import play.api.libs.json.{JsObject, JsValue, Json}
import sbt._

import scala.collection.mutable

/** Generates Scala case classes from the transcription service worker interface JSON schema.
  *
  * The schema is produced by Zod in the transcription-service repo, so it uses a small, predictable
  * subset of JSON Schema. This generator handles exactly that subset:
  *
  *   - `$defs` + `$ref` (all shared types are `$ref`d, so names are preserved and shapes deduplicated)
  *   - `type: object` with `properties` / `required`             -> case class + Play JSON `Format`
  *   - `type: string` with `enum`                                -> sealed trait + case objects
  *   - `type: string` with `const`                               -> discriminator, lifted out of the
  *                                                                  constructor into a companion `val`
  *   - `oneOf` of `$ref`s that share a `const` property          -> sealed trait + discriminated `Reads`
  *   - inline objects / enums                                    -> synthetic named types, deduplicated
  *                                                                  by structure (so the four identical
  *                                                                  `combinedOutputUrl` objects collapse
  *                                                                  into a single `CombinedOutputUrl`)
  *
  * Anything outside that subset (`allOf`, `anyOf`, tuple `items`, `patternProperties`, ...) raises,
  * rather than silently generating something wrong.
  */
object TranscriptionWorkerInterfaceGenerator {

  def generate(schemaFile: File, packageName: String): String =
    new Generator(Json.parse(IO.read(schemaFile)), packageName, schemaFile.getName).render()

  // ---------------------------------------------------------------------------------------------
  // Model
  // ---------------------------------------------------------------------------------------------

  private final case class Field(jsonName: String, scalaName: String, tpe: String, optional: Boolean) {
    def declaredType: String = if (optional) s"Option[$tpe]" else tpe
  }

  private sealed trait Decl { def name: String }

  private final case class EnumDecl(name: String, values: Seq[String]) extends Decl

  private final case class ClassDecl(
      name: String,
      fields: Seq[Field],
      consts: Seq[(String, String)], // json property name -> constant value
      parents: Seq[String]
  ) extends Decl

  private final case class UnionDecl(
      name: String,
      discriminator: String,
      branches: Seq[String],
      common: Seq[Field]
  ) extends Decl

  // ---------------------------------------------------------------------------------------------
  // Generator
  // ---------------------------------------------------------------------------------------------

  private final class Generator(root: JsValue, packageName: String, schemaFileName: String) {

    private val defs: Seq[(String, JsValue)] =
      root.as[JsObject].value.get("$defs").map(objectFields).getOrElse(
        sys.error("Schema has no `$defs` - expected the Zod output to register named definitions")
      )

    private val defsByName: Map[String, JsValue] = defs.toMap

    /** Declarations in emission order. */
    private val decls = mutable.LinkedHashMap.empty[String, Decl]

    /** Structural key -> generated name, so identical inline schemas share one type. */
    private val syntheticByShape = mutable.LinkedHashMap.empty[String, String]

    /** Branch name -> traits it must extend. */
    private val parents = mutable.LinkedHashMap.empty[String, mutable.ListBuffer[String]]

    // -- building -------------------------------------------------------------------------------

    def render(): String = {
      // Unions first, so branch classes know their parents before we build them.
      defs.foreach { case (name, schema) => if (isUnion(schema)) buildUnion(name, schema) }
      defs.foreach {
        case (name, schema) if isUnion(schema) => ()
        case (name, schema) if isEnum(schema)  => register(EnumDecl(name, stringEnumValues(schema)))
        case (name, schema)                    => buildClass(name, schema)
      }
      emit()
    }

    private def register(decl: Decl): Unit =
      decls.get(decl.name) match {
        case Some(existing) if existing == decl => ()
        case Some(_) => sys.error(s"Duplicate definition for type `${decl.name}`")
        case None    => decls += decl.name -> decl
      }

    private def isUnion(schema: JsValue): Boolean = schema.as[JsObject].value.contains("oneOf")
    private def isEnum(schema: JsValue): Boolean = schema.as[JsObject].value.contains("enum")

