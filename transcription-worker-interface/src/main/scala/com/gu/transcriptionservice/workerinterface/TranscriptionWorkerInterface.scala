package com.gu.transcriptionservice.workerinterface

import play.api.libs.json._

// AUTO-GENERATED - DO NOT EDIT.
//
// Generated from worker-interface-schema.json by `sbt generateTranscriptionWorkerInterface`.
// Re-run that task after updating the schema, and commit the result.

sealed abstract class TranscriptDestinationService(val value: String)

object TranscriptDestinationService {
  case object TranscriptionService extends TranscriptDestinationService("TranscriptionService")
  case object Giant extends TranscriptDestinationService("Giant")

  val All: Seq[TranscriptDestinationService] = Seq(TranscriptionService, Giant)

  def fromString(value: String): Option[TranscriptDestinationService] = All.find(_.value == value)

  implicit val reads: Reads[TranscriptDestinationService] = Reads {
    case JsString(value) =>
      fromString(value).fold[JsResult[TranscriptDestinationService]](JsError(s"Unknown TranscriptDestinationService: $value"))(JsSuccess(_))
    case other => JsError(s"Expected a JSON string for TranscriptDestinationService, got: $other")
  }

  implicit val writes: Writes[TranscriptDestinationService] = Writes(value => JsString(value.value))
}

final case class CombinedOutputUrl(
    url: String,
    key: String
)

object CombinedOutputUrl {
  implicit val format: OFormat[CombinedOutputUrl] = Json.format[CombinedOutputUrl]
}

sealed trait WorkerJob {
  def id: String
  def originalFilename: String
  def inputSignedUrl: String
  def sentTimestamp: String
  def userEmail: String
  def transcriptDestinationService: TranscriptDestinationService
  def combinedOutputUrl: CombinedOutputUrl
  def jobType: String
}

object WorkerJob {
  implicit val reads: Reads[WorkerJob] = Reads { json =>
    (json \ "jobType").validate[String].flatMap {
      case LLMJob.JobTypeValue => json.validate[LLMJob]
      case TranscriptionJob.JobTypeValue => json.validate[TranscriptionJob]
      case LLMTranslationJob.JobTypeValue => json.validate[LLMTranslationJob]
      case other => JsError(s"Unknown WorkerJob jobType: $other")
    }
  }

  implicit val writes: Writes[WorkerJob] = Writes {
    case value: LLMJob => Json.toJson(value)
    case value: TranscriptionJob => Json.toJson(value)
    case value: LLMTranslationJob => Json.toJson(value)
  }
}

sealed trait TranscriptionOutput {
  def id: String
  def userEmail: String
  def status: String
}

object TranscriptionOutput {
  implicit val reads: Reads[TranscriptionOutput] = Reads { json =>
    (json \ "status").validate[String].flatMap {
      case TranscriptionOutputSuccess.StatusValue => json.validate[TranscriptionOutputSuccess]
      case TranscriptionOutputFailure.StatusValue => json.validate[TranscriptionOutputFailure]
      case MediaDownloadFailure.StatusValue => json.validate[MediaDownloadFailure]
      case LLMOutputSuccess.StatusValue => json.validate[LLMOutputSuccess]
      case LLMOutputFailure.StatusValue => json.validate[LLMOutputFailure]
      case other => JsError(s"Unknown TranscriptionOutput status: $other")
    }
  }

  implicit val writes: Writes[TranscriptionOutput] = Writes {
    case value: TranscriptionOutputSuccess => Json.toJson(value)
    case value: TranscriptionOutputFailure => Json.toJson(value)
    case value: MediaDownloadFailure => Json.toJson(value)
    case value: LLMOutputSuccess => Json.toJson(value)
    case value: LLMOutputFailure => Json.toJson(value)
  }
}

sealed abstract class OutputLanguageCode(val value: String)

