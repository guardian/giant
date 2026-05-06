package model.frontend

import model.Uri
import model.annotations.{ProcessingStage, WorkspaceEntry, WorkspaceLeaf, WorkspaceNode}
import model.frontend.user.PartialUser
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.must.Matchers

class TreeEntryTest extends AnyFreeSpec with Matchers {
  "findNodeById" - {
    "find folder at the top level" in {
      val test = TreeNode(id = "test", name = "test", data = "test", children = List.empty)
      TreeEntry.findNodeById(test, folderId = "test") must contain(test)
    }

    "find nested folder" in {
      val bottom = TreeNode(id = "bottom", name = "bottom", data = "bottom", children = List.empty)
      val middle = TreeNode(id = "middle", name = "middle", data = "middle", children = List(bottom))
      val top = TreeNode(id = "top", name = "top", data = "top", children = List(middle))

      TreeEntry.findNodeById(top, folderId = "middle") must contain(middle)
      TreeEntry.findNodeById(top, folderId = "bottom") must contain(bottom)
    }

    "return none if no folder found" in {
      val test = TreeNode(id = "top", name = "top", data = "top", children = List(
        TreeNode(id = "middle", name = "middle", data = "middle", children = List(
          TreeNode(id = "bottom", name = "bottom", data = "bottom", children = List.empty)
        ))
      ))

      TreeEntry.findNodeById(test, folderId = "test") must be(None)
    }

    "find leaves with the expected ID" in {
      val bottomLeaf = TreeLeaf(id = "bottom", name = "bottom", data = "bottom", isExpandable = false)
      val middleLeaf = TreeLeaf(id = "middleLeaf", name = "middleLeaf", data = "middleLeaf", isExpandable = false)

      val test = TreeNode(id = "top", name = "top", data = "top", children = List(
        TreeNode(id = "middle", name = "middle", data = "middle", children = List(
          bottomLeaf,
        )),
        middleLeaf
      ))

      TreeEntry.findNodeById(test, folderId = "bottom") must contain(bottomLeaf)
      TreeEntry.findNodeById(test, folderId = "middleLeaf") must contain(middleLeaf)
    }
  }

  val testUser: PartialUser = PartialUser("testUser", "Test User")

  def makeLeaf(id: String, uri: String, stage: ProcessingStage): TreeLeaf[WorkspaceLeaf] =
    TreeLeaf(
      id = id,
      name = id,
      data = WorkspaceLeaf(
        addedBy = testUser,
        addedOn = None,
        maybeParentId = None,
        processingStage = stage,
        uri = uri,
        mimeType = "application/pdf",
        size = Some(100L)
      ),
      isExpandable = false
    )

  def makeNode(id: String, children: List[TreeEntry[WorkspaceEntry]]): TreeNode[WorkspaceEntry] =
    TreeNode[WorkspaceEntry](
      id = id,
      name = id,
      data = WorkspaceNode(
        addedBy = testUser,
        addedOn = None,
        maybeParentId = None,
        descendantsLeafCount = 0,
        descendantsNodeCount = 0,
        descendantsProcessingTaskCount = 0,
        descendantsFailedCount = 0
      ),
      children = children
    )

  "getFailedBlobUris" - {
    "return empty list for a processed leaf" in {
      val leaf = makeLeaf("f1", "uri1", ProcessingStage.Processed)
      TreeEntry.getFailedBlobUris(leaf) must be(List.empty)
    }

    "return empty list for a processing leaf" in {
      val leaf = makeLeaf("f1", "uri1", ProcessingStage.Processing(3, None))
      TreeEntry.getFailedBlobUris(leaf) must be(List.empty)
    }

    "return the uri for a failed leaf" in {
      val leaf = makeLeaf("f1", "uri1", ProcessingStage.Failed)
      TreeEntry.getFailedBlobUris(leaf) must be(List(Uri("uri1")))
    }

    "return only failed uris from a folder tree" in {
      val tree = makeNode("root", List(
        makeLeaf("f1", "uri1", ProcessingStage.Failed),
        makeLeaf("f2", "uri2", ProcessingStage.Processed),
        makeNode("subfolder", List(
          makeLeaf("f3", "uri3", ProcessingStage.Failed),
          makeLeaf("f4", "uri4", ProcessingStage.Processing(1, None)),
        ))
      ))

      TreeEntry.getFailedBlobUris(tree) must be(List(Uri("uri1"), Uri("uri3")))
    }

    "return empty list for a folder with no failed files" in {
      val tree = makeNode("root", List(
        makeLeaf("f1", "uri1", ProcessingStage.Processed),
        makeLeaf("f2", "uri2", ProcessingStage.Processing(2, None)),
      ))

      TreeEntry.getFailedBlobUris(tree) must be(List.empty)
    }
  }
}
