package utils

import cats.syntax.either._
import play.api.libs.json.JsResult

package object attempt {

  implicit class RichOption[A](option: Option[A]) {
    def toAttempt(whenNone: => Attempt[A]): Attempt[A] = Attempt.fromOption(option, whenNone)
  }

  implicit class RichFailureEither[A](either: Either[Failure,A]) {
    def toAttempt = Attempt.fromEither(either)
  }

  implicit class RichEither[Left,A](either: Either[Left,A]) {
    def toAttempt(leftToFailure: Left => Failure) = Attempt.fromEither(either.leftMap(leftToFailure))
  }

  implicit class RichJsResult[A](jsResult: JsResult[A]) {
    def toAttempt = jsResult.asEither.toAttempt(jsonError => JsonParseFailure(jsonError))
  }


}
