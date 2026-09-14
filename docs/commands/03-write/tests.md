# Write Service Tests

Provider-backed LLM coverage for the `write` command: Gemini, GLM, Kimi, and Together.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Quick Start

```bash
bun t test/test-cases/e2e/service/text/write/
```

## Provider Env Vars

Live write tests need the matching provider key: `GEMINI_API_KEY`, `GLM_API_KEY`, `KIMI_API_KEY`, or `TOGETHER_API_KEY`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/text/write/ --price
bun t test/test-cases/e2e/service/text/write/ --budget 2500
```

`test/test-cases/price-flag/text/write/write-price.test.ts` covers `--price` validation without calling providers.

## Related Docs

- [Testing Overview](../testing.md)
- [Write Command](overview.md)
