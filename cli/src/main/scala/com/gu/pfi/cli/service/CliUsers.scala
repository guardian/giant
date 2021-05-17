package com.gu.pfi.cli.service

import java.security.SecureRandom

import model.user.NewUser
import play.api.libs.json.Json
import utils.attempt.Attempt

import scala.concurrent.ExecutionContext

class CliUsers(httpClient: CliHttpClient) {
  private lazy val rng: SecureRandom = buildRNG()

  def createUsers(usernames: List[String])(implicit ec: ExecutionContext): Attempt[List[NewUser]] = {
    Attempt.sequence(usernames.map { username =>
      // TODO MRB: should inherit the servers password requirements?
      val req = NewUser(username, createRandomPassword(14))
      httpClient.put(s"/api/users/$username", Json.stringify(Json.toJson(req))).map { _ => req }
    })
  }

  private def createRandomPassword(length: Int): String = {
    val alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*_=+-/.?<>)"
    (0 until length).map { _ => alphabet(rng.nextInt(alphabet.length)) }.mkString("")
  }

  private def buildRNG(): SecureRandom = {
    val ret = SecureRandom.getInstanceStrong

    // immediately seed the generator - this is good practice
    ret.nextBoolean()

    ret
  }
}
