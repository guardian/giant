package utils

import model.frontend.HighlightableText
import model.index.SearchResultPageHighlight
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.common.PDRectangle
import org.apache.pdfbox.pdmodel.graphics.color.{PDColor, PDDeviceRGB}
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationTextMarkup
import org.apache.pdfbox.text.{PDFTextStripper, TextPosition}

import java.util
import scala.collection.JavaConverters._

object PDFUtil {
  val highlightColour = new PDColor(Array(253f, 182f, 0f), PDDeviceRGB.INSTANCE)

  // PDFBox will issue newlines to approximate lines on the page. This makes it difficult to match up the
  // highlighted text that comes back from Elasticsearch with offsets into the text when rendering the highlights.
  // So we override the default functionality and ensure there is a maximum of one newline separating each line.
  def getPageText(doc: PDDocument, pageNumber: Int): String = {
    val textBuilder = new StringBuilder()

    val textStripper = new PDFTextStripper() {
      // Looking up the calling code within PDFTextStripper itself, this is called for each line
      override def writeString(text: String, notUsedJavaTextPositions: util.List[TextPosition]): Unit = {
        textBuilder.append(text)
        textBuilder.append(" ")
      }
    }

    textStripper.setStartPage(pageNumber)
    textStripper.setEndPage(pageNumber)
    textStripper.getText(doc)

    textBuilder.toString()
  }

  // We still need to have a separator in ES between each line, otherwise it will treat the first word of the subsequent
  // line as part of the last word of the preceding. I've used an either type here to make it clear what is a character
  // position coming back from PDFBox and what is a newline we have added ourselves.
  object NewlinePlaceholder

  def getText(positions: List[Either[TextPosition, NewlinePlaceholder.type]]): String = positions.map {
    case Left(pos) => pos.getUnicode
    case Right(NewlinePlaceholder) => "\n"
  }.mkString("")

  def rectangleToQuadPoints(rekt: PDRectangle): Array[Float] = {
    Array(
      // top left
      rekt.getLowerLeftX, rekt.getUpperRightY,
      // bottom left
      rekt.getUpperRightX, rekt.getUpperRightY,
      // top right
      rekt.getLowerLeftX, rekt.getLowerLeftY,
      // bottom right
      rekt.getUpperRightX, rekt.getLowerLeftY
    )
  }

  def getSearchResultHighlights(pageText: HighlightableText, singlePageDoc: PDDocument, pageNumber: Int): List[SearchResultPageHighlight] = {
    val highlights = pageText.highlights

    var textPositions = List.empty[Either[TextPosition, NewlinePlaceholder.type]]

    val textStripper = new PDFTextStripper() {
      // Looking up the stack, this is called for each line
      override def writeString(notUsedText: String, javaTextPositions: util.List[TextPosition]): Unit = {
        textPositions = textPositions ++ javaTextPositions.asScala.map(Left(_))
        textPositions :+= Right(NewlinePlaceholder)
      }
    }

    // Will call writeString above with every line
    textStripper.getText(singlePageDoc)

    highlights.zipWithIndex.map { case(highlight, ix) =>
      // TODO MRB: do we need to do more work to handle handle rotated lines (see getXDirAdj and getRot on TextPosition)
      val startCharacter = textPositions(highlight.range.startCharacter).left.get
      val endCharacter = textPositions(highlight.range.endCharacter - 1).left.get

      val x = startCharacter.getX
      val y = startCharacter.getY - endCharacter.getHeight

      val x1 = endCharacter.getX + endCharacter.getWidth
      val y1 = y + endCharacter.getHeight

      val id = HighlightableText.searchHighlightId(ix, Some(pageNumber))

      SearchResultPageHighlight(id, x, y, width = x1 - x, height = y1 - y)
    }
  }

  // This works but PDF.js renders them directly onto the canvas (and requires a beta version)
  def highlightSearchResultsInline(pageText: HighlightableText, singlePageDoc: PDDocument): PDDocument = {
    for (pageNumber <- 1 to singlePageDoc.getNumberOfPages) {
      val page = singlePageDoc.getPage(pageNumber - 1)
      val pageHeight = page.getMediaBox.getHeight

      val highlightRectangles = getSearchResultHighlights(pageText, singlePageDoc, 1)

      highlightRectangles.foreach { case SearchResultPageHighlight(_, x, y, width, height) =>
        val rekt = new PDRectangle(x.toFloat, pageHeight - (y.toFloat + height.toFloat), width.toFloat, height.toFloat)
        val quadPoints = rectangleToQuadPoints(rekt)

        val highlightBox = new PDAnnotationTextMarkup(PDAnnotationTextMarkup.SUB_TYPE_HIGHLIGHT)

        // I'm not sure (and neither is the internet) why we need to set both a rectangle and quad points
        highlightBox.setRectangle(rekt)
        highlightBox.setQuadPoints(quadPoints)

        highlightBox.setColor(highlightColour)
        highlightBox.setPrinted(true)

        page.getAnnotations.add(highlightBox)
      }
    }

    singlePageDoc
  }
}