# Step 1 Service Tests: Download

Network-backed download coverage for hosted media URLs, feeds, and streaming sources. Local file input coverage for step 1 remains in [Local Tests](local-tests.md).

Safety: these `bun t` commands document human service/e2e coverage and may call paid or quota-limited providers. Do not run them for agent verification without explicit approval for that exact run.

## Outline

- [Quick Start](#quick-start)
- [Current Coverage](#current-coverage)
- [Price Preflight](#price-preflight)
- [Related Docs](#related-docs)

## Quick Start

```bash
bun t \
  test/test-cases/e2e/local/step-1-download-e2e/download-input-types-direct-url.test.ts \
  test/test-cases/e2e/local/step-1-download-e2e/download-input-types-feed-or-channel.test.ts \
  test/test-cases/e2e/local/step-1-download-e2e/download-input-types-streaming.test.ts
```

## Current Coverage

- `test/test-cases/e2e/local/step-1-download-e2e/download-input-types-local-file.test.ts` covers the hosted example audio URL and local PDF inputs. This remains part of [Local Tests](local-tests.md).
- `test/test-cases/e2e/local/step-1-download-e2e/download-input-types-direct-url.test.ts` covers hosted audio and video URLs plus URL-list batching for direct URLs.
- `test/test-cases/e2e/local/step-1-download-e2e/download-input-types-feed-or-channel.test.ts` covers RSS feed batching served from a local HTTP feed fixture. YouTube channel batching is not currently covered.
- `test/test-cases/e2e/local/step-1-download-e2e/download-input-types-streaming.test.ts` covers YouTube and Twitch streaming URLs.
- No-cost validation coverage lives in `test/test-cases/validation/cli/option-resolution-contracts/download-extract-url-options.test.ts` and `test/test-cases/validation/ingest/input-contracts.test.ts`. No standalone step 1 price-only file currently exists in `test/test-cases/price-flag/`; coverage stays in the step 1 e2e suites above.

## Price Preflight

```bash
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-direct-url.test.ts --price
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-streaming.test.ts --price
bun t test/test-cases/e2e/local/step-1-download-e2e/download-input-types-feed-or-channel.test.ts --price
```

These download mappings are report-only entries in `test/test-runner/price-commands/registry/download.ts`. `--budget` does not currently skip step 1 download tests.

## Related Docs

- [Service Tests](service-tests.md)
- [Local Tests](local-tests.md)
- [Download](../commands/process-steps/step-1-download/download-file.md)
