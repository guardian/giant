package utils

import utils.attempt.Attempt

import scala.concurrent.ExecutionContext

trait Timing extends Logging {
  private def log(name: String, totalElapsedMilliseconds: Long): Unit = {
    val elapsedMilliseconds =(totalElapsedMilliseconds % 1000).toInt
    val elapsedSeconds = (totalElapsedMilliseconds / 1000).toInt
    val elapsedMinutes = elapsedSeconds / 60
    logger.info(s"${name}: took ${elapsedMinutes} minutes ${elapsedSeconds} seconds ${elapsedMilliseconds} milliseconds")
  }
  def timeAsync[T](name: String, attempt: => Attempt[T])(implicit ec: ExecutionContext): Attempt[T] = {
    val start = System.currentTimeMillis()

    attempt.map { result =>
      val end = System.currentTimeMillis()
      log(name, end - start)
      result
    }
  }

  def timeSync[T](name: String, block: => T): T = {
    val start = System.currentTimeMillis()
    val res = block
    val end = System.currentTimeMillis()

    log(name, end - start)

    res
  }
}
