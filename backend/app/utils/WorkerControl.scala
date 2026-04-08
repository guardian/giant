package utils


import java.time.Instant
import java.util.Date
import org.apache.pekko.actor.{ActorSystem, Cancellable, Scheduler}
import org.apache.pekko.cluster.{Cluster, MemberStatus}
import software.amazon.awssdk.services.autoscaling.AutoScalingClient
import software.amazon.awssdk.services.autoscaling.model.{AutoScalingGroup, DescribeAutoScalingGroupsRequest, DescribeScalingActivitiesRequest, SetDesiredCapacityRequest}
import software.amazon.awssdk.services.ec2.Ec2Client
import software.amazon.awssdk.imds.Ec2MetadataClient
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

  val metadataClient = Ec2MetadataClient.create()

  def getWorkerDetails(implicit ec: ExecutionContext): Attempt[WorkerDetails] = for {
    myInstanceId <- Attempt.catchNonFatalBlasé {
        metadataClient.get("/latest/meta-data/instance-id").asString()
    }

    instances <- Attempt.catchNonFatalBlasé {
      AwsDiscovery.findRunningInstances(discoveryConfig.stack, app = List("pfi-worker", "pfi-spot-worker"), discoveryConfig.stage, ec2)
    }
  } yield {
    WorkerDetails(instances.map(_.instanceId()).toSet, myInstanceId)
  }

  private def publishStateMetrics (state: AWSWorkerControl.State): Unit = {
    metrics.updateMetric(Metrics.extractorWorkInProgress, state.inProgress)
    metrics.updateMetric(Metrics.extractorWorkOutstanding, state.outstandingFromTodos)
  }

  override def start(scheduler: Scheduler)(implicit ec: ExecutionContext): Unit = {
    (discoveryConfig.workerAutoScalingGroupName, discoveryConfig.spotWorkerAutoscalingGroupName) match {
      case (Some(workerAutoScalingGroupName), Some(spotWorkerAutoscalingGroupName)) =>
        scheduler.scheduleWithFixedDelay(config.controlInterval, config.controlInterval)(() => {
          // Only run the check on the oldest instance to get as close as we running the checks as a "singleton"
          if(runningOnOldestInstance()) {
            val state = getCurrentState(workerAutoScalingGroupName, spotWorkerAutoscalingGroupName)
            // reuse the state needed for worker control to report cloudwatch metrics on work remaining
            state.foreach(publishStateMetrics)
            if(AwsDiscovery.isRiffRaffDeployRunning(discoveryConfig.stack, discoveryConfig.stage, ec2)) {
              logger.info("AWSWorkerControl - not running check as Riff-Raff deploy is running (instances are running and tagged as Magenta:Terminate)")
            } else {
              state.foreach(s => scaleUpOrDownIfNeeded(s, workerAutoScalingGroupName, spotWorkerAutoscalingGroupName))
              breakLocksOnTerminatedWorkers()
            }
          } else {
            logger.info("AWSWorkerControl - not running check as we are not running on the oldest instance")
          }
        })

      case _ =>
        logger.warn("Missing aws.workerAutoScalingGroupName or aws.spotWorkerAutoscalingGroupName setting, cannot automatically update workers")
    }
  }

  override def stop(): Future[Unit] = {
    timerHandler.foreach(_.cancel())
    Future.successful(())
  }

  private def runningOnOldestInstance()(implicit ec: ExecutionContext): Boolean = {
    val myInstanceId = metadataClient.get("/latest/meta-data/instance-id").asString()

    val otherInstances =  AwsDiscovery.findRunningInstances(discoveryConfig.stack, app = List("pfi"), discoveryConfig.stage, ec2)

    val oldestInstance = otherInstances.toList.sortBy(_.launchTime()).headOption.map(_.instanceId())

    oldestInstance.isEmpty || oldestInstance.contains(myInstanceId)
  }

  private def scaleUpOrDownIfNeeded(state: AWSWorkerControl.State, workerAutoScalingGroupName: String, spotWorkerAutoscalingGroupName: String)(implicit ec: ExecutionContext): Unit = {
      val operation = AWSWorkerControl.decideOperation(state, Instant.now().toEpochMilli, config.controlCooldown.toMillis)
      
      logger.info(s"AWSWorkerControl on-demand asg: ${state.workerAsg} spot asg: ${state.spotWorkerAsg} inProgress: ${state.inProgress}, outstandingFromIngestStore: ${state.outstandingFromIngestStore}, outstandingFromTodos: ${state.outstandingFromTodos}, operation: $operation")

    // as this check runs every minute, we assume that if there's a difference between actual/desired workers then
    // there's a spot capacity problem, in which case we scale on demand instead of spot. Capacity is still constrained
    // by the maximum size of the spot ASG via the check in decideOperation
    val spotCapacityProblems = state.spotWorkerAsg.actualNumberOfWorkers < state.spotWorkerAsg.desiredNumberOfWorkers

      val scaleResult = operation match {
        // we scale up using the spot ASG
        case Some(AddNewWorker) if !spotCapacityProblems && state.spotWorkerAsg.desiredNumberOfWorkers < state.spotWorkerAsg.maximumNumberOfWorkers =>
          setNumberOfWorkers(state.spotWorkerAsg.desiredNumberOfWorkers + 1, spotWorkerAutoscalingGroupName)

        case Some(AddNewWorker) if state.workerAsg.desiredNumberOfWorkers < state.workerAsg.maximumNumberOfWorkers =>
          setNumberOfWorkers(state.workerAsg.desiredNumberOfWorkers + 1, workerAutoScalingGroupName)

        // when scaling down, start with the on demand ASG
        case Some(RemoveWorker) if state.workerAsg.desiredNumberOfWorkers > state.workerAsg.minimumNumberOfWorkers =>
          setNumberOfWorkers(state.workerAsg.desiredNumberOfWorkers - 1, workerAutoScalingGroupName)

        case Some(RemoveWorker) if state.spotWorkerAsg.desiredNumberOfWorkers > state.spotWorkerAsg.minimumNumberOfWorkers =>
          setNumberOfWorkers(state.spotWorkerAsg.desiredNumberOfWorkers - 1, spotWorkerAutoscalingGroupName)


        case _ =>
          Attempt.Right(())
      }

    scaleResult.recoverWith {
      case f: Failure =>
        logger.warn(s"Worker control update failed. Retry in ${config.controlInterval.toSeconds} seconds", f.toThrowable)
        Attempt.Right(())
    }
  }

  private def getAsgState(asgName: String)(implicit ec: ExecutionContext): Attempt[AWSWorkerControl.AsgState] = {
    for {
      asg <- getAutoScalingGroup(asgName)
      desiredNumberOfWorkers = asg.desiredCapacity().intValue()
      actualNumberOfWorkers = asg.instances().size()
      minimumNumberOfWorkers = asg.minSize().intValue()
      // This is not the same as the max in the auto-scaling group as we
      // need to maintain headroom to accommodate new workers during a
      // deploy even if we're scaled up due to the number of tasks
      maximumNumberOfWorkers = Math.max(asg.minSize(), asg.maxSize() / 2)
      lastEventTime <- getLastEventTime(asg.autoScalingGroupName())
    } yield {
      AWSWorkerControl.AsgState(desiredNumberOfWorkers, lastEventTime, minimumNumberOfWorkers, maximumNumberOfWorkers, actualNumberOfWorkers)
      }
    }


  private def getCurrentState(workerAutoScalingGroupName: String, workerSpotAutoscalingGroupName: String)(implicit ec: ExecutionContext): Attempt[AWSWorkerControl.State] = {
    for {
      workerAutoScalingGroup <- getAsgState(workerAutoScalingGroupName)
      spotWorkerAutoscalingGroup <- getAsgState(workerSpotAutoscalingGroupName)
      extractorWorkCounts <- Attempt.fromEither(manifest.getWorkCounts())
      filesLeftInS3UploadBucket <- Attempt.fromEither(ingestStorage.list)
    } yield {
      AWSWorkerControl.State(extractorWorkCounts.inProgress, filesLeftInS3UploadBucket.size,
        extractorWorkCounts.outstanding, workerAutoScalingGroup, spotWorkerAutoscalingGroup)
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
      val runningWorkers =
        AwsDiscovery.findRunningInstances(discoveryConfig.stack, app = List("pfi-worker", "pfi-spot-worker"), discoveryConfig.stage, ec2)
      val runningInstanceIds = runningWorkers.map(_.instanceId()).toList

      logger.info(s"Breaking locks for any worker not running. Running: [${runningInstanceIds.mkString(", ")}]")

      manifest.releaseLocksForTerminatedWorkers(runningInstanceIds)
    }
  }
}

