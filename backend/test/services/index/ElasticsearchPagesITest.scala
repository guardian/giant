package services.index

import model.index.{Page, PageDimensions}
import model.{English, Russian, Uri}
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers
import test.integration.ElasticsearchTestService

class ElasticsearchPagesITest extends AnyFreeSpec with Matchers with ElasticsearchTestService {
  override def beforeAll(): Unit = {
    super.beforeAll()

    deleteIndicesIfExists()

    elasticPages.setup().successValue
    List(English, Russian).foreach { lang =>
      elasticPages.addLanguage(lang).successValue
    }
  }

  override def afterAll(): Unit = {
    deleteIndicesIfExists()

    super.afterAll()
  }

  "ElasticsearchPages" - {
    "Not write duplicate pages if a file is processed twice" in {
      val uri = Uri("duplicate-page-test")
      val page = Page(page = 1, Map(English -> "some test content"), PageDimensions.A4_PORTRAIT)

      elasticPages.addPageContents(uri, Seq(page)).successValue

      elasticPages.addPageContents(uri, Seq(page)).successValue

      val textPages = elasticPages.getTextPages(uri, 0, PageDimensions.A4_PORTRAIT.height, highlightQuery = None).successValue
      textPages.pages should have length 1
      textPages.pages should contain only page
    }

    "Highlight stemmed search results per language" in {
      val uri = Uri("highlight-search-results")
      val inputPage = Page(page = 1, Map(
        English -> "vases vase",
        Russian -> "вазах ваз"
      ), PageDimensions.A4_PORTRAIT)

      elasticPages.addPageContents(uri, Seq(inputPage)).successValue

      val query = "vase OR ваз"
      val textPages = elasticPages.getTextPages(uri, 0, PageDimensions.A4_PORTRAIT.height, Some(query)).successValue

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

      elasticPages.addPageContents(uri, Seq(inputPage)).successValue

      val query = "\"vase\" OR \"ваз\""
      val textPages = elasticPages.getTextPages(uri, 0, PageDimensions.A4_PORTRAIT.height, Some(query)).successValue

      textPages.pages should have length 1

      val outputPage = textPages.pages.head
      outputPage.value should contain only(
        English -> "vases <result-highlight>vase</result-highlight>",
        Russian -> "вазах <result-highlight>ваз</result-highlight>"
      )
    }
  }
}
