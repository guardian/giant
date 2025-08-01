package model.annotations

import model._
import model.frontend._
import model.frontend.user.PartialUser
import model.user.DBUser
import org.neo4j.driver.v1.Value
import play.api.libs.json.Json.JsValueWrapper
import play.api.libs.json.{Format, JsNumber, JsObject, JsResult, JsString, JsSuccess, JsValue, Json, Reads, Writes}

sealed abstract class ProcessingStage
object ProcessingStage {
  case class Processing(tasksRemaining: Int, note: Option[String]) extends ProcessingStage
  case object Processed extends ProcessingStage
  case object Failed extends ProcessingStage

  implicit val format: Format[ProcessingStage] = Format(
    (value: JsValue) => (value \ "type").validate[String].flatMap {
      case "processing" =>
        for {
          tasksRemaining <- (value \ "tasksRemaining").validate[Int]
          note <- (value \ "note").validateOpt[String]
        } yield {
          Processing(tasksRemaining, note)
        }

      case "processed" =>
        JsSuccess(Processed)

      case "failed" =>
        JsSuccess(Failed)
    }
    ,
    {
      case Processing(tasksRemaining, note) =>
        val mandatory = Map("type" -> JsString("processing"), "tasksRemaining" -> JsNumber(tasksRemaining))
        val optional = note.map(n => "note" -> JsString(n))

        JsObject(mandatory ++ optional)

      case Processed =>
        Json.obj("type" -> "processed")

      case Failed =>
        Json.obj("type" -> "failed")
    }
  )
}

sealed trait WorkspaceEntry {
  def addedBy: PartialUser
  def addedOn: Option[Long]
  def maybeParentId: Option[String]
}

case class WorkspaceNode(
  addedBy: PartialUser,
  addedOn: Option[Long],
  maybeParentId: Option[String]
) extends WorkspaceEntry

case class WorkspaceLeaf(
  addedBy: PartialUser,
  addedOn: Option[Long],
  maybeParentId: Option[String],

  processingStage: ProcessingStage,
  uri: String,
  mimeType: String,
  // there are nodes in Playground where this is null, which breaks things
  // if I don't make it optional
  size: Option[Long],
) extends WorkspaceEntry


object WorkspaceEntry {
  implicit val format = new Format[WorkspaceEntry] {
    override def writes(entry: WorkspaceEntry): JsValue = entry match {
      case e: WorkspaceNode => nodeFormat.writes(e)
      case e: WorkspaceLeaf => leafFormat.writes(e)
    }

    override def reads(json: JsValue): JsResult[WorkspaceEntry] = (json \ "uri").toOption match {
      case Some(_) => leafFormat.reads(json)
      case _ => nodeFormat.reads(json)
    }
  }

  private val nodeFormat: Format[WorkspaceNode] = Json.format[WorkspaceNode]
  private val leafFormat: Format[WorkspaceLeaf] = Json.format[WorkspaceLeaf]

  def fromNeo4jValue(
    v: Value,
    createdBy: PartialUser,
    maybeParentId: Option[String],
    numberOfTodos: Int,
    note: Option[String],
    hasFailures: Boolean
  ): TreeEntry[WorkspaceEntry] = {
    val processingStage = if (hasFailures) {
      ProcessingStage.Failed
    } else if (numberOfTodos > 0) {
      ProcessingStage.Processing(numberOfTodos, note)
    } else {
      ProcessingStage.Processed
    }

    v.get("type").asString() match {
      case "folder" => TreeNode[WorkspaceNode](
        id = v.get("id").asString(),
        name = v.get("name").asString(),
        data = WorkspaceNode(
          addedBy = createdBy,
          addedOn = v.get("addedOn").optionally(_.asLong()),
          maybeParentId = maybeParentId,
        ),
        children = List.empty
      )
      case "file" => TreeLeaf[WorkspaceLeaf](
        id = v.get("id").asString(),
        name = v.get("name").asString(),
        // we load the entire tree up front for workspaces, so no leaves are expandable
        // (they'd only be expandable if they had children which we were not yet returning to the client)
        isExpandable = false,
        data = WorkspaceLeaf(
          addedBy = createdBy,
          addedOn = v.get("addedOn").optionally(_.asLong()),
          maybeParentId = maybeParentId,
          processingStage = processingStage,
          uri = v.get("uri").asString(),
          mimeType = v.get("mimeType").asString(),
          // there are nodes in Playground where this is null, which breaks things
          // if I don't make it optional
          size = v.get("size").optionally(_.asLong()),
        )
      )
    }
  }
}

case class WorkspaceMetadata(id: String,
                             name: String,
                             isPublic: Boolean,
                             tagColor: String,
                             owner: PartialUser,
                             followers: List[PartialUser]
)

object WorkspaceMetadata {
  implicit val write: Writes[WorkspaceMetadata] = Json.writes[WorkspaceMetadata]
  implicit val read: Reads[WorkspaceMetadata] = Json.reads[WorkspaceMetadata]

  def fromNeo4jValue(v: Value, owner: DBUser, followers: List[DBUser]): WorkspaceMetadata = {
    WorkspaceMetadata(
      v.get("id").asString(),
      v.get("name").asString(),
      v.get("isPublic").asBoolean(),
      v.get("tagColor").asString(),
      owner.toPartial,
      followers.map(_.toPartial)
    )
  }
}

case class Workspace(id: String,
                     name: String,
                     isPublic: Boolean,
                     tagColor: String,
                     owner: PartialUser,
                     followers: List[PartialUser],
                     rootNode: TreeEntry[WorkspaceEntry])

object Workspace {
  implicit val write = Json.writes[Workspace]
  implicit val read: Reads[Workspace] = Json.reads[Workspace]

  def fromMetadataAndRootNode(metadata: WorkspaceMetadata, rootNode: TreeEntry[WorkspaceEntry]) =
    Workspace(
      id = metadata.id,
      name = metadata.name,
      isPublic = metadata.isPublic,
      tagColor = metadata.tagColor,
      owner = metadata.owner,
      followers = metadata.followers,
      rootNode = rootNode
    )
}

