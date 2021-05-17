import org.apache.poi.ss.formula.functions.T
import org.neo4j.driver.v1.Value
import org.neo4j.driver.v1.exceptions.value.Uncoercible
import utils.attempt.{Attempt, Neo4JValueFailure}

package object model {
  // Used in the email parsing from .pst files where empty strings are used to represent absent values, is that worse than using null? Probably.
  implicit class RichString(v: String) {
    def hasTextOrNone(): Option[String] = Option(v).filter(_.trim.nonEmpty)

    def removeChevrons(): String = v.trim.stripPrefix("<").stripSuffix(">")

    /**
      * This splits a string much like split does but doesn't return a single item list for an empty string and
      * does sensible cleaning on the results
      */
    def splitListClean(regex: String): List[String] = v.split(regex).toList.map(_.trim).filterNot(_.isEmpty)

    /**
      * This splits a string much like split does but doesn't return a single item list for an empty string and
      * does sensible cleaning on the results
      */
    def splitListClean(char: Char): List[String] = v.split(char).toList.map(_.trim).filterNot(_.isEmpty)
  }

  implicit class RichValue(v: Value) {
    def optionally[T](f: Value => T): Option[T] = {
      if (v.isNull) {
        None
      } else {
        Some(f(v))
      }
    }
    def attempt[T](f: Value => T): Attempt[T] = {
      if (v.isNull) {
        Attempt.Left(Neo4JValueFailure("No value"))
      } else {
        Attempt.catchNonFatal(f(v)){
          case u:Uncoercible => Neo4JValueFailure(u.getMessage)
        }
      }
    }
    def attemptOpt[T](f: Value => T): Attempt[Option[T]] = {
      if (v.isNull) {
        Attempt.Right(None)
      } else {
        Attempt.catchNonFatal[Option[T]](Some(f(v))){
          case u:Uncoercible => Neo4JValueFailure(u.getMessage)
        }
      }
    }
  }
}
