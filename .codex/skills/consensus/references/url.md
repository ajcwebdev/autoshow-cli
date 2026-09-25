# URL Consensus

Use this category for AutoShow URL article extraction runs with `providers/*/result.json`.

## Packet

```bash
bun scripts/run.ts url build-packet "$RUN_DIR" --out "$TMP_PACKET"
```
Build the packet before authoring the reference. Author `consensus-extraction.txt` from the full multi-provider packet evidence as the reconciled article extraction. Do not copy `prompt.md`, a provider extraction, provider summary, or any single provider output as the consensus extraction.

The file should contain only reconciled article content, not scoring notes or process commentary.

## Report

```bash
bun scripts/run.ts url build-report "$RUN_DIR"
```
To use a non-default consensus extraction artifact path:

```bash
bun scripts/run.ts url build-report "$RUN_DIR" --input-text /path/to/consensus-extraction.txt
```
Reports expose full `price`, `speed`, `automatedQuality`, and `humanQuality` ranking surfaces for local and service groups. Reports expose only the canonical `price`, `speed`, `automatedQuality`, and `humanQuality` ranking surfaces.

Price and speed rankings include every provider in the group, with missing values sorted last as `n/a`. Automated quality uses WER/CER/coverage-derived extraction accuracy against the consensus extraction. Human quality uses only explicit `humanQualityScore` evidence. URL normalized reports do not keep combined overall ranking or tiering output.

## Combined Cross-Run Report

```bash
bun scripts/run.ts url build-combined-report "$ROOT_DIR"
```
The command discovers each `provider-comparison-report.json` below the root and
reads optional sibling `manifest.json` metadata for article titles and source URLs. It
uses only committed local artifacts and never reruns providers or regenerates a
consensus extraction.

Output is written to `$ROOT_DIR/combined-comparison-report.json` (URL schema v2) and `combined-comparison-report.md`. The visual surface is the repository-level `docs/benchmarks/combined-comparison-dashboard.html`, written by `build-combined-dashboard` and rebuilt automatically after a `build-combined-report` under `docs/benchmarks`: a zero-dependency page whose data lives in the sibling `combined-comparison-dashboard.json`, with a stylesheet and script generated beside it, rendered in the browser from an HTTP origin; its `URL` tab holds these aggregates. Each group's sort control also offers `Custom`, three sliders sharing one 100% budget that rescore that group in the browser; it changes no emitted artifact.

Providers remain split into `local` and `service`. Rankings aggregate present values for price, speed, and source `rankingSurfaces.*.automatedQuality`; combined quality is not recomputed from WER/CER/coverage. WER, CER, content coverage, processing time, and cost remain supporting means. Combined reports do not emit weighted composites or model tiers. No human-quality ranking is emitted when the source human-quality arrays are empty, and local and service providers are never compared against each other.