object OutputLanguageCode {
  case object Unknown extends OutputLanguageCode("UNKNOWN")
  case object En extends OutputLanguageCode("en")
  case object Zh extends OutputLanguageCode("zh")
  case object De extends OutputLanguageCode("de")
  case object Es extends OutputLanguageCode("es")
  case object Ru extends OutputLanguageCode("ru")
  case object Ko extends OutputLanguageCode("ko")
  case object Fr extends OutputLanguageCode("fr")
  case object Ja extends OutputLanguageCode("ja")
  case object Pt extends OutputLanguageCode("pt")
  case object Tr extends OutputLanguageCode("tr")
  case object Pl extends OutputLanguageCode("pl")
  case object Ca extends OutputLanguageCode("ca")
  case object Nl extends OutputLanguageCode("nl")
  case object Ar extends OutputLanguageCode("ar")
  case object Sv extends OutputLanguageCode("sv")
  case object It extends OutputLanguageCode("it")
  case object Id extends OutputLanguageCode("id")
  case object Hi extends OutputLanguageCode("hi")
  case object Fi extends OutputLanguageCode("fi")
  case object Vi extends OutputLanguageCode("vi")
  case object He extends OutputLanguageCode("he")
  case object Uk extends OutputLanguageCode("uk")
  case object El extends OutputLanguageCode("el")
  case object Ms extends OutputLanguageCode("ms")
  case object Cs extends OutputLanguageCode("cs")
  case object Ro extends OutputLanguageCode("ro")
  case object Da extends OutputLanguageCode("da")
  case object Hu extends OutputLanguageCode("hu")
  case object Ta extends OutputLanguageCode("ta")
  case object No extends OutputLanguageCode("no")
  case object Th extends OutputLanguageCode("th")
  case object Ur extends OutputLanguageCode("ur")
  case object Hr extends OutputLanguageCode("hr")
  case object Bg extends OutputLanguageCode("bg")
  case object Lt extends OutputLanguageCode("lt")
  case object La extends OutputLanguageCode("la")
  case object Mi extends OutputLanguageCode("mi")
  case object Ml extends OutputLanguageCode("ml")
  case object Cy extends OutputLanguageCode("cy")
  case object Sk extends OutputLanguageCode("sk")
  case object Te extends OutputLanguageCode("te")
  case object Fa extends OutputLanguageCode("fa")
  case object Lv extends OutputLanguageCode("lv")
  case object Bn extends OutputLanguageCode("bn")
  case object Sr extends OutputLanguageCode("sr")
  case object Az extends OutputLanguageCode("az")
  case object Sl extends OutputLanguageCode("sl")
  case object Kn extends OutputLanguageCode("kn")
  case object Et extends OutputLanguageCode("et")
  case object Mk extends OutputLanguageCode("mk")
  case object Br extends OutputLanguageCode("br")
  case object Eu extends OutputLanguageCode("eu")
  case object Is extends OutputLanguageCode("is")
  case object Hy extends OutputLanguageCode("hy")
  case object Ne extends OutputLanguageCode("ne")
  case object Mn extends OutputLanguageCode("mn")
  case object Bs extends OutputLanguageCode("bs")
  case object Kk extends OutputLanguageCode("kk")
  case object Sq extends OutputLanguageCode("sq")
  case object Sw extends OutputLanguageCode("sw")
  case object Gl extends OutputLanguageCode("gl")
  case object Mr extends OutputLanguageCode("mr")
  case object Pa extends OutputLanguageCode("pa")
  case object Si extends OutputLanguageCode("si")
  case object Km extends OutputLanguageCode("km")
  case object Sn extends OutputLanguageCode("sn")
  case object Yo extends OutputLanguageCode("yo")
  case object So extends OutputLanguageCode("so")
  case object Af extends OutputLanguageCode("af")
  case object Oc extends OutputLanguageCode("oc")
  case object Ka extends OutputLanguageCode("ka")
  case object Be extends OutputLanguageCode("be")
  case object Tg extends OutputLanguageCode("tg")
  case object Sd extends OutputLanguageCode("sd")
  case object Gu extends OutputLanguageCode("gu")
  case object Am extends OutputLanguageCode("am")
  case object Yi extends OutputLanguageCode("yi")
  case object Lo extends OutputLanguageCode("lo")
  case object Uz extends OutputLanguageCode("uz")
  case object Fo extends OutputLanguageCode("fo")
  case object Ht extends OutputLanguageCode("ht")
  case object Ps extends OutputLanguageCode("ps")
  case object Tk extends OutputLanguageCode("tk")
  case object Nn extends OutputLanguageCode("nn")
  case object Mt extends OutputLanguageCode("mt")
  case object Sa extends OutputLanguageCode("sa")
  case object Lb extends OutputLanguageCode("lb")
  case object My extends OutputLanguageCode("my")
  case object Bo extends OutputLanguageCode("bo")
  case object Tl extends OutputLanguageCode("tl")
  case object Mg extends OutputLanguageCode("mg")
  case object As extends OutputLanguageCode("as")
  case object Tt extends OutputLanguageCode("tt")
  case object Haw extends OutputLanguageCode("haw")
  case object Ln extends OutputLanguageCode("ln")
  case object Ha extends OutputLanguageCode("ha")
  case object Ba extends OutputLanguageCode("ba")
  case object Jw extends OutputLanguageCode("jw")
  case object Su extends OutputLanguageCode("su")
  case object Yue extends OutputLanguageCode("yue")

