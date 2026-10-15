package extraction.ocr

import model.{English, Uri}
import org.apache.pdfbox.pdmodel.{PDDocument, PDPage}
import org.scalamock.scalatest.MockFactory
import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers
import services.ObjectStorage
import services.index.Index
import utils.attempt.{Attempt, IllegalStateFailure}

import java.nio.file.Files
import scala.concurrent.ExecutionContext.Implicits.global
import scala.util.Using

class OcrMyPdfImageExtractorTest extends AnyFlatSpec with Matchers with MockFactory {
  private val uri = Uri("image")

  it should "store an image's PDF preview and index empty OCR as absent text" in {
    val path = Files.createTempFile("image-ocr", ".pdf")
    try {
      Using.resource(new PDDocument()) { document =>
        document.addPage(new PDPage())
        document.save(path.toFile)
      }
      val storage = mock[ObjectStorage]
      val index = mock[Index]
      (storage.create _).expects(uri.toStoragePath, path, Some("application/pdf")).returning(Right(()))
      (index.addDocumentOcr _).expects(uri, None, English).returning(Attempt.Right(()))

      val text = OcrMyPdfImageExtractor.postProcessPdf(List(English -> path), uri, storage, index)
      text(English).trim shouldBe empty
    } finally Files.deleteIfExists(path)
  }

  it should "propagate preview upload failures so external results can be retried" in {
    val path = Files.createTempFile("image-ocr", ".pdf")
    try {
      Using.resource(new PDDocument()) { document =>
        document.addPage(new PDPage())
        document.save(path.toFile)
      }
      val storage = mock[ObjectStorage]
      val index = mock[Index]
      (storage.create _).expects(uri.toStoragePath, path, Some("application/pdf"))
        .returning(Left(IllegalStateFailure("upload failed")))

      intercept[Throwable] {
        OcrMyPdfImageExtractor.postProcessPdf(List(English -> path), uri, storage, index)
      }.getMessage should include("upload failed")
    } finally Files.deleteIfExists(path)
  }
}
