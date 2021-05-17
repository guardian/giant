package com.gu.pfi.cli

import java.nio.file.{Path, Paths}
import java.util.concurrent.Executors

import _root_.model.{CreateIngestionResponse, Language, Uri}
import com.amazonaws.auth.AWSCredentialsProvider
import com.gu.pfi.cli.ingestion._
import com.gu.pfi.cli.service.{CliIngestionService, CliVeracrypt, DefaultIngestionS3Client, IngestionS3Client}
import utils.AwsS3Clients
import utils.attempt._

import scala.concurrent.ExecutionContext

class RunIngestion(ingestions: CliIngestionService, ingestionS3Client: IngestionS3Client, veracrypt: CliVeracrypt) {
  private val batchSize = 100
  private val chunkSize = 1048576
  private val inMemoryThreshold = 5242880

  // TODO MRB: set throughput to 1?
  private val ingestionContext = ExecutionContext.fromExecutorService(Executors.newFixedThreadPool(10))
  private implicit val defaultContext: ExecutionContext = scala.concurrent.ExecutionContext.global

  def run(ingestionUri: Uri, source: IngestionSource, languages: List[Language]): Attempt[Unit] = for {
    rootPath <- mountSource(source)
    _ <- runPipeline(rootPath, ingestionUri, languages)
    _ <- dismountSource(source, rootPath)
  } yield {
    ()
  }

  // We return absolute paths here as the ingestion pipeline use string manipulation to work out parent paths
  private def mountSource(source: IngestionSource): Attempt[Path] = source match {
    case FilesystemSource(root) =>
      Attempt.Right(root.toAbsolutePath)

    case EncryptedVolumeSource(volume, password, truecrypt) =>
      veracrypt.mount(volume, password, truecrypt).map(_.toAbsolutePath)
  }

  private def dismountSource(source: IngestionSource, mountpoint: Path): Attempt[Unit] = source match {
    case FilesystemSource(_) =>
      // Nowt to do here
      Attempt.Right(())

    case EncryptedVolumeSource(volume, _, _) =>
      veracrypt.dismount(volume, mountpoint)
  }

  private def runPipeline(root: Path, ingestionUri: Uri, languages: List[Language]): Attempt[Unit] = {
    val pipeline = new CliIngestionPipeline(ingestions, ingestionS3Client, batchSize, inMemoryThreshold, ingestionContext, defaultContext)
    val result = pipeline.crawlFromFile(root, ingestionUri, languages)

    Attempt.fromFutureBlasé(result)
  }
}
