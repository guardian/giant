package services.annotations

import java.time.format.DateTimeFormatter
import java.time.{ZoneOffset, ZonedDateTime}
import java.util.UUID
import model.{RichValue, Uri}
import model.annotations._
import model.frontend.{TreeEntry, TreeLeaf, TreeNode}
import model.ingestion.RemoteIngest
import model.user.DBUser
import org.neo4j.driver.{Driver, Record, Value}
import org.neo4j.driver.Values.parameters
import play.api.libs.json.Json
import services.Neo4jQueryLoggingConfig
import services.annotations.Annotations.{AffectedResource, CopyDestination, DeleteItemResult, MoveItemResult}
import utils._
import utils.attempt.{Attempt, ClientFailure, Failure, IllegalStateFailure, NotFoundFailure}

import scala.jdk.CollectionConverters._
import scala.concurrent.ExecutionContext

object Neo4jAnnotations {
  def setupAnnotations(driver: Driver, executionContext: ExecutionContext, queryLoggingConfig: Neo4jQueryLoggingConfig): Either[Failure, Annotations] = {
    val neo4jAnnotations = new Neo4jAnnotations(driver, executionContext, queryLoggingConfig)
    neo4jAnnotations.setup().map(_ => neo4jAnnotations)
  }
}

class Neo4jAnnotations(driver: Driver, executionContext: ExecutionContext, queryLoggingConfig: Neo4jQueryLoggingConfig)
  extends Neo4jHelper(driver, executionContext, queryLoggingConfig) with Annotations {

  import Neo4jHelper._

  implicit val ec: ExecutionContext = executionContext

  override def setup(): Either[Failure, Unit] = {
    for {
      _ <- transaction { tx =>
        tx.run("CREATE CONSTRAINT IF NOT EXISTS FOR (dictionary :Dictionary) REQUIRE dictionary.id IS UNIQUE")
        tx.run("CREATE CONSTRAINT IF NOT EXISTS FOR (workspace :Workspace) REQUIRE workspace.id IS UNIQUE")
        tx.run("CREATE CONSTRAINT IF NOT EXISTS FOR (node :WorkspaceNode) REQUIRE node.id IS UNIQUE")
        tx.run("CREATE CONSTRAINT IF NOT EXISTS FOR (comment :Comment) REQUIRE comment.id IS UNIQUE")
        // WorkspaceNode is looked up by uri (not just id) when deleting a blob. Without this index
        // that lookup is a label scan over every WorkspaceNode on every delete, which dominates the
        // delete cost as the number of workspace items grows. (id is already unique-constrained.)
        tx.run("CREATE INDEX IF NOT EXISTS FOR (node :WorkspaceNode) ON (node.uri)")
        Right(())
      }
    } yield Right(())
  }

  override def getAllWorkspacesMetadata(currentUser: String): Attempt[List[WorkspaceMetadata]] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (workspace :Workspace)
        |WHERE (:User { username: $currentUser })-[:FOLLOWING|OWNS]->(workspace) OR workspace.isPublic
        |MATCH (creator :User)-[:CREATED]->(workspace)<-[:FOLLOWING]-(follower :User)
        |MATCH (owner :User)-[:OWNS]->(workspace)
        |WITH workspace, creator, owner, collect(distinct follower) AS followers
        |RETURN workspace, creator, owner, followers,
        |  COUNT { (workspace)<-[:PART_OF]-() } AS nodeCount
      """.stripMargin,
      parameters(
        "currentUser", currentUser
      )
    ).map { summary =>
      summary.list().asScala.toList.map { r =>
        val workspace = r.get("workspace")
        val creator = DBUser.fromNeo4jValue(r.get("creator"))
        val owner = DBUser.fromNeo4jValue(r.get("owner"))
        val followers = r.get("followers").asList[DBUser](DBUser.fromNeo4jValue(_)).asScala.toList
        val nodeCount = Some(r.get("nodeCount").asLong())

        WorkspaceMetadata.fromNeo4jValue(workspace, creator, owner, followers, nodeCount)
      }
    }
  }

  override def getWorkspaceMetadata(currentUser: String, id: String): Attempt[WorkspaceMetadata] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (workspace :Workspace {id: $id })
        |WHERE (:User { username: $currentUser })-[:FOLLOWING|OWNS]->(workspace) OR workspace.isPublic
        |MATCH (creator :User)-[:CREATED]->(workspace)<-[:FOLLOWING]-(follower :User)
        |MATCH (owner :User)-[:OWNS]->(workspace)
        |WITH workspace, creator, owner, collect(distinct follower) AS followers
        |RETURN workspace, creator, owner, followers,
        |  COUNT { (workspace)<-[:PART_OF]-() } AS nodeCount
      """.stripMargin,
      parameters(
        "currentUser", currentUser,
        "id", id
      )
    ).flatMap { summary =>
      summary.list().asScala.hasKeyOrFailure(
        "workspace",
        NotFoundFailure(s"Workspace $id does not exist")
      ).map { r =>
        val workspace = r.head.get("workspace")
        val creator = DBUser.fromNeo4jValue(r.head.get("creator"))
        val owner = DBUser.fromNeo4jValue(r.head.get("owner"))
        val followers = r.head.get("followers").asList[DBUser](DBUser.fromNeo4jValue(_)).asScala.toList
        val nodeCount = Some(r.head.get("nodeCount").asLong())

        WorkspaceMetadata.fromNeo4jValue(workspace, creator, owner, followers, nodeCount)
      }
    }
  }

  override def getWorkspaceContents(currentUser: String, id: String, remoteIngestsToMixin: List[RemoteIngest] = List.empty): Attempt[TreeEntry[WorkspaceEntry]] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (workspace: Workspace { id: $id })
        |WHERE (:User { username: $currentUser })-[:FOLLOWING|OWNS]->(workspace) OR workspace.isPublic
        |
        |OPTIONAL MATCH (workspace)<-[:PART_OF]-(node :WorkspaceNode)<-[:CREATED]-(nodeCreator :User)
        |
        |OPTIONAL MATCH (node)-[:PARENT]->(parentNode :WorkspaceNode)
        |
        |OPTIONAL MATCH (node)-[:FROM]->(remoteIngest: RemoteIngest)
        |
        |OPTIONAL MATCH (:Resource {uri: node.uri})<-[todo:TODO|PROCESSING_EXTERNALLY]-(:Extractor)
        |RETURN node, nodeCreator, parentNode.id, remoteIngest.url,
        |	count(todo) AS numberOfTodos,
        |	collect(todo)[0].note as note,
        |	EXISTS { (:Resource {uri: node.uri})<-[:EXTRACTION_FAILURE]-(:Extractor) } AS hasFailures
      """.stripMargin,
      parameters(
        "currentUser", currentUser,
        "id", id
      )
    ).map { summary =>
      val rows = summary.list().asScala

      val realEntries = rows.map { r =>
        val node = r.get("node")
        val nodeCreator = DBUser.fromNeo4jValue(r.get("nodeCreator")).toPartial
        val maybeParentNodeId = r.get("parentNode.id").optionally(_.asString())
        val maybeCapturedFromURL = r.get("remoteIngest.url").optionally(_.asString())
        val numberOfTodos = r.get("numberOfTodos").asInt()
        val note = r.get("note").optionally(_.asString())
        val hasFailures = r.get("hasFailures").asBoolean()

        WorkspaceEntry.fromNeo4jValue(node, nodeCreator, maybeParentNodeId, maybeCapturedFromURL, numberOfTodos, note, hasFailures)
      }.toList

      val synthesisedEntries = remoteIngestsToMixin.flatMap(_.asSyntheticEntries(
        (parentFolderId: String, name: String) => {
          realEntries.find { entry =>
            entry.data.maybeParentId.contains(parentFolderId) &&
              entry.name.equalsIgnoreCase(name)
          }.map(_.id)
        }
      ))

      val entries = realEntries ++ synthesisedEntries
      val childrenByParent: Map[String, List[TreeEntry[WorkspaceEntry]]] =
        entries.groupBy(_.data.maybeParentId.getOrElse("noParent"))

      def buildNode(currentEntry: TreeEntry[WorkspaceEntry]): TreeEntry[WorkspaceEntry] = {
        currentEntry match {
          case leaf: TreeLeaf[WorkspaceEntry] => leaf
          case node: TreeNode[WorkspaceEntry] => {
            val children = childrenByParent.getOrElse(node.id, List.empty).map(buildNode)
            node.copy(
              children = children,
              data = node.data match {
                // TODO this probably ought to be achieved single pass of the children list rather than multiple children.map calls (probably a reduce)
                case wNode: WorkspaceNode => wNode.copy(
                  descendantsLeafCount = children.map {
                    case TreeNode(_, _, childNode: WorkspaceNode, _) => childNode.descendantsLeafCount
                    case _: TreeLeaf[WorkspaceEntry] => 1
                    case _ => 0
                  }.sum,
                  descendantsNodeCount = children.map {
                    case TreeNode(_, _, childNode: WorkspaceNode, _) => 1 + childNode.descendantsNodeCount
                    case _: TreeLeaf[WorkspaceEntry] => 0
                    case _ => 0
                  }.sum,
                  descendantsProcessingTaskCount = children.map {
                    case TreeNode(_, _, childNode: WorkspaceNode, _) => childNode.descendantsProcessingTaskCount
                    case leaf: TreeLeaf[WorkspaceEntry] => leaf.data match {
                      case wl: WorkspaceLeaf => wl.processingStage match {
                        case ProcessingStage.Processing(tasksRemaining, _) => tasksRemaining
                        case _ => 0
                      }
                      case _ => 0
                    }
                    case _ => 0
                  }.sum,
                  descendantsProcessingLeafCount = children.map {
                    case TreeNode(_, _, childNode: WorkspaceNode, _) => childNode.descendantsProcessingTaskCount
                    case leaf: TreeLeaf[WorkspaceEntry] => leaf.data match {
                      case wl: WorkspaceLeaf => wl.processingStage match {
                        case ProcessingStage.Processing(_, _) => 1
                        case _ => 0
                      }
                      case _ => 0
                    }
                    case _ => 0
                  }.sum,
                  descendantsFailedCount = children.map {
                    case TreeNode(_, _, childNode: WorkspaceNode, _) => childNode.descendantsFailedCount
                    case leaf: TreeLeaf[WorkspaceEntry] => leaf.data match {
                      case wl: WorkspaceLeaf => wl.processingStage match {
                        case ProcessingStage.Failed => 1
                        case _ => 0
                      }
                      case _ => 0
                    }
                    case _ => 0
                  }.sum
                )
                case _ => node.data
              },
            )
          }
        }
      }

      val root = entries.find(_.data.maybeParentId.isEmpty).get
      buildNode(root)
    }
  }

  override def getBlobUrisInWorkspaceFolder(currentUser: String, workspaceId: String, folderId: String): Attempt[List[String]] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (workspace :Workspace {id: $workspaceId})
        |WHERE (:User {username: $currentUser})-[:FOLLOWING|OWNS]->(workspace) OR workspace.isPublic
        |OPTIONAL MATCH (folder :WorkspaceNode {id: $folderId})-[:PART_OF]->(workspace)
        |WITH folder
        |OPTIONAL MATCH (descendant :WorkspaceNode {type: 'file'})-[:PARENT*0..]->(folder)
        |RETURN folder.type AS folderType, collect(descendant.uri) AS blobUris
      """.stripMargin,
      parameters(
        "currentUser", currentUser,
        "workspaceId", workspaceId,
        "folderId", folderId
      )
    ).flatMap { summary =>
      val rows = summary.list().asScala.toList
      rows match {
        case Nil =>
          Attempt.Left(NotFoundFailure(s"Workspace $workspaceId does not exist"))
        case row :: _ =>
          row.get("folderType").optionally(_.asString()) match {
            case None =>
              Attempt.Left(NotFoundFailure(s"$folderId not found in workspace $workspaceId"))
            case Some("file") =>
              Attempt.Left(ClientFailure(s"$folderId is a leaf, not a node in workspace $workspaceId"))
            case Some(_) =>
              val blobUris = row.get("blobUris").asList[String](_.asString()).asScala.toList
              Attempt.Right(blobUris)
          }
      }
    }
  }

  // === Lazy-loading read primitives (issue #744) ===
  // These additive endpoints let the client fetch a workspace one level at a time. They share the
  // childrenWithStatusClause query fragment below and the buildLazyParentNode helper, which turns a
  // parent's child rows into entries via the existing WorkspaceEntry.fromNeo4jValue.

  // The OPTIONAL MATCHes + RETURN that buildLazyParentNode reads, to assemble a parent folder and its
  // direct children with inline processing status. Shared verbatim by getWorkspaceChildren and
  // getWorkspaceAncestors so their row shape can't drift — buildLazyParentNode consumes both. Expects
  // `workspace` and `parent` to be bound by the clauses prepended to it.
  private val childrenWithStatusClause: String =
    """MATCH (parent)<-[:CREATED]-(parentCreator :User)
      |OPTIONAL MATCH (parent)-[:PARENT]->(parentParent :WorkspaceNode)
      |OPTIONAL MATCH (workspace)<-[:PART_OF]-(child :WorkspaceNode)-[:PARENT]->(parent)
      |OPTIONAL MATCH (child)<-[:CREATED]-(childCreator :User)
      |OPTIONAL MATCH (child)-[:FROM]->(childRemoteIngest :RemoteIngest)
      |OPTIONAL MATCH (:Resource { uri: child.uri })<-[todo:TODO|PROCESSING_EXTERNALLY]-(:Extractor)
      |RETURN parent, parentCreator, parentParent.id AS parentParentId,
      |       child, childCreator, childRemoteIngest.url AS childCapturedFromURL,
      |       count(todo) AS numberOfTodos,
      |       collect(todo)[0].note AS note,
      |       EXISTS { (:Resource { uri: child.uri })<-[:EXTRACTION_FAILURE]-(:Extractor) } AS hasFailures""".stripMargin

  override def getWorkspaceChildren(currentUser: String, workspaceId: String, maybeNodeId: Option[String]): Attempt[TreeEntry[WorkspaceEntry]] = attemptTransaction { tx =>
    // Select the parent by id (an index seek on the WorkspaceNode.id uniqueness constraint) for a
    // known node, or as the parentless root otherwise. These are kept as separate predicates rather
    // than one `parent.id = $nodeId OR NOT (parent)-[:PARENT]->()`: that OR stops the planner using
    // the id index, so it expands every PART_OF node and filters — making even a single-folder fetch
    // O(total). Split out, the by-id case is an index seek.
    //
    // Finding the root still scans (a NOT-EXISTS predicate can't use an index), so the first-paint
    // root load is O(total). Deferred for now — the POC measured ~2s on a 101k-item workspace,
    // acceptable versus the eager path it replaces — but a rootNodeId marker on the Workspace node
    // would make this an index seek too (see #744).
    val parentSelection = maybeNodeId match {
      case Some(_) =>
        "MATCH (workspace)<-[:PART_OF]-(parent :WorkspaceNode) WHERE parent.id = $nodeId"
      case None =>
        "MATCH (workspace)<-[:PART_OF]-(parent :WorkspaceNode) WHERE NOT (parent)-[:PARENT]->(:WorkspaceNode)"
    }

    val query = List(
      """MATCH (workspace: Workspace { id: $id })
        |WHERE (:User { username: $currentUser })-[:FOLLOWING|OWNS]->(workspace) OR workspace.isPublic""".stripMargin,
      parentSelection,
      childrenWithStatusClause
    ).mkString("\n")

    tx.run(
      query,
      parameters(
        "currentUser", currentUser,
        "id", workspaceId,
        "nodeId", maybeNodeId.orNull
      )
    ).flatMap { summary =>
      summary.list().asScala.toList match {
        case Nil =>
          Attempt.Left(NotFoundFailure(s"Node ${maybeNodeId.getOrElse("<root>")} not found in workspace $workspaceId"))
        case rows =>
          Attempt.Right(buildLazyParentNode(rows))
      }
    }
  }

  override def getWorkspaceAncestors(currentUser: String, workspaceId: String, nodeId: String): Attempt[List[TreeEntry[WorkspaceEntry]]] = attemptTransaction { tx =>
    // Step 1: confirm the node is visible to this user and get the ordered ancestor ids (root first,
    // excluding the node itself). Walking up the single PARENT chain is O(depth), no fan-out.
    tx.run(
      """
        |MATCH (workspace: Workspace { id: $id })
        |WHERE (:User { username: $currentUser })-[:FOLLOWING|OWNS]->(workspace) OR workspace.isPublic
        |MATCH (target: WorkspaceNode { id: $nodeId })-[:PART_OF]->(workspace)
        |MATCH path = (target)-[:PARENT*0..]->(root: WorkspaceNode)
        |WHERE NOT (root)-[:PARENT]->(:WorkspaceNode)
        |RETURN [n IN reverse(nodes(path))[0..-1] | n.id] AS ancestorIds
      """.stripMargin,
      parameters(
        "currentUser", currentUser,
        "id", workspaceId,
        "nodeId", nodeId
      )
    ).flatMap { summary =>
      summary.list().asScala.headOption match {
        case None =>
          Attempt.Left(NotFoundFailure(s"Node $nodeId not found in workspace $workspaceId"))

        case Some(row) =>
          val ancestorIds = row.get("ancestorIds").asList[String]((v: Value) => v.asString()).asScala.toList

          if (ancestorIds.isEmpty) {
            // The node is the workspace root — it has no ancestors, and is already loaded.
            Attempt.Right(List.empty[TreeEntry[WorkspaceEntry]])
          } else {
            // Step 2: fetch the direct children (with inline status) of every ancestor in one query.
            // Access is already authorised by step 1 within this transaction, so no re-check needed.
            val childrenQuery = List(
              """MATCH (workspace: Workspace { id: $id })
                |MATCH (workspace)<-[:PART_OF]-(parent :WorkspaceNode)
                |WHERE parent.id IN $parentIds""".stripMargin,
              childrenWithStatusClause
            ).mkString("\n")
            tx.run(
              childrenQuery,
              parameters(
                "id", workspaceId,
                "parentIds", ancestorIds.toArray
              )
            ).map { childrenSummary =>
              val rowsByParentId = childrenSummary.list().asScala.toList.groupBy(_.get("parent").get("id").asString())
              // Return one populated TreeNode per ancestor, preserving the root-first order.
              ancestorIds.flatMap(id => rowsByParentId.get(id).map(buildLazyParentNode))
            }
          }
      }
    }
  }

  override def getWorkspaceAggregate(currentUser: String, workspaceId: String): Attempt[WorkspaceAggregate] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (workspace: Workspace { id: $id })
        |WHERE (:User { username: $currentUser })-[:FOLLOWING|OWNS]->(workspace) OR workspace.isPublic
        |OPTIONAL MATCH (workspace)<-[:PART_OF]-(node :WorkspaceNode)
        |WITH workspace, node,
        |     node.type AS nodeType,
        |     EXISTS { (:Resource { uri: node.uri })<-[:EXTRACTION_FAILURE]-(:Extractor) } AS hasFailures,
        |     count { (:Resource { uri: node.uri })<-[:TODO|PROCESSING_EXTERNALLY]-(:Extractor) } AS numberOfTodos
        |RETURN workspace.id AS workspaceId,
        |       count(CASE WHEN nodeType = 'file' THEN node END) AS fileCount,
        |       count(CASE WHEN nodeType = 'folder' THEN node END) AS folderCount,
        |       sum(CASE WHEN nodeType = 'file' AND hasFailures THEN 1 ELSE 0 END) AS failedCount,
        |       sum(CASE WHEN nodeType = 'file' AND NOT hasFailures THEN numberOfTodos ELSE 0 END) AS processingTaskCount
      """.stripMargin,
      parameters(
        "currentUser", currentUser,
        "id", workspaceId
      )
    ).flatMap { summary =>
      summary.list().asScala.headOption match {
        case None =>
          Attempt.Left(NotFoundFailure(s"Workspace $workspaceId does not exist"))

        case Some(row) =>
          // The query counts the root folder among the folders; the eager tree's rollup
          // (descendantsNodeCount) excludes it, so subtract it here to keep the two in parity.
          val folderCountExcludingRoot = math.max(row.get("folderCount").asLong() - 1L, 0L)
          Attempt.Right(WorkspaceAggregate(
            fileCount = row.get("fileCount").asLong(),
            folderCount = folderCountExcludingRoot,
            processingTaskCount = row.get("processingTaskCount").asLong(),
            failedCount = row.get("failedCount").asLong()
          ))
      }
    }
  }

  // Assemble a parent folder (a lazy TreeNode) and its direct children from a group of query rows
  // that share the same parent. The parent's own data comes from the first row; children come from
  // every row with a non-null child. Roll-up counts stay 0 — the client computes them where a
  // subtree is fully loaded and shows "counts pending" otherwise (issue #744).
  private def buildLazyParentNode(rows: List[Record]): TreeNode[WorkspaceEntry] = {
    val firstRow = rows.head
    val parentValue = firstRow.get("parent")
    val parentId = parentValue.get("id").asString()
    val parentCreator = DBUser.fromNeo4jValue(firstRow.get("parentCreator")).toPartial
    val maybeParentParentId = firstRow.get("parentParentId").optionally(_.asString())

    // A child with no creator is dropped, matching the eager query which couples node and creator.
    // WorkspaceEntry.fromNeo4jValue produces exactly the flat entry lazy loading needs: a child
    // folder becomes a TreeNode with empty children (a placeholder the client fetches on expand, so
    // it still behaves structurally like a folder — drop target, context menu, stable sort), and a
    // child file becomes a leaf carrying its processing status inline.
    val children: List[TreeEntry[WorkspaceEntry]] =
      rows.filter(r => !r.get("child").isNull && !r.get("childCreator").isNull).map { r =>
        WorkspaceEntry.fromNeo4jValue(
          r.get("child"),
          DBUser.fromNeo4jValue(r.get("childCreator")).toPartial,
          Some(parentId),
          r.get("childCapturedFromURL").optionally(_.asString()),
          r.get("numberOfTodos").asInt(),
          r.get("note").optionally(_.asString()),
          r.get("hasFailures").asBoolean()
        )
      }

    TreeNode[WorkspaceEntry](
      id = parentId,
      name = parentValue.get("name").asString(),
      data = WorkspaceNode(
        addedBy = parentCreator,
        addedOn = parentValue.get("addedOn").optionally(_.asLong()),
        maybeParentId = maybeParentParentId,
        maybeCapturedFromURL = None,
        descendantsLeafCount = 0,
        descendantsNodeCount = 0,
        descendantsProcessingTaskCount = 0,
        descendantsFailedCount = 0
      ),
      children = children
    )
  }

  override def insertWorkspace(username: String, id: String, name: String, isPublic: Boolean, tagColor: String): Attempt[Unit] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (u: User {username: $username})
        |CREATE (w: Workspace {id: $id, name: $name, isPublic: $isPublic, tagColor: $tagColor})
        |CREATE (w)<-[:CREATED]-(u)
        |CREATE (w)<-[:FOLLOWING]-(u)
        |CREATE (w)<-[:OWNS]-(u)
        |
        |CREATE (u)-[:CREATED]->(f: WorkspaceNode {id: $rootFolderId, name: $name, type: 'folder'})-[:PART_OF]->(w)
        |
      """.stripMargin,
      parameters(
        "username", username,
        "id", id,
        "rootFolderId", UUID.randomUUID().toString,
        "name", name,
        "isPublic", Boolean.box(isPublic),
        "tagColor", tagColor
      )
    ).flatMap {
      case r if r.consume().counters().nodesCreated() == 0 =>
        Attempt.Left(IllegalStateFailure("Did not create new workspace"))
      case _ =>
        Attempt.Right(())
    }
  }

  override def updateWorkspaceFollowers(currentUser: String, id: String, followers: List[String]): Attempt[Unit] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (workspace :Workspace {id: $workspaceId})<-[:OWNS]-(owner :User {username: $username})
        |
        |OPTIONAL MATCH (existingFollower :User)-[existingFollow :FOLLOWING]->(workspace)
        |  WHERE existingFollower.username <> owner.username
        |
        |OPTIONAL MATCH (newFollower :User)
        |  WHERE newFollower.username IN $followers
        |
        |DELETE existingFollow
        |
        |// Use unwind to correctly handle an empty array of followers
        |WITH workspace, collect(newFollower) as newFollowers
        |UNWIND newFollowers as newFollower
        |  MERGE (newFollower)-[:FOLLOWING]->(workspace)
      """.stripMargin,
      parameters(
        "workspaceId", id,
        "username", currentUser,
        "followers", followers.toArray
      )
    ).map(_.consume()).flatMap {
      case r if r.counters().relationshipsCreated() != followers.length =>
        Attempt.Left(IllegalStateFailure(s"Error when updating workspace followers, unexpected relationships created ${r.counters().relationshipsCreated()}"))
      case _ =>
        Attempt.Right(())
    }
  }

  override def updateWorkspaceIsPublic(currentUser: String, id: String, isPublic: Boolean): Attempt[Unit] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (workspace :Workspace {id: $workspaceId})<-[:OWNS]-(owner :User {username: $username})
        |
        |SET workspace.isPublic = $isPublic
        |
      """.stripMargin,
      parameters(
        "workspaceId", id,
        "username", currentUser,
        "isPublic", Boolean.box(isPublic)
      )
    ).map(_.consume()).flatMap {
      case r if r.counters().propertiesSet() != 1 =>
        Attempt.Left(IllegalStateFailure(s"Error when updating workspace isPublic, unexpected properties set ${r.counters().propertiesSet()}"))
      case _ =>
        Attempt.Right(())
    }
  }

  override def updateWorkspaceName(currentUser: String, id: String, name: String): Attempt[Unit] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (rootNode :WorkspaceNode)-[:PART_OF]->(workspace :Workspace {id: $workspaceId})<-[:OWNS]-(owner :User {username: $username})
        |   WHERE NOT EXISTS { (rootNode)-[:PARENT]->(:WorkspaceNode) }
        |
        |SET workspace.name = $name
        |SET rootNode.name = $name
      """.stripMargin,
      parameters(
        "workspaceId", id,
        "name", name,
        "username", currentUser
      )
    ).map(_.consume()).flatMap {
      case r if r.counters().propertiesSet() != 2 =>
        Attempt.Left(IllegalStateFailure(s"Error when updating workspace name, unexpected properties set ${r.counters().propertiesSet()}"))
      case _ =>
        Attempt.Right(())
    }
  }

  override def updateWorkspaceOwner(currentUser: String, id: String, owner: String): Attempt[Unit] = attemptTransaction { tx =>
    val query = """
                  MATCH (user: User { username: $username})
                  |MATCH (newOwner: User { username: $owner})
                  |MATCH (workspace: Workspace {id:$workspaceId} )<-[ownsRelationship:OWNS]-(currentOwner:User)
                  |WHERE (:Permission {name: "CanPerformAdminOperations"})<-[:HAS_PERMISSION]-(user)
                  |CREATE (workspace)<-[:FOLLOWING]-(newOwner)
                  |CREATE (workspace)<-[:OWNS]-(newOwner)
                  |DELETE ownsRelationship
      """.stripMargin
    tx.run(
      query,
      parameters(
        "workspaceId", id,
        "owner", owner,
        "username", currentUser
      )
    ).map(_.consume()).flatMap {
      case r if r.counters().relationshipsCreated() != 2 =>
        Attempt.Left(IllegalStateFailure(s"Error when updating workspace owner, unexpected properties set ${r.counters().propertiesSet()}"))
      case _ =>
        Attempt.Right(())
    }
  }

  override def deleteWorkspace(currentUser: String, workspace: String): Attempt[Unit] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (user: User { username: $username })
        |MATCH (workspace: Workspace {id: $workspaceId})<-[:OWNS]-(u:User)
        |WHERE u.username = $username OR (workspace.isPublic and (:Permission {name: "CanPerformAdminOperations"})<-[:HAS_PERMISSION]-(user))
        |MATCH (workspace)<-[:PART_OF]-(node: WorkspaceNode)
        |
        |DETACH DELETE node
        |DETACH DELETE workspace
      """.stripMargin,
      parameters(
        "workspaceId", workspace,
        "username", currentUser
      )
    ).map(_.consume()).flatMap {
      case r if r.counters().nodesDeleted() < 1 =>
        Attempt.Left(IllegalStateFailure("Failed to delete workspace"))
      case _ =>
        Attempt.Right(())
    }
  }

  private def addFolder(tx: AttemptWrappedTransaction, currentUser: String, workspaceId: String, parentFolderId: String, folderName: String): Attempt[String] = {
    tx.run(
      """
        |MATCH (p :WorkspaceNode {id: $parentFolderId})-[:PART_OF]->(w: Workspace {id: $workspaceId})
        |MATCH (currentUser :User {username: $currentUser})
        |  WHERE (currentUser)-[:FOLLOWING]->(w) OR w.isPublic
        |
        |CREATE (f :WorkspaceNode {id: $folderId, name: $folderName, type: 'folder', addedOn: $addedOn})
        |CREATE (f)-[:PARENT]->(p)
        |CREATE (f)-[:PART_OF]->(w)
        |CREATE (f)<-[:CREATED]-(currentUser)
        |
        |RETURN f
      """.stripMargin,
      parameters(
        "workspaceId", workspaceId,
        "parentFolderId", parentFolderId,
        "currentUser", currentUser,
        "folderId", UUID.randomUUID.toString,
        "folderName", folderName,
        "addedOn", Long.box(System.currentTimeMillis())
      )
    ).map(_.list().asScala.headOption).flatMap {
      case None =>
        // This is the expected failure case on lack of permissions.
        // But we return a 404 to not leak information to the client
        Attempt.Left(NotFoundFailure("Could not find node to create folder at"))
      case Some(r) =>
        Attempt.Right(r.get("f").get("id").asString())
    }
    }

  override def addFolder(currentUser: String, workspaceId: String, parentFolderId: String, folderName: String): Attempt[String] = attemptTransaction {  tx =>
    addFolder(tx, currentUser, workspaceId, parentFolderId, folderName)
  }

  // Checks for a folder with the given name under the given parent folder, returning its ID if found.
  // If there are multiple folders with the same name, return the first
  private def getFolder(tx: AttemptWrappedTransaction, workspaceId: String, parentFolderId: String, folderName: String): Attempt[String] = {
    tx.run(
      """
      | MATCH  (parentFolder :WorkspaceNode {id: $parentFolderId})-[:PART_OF]->(w: Workspace {id: $workspaceId})
      | MATCH  (folder :WorkspaceNode {name: $folderName, type: 'folder'})-[:PARENT]->(parentFolder)
      | RETURN folder
      """.stripMargin,
      parameters(
        "workspaceId", workspaceId,
        "parentFolderId", parentFolderId,
        "folderName", folderName
      )
    ).flatMap { case r =>
      val records = r.list().asScala
      if (records.isEmpty) {
        Attempt.Left(NotFoundFailure("Could not find folder"))
      } else {
        Attempt.Right(records.head.get("folder").get("id").asString())
      }
    }
  }

  override def addOrGetFolder(currentUser: String, workspaceId: String, parentFolderId: String, folderName: String): Attempt[String] = attemptTransaction {  tx =>
    getFolder(tx, workspaceId, parentFolderId, folderName).recoverWith {
      case _: NotFoundFailure =>
        addFolder(tx, currentUser, workspaceId, parentFolderId, folderName)
    }
  }

  override def addResourceToWorkspaceFolder(currentUser: String, fileName: String, uri: Uri, size: Option[Long], mimeType: Option[String], icon: String, workspaceId: String, folderId: String, nodeId: String): Attempt[String] = attemptTransaction { tx =>
    val sizePart = if (size.isDefined) ", size: $size" else ""
    val mimeTypePart = if(mimeType.isDefined) ", mimeType: $mimeType" else ""

    val params = List(
      "parentFolderId", folderId,
      "workspaceId", workspaceId,
      "currentUser", currentUser,
      "fileId", nodeId,
      "fileName", fileName,
      "icon", icon,
      "blobUri", uri.value,
      "addedOn", Long.box(System.currentTimeMillis())
    ) ++ size.map(v => List("size", Long.box(v))).getOrElse(Nil) ++ mimeType.map(v => List("mimeType", v)).getOrElse(Nil)

    tx.run(
      s"""
         |MATCH (parentNode: WorkspaceNode {id: $$parentFolderId})
         |  WHERE parentNode.type = 'folder'
         |
         |MATCH (parentNode)-[:PART_OF]->(workspace: Workspace {id: $$workspaceId})<-[:FOLLOWING]-(user: User)
         |  WHERE user.username = $$currentUser OR workspace.isPublic
         |WITH DISTINCT parentNode, workspace
         |
         |MATCH (currentUser:User {username: $$currentUser})
         |
         |CREATE (file: WorkspaceNode {id: $$fileId, name: $$fileName, type: 'file', icon: $$icon, uri: $$blobUri, addedOn: $$addedOn$sizePart$mimeTypePart})
         |
         |CREATE (file)<-[:CREATED]-(currentUser)
         |CREATE (file)-[:PARENT]->(parentNode)
         |CREATE (file)-[:PART_OF]->(workspace)
         |
         |RETURN file
      """.stripMargin,
      parameters(
        params:_*
      )
    ).map(_.list().asScala.headOption).flatMap {
      case None =>
        Attempt.Left(IllegalStateFailure("Did not create new workspace resource"))
      case Some(r) =>
        Attempt.Right(r.get("file").get("id").asString())
    }
  }

  override def renameWorkspaceItem(currentUser: String, workspaceId: String, itemId: String, name: String): Attempt[Unit] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (item: WorkspaceNode {id: $itemId})-[:PART_OF]->(workspace: Workspace {id: $workspaceId})<-[:FOLLOWING]-(user: User)
        |  WHERE user.username = $currentUser OR workspace.isPublic
        |
        |SET item.name = $name
      """.stripMargin,
      parameters(
        "currentUser", currentUser,
        "workspaceId", workspaceId,
        "itemId", itemId,
        "name", name
      )
    ).map(_.consume()).flatMap {
      case r if r.counters().propertiesSet() == 0 =>
        Attempt.Left(IllegalStateFailure("Failed to change item name"))
      case _ =>
        Attempt.Right(())
    }
  }

  private def getWorkspaceRootNodeId(currentUser: String, workspaceId: String): Attempt[String] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (rootNode :WorkspaceNode)-[:PART_OF]->(workspace :Workspace {id: $workspaceId})
        |  WHERE ((:User { username: $currentUser })-[:FOLLOWING]->(workspace) OR workspace.isPublic)
        |    AND NOT EXISTS { (rootNode)-[:PARENT]->(:WorkspaceNode) }
        |RETURN rootNode
        |""".stripMargin,
      parameters(
        "workspaceId", workspaceId,
        "currentUser", currentUser
      )
    ).flatMap { summary =>
      summary.list().asScala.hasKeyOrFailure(
        "rootNode",
        NotFoundFailure(s"Root node for workspace $workspaceId not found")
      ).map { r =>
        val rootNode = r.head.get("rootNode")
        rootNode.get("id").asString
      }
    }
  }

  def getCopyDestination(user: String, workspaceId: String, newWorkspaceId: Option[String], newParentId: Option[String]): Attempt[CopyDestination] = {
    (newWorkspaceId, newParentId) match {
      case (None, None) => Attempt.Left(ClientFailure("Must supply at least one of newWorkspaceId or newParentId"))
      case (Some(newWorkspaceId), None) =>
        getWorkspaceRootNodeId(user, newWorkspaceId).map(id => CopyDestination(newWorkspaceId, id))
      case (None, Some(newParentId)) => Attempt.Right(CopyDestination(workspaceId, newParentId))
      case (Some(newWorkspaceId), Some(newParentId)) => Attempt.Right(CopyDestination(newWorkspaceId, newParentId))
    }
  }

  private def moveToRootOfNewWorkspace(currentUser: String, workspaceId: String, itemId: String, newWorkspaceId: String): Attempt[MoveItemResult] = {
    for {
      rootNodeId <- getWorkspaceRootNodeId(currentUser, newWorkspaceId)
      moveItemResult <- move(currentUser, workspaceId, itemId, newWorkspaceId, newParentId = rootNodeId)
    } yield moveItemResult
  }

  private def move(currentUser: String, workspaceId: String, itemId: String, newWorkspaceId: String, newParentId: String): Attempt[MoveItemResult] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (:WorkspaceNode)<-[oldParentLink:PARENT]-(item: WorkspaceNode {id: $itemId})-[:PART_OF]->(oldWorkspace: Workspace {id: $workspaceId})
        |  WHERE (:User { username: $currentUser })-[:FOLLOWING]->(oldWorkspace) OR oldWorkspace.isPublic
        |
        |MATCH (newParent :WorkspaceNode {id: $newParentId})-[:PART_OF]->(newWorkspace :Workspace {id: $newWorkspaceId})
        |  WHERE (:User { username: $currentUser })-[:FOLLOWING]->(newWorkspace) OR newWorkspace.isPublic
        |
        |WITH oldParentLink, oldWorkspace, newParent, newWorkspace, item, EXISTS { (newParent)-[:PARENT*0..]->(item) } as isNewParentDescendantOfItem
        |  WHERE isNewParentDescendantOfItem = false
        |
        |  // The zero-length lower bound on the path matches the item itself as well
        |  // https://neo4j.com/docs/developer-manual/3.3/cypher/clauses/match/#zero-length-paths
        |  MATCH (itemAndItsDescendants :WorkspaceNode)-[:PARENT*0..]->(item)
        |
        |  // we only want to delete and re-create PART_OF links if we're moving between workspaces
        |  OPTIONAL MATCH (:Workspace)<-[oldPartOfLinks:PART_OF]-(itemAndItsDescendants)
        |    WHERE oldWorkspace <> newWorkspace
        |
        |  DELETE oldPartOfLinks
        |  DELETE oldParentLink
        |  MERGE (itemAndItsDescendants)-[:PART_OF]->(newWorkspace)
        |  MERGE (item)-[:PARENT]->(newParent)
        |  RETURN itemAndItsDescendants
      """.stripMargin,
      parameters(
        "currentUser", currentUser,
        "workspaceId", workspaceId,
        "itemId", itemId,
        "newWorkspaceId", newWorkspaceId,
        "newParentId", newParentId
      )
    ).flatMap { statementResult =>
      val records = statementResult.list().asScala.toList
      val entriesMoved = records.map(_.get("itemAndItsDescendants"))
      val resourcesMoved = entriesMoved.flatMap(AffectedResource.fromNeo4jValue)
      val counters = statementResult.consume().counters()
      val relationshipsCreated = counters.relationshipsCreated()
      val relationshipsDeleted = counters.relationshipsDeleted()

      if (entriesMoved.isEmpty) {
        // checking r.single().get("isNewParentDescendantOfItem").asBoolean() would be helpful for reporting the
        // cause of the error, but because of the WITH/WHERE we get an empty result set if it's true
        Attempt.Left(NotFoundFailure("Could not find node to move or destination node"))
      } else if (relationshipsCreated != relationshipsDeleted) {
        Attempt.Left(
          IllegalStateFailure(s"Failed to move item. $relationshipsCreated relationships created and $relationshipsDeleted deleted, so change was rolled back.")
        )
      } else {
        entriesMoved.foreach(entryMoved => {
          logger.info(s"Moved workspace item ${entryMoved.get("name")} with id ${entryMoved.get("id")} from workspace $workspaceId to workspace $newWorkspaceId under new parent $newParentId. $relationshipsCreated relationships created and $relationshipsDeleted deleted")
        })
        Attempt.Right(MoveItemResult(resourcesMoved))
      }
    }
  }

  def moveWorkspaceItem(currentUser: String, workspaceId: String, itemId: String, newWorkspaceId: Option[String], newParentId: Option[String]): Attempt[MoveItemResult] = {
    (newWorkspaceId, newParentId) match {
      case (None, None) => Attempt.Left(ClientFailure("Must supply at least one of newWorkspaceId or newParentId"))
      case (Some(newWorkspaceId), None) => moveToRootOfNewWorkspace(currentUser, workspaceId, itemId, newWorkspaceId)
      case (None, Some(newParentId)) => move(currentUser, workspaceId, itemId, workspaceId, newParentId)
      case (Some(newWorkspaceId), Some(newParentId)) => move(currentUser, workspaceId, itemId, newWorkspaceId, newParentId)
    }
  }

  def deleteWorkspaceItem(currentUser: String, workspaceId: String, itemId: String): Attempt[DeleteItemResult] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (item: WorkspaceNode {id: $itemId})-[:PART_OF]->(workspace:Workspace {id: $workspaceId})<-[:FOLLOWING]-(user: User)
        | WHERE user.username = $currentUser OR workspace.isPublic
        |
        |OPTIONAL MATCH (child: WorkspaceNode)-[:PARENT*]->(item)
        |WITH child, item, { id: item.id, uri: item.uri } as removedItem, { id: child.id, uri: child.uri } as removedChild
        |
        |DETACH DELETE child, item
        |RETURN removedItem, removedChild
        |""".stripMargin,
      parameters(
        "currentUser", currentUser,
        "workspaceId", workspaceId,
        "itemId", itemId
      )
    ).flatMap { result =>

      val entries = result.list().asScala.toList

      result match {
        case r if r.consume().counters().nodesDeleted() < 1 =>
          Attempt.Left(IllegalStateFailure("Failed to delete item"))

        case _ =>
          val removedItems = entries.head.get("removedItem") +: entries.map(_.get("removedChild"))
          val removedResources = removedItems.flatMap(AffectedResource.fromNeo4jValue)

          Attempt.Right(DeleteItemResult(removedResources))
      }
    }
  }

  override def postComment(currentUser: String, uri: Uri, text: String, anchor: Option[CommentAnchor]): Attempt[Unit] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (u :User {username: $currentUser})
        |MATCH (r :Resource {uri: $uri})
        |CREATE (c: Comment {id: $id, postedAt: $postedAt, text: $text, anchor: $anchor})-[:POSTED_ON]->(r)
        |CREATE (c)-[:POSTED_BY]->(u)
      """.stripMargin,
      parameters(
        "currentUser", currentUser,
        "id", UUID.randomUUID().toString,
        "postedAt", Long.box(System.currentTimeMillis()),
        "text", text,
        "uri", uri.value,
        "anchor", anchor.map { a => Json.stringify(Json.toJson(a)) }.orNull
      )
    ).map(_.consume()).flatMap {
      case r if r.counters().nodesCreated() == 0 =>
        Attempt.Left(IllegalStateFailure("Failed to insert new comment"))
      case _ =>
        Attempt.Right(())
    }
  }

  override def getComments(uri: Uri): Attempt[List[Comment]] = attemptTransaction { tx =>
    tx.run(
      """
        MATCH (:Resource {uri: $uri})<-[:POSTED_ON]-(c:Comment)-[:POSTED_BY]->(u: User)
        RETURN c, u
      """.stripMargin,
      parameters(
        "uri",uri.value
      )
    ).map { summary =>
      val records = summary.list().asScala.toList
      records.map { r =>
        val userValue = r.get("u")
        val pUser = DBUser.fromNeo4jValue(userValue).toPartial

        val commentValue = r.get("c")

        Comment.fromNeo4jValue(commentValue, pUser)
      }
    }
  }

  override def deleteComment(currentUser: String, commentId: String): Attempt[Unit] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (c: Comment {id: $commentId})-[:POSTED_BY]->(u: User {username: $currentUser})
        |DETACH DELETE (c)
        |RETURN u
      """.stripMargin,
      parameters(
        "currentUser", currentUser,
        "commentId", commentId
      )
    ).flatMap { summary =>
      val dbUser = summary.list().asScala.headOption.map(v => DBUser.fromNeo4jValue(v.get("u")))
      (dbUser, summary) match {
        case (None, _) =>
          Attempt.Left(NotFoundFailure("Not found"))
        case (Some(_), r) if r.consume().counters().nodesDeleted() != 1 =>
          Attempt.Left(IllegalStateFailure("Failed to delete comment"))
        case _ =>
          Attempt.Right(())
      }
    }
  }

  override def getBlobOwners(blobUri: String): Attempt[Set[String]] = attemptTransaction { tx =>
    tx.run(
      """
        | MATCH (b:Blob:Resource {uri: $blob})-[r:PARENT*]->(c:Collection)
        | RETURN DISTINCT c.createdBy AS owner
        """.stripMargin,
      parameters(
        "blob", blobUri
      )
    ).map { result =>
      result.list.asScala.map(_.get("owner").asString()).toSet
    }
  }

}
