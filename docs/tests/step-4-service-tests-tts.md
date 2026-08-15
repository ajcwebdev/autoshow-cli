# Step 4 Service Tests: TTS

Provider-backed text-to-speech coverage for the `tts` command plus the service-side Kitten pipeline flow.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t test/test-cases/e2e/service/step-4-tts-e2e/tts-services/
```

## Current Coverage

- Model-level service files under `test/test-cases/e2e/service/step-4-tts-e2e/tts-services/` cover Cartesia, Deepgram, ElevenLabs, Gemini, Grok, Groq, Hume, MiniMax, Mistral, OpenAI, and Speechify, gated by their respective provider keys. The shared `defineTTSServiceTest` helper covers invalid model rejection and synthesis.
- Mocked provider contract validation under `test/test-cases/validation/providers/tts-provider-contracts/` covers ElevenLabs Instant Voice Cloning (IVC), OpenAI preset-only parameters, Grok normalization/custom voice IDs, Groq English voice defaults, MiniMax synthesis controls, Hume Octave payloads, and Cartesia byte requests.
- Mistral live coverage exercises reference audio via `input/examples/audio/anthony-voice.mp3`; Speechify live coverage asserts the default speaker; Kitten TTS pipeline coverage (`kitten-tts-pipeline.test.ts`) verifies root `write` pipeline integration with multi-provider speech artifacts.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-4-tts-e2e/tts-services/ --price
bun t test/test-cases/e2e/service/step-4-tts-e2e/tts-services/ --budget 2500
```

ElevenLabs IVC, Speechify custom voice, Hume, and Cartesia provide side-effect-free price coverage. Setup cost (0 cents) and setup time (10,000 ms) are attached to initial clone and custom-voice targets.

The Kitten pipeline mapping is selected via `bun t test/test-cases/e2e/service/step-4-tts-e2e/tts-services/kitten-tts-pipeline.test.ts --price`.

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [TTS Command](../commands/process-steps/step-4-tts/text-to-speech-and-voice.md)
