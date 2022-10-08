package services

import java.io.{File, InputStream, OutputStream}
import java.nio.file.Files
import java.security.{DigestInputStream, MessageDigest}
import java.util.{Base64, UUID}

object FingerprintServices {
  val DEFAULT_HASH: String = "SHA-512"

  private val encoder = Base64.getUrlEncoder.withoutPadding

  def createFingerprintFromFile(file: File): String = {
    if(Files.size(file.toPath) == 0) {
      s"urn:pfi:giant:zero-byte-file:${UUID.randomUUID()}"
    } else {
      var inputStream: InputStream = null

      try {
        inputStream = Files.newInputStream(file.toPath)

        val digest = MessageDigest.getInstance(DEFAULT_HASH)
        val digestInputStream = new DigestInputStream(inputStream, digest)

        digestInputStream.transferTo(OutputStream.nullOutputStream())

        val bytes = digest.digest()

        encoder.encodeToString(bytes)
      } finally {
        Option(inputStream).foreach(_.close())
      }
    }
  }
}
