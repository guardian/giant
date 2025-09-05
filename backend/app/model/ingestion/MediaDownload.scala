package model.ingestion

import play.api.libs.json.{Format, Json}


case class MediaDownloadJob(id: String, url: String, client: String = MediaDownloadJob.CLIENT_IDENTIFIER, outputQueueUrl: String, s3OutputSignedUrl: String)
object MediaDownloadJob {
  implicit val mediaDownloadJobFormat: Format[MediaDownloadJob] = Json.format[MediaDownloadJob]
  val CLIENT_IDENTIFIER = "EXTERNAL"
}

case class MediaDownloadOutputMetadata(title: String, extension: String, mediaPath: String, duration: Int)
case class MediaDownloadOutput(id: String, status: String, metadata: Option[MediaDownloadOutputMetadata])
object MediaDownloadOutput {
  implicit val mediaDownloadOutputMetadataFormat: Format[MediaDownloadOutputMetadata] = Json.format[MediaDownloadOutputMetadata]
  implicit val mediaDownloadOutputFormat: Format[MediaDownloadOutput] = Json.format[MediaDownloadOutput]
}
