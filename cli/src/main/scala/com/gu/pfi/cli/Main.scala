package com.gu.pfi.cli

import java.nio.file.Paths
import java.util.Locale

import _root_.model.{Languages, Uri}
import com.gu.pfi.cli.ingestion.IngestionSource
import com.gu.pfi.cli.service.{CliServices, _}
import play.api.libs.json.Json
import utils.{AwsCredentials, AwsS3Clients, Logging}
import utils.attempt.Attempt

import scala.concurrent.Await
import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.duration.Duration

object Main extends App with Logging {
  import scala.language.reflectiveCalls

  val options = new Options(args)

  options.subcommand match {
    case Some(options.hashCmd) =>
      HashFiles.run(options.hashCmd.files())

    case Some(cmd @ options.loginCmd) =>
      run("Login", cmd) { services =>
        services.http.login(
          options.loginCmd.username.toOption,
          options.loginCmd.password.toOption,
          options.loginCmd.twoFactor.toOption,
          options.loginCmd.token.toOption
        )
      }

    case Some(cmd @ options.logoutCmd) =>
      run("Logout", cmd) { services =>
        services.http.logout()
      }

    case Some(cmd @ options.apiCmd) =>
      run("API call", cmd) { services =>
        val uri = options.apiCmd.endpoint()

        options.apiCmd.verb() match {
          case HttpMethod.GET =>
            services.http.get(uri).map { js =>
              logger.info(Json.prettyPrint(js))
            }
          case HttpMethod.POST =>
            services.http.post(uri, "").map { r =>
              logger.info(r.body().string())
            }
          case HttpMethod.PUT =>
            services.http.put(uri, "").map { r =>
              logger.info(r.body().string())
            }
          case HttpMethod.DELETE =>
            services.http.delete(uri).map { r =>
              logger.info(r.body().string())
            }
        }
      }

    case Some(cmd @ options.authCmd) =>
      run("Authorisation token", cmd) { services =>
        services.http.getCredentials.map { creds =>
          logger.info(s"${CliHttpClient.authHeader}: ${creds.authorization}")
        }
      }

    case Some(cmd @ options.listCmd) =>
      run("List ingestions", cmd) { services =>
        services.ingestion.listIngestions().map { ingestions =>
          ingestions.sortBy(_.uri.toLowerCase(Locale.UK)).foreach { ingestion =>
            logger.info(ingestion.uri)
            ingestion.path.foreach { path =>
              logger.info(s"\t Original path: $path")
            }
          }
        }
      }

    case Some(cmd @ options.verifyCmd) =>
      run("Verify ingestion", cmd) { services =>
        val result = services.ingestion.verifyIngestion(
          options.verifyCmd.ingestion(),
          options.verifyCmd.checkDigest(),
          options.verifyCmd.alternatePath.toOption.map(_.toPath)
        )

        result.map { result =>
          if (result.filesInError.nonEmpty) {
            logger.info(
              s"""
                 |Files in error during crawl:
                 |  ${result.filesInError.mkString("\n  ")}
                 """.stripMargin
            )
          }
          if (result.filesNotIndexed.nonEmpty) {
            logger.info(
              s"""
                 |Files crawled but not in index:
                 |  ${result.filesNotIndexed.mkString("\n  ")}
                 """.stripMargin
            )
          }
          logger.info(s"Files in index: ${result.numberOfFilesInIndex} Files crawled: ${result.numberOfFilesOnDisk}")
        }
      }

    case Some(cmd @ options.ingestCmd) =>
      run("Ingest", cmd) { services =>
        val ingestArgs = options.ingestCmd

        val source = IngestionSource(options)
        val credentials = AwsCredentials(ingestArgs.minioAccessKey.toOption, ingestArgs.minioSecretKey.toOption, ingestArgs.awsProfile.toOption)

        val ingestionS3Client = new DefaultIngestionS3Client(cmd, credentials)

        val command = new RunIngestion(services.ingestion, ingestionS3Client, services.veracrypt)
        command.run(Uri(ingestArgs.ingestionUri()), source, cmd.languages)
      }

    case Some(cmd @ options.createUsers) =>
      run("Create users", cmd) { services =>
        services.users.createUsers(options.createUsers.usernames()).map { newUsers =>
          newUsers.foreach { user =>
            logger.info(s"username: ${user.username}\tpassword: ${user.password}")
          }
        }
      }

    case Some(cmd @ options.deleteIngestions) =>
      run("Delete ingestions", cmd) { services =>
        val command = new DeleteIngestions(cmd.ingestionUris, services.ingestion)
        command.run()
      }

    case Some(cmd @ options.createIngestion) =>
      run("Create ingestion", cmd) { services =>
        val Array(collection, ingestionName) = cmd.ingestionUri().split('/')

        services.ingestion.createCollection(collection).flatMap { _ =>
          services.ingestion.createIngestion(collection, root = None, ingestionName, cmd.languages, fixed = false)
        }
      }

    case _ =>
      options.printHelp()
  }

  private def run[T](action: String, options: CommonOptions)(fn: CliServices => Attempt[T]): Unit = {
    val result = fn(CliServices(options))

    Await.result(result.fold(
      failure => {
        logger.error(s"Failed to $action: $failure")
        failure.toThrowable.printStackTrace()
        System.exit(1)
      },
      _ => {
        System.exit(0)
      }
    ), Duration.Inf)
  }
}
