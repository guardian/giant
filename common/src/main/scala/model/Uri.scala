package model

import java.nio.file.Path

import play.api.libs.json._

// TODO MRB: move back to app
object Uri {
  implicit val format: Format[Uri] = new Format[Uri] {
    def writes(uri: Uri): JsValue = JsString(uri.value)
    def reads(json: JsValue): JsResult[Uri] = Reads.StringReads.reads(json).map(Uri.apply)
  }

  // Construct a file URI from a root
  def relativizeFromFilePaths(root: Uri, pathRoot: Path, path: Path): Uri = {
    val relPath = pathRoot.relativize(path)

    val relativePath = relPath.toString

    if (relativePath == "") {
      root
    } else {
      root.chain(relativePath)
    }
  }
}

/**
  * Untyped URI is used whenever the client provides the server with a URI since the client has no idea about the type information
  */
case class Uri(value: String) extends AnyVal {
  def toJson: JsValue = Json.toJson(this)
  def toStoragePath = s"${value.take(6).mkString("/")}/$value"
  def chain(other: String): Uri = Uri(value.stripSuffix("/") + "/" + other.stripPrefix("/"))
  // .split supposedly never returns an empty array
  // (it gives the original string back if the separator isn't in it)
  // so we don't mind that .head throws an exception
  def root: String = value.split('/').head
}
