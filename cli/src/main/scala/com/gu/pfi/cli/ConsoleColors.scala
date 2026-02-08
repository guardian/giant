package com.gu.pfi.cli

/**
 * ANSI color codes for terminal output
 * Colors are automatically disabled if the output is not a TTY (e.g., piped to a file)
 */
object ConsoleColors {
  
  // Check if we're outputting to a terminal (not piped/redirected)
  private val isTerminal: Boolean = System.console() != null
  
  // ANSI color codes
  private val RESET = "\u001B[0m"
  private val RED = "\u001B[31m"
  private val GREEN = "\u001B[32m"
  private val YELLOW = "\u001B[33m"
  private val BLUE = "\u001B[34m"
  private val CYAN = "\u001B[36m"
  private val GRAY = "\u001B[90m"
  private val BOLD = "\u001B[1m"
  
  /**
   * Colorize text only if outputting to a terminal
   */
  private def colorize(text: String, color: String): String = {
    if (isTerminal) s"$color$text$RESET" else text
  }
  
  def red(text: String): String = colorize(text, RED)
  def green(text: String): String = colorize(text, GREEN)
  def yellow(text: String): String = colorize(text, YELLOW)
  def blue(text: String): String = colorize(text, BLUE)
  def cyan(text: String): String = colorize(text, CYAN)
  def gray(text: String): String = colorize(text, GRAY)
  def bold(text: String): String = colorize(text, BOLD)
  
  // Semantic color helpers
  def error(text: String): String = red(text)
  def success(text: String): String = green(text)
  def warning(text: String): String = yellow(text)
  def info(text: String): String = cyan(text)
  def dim(text: String): String = gray(text)
}
