package services.index

import model.annotations.{ProcessingStage, WorkspaceLeaf, WorkspaceNode}
import model.frontend.{TreeLeaf, TreeNode}
import model.frontend.user.PartialUser
import services.index.SearchContext.findBlobsInWorkspaceFolder
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.must.Matchers

class SearchContextTest extends AnyFreeSpec with Matchers {
  val barry = PartialUser("barry", "Barry")
  val folder = WorkspaceNode(barry, None, None, 0, 0, 0, 0)

  def leaf(uri: String): WorkspaceLeaf =
    WorkspaceLeaf(barry, None, None, ProcessingStage.Processed, uri, "text/test", None)

  "findBlobsInWorkspaceFolder" - {
    "find a nested blob" in {
      val tree = TreeNode(id = "top", name = "top", data = folder, children = List(
        TreeNode(id = "middle", name = "middle", data = folder, children = List(
          TreeLeaf(id = "bottom", name = "bottom", data = leaf("blob-1234"), isExpandable = false)
        ))
      ))

      findBlobsInWorkspaceFolder(tree) must contain only("blob-1234")
    }

    "accumulate nested blobs" in {
      val tree = TreeNode(id = "top", name = "top", data = folder, children = List(
        TreeLeaf(id = "middleLeaf", name = "middleLeaf", data = leaf("blob-1234"), isExpandable = false),
        TreeNode(id = "middle", name = "middle", data = folder, children = List(
          TreeLeaf(id = "bottom1", name = "bottom1", data = leaf("blob-4567"), isExpandable = false),
          TreeLeaf(id = "bottom2", name = "bottom2", data = leaf("blob-8910"), isExpandable = false)
        ))
      ))

      findBlobsInWorkspaceFolder(tree) must contain only("blob-1234", "blob-4567", "blob-8910")
    }
  }
}
