package com.gu.pfi.cli

import java.io.File
import _root_.model.{English, Language, Languages}
import com.gu.pfi.cli.model.{ConflictBehaviour, Delete, Skip, Stop}
import enumeratum.{Enum, EnumEntry}
import org.rogach.scallop.{DefaultConverters, ScallopConf, Subcommand, ValueConverter}

sealed trait IngestionType extends EnumEntry
object IngestionType extends CliEnum[IngestionType] {
  val values = findValues

  case object FileSystem extends IngestionType
  case object Truecrypt extends IngestionType
  case object Veracrypt extends IngestionType
}

sealed trait HttpMethod extends EnumEntry
object HttpMethod extends CliEnum[HttpMethod] {
  val values = findValues

  case object GET extends HttpMethod
  case object PUT extends HttpMethod
  case object POST extends HttpMethod
  case object DELETE extends HttpMethod
}

trait CommonOptions { _: ScallopConf =>
  val uri = opt[String]("uri", descr = "URI of the PFI installation to connect to eg https://mtest.pfi.gutools.co.uk, http://localhost:9001", noshort = true)
}

trait LanguageOptions { _: ScallopConf =>
  val languagesOpt = opt[List[String]]("languages", noshort = true,
    descr = s"One or more languages, separated by commas. Defaults to ${English.key}. Supported languages: (${Languages.all.map(_.key).sortWith(_ < _).mkString(", ")})")

  def languages: List[Language] = {
    languagesOpt.toOption match {
      case Some(rawLanguageArgs) =>
        rawLanguageArgs.flatMap { rawLanguageArg =>
          rawLanguageArg.split(",").map(_.trim)
        }.map { lang =>
          Languages.getByKeyOrThrow(lang)
        }

      case _ =>
        List(English)
    }
  }
}


class IngestCommandOptions extends Subcommand("ingest") with CommonOptions with LanguageOptions  {

    descr("Upload files into an ingestion")

    val path = opt[String]("path", noshort = true, required = true,
      descr = "Path to the source data on disk")

    val ingestionUri = opt[String]("ingestionUri", noshort = true, required = true,
      descr = "Ingestion URI (<collection>/<ingestion>)")

    val ingestionBucket = opt[String]("bucket", noshort = true, default = Some("ingest-data"),
      descr = "Ingestion S3 bucket")

    val region = opt[String]("region", noshort = true, default = Some("eu-west-1"),
      descr = "AWS region for the ingestion S3 bucket")

    val minioAccessKey = opt[String]("minioAccessKey", descr = "Access key (only required when using Minio)", noshort = true)
    val minioSecretKey = opt[String]("minioSecretKey", descr = "Secret key (only required when using Minio)", noshort = true)
    val minioEndpoint = opt[String]("minioEndpoint", descr = "Endpoint (only required when using Minio, defaults to localhost)", default = Some("http://127.0.0.1:9090"))

    val awsProfile = opt[String]("awsProfile", descr = "AWS profile to use for S3 upload credentials", noshort = true)
    val sseAlgorithm = opt[String]("sseAlgorithm", descr = "Mandate S3 use a server-side encryption algorithm (eg aws:kms)", noshort = true)

    val ingestionType = opt[IngestionType]("type", noshort = true,
      descr = s"Type of source data for the ingestion. Valid: [${IngestionType.values.mkString(", ")}]. Default: ${IngestionType.FileSystem}")

    val password = opt[String]("password", noshort = true, descr = s"Password if ingestion type is ${IngestionType.Truecrypt} or ${IngestionType.Veracrypt}")

}

class Options(args: Seq[String]) extends ScallopConf(args) {
  // Don't forget to add your new subcommand using addSubcommand at the bottom of the file!

  version(s"pfi-cli ${utils.buildinfo.BuildInfo.version} ${utils.buildinfo.BuildInfo.vcsBranch} ${utils.buildinfo.BuildInfo.vcsCommitId}")

