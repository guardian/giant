package com.gu.pfi.cli

import java.nio.file.Path

object FileFilters {
  /** Filenames that should never be uploaded — OS metadata, editor temp files, etc. */
  private val ignoredNames: Set[String] = Set(
    ".DS_Store",
    "Thumbs.db",
    "desktop.ini",
    ".Spotlight-V100",
    ".Trashes",
    ".fseventsd",
    ".TemporaryItems"
  )

  def isJunkFile(path: Path): Boolean = {
    val name = path.getFileName.toString
    ignoredNames.contains(name) || name.startsWith("._")
  }
}
