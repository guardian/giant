package com.gu.pfi.cli

import utils.attempt.Failure

/**
 * Formats error messages with helpful context and actionable advice for users
 */
object ErrorFormatter {
  
  /**
   * Formats a failure message with context and suggestions
   */
  def format(failure: Failure, action: String, verbose: Boolean): String = {
    val baseMessage = enhanceMessage(failure, action)
    val suggestion = getSuggestion(failure, action)
    
    val formattedMessage = s"""
      |${ConsoleColors.error("❌ Error:")} $baseMessage
      |
      |$suggestion
      |${if (!verbose) ConsoleColors.dim("\n💡 Run with --verbose for more details") else ""}
      """.stripMargin.trim
    
    formattedMessage
  }
  
  private def enhanceMessage(failure: Failure, action: String): String = {
    val message = failure.msg
    
    // Add context based on the error message patterns
    message match {
      case msg if msg.contains("401") || msg.toLowerCase.contains("unauthorized") =>
        "Authentication failed - your session may have expired"
      
      case msg if msg.contains("404") || msg.toLowerCase.contains("not found") =>
        s"Resource not found during '$action'"
      
      case msg if msg.contains("403") || msg.toLowerCase.contains("forbidden") =>
        "Access denied - you don't have permission for this operation"
      
      case msg if msg.contains("500") || msg.toLowerCase.contains("internal server error") =>
        "Server error - the Giant server encountered an internal error"
      
      case msg if msg.toLowerCase.contains("connection refused") =>
        "Cannot connect to Giant server - is it running?"
      
      case msg if msg.toLowerCase.contains("not logged in") =>
        "Not logged in"
      
      case msg if msg.toLowerCase.contains("no such file") || msg.toLowerCase.contains("does not exist") =>
        s"File or directory not found"
      
      case _ =>
        message
    }
  }
  
  private def getSuggestion(failure: Failure, action: String): String = {
    val message = failure.msg.toLowerCase
    
    val suggestionText = message match {
      case msg if msg.contains("401") || msg.contains("unauthorized") || msg.contains("not logged in") =>
        """Run 'pfi-cli login' to authenticate
          |   - Use --token flag if you have a JWT token from the UI
          |   - Check that your token hasn't expired""".stripMargin
      
      case msg if msg.contains("404") || msg.contains("not found") =>
        """Check your command parameters
          |   - Verify the ingestion URI format: <collection>/<ingestion>
          |   - Run 'pfi-cli list' to see available ingestions""".stripMargin
      
      case msg if msg.contains("403") || msg.contains("forbidden") =>
        """Check your user permissions
          |   - You may need admin privileges for this operation
          |   - Contact your Giant administrator""".stripMargin
      
      case msg if msg.contains("500") || msg.contains("internal server") =>
        """This is a server-side issue
          |   - Check the Giant server logs
          |   - Try again in a few moments
          |   - Contact your Giant administrator if the problem persists""".stripMargin
      
      case msg if msg.contains("connection refused") =>
        """Check your connection
          |   - Verify the --uri parameter (default: http://localhost:9001)
          |   - Ensure the Giant server is running
          |   - Check your network connection""".stripMargin
      
      case msg if msg.contains("no such file") || msg.contains("does not exist") =>
        """Check file paths
          |   - Verify the --path parameter points to an existing file or directory
          |   - Use absolute paths to avoid confusion
          |   - Check file permissions""".stripMargin
      
      case msg if msg.contains("ingestion") && msg.contains("missing path") =>
        """The ingestion may be incomplete
          |   - Check if the ingestion was properly created
          |   - Try creating a new ingestion with 'pfi-cli create-ingestion'""".stripMargin
      
      case _ =>
        """For more help:
          |   - Run with --verbose to see detailed error information
          |   - Check the documentation
          |   - Verify all command parameters are correct""".stripMargin
    }
    
    ConsoleColors.info("💡 Suggestion: ") + suggestionText
  }
}
