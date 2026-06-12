package com.gu.pfi.cli

import java.nio.file.Paths

import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.must.Matchers
import play.api.libs.json.Json

class DownloadWorkspaceTest extends AnyFunSuite with Matchers {

  // Mirrors the shape returned by GET /api/workspaces/:id/nodes — a TreeEntry[WorkspaceEntry].
  // Folders have `children`; files (leaves) have `data.uri` and `isExpandable`.
  private def folder(id: String, name: String, children: String*) =
    s"""{"id":"$id","name":"$name","data":{},"children":[${children.mkString(",")}]}"""

  private def file(id: String, name: String, uri: String) =
    s"""{"id":"$id","name":"$name","data":{"uri":"$uri","mimeType":"text/plain","size":1},"isExpandable":false}"""

  test("flatten nests everything under the workspace name, preserving structure and original names") {
    val tree = Json.parse(folder("root", "My Workspace",
      file("a", "report.pdf", "blob-1"),
      folder("f1", "subfolder",
        file("b", "notes.txt", "blob-2")
      )
    ))

    val items = DownloadWorkspace.flatten(tree, fallbackName = "fallback")

    items must contain(WorkspaceDownloadItem("blob-1", Paths.get("My Workspace/report.pdf")))
    items must contain(WorkspaceDownloadItem("blob-2", Paths.get("My Workspace/subfolder/notes.txt")))
    items must have size 2
  }

  test("flatten falls back to the supplied name when the workspace root name is blank") {
    val tree = Json.parse(folder("root", "", file("a", "report.pdf", "blob-1")))
    DownloadWorkspace.flatten(tree, fallbackName = "workspace-abc123") must equal(
      List(WorkspaceDownloadItem("blob-1", Paths.get("workspace-abc123/report.pdf")))
    )
  }

  test("flatten skips leaves that have no backing blob") {
    val tree = Json.parse(folder("root", "ws",
      s"""{"id":"x","name":"pending capture","data":{"maybeCapturedFromURL":"http://example.com"},"isExpandable":false}""",
      file("b", "real.txt", "blob-2")
    ))

    DownloadWorkspace.flatten(tree, fallbackName = "fallback") must equal(List(WorkspaceDownloadItem("blob-2", Paths.get("ws/real.txt"))))
  }

  test("flatten sanitises path separators in names") {
    val tree = Json.parse(folder("root", "ws", file("a", "a/b.txt", "blob-1")))
    DownloadWorkspace.flatten(tree, fallbackName = "fallback").head.relativePath must equal(Paths.get("ws/a_b.txt"))
  }

  test("deduplicate disambiguates colliding paths using the blob uri, before the extension") {
    val items = List(
      WorkspaceDownloadItem("abcdef1234", Paths.get("dir/dup.txt")),
      WorkspaceDownloadItem("9876543210", Paths.get("dir/dup.txt"))
    )

    val deduped = DownloadWorkspace.deduplicate(items)

    deduped.head.relativePath must equal(Paths.get("dir/dup.txt"))
    deduped(1).relativePath must equal(Paths.get("dir/dup-98765432.txt"))
  }

  test("deduplicate leaves distinct paths untouched") {
    val items = List(
      WorkspaceDownloadItem("blob-1", Paths.get("a.txt")),
      WorkspaceDownloadItem("blob-2", Paths.get("b.txt"))
    )
    DownloadWorkspace.deduplicate(items) must equal(items)
  }
}
