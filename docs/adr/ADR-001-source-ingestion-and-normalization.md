# ADR-001: Source Ingestion and Normalization

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-11-14
- **Verification Status:** Passed

## Context

Every extraction needs an explicit source identity, route, and readable input. Shared classification, normalization, and discovery prevent commands from interpreting the same source differently.

## Decision

Classify inputs and expand collections and batch lists before execution. Preserve distinct `article` and `x-space` routes in work plans and manifests, including mixed batches. Articles may resume; X Spaces may not. Article extraction uses the shared `--provider` surface; local HTML always uses `defuddle`. Record URL artifacts and provider progress through the [canonical manifest](ADR-002-pipeline-state-resume-and-dry-run-planning.md).

Discovery caches may be shared across processes but never establish completion or resume eligibility. Local media and batch lists require unchanged file fingerprints; video metadata and YouTube collection entries require validation. Missing or malformed caches are misses; other I/O failures propagate. Updates use locks and atomic replacement. YouTube collections are keyed by URL without live freshness checks.

Only registered ebooks convert through local Calibre `ebook-convert`: `mobi`, `azw3`, `fb2`, and `lit`, with `azw` and `prc` as aliases for `azw3` and `mobi`. A temporary EPUB enters the existing chapter-aware extraction path; metadata retains the original format and conversion chain. Unregistered formats, DRM-protected ebooks, and `.acsm` fulfillment files are unsupported. Require a readable EPUB or PDF instead.

## Trade-offs

One EPUB path avoids per-format parsers and paid OCR conversion, but requires Calibre and inherits its conversion quality. Validated caches reduce discovery work at the cost of temporary storage and potentially stale collection membership.

## Verification

```bash
bun test test/test-cases/validation/text/ocr/epub-contracts/
bun test test/test-cases/validation/runtime-contracts/file-cache-contracts.test.ts test/test-cases/validation/runtime-contracts/youtube-collection-cache-contracts.test.ts
```

Verify conversion metadata, local-file invalidation, validated cache hits/misses, I/O failures, and concurrent updates without provider calls.

## References

- [URL extraction guide](../commands/02-extract/url/overview.md)
- [Setup](ADR-004-setup-toolchain-and-runtime-configuration.md), [OCR](ADR-008-ocr-execution-pooling-and-artifacts.md), and [STT](ADR-009-stt-timing-captions-and-alignment.md)
- `src/cli/commands/sources/metadata/`
- `src/cli/commands/sources/download/document/dl-document.ts`
