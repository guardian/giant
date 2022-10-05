package services.index

import com.sksamuel.elastic4s.ElasticClient
import com.sksamuel.elastic4s.ElasticDsl._
import com.sksamuel.elastic4s.requests.common.FetchSourceContext
import com.sksamuel.elastic4s.requests.searches.{DateHistogramInterval, HighlightField}
import com.sksamuel.elastic4s.requests.update.UpdateByQueryRequest
import extraction.EnrichedMetadata
import model.frontend._
import model.frontend.email.EmailMetadata
import model.index._
import model.ingestion.WorkspaceItemContext
import model.{Email, ExtractedDateTime, Language, Recipient, Uri, Languages, Arabic}
import services.ElasticsearchSyntax
import services.ElasticsearchSyntax.NestedField
import services.index.HitReaders._
import utils._
import utils.attempt._

import scala.collection.JavaConverters._
import scala.concurrent.ExecutionContext

class ElasticsearchResources(override val client: ElasticClient, indexName: String)(implicit executionContext: ExecutionContext) extends Index with Logging with ElasticsearchSyntax {
  override def setup(): Attempt[Index] = {
    createIndexIfNotAlreadyExists(indexName,
      properties(
        textField(IndexFields.`type`),
        emptyMultiLanguageField(IndexFields.text),
        emptyMultiLanguageField(IndexFields.ocr),
        textKeywordField(IndexFields.flags),
        dateField(IndexFields.createdAt),
        dateField(IndexFields.lastModifiedAt),
        booleanField(IndexFields.extracted),
        booleanField(IndexFields.ocrExtracted),
        textKeywordField(IndexFields.collection),
        textKeywordField(IndexFields.ingestion),
        keywordField(IndexFields.parentBlobs),
        nestedField(IndexFields.workspacesField).fields(
          keywordField(IndexFields.workspaces.workspaceId),
          keywordField(IndexFields.workspaces.workspaceNodeId),
          keywordField(IndexFields.workspaces.uri)
        ),
        objectField(IndexFields.metadataField).fields(
          // Normal Documents
          emptyMultiLanguageField(IndexFields.metadata.fileUris),
          textKeywordField(IndexFields.metadata.mimeTypes),
          longField(IndexFields.metadata.fileSize),
          nestedField(IndexFields.metadata.extractedMetadataField).fields(
            textKeywordField(NestedField.key).termVector("with_positions_offsets"),
            textField(NestedField.values).termVector("with_positions_offsets")
          ),
          objectField(IndexFields.metadata.enrichedMetadataField).fields(
            textKeywordField(IndexFields.metadata.enrichedMetadata.title),
            textKeywordField(IndexFields.metadata.enrichedMetadata.author),
            longField(IndexFields.metadata.enrichedMetadata.createdAt),
            longField(IndexFields.metadata.enrichedMetadata.lastModified),
            textKeywordField(IndexFields.metadata.enrichedMetadata.createdWith),
            intField(IndexFields.metadata.enrichedMetadata.pageCount),
            intField(IndexFields.metadata.enrichedMetadata.wordCount)
          ),

          // Emails Only
          objectField(IndexFields.metadata.fromField).fields(
            emptyMultiLanguageField(IndexFields.metadata.from.name),
            textField(IndexFields.metadata.from.address).termVector("with_positions_offsets")
          ),
          objectField(IndexFields.metadata.recipientsField).fields(
            emptyMultiLanguageField(IndexFields.metadata.recipients.name),
            textField(IndexFields.metadata.recipients.address).termVector("with_positions_offsets")
          ),
          textField(IndexFields.metadata.sentAt),
          textField(IndexFields.metadata.sensitivity).termVector("with_positions_offsets"),
          textField(IndexFields.metadata.priority).termVector("with_positions_offsets"),
          emptyMultiLanguageField(IndexFields.metadata.subject),
          textKeywordField(IndexFields.metadata.references),
          textKeywordField(IndexFields.metadata.inReplyTo),
          emptyMultiLanguageField(IndexFields.metadata.html),
          intField(IndexFields.metadata.attachmentCount)
        )
      )
    ).flatMap { _ =>
      Attempt.sequence(Languages.all.map(addLanguage))
    }.map { _ =>
      this
    }
  }

