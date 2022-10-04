package model.ingestion

// See https://ocrmypdf.readthedocs.io/en/latest/advanced.html#when-ocr-is-skipped for details of these flags
// also https://github.com/guardian/giant/pull/68 for a discussion of their use in giant
sealed trait OcrMyPdfFlag {
  def flag: String
}
case object RedoOcr extends OcrMyPdfFlag {
  val flag = "--redo-ocr"
}
case object SkipText extends OcrMyPdfFlag {
  val flag = "--skip-text"
}
case object ForceOcr extends OcrMyPdfFlag {
  val flag = "--force-ocr"
}