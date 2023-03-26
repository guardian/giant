package test

import model.manifest.Collection
import model.user._
import model.{Uri, user}
import services.DatabaseAuthConfig
import services.users.UserManagement
import test.fixtures.GoogleAuthenticator
import utils.attempt._
import utils.auth.{PasswordHashing, PasswordValidator}
import utils.auth.providers.DatabaseUserProvider
import utils.auth.totp.{Secret, SecureSecretGenerator, Totp}

import scala.concurrent.ExecutionContext.Implicits.global

case class TestUserRegistration(dbUser: DBUser, permissions: UserPermissions, collections: List[Collection]) {
  def username: String = dbUser.username
}

object TestUserManagement {
  import GoogleAuthenticator._

  type Storage = Map[String, TestUserRegistration]

  val testPassword = "hardtoguess"
  val testPasswordHashed = BCryptPassword("$2y$04$vZVs5a9NfK6GbyTuF6t22eNTmHcuzTMZftfLxiimNkkoO.spBvIZ6")

  val ssg = new SecureSecretGenerator
  val totp = Totp.googleAuthenticatorInstance()

  def apply(initialUsers: List[TestUserRegistration]): TestUserManagement =
    new TestUserManagement(initialUsers.map { u => u.username -> u }.toMap)

  def makeUserProvider(require2fa: Boolean, users: TestUserRegistration*): (DatabaseUserProvider, TestUserManagement) = {
    val config = DatabaseAuthConfig(
      minPasswordLength = 8,
      require2FA = require2fa,
      totpIssuer = "giant"
    )

    val userManagement = TestUserManagement(users.toList)
    val totp = Totp.googleAuthenticatorInstance()

    val userProvider = new DatabaseUserProvider(
      config = config,
      passwordHashing = new PasswordHashing(4),
      users = userManagement,
      totp = totp,
      ssg = new SecureSecretGenerator(),
      passwordValidator = new PasswordValidator(config.minPasswordLength)
    )

    (userProvider, userManagement)
  }

  def user(username: String, displayName: Option[String] = None, permissions: UserPermissions = UserPermissions.default,
                          collections: List[Collection] = List.empty): TestUserRegistration = TestUserRegistration(
    dbUser = DBUser(
      username,
      displayName = displayName,
      password = Some(testPasswordHashed),
      invalidationTime = None,
      registered = true,
      totpSecret = None
    ),
    permissions,
    collections
  )

  def unregisteredUser(username: String): TestUserRegistration = {
    val initial = user(username)
    initial.copy(dbUser = initial.dbUser.copy(registered = false))
  }

  def totpUser(username: String, displayName: Option[String] = None, permissions: UserPermissions = UserPermissions.default,
                         collections: List[Collection] = List.empty): TestUserRegistration = {
    val initial = user(username, displayName, permissions, collections)
    initial.copy(dbUser = initial.dbUser.copy(totpSecret = Some(sampleSecret)))
  }
}

class TestUserManagement(initialUsers: TestUserManagement.Storage) extends UserManagement {
  private var users: TestUserManagement.Storage = initialUsers

  def getAllUsers: List[DBUser] = users.values.toList.map(_.dbUser)

  override def getUser(username: String): Attempt[DBUser] = {
    users.get(username).toAttempt(Attempt.Left(UserDoesNotExistFailure(username))).map(_.dbUser)
  }

  override def listUsers(): Attempt[List[(DBUser, List[Collection])]] = Attempt.Right {
    users.values.toList
      .sortBy(_.username)
      .map { case TestUserRegistration(dbUser, _, collections) => dbUser -> collections }
  }

  def listUsersWithPermission(permission: UserPermission): Attempt[List[DBUser]] = Attempt.Right {
    users.values.toList.collect { case TestUserRegistration(dbUser, permissions, _) if permissions.hasPermission(permission) => dbUser }
  }

  override def getPermissions(username: String): Attempt[UserPermissions] = {
    users.get(username).toAttempt(Attempt.Left(UserDoesNotExistFailure(username))).map(_.permissions)
  }

