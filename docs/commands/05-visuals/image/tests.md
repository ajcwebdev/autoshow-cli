# Image Tests

Live image tests use `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `XAI_API_KEY` and may incur charges. They check decoding, requested aspect ratios, and model metadata; they do not establish prompt fidelity or perceptual quality.

Preflight without generation:

```bash
bun t test/test-cases/e2e/service/visuals/image/ --price
```

After the required spending authorization, omit `--price` to run that targeted directory. `--budget 2500` filters test keys above a 25¢ estimate; it is not a cumulative spending cap. Local usage-error coverage is also available without provider calls.

See [testing](../../testing.md) and the [image guide](overview.md).
