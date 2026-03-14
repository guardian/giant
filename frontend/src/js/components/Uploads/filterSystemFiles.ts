// Filenames and path segments commonly produced by macOS and Windows
// that have no value as uploaded content.
const JUNK_BASENAMES = new Set([
  ".ds_store",
  "thumbs.db",
  "desktop.ini",
  ".apdisk",
]);

// Directory or path segment names that are macOS/Windows system artifacts —
// if any segment of the path matches one of these, the file is junk.
const JUNK_PATH_SEGMENTS = new Set([
  "__macosx",
  ".spotlight-v100",
  ".trashes",
  ".fseventsd",
  ".temporaryitems",
]);

function basename(path: string): string {
  const lastSlash = path.lastIndexOf("/");
  return lastSlash === -1 ? path : path.substring(lastSlash + 1);
}

function isSystemFile(path: string): boolean {
  const lowercasedPath = path.toLowerCase();
  const name = basename(lowercasedPath);
  const segments = lowercasedPath.split("/");

  return (
    JUNK_BASENAMES.has(name) ||
    // AppleDouble resource fork files (._<filename>)
    name.startsWith("._") ||
    // Paths containing macOS zip artifact directories or system directories
    segments.some((segment) => JUNK_PATH_SEGMENTS.has(segment))
  );
}

export function filterSystemFiles(files: Map<string, File>): Map<string, File> {
  const filtered = new Map<string, File>();
  for (const [path, file] of files) {
    if (!isSystemFile(path)) {
      filtered.set(path, file);
    }
  }
  return filtered;
}