  def addLanguage(language: Language): Attempt[Unit] = {
    executeNoReturn {
      putMapping(indexName).as(
        multiLanguageField(IndexFields.text, language),
        multiLanguageField(IndexFields.ocr, language),
        objectField(IndexFields.metadataField).fields(
          multiLanguageField(IndexFields.metadata.fileUris, language),
          objectField(IndexFields.metadata.fromField).fields(
            multiLanguageField(IndexFields.metadata.from.name, language)
          ),
          objectField(IndexFields.metadata.recipientsField).fields(
            multiLanguageField(IndexFields.metadata.recipients.name, language)
          ),
          multiLanguageField(IndexFields.metadata.subject, language),
          multiLanguageField(IndexFields.metadata.html, language)
        )
      )
    }
  }

  override def ingestDocument(uri: Uri, fileSize: Long, ingestionData: IngestionData, languages: List[Language]): Attempt[Unit] = {
    val fileUris = ingestionData.uris.map(_.value)
    val mimeTypes = ingestionData.mimeTypes.map(_.mimeType)
    val parentBlobs = ingestionData.parentBlobs.map(_.value)

    logger.info(s"Indexing ${uri.value} with types: ${mimeTypes.mkString(", ")} and file URIs: '${fileUris.mkString(", ")}")

    val collection = ingestionData.ingestion.split("/").headOption.getOrElse("unknown")

    // We're playing a weird game with several functions which take 'Object'.
    // From the scala Set, via the elasticsearch transport client and finally to a elasticsearch "painless" collection
    val javaFileUris = fileUris.toList.asJava
    val javaMimeTypes = mimeTypes.toList.asJava
    val javaParentBlobs = parentBlobs.toList.asJava

    val defaultFields = Map(
      IndexFields.flags -> Flags.unseen,
      IndexFields.`type` -> "blob",
      IndexFields.extracted -> false,
      IndexFields.ocrExtracted -> false,
      IndexFields.collection -> Set(collection),
      IndexFields.ingestion -> Set(ingestionData.ingestion),
      IndexFields.parentBlobs -> parentBlobs,
      IndexFields.metadataField -> Map(
        IndexFields.metadata.mimeTypes -> mimeTypes,
        IndexFields.metadata.fileUris -> fileUris.map(multiLanguageValue(languages, _)),
        IndexFields.metadata.fileSize -> Long.box(fileSize)
      )
    ) ++ getWorkspaceFields(ingestionData.workspace)

    val createdAtField = ingestionData.createdAt.map(IndexFields.createdAt -> _)
    val lastModifiedAtField = ingestionData.lastModifiedAt.map(IndexFields.lastModifiedAt -> _)

    val upsertFields = defaultFields ++ createdAtField ++ lastModifiedAtField

    executeUpdate {
      updateById(indexName, uri.value)
        .script {
          script(
            s"""
               |params.mimeTypes.removeIf(mime -> ctx._source.metadata.${IndexFields.metadata.mimeTypes}.contains(mime));
               |ctx._source.metadata.${IndexFields.metadata.mimeTypes}.addAll(params.mimeTypes);
               |
               |params.fileUris
               |  .removeIf(fileUri ->
               |    ctx._source.metadata.${IndexFields.metadata.fileUris}
               |      .stream()
               |      .anyMatch(v -> v.values().contains(fileUri))
               |    );
               |
               |for(uri in params.fileUris) {
               |  def fileUri = [:];
               |
               |  for(language in params.languages) {
               |    fileUri[language] = uri;
               |  }
               |
               |  ctx._source.metadata.${IndexFields.metadata.fileUris}.add(fileUri);
               |}
               |
               |if(!ctx._source.${IndexFields.collection}.contains(params.collection)) {
               |  ctx._source.${IndexFields.collection}.add(params.collection);
               |}
               |
               |if(!ctx._source.${IndexFields.ingestion}.contains(params.ingestion)) {
               |  ctx._source.${IndexFields.ingestion}.add(params.ingestion);
               |}
               |
               |if(ctx._source.${IndexFields.parentBlobs} == null) {
               |  ctx._source.${IndexFields.parentBlobs} = [];
               |}
               |
               |params.parentBlobs.removeIf(uri -> ctx._source.${IndexFields.parentBlobs}.contains(uri));
               |ctx._source.${IndexFields.parentBlobs}.addAll(params.parentBlobs);
               |
               |if(params.workspaceBlobUri != null && params.workspaceId != null && params.workspaceNodeId != null) {
               |  if(ctx._source.${IndexFields.workspacesField} == null) {
               |    ctx._source.${IndexFields.workspacesField} = [[
               |      "${IndexFields.workspaces.uri}": params.workspaceBlobUri,
               |      "${IndexFields.workspaces.workspaceId}": params.workspaceId,
               |      "${IndexFields.workspaces.workspaceNodeId}": params.workspaceNodeId
               |    ]];
               |  } else {
               |    ctx._source.${IndexFields.workspacesField}.add([
               |      "${IndexFields.workspaces.uri}": params.workspaceBlobUri,
               |      "${IndexFields.workspaces.workspaceId}": params.workspaceId,
               |      "${IndexFields.workspaces.workspaceNodeId}": params.workspaceNodeId
               |    ]);
               |  }
               |}
          """.
              stripMargin.replaceAll("\\\r?\\\n", "").trim()).params(Map(
            "mimeTypes" -> javaMimeTypes,
            "fileUris" -> javaFileUris,
            "collection" -> collection,
            "ingestion" -> ingestionData.ingestion,
            "parentBlobs" -> javaParentBlobs,
            "workspaceBlobUri" -> ingestionData.workspace.map(_.blobAddedToWorkspace).orNull,
            "workspaceId" -> ingestionData.workspace.map(_.workspaceId).orNull,
            "workspaceNodeId" -> ingestionData.workspace.map(_.workspaceNodeId).orNull,
            "languages" -> languages.map(_.key)
          )
          ).lang("painless")
        }.upsert(upsertFields)
    }
  }

