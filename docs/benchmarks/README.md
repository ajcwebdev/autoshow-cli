# Benchmark Reports

Retained runs, references, and generated reports live here. [ADR-015](../adr/ADR-015-govern-documentation-examples-and-verification-evidence.md) governs evidence and spending; [ADR-010](../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) governs model identity, prices, and calibration. Media is Git-ignored and must be backed up separately.

## Layout and dashboard

- `text/ocr`, `stt/local`, `stt/with-speakers`, `stt/without-speakers`, and `text/url` contain combined JSON/Markdown reports over their retained runs.
- `tts` has narration and separate emotion/delivery and speed/pause suites, with [storage and assessment guidance](tts/README.md). Each control suite independently selects its newest dated directory; its first-run date and shared spending remain pinned in the controls ledger.
- `text/write` contains the [five-prompt comparison](text/write/benchmark-report.md), pinned plans, receipts, outputs, and reruns. Music and video retain dated hand-authored comparisons beside their runs.
- `combined-comparison-dashboard.{html,json,css,js}` are generated together. Serve them over HTTP with JavaScript enabled; `file://` cannot fetch the sibling JSON. There is no CLI `benchmark` command.

The dashboard defaults to **Only CLI-supported models**, using selectors, executing adapters, and lifecycle metadata from its last rebuild. Disable the filter to inspect historical models. Filtering covers rankings, heatmaps, and evidence; unrecomputable summaries are marked **Archive**. The browser retains the filter and preserves the selected tab, sort, and weights.

Compare quality, speed, and cost within each category/provider group. There is no cross-group overall leaderboard, emitted weighted composite, or model-tier contract. Optional browser weights are an unsaved viewing aid. Retained costs and model identities remain historical evidence, including retired routes where preserved.

## Write benchmark

The five presets are `shortSummary`, `longSummary`, `mediumChapters`, `blog`, and `rapSongChapter`. Each uses one fixed source across the routes in [the saved plan](text/write/benchmark-plan.json), one inference attempt per slot, two concurrent targets per provider, and pinned CLI/model defaults. Failed or invalid attempts remain visible and cannot be automatically repurchased.

Speed is observed request time. Cost uses recorded usage and saved uncached tariffs, excluding cache discounts and introductory pricing; it is not a reconciled invoice. Aggregate comparisons require valid results for all five prompts. The latest completed rerun replaces a first-pass result in the comparison, while all attempt costs and unresolved billing remain retained. The earlier September run is outside this aggregate.

The Write tab's **Price proxy ($ / 1M output tokens)** sorts higher list prices first by explicit user choice. This model rate is neither measured text quality nor request cost; per-run quality remains unavailable without assessment evidence.

Inspect current pricing or verify saved receipts without dispatch:

```bash
bun src/tools/write-benchmark.ts --price
bun src/tools/write-benchmark.ts --verify-cache
bun src/tools/rerun-write-benchmark.ts --price
bun src/tools/rerun-write-benchmark.ts --verify-cache
```

Fresh pricing uses the current inventory, independently of the historical saved plan. Rerun `--prepare` pins an unapproved plan; paid `--run` requires its explicit cost-specific authorization. Historical approvals do not carry over to changed plans or new request batches.

## October 2026 OCR refresh

[OCR comparisons](text/ocr/combined-comparison-report.md) retain source coverage, usage, and end-to-end processing times. WER-derived quality uses an ASCII word tokenizer and does not measure Japanese glyph accuracy; Unicode CER and source review remain necessary. Failed requests without usage retain unknown billing and stay outside successful-result rankings. Plaintext whitespace cleanup did not alter the provider text preserved in `result.json`.

## October 2026 video refresh

[Video comparisons](video/2026-05-21_combined-provider-comparison-report.md) retain Grok/Gemini generation measurements. Evaluations based only on packet metadata make no visual-quality claim. [TTS notes](tts/README.md) distinguish computed costs, provider-reported usage, delivery formats, and assessment limits.

## October 2026 STT refresh

[With-speakers](stt/with-speakers/combined-comparison-report.md) and [without-speakers](stt/without-speakers/combined-comparison-report.md) results preserve Cloudflare Nova-3 despite its later selector removal. Together's WebSocket-only Nemotron rejection remains failure evidence. These exclusions are recorded in [ADR-010](../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md#excluded-integrations); neither archived results nor an older source URL establish current dispatch support. [Canonical source recordings](stt/sources/README.md) retain hash-bound run relationships.

## Compaction and regeneration

Preserve canonical records, original identities, receipts, references, and purchased media. Compact only verified completed runs; never delete interrupted/failed TTS outputs or working files. After changing report inputs, regenerate combined JSON/Markdown and all four dashboard files from the same evidence, rather than hand-editing generated outputs.

```bash
bun src/tools/write-benchmark-report.ts --write
bun .codex/skills/consensus/scripts/run.ts build-combined-dashboard
```

These commands make no provider calls. Combined-report generation also rebuilds the dashboard when all five combined-report roots exist. Restoring metadata alone does not restore missing purchased media or prove resumability.
