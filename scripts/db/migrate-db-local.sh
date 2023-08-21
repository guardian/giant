#!/usr/bin/env bash
set -e

SCRIPT_PATH=$( cd $(dirname $0) ; pwd -P )
MIGRATE_DIRECTORY="$SCRIPT_PATH/../../postgres/migrate-db"

echo "change directory to $DATA_DIRECTORY"

cd $MIGRATE_DIRECTORY

EXPECTED_NODE_VERSION=$(head -1 .nvmrc)
CURRENT_NODE_VERSION=$(node --version)

if [[ $CURRENT_NODE_VERSION = *"$EXPECTED_NODE_VERSION"* ]]; then
  npm install
  npm run start DEV 8432
else
  echo -e "\033[0;31m ERROR current directory NODE version $CURRENT_NODE_VERSION does not match the expected version $EXPECTED_NODE_VERSION" 1>&2
  exit 1
fi