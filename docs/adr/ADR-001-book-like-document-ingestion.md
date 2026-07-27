# ADR-001: Normalize and Fulfill Book-Like Inputs into EPUB/PDF Before Extraction

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-07-24
- **Verification Status:** Passed
- **Supersession:** Consolidates the separate ACSM fulfillment record, "Add ACSM Support with Calibre ACSM Plugin", merged here on 2026-07-24.

## Context

AutoShow has one mature document extraction implementation, and it reads exactly two container types: EPUB and PDF. The EPUB path covers TOC/spine inspection, EPUB text cleanup, automatic chapter export, `--no-chapters`, `--length <n>`, and JSON inspection through the Bun EPUB reader; the PDF path covers page extraction and the local/hosted OCR behavior. Everything else that a user thinks of as "a book" arrives in some other container, so Step 0/1 is the single place where a book-like input is converted into an EPUB or PDF before Step 2 runs.

Two source classes need that conversion, and they need it for different reasons.

Convertible ebook formats. Several ebook formats are closer to EPUB than to PDF/image OCR workflows, but treating each format separately would duplicate chapter logic and increase maintenance. Step 1 has an explicit convertible ebook registry for MOBI/AZW/AZW3/FB2/LIT/PRC inputs, runs Calibre `ebook-convert` into a temporary EPUB, records the original source format and conversion chain, and passes the normalized EPUB into Step 2. Step 2 preserves `normalizedFrom` and `conversionChain` metadata during EPUB extraction and inspection.

ACSM fulfillment documents. ACSM files are different from every other input in this class: they are Adobe Content Server fulfillment documents, not the final book files. Turning an ACSM into an EPUB or PDF requires a user-authorized fulfillment flow that can contact Adobe or distributor servers and may produce DRM-protected output. The resulting EPUB/PDF can then use AutoShow's existing document extraction behavior, but the ACSM itself must never be treated as directly extractable text. The trade study in `docs/report/acsm-support-report.md` identified several reader-side paths: `libgourou`, the Calibre ACSM Input plugin / DeACSM, Adobe Digital Editions / ByteBooks, online ACSM services, and commercial desktop converters. The deeper plugin notes in `docs/report/calibre-acsm-plugin-docs.md` show that the Calibre plugin can fulfill ACSM files without requiring Adobe Digital Editions, supports multiple authorization paths, and also exposes standalone scripts such as `fulfill.py`.

Why now: both halves are implemented in the current project state — Calibre-backed ebook normalization at the Step 1 boundary and setup-managed ACSM fulfillment through `calibre-acsm-fulfill` — and they share one ingestion contract, one explicit-registry rule, and one conversion-metadata shape. Recording them as one decision keeps that contract in a single place instead of splitting it across two records that must be read together.

## Options Considered

### Convertible Ebook Formats

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Normalize supported convertible ebooks to EPUB with existing Calibre `ebook-convert`** | Reuses native EPUB chapter extraction; keeps one implementation for TOC/spine/chunk behavior; avoids new package dependencies; keeps default path local and no-cost | Requires Calibre; conversion quality depends on Calibre; DRM or malformed inputs can fail before extraction | Accepted and implemented; 4 canonical formats plus 2 aliases; 0 package dependencies; 1 local subprocess per normalized ebook |
| Add one-off AZW3 handling | Smallest immediate implementation | Leaves MOBI, AZW, FB2, LIT, and PRC inconsistent; creates precedent for per-format branches | Lower short-term scope but misses the broader ebook class |
| Implement native parsers per ebook format | Avoids an external conversion tool | High maintenance; inconsistent chapter semantics; more edge cases around metadata and navigation | High code cost across at least 4 formats |
| Convert ebooks to PDF and use OCR/chapter detection | Reuses PDF path | Lower fidelity; slower; can enter OCR provider paths when provider flags are selected | Higher CPU cost and possible paid-provider risk under OCR selections |
| Add ebook parsing libraries | Could provide direct parsing for some formats | Adds dependencies; still leaves format-specific behavior and DRM failures | Rejected under the no-new-dependency constraint |

