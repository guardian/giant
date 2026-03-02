import React from "react";
import {
  readFileEntry,
  readDirectoryEntry,
  FileSystemEntry,
  FileSystemFileEntry,
  FileSystemDirectoryEntry,
} from "./FileApiHelpers";

/**
 * Reads files from a drag event - handles both direct file drops and directories.
 * Works across all major browsers on all platforms using the File System Access API.
 *
 * @param e - The React drag event
 * @returns A Map of file paths to File objects
 */
export async function readFilesFromDragEvent(
  e: React.DragEvent,
): Promise<Map<string, File>> {
  const files = new Map<string, File>();

  for (const item of e.dataTransfer.items) {
    if (item.webkitGetAsEntry()) {
      const entry: FileSystemEntry | null = item.webkitGetAsEntry();

      if (entry && entry.isFile) {
        const file = await readFileEntry(entry as FileSystemFileEntry);
        files.set(file.name, file as File);
      } else if (entry && entry.isDirectory) {
        const directoryFiles = await readDirectoryEntry(
          entry as FileSystemDirectoryEntry,
        );

        for (const [path, file] of directoryFiles) {
          files.set(path, file as File);
        }
      }
    } else {
      // Fallback for browsers that don't support webkitGetAsEntry
      const file = item.getAsFile();

      if (file) {
        files.set(file.name, file);
      }
    }
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
export function dragEventContainsFiles(e: React.DragEvent): boolean {
  // Internal tree drags set application/json — exclude those even if Files is also present
  if (e.dataTransfer.types.includes("application/json")) {
    return false;
  }

  // Check if there are any files in the dataTransfer
  if (e.dataTransfer.types.includes("Files")) {
    return true;
  }

  // Also check items for file entries
  for (const item of e.dataTransfer.items) {
    if (item.kind === "file") {
      return true;
    }
  }

  return false;
}
