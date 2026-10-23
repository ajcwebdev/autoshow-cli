# Image Service Tests

Live image generation for the `image` command: Gemini, Grok, and OpenAI. These `bun t` commands may call paid or quota-limited providers.

## Quick Start

```bash
bun t test/test-cases/e2e/service/visuals/image/
```

## Provider Env Vars

Live image generation tests need a configured provider key: `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `XAI_API_KEY`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/visuals/image/ --price
bun t test/test-cases/e2e/service/visuals/image/ --budget 2500
```

## Related Docs

- [Testing Overview](../../testing.md)
- [Image Command](overview.md)
