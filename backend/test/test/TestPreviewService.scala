package test

import com.amazonaws.util.StringInputStream
import model.{ObjectData, ObjectMetadata, Uri}
import services.previewing.PreviewService
import utils.attempt.Attempt

class TestPreviewService extends PreviewService {
  override def getPreviewType(uri: Uri): Attempt[String] = Attempt.Right("application/pdf")
  override def generatePreview(uri: Uri): Attempt[Unit] = Attempt.Right(())
  override def getPreviewObject(uri: Uri): Attempt[ObjectData] = Attempt.Right(ObjectData(
    new StringInputStream("Not a real preview"), ObjectMetadata(-1, "application/pdf")
  ))
}
