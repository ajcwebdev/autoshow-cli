# Video Combined Provider Comparison Report (2026-05-21)

This standalone report aggregates the two video benchmark runs dated 2026-05-21 from the existing `run.json` and `provider-comparison-report.json` files only. Provider result rows are read from `providerGroups.service.providers`, with source ranking contracts checked under `rankingSurfaces.service.*`; no videos were regenerated and no video judge was run.

## Source Inventory

- Runs: 2
- Provider result rows: 17
- Service providers: 9 models; `gemini/veo-3.1-generate-preview` was observed in 1/2 runs and every other service model was observed in 2/2 runs
- Local providers: 0
- Automated quality score rows: 9
- Human quality score rows: 0

Aggregate quality is the unweighted average `qualityScore` across rows where an explicit score was present. Quality coverage is shown as score observations over total runs; cost and speed coverage is shown as observed provider rows over total runs. Cost is USD converted from report cents. Speed is average processing time in seconds. Rankings are grouped by service providers because no local providers were present.

| Run | Prompt | Providers | Best automated quality | Cheapest service | Fastest service |
| --- | --- | ---: | --- | --- | --- |
| `2026-05-21_06-50-32-135_video-gen` | a rainy neon city street, slow camera pan | 0 local / 9 service | `gemini/veo-3.1-generate-preview` (88.00) | `minimax/T2V-01-Director` ($0.1900) | `grok/grok-imagine-video` (41.60s) |
| `2026-05-21_06-51-12-517_video-gen` | a man eating spaghetti | 0 local / 8 service | n/a | `minimax/T2V-01-Director` ($0.1900) | `grok/grok-imagine-video` (21.02s) |

## Service Aggregates

### Automated Quality Ranking

| Rank | Provider | Quality coverage | Avg quality score | Avg speed | Avg cost |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 | `gemini/veo-3.1-generate-preview` | 1/2 | 88.00 | 72.03s | $3.2000 |
| 2 | `minimax/MiniMax-Hailuo-2.3` | 1/2 | 88.00 | 97.97s | $0.4200 |
| 3 | `minimax/T2V-01-Director` | 1/2 | 88.00 | 154.84s | $0.1900 |
| 4 | `grok/grok-imagine-video` | 1/2 | 86.00 | 31.31s | $0.3000 |
| 5 | `gemini/veo-3.1-lite-generate-preview` | 1/2 | 84.00 | 51.73s | $0.3000 |
| 6 | `gemini/veo-3.1-fast-generate-preview` | 1/2 | 80.00 | 56.78s | $0.6000 |
| 7 | `glm/viduq1-text` | 1/2 | 80.00 | 193.60s | $0.4000 |
| 8 | `minimax/T2V-01` | 1/2 | 80.00 | 283.10s | $0.1900 |
| 9 | `glm/cogvideox-3` | 1/2 | 78.00 | 249.16s | $0.2000 |

### Speed Ranking

| Rank | Provider | Coverage | Avg speed | Avg quality score | Quality coverage | Avg cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | `grok/grok-imagine-video` | 2/2 | 31.31s | 86.00 | 1/2 | $0.3000 |
| 2 | `gemini/veo-3.1-lite-generate-preview` | 2/2 | 51.73s | 84.00 | 1/2 | $0.3000 |
| 3 | `gemini/veo-3.1-fast-generate-preview` | 2/2 | 56.78s | 80.00 | 1/2 | $0.6000 |
| 4 | `gemini/veo-3.1-generate-preview` | 1/2 | 72.03s | 88.00 | 1/2 | $3.2000 |
| 5 | `minimax/MiniMax-Hailuo-2.3` | 2/2 | 97.97s | 88.00 | 1/2 | $0.4200 |
| 6 | `minimax/T2V-01-Director` | 2/2 | 154.84s | 88.00 | 1/2 | $0.1900 |
| 7 | `glm/viduq1-text` | 2/2 | 193.60s | 80.00 | 1/2 | $0.4000 |
| 8 | `glm/cogvideox-3` | 2/2 | 249.16s | 78.00 | 1/2 | $0.2000 |
| 9 | `minimax/T2V-01` | 2/2 | 283.10s | 80.00 | 1/2 | $0.1900 |

### Price Ranking

| Rank | Provider | Coverage | Avg cost | Avg quality score | Quality coverage | Avg speed |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | `minimax/T2V-01-Director` | 2/2 | $0.1900 | 88.00 | 1/2 | 154.84s |
| 2 | `minimax/T2V-01` | 2/2 | $0.1900 | 80.00 | 1/2 | 283.10s |
| 3 | `glm/cogvideox-3` | 2/2 | $0.2000 | 78.00 | 1/2 | 249.16s |
| 4 | `grok/grok-imagine-video` | 2/2 | $0.3000 | 86.00 | 1/2 | 31.31s |
| 5 | `gemini/veo-3.1-lite-generate-preview` | 2/2 | $0.3000 | 84.00 | 1/2 | 51.73s |
| 6 | `glm/viduq1-text` | 2/2 | $0.4000 | 80.00 | 1/2 | 193.60s |
| 7 | `minimax/MiniMax-Hailuo-2.3` | 2/2 | $0.4200 | 88.00 | 1/2 | 97.97s |
| 8 | `gemini/veo-3.1-fast-generate-preview` | 2/2 | $0.6000 | 80.00 | 1/2 | 56.78s |
| 9 | `gemini/veo-3.1-generate-preview` | 1/2 | $3.2000 | 88.00 | 1/2 | 72.03s |

## Local Aggregates

No local providers were present in either video benchmark run, so no local price, speed, automated-quality, or human-quality aggregate ranking is produced.

## Human Quality Note

No explicit `humanQualityScore` was available in either source report. Generic `qualityScore`, cost, speed, duration, file size, dimensions, bitrate, and artifact metadata are not human-quality proxies, so no human-quality ranking is produced.

## Source Checks

Both source directories contained readable `run.json` and `provider-comparison-report.json` files. The first source report contained full `rankingSurfaces.service.price`, `rankingSurfaces.service.speed`, and `rankingSurfaces.service.automatedQuality` arrays of length 9. The second source report contained full `rankingSurfaces.service.price` and `rankingSurfaces.service.speed` arrays of length 8, plus an empty `rankingSurfaces.service.automatedQuality` array with an unavailable reason. Both source reports contained empty `rankingSurfaces.service.humanQuality` arrays with unavailable reasons. `providerGroups.local.count` was 0 in both runs.
