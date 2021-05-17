package extraction

import java.io.{File, InputStream}

import model.manifest.Blob
import services.ScratchSpace
import utils.attempt.Failure

/**
  * Extract from FileExtractor if you need to be able to seek across an actual file on disk and an InputStream is
  * not able to be used.
  */
abstract class FileExtractor(scratch: ScratchSpace) extends Extractor {
  final override def extract(blob: Blob, inputStream: InputStream, params: ExtractionParams): Either[Failure, Unit] = {
    val scratchFile = try {
      scratch.copyToScratchSpace(blob, inputStream)
    } finally {
      inputStream.close()
    }

    try {
      extract(blob, scratchFile, params)
    } finally {
      scratchFile.delete()
    }
  }

  def extract(blob: Blob, file: File, params: ExtractionParams): Either[Failure, Unit]
}
