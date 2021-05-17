package utils.auth.totp

case class Secret(data: Vector[Byte]) {
  def toBase32: String = Totp.bytesToBase32(data)
}
object HexSecret {
  def apply(hexSecret:String): Secret = Secret(Totp.hexStrToBytes(hexSecret))
}
object Base32Secret {
  def apply(base32Secret:String): Secret = Secret(Totp.base32ToBytes(base32Secret))
}