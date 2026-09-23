# Download Tests

Coverage for local files, hosted media URLs, feeds, and streaming sources. The first command stays on this machine. The second downloads from the network.

## Quick Start

```bash
bun t \
  test/test-cases/e2e/local/sources/download/download-input-types-local-file.test.ts \
  test/test-cases/e2e/local/sources/download/download-input-types-feed-or-channel.test.ts

bun t \
  test/test-cases/e2e/local/sources/download/download-input-types-direct-url.test.ts \
  test/test-cases/e2e/local/sources/download/download-input-types-streaming.test.ts
```

## Coverage

- Local runs cover audio files, documents, and RSS feed batching.
- Network runs cover direct media URLs, URL lists, YouTube, and Twitch.
- yt-dlp option and passthrough checks that do not download anything are in `test/test-cases/validation/sources/download/`.

## Price Preflight

`download` has no provider cost. `--price` on these paths only prints a report.

## Related Docs

- [Testing Overview](../../testing.md)
- [Download](overview.md)