    private def stringEnumValues(schema: JsValue): Seq[String] = {
      require(
        schema.as[JsObject].value.get("type").map(_.as[String]).contains("string"),
        s"Only string enums are supported, got: ${Json.stringify(schema)}"
      )
      schema("enum").as[List[String]]
    }

    private def refName(schema: JsValue): Option[String] =
      schema.as[JsObject].value.get("$ref").map(_.as[String]).map {
        case r if r.startsWith("#/$defs/") => r.stripPrefix("#/$defs/")
        case other                         => sys.error(s"Unsupported `$$ref`: $other")
      }

    private def buildUnion(name: String, schema: JsValue): Unit = {
      val branches = schema("oneOf").as[List[JsValue]].map { branch =>
        refName(branch).getOrElse(
          sys.error(
            s"Branch of `oneOf` in `$name` is inline rather than a `$$ref`. Register it as a named " +
              "Zod schema so the generated Scala type has a meaningful name."
          )
        )
      }

      val branchSchemas =
        branches.map(b => b -> defsByName.getOrElse(b, sys.error(s"Unknown `$$ref` target `$b`")))

      // The discriminator is the one property that is a `const` in every branch, with a distinct
      // value per branch.
      val candidates = branchSchemas.map { case (_, s) => constProperties(s).keySet }
      val shared = candidates.reduceOption(_ intersect _).getOrElse(Set.empty)
      val discriminator = shared.find { prop =>
        val values = branchSchemas.map { case (_, s) => constProperties(s)(prop) }
        values.distinct.size == values.size
      }.getOrElse(
        sys.error(
          s"Could not find a discriminator for union `$name`: no `const` property is present in " +
            "every branch with a distinct value. Use `z.discriminatedUnion` in the source Zod schema."
        )
      )

      branches.foreach(b => parents.getOrElseUpdate(b, mutable.ListBuffer.empty) += name)

      // Common members are the properties required by *every* branch (excluding the discriminator,
      // which the trait declares explicitly). Types are taken from the first branch.
      val (firstName, firstSchema) = branchSchemas.head
      val sharedProps = branchSchemas.map { case (_, s) => requiredNonConstProperties(s) }
        .reduceOption(_ intersect _)
        .getOrElse(Set.empty)
      val firstOrder = properties(firstSchema).map(_._1)
      val common = firstOrder
        .filter(sharedProps.contains)
        .map(p => field(firstName, p, properties(firstSchema).toMap.apply(p), optional = false))

      register(UnionDecl(name, discriminator, branches, common))
    }

    private def constProperties(schema: JsValue): Map[String, String] =
      properties(schema).collect {
        case (prop, s) if s.as[JsObject].value.contains("const") => prop -> s("const").as[String]
      }.toMap

    private def requiredNonConstProperties(schema: JsValue): Set[String] = {
      val consts = constProperties(schema).keySet
      required(schema).filterNot(consts.contains)
    }

    private def required(schema: JsValue): Set[String] =
      schema.as[JsObject].value.get("required").map(_.as[Set[String]]).getOrElse(Set.empty)

    private def buildClass(name: String, schema: JsValue): Unit = {
      require(
        schema.as[JsObject].value.get("type").map(_.as[String]).contains("object"),
        s"Unsupported definition `$name`: ${Json.stringify(schema)}"
      )
      val props = properties(schema)
      val req = required(schema)

      val consts = props.collect {
        case (p, s) if s.as[JsObject].value.contains("const") => p -> s("const").as[String]
      }.toList
      val fields = props.toList.collect {
        case (p, s) if !s.as[JsObject].value.contains("const") => field(name, p, s, optional = !req.contains(p))
      }

      register(ClassDecl(name, fields, consts, parents.get(name).map(_.toList).getOrElse(Nil)))
    }

    private def field(owner: String, propName: String, schema: JsValue, optional: Boolean): Field =
      Field(propName, escape(propName), typeOf(owner, propName, schema), optional)

