# Testing

Shared `bun t` runner behavior and the local and service test coverage map for the AutoShow CLI. Per-command coverage, price examples, and live selections live on the [command test pages](#command-test-pages).

`bun t` runs in live credential mode: it loads `.env` and forwards configured hosted credentials, so selected service tests can bill real providers. Use `bun t --price` for no-cost estimates of mapped commands, or `bun t:local` with explicit paths for fixture mode, which forwards no hosted credentials and skips live service tests. Fixture mode does not block network access by download or tool tests. Without `--budget`, live tests are admitted without price filtering; the flag sets a per-test-key threshold, not a total spending cap.

Full-suite execution requires explicit user authorization, including fixture-mode runs. Default verification is `bun run check`, `bun t --price`, and targeted local tests. Estimate the complete related paid batch, including minimum billing, add-ons, and billable retries: totals below $1.00 USD are automatically authorized for the requested task; unknown estimates or totals of $1.00 USD or more require explicit approval naming the commands and expected cost/risk. Keep spending cumulative across related runs and retries.

`bun run check` runs structure, name, type, and documentation example checks without loading `.env`. `bun run check:types` uses the native compiler against `tsconfig.json`; `bun run check:types:tsc` provides a reference TypeScript compiler cross-check. Normal `bun autoshow` commands load `.env` for provider credentials.

## Local Quick Start

For a targeted CLI smoke pass without provider calls:

```bash
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
bun test test/test-cases/validation/setup/
```

For local extraction and rendering coverage:

```bash
bun t:local \
  test/test-cases/e2e/local/sources/download/download-input-types-local-file.test.ts \
  test/test-cases/e2e/local/text/ocr/ \
  test/test-cases/e2e/local/stt/ \
  test/test-cases/e2e/local/audio/music/music-lyrics-video.test.ts
```

Local extraction and rendering tests require their installed tools, models, and input fixtures; select only cases whose prerequisites are available when verifying without downloads.

## Service Quick Start

```bash
bun t test/test-cases/e2e/local/sources/download/download-input-types-direct-url.test.ts
bun t test/test-cases/e2e/local/sources/download/download-input-types-streaming.test.ts
bun t test/test-cases/e2e/local/sources/download/download-input-types-feed-or-channel.test.ts

AUTOSHOW_TEST_CREDENTIAL_KEYS='["OPENAI_API_KEY"]' \
  bun --no-env-file run t:provider --budget 50 test/test-cases/e2e/service/audio/tts/
```

`t:provider` selects live mode without loading `.env` and forwards hosted credentials already present in the environment. Set `AUTOSHOW_TEST_CREDENTIAL_KEYS` to a JSON array of registered credential names, with those values exported, to restrict that list. Tests needing unlisted or missing credentials are skipped. Direct `bun test` does not authorize hosted execution; live budgeted tests fail closed without runner evidence. A budget may skip every selected live test when no estimate fits. The download examples exercise network sources without hosted AI credentials.

## Command Test Pages

Per-command coverage, price examples, and live selections live on these pages:

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
- Under `bun test`, passing tests print only the result line (`✓`, name, duration). Failing tests keep that `✗` line and the captured console output from that test.
- `bun t` hides passing and skipped result lines and prints a failure-first digest, skip summary, slowest tests, and model calibration recommendations. Quiet runs print progress after 10 seconds without output. Full result lines remain in `runner.log`; use `--verbose` to stream them to the terminal. Timing recommendations exclude local engines because concurrent CPU contention distorts their wall-clock measurements.
- `--max-concurrency` and `--parallel` default to the machine's available parallelism. E2E-only selections default `--parallel` to 32. Pass `--max-concurrency=<n>` or `--parallel=<n>` to override. `--concurrency` and `--retry` are rejected; tests are not automatically repeated.
- `--parallel` isolates test files. Use `--no-isolate` only as a temporary diagnostic escape hatch for a confirmed isolation or preload regression; it is not a supported default because it weakens file-level state separation.
- Interrupting a run terminates local test descendants.
- Each run writes artifacts under `output/test-output/YYYY-MM-DD_HH-MM-SS_test-run/`. A normal `bun t` removes its own successful run directory unless it contains protected TTS/audio artifacts; `bun t --price` retains its report by default. Both preserve earlier runs. Use `--no-cleanup` to keep the current directory in either mode. Failed and interrupted runs retain their reports, logs, and per-test outputs.
- `--cleanup` prunes earlier runs confirmed successful by this runner and removes the current successful run. Active, failed, interrupted, legacy, unknown, and TTS/audio artifacts stay intact. If both cleanup flags appear, the last one wins.
- Root files and `.test-cache/` survive cleanup. `latest.log` keeps the run summary, detailed digest, failures, skips, runner log, and command-log tail. Test-mode runs regenerate `latest-model-calibration.json` from retained run metadata for model cost and timing-estimate recommendations.
- Use `--no-adaptive-concurrency` to disable adaptive per-provider lane limits.

```bash
bun t test/test-cases/validation/stt/workflows/timing/documentation-speech-workflows.test.ts --no-cleanup

cat output/test-output/latest.log

cat output/test-output/latest-model-calibration.json
```

This targeted local run calls no hosted provider and never downloads tools or models. Native cases require FFmpeg/FFprobe; optional tiny/ONNX cases use installed prerequisites and otherwise skip. It verifies review lineage, caption serialization, channel reconciliation, and valid and rejected timing artifacts. A validation-only run can report zero model metadata files and no recommendations. Runner calibration concerns cost and timing estimates; [word-timing calibration](02-extract/stt/workflows/timing/overview.md) is separate. Neither establishes spoken-text correctness or perceptual quality.

Common selection and diagnostic flags are forwarded unchanged after AutoShow resolves path filters:

```bash
bun t --changed=main

bun t test/test-cases/validation/ --only-failures

bun t test/test-cases/validation/runtime-contracts/ --grep='tokenizer'

bun t test/test-cases/validation/ '--path-ignore-patterns=*provider*'
```

Use `--shard=<index>/<count>` only with a curated set already proven local and no-cost. Timing balance does not classify provider cost or make an unreviewed selection safe.

Preserve interrupted or failed TTS output directories and temporary working directories. When automatic redispatch is blocked pending reconciliation, inspect retained evidence and estimate possible duplicate billing before using `--allow-ambiguous-redispatch`. Completed cached audio is reused, but missing audio may be purchased again; apply the cumulative spending rules above.

`--price` maps the selected test paths to pricing commands without running the tests. Credential skips and Bun passthrough filters such as `--grep` do not narrow that command map. `--budget <whole-number-hundredths-of-a-cent>` skips live tests whose estimates exceed that threshold; for example, `--budget 100` allows tests estimated at up to 1 cent. Command-specific examples live on the command test pages.

```bash
bun t --price
bun t test/test-cases/e2e/service/text/write/ --budget 2500
```

- `--price` with no path filters resolves all mapped test price commands.
- `--price` preserves previous evidence and its own estimated-cost report by default; `--no-cleanup` states that preference explicitly. Pricing subprocesses do not receive provider credentials and disable `.env` loading.
- `--budget` applies independently to each matching test; estimates are not combined into an aggregate cap. An unmapped or unevaluated hosted test fails locally instead of calling a provider. Local engine tests run without that evidence and still skip when a budget names their key.
- Most validation paths have no mapped price commands, so `--price` on them reports a zero-cost pass.

## No-Cost CI Gate

### Documentation examples

`bun run check:docs` reads concrete `bun autoshow` and `bun as` examples from the README and `docs/commands/`, joins shell continuations, and checks command syntax, registered flags, and explicit `--provider provider=model` selectors. Templates and shell expressions are excluded. Examples are parsed without running command handlers, accessing their inputs, or contacting providers.

Price behavior is covered by `bun t --price` and the local contracts under `test/test-cases/validation/reports-pricing/price-mode-contracts/`. The documentation check produces no cost reports or generated inventory.

Pull requests and pushes to `main` run the same work as `bun run check` and `bun t --price`, plus local CLI smoke and contract tests when the diff can affect them. Changes limited to `docs/benchmarks/`, `docs/reports/`, `docs/todo/`, `docs/diagrams/`, `docs/diagrams.md`, or root-level Markdown other than `README.md` skip that contract step. An unknown diff base runs it. CI supplies no provider credentials and does not run the full suite or provider-backed commands.

`bun src/tools/ci-run-timings.ts price <metrics.ndjson>` prints per-command timings from a retained price run. `bun src/tools/ci-run-timings.ts run <run-id>` summarizes a finished GitHub Actions run with per-job and per-step timings and the critical path. Pass `--json-file` to summarize a saved run payload.

## Package Review

The package-hygiene CI job runs `bun audit`, `bun dedupe --check`, the reference compiler cross-check, and a production JSON license report. It retains dry-run audit-fix and prune reviews. Package-manager commands may load `.env` even when `--no-env-file` is supplied.

Use this review sequence for every declared dependency or lockfile refresh:

1. Work in clean CI or a clean checkout with no project `.env`; do not treat `--no-env-file` as the package-manager secret boundary.
2. Run `bun pm diff <package>` for each changed direct package and save the output with the review evidence.
3. Inspect the complete `bun.lock` diff for unrelated direct or transitive movement, source changes, scripts, native addons, patches, overrides, catalogs, workspaces, or non-registry resolutions.
4. Run `bun install --frozen-lockfile`, `bun audit`, `bun dedupe --check`, and `bun pm licenses --prod --json` before the default verification pass.
5. Run `bun audit fix --dry-run` only to create a review artifact. Never auto-apply audit fixes; review and implement each accepted dependency change explicitly.
6. Use `bun prune --dry-run` to identify installed state outside the lockfile, review every proposed removal, then run `bun prune` only when the install residue is confirmed unreachable.

Docker therefore keeps the frozen production install without an additional prune layer.

## Profiling

No-cost profiling recipes write CPU profiles, heap profiles, bundle metafiles, logs, and metadata under the ignored `runtime/profiling/bun-runtime/` directory. They inherit only `HOME` and `PATH`, do not receive provider credentials, and do not execute provider calls. Generated artifacts are diagnostic evidence and are not committed.

### CPU profiles

Run `bun profile:cpu` to profile `autoshow --help` startup and the no-cost `bun t --price` path. The command writes `cli-help.cpu.md`, `test-price.cpu.md`, child logs, and `metadata.json` into one timestamped run directory. Compare the profile summaries and the command durations in the metadata files before and after a startup or price-planning change. This recipe does not run test cases or provider commands.

### Heap profile

Run `bun profile:heap` to profile a deterministic synthetic RSS/XML workload and a large synthetic OCR-style page-normalization workload. The fixture contains no user or source-book content. The run writes `local-parsing-normalization.heap.md`, child logs, and metadata.

### Reference-tokenizer cache profile

Run `bun profile:tokenizer` to record heap profiles before the tokenizer cache is loaded, after it is loaded, after eviction, and after reconstruction. `reference-tokenizer-memory-summary.json` records heap totals, cache entry counts, and token-ID hashes. The after-load and after-reconstruction hashes must match.

### Bundle analysis

Run `bun profile:bundle` to build the CLI entrypoint and write JSON and Markdown bundle metafiles. Review `bundle-inventory.json` before moving assets or changing dynamic imports.

### Complete capture

Run `bun profile:all` to execute all four recipes into one timestamped directory. Any recipe accepts `--output-dir <path>` when invoked directly, for example `env -i PATH="$PATH" HOME="$HOME" bun --no-env-file src/tools/bun-profile.ts bundle --output-dir runtime/profiling/bun-runtime/before-bundle-change`.

## Cross-Cutting Coverage

No-cost suites that are shared across commands:

- `test/test-cases/validation/cli/option-resolution-contracts/` covers model-option resolution.
- `test/test-cases/validation/providers/provider-selection-contracts/` covers provider-flag acceptance, rejection, and shared flags.
- `test/test-cases/validation/reports-pricing/price-mode-contracts/` covers price-mode behavior.
- `test/test-cases/validation/text/url/html-url-backends-contracts/` covers URL article contracts.
- `test/test-cases/validation/providers/` and `test/test-cases/validation/resume-manifests/` cover provider contracts and resume manifests.
- `test/test-cases/price-flag/` covers `--price` for STT, OCR, write, TTS, image, video, and music.
