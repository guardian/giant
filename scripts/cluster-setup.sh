#!/usr/bin/env bash

SCRIPTPATH=$( cd $(dirname $0) ; pwd -P )
SITECONFDIR="$SCRIPTPATH/../backend/conf"

function print_usage {
    echo "PFI setup script

Usage:
    setup.sh [options]
    setup.sh --help

Options:
    -c --clustered    Start, using investigations-01 as the seed node
    -h --help         Show this help message.
    "
}

for arg in "$@"; do
    shift
    case "$arg" in
        "--clustered") set -- "$@" "-c" ;;
        "--help") set -- "$@" "-h" ;;
        *)        set -- "$@" "$arg"
    esac
done

CLUSTERED=false
DEBUG=false

OPTIND=1
while getopts "cdh" opt
do
    case "$opt" in
        "c") CLUSTERED=true ;;
        "h") print_usage; exit 0 ;;
        "?") echo "'$opt' is an unknown flag" >&2; print_usage >&2; exit 1 ;
    esac
done

if [ ! -d "$SITECONFDIR" ]; then
    mkdir -p "$SITECONFDIR"
fi

if $CLUSTERED; then
    echo "Setting up investigations cluster"
    cat << EOF > "$SITECONFDIR/site.conf"
akka.remote.netty.tcp.hostname = "`hostname`"
akka.cluster.seed-nodes = ["akka.tcp://pfi@investigations-01:1234"]

neo4j.url = "bolt://investigations-02:7687"
EOF
fi

case "$OSTYPE" in
    darwin*)
        SOFFICE_BIN="/Applications/LibreOffice.app/Contents/MacOS/soffice"
        ;;
esac

if [ ! -f "$SOFFICE_BIN" ]
then
    SOFFICE_BIN=$(which soffice)
fi

if [ -f "$SOFFICE_BIN" ]
then
    cat << EOF > "$SITECONFDIR/site.conf"
preview.libreOfficeBinary = "${SOFFICE_BIN}"
EOF
else
    echo "Unable to find Open Office. Please set preview.libreOfficeBinary to point to 'soffice' in your installation"
fi


echo "Fetching password for remote neo4j database"

NEO4j_PASSWORD=$(aws ssm get-parameter --name "/pfi/pfi-playground/DEV/neo4j/password" --with-decryption --profile investigations | jq -r '.Parameter.Value')
cat << EOF >> "$SITECONFDIR/site.conf"
neo4j.password = "${NEO4j_PASSWORD}"
EOF

echo "Finished cluster setup"
