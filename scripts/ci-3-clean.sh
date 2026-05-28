#!/usr/bin/env bash
set -e

# Avoid problems in case we re-use this checkout again
sed -i -e "s/pfi-giant/pfi-playground/g" riff-raff.yaml
