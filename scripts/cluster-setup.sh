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
        CHROMIUM_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
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

if [ -f "$CHROMIUM_BIN" ]
then
    cat << EOF >> "$SITECONFDIR/site.conf"
preview.chromiumBinary = "${CHROMIUM_BIN}"
EOF
else
    echo "Unable to find Chromium/Google Chrome. Please set preview.chromiumBinary in site.conf"
fi

echo "Finished cluster setup"
