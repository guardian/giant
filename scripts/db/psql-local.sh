#/usr/bin/env bash
PGPASSWORD=giant psql -h localhost -p 8432 -U giant_master -d giant "$@"
