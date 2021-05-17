package services.previewing

import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

class HtmlPreviewGeneratorTest extends AnyFreeSpec with Matchers {
  "HtmlPreviewGenerator" - {
    "should scrub" - {
      "hyperlinks" in {
        check(
          """
            |<html>
            | <head />
            | <body>
            |   <a href="http://badwebsite.horse">Hey you! Click this link!</a>
            | </body>
            |</html>
          """.stripMargin)
          { document =>
            document.select("a").attr("href") should be("#")
          }
      }

      "all images except embedded data urls" in {
        check(
          """
            |<html>
            | <head />
            | <body>
            |   <img id="retain" src="data:image/png;base64,xxxxxxxxxxxxxxxxxxxxxxxxxxx" />
            |   <div id="remove">
            |     <img src="http://badwebsite.horse/trackingPixel.png" />
            |   </div>
            | </body>
            |</html>
          """.stripMargin)
        { document =>
          document.select("#retain").attr("src") should startWith("data:")
          document.select("#remove img").size should be(0)
          document.select("#remove svg").size should be(1)
        }
      }

      "script tags" in {
        check(
          """
            |<html>
            | <head>
            |   <script type="text/javascript" src="http://badwebsite.horse/stylinCodez.js"></script>
            | </head>
            | <body>
            |   <script type="text/javascript" src="http://badwebsite.horse/trackingCodez.js"></script>
            |   <h1>MARKETING SPAM!!</h1>
            | </body>
            |</html>
          """.stripMargin)
        { document =>
          document.select("script").size() should be(0)
        }
      }
    }
  }

  private def check(input: String)(fn: Document => Unit) = {
    val cleansed = HtmlPreviewGenerator.clean(Jsoup.parse(input))
    val parsed = Jsoup.parse(cleansed)

    fn(parsed)
  }
}
