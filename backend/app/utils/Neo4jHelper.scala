package utils

import org.neo4j.driver.Values.parameters

import java.util.UUID
import java.util.concurrent.CompletionStage
import org.neo4j.driver.exceptions.{Neo4jException, NoSuchRecordException, TransientException}
import org.neo4j.driver._
import org.neo4j.driver.types.TypeSystem
import play.api.Logger
import services.Neo4jQueryLoggingConfig
import utils.attempt.{Attempt, Failure, Neo4JFailure, Neo4JTransientFailure, NotFoundFailure, UnknownFailure}

import scala.collection.mutable
import scala.concurrent.{ExecutionContext, Future}
import scala.util.control.NonFatal
import scala.jdk.CollectionConverters._
import utils.Logging

class Neo4jHelper(driver: Driver, executionContext: ExecutionContext, queryLoggingConfig: Neo4jQueryLoggingConfig) extends Logging {

  val slowQueryLogger = Logger("slowqueries")

  /**
    * Helper that wraps a Neo4J operation and converts any uncaught exceptions to Neo4JFailures.
    *
    * @param f the operation being called
    * @return an Attempt containing the result (or failure)
    */
  def attemptNeo4J(f: => Result)(): Attempt[Result] =
    Attempt.catchNonFatal(f) {
      case NonFatal(t) => Neo4JFailure(t)
    }

  /**
    * This is a useful wrapper around a Neo4J transaction. It has most of the same methods, but instead of blocking
    * and eventually returning Result objects, it returns a (synchronous) Attempt[Result].
    */
  class AttemptWrappedTransaction(underlying: QueryRunner, executionContext: ExecutionContext) {
    def run(statementTemplate: String, statementParameters: Record): Attempt[Result] =
      attemptNeo4J({
        underlying.run(statementTemplate, statementParameters)
      })()

    def run(statementTemplate: String): Attempt[Result] =
      attemptNeo4J({
        underlying.run(statementTemplate)
      })()

    def run(statementTemplate: String, parameters: Value): Attempt[Result] =
      attemptNeo4J({
        underlying.run(statementTemplate, parameters)
      })()

    def run(statementTemplate: String, statementParameters: java.util.Map[String, AnyRef]): Attempt[Result] =
      attemptNeo4J({
        underlying.run(statementTemplate, statementParameters)
      })()

    def run(statement: Query): Attempt[Result] =
      attemptNeo4J({
        underlying.run(statement)
      })()

    def run(statementTemplate: String, parameters: (String, AnyRef)*): Attempt[Result] = {
      val flattenedParameters = parameters.flatten { case (k, v) => Vector(k,v) }
      val parametersObj = Values.parameters(flattenedParameters:_*)
      run(statementTemplate, parametersObj)
    }
  }

  /**
    * This is a wrapper around a Neo4J transaction that logs slow queries.
    */
  private class LoggingTransaction(underlying: Transaction, config: Neo4jQueryLoggingConfig) extends Transaction {
    // a UUID to uniquely identify this transaction if it is slow
    private lazy val uuid = UUID.randomUUID().toString
    // collect all of the statements run in this transaction
    private val statements = mutable.Buffer.empty[() => String]

    def logNeo4J(logData: => String)(f: => Result): Result = {
      statements += (() => logData)
      val start = System.currentTimeMillis()

      if(config.logAllQueries) {
        logger.info(s"$uuid START NEO4J QUERY: $logData")
      }

      val result = f
      val timeTaken = System.currentTimeMillis() - start
      if (timeTaken >= config.slowQueryThreshold.toMillis) {
        slowQueryLogger.warn(s"$uuid SLOW NEO4J QUERY - ${timeTaken}ms: $logData")
      } else if(config.logAllQueries) {
        logger.info(s"$uuid FINISHED NEO4J QUERY - ${timeTaken}ms: $logData")
      }

      result
    }

    def run(statementTemplate: String, statementParameters: Record): Result =
      logNeo4J(s"$statementTemplate [${statementParameters.fields().asScala}]"){
        underlying.run(statementTemplate, statementParameters)
      }

