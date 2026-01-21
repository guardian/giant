package utils

import net.logstash.logback.marker.Markers.appendEntries
import utils.attempt.Attempt

import scala.concurrent.ExecutionContext
import scala.jdk.CollectionConverters._

object Stopwatch extends Logging {
  def measure[T](f: => T): (T, Long) = {
    val start = System.currentTimeMillis
    val result = f
    val timeTaken = System.currentTimeMillis - start
    (result, timeTaken)
  }

  def measureAndLog[T](f: => T, task: String, id: String): T = {
    val res = measure(f)
    logTiming(task, id, res._2)
    res._1
  }

  def measureAttempt[T](body: => Attempt[T])(implicit executionContext: ExecutionContext): AttemptTimeTracker[T] =
    new AttemptTimeTracker(body)

  def logTiming(task: String, id: String, timeTaken: Long): Unit = {
    val marker = appendEntries(Map(
      "timeTaken" -> timeTaken,
      "id" -> id,
      "task" -> task
    ).asJava)
    logger.info(marker, s"$task with id $id completed in time $timeTaken")
  }
}

//heavily inspired by https://chaitanyawaikar1993.medium.com/tracking-time-of-futures-in-scala-b64c71b965db
class AttemptTimeTracker[T](body: => Attempt[T])(implicit executionContext: ExecutionContext) extends Logging  {

  private val start = System.currentTimeMillis()

  def track(task: String, id: String): Attempt[T] = {
    body.asFuture.andThen {
      case _ =>
        val timeTaken = System.currentTimeMillis() - start
        Stopwatch.logTiming(task, id, timeTaken)
    }
    body
  }
}
