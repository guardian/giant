package services.index

import controllers.api.Search
import model.frontend.{Highlight, SearchResults}
import model.index.Document
import model.manifest.Collection
import model.user.{BCryptPassword, DBUser, UserPermissions}
import model.{Arabic, Email, English, Portuguese, Recipient, Russian, Uri, user}
import play.api.test.FakeRequest
import play.api.test.Helpers._
import test.integration.ElasticsearchTestService
import test.integration.Helpers.{Controllers, setupUserControllers, stubControllerComponentsAsUser}
import test.{TestAnnotations, TestUserManagement}
import utils.IndexTestHelpers
import utils.attempt.AttemptAwait._
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

class ElasticsearchResourcesITest extends AnyFreeSpec with Matchers with ElasticsearchTestService with IndexTestHelpers {

  val canSeeCatsAndDogsUser = user.DBUser("paul", Some("Paul Chuckle"), Some(BCryptPassword("invalid")), None, registered = true, None)
  val canSeeCatsUser = user.DBUser("barry", Some("Barry Chuckle"), Some(BCryptPassword("invalid")), None, registered = true, None)
  val cantSeeCollectionsUser = user.DBUser("larry", Some("Larry"), Some(BCryptPassword("invalid")), None, registered = true, None)

  val catCollection = Collection(Uri("cat"), "cat", List.empty, None)
  val dogCollection = Collection(Uri("dog"), "dog", List.empty, None)
  val goatCollection = Collection(Uri("goat"), "goat", List.empty, None)

  val users: Map[DBUser, (UserPermissions, List[Collection])] = Map(
    canSeeCatsAndDogsUser -> (UserPermissions.default, List(catCollection, dogCollection)),
    canSeeCatsUser -> (UserPermissions.default, List(catCollection)),
    cantSeeCollectionsUser -> (UserPermissions.default, List.empty)
  )

  var docs: Map[Collection, List[Uri]] = Map.empty

  override def beforeAll(): Unit = {
    super.beforeAll()

    deleteIndicesIfExists()
    elasticResources.setup().successValue

    List(English, Arabic, Russian, Portuguese).foreach { lang =>
      elasticResources.addLanguage(lang).await()
    }

    def addAndRememberTestDocument(collection: Collection, ingestion: String) = {
      addTestDocument(collection, ingestion).map { uri =>
        docs = docs + (collection -> (docs.getOrElse(collection, List.empty) :+ uri))
      }
    }

    addAndRememberTestDocument(catCollection, "ingestion_one").await()
    addAndRememberTestDocument(catCollection, "ingestion_two").await()
    addAndRememberTestDocument(dogCollection, "ingestion_one").await()
    addAndRememberTestDocument(dogCollection, "ingestion_two").await()
    addAndRememberTestDocument(goatCollection, "ingestion_one").await()
    addAndRememberTestDocument(goatCollection, "ingestion_two").await()
  }

  override def afterAll(): Unit = {
    deleteIndicesIfExists()

    super.afterAll()
  }

