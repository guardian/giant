package model.user

import model._
import model.frontend.user.PartialUser
import org.neo4j.driver.v1.Value
import utils.auth.totp.{Base32Secret, Secret}

/* User model for representation in the database */
case class DBUser(username: String, displayName: Option[String], password: Option[BCryptPassword],
                  invalidationTime: Option[Long], registered: Boolean,
                  totpSecret: Option[Secret]) {
  def toPartial = PartialUser(username, displayName.getOrElse(username))
}

object DBUser {
  // this deliberately has no Json Formats as this should never be sent to a client

  def fromNeo4jValue(user: Value): DBUser = {
    DBUser(
      user.get("username").asString,
      user.get("displayName").optionally(_.asString),
      user.get("password").optionally(v => BCryptPassword.apply(v.asString)),
      user.get("invalidationTime").optionally(_.asLong),
      user.get("registered").optionally(_.asBoolean).getOrElse(false),
      user.get("totpSecret").optionally(v => Base32Secret(v.asString))
    )
  }
}