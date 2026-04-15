package com.gu.pfi.cli

import java.nio.file.Paths
import java.util.Locale

import _root_.model.{Languages, Uri}
import com.amazonaws.auth.AWSCredentialsProvider
import com.amazonaws.client.builder.AwsClientBuilder.EndpointConfiguration
import com.amazonaws.services.s3.AmazonS3ClientBuilder
import com.gu.pfi.cli.ingestion.IngestionSource
import com.gu.pfi.cli.service.{CliServices, _}
import play.api.libs.json.Json
import utils.{AwsCredentials, AwsS3Clients, Logging}
import utils.attempt.{Attempt, Failure}
import utils.attempt.AttemptAwait._

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
        ).map { _ =>
          logger.info(ConsoleColors.success("✓ Logged in successfully"))
        }
      }

    case Some(_ @ options.logoutCmd) =>
      run("Logout", options.logoutCmd) { services =>
        services.http.logout().map { _ =>
          logger.info(ConsoleColors.success("✓ Logged out"))
        }
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
        services.ingestion.listCollections().map { collections =>
          if (collections.isEmpty) {
            logger.info(ConsoleColors.dim("No collections found"))
          } else {
          val collectionFilter = options.listCmd.collection.toOption
          val filtered = collectionFilter match {
            case Some(name) => collections.filter(_.uri == name)
            case None => collections
          }

          if (filtered.isEmpty && collectionFilter.isDefined) {
            logger.info(ConsoleColors.warning(s"No collection found matching '${collectionFilter.get}'"))
            logger.info(ConsoleColors.dim("Use 'list' without --collection to see all collections"))
          } else {
            filtered.sortBy(_.uri.toLowerCase(Locale.UK)).foreach { collection =>
              logger.info(ConsoleColors.bold(s"\uD83D\uDCC1 ${collection.uri}"))
              if (collection.ingestions.isEmpty) {
                logger.info(ConsoleColors.dim("   (no ingestions)"))
              } else {
                collection.ingestions.sortBy(_.uri.toLowerCase(Locale.UK)).foreach { ingestion =>
                  val pathInfo = ingestion.path.map(p => ConsoleColors.dim(s" ← $p")).getOrElse("")
                  logger.info(s"   └─ ${ingestion.uri}$pathInfo")
                }
              }
            }
            val totalIngestions = filtered.map(_.ingestions.size).sum
            logger.info(ConsoleColors.dim(s"\n${filtered.size} collection(s), $totalIngestions ingestion(s)"))
          }
          }
        }
      }

    case Some(_ @ options.showCmd) =>
      run("Show ingestion", options.showCmd) { services =>
        val uri = options.showCmd.ingestionUri()
        CommandValidator.validateIngestionUri(uri).flatMap { _ =>
          val parts = uri.split("/")
          val collection = parts(0)
          val ingestion = parts(1)

          for {
            ingestionInfo <- services.ingestion.listIngestions().map(_.find(_.uri == uri))
            blobCount <- services.ingestion.countBlobs(collection, ingestion)
          } yield {
            ingestionInfo match {
              case Some(info) =>
                logger.info(ConsoleColors.bold(s"\nIngestion: $uri"))
                info.path.foreach(p => logger.info(s"  Source path:   $p"))
                logger.info(s"  Files indexed: $blobCount")
                logger.info("")
                logger.info(ConsoleColors.dim("Use 'verify' to check all source files are indexed"))
                logger.info(ConsoleColors.dim("Use 'delete-ingestion' to remove this ingestion"))
              case None =>
                logger.info(ConsoleColors.warning(s"Ingestion '$uri' not found"))
                logger.info(ConsoleColors.dim("Use 'list' to see all available ingestions"))
            }
          }
        }
      }

    case Some(_ @ options.showCollectionCmd) =>
      run("Show collection", options.showCollectionCmd) { services =>
        val collectionName = options.showCollectionCmd.collection()
        services.ingestion.listCollections().flatMap { collections =>
          collections.find(_.uri == collectionName) match {
            case Some(collection) =>
              if (collection.ingestions.isEmpty) {
                logger.info(ConsoleColors.bold(s"\n📁 ${collection.uri}"))
                logger.info(ConsoleColors.dim("   (no ingestions)"))
                Attempt.Right(())
              } else {
                val countAttempts = collection.ingestions.map { ingestion =>
                  val parts = s"${collection.uri}/${ingestion.uri}".split("/")
                  services.ingestion.countBlobs(parts(0), parts(1)).map(count => (ingestion, count))
                }
                Attempt.sequence(countAttempts).map { ingestionsWithCounts =>
                  logger.info(ConsoleColors.bold(s"\n📁 ${collection.uri}"))
                  logger.info(s"   ${collection.ingestions.size} ingestion(s)\n")
                  ingestionsWithCounts.sortBy(_._1.uri.toLowerCase(Locale.UK)).foreach { case (ingestion, count) =>
                    val pathInfo = ingestion.path.map(p => ConsoleColors.dim(s" ← $p")).getOrElse("")
                    logger.info(s"   └─ ${ingestion.uri}  [$count file(s)]$pathInfo")
                  }
                  logger.info("")
                  logger.info(ConsoleColors.dim("Use 'show --ingestionUri <collection>/<ingestion>' for more detail"))
                  logger.info(ConsoleColors.dim("Use 'delete-ingestion --ingestionUri <collection>/<ingestion>' to remove an ingestion"))
                }
              }
            case None =>
              logger.info(ConsoleColors.warning(s"Collection '$collectionName' not found"))
              logger.info(ConsoleColors.dim("Use 'list' to see all available collections"))
              Attempt.Right(())
          }
        }
      }

    case Some(_ @ options.statusCmd) =>
      run("Status", options.statusCmd) { services =>
        val statusArgs = options.statusCmd
        val uri = statusArgs.ingestionUri()

        CommandValidator.validateIngestionUri(uri).flatMap { _ =>
          Attempt.catchNonFatalBlasé {
            val credentials: AWSCredentialsProvider = AwsCredentials(
              statusArgs.minioAccessKey.toOption,
              statusArgs.minioSecretKey.toOption,
              statusArgs.awsProfile.toOption
            )

            val s3 = (statusArgs.minioAccessKey.toOption, statusArgs.minioSecretKey.toOption, statusArgs.minioEndpoint.toOption) match {
              case (Some(_), Some(_), Some(endpoint)) =>
                AmazonS3ClientBuilder.standard()
                  .withEndpointConfiguration(new EndpointConfiguration(endpoint, statusArgs.region()))
                  .withPathStyleAccessEnabled(true)
                  .withCredentials(credentials)
                  .build()
              case _ =>
                AmazonS3ClientBuilder.standard()
                  .withCredentials(credentials)
                  .withRegion(statusArgs.region())
                  .build()
            }

            val result = IngestionStatus.checkBucket(s3, statusArgs.bucket(), uri)

            statusArgs.path.toOption match {
              case Some(localPath) =>
                val local = Paths.get(localPath)
                logger.info(IngestionStatus.formatComparison(result, local, uri))

                if (statusArgs.generateCheckpoint()) {
                  val checkpointPath = IngestionStatus.generateCheckpoint(result, local, uri)
                  // Also add files already processed by the backend (no longer in S3)
                  IngestionStatus.augmentCheckpointFromIndex(services.ingestion, checkpointPath, local, uri)
                  IngestionStatus.printCheckpointSummary(checkpointPath, local, uri)
                }

              case None =>
                logger.info(IngestionStatus.formatStatus(result, uri))

                if (statusArgs.generateCheckpoint()) {
                  logger.warn(ConsoleColors.warning("--generate-checkpoint requires --path to map S3 files back to local paths"))
                }
            }
          }
        }
      }

    case Some(_ @ options.verifyCmd) =>
      run("Verify ingestion", options.verifyCmd) { services =>
        CommandValidator.validateVerifyCommand(
          options.verifyCmd.ingestion(),
          options.verifyCmd.alternatePath.toOption.map(_.toPath)
        ).flatMap { _ =>
          val result = services.ingestion.verifyIngestion(
            options.verifyCmd.ingestion(),
            options.verifyCmd.checkDigest(),
            options.verifyCmd.alternatePath.toOption.map(_.toPath)
          )

          result.map { result =>
            if (result.filesInError.nonEmpty) {
              logger.info(ConsoleColors.error(
                s"""
                   |Files in error during crawl:
                   |  ${result.filesInError.mkString("\n  ")}
                   """.stripMargin
              ))
            }
            if (result.filesNotIndexed.nonEmpty) {
              logger.info(ConsoleColors.warning(
                s"""
                   |Files crawled but not in index:
                   |  ${result.filesNotIndexed.mkString("\n  ")}
                   """.stripMargin
              ))
            }
            val summary = s"Files in index: ${result.numberOfFilesInIndex} Files crawled: ${result.numberOfFilesOnDisk}"
            if (result.filesInError.isEmpty && result.filesNotIndexed.isEmpty) {
              logger.info(ConsoleColors.success(s"✓ $summary"))
            } else {
              logger.info(summary)
            }
          }
        }
      }

    case Some(_ @ options.ingestCmd) =>
      run("Ingest", options.ingestCmd) { services =>
        val ingestArgs = options.ingestCmd

        // Validate inputs before starting
        CommandValidator.validateIngestCommand(
          ingestArgs.ingestionUri(),
          ingestArgs.path(),
          ingestArgs.ingestionBucket()
        ).flatMap { _ =>
          val sourcePath = Paths.get(ingestArgs.path()).toAbsolutePath

          // Pre-flight scan
          logger.info(ConsoleColors.dim("Scanning source directory..."))
          val scanResult = PreFlightCheck.scan(sourcePath)
          logger.info(PreFlightCheck.formatSummary(sourcePath, ingestArgs.ingestionUri(), scanResult))

          if (scanResult.fileCount == 0) {
            logger.info(ConsoleColors.warning("No files found to upload"))
            Attempt.Right(())
          } else if (ingestArgs.dryRun()) {
            logger.info(ConsoleColors.info("Dry run - no files were uploaded"))
            Attempt.Right(())
          } else {
            val checkpointEnabled = !ingestArgs.noCheckpointing()
            val checkpoint = new IngestionCheckpoint(ingestArgs.ingestionUri(), enabled = checkpointEnabled)
            val previouslyUploaded = checkpoint.load()

            if (!checkpointEnabled) {
              logger.info(ConsoleColors.dim("Checkpointing disabled — all files will be uploaded"))
            }

            val source = IngestionSource(options)
            val credentials = AwsCredentials(ingestArgs.minioAccessKey.toOption, ingestArgs.minioSecretKey.toOption, ingestArgs.awsProfile.toOption)

            val ingestionS3Client = new DefaultIngestionS3Client(options.ingestCmd, credentials)

            if (previouslyUploaded.nonEmpty) {
              logger.info(ConsoleColors.info(
                s"Resuming: ${previouslyUploaded.size} files already uploaded, ${scanResult.fileCount - previouslyUploaded.size} remaining"
              ))
              checkpoint.validateAgainstS3(ingestionS3Client.s3, ingestArgs.ingestionBucket())
            }

            checkpoint.start()

            val command = new RunIngestion(services.ingestion, ingestionS3Client, services.veracrypt)
            val totalExpected = scanResult.fileCount - previouslyUploaded.size
            command.run(Uri(ingestArgs.ingestionUri()), source, options.ingestCmd.languages, checkpoint, totalExpected).map { case (successes, failures) =>
              if (failures > 0 && checkpointEnabled) {
                checkpoint.close()
                logger.info(ConsoleColors.dim(s"\nCheckpoint saved to ${checkpoint.checkpointPath}"))
                logger.info(ConsoleColors.dim(s"$failures files failed. Re-run the same command to retry failed files"))
              } else if (failures > 0) {
                logger.info(ConsoleColors.dim(s"\n$failures files failed (no checkpoint saved — checkpointing was disabled)"))
              } else {
                checkpoint.delete()
              }
              logger.info(ConsoleColors.dim("\nUse 'verify' to confirm all files were processed by the server"))
            }.recoverWith { case failure =>
              checkpoint.close()
              logger.info(ConsoleColors.dim(s"\nCheckpoint saved to ${checkpoint.checkpointPath}"))
              logger.info(ConsoleColors.dim("Re-run the same command to resume from where it stopped"))
              Attempt.Left(failure)
            }
          }
        }
      }

    case Some(_ @ options.createUsers) =>
      run("Create users", options.createUsers) { services =>
        services.users.createUsers(options.createUsers.usernames()).map { newUsers =>
          newUsers.foreach { user =>
            logger.info(s"username: ${user.username}\tpassword: ${user.password}")
          }
          logger.info(ConsoleColors.success(s"\n✓ Created ${newUsers.size} user(s)"))
        }
      }

    case Some(_ @ options.deleteIngestions) =>
      run("Delete ingestions", options.deleteIngestions) { services =>
        val uris = options.deleteIngestions.ingestionUrisOpt()
        CommandValidator.validateDeleteIngestion(uris).flatMap { _ =>
          val ingestionPairs = options.deleteIngestions.ingestionUris

          // Preview: show file counts for each ingestion
          logger.info("")
          val countAttempts = ingestionPairs.map { case (collection, ingestion) =>
            services.ingestion.countBlobs(collection, ingestion).map(count => (collection, ingestion, count))
          }
          val ingestionsWithCounts = Attempt.sequence(countAttempts).await()
          val totalFiles = ingestionsWithCounts.map(_._3).sum

          ingestionsWithCounts.foreach { case (collection, ingestion, count) =>
            logger.info(s"   └─ $collection/$ingestion  [$count file(s)]")
          }
          logger.info(ConsoleColors.dim(s"\n   ${ingestionPairs.size} ingestion(s), $totalFiles file(s) total"))
          logger.info("")

          if (!options.deleteIngestions.force() && !UserPrompt.confirm(
            s"Delete ${ingestionPairs.size} ingestion(s) and all $totalFiles file(s)?"
          )) {
            logger.info(ConsoleColors.dim("Cancelled"))
            Attempt.Right(())
          } else {
            val command = new DeleteIngestions(ingestionPairs, services.ingestion, options.deleteIngestions.conflictBehaviour)
            command.run()
          }
        }
      }

    case Some(_ @ options.deleteBlobsCmd) =>
      run("Delete blobs", options.deleteBlobsCmd) { services =>
        val uri = options.deleteBlobsCmd.ingestionUri()
        val pathPrefix = options.deleteBlobsCmd.pathPrefix()

        CommandValidator.validateIngestionUri(uri).flatMap { _ =>
          val parts = uri.split("/")
          val collection = parts(0)
          val ingestion = parts(1)

          // Preview: count matching blobs
          val preview = services.ingestion.getBlobsByPrefix(collection, ingestion, pathPrefix, size = 1).await()
          val totalInIngestion = services.ingestion.countBlobs(collection, ingestion).await()

          logger.info(s"\n   Ingestion $uri has $totalInIngestion file(s) total")
          if (preview.pathConflicts.nonEmpty) {
            logger.info(ConsoleColors.warning(s"   ⚠ Some matching files also exist at other paths in this ingestion"))
          }
          logger.info("")

          if (!options.deleteBlobsCmd.force() && !UserPrompt.confirm(
            s"Delete blobs matching prefix '$pathPrefix' in $uri?"
          )) {
            logger.info(ConsoleColors.dim("Cancelled"))
            Attempt.Right(())
          } else {
            val command = new DeleteBlobs(collection, ingestion, pathPrefix, services.ingestion, options.deleteBlobsCmd.conflictBehaviour)
            command.run()
          }
        }
      }

    case Some(_ @ options.deleteCollectionCmd) =>
      run("Delete collection", options.deleteCollectionCmd) { services =>
        val collectionName = options.deleteCollectionCmd.collection()

        services.ingestion.listCollections().flatMap { collections =>
          collections.find(_.uri == collectionName) match {
            case None =>
              logger.info(ConsoleColors.warning(s"Collection '$collectionName' not found"))
              logger.info(ConsoleColors.dim("Use 'list' to see all available collections"))
              Attempt.Right(())

            case Some(collection) =>
              // Show preview — same as show-collection
              logger.info(ConsoleColors.bold(s"\n📁 ${collection.uri}"))
              if (collection.ingestions.isEmpty) {
                logger.info(ConsoleColors.dim("   (no ingestions)"))
              } else {
                val countAttempts = collection.ingestions.map { ingestion =>
                  services.ingestion.countBlobs(collectionName, ingestion.uri).map(count => (ingestion, count))
                }
                val ingestionsWithCounts = Attempt.sequence(countAttempts).await()
                val totalFiles = ingestionsWithCounts.map(_._2).sum
                logger.info(s"   ${collection.ingestions.size} ingestion(s), $totalFiles file(s) total\n")
                ingestionsWithCounts.sortBy(_._1.uri.toLowerCase(Locale.UK)).foreach { case (ingestion, count) =>
                  val pathInfo = ingestion.path.map(p => ConsoleColors.dim(s" ← $p")).getOrElse("")
                  logger.info(s"   └─ ${ingestion.uri}  [$count file(s)]$pathInfo")
                }
              }
              logger.info("")

              if (!options.deleteCollectionCmd.force() && !UserPrompt.confirm(
                s"Delete collection '${collection.uri}' and ALL its ingestions and files?"
              )) {
                logger.info(ConsoleColors.dim("Cancelled"))
                Attempt.Right(())
              } else {
                val ingestionPairs = collection.ingestions.map(i => (collectionName, i.uri))
                if (ingestionPairs.nonEmpty) {
                  val command = new DeleteIngestions(ingestionPairs, services.ingestion, options.deleteCollectionCmd.conflictBehaviour)
                  command.run().flatMap { _ =>
                    services.ingestion.deleteCollection(collectionName).map { _ =>
                      logger.info(ConsoleColors.success(s"✓ Collection '$collectionName' deleted"))
                    }
                  }
                } else {
                  services.ingestion.deleteCollection(collectionName).map { _ =>
                    logger.info(ConsoleColors.success(s"✓ Empty collection '$collectionName' deleted"))
                  }
                }
              }
          }
        }
      }

    case Some(_ @ options.createIngestion) =>
      run("Create ingestion", options.createIngestion) { services =>
        val uri = options.createIngestion.ingestionUri()
        CommandValidator.validateCreateIngestion(uri).flatMap { _ =>
          val Array(collection, ingestionName) = uri.split('/')

          services.ingestion.createCollection(collection).flatMap { _ =>
            services.ingestion.createIngestion(collection, root = None, ingestionName, options.createIngestion.languages, fixed = false).map { response =>
              logger.info(ConsoleColors.success(s"✓ Created ingestion: $uri"))
              logger.info(ConsoleColors.dim(s"  Collection: $collection"))
              logger.info(ConsoleColors.dim(s"  Ingestion:  $ingestionName"))
              logger.info(ConsoleColors.dim(s"\nUpload files with: pfi-cli ingest --ingestionUri $uri --path <source-directory>"))
            }
          }
        }
      }

    case _ =>
      options.printHelp()
  }

  private def run[T](action: String, options: CommonOptions)(fn: CliServices => Attempt[T]): Unit = {
    val result = fn(CliServices(options))

    Await.result(result.fold(
      failure => {
        val formattedError = ErrorFormatter.format(failure, action, options.verbose())
        logger.error(formattedError)
        
        if (options.verbose()) {
          logger.error(ConsoleColors.dim("\nStack trace:"))
          failure.toThrowable.printStackTrace()
        }
        System.exit(1)
      },
      success => {
        System.exit(0)
      }
    ), Duration.Inf)
  }
}