  val All: Seq[OutputLanguageCode] = Seq(Unknown, En, Zh, De, Es, Ru, Ko, Fr, Ja, Pt, Tr, Pl, Ca, Nl, Ar, Sv, It, Id, Hi, Fi, Vi, He, Uk, El, Ms, Cs, Ro, Da, Hu, Ta, No, Th, Ur, Hr, Bg, Lt, La, Mi, Ml, Cy, Sk, Te, Fa, Lv, Bn, Sr, Az, Sl, Kn, Et, Mk, Br, Eu, Is, Hy, Ne, Mn, Bs, Kk, Sq, Sw, Gl, Mr, Pa, Si, Km, Sn, Yo, So, Af, Oc, Ka, Be, Tg, Sd, Gu, Am, Yi, Lo, Uz, Fo, Ht, Ps, Tk, Nn, Mt, Sa, Lb, My, Bo, Tl, Mg, As, Tt, Haw, Ln, Ha, Ba, Jw, Su, Yue)

  def fromString(value: String): Option[OutputLanguageCode] = All.find(_.value == value)

  implicit val reads: Reads[OutputLanguageCode] = Reads {
    case JsString(value) =>
      fromString(value).fold[JsResult[OutputLanguageCode]](JsError(s"Unknown OutputLanguageCode: $value"))(JsSuccess(_))
    case other => JsError(s"Expected a JSON string for OutputLanguageCode, got: $other")
  }

  implicit val writes: Writes[OutputLanguageCode] = Writes(value => JsString(value.value))
}

final case class Transcripts(
    srt: String,
    text: String,
    json: String
)

object Transcripts {
  implicit val format: OFormat[Transcripts] = Json.format[Transcripts]
}

final case class TranscriptionMetadata(
    detectedLanguageCode: OutputLanguageCode,
    loadTimeMs: Option[Double],
    totalTimeMs: Option[Double]
)

object TranscriptionMetadata {
  implicit val format: OFormat[TranscriptionMetadata] = Json.format[TranscriptionMetadata]
}

sealed abstract class TranscriptionEngine(val value: String)

object TranscriptionEngine {
  case object Whisperx extends TranscriptionEngine("whisperx")

  val All: Seq[TranscriptionEngine] = Seq(Whisperx)

  def fromString(value: String): Option[TranscriptionEngine] = All.find(_.value == value)

  implicit val reads: Reads[TranscriptionEngine] = Reads {
    case JsString(value) =>
      fromString(value).fold[JsResult[TranscriptionEngine]](JsError(s"Unknown TranscriptionEngine: $value"))(JsSuccess(_))
    case other => JsError(s"Expected a JSON string for TranscriptionEngine, got: $other")
  }

  implicit val writes: Writes[TranscriptionEngine] = Writes(value => JsString(value.value))
}

sealed abstract class LlmBackend(val value: String)

