package utils

import org.apache.pekko.stream.Materializer
import play.api.mvc.{Filter, RequestHeader, Result}

import scala.concurrent.{ExecutionContext, Future}

class AllowFrameFilter(implicit val mat: Materializer, ec: ExecutionContext) extends Filter with Logging {
  override def apply(f: RequestHeader => Future[Result])(rh: RequestHeader): Future[Result] = {
    val allow = rh.path.startsWith("/third-party/pdfjs")

    if(allow) {
      f(rh).map { r =>
        r.withHeaders("X-Frame-Options" -> "SAMEORIGIN")
      }
    } else {
      f(rh)
    }
  }
}
