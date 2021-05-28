import play.api.ApplicationLoader.Context
import play.api.{Application, ApplicationLoader, Configuration, LoggerConfigurator}
import services.Config
import utils.{AwsDiscovery, DiscoveryResult}

class AppLoader extends ApplicationLoader {
  override def load(contextBefore: Context): Application = {
    val discoveryResult = discoverConfig(contextBefore)
    val config = discoveryResult.updatedConfig

    val contextAfter = contextBefore.copy(initialConfiguration = Configuration(config.underlying))

    startLogging(contextAfter, discoveryResult)
    new AppComponents(contextAfter, config).application
  }

  private def discoverConfig(context: Context): DiscoveryResult = {
    val config = Config(context.initialConfiguration.underlying)

    config.aws match {
      case Some(discoveryConfig) =>
        AwsDiscovery.build(config, discoveryConfig)

      case _ =>
        DiscoveryResult(config, Map.empty)
    }
  }

  private def startLogging(context: Context, discoveryResult: DiscoveryResult): Unit = {
    LoggerConfigurator(context.environment.classLoader).foreach {
      _.configure(context.environment, context.initialConfiguration, discoveryResult.jsonLoggingProperties)
    }
  }
}
