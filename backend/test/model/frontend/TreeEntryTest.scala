package model.frontend

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
}
