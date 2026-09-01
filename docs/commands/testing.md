# Testing

Shared `bun t` runner behavior plus the local and service test coverage map for the AutoShow CLI. Per-step test pages live beside their command docs and are indexed in [Step Test Pages](#step-test-pages).

Default local verification is `bun run check` followed by `bun t --price`. Price mode estimates mapped commands without executing provider tests. The other `bun t` commands below may call paid or quota-limited providers. Do not use them as a default verification pass without explicit approval for that exact run.

`bun run check` starts `check:names` and `check:types` concurrently with `bun run --parallel`. Each maintenance child receives only `PATH` and `HOME`, disables automatic env-file loading, and calls the installed TypeScript 6.0.3 compiler directly. The `repo`, OCR-token audit, complexity analysis, Docker baseline, env-compatibility probe, and default custom test-runner scripts use the same minimal environment boundary. Normal `bun autoshow` commands still load `.env` because provider commands legitimately require credentials.

## Outline

- [Local Quick Start](#local-quick-start)
- [Service Quick Start](#service-quick-start)
- [Step Test Pages](#step-test-pages)
- [Shared Runner Behavior](#shared-runner-behavior)
- [Price Preflight](#price-preflight)
- [No-Cost CI Gate](#no-cost-ci-gate)
- [Package Review](#package-review)
- [Profiling](#profiling)
- [Cross-Cutting Coverage](#cross-cutting-coverage)

## Local Quick Start

```bash
# local e2e coverage
bun t \
  test/test-cases/e2e/local/step-1-download-e2e/download-input-types-local-file.test.ts \
  test/test-cases/e2e/local/step-2-ocr-e2e/ocr-local/ \
  test/test-cases/e2e/local/step-2-stt-e2e/stt-local/ \
  test/test-cases/e2e/local/step-3-write-e2e/write-local/ \
  test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts
```

## Service Quick Start

```bash
# network-backed download coverage
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-direct-url.test.ts
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-streaming.test.ts
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-feed-or-channel.test.ts

# service command suites; exported credentials only, with automatic .env loading disabled
bun --no-env-file run t:provider test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/
bun --no-env-file run t:provider test/test-cases/e2e/service/step-2-stt-e2e/stt-services/
bun --no-env-file run t:provider test/test-cases/e2e/service/step-3-write-e2e/write-services/
bun --no-env-file run t:provider test/test-cases/e2e/service/step-4-tts-e2e/tts-services/
bun --no-env-file run t:provider test/test-cases/e2e/service/step-5-image-gen-e2e/
bun --no-env-file run t:provider test/test-cases/e2e/service/step-6-video-gen-e2e/
bun --no-env-file run t:provider test/test-cases/e2e/service/step-7-music-gen-e2e/
```

The `t:provider` entrypoint is reserved for an explicitly approved provider run. Export only the credential required by that exact selection before invoking it; the command does not auto-load `.env`.

## Step Test Pages

- [Setup Tests](setup-and-utilities/setup/setup-tests.md)
- [Step 1 Tests: Download](process-steps/step-1-download/download-tests.md)
- [Step 2 Tests: STT](process-steps/step-2-extract/05-extract-stt-tests.md)
- [Step 2 Tests: OCR](process-steps/step-2-extract/06-extract-ocr-tests.md)
- [Step 3 Service Tests: Write](process-steps/step-3-write/write-tests.md)
- [Step 4 Service Tests: TTS](process-steps/step-4-tts/tts-tests.md)
- [Step 5 Service Tests: Image](process-steps/step-5-image/image-tests.md)
- [Step 6 Service Tests: Video](process-steps/step-6-video/video-tests.md)
- [Step 7 Tests: Music](process-steps/step-7-music/music-tests.md)

## Shared Runner Behavior

- Pass file or directory paths under `test/test-cases/` to select tests.
- Passing tests print only the result line (`✓`, name, duration). Failing tests keep that `✗` line and the captured console output from that test.
- `--max-concurrency` and `--parallel` default to the machine's available parallelism. E2E-only selections default `--parallel` to 32 and retry once. Pass `--max-concurrency=<n>` or `--parallel=<n>` to override; `--concurrency` is not a Bun test flag and is rejected.
- On Bun 1.4, `--parallel` implies isolated test files. Use `--no-isolate` only as a temporary diagnostic escape hatch for a confirmed isolation or preload regression; it is not a supported default because it weakens file-level state separation.
- The runner gives Bun `--timings=output/test-output/.test-cache/bun-file-timings.json --update-timings`, so Bun schedules slow files first and balances timing-aware shards. The native file cache is seeded once from AutoShow's historical file medians; the separate custom cache remains the source of per-test estimates in `report.json`.
- Parallel scratch roots include `BUN_TEST_WORKER_ID` and the worker process ID. The worker ID partitions Bun's scheduling lanes while the process ID keeps independently launched local runs distinct.
- The runner and each inner `bun test` process use `--no-orphans`, so interruption terminates local test descendants without treating generated output or TTS reconciliation artifacts as disposable.
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

Use `--shard=<index>/<count>` only with a curated set already proven local and no-cost. Native file timings balance those shards, but timing balance does not classify provider cost or make an unreviewed selection safe.

Setup relaunches only the `setup` command under Bun's `--no-orphans` mode. The relaunch passes the already-resolved environment explicitly and disables a second `.env` parse. Other AutoShow commands retain their existing process behavior while interruption contracts are staged; `run.noOrphans` is deliberately not enabled globally in `bunfig.toml` yet. Process termination never authorizes deletion of completed TTS segment audio or reconciliation state. Resume ambiguous real TTS work with `--allow-ambiguous-redispatch` so completed slots can be reused.

## Price Preflight

`--price` uses the same path filters as a normal `bun t` run: append it to price-check mapped commands without running the live tests. `--budget <whole-number-hundredths-of-a-cent>` skips live tests whose estimates exceed that threshold; for example, `--budget 100` allows tests estimated at up to 1 cent. Step-specific examples live on the step test pages.

```bash
bun t --price
bun t test/test-cases/e2e/service/step-3-write-e2e/write-services/ --budget 2500
```

- `--price` with no path filters resolves all mapped test price commands.
- `--budget` applies independently to each matching test; estimates are not combined into an aggregate cap. An unmapped or unevaluated test fails locally instead of calling a provider.
- Most validation paths have no mapped price commands, so `--price` on them reports a zero-cost pass.

## No-Cost CI Gate

Pull requests and pushes to `main` run the exact Bun 1.4.0 verification job in `.github/workflows/docker-publish.yml`. It disables automatic env-file loading, installs from the frozen v2 lockfile, runs the same work as `bun run check` and `bun t --price`, runs the three approved CLI smoke selections, and runs the explicit local-only Bun migration contracts. The workflow supplies no provider credentials and does not run the full suite, unclassified shards, smoke/e2e selections, or provider-backed commands.

The AMD64 and ARM64 Docker publication jobs depend on both no-cost verification and package hygiene. On their native runners they prove the production frozen install, run help/config/setup-doctor smokes, record image size plus five cold-help samples, five prebuild samples, and three local-fixture peak-RSS samples, and upload the evidence. They run only for pushes, so a failure prevents the multi-architecture manifest from being published and pull requests never publish images.

## Package Review

Package hygiene runs separately in clean CI with an empty inherited environment except for `PATH`, an isolated `HOME`, and `CI=true`. It runs `bun audit`, `bun dedupe --check`, and a production JSON license report uploaded as a workflow artifact. This clean environment is the secret boundary because Bun package-manager commands may load `.env` even when `--no-env-file` is supplied.

`repomix` and `tiktoken` are intentionally not dependencies. The repository snapshot builder is implemented in `src/tools/repo-snapshot.ts`, and reference tokenization uses the pinned vendored rank data in `src/tools/o200k-base-ranks.tiktoken.gz`. On 2026-08-31, `bun prune --dry-run` identified both undeclared top-level links, their unreachable transitive graph, and a stale TypeScript 6.0.2 store copy. The reviewed `bun prune` removed 186 unreachable packages; a subsequent frozen install and the verification pass establish the declared seven-package graph.

Use this review sequence for every declared dependency or lockfile refresh:

1. Work in clean CI or a clean checkout with no project `.env`; do not treat `--no-env-file` as the package-manager secret boundary.
2. Run `bun pm diff <package>` for each changed direct package and save the output with the review evidence.
3. Inspect the complete `bun.lock` diff for unrelated direct or transitive movement, source changes, scripts, native addons, patches, overrides, catalogs, workspaces, or non-registry resolutions.
4. Run `bun install --frozen-lockfile`, `bun audit`, `bun dedupe --check`, and `bun pm licenses --prod --json` before the default verification pass.
5. Run `bun audit fix --dry-run` only to create a review artifact. Never auto-apply audit fixes; review and implement each accepted dependency change explicitly.
6. Use `bun prune --dry-run` to identify installed state outside the lockfile, review every proposed removal, then run `bun prune` only when the install residue is confirmed unreachable.

A clean production frozen install measured 26,096 KiB before and after `bun prune --production` on 2026-08-31, and prune reported nothing removable. Docker therefore keeps the frozen production install without an additional prune layer; remeasure before revisiting that choice.

## Profiling

The no-cost `profile:cpu`, `profile:heap`, `profile:tokenizer`, `profile:bundle`, and `profile:all` scripts use a clean environment and write generated artifacts beneath ignored `runtime/profiling/bun-runtime/` directories. See [Bun 1.4 Profiling Recipes](../benchmarks/bun-1-4-profiling-recipes.md) for the workloads, metadata contract, and before/after comparison procedure.

## Cross-Cutting Coverage

No-cost suites that are not tied to a single step:

- `test/test-cases/validation/cli/option-resolution-contracts/` covers model-option resolution.
- `test/test-cases/validation/providers/provider-selection-contracts/` covers provider-flag acceptance, rejection, and shared flags.
- `test/test-cases/validation/reports-pricing/price-mode-contracts/` covers price-mode behavior.
- `test/test-cases/validation/ingest/html-url-backends-contracts/` covers URL article contracts.
- `test/test-cases/validation/providers/` and `test/test-cases/validation/resume-manifests/` cover provider contracts and resume manifests.
- `test/test-cases/price-flag/` covers `--price` for STT, OCR, write, TTS, image, video, and music.
