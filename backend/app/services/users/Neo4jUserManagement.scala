package services.users

import commands.{CreateCollection, CreateIngestion}
import model.CreateIngestionRequest
import model.frontend.user.PartialUser
import model.manifest.{Collection, Ingestion}
import model.user.{BCryptPassword, DBUser, UserPermission, UserPermissions}
import org.neo4j.driver.v1.Values.parameters
import org.neo4j.driver.v1.exceptions.ClientException
import org.neo4j.driver.v1.{Driver, Record, StatementResult}
import services.Neo4jQueryLoggingConfig
import services.annotations.Annotations
import services.index.{Index, Pages}
import services.manifest.Manifest
import utils._
import utils.attempt.{Attempt, ClientFailure, Failure, IllegalStateFailure, Neo4JFailure, NotFoundFailure, UnknownFailure, UserDoesNotExistFailure}
import utils.auth.totp.Secret

import scala.jdk.CollectionConverters._
import scala.concurrent.ExecutionContext
import scala.util.control.NonFatal

object Neo4jUserManagement {
  def apply(driver: Driver, executionContext: ExecutionContext, queryLoggingConfig: Neo4jQueryLoggingConfig, manifest: Manifest, index: Index, pages: Pages): UserManagement = {
    val neo4jUserManagement = new Neo4jUserManagement(driver, executionContext, queryLoggingConfig, manifest, index, pages)

    neo4jUserManagement.setup() match {
      case Left(err) => throw err.toThrowable
      case Right(_) => neo4jUserManagement
    }
  }
}

