# Step 5 Service Tests: Image

Provider-backed image-generation coverage for the `image` command.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Quick Start

```bash
bun t test/test-cases/e2e/service/step-5-image-gen-e2e/
```

## Provider Env Vars

Live image generation tests run only when their provider key is configured: `BFL_API_KEY`, `FAL_API_KEY`, `GEMINI_API_KEY`, `LUMA_AGENTS_API_KEY`, `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, or `XAI_API_KEY`.

## Current Coverage

- `test/test-cases/e2e/service/step-5-image-gen-e2e/` covers live generation for BFL, fal.ai, Gemini, Grok, Luma Labs, OpenAI, and Replicate.
- `test/test-cases/price-flag/image-price.test.ts` covers `--price` validation.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-5-image-gen-e2e/ --price
bun t test/test-cases/e2e/service/step-5-image-gen-e2e/ --budget 2500
```

## Related Docs

- [Testing Overview](../../testing.md)
- [Image Command](text-to-image.md)
