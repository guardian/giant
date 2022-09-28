package test

import java.io.InputStream
import java.nio.file.Path

import model.ObjectMetadata
import services.ObjectStorage
import utils.attempt.{Failure, UnsupportedOperationFailure}

class TestObjectStorage extends ObjectStorage {
  override def create(key: String, path: Path, mimeType: Option[String]): Either[Failure, Unit] = Right(())
  override def get(key: String): Either[Failure, InputStream] = Left(UnsupportedOperationFailure(""))
  override def getMetadata(key: String): Either[Failure, ObjectMetadata] = Left(UnsupportedOperationFailure(""))
  override def delete(key: String): Either[Failure, Unit] = Left(UnsupportedOperationFailure(""))
  override def list(prefix: String): Either[Failure, List[String]] = Left(UnsupportedOperationFailure(""))
}
