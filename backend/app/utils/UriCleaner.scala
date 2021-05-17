package utils

object UriCleaner {
  /**
   * Converts a display name into a 'clean' name which can be safely stored as a URI
   */
  def clean(text: String): String = text.replace("/", "-")
}
