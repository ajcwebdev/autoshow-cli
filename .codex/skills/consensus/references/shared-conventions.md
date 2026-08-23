# Shared Consensus Conventions

## Public Entry Point

Use `scripts/run.ts` for all category workflows:

```bash
bun scripts/run.ts <category> build-packet <run_dir> [--input-text <path>] [--out <path>]
bun scripts/run.ts <category> build-report <run_dir> [--input-text <path>] [--roundtrip-dir <path>]
bun scripts/run.ts <category> compact-archive <root_dir>
bun scripts/run.ts <stt|ocr|url> build-combined-report <root_dir>
```

The dispatcher calls category-specific scripts and then normalizes reports into the consolidated ranking contract. OCR and STT use category-specific grouped full `metricRankings` instead of `rankingSurfaces`.

A path is a single run when it contains `manifest.json`. A path is an archive root when it is not a run and it contains those run subdirectories, for example `docs/benchmarks/image`, `docs/benchmarks/ocr`, or `docs/benchmarks/stt-with-speakers`. `compact-archive` is required on archive roots for every category and is refused on a single run. For each discovered run it minifies `manifest.json`, strips duplicated `providers[].result` when a sidecar `result.json` exists, compacts STT-style `result.json` evidence blobs the same way as `compact-results`, minifies committed report JSON (`provider-comparison-report.json`, `reference-comparison-report.json`, OCR `page-metrics.json` / `outliers.json` / `selective-adjudication-pages.json` / `variant-comparison-summary.json`, and the archive-root `combined-comparison-report.json`), rewrites absolute run paths in those files to run-relative paths, and deletes regenerable `page-inputs/` trees. When a provider already has canonical `result.json`, it also deletes resume checkpoints that duplicate that result: OCR `page-results/`, `fallback-state.json`, and `partial-extraction.txt`; STT `split-attempts/`, `segment-runs/`, `transcription.words.json`, and `transcription.json`. It keeps those checkpoints for failed providers that have no `result.json`, and it keeps source and generated media, consensus artifacts, `result.json`, transcription/extraction files, and reports. Markdown reports stay pretty-printed.

## Local And Service Separation

Always expose local and service provider ranking surfaces separately, so local zero-cost tools are not hidden inside service cost comparisons.

Use two report groups:

1. `local` for providers that run on the user's machine and have zero monetary cost in this report.
2. `service` for hosted, cloud, or third-party providers with possible monetary cost, quota, or billing.

Local cheapest rankings treat each local provider as zero monetary cost and only compare local providers with each other.

OCR and STT single-run reports are metric-ranking exceptions: they do not emit combined balanced-overall leaderboards, tiering, or ranking surfaces. They expose full rankings by price, speed, and quality score within category-specific provider groups. OCR, STT, and URL combined cross-run reports expose the same per-group metric rankings only. URL combined quality comes from the source automated-quality ranking surface. Local and service providers are still never ranked against each other. Combined reports do not emit weighted composites or model tiers.

OCR, STT, and URL combined HTML dashboards are self-contained: embedded data, inline CSS, no third-party dependencies, and they open from `file://`. Each group's metric table defaults to quality order and can be reordered by quality, cost, or speed from the sort control and those column headers. Rank chips stay each metric's own rank. Sorting uses pre-rendered tables so the dashboard stays readable with JavaScript disabled.

## Required Ranking Surfaces

Image, music, text, TTS, URL, and video JSON reports must expose complete rankings under both `rankingSurfaces.local` and `rankingSurfaces.service`:

```text
price
speed
automatedQuality
humanQuality
```

Each surface has a matching `*UnavailableReason` field. Price and speed rankings include every provider in the relevant group, with missing values sorted last as `value: null` and `label: "n/a"`. Automated and human quality rankings use only explicit evidence for that metric. If unavailable, the array is empty and the adjacent unavailable reason explains why.

Compatibility aliases are also required and must point at full-length arrays:

```text
fastest = speed
cheapest = price
highestQuality = humanQuality when humanQuality is present, otherwise automatedQuality
```

