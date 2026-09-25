# TTS Service Tests

Provider-backed text-to-speech coverage for the `tts` command: ElevenLabs, Grok, Inworld, Mistral, OpenAI, and Speechify. These `bun t` commands may call paid or quota-limited providers.

## Quick Start

```bash
bun t test/test-cases/e2e/service/audio/tts/
```

## Provider Env Vars

Live TTS synthesis tests need the matching provider key: `ELEVENLABS_API_KEY`, `XAI_API_KEY`, `INWORLD_API_KEY`, `MISTRAL_API_KEY`, `OPENAI_API_KEY`, or `SPEECHIFY_API_KEY`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/audio/tts/ --price
bun t test/test-cases/e2e/service/audio/tts/ --budget 2500
```

## Related Docs

- [Testing Overview](../../testing.md)
- [TTS Command](overview.md)
