package services.index

import com.sksamuel.elastic4s.requests.searches.queries.QueryStringQuery
import com.sksamuel.elastic4s.requests.searches.{HighlightField, InnerHit, SearchHit}
import com.sksamuel.elastic4s.ElasticDsl._
import model.Languages
import model.frontend.Highlight

object HighlightFields {
  import IndexFields._

  private val defaultMappings: Map[String, String] = Map(
    text -> "Body Text",
    ocr -> "OCR Text",
    transcript -> "Transcript Text",
    vttTranscript -> "Transcript (timecodes)",
    metadataField + "." + metadata.subject -> "Email Subject",
    metadataField + "." + metadata.fromField + "." + metadata.recipients.name -> "Email From",
    metadataField + "." + metadata.fromField + "." + metadata.recipients.address -> "Email From",
    metadataField + "." + metadata.recipientsField + "." + metadata.recipients.name -> "Email Recipient",
    metadataField + "." + metadata.recipientsField + "." + metadata.recipients.address -> "Email Recipient",
    metadataField + "." + metadata.fileUris -> "File Path",
    metadataField + "." + metadata.html -> "Email HTML",
    metadataField + "." + metadata.mimeTypes -> "Mime Type"
  )

  private val MAX_RESULTS = 5

  private val enrichedMetadataFieldPrefix = metadataField + "." + metadata.enrichedMetadataField + "."
  private val metadataFieldPrefix = metadataField + "."
  private val fieldPrefixes = List(enrichedMetadataFieldPrefix, metadataFieldPrefix)

  // This list of highlighters should be kept in sync with the list of fields we apply a search to in
  // ElasticsearchResources.buildQuery. Raw metadata highlighting is specified there too as it is a nested field
  //
  // // We don't want to highlight all top level fields as some are non-human readable (like workspace ID)
  def searchHighlights(topLevelSearchQuery: QueryStringQuery): List[HighlightField] = {
    textHighlighters(topLevelSearchQuery) ++
      languageHighlighters(s"${IndexFields.metadataField}.${IndexFields.metadata.fileUris}", topLevelSearchQuery) ++
      // use the simpler highlighter as the field is small so there's no need for positions_with_offsets)
      List(highlighter(s"${IndexFields.metadataField}.${IndexFields.metadata.mimeTypes}")
        .highlighterType("unified")) ++
      languageHighlighters(s"${IndexFields.metadataField}.${IndexFields.metadata.fromField}.${IndexFields.metadata.from.name}", topLevelSearchQuery) ++
      List(highlighter(s"${IndexFields.metadataField}.${IndexFields.metadata.fromField}.${IndexFields.metadata.from.address}")) ++
      languageHighlighters(s"${IndexFields.metadataField}.${IndexFields.metadata.recipientsField}.${IndexFields.metadata.from.name}", topLevelSearchQuery) ++
      List(highlighter(s"${IndexFields.metadataField}.${IndexFields.metadata.recipientsField}.${IndexFields.metadata.from.address}")) ++
      languageHighlighters(s"${IndexFields.metadataField}.${IndexFields.metadata.subject}", topLevelSearchQuery) ++
      languageHighlighters(s"${IndexFields.metadataField}.${IndexFields.metadata.html}", topLevelSearchQuery)
  }

  def textHighlighters(topLevelSearchQuery: QueryStringQuery): List[HighlightField] = {
    val textFieldHighlighters = languageHighlighters(IndexFields.text, topLevelSearchQuery)
    val ocrFieldHighlighters = languageHighlighters(IndexFields.ocr, topLevelSearchQuery)
    val transcriptFieldHighlighters = languageHighlighters(IndexFields.transcript, topLevelSearchQuery)
    val vttTranscriptFieldHighlighters = languageHighlighters(IndexFields.vttTranscript, topLevelSearchQuery)

    textFieldHighlighters ++ ocrFieldHighlighters ++ transcriptFieldHighlighters ++ vttTranscriptFieldHighlighters
  }

  def parseHit(hit: SearchHit): Seq[Highlight] = {
    val topLevelFields = Option(hit.highlight).getOrElse(Map.empty)
    val innerHitFields = getHighlightFields(hit.innerHits.values.flatMap(_.hits))

    val highlightFields = deduplicateHighlightsByLanguage(topLevelFields ++ innerHitFields)

    highlightFields
      .flatMap { case(k, v) => getHighlights(k, v) }
      .toSeq
      .take(MAX_RESULTS)
  }

  def highlighter(fieldName: String): HighlightField = {
    highlight(fieldName)
      .order("score")
      .highlighterType("fvh")
      .preTag("<result-highlight>").postTag("</result-highlight>")
  }

  def singleLanguageHighlighter(fieldName: String, topLevelSearchQuery: QueryStringQuery): HighlightField = {
    highlighter(fieldName)
      .matchedFields(fieldName, s"${fieldName}.exact")
      // Exact matching doesn't seem to work for highlights in a query that also includes a nested query (and inner hits)
      // as we do for metadata. Manually specifying the highlight query seems to fix this <shrug>
      .query(topLevelSearchQuery.field(fieldName))
  }

  def languageHighlighters(fieldName: String, topLevelSearchQuery: QueryStringQuery): List[HighlightField] = {
    Languages.all.map { language =>
      singleLanguageHighlighter(s"${fieldName}.${language.key}", topLevelSearchQuery)
    }
  }

  private def getHighlightFields(innerHits: Iterable[InnerHit]): Map[String, Seq[String]] = {
    innerHits.foldLeft(Map.empty[String, Seq[String]]) { (acc, innerHit) =>
      innerHit.source.get("key") match {
        case Some(key: String) =>
          val highlightFields = innerHit.highlight.map { case(_, v) => key -> v }
          acc ++ highlightFields

        case _ =>
          acc
      }
    }
  }

  private def deduplicateHighlightsByLanguage(highlights: Map[String, Seq[String]]): Map[String, Seq[String]] = {
    // We index some values using language specific analysers, with a separate object field for each language.
    // For all values except OCR (which has genuinely different values as they come from separately trained ML models)
    // we want to just pick one of them to avoid confusing users. This only affects documents that have been processed
    // as multiple languages. The vast majority are processed using a single language.

    highlights.foldLeft(Map.empty[String, Seq[String]]) {
      case (acc, (key, values)) if key.startsWith(IndexFields.ocr) || key.startsWith(IndexFields.transcript) || key.startsWith(IndexFields.vttTranscript) =>
        acc + (key -> values)

      case (acc, (key, values)) =>
        Languages.all.find { lang => key.endsWith(s".${lang.key}") } match {
          case Some(lang) =>
            val modifiedKey = key.substring(0, key.length - s".${lang.key}".length)
            acc + (modifiedKey -> values)

          case None =>
            acc + (key -> values)
        }
    }
  }

  private def getHighlights(field: String, highlight: Seq[String]): List[Highlight] = {
    val maybeDisplayName = defaultMappings.collectFirst { case(k, v) if field.startsWith(k) => v }

    val displayName = maybeDisplayName.getOrElse {
      // sort by length so we are not dependent on the ordering of the prefixes in the list
      fieldPrefixes.filter(field.startsWith).sortBy(_.length).lastOption match {
        case Some(prefix) =>
          field.substring(prefix.length)

        case None =>
          field
      }
    }

    highlight.map(Highlight(field, displayName, _)).toList
  }
}
