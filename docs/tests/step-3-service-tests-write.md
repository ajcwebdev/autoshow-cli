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
- The suite uses `defineLLMWriteTest` to verify service-backed write runs, output artifacts, and canonical item `metadata.step3` when provider API keys are configured (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `MINIMAX_API_KEY`, `XAI_API_KEY`, `GLM_API_KEY`, `KIMI_API_KEY`). Unconfigured providers are skipped automatically.
- No-cost REST contract coverage under `test/test-cases/validation/providers/` (`openai-rest-contracts/response-chat-contracts.test.ts`, `anthropic-rest-contracts.test.ts`, `gemini-rest-contracts.test.ts`) verifies Together model mapping, Cerebras public model IDs (`gpt-oss-120b`, `zai-glm-4.7`), bearer auth, structured-output routing, and canonical `metadata.step3` without calling provider APIs.
- Local write and price validation live in `test/test-cases/e2e/local/step-3-write-e2e/write-local/` and `test/test-cases/price-flag/write-price.test.ts`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-3-write-e2e/write-services/ --price
bun t test/test-cases/e2e/service/step-3-write-e2e/write-services/ --budget 2500
```

The directory-wide `--price` selection resolves OpenAI, Anthropic, Gemini, Groq, MiniMax, Grok, GLM, and Kimi price mappings. Unit pricing contracts cover Together serverless and Cerebras public endpoint estimates.

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [Write Command](../commands/process-steps/step-3-write/write-text.md)
