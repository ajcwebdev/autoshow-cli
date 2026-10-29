#!/usr/bin/env bash
# Download scanner tarballs against repository-reviewed hashes, never remote trust data.
# The Anchore GitHub Actions installers resolve tags via /releases/<tag>, which 504s on GitHub.
set -euo pipefail

bin_dir="${RUNNER_TEMP:?}/scan-image-bin"
: "${GITHUB_PATH:?}"
grype_version="${GRYPE_VERSION:?}"
install_syft="${INSTALL_SYFT:-true}"
case "${install_syft}" in true|false) ;; *) echo 'INSTALL_SYFT must be true or false' >&2; exit 1 ;; esac
if [ "${install_syft}" = true ]; then syft_version="${SYFT_VERSION:?}"; fi
max_time="${SCAN_DOWNLOAD_MAX_TIME_SECONDS:-60}"
[[ "${max_time}" =~ ^[1-9][0-9]*$ ]] && [ "${max_time}" -le 60 ] || { echo 'SCAN_DOWNLOAD_MAX_TIME_SECONDS must be an integer from 1 to 60' >&2; exit 1; }
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
pins="${script_dir}/scanner-checksums.txt"

case "$(uname -m)" in
  x86_64) arch=amd64 ;;
  aarch64|arm64) arch=arm64 ;;
  *) echo "install-scan-tools: unsupported architecture $(uname -m)" >&2; exit 1 ;;
esac

expected_checksum() {
  local archive="$1" expected
  expected="$(awk -v file="${archive}" '$2 == file { print $1 }' "${pins}")"
  [[ "${expected}" =~ ^[a-f0-9]{64}$ ]] || { echo "install-scan-tools: missing, duplicate, or malformed reviewed checksum for ${archive}" >&2; return 1; }
  printf '%s' "${expected}"
}

# Resolve every requested tuple before network or installation work. A version bump
# must update the reviewed repository pins in the same change.
if [ "${install_syft}" = true ]; then syft_checksum="$(expected_checksum "syft_${syft_version#v}_linux_${arch}.tar.gz")"; fi
grype_checksum="$(expected_checksum "grype_${grype_version#v}_linux_${arch}.tar.gz")"
mkdir -p "${bin_dir}"
work_root="$(mktemp -d "${RUNNER_TEMP}/scan-image-downloads-XXXXXX")"
download_pid=''
cleanup() {
  if [ -n "${download_pid}" ]; then kill -TERM "${download_pid}" 2>/dev/null || true; wait "${download_pid}" 2>/dev/null || true; fi
  rm -rf "${work_root}"
}
trap cleanup EXIT
trap 'echo "install-scan-tools: interrupted" >&2; exit 130' INT
trap 'echo "install-scan-tools: terminated" >&2; exit 143' TERM

download_release() {
  local name="$1"
  local version="$2"
  local expected="$3"
  local numeric
  numeric="${version#v}"
  local archive="${name}_${numeric}_linux_${arch}.tar.gz"
  local base="https://github.com/anchore/${name}/releases/download/${version}"
  local work="${work_root}/${name}"
  mkdir -p "${work}"
  # curl retries transient HTTP/transport failures only: at most four attempts, with
  # a 120-second retry window and a 60-second transfer deadline (180 seconds total).
  # The optional lower transfer deadline cannot enlarge the production bound.
  local -a download=(curl -fL --retry 3 --retry-connrefused --retry-delay 2 --retry-max-time 120 --connect-timeout 20 --max-time "${max_time}")
  "${download[@]}" -o "${work}/${archive}" "${base}/${archive}" &
  download_pid=$!
  wait "${download_pid}"
  download_pid=''
  printf '%s  %s\n' "${expected}" "${work}/${archive}" | sha256sum -c - || { echo "install-scan-tools: checksum mismatch for ${archive}" >&2; exit 1; }
  tar -xzf "${work}/${archive}" -C "${work}" "${name}"
  # A checksum-verified archive must still contain the expected regular executable.
  test -f "${work}/${name}" && test -s "${work}/${name}" && ! test -L "${work}/${name}" || { echo "install-scan-tools: invalid executable in ${archive}" >&2; exit 1; }
  chmod 0755 "${work}/${name}"
  mv "${work}/${name}" "${bin_dir}/${name}"
  "${bin_dir}/${name}" version
}

if [ "${install_syft}" = true ]; then download_release syft "${syft_version}" "${syft_checksum}"; fi
download_release grype "${grype_version}" "${grype_checksum}"
printf '%s\n' "${bin_dir}" >> "${GITHUB_PATH}"
