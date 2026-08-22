# ADR-001: Define Source Ingestion and Normalization Policy

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed
- **Supersession:** URL execution moved to ADR-009, and pipeline state, resume, and dry-run planning belong to ADR-002. This record remains accepted authority for source classification, supported ebook normalization, discovery caches, and the normalized handoff to execution.

## Context

Source ingestion must answer what the input is, which route it requires, and which normalized input enters extraction, without owning provider execution or persistent run state. Input classification, source expansion, format hints, and route selection are command-neutral Step 0 concerns. Download-specific acquisition, normalization, raw downloader options, and source output writing are Step 1 concerns.

URL sources need one stable identity model before extraction. The shared provider registry owns URL backend identity, hosted/local grouping, configuration paths, shortcut expansion, provider-spec collection, and resume-selectable target identity. It does not own adapters, retries, provider responses, article normalization, or artifact writing.

Discovery repeats expensive but non-authoritative work across independent CLI processes: `yt-dlp` video and collection lookups, local `ffprobe` probes, and batch-list parsing. Best-effort temporary caches may accelerate that work only when fingerprints, payload validation, stable-source checks, serialized updates, private permissions, and atomic replacement preserve the same ingestion result.

AutoShow has one mature document extraction implementation, and only two of its input families carry chapter-aware book extraction: EPUB and PDF. The EPUB path covers TOC/spine inspection, text cleanup, automatic chapter export, and JSON inspection; the PDF path covers page extraction and local/hosted OCR. The other families it reads (DOCX/PPTX/XLSX/ODF, RTF, CSV, CBZ, and images) produce flat text or per-image OCR with no chapter semantics, so Step 0/1 is the single place where a book-like input in some other container becomes an EPUB or PDF before Step 2 runs.

Several ebook formats are closer to EPUB than to PDF/image OCR workflows, but treating each separately would duplicate chapter logic. These explicitly registered formats are normalized to EPUB before extraction.

Why now: supported ebook conversion, source routing, and discovery caching share one ingestion contract and one explicit-registry rule.

## Options Considered

### Convertible Ebook Formats

**Option 1 (selected)**

- **Option:** Normalize supported convertible ebooks to EPUB with Calibre `ebook-convert`
- **Pros:** Reuses native EPUB chapter extraction; one implementation for TOC/spine/chunk behavior; no new package dependencies; default path stays local and no-cost
- **Cons:** Requires Calibre; conversion quality depends on Calibre; DRM or malformed inputs fail before extraction
- **Quantitative Notes:** 4 canonical formats plus 2 aliases; 0 package dependencies; 1 local subprocess per normalized ebook

**Option 2**

- **Option:** Add one-off AZW3 handling
- **Pros:** Smallest immediate implementation
- **Cons:** Leaves MOBI, AZW, FB2, LIT, and PRC inconsistent; creates precedent for per-format branches
- **Quantitative Notes:** Misses the broader ebook class

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

Input classification, source expansion, format hints, and route selection belong to `step-0-metadata`. Download-specific acquisition, normalization, raw downloader options, and source output writing belong to `step-1-download`. These stages produce the normalized, explicitly routed inputs consumed by execution without owning the canonical batch work plan or provider progress.

The shared provider registry owns URL backend identity, hosted/local grouping, configuration paths, shortcut expansion, provider-spec collection, and resume-selectable targets. `article` and `x-space` remain distinct explicit source routes and are never inferred from one another.

### Discovery cache ownership and correctness

Discovery caches reusable metadata in JSON files under the operating-system temporary directory:

- `getVideoInfo` caches validated `yt-dlp` video information by URL so a remote lookup normally executes at most once across CLI processes.
- YouTube collection discovery caches the normalized, de-duplicated item list by collection URL.
- `extractLocalFileMetadata` caches validated `ffprobe` results by resolved local path in `autoshow-local-file-metadata-cache.json`.
- `readInputList` caches parsed batch targets by resolved path in `autoshow-batch-list-cache.json`.

The local-file and batch-list caches are correctness-preserving accelerators, never source-of-truth state. Entries include stable file fingerprints covering device, inode, modification time, change time, and size; a hit requires the current fingerprint to match. Producers fingerprint before and after parsing or probing and write only when the source remained stable. Cached payloads are shape-checked before reuse.

Shared asynchronous JSON-cache updates take a process lock, re-read while holding it, write a mode-`0600` temporary file, and atomically rename it into place. Read, parse, validation, and write failures degrade to a miss or uncached result. Remote collection caching is likewise best effort. These caches cannot change classification, metadata fallback, provider selection, normalized output, or canonical pipeline state.

### Book-like normalization

No raw book container other than EPUB and PDF gets chapter-aware extraction. Every supported convertible book input is converted at the Step 1 boundary into a temporary EPUB, and only that normalized file enters Step 2 extraction. A format must be registered before conversion is attempted; AutoShow must not broadly probe unknown extensions.

Convertible ebooks. Explicitly registered non-EPUB ebook inputs are normalized to a temporary EPUB with Calibre `ebook-convert`, then routed through the existing native EPUB extraction and chapter export path. Canonical detected formats are `mobi`, `azw3`, `fb2`, and `lit`, with `.azw` treated as `azw3` and `.prc` as `mobi`. Convertible formats are maintained in a single central registry (`src/cli/commands/process-steps/step-0-metadata/formats/metadata-convertible-ebooks.ts`) rather than probed dynamically.

ACSM is unsupported. AutoShow does not recognize, fulfill, authorize, or provision tooling for `.acsm`; users must provide a lawful readable EPUB or PDF, and existing activation files are left untouched.

This applies to:

