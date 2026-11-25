#!/usr/bin/env bash
set -euo pipefail

repo_dir=$(cd "$(dirname "$0")/.." && pwd -P)
version=6.5.438
sha256=fcbe9ba21d9911843e3502adc178a7f549a524a4055f887bedc942e5490c6ba1
distribution="pdfjs-${version}-dist"
cache_dir="${XDG_CACHE_HOME:-$HOME/.cache}/giant"
archive="$cache_dir/$distribution.zip"
assets_dir="$repo_dir/backend/public/third-party"
viewer_dir="$assets_dir/$distribution"

mkdir -p "$cache_dir" "$repo_dir/backend/target"
staged=$(mktemp -d "$repo_dir/backend/target/$distribution.XXXXXX")
trap 'rm -rf "$staged"' EXIT

if [[ -f "$archive" ]]; then
    cp "$archive" "$staged/viewer.zip"
else
    curl --fail --silent --show-error --location --retry 3 \
        "https://github.com/mozilla/pdf.js/releases/download/v$version/$distribution.zip" \
        --output "$staged/viewer.zip"
fi

if ! printf '%s  %s\n' "$sha256" "$staged/viewer.zip" | shasum -a 256 --check --status; then
    echo "PDF.js viewer checksum mismatch. Remove $archive if it exists and rerun setup." >&2
    exit 1
fi

unzip -q "$staged/viewer.zip" -d "$staged/viewer" -x '*.mjs.map' 'web/compressed.tracemonkey-pldi-09.pdf'
if [[ ! -f "$archive" ]]; then
    mv "$staged/viewer.zip" "$archive"
fi

if [[ -d "$viewer_dir" ]] && diff -qr "$staged/viewer" "$viewer_dir" >/dev/null; then
    exit 0
fi

rm -rf "$viewer_dir"
mv "$staged/viewer" "$viewer_dir"
