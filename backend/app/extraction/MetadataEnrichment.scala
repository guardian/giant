package extraction

import java.text.SimpleDateFormat

import play.api.libs.json.Json
import services.index.IndexFields

import scala.util.Try

case class EnrichedMetadata(title: Option[String],
                            author: Option[String],
                            createdAt: Option[Long],
                            lastModified: Option[Long],
                            createdWith: Option[String],
                            pageCount: Option[Int],
                           wordCount: Option[Int]) {
  def toMap: Map[String, AnyRef] = {
    val t = this.title.map(IndexFields.metadata.enrichedMetadata.title -> _)
    val a = this.author.map(IndexFields.metadata.enrichedMetadata.author -> _)
    val c = this.createdAt.map(IndexFields.metadata.enrichedMetadata.createdAt -> Long.box(_))
    val l = this.lastModified.map(IndexFields.metadata.enrichedMetadata.lastModified -> Long.box(_))
    val cw = this.createdWith.map(IndexFields.metadata.enrichedMetadata.createdWith -> _)
    val p =  this.pageCount.map(IndexFields.metadata.enrichedMetadata.pageCount -> Int.box(_))
    val wc = this.wordCount.map(IndexFields.metadata.enrichedMetadata.wordCount -> Int.box(_))

    Map() ++ t ++ a ++ c ++ l ++ cw ++ p ++ wc
  }
}

object EnrichedMetadata {
  implicit val format = Json.format[EnrichedMetadata]
}

object MetadataEnrichment {

  def someIdentity[T](v: T): Option[T] = Some(v)
  def safeIntParse(c: String): Option[Int] = Try(c.toInt).toOption

  def enrich(metadata: Map[String, Seq[String]]): EnrichedMetadata = EnrichedMetadata(
    extractFields(metadata, titleKeys)(someIdentity),
    extractFields(metadata, authorKeys)(someIdentity),
    extractFields(metadata, createdAtKeys)(isoDateToLong),
    extractFields(metadata, lastModifiedKeys)(isoDateToLong),
    extractFields(metadata, createdWithKeys)(someIdentity),
    extractFields(metadata, pageCountKeys)(safeIntParse),
    extractFields(metadata, wordCountKeys)(safeIntParse)
  )

  // Probably these lists of keys could be simplified now we're on Tika v2.
  // But I've left the old ones in for backwards compatibility,
  // and because I'm not sure how to test this.
  // https://cwiki.apache.org/confluence/display/TIKA/Migrating+to+Tika+2.0.0
  val titleKeys = List(
    "pdf:docinfo:title",
    "title",
    "dc:title"
  )

  val authorKeys = List(
    "pdf:docinfo:author",
    "Author",
    "dc:creator",
    "creator"
  )

  val createdAtKeys = List(
    "meta:creation-date",
    "Creation-Date",
    "pdf:docinfo:created",
    "dcterms:created"
  )

  val lastModifiedKeys = List(
    "Last-Modified",
    "Last-Save-Date",
    "dcterms:modified"
  )

  val createdWithKeys = List(
    "pdf:docinfo:producer",
    "xmp:CreatorTool"
  )

  val pageCountKeys = List(
    "xmpTPg:NPages",
    "meta:page-count",
    "Page-Count"
  )

  val wordCountKeys = List(
    "meta:word-count",
    "Word-Count"
  )

  private def extractFields[T](metadata: Map[String, Seq[String]], keys: Seq[String])(transform: String => Option[T]): Option[T] =
    Try(metadata.filter { case (k, v) => keys.contains(k) }.values.flatten.groupBy(identity).maxBy(_._2.size)._1).toOption.flatMap(transform)

  def isoDateToLong(text: String): Option[Long] = {
    Try(new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX").parse(text)).toOption.map(_.getTime)
  }
}
