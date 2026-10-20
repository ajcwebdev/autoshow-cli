#!/usr/bin/env bash
# Download pinned scanner tarballs with one bounded transient-retry policy.
# The Anchore GitHub Actions installers resolve tags via /releases/<tag>, which 504s on GitHub.
set -euo pipefail

bin_dir="${RUNNER_TEMP:?}/scan-image-bin"
grype_version="${GRYPE_VERSION:?}"
install_syft="${INSTALL_SYFT:-true}"
case "${install_syft}" in true|false) ;; *) echo 'INSTALL_SYFT must be true or false' >&2; exit 1 ;; esac
if [ "${install_syft}" = true ]; then syft_version="${SYFT_VERSION:?}"; fi
mkdir -p "${bin_dir}"
work_root="$(mktemp -d "${RUNNER_TEMP}/scan-image-downloads-XXXXXX")"
trap 'rm -rf "${work_root}"' EXIT

case "$(uname -m)" in
  x86_64) arch=amd64 ;;
  aarch64|arm64) arch=arm64 ;;
  *) echo "install-scan-tools: unsupported architecture $(uname -m)" >&2; exit 1 ;;
esac

download_release() {
  local name="$1"
  local version="$2"
  local numeric
  numeric="${version#v}"
  local archive="${name}_${numeric}_linux_${arch}.tar.gz"
  local base="https://github.com/anchore/${name}/releases/download/${version}"
  local work="${work_root}/${name}"
  mkdir -p "${work}"
  # curl retries transient HTTP/transport failures only: at most four attempts, with
  # a 120-second retry window and a 60-second transfer deadline (180 seconds total).
  local -a download=(curl -fL --retry 3 --retry-connrefused --retry-delay 2 --retry-max-time 120 --connect-timeout 20 --max-time 60)
  "${download[@]}" -o "${work}/checksums.txt" "${base}/${name}_${numeric}_checksums.txt"
  local expected
  expected="$(awk -v file="${archive}" '$2 == file { print $1 }' "${work}/checksums.txt")"
  [[ "${expected}" =~ ^[a-fA-F0-9]{64}$ ]] || { echo "install-scan-tools: missing, duplicate, or malformed checksum for ${archive}" >&2; exit 1; }
  "${download[@]}" -o "${work}/${archive}" "${base}/${archive}"
  printf '%s  %s\n' "${expected}" "${work}/${archive}" | sha256sum -c - || { echo "install-scan-tools: checksum mismatch for ${archive}" >&2; exit 1; }
  tar -xzf "${work}/${archive}" -C "${work}" "${name}"
  # A checksum-verified archive must still contain the expected regular executable.
  test -f "${work}/${name}" && test -s "${work}/${name}" && ! test -L "${work}/${name}" || { echo "install-scan-tools: invalid executable in ${archive}" >&2; exit 1; }
  chmod 0755 "${work}/${name}"
  mv "${work}/${name}" "${bin_dir}/${name}"
  "${bin_dir}/${name}" version
}

if [ "${install_syft}" = true ]; then download_release syft "${syft_version}"; fi
download_release grype "${grype_version}"
printf '%s\n' "${bin_dir}" >> "${GITHUB_PATH}"