object LlmBackend {
  case object Local extends LlmBackend("LOCAL")
  case object Bedrock extends LlmBackend("BEDROCK")

  val All: Seq[LlmBackend] = Seq(Local, Bedrock)

  def fromString(value: String): Option[LlmBackend] = All.find(_.value == value)

  implicit val reads: Reads[LlmBackend] = Reads {
    case JsString(value) =>
      fromString(value).fold[JsResult[LlmBackend]](JsError(s"Unknown LlmBackend: $value"))(JsSuccess(_))
    case other => JsError(s"Expected a JSON string for LlmBackend, got: $other")
  }

  implicit val writes: Writes[LlmBackend] = Writes(value => JsString(value.value))
}

sealed abstract class InputLanguageCode(val value: String)

object InputLanguageCode {
  case object Auto extends InputLanguageCode("auto")
  case object En extends InputLanguageCode("en")
  case object Zh extends InputLanguageCode("zh")
  case object De extends InputLanguageCode("de")
  case object Es extends InputLanguageCode("es")
  case object Ru extends InputLanguageCode("ru")
  case object Ko extends InputLanguageCode("ko")
  case object Fr extends InputLanguageCode("fr")
  case object Ja extends InputLanguageCode("ja")
  case object Pt extends InputLanguageCode("pt")
  case object Tr extends InputLanguageCode("tr")
  case object Pl extends InputLanguageCode("pl")
  case object Ca extends InputLanguageCode("ca")
  case object Nl extends InputLanguageCode("nl")
  case object Ar extends InputLanguageCode("ar")
  case object Sv extends InputLanguageCode("sv")
  case object It extends InputLanguageCode("it")
  case object Id extends InputLanguageCode("id")
  case object Hi extends InputLanguageCode("hi")
  case object Fi extends InputLanguageCode("fi")
  case object Vi extends InputLanguageCode("vi")
  case object He extends InputLanguageCode("he")
  case object Uk extends InputLanguageCode("uk")
  case object El extends InputLanguageCode("el")
  case object Ms extends InputLanguageCode("ms")
  case object Cs extends InputLanguageCode("cs")
  case object Ro extends InputLanguageCode("ro")
  case object Da extends InputLanguageCode("da")
  case object Hu extends InputLanguageCode("hu")
  case object Ta extends InputLanguageCode("ta")
  case object No extends InputLanguageCode("no")
  case object Th extends InputLanguageCode("th")
  case object Ur extends InputLanguageCode("ur")
  case object Hr extends InputLanguageCode("hr")
  case object Bg extends InputLanguageCode("bg")
  case object Lt extends InputLanguageCode("lt")
  case object La extends InputLanguageCode("la")
  case object Mi extends InputLanguageCode("mi")
  case object Ml extends InputLanguageCode("ml")
  case object Cy extends InputLanguageCode("cy")
  case object Sk extends InputLanguageCode("sk")
  case object Te extends InputLanguageCode("te")
  case object Fa extends InputLanguageCode("fa")
  case object Lv extends InputLanguageCode("lv")
  case object Bn extends InputLanguageCode("bn")
  case object Sr extends InputLanguageCode("sr")
  case object Az extends InputLanguageCode("az")
  case object Sl extends InputLanguageCode("sl")
  case object Kn extends InputLanguageCode("kn")
  case object Et extends InputLanguageCode("et")
  case object Mk extends InputLanguageCode("mk")
  case object Br extends InputLanguageCode("br")
  case object Eu extends InputLanguageCode("eu")
  case object Is extends InputLanguageCode("is")
  case object Hy extends InputLanguageCode("hy")
  case object Ne extends InputLanguageCode("ne")
  case object Mn extends InputLanguageCode("mn")
  case object Bs extends InputLanguageCode("bs")
  case object Kk extends InputLanguageCode("kk")
  case object Sq extends InputLanguageCode("sq")
  case object Sw extends InputLanguageCode("sw")
  case object Gl extends InputLanguageCode("gl")
  case object Mr extends InputLanguageCode("mr")
  case object Pa extends InputLanguageCode("pa")
  case object Si extends InputLanguageCode("si")
  case object Km extends InputLanguageCode("km")
  case object Sn extends InputLanguageCode("sn")
  case object Yo extends InputLanguageCode("yo")
  case object So extends InputLanguageCode("so")
  case object Af extends InputLanguageCode("af")
  case object Oc extends InputLanguageCode("oc")
  case object Ka extends InputLanguageCode("ka")
  case object Be extends InputLanguageCode("be")
  case object Tg extends InputLanguageCode("tg")
  case object Sd extends InputLanguageCode("sd")
  case object Gu extends InputLanguageCode("gu")
  case object Am extends InputLanguageCode("am")
  case object Yi extends InputLanguageCode("yi")
  case object Lo extends InputLanguageCode("lo")
  case object Uz extends InputLanguageCode("uz")
  case object Fo extends InputLanguageCode("fo")
  case object Ht extends InputLanguageCode("ht")
  case object Ps extends InputLanguageCode("ps")
  case object Tk extends InputLanguageCode("tk")
  case object Nn extends InputLanguageCode("nn")
  case object Mt extends InputLanguageCode("mt")
  case object Sa extends InputLanguageCode("sa")
  case object Lb extends InputLanguageCode("lb")
  case object My extends InputLanguageCode("my")
  case object Bo extends InputLanguageCode("bo")
  case object Tl extends InputLanguageCode("tl")
  case object Mg extends InputLanguageCode("mg")
  case object As extends InputLanguageCode("as")
  case object Tt extends InputLanguageCode("tt")
  case object Haw extends InputLanguageCode("haw")
  case object Ln extends InputLanguageCode("ln")
  case object Ha extends InputLanguageCode("ha")
  case object Ba extends InputLanguageCode("ba")
  case object Jw extends InputLanguageCode("jw")
  case object Su extends InputLanguageCode("su")
  case object Yue extends InputLanguageCode("yue")

