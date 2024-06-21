package services.index

import com.dimafeng.testcontainers.ElasticsearchContainer
import com.dimafeng.testcontainers.scalatest.TestContainersForAll
import model.index.{Page, PageDimensions}
import model.{English, Russian, Uri}
import org.scalatest.BeforeAndAfterAll
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers
import test.AttemptValues
import test.integration.{ElasticSearchTestContainer, ElasticsearchTestService}

import scala.concurrent.ExecutionContext

class ElasticsearchPagesITest extends AnyFreeSpec with Matchers with AttemptValues with BeforeAndAfterAll with TestContainersForAll with ElasticSearchTestContainer {

  final implicit def executionContext: ExecutionContext = ExecutionContext.global

  override type Containers = ElasticsearchContainer

  var elasticsearchTestService: ElasticsearchTestService = _

  override def startContainers(): Containers = {
    val elasticContainer = getElasticSearchContainer()
    val url = s"http://${elasticContainer.container.getHttpHostAddress}"

    elasticsearchTestService = new ElasticsearchTestService(url)

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
}
