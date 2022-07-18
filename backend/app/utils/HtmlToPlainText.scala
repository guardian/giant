package utils

import org.jsoup.Jsoup
import org.jsoup.internal.StringUtil
import org.jsoup.nodes.{Element, Node, TextNode}
import org.jsoup.select.NodeFilter.FilterResult
import org.jsoup.select.{NodeFilter, NodeTraversor}

import scala.util.control.NonFatal

/**
  * HTML to plain-text. This example program demonstrates the use of jsoup to convert HTML input to lightly-formatted
  * plain-text. That is divergent from the general goal of jsoup's .text() methods, which is to get clean data from a
  * scrape.
  * <p>
  * Note that this is a fairly simplistic formatter -- for real world use you'll want to embrace and extend.
  * </p>
  * <p>
  * To invoke from the command line, assuming you've downloaded the jsoup jar to your current directory:</p>
  * <p><code>java -cp jsoup.jar org.jsoup.examples.HtmlToPlainText url [selector]</code></p>
  * where <i>url</i> is the URL to fetch, and <i>selector</i> is an optional CSS selector.
  *
  * @author Jonathan Hedley, jonathan@hedley.net
  */
object HtmlToPlainText {
  def convert(html: String): String = try {
    val doc = Jsoup.parse(html)
    val formatter = new HtmlToPlainText
    formatter.getPlainText(doc)
  } catch {
    case NonFatal(e) =>
      html
  }
}

class HtmlToPlainText {
  /**
    * Format an Element to plain-text
    *
    * @param element the root element to format
    * @return formatted text
    */
  def getPlainText(element: Element) = {
    val formatter = new FormattingVisitor

    // walk the DOM, and call .head() and .tail() for each node
    NodeTraversor.filter(formatter, element)

    formatter.toString
  }

  // the formatting rules, implemented in a breadth-first DOM traverse
  private object FormattingVisitor {
    private val maxWidth = 80
  }

  private class FormattingVisitor extends NodeFilter {
    private var width = 0
    private val accum = new StringBuilder // holds the accumulated text
    private var skipping: Option[String] = None
    private val skipSet = Set("title", "style")

    // hit when the node is first seen
    override def head(node: Node, depth: Int) = {
      if (skipping.isEmpty) {
        //Logger.logger.info(s"HTML: ${node.getClass} ${node.nodeName()}")
        node match {
          case textNode: TextNode =>
            //Logger.logger.info(s"  ${textNode.text()}")
            if (textNode.text.trim.nonEmpty) append(textNode.text)
          case elementNode: Element =>
            val name = elementNode.nodeName
            if (skipSet.contains(name)) skipping = Some(name)
            else if (name == "li") append("\n * ")
            else if (name == "dt") append("  ")
            else if (StringUtil.in(name, "p", "h1", "h2", "h3", "h4", "h5")) append("\n")
          case _ =>
        }
      }

      FilterResult.CONTINUE
    }

    // hit when all of the node's children (if any) have been visited
    override def tail(node: Node, depth: Int) = {
      if (skipping.isEmpty) {
        val name = node.nodeName
        if (StringUtil.in(name, "br", "dd", "dt", "p", "h1", "h2", "h3", "h4", "h5", "tr")) append("\n")
        else if (StringUtil.in(name, "td", "th")) append("\t")
        else if (name == "img") append(s"${node.attr("alt")}\n")
        else if (name == "a") append(s" <${node.attr("href")}>")
      } else if (skipping.contains(node.nodeName())) {
        skipping = None
      }

      FilterResult.CONTINUE
    }

    // appends text to the string builder with a simple word wrap method
    private def append(text: String) = {
      if (text.startsWith("\n")) width = 0 // reset counter if starts with a newline. only from formats above, not in natural text
      if (text == " " && (accum.isEmpty || StringUtil.in(accum.substring(accum.length - 1), " ", "\n"))) {
        // do nothing
      } else if (text.length + width > FormattingVisitor.maxWidth) { // won't fit, needs to wrap
        val words = text.split("\\s+")
        var i = 0
        while ( {
          i < words.length
        }) {
          var word = words(i)
          val last = i == words.length - 1
          if (!last) { // insert a space if not the last word
            word = word + " "
          }
          if (word.length + width > FormattingVisitor.maxWidth) { // wrap and reset counter
            accum.append("\n").append(word)
            width = word.length
          }
          else {
            accum.append(word)
            width += word.length
          }

          {
            i += 1; i - 1
          }
        }
      } else { // fits as is, without need to wrap text
        accum.append(text)
        width += text.length
      }
    }

    override def toString = accum.toString
  }

}