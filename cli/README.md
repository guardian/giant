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
pfi-cli status --help
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
| `status` | Check upload progress in S3 (useful after interruptions) |
| `create-ingestion` | Create a new ingestion |
| `ingest` | Upload files into an ingestion |
| `verify` | Check that all source files have been indexed |
| `delete-ingestion` | Delete an ingestion and its files |
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
All these commands default the `--uri` parameter to `http://localhost:9001`

```
pfi-cli login --token YOUR_TOKEN_HERE
```

The above command writes to `~/.pfi-token`

6. Create the ingestion

```
pfi-cli create-ingestion --ingestionUri "BinLaden/ingestion"
```

This will confirm the collection and ingestion names and print the next command to run.

7. Preview what will be uploaded using `--dry-run`:

```
pfi-cli ingest \
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
  --ingestionUri "BinLaden/ingestion" \
  --bucket pfi-giant-ingest-data-rex \
  --sseAlgorithm aws:kms \
  --path /data/BinLaden \
  > /tmp/pfi-cli-output &
```

The ingest command will:
- Scan the source directory and show a summary before uploading
- Track progress (files processed, throughput, data volume)

9. Once the phase 1 ingestion is complete, you'll need to look in the Giant logs to monitor phase 2 ingestion progress. These can be found at `/var/log/pfi/frontend.log`

### Checking Upload Status

If you're unsure where a partial upload got to (e.g. the checkpoint file is missing, or you're diagnosing an old upload), the `status` command reads the S3 ingest bucket directly:

```bash
# See how many files made it to S3
pfi-cli status --ingestionUri "BinLaden/ingestion" \
  --bucket pfi-giant-ingest-data-rex

# Compare against local files to see what's missing
pfi-cli status --ingestionUri "BinLaden/ingestion" \
  --bucket pfi-giant-ingest-data-rex \
  --path /data/BinLaden
```

With `--path`, this shows the number of files on disk vs in S3, a progress percentage, and lists the first 20 missing files.

### Browsing Ingestions

```bash
# List all collections and ingestions
pfi-cli list

# Show details of a specific ingestion (including indexed file count)
pfi-cli show --ingestionUri "BinLaden/ingestion"

# Verify all source files have been indexed after phase 2 completes
pfi-cli verify --ingestion "BinLaden/ingestion"
```

### Running pfi-cli locally
When running locally pfi-cli works best when pointed directly at the play server rather than at giant.local.blah. You also
need to make sure you tell pfi-cli to use minio rather than uploading stuff to S3. Here are some example commands:

```bash
./pfi-cli login --token $GIANT_KEY --uri http://localhost:9001
./pfi-cli create-ingestion --uri http://localhost:9001 --ingestionUri testfolder/test
./pfi-cli ingest --path ~/stufftoingest --languages english --ingestionUri testfolder/test --minioAccessKey minio-user --minioEndpoint http://localhost:9090 --minioSecretKey reallyverysecret
```

To check the status of a local upload against Minio:
```bash
./pfi-cli status --ingestionUri testfolder/test --path ~/stufftoingest --minioAccessKey minio-user --minioEndpoint http://localhost:9090 --minioSecretKey reallyverysecret
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

The `delete-ingestion` command will prompt for confirmation before proceeding. Use `--force` to skip the prompt (e.g. in scripts).

If a blob exists in multiple ingestions, you need to either delete the blob in the Giant UI, or pass all of the relevant ingestions to `delete-ingestion`. Use `--conflictBehaviour` to control what happens:

- `stop` (default) — abort if a file also belongs to another ingestion
- `skip` — leave shared files alone, only delete unshared ones
- `delete` — remove the file from all ingestions

Here's an example command to delete from two ingestions, running as a background task detached from the terminal.

**This assumes you're running on a Giant instance where the URI is localhost. To run locally, supply a `--uri` param**

```bash
(nohup ./pfi-cli delete-ingestion --ingestionUri \
  'Collection/ingestion' \
  'Collection/ingestion2' \
  --force \
    >>output.log 2>errors.log &)
```
