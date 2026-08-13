# ADR-001: Define Source Ingestion and Normalization Policy

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-08-13
- **Verification Status:** Passed
- **Supersession:** Setup mechanics for the ACSM toolchain — plugin provisioning, managed runtime, wrappers, resolver precedence, doctor, and help — moved to ADR-004. URL execution moved to ADR-009, and pipeline state, resume, and dry-run planning belong to ADR-002. This record remains the authority on ingestion classification, normalization, and the fulfillment boundary.

## Context

Source ingestion must answer what the input is, which route it requires, and which normalized input enters extraction, without owning provider execution or persistent run state. Input classification, source expansion, format hints, and route selection are command-neutral Step 0 concerns. Download-specific acquisition, normalization, raw downloader options, and source output writing are Step 1 concerns.

URL sources need one stable identity model before extraction. The shared provider registry owns URL backend identity, hosted/local grouping, configuration paths, shortcut expansion, provider-spec collection, and resume-selectable target identity. It does not own adapters, retries, provider responses, article normalization, or artifact writing.

Discovery repeats expensive but non-authoritative work across independent CLI processes: `yt-dlp` video and collection lookups, local `ffprobe` probes, and batch-list parsing. Best-effort temporary caches may accelerate that work only when fingerprints, payload validation, stable-source checks, serialized updates, private permissions, and atomic replacement preserve the same ingestion result.

AutoShow has one mature document extraction implementation, and it reads exactly two container types: EPUB and PDF. The EPUB path covers TOC/spine inspection, text cleanup, automatic chapter export, `--no-chapters`, `--length <n>`, and JSON inspection through the Bun EPUB reader; the PDF path covers page extraction and local/hosted OCR. Everything else a user thinks of as "a book" arrives in some other container, so Step 0/1 is the single place where a book-like input becomes an EPUB or PDF before Step 2 runs.

Two source classes need that conversion, for different reasons. Several ebook formats are closer to EPUB than to PDF/image OCR workflows, but treating each separately would duplicate chapter logic. ACSM files are different from every other input: they are Adobe Content Server fulfillment documents, not the final book files. Turning an ACSM into an EPUB or PDF requires a user-authorized fulfillment flow that can contact Adobe or distributor servers and may produce DRM-protected output, so the ACSM itself must never be treated as directly extractable text.

Why now: both source classes are implemented and share one ingestion contract, one explicit-registry rule, and one conversion-metadata shape. This record owns what may enter the pipeline, the required fulfillment boundary, and the authorization/security policy; ADR-004 owns how setup provisions and diagnoses the selected tools.

## Options Considered

### Convertible Ebook Formats

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Normalize supported convertible ebooks to EPUB with Calibre `ebook-convert`** | Reuses native EPUB chapter extraction; one implementation for TOC/spine/chunk behavior; no new package dependencies; default path stays local and no-cost | Requires Calibre; conversion quality depends on Calibre; DRM or malformed inputs fail before extraction | 4 canonical formats plus 2 aliases; 0 package dependencies; 1 local subprocess per normalized ebook |
| Add one-off AZW3 handling | Smallest immediate implementation | Leaves MOBI, AZW, FB2, LIT, and PRC inconsistent; creates precedent for per-format branches | Misses the broader ebook class |
| Implement native parsers per ebook format | Avoids an external conversion tool | High maintenance; inconsistent chapter semantics; more metadata and navigation edge cases | High code cost across at least 4 formats |
| Convert ebooks to PDF and use OCR/chapter detection | Reuses PDF path | Lower fidelity; slower; can enter OCR provider paths when provider flags are selected | Higher CPU cost and possible paid-provider risk |
| Add ebook parsing libraries | Direct parsing for some formats | Adds dependencies; still leaves format-specific behavior and DRM failures | Rejected under the no-new-dependency constraint |

### ACSM Fulfillment

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Calibre ACSM Input plugin / DeACSM behind a local fulfillment interface** | Aligns with the existing Calibre dependency; produces EPUB/PDF without requiring Adobe Digital Editions; supports Adobe ID authorization, anonymous authorization, ADE activation import, and activation backups; frames as local user-authorized preprocessing | Less headless than a purpose-built CLI tool; authorization state is sensitive; DRM may still require user-managed key handling; GPLv3 installation and redistribution boundaries need explicit setup ownership | Implemented behind the `calibre-acsm-fulfill` interface; fulfillment is local but may contact Adobe/distributor servers |
| `libgourou` | CLI-native fit; purpose-built around ADEPT/ACSM fulfillment | Adds an ACSM-specific toolchain beside Calibre; pushes AutoShow toward managing ADEPT activation state directly | Not chosen; viable fallback if plugin integration proves unsuitable |
| Adobe Digital Editions / ByteBooks | Official fulfillment route; produces EPUB/PDF that users can pass to AutoShow afterward | Desktop/manual workflow; not a clean CLI integration; users must locate downloaded files themselves | Remains a documented manual workaround outside the CLI conversion path |
| Online ACSM services | Low setup for one-off conversion | ACSM files can carry fulfillment/license data and the service retrieves the actual book; no acceptable default for silently uploading user files | 0 integration surface; not used |
| Commercial desktop converters | Packaged user experience | Poor CLI fit; commercial licensing; desktop automation fragility; often depend on ADE-managed libraries | 0 integration surface |

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