    def run(statementTemplate: String): Result =
      logNeo4J(s"$statementTemplate"){
        underlying.run(statementTemplate)
      }

    def run(statementTemplate: String, parameters: Value): Result =
      logNeo4J(s"$statementTemplate [$parameters]"){
        underlying.run(statementTemplate, parameters)
      }

    def run(statementTemplate: String, statementParameters: java.util.Map[String, AnyRef]): Result =
      logNeo4J(s"$statementTemplate [${statementParameters.asScala}]") {
        underlying.run(statementTemplate, statementParameters)
      }

    def run(statement: Query): Result =
      logNeo4J(s"$statement") {
        underlying.run(statement)
      }

    override def close(): Unit = underlying.close()

    override def commit(): Unit = {
      val start = System.currentTimeMillis()

      try {
        underlying.commit()
      } finally {
        val timeTaken = System.currentTimeMillis() - start
        if (timeTaken >= config.slowQueryThreshold.toMillis) {
          slowQueryLogger.warn(s"$uuid SLOW NEO4J COMMIT - ${timeTaken}ms: transaction statements: ${statements.map(s => s()).mkString("\n")}")
        } else if(config.logAllQueries) {
          logger.info(s"$uuid NEO4J COMMIT - ${timeTaken}ms: transaction statements: ${statements.map(s => s()).mkString("\n")}")
        }
      }
    }

    override def rollback(): Unit = underlying.rollback()

    override def isOpen: Boolean = underlying.isOpen
  }

  def attemptTransaction[T](f: AttemptWrappedTransaction => Attempt[T]): Attempt[T] = {
    val session = driver.session()
    val tx = session.beginTransaction()
    val future = Future {
        // do the whole of the transaction inside a future
        f(new AttemptWrappedTransaction(new LoggingTransaction(tx, queryLoggingConfig), executionContext))
      }(executionContext)
      .flatMap {
        // strip off the attempt and flatten it
        _.underlying
      }(executionContext)
      .map { either =>
        // notify the transaction whether the attempt was successful or not
        either.fold[Unit](
          _ => tx.rollback(),
          _ => tx.commit()
        )
        either
      }(executionContext)
      .transform { value =>
        // ensure the transaction and session are closed when we've finished
        try {
          if (tx.isOpen) tx.close()
          if (session.isOpen) session.close()
        } catch {
          case NonFatal(t) => {
            logger.warn("Failed to close session", t)
            throw t
          }
        }
        value
      }(executionContext)

    // re-wrap the result in Attempt
    Attempt(future)
  }

  def getDeadlockedNodes(tx: Transaction, transientException: TransientException): List[String] = {
      val nodePattern = """RWLock\[NODE\(([0-9]*)\)""".r

      val nodeIds = nodePattern
        .findAllMatchIn(transientException.getMessage)
        .toList
        .map(_.group(1).toInt)

      val nodesResult = tx.run(
        """MATCH (n) WHERE id(n) IN $nodeIds RETURN n""",
        parameters("nodeIds", nodeIds.asJava)
      )
      val nodes = nodesResult
        .list()
        .asScala
        .toList
        .map(_.get("n").asNode())

      nodes.map(n => s"node (:${n.labels().asScala.toList.mkString(":")} {id: ${n.id()}})")
  }

  def getDeadlockedRelationships(tx: Transaction, transientException: TransientException): List[String] = {
    val relationshipPattern = """RWLock\[RELATIONSHIP\(([0-9]*)\)""".r

    val relationshipIds = relationshipPattern
      .findAllMatchIn(transientException.getMessage)
      .toList
      .map(_.group(1).toInt)

    val relationshipsResult = tx.run(
      """MATCH ()-[r]->() WHERE id(r) IN $relationshipIds RETURN r""",
      parameters("relationshipIds", relationshipIds.asJava)
    )
    val relationships = relationshipsResult
      .list()
      .asScala
      .toList
      .map(_.get("r").asRelationship())

    relationships.map(r => s"relationship ({id: ${r.startNodeId()}})-[:${r.`type`()}]->({id: ${r.endNodeId()}})")
  }

