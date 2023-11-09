package services.index

import extraction.EnrichedMetadata
import model.frontend.SearchResults
import model.frontend.email.EmailMetadata
import model.index.{IndexedBlob, IndexedResource, SearchParameters}
import model.ingestion.WorkspaceItemContext
import model.{Email, Language, Uri}
import utils.attempt.Attempt

trait Index {
  def setup(): Attempt[Index]

  def ingestDocument(uri: Uri, size: Long, document: IngestionData, languages: List[Language]): Attempt[Unit]

  def addDocumentDetails(uri: Uri, text: Option[String], metadata: Map[String, Seq[String]], enrichedMetadata: EnrichedMetadata, languages: List[Language]): Attempt[Unit]
  def addDocumentOcr(uri: Uri, ocr: Option[String], language: Language): Attempt[Unit]
  def addDocumentTranscription(uri: Uri, transcription: String, translation: Option[String], language: Language): Attempt[Unit]

  def ingestEmail(email: Email, ingestion: String, sourceMimeType: String, parentBlobs: List[Uri], workspace: Option[WorkspaceItemContext], languages: List[Language]): Attempt[Unit]

  def query(parameters: SearchParameters, context: SearchContext): Attempt[SearchResults]

  def getResource(uri: Uri, highlightTextQuery: Option[String]): Attempt[IndexedResource]

  def getPageCount(uri: Uri): Attempt[Option[Long]]

  def getEmailMetadata(ids: List[String]): Attempt[Map[String, EmailMetadata]]

  def flag(uri: Uri, flagValue: String): Attempt[Unit]

  def getBlobs(collection: String, ingestion: Option[String], size: Int, inMultiple: Boolean): Attempt[Iterable[IndexedBlob]]

  def countBlobs(collection: String, ingestion: Option[String], inMultiple: Boolean): Attempt[Long]

  def delete(id: String): Attempt[Unit]

  def anyWorkspaceOrCollectionContainsAnyResource(collectionUris: Set[String], workspaceIds: Set[String], resourceUris: Set[String]): Attempt[Boolean]

  def addResourceToWorkspace(uri: Uri, workspaceId: String, workspaceNodeId: String): Attempt[Unit]

  def removeResourceFromWorkspace(uri: Uri, workspaceId: String, workspaceNodeId: String): Attempt[Unit]

  def deleteWorkspace(workspaceId: String): Attempt[Unit]
}
