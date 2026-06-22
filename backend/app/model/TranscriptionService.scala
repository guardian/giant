package model

import play.api.libs.json.{Format, JsError, JsResult, JsValue, Json, Reads, Writes}

// NOTE: these types need to be kept in sync with the corresponding types in the transcription service:
// https://github.com/guardian/transcription-service/blob/main/packages/common/src/types.ts
case class SignedUrl(url: String, key: String)
object SignedUrl {
  implicit val formats: Format[SignedUrl] = Json.format[SignedUrl]
}

trait Job {
  def id: String
  def originalFilename: String
  def inputSignedUrl: String
  def sentTimestamp: String
  def userEmail: String
  def transcriptDestinationService: String
  def combinedOutputUrl: CombinedOutputUrl
  def ingestion: String
}

case class LlmPrompt(system: Option[String], user: String, assistant: Option[String])
object LlmPrompt {
  implicit val formats: Format[LlmPrompt] = Json.format[LlmPrompt]
}

case class CombinedOutputUrl(url: String, key: String)
object CombinedOutputUrl {
  implicit val formats: Format[CombinedOutputUrl] = Json.format[CombinedOutputUrl]
}

case class TranscriptionJob(id: String, originalFilename: String, inputSignedUrl: String, sentTimestamp: String,
                            userEmail: String, transcriptDestinationService: String,
                            combinedOutputUrl: CombinedOutputUrl, languageCode: String, translate: Boolean,
                            diarize: Boolean, engine: String, ingestion: String, jobType: String) extends Job

case class LlmJob(id: String, originalFilename: String, inputSignedUrl: String, sentTimestamp: String,
                  userEmail: String, transcriptDestinationService: String,
                  combinedOutputUrl: CombinedOutputUrl, backend: String, ingestion: String, jobType: String) extends Job

object LlmJob {
  implicit val formats: Format[LlmJob] = Json.format[LlmJob]
}

object TranscriptionJob {
  implicit val formats: Format[TranscriptionJob] = Json.format[TranscriptionJob]
}
case class TranscriptionMetadata(detectedLanguageCode: Language)
object TranscriptionMetadata {
  implicit val languageReads: Reads[Language] = Reads.of[String].map { code =>
    Languages.getByIso6391Code(code).getOrElse(English)
  }
  implicit val languageWrites: Writes[Language] = Writes.of[String].contramap(_.iso6391Code)
  implicit val formats: Format[TranscriptionMetadata] = Json.format[TranscriptionMetadata]
}
case class Transcripts(srt: String, text: String, json: String)
case class TranscriptionResult(transcripts: Transcripts, transcriptTranslations: Option[Transcripts], metadata: TranscriptionMetadata)
object TranscriptionResult {
  implicit val transcriptsFormat: Format[Transcripts] = Json.format[Transcripts]
  implicit val formats: Format[TranscriptionResult] = Json.format[TranscriptionResult]
}

sealed trait TranscriptionOutput {
  def id: String
  def status: String
}

case class TranscriptionOutputSuccess(
                                       id: String,
                                       originalFilename: String,
                                       userEmail: String,
                                       status: String,
                                       languageCode: String,
                                       combinedOutputKey: String,
                                     ) extends TranscriptionOutput

case class TranscriptionOutputFailure(
                                       id: String,
                                       originalFilename: String,
                                       userEmail: String,
                                       status: String,
                                       noAudioDetected: Boolean
                                     ) extends TranscriptionOutput

object TranscriptionOutputSuccess {
  implicit val format: Format[TranscriptionOutputSuccess] = Json.format[TranscriptionOutputSuccess]
}

object TranscriptionOutputFailure {
  implicit val format: Format[TranscriptionOutputFailure] = Json.format[TranscriptionOutputFailure]
}

case class LlmOutputSuccess(
      id: String,
      status: String,
      userEmail: String,
      outputKey: String
    ) extends TranscriptionOutput

object LlmOutputSuccess {
  implicit val format: Format[LlmOutputSuccess] = Json.format[LlmOutputSuccess]
}

case class LlmOutputFailure(
      id: String,
      status: String,
    ) extends TranscriptionOutput
object LlmOutputFailure {
  implicit val format: Format[LlmOutputFailure] = Json.format[LlmOutputFailure]
}

object TranscriptionOutput {
  // Custom Reads to handle both message types
  implicit val transcriptionOutputReads: Reads[TranscriptionOutput] = new Reads[TranscriptionOutput] {
    def reads(json: JsValue): JsResult[TranscriptionOutput] = {
      (json \ "status").as[String] match {
        // NOTE: These statuses are defined in the transcription service:
        // https://github.com/guardian/transcription-service/blob/main/packages/common/src/types.ts
        case "SUCCESS" => json.validate[TranscriptionOutputSuccess]
        case "LLM_SUCCESS" => json.validate[LlmOutputSuccess]
        case "LLM_FAILURE" => json.validate[LlmOutputFailure]
        case "TRANSCRIPTION_FAILURE" => json.validate[TranscriptionOutputFailure]
        case other     => JsError(s"Unknown status type: $other")
      }
    }
  }
}

trait LlmBackend
case object Bedrock extends LlmBackend {
  val name = "BEDROCK"
}
case object Local extends LlmBackend {
  val name = "LOCAL"
}

trait JobType
case object LlmJobType extends JobType {
  val name = "llm"
}
case object TranscriptionJobType extends JobType {
  val name = "transcription"
}
