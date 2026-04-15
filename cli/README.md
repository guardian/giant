## pfi-cli

This is typically used for ingesting datasets which are too large to feasibly be uploaded via the UI. It is installed via a Debian package on worker instances so is available as `pfi-cli` on these boxes.

### Getting Help

View all available commands:
```bash
pfi-cli --help
```

Get help for a specific command:
```bash
pfi-cli ingest --help
pfi-cli create-ingestion --help
```

#### Verbose Mode
Add `--verbose` to any command for detailed output:
```bash
pfi-cli login --token YOUR_TOKEN --verbose
```
- Displays full stack traces for errors
- Provides detailed progress information

### Commands Overview

| Command | Description |
|---|---|
| `login` | Authenticate (password, 2FA, or token) |
| `logout` | Remove saved credentials |
| `list` | Show all collections and ingestions |
| `show` | Show details of a specific ingestion |
| `create-ingestion` | Create a new ingestion |
| `ingest` | Upload files into an ingestion |
| `verify` | Check that all source files have been indexed |
| `delete-ingestion` | Delete an ingestion and its files |
| `delete-blobs` | Delete a subset of blobs by path prefix (e.g. a subfolder) |
| `delete-collection` | Delete an entire collection and all its ingestions |
| `hash` | Compute the PFI hash of a file |
| `api` | Make raw authenticated API calls |
| `auth` | Output the auth header for use with other tools |
| `create-users` | Bulk create users |

### Ingestion Workflow

Here are some example steps for performing such an ingestion.

1. Set the `WorkerDataVolumeSize` CloudFormation parameter in the relevant Giant/Playground stack (it will be the one containing `investigations` rather than `neo4j` or `elasticsearch`, e.g. `pfi-giant-investigations-rex`). Set it to at least twice the size of the data you want to ingest. This is because you'll need to download the data to the box and Giant will then need scratch space to make a copy of it, potentially unzip it, etc.

2. Increase the `MaxNumberOfWorkers`, `MinNumberOfWorkers` and `NumberOfWorkers` CloudFormation params to 0 and wait for the existing workers to be killed off. Then set to 1 and wait for a new worker to come up with an EBS volume of the required size. **You need to do this using the CloudFormation params and not just by modifying the ASG directly, because otherwise Giant's own autoscaling logic will potentially start overriding your settings and creating/killing boxes unexpectedly.**

3. ssh onto the worker instance

```
ssm ssh -x --profile investigations -i i-0435ccd9c395ef0b5
```

4. Copy your data onto the mounted volume. `/data` is owned by `root`, hence `sudo`

```
sudo aws s3 cp s3://investigations-testing-data/BinLaden/Everything.20171105.zip /data
```