### Book-like normalization and fulfillment

No raw book container other than EPUB and PDF is directly extractable. Every supported book-like input is converted at the Step 1 boundary into a temporary EPUB or a fulfilled EPUB/PDF, and only that normalized file enters Step 2 extraction. A format must be registered before conversion is attempted; AutoShow must not broadly probe unknown extensions.

Convertible ebooks. Explicitly registered non-EPUB ebook inputs are normalized to a temporary EPUB with Calibre `ebook-convert`, then routed through the existing native EPUB extraction and chapter export path. Canonical detected formats are `mobi`, `azw3`, `fb2`, and `lit`, with `.azw` treated as `azw3` and `.prc` as `mobi`. The single registry is `metadata-convertible-ebooks.ts`, which exports `CONVERTIBLE_EBOOK_FORMATS`, `CONVERTIBLE_EBOOK_FORMAT_LABEL`, and `isConvertibleEbookFormat`; `dl-document.ts` imports it directly, and `convertible-ebooks-types.ts` derives its type from that one array.

ACSM. ACSM fulfillment is a local, user-authorized preprocessing step that produces an EPUB or PDF, which then reuses the existing EPUB/PDF extraction pipeline. The ingestion boundary requires a local `calibre-acsm-fulfill` implementation and invokes:

```bash
calibre-acsm-fulfill <input.acsm> <output-dir>
```

The fulfillment command must write exactly one `.epub` or `.pdf` into `<output-dir>` and exit `0`. ADR-004 owns the setup steps, pinned plugin acquisition, managed Python environment, generated wrappers, resolver precedence, activation helper, doctor checks, and setup/help presentation that supply this interface. A user override may provide the same interface without changing this ingestion contract.

This applies to:

- Canonical convertible formats `mobi`, `azw3`, `fb2`, `lit`, and the aliases `.azw` as `azw3` and `.prc` as `mobi`.
- Default extraction of `epub-text` after ebook normalization.
- EPUB features after normalization: automatic `chapters/`, `--no-chapters`, `--length <n>`, and `--epub-bun --format json`.
- OCR provider flags after normalization: existing EPUB-to-PDF OCR behavior.
- `.acsm` recognition for local files, direct URLs, content-disposition filenames, and ACSM content-type hints.
- User-managed authorization and activation state, which must remain outside manifests, run artifacts, and logs.
- A custom local fulfillment implementation when it satisfies the same one-output command contract.
- Metadata that records the original source format and the normalized EPUB/PDF for both conversion paths.
- `--price` behavior that does not fulfill ACSM files and notes that page-priced OCR estimates are omitted until a fulfilled EPUB/PDF exists.

It does not apply to:

- Treating raw `.acsm` files as directly extractable text, PDF pages, EPUB chapters, or OCR images.
- Attempting conversion of unregistered extensions, or uploading any input to online converters or remote conversion services.
- Choosing how the GPLv3 plugin, managed Python environment, wrappers, or authorization helper are installed; those are ADR-004 setup concerns.
- Automating DRM removal. Users remain responsible for lawful access, authorization, and any key handling needed to read their fulfilled books.
- Changing paid-provider execution rules. Both ebook normalization and ACSM fulfillment are local preprocessing, although the authorized ACSM fulfillment process may contact Adobe or distributor servers.

## API / Type Impact

Both paths write the same three Step 1 conversion metadata fields, which Step 2 then preserves:

| Source class | `sourceFormat` | `normalizedFormat` | `conversionChain` |
|---|---|---|---|
| Convertible ebook | `mobi` \| `azw3` \| `fb2` \| `lit` (after alias resolution) | `epub` | `["calibre"]` |
| ACSM fulfillment | `acsm` | `epub` \| `pdf` | `["calibre-acsm-plugin"]` |

- `.acsm` is a recognized document input after local wrapper fulfillment.
- Missing `calibre-acsm-fulfill` fails with a clear setup error rather than falling through to PDF, EPUB, OCR, hosted provider, or online-service paths.
- Step 2 extraction sees only the normalized EPUB/PDF and uses the existing EPUB/PDF extraction behavior, including chapter export and OCR/provider handling where those already apply.
- Step 2 result metadata records `normalizedFrom` and `conversionChain` for both paths.

## Rationale

