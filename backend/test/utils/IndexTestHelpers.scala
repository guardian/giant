package utils

import org.apache.pekko.util.Timeout
import controllers.api.Search
import extraction.MetadataEnrichment
import model.frontend.{Highlight, SearchResults}
import model.manifest.{Collection, MimeType}
import model.{English, Language, Uri}
import play.api.test.FakeRequest
import play.api.test.Helpers.contentAsJson
import services.index
import test.integration.ElasticsearchTestService
import utils.attempt.Attempt

trait IndexTestHelpers { this: ElasticsearchTestService =>
  def addTestDocument(collection: Collection,
                      ingestion: String,
                      maybeFileName: Option[String] = None,
                      maybeMimeType: Option[String] = None,
                      maybeText: Map[Language, String] = Map.empty,
                      maybeOcrText: Map[Language, String] = Map.empty,
                      maybeExtractedMetadata: Map[String, Seq[String]] = Map.empty): Attempt[Uri] = {

    val ingestionUri = collection.uri.chain(ingestion)
    val documentUri = ingestionUri.chain(maybeFileName.getOrElse(collection.uri.value + ".txt"))

    val mimeType = MimeType(maybeMimeType.getOrElse("application/text"))
    val ingestionData = index.IngestionData(
      createdAt = None,
      lastModifiedAt = None,
      Set(mimeType),
      Set(documentUri),
      parentBlobs = List.empty,
      ingestionUri.value,
      workspace = None
    )

    val text = maybeText.values.headOption.getOrElse((collection.uri.value + "/" + ingestion))

    val maybeLanguages = (maybeText.keys ++ maybeOcrText.keys)
    val languages = if(maybeLanguages.isEmpty) { List(English) } else { maybeLanguages.toList }

    // TODO MRB: this only seems to work in sequence, not in parallel? Elasticsearch problem?
    def _addDocumentOcr(entries: List[(Language, String)]): Attempt[Unit] = {
      if(entries.isEmpty) {
        Attempt.Right(())
      } else {
        val (lang, text) :: rest = entries

        elasticResources.addDocumentOcr(documentUri, Some(text), lang).flatMap { _ =>
          if (rest.isEmpty) {
            Attempt.Right(())
          } else {
            _addDocumentOcr(rest)
          }
        }
      }
    }

    for {
      _ <- elasticResources.ingestDocument(documentUri, 0, ingestionData, languages)
      _ <- elasticResources.addDocumentDetails(documentUri, Some(text), Map.empty, MetadataEnrichment.enrich(maybeExtractedMetadata), languages)
      _ <- _addDocumentOcr(maybeOcrText.toList)
    } yield {
      documentUri
    }
  }

  def getSearchHighlights(controller: Search, searchQuery: String)(implicit timeout: Timeout): Seq[Highlight] = {
    val searchRequest = FakeRequest("GET", s"""/query?q=["${searchQuery}"]""")
    val searchResponse = (contentAsJson(controller.search().apply(searchRequest))).as[SearchResults]

    searchResponse.results.flatMap(_.highlights)
  }
}
