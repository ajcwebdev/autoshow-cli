# Step 4 Service Tests: TTS

Provider-backed text-to-speech coverage for the `tts` command.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Provider Env Vars](#provider-env-vars)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t test/test-cases/e2e/service/step-4-tts-e2e/tts-services/
```

## Provider Env Vars

Live TTS synthesis tests need the matching provider key: `CARTESIA_API_KEY`, `ELEVENLABS_API_KEY`, `XAI_API_KEY`, `HUME_API_KEY`, `INWORLD_API_KEY`, `MISTRAL_API_KEY`, `OPENAI_API_KEY`, or `SPEECHIFY_API_KEY`. A missing key fails that test rather than skipping it, so only over-budget selections are skipped.

## Current Coverage

- Live synthesis files under `test/test-cases/e2e/service/step-4-tts-e2e/tts-services/` are historical or explicitly approved provider tests. The active TTS registry contains ElevenLabs, Grok, Mistral, OpenAI, Speechify, Hume, Cartesia, and Inworld; routine verification never runs live provider synthesis.
- The Inworld file in that directory does not call providers. `mistral-validation.test.ts` covers invalid-model rejection locally.
- Zero-cost validation lives in `test/test-cases/validation/providers/tts-provider-contracts/` and `test/test-cases/validation/cli/option-resolution-contracts/tts-custom-voices/`.
- Focused `--price` validation lives in `test/test-cases/price-flag/tts-price/`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-4-tts-e2e/tts-services/ --price
bun t test/test-cases/e2e/service/step-4-tts-e2e/tts-services/ --budget 2500
```

The mapped TTS price preflight covers the active synthesis files, including the local no-call Inworld price case. Retired provider rates remain available only for historical report inspection.

## Related Docs

- [Testing Overview](../../testing.md)
- [TTS Command](text-to-speech-and-voice.md)
