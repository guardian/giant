#!/usr/bin/env bash

echo "Cloning whisper.cpp"
git clone git@github.com:ggerganov/whisper.cpp.git ~/code/whisper.cpp

echo "downloading ggml model"
bash ~/code/whisper.cpp/models/download-ggml-model.sh large

echo "compiling whisper.cpp"
pushd ~/code/whisper.cpp
make
popd