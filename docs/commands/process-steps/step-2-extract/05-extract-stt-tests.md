# Step 2 Tests: STT

Local Whisper and Whisperfile coverage plus hosted speech-to-text and URL transcript coverage for the extract STT route.

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
bun t test/test-cases/e2e/local/step-2-stt-e2e/stt-local/whisper/
bun t test/test-cases/e2e/local/step-2-stt-e2e/stt-local/whisperfile/

# hosted STT service coverage
bun t test/test-cases/e2e/service/step-2-stt-e2e/stt-services/
```

## Local Coverage

- `test/test-cases/e2e/local/step-2-stt-e2e/stt-local/whisper/` covers default Whisper transcription, per-model (`tiny`/`base`) runs, `--split`, and `large-v3-turbo`.
- `test/test-cases/e2e/local/step-2-stt-e2e/stt-local/whisperfile/` covers local Mozilla whisperfile STT (downloads a prebuilt `tiny` whisperfile on first run).

## Service Coverage

- Model-level service files under `test/test-cases/e2e/service/step-2-stt-e2e/stt-services/` cover live transcription for AssemblyAI, Deepgram, DeepInfra, Gemini, Gladia, Grok, Groq, Mistral, Rev, ScrapeCreators, Soniox, Speechmatics, Supadata, and Together.
- Dedicated URL transcript files (`scrapecreators-youtube-transcript.test.ts`, `supadata-auto-url-transcript.test.ts`) cover hosted URL-to-transcript scenarios.
- Zero-cost validation and contract coverage lives in `test/test-cases/validation/extract-stt/`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-2-stt-e2e/stt-services/ --price
bun t test/test-cases/e2e/service/step-2-stt-e2e/stt-services/ --budget 2500
bun t test/test-cases/e2e/local/step-2-stt-e2e/stt-local/whisper/ --price
```

The mapped STT price preflight covers model-level STT service files plus ScrapeCreators and Supadata URL transcript scenarios.

## Related Docs

- [Testing Overview](../../testing.md)
- [extract STT](02-extract-stt.md)
