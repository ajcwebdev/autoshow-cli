# Step 6 Service Tests: Video

Provider-backed video-generation coverage for the `video` command.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Provider Env Vars](#provider-env-vars)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t test/test-cases/e2e/service/step-6-video-gen-e2e/
```

## Provider Env Vars

Live video generation tests need a configured provider key: `FAL_API_KEY`, `GEMINI_API_KEY`, `LTXV_API_KEY`, `REPLICATE_API_TOKEN`, or `XAI_API_KEY`.

## Current Coverage

- Model-level service files under `test/test-cases/e2e/service/step-6-video-gen-e2e/` cover live generation for fal.ai, Gemini, Grok, LTX, and Replicate.
- Focused `--price` validation lives in `test/test-cases/price-flag/video-price.test.ts`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-6-video-gen-e2e/ --price
bun t test/test-cases/e2e/service/step-6-video-gen-e2e/ --budget 2500
```

## Related Docs

- [Testing Overview](../../testing.md)
- [Video](text-to-video-services.md)
