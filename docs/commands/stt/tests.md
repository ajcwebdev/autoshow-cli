# STT Tests

Local whisperfile coverage plus hosted speech-to-text and URL transcript coverage for the extract STT route.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Local Coverage](#local-coverage)
- [Service Coverage](#service-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
# local STT coverage
bun t test/test-cases/e2e/local/stt/whisperfile/

# hosted STT service coverage
bun t test/test-cases/e2e/service/stt/
```

## Local Coverage

- `test/test-cases/e2e/local/stt/whisperfile/` covers tiny, tiny.en, small, small.en, omitted provider/model defaults, and `--split`.

## Service Coverage

Hosted tests use `diarization/`, `diarization-off-by-default/`, and `direct-url/` subgroups beneath `test/test-cases/e2e/service/stt/`. Select any subgroup independently; local provider tests live directly under `test/test-cases/e2e/local/stt/`.

- Files under `test/test-cases/e2e/service/stt/` cover live transcription for AssemblyAI, Deepgram, DeepInfra, Gemini, Gladia, Grok, Mistral, ScrapeCreators, Soniox, Speechmatics, Supadata, and Together, including ScrapeCreators and Supadata URL-to-transcript scenarios.
- Zero-cost validation lives in `test/test-cases/validation/stt/`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/stt/ --price
bun t test/test-cases/e2e/service/stt/ --budget 2500
bun t test/test-cases/e2e/local/stt/whisperfile/ --price
```

## Related Docs

- [Testing Overview](../testing.md)
- [extract STT](overview.md)