  val All: Seq[InputLanguageCode] = Seq(Auto, En, Zh, De, Es, Ru, Ko, Fr, Ja, Pt, Tr, Pl, Ca, Nl, Ar, Sv, It, Id, Hi, Fi, Vi, He, Uk, El, Ms, Cs, Ro, Da, Hu, Ta, No, Th, Ur, Hr, Bg, Lt, La, Mi, Ml, Cy, Sk, Te, Fa, Lv, Bn, Sr, Az, Sl, Kn, Et, Mk, Br, Eu, Is, Hy, Ne, Mn, Bs, Kk, Sq, Sw, Gl, Mr, Pa, Si, Km, Sn, Yo, So, Af, Oc, Ka, Be, Tg, Sd, Gu, Am, Yi, Lo, Uz, Fo, Ht, Ps, Tk, Nn, Mt, Sa, Lb, My, Bo, Tl, Mg, As, Tt, Haw, Ln, Ha, Ba, Jw, Su, Yue)

  def fromString(value: String): Option[InputLanguageCode] = All.find(_.value == value)

  implicit val reads: Reads[InputLanguageCode] = Reads {
    case JsString(value) =>
      fromString(value).fold[JsResult[InputLanguageCode]](JsError(s"Unknown InputLanguageCode: $value"))(JsSuccess(_))
    case other => JsError(s"Expected a JSON string for InputLanguageCode, got: $other")
  }

  implicit val writes: Writes[InputLanguageCode] = Writes(value => JsString(value.value))
}

sealed abstract class JobType(val value: String)

object JobType {
  case object Transcribe extends JobType("transcribe")
  case object Llm extends JobType("llm")
  case object LlmTranslation extends JobType("llm-translation")

  val All: Seq[JobType] = Seq(Transcribe, Llm, LlmTranslation)

  def fromString(value: String): Option[JobType] = All.find(_.value == value)

  implicit val reads: Reads[JobType] = Reads {
    case JsString(value) =>
      fromString(value).fold[JsResult[JobType]](JsError(s"Unknown JobType: $value"))(JsSuccess(_))
    case other => JsError(s"Expected a JSON string for JobType, got: $other")
  }

