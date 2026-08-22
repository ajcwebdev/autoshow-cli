# Step 5 Service Tests: Image

Provider-backed image-generation coverage for the `image` command.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Provider Env Vars](#provider-env-vars)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t test/test-cases/e2e/service/step-5-image-gen-e2e/
```

## Provider Env Vars

Live image generation tests run only when their provider key is configured: `BFL_API_KEY`, `FAL_API_KEY`, `GEMINI_API_KEY`, `LUMA_AGENTS_API_KEY`, `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, or `XAI_API_KEY`.

## Current Coverage

- Model-level service files under `test/test-cases/e2e/service/step-5-image-gen-e2e/` cover BFL (FLUX.2), fal.ai (HiDream, Qwen, Reve), Gemini, Grok, Luma Labs (Uni-1), OpenAI (`gpt-image-2`), and Replicate (Seedream, Qwen, Wan) using `defineImageServiceTest`, which runs live generation and asserts the generated image artifact plus its manifest metadata.
- Local validation files in that same directory (`bfl-validation.test.ts`, `lumalabs-validation.test.ts`) call no provider: they assert exit code 2 for unsupported flags and invalid `--size`, `--aspect-ratio`, and `--format` values.
- Zero-cost validation and contract coverage lives in `test/test-cases/validation/providers/image-provider-rest-contracts.test.ts` (mocked BFL, Luma Labs, and Replicate requests and downloads), `test/test-cases/validation/providers/fal-provider-contracts.test.ts` (mocked fal.ai image queue endpoints), and `test/test-cases/validation/providers/provider-selection-contracts/` (provider-specific flag acceptance/rejection and model capabilities).
- Focused `--price` validation lives in `test/test-cases/price-flag/image-price.test.ts`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-5-image-gen-e2e/ --price
bun t test/test-cases/e2e/service/step-5-image-gen-e2e/ --budget 2500
```

The mapped image price preflight covers BFL, fal.ai, Gemini, Grok, Luma Labs, OpenAI, and Replicate generation files. Validation-only files (`bfl-validation.test.ts`, `lumalabs-validation.test.ts`) do not resolve mapped price commands.

## Related Docs

- [Testing Overview](../../testing.md)
- [Image Command](text-to-image.md)
