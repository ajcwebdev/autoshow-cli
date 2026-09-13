# Video Service Tests

Provider-backed video-generation coverage for the `video` command.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Quick Start

```bash
bun t test/test-cases/e2e/service/visuals/video/
```

## Provider Env Vars

Live video generation tests need a configured provider key: `FAL_API_KEY`, `GEMINI_API_KEY`, `LTXV_API_KEY`, `REPLICATE_API_TOKEN`, or `XAI_API_KEY`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/visuals/video/ --price
bun t test/test-cases/e2e/service/visuals/video/ --budget 2500
```

`test/test-cases/price-flag/visuals/video/video-price.test.ts` covers `--price` validation without calling providers.

## Related Docs

- [Testing Overview](../../testing.md)
- [Video Command](overview.md)
