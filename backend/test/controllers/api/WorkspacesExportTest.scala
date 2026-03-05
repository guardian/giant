package controllers.api

import model.annotations._
import model.frontend._
import model.frontend.user.PartialUser
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.must.Matchers
import play.api.libs.json._

class WorkspacesExportTest extends AnyFreeSpec with Matchers {

  val testUser = PartialUser("testuser", "Test User")
  val otherUser = PartialUser("otheruser", "Other User")

  def makeLeaf(id: String, name: String, uri: String, mimeType: String = "application/pdf",
               size: Option[Long] = Some(1024L), processingStage: ProcessingStage = ProcessingStage.Processed,
               ingestionUri: Option[String] = None): TreeLeaf[WorkspaceEntry] =
    TreeLeaf(id, name, isExpandable = false, data = WorkspaceLeaf(
      addedBy = testUser, addedOn = Some(1000L), maybeParentId = Some("root"),
      processingStage = processingStage, uri = uri, mimeType = mimeType, size = size,
      ingestionUri = ingestionUri
    ))

  def makeFolder(id: String, name: String, children: List[TreeEntry[WorkspaceEntry]],
                 leafCount: Long = 0, nodeCount: Long = 0): TreeNode[WorkspaceEntry] =
    TreeNode(id, name, data = WorkspaceNode(
      addedBy = testUser, addedOn = Some(2000L), maybeParentId = if (id == "root") None else Some("root"),
      descendantsLeafCount = leafCount, descendantsNodeCount = nodeCount,
      descendantsProcessingTaskCount = 0, descendantsFailedCount = 0
    ), children = children)

  def makeWorkspace(rootNode: TreeEntry[WorkspaceEntry]): Workspace =
    Workspace(
      id = "ws-1", name = "Test Workspace", isPublic = false, tagColor = "blue",
      creator = testUser, owner = otherUser, followers = List.empty, rootNode = rootNode
    )

  val leaf1 = makeLeaf("leaf-1", "report.pdf", "file:///report.pdf", ingestionUri = Some("ingestion://batch-1"))
  val leaf2 = makeLeaf("leaf-2", "notes.txt", "file:///notes.txt", mimeType = "text/plain", size = Some(256L))
  val leaf3 = makeLeaf("leaf-3", "image.png", "file:///image.png", mimeType = "image/png",
    processingStage = ProcessingStage.Processing(3, Some("OCR in progress")),
    ingestionUri = Some("ingestion://batch-2"))
  val failedLeaf = makeLeaf("leaf-4", "broken.doc", "file:///broken.doc", mimeType = "application/msword",
    processingStage = ProcessingStage.Failed)

  val subfolder = makeFolder("folder-1", "Documents", List(leaf1, leaf3), leafCount = 2)
  val rootWithFiles = makeFolder("root", "root", List(subfolder, leaf2, failedLeaf), leafCount = 4, nodeCount = 1)

  val workspace = makeWorkspace(rootWithFiles)

