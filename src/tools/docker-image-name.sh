#!/usr/bin/env bash
# GitHub's owner/repository identity becomes one validated, lowercase GHCR name.
set -euo pipefail
export LC_ALL=C

if [ "$#" -gt 1 ]; then
  echo 'Usage: docker-image-name.sh [owner/repository]' >&2
  exit 2
fi
repository="${1-${GITHUB_REPOSITORY:-}}"
case "${repository}" in
  ''|*[!A-Za-z0-9_./-]*)
    echo 'Expected a valid owner/repository identity for the GHCR image name' >&2
    exit 2
    ;;
esac
repository="$(printf '%s' "${repository}" | tr '[:upper:]' '[:lower:]')"
# Docker Distribution path component grammar: https://github.com/distribution/reference/blob/main/regexp.go
component='[a-z0-9]+(([._]|__|-+)[a-z0-9]+)*'
if ! [[ "${repository}" =~ ^${component}/${component}$ ]]; then
  echo 'Expected a valid owner/repository identity for the GHCR image name' >&2
  exit 2
fi
printf 'ghcr.io/%s\n' "${repository}"