  override def addDocumentDetails(uri: Uri, text: Option[String], metadata: Map[String, Seq[String]], enrichedMetadata: EnrichedMetadata, languages: List[Language]): Attempt[Unit] = {
    logger.info(s"Adding text to ${uri.value} in index")

    val metadataList = metadata.map { case(key, values) =>
      Map(
        NestedField.key -> key,
        NestedField.values -> values
      )
    }

    val textField: Map[String, Any] = text.map { textContent =>
      Map(IndexFields.text -> multiLanguageValue(languages, textContent))
    }.getOrElse(Map.empty)

    val fieldMap: Map[String, Any] = Map(
      IndexFields.extracted -> true,
      IndexFields.metadataField -> Map(
        IndexFields.metadata.extractedMetadataField -> metadataList,
        IndexFields.metadata.enrichedMetadataField -> enrichedMetadata.toMap
      )
    ) ++ textField ++ enrichedMetadata.createdAt.map(IndexFields.createdAt -> _) ++ enrichedMetadata.lastModified.map(IndexFields.lastModifiedAt -> _)

    executeUpdate {
      updateById(indexName, uri.value).doc(
        fieldMap
      )
    }
  }

  override def addDocumentOcr(uri: Uri, ocr: Option[String], language: Language): Attempt[Unit] = {
    logger.info(s"Adding OCR to ${uri.value} in index")

    val fieldMap = Map(
      IndexFields.ocrExtracted -> true
    )  ++ ocr.map(ocrText =>
      IndexFields.ocr -> Map(
        language.key -> ocrText
      )
    )

    executeUpdate {
      updateById(indexName, uri.value).doc(
        fieldMap
      )
    }
  }

