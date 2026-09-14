# Download Tests

Download coverage for local files, hosted media URLs, feeds, and streaming sources.

Safety: these commands may hit the network.

## Quick Start

```bash
# local documents and audio
bun t test/test-cases/e2e/local/sources/download/download-input-types-local-file.test.ts

# hosted audio/video URLs, RSS feeds, and streaming sources
bun t \
  test/test-cases/e2e/local/sources/download/download-input-types-direct-url.test.ts \
  test/test-cases/e2e/local/sources/download/download-input-types-feed-or-channel.test.ts \
  test/test-cases/e2e/local/sources/download/download-input-types-streaming.test.ts
```

## Price Preflight

`download` has no provider cost; `--price` on these paths is report-only.

```bash
bun t \
  test/test-cases/e2e/local/sources/download/download-input-types-direct-url.test.ts \
  test/test-cases/e2e/local/sources/download/download-input-types-feed-or-channel.test.ts \
  test/test-cases/e2e/local/sources/download/download-input-types-streaming.test.ts \
  --price
```

## Related Docs

- [Testing Overview](../../testing.md)
- [Download](overview.md)
