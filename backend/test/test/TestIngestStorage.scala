package test

import java.io.InputStream
import java.nio.file.Path
import model.ObjectMetadata
import model.ingestion.{FileContext, Key}
import services.IngestStorage
import utils.attempt.{Failure, UnsupportedOperationFailure}

class TestIngestStorage extends IngestStorage {

  override def list: Either[Failure, Iterable[Key]] =
  Left(UnsupportedOperationFailure("list not supported in test"))

  override def getData(key: Key): Either[Failure, InputStream] =
    Left(UnsupportedOperationFailure("getData not supported in test"))

  override def getMetadata(key: Key): Either[Failure, FileContext] =
    Left(UnsupportedOperationFailure("getMetadata not supported in test"))

  override def delete(key: Key): Either[Failure, Unit] =
    Left(UnsupportedOperationFailure("delete not supported in test"))

  override def sendToDeadLetterBucket(key: Key): Either[Failure, Unit] =
    Left(UnsupportedOperationFailure("sendToDeadLetterBucket not supported in test"))

  override def retryDeadLetters(): Either[Failure, Unit] =
    Left(UnsupportedOperationFailure("retryDeadLetters not supported in test"))

  override def getUploadSignedUrl(key: String): Either[Failure, String] =
    Left(UnsupportedOperationFailure("getUploadSignedUrl not supported in test"))
}