  "workspaceToInventoryJson" - {
    val json = Workspaces.workspaceToInventoryJson(workspace)

    "includes workspace metadata" in {
      (json \ "workspaceId").as[String] must be("ws-1")
      (json \ "workspaceName").as[String] must be("Test Workspace")
      (json \ "isPublic").as[Boolean] must be(false)
      (json \ "owner").as[String] must be("Other User")
      (json \ "creator").as[String] must be("Test User")
      (json \ "exportedAt").asOpt[Long] must be(defined)
    }

    "includes root node as contents" in {
      (json \ "contents" \ "type").as[String] must be("folder")
      (json \ "contents" \ "name").as[String] must be("root")
    }

    "includes nested folder with correct path" in {
      val folder = (json \ "contents" \ "children")(0)
      (folder \ "type").as[String] must be("folder")
      (folder \ "name").as[String] must be("Documents")
      (folder \ "path").as[String] must be("/root/Documents")
      (folder \ "descendantsFileCount").as[Long] must be(2)
    }

    "includes file leaves with all fields" in {
      val folder = (json \ "contents" \ "children")(0)
      val file = (folder \ "children")(0)
      (file \ "type").as[String] must be("file")
      (file \ "name").as[String] must be("report.pdf")
      (file \ "path").as[String] must be("/root/Documents/report.pdf")
      (file \ "uri").as[String] must be("file:///report.pdf")
      (file \ "mimeType").as[String] must be("application/pdf")
      (file \ "size").as[Long] must be(1024L)
      (file \ "addedBy").as[String] must be("Test User")
      (file \ "addedOn").as[Long] must be(1000L)
    }

    "includes ingestionUri when present" in {
      val folder = (json \ "contents" \ "children")(0)
      val file = (folder \ "children")(0)
      (file \ "ingestionUri").as[String] must be("ingestion://batch-1")
    }

    "includes null ingestionUri when absent" in {
      val file = (json \ "contents" \ "children")(1)
      (file \ "ingestionUri").asOpt[String] must be(None)
    }

    "includes processing stage" in {
      val folder = (json \ "contents" \ "children")(0)
      val processingFile = (folder \ "children")(1)
      (processingFile \ "processingStage" \ "type").as[String] must be("processing")
      (processingFile \ "processingStage" \ "tasksRemaining").as[Int] must be(3)

      val failedFile = (json \ "contents" \ "children")(2)
      (failedFile \ "processingStage" \ "type").as[String] must be("failed")
    }
  }

  "workspaceToCsv" - {
    val csv = Workspaces.workspaceToCsv(workspace)
    val lines = csv.split("\n").toList

    "includes header row" in {
      lines.head must be("Node ID,Name,Type,Path,URI,MIME Type,Size (bytes),Added By,Added On (epoch ms),Ingestion URI,Processing Status")
    }

    "includes a row for every node" in {
      // 1 root folder + 1 subfolder + 4 leaves = 6 rows + 1 header
      lines.length must be(7)
    }

    "includes folder rows with empty file-specific fields" in {
      val rootRow = lines(1).split(",", -1).toList
      rootRow(0) must be("root")
      rootRow(2) must be("folder")
      rootRow(4) must be("") // URI
      rootRow(5) must be("") // MIME Type
      rootRow(10) must be("") // Processing Status
    }

    "includes file rows with all fields" in {
      // leaf1 is inside Documents folder — should be row 3 (after header, root, Documents)
      val reportRow = lines(3).split(",", -1).toList
      reportRow(0) must be("leaf-1")
      reportRow(1) must be("report.pdf")
      reportRow(2) must be("file")
      reportRow(3) must be("/root/Documents/report.pdf")
      reportRow(4) must be("file:///report.pdf")
      reportRow(5) must be("application/pdf")
      reportRow(6) must be("1024")
      reportRow(7) must be("Test User")
      reportRow(8) must be("1000")
      reportRow(9) must be("ingestion://batch-1")
      reportRow(10) must be("processed")
    }

    "includes ingestion URI in CSV when present" in {
      val imageRow = lines(4).split(",", -1).toList
      imageRow(9) must be("ingestion://batch-2")
    }

    "leaves ingestion URI empty when absent" in {
      val notesRow = lines(5).split(",", -1).toList
      notesRow(9) must be("")
    }

    "shows processing status correctly" in {
      val imageRow = lines(4).split(",", -1).toList
      imageRow(10) must be("processing (3 remaining)")

      val brokenRow = lines(6).split(",", -1).toList
      brokenRow(10) must be("failed")
    }

    "escapes CSV fields containing commas" in {
      val leafWithComma = makeLeaf("c-1", "report, final.pdf", "file:///report.pdf")
      val root = makeFolder("root", "root", List(leafWithComma), leafCount = 1)
      val ws = makeWorkspace(root)
      val csvOutput = Workspaces.workspaceToCsv(ws)
      csvOutput must include("\"report, final.pdf\"")
    }

    "escapes CSV fields containing double quotes" in {
      val leafWithQuote = makeLeaf("q-1", """file "draft".pdf""", "file:///draft.pdf")
      val root = makeFolder("root", "root", List(leafWithQuote), leafCount = 1)
      val ws = makeWorkspace(root)
      val csvOutput = Workspaces.workspaceToCsv(ws)
      csvOutput must include("\"file \"\"draft\"\".pdf\"")
    }
  }
}
