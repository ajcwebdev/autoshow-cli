# ADR-001: Define Source Ingestion and Normalization Policy

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed
- **Supersession:** URL execution moved to ADR-009, and pipeline state, resume, and dry-run planning belong to ADR-002. This record remains accepted authority for source classification, supported ebook normalization, discovery caches, and the normalized handoff to execution.

## Context

Source ingestion must answer what the input is, which route it requires, and which normalized file enters extraction. It does not own provider execution or persistent run state.

URL sources need a stable identity before extraction. `article` and `x-space` stay distinct explicit routes rather than being inferred from each other or from provider metadata.

Discovery repeats expensive, non-authoritative work across independent CLI processes: video and collection lookups, local media probes, and batch-list parsing. Best-effort caches may reuse that work. Local hits require an unchanged file and a valid payload. Remote video and collection hits can repeat an earlier lookup. None of them choose the normalized file handed to extraction.

Only EPUB and PDF have chapter-aware extraction. Other documents and images produce flat text or per-image OCR. A book-like file in another container must become an EPUB or PDF before extraction. Several ebook formats are closer to EPUB than to PDF OCR, but treating each separately would duplicate chapter logic.

Why now: source routing, supported ebook conversion, and discovery caching share one ingestion contract and one explicit-registry rule.

## Options Considered

**Option 1 (selected)**

- **Option:** Normalize supported convertible ebooks to EPUB with Calibre `ebook-convert`
- **Pros:** Reuses native EPUB chapter extraction; one implementation for chapter behavior; no new package dependencies; default path stays local and no-cost
- **Cons:** Requires Calibre; conversion quality depends on Calibre; DRM or malformed inputs fail before extraction
- **Quantitative Notes:** 4 canonical formats plus 2 aliases; 0 package dependencies; 1 local subprocess per normalized ebook

**Option 2**

- **Option:** Add one-off AZW3 handling
- **Pros:** Smallest immediate implementation
- **Cons:** Leaves MOBI, AZW, FB2, LIT, and PRC inconsistent; creates precedent for per-format branches
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Implement native parsers per ebook format
- **Pros:** Avoids an external conversion tool
- **Cons:** High maintenance; inconsistent chapter semantics; more metadata and navigation edge cases
- **Quantitative Notes:** High code cost across at least 4 formats

**Option 4**

- **Option:** Convert ebooks to PDF and use OCR/chapter detection
- **Pros:** Reuses PDF path
- **Cons:** Lower fidelity; slower; can enter OCR provider paths when provider flags are selected
- **Quantitative Notes:** Higher CPU cost and possible paid-provider risk

**Option 5**

- **Option:** Add ebook parsing libraries
- **Pros:** Direct parsing for some formats
- **Cons:** Adds dependencies; still leaves format-specific behavior and DRM failures
- **Quantitative Notes:** Rejected under the no-new-dependency constraint

## Decision

Classify each input, expand collections and batch lists, and normalize supported sources before extraction. The result is an explicitly routed, normalized file.

This applies to:

- Command-neutral source classification, expansion, format hints, and route selection, including distinct `article` and `x-space` routes.
- Local conversion during download of ebooks `mobi`, `azw3`, `fb2`, and `lit`, with `.azw` treated as `azw3` and `.prc` as `mobi`.
- Best-effort discovery caches for video lookups, YouTube collections, local media probes, and batch-list parsing.
- Conversion metadata that records the original source format and the normalized EPUB.
- The explicit refusal of `.acsm` as an input.

It does not apply to:

- Batch work planning, pipeline persistence, resume, or dry-run pricing ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).
- URL, OCR, or STT execution, retries, or artifacts ([ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)).
- Setup-managed Calibre provisioning ([ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)).
- Unregistered extensions, remote conversion services, DRM removal, or paid-provider execution.

### Discovery caches

