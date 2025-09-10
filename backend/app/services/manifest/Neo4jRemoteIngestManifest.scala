package services.manifest

import model.ingestion.RemoteIngest
import org.neo4j.driver.v1.Driver
import services.Neo4jQueryLoggingConfig
import utils.{Logging, Neo4jHelper}
import utils.attempt.{Attempt, Failure, NotFoundFailure}
import org.neo4j.driver.v1.Values.parameters

import scala.concurrent.ExecutionContext
import scala.jdk.CollectionConverters.CollectionHasAsScala

object Neo4jRemoteIngestManifest {
  def setupManifest(driver: Driver, executionContext: ExecutionContext, queryLoggingConfig: Neo4jQueryLoggingConfig): Either[Failure, Neo4jRemoteIngestManifest] = {
    val neo4jManifest = new Neo4jRemoteIngestManifest(driver, executionContext, queryLoggingConfig)
    neo4jManifest.setup().map(_ => neo4jManifest)
  }
}

class Neo4jRemoteIngestManifest(driver: Driver, executionContext: ExecutionContext, queryLoggingConfig: Neo4jQueryLoggingConfig)
  extends Neo4jHelper(driver, executionContext, queryLoggingConfig) with RemoteIngestManifest with Logging {


  implicit val ec: ExecutionContext = executionContext

  override def setup(): Either[Failure, Unit] = transaction { tx =>
    tx.run("CREATE CONSTRAINT ON (remoteIngest: RemoteIngest)   ASSERT remoteIngest.id   IS UNIQUE")
    tx.run("CREATE INDEX ON :RemoteIngest(status)")
    Right(())
  }

  override def insertRemoteIngest(ingest: RemoteIngest): Attempt[String] = attemptTransaction { tx =>
    val query =
      """
        |CREATE (ri:RemoteIngest {
        |  id: $id,
        |  title: $title,
        |  status: $status,
        |  workspaceId: $workspaceId,
        |  parentFolderId: $parentFolderId,
        |  collection: $collection,
        |  ingestion: $ingestion,
        |  timeoutAt: $timeoutAt,
        |  url: $url,
        |  userEmail: $userEmail
        |})
        |RETURN ri.id AS id
    """.stripMargin

    val params = parameters(
      "id", ingest.id,
      "title", ingest.title,
      "status", ingest.status,
      "workspaceId", ingest.workspaceId,
      "parentFolderId", ingest.parentFolderId,
      "collection", ingest.collection,
      "ingestion", ingest.ingestion,
      "timeoutAt", ingest.timeoutAt.getMillis,
      "url", ingest.url,
      "userEmail", ingest.userEmail
    )
    
    tx.run(query, params).map(res => res.single().get("id").asString())
  }

  private def recordToRemoteIngest(record: org.neo4j.driver.v1.Record): RemoteIngest = {
    RemoteIngest(
      record.get("id").asString(),
      record.get("title").asString(),
      record.get("status").asString(),
      record.get("workspace_id").asString(),
      record.get("parent_folder_id").asString(),
      record.get("collection").asString(),
      record.get("ingestion").asString(),
      new org.joda.time.DateTime(record.get("timeout_at").asLong(), org.joda.time.DateTimeZone.UTC),
      record.get("url").asString(),
      record.get("user_email").asString()
    )
  }

  override def getRemoteIngestJob(id: String): Attempt[RemoteIngest] = attemptTransaction { tx =>
    val query =
      """
        |MATCH (ri:RemoteIngest {id: $id})
        |RETURN ri.id AS id,
        |       ri.title AS title,
        |       ri.status AS status,
        |       ri.workspaceId AS workspace_id,
        |       ri.parentFolderId AS parent_folder_id,
        |       ri.collection AS collection,
        |       ri.ingestion AS ingestion,
        |       ri.timeoutAt AS timeout_at,
        |       ri.url AS url,
        |       ri.userEmail AS user_email
      """.stripMargin

    val params = parameters("id", id)
    tx.run(query, params).map {
      result => recordToRemoteIngest(result.single())
    }
  }

  override def getRemoteIngestJobs(status: Option[String]): Attempt[List[RemoteIngest]] = attemptTransaction { tx =>
    val (query, params) = status match {
      case Some(s) =>
        ("""
          |MATCH (ri:RemoteIngest)
          |WHERE ri.status = $status
          |RETURN ri.id AS id,
          |       ri.title AS title,
          |       ri.status AS status,
          |       ri.workspaceId AS workspace_id,
          |       ri.parentFolderId AS parent_folder_id,
          |       ri.collection AS collection,
          |       ri.ingestion AS ingestion,
          |       ri.timeoutAt AS timeout_at,
          |       ri.url AS url,
          |       ri.userEmail AS user_email
        """.stripMargin, parameters("status", s))
      case None =>
        ("""
          |MATCH (ri:RemoteIngest)
          |RETURN ri.id AS id,
          |       ri.title AS title,
          |       ri.status AS status,
          |       ri.workspaceId AS workspace_id,
          |       ri.parentFolderId AS parent_folder_id,
          |       ri.collection AS collection,
          |       ri.ingestion AS ingestion,
          |       ri.timeoutAt AS timeout_at,
          |       ri.url AS url,
          |       ri.userEmail AS user_email
        """.stripMargin, parameters())
    }
    tx.run(query, params).map { result =>
      result.list().asScala.map(recordToRemoteIngest).toList
    }
  }

  override def updateRemoteIngestJobStatus(id: String, status: String): Attempt[Unit] = attemptTransaction { tx =>
    val query =
      """
        |MATCH (ri:RemoteIngest {id: $id})
        |SET ri.status = $status
        |RETURN COUNT(ri) AS updatedCount
      """.stripMargin
    val params = parameters("id", id, "status", status)
    tx.run(query, params).map { result =>
      val updatedCount = result.single().get("updatedCount").asInt()
      if (updatedCount == 0) {
        Attempt.Left(NotFoundFailure(s"No RemoteIngest job found with id $id to update status."))
      } else ()
    }
  }

}
