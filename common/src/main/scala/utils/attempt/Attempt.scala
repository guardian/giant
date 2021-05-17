package utils.attempt

import cats.data.EitherT

import scala.collection.generic.CanBuildFrom
import scala.concurrent.{ExecutionContext, Future}
import scala.language.higherKinds
import scala.util.control.NonFatal

/**
  * Represents a value that will need to be calculated using an asynchronous
  * computation that may fail.
  */
case class Attempt[A] private (underlying: Future[Either[Failure, A]]) {
  def foreach[U](f: A => U)(implicit ec: ExecutionContext): Unit =
    asFuture.foreach {
      case Right(a) => f(a)
      case _ => ()
    }

  def map[B](f: A => B)(implicit ec: ExecutionContext): Attempt[B] =
    flatMap(a => Attempt.Right(f(a)))

  def flatMap[B](f: A => Attempt[B])(implicit ec: ExecutionContext): Attempt[B] = Attempt {
    asFuture.flatMap {
      case Right(a) => f(a).asFuture
      case Left(e) => Future.successful(Left(e))
    }
  }

  def fold[B](failure: Failure => B, success: A => B)(implicit ec: ExecutionContext): Future[B] = {
    asFuture.map(_.fold(failure, success))
  }

  def map2[B, C](bAttempt: Attempt[B])(f: (A, B) => C)(implicit ec: ExecutionContext): Attempt[C] = {
    for {
      a <- this
      b <- bAttempt
    } yield f(a, b)
  }

  def zipWith[U, R](that: Attempt[U])(f: (A, U) => R)(implicit executor: ExecutionContext): Attempt[R] =
    flatMap(r1 => that.map(r2 => f(r1, r2)))

  def recoverWith(pf: PartialFunction[Failure, Attempt[A]])(implicit ec: ExecutionContext) = Attempt {
    asFuture.flatMap {
      case Right(a) =>
        Attempt.Right(a).asFuture

      case Left(err) =>
        val ret = pf.lift(err) match {
          case Some(attempt) => attempt
          case None => Attempt.Left[A](err)
        }

        ret.asFuture
    }
  }

  def transform[B](sf: A => Attempt[B], ef: Failure => Attempt[B])(implicit ec: ExecutionContext) = Attempt {
    asFuture.flatMap {
      case Right(a) => sf(a).asFuture
      case Left(err) => ef(err).asFuture
    }
  }

  /**
    * If there is an error in the Future itself (e.g. a timeout) we convert it to a
    * Left so we have a consistent error representation. Unfortunately, this means
    * the error isn't being handled properly so we're left with just the information
    * provided by the exception.
    *
    * Try to avoid hitting this method's failure case by always handling Future errors
    * and creating a suitable failure instance for the problem.
    */
  def asFuture(implicit ec: ExecutionContext): Future[Either[Failure, A]] = {
    underlying recover { case err =>
      scala.Left(UnknownFailure(err))
    }
  }

  /** The current value of this `Attempt`.
    *  If the underlying future was not completed the returned value will be `None`.
    *  If the underlying future was completed the value will be `Some(Either.Right(A))`
    *  if it contained a valid result, or `Some(Either.Left(failure))` if it contained
    *  a failure or the future contained an exception.
    */
  def value: Option[Either[Failure, A]] = {
    underlying.value.map {
      case scala.util.Success(result) => result
      case scala.util.Failure(err) => scala.Left(UnknownFailure(err))
    }
  }

  def toEitherT: EitherT[Future, Failure, A] = EitherT(underlying)

  def isSuccess(implicit ec: ExecutionContext): Future[Boolean] = fold(_ => false, _ => true)
  def isFailure(implicit ec: ExecutionContext): Future[Boolean] = fold(_ => true, _ => false)
}

object Attempt {
  /**
    * Changes generated `Traversable[Attempt[A]]` to `Attempt[Traversable[A]]` via provided
    * traversal function (like `Future.traverse`).
    *
    * This implementation returns the first failure in the resulting list,
    * or the successful result.
    */
  def traverse[A, B, M[X] <: TraversableOnce[X]](as: M[A])(f: A => Attempt[B])(implicit cbf: CanBuildFrom[M[A], B, M[B]], ec: ExecutionContext): Attempt[M[B]] = {
    as.foldLeft(Right(cbf(as))) {
      (attempt, a) => attempt.zipWith(f(a))(_ += _)
    }.map(_.result())
  }

  /**
    * Option doesn't implement TraversableOnce, so here is a helper to invert it
    */
  def traverseOption[A, B](a: Option[A])(f: A => Attempt[B])(implicit ec: ExecutionContext): Attempt[Option[B]] = {
    a match {
      case None => Attempt.Right(None)
      case Some(a) => f(a).map(Some.apply)
    }
  }

  /**
    * Using the provided traversal function, sequence the resulting attempts
    * into a list that preserves failures.
    *
    * This is useful if failure is acceptable in part of the application.
    */
  def traverseWithFailures[A, B](as: List[A])(f: A => Attempt[B])(implicit ec: ExecutionContext): Attempt[List[Either[Failure, B]]] = {
    sequenceWithFailures(as.map(f))
  }

