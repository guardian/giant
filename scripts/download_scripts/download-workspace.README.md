# One-off workspace download scripts

Two standalone scripts to download an entire Giant **workspace** to disk, preserving its
folder structure and original file names. Aimed at large workspaces (100,000+ files) that
aren't practical to download file-by-file through the UI.

Both reconstruct the same thing on disk — they differ only in *where* they pull the file
bytes from:

| Script | Pulls bytes from | Needs | Speed |
|---|---|---|---|
| `download-workspace.sh` | Giant's HTTP download endpoint | just your `pfi-cli` login | slower (2 requests/file) |
| `download-workspace-s3.sh` | the blob S3 bucket, by content hash | `pfi-cli` login **+** AWS read on the bucket | fast (esp. with `s5cmd`) |

If you have AWS access to the blob bucket, prefer the S3 script. Otherwise the credentials-only
script needs nothing but your Giant login.

Both are **resumable**: re-run and they skip files already on disk.

---

## Prerequisites

- `pfi-cli` — the scripts auto-locate the locally-built binary at
  `cli/target/universal/pfi-cli-*/bin/pfi-cli` (relative to the repo), or one on your `PATH`,
  or whatever you point `PFI_CLI=/path/to/pfi-cli` at. Build it with `sbt cli/stage` if needed.
  Log in once first (`$PFI_CLI` below is that resolved binary):
  ```bash
  PFI_CLI=cli/target/universal/pfi-cli-0.1.0-SNAPSHOT/bin/pfi-cli
  "$PFI_CLI" login --uri <giant-uri> --token <token from Settings > About>
  ```
