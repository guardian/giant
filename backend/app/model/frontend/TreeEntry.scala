package model.frontend

import model.Uri
import model.annotations.{WorkspaceEntry, WorkspaceLeaf}

sealed trait TreeEntry[+T] {
  def id: String
  def name: String
  def data: T
}

object TreeEntry {
  import play.api.libs.functional.syntax._
  import play.api.libs.json._
  implicit def treeEntryWrites[T](implicit fmt: Format[T]): Writes[TreeEntry[T]] = (
    (__ \ "id").write[String] and
      (__ \ "name").write[String] and
      (__ \ "data").write[T] and
      (__ \ "children").lazyWriteNullable(Writes.seq[TreeEntry[T]](treeEntryWrites)) and
      (__ \ "isExpandable").writeNullable[Boolean]
    )((treeEntry: TreeEntry[T]) => treeEntry match {
    case l: TreeLeaf[T] => (l.id, l.name, l.data, None, Some(l.isExpandable))
    case n: TreeNode[T] => (n.id, n.name, n.data, Some(n.children), None)
  })

  def nodeReads[T](implicit fmt: Format[T]): Reads[TreeEntry[T]] = ((
    (__ \ "id").read[String] and
      (__ \ "name").read[String] and
      (__ \ "data").read[T] and
      (__ \ "children").lazyRead(Reads.seq[TreeEntry[T]](treeEntryReads))
    )((id, name, data, children) => TreeNode[T](id, name, data, children.toList)))

  def leafReads[T](implicit fmt: Format[T]): Reads[TreeEntry[T]] = ((
    (__ \ "id").read[String] and
      (__ \ "name").read[String] and
      (__ \ "data").read[T] and
      (__ \ "isExpandable").read[Boolean]
    )((id, name, data, isExpandable) => TreeLeaf[T](id, name, data, isExpandable)))

  implicit def treeEntryReads[T](implicit fmt: Format[T]): Reads[TreeEntry[T]] = nodeReads orElse leafReads

  def findNodeById[T](folder: TreeEntry[T], folderId: String): Option[TreeEntry[T]] = {
    folder match {
      case node: TreeEntry[T] if node.id == folderId =>
        Some(node)

      case _: TreeLeaf[T] =>
        None

      case node: TreeNode[T] =>
        val acc: Option[TreeEntry[T]] = None

        node.children.foldLeft(acc) {
          case (Some(ret), _) => Some(ret)
          case (_, entry) => findNodeById(entry, folderId)
        }
    }
  }

  def workspaceTreeToBlobIds(tree: TreeEntry[WorkspaceEntry]): List[Uri] = tree match {
    case treeLeaf: TreeLeaf[WorkspaceEntry] => treeLeaf.data match {
      case workspaceLeaf: WorkspaceLeaf => List(Uri(workspaceLeaf.uri))
      case _ => throw new AssertionError(s"WorkspaceNode inside TreeLeaf with id ${treeLeaf.id} is crazy and should not happen")
    }
    case treeNode: TreeNode[WorkspaceEntry] => treeNode.children.flatMap(workspaceTreeToBlobIds)
  }
}

case class TreeNode[T](
  id: String,
  name: String,
  data: T,
  children: List[TreeEntry[T]],
) extends TreeEntry[T]

case class TreeLeaf[T](
  id: String,
  name: String,
  data: T,
  // isExpandable is only on the leaves, since nodes are expandable by definition (they already have children).
  // If a leaf is expandable, it means that it has children on the server but they have not yet been
  // fetched by the client.
  isExpandable: Boolean
) extends TreeEntry[T]
