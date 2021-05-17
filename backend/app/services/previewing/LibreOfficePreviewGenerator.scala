package services.previewing

import java.nio.file.Path

object LibreOfficePreviewGenerator {
  val supportedMimeTypes: Set[String] = Set(
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    // TODO MRB: all supported Open Office MIME types
  )

  def isSupported(mimeType: String): Boolean = {
    supportedMimeTypes.contains(mimeType)
  }
}

class LibreOfficePreviewGenerator(binary: String, workspace: Path) extends PreviewGenerator(workspace) {
  override def buildCommand(workspace: String, input: String, output: String): Seq[String] = {
    Seq(binary, "--headless", "--convert-to", "pdf", "--outdir", workspace, input)
  }

  def isSupported(mimeType: String): Boolean = LibreOfficePreviewGenerator.isSupported(mimeType)
}
