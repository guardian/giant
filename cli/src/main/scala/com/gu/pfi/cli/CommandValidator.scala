package com.gu.pfi.cli

import java.io.File
import java.nio.file.{Files, Path, Paths}

import utils.attempt.{Attempt, Failure, IllegalStateFailure}

/**
 * Validates command options before execution to catch common errors early
 */
object CommandValidator {
  
  /**
   * Validates ingestion command options
   */
  def validateIngestCommand(
    ingestionUri: String,
    path: String,
    bucket: String
  ): Attempt[Unit] = {
    validateIngestionUri(ingestionUri).value match {
      case Some(scala.Left(failure)) => Attempt.Left(failure)
      case _ => validatePath(path, mustExist = true, mustBeReadable = true).value match {
        case Some(scala.Left(failure)) => Attempt.Left(failure)
        case _ => validateBucketName(bucket)
      }
    }
  }
  
  /**
   * Validates create-ingestion command options
   */
  def validateCreateIngestion(ingestionUri: String): Attempt[Unit] = {
    validateIngestionUri(ingestionUri)
  }
  
  /**
   * Validates delete-ingestion command options
   */
  def validateDeleteIngestion(ingestionUris: List[String]): Attempt[Unit] = {
    if (ingestionUris.isEmpty) {
      Attempt.Left(IllegalStateFailure("At least one ingestion URI must be provided"))
    } else {
      // Validate each URI, stopping at first error
      var error: Option[Failure] = None
      for (uri <- ingestionUris if error.isEmpty) {
        validateIngestionUri(uri).value match {
          case Some(scala.Left(failure)) => error = Some(failure)
          case _ => // continue
        }
      }
      error match {
        case Some(failure) => Attempt.Left(failure)
        case None => Attempt.Right(())
      }
    }
  }
  
  /**
   * Validates verify command options
   */
  def validateVerifyCommand(ingestionUri: String, alternatePath: Option[Path]): Attempt[Unit] = {
    validateIngestionUri(ingestionUri).value match {
      case Some(scala.Left(failure)) => Attempt.Left(failure)
      case _ =>
        alternatePath match {
          case Some(p) => validatePath(p.toString, mustExist = true, mustBeReadable = true)
          case None => Attempt.Right(())
        }
    }
  }
  
  /**
   * Validates URI is accessible
   */
  def validateUri(uri: String): Attempt[Unit] = {
    if (uri.isEmpty) {
      Attempt.Left(IllegalStateFailure("URI cannot be empty"))
    } else if (!uri.startsWith("http://") && !uri.startsWith("https://")) {
      Attempt.Left(IllegalStateFailure(
        s"Invalid URI: '$uri'. Must start with http:// or https://"
      ))
    } else {
      Attempt.Right(())
    }
  }
  
  private def validateIngestionUri(uri: String): Attempt[Unit] = {
    if (uri.isEmpty) {
      Attempt.Left(IllegalStateFailure("Ingestion URI cannot be empty"))
    } else if (!uri.contains("/")) {
      Attempt.Left(IllegalStateFailure(
        s"Invalid ingestion URI: '$uri'. Must be in format: <collection>/<ingestion>"
      ))
    } else {
      val parts = uri.split("/")
      if (parts.length != 2) {
        Attempt.Left(IllegalStateFailure(
          s"Invalid ingestion URI: '$uri'. Must be in format: <collection>/<ingestion>"
        ))
      } else if (parts(0).isEmpty || parts(1).isEmpty) {
        Attempt.Left(IllegalStateFailure(
          s"Invalid ingestion URI: '$uri'. Collection and ingestion names cannot be empty"
        ))
      } else {
        Attempt.Right(())
      }
    }
  }
  
  private def validatePath(pathStr: String, mustExist: Boolean, mustBeReadable: Boolean): Attempt[Unit] = {
    val path = Paths.get(pathStr)
    
    if (mustExist && !Files.exists(path)) {
      Attempt.Left(IllegalStateFailure(
        s"Path does not exist: '$pathStr'"
      ))
    } else if (mustBeReadable && !Files.isReadable(path)) {
      Attempt.Left(IllegalStateFailure(
        s"Path is not readable: '$pathStr'. Check file permissions."
      ))
    } else {
      Attempt.Right(())
    }
  }
  
  private def validateBucketName(bucket: String): Attempt[Unit] = {
    if (bucket.isEmpty) {
      Attempt.Left(IllegalStateFailure("Bucket name cannot be empty"))
    } else if (bucket.contains(" ")) {
      Attempt.Left(IllegalStateFailure(
        s"Invalid bucket name: '$bucket'. Bucket names cannot contain spaces."
      ))
    } else {
      Attempt.Right(())
    }
  }
}
