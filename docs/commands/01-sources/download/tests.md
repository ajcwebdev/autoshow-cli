# Download Tests

Coverage for local files, hosted media URLs, feeds, and streaming sources. The first command uses local fixtures and a loopback RSS server. The second downloads from external sites and depends on their availability and the installed download tools.

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

- Local runs cover audio files, PDFs, and RSS feed batching.
- Network runs cover direct media URLs, URL lists, YouTube, and Twitch.
- yt-dlp option and passthrough checks that do not download anything are in `test/test-cases/validation/sources/download/`.

## Price Preflight

These download tests make no billable provider calls. `bun t --price` on these paths runs mapped price-only checks instead of the download tests; it does not verify that downloads work.

## Related Docs

- [Testing Overview](../../testing.md)
- [Download](overview.md)
