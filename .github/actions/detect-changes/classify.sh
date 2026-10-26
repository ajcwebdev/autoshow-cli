#!/usr/bin/env bash
# Reads changed repository paths, one per line on stdin, and prints which CI areas they can affect as
# GITHUB_OUTPUT-style key=value lines: image, alignment, javascript_graph, code (each true or false).
# Patterns are bash case globs, where * also matches / so a directory pattern covers its whole subtree.
set -euo pipefail

image=false
alignment=false
javascript_graph=false
code=false

while IFS= read -r path; do
  [ -n "${path}" ] || continue
  case "${path}" in
    # Report-style documentation that no job reads or tests.
    docs/benchmarks/*|docs/reports/*|docs/todo/*|docs/diagrams/*|docs/diagrams.md) continue ;;
    # Nested paths, including docs/docker.md, docs/adr, docs/commands, and Markdown under src, are observable by contract tests.
    */*) ;;
    # README.md is read by contract tests; other root-level Markdown is agent guidance.
    README.md) ;;
    *.md) continue ;;
  esac
  code=true
  case "${path}" in
    # These files orchestrate all three independent graph jobs or the classifier itself.
    .github/workflows/dependency-graphs.yml|.github/actions/detect-changes/*)
      image=true; alignment=true; javascript_graph=true ;;
    # Native image build/release/scan policy does not change either JavaScript dependency graph.
    .github/workflows/docker-publish.yml|.github/workflows/warm-grype-db.yml|.github/actions/build-native-image/*|.github/actions/smoke-native-image/*|.github/actions/audit-native-image/*|.github/actions/scan-image/*|.github/actions/prepare-grype-db/*|.github/actions/ghcr-login/*)
      image=true ;;
    # New CI inputs and Git-quoted filenames need review before they can safely skip a graph.
    .github/*|\"*|*\\*)
      image=true; alignment=true; javascript_graph=true ;;
  esac
  case "${path}" in
    Dockerfile|.dockerignore|package.json|bun.lock|bunfig.toml|tsconfig.json|config/*|src/*|test/docker-acceptance/*|test/fixtures/setup/*|test/test-cases/validation/stt/workflows/timing/*|test/test-utils/onnx-alignment-fixture.ts)
      image=true ;;
  esac
  case "${path}" in
    config/stt-alignment/*|src/cli/commands/stt/workflows/timing/*|test/test-cases/validation/stt/workflows/timing/*|test/test-utils/onnx-alignment-fixture.ts|bun.lock|package.json)
      alignment=true ;;
  esac
  case "${path}" in
    package.json|bun.lock|bunfig.toml|config/defuddle/*|test/test-cases/validation/runtime-contracts/dependency-priority-contracts.test.ts|test/test-cases/validation/setup/rendering-prerequisites-contracts.test.ts|src/cli/commands/text/url/url-local/*|src/cli/commands/stt/local/whisperfile/*|src/cli/commands/setup-and-utilities/models/stt-config/stt-whisperfile.json|src/cli/commands/audio/music/lyrics-video/*|src/cli/commands/visuals/comic/comic-commands/character-sketch/*)
      javascript_graph=true ;;
  esac
done

printf 'image=%s\nalignment=%s\njavascript_graph=%s\ncode=%s\n' "${image}" "${alignment}" "${javascript_graph}" "${code}"
