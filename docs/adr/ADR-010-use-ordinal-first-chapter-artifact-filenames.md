# ADR-010: Use Ordinal-First Chapter Artifact Filenames

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-12
- **Date Updated:** 2026-07-23
- **Verification Status:** Passed

## Context

Chapter artifact filenames currently encode ordering differently by source format. Native EPUB chapter export already starts with the logical chapter ordinal, such as `chapters/01-title.txt`. PDF chapter export starts with the source PDF page, such as `chapters/011-title.txt`. That mismatch makes mixed EPUB/PDF output harder to scan, sort, document, and test because the first filename token sometimes means logical order and sometimes means source position.

Only native EPUB/ebook extraction and PDF chapter detection currently emit `chapters/` side artifacts. Other OCR, office, image, CSV, URL, and STT routes do not create chapter files directly.

Why now: PDF chapter detection now has enough artifact coverage that the public path contract should be made explicit before more users and tests depend on source-page-first PDF names.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Unified ordinal-first plus source-locator naming: `NN-PPP-title` / `NN-III-title`** | Makes every chapter-producing extractor sort by logical order first; keeps source traceability; gives PDF and EPUB one documented contract | Changes public artifact paths and requires docs/tests updates | Applies to the 2 current direct `chapters/` producers: EPUB native text and PDF chapter detection |
| PDF-only change, leaving EPUB as `NN-title` | Fixes PDF sorting while minimizing EPUB churn | Keeps source-locator information absent from EPUB names; leaves two filename shapes to document | 1 producer changed, 1 producer unchanged |
| Placeholder locator for EPUB: `NN-000-title` | Gives PDF and EPUB the same token count | `000` is not a real locator and trains users to ignore the field | Adds a synthetic value to every EPUB chapter artifact |
| No change | Avoids path churn | Preserves inconsistent first-token meaning and source-page-first PDF sorting | No implementation cost |

## Decision

Adopt `chapters/<ordinal>-<source-locator>-<slug>.txt` for every chapter producer. PDF uses `pdfStartPage` as the source locator. EPUB uses the first original source/spine section index when available, otherwise the logical section index.

Both ordinal and split-part fields use dynamic width: 2 digits below 100 generated files and 3 digits at 100 or more generated files. Source locator fields are padded to at least 3 digits and are never truncated. Split files append `-part-NN` to the same ordinal-first/source-locator base name.

This applies to:

- Native EPUB/ebook chapter files under `chapters/`.
- PDF chapter-detection files under `chapters/`.
- Split chapter parts produced by `--length <n>`.

It does not apply to:

- Legacy `chunks/` artifacts.
- Non-EPUB/non-PDF extraction routes that do not directly create chapter files.
- Existing generated output directories; reruns can recreate artifacts with the new names.

## API / Type Impact

- No new CLI flag.
- No metadata schema change.
- The public artifact path contract changes from mixed `NN-title` and `PPP-title` forms to `NN-PPP-title` / `NN-III-title` forms.
- Documentation and tests that assert chapter artifact paths must use the new contract.

## Audit

- PDF chapter artifact names are owned by `src/cli/commands/process-steps/step-2-extract/step-2-ocr/pdf/ocr-chapters/ocr-chapter-artifacts.ts`.
- EPUB chapter artifact names are owned by `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ebook/epub/export.ts`.
- The shared writer in `src/cli/commands/process-steps/step-2-extract/step-2-ocr/process-ocr.ts` only persists each `TextArtifactFile.relativePath`.
- No other direct `chapters/` producers were found.

Robustness improvements:

- Centralize chapter artifact filename construction in a shared helper.
- Add collision handling for exact duplicate generated paths.
- Add PDF filename tests.
- Document that the source locator means PDF page for PDF and EPUB source/spine section index for EPUB.

## Rationale

- Logical ordinal first makes filesystem sorting match reading order for both EPUB and PDF.
- Keeping the source locator in the second token preserves the debugging value of PDF page numbers and EPUB source section positions.
- A real EPUB source locator is clearer than a placeholder `000` and avoids a field that users must learn to ignore.
- Centralizing filename construction prevents PDF and EPUB from drifting again as split, width, and collision behavior evolve.

## Consequences

Positive outcomes:

- EPUB and PDF chapter files share one documented filename shape.
- Chapter files sort by logical order even when PDF source pages skip front matter.
- Source location remains visible in the path without requiring `manifest.json`.
- Split parts continue sorting after their parent chapter base name.

Negative outcomes:

- Existing scripts that expect `chapters/011-title.txt` or `chapters/01-title.txt` must be updated.
- EPUB filenames become longer.
- Existing generated outputs are not migrated in place.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| One chapter artifact naming contract | Public path churn |
| Reading order sorts first | Longer EPUB filenames |
| Source locator remains visible | Tests and docs need updates |
| Shared helper prevents producer drift | A small shared dependency between EPUB and PDF export |

## Implementation Note

| Action | Owner | Current State |
|---|---|---|
| Add a shared chapter artifact filename helper used by EPUB and PDF builders | OCR maintainers | Implemented in `src/cli/commands/process-steps/step-2-extract/step-2-ocr/chapter-artifact-filenames.ts` |
| Preserve existing slug cleanup and fallback behavior in each producer | OCR maintainers | Implemented in `ebook/epub/export.ts` and `pdf/ocr-chapters/ocr-chapter-artifacts.ts` |
| Preserve dynamic ordinal width and split `-part-NN` suffixes | OCR maintainers | Implemented in `chapter-artifact-filenames.ts` |
| Update docs that describe chapter artifacts | OCR maintainers | Implemented in `docs/commands/process-steps/step-2-extract/03-extract-ocr.md` |
| Add local/no-cost tests for PDF, EPUB, 100+ widths, split sorting, and slug collision behavior | OCR maintainers | Implemented in `test/test-cases/validation/extract-ocr/` |

## References

- `src/cli/commands/process-steps/step-2-extract/step-2-ocr/chapter-artifact-filenames.ts`
- `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ebook/epub/export.ts`
- `src/cli/commands/process-steps/step-2-extract/step-2-ocr/pdf/ocr-chapters/ocr-chapter-artifacts.ts`
- `test/test-cases/validation/extract-ocr/chapter-artifact-filenames.test.ts`
- `test/test-cases/validation/extract-ocr/epub-contracts/chapter-prefixes.test.ts`
- `test/test-cases/validation/extract-ocr/ocr-resilience-contracts/pdf-chapter-detection.test.ts`