  override def ingestEmail(email: Email, ingestion: String, sourceMimeType: String, parentBlobs: List[Uri], workspace: Option[WorkspaceItemContext], languages: List[Language]): Attempt[Unit] = {
    val collection = ingestion.split("/").headOption.getOrElse("unknown")
    val recipients = email.recipients.map { r => recipientToMap(languages, Some(r)) }

    val parentBlobUris = parentBlobs.map(_.value)

    val metadataList = email.metadata.map { case(key, values) =>
      Map(
        NestedField.key -> key,
        NestedField.values -> values
      )
    }

    val defaultFields = Map(
      IndexFields.`type` -> "email",
      IndexFields.text -> multiLanguageValue(languages, email.body),
      IndexFields.flags -> Flags.unseen,
      IndexFields.collection -> Set(collection),
      IndexFields.ingestion -> Set(ingestion),
      IndexFields.parentBlobs -> parentBlobUris,
      IndexFields.metadataField -> Map(
        IndexFields.metadata.mimeTypes -> List(sourceMimeType),
        IndexFields.metadata.fromField -> recipientToMap(languages, email.from),
        IndexFields.metadata.recipientsField -> recipients,
        IndexFields.metadata.sentAt -> email.sentAt.orNull,
        IndexFields.metadata.sensitivity -> email.sensitivity.map(_.toString).orNull,
        IndexFields.metadata.priority -> email.priority.map(_.toString).orNull,
        IndexFields.metadata.subject -> multiLanguageValue(languages, email.subject),
        IndexFields.metadata.references -> email.references,
        IndexFields.metadata.inReplyTo -> email.inReplyTo,
        IndexFields.metadata.html -> email.html.map(multiLanguageValue(languages, _)).orNull,
        IndexFields.metadata.attachmentCount -> email.attachmentCount,
        IndexFields.metadata.extractedMetadataField -> metadataList
      )
    ) ++ getWorkspaceFields(workspace)

    val createdAtField: Option[(String, Long)] = email.sentAtMillis().map(IndexFields.createdAt -> _)

    val upsertFields = defaultFields ++ createdAtField

    executeUpdate {
      updateById(indexName, email.uri.value)
        .script {
          script(
            s"""
               |params.recipients
               |  .removeIf(recipient ->
               |    ctx._source.metadata.${IndexFields.metadata.recipientsField}
               |      .stream()
               |      .map(r -> r.address)
               |      .anyMatch(a -> a.equals(recipient.address))
               |    );
               |
               |ctx._source.metadata.${IndexFields.metadata.recipientsField}.addAll(params.recipients);
               |ctx._source.${IndexFields.collection}.add(params.collection);
               |ctx._source.${IndexFields.ingestion}.add(params.ingestion);
               |
               |params.parentBlobs.removeIf(uri -> ctx._source.${IndexFields.parentBlobs}.contains(uri));
               |ctx._source.${IndexFields.parentBlobs}.addAll(params.parentBlobs);
               |
               |if(params.workspaceBlobUri != null && params.workspaceId != null && params.workspaceNodeId != null) {
               |  if(ctx._source.${IndexFields.workspacesField} == null) {
               |    ctx._source.${IndexFields.workspacesField} = [[
               |      "${IndexFields.workspaces.uri}": params.workspaceBlobUri,
               |      "${IndexFields.workspaces.workspaceId}": params.workspaceId,
               |      "${IndexFields.workspaces.workspaceNodeId}": params.workspaceNodeId
               |    ]];
               |  } else {
               |    ctx._source.${IndexFields.workspacesField}.add([
               |      "${IndexFields.workspaces.uri}": params.workspaceBlobUri,
               |      "${IndexFields.workspaces.workspaceId}": params.workspaceId,
               |      "${IndexFields.workspaces.workspaceNodeId}": params.workspaceNodeId
               |    ]);
               |  }
               |}
           """.stripMargin.replaceAll("\\\r?\\\n", "").trim())
            .params(
              Map(
                "recipients" -> recipients.asJava,
                "collection" -> collection,
                "ingestion" -> ingestion,
                "parentBlobs" -> parentBlobUris.asJava,
                "workspaceBlobUri" -> workspace.map(_.blobAddedToWorkspace).orNull,
                "workspaceId" -> workspace.map(_.workspaceId).orNull,
                "workspaceNodeId" -> workspace.map(_.workspaceNodeId).orNull
              )
            ).lang("painless")
        }.upsert(upsertFields)
    }
  }

