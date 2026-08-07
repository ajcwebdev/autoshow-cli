# STT Consensus

Use this category for AutoShow speech-to-text runs with `providers/*/result.json`.

## Packet

```bash
bun scripts/run.ts stt build-packet "$RUN_DIR" --out "$TMP_PACKET"
```

Build the packet before authoring the reference. Author `consensus-transcription.txt` from the sum total of segment evidence across providers in the full multi-provider packet. Use the packet baseline and provider transcripts as evidence, not as automatic truth, and do not copy `prompt.md`, provider summaries, or any single provider output as the consensus transcript.

Preserve canonical speaker labels and timestamps in this line format:

```text
[00:00:10] [speaker-1] Transcript text.
```

Keep one segment per line, chronological timestamps, and stable canonical speaker labels.

## Report

```bash
bun scripts/run.ts stt build-report "$RUN_DIR"
```

For an archive whose historical report rows intentionally outlive their original provider results, preserve those rows while promoting current result artifacts:

```bash
bun scripts/run.ts stt build-report "$RUN_DIR" --preserve-existing
```

Current `result.json` data wins on matching provider keys. Historical-only rows retain their prior scores, costs, and timings. Do not use this flag to conceal an unexpectedly missing current result.

To use a non-default consensus transcript artifact path:

```bash
bun scripts/run.ts stt build-report "$RUN_DIR" --input-text /path/to/consensus-transcription.txt
```

The STT report uses full grouped metric rankings:

1. `## Metric Rankings` contains Local, Third-Party Service Non-Diarization, and Third-Party Service Diarization groups.
2. Each group contains full Price, Speed, and Quality Score tables.
3. JSON exposes `metricRankings.local.price|speed|qualityScore`.
4. JSON exposes `metricRankings.thirdPartyServiceNonDiarization.price|speed|qualityScore`.
5. JSON exposes `metricRankings.thirdPartyServiceDiarization.price|speed|qualityScore`.
6. The single-run JSON does not emit `rankingSurfaces`, `overall`, `overallMetric`, `overallWeights`, or `tiering`; combined cross-run reports add per-group weighted composites and model tiers (see Combined Cross-Run Report).

Quality Score rankings use the existing speaker-aware WER-derived score from highest to lowest, with speaker-aware WER, text-only WER, and diarization support retained as evidence. Price rankings use zero monetary cost for local STT providers and reported cost for third-party services, keeping missing service price at the end. Speed rankings keep missing timing at the end.

## Compaction For Git

Raw STT `providers/*/result.json` files carry large `result.evidence.words` arrays (per-word timing/confidence) and `result.evidence.rawResponse` blobs that can make a single run tens of megabytes — too large to commit. Compact them in place before committing:

```bash
bun scripts/run.ts stt compact-results "$RUN_DIR"
```

This removes:

1. `result.evidence.words` for every provider — never read by the packet or report.
2. `result.evidence.rawResponse` for every provider except `whisper` and `gemini-stt`, which are the only providers whose advisory Quality Flags read it.

Everything the packet and report consume is preserved: `provider`, `model`, `metadata.tokenCount`, `metadata.processingTime`, `result.text`, `result.segments`, `result.evidence.timingQuality`, and `result.evidence.capabilities`. Output is minified and the operation is idempotent. Regenerating `reference-comparison-report.{json,md}` after compaction produces byte-identical output aside from the `generatedAt` timestamp.

Before deleting the source audio and derivative `transcription.txt`/`checkpoint.json`/`split-attempts` files, confirm `run.json`, every `providers/*/result.json`, and `consensus-transcription.txt` remain — they are the full set needed to regenerate reports. `run.json` holds only metadata (no transcripts), so the per-provider `result.json` files are the sole transcript source and must be kept.

## Combined Cross-Run Report

To aggregate every per-run `reference-comparison-report.json` under a root directory into one provider leaderboard:

```bash
bun scripts/run.ts stt build-combined-report "$ROOT_DIR"
```

`$ROOT_DIR` is the parent directory holding the run subdirectories (for example `docs/benchmarks/stt`). The script discovers each subdirectory that contains a `reference-comparison-report.json`, matches providers by `providerKey`, and aggregates across the runs each provider appears in:

1. Quality score: mean of the per-run speaker-aware WER-derived score, ranked highest first.
2. Price: mean per-run monetary cost, ranked lowest first, local providers at zero, missing cost last.
3. Speed: mean processing time, ranked lowest first, missing timing last.
4. Weighted composites: eight per-group rankings (strong/moderate quality, speed, and cost — 0.8/0.1/0.1 and 0.6/0.2/0.2 weight permutations — plus quality + cost at 0.45/0.10/0.45 and cost + speed at 0.10/0.45/0.45). Within each run and group, providers get 0-100 min-max Q/S/C subscores (Q higher-better; S/C lower-better; identical min/max gives everyone 100), averaged across covered runs; composite = `w_q*Q + w_s*S + w_c*C`. A provider missing a value in a run is excluded from that run's normalization pool for that dimension; a dimension missing in all covered runs scores 0.
5. Model tiers: a per-group three-tier structure computed with `quality-cost-terciles-v1` from the `qualityCost` weighted ranking only. Preserve that ranking's order (composite descending, quality subscore descending, provider key), then split it into three contiguous tiers of `floor(n / 3)` models with remainder models assigned to Tier 1 and then Tier 2. Every model appears exactly once; for example, 8 models split 3/3/2 and 10 split 4/3/3.

Output is written to `$ROOT_DIR/combined-comparison-report.json` (schema v3), `combined-comparison-report.md`, and `combined-comparison-report.html`. The `.html` is a self-contained dashboard (all data embedded, inline CSS/JS, zero third-party dependencies, works from `file://`) consolidating the same per-group data; see ADR-014. The report follows the same group split as single-run reports (`local`, `thirdPartyServiceNonDiarization`, `thirdPartyServiceDiarization`) with full Price, Speed, Quality Score, and Weighted Rankings tables per group, plus a per-run quality-score matrix and a per-group `## Model Tiers` section. Per-run provider details record `audioDurationSeconds` and `realtimeFactor`; the combined report records aggregate realtime throughput as total covered audio duration divided by total covered processing time and promotes it into Markdown, the HTML dashboard, and `docs/benchmarks/summary.md` when that repository summary exists. It emits no cross-group overall or `rankingSurfaces` leaderboard; weighted composites and tiers are always per group. Run `compact-results` and `build-report` for each run first so the combined report reads finished per-run artifacts.