- The project already has one strong EPUB/PDF extraction implementation. Converting at Step 1 keeps chapter and inspection behavior consistent without adding parser dependencies or parallel extraction paths.
- Keeping the registry explicit prevents unrelated file types from being silently sent to Calibre, while the metadata fields make every conversion transparent to downstream manifests and reports.
- AutoShow already depends on Calibre, so a Calibre-centered ACSM fulfillment interface fits the existing dependency story better than an independent ACSM stack, and it avoids requiring Adobe Digital Editions while still supporting Adobe ID authorization, anonymous authorization, ADE activation import, and activation backups.
- Sensitive activation files remain user-controlled local state and are never copied into manifests or run artifacts; ADR-004 owns their setup and doctor treatment, including the external pinned-plugin download and GPLv3 installation boundary.
- Online ACSM converters are not acceptable automation targets because the ACSM file can carry license and fulfillment data, and the conversion service may retrieve the book.

## Consequences

Positive outcomes:

- URL, OCR, and STT selection share one registry-backed source identity model without centralizing execution, and metadata, download, extract, and write consume one command-neutral classification and expansion result.
- Repeated remote discovery, local probing, and batch-list parsing reuse validated best-effort caches across CLI processes, while fingerprints, stable-source checks, shape validation, locking, private temporary files, and atomic replacement prevent cache acceleration from becoming source authority.
- MOBI, AZW/AZW3, FB2, LIT, and PRC inputs get consistent EPUB-style extraction, ACSM files become EPUB/PDF files that reuse the same behavior, and native chapter behavior remains centralized in the EPUB extractor.
- The default path remains local and no-cost, and users are not required to use Adobe Digital Editions as the fulfillment application.
- Step 1 metadata records `sourceFormat`, `normalizedFormat`, and `conversionChain`; Step 2 metadata records `normalizedFrom` and `conversionChain`, making the original source and conversion chain auditable.
- Future normalizable formats can be added through one registry and focused tests.

Negative outcomes:

- Temporary discovery caches add a small disk-state and maintenance surface; misses still perform the original discovery work.
- Users need Calibre available through the setup-managed runtime or an explicit supported override, and conversion and fulfillment failures are delegated to Calibre before extraction begins.
- DRM-protected ebooks remain unsupported, and DRM-protected fulfilled books may still require user-managed key handling.
- The normalized EPUB is temporary, so debugging conversion output requires rerunning with local inspection.
- The selected Calibre plugin workflow is less headless than `libgourou` and may require user authorization or activation state before fulfillment.
- Adobe ID, anonymous activation, ADE-imported activation, and backup ZIP files are sensitive local state that AutoShow must not copy into run artifacts or logs.
- ACSM/library return behavior only applies to books downloaded through the plugin, not books downloaded through ADE or other tools.
- Fulfillment may depend on Adobe/distributor server availability and account policy even though it is not a paid AutoShow provider run.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Broad book-like input support with minimal extraction code | No byte-level native parser for each ebook format |
| One chapter export and EPUB inspection implementation | Calibre remains an external tool prerequisite |
| No new runtime package dependencies | Unsupported Calibre-capable formats are not auto-tried until added to the registry |
| Clear source-vs-normalized metadata for both conversion chains | Conversion fidelity depends on Calibre output |
| Reuse of the existing Calibre and EPUB/PDF extraction model for ACSM | Less clean headless ACSM automation than `libgourou` |
| No Adobe Digital Editions application requirement | Users still manage authorization; setup mechanics remain an ADR-004 concern |
| Local, user-controlled fulfillment that avoids online ACSM uploads | AutoShow must carefully avoid persisting activation secrets; no one-click hosted conversion path |

## Test Plan

Run default verification (`bun run check`) and local, no-cost contract validation suites:

```bash
bun run check
bun test test/test-cases/validation/extract-ocr/epub-contracts/normalizable-ebooks.test.ts
```

Local/no-cost contract tests cover:

- Convertible ebook detection, alias resolution, Calibre normalization, and Step 1 source/conversion metadata.
- `.acsm` local, URL path, content-disposition, and ACSM content-type classification.
- Missing `calibre-acsm-fulfill` setup errors.
- Fake wrapper fulfillment to EPUB and PDF with Step 1 metadata.
- Zero, 0-byte, and multiple fulfilled output contract failures.
- Step 2 `normalizedFrom` and `conversionChain` propagation after normalization and after mocked fulfillment.
- `--price` dry-run behavior that does not invoke fulfillment and notes omitted ACSM OCR estimates.
- Redaction/omission of fake activation/account/key paths from fulfillment failure messages.

Do not run live Adobe, distributor, hosted OCR, paid-provider, smoke, e2e, or full-suite tests for this ADR.

## References

- Pipeline work-plan, state, resume, and dry-run authority: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Setup-managed toolchain, ACSM provisioning, resolver, doctor, and help authority: [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)
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
- ACSM fulfillment wrapper boundary: `src/cli/commands/process-steps/step-1-download/document/acsm-fulfillment.ts`
- EPUB/PDF extraction entry point and metadata propagation: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/run-ocr.ts`
- OCR result metadata fields: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-result.ts`
- EPUB export implementation: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ebook/epub/export.ts`
- Normalizable ebook contracts: `test/test-cases/validation/extract-ocr/epub-contracts/normalizable-ebooks.test.ts`