### ACSM Fulfillment

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Calibre ACSM Input plugin / DeACSM** | Aligns with AutoShow's existing Calibre ebook dependency; turns ACSM into EPUB/PDF without requiring Adobe Digital Editions; supports Adobe ID authorization, anonymous authorization, ADE activation import, activation backups, and standalone `fulfill.py`; can be framed as local user-authorized preprocessing before the existing pipeline | Less headless than a purpose-built CLI tool; authorization state is sensitive; DRM may still require user-managed DeDRM/key handling; plugin is GPLv3, so setup-managed download and redistribution boundaries must stay explicit | Chosen and implemented through setup-managed plugin download, Python environment, and `calibre-acsm-fulfill` wrapper; fulfillment is local but may contact Adobe/distributor servers |
| `libgourou` | Strong CLI-native fit; includes `acsmdownloader <ACSM_FILE>` and `adept_activate`; designed around ADEPT/ACSM fulfillment | Adds a separate ACSM-specific toolchain beside Calibre; pushes AutoShow toward managing ADEPT activation state directly; less aligned with current ebook normalization dependency | Not chosen; viable fallback if plugin integration proves unsuitable |
| Adobe Digital Editions / ByteBooks | Official/manual fulfillment route; familiar to ACSM ebook users; produces EPUB/PDF files that users can pass to AutoShow afterward | Desktop/manual workflow; not a clean CLI integration; authorization branding is changing from Adobe ID to ByteBooks in some flows; may require users to locate downloaded files themselves | Manual workaround remains documented outside the CLI conversion path |
| Online ACSM services | Low setup for users; may appear convenient for one-off conversion | Rejected because ACSM files can contain fulfillment/license data and the service may retrieve the actual book; no acceptable default for silently uploading user ACSM files | 0 integration surface; do not use for AutoShow automation |
| Commercial desktop converters | Packaged user experience; some can work with ADE libraries and converted outputs | Rejected for poor CLI fit, commercial licensing, desktop automation fragility, and frequent dependence on ADE-managed libraries | 0 integration surface |

## Decision

No raw book container other than EPUB and PDF is directly extractable. Every supported book-like input is converted at the Step 1 boundary into a temporary EPUB or a fulfilled EPUB/PDF, and only that normalized file enters Step 2 extraction. A format must be registered before conversion is attempted; AutoShow must not broadly probe unknown extensions.

Two conversion paths implement that rule.

Convertible ebooks. Explicitly registered non-EPUB ebook inputs are normalized to a temporary EPUB with Calibre `ebook-convert`, then routed through the existing native EPUB extraction and chapter export path. Canonical detected formats are `mobi`, `azw3`, `fb2`, and `lit`, with `.azw` treated as `azw3` and `.prc` as `mobi`. The registry lives in `convertible-ebooks.ts`.

ACSM. ACSM fulfillment is a local, user-authorized preprocessing step that produces an EPUB or PDF, which then reuses the existing EPUB/PDF extraction pipeline. `bun autoshow setup --step calibre` installs the usual document tools and ACSM fulfillment support. `bun autoshow setup --step acsm` installs only the ACSM pieces: a pinned Calibre ACSM Input plugin ZIP extracted under `runtime/tools/acsm-calibre-plugin`, a managed Python environment for the standalone scripts, `calibre-acsm-fulfill`, and `calibre-acsm-authorize`. AutoShow resolves `calibre-acsm-fulfill` from `--bin-dir` first, then the setup-managed `runtime/bin` wrapper, then `PATH`, and invokes:

```bash
calibre-acsm-fulfill <input.acsm> <output-dir>
```

The wrapper must write exactly one `.epub` or `.pdf` into `<output-dir>` and exit `0`.

This applies to:

- Canonical convertible formats `mobi`, `azw3`, `fb2`, `lit`, and the aliases `.azw` as `azw3` and `.prc` as `mobi`.
- Default extraction of `epub-text` after ebook normalization.
- EPUB features after normalization: automatic `chapters/`, `--no-chapters`, `--length <n>`, and `--epub-bun --format json`.
- OCR provider flags after normalization: existing EPUB-to-PDF OCR behavior.
- `.acsm` recognition for local files, direct URLs, content-disposition filenames, and ACSM content-type hints.
- Documentation and setup guidance for setup-managed ACSM plugin scripts and user-managed activation state.
- User override integration with a custom `calibre-acsm-fulfill` on `--bin-dir` or `PATH` when the user wants another local Calibre plugin workflow.
- Metadata that records the original source format and the normalized EPUB/PDF for both conversion paths.
- `--price` behavior that does not fulfill ACSM files and notes that page-priced OCR estimates are omitted until a fulfilled EPUB/PDF exists.

