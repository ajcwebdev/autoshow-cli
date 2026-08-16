# Step 6 Service Tests: Video

Provider-backed validation, price coverage, and optional live generation coverage for the `video` command.

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

Live video generation tests run only when their provider key is configured: `FAL_API_KEY`, `GEMINI_API_KEY`, `GLM_API_KEY`, `LTXV_API_KEY`, `LUMA_AGENTS_API_KEY`, `MINIMAX_API_KEY`, `REPLICATE_API_TOKEN`, `RUNWAYML_API_SECRET`, or `XAI_API_KEY`.

## Current Coverage

- Model-level service files under `test/test-cases/e2e/service/step-6-video-gen-e2e/` cover fal.ai, Gemini, GLM, Grok, LTX, MiniMax, Replicate, and Runway using `defineVideoServiceTest` for model/provider rejection, option validation, and live generation.
- Zero-cost validation and contract coverage lives in `test/test-cases/validation/providers/video-provider-contracts/` (mocked Gemini, GLM, Grok, LTX, Luma Labs, MiniMax, Replicate, and Runway requests), `test/test-cases/validation/providers/fal-provider-contracts.test.ts`, and `test/test-cases/validation/providers/provider-selection-contracts/`.
- Focused `--price` validation lives in `test/test-cases/price-flag/video-price.test.ts`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-6-video-gen-e2e/ --price
bun t test/test-cases/e2e/service/step-6-video-gen-e2e/ --budget 2500
```

The mapped video price preflight covers fal.ai, Gemini, GLM, Grok, LTX, MiniMax, Replicate, and Runway generation files.

## Related Docs

- [Testing Overview](../../testing.md)
- [Video](text-to-video-services.md)
