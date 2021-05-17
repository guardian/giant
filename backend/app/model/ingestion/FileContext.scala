package model.ingestion

import model.ingestion.IngestMetadata.expandParents
import model.{Language, Uri}
import utils.attempt.{ClientFailure, Failure}

/**
  * The file context represents a file along with a list of parent components showing the location within a directory
  * hierarchy.
  *
  * @param file        The file details itself
  * @param parents     A list of the parents of the file, the head of the list is the direct parent of the file whilst
  *                    the last entry of the list is the root
  * @param parentBlobs A list of the blobs under which the file can be found, expanded recursively
  *                    The URIs in `parents` will terminate at the first parent blob.
  * @param ingestion   The name of the current ingestion being processed when we see this file
  * @param languages   The languages that could be present in this file (used for OCR)
  * @param workspace   Details of where the file (or parent) has been uploaded directly to a workspace
  */
case class FileContext(file: IngestionFile, parents: List[Uri], parentBlobs: List[Uri], ingestion: String, languages: List[Language], workspace: Option[WorkspaceItemContext])

object FileContext {
  def fromIngestMetadata(metadata: IngestMetadata): Either[Failure, FileContext] = {
    if(!metadata.file.uri.value.startsWith(metadata.file.parentUri.value)) {
      Left(ClientFailure(s"uri ${metadata.file.uri} does not start with parent ${metadata.file.parentUri}"))
    } else {
      // No parent blobs, this is a file where the URI leads directly back up to the ingestion
      expandParents(metadata.ingestion, metadata.file.parentUri).map { parents =>
        FileContext(metadata.file, parents, parentBlobs = List.empty, metadata.ingestion, metadata.languages, workspace = None)
      }
    }
  }
}