5. Login to Giant using a token which you can find in Settings > About in the UI. (Make sure you use the relevant stack, i.e. the Playground frontend if you're ingesting data with a Playground worker).

> **Note:** The `--uri` parameter defaults to `http://localhost:9001`, so it can be omitted when running directly on a Giant worker instance. All examples below include it explicitly for clarity.

```
pfi-cli login --uri https://giant.pfi.gutools.co.uk --token YOUR_TOKEN_HERE
```

The above command writes to `~/.pfi-token`

6. Create the ingestion

```
pfi-cli create-ingestion --uri https://giant.pfi.gutools.co.uk \
  --ingestionUri "BinLaden/ingestion"
```

This will confirm the collection and ingestion names and print the next command to run.

7. Preview what will be uploaded using `--dry-run`:

```
pfi-cli ingest \
  --uri https://giant.pfi.gutools.co.uk \
  --ingestionUri "BinLaden/ingestion" \
  --bucket pfi-giant-ingest-data-rex \
  --sseAlgorithm aws:kms \
  --path /data/BinLaden \
  --dry-run
```

This scans the source directory and shows a summary (file count, total size, destination) without uploading anything.

8. Run the ingest job in the background with nohup, redirecting output to a log file, so it will continue to run after you end your terminal session.

```
nohup pfi-cli ingest \
  --uri https://giant.pfi.gutools.co.uk \
  --ingestionUri "BinLaden/ingestion" \
  --bucket pfi-giant-ingest-data-rex \
  --sseAlgorithm aws:kms \
  --path /data/BinLaden \
  > /tmp/pfi-cli-output &
```

The ingest command will:
- Scan the source directory and show a summary before uploading
- Show which top-level directory is currently being uploaded, with a percentage of this run completed
- Track progress (files processed, throughput, data volume)

9. Once the phase 1 ingestion is complete, you'll need to look in the Giant logs to monitor phase 2 ingestion progress. These can be found at `/var/log/pfi/frontend.log`

### Resuming an Interrupted Ingestion

If an ingestion is interrupted (network failure, process killed, etc.), simply re-run the same `ingest` command. The CLI saves a checkpoint file that tracks which files have been successfully uploaded. On resume it will:

1. Load the checkpoint from `~/.pfi-checkpoints/`
2. Skip files that are already uploaded
3. Continue from where it left off

**Important:** Checkpointing relies on absolute local file paths matching between runs. The same `--path` must be used each time — if you move the source files or upload from a different directory, the checkpoint won't recognise the files and will re-upload everything. If you need to add files from a different path to the same ingestion, use `--no-checkpointing`.

```
# Just re-run the same command
pfi-cli ingest \
  --uri https://giant.pfi.gutools.co.uk \
  --ingestionUri "BinLaden/ingestion" \
  --bucket pfi-giant-ingest-data-rex \
  --sseAlgorithm aws:kms \
  --path /data/BinLaden
```

The checkpoint is deleted automatically when the ingestion completes successfully.

#### Disabling Checkpointing

Use `--no-checkpointing` to skip checkpoint read/write entirely. This is useful when:
- Topping up an ingestion with additional files from a different source directory
- Making small one-off additions where checkpoint overhead isn't needed
- The local path doesn't correspond exactly to the original ingestion path

```bash
pfi-cli ingest \
  --ingestionUri "BinLaden/ingestion" \
  --bucket pfi-giant-ingest-data-rex \
  --sseAlgorithm aws:kms \
  --path /data/BinLaden-extras \
  --no-checkpointing
```

### Browsing Ingestions

```bash
# List all collections and ingestions
pfi-cli list --uri https://giant.pfi.gutools.co.uk

# Show details of a specific ingestion (including indexed file count)
pfi-cli show --uri https://giant.pfi.gutools.co.uk \
  --ingestionUri "BinLaden/ingestion"

# Verify all source files have been indexed after phase 2 completes
pfi-cli verify --uri https://giant.pfi.gutools.co.uk \
  --ingestion "BinLaden/ingestion"
```

### Running pfi-cli locally
When running locally pfi-cli works best when pointed directly at the play server rather than at giant.local.blah. You also
need to make sure you tell pfi-cli to use minio rather than uploading stuff to S3. Here are some example commands:

```bash
./pfi-cli login --token $GIANT_KEY --uri http://localhost:9001
./pfi-cli create-ingestion --uri http://localhost:9001 --ingestionUri testfolder/test
./pfi-cli ingest --path ~/stufftoingest --languages english --ingestionUri testfolder/test --minioAccessKey minio-user --minioEndpoint http://localhost:9090 --minioSecretKey reallyverysecret
```

**Tip:** Use `--dry-run` to preview what will be uploaded without actually uploading:
```bash
./pfi-cli ingest --path ~/stufftoingest --ingestionUri testfolder/test --dry-run
```

### Troubleshooting

#### Authentication Issues
If you get authentication errors:
- Run `pfi-cli login --token YOUR_TOKEN` to refresh your session
- Check that your token hasn't expired (tokens are available in Settings > About in the UI)
- Verify the `--uri` parameter points to the correct Giant instance

#### Invalid Ingestion URI
Ingestion URIs must follow the format: `<collection>/<ingestion>`
```bash
# ✓ Correct
pfi-cli create-ingestion --ingestionUri "MyCollection/MyIngestion"

# ✗ Incorrect
pfi-cli create-ingestion --ingestionUri "MyIngestion"
```

#### File Not Found Errors
- Ensure paths are absolute or relative to your current directory
- Check file permissions: files must be readable
- Use `--verbose` to see which file is causing the issue

### Deleting data with the CLI

All delete commands show a preview of what will be affected (including file counts) and prompt for confirmation before proceeding. Use `--force` to skip the prompt (e.g. in scripts).

If a blob exists in multiple ingestions, use `--conflictBehaviour` to control what happens:

- `stop` (default) — abort if a file also belongs to another ingestion
- `skip` — leave shared files alone, only delete unshared ones
- `delete` — remove the file from all ingestions

#### Deleting an entire collection

```bash
# Shows all ingestions with file counts and asks for confirmation
pfi-cli delete-collection --uri https://giant.pfi.gutools.co.uk \
  --collection "BinLaden"
```

#### Deleting specific ingestions

```bash
pfi-cli delete-ingestion --uri https://giant.pfi.gutools.co.uk \
  --ingestionUri 'Collection/ingestion' 'Collection/ingestion2'
```

#### Deleting a subfolder within an ingestion

The `delete-blobs` command deletes blobs matching a path prefix within an ingestion. This is useful for removing a subfolder without deleting the entire ingestion.

```bash
pfi-cli delete-blobs --uri https://giant.pfi.gutools.co.uk \
  --ingestionUri "BinLaden/batch-001" \
  --pathPrefix "unwanted-subfolder/"
```

Note: if the same file content exists at paths both inside and outside the target prefix (within the same ingestion), `delete-blobs` treats this as a conflict — governed by `--conflictBehaviour`, same as cross-ingestion conflicts.

#### Running a large deletion in the background

Here's an example command to delete from two ingestions, running as a background task detached from the terminal.

**This assumes you're running on a Giant instance where the URI is localhost. To run locally, supply a `--uri` param**

```bash
(nohup ./pfi-cli delete-ingestion --ingestionUri \
  'Collection/ingestion' \
  'Collection/ingestion2' \
  --force \
    >>output.log 2>errors.log &)
```
