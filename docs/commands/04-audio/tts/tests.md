# TTS Service Tests

Live synthesis coverage for the `tts` command includes ElevenLabs, Grok, and OpenAI. Inworld has local target-selection coverage and a price estimate only. Commands below can incur provider charges except in `--price` mode.

## Quick Start

```bash
bun t test/test-cases/e2e/service/audio/tts/
```

## Provider Env Vars

Live synthesis needs the matching key: `ELEVENLABS_API_KEY`, `XAI_API_KEY`, or `OPENAI_API_KEY`. It also requires installed media tools and the local Whisperfile `small.en` model before synthesis. Tests validate decodable audio, provider/model/voice metadata, and approximate spoken-text agreement; they do not establish perceptual quality.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/audio/tts/ --price
```

`--price` estimates mapped commands without synthesis. `--budget 2500` runs the tests after excluding budgeted test keys estimated above 25¢; it is not a total spending cap.

```bash
bun t test/test-cases/e2e/service/audio/tts/ --budget 2500
```

## Related Docs

- [Testing Overview](../../testing.md)
- [TTS Command](overview.md)
