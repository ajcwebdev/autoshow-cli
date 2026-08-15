# Local Tests

Shared `bun t` runner behavior plus the local/runtime-heavy test paths for Whisper, Whisperfile, Reverb, local llama.cpp, llamafile, and Kitten TTS.

For API-backed and networked coverage, see [Service Tests](service-tests.md).

Default agent/contributor verification is `bun run check`. For smoke coverage that avoids third-party APIs and provider costs, use only targeted local/no-cost tests:

```bash
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

Additional no-cost URL article contract coverage lives in `test/test-cases/validation/ingest/html-url-backends-contracts/` and `test/test-cases/validation/reports-pricing/price-mode-contracts/`; those suites mock provider calls and cover route-aware `--all-providers` artifact and price-preflight behavior. `test/test-cases/validation/providers/provider-selection-contracts/` is another no-cost suite covering provider-flag acceptance/rejection and shared-flag logic across all provider types.

The `bun t` commands below document the full project runner for humans. Do not use `bun t`, `bun run t`, or `bun test/test-runner.ts` as a default verification pass. Service, e2e, and full-runner commands may call paid or quota-limited providers and must not be used as agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Shared Runner Behavior](#shared-runner-behavior)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
# run all local tests
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-local-file.test.ts test/test-cases/e2e/local/step-2-ocr-e2e/ocr-local/ test/test-cases/e2e/local/step-2-stt-e2e/stt-local/ test/test-cases/e2e/local/step-3-write-e2e/write-local/ test/test-cases/e2e/local/step-4-tts-e2e/tts-local/ test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts
```

```bash
# local STT coverage
bun t test/test-cases/e2e/local/step-2-stt-e2e/stt-local/whisper/
bun t test/test-cases/e2e/local/step-2-stt-e2e/stt-local/whisperfile/
bun t test/test-cases/e2e/local/step-2-stt-e2e/stt-local/reverb/reverb.test.ts

# local write and TTS coverage
bun t test/test-cases/e2e/local/step-3-write-e2e/write-local/write-subcommand-local.test.ts
bun t test/test-cases/e2e/local/step-3-write-e2e/write-local/write-subcommand-llamafile.test.ts
bun t test/test-cases/e2e/local/step-3-write-e2e/write-local/write-project-lyrics.test.ts
bun t test/test-cases/e2e/local/step-4-tts-e2e/tts-local/kitten-tts.test.ts

# local lyric-video coverage
bun t test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts
```

## Shared Runner Behavior

- Test discovery comes from `test/test-cases/**/*.test.ts`.
- Selection is path-based only.
- Normal test mode passes `--max-concurrency=10 --parallel=10` to `bun test` by default. Pass explicit `--max-concurrency=<n>` or `--parallel=<n>` values to override either knob for a run.
- Price and budget preflight commands run with the default price concurrency of 25.
- `--price` uses the same normal `test/test-cases/...` path filters as `bun t`: append it to the command you would otherwise run to price-check the mapped commands without running the live tests. The same flag is used by regular AutoShow commands. `--budget <whole-number-hundredths-of-a-cent>` remains a live-test skip mechanism for the selected normal test paths. For example, `--budget 100` allows tests estimated at up to 1 cent.
- Each run writes artifacts under `./project/test-output/YYYY-MM-DD_HH-MM-SS_test-run/`, including `runner.log`, `commands.log`, `metrics.ndjson`, `metadata/`, and `report.json`. Normal test mode also writes `junit.xml`, `e2e-report.json`, and `model-calibration.json` with read-only model calibration recommendations.
- By default, `bun t` cleans test outputs after every run and leaves `./project/test-output/latest.log` with the run summary, failures, runner log, and command log. Normal test mode also sets `AUTOSHOW_TEST_PRESERVE_ARTIFACTS=0`, which deletes per-test output directories as tests finish.
- Use `--no-cleanup` to keep the full run directory, per-test CLI outputs, and test cache under `./project/test-output/`.

