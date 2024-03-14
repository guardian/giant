#!/usr/bin/env bash

script_dir=$(dirname $0)
(${script_dir}/start-backend.sh &)
(${script_dir}/start-frontend.sh &)
