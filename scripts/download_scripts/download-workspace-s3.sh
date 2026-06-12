#!/usr/bin/env bash
#
# Fast one-off workspace download, pulling blobs straight from S3 by content hash.
# Reconstructs the workspace's folder structure and original file names on disk.
#
# Requires: pfi-cli (logged in), jq, and the AWS CLI (and ideally s5cmd) with read
# access to the blob bucket. Resumable: files already on disk are skipped.
#
# Usage:
#   ./download-workspace-s3.sh <giant-uri> <workspaceId> <output-dir> <bucket> [aws-profile] [s3-endpoint]
#
# Examples:
#   # Production (rex stack):
#   ./download-workspace-s3.sh https://giant.pfi.gutools.co.uk <wsId> ./export pfi-giant-data-rex investigations
#
#   # Local stack against Garage (bucket "data", endpoint on :3900):
#   AWS_ACCESS_KEY_ID=garage-user AWS_SECRET_ACCESS_KEY=reallyverysecret \
#     ./download-workspace-s3.sh http://localhost:9001 <wsId> ./export data "" http://127.0.0.1:3900

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
# the workspace-tree JSON we parse with jq.
pfi() { "$PFI_CLI" -Dlogback.statusListenerClass=ch.qos.logback.core.status.NopStatusListener "$@"; }

URI="${1:?giant uri}"
WS="${2:?workspaceId}"
OUT="${3:?output directory}"
BUCKET="${4:?blob bucket, e.g. pfi-giant-data-rex}"
PROFILE="${5:-}"
ENDPOINT="${6:-}"   # optional S3 endpoint, e.g. http://127.0.0.1:3900 for local Garage testing
AWS_ARGS=()
S5_ARGS=()
# Export AWS_PROFILE so every AWS tool (aws cli AND s5cmd, including older versions that
# don't accept a --profile flag) picks up the right credentials from the environment.
if [ -n "$PROFILE" ]; then
  export AWS_PROFILE="$PROFILE"
  AWS_ARGS+=(--profile "$PROFILE")
fi
# A custom endpoint (e.g. local Garage) is passed as a flag to aws/s5cmd, and exported for the
# aws-cp subshell via AWS_ENDPOINT_URL (read by aws cli v2).
if [ -n "$ENDPOINT" ]; then
  export AWS_ENDPOINT_URL="$ENDPOINT"
  AWS_ARGS+=(--endpoint-url "$ENDPOINT")
  S5_ARGS+=(--endpoint-url "$ENDPOINT")
fi

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
TREE="$WORK/tree.json"; LIST="$WORK/files.tsv"
mkdir -p "$OUT"

storage_path() { local u=$1; echo "${u:0:1}/${u:1:1}/${u:2:1}/${u:3:1}/${u:4:1}/${u:5:1}/$u"; }

# Download every "<blobUri>\t<relpath>" line in the given todo file, preserving folder
# structure. Uses s5cmd if available (fast, massively parallel), else parallel aws s3 cp.
# Reused for both the initial download and the verification re-fetch.
download_files() {
  local todo="$1"
  [ -s "$todo" ] || return 0
  if command -v s5cmd >/dev/null 2>&1; then
    local cmds; cmds="$(mktemp)"
    # Build the s5cmd command list with awk (one process) rather than a per-file shell loop.
    awk -F'\t' -v bucket="$BUCKET" -v out="$OUT" '{
      u=$1
      key=substr(u,1,1)"/"substr(u,2,1)"/"substr(u,3,1)"/"substr(u,4,1)"/"substr(u,5,1)"/"substr(u,6,1)"/"u
      printf "cp \"s3://%s/%s\" \"%s/%s\"\n", bucket, key, out, $2
    }' "$todo" > "$cmds"
    s5cmd ${S5_ARGS[@]+"${S5_ARGS[@]}"} run "$cmds"
    rm -f "$cmds"
  else
    export BUCKET OUT
    export -f storage_path
    awk -F'\t' '{printf "%s\t%s\0", $1, $2}' "$todo" \
      | xargs -0 -P 16 -n1 bash -c '
          rec="$0"; TAB=$(printf "\t"); blob="${rec%%${TAB}*}"; rel="${rec#*${TAB}}"
          dest="$OUT/$rel"; mkdir -p "$(dirname "$dest")"
          aws s3 cp "s3://$BUCKET/$(storage_path "$blob")" "$dest" --only-show-errors \
            || echo "FAIL $blob -> $rel" >&2
        '
  fi
}

# Human-readable byte count.
human() { awk -v b="${1:-0}" 'BEGIN{ split("B KB MB GB TB PB",u," "); i=1; while(b>=1024 && i<6){b/=1024;i++} printf "%.1f %s", b, u[i] }'; }

# --- fetch + flatten the workspace tree (same logic as the HTTP-endpoint script) ---
echo "Fetching workspace tree..."
pfi api --uri "$URI" "/api/workspaces/$WS/nodes" > "$TREE" || { echo "Failed to fetch tree"; exit 1; }

# Nest the export under a folder named after the workspace. The backend keeps the tree's
# root node name in sync with the workspace name, so the top-level .name is the workspace name.
WS_NAME="$(jq -r '(.name // "") | gsub("/";"_") | gsub("\\\\";"_")' "$TREE")"
[ -z "${WS_NAME// /}" ] && WS_NAME="workspace-$WS"
OUT="$OUT/$WS_NAME"
mkdir -p "$OUT"
echo "Workspace: $WS_NAME"

