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

- Model-level service files under `test/test-cases/e2e/service/step-7-music-gen-e2e/` use `defineMusicServiceTest` for model/provider rejection, option validation, and live generation when provider credentials are supplied.
- `provider-flag-validation.test.ts` covers provider-selection validation and multi-provider runs emitting per-provider filenames and array metadata.
- `test/test-cases/validation/providers/music-provider-contracts.test.ts` covers mocked REST contracts for MiniMax (`music-3.0` model acceptance, previous model rejection, instrumental flag, auto-lyrics metadata, prompt capping, and lyrics length validation), Gemini (inline audio decoding and text part preservation), and ElevenLabs (model-specific output formats `mp3_44100_128` / `mp3_48000_192` and response header recording). `test/test-cases/validation/music/lyrics-video-render-contracts.test.ts` covers lyric-video ASS subtitle generation, image background filters, and FFmpeg command-line argument construction without live service calls.
- Pipeline files (`elevenlabs-music-v2-pipeline.test.ts`, `minimax-music-3.0-pipeline.test.ts`) add write-pipeline coverage for ElevenLabs and MiniMax music generation.
- Focused `--price` coverage lives in `test/test-cases/price-flag/music-price.test.ts`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-7-music-gen-e2e/ --price
bun t test/test-cases/e2e/service/step-7-music-gen-e2e/ --budget 2500
```

## Related Docs

- [Service Tests](service-tests.md)
- [Music Services](../commands/process-steps/step-7-music/text-to-music-services.md)
