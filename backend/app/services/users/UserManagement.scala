package services.users

import model.Uri
import model.manifest.Collection
import model.user.{BCryptPassword, DBUser, UserPermission, UserPermissions}
import utils.attempt.Attempt
import utils.auth.totp.Secret

import scala.concurrent.ExecutionContext

trait UserManagement {
  def listUsers(): Attempt[List[(DBUser, List[Collection])]]
  def listUsersWithPermission(permission: UserPermission): Attempt[List[DBUser]]
  def getPermissions(username: String): Attempt[UserPermissions]
  def createUser(user: DBUser, permissions: UserPermissions): Attempt[DBUser]
  def importUser(user: DBUser, permissions: UserPermissions): Attempt[DBUser]
  def registerUser(username: String, displayName: String, password: Option[BCryptPassword], secret: Option[Secret]): Attempt[DBUser]
  def updateUserDisplayName(username: String, displayName: String): Attempt[DBUser]
  def updateUserPassword(username: String, password: BCryptPassword): Attempt[DBUser]
  def updateTotpSecret(username: String, secret: Option[Secret]): Attempt[DBUser]
  def getUser(username: String): Attempt[DBUser]
  def removeUser(username: String): Attempt[Unit]
  def updateInvalidatedTime(username: String, invalidatedTime: Long): Attempt[DBUser]
  def getAllCollectionUrisAndUsernames(): Attempt[Map[String, Set[String]]]
  def getUsersForCollection(collectionUri: String): Attempt[Set[String]]
  def getVisibleCollectionUrisForUser(user: String): Attempt[Set[String]]
  def addUserCollection(user: String, collection: String): Attempt[Unit]
  def removeUserCollection(user: String, collection: String): Attempt[Unit]
  def setPermissions(user: String, permissions: UserPermissions): Attempt[Unit]

  def canSeeCollection(user: String, collection: Uri)(implicit ec: ExecutionContext): Attempt[Boolean] =
    getVisibleCollectionUrisForUser(user).map(_.contains(collection.value))

  def hasPermission(user: String, permission: UserPermission)(implicit ec: ExecutionContext): Attempt[Boolean] =
    getPermissions(user).map(_.hasPermission(permission))

  def isOnlyOwnerOfBlob(blobUri: String, username: String): Attempt[Boolean]
}
