package utils

import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import cats.syntax.either._
import model.{Language, Languages, Uri}
import play.api.mvc.{PathBindable, QueryStringBindable}

import scala.language.implicitConversions

object Binders {
  implicit val offsetDateTimeBindable = new PathBindable[OffsetDateTime] {
    override def bind(key: String, value: String) = Either.catchNonFatal(DateTimeFormatter.ISO_OFFSET_DATE_TIME.parse(value, OffsetDateTime.from(_))).left.map(_.toString)
    override def unbind(key: String, value: OffsetDateTime) = DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(value)
  }

  implicit def pathBindable(implicit stringBinder: PathBindable[String]) = new PathBindable[Uri] {
    override def bind(key: String, value: String): Either[String, Uri] = stringBinder.bind(key, value).map(Uri.apply)
    override def unbind(key: String, value: Uri): String = stringBinder.unbind(key, value.value)
  }

  implicit def languageBindable(implicit stringBinder: PathBindable[String]) = new PathBindable[Language] {
    override def bind(key: String, value: String): Either[String, Language] = stringBinder.bind(key, value).flatMap(Languages.getByKey(_).toRight("No such language"))
    override def unbind(key: String, value: Language): String = stringBinder.unbind(key, value.key)
  }

  implicit def languageQueryStringBindable(implicit stringBinder: QueryStringBindable[String]) = new QueryStringBindable[Language] {
    override def bind(key: String, params: Map[String, Seq[String]]): Option[Either[String, Language]] = {
      stringBinder.bind(key, params)
        .map(_.flatMap(Languages.getByKey(_).toRight("No such language")))
    }
    override def unbind(key: String, value: Language): String = stringBinder.unbind(key, value.key)
  }
}
