#!/usr/bin/env bash

echo "Checking backend is running"

curl \
    --retry 60 \
    --retry-delay 5 \
    'http://localhost:9001/healthcheck' 1>/dev/null

if [ $? -eq 0 ]; then
    pushd frontend
    npm run start
    popd
else
    echo "Backend is not running. Launch it using ./scripts/start-backend.sh"
fi
