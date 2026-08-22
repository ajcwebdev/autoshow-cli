# Step 3 Service Tests: Write

Provider-backed LLM coverage for the `write` command.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t test/test-cases/e2e/service/step-3-write-e2e/write-services/
```

## Current Coverage

- Provider-backed write coverage lives in model-level files under `test/test-cases/e2e/service/step-3-write-e2e/write-services/`.
- The suite uses `defineLLMWriteTest` to verify service-backed write runs, output artifacts, and canonical item `metadata.step3`. Each model test needs its provider API key (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `MINIMAX_API_KEY`, `XAI_API_KEY`, `GLM_API_KEY`, `KIMI_API_KEY`); a missing key fails that test rather than skipping it, so only over-budget selections are skipped.
- No-cost REST contract coverage under `test/test-cases/validation/providers/` verifies write request shapes without calling provider APIs: `openai-rest-contracts/response-chat-contracts.test.ts` covers Together model mapping, Cerebras public model IDs (`gpt-oss-120b`, `zai-glm-4.7`), bearer auth, structured-output routing, and canonical `metadata.step3`, while `anthropic-rest-contracts.test.ts` and the `gemini-rest-{core,extraction,generated-media}-contracts.test.ts` suites cover their own request headers, structured-output config, and error propagation.
- Local write and price validation live in `test/test-cases/e2e/local/step-3-write-e2e/write-local/` and `test/test-cases/price-flag/write-price.test.ts`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-3-write-e2e/write-services/ --price
bun t test/test-cases/e2e/service/step-3-write-e2e/write-services/ --budget 2500
```

The directory-wide `--price` selection resolves OpenAI, Anthropic, Gemini, Groq, MiniMax, Grok, GLM, and Kimi price mappings. Unit pricing contracts cover Together serverless and Cerebras public endpoint estimates.

## Related Docs

- [Testing Overview](../../testing.md)
- [Write Command](write-text.md)
