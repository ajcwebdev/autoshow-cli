#!/usr/bin/env bash
set -euo pipefail

case "${ARCH}" in amd64|arm64) ;; *) echo 'Expected ARCH=amd64|arm64' >&2; exit 1 ;; esac
started_ns="$(date +%s%N)"
image="$(bash "$(dirname "${BASH_SOURCE[0]}")/docker-image-name.sh")"
created="$(git show -s --format=%cI "${GITHUB_SHA}")"
version="$(jq -er '.version' package.json)"
metadata_file="$(mktemp)"
trap 'rm -f "${metadata_file}"' EXIT
docker buildx build \
  --platform "linux/${ARCH}" --target production --file Dockerfile \
  --build-arg "AUTOSHOW_VERSION=${version}" \
  --build-arg "BUILD_DATE=${created}" \
  --build-arg "VCS_REF=${GITHUB_SHA}" \
  --provenance=mode=max --sbom=true \
  --cache-from "type=registry,ref=${image}:buildcache-${ARCH}" \
  --cache-to "type=registry,ref=${image}:buildcache-${ARCH},mode=max" \
  --output "type=image,name=${image},push-by-digest=true,name-canonical=true,push=true" \
  --metadata-file "${metadata_file}" .
digest="$(jq -er '."containerimage.digest" | select(type == "string" and length == 71) | select(test("^sha256:[a-f0-9]{64}$"))' "${metadata_file}")"
[[ "${digest}" =~ ^sha256:[a-f0-9]{64}$ ]] || { printf 'Invalid %s image digest: %s\n' "${ARCH}" "${digest}" >&2; exit 1; }
printf 'digest=%s\n' "${digest}" >> "${GITHUB_OUTPUT}"
printf 'build_duration_ms=%s\n' "$(( ($(date +%s%N) - started_ns) / 1000000 ))" >> "${GITHUB_OUTPUT}"
