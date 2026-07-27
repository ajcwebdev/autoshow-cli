# Image Combined Provider Comparison Report (2026-05-21)

This standalone report aggregates the two image benchmark runs dated 2026-05-21 from the existing `run.json` and `provider-comparison-report.json` files only. Provider result rows are read from `providerGroups.service.providers`, with source ranking contracts checked under `rankingSurfaces.service.*`; no images were regenerated and no image judge was run.

## Source Inventory

- Runs: 2
- Provider result rows: 26
- Service providers: 13 models, all observed in 2/2 runs
- Local providers: 0
- Judge model: `gpt-5.5`

Aggregate quality is the unweighted average `qualityScore` across observed runs. Cost is USD converted from report cents. Speed is average processing time in seconds. Rankings are grouped by service providers because no local providers were present.

| Run | Prompt | Providers | Best automated quality | Cheapest service | Fastest service |
| --- | --- | ---: | --- | --- | --- |
| `2026-05-21_10-33-37-508_image-gen` | media-processing infographic | 0 local / 13 service | `recraft/recraftv4_1` (90.00) | `grok/grok-imagine-image` ($0.0200) | `grok/grok-imagine-image-quality` (4.71s) |
| `2026-05-21_10-35-24-459_image-gen` | recursive pencil drawing | 0 local / 13 service | `openai/gpt-image-2` (90.00) | `grok/grok-imagine-image` ($0.0200) | `grok/grok-imagine-image-quality` (5.05s) |

## Service Aggregates

### Automated Quality Ranking

| Rank | Provider | Coverage | Avg quality score | Avg speed | Avg cost |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 | `openai/gpt-image-2` | 2/2 | 89.00 | 105.69s | $0.0530 |
| 2 | `recraft/recraftv4_1` | 2/2 | 88.00 | 8.60s | $0.0400 |
| 3 | `recraft/recraftv4_1_utility_pro` | 2/2 | 86.00 | 15.69s | $0.2500 |
| 4 | `recraft/recraftv4_1_utility` | 2/2 | 86.00 | 17.11s | $0.0400 |
| 5 | `recraft/recraftv4_1_pro` | 2/2 | 85.00 | 12.65s | $0.2500 |
| 6 | `gemini/gemini-3.1-flash-image-preview` | 2/2 | 85.00 | 20.56s | $0.0670 |
| 7 | `grok/grok-imagine-image-quality` | 2/2 | 84.00 | 4.88s | $0.0500 |
| 8 | `bfl/flux-2-flex` | 2/2 | 82.00 | 16.41s | $0.0500 |
| 9 | `bfl/flux-2-max` | 2/2 | 80.00 | 44.41s | $0.0700 |
| 10 | `grok/grok-imagine-image` | 2/2 | 78.00 | 5.75s | $0.0200 |
| 11 | `bfl/flux-2-pro` | 2/2 | 77.00 | 14.16s | $0.0300 |
| 12 | `reve/latest` | 2/2 | 75.00 | 6.50s | $0.0240 |
| 13 | `reve/reve-create@20250915` | 2/2 | 70.00 | 6.32s | $0.0240 |

### Speed Ranking

| Rank | Provider | Coverage | Avg speed | Avg quality score | Avg cost |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 | `grok/grok-imagine-image-quality` | 2/2 | 4.88s | 84.00 | $0.0500 |
| 2 | `grok/grok-imagine-image` | 2/2 | 5.75s | 78.00 | $0.0200 |
| 3 | `reve/reve-create@20250915` | 2/2 | 6.32s | 70.00 | $0.0240 |
| 4 | `reve/latest` | 2/2 | 6.50s | 75.00 | $0.0240 |
| 5 | `recraft/recraftv4_1` | 2/2 | 8.60s | 88.00 | $0.0400 |
| 6 | `recraft/recraftv4_1_pro` | 2/2 | 12.65s | 85.00 | $0.2500 |
| 7 | `bfl/flux-2-pro` | 2/2 | 14.16s | 77.00 | $0.0300 |
| 8 | `recraft/recraftv4_1_utility_pro` | 2/2 | 15.69s | 86.00 | $0.2500 |
| 9 | `bfl/flux-2-flex` | 2/2 | 16.41s | 82.00 | $0.0500 |
| 10 | `recraft/recraftv4_1_utility` | 2/2 | 17.11s | 86.00 | $0.0400 |
| 11 | `gemini/gemini-3.1-flash-image-preview` | 2/2 | 20.56s | 85.00 | $0.0670 |
| 12 | `bfl/flux-2-max` | 2/2 | 44.41s | 80.00 | $0.0700 |
| 13 | `openai/gpt-image-2` | 2/2 | 105.69s | 89.00 | $0.0530 |

### Price Ranking

| Rank | Provider | Coverage | Avg cost | Avg quality score | Avg speed |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 | `grok/grok-imagine-image` | 2/2 | $0.0200 | 78.00 | 5.75s |
| 2 | `reve/latest` | 2/2 | $0.0240 | 75.00 | 6.50s |
| 3 | `reve/reve-create@20250915` | 2/2 | $0.0240 | 70.00 | 6.32s |
| 4 | `bfl/flux-2-pro` | 2/2 | $0.0300 | 77.00 | 14.16s |
| 5 | `recraft/recraftv4_1` | 2/2 | $0.0400 | 88.00 | 8.60s |
| 6 | `recraft/recraftv4_1_utility` | 2/2 | $0.0400 | 86.00 | 17.11s |
| 7 | `grok/grok-imagine-image-quality` | 2/2 | $0.0500 | 84.00 | 4.88s |
| 8 | `bfl/flux-2-flex` | 2/2 | $0.0500 | 82.00 | 16.41s |
| 9 | `openai/gpt-image-2` | 2/2 | $0.0530 | 89.00 | 105.69s |
| 10 | `gemini/gemini-3.1-flash-image-preview` | 2/2 | $0.0670 | 85.00 | 20.56s |
| 11 | `bfl/flux-2-max` | 2/2 | $0.0700 | 80.00 | 44.41s |
| 12 | `recraft/recraftv4_1_utility_pro` | 2/2 | $0.2500 | 86.00 | 15.69s |
| 13 | `recraft/recraftv4_1_pro` | 2/2 | $0.2500 | 85.00 | 12.65s |

## Local Aggregates

No local providers were present in either image benchmark run, so no local price, speed, automated-quality, or human-quality aggregate ranking is produced.

## Human Quality Note

No explicit `humanQualityScore` was available in either source report. Generic `qualityScore`, cost, speed, dimensions, file size, and artifact metadata are not human-quality proxies, so no human-quality ranking is produced.

## Source Checks

Both source directories contained readable `run.json` and `provider-comparison-report.json` files. Each source report contained full `rankingSurfaces.service.price`, `rankingSurfaces.service.speed`, and `rankingSurfaces.service.automatedQuality` arrays of length 13. Each source report contained an empty `rankingSurfaces.service.humanQuality` array with an unavailable reason. `providerGroups.local.count` was 0 in both runs.
