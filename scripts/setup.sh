#!/usr/bin/env bash

echo "Installing contents of Brewfile..."
brew bundle

echo "Installing frontend dependencies..."
pushd frontend
npm install
popd

echo "Starting docker containers for databases/object storage..."
./scripts/start-containers.sh

echo "Running postgres migrations..."
pushd infra/migrate-db
npm install
npm run start DEV 8432
popd

echo "Setup complete"