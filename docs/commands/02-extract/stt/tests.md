# STT Tests

Local whisperfile and hosted speech-to-text coverage. Hosted tests may call paid or quota-limited providers. The whisperfile e2e tests run local inference but download their audio fixture and require the selected runtime and models.

## Quick Start

```bash
bun t test/test-cases/e2e/local/stt/whisperfile/

bun t test/test-cases/e2e/service/stt/
```

## Price Preflight

```bash
bun t test/test-cases/e2e/service/stt/ --price
```

`--price` estimates cost without transcribing. The following command executes tests whose estimated cost per test key is at most $0.25; it does not cap total spending:

```bash
bun t test/test-cases/e2e/service/stt/ --budget 2500
```

No-cost contract checks are in `test/test-cases/validation/stt/`. Passing artifact and fixture-text checks does not establish comprehensive transcription or speaker accuracy.

## Related Docs

- [Testing Overview](../../testing.md)
- [extract STT](overview.md)
