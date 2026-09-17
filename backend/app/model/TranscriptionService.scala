package model

import play.api.libs.json.{Format, Json, Reads, Writes}

// The types describing the messages exchanged with the transcription service are generated from its
// published JSON schema - see the `transcription-worker-interface` project.
//
// The types below are deliberately NOT generated. They are Giant's own model of a transcript: they
// use Giant's richer `Language` rather than the schema's language code enum, and they are also
// produced by the local (non-external) TranscriptionExtractor. Conversion from the wire types
// happens at the boundary, in ExternalTranscriptionWorker.

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

// SQS message attributes that Giant attaches to outgoing jobs, and that the transcription service
// echoes back on the corresponding output message so we can match it to the originating blob and
// extractor. Giant-specific, so not part of the published schema.
object TranscriptionMessageAttributes {
  val GIANT_BLOB_URI = "GiantBlobUri"
  val GIANT_EXTRACTOR_NAME = "GiantExtractorName"
}
