package ingestion

import java.nio.file.attribute.FileTime
import java.nio.file.{Files, LinkOption, Path}

import cats.data.NonEmptyList
import extraction.ExtractionParams
import model.ingestion.{EmailContext, FileContext, IngestionFile, WorkspaceItemContext}
import model.{Email, Language, Uri}

import scala.jdk.CollectionConverters._

// The manifests resource graph is build piecemeal as paths of the overall graph which begin and end with a RootUri
// This class is a helper to build those while walking some structure (file system, email store, etc.)
class IngestionContextBuilder private(val progress: NonEmptyList[Uri], parentBlobs: List[Uri], ingestion: String, languages: List[Language], workspace: Option[WorkspaceItemContext]) {
  def pushDirectory(dirName: String): IngestionContextBuilder = {
    new IngestionContextBuilder(progress.head.chain(dirName) :: this.progress, parentBlobs, ingestion, languages, workspace)
  }

  def pushParentDirectories(path: Path): IngestionContextBuilder = {
    Option(path.getParent).map(_.iterator().asScala.toList).getOrElse(Nil)
      .foldLeft(this) {
        (acc, currentPath) => acc.pushDirectory(currentPath.toString)
      }
  }

  // When you push a root URI we reset the current progress
  def pushEmail(emailUri: Uri): IngestionContextBuilder = IngestionContextBuilder(emailUri, parentBlobs :+ emailUri, ingestion, languages, workspace)
  def pushBlob(blobUri: Uri): IngestionContextBuilder = IngestionContextBuilder(blobUri, parentBlobs :+ blobUri, ingestion, languages, workspace)

  def finishWithEmail(email: Email): EmailContext = EmailContext(email, progress.toList, parentBlobs, ingestion, languages, workspace)
  def finishWithFile(file: IngestionFile): FileContext = FileContext(file, this.progress.toList, parentBlobs, ingestion, languages, workspace)

  def finishWithFile(path: Path): FileContext = finishWithFile(IngestionFile(
    path = path,
    uri = this.progress.head.chain(path.getFileName.toString),
    parentUri = this.progress.head,
    attr = Files.readAttributes(path, "*", LinkOption.NOFOLLOW_LINKS),
    temporary = false)
  )

  def finish(fileName: String,
             fileOnDisk: Path,
             creationTime: Option[FileTime] = None,
             lastAccessTime: Option[FileTime] = None,
             lastModifiedTime: Option[FileTime] = None): FileContext = finishWithFile(
    IngestionFile(
      uri = this.progress.head.chain(fileName),
      parentUri = this.progress.head,
      size = Files.size(fileOnDisk),
      creationTime = creationTime,
      lastAccessTime = lastAccessTime,
      lastModifiedTime = lastModifiedTime,
      isRegularFile = true
    )
  )
}

object IngestionContextBuilder {
  private def apply(rootUri: Uri, parentBlobs: List[Uri], ingestion: String, languages: List[Language], workspace: Option[WorkspaceItemContext]) =
    new IngestionContextBuilder(NonEmptyList.fromListUnsafe(List(rootUri)), parentBlobs, ingestion, languages, workspace)

  def fromIngestion(ingestion: String, languages: List[Language], workspace: Option[WorkspaceItemContext]): IngestionContextBuilder = {
    IngestionContextBuilder(Uri(ingestion), parentBlobs = List.empty, ingestion, languages, workspace)
  }

  def apply(rootUri: Uri, params: ExtractionParams) = {
    new IngestionContextBuilder(NonEmptyList.fromListUnsafe(List(rootUri)), params.parentBlobs :+ rootUri, params.ingestion, params.languages, params.workspace)
  }
}
