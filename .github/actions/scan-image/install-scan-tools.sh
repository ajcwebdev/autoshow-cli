#!/usr/bin/env bash
# Download pinned Syft and Grype release tarballs with retries.
# The Anchore GitHub Actions installers resolve tags via /releases/<tag>, which 504s on GitHub.
set -euo pipefail

bin_dir="${RUNNER_TEMP:?}/scan-image-bin"
syft_version="${SYFT_VERSION:?}"
grype_version="${GRYPE_VERSION:?}"
mkdir -p "${bin_dir}"

case "$(uname -m)" in
  x86_64) arch=amd64 ;;
  aarch64|arm64) arch=arm64 ;;
  *) echo "install-scan-tools: unsupported architecture $(uname -m)" >&2; exit 1 ;;
esac

strip_v() {
  local value="$1"
  printf '%s' "${value#v}"
}

download_release() {
  local name="$1"
  local version="$2"
  local numeric
  numeric="$(strip_v "${version}")"
  local archive="${name}_${numeric}_linux_${arch}.tar.gz"
  local base="https://github.com/anchore/${name}/releases/download/${version}"
  local work
  work="$(mktemp -d)"
  local attempt
  for attempt in 1 2 3 4 5 6 7 8; do
    if curl -fL --retry 8 --retry-all-errors --retry-delay 3 --connect-timeout 20 --max-time 180 \
      -o "${work}/checksums.txt" "${base}/${name}_${numeric}_checksums.txt" \
      && curl -fL --retry 8 --retry-all-errors --retry-delay 3 --connect-timeout 20 --max-time 180 \
      -o "${work}/${archive}" "${base}/${archive}"; then
      local expected
      expected="$(awk -v file="${archive}" '$2 == file { print $1; exit }' "${work}/checksums.txt")"
      if [ -n "${expected}" ] && printf '%s  %s\n' "${expected}" "${work}/${archive}" | sha256sum -c -; then
        tar -xzf "${work}/${archive}" -C "${bin_dir}" "${name}"
        rm -rf "${work}"
        return 0
      fi
      echo "install-scan-tools: checksum mismatch for ${archive} (attempt ${attempt})" >&2
    else
      echo "install-scan-tools: download failed for ${name} ${version} (attempt ${attempt})" >&2
    fi
    sleep $((attempt * 2))
  done
  rm -rf "${work}"
  echo "install-scan-tools: exhausted retries installing ${name} ${version}" >&2
  exit 1
}

download_release syft "${syft_version}"
download_release grype "${grype_version}"
chmod 0755 "${bin_dir}/syft" "${bin_dir}/grype"
printf '%s\n' "${bin_dir}" >> "${GITHUB_PATH}"
"${bin_dir}/syft" version
"${bin_dir}/grype" version
