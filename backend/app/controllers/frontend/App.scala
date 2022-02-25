package controllers.frontend

import controllers.Assets
import model.frontend.ClientConfig
import play.api.libs.json.Json.obj
import play.api.libs.json.{JsObject, JsString, Json}
import play.api.mvc.{AbstractController, AnyContent, ControllerComponents, Request}
import services.{AWSDiscoveryConfig, Config}
import utils.auth.providers.UserProvider

import scala.concurrent.Future

class App (components: ControllerComponents, assets: Assets, config: Config,
           userProvider: UserProvider, awsDiscovery: Option[AWSDiscoveryConfig])
  extends AbstractController(components) {
  
  def index = {
    assets.at("index.html")
  }

  def assetOrBundle(path: String) = Action.async { implicit req: Request[AnyContent] =>
    // Try assets first. If not then it is a route in the SPA so serve the app bundle
    assets.at(path)(req).flatMap { result =>
      if(result.header.status == 404) {
        index(req)
      } else {
        Future.successful(result)
      }
    }(controllerComponents.executionContext)
  }

  def manifest = Action {
    val buildInfo = Map(
      "build" -> Json.parse(utils.buildinfo.BuildInfo.toJson)
    )

    val environment = awsDiscovery.map { config =>
      Map(
        "stack" -> JsString(config.stack),
        "stage" -> JsString(config.stage)
      )
    }.getOrElse(Map.empty)

    Ok(JsObject(buildInfo ++ environment))
  }

  def configuration = Action {
    Ok(Json.toJson(
      ClientConfig(
        config.app.label,
        config.app.readOnly,
        config.auth.provider.name,
        userProvider.clientConfig,
        config.app.hideDownloadButton
      )
    ))
  }
}
