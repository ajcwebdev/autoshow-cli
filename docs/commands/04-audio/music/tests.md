# Music Tests

Local/mocked contracts cover provider payloads, lyric selection, and render plans without third-party calls:

```bash
bun test test/test-cases/validation/audio/music/
```

Local rendering e2e tests require the installed media tools, fonts, and whisperfile. Preflight their mapped cases or the hosted suite before running them:

```bash
bun t test/test-cases/e2e/local/audio/music/music-lyrics-video.test.ts --price
bun t test/test-cases/e2e/service/audio/music/ --price
```

Hosted execution needs the matching `ELEVENLABS_API_KEY`, `GEMINI_API_KEY`, or `MINIMAX_API_KEY` and must meet [spending rules](../../../../AGENTS.md#paid-providers). Run the selected command without `--price` only within that authorization. `--budget 2500` filters paid cases at 25¢ per test key; it is not a cumulative spending cap.

See the [testing guide](../../testing.md) and [music command](overview.md).
