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

echo 'java version:'
echo $(java --version)

# Do a full build of PFI including all tests
sbt -DPFI_STACK=pfi-playground clean runAllTests debian:packageBin Universal/packageZipTarball

mkdir -p target
mv ./backend/target/pfi_0.1.0-SNAPSHOT_all.deb target/pfi_0.1.0-${GITHUB_RUN_NUMBER}_all.deb
mv ./cli/target/pfi-cli_0.1.0-SNAPSHOT_all.deb target/pfi-cli_0.1.0-${GITHUB_RUN_NUMBER}_all.deb
mv ./backend/target/universal/pfi-0.1.0-SNAPSHOT.tgz target/pfi-0.1.0-${GITHUB_RUN_NUMBER}.tgz