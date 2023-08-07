package utils.auth

import org.apache.pekko.util.Timeout
import org.joda.time.DateTime
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers
import org.scalatest.{EitherValues, Inside}
import org.scalatestplus.play.{BaseOneAppPerSuite, FakeApplicationFactory}
import pdi.jwt.JwtSession
import play.api.http.HeaderNames
import play.api.libs.json.Json
import play.api.mvc.{AnyContentAsEmpty, Result, Results}
import play.api.test.{FakeHeaders, FakeRequest, Helpers}
import play.api.{Application, ApplicationLoader, Configuration, Environment}
import test.{EmptyAppLoader, TestUserManagement}
import utils.attempt._
import utils.controller.DefaultFailureToResultMapper

import java.io.File
import java.time.Clock
import scala.concurrent.Future
import scala.concurrent.duration._
import scala.language.postfixOps

class AuthActionBuilderTest extends AnyFreeSpec with Matchers with BaseOneAppPerSuite with FakeApplicationFactory
  with EitherValues with Results with Inside {

  import TestUserManagement._

  override def fakeApplication(): Application = {
    val env = Environment.simple(new File("."))
    val initialSettings: Map[String, AnyRef] = Map(
      "play.http.secret.key" -> "TestKey",
      "play.http.session.maxAge" -> Int.box(900000),
      "pekko.actor.provider" -> "local"
    )

    val context = ApplicationLoader.Context.create(env, initialSettings)
    val loader = new EmptyAppLoader()

    loader.load(context)
  }

  // To appease jwt-scala
  implicit val configuration: Configuration = fakeApplication().configuration
  implicit val clock: Clock = Clock.systemUTC()

  val fakeUsers = TestUserManagement(List(user("mickey")))

  "AuthActionBuilder" - {
    val authActionBuilder = new DefaultAuthActionBuilder(Helpers.stubControllerComponents(), new DefaultFailureToResultMapper, 8 hours, 15 minutes, fakeUsers)(fakeApplication().configuration, Clock.systemUTC())
    val userMickey = User("mickey", "Mickey Mouse")
    val now = new DateTime(2017, 1, 5, 16, 0, 0)

    "invokeBlockWithTime" - {
      def makeRequest(encodedToken: Option[String]): FakeRequest[AnyContentAsEmpty.type] = {
        FakeRequest(
          method = "GET",
          uri = "/",
          headers = FakeHeaders(Seq(
            HeaderNames.HOST -> "localhost"
          ) ++ encodedToken.map(t => HeaderNames.AUTHORIZATION -> s"Bearer $t")),
          body = AnyContentAsEmpty
        )
      }

      def requestFromToken(token: Token): FakeRequest[AnyContentAsEmpty.type] = {
        val sessionToken: JwtSession =
          JwtSession(jsClaim = Json.obj(
            "exp" -> token.exp,
            Token.ISSUED_AT_KEY -> Json.toJson(token.issuedAt),
            Token.REFRESHED_AT_KEY -> Json.toJson(token.issuedAt),
            Token.USER_KEY -> Json.toJson(token.user),
            Token.LOGIN_EXPIRY_KEY -> token.loginExpiry,
            Token.VERIFICATION_EXPIRY_KEY -> token.verificationExpiry
          ))
        makeRequest(Some(sessionToken.serialize))
      }

      def tokenFromResult(result: Result): Token = {
        val header = result.header.headers(JwtSession.RESPONSE_HEADER_NAME)
        val trimmedHeader = if (header.startsWith(JwtSession.TOKEN_PREFIX)) {
          header.substring(JwtSession.TOKEN_PREFIX.length()).trim
        } else {
          header.trim
        }
        val claimData = JwtSession.deserialize(trimmedHeader).claimData
        claimData.as[Token]
      }

      val block: (UserIdentityRequest[AnyContentAsEmpty.type]) => Future[Result] = { req =>
        Future.successful(Ok(s"Hi ${req.user.displayName}"))
      }

      implicit val timeout = Timeout(5 seconds)

      "should return an error when no authorization header is present" in {
        val request = makeRequest(None)
        val futureResult = authActionBuilder.invokeBlockWithTime(request, block, now.getMillis)
        val result = Helpers.await(futureResult)
        result.left.value should matchPattern {
          case _: HiddenFailure =>
        }
        inside (result.left.value) {
          case uf: HiddenFailure =>
            uf.actualMessage should startWith ("Failed to parse token: ")
        }
      }

      "should return an error if the token is too old" in {
        val token = Token(
          user = userMickey,
          issuedAt = now.minusMinutes(30).getMillis,
          refreshedAt = now.minusMinutes(30).getMillis,
          exp = now.plusMinutes(30).getMillis,
          loginExpiry = now.getMillis, // This will be expired
          verificationExpiry = now.plusMinutes(30).getMillis
        )
        val request = requestFromToken(token)
        val futureResult = authActionBuilder.invokeBlockWithTime(request, block, now.plusMinutes(10).getMillis)
        val result = Helpers.await(futureResult)
        result.left.value shouldBe AuthenticationFailure("Token is older than 8 hours", None, false)
      }

      "should return an error if the user is no longer in the database and the verification has expired" in {
        val authActionBuilderWithEmptyUserDb =
          new DefaultAuthActionBuilder(Helpers.stubControllerComponents(), new DefaultFailureToResultMapper, 8 hours, 15 minutes, TestUserManagement(Nil))

        val token = Token(
          user = userMickey,
          issuedAt = now.minusMinutes(30).getMillis,
          refreshedAt = now.minusMinutes(30).getMillis,
          exp = now.plusMinutes(30).getMillis,
          loginExpiry = now.plusMinutes(30).getMillis,
          verificationExpiry = now.getMillis // This will be expired
        )
        val request = requestFromToken(token)
        val futureResult = authActionBuilderWithEmptyUserDb.
          invokeBlockWithTime(request, block, now.plusMinutes(10).getMillis)
        val result = Helpers.await(futureResult)
        result.left.value shouldBe UserDoesNotExistFailure("mickey")
      }

      "should refresh the token verification if it has expired and the user is in the database" in {
        val token = Token(
          user = userMickey,
          issuedAt = now.minusMinutes(30).getMillis,
          refreshedAt = now.minusMinutes(30).getMillis,
          exp = now.plusMinutes(30).getMillis,
          loginExpiry = now.plusMinutes(30).getMillis,
          verificationExpiry = now.getMillis // This will be expired
        )
        val request = requestFromToken(token)
        val requestTime = now.plusMinutes(10)
        val futureResult = authActionBuilder.invokeBlockWithTime(request, block, requestTime.getMillis)
        val resultEither = Helpers.await(futureResult)
        val result = resultEither.toOption.get

        val newToken = tokenFromResult(result)
        newToken.user shouldBe token.user
        newToken.verificationExpiry shouldBe requestTime.plusMinutes(15).getMillis
        newToken.refreshedAt shouldBe requestTime.getMillis
      }

      "should refresh the token expiry" in {
        val token = Token(
          user = userMickey,
          issuedAt = now.minusMinutes(30).getMillis,
          refreshedAt = now.minusMinutes(30).getMillis,
          exp = now.getMillis, // This will be expired
          loginExpiry = now.plusMinutes(30).getMillis,
          verificationExpiry = now.plusMinutes(30).getMillis
        )
        val request = requestFromToken(token)
        val requestTime = now.plusMinutes(10)
        val futureResult = authActionBuilder.invokeBlockWithTime(request, block, requestTime.getMillis)
        val resultEither = Helpers.await(futureResult)
        val result = resultEither.toOption.get

        val newToken = tokenFromResult(result)
        newToken.user shouldBe token.user
        newToken.verificationExpiry shouldBe token.verificationExpiry
        newToken.loginExpiry shouldBe token.loginExpiry
        newToken.exp shouldBe ((System.currentTimeMillis() + 900000) / 1000 +- 10)
        newToken.refreshedAt shouldBe requestTime.getMillis
      }

      "should return an error if the user is not registered" in {
        val authActionBuilderWithInvalidatedUser = builderWithUser(
          invalidationTime = Some(now.minusMinutes(10).getMillis),
          registered = false
        )

        val token = Token(
          user = userMickey,
          issuedAt = now.minusMinutes(30).getMillis,
          refreshedAt = now.minusMinutes(30).getMillis,
          exp = now.plusMinutes(30).getMillis,
          loginExpiry = now.plusMinutes(30).getMillis,
          verificationExpiry = now.getMillis // This will be expired
        )

        val request = requestFromToken(token)
        val futureResult = authActionBuilderWithInvalidatedUser.
          invokeBlockWithTime(request, block, now.getMillis)
        val result = Helpers.await(futureResult)
        result.left.value shouldBe an [AuthenticationFailure]
      }

      "should return an error if the token is older than invalidatedTime and the verification has expired" in {
        val authActionBuilderWithInvalidatedUser = builderWithUser(
          invalidationTime = Some(now.minusMinutes(10).getMillis)
        )

        val token = Token(
          user = userMickey,
          issuedAt = now.minusMinutes(30).getMillis, // this token was issued 30 minutes ago
          refreshedAt = now.minusMinutes(30).getMillis,
          exp = now.plusMinutes(30).getMillis,
          loginExpiry = now.plusMinutes(30).getMillis,
          verificationExpiry = now.getMillis // This will be expired
        )
        val request = requestFromToken(token)
        val futureResult = authActionBuilderWithInvalidatedUser.
          invokeBlockWithTime(request, block, now.getMillis)
        val result = Helpers.await(futureResult)
        result.left.value shouldBe an [AuthenticationFailure]
      }

      "should be permitted if the token is newer than invalidatedTime and the verification has expired" in {
        // a user that has an invalidation time of 10 minutes ago
        val authActionBuilderWithInvalidatedUser = builderWithUser(
          invalidationTime = Some(now.minusMinutes(10).getMillis)
        )

        val token = Token(
          user = userMickey,
          issuedAt = now.minusMinutes(5).getMillis, // this token was issued 5 minutes ago, later than the invalidation
          refreshedAt = now.minusMinutes(5).getMillis,
          exp = now.plusMinutes(30).getMillis,
          loginExpiry = now.plusMinutes(30).getMillis,
          verificationExpiry = now.getMillis // This will be expired
        )
        val request = requestFromToken(token)
        val futureResult = authActionBuilderWithInvalidatedUser.
          invokeBlockWithTime(request, block, now.getMillis)
        val resultOrFailure = Helpers.await(futureResult)
        val result = resultOrFailure.toOption.get
        result.header.status shouldBe 200
      }
    }

  }

  private def builderWithUser(invalidationTime: Option[Long] = None, registered: Boolean = true): DefaultAuthActionBuilder = {
    val baseUser = user("mickey")

    new DefaultAuthActionBuilder(Helpers.stubControllerComponents(), new DefaultFailureToResultMapper, 8 hours, 15 minutes,
      TestUserManagement(List(baseUser.copy(
        dbUser = baseUser.dbUser.copy(
          invalidationTime = invalidationTime,
          registered = registered
        )
      )))
    )
  }
}
