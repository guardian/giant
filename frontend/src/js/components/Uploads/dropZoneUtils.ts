import React from "react";
import {
  readFileEntry,
  readDirectoryEntry,
  FileSystemEntry,
  FileSystemFileEntry,
  FileSystemDirectoryEntry,
} from "./FileApiHelpers";

/**
 * Custom MIME type used by internal tree drags to distinguish them from
 * file-system drops. Using a custom type avoids false positives when an
 * external application happens to set application/json on its drag data.
 */
export const INTERNAL_DRAG_MIME_TYPE = "application/x-giant-tree-entry";

/**
 * Reads files from a drag event - handles both direct file drops and directories.
 * using the File System Access API.
 *
 * Only two kinds of selection are accepted:
 *  1. A single directory (its full hierarchy is preserved); or
 *  2. One or more files with no directories.
 *
 * Any other combination (e.g. mixed files and folders, or multiple folders) is
 * rejected to avoid the ambiguous duplicate-entry problem that arises when the
 * OS includes both a folder and its visible children as separate DataTransfer
 * items.
 *
 * @param e - The React drag event
 * @returns A Map of file paths to File objects
 * @throws {Error} if the selection doesn't match one of the two accepted shapes
 */
export async function readFilesFromDragEvent(
  e: React.DragEvent,
): Promise<Map<string, File>> {
  // Collect all entries and fallback files synchronously before any async work.
  // The browser clears the DataTransfer after the event handler returns,
  // so awaiting inside the loop would lose items beyond the first.
  const entries: FileSystemEntry[] = [];
  const fallbackFiles: File[] = [];

  for (const item of e.dataTransfer.items) {
    const entry = item.webkitGetAsEntry();

    if (entry) {
      entries.push(entry);
    } else {
      // Fallback for browsers that don't support webkitGetAsEntry
      const file = item.getAsFile();

      if (file) {
        fallbackFiles.push(file);
      }
    }
  }

  const directoryEntries = entries.filter((e) => e.isDirectory);
  const fileEntries = entries.filter((e) => e.isFile);

  // Validate the selection shape
  if (directoryEntries.length > 1) {
    throw new Error(
      "Please drag a single folder, or one or more individual files. " +
        "Dragging multiple folders at once is not supported.",
    );
  }

  if (
    directoryEntries.length === 1 &&
    (fileEntries.length > 0 || fallbackFiles.length > 0)
  ) {
    throw new Error(
      "Please drag either a single folder or individual files, but not both at the same time.",
    );
  }

  // Now process collected entries asynchronously
  const files = new Map<string, File>();

  if (directoryEntries.length === 1) {
    // Single directory: read its full hierarchy
    const directoryFiles = await readDirectoryEntry(
      directoryEntries[0] as FileSystemDirectoryEntry,
    );

    for (const [path, file] of directoryFiles) {
      files.set(path, file as File);
    }
  } else {
    // Files only (no directories)
    for (const entry of fileEntries) {
      const file = await readFileEntry(entry as FileSystemFileEntry);
      files.set(file.name, file as File);
    }

    for (const file of fallbackFiles) {
      files.set(file.name, file);
    }
  }

  if (files.size === 0) {
    throw new Error("The dropped folder was empty.");
  }

  return files;
}

/**
 * Checks if a drag event contains files from the file system (as opposed to
 * internal application data like dragging items within the workspace).
 *
 * @param e - The React drag event
 * @returns true if the drag event contains files from the file system and not internal app data
 */
export function isFilesystemDragEvent(e: React.DragEvent): boolean {
  // Internal tree drags use a custom MIME type — exclude them even if Files is also present
  if (e.dataTransfer.types.includes(INTERNAL_DRAG_MIME_TYPE)) {
    return false;
  }

  return e.dataTransfer.types.includes("Files");
}