  def getDeadlockedNodesAndRelationships(session: Session, transientException: TransientException): List[String] = {
    val tx = session.beginTransaction()
    try {
      List(
        getDeadlockedRelationships(tx, transientException),
        getDeadlockedNodes(tx, transientException)
      ).flatten
    } catch {
      case NonFatal(ex) => {
        tx.rollback()
        logger.error("Error attempting to get deadlocked nodes and relationships", ex)
        List()
      }
    } finally {
      tx.close()
    }
  }

  def transaction[T](f: Transaction => Either[Failure, T]): Either[Failure, T] = {
    val session = driver.session()
    val tx = session.beginTransaction()
    try {
      val result = f(new LoggingTransaction(tx, queryLoggingConfig))
      if (result.isRight) {
        tx.commit()
      } else {
        tx.rollback()
      }
      tx.close()
      session.close()
      result
    } catch {
      case transientException: TransientException =>
        // example exception message:
        // Caught error from neo4j: LockClient[680704] can't wait on resource RWLock[NODE(4751773), hash=582829124] since => LockClient[680704] <-[:HELD_BY]- RWLock[RELATIONSHIP(10943051), hash=1236839988] <-[:WAITING_FOR]- LockClient[680747] <-[:HELD_BY]- RWLock[NODE(4751773), hash=582829124])

        // We need to close off the original transaction, because if we try and run further statements we get:
        //  "Cannot run more statements in this transaction, because previous statements
        //  in the transaction has failed and the transaction has been rolled back.
        //  Please start a new transaction to run another statement."
        tx.rollback()
        tx.close()

        val deadlockedNodesAndRelationships = getDeadlockedNodesAndRelationships(session, transientException)
        logger.info(s"""Deadlocked on ${deadlockedNodesAndRelationships.mkString(", ")}""")

        Left(Neo4JTransientFailure(transientException))

      case NonFatal(ex) =>
        tx.rollback()

        // We want to get a stack trace here otherwise we only get async transport level frames from the neo4j client
        val wrappingException = new IllegalStateException("Caught error from neo4j: " + ex.getMessage, ex)
        Left(UnknownFailure(wrappingException))
    } finally {
      if (tx.isOpen) tx.close()
      if (session.isOpen) session.close()
    }
  }

}

object Neo4jHelper {
  implicit class RichRecords[T <: Iterable[Record]](result: T) {
    def hasKeyOrFailure(expectedKey: String, errorMessage: String): Either[Failure, T] = {
      if (!result.exists(x => x.containsKey(expectedKey))) {
        Left(NotFoundFailure(errorMessage))
      } else {
        Right(result)
      }
    }

    def hasKeyOrFailure(expectedKey: String, error: Failure): Attempt[T] = {
      if (!result.exists(x => x.containsKey(expectedKey))) {
        Attempt.Left(error)
      } else {
        Attempt.Right(result)
      }
    }
  }

  implicit class RichRecord(record: Record) {
    def hasKeyOrFailure(expectedKey: String, error: Failure): Attempt[Record] = {
      if (!record.containsKey(expectedKey)) {
        Attempt.Left(error)
      } else {
        Attempt.Right(record)
      }
    }
  }

  implicit class RichResult(result: Result) {
    def hasKeyOrFailure(expectedKey: String, error: Failure)(implicit executionContext: ExecutionContext): Attempt[Record] = {
      Attempt.catchNonFatal(result.single()) {
        case _: NoSuchRecordException => error
        case neo4j: Neo4jException => Neo4JFailure(neo4j)
      }.flatMap {
        _.hasKeyOrFailure(expectedKey, error)
      }
    }

    def iterator: Iterator[Record] = new Iterator[Record]{
      override def hasNext: Boolean = result.hasNext
      override def next(): Record = result.next()
    }
  }
}
