package model

import java.nio.file.Paths

import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers

class UriTest extends AnyFlatSpec with Matchers {
  behavior of "Uri$Test"

  it should "correctly create a file uri from relative file paths" in {
    val fileUri = Uri.relativizeFromFilePaths(
      Uri("myCollection/myIngestion"),
      Paths.get("/root/bob"),
      Paths.get("/root/bob/foo")
    )

    fileUri.value shouldBe "myCollection/myIngestion/foo"
  }

  it should "correctly create a file uri from relative file paths where the root is the same as the path" in {
    val fileUri = Uri.relativizeFromFilePaths(
      Uri("myCollection/myIngestion"),
      Paths.get("/root/bob"),
      Paths.get("/root/bob")
    )

    fileUri.value shouldBe "myCollection/myIngestion"
  }
}
