package services.index

import com.dimafeng.testcontainers.ElasticsearchContainer
import com.dimafeng.testcontainers.scalatest.TestContainersForAll
import model.index.{Page, PageDimensions}
import model.{English, Russian, Uri}
import org.scalatest.BeforeAndAfterAll
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers
import test.integration.{ElasticSearchTestContainer, ElasticsearchTestService}
import services.index.Pages2
import test.AttemptValues

import scala.concurrent.ExecutionContext

class ElasticsearchPagesITest extends AnyFreeSpec with Matchers with BeforeAndAfterAll with TestContainersForAll with ElasticSearchTestContainer with AttemptValues {

  final implicit def executionContext: ExecutionContext = ExecutionContext.global

  override type Containers = ElasticsearchContainer

  var elasticsearchTestService: ElasticsearchTestService = _
  var pages2: Pages2 = _

  override def startContainers(): Containers = {
    val elasticContainer = getElasticSearchContainer()
    val url = s"http://${elasticContainer.container.getHttpHostAddress}"

    elasticsearchTestService = new ElasticsearchTestService(url)
    pages2 = new Pages2(elasticsearchTestService.elasticClient, "pfi-pages")

    elasticContainer
  }

  override def afterContainersStart(containers: Containers): Unit = {
    super.afterContainersStart(containers)

    elasticsearchTestService.deleteIndicesIfExists()

    elasticsearchTestService.elasticPages.setup().successValue
    List(English, Russian).foreach { lang =>
      elasticsearchTestService.elasticPages.addLanguage(lang).successValue
    }
  }

  override def afterAll(): Unit = {
    elasticsearchTestService.deleteIndicesIfExists()

    super.afterAll()
  }

  "ElasticsearchPages" - {
    "Not write duplicate pages if a file is processed twice" in {
      val uri = Uri("duplicate-page-test")
      val page = Page(page = 1, Map(English -> "some test content"), PageDimensions.A4_PORTRAIT)

      elasticsearchTestService.elasticPages.addPageContents(uri, Seq(page)).successValue

      elasticsearchTestService.elasticPages.addPageContents(uri, Seq(page)).successValue

      val textPages = elasticsearchTestService.elasticPages.getTextPages(uri, 0, PageDimensions.A4_PORTRAIT.height, highlightQuery = None).successValue
      textPages.pages should have length 1
      textPages.pages should contain only page
    }

    "Highlight stemmed search results per language" in {
      val uri = Uri("highlight-search-results")
      val inputPage = Page(page = 1, Map(
        English -> "vases vase",
        Russian -> "вазах ваз"
      ), PageDimensions.A4_PORTRAIT)

      elasticsearchTestService.elasticPages.addPageContents(uri, Seq(inputPage)).successValue

      val query = "vase OR ваз"
      val textPages = elasticsearchTestService.elasticPages.getTextPages(uri, 0, PageDimensions.A4_PORTRAIT.height, Some(query)).successValue

      textPages.pages should have length 1

      val outputPage = textPages.pages.head
      outputPage.value should contain only(
        English -> "<result-highlight>vases</result-highlight> <result-highlight>vase</result-highlight>",
        Russian -> "<result-highlight>вазах</result-highlight> <result-highlight>ваз</result-highlight>"
      )
    }

    "Highlight quoted search results per language" in {
      val uri = Uri("highlight-search-results")
      val inputPage = Page(page = 1, Map(
        English -> "vases vase",
        Russian -> "вазах ваз"
      ), PageDimensions.A4_PORTRAIT)

      elasticsearchTestService.elasticPages.addPageContents(uri, Seq(inputPage)).successValue

      val query = "\"vase\" OR \"ваз\""
      val textPages = elasticsearchTestService.elasticPages.getTextPages(uri, 0, PageDimensions.A4_PORTRAIT.height, Some(query)).successValue

      textPages.pages should have length 1

      val outputPage = textPages.pages.head
      outputPage.value should contain only(
        English -> "vases <result-highlight>vase</result-highlight>",
        Russian -> "вазах <result-highlight>ваз</result-highlight>"
      )
    }
  }

  "Pages2" - {
    "getFirstPageDimensions" - {
      "return dimensions for a document that has pages" in {
        val uri = Uri("dimensions-test")
        val dimensions = PageDimensions(612, 792, 0, 792)
        val page = Page(page = 1, Map(English -> "test content"), dimensions)

        elasticsearchTestService.elasticPages.addPageContents(uri, Seq(page)).successValue

        val result = pages2.getFirstPageDimensions(uri).successValue
        result shouldBe Some(dimensions)
      }

      "return None for a document with no pages" in {
        val uri = Uri("no-pages-dimensions-test")

        val result = pages2.getFirstPageDimensions(uri).successValue
        result shouldBe None
      }
    }

    "hasSearchMatch" - {
      val uri = Uri("has-search-match-test")
      val page = Page(page = 1, Map(English -> "brown fox jumped near hedge"), PageDimensions.A4_PORTRAIT)

      "return true when the query matches the document's pages" in {
        elasticsearchTestService.elasticPages.addPageContents(uri, Seq(page)).successValue

        pages2.hasSearchMatch(uri, "fox").successValue shouldBe true
      }

      "return false when the query does not match" in {
        elasticsearchTestService.elasticPages.addPageContents(uri, Seq(page)).successValue

        pages2.hasSearchMatch(uri, "badger").successValue shouldBe false
      }

      "respect quoted phrases" in {
        elasticsearchTestService.elasticPages.addPageContents(uri, Seq(page)).successValue

        pages2.hasSearchMatch(uri, "\"brown fox\"").successValue shouldBe true
        pages2.hasSearchMatch(uri, "\"fox brown\"").successValue shouldBe false
      }

      "not match content from other documents" in {
        val otherUri = Uri("has-search-match-other-doc")
        val otherPage = Page(page = 1, Map(English -> "badger slept here"), PageDimensions.A4_PORTRAIT)
        elasticsearchTestService.elasticPages.addPageContents(uri, Seq(page)).successValue
        elasticsearchTestService.elasticPages.addPageContents(otherUri, Seq(otherPage)).successValue

        pages2.hasSearchMatch(uri, "badger").successValue shouldBe false
        pages2.hasSearchMatch(otherUri, "badger").successValue shouldBe true
      }

      "return false for a document with no pages" in {
        pages2.hasSearchMatch(Uri("has-search-match-no-pages"), "fox").successValue shouldBe false
      }
    }
  }
}
