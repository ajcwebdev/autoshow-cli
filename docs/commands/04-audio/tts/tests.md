# TTS Service Tests

Provider-backed text-to-speech coverage for the `tts` command: Cartesia, ElevenLabs, Grok, Hume, Inworld, Mistral, OpenAI, and Speechify.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Quick Start

```bash
bun t test/test-cases/e2e/service/audio/tts/
```
## Provider Env Vars

Live TTS synthesis tests need the matching provider key: `CARTESIA_API_KEY`, `ELEVENLABS_API_KEY`, `XAI_API_KEY`, `HUME_API_KEY`, `INWORLD_API_KEY`, `MISTRAL_API_KEY`, `OPENAI_API_KEY`, or `SPEECHIFY_API_KEY`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/audio/tts/ --price
bun t test/test-cases/e2e/service/audio/tts/ --budget 2500
```
`test/test-cases/price-flag/audio/tts/tts-price/` covers `--price` validation without calling providers.

## Related Docs

- [Testing Overview](../../testing.md)
- [TTS Command](overview.md)
