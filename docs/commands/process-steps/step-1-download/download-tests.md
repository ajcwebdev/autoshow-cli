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
# local file input coverage
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-local-file.test.ts

# network-backed coverage
bun t \
  test/test-cases/e2e/local/step-1-download-e2e/download-input-types-direct-url.test.ts \
  test/test-cases/e2e/local/step-1-download-e2e/download-input-types-feed-or-channel.test.ts \
  test/test-cases/e2e/local/step-1-download-e2e/download-input-types-streaming.test.ts
```

## Local Coverage

- `test/test-cases/e2e/local/step-1-download-e2e/download-input-types-local-file.test.ts` covers local input paths without network access.

## Service Coverage

- `test/test-cases/e2e/local/step-1-download-e2e/download-input-types-direct-url.test.ts` covers hosted audio and video URLs plus URL-list batching for direct URLs.
- `test/test-cases/e2e/local/step-1-download-e2e/download-input-types-feed-or-channel.test.ts` covers RSS feed batching served from a local HTTP feed fixture.
- `test/test-cases/e2e/local/step-1-download-e2e/download-input-types-streaming.test.ts` covers YouTube and Twitch streaming URLs.
- No-cost validation coverage lives in `test/test-cases/validation/cli/option-resolution-contracts/download-extract-url-options.test.ts` and `test/test-cases/validation/ingest/input-contracts.test.ts`.

## Price Preflight

```bash
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-direct-url.test.ts --price
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-streaming.test.ts --price
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-feed-or-channel.test.ts --price
```

These download mappings are report-only entries in `test/test-runner/price-commands/registry/download.ts`.

## Related Docs

- [Testing Overview](../../testing.md)
- [Download](download-file.md)
