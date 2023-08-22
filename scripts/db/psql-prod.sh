#!/usr/bin/env bash
set -e

DB_SECRET_ID=$(aws secretsmanager list-secrets \
  --filters Key=tag-value,Values=pfi-giant-postgres-PROD \
  --profile investigations \
  --region eu-west-1 | jq -r '.SecretList | .[0].Name'
)

SECRET=$(aws secretsmanager get-secret-value \
           --secret-id $DB_SECRET_ID \
           --version-stage AWSCURRENT \
           --profile investigations \
           --region eu-west-1 \
             | jq  -r .SecretString)

DB_PASSWORD=$(echo $SECRET | jq -r .password)
DB_HOST=$(echo $SECRET | jq -r .host)

SSH_COMMAND=$(ssm ssh --raw -t pfi-worker,pfi-giant,rex --newest --profile investigations)

# -f to run in background
# sleep 10 to give time for tunnel to be established before psql connects.
# Once psql connects, ssh will keep the tunnel open as long as there is
# at least one open connection, so until you exit psql.
eval ${SSH_COMMAND} -L 25433:$DB_HOST:5432 -o ExitOnForwardFailure=yes -f sleep 10

# For some reason the terminal gets messed up after running the SSH command.
# Possibly the remote terminal changes the window size and some other
# settings? Not sure how else to fix.
reset

PGPASSWORD=$DB_PASSWORD psql -h localhost -p 25433 -U giant_master -d giant "$@"
