# Step 7 Tests: Music

Local lyric-video rendering coverage plus provider-backed music-generation coverage for the `music` command.

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

Live music generation tests run only when their provider key is configured: `ELEVENLABS_API_KEY`, `GEMINI_API_KEY`, or `MINIMAX_API_KEY`. The multi-provider test requires both `MINIMAX_API_KEY` and `GEMINI_API_KEY`.

## Local Coverage

- `test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts` covers local FFmpeg/Whisper lyric-video rendering.

## Service Coverage

- Model-level service files under `test/test-cases/e2e/service/step-7-music-gen-e2e/` cover live generation for ElevenLabs (`elevenlabs-music.test.ts`, `--provider elevenlabs=music_v2`), Gemini (`gemini-lyria-3-pro-preview.test.ts`, `--provider gemini=lyria-3-pro-preview`), and MiniMax (`minimax-music-3.0.test.ts`, `--provider minimax=music-3.0`). Each uses `defineMusicServiceTest`, which asserts the generated `generated-music.mp3` artifact and its canonical `music` metadata entry.
- Hand-written service tests cover the cases the shared helper does not: `minimax-music-3.0-gemini-lyria-3-pro-preview.test.ts` runs both providers in one command and asserts per-provider filenames plus array metadata, and `provider-flag-validation.test.ts` asserts that omitting `--provider` exits with code 2.
- Zero-cost validation and contract coverage lives in `test/test-cases/validation/providers/music-provider-contracts.test.ts` (mocked ElevenLabs, Gemini, and MiniMax REST contracts, including MiniMax model acceptance and rejection) and `test/test-cases/validation/music/lyrics-video-render-contracts.test.ts` (lyric-video rendering contracts).
- Focused `--price` validation lives in `test/test-cases/price-flag/music-price.test.ts`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/step-7-music-gen-e2e/ --price
bun t test/test-cases/e2e/service/step-7-music-gen-e2e/ --budget 2500
bun t test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts --price
bun t test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts --budget 500
```

`--price` is estimate-only and never runs the tests; `--budget` runs the preflight and then runs the selected tests, skipping only the keys whose estimate exceeds the budget, so it makes live provider calls.

The mapped music price preflight covers ElevenLabs, Gemini, and MiniMax music generation files. Local lyric-video rendering maps to local Whisper transcription price keys (`transcribe-whisper-tiny` and `transcribe-whisper-large-v3-turbo`); `music --audio --price` reports a free (`0.000¢`) estimate with the expected lyric-video output files, since local transcription and rendering have no provider cost.

## Related Docs

- [Testing Overview](../../testing.md)
- [Music Services](text-to-music-services.md)
