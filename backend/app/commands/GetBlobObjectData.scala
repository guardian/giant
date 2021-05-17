package commands

import model.{ObjectData, ObjectMetadata, Uri}
import services.ObjectStorage
import services.manifest.Manifest
import utils.attempt.Failure

case class GetBlobObjectData(uri: Uri, manifest: Manifest, blobStorage: ObjectStorage) extends CommandCanFail[ObjectData] {
  override def process(): Either[Failure, ObjectData] = for {
    blob <- manifest.getBlob(uri)
    data <- blobStorage.get(uri.toStoragePath)
  } yield ObjectData(data, ObjectMetadata(blob.size, blob.mimeType.head.mimeType))
}
