# TTS Tests

Local contracts cover selection, provider payloads, control rejection, delivery, and retained-audio recovery:

```bash
bun test test/test-cases/validation/audio/tts/tts-provider-contracts/
```

Live synthesis covers ElevenLabs v3/v4, Grok, and OpenAI. Inworld has local target-selection coverage and a price estimate. Live cases require the matching API key, media tools, and local Whisperfile `small.en` before synthesis. They check decoding, recorded provider/model/voice, and approximate transcript agreement; they do not establish perceptual quality.

Preflight the selected service tests before any paid run:

```bash
bun t test/test-cases/e2e/service/audio/tts/ --price
```

After satisfying the [spending rules](../../../../AGENTS.md#paid-providers), run the same command without `--price`. Runner `--budget 2500` filters individual test keys above 25¢; it is not a cumulative spending cap.

See [testing](../../testing.md) and the [TTS command](overview.md).
