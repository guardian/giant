#/usr/bin/env bash
PGPASSWORD=lurch psql -h localhost -p 9432 -U lurch_master -d lurch "$@"
