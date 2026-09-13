# Testing

Shared `bun t` runner behavior plus the local and service test coverage map for the AutoShow CLI. Capability test pages live beside their command docs and are indexed in [Command Test Pages](#command-test-pages).

Default local verification is `bun run check` followed by `bun t --price`. Price mode estimates mapped commands without executing provider tests. The default runner uses fixture mode and does not forward provider credentials. Hosted execution requires explicit live mode, a credential allowlist, and valid budget evidence; apply the repository spending policy before running it.

`bun run check` runs structure, name, and type checks without loading `.env`. Normal `bun autoshow` commands still load `.env` because provider commands need credentials.

## Outline

- [Local Quick Start](#local-quick-start)
- [Service Quick Start](#service-quick-start)
- [Command Test Pages](#command-test-pages)
- [Shared Runner Behavior](#shared-runner-behavior)
- [Price Preflight](#price-preflight)
- [No-Cost CI Gate](#no-cost-ci-gate)
- [Package Review](#package-review)
- [Profiling](#profiling)
- [Cross-Cutting Coverage](#cross-cutting-coverage)

## Local Quick Start

For a targeted CLI smoke pass without provider calls:

```bash
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

For local extraction and rendering coverage:

```bash
# local e2e coverage
bun t \
  test/test-cases/e2e/local/sources/download/download-input-types-local-file.test.ts \
  test/test-cases/e2e/local/text/ocr/ \
  test/test-cases/e2e/local/stt/ \
  test/test-cases/e2e/local/text/write/ \
  test/test-cases/e2e/local/audio/music/music-lyrics-video.test.ts
```

## Service Quick Start

```bash
# network-backed download coverage
bun t test/test-cases/e2e/local/sources/download/download-input-types-direct-url.test.ts
bun t test/test-cases/e2e/local/sources/download/download-input-types-streaming.test.ts
bun t test/test-cases/e2e/local/sources/download/download-input-types-feed-or-channel.test.ts

# Example live selection: export OPENAI_API_KEY through your normal secret channel first.
# Only the listed credential reaches workers; this example uses a 0.5-cent budget.
AUTOSHOW_TEST_CREDENTIAL_KEYS='["OPENAI_API_KEY"]' \
  bun --no-env-file run t:provider --budget 50 test/test-cases/e2e/service/audio/tts/
```

`t:provider` selects live mode and disables automatic `.env` loading. Set `AUTOSHOW_TEST_CREDENTIAL_KEYS` to a JSON array of the registered credential names required by the selected files, and export those values. Tests needing unlisted or missing credentials are skipped. `--budget` produces the evaluated and skip evidence live tests require; missing or corrupt evidence blocks hosted runs. A budget may skip every selected test when no estimate fits. Choose the selection and budget according to the repository spending policy.

Direct live `bun --no-env-file test` execution requires `AUTOSHOW_TEST_CREDENTIAL_MODE=live` plus valid `AUTOSHOW_TEST_BUDGET_EVALUATED_KEYS` and `AUTOSHOW_TEST_BUDGET_SKIP_KEYS` JSON arrays from an evaluated plan. Helpers never fall back to `.env`.

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
- On Bun 1.4, `--parallel` implies isolated test files. Use `--no-isolate` only as a temporary diagnostic escape hatch for a confirmed isolation or preload regression; it is not a supported default because it weakens file-level state separation.
- The runner updates file timings so Bun schedules slow files first and balances shards. Per-test estimates in `report.json` come from the runner cache.
- Interrupting a run terminates local test descendants.
- Each run writes artifacts under `./output/test-output/YYYY-MM-DD_HH-MM-SS_test-run/`. By default, `bun t` cleans that directory after every run and leaves `./output/test-output/latest.log` with the run summary, failures, runner log, and command log. Use `--no-cleanup` to keep the full run directory, per-test CLI outputs, and test cache.
- Use `--no-adaptive-concurrency` to disable adaptive per-provider lane limits.

```bash
# keep the full run directory after completion
bun t --no-cleanup

# default cleanup still leaves a failure/debug summary
cat output/test-output/latest.log
```

Common Bun 1.4 selection and diagnostic flags are forwarded unchanged after AutoShow resolves path filters:

```bash
# Test files affected since a commit or branch
bun t --changed=main

# Keep only failure output while preserving JUnit and report.json
bun t test/test-cases/validation/ --only-failures

# Filter test names; --grep is Bun's accepted alias for --test-name-pattern
bun t test/test-cases/validation/runtime-contracts/ --grep='tokenizer'

# Exclude matching test file paths
bun t test/test-cases/validation/ '--path-ignore-patterns=*provider*'
```

Use `--shard=<index>/<count>` only with a curated set already proven local and no-cost. Timing balance does not classify provider cost or make an unreviewed selection safe.

Process termination never authorizes deletion of completed TTS segment audio. Resume ambiguous real TTS work with `--allow-ambiguous-redispatch` so completed slots can be reused.

## Price Preflight

`--price` uses the same path filters as a normal `bun t` run: append it to price-check mapped commands without running the live tests. `--budget <whole-number-hundredths-of-a-cent>` skips live tests whose estimates exceed that threshold; for example, `--budget 100` allows tests estimated at up to 1 cent. Command-specific examples live on the command test pages.

```bash
bun t --price
bun t test/test-cases/e2e/service/text/write/ --budget 2500
```

- `--price` with no path filters resolves all mapped test price commands.
- `--budget` applies independently to each matching test; estimates are not combined into an aggregate cap. An unmapped or unevaluated test fails locally instead of calling a provider.
- Most validation paths have no mapped price commands, so `--price` on them reports a zero-cost pass.

## No-Cost CI Gate

Pull requests and pushes to `main` run the verification job in `.github/workflows/docker-publish.yml`. It runs the same work as `bun run check` and `bun t --price`, plus the approved CLI smoke selections and the local-only contract files listed in that job. The workflow supplies no provider credentials and does not run the full suite, unclassified shards, smoke/e2e selections, or provider-backed commands.

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

AutoShow keeps generated CPU profiles, heap profiles, bundle metafiles, compiled probe bundles, logs, and metadata under the ignored `runtime/profiling/bun-runtime/` directory. Every run records the child commands, Bun version, package-manager pin, platform, architecture, duration, exit status, and that dotenv loading was disabled. The recipes inherit only `HOME` and `PATH`; they do not receive provider credentials and do not execute provider calls.

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

Generated artifacts are diagnostic evidence and are not committed. Checked benchmark summaries should contain only aggregate measurements, fixture identities, commands, and conclusions.

Historical Bun 1.4 measurements are archived with the decisions they support: [XML and normalization in ADR-001](../adr/ADR-001-source-ingestion-and-normalization.md#bun-14-xml-evaluation), [CPU and tokenizer evidence in ADR-002](../adr/ADR-002-pipeline-state-resume-and-dry-run-planning.md#bun-14-journal-and-tokenizer-evidence), and [bundle packaging in ADR-014](../adr/ADR-014-distribute-the-cli-as-a-docker-image.md#bundle-inventory-supporting-the-packaging-decision).

## Cross-Cutting Coverage

No-cost suites that are shared across commands:

- `test/test-cases/validation/cli/option-resolution-contracts/` covers model-option resolution.
- `test/test-cases/validation/providers/provider-selection-contracts/` covers provider-flag acceptance, rejection, and shared flags.
- `test/test-cases/validation/reports-pricing/price-mode-contracts/` covers price-mode behavior.
- `test/test-cases/validation/text/url/html-url-backends-contracts/` covers URL article contracts.
- `test/test-cases/validation/providers/` and `test/test-cases/validation/resume-manifests/` cover provider contracts and resume manifests.
- `test/test-cases/price-flag/` covers `--price` for STT, OCR, write, TTS, image, video, and music.
