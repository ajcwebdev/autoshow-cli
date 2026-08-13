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

Live video generation tests run only when their provider key is configured: `GEMINI_API_KEY`, `MINIMAX_API_KEY`, `GLM_API_KEY`, `XAI_API_KEY`, `RUNWAYML_API_SECRET`, `LTXV_API_KEY`, `REPLICATE_API_TOKEN`, `FAL_API_KEY`, or `LUMA_AGENTS_API_KEY`.

## Current Coverage

- Video coverage is split into model-level scenario files under `test/test-cases/e2e/service/step-6-video-gen-e2e/` using `defineVideoServiceTest` for model/provider rejection, option validation, and live generation when provider credentials are supplied. Provider-flag and request-shape validation lives in `test/test-cases/validation/providers/video-provider-contracts/` and `test/test-cases/validation/providers/provider-selection-contracts/`.
- `test/test-cases/validation/providers/video-provider-contracts/` covers mocked REST contracts for Gemini Veo media inputs, GLM text/image/interpolation/reference requests, MiniMax text/image/subject-reference requests, Grok generation/reference/edit/extension endpoint shapes including moderation failure handling, LTX text/image/interpolation/extension request shapes including failed jobs, Runway `text_to_video` request shapes, Replicate prediction create/poll/download flows including terminal failure statuses, and Luma Labs text/image-to-video request shapes (`lumalabs-video.test.ts`).
- `fal-provider-contracts.test.ts` separately exercises fal.ai queue submission, polling, result retrieval, downloads, authentication, and both current video model routes without consuming provider credits. Optional live coverage for fal.ai video models is defined in `fal-minimax-h3.test.ts` and `fal-pixverse-c1.test.ts`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-6-video-gen-e2e/ --price
bun t test/test-cases/e2e/service/step-6-video-gen-e2e/ --budget 2500
```

The price checks cover:

- Gemini: `veo-3.1-fast-generate-preview`, `veo-3.1-generate-preview`
- MiniMax: `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-2.3-Fast`, `T2V-01-Director`, `T2V-01`
- GLM: `cogvideox-3`, `viduq1-text`
- Grok: `grok-imagine-video`, `grok-imagine-video-1.5`
- Runway: `gen4.5`
- LTX: `ltx-2-3-fast`, `ltx-2-3-pro`
- Replicate: `alibaba/happyhorse-1.1`, `bytedance/seedance-2.0`, `bytedance/seedance-2.0-fast`, `kwaivgi/kling-v3-video`, `kwaivgi/kling-v3-omni-video`, `pixverse/pixverse-v6`, `runwayml/aleph-2`, `wan-video/wan-2.7-t2v`
- fal: `minimax/h3`, `fal-ai/pixverse/c1`

## Related Docs

- [Service Tests](service-tests.md)
- [Video](../commands/process-steps/step-6-video/text-to-video-services.md)
