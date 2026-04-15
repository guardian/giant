package com.gu.pfi.cli

import java.util.Scanner

/**
 * Prompts the user for confirmation in the terminal before destructive operations
 */
object UserPrompt {

  def confirm(message: String): Boolean = {
    val prompt = s"${ConsoleColors.warning(message)} [y/N] "

    Option(System.console()) match {
      case Some(console) =>
        val response = console.readLine(prompt)
        response != null && response.trim.toLowerCase == "y"

      case None =>
        print(prompt)
        val scanner = new Scanner(System.in)
        val response = scanner.nextLine()
        response.trim.toLowerCase == "y"
    }
  }
}
