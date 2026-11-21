#!/usr/bin/env bash
set -euo pipefail
: "${EVIDENCE_DIR:?}"

# Earlier failed steps may never have created runtime state.
if [ ! -e "${EVIDENCE_DIR}/runtime-state/authored-cache" ] && [ ! -L "${EVIDENCE_DIR}/runtime-state/authored-cache" ]; then exit 0; fi

project_root="$(realpath -e -- "${GITHUB_WORKSPACE:-.}")"
evidence_root="$(realpath -e -- "${EVIDENCE_DIR}")"
case "${evidence_root}/" in "${project_root}/runtime/"*) ;; *) echo 'archive-authored-cache: evidence must remain under project runtime' >&2; exit 1 ;; esac
authored_cache_root="${evidence_root}/runtime-state/authored-cache"
test -d "${authored_cache_root}" && ! test -L "${authored_cache_root}" || { echo 'archive-authored-cache: authored cache must be a directory' >&2; exit 1; }
test "$(realpath -e -- "${authored_cache_root}")" = "${authored_cache_root}" || { echo 'archive-authored-cache: authored cache cannot traverse symlinks' >&2; exit 1; }

: "${IMAGE_REFERENCE:?}"
verified_image="$(docker image inspect --format '{{.Id}}' "${IMAGE_REFERENCE}")"
[[ "${verified_image}" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo 'archive-authored-cache: missing immutable image identity' >&2; exit 1; }

archive_path="${evidence_root}/runtime-state/authored-cache.evidence.tar.gz"
! test -L "${archive_path}" && { ! test -e "${archive_path}" || test -f "${archive_path}"; } || { echo 'archive-authored-cache: archive destination must be a regular file' >&2; exit 1; }
archive_candidate="$(mktemp "${archive_path}.candidate.XXXXXXXX")"
archive_diagnostics="${archive_candidate}.log"

# Only this authored payload is visible. Numeric owners, nanosecond PAX times,
# private modes and link relationships survive without rewriting source state.
if ! docker run --rm --read-only --network none --user 0:0 \
  --cap-drop ALL --cap-add DAC_READ_SEARCH --security-opt no-new-privileges \
  --mount "type=bind,src=${authored_cache_root},dst=/source/authored-cache,readonly" \
  --entrypoint /bin/tar "${verified_image}" \
  --format=pax --numeric-owner --acls --xattrs --exclude=.DS_Store --exclude='*/.DS_Store' \
  --directory=/source --gzip --create --file=- authored-cache \
  > "${archive_candidate}" 2> "${archive_diagnostics}"; then
  tail -n 40 "${archive_diagnostics}" >&2
  exit 1
fi
# Warnings such as an unarchivable socket must not silently discard evidence.
if test -s "${archive_diagnostics}"; then tail -n 40 "${archive_diagnostics}" >&2; exit 1; fi
tar -tzf "${archive_candidate}" > /dev/null
mv -f -- "${archive_candidate}" "${archive_path}"
rm -f -- "${archive_diagnostics}"
(
  cd "${evidence_root}/runtime-state"
  sha256sum authored-cache.evidence.tar.gz > authored-cache.evidence.tar.gz.sha256
)
