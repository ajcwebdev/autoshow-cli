# STT Tests

Local whisperfile coverage plus hosted speech-to-text coverage for `extract`.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Quick Start

```bash
bun t test/test-cases/e2e/local/stt/whisperfile/

bun t test/test-cases/e2e/service/stt/
```
## Coverage

- Local e2e covers whisperfile transcription for tiny, tiny.en, small, and small.en, including `--split`.
- Hosted e2e covers live transcription for AssemblyAI, Deepgram, DeepInfra, Gemini, Gladia, Grok, Mistral, OpenAI, Soniox, Speechmatics, and Together.
- Zero-cost validation is in `test/test-cases/validation/stt/`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/stt/ --price
bun t test/test-cases/e2e/service/stt/ --budget 2500
```
## Related Docs

- [Testing Overview](../../testing.md)
- [extract STT](overview.md)