It does not apply to:

- Treating raw `.acsm` files as directly extractable text, PDF pages, EPUB chapters, or OCR images.
- Attempting conversion of unregistered extensions, or uploading any input to online converters or remote conversion services.
- Modifying the GPLv3 plugin source inside AutoShow. Setup downloads the pinned upstream plugin release instead of vendoring edited plugin code in the repository.
- Automating DRM removal. Users remain responsible for lawful access, authorization, and any DeDRM/key handling needed to read their fulfilled books.
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
- Setup/help text distinguishes Calibre `ebook-convert`, setup-managed ACSM plugin scripts, and user-controlled activation state.

## Rationale

- The project already has one strong EPUB/PDF extraction implementation. Converting at Step 1 keeps chapter and inspection behavior consistent without adding parser dependencies or creating parallel extraction paths.
- Keeping the registry explicit prevents unrelated file types from being silently sent to Calibre, while the metadata fields make every conversion transparent to downstream manifests and reports.
- AutoShow already depends on Calibre for ebook normalization, so a Calibre-centered ACSM path fits the existing dependency story better than introducing an independent ACSM stack as the primary option.
- The ACSM plugin avoids requiring Adobe Digital Editions as the fulfillment application while still supporting Adobe ID authorization, anonymous authorization, ADE activation import, activation backups, and standalone script usage.
- The plugin output is an EPUB or PDF, which means the extraction side reuses the mature pipeline instead of adding ACSM-specific text extraction behavior.
- Setup-managed plugin download keeps the normal user path one command away from use, while sensitive activation files remain under the user's local runtime directory and are never copied into manifests.
- The plugin's GPLv3 license is handled as an external setup-time download from the upstream release. AutoShow does not vendor edited plugin code in the repository.
- Online ACSM converters are not acceptable automation targets because the ACSM file can carry license and fulfillment data, and the conversion service may retrieve the book.

## Consequences

Positive outcomes:

- MOBI, AZW/AZW3, FB2, LIT, and PRC inputs get consistent EPUB-style extraction, and ACSM files become EPUB/PDF files that reuse the same behavior.
- Native chapter behavior remains centralized in the EPUB extractor.
- The default path remains local and no-cost.
- Step 1 metadata records `sourceFormat`, `normalizedFormat`, and `conversionChain`; Step 2 metadata records `normalizedFrom` and `conversionChain`, making the original source and conversion chain auditable.
- Future normalizable formats can be added through one registry and focused tests.
- Users are not required to install Adobe Digital Editions just to fulfill ACSM files.
- Authorization setup choices remain visible to the user instead of hidden inside AutoShow.

Negative outcomes:

