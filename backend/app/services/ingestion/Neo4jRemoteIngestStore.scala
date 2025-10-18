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
        |  webpageSnapshotId: $webpageSnapshotId,
        |  tasks: {
        |    $mediaDownloadId: {
        |      id: $mediaDownloadId,
        |      status: $status,
        |      blobUris: []
        |    },
        |    $webpageSnapshotId: {
        |      id: $webpageSnapshotId,
        |      status: $status,
        |      blobUris: []
        |    }
        |  }
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
    |       ri.tasks AS tasks
  """.stripMargin

  private def parseTasksMap(tasksMap: JavaMap[String, Object]): Map[String, RemoteIngestTask] = {
    tasksMap.asScala.toMap.map { case (taskId, taskValue) =>
      val taskMap = taskValue.asInstanceOf[JavaMap[String, Object]].asScala.toMap
      val blobUris =
        if (taskMap.contains("blobUris") && taskMap("blobUris") != null)
          taskMap("blobUris").asInstanceOf[java.util.List[String]].asScala.toList
        else List()
      val status =
        if (taskMap.contains("status") && taskMap("status") != null)
          RemoteIngestStatus withName taskMap("status").asInstanceOf[String]
        else RemoteIngestStatus.Queued
      taskId -> RemoteIngestTask(
        id = taskId,
        status = status,
        blobUris = blobUris
      )
    }
  }

  private def recordToRemoteIngest(record: org.neo4j.driver.v1.Record): RemoteIngest = {
    RemoteIngest(
      id = record.get("id").asString(),
      title = record.get("title").asString(),
      workspaceId = record.get("workspace_id").asString(),
      parentFolderId = record.get("parent_folder_id").asString(),
      collection = record.get("collection").asString(),
      ingestion = record.get("ingestion").asString(),
      createdAt = new org.joda.time.DateTime(record.get("created_at").asLong(), org.joda.time.DateTimeZone.UTC),
      url = record.get("url").asString(),
      addedBy = DBUser.fromNeo4jValue(record.get("added_by")).toPartial,
      tasks = parseTasksMap(record.get("tasks").asMap())
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

  override def updateRemoteIngestJobStatus(id: String, taskId: String, status: RemoteIngestStatus): Attempt[Unit] = attemptTransaction { tx =>
    val query =
      """
        |MATCH (ri:RemoteIngest {id: $id})
        |SET ri.tasks.$taskId.status = $status
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

  override def updateRemoteIngestJobBlobUris(id: String, taskId: String, blobUris: List[String]): Attempt[Unit] = attemptTransaction { tx =>
    val query =
      """
        |MATCH (ri:RemoteIngest {id: $id})
        |SET ri.tasks.$taskId.blobUris = $blobUris
        |RETURN COUNT(ri) AS updatedCount
      """.stripMargin
    val params = parameters("id", id, "taskId", taskId, "blobUris", blobUris.asJava)
    tx.run(query, params).map { result =>
      val updatedCount = result.single().get("updatedCount").asInt()
      if (updatedCount == 0) {
        Attempt.Left(NotFoundFailure(s"No RemoteIngest job found with id $id to update blobUri."))
      } else ()
    }
  }

}