    /** Resolves a property schema to a Scala type name, registering synthetic types as needed. */
    private def typeOf(owner: String, propName: String, schema: JsValue): String =
      refName(schema) match {
        case Some(target) => target
        case None =>
          schema.as[JsObject].value.get("type").map(_.as[String]) match {
            case Some("string") if schema.as[JsObject].value.contains("enum") =>
              synthetic(schema, typeName(propName), s => EnumDecl(s, stringEnumValues(schema)))
            case Some("string")  => "String"
            case Some("boolean") => "Boolean"
            case Some("number")  => "Double"
            case Some("integer") => "Long"
            case Some("array") =>
              val items = schema.as[JsObject].value.getOrElse("items", sys.error(s"`$owner.$propName` array has no `items`"))
              s"List[${typeOf(owner, singular(propName), items)}]"
            case Some("object") =>
              synthetic(
                schema,
                typeName(propName),
                { s =>
                  val props = properties(schema)
                  val req = required(schema)
                  ClassDecl(
                    s,
                    props.toList.map { case (p, ps) => field(s, p, ps, optional = !req.contains(p)) },
                    consts = Nil,
                    parents = Nil
                  )
                }
              )
            case other =>
              sys.error(s"Unsupported schema for `$owner.$propName` (type=$other): ${Json.stringify(schema)}")
          }
      }

    /** Registers an inline type once per distinct shape, reusing the name for identical shapes. */
    private def synthetic(schema: JsValue, preferredName: String, make: String => Decl): String = {
      val shape = Json.stringify(schema)
      syntheticByShape.getOrElseUpdate(
        shape, {
          val name = uniqueName(preferredName)
          // Reserve the name before recursing, in case of nested inline objects.
          decls += name -> ClassDecl(name, Nil, Nil, Nil)
          val decl = make(name)
          decls += name -> decl
          name
        }
      )
    }

    private def uniqueName(preferred: String): String =
      if (!decls.contains(preferred) && !defsByName.contains(preferred)) preferred
      else
        Iterator
          .from(2)
          .map(i => s"$preferred$i")
          .find(n => !decls.contains(n) && !defsByName.contains(n))
          .get

    /** Object members, in schema declaration order. */
    private def objectFields(value: JsValue): Seq[(String, JsValue)] =
      value.as[JsObject].fields

    private def properties(schema: JsValue): Seq[(String, JsValue)] =
      schema.as[JsObject].value.get("properties").map(objectFields).getOrElse(Nil)

    // -- emitting -------------------------------------------------------------------------------

    private def emit(): String = {
      val sb = new StringBuilder

      sb.append(s"""package $packageName
                   |
                   |import play.api.libs.json._
                   |
                   |// AUTO-GENERATED - DO NOT EDIT.
                   |//
                   |// Generated from $schemaFileName by `sbt generateTranscriptionWorkerInterface`.
                   |// Re-run that task after updating the schema, and commit the result.
                   |""".stripMargin)

      decls.values.foreach {
        case d: EnumDecl  => sb.append("\n").append(emitEnum(d))
        case d: UnionDecl => sb.append("\n").append(emitUnion(d))
        case d: ClassDecl => sb.append("\n").append(emitClass(d))
      }

      sb.toString
    }

    private def emitEnum(d: EnumDecl): String = {
      val members = d.values.map(v => s"""  case object ${typeName(v)} extends ${d.name}("$v")""").mkString("\n")
      val all = d.values.map(typeName).mkString(", ")
      s"""sealed abstract class ${d.name}(val value: String)
         |
         |object ${d.name} {
         |$members
         |
         |  val All: Seq[${d.name}] = Seq($all)
         |
         |  def fromString(value: String): Option[${d.name}] = All.find(_.value == value)
         |
         |  implicit val reads: Reads[${d.name}] = Reads {
         |    case JsString(value) =>
         |      fromString(value).fold[JsResult[${d.name}]](JsError(s"Unknown ${d.name}: $$value"))(JsSuccess(_))
         |    case other => JsError(s"Expected a JSON string for ${d.name}, got: $$other")
         |  }
         |
         |  implicit val writes: Writes[${d.name}] = Writes(value => JsString(value.value))
         |}
         |""".stripMargin
    }

