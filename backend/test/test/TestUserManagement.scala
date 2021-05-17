package test

import model.manifest.Collection
import model.{Uri, user}
import model.user.{BCryptPassword, DBUser, UserPermission, UserPermissions}
import services.users.UserManagement
import utils.attempt._
import utils.auth.totp.Secret

import scala.concurrent.ExecutionContext.Implicits.global

object TestUserManagement {
  def apply(initialUsers: List[user.DBUser]): TestUserManagement = {
    val withPermissions: Map[String, (user.DBUser, user.UserPermissions, List[Collection])] = initialUsers.map(user => user.username -> (user, UserPermissions.default, List.empty))(scala.collection.breakOut)
    new TestUserManagement(withPermissions)
  }

  def apply(initialUsers: Map[user.DBUser, (user.UserPermissions, List[Collection])]): TestUserManagement = {
    new TestUserManagement(initialUsers.map{ case (user, (perms, colls)) => user.username -> (user, perms, colls) })
  }
}

class TestUserManagement(initialUsers: Map[String, (user.DBUser, user.UserPermissions, List[Collection])]) extends UserManagement {
  private var users: Map[String, (DBUser, UserPermissions, List[Collection])] = initialUsers

  private def getUserByUsername(username: String): DBUser = users.get(username).map(_._1).get

  def getAllUsers: List[DBUser] = users.values.toList.map(_._1)

  override def getUser(username: String): Attempt[DBUser] = {
    users.get(username).toAttempt(Attempt.Left(UserDoesNotExistFailure(username))).map(_._1)
  }

  override def listUsers(): Attempt[List[(DBUser, List[Collection])]] = {
    Attempt.Right(users.values.toList.map(_._1).sortBy(_.username).map(u => (u, List.empty[Collection])))
  }

  def listUsersWithPermission(permission: UserPermission): Attempt[List[DBUser]] = {
    Attempt.Right(users.values.toList.filter(_._2.hasPermission(permission)).map(_._1))
  }

  override def getPermissions(username: String): Attempt[UserPermissions] = {
    users.get(username).toAttempt(Attempt.Left(UserDoesNotExistFailure(username))).map(_._2)
  }

  override def removeUser(username: String): Attempt[Unit] = {
    users = users - username
    Attempt.Right(())
  }

  override def createUser(u: user.DBUser, p: user.UserPermissions): Attempt[DBUser] = {
    users = users + (u.username -> (u, p, List.empty))
    Attempt.Right(u)
  }

  override def importUser(u: DBUser, p: user.UserPermissions): Attempt[DBUser] = {
    users = users + (u.username -> (u, p, List.empty))
    Attempt.Right(u)
  }

  override def updateUserPassword(username: String, password: BCryptPassword): Attempt[DBUser] = updateField(username, _.copy(password = Some(password)))
  override def updateUserDisplayName(username: String, displayName: String): Attempt[DBUser] = updateField(username, _.copy(displayName = Some(displayName)))
  override def updateTotpSecret(username: String, secret: Option[Secret]): Attempt[DBUser] = updateField(username, _.copy(totpSecret = secret))
  override def updateInvalidatedTime(username: String, invalidatedTime: Long): Attempt[DBUser] = updateField(username, _.copy(invalidationTime = Some(invalidatedTime)))
  override def addUserCollection(username: String, collection: String): Attempt[Unit] = {
    users = users + (username -> (getUserByUsername(username), UserPermissions.default, List(Collection(Uri(collection), collection, List.empty, None))))
    Attempt.Right(())
  }

  def getAllCollectionUrisAndUsernames(): Attempt[Map[String, Set[String]]] = Attempt.Right {
    users.foldLeft(Map.empty[String, Set[String]]) { case (acc, (username, (_, _, collections))) =>
      collections.foldLeft(acc) { (acc, collection) =>
        val before = acc.getOrElse(collection.uri.value, Set.empty)
        val after = before + username

        acc + (collection.uri.value  -> after)
      }
    }
  }

  override def getUsersForCollection(collectionUri: String): Attempt[Set[String]] = Attempt.Right {
    users.collect {
      case (username, (_, _, collections)) if collections.exists(_.uri.value == collectionUri) => username
    }.toSet
  }

  override def getVisibleCollectionUrisForUser(username: String): Attempt[Set[String]] = {
    users.get(username).toAttempt(Attempt.Left(UserDoesNotExistFailure(username))).map { case (_, _, colls) =>
      colls.map(_.uri.value).toSet
    }
  }

  override def removeUserCollection(username: String, collection: String): Attempt[Unit] =
    users.get(username).toAttempt(Attempt.Left(UserDoesNotExistFailure(username))).map{ case (_, _, colls) =>
      colls.filter(_.uri.value != collection)
    }

  override def registerUser(username: String, displayName: String, password: Option[BCryptPassword], secret: Option[Secret]): Attempt[DBUser] = {
    updateField(username, _.copy(password = password, displayName = Some(displayName), totpSecret = secret, registered = true))
  }

  def setPermissions(user: String, permissions: UserPermissions): Attempt[Unit] = {
    users.get(user) match {
      case Some((dbUser, _, collections)) =>
        users = users + (user -> (dbUser, permissions, collections))
        Attempt.Right(())

      case _ =>
        Attempt.Left(NotFoundFailure(s"User $user does not exist"))
    }
  }

  private def updateField(username: String, f: DBUser => DBUser) = {
    val maybeUpdatedUser = users
      .get(username)
      .map { case(u, p, c) => username -> (f(u), p, c) }

    users = users ++ maybeUpdatedUser
    maybeUpdatedUser.fold[Attempt[DBUser]]
      { Attempt.Left(UserDoesNotExistFailure(username)) }
      { case(_, (user, _, _)) => Attempt.Right(user) }
  }


}
