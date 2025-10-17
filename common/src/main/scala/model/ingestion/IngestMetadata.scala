package model.ingestion

import java.nio.file.{Path, Paths}
import model.{Language, Uri}
import play.api.libs.json.{Format, Json}
import utils.attempt.{ClientFailure, Failure}

import scala.annotation.tailrec

case class IngestMetadata(ingestion: String, file: IngestionFile, languages: List[Language])

object IngestMetadata {
  implicit val formats: Format[IngestMetadata] = Json.format[IngestMetadata]
  
  def expandParents(ingestionUri: String, parentUri: Uri): Either[Failure, List[Uri]] = {
    val ingestionParts = ingestionUri.split("/").toList

    ingestionParts match {
      case collection :: _ :: Nil =>
        @tailrec
        def expandParentsRecursively(path: Path, acc: List[String]): List[String] = {
          if(path == null) {
            acc
          } else {
            val part = path.toString
            expandParentsRecursively(path.getParent, acc :+ part)
          }
        }

        val parentPath = Paths.get(parentUri.value)

        val expanded = expandParentsRecursively(parentPath, List.empty)

        val withoutIngestion = expanded.flatMap {
          case uri if uri == collection => None
          case uri if uri == ingestionUri => None
          case uri if uri.startsWith(ingestionUri) => Some(Uri(uri))
          case uri => Some(Uri(ingestionUri + "/" + uri))
        }

        val withIngestion = withoutIngestion :+ Uri(ingestionUri)

        Right(withIngestion)

      case _ =>
        Left(ClientFailure(s"Invalid ingestion uri $ingestionUri"))
    }
  }
}
