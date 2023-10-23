#!/usr/bin/env bash

echo "Cloning whisper.cpp"
git clone git@github.com:ggerganov/whisper.cpp.git ~/code/whisper.cpp

echo "downloading ggml model"
bash ~/code/whisper.cpp/models/download-ggml-model.sh large

echo "creating whisper function"
whisper () { ~/code/whisper.cpp/main -m ~/code/whisper.cpp/models/ggml-large.bin "$@"; }