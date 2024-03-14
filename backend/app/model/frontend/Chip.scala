package model.frontend

import play.api.libs.json._
import services.index.WorkspaceSearchContextParams

case class DropdownOption(label: String, value: String)

sealed trait Chip {
  def name: String
  def template: String
}

case class TextChip(name: String, template: String) extends Chip
case class DateChip(name: String, template: String) extends Chip
// An exclusive date is from the end of a date rather than from teh start.
// Useful when the user wants to say "get me content from after 2018", you don't want to parse 2018 as 2018/01/01 because that includes basically all docs from 2018!
case class ExclusiveDateChip(name: String, template: String) extends Chip
case class DropdownChip(name: String, options: List[DropdownOption], template: String) extends Chip

case class WorkspaceFolderChip(name: String, template: String, workspaceId: String, folderId: String) extends Chip

object WorkspaceFolderChip {
  implicit val workspaceFolderChip = Json.format[WorkspaceFolderChip]
}

object Chip {
  private val plainChipFormat = Json.format[TextChip]
  private val dateChipFormat = Json.format[DateChip]
  private val exclusiveDateChipFormat = Json.format[ExclusiveDateChip]
  private implicit val dropdownOptionFormat = Json.format[DropdownOption]
  private val dropdownChipFormat = Json.format[DropdownChip]

  implicit val format = new Format[Chip] {
    override def reads(json: JsValue): JsResult[Chip] = {
      (json \ "type").get match {
        case JsString("text") => plainChipFormat.reads(json)
        case JsString("dropdown") => dropdownChipFormat.reads(json)
        case JsString("date") => dateChipFormat.reads(json)
        case JsString("date_ex") => exclusiveDateChipFormat.reads(json)
        case JsString("workspace_folder") => WorkspaceFolderChip.workspaceFolderChip.reads(json)
        case other => JsError(s"Unexpected type in chip $other")
      }
    }

    override def writes(chip: Chip): JsValue = {
      chip match {
        case r: TextChip => plainChipFormat.writes(r) + ("type", JsString("text")) - "template"
        case r: DateChip => dateChipFormat.writes(r) + ("type", JsString("date")) - "template"
        case r: ExclusiveDateChip => exclusiveDateChipFormat.writes(r) + ("type", JsString("date_ex")) - "template"
        case r: DropdownChip => dropdownChipFormat.writes(r) + ("type", JsString("dropdown")) - "template"
        case r: WorkspaceFolderChip => WorkspaceFolderChip.workspaceFolderChip.writes(r) + ("t", JsString("workspace_folder")) - "template"
        case other => throw new UnsupportedOperationException(s"Unable to serialize chip of type ${other.getClass.toString}")
      }
    }
  }
}

case class ParsedChips (query: String, workspace: Option[WorkspaceSearchContextParams])

object Chips {
  // TODO - when the index supports attempts we can uncomment these lines to make this attempty
  //def parseQueryString(q: String): Attempt[String] = {
  def parseQueryString(q: String): ParsedChips = {
    //Attempt.catchNonFatal {
    val parsedQ = Json.parse(q)
    // find WorkspaceSearchContextParams
    val workspaceFolder = parsedQ match {
      case JsArray(value) => value.collectFirst {
        case JsObject(o) if o.get("t").map(_.validate[String].get).get == "workspace_folder" => 
            WorkspaceSearchContextParams(o.get("workspaceId").map(_.validate[String].get).get, o.get("folderId").map(_.validate[String].get).get)
      }
      case _ => None
    }

    val query = parsedQ match {
      case JsArray(v) => v.toList.filter {
        // remove workspace_folder chips
        case JsObject(o) if o.get("t").map(_.validate[String].get).get == "workspace_folder" => false
        case _ => true
      }.map {
        // When typing a new chip, we end up with a dangling + which is illegal in the ES query syntax.
        // This doesn't matter if you start a chip before an existing term or in between two existing.
        // In that case it will be parsed as the boolean operator attached to the subsequent term.
        // Weirdly this seems to work even if it's just whitespace after the plus so no need to trim
        case JsString(s) if s.endsWith("+") || s.endsWith("-") =>
          s.substring(0, s.length - 1)
        case JsString(s) =>
          s
        case JsObject(o) =>
          val name: String = o.get("n").map(_.validate[String].get).get
          val value: String = o.get("v").map(_.validate[String].get).get
          val op: String = o.get("op").map(_.validate[String].get).get

          val template: String = all.find(suggestion => suggestion.name == name).map(_.template).get

          // The query syntax will fail to parse with text() so we convert to text("") if no value is set
          // which happens when you've inserted the chip but haven't typed into it yet
          val sanitisedValue = if(value.isEmpty) { "\"\"" } else  { value }

          op + template.replace("_word_", sanitisedValue)
        case _ => throw new UnsupportedOperationException("Invalid json type in query array")
      }.mkString(" ")
      case _ => throw new UnsupportedOperationException("Outer json type must be an array")
    }
    ParsedChips(query, workspaceFolder)
    //  } {
    //  case s: Exception => ClientFailure(s"Invalid query: ${s.getMessage}")
    //}
  }

  val all: List[Chip] = List(
    TextChip("Body Text", "(text:(_word_) OR metadata.html:(_word_))"),
    TextChip("File Path", "metadata.fileUris.\\*:(_word_)"),
    TextChip("Mime Type", "metadata.mimeTypes:(_word_)"),
    TextChip("Email From", "(metadata.from.name.\\*:(_word_) OR metadata.from.address:(_word_))"),
    TextChip("Email Recipient", "(metadata.recipients.name.\\*:(_word_) OR metadata.recipients.address:(_word_))"),
    TextChip("Email Subject", "metadata.subject.\\*:(_word_)"),
    DateChip("Created Before", "createdAt:<_word_"),
    ExclusiveDateChip("Created After", "createdAt:>_word_"),
    DropdownChip("Has Field", List(
      DropdownOption("OCR", "ocr"),
      DropdownOption("Text", "text"),
      DropdownOption("Author", "metadata.enrichedMetadata.author"),
    ), "_exists_:(_word_)")
  )
}
