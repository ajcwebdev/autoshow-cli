# STT Tests

No-cost contracts live in `test/test-cases/validation/stt/`. Local inference requires installed Whisperfile models; its e2e fixture may download:

```bash
bun t test/test-cases/e2e/local/stt/whisperfile/
```

Preflight hosted coverage before spending:

```bash
bun t test/test-cases/e2e/service/stt/ --price
```

Removing `--price` executes paid/quota-limited tests. `--budget 2500` filters test keys estimated at no more than $0.25 each; it does not cap the total. Apply [testing and spending rules](../../testing.md), including full-suite approval. Artifact/fixture-text checks do not prove comprehensive speech or speaker accuracy.
