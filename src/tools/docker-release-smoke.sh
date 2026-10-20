#!/usr/bin/env bash
set -euo pipefail

case "${ARCH}" in
  amd64) native_arch=x86_64; bun_arch=x64 ;;
  arm64) native_arch=aarch64; bun_arch=arm64 ;;
  *) echo 'Expected ARCH=amd64|arm64' >&2; exit 1 ;;
esac
[[ "${IMAGE_DIGEST}" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo 'Missing native image digest' >&2; exit 1; }
test "$(uname -m)" = "${native_arch}"
case "$(docker info --format '{{.Architecture}}')" in
  "${ARCH}"|"${native_arch}") ;;
  *) echo 'Docker daemon is not native to this runner' >&2; exit 1 ;;
esac
image="ghcr.io/$(printf '%s' "${GITHUB_REPOSITORY}" | tr '[:upper:]' '[:lower:]')"
image_ref="${image}@${IMAGE_DIGEST}"
report_dir="runtime/ci/docker-${ARCH}"
release_dir="docs/reports/release-evidence/${ARCH}"
mkdir -p "${report_dir}" "${release_dir}"
docker pull --platform "linux/${ARCH}" "${image_ref}" >/dev/null
test "$(docker run --rm --platform "linux/${ARCH}" --network none --entrypoint bun "${image_ref}" --version)" = "1.4.2"
# Import the installed production graph offline; never repair/reinstall what the build shipped.
docker run --rm --platform "linux/${ARCH}" --network none --entrypoint bun "${image_ref}" --no-env-file src/tools/docker-installed-dependencies.ts > "${report_dir}/production-dependencies.json"
docker run --rm --platform "linux/${ARCH}" --network none --entrypoint bun --mount "type=bind,src=${GITHUB_WORKSPACE}/test/docker-acceptance/native-image-acceptance.ts,dst=/app/test/docker-acceptance/native-image-acceptance.ts,readonly" "${image_ref}" --no-env-file /app/test/docker-acceptance/native-image-acceptance.ts "${bun_arch}" > "${release_dir}/rendering.log" 2>&1
jq -n --arg digest "${IMAGE_DIGEST}" --arg architecture "${ARCH}" '{digest:$digest,architecture:$architecture,native:true,network:"none",status:"passed"}' > "${release_dir}/native-acceptance.json"
docker history --no-trunc --human=false --format '{{json .}}' "${image_ref}" > "${report_dir}/image-history.jsonl"
docker run --rm --platform "linux/${ARCH}" --network none "${image_ref}" --help > "${report_dir}/help.log" 2>&1
# Exercise the default config path, including a fresh runtime volume and an arbitrary host UID.
for smoke_user in default host; do
  state_dir="$(mktemp -d "${RUNNER_TEMP}/autoshow-state-${ARCH}-XXXXXX")"
  mkdir -p "${state_dir}/runtime" "${state_dir}/home" "${state_dir}/input" "${state_dir}/output"
  if [ "${smoke_user}" = default ]; then
    sudo chown -R 1000:1000 "${state_dir}"
    set --
  else
    set -- --user "$(id -u):$(id -g)"
  fi
  docker run --rm --platform "linux/${ARCH}" --network none "$@" \
    --mount "type=bind,src=${state_dir}/runtime,dst=/app/runtime" \
    --mount "type=bind,src=${state_dir}/home,dst=/home/bun" \
    --mount "type=bind,src=${state_dir}/input,dst=/app/input" \
    --mount "type=bind,src=${state_dir}/output,dst=/app/output" \
    --entrypoint bun "${image_ref}" --no-env-file src/tools/docker-installed-dependencies.ts --state > "${report_dir}/state-${smoke_user}.json"
  # Retain only this job's owned smoke state until the job runner is discarded.
done
docker run --rm --platform "linux/${ARCH}" --network none "${image_ref}" config --show --no-color > "${report_dir}/config.log" 2>&1
docker run --rm --platform "linux/${ARCH}" --network none "${image_ref}" setup --doctor --no-color > "${report_dir}/doctor.log" 2>&1
grep -F 'Setup doctor:' "${report_dir}/doctor.log"
grep -F 'Setup doctor completed' "${report_dir}/doctor.log"
help_samples="$({ for _ in 1 2 3 4 5; do start="$(date +%s%N)"; docker run --rm --platform "linux/${ARCH}" --network none "${image_ref}" --help >/dev/null; printf '%s\n' "$(( ($(date +%s%N) - start) / 1000000 ))"; done; } | jq -s '.')"
fixture="${GITHUB_WORKSPACE}/test/fixtures/setup/managed-toolchain-smoke.pdf"
fixture_sha256="$(sha256sum "${fixture}" | cut -d ' ' -f 1)"
fixture_peak_samples="$({ for index in 1 2 3; do fixture_output="${RUNNER_TEMP}/autoshow-rss-${ARCH}-${index}"; mkdir -p "${fixture_output}"; sudo chown 1000:1000 "${fixture_output}"; docker run --rm --platform "linux/${ARCH}" --network none --env NO_COLOR=1 --entrypoint /bin/sh --mount "type=bind,src=${fixture},dst=/benchmark/fixture.pdf,readonly" --mount "type=bind,src=${fixture_output},dst=/benchmark/output" "${image_ref}" -c 'set -eu; bun --no-env-file /app/src/cli/create-cli.ts extract /benchmark/fixture.pdf --provider tesseract --step-concurrency ocr-page=1 --output-root /benchmark/output >/dev/null 2>&1; cat /sys/fs/cgroup/memory.peak'; done; } | jq -s '.')"
jq -n \
  --arg platform "linux/${ARCH}" --arg digest "${IMAGE_DIGEST}" \
  --argjson buildDurationMs "${BUILD_DURATION_MS}" \
  --argjson imageSizeBytes "$(docker image inspect "${image_ref}" --format '{{.Size}}')" \
  --argjson helpSamples "${help_samples}" --arg fixtureSha256 "${fixture_sha256}" \
  --argjson fixturePeakSamples "${fixture_peak_samples}" \
  '{platform:$platform,digest:$digest,execution:"native GitHub runner",fixture:{path:"test/fixtures/setup/managed-toolchain-smoke.pdf",sha256:$fixtureSha256,workload:"local Tesseract OCR"},measurements:{buildDurationMs:$buildDurationMs,imageSizeBytes:$imageSizeBytes,coldHelpWallMs:$helpSamples,fixturePeakRssBytes:$fixturePeakSamples}}' > "${report_dir}/measurements.json"
