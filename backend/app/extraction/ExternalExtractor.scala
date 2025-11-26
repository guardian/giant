package extraction

import model.manifest.Blob
import services.manifest.WorkerManifest
import utils.Logging
import utils.attempt.Failure

import java.io.InputStream

/**
  * External Extractors are where the actual extraction doesn't take place on the worker but in some third party service
  * The behaviour is a little different as we need to trigger the extraction, then the worker can get on with other tasks
  * whilst waiting for a response from the third party service. Once the response comes in we need to store the data
  * and update the manifest to mark the extraction as complete
  */
abstract class ExternalExtractor(manifest: WorkerManifest) extends Extractor with Logging {

  override def external = true

  final override def extract(blob: Blob, inputStream: InputStream, params: ExtractionParams): Either[Failure, Unit] = {
    manifest.isBlobRecentlyProcessingExternally(blob, this).flatMap {
      case true =>
        logger.info(s"Blob ${blob.uri} is already being processed by ${this.name} - skipping extraction")
        Right(())
      case false => triggerExtraction(blob, params)
    }
  }

  def triggerExtraction(blob: Blob, params: ExtractionParams): Either[Failure, Unit]

}
