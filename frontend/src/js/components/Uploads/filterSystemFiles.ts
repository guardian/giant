// Filenames commonly produced by macOS and Windows that have no value
// as uploaded content.
const JUNK_BASENAMES = new Set([
  ".ds_store",
  "thumbs.db",
  "desktop.ini",
  ".apdisk",
]);

// Directory names that are OS system artifacts — if any path segment
// matches one of these, the file is junk.
const JUNK_SEGMENTS = new Set([
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
  const lowerPath = path.toLowerCase();
  const name = basename(lowerPath);

  if (JUNK_BASENAMES.has(name)) {
    return true;
  }

  // AppleDouble resource fork files (._<filename>)
  if (name.startsWith("._")) {
    return true;
  }

  return lowerPath.split("/").some((segment) => JUNK_SEGMENTS.has(segment));
}

export function filterSystemFiles(files: Map<string, File>): Map<string, File> {
  return new Map([...files].filter(([path]) => !isSystemFile(path)));
}
