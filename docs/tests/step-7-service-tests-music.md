# Step 7 Service Tests: Music

Provider-backed music-generation coverage for the `music` command plus service-side write-pipeline cases.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Provider Env Vars](#provider-env-vars)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t test/test-cases/e2e/service/step-7-music-gen-e2e/
```

## Provider Env Vars

Live music generation tests run only when their provider key is configured: `ELEVENLABS_API_KEY`, `GEMINI_API_KEY`, or `MINIMAX_API_KEY`.

## Current Coverage

- Model-level service files under `test/test-cases/e2e/service/step-7-music-gen-e2e/` cover ElevenLabs, Gemini, and MiniMax using `defineMusicServiceTest` for model rejection, option validation, and live generation.
- Pipeline integration coverage in `elevenlabs-music-v2-pipeline.test.ts` and `minimax-music-3.0-pipeline.test.ts` verifies root `write` pipeline integration.
- Zero-cost validation and contract coverage lives in `test/test-cases/validation/providers/music-provider-contracts.test.ts` (mocked ElevenLabs, Gemini, and MiniMax REST contracts) and `test/test-cases/validation/music/lyrics-video-render-contracts.test.ts` (lyric-video rendering contracts).
- Focused `--price` validation lives in `test/test-cases/price-flag/music-price.test.ts`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-7-music-gen-e2e/ --price
bun t test/test-cases/e2e/service/step-7-music-gen-e2e/ --budget 2500
```

The mapped music price preflight covers ElevenLabs, Gemini, and MiniMax music generation files.

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [Music Services](../commands/process-steps/step-7-music/text-to-music-services.md)
