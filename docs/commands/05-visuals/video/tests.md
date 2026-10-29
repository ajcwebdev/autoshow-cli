# Video Service Tests

Live video generation for the `video` command: Gemini and Grok. The tests validate decodable MP4 artifacts and recorded metadata, not prompt adherence or perceptual quality. The directory also includes local usage-error coverage. Test execution may call paid or quota-limited providers.

## Quick Start

```bash
bun t test/test-cases/e2e/service/visuals/video/
```

## Provider Env Vars

Live video generation tests need a configured provider key: `GEMINI_API_KEY` or `XAI_API_KEY`.

## Price Preflight

Estimate the mapped generation commands without running the tests:

```bash
bun t test/test-cases/e2e/service/visuals/video/ --price
```

Run tests whose mapped estimates are at most 25¢ per test key. This filter does not cap cumulative spending:

```bash
bun t test/test-cases/e2e/service/visuals/video/ --budget 2500
```

## Related Docs

- [Testing Overview](../../testing.md)
- [Video Command](overview.md)
