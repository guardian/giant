package com.gu.pfi.cli.service.ingestion

import java.nio.file.Paths

import com.gu.pfi.cli.ingestion.CliIngestionPipeline
import model.Uri
import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers

class CliIngestionPipelineTest extends AnyFlatSpec with Matchers {

  behavior of "CliIngestionPipeline"

  it should "correctly relativise paths in makeRelativeFile" in {
    val file = CliIngestionPipeline.makeRelativeFile(
      Paths.get("/root/bob/path/to/doc"),
      Paths.get("/root/bob"),
      Uri("myCollection/myIngestion"),
      new java.util.HashMap[String, AnyRef]()
    )
    file.uri.value shouldBe "myCollection/myIngestion/path/to/doc"
  }

  it should "correctly relativise root path in makeRelativeFile" in {
    val file = CliIngestionPipeline.makeRelativeFile(
      Paths.get("/root/bob"),
      Paths.get("/root/bob"),
      Uri("myCollection/myIngestion"),
      new java.util.HashMap[String, AnyRef]()
    )
    file.uri.value shouldBe "myCollection/myIngestion"
  }

}

