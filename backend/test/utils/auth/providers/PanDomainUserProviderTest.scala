package utils.auth.providers

import com.gu.pandomainauth.{PrivateKey, PublicKey}
import com.gu.pandomainauth.model.{AuthenticatedUser, User}
import com.gu.pandomainauth.service.CookieUtils
import model.frontend.user.PartialUser
import model.user.DBUser
import play.api.libs.json.JsString
import play.api.mvc.{Cookie, Results}
import play.api.test.FakeRequest
import services.{AwsConnection, NoOpMetricsService, PandaAuthConfig}
import test.{AttemptValues, TestUserManagement}
import utils.Epoch
import utils.attempt.{AuthenticationFailure, PanDomainCookieInvalid}

import scala.concurrent.ExecutionContext.Implicits.global
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

class PanDomainUserProviderTest extends AnyFreeSpec with Matchers with AttemptValues with Results  {

  val pandaPrivateKey=PrivateKey("MIIJKQIBAAKCAgEAlZTnNvbhe2Y2fQBuKmCbXzTtcUmNuTNYl+/ymr4E2wAHKGfq/xPSO6zHHthlTUncStFw2uursfgJjimfkV3Yl1VTQ8XFXMeZNtQ9d+qRuCTSp19FJ6Rwr+ai8Z5Zduc3IeklrpHcEqNNax/Kf0R3zQcSFF4/mJVijfYwgAqPI3hgWCwPw4RAV1tFMPAmiapyswUybvROwH3Y3aFKWMyhW0EPGcPD4/362rPenu2wth7aR+3ibGeCl2sohr8tGNAmCBgxw3EuTk438op7voSQzah4+Gsm59goFO3nBtjE532Qx1jkMf43dfjLHy8XlJJ9fk/4AsNPA1SsyY1w+fb4Wbq7GHNgH4w+f8Vb4jk/PHc+HQgtRzbsF/pCXep3bYXgeR9oAYRQYiRiQm8RVgN//xotRQCUw8UTNyCGooUIjAbvEqfuS3s46v7gfuqPXsp9x+aAI6dx0pmuJWe6gfylkGvJEcThIdt/Cu3W96YznWHykgCUdNg/bc9QjTYZ16ZRphbHcqzIQwnNGN1L+fCSnXBbLEyAV9HGWxANNAjuxddC7y01amuE283UdcGvrZR6pq6Sgu/Ib+d5zxK6yUWiranWCpI1rLzdaQuoD7a2F8PBXcYfZvpYI9cs76BcwDurA+9dPnxv8c6+T9xi03q4bX6caH0iZydeTMJA9NwTT1ECAwEAAQKCAgAdJ8bhecF9cfDQ8JKIhAgEyKY3XKTZIl70Tnq1GrCLlzfN8mNlkJF7vDObmYY1SF493xDmOuVebQA/y3EkvmwHI0R1g0jyypzciQXqJ7h7cgH1SaaLEYw9XPEJs1mwyWR/oZgMrLV+lIH0jV/E6q2HMwedHLm8nfF1xjSx4F0CBuaQiRYRf+ein1GfNk/sqWJt7mdkJQ5sipsIp/V71Xbl+Ipe9T9rYwfQNRsBU0cMWHsnZgCqLIrRxLtDeGPr4DZpgX3BoH/sF2bkSYXRHrmyvFHH6erNad52JeDP/tRyYpEjqfngnLJmtjWxQFaSSPNY+XFX6IWwGoMLThxlPHQvjOMxAApVcJP8S4Nfoh3xDIT6Tn4MGd7wJz6TFprKZEc+DKIzL1xo2nd+Ua3pncVMdTmDoCfr/WODGxH3zT3EGY1D91+0vxDmSF+fcjGiAdIrTDexXaiDZdfEmklCOZihinw9oHG6KtRcY35HS1XWIgA/eHmP1oNfSJLvfERFVtxC1I5joct2CjqDCfvzF4PsEPNYnOx+w+BWzyVrmPR7CWIhDn+E85dSXiURJRUlTIMGVwfSL2qMKFAGGCMcqT39J8dJI0hVlSe92UO1v6A6bshPtzejhcO4TclqIzIqnKs/Pdlkm2CVPTTWXczSp7qiWWqjeMKPLXe5mkEI+926uQKCAQEAw+Ytt69mtprdLSp+k+JHCORq4E9U7uB2INzfVEIoz9HL5RrBBONwIX7Sgg6g1ae7LYKBanee/5FKwpLAa7dnOdzz4WIJs43OpZ1CbBM+IdsIJd+1hScNpojsCAhL4ryOMPvgkY/QX5tRnhs1O5fU/OM6y+IueDijWcBXcz3OUF9e87f7UczE5PgrR6gPKNk5mUDJfYguRmys4mvCje8imt7UZWG0LKGfzUq3aw/7IKiFbywEYNopuxTq4TxbOgyHnPWGZ9U+J7LliMRlV9Cr9cbo8hI6vaoPlbk62AAR/dXatT1v6TDkg2F/t6mrujvv56hjqYnIfafZnWA/9fW9QwKCAQEAw3j47/hHGvOUfvLCVBYmzVfBZbScTvVtN/lZIIgOf+on62Bf2agub74bDMpeDGYHWdlxGv4oZIU9euj2rS+b20W286+lfK7kNY1PdM26s9rhdALg5mmw5uWvpyoBIvORQgVDi0TrvwPsx2c2QmyeHLSRG+fG/q9B0qDDLzRX/i0VYSmD7/FvhTdsO1ttqB6k3/kMBtxaHZXUL4zJVNbqQ00/1+NazDWP+71Xr9bXahMVs/51b187ahNl0DtwFRKiL+Y6w9vnzJJ2/FhIOYAsnbSVn9abb1Fo1lwuDonbMjY9cjm7AADfkNJ16Ev24bAdJxszX4UPsSZV7NTHE+oN2wKCAQEAp8MrS67OS3r8Bn3pwEN7icXzMP0/QwK+pw3/w2yU/sQv1JfAzKrpkAXHyNE2M0JdLXAh3EdsxnhqiY6bcqOxpv/tawpGPJooafPuuhcQknW82JJoJQt4yTFg0NAqDJZlPtW1T3LVg8rDbp7mS46PO7Js28Vq/lGism3hdjNrx7Ck5BqfA0JVK7DLf6YQtW6xwOiWpQZGetD+jTizeFFeVTqWseumHMKc03Y09V7ONP2cp8QOS9MJAcm8C/9gMKoiSOyKmckoXV766tEl6LovSV96hjPOUjac+h+SoQAOaE8H6UYf3JeeWlTYxzRqeCZ0IPM3xizUoado2TlgDQbReQKCAQEAvZmJXLolvi6lyr0NYSJbYLHOFSiqtKu51KE3oiZWahxlvBku36AR6rEq660erEgKuUwAOX5tD5Ntntp46mNTecyVOKkWi2nYUVlPyKwEfI/CPxTLsLKztEL1rd9AWvaF3tPcQCoJwK297WxfZO6WLqG2XqriigbUgckNiavr7c8s/aGXKBW3Zi/r+2cjZf7TTavzznPNtQSvW6/jWTdc4wr68hzE5W7Oyg9ODnEFYQ5B7uTSY8SrjKhkCSaeANKiHnPibDfRDszCPOIkrCF3JUEUIIW5HrCIT+P5iICO7JVP5Iu6prYyI/cABuIoBaEdpeDsY6pdHidhEOcScm6EIQKCAQAXMVJdpR+6d+KHEBab+KGov2U9ICheVt7wKL/AJkagi+ab2oCvZK3JgKzciEU1vsLn8P9royFgMXut2kGoNcQ8u3CeqSMnllatWLYjoK/bIJF1VfL9fukLYDIjPsKd0N6k7wFeMOB6ie9qqPRzcKhDoARqjN9iNvdTxTWYetHM06EkMgQxV7t9DoblCLYrMoEYEOI0IeL1AmC+AHU6kC8+56va8GjKdpjDZCieTxl372VuUdZ7qXYZo95hbUfEUzsSPTJQxaUueqKaEX67mjaSRzF/KqXb3ScBua1HEWT8LEP69odziWC10GOkujtVfnjjB5ic/FRDRD3wxRpZW93D")
  val pandaPublicKey=PublicKey("MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAlZTnNvbhe2Y2fQBuKmCbXzTtcUmNuTNYl+/ymr4E2wAHKGfq/xPSO6zHHthlTUncStFw2uursfgJjimfkV3Yl1VTQ8XFXMeZNtQ9d+qRuCTSp19FJ6Rwr+ai8Z5Zduc3IeklrpHcEqNNax/Kf0R3zQcSFF4/mJVijfYwgAqPI3hgWCwPw4RAV1tFMPAmiapyswUybvROwH3Y3aFKWMyhW0EPGcPD4/362rPenu2wth7aR+3ibGeCl2sohr8tGNAmCBgxw3EuTk438op7voSQzah4+Gsm59goFO3nBtjE532Qx1jkMf43dfjLHy8XlJJ9fk/4AsNPA1SsyY1w+fb4Wbq7GHNgH4w+f8Vb4jk/PHc+HQgtRzbsF/pCXep3bYXgeR9oAYRQYiRiQm8RVgN//xotRQCUw8UTNyCGooUIjAbvEqfuS3s46v7gfuqPXsp9x+aAI6dx0pmuJWe6gfylkGvJEcThIdt/Cu3W96YznWHykgCUdNg/bc9QjTYZ16ZRphbHcqzIQwnNGN1L+fCSnXBbLEyAV9HGWxANNAjuxddC7y01amuE283UdcGvrZR6pq6Sgu/Ib+d5zxK6yUWiranWCpI1rLzdaQuoD7a2F8PBXcYfZvpYI9cs76BcwDurA+9dPnxv8c6+T9xi03q4bX6caH0iZydeTMJA9NwTT1ECAwEAAQ==")
  val metricsService = new NoOpMetricsService()