- Canonical convertible formats `mobi`, `azw3`, `fb2`, `lit`, and the aliases `.azw` as `azw3` and `.prc` as `mobi`.
- Default extraction of `epub-text` after ebook normalization.
- EPUB features after normalization: automatic chapter export, length truncation, and JSON inspection.
- OCR provider flags after normalization: existing EPUB-to-PDF OCR behavior.
- Metadata that records the original source format and normalized EPUB for supported ebook conversion.

It does not apply to:

- Attempting conversion of unregistered extensions, or uploading any input to online converters or remote conversion services.
- Automating DRM removal. Users remain responsible for lawful access, authorization, and any key handling needed to read their fulfilled books.
- Changing paid-provider execution rules. Supported ebook normalization is local preprocessing.

## API / Type Impact

Supported ebook conversion writes standard Step 1 conversion metadata fields that Step 2 extraction preserves:

**Source class 1: Convertible ebook**

- **Source class:** Convertible ebook
- **`sourceFormat`:** `mobi` \| `azw3` \| `fb2` \| `lit` (after alias resolution)
- **`normalizedFormat`:** `epub`
- **`conversionChain`:** `["calibre"]`

- `ConvertibleEbookFormat` type union defines explicitly supported convertible formats (`mobi`, `azw3`, `fb2`, `lit`).
- Step 2 extraction result metadata records `normalizedFrom` (the original source format) and `conversionChain` for downstream manifest transparency.

## Rationale

- The project already has one strong EPUB/PDF extraction implementation. Converting at Step 1 keeps chapter and inspection behavior consistent without adding parser dependencies or parallel extraction paths.
- Keeping the registry explicit prevents unrelated file types from being silently sent to Calibre, while the metadata fields make every conversion transparent to downstream manifests and reports.

## Consequences

Positive outcomes:

- URL, OCR, and STT selection share one registry-backed source identity model without centralizing execution, and metadata, download, extract, and write consume one command-neutral classification and expansion result.
- Repeated remote discovery, local probing, and batch-list parsing reuse validated best-effort caches across CLI processes, while fingerprints, stable-source checks, shape validation, locking, private temporary files, and atomic replacement prevent cache acceleration from becoming source authority.
- MOBI, AZW/AZW3, FB2, LIT, and PRC inputs get consistent EPUB-style extraction, and native chapter behavior remains centralized in the EPUB extractor.
- The default normalization path remains local and no-cost.
- Step 1 metadata records `sourceFormat`, `normalizedFormat`, and `conversionChain`; Step 2 metadata records `normalizedFrom` and `conversionChain`, making the original source and conversion chain auditable.
- Future normalizable formats can be added through one registry and focused tests.

Negative outcomes:

- Temporary discovery caches add a small disk-state and maintenance surface; misses still perform the original discovery work.
- Users need Calibre available through the setup-managed runtime or an explicit supported override, and conversion failures are delegated to Calibre before extraction begins.
- DRM-protected ebooks remain unsupported.
- The normalized EPUB is temporary, so debugging conversion output requires rerunning with local inspection.

## Trade-offs

**Trade-off 1**

- **Gain:** Broad book-like input support with minimal extraction code
- **Sacrifice:** No byte-level native parser for each ebook format

**Trade-off 2**

- **Gain:** One chapter export and EPUB inspection implementation
- **Sacrifice:** Calibre remains an external tool prerequisite

**Trade-off 3**

- **Gain:** No new runtime package dependencies
- **Sacrifice:** Unsupported Calibre-capable formats are not auto-tried until added to the registry

**Trade-off 4**

- **Gain:** Clear source-vs-normalized metadata for both conversion chains
- **Sacrifice:** Conversion fidelity depends on Calibre output

## Test Plan

Run default verification (`bun run check`) and local, no-cost contract validation suites:

```bash
bun run check
bun test test/test-cases/validation/extract-ocr/epub-contracts/normalizable-ebooks.test.ts
```

Local/no-cost contract tests cover:

- Convertible ebook detection, alias resolution, Calibre normalization, and Step 1 source/conversion metadata.
- Step 2 `normalizedFrom` and `conversionChain` propagation after normalization.

Do not run live Adobe, distributor, hosted OCR, paid-provider, smoke, e2e, or full-suite tests for this ADR.

## References

- Pipeline work-plan, state, resume, and dry-run authority: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Setup-managed toolchain, resolver, doctor, and help authority: [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)
- Extract execution and artifact authority: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- Command-neutral discovery: `src/cli/commands/process-steps/step-0-metadata/`
- URL provider identity: `src/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry/url-providers.ts`
- Shared fingerprint cache: `src/utils/file-fingerprint-cache.ts`
- Video and local-file metadata caches: `src/cli/commands/process-steps/step-1-download/audio/metadata-utils.ts`
- YouTube collection cache: `src/cli/commands/process-steps/step-0-metadata/metadata-sources/metadata-youtube-collection-target.ts`
- Batch-list cache: `src/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-collection.ts`
- Convertible ebook registry: `src/cli/commands/process-steps/step-0-metadata/formats/metadata-convertible-ebooks.ts`
- Convertible ebook types: `src/types/document-processing/convertible-ebooks-types.ts`
- Step 1 document preparation and Calibre normalization: `src/cli/commands/process-steps/step-1-download/document/dl-document.ts`
- EPUB/PDF extraction entry point and metadata propagation: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/run-ocr.ts`
- OCR result metadata fields: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-result.ts`
- EPUB export implementation: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ebook/epub/export.ts`
- Normalizable ebook contracts: `test/test-cases/validation/extract-ocr/epub-contracts/normalizable-ebooks.test.ts`
