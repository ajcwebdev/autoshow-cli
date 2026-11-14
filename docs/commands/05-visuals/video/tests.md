# Video Tests

Live Gemini/Grok tests use `GEMINI_API_KEY` or `XAI_API_KEY` and may incur charges. They validate decodable MP4s and metadata, not prompt adherence or perceptual quality. Local usage-error coverage is also available without provider calls.

Preflight the mapped commands without generation:

```bash
bun t test/test-cases/e2e/service/visuals/video/ --price
```

After the required spending authorization, omit `--price` to run that targeted directory. `--budget 2500` filters test keys above a 25¢ estimate; it does not cap cumulative spending.

See [testing](../../testing.md) and the [video guide](overview.md).
