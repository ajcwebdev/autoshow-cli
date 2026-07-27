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

Reports expose full `price`, `speed`, `automatedQuality`, and `humanQuality` ranking surfaces for local and service groups. `fastest`, `cheapest`, and `highestQuality` remain compatibility aliases for the full `speed`, `price`, and quality arrays.

Price and speed rankings include every provider in the group, with missing values sorted last as `n/a`. Automated quality uses WER/CER/coverage-derived extraction accuracy against the consensus extraction. Human quality uses only explicit `humanQualityScore` evidence. URL normalized reports do not keep combined overall ranking or tiering output.

## Combined Cross-Run Report

```bash
bun scripts/run.ts url build-combined-report "$ROOT_DIR"
```

The command discovers each `provider-comparison-report.json` below the root and
reads optional sibling `run.json` metadata for article titles and source URLs. It
uses only committed local artifacts and never reruns providers or regenerates a
consensus extraction.

Output is written to `$ROOT_DIR/combined-comparison-report.json` (URL schema v1),
`combined-comparison-report.md`, and `combined-comparison-report.html`. The HTML
is a self-contained offline dashboard with embedded data and inline CSS/JS. Its
article inventory validates links as HTTP(S), and the browser script only switches
between precomputed rankings.

Providers remain split into `local` and `service`. Pure rankings aggregate present
values for price, speed, and source `rankingSurfaces.*.automatedQuality`; combined
quality is not recomputed from WER/CER/coverage. WER, CER, content coverage,
processing time, and cost remain supporting means. Each group also receives the
shared eight weighted Q/S/C rankings and `quality-cost-terciles-v1` tiers. No
human-quality ranking is emitted when the source human-quality arrays are empty,
and local and service providers are never compared against each other.
