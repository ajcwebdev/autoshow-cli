# Step 4 Service Tests: TTS

Provider-backed text-to-speech coverage for the `tts` command.

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

- Model-level service files under `test/test-cases/e2e/service/step-4-tts-e2e/tts-services/` cover live synthesis for Cartesia, Deepgram, ElevenLabs, Gemini, Grok, Groq, Hume, MiniMax, Mistral, OpenAI, and Speechify. Each model test needs its provider API key (`CARTESIA_API_KEY`, `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `GROQ_API_KEY`, `HUME_API_KEY`, `MINIMAX_API_KEY`, `MISTRAL_API_KEY`, `OPENAI_API_KEY`, `SPEECHIFY_API_KEY`); a missing key fails that test rather than skipping it, so only over-budget selections are skipped. The shared `defineTTSServiceTest` helper asserts a non-empty `speech.wav` plus the canonical `tts` record (service, model, speaker, audio file name). The DeepInfra and Inworld files in the same directory only assert target collection and serve as price-registry anchors, and invalid-model rejection is Mistral-specific in `mistral-validation.test.ts`.
- Mocked provider contract validation under `test/test-cases/validation/providers/tts-provider-contracts/` covers MiniMax synthesis controls, Deepgram lossless-WAV query parameters, Hume Octave payloads, Cartesia byte requests, Mistral reference-audio conversion, ElevenLabs output format/voice settings/chunking, OpenAI instructions/speed and typed custom voice objects, Grok normalization/custom voice IDs, Groq English voice defaults, Speechify chunked JSON and custom voice creation, and the hosted TTS chunk scheduler. ElevenLabs Instant Voice Cloning (IVC) coverage lives under `test/test-cases/validation/cli/option-resolution-contracts/tts-custom-voices/`.
- Mistral live coverage exercises reference audio via `input/examples/audio/anthony-voice.mp3`; Speechify live coverage asserts the default speaker.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-4-tts-e2e/tts-services/ --price
bun t test/test-cases/e2e/service/step-4-tts-e2e/tts-services/ --budget 2500
```

Every model-level file in that directory maps to a side-effect-free `--price` command in `test/test-runner/price-commands/registry/tts.ts`. Replicate and Fal TTS price mappings are anchored to their adapter-contract files under `test/test-cases/validation/media-generation/`.

## Related Docs

- [Testing Overview](../../testing.md)
- [TTS Command](text-to-speech-and-voice.md)
