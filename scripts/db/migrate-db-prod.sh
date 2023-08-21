#!/usr/bin/env bash
set -e

SCRIPT_PATH=$( cd $(dirname $0) ; pwd -P )
MIGRATE_DIRECTORY="$SCRIPT_PATH/../../postgres/migrate-db"

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
PORT=25432

SSH_COMMAND=$(ssm ssh --raw -t pfi-worker,pfi-playground,rex --newest --profile investigations)
eval ${SSH_COMMAND} -L $PORT:$DB_HOST:5432 -o ExitOnForwardFailure=yes -f sleep 10


echo "change directory to $DATA_DIRECTORY"

cd $MIGRATE_DIRECTORY

source ~/.nvm/nvm.sh
nvm use
npm install
npm run start PROD $PORT