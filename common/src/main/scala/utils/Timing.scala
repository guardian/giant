package utils

import utils.attempt.Attempt

import scala.concurrent.ExecutionContext

trait Timing extends Logging {
  private def log(name: String, totalElapsedNanoseconds: Long): Unit = {
    // TODO: use Duration instead?
    val elapsedNanoseconds = (totalElapsedNanoseconds % 1000000).toInt
    val elapsedMilliseconds =(totalElapsedNanoseconds / 1000000).toInt
    val elapsedSeconds = (elapsedMilliseconds / 1000).toInt
    val elapsedMinutes = (elapsedSeconds / 60).toInt
    logger.info(s"${name}: took ${elapsedMinutes} minutes ${elapsedSeconds} seconds ${elapsedMilliseconds} milliseconds ${elapsedNanoseconds} nanoseconds")
  }
  def timeAsync[T](name: String, attempt: => Attempt[T])(implicit ec: ExecutionContext): Attempt[T] = {
    val start = System.nanoTime()

    attempt.map { result =>
      val end = System.nanoTime()
      log(name, end - start)
      result
    }
  }

  def timeSync[T](name: String, block: => T): T = {
    val start = System.nanoTime()
    val res = block
    val end = System.nanoTime()

    log(name, end - start)

    res
  }
}
