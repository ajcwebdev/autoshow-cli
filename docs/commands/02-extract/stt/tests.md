# STT Tests

Local whisperfile coverage, plus hosted speech-to-text for AssemblyAI, Deepgram, DeepInfra, Gemini, Gladia, Grok, Mistral, OpenAI, Soniox, Speechmatics, and Together. The hosted command may call paid or quota-limited providers.

## Quick Start

```bash
bun t test/test-cases/e2e/local/stt/whisperfile/

bun t test/test-cases/e2e/service/stt/
```

## Price Preflight

```bash
bun t test/test-cases/e2e/service/stt/ --price
bun t test/test-cases/e2e/service/stt/ --budget 2500
```

No-cost checks are in `test/test-cases/validation/stt/`.

## Related Docs

- [Testing Overview](../../testing.md)
- [extract STT](overview.md)
