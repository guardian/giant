#!/bin/bash

# build cloudformation
cd postgres
npm install
npm run synth

# upload to riffraff
./node_modules/.bin/node-riffraff-artifact