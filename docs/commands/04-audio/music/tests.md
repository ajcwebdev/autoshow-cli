# Music Tests

Local lyric-video rendering plus hosted music generation for the `music` command.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Quick Start

```bash
# local lyric-video rendering
bun t test/test-cases/e2e/local/audio/music/music-lyrics-video.test.ts

# hosted music generation
bun t test/test-cases/e2e/service/audio/music/
```

## Provider Env Vars

Live music generation tests need the matching provider key: `ELEVENLABS_API_KEY`, `GEMINI_API_KEY`, or `MINIMAX_API_KEY`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/audio/music/ --price
bun t test/test-cases/e2e/service/audio/music/ --budget 2500
```

`test/test-cases/price-flag/audio/music/music-price.test.ts` covers `--price` validation without calling providers.

Local lyric-video rendering has no provider cost.

## Related Docs

- [Testing Overview](../../testing.md)
- [Music Command](overview.md)