  val loginCmd = new Subcommand("login") with CommonOptions {
    descr("Login - subsequent commands will not require you to type in credentials (until the login expires)")

    val username = opt[String]("username", noshort = true)
    val password = opt[String]("password", noshort = true)
    val twoFactor = opt[String]("tfa", descr = "Two factor authentication code", noshort = true)
    val token = opt[String]("token", descr = "Raw JWT token from the About page in the browser app")
  }

  val logoutCmd = new Subcommand("logout") with CommonOptions

  val apiCmd = new Subcommand("api") with CommonOptions {
    descr("API (direct call using auth)")

    val verb = opt[HttpMethod]("verb", default = Some(HttpMethod.GET), noshort = true)
    val endpoint = trailArg[String]("endpoint")
  }

  val authCmd = new Subcommand("auth") with CommonOptions {
    descr("Provide the auth header for use in another tool")
  }

  val listCmd = new Subcommand("list") with CommonOptions {
    descr("List all ingestions in the index")
  }

  val verifyCmd = new Subcommand("verify") with CommonOptions {
    descr("Verify that an ingestion has completed successfully - this will crawl the files on disk (in the path recorded in the database) and check them against the index")

    val ingestion = opt[String]("ingestion", required = true, descr = "URI of ingestion to verify (see list command)", noshort = true)
    val checkDigest = toggle("check-digests", descrYes = "Compute and verify the digest of each file (otherwise we only check size)", noshort = true)

    val alternatePath = opt[File]("alternate-path", descr = "Provide an alternate location of the files to check", noshort = true)
    validateFileIsDirectory(alternatePath)
  }

  val ingestCmd = new IngestCommandOptions

  val hashCmd = new Subcommand("hash") {
    descr("Compute the PFI hash of a given file")

    val files = trailArg[List[File]]("files")
  }

  val exportCmd = new Subcommand("export") with CommonOptions {
    descr("Exports user data from a given deployment")
  }

  val importCmd = new Subcommand("import") with CommonOptions {
    descr("Imports user data from a given deployment")

    val file = trailArg[File]("file")
    validateFileIsFile(file)
  }

  val createUsers = new Subcommand("create-users") with CommonOptions {
    descr("Bulk create new users, automatically generating passwords")

    val usernames = trailArg[List[String]]("usernames", validate = _.nonEmpty)
  }

  val deleteIngestions = new Subcommand("delete-ingestion") with CommonOptions {
    descr("Delete ingestions. EXPERIMENTAL: do not use without consulting the caveats in the documentation")

    val ingestionUrisOpt = opt[List[String]](name = "ingestionUri")
    def ingestionUris: List[(String, String)] = ingestionUrisOpt().map { uri =>
      val parts = uri.split("/")
      (parts.head, parts.last)
    }

    val conflictBehaviourOpt = opt[String](
      name = "conflictBehaviour",
      descr =
        """
          |What to do when a blob in the ingest is also included in another ingest. Valid options: delete,skip,stop.
          |Note that if you select 'delete' the blob will be deleted from all ingestions in giant.
        """.stripMargin,
      noshort = true)
    def conflictBehaviour: Option[ConflictBehaviour] = conflictBehaviourOpt.toOption.map {
      case Skip.name => Skip
      case Delete.name => Delete
      case Stop.name => Stop
    }
  }

  val createIngestion = new Subcommand("create-ingestion") with CommonOptions with LanguageOptions {
    descr("Create an ingestion that other tools can upload into")

    val ingestionUri = opt[String]("ingestionUri", required = true, noshort = true)
  }

  addSubcommand(loginCmd)
  addSubcommand(logoutCmd)
  addSubcommand(apiCmd)
  addSubcommand(authCmd)
  addSubcommand(listCmd)
  addSubcommand(verifyCmd)
  addSubcommand(ingestCmd)
  addSubcommand(hashCmd)
  addSubcommand(exportCmd)
  addSubcommand(importCmd)
  addSubcommand(createUsers)
  addSubcommand(deleteIngestions)
  addSubcommand(createIngestion)

  verify()
}

trait CliEnum[A <: EnumEntry] extends Enum[A] with DefaultConverters {
  implicit val converter: ValueConverter[A] = singleArgConverter(withNameInsensitive)
}
