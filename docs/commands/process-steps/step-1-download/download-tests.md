# Step 1 Tests: Download

Download coverage for step 1: local file inputs plus network-backed hosted media URLs, feeds, and streaming sources.

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Local Coverage](#local-coverage)
- [Service Coverage](#service-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
# local file coverage
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-local-file.test.ts

# network-backed coverage
bun t \
  test/test-cases/e2e/local/step-1-download-e2e/download-input-types-direct-url.test.ts \
  test/test-cases/e2e/local/step-1-download-e2e/download-input-types-feed-or-channel.test.ts \
  test/test-cases/e2e/local/step-1-download-e2e/download-input-types-streaming.test.ts
```

## Local Coverage

- `test/test-cases/e2e/local/step-1-download-e2e/download-input-types-local-file.test.ts` covers local document download and a hosted example audio URL.

## Service Coverage

- `test/test-cases/e2e/local/step-1-download-e2e/download-input-types-direct-url.test.ts` covers hosted audio and video URLs plus URL-list batching for direct URLs.
- `test/test-cases/e2e/local/step-1-download-e2e/download-input-types-feed-or-channel.test.ts` covers RSS feed batching.
- `test/test-cases/e2e/local/step-1-download-e2e/download-input-types-streaming.test.ts` covers YouTube and Twitch streaming URLs.

## Price Preflight

```bash
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-direct-url.test.ts --price
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-streaming.test.ts --price
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-feed-or-channel.test.ts --price
```

`download` has no provider cost; `--price` on these paths is report-only.

## Related Docs

- [Testing Overview](../../testing.md)
- [Download](download-file.md)
