package controllers.api

import model.index.{Relevance, SearchParameters}
import org.scalatest.EitherValues
import services.index.DefaultSearchContext
import utils.auth.User
import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.must.Matchers

class SearchTest extends AnyFunSuite with Matchers with EitherValues {
  import SearchTest.checkParameters

  test("build prefix filters for given collections") {
    checkParameters(
      ingestionFilters = List("cat", "dog"),
      visibleCollections = List("cat", "dog")
    ).ingestionFilters must be(List("cat/", "dog/"))
  }

  test("restrict to visible collections") {
    checkParameters(
      ingestionFilters = List("goat"),
      visibleCollections = List("cat")
    ).ingestionFilters mustBe empty
  }

  test("generate ingestion filters") {
    checkParameters(
      ingestionFilters = List("cat/ingestion"),
      visibleCollections = List("cat")
    ).ingestionFilters must be(List("cat/ingestion"))
  }

  test("restrict to ingestions under visible collections") {
    checkParameters(
      ingestionFilters = List("goat/ingestion"),
      visibleCollections = List("cat")
    ).ingestionFilters mustBe empty
  }

  test("cannot sneak past the ingestion filter by using a common collection prefix") {
    checkParameters(
      ingestionFilters = List("collection/ingestion", "collection-2/ingestion"),
      visibleCollections = List("collection")
    ).ingestionFilters must be(List("collection/ingestion"))
  }

  test("build filter for workspaces") {
    checkParameters(
      workspaceFilters = List("test-workspace", "another-workspace"),
      visibleWorkspaces = List("test-workspace", "another-workspace")
    ).workspaceFilters must be(List("test-workspace", "another-workspace"))
  }

  test("restrict to visible workspaces") {
    checkParameters(
      workspaceFilters = List("test-workspace"),
      visibleWorkspaces = List("another-workspace")
    ).workspaceFilters mustBe empty
  }
}

object SearchTest {
  import Search.verifyParameters

  def checkParameters(ingestionFilters: List[String] = List.empty, workspaceFilters: List[String] = List.empty, visibleCollections: List[String] = List.empty, visibleWorkspaces: List[String] = List.empty): SearchParameters = {
    verifyParameters(User("test", "Test"), SearchParameters(
      q = "*",
      mimeFilters = List.empty,
      ingestionFilters,
      workspaceFilters,
      start = None,
      end = None,
      page = 1,
      pageSize = 10,
      sortBy = Relevance
    ), DefaultSearchContext(visibleCollections.toSet, visibleWorkspaces))
  }
}
