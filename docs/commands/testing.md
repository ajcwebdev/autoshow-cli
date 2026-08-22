# Testing

Shared `bun t` runner behavior plus the local and service test coverage map for the AutoShow CLI. Per-step test pages live beside their command docs and are indexed in [Step Test Pages](#step-test-pages).

Default agent/contributor verification is `bun run check`. For smoke coverage that avoids third-party APIs and provider costs, use only targeted local/no-cost tests:

```bash
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

The `bun t` commands below document the full project runner for humans. Do not use `bun t` as a default verification pass: service, e2e, and full-runner commands may call paid or quota-limited providers and must not be used for agent verification without explicit approval for that exact run.

## Outline

- [Local Quick Start](#local-quick-start)
- [Service Quick Start](#service-quick-start)
- [Step Test Pages](#step-test-pages)
- [Shared Runner Behavior](#shared-runner-behavior)
- [Price Preflight](#price-preflight)
- [Cross-Cutting Coverage](#cross-cutting-coverage)

## Local Quick Start

```bash
# run all local tests
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-local-file.test.ts test/test-cases/e2e/local/step-2-ocr-e2e/ocr-local/ test/test-cases/e2e/local/step-2-stt-e2e/stt-local/ test/test-cases/e2e/local/step-3-write-e2e/write-local/ test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts
```

```bash
# local STT coverage
bun t test/test-cases/e2e/local/step-2-stt-e2e/stt-local/whisper/
bun t test/test-cases/e2e/local/step-2-stt-e2e/stt-local/whisperfile/

# local lyric-video coverage
bun t test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts
```

## Service Quick Start

```bash
# network-backed download coverage
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-direct-url.test.ts
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-streaming.test.ts
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-feed-or-channel.test.ts

# service command suites
bun t test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/
bun t test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ --price

bun t test/test-cases/e2e/service/step-2-stt-e2e/stt-services/
bun t test/test-cases/e2e/service/step-2-stt-e2e/stt-services/ --price

bun t test/test-cases/e2e/service/step-3-write-e2e/write-services/
bun t test/test-cases/e2e/service/step-3-write-e2e/write-services/ --price

bun t test/test-cases/e2e/service/step-4-tts-e2e/tts-services/
bun t test/test-cases/e2e/service/step-4-tts-e2e/tts-services/ --price

bun t test/test-cases/e2e/service/step-5-image-gen-e2e/
bun t test/test-cases/e2e/service/step-5-image-gen-e2e/ --price

bun t test/test-cases/e2e/service/step-6-video-gen-e2e/
bun t test/test-cases/e2e/service/step-6-video-gen-e2e/ --price

bun t test/test-cases/e2e/service/step-7-music-gen-e2e/
bun t test/test-cases/e2e/service/step-7-music-gen-e2e/ --price
```

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

- Test discovery comes from `test/test-cases/**/*.test.ts`.
- Passing tests print only the result line (`✓`, name, duration). Failing tests keep that `✗` line and the captured console output from that test. JUnit stays a post-run sidecar for `report.json`; it is not the live reporter.
- Selection is path-based only.
- Normal test mode defaults both `--max-concurrency` and `--parallel` to the machine's available parallelism. When every selected file sits under `test/test-cases/e2e/`, `--parallel` instead defaults to 32 and the run also passes `--retry 1`. Pass explicit `--max-concurrency=<n>` or `--parallel=<n>` values to override either knob for a run; `--concurrency` is not a Bun test flag and is rejected with a usage error.
- Price and budget preflight commands run with the default price concurrency of 25.
- `--price` uses the same normal `test/test-cases/...` path filters as `bun t`: append it to the command you would otherwise run to price-check the mapped commands without running the live tests. The same flag is used by regular AutoShow commands. `--budget <whole-number-hundredths-of-a-cent>` remains a live-test skip mechanism for the selected normal test paths. For example, `--budget 100` allows tests estimated at up to 1 cent.
- Each run writes artifacts under `./project/test-output/YYYY-MM-DD_HH-MM-SS_test-run/`, including `runner.log`, `commands.log`, `metrics.ndjson`, `metadata/`, and `report.json`. Normal test mode also writes `junit.xml`, `e2e-report.json`, and `model-calibration.json` with read-only model calibration recommendations.
- By default, `bun t` cleans test outputs after every run and leaves `./project/test-output/latest.log` with the run summary, failures, runner log, and command log. Normal test mode also sets `AUTOSHOW_TEST_PRESERVE_ARTIFACTS=0`, which deletes per-test output directories as tests finish.
- The runner prebuilds the CLI to `project/test-output/.test-cache/cli.js` and points tests at it with `AUTOSHOW_TEST_CLI_BUNDLE`; bundle-mode CLI spawns also receive `AUTOSHOW_PROJECT_ROOT` so the prebuilt bundle resolves `runtime/` against the checkout instead of its own location. `AUTOSHOW_TEST_CONCURRENT` is the runner-to-worker switch that enables `test.concurrent` for budgeted e2e tests; exporting it yourself before a run wins over the runner's value. These are runner-internal transport variables, not user configuration.
- Use `--no-cleanup` to keep the full run directory, per-test CLI outputs, and test cache under `./project/test-output/`. Use `--no-adaptive-concurrency` to disable the runner's adaptive per-provider lane limits for a run.

```bash
# keep the full run directory after completion
bun t --no-cleanup

# default cleanup still leaves a failure/debug summary
bun t test/test-cases/e2e/local/step-2-stt-e2e/stt-local/whisper/
cat project/test-output/latest.log
```

## Price Preflight

Price and budget commands use the same path filters as normal runs; step-specific examples live on the step test pages.

Notes:
- `--price` with no path filters resolves all mapped test price commands.
- `--budget` in normal mode applies its threshold independently to each matching `budgetedTest()` key; runnable estimates are not combined into an aggregate cap. Every component key must be mapped and successfully evaluated by preflight. An unmapped, malformed, or otherwise unevaluated key fails locally without executing the test callback or calling a provider.
- Validation paths (`test/test-cases/validation/`) are unmapped apart from `media-generation/fal-tts-adapter-contracts.test.ts` and `media-generation/replicate-tts-adapter-contracts.test.ts`, which map to the Fal and Replicate TTS price commands. Selecting any other validation path with `--price` resolves zero commands and reports a zero-cost pass.

## Cross-Cutting Coverage

- `test/test-cases/validation/cli/option-resolution-contracts/`, `test/test-cases/validation/providers/provider-selection-contracts/`, and `test/test-cases/validation/reports-pricing/price-mode-contracts/` cover model-option resolution, provider-flag acceptance/rejection and shared-flag logic across all provider types, and price-mode behavior without live service calls.
- `test/test-cases/validation/ingest/html-url-backends-contracts/` provides no-cost URL article contract coverage; the suite mocks provider calls and covers route-aware `--all-providers` artifact and price-preflight behavior.
- `test/test-cases/validation/providers/` and `test/test-cases/validation/resume-manifests/` cover mocked REST request/response payloads and manifest serialization across generation command families without live network requests.
- `test/test-cases/price-flag/` contains focused `--price` coverage for STT, OCR, write, TTS, image, video, and music command families.
