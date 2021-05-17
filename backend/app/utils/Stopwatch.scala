package utils

object Stopwatch {
  def measure[T](f: => T): (T, Long) = {
    val start = System.currentTimeMillis
    val result = f
    val timeTaken = System.currentTimeMillis - start
    (result, timeTaken)
  }

  def measureSideEffect(f: => Any): Long = {
    measure(f)._2
  }
}
