# Download Tests

Download coverage for local files, hosted media URLs, feeds, and streaming sources.

Safety: these `bun t` commands document human e2e coverage and may hit the network. Do not run them for agent verification without explicit approval for that exact run.

## Quick Start

```bash
bun t test/test-cases/e2e/local/sources/download/download-input-types-local-file.test.ts

bun t \
  test/test-cases/e2e/local/sources/download/download-input-types-direct-url.test.ts \
  test/test-cases/e2e/local/sources/download/download-input-types-feed-or-channel.test.ts \
  test/test-cases/e2e/local/sources/download/download-input-types-streaming.test.ts
```
## Coverage

- Local e2e covers local audio and document downloads.
- Network e2e covers direct media URLs, URL lists, RSS feeds, YouTube, and Twitch.
- Zero-cost validation is in `test/test-cases/validation/sources/download/` (yt-dlp options and passthrough contracts).

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
