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

When the user requests evaluation against an independent publisher reference, preserve that reference rather than deriving gold from provider outputs. Declare its provenance in the run's `manifest.json` as a top-level `reference` object:

```json
{
  "reference": {
    "kind": "publisher-canonical",
    "path": "input/examples/document/example/canonical-reference.txt",
    "sha256": "<64 hexadecimal characters, hashing the exact reference file bytes>",
    "sourceUrl": "https://publisher.example/reference",
    "sourceRevision": "<pinned publisher revision>",
    "description": "<source annotation selector and deterministic conversion policy>"
  }
}
```

The path must be normalized and relative to the repository root. Report generation resolves this declared reference by default and verifies its exact SHA-256 before scoring; an explicit `--input-text` must match the declared path. Missing provenance fields, mismatched paths and changed reference bytes are rejected. Generated reports add `referenceProvenance.independentOfProviders: true`, label the source as a publisher canonical reference and use the `publisher-canonical` diagnostic variant. Existing runs without a declaration retain the consensus workflow and its labels. Diagnostic provider agreement never changes independently supplied gold.

Keep restricted source images, publisher text, packets and text-bearing provider results in ignored local storage. Use `--markdown-out` and `--json-out` to write metric-only reports into the benchmark archive; analysis sidecars follow the JSON output directory. The legacy `consensusExtractionPath` field remains a compatibility path field and points to the declared publisher reference for these runs.

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

On a category root such as `docs/benchmarks/text/ocr`, run `compact-archive` before the combined report. It strips duplicated `providers[].result` payloads from each run `manifest.json` when `result.json` exists, minifies `provider-comparison-report.json`, `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and the archive-root `combined-comparison-report.json`, rewrites absolute run paths in those files to run-relative paths, deletes regenerable `page-inputs/` trees, and deletes per-page resume checkpoints (`providers/*/page-results/`, `fallback-state.json`, `partial-extraction.txt`) once the sibling `result.json` exists. For document-route extract items it also removes stored `metadata.step2` only when every entry is an exact duplicate of the complete multiset of nonempty successful provider metadata. The canonical reader derives `step2` from the retained provider records, so page evidence, costs, usage and successful/failed provider metadata remain available. Unique or mismatched copies and zero-success items are preserved. Failed providers without `result.json` keep their checkpoints, including invalid-response files. Markdown reports stay pretty-printed. See `references/shared-conventions.md`.

## Combined Cross-Run Report

To aggregate every per-run `provider-comparison-report.json` under a root directory into one provider leaderboard:

```bash
bun scripts/run.ts ocr build-combined-report "$ROOT_DIR"
```

`$ROOT_DIR` is the parent directory holding the run subdirectories (for example `docs/benchmarks/text/ocr`). The script discovers each subdirectory that contains a `provider-comparison-report.json`, reads its `page-metrics.json` for the run's page count, matches providers by `providerKey`, and aggregates across the runs each provider appears in:

1. Quality score: unweighted mean of the per-run `metrics.score`, ranked highest first. Weighted WER and weighted CER (summed breakdown errors over summed reference counts) are retained as evidence.
2. Speed: aggregate pages per minute — `sum(pageCount) / sum(processingTimeMs / 60000)` — ranked highest first, missing timing last.
3. Price: USD per 100 pages — `sum(costCents) / sum(pageCount)` — ranked lowest first, local providers at zero, missing cost last.

Output is written to `$ROOT_DIR/combined-comparison-report.json` (schema v3) and `combined-comparison-report.md`. The visual surface is the repository-level `docs/benchmarks/combined-comparison-dashboard.html`, written by `build-combined-dashboard` and rebuilt automatically after a `build-combined-report` under `docs/benchmarks`: a zero-dependency page (data in the sibling `combined-comparison-dashboard.json`, stylesheet and script generated beside it, all named by relative path, rendered in the browser from an HTTP origin) with one tab per combined-report root, consolidating the same per-group metric rankings. Each group's sort control also offers `Custom`, three sliders sharing one 100% budget that rescore that group in the browser; it changes no emitted artifact. The report follows the same group split as single-run reports (`local`, `thirdPartyService`) — local and service providers are never ranked against each other — and emits no weighted composites, model tiers, cross-group overall, or `rankingSurfaces` leaderboard. The hand-authored `2026-06-14_combined-provider-comparison-report.md` predates this command and is preserved as a historical record.
