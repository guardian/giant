package model.ingestion

import model.{Email, Language, Uri}

/**
  * Email context used when ingesting emails from an email store (.pst file, etc)
  *
  * @param email       The file details itself
  * @param parents     A list of the parents of the file, the head of the list is the direct parent of the file whilst
  *                    the last entry of the list is the root
  * @param parentBlobs A list of the blobs under which the file can be found, expanded recursively
  *                    The URIs in `parents` will terminate at the first parent blob.
  * @param ingestion   The name of the current ingestion being processed when we see this file
  * @param languages   The languages that could be present in this file (used for OCR)
  * @param workspace   Details of where the file (or parent) has been uploaded directly to a workspace
  */
case class EmailContext(email: Email, parents: List[Uri], parentBlobs: List[Uri], ingestion: String, languages: List[Language], workspace: Option[WorkspaceItemContext])

