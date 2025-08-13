package services.manifest

import cats.instances.either._
import cats.instances.list._
import cats.syntax.traverse._
import commands.IngestFileResult
import extraction.{ExtractionParams, Extractor}
import model._
import model.annotations.WorkspaceMetadata
import model.frontend.email.EmailNeighbours
import model.frontend.{BasicResource, ExtractionFailureSummary, ExtractionFailures, ResourcesForExtractionFailure}
import model.ingestion.{IngestionFile, WorkspaceItemContext, WorkspaceItemUploadContext}
import model.manifest._
import model.user.DBUser
import org.joda.time.DateTime
import org.neo4j.driver.v1.Values.parameters
import org.neo4j.driver.v1.{Driver, StatementResult, StatementRunner, Value}
import services.Neo4jQueryLoggingConfig
import services.manifest.Manifest.WorkCounts
import utils._
import utils.attempt.{Attempt, Failure, IllegalStateFailure, NotFoundFailure}

import java.nio.file.Path
import java.time.Instant
import scala.concurrent.ExecutionContext
import scala.jdk.CollectionConverters._

object Neo4jManifest {
  def setupManifest(driver: Driver, executionContext: ExecutionContext, queryLoggingConfig: Neo4jQueryLoggingConfig): Either[Failure, Manifest] = {
    val neo4jManifest = new Neo4jManifest(driver, executionContext, queryLoggingConfig)
    neo4jManifest.setup().map(_ => neo4jManifest)
  }
}

