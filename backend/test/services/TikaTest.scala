package services

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

import java.nio.file.Files

class TikaTest extends AnyFreeSpec with Matchers {
  "Tika" - {
    "loads custom MIME type detection rules from the classpath root" in {
      val email = Files.createTempFile("tika-custom-mime", ".txt")

      try {
        Files.writeString(email, "Subject: custom MIME detection\n\nMessage body")

        Tika.createInstance.detectType(email).map(_.toString) shouldBe Right("message/rfc822")
      } finally {
        Files.deleteIfExists(email)
      }
    }
  }
}
