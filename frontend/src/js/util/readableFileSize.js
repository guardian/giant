export function readableFileSize(bytes, fractionalDigits = 1) {
  const threshold = 1024;
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];

  if (bytes < 0 || bytes > Math.pow(threshold, units.length)) {
    throw new Error(
      `Cannot convert to human readable bytes, value is out of range (${bytes}).`,
    );
  }

  let unitIdx = 0;

  while (bytes >= threshold) {
    bytes /= threshold;
    unitIdx += 1;
  }

  return bytes.toFixed(fractionalDigits) + " " + units[unitIdx];
}
