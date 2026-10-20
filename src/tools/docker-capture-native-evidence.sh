#!/usr/bin/env bash
# Capture the same native package/tool evidence for release digests and local audit images.
set -euo pipefail

arch="${ARCH:?}"
image="${IMAGE_REFERENCE:?}"
evidence_dir="${EVIDENCE_DIR:?}"
revision="${GITHUB_SHA:?}"
case "${arch}" in amd64|arm64) ;; *) echo 'Expected ARCH=amd64|arm64' >&2; exit 1 ;; esac
[[ "${image}" =~ ^[a-zA-Z0-9][a-zA-Z0-9./:@_-]*$ ]] || { echo 'Invalid image reference' >&2; exit 1; }
[[ "${revision}" =~ ^[a-f0-9]{40}$ ]] || { echo 'Expected full source revision' >&2; exit 1; }
case "$(docker info --format '{{.Architecture}}')" in
  amd64|x86_64) daemon_arch=amd64 ;;
  arm64|aarch64) daemon_arch=arm64 ;;
  *) echo 'Unsupported Docker daemon architecture' >&2; exit 1 ;;
esac
test "${daemon_arch}" = "${arch}" || { echo 'Evidence requires the native Docker daemon' >&2; exit 1; }
mkdir -p "${evidence_dir}"
docker image inspect "${image}" > "${evidence_dir}/image-identity.json"
jq -e --arg arch "${arch}" --arg revision "${revision}" '
  length == 1 and (.[0] | .Os == "linux" and .Architecture == $arch
    and (.Id | test("^sha256:[a-f0-9]{64}$"))
    and .Config.Labels["org.opencontainers.image.revision"] == $revision)
' "${evidence_dir}/image-identity.json" >/dev/null
# Resolve local audit tags once; every capture command reads this immutable image ID.
image_id="$(jq -er '.[0].Id' "${evidence_dir}/image-identity.json")"
run=(docker run --rm --platform "linux/${arch}" --network none)
"${run[@]}" --entrypoint dpkg-query "${image_id}" -W '-f=${Package}\t${Version}\t${Architecture}\n' > "${evidence_dir}/debian-packages.tsv"
"${run[@]}" --entrypoint tar "${image_id}" -czf - /usr/share/doc > "${evidence_dir}/native-notices.tar.gz"
"${run[@]}" --entrypoint sh "${image_id}" -ec 'ffmpeg -hide_banner -filters; convert -list format; fc-match "DejaVu Sans"' > "${evidence_dir}/rendering-capabilities.txt"
"${run[@]}" --entrypoint bun "${image_id}" --no-env-file -e 'import {readDependencyMetadata} from "./src/cli/commands/setup-and-utilities/setup/dependency-metadata.ts"; console.log(JSON.stringify(await readDependencyMetadata(), null, 2))' > "${evidence_dir}/native-source-pins.json"
# Read policy bytes from the captured image, rather than assuming the checkout matches it.
"${run[@]}" --entrypoint cat "${image_id}" /app/src/cli/commands/setup-and-utilities/setup/setup-download/managed-toolchain-distribution-policy.ts > "${evidence_dir}/native-distribution-policy.ts"
"${run[@]}" --entrypoint cat "${image_id}" /app/src/cli/commands/stt/local/whisperfile/whisperfile-artifacts.ts > "${evidence_dir}/model-artifact-pins.ts"
awk -F '\t' 'NF != 3 || $1 == "" || $2 == "" || $3 == "" { invalid = 1 } END { exit invalid || NR == 0 }' "${evidence_dir}/debian-packages.tsv"
tar -tzf "${evidence_dir}/native-notices.tar.gz" >/dev/null
jq -e 'type == "object" and length > 0' "${evidence_dir}/native-source-pins.json" >/dev/null
for file in rendering-capabilities.txt native-distribution-policy.ts model-artifact-pins.ts; do test -s "${evidence_dir}/${file}"; done
jq --arg image "${image}" '.[0] | {schemaVersion:1, image:{requestedReference:$image,id:.Id,platform:(.Os+"/"+.Architecture),revision:.Config.Labels["org.opencontainers.image.revision"]},network:"none"}' "${evidence_dir}/image-identity.json" > "${evidence_dir}/native-evidence.json"
(cd "${evidence_dir}" && sha256sum image-identity.json debian-packages.tsv native-notices.tar.gz rendering-capabilities.txt native-source-pins.json native-distribution-policy.ts model-artifact-pins.ts native-evidence.json > SHA256SUMS)