object AWSWorkerControl {

  case class AsgState(
    desiredNumberOfWorkers: Int,
    lastEventTime: Long,
    minimumNumberOfWorkers: Int,
    maximumNumberOfWorkers: Int,
    actualNumberOfWorkers: Int
  ) {
    override def toString: String =
      s"desiredNumberOfWorkers=$desiredNumberOfWorkers, " +
        s"actualNumberOfWorkers=$actualNumberOfWorkers " +
        s"minimumNumberOfWorkers=$minimumNumberOfWorkers, " +
        s"maximumNumberOfWorkers=$maximumNumberOfWorkers, " +
        s"lastEventTime=${new Date(lastEventTime)}, "
  }

  case class State(
    inProgress: Int,
    outstandingFromIngestStore: Int,
    outstandingFromTodos: Int,
    workerAsg: AsgState,
    spotWorkerAsg: AsgState
  )

  sealed trait Operation
  case object AddNewWorker extends Operation
  case object RemoveWorker extends Operation

  def decideOperation(state: State, now: Long, cooldown: Long): Option[Operation] = {
    val inCooldown = state.workerAsg.lastEventTime > (now - cooldown) || state.spotWorkerAsg.lastEventTime > (now - cooldown)
    val manuallyScaledDown = state.workerAsg.desiredNumberOfWorkers == 0

    val outstandingInTotal = state.outstandingFromIngestStore + state.outstandingFromTodos

    if(inCooldown || manuallyScaledDown) {
      None
      // we scale to the maximum size of the spot ASG (capacity might end up being met in the on demand ASG if no spot capacity is availalbe)
    } else if(outstandingInTotal > 0 && state.spotWorkerAsg.desiredNumberOfWorkers < state.spotWorkerAsg.maximumNumberOfWorkers) {
      Some(AddNewWorker)
      // when scaling down automatically we check both asgs for excess capacity
    } else if(outstandingInTotal == 0 && state.inProgress == 0 && state.workerAsg.desiredNumberOfWorkers + state.spotWorkerAsg.desiredNumberOfWorkers > state.workerAsg.minimumNumberOfWorkers + state.spotWorkerAsg.minimumNumberOfWorkers) {
      Some(RemoveWorker)
    } else {
      None
    }
  }
}