  implicit val writes: Writes[JobType] = Writes(value => JsString(value.value))
}

final case class Job(
    id: String,
    originalFilename: String,
    inputSignedUrl: String,
    sentTimestamp: String,
    userEmail: String,
    transcriptDestinationService: TranscriptDestinationService,
    combinedOutputUrl: CombinedOutputUrl,
    jobType: JobType,
    ingestion: Option[String]
)

object Job {
  implicit val format: OFormat[Job] = Json.format[Job]
}

final case class TranscriptionJob(
    id: String,
    originalFilename: String,
    inputSignedUrl: String,
    sentTimestamp: String,
    userEmail: String,
    transcriptDestinationService: TranscriptDestinationService,
    combinedOutputUrl: CombinedOutputUrl,
    ingestion: Option[String],
    languageCode: InputLanguageCode,
    translate: Boolean,
    diarize: Boolean,
    engine: TranscriptionEngine
) extends WorkerJob {
  def jobType: String = TranscriptionJob.JobTypeValue
}

object TranscriptionJob {
  val JobTypeValue: String = "transcribe"

  implicit val reads: Reads[TranscriptionJob] = Json.reads[TranscriptionJob]

  implicit val writes: OWrites[TranscriptionJob] =
    Json.writes[TranscriptionJob].transform((json: JsObject) => json ++ Json.obj("jobType" -> JobTypeValue))
}

final case class LLMJob(
    id: String,
    originalFilename: String,
    inputSignedUrl: String,
    sentTimestamp: String,
    userEmail: String,
    transcriptDestinationService: TranscriptDestinationService,
    combinedOutputUrl: CombinedOutputUrl,
    ingestion: Option[String],
    backend: LlmBackend
) extends WorkerJob {
  def jobType: String = LLMJob.JobTypeValue
}

object LLMJob {
  val JobTypeValue: String = "llm"

  implicit val reads: Reads[LLMJob] = Json.reads[LLMJob]

  implicit val writes: OWrites[LLMJob] =
    Json.writes[LLMJob].transform((json: JsObject) => json ++ Json.obj("jobType" -> JobTypeValue))
}

final case class LLMTranslationJob(
    id: String,
    originalFilename: String,
    inputSignedUrl: String,
    sentTimestamp: String,
    userEmail: String,
    transcriptDestinationService: TranscriptDestinationService,
    combinedOutputUrl: CombinedOutputUrl,
    ingestion: Option[String],
    backend: LlmBackend
) extends WorkerJob {
  def jobType: String = LLMTranslationJob.JobTypeValue
}

object LLMTranslationJob {
  val JobTypeValue: String = "llm-translation"

  implicit val reads: Reads[LLMTranslationJob] = Json.reads[LLMTranslationJob]

  implicit val writes: OWrites[LLMTranslationJob] =
    Json.writes[LLMTranslationJob].transform((json: JsObject) => json ++ Json.obj("jobType" -> JobTypeValue))
}

final case class LlmPrompt(
    system: Option[String],
    user: String,
    assistant: Option[String]
)

object LlmPrompt {
  implicit val format: OFormat[LlmPrompt] = Json.format[LlmPrompt]
}

final case class TranslationField(
    name: String,
    text: String
)

object TranslationField {
  implicit val format: OFormat[TranslationField] = Json.format[TranslationField]
}

final case class TranslationTask(
    systemPrompt: String,
    fields: List[TranslationField]
)

object TranslationTask {
  implicit val format: OFormat[TranslationTask] = Json.format[TranslationTask]
}

final case class OutputBase(
    id: String,
    userEmail: String,
    status: String
)

object OutputBase {
  implicit val format: OFormat[OutputBase] = Json.format[OutputBase]
}

final case class TranscriptionOutputSuccess(
    id: String,
    userEmail: String,
    originalFilename: String,
    languageCode: OutputLanguageCode,
    combinedOutputKey: String,
    duration: Option[Double],
    maybeEnqueuedAtEpochMillis: Option[Double],
    includesTranslation: Boolean,
    translationRequested: Boolean
) extends TranscriptionOutput {
  def status: String = TranscriptionOutputSuccess.StatusValue
}

