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

### User Experience Features

The CLI includes several features to improve usability and provide better feedback:

#### Verbose Mode
Add `--verbose` to any command for detailed output:
```bash
pfi-cli login --token YOUR_TOKEN --verbose
```
- Shows success confirmations
- Displays full stack traces for errors
- Provides detailed progress information

#### Enhanced Error Messages
Errors now include:
- Clear explanation of what went wrong
- Actionable suggestions for fixing the issue
- Context-aware help based on the error type

Example error output:
```
❌ Error: Authentication failed - your session may have expired

💡 Suggestion: Run 'pfi-cli login' to authenticate
   - Use --token flag if you have a JWT token from the UI
   - Check that your token hasn't expired

💡 Run with --verbose for more details
```

#### Color-Coded Output
- Errors appear in red (❌)
- Warnings in yellow (⚠)
- Success messages in green (✓)
- Informational hints in cyan (💡)
- Colors automatically disable when output is piped or redirected

#### Progress Tracking
Long-running operations like ingestion show:
- Number of files processed
- Throughput (files/sec)
- Total data size processed
- Time elapsed
- Success/failure counts

Example progress output:
```
Starting Phase I ingestion of BinLaden/ingestion...
✓ 250 processed (41.7 files/sec, 1.2GB)
✓ 500 processed (45.2 files/sec, 2.8GB)
✓ Phase I ingestion completed: 5,000 files, 14.3GB in 1m 52s
```

#### Upfront Validation
Commands validate parameters before starting work:
- Ingestion URI format (`<collection>/<ingestion>`)
- File paths exist and are readable
- Required parameters are provided

This catches common mistakes early, before spending time on long operations.

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

6. Run the ingest job in the background with nohup, redirecting output to a log file, so it will continue to run after you end your terminal session.

Note that if the command fails for some reason, you will need to change the ingestion name before running it again otherwise it will fail saying there's already an ingestion with that name.
```
nohup pfi-cli ingest \
  --ingestionUri "BinLaden/ingestion" \
  --bucket pfi-giant-ingest-data-rex \
  --sseAlgorithm aws:kms \
  > /tmp/pfi-cli-output &
  ```

7. Once the phase 1 ingestion is complete, you'll need to look in the Giant logs to monitor phase 2 ingestion progress. These can be found at `/var/log/pfi/frontend.log`

### Running pfi-cli locally
When running locally pfi-cli works best when pointed directly at the play server rather than at giant.local.blah. You also
need to make sure you tell pfi-cli to use minio rather than uploading stuff to S3. Here are some example commands:

```bash
./pfi cli login --token $GIANT_KEY --uri http://localhost:9001
./pfi-cli create-ingestion --uri http://localhost:9001 --ingestionUri testfolder/test
./pfi-cli ingest --path ~/stufftoingest --languages english --ingestionUri testfolder/test --minioAccessKey minio-user --minioEndpoint http://localhost:9090 --minioSecretKey reallyverysecret
```

**Tip:** Add `--verbose` to see detailed output during development:
```bash
./pfi-cli ingest --path ~/stufftoingest --ingestionUri testfolder/test --verbose
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

#### Getting More Information
For any error, add `--verbose` to see:
- Full stack traces
- Detailed request/response information
- Step-by-step progress through the operation

### Deleting data with the CLI
If a blob exists in multiple ingestions, you need to either delete the blob in the Giant UI, or pass all of the relevant ingestions to `delete-ingestion`.

Here's an example command to delete from two ingestions, running as a background task detached from the terminal.

**This assumes you're running on a Giant instance where the URI is localhost. To run locally, supply a `--uri` param**

```bash
(nohup ./pfi-cli delete-ingestion --ingestionUri \
  'Collection/ingestion' \
  'Collection/ingestion2' \
    >>output.log 2>errors.log &)
```
