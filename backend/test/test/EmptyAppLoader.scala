package test

import play.api.{ApplicationLoader, BuiltInComponentsFromContext}
import play.api.routing.Router

class EmptyAppLoader extends ApplicationLoader {
  override def load(context: ApplicationLoader.Context) = {
    new BuiltInComponentsFromContext(context) {
      override def router = Router.empty
      override def httpFilters = Nil
    }.application
  }
}
