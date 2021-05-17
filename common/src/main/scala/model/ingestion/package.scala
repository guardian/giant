package model

import java.util.UUID

package object ingestion {
  type Key = (Long, UUID)
  implicit class RichKey(key: Key) {
    def asObjectKey = s"${key._1}_${key._2}"
  }

  val dataPrefix = "data/"
  val metadataPrefix = "metadata/"
  val dataSuffix = ".data"
  val metadataSuffix = ".metadata.json"

  def dataKey(key: Key): String = s"$dataPrefix${key.asObjectKey}$dataSuffix"
  def metadataKey(key: Key): String = s"$metadataPrefix${key.asObjectKey}$metadataSuffix"
}
