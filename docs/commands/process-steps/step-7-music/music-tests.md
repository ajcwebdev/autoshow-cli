# Step 7 Tests: Music

Local lyric-video rendering coverage plus provider-backed music-generation coverage for the `music` command.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Quick Start

```bash
# local lyric-video coverage
bun t test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts

# hosted music service coverage
bun t test/test-cases/e2e/service/step-7-music-gen-e2e/
```

## Provider Env Vars

Live music generation tests run only when their provider key is configured: `ELEVENLABS_API_KEY`, `GEMINI_API_KEY`, or `MINIMAX_API_KEY`.

## Current Coverage

- `test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts` covers local lyric-video rendering.
- `test/test-cases/e2e/service/step-7-music-gen-e2e/` covers live generation for ElevenLabs, Gemini, and MiniMax.
- `test/test-cases/price-flag/music-price.test.ts` covers `--price` validation.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-7-music-gen-e2e/ --price
bun t test/test-cases/e2e/service/step-7-music-gen-e2e/ --budget 2500
```

Local lyric-video rendering has no provider cost.

## Related Docs

- [Testing Overview](../../testing.md)
- [Music Services](text-to-music-services.md)
