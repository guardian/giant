package utils

import org.neo4j.driver.v1.Values.parameters

import java.util.UUID
import java.util.concurrent.CompletionStage
import org.neo4j.driver.v1.exceptions.{Neo4jException, NoSuchRecordException, TransientException}
import org.neo4j.driver.v1._
import org.neo4j.driver.v1.types.TypeSystem
import play.api.Logger
import services.Neo4jQueryLoggingConfig
import utils.attempt.{Attempt, Failure, Neo4JFailure, Neo4JTransientFailure, NotFoundFailure, UnknownFailure}

import scala.collection.mutable
import scala.concurrent.{ExecutionContext, Future}
import scala.util.control.NonFatal
import scala.collection.JavaConverters._

class Neo4jHelper(driver: Driver, executionContext: ExecutionContext, queryLoggingConfig: Neo4jQueryLoggingConfig) extends Logging {

  val slowQueryLogger = Logger("slowqueries")

  /**
    * Helper that wraps a Neo4J operation and converts any uncaught exceptions to Neo4JFailures.
    *
    * @param f the operation being called
    * @return an Attempt containing the result (or failure)
    */
  def attemptNeo4J(f: => StatementResult)(): Attempt[StatementResult] =
    Attempt.catchNonFatal(f) {
      case NonFatal(t) => Neo4JFailure(t)
    }

  /**
    * This is a useful wrapper around a Neo4J transaction. It has most of the same methods, but instead of blocking
    * and eventually returning StatementResult objects, it returns a (synchronous) Attempt[StatementResult].
    */
  class AttemptWrappedTransaction(underlying: StatementRunner, executionContext: ExecutionContext) {
    def run(statementTemplate: String, statementParameters: Record): Attempt[StatementResult] =
      attemptNeo4J {
        underlying.run(statementTemplate, statementParameters)
      }

    def run(statementTemplate: String): Attempt[StatementResult] =
      attemptNeo4J {
        underlying.run(statementTemplate)
      }

    def run(statementTemplate: String, parameters: Value): Attempt[StatementResult] =
      attemptNeo4J {
        underlying.run(statementTemplate, parameters)
      }

    def run(statementTemplate: String, statementParameters: java.util.Map[String, AnyRef]): Attempt[StatementResult] =
      attemptNeo4J {
        underlying.run(statementTemplate, statementParameters)
      }

    def run(statement: Statement): Attempt[StatementResult] =
      attemptNeo4J {
        underlying.run(statement)
      }

    def run(statementTemplate: String, parameters: (String, AnyRef)*): Attempt[StatementResult] = {
      val flattenedParameters = parameters.flatten { case (k, v) => Vector(k,v) }
      val parametersObj = Values.parameters(flattenedParameters:_*)
      run(statementTemplate, parametersObj)
    }
  }

  /**
    * This is a wrapper around a Neo4J transaction that logs slow queries.
    */
  class LoggingTransaction(underlying: Transaction, config: Neo4jQueryLoggingConfig) extends Transaction {
    // a UUID to uniquely identify this transaction if it is slow
    private lazy val uuid = UUID.randomUUID().toString
    // collect all of the statements run in this transaction
    private var statements = mutable.Buffer.empty[() => String]

    def logNeo4J(logData: => String)(f: => StatementResult): StatementResult = {
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

    def run(statementTemplate: String, statementParameters: Record): StatementResult =
      logNeo4J(s"$statementTemplate [${statementParameters.fields().asScala}]"){
        underlying.run(statementTemplate, statementParameters)
      }

    def run(statementTemplate: String): StatementResult =
      logNeo4J(s"$statementTemplate"){
        underlying.run(statementTemplate)
      }

    def run(statementTemplate: String, parameters: Value): StatementResult =
      logNeo4J(s"$statementTemplate [$parameters]"){
        underlying.run(statementTemplate, parameters)
      }

    def run(statementTemplate: String, statementParameters: java.util.Map[String, AnyRef]): StatementResult =
      logNeo4J(s"$statementTemplate [${statementParameters.asScala}]") {
        underlying.run(statementTemplate, statementParameters)
      }

    def run(statement: Statement): StatementResult =
      logNeo4J(s"$statement") {
        underlying.run(statement)
      }

    // TODO MRB: log slow async queries? (we would have to wait for all the results to complete)

    def runAsync(statementTemplate: String, statementParameters: Record): CompletionStage[StatementResultCursor] =
      underlying.runAsync(statementTemplate, statementParameters)

    def runAsync(statementTemplate: String): CompletionStage[StatementResultCursor] =
      underlying.runAsync(statementTemplate)

    def runAsync(statementTemplate: String, parameters: Value): CompletionStage[StatementResultCursor] =
      underlying.runAsync(statementTemplate, parameters)

    def runAsync(statementTemplate: String, statementParameters: java.util.Map[String, AnyRef]): CompletionStage[StatementResultCursor] =
      underlying.runAsync(statementTemplate, statementParameters)

    override def runAsync(statement: Statement): CompletionStage[StatementResultCursor] = {
      underlying.runAsync(statement)
    }

    override def commitAsync(): CompletionStage[Void] = underlying.commitAsync()
    override def rollbackAsync(): CompletionStage[Void] = underlying.rollbackAsync()

    override def typeSystem(): TypeSystem = underlying.typeSystem()

    override def close(): Unit = underlying.close()

    override def success(): Unit = {
      val start = System.currentTimeMillis()

      try {
        underlying.success()
      } finally {
        val timeTaken = System.currentTimeMillis() - start
        if (timeTaken >= config.slowQueryThreshold.toMillis) {
          slowQueryLogger.warn(s"$uuid SLOW NEO4J COMMIT - ${timeTaken}ms: transaction statements: ${statements.map(s => s()).mkString("\n")}")
        } else if(config.logAllQueries) {
          logger.info(s"$uuid NEO4J COMMIT - ${timeTaken}ms: transaction statements: ${statements.map(s => s()).mkString("\n")}")
        }
      }
    }

    override def failure(): Unit = underlying.failure()

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
          _ => tx.failure(),
          _ => tx.success()
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

      val nodesStatementResult = tx.run(
        """MATCH (n) WHERE id(n) IN {nodeIds} RETURN n""",
        parameters("nodeIds", nodeIds.asJava)
      )
      val nodes = nodesStatementResult
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

    val relationshipsStatementResult = tx.run(
      """MATCH ()-[r]->() WHERE id(r) IN {relationshipIds} RETURN r""",
      parameters("relationshipIds", relationshipIds.asJava)
    )
    val relationships = relationshipsStatementResult
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
        tx.failure()
        logger.error("Error attempting to get deadlocked nodes and relationships", ex)
        List()
      }
    } finally {
      tx.close()
    }
  }

  def transaction[T](f: StatementRunner => Either[Failure, T]): Either[Failure, T] = {
    val session = driver.session()
    val tx = session.beginTransaction()
    try {
      val result = f(new LoggingTransaction(tx, queryLoggingConfig))
      if (result.isRight) {
        tx.success()
      } else {
        tx.failure()
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
        tx.failure()
        tx.close()

        val deadlockedNodesAndRelationships = getDeadlockedNodesAndRelationships(session, transientException)
        logger.info(s"""Deadlocked on ${deadlockedNodesAndRelationships.mkString(", ")}""")

        Left(Neo4JTransientFailure(transientException))

      case NonFatal(ex) =>
        tx.failure()

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
  implicit class RichRecords[T <: mutable.Buffer[Record]](result: T) {
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

  implicit class RichStatementResult(result: StatementResult) {
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
