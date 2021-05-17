package extraction

// Used during insertion of blobs to associate a blob with its appropriate extractor
class MimeTypeMapper {
  var extractors: List[Extractor] = Nil

  def getExtractorsFor(mimeType: String): List[Extractor] = extractors.filter(_.canProcessMimeType(mimeType))
  def addExtractor(extractor: Extractor): Unit = extractors = extractor :: extractors
}