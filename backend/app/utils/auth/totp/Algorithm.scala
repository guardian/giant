package utils.auth.totp

case class Algorithm(alg: String, secretLength: Int)
object Algorithm {
  val HmacSHA1 = Algorithm("HmacSHA1", 20)
  val HmacSHA256 = Algorithm("HmacSHA256", 32)
  val HmacSHA512 = Algorithm("HmacSHA512", 64)
}