  /**
    * As with `Future.sequence`, changes `Traversable[Attempt[A]]` to `Traversable[List[A]]`.
    *
    * This implementation returns the first failure in the list, or the successful result.
    */
  def sequence[A, M[X] <: TraversableOnce[X]](in: M[Attempt[A]])(implicit cbf: CanBuildFrom[M[Attempt[A]], A, M[A]], executor: ExecutionContext): Attempt[M[A]] = {
    traverse(in)(identity)
  }

  /**
    * Option doesn't implement TraversableOnce so this is a little helper to invert it.
    */
  def sequenceOption[A](option: Option[Attempt[A]])(implicit ec: ExecutionContext): Attempt[Option[A]] = {
    traverseOption(option)(identity)
  }

  /**
    * Sequence these attempts into a list that preserves failures.
    *
    * This is useful if failure is acceptable in part of the application.
    */
  def sequenceWithFailures[A](attempts: List[Attempt[A]])(implicit ec: ExecutionContext): Attempt[List[Either[Failure, A]]] = {
    async.Right(Future.traverse(attempts)(_.asFuture))
  }

  def fromEither[A](e: Either[Failure, A]): Attempt[A] =
    Attempt(Future.successful(e))

  def fromOption[A](optA: Option[A], ifNone: => Attempt[A]): Attempt[A] =
    optA match {
      case Some(a) => Attempt.Right(a)
      case None => ifNone
    }

  /**
    * Run f and catch any non-fatal exceptions from the execution. This is typically used to wrap IO SDK calls.
    * @param f function to run
    * @param recovery partial function to convert thrown exceptions to Failure types
    */
  def catchNonFatal[A](f: => A)(recovery: PartialFunction[Throwable, Failure]): Attempt[A] = {
    try {
      Attempt.Right(f)
    } catch {
      case NonFatal(t) => Attempt.Left(recovery.lift(t).getOrElse(UnknownFailure(t)))
    }
  }

  /**
    * Run f and convert all non fatal exceptions to UnknownFailures. Best practice is to use catchNonFatal
    * instead but this can be used when you don't know what kind of exceptions will be thrown or you have a blasé attitude.
    */
  def catchNonFatalBlasé[A](f: => A): Attempt[A] = catchNonFatal(f)(Map.empty)

  /**
    * Convert a plain `Future` value to an attempt by providing a recovery handler.
    */
  def fromFuture[A](future: Future[A])(recovery: PartialFunction[Throwable, Failure])(implicit ec: ExecutionContext): Attempt[A] = {
    Attempt {
      future
        .map(scala.Right(_))
        .recover { case t =>
          scala.Left(recovery(t))
        }
    }
  }

  /**
    * Convert a plain `Future` value to an attempt by converting all non-fatal exceptions to UnknownFailures.
    */
  def fromFutureBlasé[A](future: Future[A])(implicit ec: ExecutionContext): Attempt[A] = {
    fromFuture(future) { case NonFatal(e) => UnknownFailure(e) }
  }

  /**
    * Discard failures from a list of attempts.
    *
    * **Use with caution**.
    */
  def successfulAttempts[A](attempts: List[Attempt[A]])(implicit ec: ExecutionContext): Attempt[List[A]] = {
    Attempt.async.Right {
      Future.traverse(attempts)(_.asFuture).map(_.collect { case Right(a) => a })
    }
  }

  /**
    * Create an Attempt instance from a "good" value.
    */
  def Right[A](a: A): Attempt[A] =
    Attempt(Future.successful(scala.Right(a)))

  /**
    * Syntax sugar to create an Attempt failure if there's only a single error.
    */
  def Left[A](err: Failure): Attempt[A] =
    Attempt(Future.successful(scala.Left(err)))

  /**
    * Asynchronous versions of the Attempt Right/Left helpers for when you have
    * a Future that returns a good/bad value directly.
    */
  object async {
    /**
      * Run f asynchronously and catch any non-fatal exceptions from the execution. This is typically used to wrap IO
      * SDK calls.
      * @param f function to run asynchronously
      * @param recovery partial function to convert thrown exceptions to Failure types
      */
    def catchNonFatal[A](f: => A)(recovery: PartialFunction[Throwable, Failure])(implicit ec: ExecutionContext): Attempt[A] =
      Attempt(Future(scala.Right(f)).recover {
        case NonFatal(t) => scala.Left(recovery.lift(t).getOrElse(UnknownFailure(t)))
      })

    /**
      * Run f asynchronously and convert all non fatal exceptions to UnknownFailures. Best practice is to use
      * catchNonFatal instead but this can be used when you don't know what kind of exceptions will be thrown or you
      * have a blasé attitude to exceptions.
      */
    def catchNonFatalBlasé[A](f: => A)(implicit ec: ExecutionContext): Attempt[A] = catchNonFatal(f)(Map.empty)

    /**
      * Create an Attempt from a Future of a good value.
      */
    def Right[A](fa: Future[A])(implicit ec: ExecutionContext): Attempt[A] =
      Attempt(fa.map(scala.Right(_)))

    /**
      * Create an Attempt from a known failure in the future. For example,
      * if a piece of logic fails but you need to make a Database/API call to
      * get the failure information.
      */
    def Left[A](ferr: Future[Failure])(implicit ec: ExecutionContext): Attempt[A] =
      Attempt(ferr.map(scala.Left(_)))
  }
}
