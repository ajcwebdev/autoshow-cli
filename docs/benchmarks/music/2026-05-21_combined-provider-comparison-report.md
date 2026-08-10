# Music Combined Provider Comparison Report (2026-05-21)

This standalone report aggregates the four music benchmark runs dated 2026-05-21 from the existing `manifest.json` and `provider-comparison-report.json` files only. Provider result rows are read from `providerGroups.service.providers`, with source ranking contracts checked under `rankingSurfaces.service.*`; no music was regenerated and no audio judge was run.

## Source Inventory

- Runs: 4
- Provider result rows: 16
- Service providers: 4 models, all observed in 4/4 runs
- Local providers: 0
- Automated quality score rows: 0
- Human quality score rows: 0

Aggregate cost is USD converted from report cents. Speed is average processing time in seconds. Automated quality and human quality are unavailable because no explicit `qualityScore` or `humanQualityScore` values were present in the source reports. Rankings are grouped by service providers because no local providers were present.

| Run | Prompt | Providers | Best automated quality | Cheapest service | Fastest service |
| --- | --- | ---: | --- | --- | --- |
| `2026-05-21_09-58-14-202_music-gen` | indie pop, nostalgic summer road trip vibe song about cats | 0 local / 4 service | n/a | `gemini/lyria-3-clip-preview` ($0.0400) | `elevenlabs/music_v1` (16.63s) |
| `2026-05-21_09-58-34-695_music-gen` | Avant-garde jazz influenced hip hop rap song about leprechauns | 0 local / 4 service | n/a | `gemini/lyria-3-clip-preview` ($0.0400) | `gemini/lyria-3-clip-preview` (20.46s) |
| `2026-05-21_09-58-58-871_music-gen` | classical guitar | 0 local / 4 service | n/a | `gemini/lyria-3-clip-preview` ($0.0400) | `elevenlabs/music_v1` (10.65s) |
| `2026-05-21_10-01-43-712_music-gen` | heavy metal with complex time signatures and synths | 0 local / 4 service | n/a | `gemini/lyria-3-clip-preview` ($0.0400) | `gemini/lyria-3-clip-preview` (21.09s) |

## Service Aggregates

### Automated Quality Ranking

Unavailable. No explicit music `qualityScore` was available in any source report. File size, duration, bitrate, lyrics metadata, cost, and speed are not automated-quality proxies, so no automated-quality aggregate ranking is produced.

### Speed Ranking

| Rank | Provider | Coverage | Avg speed | Avg cost |
| ---: | --- | ---: | ---: | ---: |
| 1 | `gemini/lyria-3-clip-preview` | 4/4 | 20.28s | $0.0400 |
| 2 | `elevenlabs/music_v1` | 4/4 | 20.76s | $0.4550 |
| 3 | `gemini/lyria-3-pro-preview` | 4/4 | 36.64s | $0.0800 |
| 4 | `minimax/music-2.6` | 4/4 | 110.04s | $0.1600 |

### Price Ranking

| Rank | Provider | Coverage | Avg cost | Avg speed |
| ---: | --- | ---: | ---: | ---: |
| 1 | `gemini/lyria-3-clip-preview` | 4/4 | $0.0400 | 20.28s |
| 2 | `gemini/lyria-3-pro-preview` | 4/4 | $0.0800 | 36.64s |
| 3 | `minimax/music-2.6` | 4/4 | $0.1600 | 110.04s |
| 4 | `elevenlabs/music_v1` | 4/4 | $0.4550 | 20.76s |

## Local Aggregates

No local providers were present in any music benchmark run, so no local price, speed, automated-quality, or human-quality aggregate ranking is produced.

## Human Quality Note

No explicit `humanQualityScore` was available in any source report. Generic `qualityScore`, cost, speed, duration, file size, bitrate, lyrics metadata, and artifact metadata are not human-quality proxies, so no human-quality ranking is produced.

## Source Checks

All four source directories contained readable `manifest.json` and `provider-comparison-report.json` files. Each source report contained full `rankingSurfaces.service.price` and `rankingSurfaces.service.speed` arrays of length 4. Each source report contained empty `rankingSurfaces.service.automatedQuality` and `rankingSurfaces.service.humanQuality` arrays with unavailable reasons. `providerGroups.local.count` was 0 in all four runs.
