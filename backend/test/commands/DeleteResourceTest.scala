package commands

import model.Uri
import org.scalamock.scalatest.MockFactory
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers
import services.ObjectStorage
import services.index.Index
import services.manifest.Manifest
import services.observability.PostgresClientDoNothing
import test.AttemptValues
import utils.attempt.Attempt

import scala.concurrent.ExecutionContext

class DeleteResourceTest extends AnyFreeSpec with Matchers with MockFactory with AttemptValues {

  // Run everything synchronously on the test thread: the orchestration fans out across Futures,
  // but scalamock expects calls on a single thread, and this keeps the assertions deterministic.
  implicit val ec: ExecutionContext = ExecutionContext.parasitic

  "DeleteResource.deleteBlob" - {
    "cleans up every store and reports success" in {
      val manifest = mock[Manifest]
      val index = mock[Index]
      val previewStorage = mock[ObjectStorage]
      val objectStorage = mock[ObjectStorage]

      val uri = Uri("some-blob-id")

      // No OCR languages, so only the two legacy preview prefixes are listed.
      (manifest.getLanguagesProcessedByOcrMyPdf _).expects(uri).returning(Attempt.Right(List.empty)).once()
      (previewStorage.list _).expects(*).returning(Right(List.empty)).twice()
      (previewStorage.deleteMultiple _).expects(*).returning(Right(())).once()
      (objectStorage.delete _).expects(*).returning(Right(())).once()
      (manifest.deleteBlob _).expects(uri).returning(Attempt.Right(())).once()
      (index.delete _).expects(uri.value).returning(Attempt.Right(())).once()

      val deleteResource = new DeleteResource(manifest, index, previewStorage, objectStorage, new PostgresClientDoNothing)

      deleteResource.deleteBlob(uri.value).successValue
    }
  }
}
