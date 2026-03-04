/**
 * Human-friendly "File Type" categories for the filter chip.
 *
 * Each category maps a short key to a user-visible label and the set of
 * concrete MIME types it covers.  The MIME lists are drawn from
 * fileTypeIcon.js groupings and MimeDetails.scala.
 *
 * Serialisation contract:
 *   UI chip  →  { name: "File Type", values: ["pdf","spreadsheet"] }
 *   Backend  →  { n: "Mime Type", v: "application/pdf OR …", t: "file_type" }
 *
 * The `t: "file_type"` marker lets parseChips reconstitute the File Type
 * chip on re-parse without confusing it with raw Mime Type chips.
 */

export const FILE_TYPE_CATEGORIES = [
  {
    value: "pdf",
    label: "PDF",
    mimes: ["application/pdf"],
  },
  {
    value: "word",
    label: "Word Documents",
    mimes: [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-word.document.macroenabled.12",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
    ],
  },
  {
    value: "spreadsheet",
    label: "Spreadsheets",
    mimes: [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel.sheet.binary.macroenabled.12",
      "application/vnd.ms-excel.sheet.macroenabled.12",
      "application/vnd.ms-spreadsheetml",
      "text/csv",
    ],
  },
  {
    value: "presentation",
    label: "Presentations",
    mimes: [
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
      "application/vnd.ms-powerpoint.presentation.macroenabled.12",
      "application/vnd.ms-powerpoint.slideshow.macroenabled.12",
      "application/vnd.apple.keynote",
    ],
  },
  {
    value: "email",
    label: "Emails",
    mimes: ["message/rfc822", "application/vnd.ms-outlook"],
  },
  {
    value: "image",
    label: "Images",
    mimes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/tiff",
      "image/bmp",
      "image/webp",
      "image/svg+xml",
    ],
  },
  {
    value: "audio",
    label: "Audio",
    mimes: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/flac", "audio/aac"],
  },
  {
    value: "video",
    label: "Video",
    mimes: [
      "video/mp4",
      "video/mpeg",
      "video/webm",
      "video/quicktime",
      "video/x-msvideo",
    ],
  },
  {
    value: "web",
    label: "Web Pages",
    mimes: ["text/html", "application/xhtml+xml"],
  },
  {
    value: "archive",
    label: "Archives",
    mimes: [
      "application/zip",
      "application/gzip",
      "application/x-tar",
      "application/x-gtar",
      "application/x-bzip2",
      "application/x-compress",
      "application/zlib",
      "application/java-archive",
    ],
  },
  {
    value: "text",
    label: "Plain Text",
    mimes: ["text/plain"],
  },
];

// ── Derived look-ups (built once at module load) ─────────────────────

/** Map: category key → array of MIME types */
const _categoryToMimes = new Map(
  FILE_TYPE_CATEGORIES.map((c) => [c.value, c.mimes]),
);

/** Map: MIME type → category key (first match wins) */
const _mimeToCategory = new Map();
FILE_TYPE_CATEGORIES.forEach((c) => {
  c.mimes.forEach((m) => {
    if (!_mimeToCategory.has(m)) {
      _mimeToCategory.set(m, c.value);
    }
  });
});

/**
 * Expand an array of category keys into a flat array of MIME types.
 * Unknown keys are silently ignored.
 */
export function expandFileTypeValues(categoryKeys) {
  const mimes = [];
  (categoryKeys || []).forEach((key) => {
    const list = _categoryToMimes.get(key);
    if (list) mimes.push(...list);
  });
  return mimes;
}

/**
 * Look up the category key for a single MIME type.
 * Returns undefined if the MIME doesn't belong to any category.
 */
export function mimeToCategory(mime) {
  return _mimeToCategory.get(mime);
}

/**
 * Reverse-map an array of MIME types back to unique category keys,
 * preserving the order in which each category first appears.
 * MIMEs that don't match any category are silently dropped.
 */
export function collapseMimesToCategories(mimes) {
  const seen = new Set();
  const keys = [];
  (mimes || []).forEach((m) => {
    const key = _mimeToCategory.get(m);
    if (key && !seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  });
  return keys;
}