  override def removeUser(username: String): Attempt[Unit] = {
    users = users - username
    Attempt.Right(())
  }

  override def createUser(u: user.DBUser, p: user.UserPermissions): Attempt[DBUser] = {
    users = users + (u.username -> TestUserRegistration(u, p, List.empty))
    Attempt.Right(u)
  }

  override def importUser(u: DBUser, p: user.UserPermissions): Attempt[DBUser] = {
    users = users + (u.username -> TestUserRegistration(u, p, List.empty))
    Attempt.Right(u)
  }

  override def updateUserPassword(username: String, password: BCryptPassword): Attempt[DBUser] =
    updateDbUserField(username, _.copy(password = Some(password)))

  override def updateUserDisplayName(username: String, displayName: String): Attempt[DBUser] =
    updateDbUserField(username, _.copy(displayName = Some(displayName)))

  override def updateTotpSecret(username: String, secret: Option[Secret]): Attempt[DBUser] =
    updateDbUserField(username, _.copy(totpSecret = secret))

  override def updateInvalidatedTime(username: String, invalidatedTime: Long): Attempt[DBUser] =
    updateDbUserField(username, _.copy(invalidationTime = Some(invalidatedTime)))

  override def addUserCollection(username: String, collection: String): Attempt[Unit] = {
    updateField(username, r => r.copy(collections = r.collections :+ Collection(Uri(collection), collection, List.empty, None))).map(_ => ())
  }

  def getAllCollectionUrisAndUsernames(): Attempt[Map[String, Set[String]]] = Attempt.Right {
    users.foldLeft(Map.empty[String, Set[String]]) { case (acc, (username, TestUserRegistration(_, _, collections))) =>
      collections.foldLeft(acc) { (acc, collection) =>
        val before = acc.getOrElse(collection.uri.value, Set.empty)
        val after = before + username

        acc + (collection.uri.value  -> after)
      }
    }
  }

  override def getUsersForCollection(collectionUri: String): Attempt[Set[String]] = Attempt.Right {
    users.collect {
      case (username, TestUserRegistration(_, _, collections)) if collections.exists(_.uri.value == collectionUri) => username
    }.toSet
  }

  override def getVisibleCollectionUrisForUser(username: String): Attempt[Set[String]] = {
    users.get(username).toAttempt(Attempt.Left(UserDoesNotExistFailure(username))).map { case TestUserRegistration(_, _, colls) =>
      colls.map(_.uri.value).toSet
    }
  }

  override def removeUserCollection(username: String, collection: String): Attempt[Unit] =
    updateField(username, r => r.copy(collections = r.collections.filterNot(_.uri.value == collection))).map(_ => ())

  override def registerUser(username: String, displayName: String, password: Option[BCryptPassword], secret: Option[Secret]): Attempt[DBUser] =
    updateField(username, r => r.copy(
      dbUser = r.dbUser.copy(
        password = password,
        displayName = Some(displayName),
        registered = true,
        totpSecret = secret
      ),
    )).map(r => r.dbUser)

  override def setPermissions(username: String, permissions: UserPermissions): Attempt[Unit] =
    updateField(username, r => r.copy(permissions = permissions)).map(_ => ())

  private def updateField(username: String, f: TestUserRegistration => TestUserRegistration): Attempt[TestUserRegistration] = {
    val maybeUpdatedUser = users
      .get(username)
      .map {r => username -> f(r) }

    users = users ++ maybeUpdatedUser
    maybeUpdatedUser.fold[Attempt[TestUserRegistration]]
      { Attempt.Left(UserDoesNotExistFailure(username)) }
      { case (_, user) => Attempt.Right(user) }
  }

  private def updateDbUserField(username: String, f: DBUser => DBUser): Attempt[DBUser] = {
    updateField(username, r => r.copy(dbUser = f(r.dbUser))).map(_.dbUser)
  }
}
