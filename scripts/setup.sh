#!/usr/bin/env bash

. ${0%/*}/setup_whisper.sh
brew bundle
pushd frontend
npm install
popd