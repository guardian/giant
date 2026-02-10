package utils


import java.time.Instant
import java.util.Date
import org.apache.pekko.actor.{ActorSystem, Cancellable, Scheduler}
import org.apache.pekko.cluster.{Cluster, MemberStatus}
import software.amazon.awssdk.services.autoscaling.AutoScalingClient
import software.amazon.awssdk.services.autoscaling.model.{AutoScalingGroup, DescribeAutoScalingGroupsRequest, DescribeScalingActivitiesRequest, SetDesiredCapacityRequest}
import software.amazon.awssdk.services.ec2.Ec2Client
import com.amazonaws.util.EC2MetadataUtils
import services.manifest.WorkerManifest
import services.{AWSDiscoveryConfig, IngestStorage, MetricUpdate, Metrics, MetricsService, WorkerConfig}
import utils.AWSWorkerControl.{AddNewWorker, RemoveWorker}
import utils.attempt.{Attempt, Failure, IllegalStateFailure}

import scala.jdk.CollectionConverters._
import scala.concurrent.{ExecutionContext, Future}

case class WorkerDetails(nodes: Set[String], thisNode: String)

trait WorkerControl {
  def getWorkerDetails(implicit ec: ExecutionContext): Attempt[WorkerDetails]

  def start(scheduler: Scheduler)(implicit ec: ExecutionContext): Unit
  def stop(): Future[Unit]
}

class PekkoWorkerControl(actorSystem: ActorSystem) extends WorkerControl {
  private val cluster = Cluster(actorSystem)

  override def getWorkerDetails(implicit ec: ExecutionContext): Attempt[WorkerDetails] = Attempt.catchNonFatalBlasé {
    val state = cluster.state
    val members = state.members.filter(_.status == MemberStatus.Up).map(_.uniqueAddress.toString)

    WorkerDetails(members, cluster.selfUniqueAddress.toString)
  }

  // We don't manually spin up and down the Pekko cluster, it's done for us
  override def start(scheduler: Scheduler)(implicit ec: ExecutionContext): Unit = {}
  override def stop(): Future[Unit] = Future.successful(())
}

