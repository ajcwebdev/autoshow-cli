#!/usr/bin/env bash
# Resolves the diff base for the current workflow event and classifies the changed paths into CI areas.
# Prints GITHUB_OUTPUT-style key=value lines on stdout. Whenever the base cannot be determined or read,
# every area is reported as changed so selectivity can only ever skip work, never hide a regression.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

everything() {
  printf 'all=true\nimage=true\nalignment=true\njavascript_graph=true\ncode=true\nreason=%s\n' "$1"
  exit 0
}

base=''
case "${EVENT_NAME:-}" in
  pull_request)
    base="${BASE_SHA:-}"
    ;;
  push)
    if [ "${FORCED:-}" = true ]; then everything 'forced push has no reliable previous commit'; fi
    case "${BEFORE_SHA:-}" in
      ''|0000000000000000000000000000000000000000) everything 'push has no previous commit' ;;
    esac
    base="${BEFORE_SHA}"
    ;;
  *)
    everything "event ${EVENT_NAME:-unknown} has no diff base"
    ;;
esac

if [ -z "${base}" ]; then everything 'diff base is empty'; fi

if ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
  git fetch --quiet --no-tags --depth=1 origin "${base}" 2>/dev/null || everything "base ${base} is not fetchable"
  git cat-file -e "${base}^{commit}" 2>/dev/null || everything "base ${base} is not a commit"
fi

if ! changed="$(git diff --name-only --no-renames "${base}" HEAD)"; then
  everything "diff against ${base} failed"
fi

printf 'Changed paths (%s..HEAD):\n%s\n' "${base}" "${changed:-<none>}" >&2
printf 'all=false\nreason=diff %s..HEAD\n' "${base}"
printf '%s\n' "${changed}" | "${here}/classify.sh"
