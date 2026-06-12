#!/usr/bin/env bash
#
# One-off workspace download using your existing pfi-cli login.
# Reconstructs a workspace on disk with its folder structure and original
# file names, by reading the workspace tree from the API and downloading each
# file through Giant's per-file download endpoint.
#
# Requires: pfi-cli (already logged in), curl, jq.
# Resumable: re-run it and it skips files already on disk.
#
# Usage:
#   ./download-workspace.sh <giant-uri> <workspaceId> <output-dir> [concurrency]
#
# Example:
#   ./download-workspace.sh https://giant.pfi.gutools.co.uk 1a2b3c... ./export 8

set -uo pipefail

# --- locate pfi-cli: prefer the locally-built binary in this repo --------------
# Resolves relative to this script's location, so it works from any CWD. This script
# lives in scripts/download_scripts/, so the repo root is two levels up. Override with
# PFI_CLI=/path/to/bin.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PFI_CLI="${PFI_CLI:-}"
if [ -z "$PFI_CLI" ]; then
  if [ -x "$REPO_ROOT/cli/target/universal/pfi-cli-0.1.0-SNAPSHOT/bin/pfi-cli" ]; then
    PFI_CLI="$REPO_ROOT/cli/target/universal/pfi-cli-0.1.0-SNAPSHOT/bin/pfi-cli"
  else
    # Fall back to any built version, then to one on PATH.
    PFI_CLI="$(ls "$REPO_ROOT"/cli/target/universal/pfi-cli-*/bin/pfi-cli 2>/dev/null | head -1)"
    [ -z "$PFI_CLI" ] && command -v pfi-cli >/dev/null 2>&1 && PFI_CLI="pfi-cli"
  fi
fi
{ [ "$PFI_CLI" = "pfi-cli" ] || [ -x "$PFI_CLI" ]; } || {
  echo "Could not find pfi-cli. Build it with 'sbt cli/stage' (or unzip the dist), or set PFI_CLI=/path/to/pfi-cli"
  exit 1
}

# Wrapper: silence logback's internal status messages, which some builds dump to stdout
# (lines like "16:54:13,774 |-INFO in ch.qos.logback...") and which would otherwise corrupt
# the captured token and the workspace-tree JSON.
pfi() { "$PFI_CLI" -Dlogback.statusListenerClass=ch.qos.logback.core.status.NopStatusListener "$@"; }

URI="${1:?giant uri, e.g. https://giant.pfi.gutools.co.uk}"
WS="${2:?workspaceId (from the workspace URL in the browser)}"
OUT="${3:?output directory}"
CONC="${4:-8}"

WORK="$(mktemp -d)"
AUTH_FILE="$WORK/auth.header"
TREE="$WORK/tree.json"
LIST="$WORK/files.tsv"

mkdir -p "$OUT"

# --- auth: capture the bearer header, and keep it fresh for long runs --------
# Capture just the header line, ignoring any other stray output.
pfi auth --uri "$URI" 2>/dev/null | grep -m1 '^Authorization: ' > "$AUTH_FILE"
[ -s "$AUTH_FILE" ] || { echo "Login failed — run '$PFI_CLI login --uri $URI --token <token>' first"; exit 1; }

( while true; do
    sleep 120
    pfi auth --uri "$URI" 2>/dev/null | grep -m1 '^Authorization: ' > "$AUTH_FILE.tmp" && [ -s "$AUTH_FILE.tmp" ] && mv "$AUTH_FILE.tmp" "$AUTH_FILE"
  done ) &
REFRESHER=$!
trap 'kill "$REFRESHER" 2>/dev/null; rm -rf "$WORK"' EXIT

# --- fetch the workspace tree -------------------------------------------------
echo "Fetching workspace tree..."
pfi api --uri "$URI" "/api/workspaces/$WS/nodes" > "$TREE" || { echo "Failed to fetch workspace tree"; exit 1; }

# Nest the export under a folder named after the workspace. The backend keeps the tree's
# root node name in sync with the workspace name, so the top-level .name is the workspace name.
WS_NAME="$(jq -r '(.name // "") | gsub("/";"_") | gsub("\\\\";"_")' "$TREE")"
[ -z "${WS_NAME// /}" ] && WS_NAME="workspace-$WS"
OUT="$OUT/$WS_NAME"
ERRORS="$OUT/_download-errors.tsv"
mkdir -p "$OUT"
: > "$ERRORS"
echo "Workspace: $WS_NAME"

# --- flatten to: <blobUri>\t<relative/path/with/original-name> ----------------
# Folders contribute their name as a path segment; the workspace root's own name
# is dropped. Leaves without a backing blob (data.uri) are skipped. Slashes in
# names are sanitised so they don't create spurious directories.
jq -r '
  def clean: gsub("/";"_") | gsub("\\\\";"_");
  def emit($dir):
    if has("children") then
      ($dir + "/" + (.name|clean)) as $d | .children[] | emit($d)
    else
      (.data.uri // "") as $u
      | if $u == "" then empty
        else [ $u, (($dir + "/" + (.name|clean)) | ltrimstr("/")) ] | @tsv
        end
    end;
  .children[] | emit("")
' "$TREE" > "$LIST"

COUNT="$(wc -l < "$LIST" | tr -d ' ')"
echo "$COUNT file(s) to download into $OUT (concurrency $CONC)"
[ "$COUNT" -eq 0 ] && { echo "Nothing to download."; exit 0; }

# --- per-file worker: two-step authorised download ----------------------------
fetch_one() {
  local TAB=$'\t' rec="$1"
  local blob="${rec%%${TAB}*}" rel="${rec#*${TAB}}"
  local dest="$OUT/$rel"
  [ -s "$dest" ] && return 0                      # resume: already downloaded
  mkdir -p "$(dirname "$dest")"
  local auth jar target
  auth="$(cat "$AUTH_FILE")"
  jar="$(mktemp)"
  # 1. authorise: returns the target URL as the body and sets a session cookie
  target="$(curl -fsS -c "$jar" -H "$auth" "$URI/api/download/auth/$blob")" \
    || { printf '%s\t%s\t%s\n' AUTHFAIL "$blob" "$rel" >> "$ERRORS"; rm -f "$jar"; return 0; }
  # 2. download: must carry the cookie and hit the returned target verbatim
  if curl -fsS -b "$jar" -H "$auth" -o "$dest.part" "$URI$target"; then
    mv "$dest.part" "$dest"
  else
    printf '%s\t%s\t%s\n' GETFAIL "$blob" "$rel" >> "$ERRORS"; rm -f "$dest.part"
  fi
  rm -f "$jar"
}
export -f fetch_one
export URI OUT AUTH_FILE ERRORS

# Null-delimit each record so spaces/quotes in paths are safe, one per worker.
awk -F'\t' '{printf "%s\t%s\0", $1, $2}' "$LIST" \
  | xargs -0 -P "$CONC" -n1 bash -c 'fetch_one "$0"'

DONE="$(find "$OUT" -type f ! -name '_download-errors.tsv' | wc -l | tr -d ' ')"
FAILED="$(wc -l < "$ERRORS" | tr -d ' ')"
echo "Done. $DONE file(s) on disk; $FAILED failure(s)."
[ "$FAILED" -gt 0 ] && echo "Failures logged to $ERRORS (re-run to retry — completed files are skipped)."
exit 0
