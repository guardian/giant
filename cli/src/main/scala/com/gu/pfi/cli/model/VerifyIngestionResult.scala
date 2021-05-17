package com.gu.pfi.cli.model

case class VerifyIngestionResult(
  numberOfFilesOnDisk: Long,
  numberOfFilesInIndex: Long,
  filesInError: Map[String, String],
  filesNotIndexed: List[String]
)