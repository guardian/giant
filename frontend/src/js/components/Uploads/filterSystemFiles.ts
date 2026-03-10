// Filenames and path segments commonly produced by macOS and Windows
// that have no value as uploaded content.
const JUNK_BASENAMES = new Set([
  ".ds_store",
  "thumbs.db",
  "desktop.ini",
  ".apdisk",
]);

const JUNK_PATH_SEGMENTS = ["__macosx"];

// Directory names that are macOS system artifacts — if any segment
// of the path matches one of these, the file is junk.
const JUNK_DIRECTORY_NAMES = new Set([
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
  const name = basename(path).toLowerCase();

  if (JUNK_BASENAMES.has(name)) {
    return true;
  }

  // AppleDouble resource fork files (._<filename>)
  if (name.startsWith("._")) {
    return true;
  }

  // Paths containing macOS zip artifact directories or system directories
  const lowerPath = path.toLowerCase();
  const segments = lowerPath.split("/");

  for (const segment of segments) {
    if (
      JUNK_PATH_SEGMENTS.includes(segment) ||
      JUNK_DIRECTORY_NAMES.has(segment)
    ) {
      return true;
    }
  }

  return false;
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