  "Elasticsearch Resources" - {
    "Return nothing to a user who has no access to any datasets or workspaces" in {
      TestSetup(users, cantSeeCollectionsUser, usersToWorkspaces = Map.empty) { controller =>
        val request = FakeRequest("GET", "/query?q=[\"*\"]")
        val result = contentAsJson(controller.search().apply(request))

        val hits = (result \ "hits").as[Int]
        hits should be(0)
      }
    }

    "Limit query to collections the user has permission to access" in {
      TestSetup(users, canSeeCatsAndDogsUser) { controller =>
        val request = FakeRequest("GET", "/query?q=[\"*\"]")
        val result = contentAsJson(controller.search().apply(request))

        val hits = (result \ "hits").as[Int]
        hits should be(4)
      }

      TestSetup(users, canSeeCatsUser) { controller =>
        val request = FakeRequest("GET", "/query?q=[\"*\"]")
        val result = contentAsJson(controller.search().apply(request))

        val hits = (result \ "hits").as[Int]
        hits should be(2)
      }
    }

    "Filter by single collection" in {
      TestSetup(users, canSeeCatsAndDogsUser) { controller =>
        val request = FakeRequest("GET", "/query?q=[\"*\"]&ingestion[]=cat")
        val result = contentAsJson(controller.search().apply(request))
        (result \ "hits").as[Int] should be(2)
      }
    }

    "Filter by multiple collections" in {
      TestSetup(users, canSeeCatsAndDogsUser) { controller =>
        val request = FakeRequest("GET", "/query?q=[\"*\"]&ingestion[]=cat&ingestion[]=dog")
        val result = contentAsJson(controller.search().apply(request))
        (result \ "hits").as[Int] should be(4)
      }
    }

    "Filter only by collections the user has access to" in {
      TestSetup(users, canSeeCatsAndDogsUser) { controller =>
        val request = FakeRequest("GET", "/query?q=[\"*\"]&ingestion[]=cat&ingestion[]=dog&ingestion[]=goat")

        val result = contentAsJson(controller.search().apply(request))
        (result \ "hits").as[Int] should be(4)
      }
    }

    "Return nothing if the user cannot see any of the requested collections" in {
      TestSetup(users, canSeeCatsAndDogsUser) { controller =>
        val request = FakeRequest("GET", "/query?q=[\"*\"]&ingestion[]=goat")

        val result = contentAsJson(controller.search().apply(request))
        (result \ "hits").as[Int] should be(0)
      }
    }

    "Filter by single ingestion" in {
      TestSetup(users, canSeeCatsAndDogsUser) { controller =>
        val request = FakeRequest("GET", "/query?q=[\"*\"]&ingestion[]=cat%2Fingestion_one")
        val result = contentAsJson(controller.search().apply(request))
        (result \ "hits").as[Int] should be(1)
      }
    }

    "Filter by collection and ingestion under a different collection" in {
      TestSetup(users, canSeeCatsAndDogsUser) { controller =>
        val request = FakeRequest("GET", "/query?q=[\"*\"]&ingestion[]=cat&ingestion[]=dog%2Fingestion_one")
        val result = contentAsJson(controller.search().apply(request))
        (result \ "hits").as[Int] should be(3)
      }
    }

    "Don't return results for an ingestion under a collection the user does not have permission to access" in {
      TestSetup(users, canSeeCatsAndDogsUser) { controller =>
        val request = FakeRequest("GET", "/query?q=[\"*\"]&ingestion[]=goat%2Fingestion_one")
        (contentAsJson(controller.search().apply(request)) \ "hits").as[Int] should be(0)
      }
    }

    "Return results for collections the user can see even if they request a workspace they can't see" in {
      TestSetup(users, canSeeCatsAndDogsUser, usersToWorkspaces = Map.empty) { controller =>
        val request = FakeRequest("GET", "/query?q=[\"*\"]&ingestion[]=cat&workspace[]=not-real-workspace-id")
        (contentAsJson(controller.search().apply(request)) \ "hits").as[Int] should be(2)
      }
    }

    "Filter results by workspace" in {
      TestSetup(users, canSeeCatsUser, Map(canSeeCatsUser.username -> List("test-workspace-id"))) { controller =>
        val request = FakeRequest("GET", "/query?q=[\"*\"]&workspace[]=test-workspace-id")
        (contentAsJson(controller.search().apply(request)) \ "hits").as[Int] should be(0)

        val catDoc = docs(catCollection).head

        elasticResources.addResourceToWorkspace(catDoc, "test-workspace-id", "test-node").await()
        (contentAsJson(controller.search().apply(request)) \ "hits").as[Int] should be(1)

        elasticResources.removeResourceFromWorkspace(catDoc, "test-workspace-id", "test-node").await()
        (contentAsJson(controller.search().apply(request)) \ "hits").as[Int] should be(0)
      }
    }

    "Return results for a workspace the user can see even if they request a collection they can't see" in {
      TestSetup(users, canSeeCatsUser, Map(canSeeCatsUser.username -> List("test-workspace-id"))) { controller =>
        val request = FakeRequest("GET", "/query?q=[\"*\"]&workspace[]=test-workspace-id&ingestion[]=goat")
        (contentAsJson(controller.search().apply(request)) \ "hits").as[Int] should be(0)

        val catDoc = docs(catCollection).head

        elasticResources.addResourceToWorkspace(catDoc, "test-workspace-id", "test-node").await()
        (contentAsJson(controller.search().apply(request)) \ "hits").as[Int] should be(1)

        elasticResources.removeResourceFromWorkspace(catDoc, "test-workspace-id", "test-node").await()
        (contentAsJson(controller.search().apply(request)) \ "hits").as[Int] should be(0)
      }
    }

    "Return results shared via a workspace from a dataset the user does not have access to" in {
      TestSetup(users, canSeeCatsUser, Map(canSeeCatsUser.username -> List("test-workspace-id"))) { controller =>
        // The cats user can see the document even though it's in the dog collection as it has been shared in a workspace

        val request = FakeRequest("GET", "/query?q=[\"*\"]&workspace[]=test-workspace-id")
        (contentAsJson(controller.search().apply(request)) \ "hits").as[Int] should be(0)

        val dogDoc = docs(dogCollection).head

        elasticResources.addResourceToWorkspace(dogDoc, "test-workspace-id", "test-node").await()
        (contentAsJson(controller.search().apply(request)) \ "hits").as[Int] should be(1)

        elasticResources.removeResourceFromWorkspace(dogDoc, "test-workspace-id", "test-node").await()
        (contentAsJson(controller.search().apply(request)) \ "hits").as[Int] should be(0)
      }
    }

    "Don't return results from a workspace they don't have access to" in {
      val usersToWorkspace = Map(
        canSeeCatsUser.username -> List.empty,
        canSeeCatsAndDogsUser.username -> List("private-workspace-id")
      )

      val dogDoc = docs(dogCollection).head
      elasticResources.addResourceToWorkspace(dogDoc, "private-workspace-id", "test-node").await()

      // The users have access (through the dataset) to both docs but we don't want to leak that it is present in
      // the other users workspace if for some reason they come into possession of the workspace ID
      val request = FakeRequest("GET", "/query?q=[\"*\"]&workspace[]=private-workspace-id")

      TestSetup(users, reqUser = canSeeCatsAndDogsUser, usersToWorkspace) { controller =>
        (contentAsJson(controller.search().apply(request)) \ "hits").as[Int] should be(1)
      }

      TestSetup(users, reqUser = canSeeCatsUser, usersToWorkspace) { controller =>
        (contentAsJson(controller.search().apply(request)) \ "hits").as[Int] should be(0)
      }
    }

    "Show results from all datasets and workspaces the user has access to if search is not refined further" in {
      val usersToWorkspace = Map(
        canSeeCatsAndDogsUser.username -> List("shared-from-goat-one", "shared-from-goat-two")
      )

      TestSetup(users, canSeeCatsAndDogsUser, usersToWorkspace) { controller =>
        val goatDocOne :: goatDocTwo :: Nil = docs(goatCollection)

        elasticResources.addResourceToWorkspace(goatDocOne, "shared-from-goat-one", "test-node").await()
        elasticResources.addResourceToWorkspace(goatDocTwo, "shared-from-goat-two", "test-node").await()

        // Everything in the cats and dogs collections as well as the two goat documents that have been shared
        val expectedHits = docs(catCollection).length + docs(dogCollection).length + 2

        val request = FakeRequest("GET", "/query?q=[\"*\"]")
        TestSetup(users, reqUser = canSeeCatsAndDogsUser, usersToWorkspace) { controller =>
          val resultJson = contentAsJson(controller.search().apply(request))
          (resultJson \ "hits").as[Int] should be(expectedHits)

          val results = (resultJson \ "results" \\ "uri").map(_.as[String])
          results.count(_.startsWith(catCollection.uri.value)) should be(docs(catCollection).length)
          results.count(_.startsWith(dogCollection.uri.value)) should be(docs(dogCollection).length)
          results.count(_.startsWith(goatCollection.uri.value)) should be(2)
        }
      }
    }

    "Return results if the user just has access to a workspace and no collections" in {
      val usersToWorkspace = Map(
        cantSeeCollectionsUser.username -> List("just-through-a-workspace-id")
      )

      val dogDoc = docs(dogCollection).head
      elasticResources.addResourceToWorkspace(dogDoc, "just-through-a-workspace-id", "test-node").await()

      val request = FakeRequest("GET", "/query?q=[\"*\"]&workspace[]=just-through-a-workspace-id")

      TestSetup(users, reqUser = cantSeeCollectionsUser, usersToWorkspace) { controller =>
        (contentAsJson(controller.search().apply(request)) \ "hits").as[Int] should be(1)
      }

      elasticResources.removeResourceFromWorkspace(dogDoc, "just-through-a-workspace-id", "test-node").await()

      TestSetup(users, reqUser = cantSeeCollectionsUser, usersToWorkspace) { controller =>
        (contentAsJson(controller.search().apply(request)) \ "hits").as[Int] should be(0)
      }
    }

    "Only return exact matches in quoted searches" in {
      TestSetup(users, reqUser = canSeeCatsUser) { controller =>
        addTestDocument(
          catCollection,
          ingestion = "search_results_testing",
          maybeFileName = Some("unbelievable_quality_test.txt"),
          maybeText = Map(English -> "unbelievable quality test")
        ).await()

        addTestDocument(
          catCollection,
          ingestion = "search_results_testing",
          maybeFileName = Some("quality_unbelievable_test.txt"),
          maybeText = Map(English -> "quality unbelievable test")
        ).await()

        addTestDocument(
          catCollection,
          ingestion = "search_results_testing",
          maybeFileName = Some("unbelievable_quality_testing.txt"),
          maybeText = Map(English -> "unbelievable quality testing")
        ).await()

        addTestDocument(
          catCollection,
          ingestion = "search_results_testing",
          maybeFileName = Some("test_testing.txt"),
          maybeText = Map(English -> "test testing")
        ).await()

        getSearchHighlights(controller, "test").map(_.highlight) should contain only(
          "unbelievable quality <result-highlight>test</result-highlight>",
          "quality unbelievable <result-highlight>test</result-highlight>",
          "unbelievable quality <result-highlight>testing</result-highlight>",
          "<result-highlight>test</result-highlight> <result-highlight>testing</result-highlight>",
        )

        getSearchHighlights(controller, "\\\"test\\\"").map(_.highlight) should contain only(
          "unbelievable quality <result-highlight>test</result-highlight>",
          "quality unbelievable <result-highlight>test</result-highlight>",
          "<result-highlight>test</result-highlight> testing"
        )

        getSearchHighlights(controller, "\\\"unbelievable quality\\\"").map(_.highlight) should contain only(
          "<result-highlight>unbelievable quality</result-highlight> test",
          "<result-highlight>unbelievable quality</result-highlight> testing"
        )
      }
    }

    "Highlight search results in text" in {
      val docUri = addTestDocument(catCollection, "search_results_text", maybeText = Map(
        English -> "please highlight me")
      ).await()

      val resource = elasticResources.getResource(docUri, Some("highlight")).await().asInstanceOf[Document]
      resource.text should be("please <result-highlight>highlight</result-highlight> me")
    }

    "Highlight quoted search results in text" in {
      val docUri = addTestDocument(catCollection, "search_results_text_quoted", maybeText = Map(
        English -> "test testing")
      ).await()

      val resource = elasticResources.getResource(docUri, Some("\"test\"")).await().asInstanceOf[Document]
      resource.text should be("<result-highlight>test</result-highlight> testing")
    }

    "Highlight quoted search results where the case doesn't match" in {
      val docUri = addTestDocument(catCollection, "search_results_text_quoted_case", maybeText = Map(
        English -> "test Testing")
      ).await()

      val resource = elasticResources.getResource(docUri, Some("\"testing\"")).await().asInstanceOf[Document]
      resource.text should be("test <result-highlight>Testing</result-highlight>")
    }

    "Highlight search results in OCR" in {
      val docUri = addTestDocument(catCollection, "search_results_ocr", maybeOcrText = Map(
        English -> "please highlight me"
      )).await()

      val resource = elasticResources.getResource(docUri, Some("highlight")).await().asInstanceOf[Document]
      resource.ocr should not be empty
      resource.ocr.get should be(Map(
        English.key -> "please <result-highlight>highlight</result-highlight> me"
      ))
    }

    "Highlight quoted search results in OCR" in {
      val docUri = addTestDocument(catCollection, "search_results_ocr_quoted", maybeOcrText = Map(
        English -> "test testing"
      )).await()

      val resource = elasticResources.getResource(docUri, Some("\"test\"")).await().asInstanceOf[Document]
      resource.ocr should not be empty
      resource.ocr.get should be(Map(
        English.key -> "<result-highlight>test</result-highlight> testing"
      ))
    }

    "Return single highlights if text has been analysed with two different languages" in {
      addTestDocument(catCollection, "search_results_multiple_languages", maybeText = Map(
        English -> "por favor me destaque",
        Portuguese -> "por favor me destaque")
      ).await()

      TestSetup(users, reqUser = canSeeCatsUser) { controller =>
        val highlights = getSearchHighlights(controller, "destaque").map(_.highlight)

        highlights should have length 1
        highlights should contain only "por favor me <result-highlight>destaque</result-highlight>"
      }
    }

    "Return multiple highlights for OCR against multiple languages" in {
      addTestDocument(catCollection, "search_results_multiple_languages_ocr", maybeOcrText = Map(
        English -> "this is the english part of the document",
        Russian -> "это русская часть документа")
      ).await()

      TestSetup(users, reqUser = canSeeCatsUser) { controller =>
        val highlights = getSearchHighlights(controller, "english OR русская")

        highlights should have length 2
        highlights should contain only (
          Highlight("ocr.english", "OCR Text", "this is the <result-highlight>english</result-highlight> part of the document"),
          Highlight("ocr.russian", "OCR Text", "это <result-highlight>русская</result-highlight> часть документа")
        )
      }
    }

    "Highlight stemmed and exact Russian search results" in {
      val docUri = addTestDocument(catCollection, "search_results_russian",
        maybeText = Map(Russian -> "вазах ваз"),
        maybeOcrText = Map(Russian -> "вазах ваз")
      ).await()

      TestSetup(users, reqUser = canSeeCatsUser) { controller =>
        getSearchHighlights(controller, "ваз").map(_.highlight) should contain only (
          "<result-highlight>вазах</result-highlight> <result-highlight>ваз</result-highlight>"
          )

        val resource = elasticResources.getResource(docUri, Some("ваз")).await().asInstanceOf[Document]

        resource.text should be("<result-highlight>вазах</result-highlight> <result-highlight>ваз</result-highlight>")

        resource.ocr should not be empty
        resource.ocr.get should be(Map(
          Russian.key -> "<result-highlight>вазах</result-highlight> <result-highlight>ваз</result-highlight>"
        ))
      }

      TestSetup(users, reqUser = canSeeCatsUser) { controller =>
        getSearchHighlights(controller, "\\\"ваз\\\"").map(_.highlight) should contain only (
          "вазах <result-highlight>ваз</result-highlight>"
        )

        val resource = elasticResources.getResource(docUri, Some("\"ваз\"")).await().asInstanceOf[Document]

        resource.text should be("вазах <result-highlight>ваз</result-highlight>")

        resource.ocr should not be empty
        resource.ocr.get should be(Map(
          Russian.key -> "вазах <result-highlight>ваз</result-highlight>"
        ))
      }
    }

    "Highlight stemmed and exact Arabic search results" in {
      val docUri = addTestDocument(catCollection, "search_results_arabic",
        maybeText = Map(Arabic -> "مكتبة مكتب"),
        maybeOcrText = Map(Arabic -> "مكتبة مكتب")
      ).await()

      TestSetup(users, reqUser = canSeeCatsUser) { controller =>
        getSearchHighlights(controller, "مكتب").map(_.highlight) should contain only (
          "<result-highlight>مكتبة</result-highlight> <result-highlight>مكتب</result-highlight>"
          )

        val resource = elasticResources.getResource(docUri, Some("مكتب")).await().asInstanceOf[Document]

        resource.text should be("<result-highlight>مكتبة</result-highlight> <result-highlight>مكتب</result-highlight>")

        resource.ocr should not be empty
        resource.ocr.get should be(Map(
          Arabic.key -> "<result-highlight>مكتبة</result-highlight> <result-highlight>مكتب</result-highlight>"
        ))
      }

      TestSetup(users, reqUser = canSeeCatsUser) { controller =>
        getSearchHighlights(controller, "\\\"مكتب\\\"").map(_.highlight) should contain only (
          "مكتبة <result-highlight>مكتب</result-highlight>"
        )

        val resource = elasticResources.getResource(docUri, Some("\"مكتب\"")).await().asInstanceOf[Document]

        resource.text should be("مكتبة <result-highlight>مكتب</result-highlight>")

        resource.ocr should not be empty
        resource.ocr.get should be(Map(
          Arabic.key -> "مكتبة <result-highlight>مكتب</result-highlight>"
        ))
      }
    }

    "Highlight file URI" in {
      addTestDocument(catCollection, "search_results_file_uri",
        maybeFileName = Some("what_a_file.txt")
      ).await()

      TestSetup(users, reqUser = canSeeCatsUser) { controller =>
        getSearchHighlights(controller, "what_a_file.txt") should contain only
          Highlight(
            field = s"${IndexFields.metadataField}.${IndexFields.metadata.fileUris}",
            display = "File Path",
            highlight = s"${catCollection.uri.value}/search_results_file_uri/<result-highlight>what_a_file.txt</result-highlight>"
          )

        // We don't yet highlight metadata as part of get resource (because there's no UI component to display it)
      }
    }

    "Highlight MIME type" in {
      addTestDocument(catCollection, "search_results_mime_type",
        maybeFileName = Some("mime_type.pdf"),
        maybeMimeType = Some("application/pdf"),
        maybeText = Map(English -> "This is a test file for mime type searching")
      ).await()

      TestSetup(users, reqUser = canSeeCatsUser) { controller =>
        getSearchHighlights(controller, "pdf") should contain
          Highlight(
            field = s"${IndexFields.metadataField}.${IndexFields.metadata.fileUris}",
            display = "Mime Type",
            highlight = s"application/<result-highlight>pdf<result-highlight>"
          )
      }
    }

    "Highlight extracted metadata" in {
      addTestDocument(catCollection, "search_results_extracted_metadata",
        maybeFileName = Some("test.jpg"),
        maybeExtractedMetadata = Map(
          "some_egregious_exif_key" -> Seq("find me!")
        )
      ).await()

      TestSetup(users, reqUser = canSeeCatsUser) { controller =>
        getSearchHighlights(controller, "\\\"find me\\\"") should contain
          Highlight(
            field = "some_egregious_exif_key",
            display = "some_egregious_exif_key",
            highlight = s"<result-highlight>find me</result-highlight>!"
          )
      }
    }

    "Highlight email" in {
      val email = Email(
        uri = Uri("test-email@test.pfi.gutools.co.uk"),
        from = Some(Recipient(
          email = "c.p.scott@guardian.co.uk",
          displayName = Some("Charles Prestwich Scott")
        )),
        recipients = List(
          Recipient(
            email = "j.e.taylor@guardian.co.uk",
            displayName = Some("John Edward Taylor")
          ),
          Recipient(
            email = "j.garnett@guardian.co.uk",
            displayName = Some("Jeremiah Garnett")
          )
        ),
        subject = "CP Scott's centenary essay",
        body ="""A hundred years is a long time; it is a long time even in the life of a newspaper, and to look back on it is to take in not only a vast development in the thing itself, but a great slice in the life of the nation, in the progress and adjustment of the world""",
        sentAt = None,
        sensitivity = None,
        priority = None,
        inReplyTo = List.empty,
        references = List.empty,
        html = None,
        attachmentCount = 0,
        metadata = Map.empty,
        flag = None
      )

      val ingestion = s"${catCollection.uri.value}/search_results_email"

      elasticResources.ingestEmail(
        email,
        ingestion,
        sourceMimeType = "message/rfc822",
        parentBlobs = List.empty,
        workspace = None,
        languages = List(English)
      ).await()

      TestSetup(users, reqUser = canSeeCatsUser) { controller =>
        getSearchHighlights(controller, "c.p.scott") should contain only
          Highlight(
            "metadata.from.address", "Email From", "<result-highlight>c.p.scott</result-highlight>@guardian.co.uk"
          )

        getSearchHighlights(controller, "j.garnett") should contain only
          Highlight(
            "metadata.recipients.address", "Email Recipient", "<result-highlight>j.garnett</result-highlight>@guardian.co.uk"
          )

        getSearchHighlights(controller, "Prestwich") should contain only
          Highlight(
            "metadata.from.name", "Email From", "Charles <result-highlight>Prestwich</result-highlight> Scott"
          )

        getSearchHighlights(controller, "Edward") should contain only
          Highlight(
            "metadata.recipients.name", "Email Recipient", "John <result-highlight>Edward</result-highlight> Taylor"
          )

        val searchHighlights = getSearchHighlights(controller, "newspaper").map(_.highlight)

        searchHighlights should have length 1
        searchHighlights.head should include("<result-highlight>newspaper</result-highlight>")

        getSearchHighlights(controller, "centenary essay") should contain only
          Highlight(
            "metadata.subject", "Email Subject", "CP Scott's <result-highlight>centenary</result-highlight> <result-highlight>essay</result-highlight>"
          )

        // NB: We don't yet highlight matches in the Email viewer UI itself (only in search)
      }
    }

    // TODO MRB: add test to properly cover the painless update scripts
    // TODO MRB: add some tests for duplicate removal in fileUris, email recipients, collections and ingestions etc
  }

  object TestSetup {
    def apply(initialUsers: Map[user.DBUser, (user.UserPermissions, List[Collection])], reqUser: user.DBUser, usersToWorkspaces: Map[String, List[String]] = Map.empty)(fn: Search => Unit): Unit = {

      val userManagement = TestUserManagement(initialUsers)
      val annotations = new TestAnnotations(usersToWorkspaces)

      val controllerComponents = stubControllerComponentsAsUser(reqUser.username, userManagement)
      val search = new Search(controllerComponents, userManagement, elasticResources, annotations)

      fn(search)
    }
  }
}
