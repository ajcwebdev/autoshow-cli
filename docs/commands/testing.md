# Testing

Shared `bun t` runner behavior plus the local and service test coverage map for the AutoShow CLI. Per-step test pages live beside their command docs and are indexed in [Step Test Pages](#step-test-pages).

Default local verification is `bun run check`. The `bun t` commands below may call paid or quota-limited providers. Do not use them as a default verification pass without explicit approval for that exact run.

## Outline

- [Local Quick Start](#local-quick-start)
- [Service Quick Start](#service-quick-start)
- [Step Test Pages](#step-test-pages)
- [Shared Runner Behavior](#shared-runner-behavior)
- [Price Preflight](#price-preflight)
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

# service command suites
bun t test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/
bun t test/test-cases/e2e/service/step-2-stt-e2e/stt-services/
bun t test/test-cases/e2e/service/step-3-write-e2e/write-services/
bun t test/test-cases/e2e/service/step-4-tts-e2e/tts-services/
bun t test/test-cases/e2e/service/step-5-image-gen-e2e/
bun t test/test-cases/e2e/service/step-6-video-gen-e2e/
bun t test/test-cases/e2e/service/step-7-music-gen-e2e/
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

- Pass file or directory paths under `test/test-cases/` to select tests.
- Passing tests print only the result line (`✓`, name, duration). Failing tests keep that `✗` line and the captured console output from that test.
- `--max-concurrency` and `--parallel` default to the machine's available parallelism. E2E-only selections default `--parallel` to 32 and retry once. Pass `--max-concurrency=<n>` or `--parallel=<n>` to override; `--concurrency` is not a Bun test flag and is rejected.
- Each run writes artifacts under `./project/test-output/YYYY-MM-DD_HH-MM-SS_test-run/`. By default, `bun t` cleans that directory after every run and leaves `./project/test-output/latest.log` with the run summary, failures, runner log, and command log. Use `--no-cleanup` to keep the full run directory, per-test CLI outputs, and test cache.
- Use `--no-adaptive-concurrency` to disable adaptive per-provider lane limits.

```bash
# keep the full run directory after completion
bun t --no-cleanup

# default cleanup still leaves a failure/debug summary
cat project/test-output/latest.log
```

## Price Preflight

`--price` uses the same path filters as a normal `bun t` run: append it to price-check mapped commands without running the live tests. `--budget <whole-number-hundredths-of-a-cent>` skips live tests whose estimates exceed that threshold; for example, `--budget 100` allows tests estimated at up to 1 cent. Step-specific examples live on the step test pages.

```bash
bun t --price
bun t test/test-cases/e2e/service/step-3-write-e2e/write-services/ --budget 2500
```

- `--price` with no path filters resolves all mapped test price commands.
- `--budget` applies independently to each matching test; estimates are not combined into an aggregate cap. An unmapped or unevaluated test fails locally instead of calling a provider.
- Most validation paths have no mapped price commands, so `--price` on them reports a zero-cost pass.

## Cross-Cutting Coverage

No-cost suites that are not tied to a single step:

- `test/test-cases/validation/cli/option-resolution-contracts/` covers model-option resolution.
- `test/test-cases/validation/providers/provider-selection-contracts/` covers provider-flag acceptance, rejection, and shared flags.
- `test/test-cases/validation/reports-pricing/price-mode-contracts/` covers price-mode behavior.
- `test/test-cases/validation/ingest/html-url-backends-contracts/` covers URL article contracts.
- `test/test-cases/validation/providers/` and `test/test-cases/validation/resume-manifests/` cover provider contracts and resume manifests.
- `test/test-cases/price-flag/` covers `--price` for STT, OCR, write, TTS, image, video, and music.
