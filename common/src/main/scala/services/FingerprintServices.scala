package services

import java.io.File
import java.nio.file.Files
import java.util.{Base64, UUID}

import com.google.common.hash.{HashFunction, Hashing}
import com.google.common.io.{Files => GuavaFiles}

object FingerprintServices {
  val DEFAULT_HASH: String = "SHA-512"
  val DEFAULT_HASH_FUNCTION: HashFunction = Hashing.sha512()
  private val encoder = Base64.getUrlEncoder.withoutPadding

  def createFingerprintFromFile(file: File): String = {
    if(Files.size(file.toPath) == 0) {
      s"urn:pfi:giant:zero-byte-file:${UUID.randomUUID()}"
    } else {
      val bytes = GuavaFiles.asByteSource(file).hash(DEFAULT_HASH_FUNCTION).asBytes()
      encoder.encodeToString(bytes)
    }
  }
}
