import play.api.ApplicationLoader.Context
import play.api.{Application, ApplicationLoader, Configuration, LoggerConfigurator}
import services.Config
import utils.AwsDiscovery

class AppLoader extends ApplicationLoader {
  override def load(contextBefore: Context): Application = {
    val config = getConfig(contextBefore)
    val contextAfter = contextBefore.copy(initialConfiguration = Configuration(config.underlying))

    startLogging(contextAfter)
    new AppComponents(contextAfter, config).application
  }

  private def getConfig(context: Context): Config = {
    val config = Config(context.initialConfiguration.underlying)

    config.aws match {
      case Some(discoveryConfig) =>
        AwsDiscovery.build(config, discoveryConfig)

      case _ =>
        config
    }
  }

  private def startLogging(context: Context): Unit = {
    LoggerConfigurator(context.environment.classLoader).foreach {
      _.configure(context.environment)
    }
  }
}
