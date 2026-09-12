# Testing

Shared `bun t` runner behavior plus the local and service test coverage map for the AutoShow CLI. Capability test pages live beside their command docs and are indexed in [Command Test Pages](#command-test-pages).

Default local verification is `bun run check` followed by `bun t --price`. Price mode estimates mapped commands without executing provider tests. The default runner uses fixture mode and does not forward provider credentials. Hosted execution requires explicit live mode, a credential allowlist, and valid budget evidence; apply the repository spending policy before running it.

`bun run check` starts `check:structure`, `check:names`, and `check:types` concurrently with `bun run --parallel`. Each maintenance child receives only `PATH` and `HOME`, disables automatic env-file loading, and calls the installed TypeScript 6.0.3 compiler directly. The `repo`, OCR-token audit, complexity analysis, and default custom test-runner scripts use the same minimal environment boundary. Docker baseline, env-compatibility and acceptance launchers additionally preserve the shared Docker host/context/TLS connection settings listed in the [environment inventory](../../src/tools/environment-reference.ts). Normal `bun autoshow` commands still load `.env` because provider commands legitimately require credentials.

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

`t:provider` selects live mode and disables automatic `.env` loading. Set `AUTOSHOW_TEST_CREDENTIAL_KEYS` to a JSON array of the registered credential names required by the selected files, and export those values. Tests needing unlisted or missing credentials are skipped. The runner generates evaluated/skip manifests from `--budget`; missing or corrupt evidence cannot admit hosted callbacks. A budget may skip every selected test when no estimate fits. Choose the selection and budget according to the repository spending policy.

Direct live `bun --no-env-file test` execution requires `AUTOSHOW_TEST_CREDENTIAL_MODE=live` plus valid `AUTOSHOW_TEST_BUDGET_EVALUATED_KEYS` and `AUTOSHOW_TEST_BUDGET_SKIP_KEYS` JSON arrays from an evaluated plan. Shared helpers read normalized exports only and never fall back to `.env`. Each live callback forwards only its declared credentials to CLI children.

## Command Test Pages

Command source, documentation, validation, and price tests use the `sources`, `stt`, `text`, `audio`, and `visuals` capability groups. E2E tests retain `local/` and `service/` as their first level. Shared CLI, configuration, runtime, pricing, resume, setup, provider, and mixed-feature contracts remain in their shared locations.

- [Setup Tests](00-setup-and-utilities/setup.md#testing)
- [Download Tests](01-sources/download/tests.md)
- [STT Tests](02-stt/tests.md)
- [OCR Tests](03-text/ocr/tests.md)
- [URL Tests](03-text/url/tests.md)
- [Write Service Tests](03-text/write/tests.md)
- [TTS Service Tests](04-audio/tts/tests.md)
- [Image Service Tests](05-visuals/image/tests.md)
- [Video Service Tests](05-visuals/video/tests.md)
- [Music Tests](04-audio/music/tests.md)

## Shared Runner Behavior

- Pass file or directory paths under `test/test-cases/` to select tests.
- Passing tests print only the result line (`✓`, name, duration). Failing tests keep that `✗` line and the captured console output from that test.
- `--max-concurrency` and `--parallel` default to the machine's available parallelism. E2E-only selections default `--parallel` to 32; automatic test retries are disabled. Pass `--max-concurrency=<n>` or `--parallel=<n>` to override; `--concurrency` is not a Bun test flag and is rejected.
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
bun t test/test-cases/e2e/service/text/write/ --budget 2500
```

- `--price` with no path filters resolves all mapped test price commands.
- `--budget` applies independently to each matching test; estimates are not combined into an aggregate cap. An unmapped or unevaluated test fails locally instead of calling a provider.
- Most validation paths have no mapped price commands, so `--price` on them reports a zero-cost pass.

## No-Cost CI Gate

Pull requests and pushes to `main` run the exact Bun 1.4.2 verification job in `.github/workflows/docker-publish.yml`. It disables automatic env-file loading, installs from the frozen v2 lockfile, runs the same work as `bun run check` and `bun t --price`, runs the three approved CLI smoke selections, and runs the explicit local-only Bun migration contracts. The workflow supplies no provider credentials and does not run the full suite, unclassified shards, smoke/e2e selections, or provider-backed commands.

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

AutoShow keeps generated CPU profiles, heap profiles, bundle metafiles, compiled probe bundles, logs, and metadata under the ignored `runtime/profiling/bun-runtime/` directory. Every profiling run records the exact child commands, Bun version, package-manager pin, platform, architecture, duration, exit status, and the fact that dotenv loading was disabled. The recipes inherit only `HOME` and `PATH`; they do not receive provider credentials and do not execute provider calls.

### CPU profiles

Run `bun profile:cpu` to generate Markdown CPU profiles for `autoshow --help` startup and the no-cost `bun t --price` path. The command writes `cli-help.cpu.md`, `test-price.cpu.md`, child logs, and `metadata.json` into one timestamped run directory.

Use the same recipe before and after a startup or price-planning optimization, then compare the profile summaries and the command durations in the two metadata files. This recipe does not run test cases or provider commands.

### Heap profile

Run `bun profile:heap` to exercise a deterministic synthetic RSS/XML workload and a large synthetic OCR-style page-normalization workload under `--heap-prof-md`. The fixture contains no user or source-book content. The run writes `local-parsing-normalization.heap.md`, a checksum-bearing workload observation, child logs, and metadata.

### Reference-tokenizer cache profile

Run `bun profile:tokenizer` to record four separate Markdown heap profiles: before the rank map is loaded, after the 199,998-entry map is loaded, after explicit eviction and forced garbage collection, and after deterministic reconstruction. `reference-tokenizer-memory-summary.json` records the total heap parsed from each profile, cache entry counts, memory-usage counters, and token-ID hashes. The after-load and after-reconstruction hashes must match.

### Bundle analysis

Run `bun profile:bundle` to build the same `src/cli/create-cli.ts` entrypoint used by the test prebuild and generate both JSON and Markdown metafiles. The accompanying `bundle-inventory.json` lists the largest input modules, dynamic imports, prompt JSON files and bytes, the tokenizer rank asset, and source-layout references using `import.meta.dir`. Review that inventory before moving assets, changing dynamic imports, or experimenting with a standalone executable.

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
