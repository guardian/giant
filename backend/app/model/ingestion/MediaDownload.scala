package model.ingestion

import play.api.libs.json.{Format, Json}


case class RemoteIngestJob(id: String, url: String, client: String = RemoteIngestJob.CLIENT_IDENTIFIER, outputQueueUrl: String, webpageSnapshotOutputSignedUrl: String, mediaDownloadOutputSignedUrl: String)
object RemoteIngestJob {
  implicit val mediaDownloadJobFormat: Format[RemoteIngestJob] = Json.format[RemoteIngestJob]
  val CLIENT_IDENTIFIER = "EXTERNAL"
}

case class MediaDownloadOutputMetadata(title: String, extension: String, mediaPath: String, duration: Int)
case class RemoteIngestOutput(id: String, status: String, outputType: String, metadata: Option[MediaDownloadOutputMetadata])
object RemoteIngestOutput {
  implicit val mediaDownloadOutputMetadataFormat: Format[MediaDownloadOutputMetadata] = Json.format[MediaDownloadOutputMetadata]
  implicit val mediaDownloadOutputFormat: Format[RemoteIngestOutput] = Json.format[RemoteIngestOutput]
}
