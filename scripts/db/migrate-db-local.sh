#!/usr/bin/env bash
set -e

SCRIPT_PATH=$( cd $(dirname $0) ; pwd -P )
MIGRATE_DIRECTORY="$SCRIPT_PATH/../../postgres/migrate-db"

echo "change directory to $DATA_DIRECTORY"

cd $MIGRATE_DIRECTORY

source ~/.nvm/nvm.sh
nvm use
npm install
npm run start DEV 8432