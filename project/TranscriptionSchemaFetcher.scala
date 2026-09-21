import play.api.libs.json.Json
import sbt._
import sbt.util.Logger

import java.nio.charset.StandardCharsets
import scala.sys.process._

/** Downloads the transcription service worker interface JSON schema, which is the input to
  * [[TranscriptionWorkerInterfaceGenerator]].
  *
  * The schema is fetched to a temporary file first and validated as JSON before it replaces the
  * checked-in copy, so a failed fetch can never leave a broken (or half-written) schema behind.
  */
object TranscriptionSchemaFetcher {

  /** Where the JSON schema lives in https://github.com/guardian/transcription-service */
  val schemaPathInRepository = "packages/common/schemas/worker-interface-schema.json"

  private val defaultBranch = "main"

  private val timeoutSeconds = 30

  /** @param args the parsed task arguments: either nothing, or the branch (or tag/commit) to fetch from
    * @param schemaFile where to write the schema on success
    */
  def fetch(args: Seq[String], schemaFile: File, log: Logger): Unit = {
    def fail(message: String): Nothing = {
      log.error(message)
      throw new MessageOnlyException(message)
    }

    val branch = args match {
      case Nil          => defaultBranch
      case Seq(ref)     => ref
      case moreThanOne  =>
        fail(
          "fetchSchema takes at most one argument, the branch (or tag/commit) to fetch the schema from, " +
            s"but got: ${moreThanOne.mkString(" ")}"
        )
    }

    val schemaUrl =
      s"https://raw.githubusercontent.com/guardian/transcription-service/$branch/$schemaPathInRepository"
    // Download to a temporary file so a failed fetch can never clobber the checked-in schema
    val tempFile = IO.createTemporaryDirectory / schemaFile.getName

    log.info(s"Fetching transcription worker interface schema from $schemaUrl")
    val exitCode = Seq(
      "curl",
      "--fail",
      "--silent",
      "--show-error",
      "--location",
      "--max-time", timeoutSeconds.toString,
      "--output", tempFile.getAbsolutePath,
      schemaUrl
    ).!(ProcessLogger(log.info(_), log.error(_)))

    if (exitCode != 0) {
      fail(
        s"Failed to fetch $schemaUrl (curl exit code $exitCode). Check that:\n" +
          s"  - the branch (or tag/commit) '$branch' exists in guardian/transcription-service\n" +
          s"  - the schema is still at $schemaPathInRepository\n" +
          s"$schemaFile has been left unchanged."
      )
    }

    val downloaded = IO.read(tempFile, StandardCharsets.UTF_8)

    try Json.parse(downloaded)
    catch {
      case e: Exception =>
        fail(
          s"The content downloaded from $schemaUrl is not valid JSON (${e.getMessage}). " +
            s"Refusing to overwrite $schemaFile."
        )
    }

    IO.write(schemaFile, downloaded, StandardCharsets.UTF_8)
    log.info(s"Wrote schema from '$branch' to $schemaFile")
    log.info(
      "Now run `sbt generateTranscriptionWorkerInterface` to regenerate the Scala model and commit both files."
    )
  }
}

