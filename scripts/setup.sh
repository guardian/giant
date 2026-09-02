#!/usr/bin/env bash

if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "Installing contents of Brewfile..."
  brew bundle
else
  sudo apt update
  sudo apt install -y libreoffice ocrmypdf imagemagick qpdf ffmpeg xpdf tesseract-ocr-all
fi

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

echo "Running cluster setup script to make sure giant can run libre office and work round a tesseract bug..."
./scripts/cluster-setup.sh

echo "Creating giant buckets in garage container"
./scripts/initialise-garage.sh

echo "Setup complete"
