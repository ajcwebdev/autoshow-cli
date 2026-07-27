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

Live image generation tests run only when their provider key is configured: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `BFL_API_KEY`, `RECRAFT_API_TOKEN`, `REPLICATE_API_TOKEN`, or `LUMA_AGENTS_API_KEY`.

## Current Coverage

- The shared `defineImageServiceTest` helper covers invalid model rejection, real generation, and metadata checks when the required API key is configured. `--price` coverage is mapped through the test-runner price registry and focused price-flag tests.
- OpenAI coverage is split across `openai-gpt-image-2.test.ts` and `openai-gpt-image-2-pipeline.test.ts`; it includes `gpt-image-2` low-quality `1024x1536` generation and `write` pipeline integration with `--image openai=...`. Multi-provider `--price` output is covered by `test/test-cases/price-flag/image-price.test.ts`.
- `gemini-image-gen.test.ts` covers native Gemini image generation and shared image options.
- BFL coverage is split across FLUX.2 generation files plus `bfl-validation.test.ts` for unsupported flag and invalid size validation. Validation and mocked REST contracts cover numbered `--image-input` reference fields, polling/download handling, and output extension handling.
- `test/test-cases/validation/providers/provider-selection-contracts/` covers provider-specific shared image flag acceptance and rejection, including BFL input; Reve aspect ratio, fit-within size, format, and input count; Recraft count, size/aspect, SVG/vector extension, and unsupported flag validation; Luma Labs aspect ratio, format, and input count; and Replicate per-model-family controls.
- `test/test-cases/validation/providers/image-provider-rest-contracts.test.ts` covers mocked BFL, Reve, Recraft, and Replicate request payloads and download handling without calling hosted providers.
- Recraft live e2e coverage uses `recraft-recraftv4_1-vector.test.ts` for SVG/vector output; `recraft-validation.test.ts` is local validation of unsupported shared flags.
- Grok coverage is split across `grok-imagine-image.test.ts` and `grok-imagine-image-quality.test.ts` for generation, `--image-aspect-ratio`, and `--image-size`.
- Replicate live e2e coverage uses `replicate-image.test.ts` for Seedream, Qwen, and Wan model generation with shared size, aspect-ratio, and format options.
- Luma Labs live e2e coverage uses `lumalabs-uni-1.test.ts` and `lumalabs-uni-1-max.test.ts` for text-to-image generation; `lumalabs-validation.test.ts` is local validation of unsupported shared flags.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-5-image-gen-e2e/ --test-price
bun t test/test-cases/e2e/service/step-5-image-gen-e2e/ --budget 2500
```

Step 5 generation files for OpenAI, Gemini, Grok, BFL, Recraft, and Replicate resolve mapped price commands. Replicate's six live model cases use the same model-specific options during price preflight as they do during generation. Luma Labs generation files are not mapped in the price registry, and validation-only files such as `bfl-validation.test.ts`, `recraft-validation.test.ts`, and `lumalabs-validation.test.ts` do not resolve mapped price commands.

## Related Docs

- [Service Tests](service-tests.md)
- [Image Command](../commands/process-steps/step-5-image/text-to-image.md)
