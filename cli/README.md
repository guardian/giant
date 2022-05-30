## pfi-cli

This is typically used for ingesting datasets which are too large to feasibly be uploaded via the UI. It is installed via a Debian package on worker instances so is available as `pfi-cli` on these boxes.

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
