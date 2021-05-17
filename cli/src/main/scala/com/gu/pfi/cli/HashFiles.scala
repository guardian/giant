package com.gu.pfi.cli

import java.io.File

import services.FingerprintServices
import utils.Logging

object HashFiles extends Logging {
  def run(files: Seq[File]): Unit = {
    files.foreach { file =>
      if (file.isFile) {
        val fingerprint = FingerprintServices.createFingerprintFromFile(file)
        logger.info(s"$fingerprint $file")
      } else {
        logger.error(s"$file: not a regular file")
      }
    }
  }
}
