#!/usr/bin/env bash
set -e

# Do another build limited to just the binaries and upload under the Giant stack
# To achieve this we unfortunately need to edit riff-raff.yaml directly.
sed -i -e "s/pfi-playground/pfi-giant/g" riff-raff.yaml
sbt -DPFI_STACK=pfi-giant riffRaffUpload
