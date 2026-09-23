package extraction

import com.gu.transcriptionservice.workerinterface.{CombinedOutputUrl, InitialFlag, OcrJob, OcrSettings, TranscriptDestinationService}
import extraction.ocr.{BaseOcrExtractor, OcrMyPdfExtractor}
import model.manifest.Blob
import org.apache.commons.io.FileUtils
import org.joda.time.DateTime
import services.{ObjectStorage, ScratchSpace, TranscribeConfig}
import services.index.Index
import services.ingestion.IngestionServices
import software.amazon.awssdk.services.sqs.SqsClient
import utils.OcrStderrLogger
import utils.attempt.Failure

import java.io.InputStream
import java.nio.file.Files
import scala.concurrent.ExecutionContext
import scala.util.Using

class ExternalOcrMyPdfExtractor(scratch: ScratchSpace, index: Index, transcribeConfig: TranscribeConfig,
                                sourceStorage: ObjectStorage, outputStorage: ObjectStorage,
                                ingestionServices: IngestionServices, sqsClient: SqsClient)
                               (implicit ec: ExecutionContext) extends ExternalExtractor {
  override def canProcessMimeType: String => Boolean = _ == "application/pdf"
  override def indexing = true
  override def priority = 2

  override def triggerExtraction(blob: Blob, params: ExtractionParams): Either[Failure, Unit] = {
    sourceStorage.get(blob.uri.toStoragePath).flatMap { stream =>
      Using.resource(stream)(extract(blob, _, params))
    }
  }

  override def extract(blob: Blob, inputStream: InputStream, params: ExtractionParams): Either[Failure, Unit] = {
    val ocrParams = BaseOcrExtractor.withOcrLanguages(blob, params, index, name)
    val tmpDir = scratch.createWorkingDir(s"external-ocrmypdf-${blob.uri.value}")
    try {
      val input = tmpDir.resolve("input.pdf")
      Files.copy(inputStream, input, java.nio.file.StandardCopyOption.REPLACE_EXISTING)
      val stderr = new OcrStderrLogger(Some(ingestionServices.setProgressNote(blob.uri, this, _)))
      val processed = OcrMyPdfExtractor.preProcessPdf(blob, input.toFile, tmpDir, stderr)
      val inputKey = s"ocr-input/${blob.uri.value}-$name.pdf"
      val outputKey = s"ocr-output/${blob.uri.value}-$name.json"
      for {
        downloadUrl <- processed match {
          case Some(path) => for {
            _ <- outputStorage.create(inputKey, path, Some("application/pdf"))
            url <- outputStorage.getSignedUrl(inputKey)
          } yield url
          case None => sourceStorage.getSignedUrl(blob.uri.toStoragePath)
        }
        uploadUrl <- outputStorage.getUploadSignedUrl(outputKey)
        job = OcrJob(
          id = blob.uri.value,
          originalFilename = blob.uri.value,
          inputSignedUrl = downloadUrl,
          sentTimestamp = DateTime.now().toString,
          userEmail = "giant",
          transcriptDestinationService = TranscriptDestinationService.Giant,
          combinedOutputUrl = CombinedOutputUrl(uploadUrl, outputKey),
          ingestion = Some(params.ingestion),
          settings = OcrSettings(
            ocrLanguages = ocrParams.languages.map(_.ocr),
            initialFlag = Some(if (params.skipTextIngestionUris.contains(params.ingestion)) InitialFlag.SkipText else InitialFlag.RedoOcr),
            dpi = None
          )
        )
        _ <- sendToQueue(sqsClient, transcribeConfig.transcriptionServiceQueueUrl, job, blob.uri.value, name)
      } yield ()
    } finally {
      FileUtils.deleteDirectory(tmpDir.toFile)
    }
  }
}
