package test

import services.observability.{BlobMetaData, IngestionEvent, PostgresClient}
import utils.attempt.Failure

class TestPostgresClient extends PostgresClient{
  override def insertEvent(event: IngestionEvent): Either[Failure, Unit] = Right(())

  override def insertMetaData(metaData: BlobMetaData): Either[Failure, Unit] = Right(())
}
