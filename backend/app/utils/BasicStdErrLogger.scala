package utils

import scala.collection.mutable

class BasicStdErrLogger extends Logging {
  val acc = mutable.Buffer[String]()

  def append(line: String): Unit = {
    acc.append(line)

    logger.info(line)
  }

  def getOutput: String = {
    acc.mkString("\n")
  }
}