  override def query(parameters: SearchParameters, context: SearchContext): Attempt[SearchResults] = {
    val topLevelSearchQuery = buildQueryStringQuery(parameters.q)

    val req =
      search(indexName)
        .query(
          must(should(
            topLevelSearchQuery,
            buildMetadataQuery(parameters)
          )).filter(SearchContext.buildFilters(parameters, context))
        )
        .fetchContext(FetchSourceContext(fetchSource = true, excludes = Set(IndexFields.text, s"${IndexFields.ocr}.*")))
        .from(parameters.from)
        .size(parameters.size)
        .highlighting(HighlightFields.searchHighlights(topLevelSearchQuery))
        .aggs(
          termsAgg(IndexAggNames.collection, IndexFields.collectionRaw),
          termsAgg(IndexAggNames.ingestion, IndexFields.ingestionRaw),
          dateHistogramAgg(IndexAggNames.createdAt, IndexFields.createdAt).calendarInterval(DateHistogramInterval.Month),
          termsAgg(IndexAggNames.mimeTypes, "metadata." + IndexFields.metadata.mimeTypesRaw).size(MimeDetails.displayMap.size * 2),
          termsAgg(IndexAggNames.flags, IndexFields.flagsRaw).size(Flags.all.size),
          nestedAggregation(IndexAggNames.workspace, IndexFields.workspacesField).subaggs(
            termsAgg(IndexAggNames.workspace, s"${IndexFields.workspacesField}.${IndexFields.workspaces.workspaceId}")
          )
        )

    execute {
      parameters.sortBy match {
        case Relevance => req
        case SizeAsc => req.sortBy(fieldSort(IndexFields.metadataField + "." + IndexFields.metadata.fileSize).asc())
        case SizeDesc => req.sortBy(fieldSort(IndexFields.metadataField + "." + IndexFields.metadata.fileSize).desc())
        case CreatedAtAsc => req.sortBy(fieldSort(IndexFields.createdAt).asc())
        case CreatedAtDesc => req.sortBy(fieldSort(IndexFields.createdAt).desc())
      }
    }.map { resp =>
      val hits = resp.totalHits
      val took = resp.took
      val results = resp.to[SearchResult].toList

      SearchResults(hits, took, parameters.page, parameters.pageSize, results,
        Set(
          Aggregations.collections(resp),
          Aggregations.months(resp),
          Aggregations.mimeTypes(resp)
          // Disabled as sometimes the counts showed more results than the hits you got back once you ticked the filter
          // TODO MRB: re-enable once we determine why we sometimes have duplicate entries in the `workspace` field
          //Aggregations.workspaces(resp)
        )
      )
    }
  }

