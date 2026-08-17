# Step 7 Tests: Music

Local lyric-video rendering coverage plus provider-backed music-generation coverage for the `music` command and service-side write-pipeline cases.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Provider Env Vars](#provider-env-vars)
- [Local Coverage](#local-coverage)
- [Service Coverage](#service-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
# local lyric-video coverage
bun t test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts

# hosted music service coverage
bun t test/test-cases/e2e/service/step-7-music-gen-e2e/
```

## Provider Env Vars

Live music generation tests run only when their provider key is configured: `ELEVENLABS_API_KEY`, `GEMINI_API_KEY`, or `MINIMAX_API_KEY`.

## Local Coverage

- `test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts` covers local FFmpeg/Whisper lyric-video rendering.

## Service Coverage

- Model-level service files under `test/test-cases/e2e/service/step-7-music-gen-e2e/` cover ElevenLabs, Gemini, and MiniMax using `defineMusicServiceTest` for model rejection, option validation, and live generation.
- Pipeline integration coverage in `elevenlabs-music-v2-pipeline.test.ts` and `minimax-music-3.0-pipeline.test.ts` verifies root `write` pipeline integration.
- Zero-cost validation and contract coverage lives in `test/test-cases/validation/providers/music-provider-contracts.test.ts` (mocked ElevenLabs, Gemini, and MiniMax REST contracts) and `test/test-cases/validation/music/lyrics-video-render-contracts.test.ts` (lyric-video rendering contracts).
- Focused `--price` validation lives in `test/test-cases/price-flag/music-price.test.ts`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-7-music-gen-e2e/ --price
bun t test/test-cases/e2e/service/step-7-music-gen-e2e/ --budget 2500
bun t test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts --price
bun t test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts --budget 500
```

The mapped music price preflight covers ElevenLabs, Gemini, and MiniMax music generation files. Local lyric-video rendering maps to local Whisper transcription price keys (`transcribe-whisper-tiny` and `transcribe-whisper-large-v3-turbo`); `music --audio` itself rejects hosted-generation `--price`.

## Related Docs

- [Testing Overview](../../testing.md)
- [Music Services](text-to-music-services.md)
