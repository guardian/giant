package utils

import model.frontend.{HighlightableText, TextHighlight}
import model.index.{HighlightSpan, FindPageHighlight, PageHighlight, SearchResultPageHighlight}
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.common.PDRectangle
import org.apache.pdfbox.pdmodel.graphics.color.{PDColor, PDDeviceRGB}
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationTextMarkup
import org.apache.pdfbox.text.{PDFTextStripper, TextPosition}

import java.util
import scala.collection.JavaConverters._
import scala.math.{atan2, cos, sin, sqrt}

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

  // Old version
  def getSearchResultHighlights(highlights: HighlightableText, singlePageDoc: PDDocument, pageNumber: Int): List[PageHighlight] = {
    getSearchResultHighlights(highlights.highlights, singlePageDoc, pageNumber, false)
  }

  def getSearchResultHighlights(highlights: List[TextHighlight], singlePageDoc: PDDocument, pageNumber: Int, isFind: Boolean = false): List[PageHighlight] = {

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
      val startIdx = highlight.range.startCharacter
      val endIdx = highlight.range.endCharacter - 1

      // Split the existing text path into lines of characters
      // TODO SC: Make a case class for this to help readability?
      val highlightSpans: List[List[TextPosition]] = textPositions
        .slice(startIdx, endIdx + 1)
        .zipWithIndex
        .foldLeft(List(List[TextPosition]()))((acc, currWithIndex) => {
            currWithIndex._1 match {
              // Regular character just append to the last span
              case Left(pos) => acc.init :+ (acc.last :+ pos)
              // If there's a newline push a new span
              case Right(NewlinePlaceholder) => acc :+ List()
            }
      })

      val spans = highlightSpans.flatMap { span =>
        for {
          // Sometimes the text stripper doesn't pull out matches correctly resulting in empty spans
          startCharacter <- span.headOption
          endCharacter <- span.lastOption
        } yield {
          // This coordinate system makes my head hurt
          val x = startCharacter.getX
          val y = startCharacter.getY

          val x1 = endCharacter.getX
          val y1 = endCharacter.getY

          val dX = x1 - x
          val dY = y1 - y

          val width = sqrt(dX * dX + dY * dY) + endCharacter.getWidth
          val height = span.maxBy(_.getFontSize).getFontSize

          val rotation = atan2(dY, dX)

          // The highlight is rendered slightly off, we need to move the position by about 0.75 * the max character height
          // while also factoring in rotation. Here were getting the x/y offsets by rotating a Y axis unit vector and then
          // multiplying the result by the offset magnitude. The Y axis has to be negated due to the coordinate spaces.

          val offsetMagnitude = height * 0.75
          val offsetX = offsetMagnitude * sin(rotation)
          val offsetY = -offsetMagnitude * cos(rotation)

          HighlightSpan(x + offsetX, y + offsetY, width, height, rotation)
        }
      }

      if (isFind) {
        FindPageHighlight(highlight.id, spans)
      } else {
        SearchResultPageHighlight(highlight.id, spans)
      }
    }
  }
}