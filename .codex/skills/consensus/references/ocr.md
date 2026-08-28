# OCR Consensus

Use this category for AutoShow OCR runs with `providers/*/result.json`.

## Packet

```bash
bun scripts/run.ts ocr build-packet "$RUN_DIR" --out "$TMP_PACKET"
```

Build the packet before authoring the reference. Author `consensus-extraction.txt` from the full multi-provider packet evidence as the reconciled consensus extraction. Do not copy `prompt.md`, a provider extraction, provider summary, or any single provider output as the consensus extraction.

The packet includes page-level consensus diagnostics under `pageAnalysis`: selected provider per page, confidence scores, outlier signals, selective adjudication candidates, and a page-level hybrid variant summary. Use these diagnostics to focus manual review on flagged pages instead of copying a single provider.

Write the artifact as plain text. For multi-page documents, keep `--- Page N ---` delimiters. Do not add report notes or commentary to the extraction file.

## Report

```bash
bun scripts/run.ts ocr build-report "$RUN_DIR"
```

To use a non-default consensus extraction artifact path:

```bash
bun scripts/run.ts ocr build-report "$RUN_DIR" --input-text /path/to/consensus-extraction.txt
```

The OCR report uses full grouped metric rankings:

1. `## Metric Rankings` contains Local and Third-Party Service groups.
2. Each group contains full Price, Speed, and Quality Score tables.
3. JSON exposes `metricRankings.local.price|speed|qualityScore`.
4. JSON exposes `metricRankings.thirdPartyService.price|speed|qualityScore`.
5. The single-run JSON does not emit `rankingSurfaces`, `overall`, `overallMetric`, `overallWeights`, or `tiering`; combined cross-run reports keep the same per-group metric rankings and add no weighted composites or model tiers (see Combined Cross-Run Report).

Quality Score rankings use the existing WER-derived score from highest to lowest, with WER and CER retained as evidence. Price rankings use zero monetary cost for local OCR providers and reported cost for third-party services, keeping missing service price at the end. Speed rankings keep missing timing at the end.

`build-report` also emits OCR consensus skill artifacts beside the provider report:

1. `page-metrics.json` with page-level provider selection, confidence scores, pairwise WER/CER disagreement, and artifact flags.
2. `outliers.json` with blank-output, repeated-text, major length-drift, high-disagreement, WER/CER-divergence, and low-confidence page lists.
3. `selective-adjudication-pages.json` with the pages recommended for adjudication and the reasons each page was flagged.
4. `variant-comparison-summary.json` with the current consensus and page-level hybrid variant stats plus pairwise distance when a consensus artifact is available.
5. `ocr-benchmark-summary.md` with a short human-readable summary of page-level hybrid sources, outlier counts, adjudication candidates, and variant distances.

These are repo-local consensus-skill artifacts only. They do not add production CLI flags or public APIs, and they must be generated from existing provider artifacts unless the user separately approves an exact paid provider rerun.

On a category root such as `docs/benchmarks/ocr`, run `compact-archive` before the combined report. It strips duplicated `providers[].result` payloads from each run `manifest.json` when `result.json` exists, minifies `provider-comparison-report.json`, `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and the archive-root `combined-comparison-report.json`, rewrites absolute run paths in those files to run-relative paths, deletes regenerable `page-inputs/` trees, and deletes per-page resume checkpoints (`providers/*/page-results/`, `fallback-state.json`, `partial-extraction.txt`) once the sibling `result.json` exists. Failed providers without `result.json` keep those checkpoints, including invalid-response files. Markdown reports stay pretty-printed. See `references/shared-conventions.md`.

## Combined Cross-Run Report

To aggregate every per-run `provider-comparison-report.json` under a root directory into one provider leaderboard:

```bash
bun scripts/run.ts ocr build-combined-report "$ROOT_DIR"
```

`$ROOT_DIR` is the parent directory holding the run subdirectories (for example `docs/benchmarks/ocr`). The script discovers each subdirectory that contains a `provider-comparison-report.json`, reads its `page-metrics.json` for the run's page count, matches providers by `providerKey`, and aggregates across the runs each provider appears in:

1. Quality score: unweighted mean of the per-run `metrics.score`, ranked highest first. Weighted WER and weighted CER (summed breakdown errors over summed reference counts) are retained as evidence.
2. Speed: aggregate pages per minute — `sum(pageCount) / sum(processingTimeMs / 60000)` — ranked highest first, missing timing last.
3. Price: USD per 100 pages — `sum(costCents) / sum(pageCount)` — ranked lowest first, local providers at zero, missing cost last.

Output is written to `$ROOT_DIR/combined-comparison-report.json` (schema v3), `combined-comparison-report.md`, and `combined-comparison-report.html`. The `.html` is a self-contained dashboard (all data embedded, inline CSS, zero third-party dependencies, works from `file://`) consolidating the same per-group metric rankings. The report follows the same group split as single-run reports (`local`, `thirdPartyService`) — local and service providers are never ranked against each other — and emits no weighted composites, model tiers, cross-group overall, or `rankingSurfaces` leaderboard. The hand-authored `2026-06-14_combined-provider-comparison-report.md` predates this command and is preserved as a historical record.
