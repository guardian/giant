package utils

import cats.data.EitherT

import scala.concurrent.{ExecutionContext, Future}

object EitherTHelper {
  implicit class RichEitherTFuture[A, B](eitherT: EitherT[Future, A, B]) {
    def recoverF(pf: PartialFunction[Throwable, Either[A, B]])(implicit executor: ExecutionContext): EitherT[Future, A, B] = {
      EitherT(eitherT.value.recover(pf))
    }
  }
}
