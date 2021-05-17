package services.previewing

import java.io.InputStream
import java.nio.file.Path

import com.amazonaws.util.StringInputStream
import org.jsoup.Jsoup
import org.jsoup.nodes.Document

class HtmlPreviewGenerator(binary: String, workspace: Path) extends PreviewGenerator(workspace, temporaryFileExtension = "tmp.html") {
  override def transform(data: InputStream): InputStream = {
    // JSoup will attempt to detect charset or fallback to UTF-8
    val cleansed = HtmlPreviewGenerator.clean(Jsoup.parse(data, null, "."))
    new StringInputStream(cleansed)
  }

  override def buildCommand(workspace: String, input: String, output: String): Seq[String] = {
    Seq(binary, "--headless", "--disable-gpu", s"--print-to-pdf=$output", s"file://$input")
  }
}

object HtmlPreviewGenerator {
  val REPLACEMENT_IMAGE = """<svg fill="currentColor" width="50" height="50" viewBox="0 0 40 40" style="vertical-align:middle;display:inline-block;fill:#666;" size="50" preserveAspectRatio="xMidYMid meet"><g><path d="m30 19.063333333333336l5 5v7.578333333333333q0 1.3283333333333367-1.0166666666666657 2.34333333333333t-2.3416666666666686 1.0166666666666657h-23.28333333333333q-1.3266666666666689 0-2.3416666666666686-1.0166666666666657t-1.0166666666666657-2.341666666666665v-10.938333333333333l5 5 6.641666666666666-6.716666666666669 6.716666666666669 6.716666666666669z m5-10.703333333333333v10.938333333333333l-5-5-6.640000000000001 6.716666666666669-6.716666666666669-6.716666666666669-6.643333333333331 6.71833333333333-5-5.078333333333331v-7.578333333333333q0-1.3283333333333331 1.0166666666666666-2.3433333333333337t2.3433333333333346-1.0166666666666675h23.28333333333334q1.326666666666668 0 2.3416666666666686 1.0166666666666666t1.0149999999999935 2.3433333333333346z"></path></g></svg>"""

  def clean(input: Document): String = {
    input.select("a[href]").attr("href", "#")
    input.select("""img:not(img[src^="data:"])""").tagName("div").html(REPLACEMENT_IMAGE)
    input.select("script").remove()
    val headerHide =
      """
        |<style>
        |@media print {
        |  @page { margin: 0; }
        |  body { margin: 1.6cm; }
        |}
        |</style>
      """.stripMargin
    input.select("head").append(headerHide)

    input.html()
  }
}