  override def getResource(uri: Uri, highlightTextQuery: Option[String]): Attempt[IndexedResource] = {
    highlightTextQuery match {
      case Some(query) => // Doing a highlighted search, we need to highlight the document text
        val topLevelQuery = buildQueryStringQuery(query)

        execute {
          search(indexName).query(
            should(topLevelQuery).filter(
              termQuery("_id", uri.value)
            )).highlighting(
              HighlightFields.textHighlighters(topLevelQuery)
                // Ensure we get the whole document, not just the highlights
                .map(_.numberOfFragments(0))
            )
        }.flatMap { response =>
          response.to[IndexedResource].headOption match {
            case Some(resource) =>
              Attempt.Right(resource)

            case None =>
              Attempt.Left(NotFoundFailure(s"Resource not found in index: ${uri.value}"))
          }
        }

      case None => // Not doing a highlighted fetch
        execute {
          get(indexName, uri.value)
        }.flatMap { resp =>
          resp.toOpt[IndexedResource] match {
            case Some(resource) =>
              Attempt.Right(resource)

            case None =>
              Attempt.Left(NotFoundFailure(s"Resource not found in index: ${uri.value}"))
          }
        }
    }

  }

  def getBlobs(collection: String, maybeIngestion: Option[String], size: Option[Int]): Attempt[Iterable[IndexedBlob]] = {
    val query = maybeIngestion match {
      case Some(ingestion) => matchQuery(IndexFields.ingestionRaw, s"$collection/$ingestion")
      case _ => matchQuery(IndexFields.collectionRaw, collection)
    }

    val searchRequest = search(indexName)
      .sourceInclude(IndexFields.ingestion)
      .bool(
        must(query)
      )

    execute(size.fold(searchRequest)(searchRequest.size(_))).map { response =>
      response.to[IndexedBlob]
    }
  }

  def delete(id: String): Attempt[Unit] = {
    executeNoReturn {
      deleteById(indexName, id)
    }
  }

  override def getPageCount(uri: Uri): Attempt[Option[Long]] = {
    execute {
      get(indexName, uri.value)
        .fetchSourceInclude(s"${IndexFields.metadataField}.${IndexFields.metadata.enrichedMetadataField}")
    }.flatMap { resp =>
      if(resp.exists) {
        val maybeMetadata = resp.source.optField[FieldMap](IndexFields.metadataField)
          .flatMap(_.optField[FieldMap](IndexFields.metadata.enrichedMetadataField))

        val pageCount = maybeMetadata.flatMap(_.optLongField("pageCount"))
        Attempt.Right(pageCount)
      } else {
        Attempt.Left(NotFoundFailure(s"Resource not found in index: ${uri.value}"))
      }
    }
  }

  override def getEmailMetadata(ids: List[String]): Attempt[Map[String, EmailMetadata]] = {
    def anyRefToScalaMap(ar: AnyRef): Map[String, AnyRef] = {
      ar.asInstanceOf[Map[String, AnyRef]].filterNot(_._2 == null)
    }

    execute {
      search("pfi")
        .query(
          constantScoreQuery(
            termsQuery("_id", ids)
          )
        )
        .sourceInclude(
          "metadata.sentAt",
          "metadata.subject",
          "metadata.from"
        )
        .size(ids.length)
    }.map { response =>
      response.hits.hits.flatMap { hit =>
        val map = hit.sourceAsMap

        for {
          metadata <- map.get("metadata").map(anyRefToScalaMap)
          subject = metadata.get("subject").map(_.toString)
          sentAt = metadata.get("sentAt").map(_.toString).flatMap(ExtractedDateTime.fromIsoString)
          from = metadata.get("from").map(anyRefToScalaMap)
          fromAddress = from.flatMap(_.get("address").map(_.toString))
          fromName = from.flatMap(_.get("name").map(_.toString))
        } yield hit.id -> EmailMetadata(subject, fromAddress, fromName, sentAt)
      }.toMap
    }
  }

  override def flag(uri: Uri, value: String): Attempt[Unit] = {
    val id = uri.value
    executeUpdate {
      updateById(indexName, uri.value).doc(
        IndexFields.flags -> value
      )
    }
  }