class AWSWorkerControl(config: WorkerConfig, discoveryConfig: AWSDiscoveryConfig, ingestStorage: IngestStorage, manifest: WorkerManifest, metrics: MetricsService)
  extends WorkerControl with Logging {

  val credentialsV2 = AwsCredentials.credentialsV2()

  val ec2 = Ec2Client.builder().region(discoveryConfig.regionV2).credentialsProvider(credentialsV2).build()
  val autoscaling = AutoScalingClient.builder().credentialsProvider(credentialsV2).region(discoveryConfig.regionV2).build()

  var timerHandler: Option[Cancellable] = None

  def getWorkerDetails(implicit ec: ExecutionContext): Attempt[WorkerDetails] = for {
    myInstanceId <- Attempt.catchNonFatalBlasé { EC2MetadataUtils.getInstanceId }
    instances <- Attempt.catchNonFatalBlasé {
      AwsDiscovery.findRunningInstances(discoveryConfig.stack, app = "pfi-worker", discoveryConfig.stage, ec2)
    }
  } yield {
    WorkerDetails(instances.map(_.instanceId()).toSet, myInstanceId)
  }

  override def start(scheduler: Scheduler)(implicit ec: ExecutionContext): Unit = {
    discoveryConfig.workerAutoScalingGroupName match {
      case Some(workerAutoScalingGroupName) =>
        scheduler.scheduleWithFixedDelay(config.controlInterval, config.controlInterval)(() => {
          // Only run the check on the oldest instance to get as close as we running the checks as a "singleton"
          if(runningOnOldestInstance()) {
            if(AwsDiscovery.isRiffRaffDeployRunning(discoveryConfig.stack, discoveryConfig.stage, ec2)) {
              logger.info("AWSWorkerControl - not running check as Riff-Raff deploy is running (instances are running and tagged as Magenta:Terminate)")
            } else {
              scaleUpOrDownIfNeeded(workerAutoScalingGroupName)
              breakLocksOnTerminatedWorkers()
            }
          } else {
            logger.info("AWSWorkerControl - not running check as we are not running on the oldest instance")
          }
        })

      case None =>
        logger.warn("Missing aws.workerAutoScalingGroupName setting, cannot automatically update workers")
    }
  }

  override def stop(): Future[Unit] = {
    timerHandler.foreach(_.cancel())
    Future.successful(())
  }

  private def runningOnOldestInstance()(implicit ec: ExecutionContext): Boolean = {
    val myInstanceId = EC2MetadataUtils.getInstanceId
    val otherInstances =  AwsDiscovery.findRunningInstances(discoveryConfig.stack, app = "pfi", discoveryConfig.stage, ec2)

    val oldestInstance = otherInstances.toList.sortBy(_.launchTime()).headOption.map(_.instanceId())

    oldestInstance.isEmpty || oldestInstance.contains(myInstanceId)
  }

  private def scaleUpOrDownIfNeeded(workerAutoScalingGroupName: String)(implicit ec: ExecutionContext): Unit = {
    getCurrentState(workerAutoScalingGroupName).flatMap { state =>
      val operation = AWSWorkerControl.decideOperation(state, Instant.now().toEpochMilli, config.controlCooldown.toMillis)
      
      logger.info(s"AWSWorkerControl desiredNumberOfWorkers: ${state.desiredNumberOfWorkers}, inProgress: ${state.inProgress}, outstandingFromIngestStore: ${state.outstandingFromIngestStore}, outstandingFromTodos: ${state.outstandingFromTodos} lastEventTime: ${new Date(state.lastEventTime)}, minimumNumberOfWorkers: ${state.minimumNumberOfWorkers}, maximumNumberOfWorkers: ${state.maximumNumberOfWorkers}, operation: $operation")

      // side effect here unrelated to scaling! Just a convenient place to report these metrics without setting up a separate task and hit neo4j again
      metrics.updateMetric(Metrics.extractorWorkInProgress, state.inProgress)
      metrics.updateMetric(Metrics.extractorWorkOutstanding, state.outstandingFromTodos)

      operation match {
        case Some(AddNewWorker) if state.desiredNumberOfWorkers < state.maximumNumberOfWorkers =>
          setNumberOfWorkers(state.desiredNumberOfWorkers + 1, workerAutoScalingGroupName)

        case Some(RemoveWorker) if state.desiredNumberOfWorkers > state.minimumNumberOfWorkers =>
          setNumberOfWorkers(state.desiredNumberOfWorkers - 1, workerAutoScalingGroupName)

        case _ =>
          Attempt.Right(())
      }
    }.recoverWith {
      case f: Failure =>
        logger.warn(s"Worker control update failed. Retry in ${config.controlInterval.toSeconds} seconds", f.toThrowable)
        Attempt.Right(())
    }
  }

  private def getCurrentState(workerAutoScalingGroupName: String)(implicit ec: ExecutionContext): Attempt[AWSWorkerControl.State] = {
    for {
      workerAutoScalingGroup <- getAutoScalingGroup(workerAutoScalingGroupName)
      desiredNumberOfWorkers = workerAutoScalingGroup.desiredCapacity().intValue()
      minimumNumberOfWorkers = workerAutoScalingGroup.minSize().intValue()
      // This is not the same as the max in the auto-scaling group as we
      // need to maintain headroom to accommodate new workers during a
      // deploy even if we're scaled up due to the number of tasks
      maximumNumberOfWorkers = Math.max(workerAutoScalingGroup.minSize(), workerAutoScalingGroup.maxSize() / 2)
      lastEventTime <- getLastEventTime(workerAutoScalingGroup.autoScalingGroupName())

      extractorWorkCounts <- Attempt.fromEither(manifest.getWorkCounts())
      filesLeftInS3UploadBucket <- Attempt.fromEither(ingestStorage.list)
    } yield {
      AWSWorkerControl.State(desiredNumberOfWorkers, extractorWorkCounts.inProgress, filesLeftInS3UploadBucket.size,
        extractorWorkCounts.outstanding, lastEventTime, minimumNumberOfWorkers, maximumNumberOfWorkers)
    }
  }

  private def getAutoScalingGroup(workerAutoScalingGroupName: String)(implicit ec: ExecutionContext): Attempt[AutoScalingGroup] = {
    Attempt.catchNonFatalBlasé {
      val request = DescribeAutoScalingGroupsRequest.builder().autoScalingGroupNames(workerAutoScalingGroupName).build()
      autoscaling.describeAutoScalingGroups(request)
    }.flatMap { response =>
      response.autoScalingGroups().asScala.headOption match {
        case Some(asg) =>
          Attempt.Right(asg)

        case None =>
          Attempt.Left(IllegalStateFailure(s"Could not find worker auto-scaling group $workerAutoScalingGroupName"))
      }
    }
  }

  private def getLastEventTime(workerAutoScalingGroupName: String)(implicit ec: ExecutionContext): Attempt[Long] = {
    Attempt.catchNonFatalBlasé {
      val request = DescribeScalingActivitiesRequest.builder().autoScalingGroupName(workerAutoScalingGroupName).build()
      autoscaling.describeScalingActivities(request)
    }.flatMap { response =>
      // events are returned with the latest first
      response.activities().asScala.headOption match {
        case Some(event) => Attempt.Right(event.startTime().toEpochMilli)
        case None => Attempt.Left(IllegalStateFailure(s"No events on autoscaling group $workerAutoScalingGroupName"))
      }
    }
  }

  private def setNumberOfWorkers(numberOfWorkers: Int, workerAutoScalingGroupName: String): Attempt[Unit] = {
    Attempt.catchNonFatalBlasé {
      logger.info(s"Worker control updating number of workers in $workerAutoScalingGroupName to $numberOfWorkers")

      val request = SetDesiredCapacityRequest.builder()
        .autoScalingGroupName(workerAutoScalingGroupName)
        .desiredCapacity(numberOfWorkers).build()

      autoscaling.setDesiredCapacity(request)
    }
  }

  private def breakLocksOnTerminatedWorkers(): Attempt[Unit] = {
    Attempt.catchNonFatalBlasé {
      val runningWorkers = AwsDiscovery.findRunningInstances(discoveryConfig.stack, app = "pfi-worker", discoveryConfig.stage, ec2)
      val runningInstanceIds = runningWorkers.map(_.instanceId()).toList

      logger.info(s"Breaking locks for any worker not running. Running: [${runningInstanceIds.mkString(", ")}]")

      manifest.releaseLocksForTerminatedWorkers(runningInstanceIds)
    }
  }
}

object AWSWorkerControl {
  case class State(
    desiredNumberOfWorkers: Int,
    inProgress: Int,
    outstandingFromIngestStore: Int,
    outstandingFromTodos: Int,
    lastEventTime: Long,
    minimumNumberOfWorkers: Int,
    maximumNumberOfWorkers: Int
  )

  sealed trait Operation
  case object AddNewWorker extends Operation
  case object RemoveWorker extends Operation

  def decideOperation(state: State, now: Long, cooldown: Long): Option[Operation] = {
    val inCooldown = state.lastEventTime > (now - cooldown)
    val manuallyScaledDown = state.desiredNumberOfWorkers == 0

    val outstandingInTotal = state.outstandingFromIngestStore + state.outstandingFromTodos

    if(inCooldown || manuallyScaledDown) {
      None
    } else if(outstandingInTotal > 0 && state.desiredNumberOfWorkers < state.maximumNumberOfWorkers) {
      Some(AddNewWorker)
    } else if(outstandingInTotal == 0 && state.inProgress == 0 && state.desiredNumberOfWorkers > state.minimumNumberOfWorkers) {
      Some(RemoveWorker)
    } else {
      None
    }
  }
}
