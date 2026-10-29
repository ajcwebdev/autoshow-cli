#!/usr/bin/env bash
# Grype v0.121.0 db status validates schema, stored checksum and its five-day age limit.
# https://github.com/anchore/grype/blob/v0.121.0/grype/db/v6/installation/curator.go
set -euo pipefail
: "${GRYPE_DB_CACHE_DIR:?}" "${EVIDENCE_DIR:?}" "${GITHUB_OUTPUT:?}"
case "${DB_UPDATE_REQUIRED:?}" in true|false) ;; *) echo 'DB_UPDATE_REQUIRED must be true or false' >&2; exit 1 ;; esac
export GRYPE_DB_VALIDATE_AGE=true
export GRYPE_DB_MAX_ALLOWED_BUILT_AGE=120h
export GRYPE_DB_VALIDATE_BY_HASH_ON_START=true
# Keep scanner-only traffic on HTTP/1 while the reviewed vendor compiler is unpatched.
# This mitigates HTTP/2 paths; it does not remove linked stdlib/module findings.
export GODEBUG=http2client=0,http2server=0

mkdir -p "${EVIDENCE_DIR}"
status_file="$(mktemp "${EVIDENCE_DIR}/.grype-db-status-XXXXXX")"
trap 'rm -f "${status_file}"' EXIT
if [ "${DB_UPDATE_REQUIRED}" = true ]; then grype db update; fi
# Exact daily cache hits must be checked too, without silently fetching a replacement.
GRYPE_DB_AUTO_UPDATE=false grype db status -o json > "${status_file}"
jq -e '.valid == true and (.error == null or .error == "") and (.schemaVersion | type == "string" and test("^v?6([.]|$)")) and (.built | type == "string" and length > 0)' "${status_file}" >/dev/null
find "${GRYPE_DB_CACHE_DIR}" -name 'vulnerability.db' -size +1M | grep -q . || { echo "prepare-grype-db: no hydrated Grype database under ${GRYPE_DB_CACHE_DIR}" >&2; exit 1; }
mv "${status_file}" "${EVIDENCE_DIR}/grype-db-status.json"
printf 'db-built=%s\n' "$(jq -r '.built' "${EVIDENCE_DIR}/grype-db-status.json")" >> "${GITHUB_OUTPUT}"
