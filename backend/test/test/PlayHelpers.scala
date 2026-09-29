package test

import play.api.http.{HeaderNames, Status}
import play.api.test.{DefaultAwaitTimeout, FutureAwaits, ResultExtractors, StubControllerComponentsFactory}

// Play's Helpers object also initializes browser drivers through PlayRunners.
// Compose only the helpers used by our controller and application tests.
object PlayHelpers
  extends HeaderNames
    with Status
    with DefaultAwaitTimeout
    with FutureAwaits
    with ResultExtractors
    with StubControllerComponentsFactory
