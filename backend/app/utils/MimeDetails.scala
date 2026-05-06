package utils

import play.api.libs.json._

case class MimeDetails(display: String, category: String = "document", explanation: Option[String] = None)

object MimeDetails {
  implicit val mimeDetailsFormat: Format[MimeDetails] = Json.format[MimeDetails]

  /** Strip MIME type parameters (e.g. "text/csv; charset=UTF-8" -> "text/csv") */
  private def baseType(mimeType: String): String =
    mimeType.indexOf(';') match {
      case -1 => mimeType
      case i  => mimeType.substring(0, i).trim
    }

  def get(key: String): Option[MimeDetails] =
    displayMap.get(key).orElse(displayMap.get(baseType(key)))

  /** Determine the file category for a given MIME type string.
    * Uses the explicit map first, then falls back to prefix-based detection.
    *
    * Valid categories: document, pdf, video, audio, image, spreadsheet, presentation, archive, web, email, technical */
  def categoryFor(mimeType: String): String = {
    val base = baseType(mimeType)
    displayMap.get(mimeType).orElse(displayMap.get(base)).map(_.category).getOrElse {
      if (base.startsWith("video/")) "video"
      else if (base.startsWith("audio/")) "audio"
      else if (base.startsWith("image/")) "image"
      else if (base.startsWith("message/")) "email"
      else "document"
    }
  }

