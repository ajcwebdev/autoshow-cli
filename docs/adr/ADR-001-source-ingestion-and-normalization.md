# ADR-001: Define Source Ingestion and Normalization Policy

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed
- **Supersession:** URL execution moved to ADR-009, and pipeline state, resume, and dry-run planning belong to ADR-002. This record remains accepted authority for source classification, supported ebook normalization, discovery caches, and the normalized handoff to execution.

## Context

Source ingestion must answer what the input is, which route it requires, and which normalized file enters extraction, without owning provider execution or persistent run state. Classification, expansion, format hints, and route selection happen before download. Acquisition, conversion, and source output writing happen at download.

URL sources need a stable backend identity before extraction. This record classifies that identity and keeps `article` and `x-space` as distinct explicit routes. Adapters, retries, article normalization, and artifacts belong to [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md). Batch planning and resume belong to [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md). Calibre provisioning belongs to [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md).

Discovery repeats expensive but non-authoritative work across independent CLI processes: `yt-dlp` video and collection lookups, local `ffprobe` probes, and batch-list parsing. Best-effort caches may reuse that work only when they cannot change classification, routing, or normalized output.

Only EPUB and PDF have chapter-aware extraction. DOCX, PPTX, XLSX, ODF, RTF, CSV, CBZ, and images produce flat text or per-image OCR. A book-like file in another container must become an EPUB or PDF before extraction. Several ebook formats are closer to EPUB than to PDF OCR, but treating each separately would duplicate chapter logic.

Why now: source routing, supported ebook conversion, and discovery caching share one ingestion contract and one explicit-registry rule.

## Options Considered

**Option 1 (selected)**

- **Option:** Normalize supported convertible ebooks to EPUB with Calibre `ebook-convert`
- **Pros:** Reuses native EPUB chapter extraction; one implementation for TOC/spine/chunk behavior; no new package dependencies; default path stays local and no-cost
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

Classify each input, expand collections and batch lists, and normalize supported sources before extraction. These stages produce explicitly routed, normalized inputs without owning the batch work plan, provider progress, or extract adapters.

This applies to:

- Command-neutral source classification, expansion, format hints, and route selection, including distinct `article` and `x-space` routes.
- Download-time acquisition and local normalization, including convertible ebooks `mobi`, `azw3`, `fb2`, and `lit`, with `.azw` treated as `azw3` and `.prc` as `mobi`.
- Best-effort discovery caches for video lookups, YouTube collections, local media probes, and batch-list parsing.
- Conversion metadata that records the original source format and the normalized EPUB.
- The explicit refusal of `.acsm` as an input.

It does not apply to:

- Batch work planning, pipeline persistence, resume, or dry-run pricing ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).
- URL, OCR, or STT execution, retries, or artifacts ([ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)).
- Setup-managed Calibre provisioning ([ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)).
- Converting unregistered extensions, uploading inputs to remote conversion services, or removing DRM.
- Paid-provider execution; ebook normalization is local preprocessing.

### Discovery caches

Video lookups, YouTube collection expansion, local media probes, and batch-list parsing may reuse best-effort caches across CLI processes. Those caches accelerate discovery; they are never source-of-truth state. A cache hit requires the source to be unchanged, cached payloads are validated before reuse, and any read, parse, validation, or write failure degrades to a miss. Caches cannot change classification, routing, provider selection, normalized output, or pipeline state.

### Convertible ebooks

No container other than EPUB and PDF receives chapter-aware extraction. Registered non-EPUB ebook inputs are converted with Calibre `ebook-convert` to a temporary EPUB, and only that file enters extraction. Unregistered extensions are not probed. After normalization, the file follows the existing EPUB path: default `epub-text` extraction, chapter export, length truncation, JSON inspection, and any selected OCR flags.

AutoShow does not recognize, fulfill, or provision `.acsm` files. Users must provide a readable EPUB or PDF. DRM-protected ebooks remain unsupported.

## Rationale

- One EPUB/PDF extraction path already exists. Converting registered ebooks to EPUB before extraction keeps chapter and inspection behavior consistent without parser dependencies or parallel extractors.
- An explicit registry prevents unrelated files from being sent to Calibre, and conversion metadata keeps the original format visible in manifests.
- Discovery work is expensive and non-authoritative, so caches are allowed only when they cannot change the ingestion result.
- `.acsm` is a fulfillment document, not a readable book, and must not enter extraction.

## Consequences

Positive outcomes:

- Every command consumes one classification and expansion result, then execution owns adapters and artifacts.
- Convertible ebooks get the same EPUB chapter path after a local, no-cost conversion.
- Rerunning discovery, local probes, and batch-list parsing can reuse validated caches without changing results.
- Future ebook formats can be added through the registry and focused tests.

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

- **Gain:** Chapter export and EPUB inspection stay in one implementation
- **Sacrifice:** Calibre remains an external prerequisite

**Trade-off 3**

- **Gain:** No new runtime package dependencies
- **Sacrifice:** Calibre-capable formats are not tried until they are added to the registry

**Trade-off 4**

- **Gain:** Manifests record the original format and conversion chain
- **Sacrifice:** Conversion quality is whatever Calibre emits

## Implementation Note

Classification, route selection, and the convertible-ebook registry live under `src/cli/commands/process-steps/step-0-metadata/`. Calibre normalization runs during Step 1 document preparation. Discovery caches use the shared fingerprint helper in `src/utils/file-fingerprint-cache.ts`. Extraction preserves `normalizedFrom` and `conversionChain` on the EPUB path.

## API / Type Impact

Supported ebook conversion writes these Step 1 fields, which Step 2 extraction preserves:

- **`sourceFormat`:** `mobi`, `azw3`, `fb2`, or `lit` after alias resolution
- **`normalizedFormat`:** `epub`
- **`conversionChain`:** `["calibre"]`
- **`normalizedFrom`:** original source format, recorded on the Step 2 result

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/extract-ocr/epub-contracts/normalizable-ebooks.test.ts
```

1. Convertible ebook detection, alias resolution, Calibre normalization, and Step 1 source/conversion metadata.
2. Step 2 `normalizedFrom` and `conversionChain` propagation after normalization.

Do not run hosted OCR, paid-provider, smoke, e2e, or full-suite tests for this ADR.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- `src/cli/commands/process-steps/step-0-metadata/`
- `src/cli/commands/process-steps/step-0-metadata/formats/metadata-convertible-ebooks.ts`
- `src/cli/commands/process-steps/step-0-metadata/metadata-sources/metadata-youtube-collection-target.ts`
- `src/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-collection.ts`
- `src/cli/commands/process-steps/step-1-download/document/dl-document.ts`
- `src/cli/commands/process-steps/step-1-download/audio/metadata-utils.ts`
- `src/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry/url-providers.ts`
- `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-result.ts`
- `src/types/document-processing/convertible-ebooks-types.ts`
- `src/utils/file-fingerprint-cache.ts`
- `test/test-cases/validation/extract-ocr/epub-contracts/normalizable-ebooks.test.ts`
