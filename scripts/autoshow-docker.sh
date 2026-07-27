#!/usr/bin/env sh
#
# Docker-backed AutoShow CLI — use it exactly like native `bun autoshow`.
#
# The current host directory is mounted at the same absolute path inside the
# container. Relative paths, host-absolute paths beneath the current directory,
# and the default `./output` root therefore behave like native execution.
#
# Usage:
#   ./scripts/autoshow-docker.sh extract content/book/book.epub
#
# Expose it as `autoshow` from any directory (recommended) by adding a function
# to your shell rc; see docs/docker.md. AUTOSHOW_ENV defaults to the
# autoshow-cli checkout's .env.
#
set -eu

IMAGE="${AUTOSHOW_IMAGE:-autoshow-cli:local}"
ENV_FILE="${AUTOSHOW_ENV:-$HOME/c/autoshow-cli/.env}"

set -- "$@"

if [ -f "$ENV_FILE" ]; then
  exec docker run --rm -i \
    --env-file "$ENV_FILE" \
    --mount "type=bind,src=$PWD,dst=$PWD" -w "$PWD" \
    "$IMAGE" "$@"
else
  exec docker run --rm -i \
    --mount "type=bind,src=$PWD,dst=$PWD" -w "$PWD" \
    "$IMAGE" "$@"
fi
