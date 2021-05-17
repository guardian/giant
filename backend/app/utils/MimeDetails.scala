package utils

import play.api.libs.json._

case class MimeDetails(display: String, explanation: Option[String] = None)

object MimeDetails {
  implicit val mimeDetailsFormat: Format[MimeDetails] = Json.format[MimeDetails]

  def get(key: String): Option[MimeDetails] = displayMap.get(key)
  // Mimetype display mappings
  // Basic Guidelines::
  //   * Prefer a shorter description if possible. E.g. "PDF" rather than "Portable Document Format" or "PDF File", if it's a slightly unusual format or something people are unlikely to be familiar with then it's ok to be explicit
  //   * Avoid needless descriptors like "File", "Source" or "Script". Unless there's possible confusion, e.g. "SQL Database" and "SQL Script" should be clear
  //   * It'd be nice if you sort each section once you add a new display value. In vim you can select a block with Shift+v and type :sort.
  val displayMap = Map(
    // Application
    "application/dita+xml; format=concept" -> MimeDetails("DITA Concept"),
    "application/dita+xml; format=task" -> MimeDetails("DITA Task"),
    "application/dita+xml; format=topic" -> MimeDetails("DITA Topic"),
    "application/gzip" -> MimeDetails("GZip Archive"),
    "application/java-archive" -> MimeDetails("Java Archive"),
    "application/java-serialized-object" -> MimeDetails("Java Serialized Object"),
    "application/java-vm" -> MimeDetails("Java Bytecode", Some("Java bytecode, usually in the form of a `.class` file")),
    "application/javascript" -> MimeDetails("Javascript"),
    "application/msword" -> MimeDetails("Microsoft Word"),
    "application/mxf" -> MimeDetails("Material Exchange Format", Some("A container format for digital audio and video media.")),
    "application/octet-stream" -> MimeDetails("Unknown Binary"),
    "application/pdf" -> MimeDetails("PDF"),
    "application/pkcs7-signature" -> MimeDetails("PKCS7 Signature"),
    "application/postscript" -> MimeDetails("Postscript"),
    "application/rtf" -> MimeDetails("Rich Text"),
    "application/vnd.adobe.indesign-idml-package" -> MimeDetails("InDesign IDML Package"),
    "application/vnd.apple.keynote" -> MimeDetails("Apple Keynote"),
    "application/vnd.ms-cab-compressed" -> MimeDetails("Microsoft Compressed Cabinet"),
    "application/vnd.ms-excel" -> MimeDetails("Microsoft Excel"),
    "application/vnd.ms-excel.sheet.binary.macroenabled.12" -> MimeDetails("Microsoft Excel (Binary, Macros Enabled)"),
    "application/vnd.ms-excel.sheet.macroenabled.12" -> MimeDetails("Microsoft Excel (Macros Enabled)"),
    "application/vnd.ms-outlook" -> MimeDetails("Microsoft Outlook Message"),
    "application/vnd.ms-outlook-olm" -> MimeDetails("Microsoft Outlook OLM"),
    "application/vnd.ms-outlook-pst" -> MimeDetails("Microsoft Outlook PST"),
    "application/vnd.ms-pki.seccat" -> MimeDetails("Microsoft PKI Signed Catalog "),
    "application/vnd.ms-powerpoint" -> MimeDetails("Microsoft Powerpoint"),
    "application/vnd.ms-powerpoint.presentation.macroenabled.12" -> MimeDetails("Microsoft Powerpoint Presentation (Macros Enabled)"),
    "application/vnd.ms-powerpoint.slideshow.macroenabled.12" -> MimeDetails("Microsoft Powerpoint Slideshow (Macros Enabled)"),
    "application/vnd.ms-project" -> MimeDetails("Microsoft Project"),
    "application/vnd.ms-spreadsheetml" -> MimeDetails("Microsoft SpreadSheet"),
    "application/vnd.ms-word.document.macroenabled.12" -> MimeDetails("Microsoft Word (Macros Enabled)"),
    "application/vnd.openxmlformats-officedocument" -> MimeDetails("Unknown Office Document"),
    "application/vnd.openxmlformats-officedocument.presentationml.presentation" -> MimeDetails("Office Presentation"),
    "application/vnd.openxmlformats-officedocument.presentationml.slideshow" -> MimeDetails("Office Slideshow"),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" -> MimeDetails("Office Spreadsheet"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document" -> MimeDetails("Office Document"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.template" -> MimeDetails("Office Document Template"),
    "application/vnd.visio" -> MimeDetails("Microsoft Visio"),
    "application/winhlp" -> MimeDetails("Windows Help File"),
    "application/x-adobe-indesign" -> MimeDetails("Adobe InDesign"),
    "application/x-bplist" -> MimeDetails("Binary PList"),
    "application/x-bzip2" -> MimeDetails("BZip2 Archive"),
    "application/x-compress" -> MimeDetails("Compress Archive"),
    "application/x-dosexec" -> MimeDetails("DOS Executable"),
    "application/x-font-otf" -> MimeDetails("OpenType Font"),
    "application/x-font-ttf" -> MimeDetails("TrueType Font"),
    "application/x-gtar" -> MimeDetails("GNU Tar Archive"),
    "application/x-java-jnilib" -> MimeDetails("Java JNI Library"),
    "application/x-ms-owner" -> MimeDetails("Microsoft Owner", Some("These are used to indicate what owner is currently editing a file in the Windows operating system")),
    "application/x-msaccess" -> MimeDetails("Microsoft Access"),
    "application/x-msdownload" -> MimeDetails("Microsoft Download", Some("This type is sometimes detected for Windows executable files and libraries (.dll)")),
    "application/x-msdownload; format=pe" -> MimeDetails("Microsoft Download (PE)", Some("A portable subtype of the `application/x-msdownload` mime type. Often associated with executable and library (`.dll`) files.")),
    "application/x-msdownload; format=pe32" -> MimeDetails("Microsoft Download (PE32)", Some("A 32 bit portable subtype of the `application/x-msdownload` mime type. Often associated with executable and library (`.dll`) files.")),
    "application/x-sh" -> MimeDetails("Shell Script"),
    "application/x-sqlite3" -> MimeDetails("SQLite3"),
    "application/x-tar" -> MimeDetails("Tar Archive"),
    "application/x-tika-msoffice" -> MimeDetails("Unknown Microsoft Office"),
    "application/x-tika-ooxml" -> MimeDetails("Open Office XML"),
    "application/x-tika-ooxml-protected" -> MimeDetails("Open Office XML (Protected)"),
    "application/xhtml+xml" -> MimeDetails("XHTML"),
    "application/xml" -> MimeDetails("XML"),
    "application/zip" -> MimeDetails("Zip Archive"),
    "application/zlib" -> MimeDetails("ZLib Archive"),

    // Audio
    "audio/amr" -> MimeDetails("AMR"),
    "audio/mp4" -> MimeDetails("MP4"),
    "audio/mpeg" -> MimeDetails("MPEG"),
    "audio/vnd.wave" -> MimeDetails("WAV"),
    "audio/x-aiff" -> MimeDetails("AIFF"),
    "audio/x-ms-wma" -> MimeDetails("Microsoft WMA"),
    "audio/x-wav" -> MimeDetails("WAV"),

    // Image
    "image/gif" -> MimeDetails("GIF"),
    "image/icns" -> MimeDetails("ICNS", Some("Apple Icon Image format")),
    "image/jpeg" -> MimeDetails("JPEG"),
    "image/png" -> MimeDetails("PNG"),
    "image/tiff" -> MimeDetails("TIFF"),
    "image/vnd.adobe.photoshop" -> MimeDetails("Adobe Photoshop"),
    "image/vnd.microsoft.icon" -> MimeDetails("Microsoft ICO"),
    "image/x-ms-bmp" -> MimeDetails("Microsoft BMP"),

    // Message
    "message/rfc822" -> MimeDetails("Email (RFC822)"),

    // Multipart
    "multipart/appledouble" -> MimeDetails("AppleDouble File Format", Some("Some files created on Apple systems will be stored as 'AppleDouble' which is used for separating the resource data from the Finder metadata. It's unlikely there will be a lot of these but it depends entirely on the dump and how the MIME types are parsed.")),

    // Text
    "text/css" -> MimeDetails("CSS"),
    "text/csv" -> MimeDetails("CSV"),
    "text/html" -> MimeDetails("HTML"),
    "text/plain" -> MimeDetails("Plain"),
    "text/x-ini" -> MimeDetails("INI Config File"),
    "text/x-java-properties" -> MimeDetails("Java Properties"),
    "text/x-log" -> MimeDetails("Log"),
    "text/x-matlab" -> MimeDetails("Matlab", Some("Matlab is a programming language often used for numerical computing.")),
    "text/x-php" -> MimeDetails("PHP"),
    "text/x-sql" -> MimeDetails("SQL Script"),
    "text/x-web-markdown" -> MimeDetails("Markdown"),

    // Video
    "video/3gpp" -> MimeDetails("3GP"),
    "video/mp4" -> MimeDetails("MP4"),
    "video/quicktime" -> MimeDetails("Quicktime"),
    "video/x-m4v" -> MimeDetails("M4V", Some("M4V is a video container developed by Apple often used to encode video files in the iTunes store.")),
    "video/x-ms-wmv" -> MimeDetails("Microsoft WMV"),
    "video/x-msvideo" -> MimeDetails("Microsoft AVI")
  )
}
