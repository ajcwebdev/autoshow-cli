# Testing

Shared `bun t` runner behavior and the local and service test coverage map for the AutoShow CLI. Per-command coverage, price examples, and live selections live on the [command test pages](#command-test-pages).

`bun t` runs in live credential mode. It loads `.env`, forwards every configured hosted credential to the workers, and executes the service tests, so a full default run bills real providers. Use `bun t --price` for a no-cost estimate of the same selection, or `bun t:local` for the fixture-mode run that forwards no credentials and skips every live test. A default run has no budget ceiling: every selected test runs and no price preflight filters it. Pass `--budget` to set a per-command ceiling in hundredths of a cent; any command whose estimate exceeds it is skipped. Apply the repository spending policy when choosing a selection.

`bun run check` runs structure, name, and type checks without loading `.env`. `check:types` runs the pinned native TypeScript preview compiler (`@typescript/native-preview`, `tsgo`) against the same `tsconfig.json`; `bun run check:types:tsc` runs the reference `typescript` compiler, which reports identical diagnostics with a slower wall time, and CI cross-checks it in the package-hygiene job. Normal `bun autoshow` commands still load `.env` because provider commands need credentials.

## Local Quick Start

For a targeted CLI smoke pass without provider calls:

```bash
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
```
For local extraction and rendering coverage:

```bash
bun t \
  test/test-cases/e2e/local/sources/download/download-input-types-local-file.test.ts \
  test/test-cases/e2e/local/text/ocr/ \
  test/test-cases/e2e/local/stt/ \
  test/test-cases/e2e/local/audio/music/music-lyrics-video.test.ts
```
## Service Quick Start

```bash
bun t test/test-cases/e2e/local/sources/download/download-input-types-direct-url.test.ts
bun t test/test-cases/e2e/local/sources/download/download-input-types-streaming.test.ts
bun t test/test-cases/e2e/local/sources/download/download-input-types-feed-or-channel.test.ts

AUTOSHOW_TEST_CREDENTIAL_KEYS='["OPENAI_API_KEY"]' \
  bun --no-env-file run t:provider --budget 50 test/test-cases/e2e/service/audio/tts/
```
`bun t` already selects live mode and derives the credential list from every registered hosted credential that is actually configured, so a normal run needs no credential allowlist. `t:provider` is the stricter entry point: it selects live mode, disables automatic `.env` loading, and requires `AUTOSHOW_TEST_CREDENTIAL_KEYS` as a JSON array of the registered credential names required by the selected files, with those values exported. Tests needing unlisted or missing credentials are skipped. Without `--budget` the runner admits every selected live test. With `--budget` it produces evaluated and skip evidence, and missing or corrupt evidence blocks hosted runs. A direct `bun test` outside the runner still fails closed. A budget may skip every selected test when no estimate fits. Choose the selection and budget according to the repository spending policy. Helpers never fall back to `.env`.

## Command Test Pages

Per-command coverage, price examples, and live selections live on these pages:

- [Setup Tests](00-setup-and-utilities/setup.md#testing)
- [Download Tests](01-sources/download/tests.md)
- [STT Tests](02-extract/stt/tests.md)
- [OCR Tests](02-extract/ocr/tests.md)
- [URL Tests](02-extract/url/tests.md)
- [Write Service Tests](03-write/tests.md)
- [TTS Service Tests](04-audio/tts/tests.md)
- [Image Service Tests](05-visuals/image/tests.md)
- [Video Service Tests](05-visuals/video/tests.md)
- [Music Tests](04-audio/music/tests.md)

## Shared Runner Behavior

- Pass file or directory paths under `test/test-cases/` to select tests.
- Passing tests print only the result line (`✓`, name, duration). Failing tests keep that `✗` line and the captured console output from that test.
- `--max-concurrency` and `--parallel` default to the machine's available parallelism. E2E-only selections default `--parallel` to 32; automatic test retries are disabled. Pass `--max-concurrency=<n>` or `--parallel=<n>` to override; `--concurrency` is not a Bun test flag and is rejected.
- `--parallel` isolates test files. Use `--no-isolate` only as a temporary diagnostic escape hatch for a confirmed isolation or preload regression; it is not a supported default because it weakens file-level state separation.
- Interrupting a run terminates local test descendants.
- Each run writes artifacts under `./output/test-output/YYYY-MM-DD_HH-MM-SS_test-run/`. By default, `bun t` cleans that directory after every run and leaves `./output/test-output/latest.log` with the run summary, failures, runner log, and command log. Use `--no-cleanup` to keep the full run directory, per-test CLI outputs, and test cache.
- Use `--no-adaptive-concurrency` to disable adaptive per-provider lane limits.

```bash
bun t --no-cleanup

cat output/test-output/latest.log
```
Common selection and diagnostic flags are forwarded unchanged after AutoShow resolves path filters:

```bash
bun t --changed=main

bun t test/test-cases/validation/ --only-failures

bun t test/test-cases/validation/runtime-contracts/ --grep='tokenizer'

bun t test/test-cases/validation/ '--path-ignore-patterns=*provider*'
```
Use `--shard=<index>/<count>` only with a curated set already proven local and no-cost. Timing balance does not classify provider cost or make an unreviewed selection safe.

Interrupted TTS tests must not delete completed segment audio. Resume ambiguous real TTS work with `--allow-ambiguous-redispatch` so completed slots can be reused.


`--price` uses the same path filters as a normal `bun t` run: append it to price-check mapped commands without running the live tests. `--budget <whole-number-hundredths-of-a-cent>` skips live tests whose estimates exceed that threshold; for example, `--budget 100` allows tests estimated at up to 1 cent. Command-specific examples live on the command test pages.

```bash
bun t --price
bun t test/test-cases/e2e/service/text/write/ --budget 2500
```
- `--price` with no path filters resolves all mapped test price commands.
- `--budget` applies independently to each matching test; estimates are not combined into an aggregate cap. An unmapped or unevaluated test fails locally instead of calling a provider.
- Most validation paths have no mapped price commands, so `--price` on them reports a zero-cost pass.

## No-Cost CI Gate

Pull requests and pushes to `main` run the same work as `bun run check` and `bun t --price`, plus approved local CLI smoke and contract tests. CI supplies no provider credentials and does not run the full suite or provider-backed commands. The verify job installs ImageMagick, FFmpeg, MuPDF tools, and qpdf through apt in the background while `bun run check` runs, waits for that install so price-mode commands resolve the tools from `PATH` instead of starting their own installs, runs `bun t --price --no-cleanup`, prints per-command timings from the retained `metrics.ndjson` with `bun src/tools/ci-run-timings.ts price <metrics.ndjson>`, and then runs the CLI smoke, Docker and DOCX, and Bun migration contract groups concurrently in one step. `bun src/tools/ci-run-timings.ts run <run-id>` summarizes a finished run through `gh run view` (or `--json-file`) with per-job and per-step tables and the critical path.

## Package Review

Package hygiene runs separately in clean CI with an empty inherited environment except for `PATH`, an isolated `HOME`, and `CI=true`. It runs `bun audit`, `bun dedupe --check`, and a production JSON license report. This clean environment is the secret boundary because Bun package-manager commands may load `.env` even when `--no-env-file` is supplied.

`repomix` and `tiktoken` are intentionally not dependencies.

Use this review sequence for every declared dependency or lockfile refresh:

1. Work in clean CI or a clean checkout with no project `.env`; do not treat `--no-env-file` as the package-manager secret boundary.
2. Run `bun pm diff <package>` for each changed direct package and save the output with the review evidence.
3. Inspect the complete `bun.lock` diff for unrelated direct or transitive movement, source changes, scripts, native addons, patches, overrides, catalogs, workspaces, or non-registry resolutions.
4. Run `bun install --frozen-lockfile`, `bun audit`, `bun dedupe --check`, and `bun pm licenses --prod --json` before the default verification pass.
5. Run `bun audit fix --dry-run` only to create a review artifact. Never auto-apply audit fixes; review and implement each accepted dependency change explicitly.
6. Use `bun prune --dry-run` to identify installed state outside the lockfile, review every proposed removal, then run `bun prune` only when the install residue is confirmed unreachable.

Docker therefore keeps the frozen production install without an additional prune layer; remeasure before revisiting that choice.

## Profiling

No-cost profiling recipes write CPU profiles, heap profiles, bundle metafiles, logs, and metadata under the ignored `runtime/profiling/bun-runtime/` directory. They inherit only `HOME` and `PATH`, do not receive provider credentials, and do not execute provider calls.

### CPU profiles

Run `bun profile:cpu` to generate Markdown CPU profiles for `autoshow --help` startup and the no-cost `bun t --price` path. The command writes `cli-help.cpu.md`, `test-price.cpu.md`, child logs, and `metadata.json` into one timestamped run directory.

Use the same recipe before and after a startup or price-planning optimization, then compare the profile summaries and the command durations in the two metadata files. This recipe does not run test cases or provider commands.

### Heap profile

Run `bun profile:heap` to exercise a deterministic synthetic RSS/XML workload and a large synthetic OCR-style page-normalization workload under `--heap-prof-md`. The fixture contains no user or source-book content. The run writes `local-parsing-normalization.heap.md`, a checksum-bearing workload observation, child logs, and metadata.

### Reference-tokenizer cache profile

Run `bun profile:tokenizer` to record four separate Markdown heap profiles: before the rank map is loaded, after it is loaded, after explicit eviction and forced garbage collection, and after deterministic reconstruction. `reference-tokenizer-memory-summary.json` records heap totals, cache entry counts, memory-usage counters, and token-ID hashes. The after-load and after-reconstruction hashes must match.

### Bundle analysis

Run `bun profile:bundle` to build the same `src/cli/create-cli.ts` entrypoint used by the test prebuild and generate both JSON and Markdown metafiles. Review `bundle-inventory.json` before moving assets, changing dynamic imports, or experimenting with a standalone executable.

### Complete capture

Run `bun profile:all` to execute all four no-cost recipes into one timestamped directory. Any recipe accepts `--output-dir <path>` after the script selector when invoked directly, for example `env -i PATH="$PATH" HOME="$HOME" bun --no-env-file src/tools/bun-profile.ts bundle --output-dir runtime/profiling/bun-runtime/before-bundle-change`.

Generated artifacts are diagnostic evidence and are not committed.

## Cross-Cutting Coverage

No-cost suites that are shared across commands:

- `test/test-cases/validation/cli/option-resolution-contracts/` covers model-option resolution.
- `test/test-cases/validation/providers/provider-selection-contracts/` covers provider-flag acceptance, rejection, and shared flags.
- `test/test-cases/validation/reports-pricing/price-mode-contracts/` covers price-mode behavior.
- `test/test-cases/validation/text/url/html-url-backends-contracts/` covers URL article contracts.
- `test/test-cases/validation/providers/` and `test/test-cases/validation/resume-manifests/` cover provider contracts and resume manifests.
- `test/test-cases/price-flag/` covers `--price` for STT, OCR, write, TTS, image, video, and music.
