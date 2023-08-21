package test

import services.observability.{BlobMetaData, BlobStatus, IngestionEvent, PostgresClient}
import utils.attempt.Failure

class TestPostgresClient extends PostgresClient{
  override def insertEvent(event: IngestionEvent): Either[Failure, Unit] = Right(())

  override def insertMetaData(metaData: BlobMetaData): Either[Failure, Unit] = Right(())

  def getEvents (ingestId: String, ingestIdIsPrefix: Boolean): Either[Failure, List[BlobStatus]] = Right(List())
}
