#!/usr/bin/env bash
set -e

pushd frontend

sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
npm install
npm run build
CI=true npm run test

popd

cp -r frontend/build/* backend/public
# Replace the symbolic link we use in dev with the actual file.
# On Teamcity the JDeb build doesn't seem to follow the symbolic link while packaging, weirdly
# NOTE: On Github actions this seems to work, and in fact it will complain if you try and run the below line
# because it thinks that the two files are the same. So  could be removed at some point but let's leave it for
# a bit in case e.g. github actions custom runners have similar issues
#cp frontend/node_modules/pdfjs-dist/build/pdf.worker.min.js backend/public/third-party/pdf.worker.min.js

#Use java 11
export JAVA_HOME=/usr/lib/jvm/java-11-amazon-corretto
export PATH=$JAVA_HOME/bin:$PATH

echo $(java --version)

# Do a full build of PFI including all tests and upload it to Riff-Raff under the playground stack
sbt -DPFI_STACK=pfi-playground clean riffRaffUploadWithIntegrationTests

# Do another build limited to just the binaries and upload under the Giant stack
# To achieve this we unfortunately need to edit riff-raff.yaml directly.
sed -i -e "s/pfi-playground/pfi-giant/g" riff-raff.yaml
sbt -DPFI_STACK=pfi-giant riffRaffUpload

# Avoid problems in case we re-use this checkout again
sed -i -e "s/pfi-giant/pfi-playground/g" riff-raff.yaml