Video lookups, YouTube collection expansion, local media probes, and batch-list parsing may reuse best-effort caches across CLI processes. Caches accelerate discovery; they are never source-of-truth state. Local media probes and batch lists hit only when the file fingerprint is unchanged and the cached payload validates. Video lookups validate the cached payload before reuse. YouTube collection hits are keyed by URL and are not checked against the live collection. A read or validation failure degrades to a miss. These caches do not change single-source classification or the normalized file handed to extraction.

### Convertible ebooks

Registered non-EPUB ebook inputs convert with Calibre `ebook-convert` to a temporary EPUB; only that file enters extraction. Unregistered extensions are not probed. After conversion, the file follows the existing EPUB extract path.

`.acsm` files are not recognized, fulfilled, or provisioned. Provide a readable EPUB or PDF. DRM-protected ebooks remain unsupported.

## Rationale

- Converting registered ebooks to EPUB reuses the existing chapter-aware extract path without parser dependencies or parallel extractors.
- An explicit registry prevents unrelated files from being sent to Calibre, and conversion metadata keeps the original format visible in run output.
- Discovery work is expensive and non-authoritative. Local caches are reused only when the file is unchanged and the payload validates. Remote video and YouTube collection caches are temporary and can repeat an earlier lookup.
- `.acsm` is a fulfillment document, not a readable book, and must not enter extraction.

## Consequences

Positive outcomes:

- Every command uses one classification and expansion result before extraction.
- Convertible ebooks get the same EPUB chapter path after a local, no-cost conversion.
- Rerunning local probes and batch-list parsing can reuse fingerprint-validated caches without changing results. Video lookups and YouTube collection expansion can reuse their temporary caches.
- Future ebook formats can be added through the registry.

Negative outcomes:

- Users need Calibre from setup or an explicit supported override; conversion failures surface before extraction.
- Discovery caches occupy a small temporary-disk surface; misses still do the original work.
- DRM-protected ebooks and `.acsm` files are unsupported.
- The normalized EPUB is temporary, so inspecting conversion output requires a local rerun.

## Trade-offs

**Trade-off 1**

- **Gain:** Broad book-like input support with one EPUB extraction path
- **Sacrifice:** No native parser for each ebook format

**Trade-off 2**

- **Gain:** No new runtime package dependencies
- **Sacrifice:** Calibre remains an external prerequisite, and unregistered formats are not converted

**Trade-off 3**

- **Gain:** Run metadata records the original format and conversion chain
- **Sacrifice:** Conversion quality is whatever Calibre emits

## Implementation Note

The convertible-ebook registry is `src/cli/commands/sources/metadata/formats/metadata-convertible-ebooks.ts`. Calibre conversion runs during document download in `src/cli/commands/sources/download/document/dl-document.ts`. Video lookups, local media probes, and batch-list parsing use `src/utils/file-fingerprint-cache.ts`. YouTube collection expansion keeps its URL cache in `src/cli/commands/sources/metadata/metadata-sources/metadata-youtube-collection-target.ts`.

## API / Type Impact

Convertible ebook runs record:

- **`sourceFormat`:** `mobi`, `azw3`, `fb2`, or `lit` after alias resolution
- **`normalizedFormat`:** `epub`
- **`conversionChain`:** `["calibre"]`
- **`normalizedFrom`:** original source format after extraction

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/text/ocr/epub-contracts/normalizable-ebooks.test.ts
```

1. Convertible ebook detection, alias resolution, Calibre conversion to EPUB, and original-format metadata.
2. Original format and conversion chain remain recorded after EPUB extraction.

Do not run hosted OCR, paid-provider, smoke, e2e, or full-suite tests for this ADR.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- `src/cli/commands/sources/metadata/formats/metadata-convertible-ebooks.ts`
- `src/cli/commands/sources/download/document/dl-document.ts`
- `src/types/document-processing/convertible-ebooks-types.ts`
- `src/utils/file-fingerprint-cache.ts`
- `src/cli/commands/sources/metadata/metadata-sources/metadata-youtube-collection-target.ts`
- `test/test-cases/validation/text/ocr/epub-contracts/normalizable-ebooks.test.ts`
