package services.ingestion

import model.ingestion.{RemoteIngest, RemoteIngestStatus, RemoteIngestTask}
import model.user.DBUser
import org.joda.time.DateTime
import model.ingestion.RemoteIngestStatus.RemoteIngestStatus
import org.joda.time.DateTime
import org.neo4j.driver.v1.Driver
import org.neo4j.driver.v1.Values.parameters
import services.Neo4jQueryLoggingConfig
import utils.attempt.{Attempt, Failure, NotFoundFailure}
import utils.{Logging, Neo4jHelper}

import scala.concurrent.ExecutionContext
import scala.jdk.CollectionConverters.{CollectionHasAsScala, IterableHasAsJava}

object Neo4jRemoteIngestStore {
  def setup(driver: Driver, executionContext: ExecutionContext, queryLoggingConfig: Neo4jQueryLoggingConfig): Either[Failure, Neo4jRemoteIngestStore] = {
    val neo4jStore = new Neo4jRemoteIngestStore(driver, executionContext, queryLoggingConfig)
    neo4jStore.setup().map(_ => neo4jStore)
  }
}

class Neo4jRemoteIngestStore(driver: Driver, executionContext: ExecutionContext, queryLoggingConfig: Neo4jQueryLoggingConfig)
  extends Neo4jHelper(driver, executionContext, queryLoggingConfig) with RemoteIngestStore with Logging {


  implicit val ec: ExecutionContext = executionContext

  override def setup(): Either[Failure, Unit] = transaction { tx =>
    tx.run("CREATE CONSTRAINT ON (remoteIngest: RemoteIngest)   ASSERT remoteIngest.id   IS UNIQUE")
    tx.run("CREATE INDEX ON :RemoteIngest(status)")
    Right(())
  }

  override def insertRemoteIngest(
    id: String,
    title: String,
    workspaceId: String,
    parentFolderId: String,
    collection: String,
    createdAt: DateTime,
    url: String,
    username:String,
    mediaDownloadId: String,
    webpageSnapshotId: String
  ): Attempt[String] = attemptTransaction { tx =>
    val query =
      """
        |MATCH (user: User { username: { username }})
        |CREATE (ri:RemoteIngest {
        |  id: $id,
        |  title: $title,
        |  status: $status,
        |  workspaceId: $workspaceId,
        |  parentFolderId: $parentFolderId,
        |  collection: $collection,
        |  ingestion: $ingestion,
        |  createdAt: $createdAt,
        |  url: $url,
        |  mediaDownloadId: $mediaDownloadId,
        |  webpageSnapshotId: $webpageSnapshotId
        |})
        |CREATE (ri)<-[:CREATED]-(user)
        |RETURN ri.id AS id
    """.stripMargin

    val params = parameters(
      "username", username,
      "id", id,
      "title", title,
      "status", RemoteIngestStatus.Queued.toString,
      "workspaceId", workspaceId,
      "parentFolderId", parentFolderId,
      "collection", collection,
      "ingestion", id, // re-use the job id as ingestion ID for now
      "createdAt", createdAt.getMillis,
      "url", url,
      "mediaDownloadId", mediaDownloadId,
      "webpageSnapshotId", webpageSnapshotId
    )

    tx.run(query, params).map(res => res.single().get("id").asString())
  }

  private val returnFields = """
    |RETURN ri.id AS id,
    |       ri.title AS title,
    |       ri.status AS status,
    |       ri.workspaceId AS workspace_id,
    |       ri.parentFolderId AS parent_folder_id,
    |       ri.collection AS collection,
    |       ri.ingestion AS ingestion,
    |       ri.createdAt AS created_at,
    |       ri.url AS url,
    |       ri.mediaDownloadId AS media_download_id,
    |       ri.webpageSnapshotId AS webpage_snapshot_id,
    |       ri.mediaDownloadBlobUris AS media_download_blob_uris,
    |       ri.webpageSnapshotBlobUris AS webpage_snapshot_blob_uris,
    |       addedBy AS added_by
  """.stripMargin

  private def recordToRemoteIngest(record: org.neo4j.driver.v1.Record): RemoteIngest = {
    val mediaDownloadBlobUris =
      if (record.containsKey("media_download_blob_uris") && !record.get("media_download_blob_uris").isNull)
        record.get("media_download_blob_uris").asList[String](b => b.asString()).asScala.toList
      else List()
    val webpageSnapshotBlobUris =
      if (record.containsKey("webpage_snapshot_blob_uris") && !record.get("webpage_snapshot_blob_uris").isNull)
        record.get("webpage_snapshot_blob_uris").asList[String](b => b.asString()).asScala.toList
      else List()
    RemoteIngest(
      id = record.get("id").asString(),
      title = record.get("title").asString(),
      status = RemoteIngestStatus withName record.get("status").asString(),
      workspaceId = record.get("workspace_id").asString(),
      parentFolderId = record.get("parent_folder_id").asString(),
      collection = record.get("collection").asString(),
      ingestion = record.get("ingestion").asString(),
      createdAt = new org.joda.time.DateTime(record.get("created_at").asLong(), org.joda.time.DateTimeZone.UTC),
      url = record.get("url").asString(),
      addedBy = DBUser.fromNeo4jValue(record.get("added_by")).toPartial,
      mediaDownload = RemoteIngestTask(
        id = record.get("media_download_id").asString(),
        blobUris = mediaDownloadBlobUris
      ),
      webpageSnapshot = RemoteIngestTask(
        id = record.get("webpage_snapshot_id").asString(),
        blobUris = webpageSnapshotBlobUris
      )
    )
  }
  override def getRemoteIngestJob(id: String): Attempt[RemoteIngest] = attemptTransaction { tx =>
    val query =
      s"""
        |MATCH (ri:RemoteIngest {id: ${"$id"}})
        |MATCH (addedBy :User)-[:CREATED]->(ri)
        |$returnFields
      """.stripMargin

    val params = parameters("id", id)

    tx.run(query, params).map {
      result => recordToRemoteIngest(result.single())
    }
  }

  override def getRemoteIngestJobs(maybeWorkspaceId: Option[String], onlyStatuses: List[RemoteIngestStatus], maybeSinceUTCEpoch: Option[Long]): Attempt[List[RemoteIngest]] = attemptTransaction { tx =>
    // important: don't remove the whitespace around the comparison operators in the where clauses, as they are used to split the string later
    val filters = List(
      maybeWorkspaceId.map("ri.workspaceId = $workspaceId" -> _),
      if(onlyStatuses.isEmpty) None else Some("ri.status IN $statuses" -> onlyStatuses.map(_.toString).toArray),
      maybeSinceUTCEpoch.map("ri.createdAt > $since" -> _)
    ).flatten

    val query = s"""
          |MATCH (ri:RemoteIngest)
          |${if (filters.isEmpty) "" else s"WHERE ${filters.toMap.keys.mkString(" AND ")}"}
          |MATCH (addedBy :User)-[:CREATED]->(ri)
          |$returnFields
        """.stripMargin

    val params = parameters(
      filters.flatMap { case (whereClause, value) => List(whereClause.split(" ").last.substring(1), value) }: _*
    )

    tx.run(query, params).map { result =>
      result.list().asScala.map(recordToRemoteIngest).toList
    }
  }

  override def getRelevantRemoteIngestJobs(workspaceId: String): Attempt[List[RemoteIngest]] = getRemoteIngestJobs(
    maybeWorkspaceId = Some(workspaceId),
    onlyStatuses = List(RemoteIngestStatus.Queued, RemoteIngestStatus.Ingesting, RemoteIngestStatus.Failed),
    maybeSinceUTCEpoch = Some(DateTime.now.minusDays(14).getMillis)
  )

  override def updateRemoteIngestJobStatus(id: String, status: RemoteIngestStatus): Attempt[Unit] = attemptTransaction { tx =>
    val query =
      """
        |MATCH (ri:RemoteIngest {id: $id})
        |SET ri.status = $status
        |RETURN COUNT(ri) AS updatedCount
      """.stripMargin
    val params = parameters("id", id, "status", status.toString)
    tx.run(query, params).map { result =>
      val updatedCount = result.single().get("updatedCount").asInt()
      if (updatedCount == 0) {
        Attempt.Left(NotFoundFailure(s"No RemoteIngest job found with id $id to update status."))
      } else ()
    }
  }

  override def updateRemoteIngestJobBlobUris(id: String, blobUris: List[String]): Attempt[Unit] = attemptTransaction { tx =>
    val query =
      """
        |MATCH (ri:RemoteIngest {id: $id})
        |SET ri.blobUris = $blobUris
        |RETURN COUNT(ri) AS updatedCount
      """.stripMargin
    val params = parameters("id", id, "blobUris", blobUris.asJava)
    tx.run(query, params).map { result =>
      val updatedCount = result.single().get("updatedCount").asInt()
      if (updatedCount == 0) {
        Attempt.Left(NotFoundFailure(s"No RemoteIngest job found with id $id to update blobUri."))
      } else ()
    }
  }

}
