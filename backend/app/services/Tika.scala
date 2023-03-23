package services

import java.io.{InputStream, StringWriter}
import java.nio.file.Path
import cats.syntax.either._
import com.amazonaws.util.StringInputStream
import extraction.email.mbox.MBoxEmailDetector
import extraction.email.olm.OlmEmailDetector
import org.apache.tika.config.TikaConfig
import org.apache.tika.detect.{CompositeDetector, DefaultDetector, Detector}
import org.apache.tika.io.TikaInputStream
import org.apache.tika.metadata.{HttpHeaders, Metadata, TikaCoreProperties}
import org.apache.tika.mime.MediaType
import org.apache.tika.parser.iwork.IWorkPackageParser
import org.apache.tika.parser.iwork.iwana.IWork13PackageParser
import org.apache.tika.parser.microsoft.ooxml.OOXMLParser
import org.apache.tika.parser.ocr.TesseractOCRParser
import org.apache.tika.parser.odf.OpenDocumentParser
import org.apache.tika.parser.{AutoDetectParser, CompositeParser, ParseContext, Parser}
import org.apache.tika.sax.BodyContentHandler
import utils.Logging
import utils.attempt.{Failure, UnknownFailure}

import scala.util.Try
import scala.jdk.CollectionConverters._

trait TypeDetector {
  def detectType(path: Path): Either[Failure, MediaType]
}

class Tika(detector: Detector, parser: Parser) extends TypeDetector {
  // TODO continually add "document" type mimes here as we find them
  // NOTE `getSupportedTypes` seems to take a parser context but for all of the following it's not actually used.
  private val openDocumentTypes = new OpenDocumentParser().getSupportedTypes(null).asScala.map(_.toString)
  private val iWork13Types = new IWork13PackageParser().getSupportedTypes(null).asScala.map(_.toString)
  private val iWorkTypes = new IWorkPackageParser().getSupportedTypes(null).asScala.map(_.toString)
  private val officeTypes = new OOXMLParser().getSupportedTypes(null).asScala.map(_.toString)

  val documentTypes = Set.empty ++ openDocumentTypes ++ iWork13Types ++ iWorkTypes ++ officeTypes

  def detectType(path: Path): Either[Failure, MediaType] = {
    val inputStream = TikaInputStream.get(path)

    val detectedType = Try {
      val metadata = new Metadata
      metadata.set(TikaCoreProperties.RESOURCE_NAME_KEY, path.toString)
      detector.detect(inputStream, metadata)
    }

    inputStream.close()
    detectedType.toEither.left.map(UnknownFailure.apply)
  }

  def parse(stream: InputStream, mimeTypeHint: String): Either[Failure, (Metadata, String)] = {
    val metadata = new Metadata
    metadata.set(HttpHeaders.CONTENT_TYPE, mimeTypeHint)
    val writer = new StringWriter()
    val data = Either.catchNonFatal {
      parser.parse(stream, new BodyContentHandler(writer), metadata, new ParseContext())
      metadata -> writer.toString
    }.left.map(UnknownFailure.apply)
    stream.close()
    data
  }
}

object Tika extends Logging {
  private val XML_IS_A_GOOD_CONFIGURATION_LANGUAGE =
    """<?xml version="1.0" encoding="UTF-8"?>
      |<properties>
      |<parsers>
      |<parser class="org.apache.tika.parser.DefaultParser">
      |<parser-exclude class="org.apache.tika.parser.ocr.TesseractOCRParser"/>
      |</parser>
      |</parsers>
      |</properties>
    """.stripMargin

  def createInstance: Tika = {
    val config = new TikaConfig(new StringInputStream(XML_IS_A_GOOD_CONFIGURATION_LANGUAGE))

    val defaultDetectors = new DefaultDetector().getDetectors.asScala
    val detectors = Seq(OlmEmailDetector, MBoxEmailDetector) ++ defaultDetectors

    val detector = new CompositeDetector(detectors: _*)
    val parser = new AutoDetectParser(config)

    checkTesseractIsActuallyDisabled(parser)
    new Tika(detector, parser)
  }

  private def checkTesseractIsActuallyDisabled(parser: CompositeParser) = {
    val parsers = parser.getAllComponentParsers.asScala
    val tesseractEnabled = parsers.exists(_.isInstanceOf[TesseractOCRParser])

    if(tesseractEnabled) {
       throw new IllegalStateException("Tesseract support in Tika is still enabled")
    } else {
      logger.info("Despite the warning above, Tesseract support in Tika has been disabled")
    }
  }
}
