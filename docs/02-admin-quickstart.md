# Getting started as a Giant administrator

## Creating the initial admin (genesis) user

TODO

## Uploading large amounts of data using the CLI

Small numbers of files are best uploaded to Giant by creating a workspace and uploading through
the web UI. Uploading larger amounts of data is done using the PFI command line,
[pfi-cli](../cli).

Uploads are grouped under collections (labelled Datasets in the UI), with multiple ingestions
within each collection. A collection represents a single logical dataset to the user, with an
ingestion representing each upload of data to that dataset. The collection name should describe
the data in a meaningful way to users with each ingestion name meaningful to administrators and
devleopers, probably including a description of the source media itself and when the ingestion
was performed.

First create an ingestion. The collection will be created automatically if it doesn't exist yet:

```
pfi-cli create-ingestion \
  --ingestionUri <collection_name>/<ingestion_name> \
  --languages <comma_separated_languages eg english,russian>
```

Then run the upload:

```
pfi-cli ingest \
  --ingestionUri <collection_name>/<ingestion_name> \
  --path <path to the data on disk>
  --languages <comma_separated_languages eg english,russian> \
  --minioAccessKey <see application.conf> \
  --minioSecretKey <see application.conf>
```
