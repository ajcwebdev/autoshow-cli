# Write Service Tests

Provider-backed LLM coverage for the `write` command: OpenAI, Anthropic, Gemini, and Grok. These `bun t` commands may call paid or quota-limited providers.

## Quick Start

```bash
bun t test/test-cases/e2e/service/text/write/
```

## Provider Env Vars

Live write tests need the matching provider key: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, or `XAI_API_KEY`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/text/write/ --price
bun t test/test-cases/e2e/service/text/write/ --budget 2500
```

## Related Docs

- [Testing Overview](../testing.md)
- [Write Command](overview.md)