# Emit one line per file: <blobUri>\t<relpath>\t<size> (size is "" when the tree has none).
jq -r '
  def clean: gsub("/";"_") | gsub("\\\\";"_");
  def emit($dir):
    if has("children") then
      ($dir + "/" + (.name|clean)) as $d | .children[] | emit($d)
    else
      (.data.uri // "") as $u
      | if $u == "" then empty
        else [ $u, (($dir + "/" + (.name|clean)) | ltrimstr("/")), (.data.size // "" | tostring) ] | @tsv end
    end;
  .children[] | emit("")
' "$TREE" > "$LIST"

COUNT="$(wc -l < "$LIST" | tr -d ' ')"
echo "$COUNT file(s) in workspace."
[ "$COUNT" -eq 0 ] && { echo "Nothing to download."; exit 0; }

# --- disk-space pre-check: sum of recorded sizes vs free space on the target volume ---
TOTAL_BYTES="$(awk -F'\t' '{s+=$3} END{printf "%.0f", s+0}' "$LIST")"
AVAIL_BYTES="$(df -Pk "$OUT" 2>/dev/null | awk 'NR==2{printf "%.0f", $4*1024}')"
echo "Total recorded size: ~$(human "$TOTAL_BYTES") across $COUNT file(s)."
if [ -n "$AVAIL_BYTES" ] && [ "$TOTAL_BYTES" -gt 0 ] && [ "$AVAIL_BYTES" -lt "$TOTAL_BYTES" ]; then
  echo "WARNING: target volume has only ~$(human "$AVAIL_BYTES") free, less than the ~$(human "$TOTAL_BYTES") needed."
  echo "         Free space or pick a larger volume. Continuing (downloads resume on re-run)."
fi

# --- confirm before downloading -----------------------------------------------
# Give a chance to abort after seeing the size. Skipped when stdin isn't a terminal
# (e.g. nohup/background runs, which can't prompt) or when ASSUME_YES=1 is set.
if [ -t 0 ] && [ "${ASSUME_YES:-}" != "1" ]; then
  printf "Download %s file(s) (~%s) into %s? [y/N] " "$COUNT" "$(human "$TOTAL_BYTES")" "$OUT"
  read -r reply
  case "$reply" in
    y|Y|yes|YES) ;;
    *) echo "Aborted."; exit 0 ;;
  esac
fi

# --- verify the bucket actually holds the data ---
PROBE="$(head -1 "$LIST" | cut -f1)"
if ! aws s3 ls "s3://$BUCKET/$(storage_path "$PROBE")" ${AWS_ARGS[@]+"${AWS_ARGS[@]}"} >/dev/null 2>&1; then
  echo "Could not find blob $PROBE in s3://$BUCKET — wrong bucket or no read access?"; exit 1
fi
echo "Verified s3://$BUCKET is readable."

# --- build the work list (blob<TAB>relpath), skipping files already downloaded (resume) ---
TODO="$WORK/todo.tsv"; : > "$TODO"
while IFS=$'\t' read -r blob rel size; do
  [ -s "$OUT/$rel" ] && continue
  printf '%s\t%s\n' "$blob" "$rel" >> "$TODO"
done < "$LIST"

REMAINING="$(wc -l < "$TODO" | tr -d ' ')"
echo "$REMAINING file(s) to fetch ($((COUNT - REMAINING)) already present)."

# --- initial download ---------------------------------------------------------
if [ "$REMAINING" -gt 0 ]; then
  echo "Downloading $REMAINING file(s)..."
  download_files "$TODO"
fi

# --- verify each file is present and the right size; re-fetch any that aren't --
# Uses the size Giant recorded in the tree, so this costs no extra S3 requests. This
# closes the gap where a hard-killed transfer could leave a truncated file that the
# resume check (exists + non-empty) would otherwise skip.
echo "Verifying downloaded files against their recorded sizes..."
if stat -f%z "$LIST" >/dev/null 2>&1; then STATFMT='-f%z'; else STATFMT='-c%s'; fi
RECHECK="$WORK/recheck.tsv"; : > "$RECHECK"
verified=0; unsized=0; bad=0
while IFS=$'\t' read -r blob rel size; do
  dest="$OUT/$rel"
  if [ ! -s "$dest" ]; then
    bad=$((bad+1)); printf '%s\t%s\n' "$blob" "$rel" >> "$RECHECK"
  elif [ -n "$size" ] && [ "$size" != "null" ]; then
    if [ "$(stat $STATFMT "$dest" 2>/dev/null)" = "$size" ]; then verified=$((verified+1))
    else bad=$((bad+1)); printf '%s\t%s\n' "$blob" "$rel" >> "$RECHECK"; fi
  else
    unsized=$((unsized+1))   # tree recorded no size; existence-only check passed
  fi
done < "$LIST"

if [ "$bad" -gt 0 ]; then
  echo "Re-fetching $bad file(s) that were missing or the wrong size..."
  download_files "$RECHECK"
fi

DONE="$(find "$OUT" -type f | wc -l | tr -d ' ')"
echo
echo "Summary:"
echo "  workspace files:           $COUNT"
echo "  on disk:                   $DONE"
echo "  size-verified:             $verified"
[ "$unsized" -gt 0 ] && echo "  present (no size in tree): $unsized"
[ "$bad" -gt 0 ]     && echo "  re-fetched this run:       $bad"
[ "$DONE" -lt "$COUNT" ] && echo "  NOTE: fewer files on disk than expected — re-run to retry any that failed."
echo "Output: $OUT"