- `jq`
- `curl` (HTTP script) — usually preinstalled
- AWS CLI, and ideally [`s5cmd`](https://github.com/peak/s5cmd) (S3 script only)

Find the **workspaceId** in the workspace's URL in the browser. The scripts live in
`scripts/download_scripts/` and work from any directory (they locate the repo themselves), e.g.
`./scripts/download_scripts/download-workspace.sh …` from the repo root.

---

## Option A — credentials only (HTTP endpoint)

Needs nothing but your `pfi-cli` login.

```bash
./download-workspace.sh <giant-uri> <workspaceId> <output-dir> [concurrency]

# example
./download-workspace.sh https://giant.pfi.gutools.co.uk 1a2b3c... ./export 8
```

How it works:
1. `pfi-cli auth` → captures your bearer token (auto-refreshed in the background for long runs).
2. `pfi-cli api …/workspaces/<id>/nodes` → fetches the workspace tree; `jq` flattens it to
   `(blobUri, relative/path/with/original-name)`.
3. For each file, the two-step download the UI uses:
   `GET /api/download/auth/:uri` (authorises, sets a session cookie) →
   `GET /api/download/get/:uri` (streams the blob to disk).

Downloads run in parallel (`concurrency`, default 8). Failures are logged to
`<output-dir>/_download-errors.tsv`; re-run to retry just those.

Trade-off: ~2 requests per file (≈200k requests for 100k files). Reliable, but slower than S3.

---

## Option B — direct from S3 (fast)

Needs AWS read access to the blob bucket. For the `rex` stack the bucket is
**`pfi-giant-data-rex`** (the `collections` bucket).

```bash
./download-workspace-s3.sh <giant-uri> <workspaceId> <output-dir> <bucket> [aws-profile] [s3-endpoint]

# example
./download-workspace-s3.sh https://giant.pfi.gutools.co.uk 1a2b3c... ./export pfi-giant-data-rex investigations
```

The optional 6th argument is a custom S3 endpoint (for local Garage testing — see below).

How it works:
1. Fetches and flattens the workspace tree (same as Option A), recording each file's size.
2. **Disk-space pre-check**: sums the recorded file sizes, prints the total (`Total recorded size:
   ~X GB across N file(s)`), and warns if the target volume has less free space than that. It then
   **prompts for confirmation** so you can abort after seeing the size. The prompt is skipped when
   stdin isn't a terminal (e.g. `nohup`/background runs) or when `ASSUME_YES=1` is set.
3. **Verifies** the bucket actually holds your data (probes one real blob) before downloading.
4. Skips files already on disk, then downloads with `s5cmd` if installed (massively parallel),
   else `aws s3 cp` under `xargs -P 16`.
5. **Size-verification pass**: checks every file is present and matches the size Giant recorded for
   it (no extra S3 requests), and re-fetches any that are missing, empty, or truncated — then prints
   a summary (`on disk` / `size-verified` / `re-fetched`). This closes the gap where a hard-killed
   transfer could leave a truncated file that the resume check would otherwise skip.

> **Install `s5cmd` for large jobs** (`brew install peak/tap/s5cmd`). The `aws s3 cp` fallback
> pays ~0.5–1s of process startup *per file*, which dominates when files are small.

### Finding / verifying the bucket

Blobs are stored under a key derived from their content hash: the first 6 characters become
directory segments, followed by the full hash (`Uri.toStoragePath`), e.g.
`AbC-_1…` → `A/b/C/-/_/1/AbC-_1…`.

List candidate buckets and confirm one against a real blob from the workspace:

```bash
aws s3 ls --profile investigations | grep -i giant

storage_path() { local u=$1; echo "${u:0:1}/${u:1:1}/${u:2:1}/${u:3:1}/${u:4:1}/${u:5:1}/$u"; }
BLOB=$("$PFI_CLI" api --uri <giant-uri> /api/workspaces/<id>/nodes \
       | jq -r '.. | .data?.uri? // empty' | head -1)
aws s3 ls "s3://pfi-giant-data-rex/$(storage_path "$BLOB")" --profile investigations
```

A one-line hit means that's the right bucket and you can read it.

---

## Testing locally

The quickest end-to-end smoke test needs **no AWS/object-store config**: run the HTTP-endpoint
script against a local Giant stack. It exercises the same tree-fetch, flatten and folder/name
reconstruction logic, downloading through the local app.

```bash
# with a local Giant running (docker-compose) and pfi-cli logged in to it:
"$PFI_CLI" login --uri http://localhost:9001 --token <token from local Settings > About>
./scripts/download_scripts/download-workspace.sh http://localhost:9001 <workspaceId> ./local-export 4
```

To exercise the **S3 script** locally, point it at the local object store. The dev stack uses
[Garage](https://garagehq.deuxfleurs.fr/) (S3-compatible) on `:3900`, with the `collections` bucket
named `data`. Pass the endpoint as the 6th arg and supply the Garage credentials:

```bash
AWS_ACCESS_KEY_ID=garage-user AWS_SECRET_ACCESS_KEY=reallyverysecret \
  ./scripts/download_scripts/download-workspace-s3.sh http://localhost:9001 <workspaceId> ./local-export \
    data "" http://127.0.0.1:3900
```

Notes for the local object store:
- `s5cmd` handles path-style addressing automatically with `--endpoint-url`. If you fall back to
  the `aws` CLI, run `aws configure set default.s3.addressing_style path` once, otherwise it tries
  virtual-host style (`bucket.127.0.0.1`) which won't resolve.
- The empty `""` 5th argument skips the AWS profile (credentials come from the env vars above).

---

## Notes & caveats (both scripts)

- **Output layout**: files are written under `<output-dir>/<workspace-name>/…`, preserving the
  workspace's folder structure and original file names. The workspace name comes from the tree's
  root node (the backend keeps it in sync with the workspace name); if it's empty it falls back to
  `workspace-<id>`. Slashes in the name are sanitised to `_`.
- **Duplicate paths**: the same blob can appear under multiple workspace paths; it's written to
  each. Slashes in file names are sanitised to `_` so they don't create stray directories.
- **Skipped entries**: leaves with no backing blob (e.g. an unprocessed remote-ingest task or a
  captured URL that never produced a file) are skipped.
- **Read-only**: both scripts only read from Giant/S3 — nothing is modified or deleted.
- **Tokens**: long runs refresh the `pfi-cli` token automatically (Option A) or rely on your AWS
  credentials (Option B). If a run dies, just re-run — completed files are skipped.
- **Don't add `--verbose`** to the underlying `pfi-cli` calls. In verbose mode the CLI appends a
  `✓ … completed successfully` line to stdout, which would corrupt the captured auth token and the
  tree JSON. The scripts run `pfi-cli` in its default quiet mode for this reason.
- **Logback status noise**: some `pfi-cli` builds dump logback's internal status lines (e.g.
  `16:54:13,774 |-INFO in ch.qos.logback...`) to stdout, which leads with a timestamp and breaks
  `jq` ("Expected string key before ':'") and the token capture. The scripts pass
  `-Dlogback.statusListenerClass=…NopStatusListener` to silence it, so this is handled
  automatically — no action needed.
- **AWS profile** (Option B): pass it as the 5th argument. The script exports it as `AWS_PROFILE`
  so both the `aws` CLI and `s5cmd` (including older versions without a `--profile` flag) use it.

These scripts work against any Giant deployment using your existing `pfi-cli` login (they only rely
on the long-standing `pfi-cli auth` and `pfi-cli api` commands). A first-class
`pfi-cli download-workspace` command that does the same S3-by-hash download natively is also in
progress, but these remain a handy, dependency-light option for one-off exports.