  override def anyWorkspaceOrCollectionContainsAnyResource(collectionUris: Set[String], workspaceIds: Set[String], resourceUris: Set[String]): Attempt[Boolean] = {
    execute {
      count(indexName)
        .query(
          boolQuery().must(
            termsQuery("_id", resourceUris),
            boolQuery().should(
              nestedQuery(IndexFields.workspacesField,
                termsQuery(s"${IndexFields.workspacesField}.${IndexFields.workspaces.workspaceId}", workspaceIds)
              ),
              termsQuery(IndexFields.collectionRaw, collectionUris)
            )
          )
        )
    }.map { response =>
      response.count > 0
    }
  }

  override def addResourceToWorkspace(blobUri: Uri, workspaceId: String, workspaceNodeId: String): Attempt[Unit] = {
    executeUpdateByQueryImmediateRefresh {
      buildUpdateWorkspaceQuery(blobUri).script(
        script(
          s"""
             |if(ctx._source.${IndexFields.workspacesField} == null) {
             |  ctx._source.${IndexFields.workspacesField} = [[
             |    "${IndexFields.workspaces.uri}": params.workspaceBlobUri,
             |    "${IndexFields.workspaces.workspaceId}": params.workspaceId,
             |    "${IndexFields.workspaces.workspaceNodeId}": params.workspaceNodeId
             |  ]];
             |} else {
             |  ctx._source.${IndexFields.workspacesField}.add([
             |    "${IndexFields.workspaces.uri}": params.workspaceBlobUri,
             |    "${IndexFields.workspaces.workspaceId}": params.workspaceId,
             |    "${IndexFields.workspaces.workspaceNodeId}": params.workspaceNodeId
             |  ]);
             |}
             |""".stripMargin.replaceAll("\\\r?\\\n", "").trim())
          .lang("painless")
          .params(Map(
            "workspaceBlobUri" -> blobUri.value,
            "workspaceId" -> workspaceId,
            "workspaceNodeId" -> workspaceNodeId
          ))
      )
    }
  }

  override def removeResourceFromWorkspace(blobUri: Uri, workspaceId: String, workspaceNodeId: String): Attempt[Unit] = {
    executeUpdateByQueryImmediateRefresh {
      buildUpdateWorkspaceQuery(blobUri).script(
        script(
          s"""
             |if(ctx._source.${IndexFields.workspacesField} != null) {
             |  ctx._source.${IndexFields.workspacesField}.removeIf(entry ->
             |    entry.uri == params.workspaceBlobUri && entry.workspaceId == params.workspaceId && entry.workspaceNodeId == params.workspaceNodeId
             |  );
             |}
             |""".stripMargin.replaceAll("\\\r?\\\n", "").trim())
          .lang("painless")
          .params(Map(
            "workspaceBlobUri" -> blobUri.value,
            "workspaceId" -> workspaceId,
            "workspaceNodeId" -> workspaceNodeId
          ))
      )
    }
  }

  override def deleteWorkspace(workspaceId: String): Attempt[Unit] = {
    executeUpdateByQuery {
      updateByQuery(indexName,
        nestedQuery(IndexFields.workspacesField,
          termQuery(s"${IndexFields.workspacesField}.${IndexFields.workspaces.workspaceId}", workspaceId)
        )
      ).script(
        script(
          s"""
             |if(ctx._source.${IndexFields.workspacesField} != null) {
             |  ctx._source.${IndexFields.workspacesField}.removeIf(entry ->
             |    entry.workspaceId == params.workspaceId
             |  );
             |}
             |""".stripMargin.replaceAll("\\\r?\\\n", "").trim())
          .lang("painless")
          .params(Map(
            "workspaceId" -> workspaceId
          ))
      )
    }
  }

  private def buildQueryStringQuery(q: String) = {
    queryStringQuery(q)
      .defaultOperator("and")
      .quoteFieldSuffix(".exact")
  }

