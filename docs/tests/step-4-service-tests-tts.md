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

- The shared `defineTTSServiceTest` helper covers invalid model rejection and real synthesis when the required API key is configured; `--price` coverage comes from the test-runner price-command registry mappings.
- Model-level service files currently cover Deepgram, Gemini, Groq, Grok, ElevenLabs, Mistral, MiniMax, Speechify, Hume, Cartesia, and OpenAI. The Kitten flow is covered through the service-side write pipeline.
- ElevenLabs Instant Voice Cloning has mocked validation coverage for IVC creation, shared clone reuse across selected ElevenLabs models, verification-required failures, metadata, API error handling, and setup estimates.
- OpenAI TTS supports preset-voice synthesis only (`--tts-voice`, `--tts-instructions`, `--tts-speed`); custom voice creation/cloning was removed.
- `test/test-cases/validation/providers/tts-provider-contracts/` covers OpenAI instructions/speed, Grok language/text-normalization and custom voice IDs, Groq English default voice selection, MiniMax synthesis controls, Hume Octave file requests and voice payloads, Cartesia byte synthesis requests, and provider-specific mocked request metadata.
- Mistral live coverage is gated by `MISTRAL_API_KEY`; both the saved-voice test (`--tts-ref-audio` + `--tts-voice-name`, creating a saved voice) and the reference-audio synthesis test use the committed `input/examples/audio/anthony-voice.mp3` fixture.
- MiniMax live coverage is gated by `MINIMAX_API_KEY` and uses hosted/preset voice IDs.
- Speechify live coverage is gated by `SPEECHIFY_API_KEY`; the test passes `--tts-voice` and asserts the default `george` speaker.
- Hume and Cartesia have provider-contract, option/config/help, side-effect-free price coverage, and model-level service e2e files gated by their provider keys.
- `test/test-cases/e2e/service/step-4-tts-e2e/tts-services/kitten-tts-pipeline.test.ts` covers the root `write` pipeline with Groq plus Kitten TTS and multi-provider speech artifacts when OpenAI TTS is also enabled.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-4-tts-e2e/tts-services/ --price
bun t test/test-cases/e2e/service/step-4-tts-e2e/tts-services/ --budget 2500
```

ElevenLabs IVC, Speechify custom voice, Hume, and Cartesia have side-effect-free price coverage. ElevenLabs IVC adds a 0 cent setup cost and 10000 ms setup time to the first ElevenLabs clone target. Speechify custom voice adds a 0 cent setup cost and 10000 ms setup time to the first Speechify custom-voice target.

The Kitten pipeline mapping is selected with `bun t test/test-cases/e2e/service/step-4-tts-e2e/tts-services/kitten-tts-pipeline.test.ts --price`; budget preflight still maps the live e2e file.

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [TTS Command](../commands/process-steps/step-4-tts/text-to-speech.md)
