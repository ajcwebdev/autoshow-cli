# ADR-001: Define Source Ingestion, Routes, and Normalization Policy

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-10-28
- **Verification Status:** Passed
- **Supersession:** Absorbs URL route execution from the retired record "Extract Execution and Artifact Contracts". OCR and STT execution remain with [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md) and [ADR-009](ADR-009-stt-timing-captions-and-alignment.md); pipeline state and resume remain with [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md).

## Context

Source ingestion must answer what the input is, which route it requires, and which normalized source enters extraction.

URL sources need a stable identity before extraction. An article is resumable URL extraction. An X Space is a separate route and is not resumable; it must not be mistaken for an article.

Discovery repeats expensive, non-authoritative work across independent CLI processes: video and collection lookups, local media probes, and batch-list parsing.

Only EPUB and PDF have chapter-aware extraction. A book-like file in another container must become an EPUB or PDF before extraction, and treating each ebook format separately would duplicate chapter logic.

Why now: source routing, URL route execution, supported ebook conversion, and discovery caching share one ingestion contract and one explicit-registry rule.

## Options Considered

**Option 1 (selected)**

- **Option:** Normalize supported convertible ebooks to EPUB with Calibre `ebook-convert`
- **Pros:** Reuses native EPUB chapter extraction; no new package dependencies; local and no-cost
- **Cons:** Requires Calibre; DRM or malformed inputs fail before extraction
- **Quantitative Notes:** 4 canonical formats plus 2 aliases

**Option 2**

- **Option:** Add one-off AZW3 handling
- **Pros:** Smallest immediate implementation
- **Cons:** Leaves the other ebook formats inconsistent and sets a per-format precedent
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Implement native parsers per ebook format
- **Pros:** Avoids an external conversion tool
- **Cons:** High maintenance and inconsistent chapter semantics
- **Quantitative Notes:** At least 4 formats

**Option 4**

- **Option:** Convert ebooks to PDF and use OCR and chapter detection
- **Pros:** Reuses the PDF path
- **Cons:** Lower fidelity, slower, and can enter paid OCR provider paths
- **Quantitative Notes:** n/a

**Option 5**

- **Option:** Add ebook parsing libraries
- **Pros:** Direct parsing for some formats
- **Cons:** Rejected under the no-new-dependency constraint; DRM failures remain
- **Quantitative Notes:** n/a

## Decision

Classify each input, expand collections and batch lists, and normalize supported sources before extraction. The result is an explicitly routed source, with a normalized file when conversion is required.

This applies to:

- Command-neutral source classification, expansion, format hints, and route selection.
- URL route execution and the Step 2 URL artifacts it writes.
- Local conversion of registered ebooks during download, discovery caches, conversion metadata, and the refusal of `.acsm` input.

It does not apply to:

- Batch work planning, pipeline persistence, resume, or dry-run pricing ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).
- OCR execution, pooling, retries, or artifacts ([ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md)).
- STT execution, timing, captions, or alignment ([ADR-009](ADR-009-stt-timing-captions-and-alignment.md)).
- Setup-managed Calibre provisioning ([ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md)).
- Unregistered extensions, remote conversion services, DRM removal, or paid-provider execution.

### URL routes and execution

Article and X Space inputs retain distinct `article` and `x-space` routes in the work plan and `manifest.json`, for both single-item and mixed-route batches. X Space runs cannot resume through the article route.

URL extraction writes its artifacts and records provider progress in the canonical `manifest.json` owned by [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md); raw responses and derived files are not resume authority. `extract` and `resume` select article backends through the shared `--provider` surface, using names such as `spider` without a route prefix. Local HTML always uses `defuddle`.

### Discovery caches

Video lookups, YouTube collection expansion, local media probes, and batch-list parsing may reuse caches across CLI processes. These caches are not resume authority. Local media and batch-list entries require an unchanged file fingerprint; video metadata is validated before reuse. YouTube collection entries are keyed by URL and are not refreshed against the live collection. Missing or malformed shared cache files become misses, while permission and other I/O failures propagate.

### Convertible ebooks

Registered ebook inputs `mobi`, `azw3`, `fb2`, and `lit` convert with Calibre `ebook-convert` to a temporary EPUB, with `.azw` treated as `azw3` and `.prc` as `mobi`. That EPUB enters the existing EPUB extraction path, and metadata retains the original format and conversion chain. Unregistered ebook extensions are not sent to Calibre.

`.acsm` files are not recognized, fulfilled, or provisioned. Provide a readable EPUB or PDF. DRM-protected ebooks remain unsupported.

## Rationale

- Converting registered ebooks to EPUB reuses the chapter-aware extract path without parser dependencies or parallel extractors.
- An explicit registry prevents unrelated files from being sent to Calibre.
- Explicit URL routes and shared provider selection keep execution and resume consistent.
- Discovery work is expensive and non-authoritative, so it is reused only under the validation rules in the Decision.
- `.acsm` is a fulfillment document, not a readable book.

## Consequences

Positive outcomes:

- Every command uses one classification and expansion result before extraction.
- An X Space cannot be treated as an article during execution or resume.
- Convertible ebooks get the same EPUB chapter path after a local, no-cost conversion, and new formats can be added through the registry.
- Repeated discovery work can be reused, with local file changes invalidating cached entries.

Negative outcomes:

- Users need Calibre from setup or a supported override; conversion failures surface before extraction.
- DRM-protected ebooks and `.acsm` files are unsupported.
- The normalized EPUB is temporary, so inspecting conversion output requires a local rerun.

## Trade-offs

**Trade-off 1**

- **Gain:** Broad book-like input support with one EPUB extraction path and no new dependencies
- **Sacrifice:** Calibre remains an external prerequisite, and conversion quality is whatever it emits

**Trade-off 2**

- **Gain:** Explicit `article` and `x-space` identities prevent cross-route resume
- **Sacrifice:** X Space runs remain outside the article resume path

**Trade-off 3**

- **Gain:** Faster repeated discovery
- **Sacrifice:** A small temporary-disk cache surface, and a miss still does the original work

## Implementation Note

Implemented by `src/cli/commands/sources/metadata/`, Calibre normalization in `src/cli/commands/sources/download/document/dl-document.ts`, and the URL provider registry in `src/cli/commands/command-shared/extract-routing/provider-registry/url-providers.ts`.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/text/ocr/epub-contracts/
bun test test/test-cases/validation/providers/provider-selection-contracts/
bun test test/test-cases/validation/runtime-contracts/file-cache-contracts.test.ts
```

1. Repository structure, type, naming, and documentation contracts.
2. Convertible ebook detection, alias resolution, Calibre conversion, and conversion metadata.
3. Registry-backed provider selection and article routing.
4. Batch-list invalidation after local file changes and preservation of concurrent cache updates.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md)
- Related ADR: [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md)
- Related ADR: [ADR-009](ADR-009-stt-timing-captions-and-alignment.md)
- URL command guide: [`docs/commands/02-extract/url/overview.md`](../commands/02-extract/url/overview.md)
