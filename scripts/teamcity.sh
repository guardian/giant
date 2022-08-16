#!/usr/bin/env bash
set -e

# Make Create React App treat warnings as errors
export CI=true

export NVM_DIR="$HOME/.nvm"
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"  # This loads nvm

nvm install
nvm use

pushd frontend

npm install
npm run build
CI=true npm run test

popd

cp -r frontend/build/* backend/public
# Replace the symbolic link we use in dev with the actual file.
# On Teamcity the JDeb build doesn't seem to follow the symbolic link while packaging, weirdly
cp frontend/node_modules/pdfjs-dist/build/pdf.worker.min.js backend/public/third-party/pdf.worker.min.js

#Use java 11
export JAVA_HOME=/usr/lib/jvm/java-11-amazon-corretto
export PATH=$JAVA_HOME/bin:$PATH

# Do a full build of PFI including all tests and upload it to Riff-Raff under the playground stack
sbt -DPFI_STACK=pfi-playground clean riffRaffUploadWithIntegrationTests

# Do another build limited to just the binaries and upload under the Giant stack
# To achieve this we unfortunately need to edit riff-raff.yaml directly.
sed -i -e "s/pfi-playground/pfi-giant/g" riff-raff.yaml
sbt -DPFI_STACK=pfi-giant riffRaffUpload

# Avoid problems in case we re-use this checkout again
sed -i -e "s/pfi-giant/pfi-playground/g" riff-raff.yaml

# Upload DEV stack
mv riff-raff.yaml riff-raff-PROD.yaml
cp util/riff-raff-DEV.yaml riff-raff.yaml
sbt -DPFI_STACK=pfi-playground-DEV riffRaffUpload

# Revert DEV changes to riffraff config
rm riff-raff.yaml
mv riff-raff-PROD.yaml riff-raff.yaml