  // Mimetype display mappings
  // Basic Guidelines::
  //   * Prefer a shorter description if possible. E.g. "PDF" rather than "Portable Document Format" or "PDF File", if it's a slightly unusual format or something people are unlikely to be familiar with then it's ok to be explicit
  //   * Avoid needless descriptors like "File", "Source" or "Script". Unless there's possible confusion, e.g. "SQL Database" and "SQL Script" should be clear
  //   * It'd be nice if you sort each section once you add a new display value. In vim you can select a block with Shift+v and type :sort.
  val displayMap = Map(
    // Application
    "application/dita+xml; format=concept" -> MimeDetails("DITA Concept", category = "technical"),
    "application/dita+xml; format=map" -> MimeDetails("DITA Map", category = "technical"),
    "application/dita+xml; format=task" -> MimeDetails("DITA Task", category = "technical"),
    "application/dita+xml; format=topic" -> MimeDetails("DITA Topic", category = "technical"),
    "application/gzip" -> MimeDetails("GZip Archive", category = "archive"),
    "application/java-archive" -> MimeDetails("Java Archive", category = "archive"),
    "application/java-serialized-object" -> MimeDetails("Java Serialized Object", category = "technical"),
    "application/java-vm" -> MimeDetails("Java Bytecode", category = "technical", explanation = Some("Java bytecode, usually in the form of a `.class` file")),
    "application/javascript" -> MimeDetails("Javascript", category = "technical"),
    "application/msword" -> MimeDetails("Microsoft Word"),
    "application/mxf" -> MimeDetails("Material Exchange Format", category = "video", explanation = Some("A container format for digital audio and video media.")),
    "application/octet-stream" -> MimeDetails("Unknown Binary"),
    "application/pdf" -> MimeDetails("PDF", category = "pdf"),
    "application/pkcs7-signature" -> MimeDetails("PKCS7 Signature"),
    "application/postscript" -> MimeDetails("Postscript"),
    "application/rtf" -> MimeDetails("Rich Text"),
    "application/sldworks" -> MimeDetails("SolidWorks", category = "technical"),
    "application/vnd.adobe.indesign-idml-package" -> MimeDetails("InDesign IDML Package"),
    "application/vnd.android.package-archive" -> MimeDetails("Android APK", category = "archive"),
    "application/vnd.apple.keynote" -> MimeDetails("Apple Keynote", category = "presentation"),
    "application/vnd.google-earth.kml+xml" -> MimeDetails("KML", category = "technical"),
    "application/vnd.google-earth.kmz" -> MimeDetails("KMZ", category = "technical"),
    "application/vnd.ms-cab-compressed" -> MimeDetails("Microsoft Compressed Cabinet", category = "archive"),
    "application/vnd.ms-excel" -> MimeDetails("Microsoft Excel", category = "spreadsheet"),
    "application/vnd.ms-excel.sheet.binary.macroenabled.12" -> MimeDetails("Microsoft Excel (Binary, Macros Enabled)", category = "spreadsheet"),
    "application/vnd.ms-excel.sheet.macroenabled.12" -> MimeDetails("Microsoft Excel (Macros Enabled)", category = "spreadsheet"),
    "application/vnd.ms-outlook" -> MimeDetails("Microsoft Outlook Message", category = "email"),
    "application/vnd.ms-outlook-olm" -> MimeDetails("Microsoft Outlook OLM", category = "email"),
    "application/vnd.ms-outlook-pst" -> MimeDetails("Microsoft Outlook PST", category = "email"),
    "application/vnd.ms-pki.seccat" -> MimeDetails("Microsoft PKI Signed Catalog "),
    "application/vnd.ms-powerpoint" -> MimeDetails("Microsoft Powerpoint", category = "presentation"),
    "application/vnd.ms-powerpoint.presentation.macroenabled.12" -> MimeDetails("Microsoft Powerpoint Presentation (Macros Enabled)", category = "presentation"),
    "application/vnd.ms-powerpoint.slideshow.macroenabled.12" -> MimeDetails("Microsoft Powerpoint Slideshow (Macros Enabled)", category = "presentation"),
    "application/vnd.ms-project" -> MimeDetails("Microsoft Project"),
    "application/vnd.ms-spreadsheetml" -> MimeDetails("Microsoft SpreadSheet", category = "spreadsheet"),
    "application/vnd.ms-tnef" -> MimeDetails("Microsoft TNEF", category = "email"),
    "application/vnd.ms-visio.drawing" -> MimeDetails("Microsoft Visio Drawing"),
    "application/vnd.ms-word.document.macroenabled.12" -> MimeDetails("Microsoft Word (Macros Enabled)"),
    "application/vnd.ms-word2006ml" -> MimeDetails("Microsoft Word"),
    "application/vnd.ms-wordml" -> MimeDetails("Microsoft Word"),
    "application/vnd.ms-xpsdocument" -> MimeDetails("XPS Document"),
    "application/vnd.oasis.opendocument.text" -> MimeDetails("OpenDocument Text"),
    "application/vnd.openxmlformats-officedocument" -> MimeDetails("Unknown Office Document"),
    "application/vnd.openxmlformats-officedocument.presentationml.presentation" -> MimeDetails("Office Presentation", category = "presentation"),
    "application/vnd.openxmlformats-officedocument.presentationml.slideshow" -> MimeDetails("Office Slideshow", category = "presentation"),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" -> MimeDetails("Office Spreadsheet", category = "spreadsheet"),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.template" -> MimeDetails("Office Spreadsheet Template", category = "spreadsheet"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document" -> MimeDetails("Office Document"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.template" -> MimeDetails("Office Document Template"),
    "application/vnd.tcpdump.pcap" -> MimeDetails("PCAP Network Capture", category = "technical"),
    "application/vnd.visio" -> MimeDetails("Microsoft Visio"),
    "application/winhlp" -> MimeDetails("Windows Help File"),
    "application/x-7z-compressed" -> MimeDetails("7-Zip Archive", category = "archive"),
    "application/x-adobe-indesign" -> MimeDetails("Adobe InDesign"),
    "application/x-bplist" -> MimeDetails("Binary PList", category = "technical"),
    "application/x-bzip2" -> MimeDetails("BZip2 Archive", category = "archive"),
    "application/x-compress" -> MimeDetails("Compress Archive", category = "archive"),
    "application/x-dbf" -> MimeDetails("dBASE", category = "technical"),
    "application/x-dex" -> MimeDetails("Android DEX", category = "technical"),
    "application/x-dosexec" -> MimeDetails("DOS Executable", category = "technical"),
    "application/x-font-otf" -> MimeDetails("OpenType Font", category = "technical"),
    "application/x-font-ttf" -> MimeDetails("TrueType Font", category = "technical"),
    "application/x-gtar" -> MimeDetails("GNU Tar Archive", category = "archive"),
    "application/x-iso9660-image" -> MimeDetails("ISO Disc Image", category = "archive"),
    "application/x-java-jnilib" -> MimeDetails("Java JNI Library", category = "technical"),
    "application/x-matroska" -> MimeDetails("Matroska", category = "video"),
    "application/x-ms-owner" -> MimeDetails("Microsoft Owner", explanation = Some("These are used to indicate what owner is currently editing a file in the Windows operating system")),
    "application/x-msaccess" -> MimeDetails("Microsoft Access"),
    "application/x-msdownload" -> MimeDetails("Microsoft Download", category = "technical", explanation = Some("This type is sometimes detected for Windows executable files and libraries (.dll)")),
    "application/x-msdownload; format=pe" -> MimeDetails("Microsoft Download (PE)", category = "technical", explanation = Some("A portable subtype of the `application/x-msdownload` mime type. Often associated with executable and library (`.dll`) files.")),
    "application/x-msdownload; format=pe32" -> MimeDetails("Microsoft Download (PE32)", category = "technical", explanation = Some("A 32 bit portable subtype of the `application/x-msdownload` mime type. Often associated with executable and library (`.dll`) files.")),
    "application/x-mspublisher" -> MimeDetails("Microsoft Publisher"),
    "application/x-rar-compressed" -> MimeDetails("RAR Archive", category = "archive"),
    "application/x-rar-compressed; version=4" -> MimeDetails("RAR Archive", category = "archive"),
    "application/x-rar-compressed; version=5" -> MimeDetails("RAR Archive", category = "archive"),
    "application/x-sh" -> MimeDetails("Shell Script", category = "technical"),
    "application/x-shapefile" -> MimeDetails("Shapefile", category = "technical"),
    "application/x-sharedlib" -> MimeDetails("Shared Library", category = "technical"),
    "application/x-sqlite3" -> MimeDetails("SQLite3", category = "technical"),
    "application/x-tar" -> MimeDetails("Tar Archive", category = "archive"),
    "application/x-tika-msoffice" -> MimeDetails("Unknown Microsoft Office"),
    "application/x-tika-ooxml" -> MimeDetails("Open Office XML"),
    "application/x-tika-ooxml-protected" -> MimeDetails("Open Office XML (Protected)"),
    "application/x-xz" -> MimeDetails("XZ Archive", category = "archive"),
    "application/xhtml+xml" -> MimeDetails("XHTML", category = "web"),
    "application/xml" -> MimeDetails("XML", category = "technical"),
    "application/zip" -> MimeDetails("Zip Archive", category = "archive"),
    "application/zlib" -> MimeDetails("ZLib Archive", category = "archive"),

    // Audio
    "audio/amr" -> MimeDetails("AMR", category = "audio"),
    "audio/mp4" -> MimeDetails("MP4", category = "audio"),
    "audio/mpeg" -> MimeDetails("MPEG", category = "audio"),
    "audio/opus" -> MimeDetails("Opus", category = "audio"),
    "audio/vnd.wave" -> MimeDetails("WAV", category = "audio"),
    "audio/vorbis" -> MimeDetails("Vorbis", category = "audio"),
    "audio/x-aiff" -> MimeDetails("AIFF", category = "audio"),
    "audio/x-ms-wma" -> MimeDetails("Microsoft WMA", category = "audio"),
    "audio/x-wav" -> MimeDetails("WAV", category = "audio"),

    // Image
    "image/bmp" -> MimeDetails("BMP", category = "image"),
    "image/gif" -> MimeDetails("GIF", category = "image"),
    "image/heic" -> MimeDetails("HEIC", category = "image"),
    "image/icns" -> MimeDetails("ICNS", category = "image", explanation = Some("Apple Icon Image format")),
    "image/jpeg" -> MimeDetails("JPEG", category = "image"),
    "image/png" -> MimeDetails("PNG", category = "image"),
    "image/svg+xml" -> MimeDetails("SVG", category = "image"),
    "image/tiff" -> MimeDetails("TIFF", category = "image"),
    "image/vnd.adobe.photoshop" -> MimeDetails("Adobe Photoshop", category = "image"),
    "image/vnd.dwg" -> MimeDetails("AutoCAD Drawing", category = "technical"),
    "image/vnd.dxf; format=ascii" -> MimeDetails("AutoCAD DXF", category = "technical"),
    "image/vnd.microsoft.icon" -> MimeDetails("Microsoft ICO", category = "image"),
    "image/webp" -> MimeDetails("WebP", category = "image"),
    "image/wmf" -> MimeDetails("Windows Metafile", category = "image"),
    "image/x-ms-bmp" -> MimeDetails("Microsoft BMP", category = "image"),

    // Message
    "message/rfc822" -> MimeDetails("Email (RFC822)", category = "email"),

    // Multipart
    "multipart/appledouble" -> MimeDetails("AppleDouble File Format", explanation = Some("Some files created on Apple systems will be stored as 'AppleDouble' which is used for separating the resource data from the Finder metadata. It's unlikely there will be a lot of these but it depends entirely on the dump and how the MIME types are parsed.")),

    // Text
    "text/calendar" -> MimeDetails("iCalendar", category = "email"),
    "text/css" -> MimeDetails("CSS", category = "technical"),
    "text/csv" -> MimeDetails("CSV", category = "spreadsheet"),
    "text/html" -> MimeDetails("HTML", category = "web"),
    "text/plain" -> MimeDetails("Plain"),
    "text/x-ini" -> MimeDetails("INI Config File", category = "technical"),
    "text/x-java-properties" -> MimeDetails("Java Properties", category = "technical"),
    "text/x-log" -> MimeDetails("Log", category = "technical"),
    "text/x-matlab" -> MimeDetails("Matlab", category = "technical", explanation = Some("Matlab is a programming language often used for numerical computing.")),
    "text/x-php" -> MimeDetails("PHP", category = "technical"),
    "text/x-python" -> MimeDetails("Python", category = "technical"),
    "text/x-sql" -> MimeDetails("SQL Script", category = "technical"),
    "text/x-vcard" -> MimeDetails("vCard", category = "email"),
    "text/x-web-markdown" -> MimeDetails("Markdown"),

    // Video
    "video/3gpp" -> MimeDetails("3GP", category = "video"),
    "video/mp4" -> MimeDetails("MP4", category = "video"),
    "video/mpeg" -> MimeDetails("MPEG", category = "video"),
    "video/quicktime" -> MimeDetails("Quicktime", category = "video"),
    "video/x-m4v" -> MimeDetails("M4V", category = "video", explanation = Some("M4V is a video container developed by Apple often used to encode video files in the iTunes store.")),
    "video/x-ms-wmv" -> MimeDetails("Microsoft WMV", category = "video"),
    "video/x-msvideo" -> MimeDetails("Microsoft AVI", category = "video")
  )
}
