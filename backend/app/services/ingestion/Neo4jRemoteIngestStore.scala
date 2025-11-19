package services.ingestion

import model.ingestion.{RemoteIngest, RemoteIngestStatus, RemoteIngestTask}
import model.user.DBUser
import org.joda.time.DateTime
import model.ingestion.RemoteIngestStatus.RemoteIngestStatus
import org.neo4j.driver.v1.Driver
import org.neo4j.driver.v1.Values.parameters
import services.Neo4jQueryLoggingConfig
import utils.attempt.{Attempt, Failure, NotFoundFailure}
import utils.{Logging, Neo4jHelper}
import java.util.{Map => JavaMap}

import scala.concurrent.ExecutionContext
import scala.jdk.CollectionConverters.{CollectionHasAsScala, IterableHasAsJava, MapHasAsScala}

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
    tx.run("CREATE CONSTRAINT ON (task: RemoteIngestTask)   ASSERT task.id   IS UNIQUE")
    tx.run("CREATE INDEX ON :RemoteIngestTask(status)")
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
        |CREATE (wst: RemoteIngestTask {
        |  type: 'WebpageSnapshot',
        |  id: $webpageSnapshotId,
        |  status: $status,
        |  blobUris: []
        |})
        |CREATE (mdt: RemoteIngestTask {
        |  type: 'MediaDownload',
        |  id: $mediaDownloadId,
        |  status: $status,
        |  blobUris: []
        | })
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
        |CREATE (ri)-[:HAS_TASK]->(mdt)
        |CREATE (ri)-[:HAS_TASK]->(wst)
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
    |       addedBy as added_by,
    |       COLLECT({id: task.id, status: task.status, blobUris: task.blobUris, type: task.type}) AS tasks
  """.stripMargin

  private def recordToRemoteIngest(record: org.neo4j.driver.v1.Record): RemoteIngest = {
    val createdAt = new org.joda.time.DateTime(record.get("created_at").asLong(), org.joda.time.DateTimeZone.UTC)
    RemoteIngest(
      id = record.get("id").asString(),
      title = record.get("title").asString(),
      workspaceId = record.get("workspace_id").asString(),
      parentFolderId = record.get("parent_folder_id").asString(),
      collection = record.get("collection").asString(),
      ingestion = record.get("ingestion").asString(),
      createdAt = createdAt,
      url = record.get("url").asString(),
      addedBy = DBUser.fromNeo4jValue(record.get("added_by")).toPartial,
      tasks = record.get("tasks").asList().asScala.map(RemoteIngestTask(
        new DateTime().minusHours(2).isAfter(createdAt)
      )).toMap
    )
  }
  override def getRemoteIngestJob(id: String): Attempt[RemoteIngest] = attemptTransaction { tx =>
    val query =
      s"""
        |MATCH (ri:RemoteIngest {id: ${"$id"}})
        |MATCH (addedBy :User)-[:CREATED]->(ri)
        |MATCH (ri)-[:HAS_TASK]->(task: RemoteIngestTask)
        |$returnFields
      """.stripMargin

    val params = parameters("id", id)

    tx.run(query, params).map {
      result => recordToRemoteIngest(result.single())
    }
  }

  override def getRemoteIngestJobs(maybeWorkspaceId: Option[String], maybeSinceUTCEpoch: Option[Long], maybeContainsTaskWithStatusIn: Option[List[RemoteIngestStatus]]): Attempt[List[RemoteIngest]] = attemptTransaction { tx =>
    // important: don't remove the whitespace around the comparison operators in the where clauses, as they are used to split the string later
    val filters = List(
      maybeWorkspaceId.map("ri.workspaceId = $workspaceId" -> _),
      maybeSinceUTCEpoch.map("ri.createdAt > $since" -> _),
      maybeContainsTaskWithStatusIn.map("task.status IN $taskStatuses" -> _.map(_.toString).toArray )
    ).flatten

    val query = s"""
          |MATCH (ri:RemoteIngest)-[:HAS_TASK]->(task: RemoteIngestTask)
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
    maybeSinceUTCEpoch = Some(DateTime.now.minusDays(14).getMillis),
    maybeContainsTaskWithStatusIn = Some(List(
      RemoteIngestStatus.Queued,
      RemoteIngestStatus.Ingesting,
      RemoteIngestStatus.TimedOut,
      RemoteIngestStatus.Failed,
    ))
  )

  private def updateRemoteIngestTaskStatus(taskId: String, status: String): Attempt[Unit] = attemptTransaction { tx =>
    val query =
      """
        |MATCH (rit:RemoteIngestTask {id: $taskId})
        |SET rit.status = $status
        |RETURN COUNT(rit) AS updatedCount
      """.stripMargin
    val params = parameters("taskId", taskId, "status", status)
    tx.run(query, params).map { result =>
      val updatedCount = result.single().get("updatedCount").asInt()
      if (updatedCount == 0) {
        Attempt.Left(NotFoundFailure(s"No RemoteIngestTask found with id $taskId to update status."))
      } else ()
    }
  }

  override def updateRemoteIngestTaskStatus(taskId: String, status: RemoteIngestStatus): Attempt[Unit] =
    updateRemoteIngestTaskStatus(taskId, status.toString)

  override def archiveRemoteIngestTask(taskId: String): Attempt[Unit] =
    updateRemoteIngestTaskStatus(taskId, "ARCHIVED")

  override def updateRemoteIngestTaskBlobUris(taskId: String, blobUris: List[String]): Attempt[Unit] = attemptTransaction { tx =>
    val query =
      """
        |MATCH (rit: RemoteIngestTask {id: $taskId})
        |SET rit.blobUris = $blobUris
        |RETURN COUNT(rit) AS updatedCount
      """.stripMargin
    val params = parameters("taskId", taskId, "blobUris", blobUris.asJava)
    tx.run(query, params).map { result =>
      val updatedCount = result.single().get("updatedCount").asInt()
      if (updatedCount == 0) {
        Attempt.Left(NotFoundFailure(s"No RemoteIngestTask found with id $taskId to update blobUri."))
      } else ()
    }
  }

}
