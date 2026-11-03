package controllers.api

import model.Uri
import model.frontend.BasicResource
import model.index.PageDimensions
import org.scalamock.scalatest.MockFactory
import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers
import play.api.libs.json.Json
import play.api.test.FakeRequest
import services.index.{Index, Pages2}
import services.manifest.Manifest
import services.users.UserManagement
import test.PlayHelpers._
import test.TestAnnotations
import test.integration.Helpers.stubControllerComponentsAsUser
import utils.attempt.Attempt

import scala.concurrent.ExecutionContext.Implicits.global

class PagesControllerTest extends AnyFunSuite with Matchers with MockFactory {
  private val uri = Uri("private-document")
  private val dimensions = PageDimensions(600, 800, 0, 800)

  private class RecordingPages extends Pages2(null, "test-pages") {
    var calls = List.empty[String]

    override def getPageCount(uri: Uri): Attempt[Long] = {
      calls = calls :+ "count"
      Attempt.Right(3L)
    }

    override def getFirstPageDimensions(uri: Uri): Attempt[Option[PageDimensions]] = {
      calls = calls :+ "dimensions"
      Attempt.Right(Some(dimensions))
    }

    override def hasSearchMatch(uri: Uri, query: String): Attempt[Boolean] = {
      calls = calls :+ "search"
      Attempt.Right(true)
    }
  }

  private def controller(hasAccess: Boolean, pages: RecordingPages): PagesController = {
    val users = mock[UserManagement]
    val manifest = mock[Manifest]
    val index = mock[Index]

    (users.getVisibleCollectionUrisForUser _).expects("reader").returning(Attempt.Right(Set.empty[String]))
    (manifest.getResource _).expects(uri).returning(Right(
      BasicResource(uri.value, None, "blob", isExpandable = false)
    ))
    (index.anyWorkspaceOrCollectionContainsAnyResource _)
      .expects(Set.empty[String], Set.empty[String], Set(uri.value))
      .returning(Attempt.Right(hasAccess))

    new PagesController(stubControllerComponentsAsUser("reader", users), manifest, index, pages, new TestAnnotations(), null)
  }

  List(None, Some("[\"secret\"]")).foreach { query =>
    test(s"page count denies inaccessible documents before querying pages, q=$query") {
      val pages = new RecordingPages
      val result = controller(hasAccess = false, pages).getPageCount(uri, query).apply(FakeRequest())

      status(result) should be(404)
      pages.calls should be(empty)
    }

    test(s"page count returns metadata and optional search matches for accessible documents, q=$query") {
      val pages = new RecordingPages
      val result = controller(hasAccess = true, pages).getPageCount(uri, query).apply(FakeRequest())

      status(result) should be(200)
      contentAsJson(result) should be(Json.obj(
        "pageCount" -> 3,
        "dimensions" -> Json.toJson(dimensions),
        "searchMatchesInPages" -> query.map(_ => true)
      ))
      pages.calls should contain theSameElementsAs (List("count", "dimensions") ++ query.toList.map(_ => "search"))
    }
  }
}
