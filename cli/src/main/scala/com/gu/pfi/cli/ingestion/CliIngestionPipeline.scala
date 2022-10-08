package com.gu.pfi.cli.ingestion

import java.nio.file.{Files, LinkOption, Path}
import java.util.UUID

import com.google.common.io.ByteStreams
import com.gu.pfi.cli.service.{CliIngestionService, IngestionS3Client}
import model._
import model.ingestion.{IngestionFile, Key, OnDiskFileContext}
import utils.{Logging, attempt}
import utils.attempt.Attempt
import utils.attempt.AttemptAwait._

import scala.concurrent.duration.Duration
import scala.concurrent.{Await, ExecutionContext, Future}

class CliIngestionPipeline(ingestionService: CliIngestionService, s3Client: IngestionS3Client,
                           batchSize: Int, inMemoryThreshold: Long,
                           ingestionContext: ExecutionContext, nonBlockingContext: ExecutionContext) extends Logging {

  def crawlFromFile(rootPath: Path, rootUri: Uri, languages: List[Language]): Future[Unit] = {
    crawlIterator(filesIterator(rootPath, rootUri, languages), rootUri, languages)
  }

  def crawlIterator(files: Iterator[OnDiskFileContext], rootUri: Uri, languages: List[Language]): Future[Unit] = {
    ingest(files, rootUri, inMemoryThreshold, languages)
  }

  private def ingest(files: Iterator[OnDiskFileContext], rootUri: Uri, inMemorySize: Long, languages: List[Language]): Future[Unit] = {
    implicit val ec: ExecutionContext = nonBlockingContext // this is the default context for when we are not doing IO
    logger.info(s"Copying... $rootUri")

    // this lock is used to prevent interleaved reads
    val ioLock = new Object()

    trait Input {
      def fileContext: OnDiskFileContext
      def key: Key
    }
    case class SmallInput(fileContext: OnDiskFileContext, key: Key, bytes: Array[Byte]) extends Input
    case class BigInput(fileContext: OnDiskFileContext, key: Key) extends Input

    object Input {
      def apply(file: OnDiskFileContext, key: Key): Input = {
        logger.info(s"Phase I ingesting ${file.path} (${file.size}) as $key")
        if (file.size <= inMemorySize) {
          val dataStream = Files.newInputStream(file.path)
          val bytes = try {
            ioLock.synchronized {
              val buf = new Array[Byte](file.size.toInt)
              ByteStreams.readFully(dataStream, buf)
              buf
            }
          } finally {
            dataStream.close()
          }
          SmallInput(file, key, bytes)
        } else {
          BigInput(file, key)
        }
      }
    }

    def putInput(input: Input, ingestion: String, languages: List[Language]): Attempt[Unit] = {
      val f = () => {
        input match {
          case SmallInput(context, key, data) =>
            s3Client.putData(key, data, context.size)
          case BigInput(context, key) =>
            s3Client.putFileData(key, context.path, context.size)
        }

        s3Client.putMetadata(input.key, input.fileContext, ingestion, languages)
        ()
      }

      input match {
        case _: SmallInput => Attempt.async.catchNonFatalBlasé(f())(ingestionContext)
        case _: BigInput => Attempt.catchNonFatalBlasé(ioLock.synchronized(f()))
      }
    }

    def processFile(file: OnDiskFileContext, languages: List[Language]): Attempt[(OnDiskFileContext, Key)] = {
      // TODO-SAH: add to checkpoint list

      // generate key
      val key = System.currentTimeMillis -> UUID.randomUUID

      // create 'input'
      val attemptInput = Attempt.async.catchNonFatalBlasé {
        Input(file, key)
      }(ingestionContext)

      // upload file
      for {
        input <- attemptInput
        uploadResult <- putInput(input, file.ingestion, languages)
      } yield {
        // TODO-SAH: remove from checkpoint list

        (file, key)
      }
    }

    val finalAttempt = files.filter(_.isRegularFile).map { file =>
      file -> processFile(file, languages)
    }.grouped(batchSize).foldLeft(Attempt.Right(0 -> 0)) { (accAttempt, fileToAttemptedResults) =>
      val (files, attemptedResults) = fileToAttemptedResults.unzip
      val batchSizeAttempt = Attempt.sequenceWithFailures(attemptedResults.toList)
        .map{ r => files.zip(r) }
        .map{ results =>
          val files: Seq[(OnDiskFileContext, Key)] = results.collect{ case (_, Right(value)) => value }
          val summaryData = files.map { case (fileContext, (_, _)) =>
            (fileContext.path.toString, fileContext.size)
          }

          val failures: Seq[(OnDiskFileContext, attempt.Failure)] = results.collect{ case (file, Left(failure)) => file -> failure }
          failures.foreach { case (file, failure) =>
            logger.error(s"Error during Phase I ingestion for ${file.path}: $failure", failure.cause.orNull)
            failure.cause.foreach(_.printStackTrace())
          }

          logger.info(s"Phase I of $rootUri batch completed. Successful: ${summaryData.size} Failures: $failures.")
          summaryData.size -> failures.size
        }

      val syncBatchSizeAttempt = Attempt.fromEither(Await.result(batchSizeAttempt.asFuture, Duration.Inf))

      for {
        acc <- accAttempt
        batchSize <- syncBatchSizeAttempt
      } yield (acc._1 + batchSize._1) -> (acc._2 + batchSize._2)
    }

    finalAttempt.fold(
      _ => (),
      { case (successes, failures) =>
        logger.info(s"Phase I of $rootUri done! Successful: $successes Failures: $failures.")
      }
    )(nonBlockingContext)
  }

  private def filesIterator(rootPath: Path, rootUri: Uri, languages: List[Language]): Iterator[OnDiskFileContext] = {
    val walker = new CliFileWalker(path =>
      CliIngestionPipeline.makeRelativeFile(path, rootPath, rootUri, Files.readAttributes(path, "*", LinkOption.NOFOLLOW_LINKS))
    )
    walker.walk(rootPath, rootUri, languages).toIterator
  }
}

object CliIngestionPipeline {
  def makeRelativeFile(path: Path, rootPath: Path, rootUri: Uri, attr: java.util.Map[String, AnyRef], temporary: Boolean = false): IngestionFile = {
    IngestionFile(path,
      uri = Uri.relativizeFromFilePaths(rootUri, rootPath, path),
      parentUri = if (rootPath == path) rootUri else Uri.relativizeFromFilePaths(rootUri, rootPath, path.getParent),
      attr = attr,
      temporary = temporary)
  }
}
