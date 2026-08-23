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
6. The single-run JSON does not emit `rankingSurfaces`, `overall`, `overallMetric`, `overallWeights`, or `tiering`; combined cross-run reports keep the same per-group metric rankings and add no weighted composites or model tiers (see Combined Cross-Run Report).

Quality Score rankings use the existing speaker-aware WER-derived score from highest to lowest, with speaker-aware WER, text-only WER, and diarization support retained as evidence. Price rankings use zero monetary cost for local STT providers and reported cost for third-party services, keeping missing service price at the end. Speed rankings keep missing timing at the end.

## Compaction For Git

On a category root such as `docs/benchmarks/stt-with-speakers`, run `compact-archive` so every run is compacted. After a provider has canonical `result.json`, it deletes the per-segment resume tree (`split-attempts/pass_*/segment-runs/segment_*/` plus sliced audio under `segments/`) and whisper sidecars (`transcription.words.json`, `transcription.json`) that duplicate that result. Failed providers without `result.json` keep those checkpoints, including `error.json` and `raw-response.json`. Keep `transcription.txt`. See `references/shared-conventions.md`.

Raw STT `providers/*/result.json` files carry large `result.evidence.words` arrays (per-word timing/confidence) and `result.evidence.rawResponse` blobs that can make a single run tens of megabytes — too large to commit. On a single run, compact them in place with:

```bash
bun scripts/run.ts stt compact-results "$RUN_DIR"
```

This removes:

1. `result.evidence.words` for every provider — never read by the packet or report.
2. `result.evidence.segments` for every provider — a numeric-timestamp duplicate of `result.segments`, unused by the packet or report.
3. `result.evidence.rawResponse` for every provider except `whisper` and `gemini-stt`, which are the only providers whose advisory Quality Flags read it.

Everything the packet and report consume is preserved: `provider`, `model`, `metadata.tokenCount`, `metadata.processingTime`, `result.text`, `result.segments`, `result.evidence.timingQuality`, and `result.evidence.capabilities`. Output is minified and the operation is idempotent. Regenerating `reference-comparison-report.{json,md}` after compaction produces byte-identical output aside from the `generatedAt` timestamp.

Before deleting the source audio and derivative transcription or split-attempt files, confirm `manifest.json`, every `providers/*/result.json`, and `consensus-transcription.txt` remain — they are the full set needed to regenerate reports. `manifest.json` holds canonical item and provider metadata but no transcripts, so the per-provider `result.json` payloads are the sole transcript source and must be kept.

## Combined Cross-Run Report

To aggregate every per-run `reference-comparison-report.json` under a root directory into one provider leaderboard:

```bash
bun scripts/run.ts stt build-combined-report "$ROOT_DIR"
```

`$ROOT_DIR` is the parent directory holding the run subdirectories (for example `docs/benchmarks/stt-without-speakers` or `docs/benchmarks/stt-with-speakers`). The script discovers each subdirectory that contains a `reference-comparison-report.json`, matches providers by `providerKey`, and aggregates across the runs each provider appears in:

1. Quality score: mean of the per-run speaker-aware WER-derived score, ranked highest first.
2. Price: mean per-run monetary cost, ranked lowest first, local providers at zero, missing cost last.
3. Speed: mean processing time, ranked lowest first, missing timing last.

Output is written to `$ROOT_DIR/combined-comparison-report.json` (schema v4), `combined-comparison-report.md`, and `combined-comparison-report.html`. The `.html` is a self-contained dashboard (all data embedded, inline CSS, zero third-party dependencies, works from `file://`) consolidating the same per-group metric rankings. Each group's metric table defaults to quality order and can be reordered by quality, cost, or speed from the sort control and those column headers. The report follows the same group split as single-run reports (`local`, `thirdPartyServiceNonDiarization`, `thirdPartyServiceDiarization`) with full Price, Speed, and Quality Score tables per group, plus a per-run quality-score matrix. Per-run provider details record `audioDurationSeconds` and `realtimeFactor`; the combined report records aggregate realtime throughput as total covered audio duration divided by total covered processing time and promotes it into Markdown, the HTML dashboard, and `docs/benchmarks/summary.md` when that repository summary exists. It emits no weighted composites, model tiers, cross-group overall, or `rankingSurfaces` leaderboard. Run `compact-results` and `build-report` for each run first so the combined report reads finished per-run artifacts.
