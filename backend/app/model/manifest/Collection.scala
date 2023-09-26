package model.manifest

import model.{RichValue, Uri}
import org.neo4j.driver.v1.{Record, Value}
import play.api.libs.json._

import scala.jdk.CollectionConverters._

case class Collection(uri: Uri, display: String, ingestions: List[Ingestion], createdBy: Option[String])

object Collection {
  implicit val collectionFormat = Json.format[Collection]

  def mergeCollectionsAndIngestions(results: Seq[Record]): List[Collection] = {
    results.map(r => {
      val cValue = r.get("c")
      val uri: String = cValue.get("uri").asString()
      val display: String = cValue.get("display").asString()
      val createdBy = cValue.get("createdBy").optionally(_.asString())

      val maybeIngestion: Option[Ingestion] = r.get("i").optionally(Ingestion.fromNeo4jValue)
      (uri, display, maybeIngestion, createdBy)
    })
      .groupBy(t => (t._1, t._2, t._4))
      .map { case ((uri, display, createdBy), list) =>
        Collection(Uri(uri), display, list.flatMap(_._3).toList, createdBy)
      }.toList
  }

  def fromNeo4jValue(collection: Value): Collection = Collection(
    Uri(collection.get("uri").asString()),
    collection.get("display").asString(),
    List.empty,
    collection.get("createdBy").optionally(_.asString())
  )

  def mergeCollectionAndUsers(results: Seq[Record]): Map[Collection, Seq[String]] = {
    results.map(r => {
      val cValue = r.get("c")
      val uri: String = cValue.get("uri").asString()
      val display: String = cValue.get("display").asString()
      val createdBy = cValue.get("createdBy").optionally(_.asString())
      val users = r.get("usernames").asList((v: Value) => v.asString()).asScala.toSeq

      Collection(Uri(uri), display, List.empty, createdBy) -> users
    }).toMap
  }
}

case class CollectionWithUsers(uri: Uri, display: String, ingestions: List[Ingestion], createdBy: Option[String], users: Set[String])
object CollectionWithUsers {
  implicit val format: Format[CollectionWithUsers] = Json.format[CollectionWithUsers]

  def apply(collection: Collection, users: Set[String]): CollectionWithUsers = {
    CollectionWithUsers(collection.uri, collection.display, collection.ingestions, collection.createdBy, users)
  }
}