  "PanDomainUserProviderTest" - {

    "clientConfig is correctly populated" in {
      val config = PandaAuthConfig("bob", "bob.key", "bobCookie", true, "https://login.bob.example/login", AwsConnection("eu-west-1", None))
      val provider = new PanDomainUserProvider(config, () => None, TestUserManagement(Nil), metricsService)
      provider.clientConfig shouldBe Map(
        "loginUrl" -> JsString("https://login.bob.example/login")
      )
    }

    "authenticate" - {
      val now = Epoch.now

      "fails when no key is available" in {
        val config = PandaAuthConfig("bob", "bob.key", "bobCookie", true, "https://login.bob.example/login", AwsConnection("eu-west-1", None))
        val provider = new PanDomainUserProvider(config, () => None, TestUserManagement(Nil), metricsService)

        val result = provider.authenticate(
          FakeRequest("GET", "/random"),
          now
        )

        result.failureValue shouldBe AuthenticationFailure("Pan domain library not initialised - no public key available", reportAsFailure = true)
      }

      "fails when no cookie is provided" in {
        val config = PandaAuthConfig("bob", "bob.key", "bobCookie", true, "https://login.bob.example/login", AwsConnection("eu-west-1", None))
        val provider = new PanDomainUserProvider(config, () => Some(pandaPublicKey), TestUserManagement(Nil), metricsService)

        val result = provider.authenticate(
          FakeRequest("GET", "/random"),
          now
        )

        result.failureValue shouldBe PanDomainCookieInvalid("No pan domain cookie available in request with name bobCookie", reportAsFailure = false)
      }

      "fails when cookie is garbage" in {
        val config = PandaAuthConfig("bob", "bob.key", "bobCookie", true, "https://login.bob.example/login", AwsConnection("eu-west-1", None))
        val provider = new PanDomainUserProvider(config, () => Some(pandaPublicKey), TestUserManagement(Nil), metricsService)

        val result = provider.authenticate(
          FakeRequest("GET", "/random").withCookies(Cookie("bobCookie", "garbage")),
          now
        )

        result.failureValue shouldBe PanDomainCookieInvalid("Pan domain cookie invalid: cookie format incorrect", reportAsFailure = true)
      }

      "fails when user is not in database" in {
        val privateCookie = CookieUtils.generateCookieData(
          AuthenticatedUser(User("Bob", "Bob", "bob@example.net", None), "test", Set("test"), now.millis+60*60*1000, multiFactor = true),
          pandaPrivateKey
        )

        val config = PandaAuthConfig("bob", "bob.key", "bobCookie", require2FA = true, "https://login.bob.example/login", AwsConnection("eu-west-1", None))
        val provider = new PanDomainUserProvider(config, () => Some(pandaPublicKey), TestUserManagement(Nil), metricsService)

        val result = provider.authenticate(
          FakeRequest("GET", "/random").withCookies(Cookie("bobCookie", privateCookie)),
          now
        )

        result.failureValue shouldBe PanDomainCookieInvalid(s"User bob@example.net is not authorised to use this system.", reportAsFailure = true)
      }

      "succeeds when cookie is valid" in {
        val privateCookie = CookieUtils.generateCookieData(
          AuthenticatedUser(User("Bob", "Bob", "bob@example.net", None), "test", Set("test"), now.millis+60*60*1000, multiFactor = true),
          pandaPrivateKey
        )

        val bob = DBUser(
          username = "bob@example.net",
          password = None,
          registered = true,
          displayName = Some("Bob Bob"),
          invalidationTime = None,
          totpSecret = None
        )

        val config = PandaAuthConfig("bob", "bob.key", "bobCookie", require2FA = true, "https://login.bob.example/login", AwsConnection("eu-west-1", None))
        val provider = new PanDomainUserProvider(config, () => Some(pandaPublicKey), TestUserManagement(List(bob)), metricsService)

        val result = provider.authenticate(
          FakeRequest("GET", "/random").withCookies(Cookie("bobCookie", privateCookie)),
          now
        )

        result.successValue shouldBe PartialUser("bob@example.net", "Bob Bob")
      }

      "registers a user on first access" in {
        val privateCookie = CookieUtils.generateCookieData(
          AuthenticatedUser(User("Bob", "Bob", "bob@example.net", None), "test", Set("test"), now.millis+60*60*1000, multiFactor = true),
          pandaPrivateKey
        )

        val bob = DBUser(
          username = "bob@example.net",
          password = None,
          registered = false,
          displayName = None,
          invalidationTime = None,
          totpSecret = None
        )

        val config = PandaAuthConfig("bob", "bob.key", "bobCookie", require2FA = true, "https://login.bob.example/login", AwsConnection("eu-west-1", None))
        val users = TestUserManagement(List(bob))
        val provider = new PanDomainUserProvider(config, () => Some(pandaPublicKey), users, metricsService)

        val result = provider.authenticate(
          FakeRequest("GET", "/random").withCookies(Cookie("bobCookie", privateCookie)),
          now
        )

        result.successValue shouldBe PartialUser("bob@example.net", "Bob Bob")

        val bob2 = users.getUser("bob@example.net").successValue
        bob2.displayName shouldBe Some("Bob Bob")
        bob2.registered shouldBe true
      }
    }

    "removeUser" - {
      "actually removes the user" in {
        val bob = DBUser(
          username = "bob@example.net",
          password = None,
          registered = false,
          displayName = None,
          invalidationTime = None,
          totpSecret = None
        )

        val config = PandaAuthConfig("bob", "bob.key", "bobCookie", require2FA = true, "https://login.bob.example/login", AwsConnection("eu-west-1", None))
        val users = TestUserManagement(List(bob))
        val provider = new PanDomainUserProvider(config, () => Some(pandaPublicKey), users, metricsService)

        provider.removeUser("bob@example.net").successValue

        users.getAllUsers shouldBe Nil
      }
    }
  }
}
