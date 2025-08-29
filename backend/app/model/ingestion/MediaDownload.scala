package model.ingestion

import play.api.libs.json.{Format, Json}

case class MediaDownloadJob(id: String, url: String, client: String = "EXTERNAL", outputQueueUrl: String, s3OutputSignedUrl: String)
object MediaDownloadJob {
  implicit val mediaDownloadJobFormat: Format[MediaDownloadJob] = Json.format[MediaDownloadJob]
}

case class MediaDownloadOutputMetadata(title: String, extension: String, mediaPath: String, duration: String)
case class MediaDownloadOutput(id: String, status: String, metadata: Option[MediaDownloadOutputMetadata])
object MediaDownloadOutput {
  implicit val mediaDownloadOutputFormat: Format[MediaDownloadOutput] = Json.format[MediaDownloadOutput]
}
