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

Live video generation tests run only when their provider key is configured: `FAL_API_KEY`, `GEMINI_API_KEY`, `LTXV_API_KEY`, `REPLICATE_API_TOKEN`, or `XAI_API_KEY`.

## Current Coverage

- Model-level service files under `test/test-cases/e2e/service/step-6-video-gen-e2e/` cover fal.ai, Gemini, Grok, LTX, and Replicate using `defineVideoServiceTest`, which runs live generation and asserts the rendered `generated-video.mp4` artifact plus its manifest metadata.
- Zero-cost validation and contract coverage lives in `test/test-cases/validation/providers/video-provider-contracts/` (mocked Gemini, Grok, LTX, Luma Labs, and Replicate requests), `test/test-cases/validation/providers/fal-provider-contracts.test.ts`, `test/test-cases/validation/providers/provider-selection-contracts/`, and `test/test-cases/validation/cli/option-resolution-contracts/video-options.test.ts` for model/provider rejection and option validation.
- Focused `--price` validation lives in `test/test-cases/price-flag/video-price.test.ts`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-6-video-gen-e2e/ --price
bun t test/test-cases/e2e/service/step-6-video-gen-e2e/ --budget 2500
```

The mapped video price preflight covers fal.ai, Gemini, Grok, LTX, and Replicate generation files.

## Related Docs

- [Testing Overview](../../testing.md)
- [Video](text-to-video-services.md)
