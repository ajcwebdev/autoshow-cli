# Image Service Tests

Live image generation for the `image` command: fal.ai, Gemini, Grok, Luma Labs, OpenAI, and Replicate. These `bun t` commands may call paid or quota-limited providers.

## Quick Start

```bash
bun t test/test-cases/e2e/service/visuals/image/
```

## Provider Env Vars

Live image generation tests need a configured provider key: `FAL_API_KEY`, `GEMINI_API_KEY`, `LUMA_AGENTS_API_KEY`, `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, or `XAI_API_KEY`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/visuals/image/ --price
bun t test/test-cases/e2e/service/visuals/image/ --budget 2500
```

## Related Docs

- [Testing Overview](../../testing.md)
- [Image Command](overview.md)
