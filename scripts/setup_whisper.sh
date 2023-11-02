#!/usr/bin/env bash
# install whisper in /opt/whisper/ in order to match path on EC2

echo "Cloning whisper.cpp"
sudo git clone git@github.com:ggerganov/whisper.cpp.git /opt/whisper/whisper.cpp

echo "downloading ggml model"
sudo bash /opt/whisper/whisper.cpp/models/download-ggml-model.sh base

echo "compiling whisper.cpp"
pushd /opt/whisper/whisper.cpp
sudo make
popd