OCR JSON reports must expose full metric rankings at:

```text
metricRankings.local.price
metricRankings.local.speed
metricRankings.local.qualityScore
metricRankings.thirdPartyService.price
metricRankings.thirdPartyService.speed
metricRankings.thirdPartyService.qualityScore
```

STT JSON reports must expose full metric rankings at:

```text
metricRankings.local.price
metricRankings.local.speed
metricRankings.local.qualityScore
metricRankings.thirdPartyServiceNonDiarization.price
metricRankings.thirdPartyServiceNonDiarization.speed
metricRankings.thirdPartyServiceNonDiarization.qualityScore
metricRankings.thirdPartyServiceDiarization.price
metricRankings.thirdPartyServiceDiarization.speed
metricRankings.thirdPartyServiceDiarization.qualityScore
```

OCR/STT metric ranking arrays include every provider in the relevant group. Price sorts lower cost first, with local providers at zero and missing service price last. Speed sorts lower processing time first, with missing timing last. Quality Score sorts the existing score higher first. OCR/STT single-run JSON must not emit `rankingSurfaces`, `overall`, `overallMetric`, `overallWeights`, or `tiering`. Combined cross-run JSON uses the same per-group `metricRankings` and must not emit `weightedRankings` or `tiering`. URL combined schema v2 uses `metricRankings.local|service` with `price`, `speed`, and `automatedQuality`.

Markdown reports normally expose matching sections:

1. Local Providers / Price
2. Local Providers / Speed
3. Local Providers / Automated Quality
4. Local Providers / Human Quality
5. Service Providers / Price
6. Service Providers / Speed
7. Service Providers / Automated Quality
8. Service Providers / Human Quality

OCR and STT single-run markdown uses `## Metric Rankings` with group-specific full Price, Speed, and Quality Score tables. It must not include `## Overall Ranking`, `## Tier Breakdown`, combined `## Ranking`, or “Top 3” ranking sections. Combined cross-run markdown uses the same per-group Price, Speed, and Quality tables and must not include weighted-ranking or model-tier sections. No section may rank local and service providers together.

OCR `build-report` also writes repo-local consensus skill artifacts beside the provider report:

```text
page-metrics.json
outliers.json
selective-adjudication-pages.json
variant-comparison-summary.json
ocr-benchmark-summary.md
```

These artifacts expose page-level provider selection, confidence scores, outlier signals, selective adjudication candidates, pairwise variant distances against the current consensus when available, and a benchmark summary. They are generated from existing provider artifacts and do not authorize paid provider reruns or production CLI/API changes.

TTS markdown uses Local Models and Third-Party Service Models sections with full Price, Speed, Automated Quality, and Human Quality tables. Do not label any non-OCR/STT ranking sections as “Top 3”.

## Quality Evidence Rules

Automated and human quality rankings must be evidence-only:

1. OCR: WER/CER-derived extraction accuracy.
2. STT: speaker-aware WER-derived transcript accuracy, split into local, third-party non-diarization, and third-party diarization groups.
3. URL: extraction accuracy using WER, CER, and content coverage.
4. TTS automated quality: roundtrip WER-derived accuracy, including median roundtrip WER from `voice-quality-report.json`.
5. TTS human quality: `humanSpeechScore` from `voice-quality-report.json`.
6. Image: image judge `qualityScore`.
7. Music and video: explicit `qualityScore` fields when present.
8. Text: explicit future text quality fields only.
9. Human quality: explicit `humanQualityScore`, or TTS `humanSpeechScore`.

Do not use file size, dimensions, bitrate, duration, length, output existence, schema validity, cost, speed, generic qualityScore as human quality, or subjective judgment as quality proxies.

## No-Cost Verification

Use only local fixture or metadata-only checks unless the user explicitly approves a paid provider run.

Do not run smoke or e2e tests that can reach OpenAI, Anthropic, Gemini, Mistral, AWS, Google Cloud, ElevenLabs, MiniMax, deAPI, Deepgram, Groq, Grok, Firecrawl, or other paid providers.
