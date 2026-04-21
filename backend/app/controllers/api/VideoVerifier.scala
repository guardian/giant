package controllers.api


import software.amazon.awssdk.services.s3.presigner.S3Presigner
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest
import software.amazon.awssdk.services.s3.model.GetObjectRequest
import software.amazon.awssdk.regions.Region
import play.api.libs.json._
import play.api.mvc.Action
import utils.attempt.Attempt
import utils.controller.{AuthApiController, AuthControllerComponents}
import utils.{AwsCredentials, Logging}

import java.time.Duration

case class InputItem(
  bucket: String,
  key: String,
  ageRangeMin: Int,
  ageRangeMax: Int,
)

class VideoVerifier(override val controllerComponents: AuthControllerComponents)
  extends AuthApiController with Logging {

  private implicit val format: Format[InputItem] = Json.format[InputItem]

  def fetchVideosToVerify(): Action[List[InputItem]] = ApiAction.attempt(parse.json[List[InputItem]]) { req =>
    Attempt.Right(
      Ok(
        Json.toJson(
          req.body.map {
            case InputItem(bucket, key, _, _) => {
              val presigner = S3Presigner.builder()
                .region(Region.of("us-east-1"))
                .credentialsProvider(AwsCredentials.credentialsV2())
                .build()

              val getObjectRequest = GetObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build()

              val presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofHours(1))
                .getObjectRequest(getObjectRequest)
                .build()

              val presignedRequest = presigner.presignGetObject(presignRequest)
              s"$bucket/$key" -> presignedRequest.url().toString
            }
          }.toMap
        )
      ).withHeaders("X-UserEmail" -> req.user.username)
    )

  }
}
