# Music Tests

Local lyric-video rendering plus hosted music generation for the `music` command. These `bun t` commands may call paid or quota-limited providers.

## Quick Start

```bash
bun t test/test-cases/e2e/local/audio/music/music-lyrics-video.test.ts

bun t test/test-cases/e2e/service/audio/music/
```

## Provider Env Vars

Live music generation tests need the matching provider key: `ELEVENLABS_API_KEY`, `GEMINI_API_KEY`, or `MINIMAX_API_KEY`.

## Price Preflight

```bash
bun t test/test-cases/e2e/service/audio/music/ --price
bun t test/test-cases/e2e/service/audio/music/ --budget 2500
```

## Related Docs

- [Testing Overview](../../testing.md)
- [Music Command](overview.md)
