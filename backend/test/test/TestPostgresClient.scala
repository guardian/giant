package test

import services.observability.{BlobMetadata, BlobStatus, IngestionEvent, PostgresClient}
import utils.attempt.Failure

class TestPostgresClient extends PostgresClient{
  override def insertEvent(event: IngestionEvent): Either[Failure, Unit] = Right(())

  override def insertMetadata(metaData: BlobMetadata): Either[Failure, Unit] = Right(())

  def getEvents (ingestId: String, ingestIdIsPrefix: Boolean): Either[Failure, List[BlobStatus]] = Right(List())

  override def cleanOldEvents(): Either[Failure, Long] = Right(0)

  override def cleanOldBlobMetadata(): Either[Failure, Long] = Right(0)
}