    private def emitUnion(d: UnionDecl): String = {
      val members =
        (d.common.map(f => s"  def ${f.scalaName}: ${f.declaredType}") :+
          s"  def ${escape(d.discriminator)}: String").mkString("\n")

      val readCases = d.branches.map { b =>
        s"      case $b.${constValName(d.discriminator)} => json.validate[$b]"
      }.mkString("\n")

      val writeCases = d.branches.map(b => s"    case value: $b => Json.toJson(value)").mkString("\n")

      s"""sealed trait ${d.name} {
         |$members
         |}
         |
         |object ${d.name} {
         |  implicit val reads: Reads[${d.name}] = Reads { json =>
         |    (json \\ "${d.discriminator}").validate[String].flatMap {
         |$readCases
         |      case other => JsError(s"Unknown ${d.name} ${d.discriminator}: $$other")
         |    }
         |  }
         |
         |  implicit val writes: Writes[${d.name}] = Writes {
         |$writeCases
         |  }
         |}
         |""".stripMargin
    }

    private def emitClass(d: ClassDecl): String = {
      val extendsClause = if (d.parents.isEmpty) "" else d.parents.mkString(" extends ", " with ", "")

      val params =
        if (d.fields.isEmpty) ""
        else d.fields.map(f => s"    ${f.scalaName}: ${f.declaredType}").mkString("\n", ",\n", "\n")

      val body =
        if (d.consts.isEmpty) ""
        else
          d.consts
            .map(c => s"  def ${escape(c._1)}: String = ${d.name}.${constValName(c._1)}")
            .mkString(" {\n", "\n", "\n}")

      val constVals =
        if (d.consts.isEmpty) ""
        else d.consts.map(c => s"""  val ${constValName(c._1)}: String = "${c._2}"""").mkString("", "\n", "\n\n")

      // `Json.reads` ignores the discriminator in the incoming JSON (it is implied by the type);
      // `Json.writes` has to add it back on the way out.
      val codecs =
        if (d.fields.isEmpty) {
          val obj = d.consts.map { case (k, v) => s""""$k" -> "$v"""" }.mkString(", ")
          s"""  implicit val reads: Reads[${d.name}] = Reads(_ => JsSuccess(${d.name}()))
             |  implicit val writes: OWrites[${d.name}] = OWrites(_ => Json.obj($obj))""".stripMargin
        } else if (d.consts.isEmpty) {
          s"  implicit val format: OFormat[${d.name}] = Json.format[${d.name}]"
        } else {
          val obj = d.consts.map { case (k, _) => s""""$k" -> ${constValName(k)}""" }.mkString(", ")
          s"""  implicit val reads: Reads[${d.name}] = Json.reads[${d.name}]
             |
             |  implicit val writes: OWrites[${d.name}] =
             |    Json.writes[${d.name}].transform((json: JsObject) => json ++ Json.obj($obj))""".stripMargin
        }

      s"""final case class ${d.name}($params)$extendsClause$body
         |
         |object ${d.name} {
         |$constVals$codecs
         |}
         |""".stripMargin
    }
  }

  // -----------------------------------------------------------------------------------------------
  // Naming helpers
  // -----------------------------------------------------------------------------------------------

  private val ScalaKeywords = Set(
    "abstract", "case", "catch", "class", "def", "do", "else", "extends", "false", "final", "finally",
    "for", "forSome", "if", "implicit", "import", "lazy", "match", "new", "null", "object", "override",
    "package", "private", "protected", "return", "sealed", "super", "this", "throw", "trait", "try",
    "true", "type", "val", "var", "while", "with", "yield"
  )

  private def escape(name: String): String = if (ScalaKeywords.contains(name)) s"`$name`" else name

  private def constValName(propName: String): String = s"${typeName(propName)}Value"

  /** "llm-translation" -> "LlmTranslation", "INVALID_URL" -> "InvalidUrl", "TranscriptionService" -> unchanged. */
  private def typeName(raw: String): String =
    raw
      .split("[^A-Za-z0-9]+")
      .filter(_.nonEmpty)
      .map(part => if (part.forall(c => !c.isLower)) part.toLowerCase else part)
      .map(part => part.head.toUpper + part.tail)
      .mkString

  private def singular(name: String): String = if (name.endsWith("s")) name.dropRight(1) else name
}








