package services.index

import model.index.{Page, PageResult}
import model.{Language, Uri}
import utils.attempt.Attempt

trait Pages {
  def setup(): Attempt[Pages]

  def addPageContents(uri: Uri, pages: Seq[Page]): Attempt[Unit]

  def getTextPages(uri: Uri, top: Double, bottom: Double, highlightQuery: Option[String]): Attempt[PageResult]

  def getPage(uri: Uri, pageNumber: Int, highlightQuery: Option[String]): Attempt[Page]
}
