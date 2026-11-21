# Music Consensus

Use this category for multi-provider AutoShow music runs with canonical `manifest.json` metadata and generated music files in the run directory root.

## Packet

```bash
bun scripts/run.ts music build-packet "$RUN_DIR" --out "$TMP_PACKET"
```
The packet verifies music artifacts and records measurable metadata such as file size, duration metadata, processing time, and cost.

## Evaluation

Write `consensus-evaluation.txt` as plain text. Do not claim to have listened to audio or assessed musical quality. Use only measurable packet evidence.

## Report

```bash
bun scripts/run.ts music build-report "$RUN_DIR"
```
Reports expose full `price`, `speed`, `automatedQuality`, and `humanQuality` ranking surfaces for local and service groups. Reports expose only the canonical `price`, `speed`, `automatedQuality`, and `humanQuality` ranking surfaces.

Price and speed rankings include every provider in the group, with missing values sorted last as `n/a`. Automated quality uses only explicit `qualityScore` evidence when present. Human quality uses only explicit `humanQualityScore` evidence. Do not use duration, file size, bitrate, cost, speed, or generic artifact metadata as quality proxies.

## Dashboard

The repository dashboard's `music` tab aggregates every run under `docs/benchmarks/music/` that has both `manifest.json` and `provider-comparison-report.json`: mean cost and speed per `providerKey`, run coverage, cost basis, and per-run evidence. Quality stays unavailable without explicit scores. After adding or rebuilding a run report, refresh it with `bun scripts/run.ts build-combined-dashboard`; this makes no provider calls.
