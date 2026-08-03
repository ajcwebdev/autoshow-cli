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
- The suite uses `defineLLMWriteTest` to verify service-backed write runs, output artifacts, and `run.json` step 3 metadata when the required API key is configured.
- Current live service providers are OpenAI, Anthropic, Gemini, Groq, MiniMax, Grok, GLM, and Kimi. The GLM case covers `--llm glm=glm-5.1` and requires `GLM_API_KEY`; the Kimi case covers `--llm kimi=kimi-k2.6` and requires `KIMI_API_KEY`.
- No-cost REST contract coverage verifies Together model mapping, Cerebras public model IDs (`gpt-oss-120b`, `zai-glm-4.7`), bearer auth, structured-output routing, and `run.json` step 3 metadata without calling provider APIs.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-3-write-e2e/write-services/ --price
bun t test/test-cases/e2e/service/step-3-write-e2e/write-services/ --budget 2500
```

The directory-wide `--price` selection resolves OpenAI, Anthropic, Gemini, Groq, MiniMax, Grok, GLM, and Kimi price mappings. Unit pricing contracts cover Together serverless estimates and Cerebras public endpoint estimates. Live service tests skip providers whose API key is not configured.

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [Write Command](../commands/process-steps/step-3-write/write-text.md)