  private def buildMetadataQuery(parameters: SearchParameters) = {
    nestedQuery(
      "metadata." + IndexFields.metadata.extractedMetadataField,
      queryStringQuery(parameters.q).defaultOperator("and"))
      .inner(
        innerHits(NestedField.values)
          .docValueFields(List(
            "metadata." + IndexFields.metadata.extractedMetadataField + "." + NestedField.key + ".keyword"
          )).highlighting(
          HighlightFields.highlighter("metadata.*")
        )
      )
  }

  private def buildUpdateWorkspaceQuery(blobUri: Uri): UpdateByQueryRequest = {
    updateByQuery(indexName,
      boolQuery().should(
        termQuery("_id", blobUri.value),
        // Also recursively add anything that is a child of this blob to the workspace They won't appear in the tree
        // but people should be able to access them even if they don't have access to the underlying dataset.
        termQuery(IndexFields.parentBlobs, blobUri.value)
      )
    )
  }

  private def getWorkspaceFields(workspace: Option[WorkspaceItemContext]) = {
    workspace.map {
      case WorkspaceItemContext(workspaceId, workspaceNodeId, blobUri) =>
        Map(
          IndexFields.workspacesField -> List(
            Map(
              IndexFields.workspaces.workspaceId -> workspaceId,
              IndexFields.workspaces.workspaceNodeId -> workspaceNodeId,
              IndexFields.workspaces.uri -> blobUri,
            )
          )
        )
    }.getOrElse(Map.empty)
  }

  private def recipientToMap(languages: List[Language], recipient: Option[Recipient]): Map[String, Any] = {
    recipient match {
      case Some(Recipient(displayName, email)) =>
        Map(
          IndexFields.metadata.recipients.address -> email
        ) ++ displayName.map { name =>
          Map(IndexFields.metadata.recipients.name -> multiLanguageValue(languages, name))
        }.getOrElse(Map.empty)

      case _ =>
        Map.empty
    }
  }
}

object IndexFields {
  val `type` = "type"
  val extracted = "extracted"
  val ocrExtracted = "ocrExtracted"
  val text = "text"
  val ocr = "ocr"
  val flags = "flags"
  val flagsRaw = "flags.keyword"

  val collection = "collection"
  val collectionRaw = "collection.keyword"
  val ingestion = "ingestion"
  val ingestionRaw = "ingestion.keyword"
  val parentBlobs = "parentBlobs"

  val workspacesField = "workspaces"
  object workspaces {
    val workspaceId = "workspaceId"
    val workspaceNodeId = "workspaceNodeId"
    val uri = "uri"
  }

  val createdAt = "createdAt"
  val lastModifiedAt = "lastModifiedAt"

  val metadataField = "metadata"
  object metadata {
    val mimeTypes = "mimeTypes"
    val mimeTypesRaw = "mimeTypes.keyword"
    val fileUris = "fileUris"
    val fileUrisRaw = "fileUris.keyword"
    val fileSize = "fileSize"
    val extractedMetadataField = "extractedMetadata"

    val enrichedMetadataField = "enrichedMetadata"
    object enrichedMetadata {
      val title = "title"
      val author = "author"
      val createdAt = "createdAt"
      val lastModified = "lastModified"
      val createdWith = "createdWith"
      val pageCount = "pageCount"
      val wordCount = "wordCount"
    }

    val fromField = "from"
    object from {
      val name = "name"
      val address = "address"
    }

    val recipientsField = "recipients"
    object recipients {
      val name = "name"
      val address = "address"
    }
    val sentAt = "sentAt"
    val sensitivity = "sensitivity"
    val priority = "priority"
    val inReplyTo = "inReplyTo"
    val references = "references"
    val subject = "subject"
    val html = "html"
    val attachmentCount = "attachmentCount"
  }

  // These should be in order of importance
}

object IndexAggNames {
  val collection = "collection"
  val ingestion = "ingestion"
  val mimeTypes = "mimeType"
  val flags = "flags"
  val createdAt = "createdAt"
  val workspace = "workspace"
}
