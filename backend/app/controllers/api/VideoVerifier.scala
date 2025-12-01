package controllers.api

import com.amazonaws.services.s3.AmazonS3ClientBuilder
import play.api.libs.json._
import utils.attempt.Attempt
import utils.controller.{AuthApiController, AuthControllerComponents}
import utils.{AwsCredentials, Logging}

import java.time.Instant
import java.time.temporal.ChronoUnit.HOURS
import java.util.Date

case class InputItem(
  bucket: String,
  key: String,
  ageRangeMin: Int,
  ageRangeMax: Int,
)

class VideoVerifier(override val controllerComponents: AuthControllerComponents)
  extends AuthApiController with Logging {

  private val s3 = AmazonS3ClientBuilder.standard()
    .withCredentials(AwsCredentials())
    .withRegion("eu-west-1")
    .build()

  private implicit val format: Format[InputItem] = Json.format[InputItem]

  def fetchVideosToVerify() = ApiAction.attempt(parse.json[List[InputItem]]) { req =>

    Attempt.Right(
      Ok(
        Json.toJson(
          req.body.map {
            case InputItem(bucket, key, _, _) =>
              s"$bucket/$key" -> s3.generatePresignedUrl(bucket, key, Date.from(Instant.now().plus(1, HOURS))).toString
          }.toMap
        )
      ).withHeaders("X-UserEmail" -> req.user.username)
    )

  }
}
