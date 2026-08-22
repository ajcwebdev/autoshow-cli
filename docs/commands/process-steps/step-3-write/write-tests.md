# Step 3 Service Tests: Write

Provider-backed LLM coverage for the `write` command.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Quick Start

```bash
bun t test/test-cases/e2e/service/step-3-write-e2e/write-services/
```

## Provider Env Vars

Live write tests need the matching provider key: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `MINIMAX_API_KEY`, `XAI_API_KEY`, `GLM_API_KEY`, or `KIMI_API_KEY`.

## Current Coverage

- `test/test-cases/e2e/service/step-3-write-e2e/write-services/` covers live write runs for OpenAI, Anthropic, Gemini, Groq, MiniMax, Grok, GLM, and Kimi.
- `test/test-cases/price-flag/write-price.test.ts` covers `--price` validation.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-3-write-e2e/write-services/ --price
bun t test/test-cases/e2e/service/step-3-write-e2e/write-services/ --budget 2500
```

## Related Docs

- [Testing Overview](../../testing.md)
- [Write Command](write-text.md)