object TranscriptionOutputSuccess {
  val StatusValue: String = "SUCCESS"

  implicit val reads: Reads[TranscriptionOutputSuccess] = Json.reads[TranscriptionOutputSuccess]

  implicit val writes: OWrites[TranscriptionOutputSuccess] =
    Json.writes[TranscriptionOutputSuccess].transform((json: JsObject) => json ++ Json.obj("status" -> StatusValue))
}

final case class TranscriptionOutputFailure(
    id: String,
    userEmail: String,
    originalFilename: String,
    noAudioDetected: Boolean
) extends TranscriptionOutput {
  def status: String = TranscriptionOutputFailure.StatusValue
}

object TranscriptionOutputFailure {
  val StatusValue: String = "TRANSCRIPTION_FAILURE"

  implicit val reads: Reads[TranscriptionOutputFailure] = Json.reads[TranscriptionOutputFailure]

  implicit val writes: OWrites[TranscriptionOutputFailure] =
    Json.writes[TranscriptionOutputFailure].transform((json: JsObject) => json ++ Json.obj("status" -> StatusValue))
}

final case class LLMOutputSuccess(
    id: String,
    userEmail: String,
    outputKey: String
) extends TranscriptionOutput {
  def status: String = LLMOutputSuccess.StatusValue
}

object LLMOutputSuccess {
  val StatusValue: String = "LLM_SUCCESS"

  implicit val reads: Reads[LLMOutputSuccess] = Json.reads[LLMOutputSuccess]

  implicit val writes: OWrites[LLMOutputSuccess] =
    Json.writes[LLMOutputSuccess].transform((json: JsObject) => json ++ Json.obj("status" -> StatusValue))
}

final case class LLMOutputFailure(
    id: String,
    userEmail: String
) extends TranscriptionOutput {
  def status: String = LLMOutputFailure.StatusValue
}

object LLMOutputFailure {
  val StatusValue: String = "LLM_FAILURE"

  implicit val reads: Reads[LLMOutputFailure] = Json.reads[LLMOutputFailure]

  implicit val writes: OWrites[LLMOutputFailure] =
    Json.writes[LLMOutputFailure].transform((json: JsObject) => json ++ Json.obj("status" -> StatusValue))
}

final case class TranscriptionResult(
    transcripts: Transcripts,
    transcriptTranslations: Option[Transcripts],
    metadata: TranscriptionMetadata
)

object TranscriptionResult {
  implicit val format: OFormat[TranscriptionResult] = Json.format[TranscriptionResult]
}

sealed abstract class FailureReason(val value: String)

object FailureReason {
  case object Failure extends FailureReason("FAILURE")
  case object InvalidUrl extends FailureReason("INVALID_URL")
  case object BotBlocked extends FailureReason("BOT_BLOCKED")

  val All: Seq[FailureReason] = Seq(Failure, InvalidUrl, BotBlocked)

  def fromString(value: String): Option[FailureReason] = All.find(_.value == value)

  implicit val reads: Reads[FailureReason] = Reads {
    case JsString(value) =>
      fromString(value).fold[JsResult[FailureReason]](JsError(s"Unknown FailureReason: $value"))(JsSuccess(_))
    case other => JsError(s"Expected a JSON string for FailureReason, got: $other")
  }

  implicit val writes: Writes[FailureReason] = Writes(value => JsString(value.value))
}

final case class MediaDownloadFailure(
    id: String,
    userEmail: String,
    failureReason: FailureReason,
    url: String
) extends TranscriptionOutput {
  def status: String = MediaDownloadFailure.StatusValue
}

object MediaDownloadFailure {
  val StatusValue: String = "MEDIA_DOWNLOAD_FAILURE"

  implicit val reads: Reads[MediaDownloadFailure] = Json.reads[MediaDownloadFailure]

  implicit val writes: OWrites[MediaDownloadFailure] =
    Json.writes[MediaDownloadFailure].transform((json: JsObject) => json ++ Json.obj("status" -> StatusValue))
}