class Neo4jManifest(driver: Driver, executionContext: ExecutionContext, queryLoggingConfig: Neo4jQueryLoggingConfig)
  extends Neo4jHelper(driver, executionContext, queryLoggingConfig) with Manifest with Logging {
  import Neo4jHelper._

  implicit val ec = executionContext

  override def setup(): Either[Failure, Unit] = transaction { tx =>
      tx.run("CREATE CONSTRAINT ON (resource: Resource)   ASSERT resource.uri   IS UNIQUE")
      tx.run("CREATE CONSTRAINT ON (extractor: Extractor) ASSERT extractor.name IS UNIQUE")
      tx.run("CREATE CONSTRAINT ON (tpe: MimeType)        ASSERT tpe.mimeType   IS UNIQUE")

      Right(())
  }

  override def insertCollection(uri: String, display: String, createdBy: String): Attempt[Collection] = attemptTransaction { tx =>
    tx.run("""
      CREATE (c:Collection:Resource {uri: {uri}, display: {display}, createdBy: {createdBy}})
      RETURN c
      """,
      parameters(
        "uri", uri,
        "display", display,
        "createdBy", createdBy
      )
    ).map(result => Collection.fromNeo4jValue(result.single.get("c")))
  }

  override def getCollections: Attempt[List[Collection]] = attemptTransaction { tx =>
    val statementResult = tx.run(
      """
        |MATCH (c:Collection)
        |OPTIONAL MATCH (c)<-[:PARENT]-(i: Ingestion)
        |RETURN c, i
      """.stripMargin)

    for {
      summary <- statementResult
      results = summary.list().asScala.toList
    } yield {
      Collection.mergeCollectionsAndIngestions(results)
    }
  }


  override def getCollectionsForBlob(blobUri: String): Attempt[Map[Collection, Seq[String]]] = attemptTransaction { tx =>
    val statementResult = tx.run(
      """
        |MATCH (b:Blob:Resource {uri: {blob}})-[r:PARENT*]->(c:Collection)
        |OPTIONAL MATCH (u:User)-[:CAN_SEE]->(c:Collection)
        |RETURN DISTINCT c, COLLECT(DISTINCT u.username) as usernames
      """.stripMargin,
      parameters(
        "blob", blobUri,
      ))

    for {
      summary <- statementResult
      results = summary.list().asScala.toList
    } yield {
      Collection.mergeCollectionAndUsers(results)
    }
  }

  override def getWorkspacesForBlob(blobUri: String): Attempt[List[WorkspaceMetadata]] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (w:WorkspaceNode {uri: {uri}})-[:PART_OF]->(workspace:Workspace)
        |MATCH (creator :User)-[:CREATED]->(workspace)<-[:FOLLOWING]-(follower :User)
        |return  workspace, creator, collect(distinct follower) as followers
        |""".stripMargin,
      parameters(
        "uri", blobUri,
      )).map { summary =>
        summary.list().asScala.toList.map { r =>
          val workspace = r.get("workspace")
          val creator = DBUser.fromNeo4jValue(r.get("creator"))
          val followers = r.get("followers").asList[DBUser](DBUser.fromNeo4jValue(_)).asScala.toList

          WorkspaceMetadata.fromNeo4jValue(workspace, creator, followers)
        }
    }
  }

  override def getCollection(collection: Uri): Attempt[Collection] = attemptTransaction { tx =>
    val statementResult = tx.run(
      """
        |MATCH (c:Collection {uri: {collectionName}})
        |OPTIONAL MATCH (c)<-[:PARENT]-(i: Ingestion)
        |RETURN c, i
      """.stripMargin,
      parameters("collectionName", collection.value))

    for {
      summary <- statementResult
      results = summary.list().asScala.toList
      collection <- Collection.mergeCollectionsAndIngestions(results).find(_.uri == collection) match {
        case Some(c) => Attempt.Right(c)
        case None => Attempt.Left(NotFoundFailure(s"Collection $collection does not exist."))
      }
    } yield collection
  }

  override def getResource(resourceUri: Uri): Either[Failure, BasicResource] = transaction { tx =>
    val result = tx.run(
      """
        |MATCH (resource: Resource {uri: {resourceUri}})
        |OPTIONAL MATCH (parents: Resource)<-[:PARENT]-(resource)
        |OPTIONAL MATCH (resource)<-[:PARENT]-(children: Resource)
        |RETURN resource, parents, children
      """.stripMargin,
      parameters("resourceUri", resourceUri.value))

    val failureOrResults = result.list().asScala.hasKeyOrFailure("resource", s"Resource '${resourceUri.value}' does not exist.")

    failureOrResults.map{ results =>

      val resource = results.map(r => r.get("resource")).toList.distinct

      val children = results.filter(r => r.containsKey("children")).map(r => r.get("children")).filter(v => !v.isNull)
        .toList.distinct

      val parents = results.filter(r => r.containsKey("parents")).map(r => r.get("parents")).filter(v => !v.isNull)
        .toList.distinct

      BasicResource.fromNeo4jValues(resource.head, parents, children)
    }
  }

  override def getIngestions(collection: Uri): Attempt[Seq[Ingestion]] = attemptTransaction { tx =>
    val statementResult = tx.run("MATCH (i :Ingestion)-[:PARENT]->(c :Collection {uri: {collectionName}}) RETURN i, c",
      parameters("collectionName", collection.value))

    for {
      summary <- statementResult
      results <- summary.list().asScala.toList.hasKeyOrFailure("c", NotFoundFailure(s"Collection '$collection' does not exist."))
    } yield results.map(r => Ingestion.fromNeo4jValue(r.get("i")))
  }


  override def getIngestionCount(collection: Uri): Attempt[Int] = attemptTransaction { tx =>
    val statementResult = tx.run(
      """
        |MATCH (c: Collection {uri: {collection}})
        |OPTIONAL MATCH (c)<-[:PARENT]-(i: Ingestion)
        |RETURN c, COUNT(i)
      """.stripMargin,
      parameters("collection", collection.value))

    for {
      summary <- statementResult
      records <- summary.list().asScala.hasKeyOrFailure("c", NotFoundFailure(s"Collection '$collection' does not exist."))
    } yield {
      records.find(r => r.containsKey("COUNT(i)")).map(r => r.get("COUNT(i)").asInt()).getOrElse(0)
    }
  }

  override def getIngestion(uri: Uri): Attempt[Ingestion] = attemptTransaction { tx =>
    val statementResult = tx.run(
      """
        | MATCH (i: Ingestion { uri: {uri} }) RETURN i
      """.stripMargin,
      parameters("uri", uri.value)
    )

    for {
      summary <- statementResult
      records <- summary.list().asScala.hasKeyOrFailure("i", NotFoundFailure(s"Ingestion '$uri' does not exist"))
    } yield {
      Ingestion.fromNeo4jValue(records.head.get("i"))
    }
  }

  override def insertIngestion(collectionUri: Uri, ingestionUri: Uri, display: String, path: Option[Path], languages: List[Language], fixed: Boolean, default: Boolean): Attempt[Uri] = attemptTransaction { tx =>
    val statementResult = tx.run(
      """
        |MATCH (c: Collection {uri: {collectionUri}})
        |
        |CREATE (i:Ingestion:Resource {
        |  uri: {uri},
        |  display: {display},
        |  startTime: {startTime},
        |  endTime: {endTime},
        |  path: {path},
        |  languages: {languages},
        |  fixed: {fixed},
        |  default: {default}
        |})-[:PARENT]->(c)
        |RETURN i, c
      """.stripMargin,
      parameters(
        "collectionUri", collectionUri.value,
        "uri", ingestionUri.value,
        "display", display,
        "path", path.map(_.toAbsolutePath.toString).orNull,
        "startTime", Instant.now.toEpochMilli.asInstanceOf[java.lang.Long],
        "endTime", null,
        "languages", languages.map(_.key).asJava,
        "fixed", Boolean.box(fixed),
        "default", Boolean.box(default)
      )
    )

    for {
      summary <- statementResult
      _ <- summary.list().asScala.hasKeyOrFailure("c", NotFoundFailure(s"Collection '${collectionUri.value}' does not exist."))
    } yield ingestionUri
  }

  def markResourceAsExpandable(tx: StatementRunner, resourceUri: Uri): Either[Failure, Unit] = {
    // if resource at uri is a blob, both the blob and its parent:File are expandable
    // otherwise it is expandable

    // * = isExpandable
    //
    // (parent:File)*->(resource:Blob)*     ->(file:File)->(blob:Blob)
    //                 (resource:Email)*    ->(file:File)->(blob:Blob)
    //                 (resource:Directory)*->(file:File)->(blob:Blob)
    //                 (resource:Ingestion)*->(file:File)->(blob:Blob)
    tx.run(
      """
        |MATCH (resource :Resource {uri: {resourceUri}})
        |SET resource.isExpandable = true
      """.stripMargin,
      parameters(
        "resourceUri", resourceUri.value
      )
    )

    tx.run(
      """
        |MATCH (blob :Blob:Resource {uri: {resourceUri}})
        |MATCH (parent :File:Resource)<-[:PARENT]-(blob)
        |SET parent.isExpandable = true
      """.stripMargin,
      parameters(
        "resourceUri", resourceUri.value
      )
    )

    Right(())
  }

  def markParentFileAsExpandableIfBlobIsExpandable(tx: StatementRunner, blobUri: Uri): Either[Failure, Unit] = {
    tx.run(
      """
        |MATCH (blob :Blob:Resource {isExpandable: true, uri: {blobUri}})
        |MATCH (parent :File:Resource)<-[:PARENT]-(blob)
        |SET parent.isExpandable = true
      """.stripMargin,
      parameters(
        "blobUri", blobUri.value
      )
    )

    Right(())
  }

  def insertDirectory(tx: StatementRunner, parentUri: Uri, uri: Uri, display: Option[String] = None): Either[Failure, Unit] = {
    tx.run(
      """
         |MERGE (parent:Resource {uri: {parentUri}})
         |MERGE (directory:Resource {uri: {uri}})
         |SET directory:Directory
         |MERGE (directory)-[:PARENT]->(parent)
         |
         |SET directory.display = {display}
      """.stripMargin,
      parameters(
        "parentUri", parentUri.value,
        "uri", uri.value,
        "display", display.orNull
      )
    )

    markResourceAsExpandable(tx, parentUri)

    Right(())
  }

  def insertBlob(tx: StatementRunner, file: IngestionFile, uri: Uri, parentBlobs: List[Uri], mimeType: MimeType,
                 ingestion: String, languages: List[String], extractors: Iterable[Extractor], workspace: Option[WorkspaceItemContext]): Either[Failure, Unit] = {
    def toParameterMap(e: Extractor): java.util.Map[String, Object] = {
      Map[String, Object](
        "name" -> e.name,
        "indexing" -> Boolean.box(e.indexing),
        "extractorPriority" -> Int.box(e.priority),
        "priority" -> Int.box(if(workspace.nonEmpty) { e.priority * 100 } else { e.priority }),
        "cost" -> Long.box(e.cost(mimeType, file.size)),
        "external" -> Boolean.box(e.external)
      ).asJava
    }

    val maybeWorkspaceProperties = workspace.map { _ =>
      """
        |,
        |workspaceId: {workspaceId},
        |workspaceNodeId: {workspaceNodeId},
        |workspaceBlobUri: {workspaceBlobUri}
        |""".stripMargin
    }.getOrElse("")

    val result = tx.run(
      s"""
        |MATCH (parent:Resource {uri: {parentUri}})
        |
        |MERGE (file:File:Resource {uri: {fileUri}})
        |MERGE (blob:Blob:Resource {uri: {blobUri}, size: {size}})
        |MERGE (mimeType:MimeType {mimeType: {mimeType}})
        |
        |MERGE (parent)<-[:PARENT]-(file)
        |MERGE (file)<-[:PARENT]-(blob)
        |MERGE (blob)-[:TYPE_OF]-(mimeType)
        |
        |WITH {extractorParamsArray} as extractors
        |UNWIND extractors as extractorParam
        |  MERGE (extractor :Extractor {name: extractorParam.name, indexing: extractorParam.indexing, priority: extractorParam.extractorPriority, external: extractorParam.external})
        |    WITH extractor, extractorParam.cost as cost, extractorParam.priority as priority
        |
        |  MATCH (unprocessedBlob: Blob:Resource {uri: {blobUri}})
        |    WHERE
        |      NOT (unprocessedBlob)<-[:PROCESSED {
        |        ingestion: {ingestion},
        |        languages: {languages},
        |        parentBlobs: {parentBlobs}
        |        ${maybeWorkspaceProperties}
        |      } ]-(extractor)
        |
        |  MERGE (unprocessedBlob)<-[todo:TODO {
        |    ingestion: {ingestion},
        |    languages: {languages},
        |    parentBlobs: {parentBlobs}
        |    ${maybeWorkspaceProperties}
        |  }]-(extractor)
        |    ON CREATE SET todo.cost = cost,
        |                  todo.priority = priority,
        |                  todo.attempts = 0
      """.stripMargin,
      parameters(
        "parentUri", file.parentUri.value,
        "fileUri", file.uri.value,
        "blobUri", uri.value,
        "size", file.size.asInstanceOf[java.lang.Long],
        "mimeType", mimeType.mimeType,
        "ingestion", ingestion,
        "extractorParamsArray", extractors.map(toParameterMap).toArray,
        "languages", languages.asJava,
        "parentBlobs", parentBlobs.map(_.value).toArray,
        "workspaceId", workspace.map(_.workspaceId).orNull,
        "workspaceNodeId", workspace.map(_.workspaceNodeId).orNull,
        "workspaceBlobUri", workspace.map(_.blobAddedToWorkspace).orNull
      )
    )

    // This operation will have an effect when we've just added a CHILD to a blob.
    // We look for a parent blob (and its parent file) and mark them as expandable.
    markResourceAsExpandable(tx, file.parentUri)

    // This operation will have an effect when we've just added a new PARENT to an existing expandable blob.
    // When you add a new file parent to an expandable blob, you need to mark that parent isExpandable,
    // because if the blob's already there, we won't be re-processing all its children,
    // so the markResourceAsExpandable step won't do what we want.
    // Note that this is a no-op if we've just added the blob for the first time,
    // since we have yet to delve into its children and mark the blob as expandable if it has them.
    markParentFileAsExpandableIfBlobIsExpandable(tx, blobUri = uri)

    Right(())
  }

  def insertEmail(tx: StatementRunner, email: Email, parent: Uri): Either[Failure, Unit] = {
    // KEEP IN MIND AN EMAIL RECORD IN THE MANIFEST IS A *RECEIVED* EMAIL NOT A SENT EMAIL SO THERE CAN BE MANY COPIES OF IT

    tx.run(
      """
        |MERGE (parent: Resource {uri: {parentUri}})
        |
        |MERGE (message:Resource {uri: {uri}})
        |SET message:Email
        |SET message.haveSource = true
        |SET message.display = {subject}
        |
        |MERGE (parent)<-[:PARENT]-(message)
        |
        |FOREACH(refersToUri in {referenceUrisParam} |
        |  MERGE (refersTo:Email:Resource {uri: refersToUri})
        |  MERGE (refersTo)<-[:REFERENCED]-(message)
        |)
        |
        |FOREACH(repliesToUri in {inReplyToUrisParam} |
        |  MERGE (reply:Email:Resource {uri: repliesToUri})
        |  MERGE (reply)<-[:IN_REPLY_TO]-(message)
        |)
      """.stripMargin,
      parameters(
        "parentUri", parent.value,
        "uri", email.uri.value,
        "subject", email.subject,
        "referenceUrisParam", email.references.asJava,
        "inReplyToUrisParam", email.inReplyTo.asJava
      )
    )

    markResourceAsExpandable(tx, parent)

    Right(())
  }

  override def fetchWork(workerName: String, maxBatchSize: Int, maxCost: Int): Either[Failure, List[WorkItem]] = transaction { tx =>
    val summary = tx.run(
      s"""
        |MERGE (worker:Worker {name: {workerName}})
        |  WITH
        |    worker
        |
        |MATCH (e: Extractor)-[todo: TODO]->(b: Blob:Resource)
        |  WHERE
        |    NOT (b)-[:LOCKED_BY]->(:Worker) AND todo.attempts < {maxExtractionAttempts}
        |
        |  WITH worker, todo, e, b
        |  // priority was originally just defined for extractors, we later extended it out to todos as well
        |  // This maintains roll forward/backward compatibility with both
        |  ORDER BY coalesce(todo.priority, e.priority) DESC
        |  LIMIT {maxBatchSize}
        |
        |WITH collect({todo: todo, extractor: e, blob: b, worker: worker}) as allTasks
        |WITH tail(reduce(acc = [0, []], task in allTasks |
        |    case
        |      when size(acc[1]) > 0 AND (acc[0] + task.todo.cost) >= {maxCost}
        |        then [acc[0], acc[1]]
        |      else
        |        [acc[0] + task.todo.cost, acc[1] + task]
        |     end
        |  )) as tasks
        |
        |UNWIND tasks[0] as task
        |  MATCH (blob: Blob:Resource { uri: task.blob.uri })-[:TYPE_OF]-(m: MimeType)
        |  MATCH (worker :Worker { name: task.worker.name })
        |
        |  SET task.todo.attempts = task.todo.attempts + 1
        |  MERGE (blob)-[:LOCKED_BY]->(worker)
        |
        |RETURN
        |    blob,
        |    collect(m) as types,
        |    task.extractor.name as extractorName,
        |    task.todo.ingestion as ingestion,
        |    task.todo.languages as languages,
        |    task.todo.parentBlobs as parentBlobs,
        |    task.todo.workspaceId as workspaceId,
        |    task.todo.workspaceNodeId as workspaceNodeId,
        |    task.todo.workspaceBlobUri as workspaceBlobUri
      """.stripMargin,
      parameters(
        "workerName", workerName,
        "maxExtractionAttempts", Int.box(maxExtractionAttempts),
        "maxBatchSize", Int.box(maxBatchSize),
        "maxCost", Int.box(maxCost)
      )
    )

    Right(summary.list().asScala.toList.map { r =>
      val rawBlob = r.get("blob")
      val mimeTypes = r.get("types").values()

      val blob = Blob.fromNeo4jValue(rawBlob, mimeTypes.asScala.toSeq)
      val extractorName = r.get("extractorName").asString()

      val ingestion = r.get("ingestion").asString()

      val workspaceId = r.get("workspaceId")
      val workspaceNodeId = r.get("workspaceNodeId")
      val workspaceBlobUri = r.get("workspaceBlobUri")

      val workspace = if(workspaceId.isNull || workspaceNodeId.isNull || workspaceBlobUri.isNull) {
        None
      } else {
        Some(WorkspaceItemContext(workspaceId.asString(), workspaceNodeId.asString(), workspaceBlobUri.asString()))
      }

      val rawLanguages = r.get("languages")
      val rawParentBlobs = r.get("parentBlobs")

      if(rawLanguages.isNull || rawParentBlobs.isNull) {
        val message = s"NULL languages or parentBlobs! blob: ${blob}. extractorName: ${extractorName}. ingestion: ${ingestion}. rawParentBlobs: ${rawParentBlobs}. rawLanguages: ${rawLanguages}. workspaceId: ${workspaceId}. workspaceNodeId: ${workspaceNodeId}. workspaceBlobUri: ${workspaceBlobUri}"
        logger.error(message)

        throw new IllegalStateException(message)
      } else {
        val languages = rawLanguages.asList(_.asString).asScala.toList.flatMap(Languages.getByKey)
        val parentBlobs: List[Uri] = rawParentBlobs.asList(_.asString, new java.util.ArrayList[String]()).asScala.toList.map(Uri(_))

        WorkItem(blob, parentBlobs, extractorName, ingestion, languages, workspace)
      }
    })
  }

  // Called by the workers themselves once a batch work is complete
  override def releaseLocks(workerName: String): Either[Failure, Unit] = transaction { tx =>
    logger.info(s"Releasing all locks for $workerName")
    tx.run(
      """
        |MATCH (resource :Resource)-[lock :LOCKED_BY]->(:Worker {name: {workerName}})
        |DELETE lock
        |WITH resource
        |MATCH (resource :Resource)<-[todo:TODO]-(e:Extractor)
        |WHERE NOT (resource)<-[:EXTRACTION_FAILURE]-(e)
        |SET todo.attempts = 0
      """.stripMargin,
      parameters(
        "workerName", workerName
      )
    )
    Right(())
  }

  // Called by AWSWorkerControl running on the frontend (webapp) instances to ensure that workers terminated
  // by a Riff-Raff deploy don't hold on to their work indefinitely and allow others to pick it up
  def releaseLocksForTerminatedWorkers(runningWorkerNames: List[String]): Either[Failure, Unit] = transaction { tx =>
    tx.run(
      """
        |MATCH (resource :Resource)-[lock:LOCKED_BY]->(w:Worker)
        |WHERE NOT w.name in {runningWorkerNames}
        |DELETE lock
        |WITH resource
        |MATCH (resource :Resource)<-[todo:TODO]-(e:Extractor)
        |WHERE NOT (resource)<-[:EXTRACTION_FAILURE]-(e)
        |SET todo.attempts = 0
      """.stripMargin,
      parameters(
        "runningWorkerNames", runningWorkerNames.asJava
      )
    )

    Right(())
  }

  override def markExternalAsComplete(uri: String, extractorName: String): Either[Failure, Unit] = transaction { tx =>

    logger.info(s"Marking ${uri} / ${extractorName} as complete")
    val result = tx.run(
      s"""
         |MATCH (b :Blob:Resource {uri: {uri}})<-[processing:PROCESSING_EXTERNALLY]-(e: Extractor {name: {extractorName}})
         |
         |MERGE (b)<-[processed:PROCESSED {
         |  ingestion: processing.ingestion,
         |  parentBlobs: processing.parentBlobs,
         |  languages: processing.languages
         |  }]-(e)
         |
         |FOREACH (_ IN CASE WHEN exists(processing.workspaceId) THEN [1] ELSE [] END |
         |  SET processed.workspaceId = processing.workspaceId
         |)
         |FOREACH (_ IN CASE WHEN exists(processing.workspaceBlobUri) THEN [1] ELSE [] END |
         |  SET processed.workspaceBlobUri = processing.workspaceBlobUri
         |)
         |FOREACH (_ IN CASE WHEN exists(processing.workspaceNodeId) THEN [1] ELSE [] END |
         |  SET processed.workspaceNodeId = processing.workspaceNodeId
         |)
         |DELETE processing
         |""".stripMargin,
      parameters(
        "uri", uri,
        "extractorName", extractorName,
      )
    )

    val counters = result.summary().counters()

    if (counters.relationshipsCreated() != 1 || counters.relationshipsDeleted() != 1) {
      Left(IllegalStateFailure(s"Unexpected number of creates/deletes in markAsComplete. Created: ${counters.relationshipsCreated()}. Deleted: ${counters.relationshipsDeleted()}"))
    } else {
      Right(())
    }
  }

  override def markAsComplete(params: ExtractionParams, blob: Blob, extractor: Extractor): Either[Failure, Unit] = transaction { tx =>
    logger.info(s"Marking ${blob.uri.value} / ${extractor.name} as complete")

    val maybeWorkspaceProperties = params.workspace.map { _ =>
      """
        |,
        |workspaceId: {workspaceId},
        |workspaceNodeId: {workspaceNodeId},
        |workspaceBlobUri: {workspaceBlobUri}
        |""".stripMargin
    }.getOrElse("")

    val result = tx.run(
      s"""
        |MATCH (b :Blob:Resource {uri: {uri}})<-[todo:TODO {
        |  ingestion: {ingestion},
        |  parentBlobs: {parentBlobs},
        |  languages: {languages}
        |  ${maybeWorkspaceProperties}
        |}]-(e: Extractor {name: {extractorName}})
        |
        |DELETE todo
        |
        |MERGE (b)<-[:PROCESSED {
        |  ingestion: {ingestion},
        |  parentBlobs: {parentBlobs},
        |  languages: {languages}
        |  ${maybeWorkspaceProperties}
        |}]-(e)
        |""".stripMargin,
      parameters(
        "uri", blob.uri.value,
        "extractorName", extractor.name,
        "ingestion", params.ingestion,
        "languages", params.languages.map(_.key).asJava,
        "parentBlobs", params.parentBlobs.map(_.value).asJava,
        "workspaceId", params.workspace.map(_.workspaceId).orNull,
        "workspaceNodeId", params.workspace.map(_.workspaceNodeId).orNull,
        "workspaceBlobUri", params.workspace.map(_.blobAddedToWorkspace).orNull
      )
    )

    val counters = result.summary().counters()

    if(counters.relationshipsCreated() != 1 || counters.relationshipsDeleted() != 1) {
      Left(IllegalStateFailure(s"Unexpected number of creates/deletes in markAsComplete. Created: ${counters.relationshipsCreated()}. Deleted: ${counters.relationshipsDeleted()}"))
    } else {
      Right(())
    }
  }

  override def markExternalAsProcessing(params: ExtractionParams, blob: Blob, extractor: Extractor): Either[Failure, Unit] = transaction { tx =>
    logger.info(s"Marking ${blob.uri.value} / ${extractor.name} as complete")

    val maybeWorkspaceProperties = params.workspace.map { _ =>
      """
        |,
        |workspaceId: {workspaceId},
        |workspaceNodeId: {workspaceNodeId},
        |workspaceBlobUri: {workspaceBlobUri}
        |""".stripMargin
    }.getOrElse("")

    val result = tx.run(
      s"""
         |MATCH (b :Blob:Resource {uri: {uri}})<-[todo:TODO {
         |  ingestion: {ingestion},
         |  parentBlobs: {parentBlobs},
         |  languages: {languages}
         |  ${maybeWorkspaceProperties}
         |}]-(e: Extractor {name: {extractorName}})
         |
         |DELETE todo
         |
         |MERGE (b)<-[processing_externally:PROCESSING_EXTERNALLY {
         |  ingestion: {ingestion},
         |  parentBlobs: {parentBlobs},
         |  languages: {languages}
         |  ${maybeWorkspaceProperties}
         |}]-(e)
         |    ON CREATE SET processing_externally.attempts = 1,
         |                  processing_externally.cost = e.cost,
         |                  processing_externally.priority = e.priority
         |""".stripMargin,
      parameters(
        "uri", blob.uri.value,
        "extractorName", extractor.name,
        "ingestion", params.ingestion,
        "languages", params.languages.map(_.key).asJava,
        "parentBlobs", params.parentBlobs.map(_.value).asJava,
        "workspaceId", params.workspace.map(_.workspaceId).orNull,
        "workspaceNodeId", params.workspace.map(_.workspaceNodeId).orNull,
        "workspaceBlobUri", params.workspace.map(_.blobAddedToWorkspace).orNull
      )
    )

    val counters = result.summary().counters()

    if (counters.relationshipsCreated() != 1 || counters.relationshipsDeleted() != 1) {
      Left(IllegalStateFailure(s"Unexpected number of creates/deletes in markAsComplete. Created: ${counters.relationshipsCreated()}. Deleted: ${counters.relationshipsDeleted()}"))
    } else {
      Right(())
    }
  }

  override def logExtractionFailure(blobUri: Uri, extractorName: String, stackTrace: String): Either[Failure, Unit] = transaction { tx =>
    tx.run(
      """
        |MATCH (b :Blob:Resource {uri: {blobUri}})
        |MATCH (e: Extractor {name: {extractorName}})
        |CREATE (b)<-[:EXTRACTION_FAILURE {stackTrace: {stackTrace}, at: {atTimeStamp}}]-(e)
      """.stripMargin,
      parameters(
        "blobUri", blobUri.value,
        "extractorName", extractorName,
        "stackTrace", stackTrace,
        "atTimeStamp", DateTime.now().getMillis.asInstanceOf[java.lang.Long]
      )
    )

    Right(())
  }

  override def getFailedExtractions: Either[Failure, ExtractionFailures] = transaction { tx =>
    val summary = tx.run(
      s"""
        |MATCH (b:Blob)<-[f:EXTRACTION_FAILURE]-(e: Extractor)
        |WITH DISTINCT { extractorName: e.name, stackTrace: f.stackTrace } as key, count(DISTINCT b) as numberOfBlobs
        |RETURN key, numberOfBlobs
        |ORDER BY numberOfBlobs DESC
      """.stripMargin
    )

    val results = summary.list().asScala.toList

    val failures = results.map { row =>
      val extractorName = row.get("key").get("extractorName").asString()
      val stackTrace = row.get("key").get("stackTrace").asString()
      val numberOfBlobs = row.get("numberOfBlobs").asLong()

      ExtractionFailureSummary(extractorName, stackTrace, numberOfBlobs)
    }

    Right(ExtractionFailures(failures))
  }

  def getResourcesForExtractionFailure(extractorName: String, stackTrace: String, page: Long, skip: Long, pageSize: Long): Either[Failure, ResourcesForExtractionFailure] = transaction { tx =>
    val summary = tx.run(
      s"""
         |MATCH (b:Blob)<-[f:EXTRACTION_FAILURE { stackTrace: {stackTrace} }]-(e: Extractor { name: { extractorName} })
         |WITH count(DISTINCT b) as count
         |
         |MATCH (b:Blob)<-[f:EXTRACTION_FAILURE { stackTrace: {stackTrace} }]-(e: Extractor { name: { extractorName} })
         |WITH collect(b) as blobs, count
         |UNWIND blobs as blob
         |  OPTIONAL MATCH (parent: Resource)<-[:PARENT]-(blob)
         |  OPTIONAL MATCH (blob)<-[:PARENT]-(child: Resource)
         |
         |RETURN blob, collect(parent) as parents, collect(child) as children, count
         |SKIP {skip}
         |LIMIT {pageSize}
      """.stripMargin,
      parameters(
        "extractorName", extractorName,
        "stackTrace", stackTrace,
        "skip", Long.box(skip),
        "pageSize", Long.box(pageSize)
      )
    )

    val results = summary.list().asScala.toList
    val count = results.headOption.map(_.get("count").asLong()).getOrElse(0L)

    val resources = results.map { row =>
      val blob = row.get("blob")
      val parents = row.get("parents").asList((v: Value) => v).asScala.toList
      val children = row.get("children").asList((v: Value) => v).asScala.toList

      BasicResource.fromNeo4jValues(blob, parents, children)
    }

    val result = ResourcesForExtractionFailure(count, page, pageSize, resources)
    Right(result)
  }

  override def getFilterableMimeTypes: Either[Failure, List[MimeType]] = transaction { tx =>
    val summary = tx.run(
      """
        |MATCH (m: MimeType)
        |  WHERE (m)<-[:TYPE_OF]-(:Blob)<-[:PROCESSED]-(:Extractor {indexing: true})
        |
        |RETURN m""".stripMargin)
    val results = summary.list().asScala.toList
    Right(results.map(r => MimeType.fromNeo4jValue(r.get("m"))))
  }

  override def getAllMimeTypes: Attempt[List[MimeType]] = attemptTransaction { tx =>
    val statementResult = tx.run(
      """
        |MATCH (m: MimeType)
        |
        |RETURN m""".stripMargin)
    for {
      summary <- statementResult
      results = summary.list().asScala.toList
    } yield {
      results.map(r => MimeType.fromNeo4jValue(r.get("m")))
    }
  }

  override def getMimeTypesCoverage: Either[Failure, List[MimeTypeCoverage]] = transaction { tx =>
    val counts = tx.run(
      """
        |MATCH (mimeType:MimeType)
        |WITH collect(mimeType) as types
        |UNWIND types as type
        |    MATCH (type)<-[:TYPE_OF]-(b:Blob)
        |    WITH type, count(b) as total
        |    OPTIONAL MATCH (type)<-[:TYPE_OF]-(b:Blob)<-[todo:TODO { attempts: 0 }]-(:Extractor)
        |    WITH type, total, count(todo) as todo
        |   OPTIONAL MATCH (type)<-[:TYPE_OF]-(b:Blob)<-[done:PROCESSED]-(:Extractor)
        |    WITH type, total, todo, count(done) as done
        |   OPTIONAL MATCH (type)<-[:TYPE_OF]-(:Blob)<-[failed:EXTRACTION_FAILURE]-(:Extractor)
        |    WITH type, total, todo, done, count(failed) as failed
        |RETURN type, total, todo, done, failed
      """.stripMargin
    )
    val coverageList = counts.list().asScala.toList.map { record =>
      val mimeType = MimeType.fromNeo4jValue(record.get("type"))

      MimeTypeCoverage(
        mimeType,
        total = record.get("total").asLong(),
        todo = record.get("todo").asLong(),
        done = record.get("done").asLong(),
        failed = record.get("failed").asLong(),
        humanReadableMimeType = MimeDetails.displayMap.get(mimeType.mimeType).map(_.display)
      )
    }

    Right(coverageList)

  }

  def getEmailThread(uri: String): Attempt[List[EmailNeighbours]] = attemptTransaction { tx =>
    val attemptResult = tx.run(
      """
        |  MATCH (root:Email:Resource {uri: {uri}})
        |  OPTIONAL MATCH (root)-[r]->(adjacent)
        |    WHERE type(r) in ['IN_REPLY_TO', 'REFERENCED']
        |  RETURN
        |    root as node,
        |    CASE WHEN adjacent IS NOT NULL THEN
        |      collect(DISTINCT { relation: type(r), uri: adjacent.uri})
        |    ELSE
        |      []
        |    END as neighbours
        |UNION
        |  MATCH (root:Email:Resource {uri: {uri}})
        |  OPTIONAL MATCH p=(root)-[*0..5]-(e2:Email)
        |    WHERE ALL (rs in relationships(p) WHERE type(rs) in ['IN_REPLY_TO', 'REFERENCED'])
        |  WITH DISTINCT e2, root
        |  OPTIONAL MATCH (e2)-[r]->(adjacent:Email)
        |    WHERE type(r) in ['IN_REPLY_TO', 'REFERENCED']
        |  RETURN
        |    e2 as node,
        |    CASE WHEN adjacent IS NOT NULL THEN
        |      collect(DISTINCT { relation: type(r), uri: adjacent.uri})
        |    ELSE
        |      []
        |    END as neighbours
      """.stripMargin,
      "uri" -> uri
    )

    attemptResult.flatMap { result =>
      Attempt.traverse(result.list().asScala.toList) { record =>
        val node = record.get("node")
        val neighbours = record.get("neighbours")
        EmailNeighbours.fromValues(node, neighbours)
      }
    }
  }

  override def insert(events: Seq[Manifest.Insertion], rootUri: Uri): Either[Failure, Unit] = transaction { tx =>
    def insertions() = events.toList.traverse {
        case Manifest.InsertDirectory(parentUri, uri) =>
          insertDirectory(tx, parentUri = parentUri, uri = uri)
        case Manifest.InsertBlob(file, blobUri, parentBlobs, mimeType, ingestion, languages, extractors, workspace) =>
          insertBlob(tx, file, blobUri, parentBlobs, mimeType, ingestion, languages, extractors, workspace)
        case Manifest.InsertEmail(email, parent) =>
          insertEmail(tx, email, parent)
    }

    def setEndTimeIfComplete() = {
      tx.run(
        """
          |MATCH (root: Resource {uri: {uri}})
          |SET root.endTime = {endTime}
        """.stripMargin,
        parameters(
          "uri", rootUri.value,
          "endTime", Instant.now.toEpochMilli.asInstanceOf[java.lang.Long]
        )
      )
      Right(())
    }

    for {
      _ <- insertions()
      _ <- setEndTimeIfComplete()
    } yield ()
  }

  override def rerunSuccessfulExtractorsForBlob(uri: Uri): Attempt[Unit] = attemptTransaction { tx =>
    // Re-run extractors that successfully ran before.
    // Effectively, re-label all the blob's PROCESSED relations as TODO relations.
    // We do this by copying properties onto new TODOs and then deleting the PROCESSEDs.
    //
    // If we had APOC (neo4j >= 3.5), we could do it a bit more simply:
    //
    // MATCH (n :Blob {uri: uri})-[p :PROCESSED]->(m)
    // WITH collect(p) as processedRelations
    // CALL apoc.refactor.rename.type("PROCESSED", "TODO", processedRelations)
    // YIELD committedOperations
    // RETURN committedOperations
    tx.run(
      """
        |MATCH (blob :Blob:Resource {uri: {uri}})<-[p :PROCESSED]-(e: Extractor)
        |
        |WITH blob, collect({relation: p, extractor: e}) as processedRelationsWithExtractors, count(p) as originalNumberOfProcessedRelations
        |UNWIND processedRelationsWithExtractors as processed
        |
        |  WITH processed.relation as processedRelation, processed.extractor as extractor, blob, originalNumberOfProcessedRelations
        |  // CREATE not MERGE
        |  // because if we have multiple PROCESSED between the same blob & extractor
        |  // (e.g. because it was uploaded to multiple workspaces)
        |  // we need to create a TODO for each so we preserve data from each (e.g. the workspace uploaded to).
        |  // A MERGE won't do this, because we don't have any distinguishing properties on the TODO in the path.
        |  // We SET them afterwards, because we want to copy properties from the PROCESSED
        |  // https://neo4j.com/docs/developer-manual/3.3/cypher/clauses/set/#set-copying-properties-between-nodes-and-relationships.
        |  CREATE (blob)<-[todoForRedoingPreviousSuccess :TODO]-(extractor)
        |  SET todoForRedoingPreviousSuccess = processedRelation
        |  SET todoForRedoingPreviousSuccess.attempts = 0
        |  SET todoForRedoingPreviousSuccess.priority = extractor.priority
        |  SET todoForRedoingPreviousSuccess.cost = extractor.cost
        |  DELETE processedRelation
        |
        |  RETURN originalNumberOfProcessedRelations
        |""".stripMargin,
      parameters(
        "uri", uri.value
      )
    ).flatMap(result => {
      val counters = result.summary().counters()
      val relationshipsCreated = counters.relationshipsCreated()
      val relationshipsDeleted = counters.relationshipsDeleted()
      val propertiesSet = counters.propertiesSet()
      val originalNumberOfProcessedRelations = result
        .list()
        .asScala
        .map(_.get("originalNumberOfProcessedRelations").asInt())
        .headOption
        .getOrElse(0)

      if (relationshipsCreated != originalNumberOfProcessedRelations) {
        Attempt.Left(IllegalStateFailure(
          s"When re-running successful extractors for blob ${uri.value}, ${relationshipsCreated} TODO relations were created and ${originalNumberOfProcessedRelations} PROCESSED relations deleted. These should be equal"
        ))
      } else {
        logger.info(
          s"When re-running successful extractors for blob ${uri.value}, ${relationshipsCreated} relations created, ${propertiesSet} properties set and ${relationshipsDeleted} relations deleted"
        )
        Attempt.Right(())
      }
    })
  }

  override def rerunFailedExtractorsForBlob(uri: Uri): Attempt[Unit] = attemptTransaction { tx =>
    // Re-run extractors that failed.
    // Failed extractors leave in place a TODO with attempts > 0 and an EXTRACTION_FAILURE.
    // So we delete the EXTRACTION_FAILUREs and set attempts to 0 on the TODOs.
    tx.run(
      """
        |MATCH (blob :Blob:Resource {uri: {uri}})<-[failure :EXTRACTION_FAILURE]-(failedExtractor :Extractor {external: false})
        |DELETE failure
        |
        |// we need DISTINCT because if there are multiple failures
        |// we'll get the blob and failedExtractor duplicated
        |WITH DISTINCT blob, failedExtractor
        |MATCH (blob)<-[todo :TODO]-(failedExtractor)
        |WHERE todo.attempts > 0
        |SET todo.attempts = 0
        |""".stripMargin,
      parameters(
        "uri", uri.value
      )
    ).flatMap(result => {
      val counters = result.summary().counters()
      val relationshipsCreated = counters.relationshipsCreated()
      val relationshipsDeleted = counters.relationshipsDeleted()
      val propertiesSet = counters.propertiesSet()

      if (propertiesSet != relationshipsDeleted) {
        Attempt.Left(IllegalStateFailure(
          s"When re-running failed extractors for blob ${uri.value}, ${relationshipsDeleted} EXTRACTION_FAILURE relations were deleted and ${propertiesSet} TODOs had their attempts reset to 0. These should be equal"
        ))
      } else {
        logger.info(
          s"When re-running failed extractors for blob ${uri.value}, ${relationshipsCreated} relations created, ${propertiesSet} properties set and ${relationshipsDeleted} relations deleted"
        )
        Attempt.Right(())
      }
    })
  }

  // Reset TODO attempts property for all TODO relations between the blob and an external extractor
  def resetExternalExtractorTodoAttemptsForBlob(uri: Uri, tx: AttemptWrappedTransaction): Attempt[Unit] =  {
    tx.run(
      """
        |MATCH (blob :Blob:Resource {uri: {uri}})<-[todo :TODO]-(extractor :Extractor {external: true})
        |WHERE todo.attempts > 0
        |SET todo.attempts = 0
       """.stripMargin,
      parameters(
        "uri", uri.value
    )
    ).flatMap(result => {
      val counters = result.summary().counters()
      val propertiesSet = counters.propertiesSet()
      logger.info(s"When resetting TODO attempts for blob ${uri.value}, ${propertiesSet} properties were set")
      Attempt.Right(())
    })
  }

  // Replace all PROCESSING_EXTERNALLY relations between the blob and an external extractor with a single TODO
  def replaceProcessingExternallyWithTodosForBlob(uri: Uri, tx: AttemptWrappedTransaction): Attempt[Unit] =  {
    tx.run(
      """
        |MATCH (blob :Blob:Resource {uri: {uri}})<-[processing_externally :PROCESSING_EXTERNALLY]-(extractor :Extractor {external: true})
        |MERGE (blob)<-[todo:TODO]-(extractor)
        |ON CREATE SET todo = processing_externally, todo.attempts = 0
        |DELETE processing_externally
      """.stripMargin,
      parameters(
        "uri", uri.value
      )
    ).flatMap(result => {
      val counters = result.summary().counters()
      val relationshipsCreated = counters.relationshipsCreated()
      val relationshipsDeleted = counters.relationshipsDeleted()
      if (relationshipsDeleted > 0 && relationshipsCreated != 1) {
        Attempt.Left(IllegalStateFailure(
          s"When replacing PROCESSING_EXTERNALLY with TODO for blob ${uri.value}, ${relationshipsDeleted} relations were deleted and ${relationshipsCreated} TODOs created. We expect exactly 1 TODO to be created."
        ))
      } else {
        logger.info(
          s"When replacing PROCESSING_EXTERNALLY with TODO for blob ${uri.value}, ${relationshipsCreated} relations created and ${relationshipsDeleted} relations deleted"
        )
        Attempt.Right(())
      }
    })
  }

  def deleteExternalExtractorFailuresForBlob(uri: Uri, tx: AttemptWrappedTransaction): Attempt[Unit] =  {
    tx.run(
      """
        |MATCH (blob :Blob:Resource {uri: {uri}})<-[failure :EXTRACTION_FAILURE]-(failedExtractor :Extractor {external: true})
        |DELETE failure
      """.stripMargin,
      parameters(
        "uri", uri.value
      )
    ).flatMap(result => {
      val counters = result.summary().counters()
      val relationshipsDeleted = counters.relationshipsDeleted()

      if (relationshipsDeleted > 0) {
        logger.info(s"Deleted ${relationshipsDeleted} EXTRACTION_FAILURE relations for blob ${uri.value}")
      }

      Attempt.Right(())
    })
  }

  // Re-run external extractors that failed.
  // this function can deal with multiple failure scenarios:
  //  - Giant fails to send a message to the transcription service = 1 TODO to reset, 1 EXTRACTION_FAILED to delete
  //  - the transcription service fails to transcribe the file = 1 TODO to create, 1 PROCESSING_EXTERNALLY to delete, 1 or more EXTRACTION_FAILED to delete
  override def rerunFailedExternalExtractorsForBlob(uri: Uri): Attempt[Unit] = attemptTransaction { tx =>
    for {
      // Reset TODO attempts property for all TODO relations between the blob and an external extractor
      _ <- resetExternalExtractorTodoAttemptsForBlob(uri, tx)
      // Replace all PROCESSING_EXTERNALLY relations between the blob and an external extractor with a single TODO
      _ <- replaceProcessingExternallyWithTodosForBlob(uri, tx)
      // clean up EXTRACTION_FAILURE relations
      _ <- deleteExternalExtractorFailuresForBlob(uri, tx)
    } yield ()
  }

  override def getBlob(uri: Uri): Either[Failure, Blob] = transaction { tx =>
    val summary = tx.run(
      """
        |MATCH (b :Blob:Resource {uri: {uri}})-[:TYPE_OF]->(m :MimeType)
        |RETURN b, m""".stripMargin,
      parameters(
        "uri", uri.value
      ))

    val results = summary.list().asScala.toList

    results match {
      case Nil =>
        Left(NotFoundFailure(s"Blob ${uri.value} not found"))
      case head :: tail =>
        val mimeTypes = (head :: tail).map(_.get("m"))
        Right(Blob.fromNeo4jValue(head.get("b"), mimeTypes))
    }
  }

  override def getBlobsForFiles(fileUris: List[String]): Either[Failure, Map[String, Blob]] = transaction { tx =>
    val result = tx.run(
      """
        |MATCH (b: Blob:Resource)-[:PARENT]->(f: File:Resource)
        |WHERE f.uri IN {fileUris}
        |RETURN b,f
      """.stripMargin,
      parameters(
        "fileUris", fileUris.asJava
      )
    )

    Right(result.iterator.foldLeft(Map.empty[String, Blob]) { (acc, record) =>
      val uri = record.get("f").get("uri").asString()
      val blob = Blob.fromNeo4jValue(record.get("b"), Seq.empty)

      acc + (uri -> blob)
    })
  }

  override def getWorkCounts(): Either[Failure, WorkCounts] = transaction { tx =>
    val result = tx.run(
      """
        |OPTIONAL MATCH (:Extractor)-[t:TODO]->(b:Blob)
        |WHERE (b)-[:LOCKED_BY]->(:Worker)
        |WITH count(t) as inProgress
        |
        |OPTIONAL MATCH (:Extractor)-[t:TODO]->(b:Blob)
        |WHERE t.attempts < {maxExtractionAttempts} AND NOT (b)-[:LOCKED_BY]->(:Worker) AND NOT (b)<-[:EXTRACTION_FAILURE]-(:Extractor)
        |RETURN inProgress, count(t) as outstanding
      """.stripMargin,
      parameters(
        "maxExtractionAttempts", Int.box(maxExtractionAttempts),
      )
    ).single()

    val inProgress = result.get("inProgress").asInt()
    val outstanding = result.get("outstanding").asInt()

    Right(WorkCounts(inProgress, outstanding))
  }

  // Swallows errors if blob has not been processed with OcrMyPdfExtractor
  // (simply returns an empty list)
  override def getLanguagesProcessedByOcrMyPdf(uri: Uri): Attempt[List[Language]] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (r: Resource { uri: {uri} } )<-[p:PROCESSED]-(e :Extractor {name: "OcrMyPdfExtractor"})
        |RETURN p.languages as languages
      """.stripMargin,
      parameters(
        "uri", uri.value
      )
    ).map { queryResultSummary =>
      val results = queryResultSummary.list().asScala.toList

      results.headOption.toList.flatMap(r =>
        r.get("languages")
          .asList((v: Value) => v.asString())
          .asScala
          .toList
          .flatMap(Languages.getByKey)
      )
    }
  }

  private def processDelete(uri: Uri, query: String, correctResultsCount: Int => Boolean, errorText: String): Attempt[Unit] = attemptTransaction { tx =>
    tx.run(
      query,
      parameters(
        "uri", uri.value
      )).flatMap { result: StatementResult =>

      val counters = result.summary().counters()

      if (correctResultsCount(counters.nodesDeleted())) Attempt.Right(())
      else {
        Attempt.Left(IllegalStateFailure(s"$errorText of  blob $uri. Nodes deleted: ${counters.nodesDeleted()}"))
      }
    }
  }

  // If this blob has children, the neo4j structure beneath it (down to
  // the next :Blob descendant) will be deleted. This leaves orphaned blobs
  // in neo4j, elasticsearch and S3, but it is expected that it will be called either:
  //   1. from the UI, in which case the operation is disallowed if it has children
  //   2. as part of deleting an ingestion or collection, in which case those
  //      orphaned blobs will have been returned from the initial getBlobs ES query
  //      and will therefore be deleted separately as we loop through them.
  def deleteBlob(uri: Uri): Attempt[Unit] = processDelete(
    uri,
    // OPTIONAL MATCH so if there's no Workspace node pointing to it,
    // we still delete the blob, and vice versa. (The vice versa would be
    // unexpected but maybe you're clearing up a blob that was only partially deleted before).
    """
      |OPTIONAL MATCH (w: WorkspaceNode { uri: { uri }})
      |OPTIONAL MATCH (b: Blob:Resource { uri: { uri }})-[:PARENT]->(f: File)
      |OPTIONAL MATCH (descendant :Resource)
      |  WHERE descendant.uri STARTS WITH {uri}
      |DETACH DELETE b, f, w, descendant
      """.stripMargin,
    // Always consider the deletion a success.
    // We can't set a lower bound, because if nothing has been deleted,
    // the deletion may have been triggered from a list of results coming
    // back from Elasticsearch (which is eventually consistent so doesn't
    // immediately show that the delete happened).
    // TODO MRB: handle the above more gracefully at a higher level, it's a hack down here
    // And we can't set an upper bound, because there will be an indeterminate
    // number of descendants deleted.
    count => true,
    "Error deleting blob")

  // This will delete descendants down to the next blobs,
  // at which point the URL pattern starts again.
  def deleteResourceAndDescendants(uri: Uri): Attempt[Unit] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (r: Resource)
        |WHERE r.uri STARTS WITH {uri}
        |DETACH DELETE r
      """.stripMargin,
      parameters(
        "uri", uri.value
      )
    ).flatMap { result =>
      val counters = result.summary().counters()

      if(counters.nodesDeleted() < 1) {
        Attempt.Left(IllegalStateFailure(s"Error deleting ingestion $uri. Nodes deleted: ${counters.nodesDeleted()}"))
      } else {
        Attempt.Right(())
      }
    }
  }

  override def setProgressNote(blobUri: Uri, extractor: Extractor, note: String): Either[Failure, Unit] = transaction { tx =>
    val result = tx.run(
      """
        |MATCH (b :Blob :Resource { uri: {blobUri} })<-[todo:TODO]-(:Extractor { name: {extractorName} })
        |SET todo.note = {note}
        |""".stripMargin,
      parameters(
        "blobUri", blobUri.value,
        "extractorName", extractor.name,
        "note", note
      )
    )

    val counters = result.summary().counters()

    if(counters.propertiesSet() != 1) {
      Left(IllegalStateFailure(s"Error in setProgressNote: unexpected properties set ${counters.propertiesSet()}"))
    } else {
      Right(())
    }
  }

  override def getWorkspaceChildrenWithUri(workspaceContext: Option[WorkspaceItemUploadContext], childUri: String) = attemptTransaction { tx =>
    if (workspaceContext.isDefined) {
      tx.run(
        """
          |match (workspaceNode:WorkspaceNode {id: {workspaceNodeId} })<-[:PARENT]-(child:WorkspaceNode {uri: {childUri} })
          |return child
          |""".stripMargin,
        parameters(
          "workspaceNodeId", workspaceContext.get.workspaceParentNodeId,
          "childUri", childUri
        )
      ).map { result: StatementResult =>
        val children = result.list().asScala.toList

        val childrenUris = children.map { c =>
          val node = c.get("child")
          val uri = node.get("uri").asString()
          val mimeType = node.get("mimeType").asString()
          val size = node.get("size").asLong()
          val id = node.get("id").asString()

          IngestFileResult(Blob(Uri(uri), size, Set(MimeType(mimeType))), Some(id))
        }

        childrenUris
      }
    } else {
      Attempt.Left(NotFoundFailure(s"No children with this"))
    }
  }
}
