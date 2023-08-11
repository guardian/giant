package test

import services.observability.{IngestionEvent, PostgresClient}
import utils.attempt.Failure

class TestPostgresClient extends PostgresClient{
  override def insertRow(event: IngestionEvent): Either[Failure, Unit] = Right(())
}
