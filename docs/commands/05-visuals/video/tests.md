# Video Service Tests

Live video generation for the `video` command: fal.ai, Gemini, and Grok. These `bun t` commands may call paid or quota-limited providers.

## Quick Start

```bash
bun t test/test-cases/e2e/service/visuals/video/
```

## Provider Env Vars

Live video generation tests need a configured provider key: `FAL_API_KEY`, `GEMINI_API_KEY`, or `XAI_API_KEY`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/visuals/video/ --price
bun t test/test-cases/e2e/service/visuals/video/ --budget 2500
```

## Related Docs

- [Testing Overview](../../testing.md)
- [Video Command](overview.md)
