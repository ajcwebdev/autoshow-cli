# Music Tests

Tests cover local lyric-video rendering and hosted music generation for `music`. The local suite uses installed media tools and whisperfile; the hosted suite may incur provider charges.

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

`--price` runs mapped estimates without generating audio. `--budget 2500` can run paid tests whose mapped estimates are at most 25¢ per test key. Total spending can exceed that threshold.

## Related Docs

- [Testing Overview](../../testing.md)
- [Music Command](overview.md)