```bash
# keep the full run directory after completion
bun t --no-cleanup

# default cleanup still leaves a failure/debug summary
bun t test/test-cases/e2e/local/step-4-tts-e2e/tts-local/kitten-tts.test.ts
cat project/test-output/latest.log
```

## Current Coverage

| Area | Paths | Notes |
|------|-------|-------|
| Download local file | `test/test-cases/e2e/local/step-1-download-e2e/download-input-types-local-file.test.ts` | Local input path coverage |
| OCR options | `test/test-cases/e2e/local/step-2-ocr-e2e/ocr-local/ocr-options.test.ts` | Core local OCR validation and routing coverage |
| Whisper | `test/test-cases/e2e/local/step-2-stt-e2e/stt-local/whisper/` | Includes default, per-model (`tiny`/`base`), split, and `large-v3-turbo` coverage |
| Whisperfile | `test/test-cases/e2e/local/step-2-stt-e2e/stt-local/whisperfile/` | Local Mozilla whisperfile STT (downloads a prebuilt `tiny` whisperfile on first run) |
| Reverb | `test/test-cases/e2e/local/step-2-stt-e2e/stt-local/reverb/reverb.test.ts` | Heavier local STT coverage |
| Llama write | `test/test-cases/e2e/local/step-3-write-e2e/write-local/write-subcommand-local.test.ts`, `test/test-cases/e2e/local/step-3-write-e2e/write-local/write-project-lyrics.test.ts` | Local llama.cpp audio and project-text flows |
| Llamafile write | `test/test-cases/e2e/local/step-3-write-e2e/write-local/write-subcommand-llamafile.test.ts` | Local llamafile write (downloads the smallest `Qwen3.5-0.8B-Q8_0` bundle on first run) |
| Local TTS | `test/test-cases/e2e/local/step-4-tts-e2e/tts-local/kitten-tts.test.ts` | Standalone Kitten TTS coverage |
| Music lyric-video | `test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts` | Local FFmpeg/Whisper lyric-video rendering |

## Price Preflight

Local price and budget commands are now path-based:

```bash
bun t test/test-cases/e2e/local/step-2-stt-e2e/stt-local/whisper/ --price
bun t test/test-cases/e2e/local/step-2-stt-e2e/stt-local/reverb/ --price
bun t test/test-cases/e2e/local/step-3-write-e2e/write-local/write-subcommand-local.test.ts --price
bun t test/test-cases/e2e/local/step-3-write-e2e/write-local/write-project-lyrics.test.ts --price
bun t test/test-cases/e2e/local/step-3-write-e2e/write-local/write-subcommand-local.test.ts --budget 500
bun t test/test-cases/e2e/local/step-4-tts-e2e/tts-local/kitten-tts.test.ts --price
bun t test/test-cases/e2e/local/step-4-tts-e2e/tts-local/kitten-tts.test.ts --budget 500
bun t test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts --price
bun t test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts --budget 500
```

Notes:
- `--price` with no path filters resolves all mapped test price commands.
- `--budget` in normal mode applies its threshold independently to each matching `budgetedTest()` key; runnable estimates are not combined into an aggregate cap. Every component key must be mapped and successfully evaluated by preflight. An unmapped, malformed, or otherwise unevaluated key fails locally without executing the test callback or calling a provider.
- Local lyric-video rendering maps to local Whisper transcription price keys (`transcribe-whisper-tiny` and `transcribe-whisper-large-v3-turbo`); `music --audio` itself still rejects hosted-generation `--price`.
- Some local paths still have no mapped price commands, including `test/test-cases/validation/` and `test/test-cases/setup/`.

## Related Docs

- [Service Tests](service-tests.md)
- [Setup Service Tests](step-0-service-tests-setup.md)
- [extract](../commands/process-steps/step-2-extract/01-extract.md)
- [Write Command](../commands/process-steps/step-3-write/write-text.md)
- [TTS Command](../commands/process-steps/step-4-tts/text-to-speech-and-voice.md)
