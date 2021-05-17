package commands

import services.manifest.Manifest
import utils.attempt.Failure

case class EmailThread(uri: String, manifest: Manifest) extends CommandCanFail[EmailThread] {
  def process(): Either[Failure, EmailThread] = ???
}