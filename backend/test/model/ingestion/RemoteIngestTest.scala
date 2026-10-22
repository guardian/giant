package model.ingestion

import model.frontend.user.PartialUser
import org.joda.time.DateTime
import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class RemoteIngestTest extends AnyFunSuite with Matchers {
  private val job = RemoteIngest(
    id = "job", title = "Original name", workspaceId = "workspace", parentFolderId = "original-parent",
    collection = "collection", ingestion = "ingestion", createdAt = DateTime.now,
    url = "https://example.com", addedBy = PartialUser("user", "User"),
    tasks = Map("task" -> RemoteIngestTask("task", RemoteIngestStatus.Queued, Nil, "Snapshot")),
    language = "english", destinationFolderId = Some("destination")
  )

  test("pending tasks use the destination ID after a rename or move without a name lookup or placeholder") {
    val entries = job.asSyntheticEntries((_, _) => fail("Must not look up a stored destination by name"))

    entries.map(_.id) shouldBe List("RemoteIngestTask/task")
    entries.head.data.maybeParentId shouldBe Some("destination")
  }

  test("legacy jobs attach pending tasks to an existing folder") {
    val entries = job.copy(destinationFolderId = None).asSyntheticEntries { (parent, title) =>
      parent shouldBe "original-parent"
      title shouldBe "Original name"
      Some("legacy-folder")
    }

    entries.map(_.id) shouldBe List("RemoteIngestTask/task")
    entries.head.data.maybeParentId shouldBe Some("legacy-folder")
  }

  test("legacy jobs without a real folder still display a placeholder") {
    val entries = job.copy(destinationFolderId = None).asSyntheticEntries((_, _) => None)

    entries.map(_.id) should contain("RemoteIngest/job")
    entries.head.data.maybeParentId shouldBe Some("RemoteIngest/job")
  }
}
