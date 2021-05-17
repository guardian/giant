package commands

import model.manifest.Blob
import model.{VerifyRequestFile, VerifyResponse}
import services.manifest.Manifest
import utils.attempt.Failure

class VerifyIngestion(files: List[VerifyRequestFile], manifest: Manifest) extends CommandCanFail[VerifyResponse] {
  override def process(): Either[Failure, VerifyResponse] = {
    manifest.getBlobsForFiles(files.map(_.path)).map { blobs =>
      val base = VerifyResponse(blobs.size, List.empty, Map.empty)
      files.foldLeft(base) { (acc, f) => verify(acc, f, blobs) }
    }
  }

  def verify(acc: VerifyResponse, file: VerifyRequestFile, blobs: Map[String, Blob]): VerifyResponse = {
    (blobs.get(file.path), file.fingerprint) match {
      case (Some(blob), Some(fingerprint)) if blob.uri.value != fingerprint =>
        acc.copy(filesInError = acc.filesInError + (file.path -> s"Digest error. Expected $fingerprint. Got ${blob.uri.value}"))

      case (None, _) =>
        acc.copy(filesNotIndexed = acc.filesNotIndexed :+ file.path)

      case _ =>
        acc
    }
  }
}

object VerifyIngestion {
  def relativise(collection: String, ingestion: String, files: List[VerifyRequestFile]): List[VerifyRequestFile] = {
    files.map {
      case VerifyRequestFile(path, fingerprint) => VerifyRequestFile(s"$collection/$ingestion/$path", fingerprint)
    }
  }
}