- Users need Calibre available through setup or `AUTOSHOW_EBOOK_CONVERT_BIN`.
- Conversion and fulfillment failures are delegated to Calibre and occur before extraction begins.
- DRM-protected ebooks remain unsupported, and DRM-protected fulfilled books may still require user-managed DeDRM/key handling.
- The normalized EPUB is temporary, so debugging conversion output requires rerunning with local inspection if needed.
- ACSM setup is less headless than `libgourou` because users may need to install and configure a Calibre plugin and activation state.
- Adobe ID, anonymous activation, ADE-imported activation, and backup ZIP files are sensitive local state that AutoShow must not casually copy into run artifacts or logs.
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
| No Adobe Digital Editions application requirement | Users still manage plugin setup and authorization |
| Local, user-controlled fulfillment | AutoShow must carefully avoid persisting activation secrets |
| Avoids online ACSM uploads | No one-click hosted ACSM conversion path |

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Keep Step 1 normalization as the canonical ebook-to-EPUB conversion boundary | Extraction maintainer | Implemented in `step-1-download/document/dl-document.ts` |
| Keep the convertible ebook registry explicit | Extraction maintainer | Implemented in `step-1-download/document/convertible-ebooks.ts` |
| Add `.acsm` detection and route it as document input | Document extraction maintainers | Implemented |
| Use a local preprocessing command instead of Calibre import automation | Document extraction maintainers | Implemented as `calibre-acsm-fulfill` |
| Add a local conversion boundary that accepts ACSM input and returns a fulfilled EPUB/PDF path without exposing activation secrets in logs or artifacts | Document extraction maintainers | Implemented |
| Add setup-managed ACSM plugin download, Python env, fulfillment wrapper, and authorization helper | Setup maintainers | Implemented as `bun autoshow setup --step acsm`, included by `bun autoshow setup --step calibre` |
| Preserve Step 1 conversion metadata for both chains: `sourceFormat`, `normalizedFormat`, and `conversionChain` of `["calibre"]` or `["calibre-acsm-plugin"]` | Extraction maintainer | Implemented and covered by normalizable ebook and ACSM contract tests |
| Preserve Step 2 `normalizedFrom` and `conversionChain` metadata | Extraction maintainer | Implemented in OCR result metadata and covered by contract tests |
| Keep provider/OCR behavior unchanged after normalization | Extraction maintainer | Implemented; hosted OCR still uses existing EPUB-to-PDF path when OCR flags are selected |
| Document the Calibre ACSM Input plugin setup path, wrapper contract, authorization state, and limitations | Docs maintainers | Implemented |
| Keep ACSM fulfillment out of hosted OCR/STT/TTS provider execution and paid-provider approval logic | CLI maintainers | Implemented; `--price` does not fulfill ACSM |
| Reject online ACSM converter integration and avoid silently uploading ACSM files | CLI maintainers | Implemented by omission and docs |
| Add future ebook formats only with registry and no-cost contract coverage | Extraction maintainer | Ongoing guardrail |
| Add licensing review before vendoring or modifying GPLv3 plugin code in-repo | Maintainers | Ongoing guardrail |

## Test Plan

Local/no-cost contract tests cover:

- Convertible ebook detection, alias resolution, Calibre normalization, and Step 1 source/conversion metadata.
- `.acsm` local, URL path, content-disposition, and ACSM content-type classification.
- Missing `calibre-acsm-fulfill` setup errors.
- Setup command surface for `acsm`, doctor checks, generated local wrappers, and the Calibre setup contract.
- Fake wrapper fulfillment to EPUB and PDF with step 1 metadata.
- Zero and multiple fulfilled output contract failures.
- Step 2 `normalizedFrom` and `conversionChain` propagation after normalization and after mocked fulfillment.
- `--price` dry-run behavior that does not invoke fulfillment and notes omitted ACSM OCR estimates.
- Redaction/omission of fake activation/account/key paths from fulfillment failure messages.

Do not run live Adobe, distributor, hosted OCR, paid-provider, smoke, e2e, or full-suite tests for this ADR.

## References

- Trade study: `docs/report/acsm-support-report.md`
- Calibre plugin notes: `docs/report/calibre-acsm-plugin-docs.md`
- Convertible ebook registry: `src/cli/commands/process-steps/step-1-download/document/convertible-ebooks.ts`
- Metadata-side convertible ebook registry: `src/cli/commands/process-steps/step-0-metadata/formats/metadata-convertible-ebooks.ts`
- Step 1 document preparation and Calibre normalization: `src/cli/commands/process-steps/step-1-download/document/dl-document.ts`
- ACSM fulfillment wrapper boundary: `src/cli/commands/process-steps/step-1-download/document/acsm-fulfillment.ts`
- EPUB/PDF extraction entry point and metadata propagation: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/run-ocr.ts`
- OCR result metadata fields: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-result.ts`
- EPUB export implementation: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ebook/epub/export.ts`
- Normalizable ebook contracts: `test/test-cases/validation/extract-ocr/epub-contracts/normalizable-ebooks.test.ts`
- Calibre setup contract: `test/test-cases/validation/setup/setup-command-contracts.test.ts`
