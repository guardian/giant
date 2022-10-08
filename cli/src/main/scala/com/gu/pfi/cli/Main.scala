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

  val options = new Options(args.toIndexedSeq)

  options.subcommand match {
    case Some(options.hashCmd) =>
      HashFiles.run(options.hashCmd.files())

    case Some(_ @ options.loginCmd) =>
      run("Login", options.loginCmd) { services =>
        services.http.login(
          options.loginCmd.username.toOption,
          options.loginCmd.password.toOption,
          options.loginCmd.twoFactor.toOption,
          options.loginCmd.token.toOption
        )
      }

    case Some(_ @ options.logoutCmd) =>
      run("Logout", options.logoutCmd) { services =>
        services.http.logout()
      }

    case Some(_ @ options.apiCmd) =>
      run("API call", options.apiCmd) { services =>
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

    case Some(_ @ options.authCmd) =>
      run("Authorisation token", options.authCmd) { services =>
        services.http.getCredentials.map { creds =>
          logger.info(s"${CliHttpClient.authHeader}: ${creds.authorization}")
        }
      }

    case Some(_ @ options.listCmd) =>
      run("List ingestions", options.listCmd) { services =>
        services.ingestion.listIngestions().map { ingestions =>
          ingestions.sortBy(_.uri.toLowerCase(Locale.UK)).foreach { ingestion =>
            logger.info(ingestion.uri)
            ingestion.path.foreach { path =>
              logger.info(s"\t Original path: $path")
            }
          }
        }
      }

    case Some(_ @ options.verifyCmd) =>
      run("Verify ingestion", options.verifyCmd) { services =>
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

    case Some(_ @ options.ingestCmd) =>
      run("Ingest", options.ingestCmd) { services =>
        val ingestArgs = options.ingestCmd

        val source = IngestionSource(options)
        val credentials = AwsCredentials(ingestArgs.minioAccessKey.toOption, ingestArgs.minioSecretKey.toOption, ingestArgs.awsProfile.toOption)

        val ingestionS3Client = new DefaultIngestionS3Client(options.ingestCmd, credentials)

        val command = new RunIngestion(services.ingestion, ingestionS3Client, services.veracrypt)
        command.run(Uri(ingestArgs.ingestionUri()), source, options.ingestCmd.languages)
      }

    case Some(_ @ options.createUsers) =>
      run("Create users", options.createUsers) { services =>
        services.users.createUsers(options.createUsers.usernames()).map { newUsers =>
          newUsers.foreach { user =>
            logger.info(s"username: ${user.username}\tpassword: ${user.password}")
          }
        }
      }

    case Some(_ @ options.deleteIngestions) =>
      run("Delete ingestions", options.deleteIngestions) { services =>
        val command = new DeleteIngestions(options.deleteIngestions.ingestionUris, services.ingestion, options.deleteIngestions.conflictBehaviour)
        command.run()
      }

    case Some(_ @ options.createIngestion) =>
      run("Create ingestion", options.createIngestion) { services =>
        val Array(collection, ingestionName) = options.createIngestion.ingestionUri().split('/')

        services.ingestion.createCollection(collection).flatMap { _ =>
          services.ingestion.createIngestion(collection, root = None, ingestionName, options.createIngestion.languages, fixed = false)
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