class Neo4jUserManagement(neo4jDriver: Driver, executionContext: ExecutionContext, queryLoggingConfig: Neo4jQueryLoggingConfig, manifest: Manifest, index: Index, pages: Pages)
  extends Neo4jHelper(neo4jDriver, executionContext, queryLoggingConfig) with UserManagement {
  import Neo4jHelper._

  implicit val ec = executionContext

  def setup(): Either[Failure, Unit] = transaction { tx =>
    tx.run("CREATE CONSTRAINT ON (user :User) ASSERT user.username IS UNIQUE")
    Right(())
  }

  override def listUsers(): Attempt[List[(DBUser, List[Collection])]] = attemptTransaction { tx =>
    val attemptedResult = tx.run(
      """
        |MATCH (user :User)
        |OPTIONAL MATCH (user)-[:CAN_SEE]->(c: Collection)
        |WITH user, collect(c) as collections
        |RETURN user, collections
      """.stripMargin
    )

    for {
      result <- attemptedResult
      userList <- Attempt.traverse(result.list.asScala.toList) { record =>
        record.hasKeyOrFailure("user", IllegalStateFailure("Failed to get user details")).map { result =>
          (DBUser.fromNeo4jValue(result.get("user")), result.get("collections").asList(v => Collection.fromNeo4jValue(v)).asScala.toList)
        }
      }
    } yield userList
  }

  override def listUsersWithPermission(permission: UserPermission): Attempt[List[DBUser]] = attemptTransaction { tx =>
    val attemptedResult = tx.run(
      """
        |MATCH (user :User)-[:HAS_PERMISSION]->(permission: Permission { name: {permissionName} })
        |RETURN user
      """.stripMargin,
      parameters(
        "permissionName", permission.entryName
      )
    )

    for {
      result <- attemptedResult
      userList <- Attempt.traverse(result.list.asScala.toList) { record =>
        record.hasKeyOrFailure("user", IllegalStateFailure("Failed to get user details")).map { result =>
          DBUser.fromNeo4jValue(result.get("user"))
        }
      }
    } yield userList
  }

  override def getPermissions(username: String): Attempt[UserPermissions] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (user: User { username: {username} })
        |OPTIONAL MATCH (permission: Permission)<-[:HAS_PERMISSION]-(user)
        |RETURN permission
      """.stripMargin,
      parameters(
        "username", username
      )
    ).flatMap(userPermissions)
  }

  override def createUser(user: DBUser, permissions: UserPermissions): Attempt[DBUser] = attemptTransaction { tx =>
    val attemptedResult = tx.run(
      s"""
         |CREATE
         | (user :User {
         |   username: {username},
         |   displayName: {displayName},
         |   password: {password},
         |   invalidationTime: {invalidationTime},
         |   registered: {registered},
         |   totpSecret: {totpSecret}
         | })
         |
         | ${permissionQuery(permissions)}
         |
         |RETURN user
      """.stripMargin,
      parameters(
        "username", user.username,
        "displayName", user.displayName.orNull,
        "password", user.password.map(_.hash).orNull,
        "invalidationTime", user.invalidationTime.map(_.asInstanceOf[java.lang.Long]).orNull,
        "registered", Boolean.box(user.registered),
        "granted", permissions.granted.map(_.toString).toArray,
        "totpSecret", user.totpSecret.map(_.toBase32).orNull
      )
    )

    val result = for {
      result <- attemptedResult
      user <- singleUser(user.username, result)
    } yield user

    result.recoverWith {
      case Neo4JFailure(ce:ClientException) if ce.getMessage.contains("already exists with label User") =>
        Attempt.Left(ClientFailure("User already exists"))
    }
  }

  override def importUser(user: DBUser, permissions: UserPermissions): Attempt[DBUser] = attemptTransaction { tx =>
    val attemptedResult = tx.run(
      s"""
         |MERGE (user :User { username: {username} })
         |
         | SET user.displayName = {displayName}
         | SET user.password = {password}
         | SET user.invalidationTime = {invalidationTime}
         | SET user.registered = {registered}
         | SET user.totpSecret = {totpSecret}
         |
         | ${permissionQuery(permissions)}
         |
         |RETURN user
      """.stripMargin,
      parameters(
        "username", user.username,
        "displayName", user.displayName.orNull,
        "password", user.password.map(_.hash).orNull,
        "invalidationTime", user.invalidationTime.map(_.asInstanceOf[java.lang.Long]).orNull,
        "registered", Boolean.box(user.registered),
        "granted", permissions.granted.map(_.toString).toArray,
        "totpSecret", user.totpSecret.map(_.toBase32).orNull
      )
    )

    for {
      result <- attemptedResult
      user <- singleUser(user.username, result)
    } yield user
  }

  override def registerUser(username: String, displayName: String, password: Option[BCryptPassword], secret: Option[Secret]): Attempt[DBUser] = for {
    user <- updateUser(username, "displayName" -> displayName,
      "totpSecret" -> secret.map(_.toBase32).orNull,
      "password" -> password.map(_.hash).orNull,
      "registered" -> true)

    _ <- createDefaultUserResources(user.toPartial)
  } yield {
    user
  }

  override def updateUserDisplayName(username: String, displayName: String): Attempt[DBUser] =
    updateUser(username, "displayName" -> displayName)

  override def updateUserPassword(username: String, password: BCryptPassword): Attempt[DBUser] =
    updateUser(username, "password" -> password.hash)

  override def updateTotpSecret(username: String, secret: Option[Secret]): Attempt[DBUser] =
    updateUser(username, "totpSecret" -> secret.map(_.toBase32).orNull)

  private def updateUser(username: String, fields: (String, Any)* ): Attempt[DBUser] = attemptTransaction { tx =>
    val setStatements = fields.map { case (fieldName, value) =>
      s"SET user.$fieldName = {$fieldName}"
    }
    val params: Seq[Any] =
      Seq("username", username) ++ fields.flatMap { case (fieldName, value) => Seq(fieldName, value) }

    val attemptedResult = tx.run(
      s"""
        |MATCH (user :User {username: {username}})
        |${setStatements.mkString("\n")}
        |RETURN user
      """.stripMargin,
      parameters(params.asInstanceOf[Seq[AnyRef]]: _*)
    )

    for {
      result <- attemptedResult
      user <- singleUser(username, result)
    } yield user
  }

  override def getUser(username: String): Attempt[DBUser] = attemptTransaction { tx =>
    val attemptedResult = tx.run(
      """
        |MATCH (user :User {username: {username}})
        |RETURN user
      """.stripMargin,
      parameters("username", username)
    )

    for {
      result <- attemptedResult
      user <- singleUser(username, result)
    } yield user
  }

  override def removeUser(username: String): Attempt[Unit] = attemptTransaction { tx =>
    val attemptedResult = tx.run(
      """
        |MATCH (user :User {username: {username}})
        |DETACH DELETE user
      """.stripMargin,
      parameters("username", username)
    )

    attemptedResult.flatMap { result =>
      result.summary.counters.nodesDeleted match {
        case 1 => Attempt.Right(())
        case 0 => Attempt.Left(NotFoundFailure(s"User '$username' doesn't exist"))
        case _ => Attempt.Left(IllegalStateFailure(s"Deleted multiple users when trying to delete $username"))
      }
    }
  }

  override def updateInvalidatedTime(username: String, invalidationTime: Long): Attempt[DBUser] = attemptTransaction { tx =>
    val attemptedResult = tx.run(
      """
        |MATCH (user :User {username: {username}})
        |SET user.invalidationTime = {invalidationTime}
        |RETURN user
      """.stripMargin,
      parameters(
        "username", username,
        "invalidationTime", invalidationTime.asInstanceOf[java.lang.Long]
      )
    )

    for {
      result <- attemptedResult
      user <- singleUser(username, result)
    } yield user
  }

  override def getAllCollectionUrisAndUsernames(): Attempt[Map[String, Set[String]]] = attemptTransaction { tx =>
    tx.run(
      """
        | MATCH (user: User)-[:CAN_SEE]->(collection: Collection)
        | RETURN user.username as username, collection.uri as collection
      """.stripMargin
    ).map { result =>
      result.list.asScala.foldLeft(Map.empty[String, Set[String]]) { (acc, record) =>
        val username = record.get("username").asString()
        val collection = record.get("collection").asString()

        val before = acc.getOrElse(collection, Set.empty)
        val after = before + username

        acc + (collection -> after)
      }
    }
  }

  override def getUsersForCollection(collectionUri: String): Attempt[Set[String]] = attemptTransaction { tx =>
    tx.run(
      """
        | MATCH (collection: Collection { uri: {collection} })
        | MATCH (user: User)-[:CAN_SEE]->(collection)
        | RETURN user.username as username
      """.stripMargin,
      parameters(
        "collection", collectionUri
      )
    ).map { result =>
      result.list.asScala.map(_.get("username").asString()).toSet
    }
  }

  override def getVisibleCollectionUrisForUser(username: String): Attempt[Set[String]] = attemptTransaction { tx =>
    val result = tx.run(
      """
        |MATCH (u: User { username: {username} })-[:CAN_SEE]->(collection: Collection)
        |MATCH (collection)<-[:CAN_SEE]-(user: User)
        |RETURN collection.uri as collection
      """.stripMargin,
      parameters("username", username)
    )

    for {
      summary <- result
      collections <- Attempt.traverse(summary.list.asScala.toList) { record =>
        record.hasKeyOrFailure("collection", IllegalStateFailure("Missing collection in response"))
          .map(_.get("collection").asString())
      }
    } yield collections.toSet
  }

  override def addUserCollection(username: String, collection: String): Attempt[Unit] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (user: User { username: {username} })
        |MATCH (collection: Collection { uri: {collection} })
        |CREATE UNIQUE (user)-[:CAN_SEE]->(collection)
      """.stripMargin,
      parameters(
        "username", username,
        "collection", collection
      )
    ).map(_ => ())
  }

  override def removeUserCollection(username: String, collection: String): Attempt[Unit] = attemptTransaction { tx =>
    tx.run(
      """
        |MATCH (u: User { username: {username} })-[r:CAN_SEE]->(c: Collection { uri: {collection}})
        |DETACH DELETE r
      """.stripMargin,
      parameters(
        "username", username,
        "collection", collection
      )
    ).map(_ => ())
  }

  override def setPermissions(user: String, permissions: UserPermissions): Attempt[Unit] = attemptTransaction { tx =>
    tx.run(
      s"""
        |MATCH (user: User { username: { username } })
        |${permissionQuery(permissions)}
        |RETURN user
      """.stripMargin,
      parameters(
        "username", user,
        "granted", permissions.granted.map(_.toString).toArray
      )
    ).flatMap { r =>
      singleUser(user, r).map(_ => ())
    }
  }

  private def singleUser(username: String, statementResult: StatementResult, field: String = "user"): Attempt[DBUser] = {
    statementResult.hasKeyOrFailure(field, UserDoesNotExistFailure(username)).map { result =>
      DBUser.fromNeo4jValue(result.get(field))
    }
  }

  private def userPermissions(result: StatementResult): Attempt[UserPermissions] = {
    val results = result.list().asScala.toList

    results.headOption match {
      case Some(record) if record.containsKey("permission") && record.get("permission").isNull =>
        Attempt.Right(UserPermissions(granted = Set.empty))

      case Some(_) =>
        Attempt.sequence(results.map(userPermission)).map { perms =>
          UserPermissions(perms.flatten.toSet)
        }

      case None =>
        Attempt.Right(UserPermissions(granted = Set.empty))
    }
  }

  private def userPermission(record: Record): Attempt[Option[UserPermission]] = {
    val name = record.get("permission").get("name")

    if(name.isNull) {
      Attempt.Left(IllegalStateFailure(s"Missing permission name"))
    } else {
      try {
        UserPermission.withNameOption(name.asString()) match {
          case Some(perm) =>
            Attempt.Right(Some(perm))

          case None =>
            logger.warn(s"Unknown permission name $name")
            Attempt.Right(None)
        }
      } catch {
        case NonFatal(err) =>
          Attempt.Left(UnknownFailure(err))
      }
    }
  }

  private def permissionQuery(permissions: UserPermissions): String = {
    if(permissions.granted.isEmpty) {
      """
        |WITH user
        |OPTIONAL MATCH (user)-[existing: HAS_PERMISSION]->(:Permission)
        |DELETE existing
      """.stripMargin
    } else {
      """
        |WITH {granted} as permissions, user
        |OPTIONAL MATCH (user)-[existing: HAS_PERMISSION]->(otherPermission: Permission)
        |  WHERE NOT otherPermission.name IN permissions
        |  DELETE existing
        |
        |WITH permissions, user
        |UNWIND permissions as permission
        | MERGE (p: Permission { name: permission })<-[:HAS_PERMISSION]-(user)
      """.stripMargin
    }
  }

  private def createDefaultUserResources(user: PartialUser)(implicit ec: ExecutionContext): Attempt[Unit] = {
    val username = user.username
    val newCollectionName = s"${user.displayName} Documents"

    val ingestionData = CreateIngestionRequest(path = None, name = None, List("english"), fixed = Some(false), default = Some(true))

    for {
      collection <- CreateCollection(newCollectionName, username, manifest).process()
      _ <- CreateIngestion(ingestionData, collection.uri, manifest, index, pages).process()
      _ <- addUserCollection(user.username, newCollectionName)
    } yield {
      ()
    }
  }
}
