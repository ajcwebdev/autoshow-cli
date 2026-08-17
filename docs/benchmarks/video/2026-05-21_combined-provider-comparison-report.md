# Video Combined Provider Comparison Report (2026-05-21)

This standalone report aggregates the two video benchmark runs dated 2026-05-21 directly from the existing `manifest.json` and `video-quality-report.json` files. No videos were regenerated and no judge was run.

## Source Inventory

- Runs: 2
- Provider result rows: 45
- Service providers: 23 models; 22 observed in 2/2 runs; `replicate/bytedance/seedance-2.0` was observed in 1/2
- Local providers: 0
- Automated quality score rows: 17 across 9 models
- Human quality score rows: 0

Aggregate quality is the unweighted average `qualityScore` across rows where an explicit judge score was present. Quality coverage is shown as score observations over total runs; cost and speed coverage is shown as observed provider rows over total runs. Cost is USD converted from report cents. For judged historical rows, the retained cost in `video-quality-report.json` takes precedence over a recomputed registry fallback; all other costs come from `manifest.json`. Speed is average processing time in seconds. Rankings are grouped by service providers because no local providers were present. Unjudged models remain in price and speed rankings with `n/a` quality and are not included in the automated-quality ranking.

| Run                                 | Prompt                                    |            Providers | Best automated quality                         | Cheapest service                   | Fastest service                        |
| ----------------------------------- | ----------------------------------------- | -------------------: | ---------------------------------------------- | ---------------------------------- | -------------------------------------- |
| `2026-05-21_06-50-32-135_video-gen` | a rainy neon city street, slow camera pan | 0 local / 23 service | `gemini/veo-3.1-generate-preview` (88.00)      | `fal/fal-ai/pixverse/c1` ($0.0250) | `grok/grok-imagine-video-1.5` (32.37s) |
| `2026-05-21_06-51-12-517_video-gen` | a man eating spaghetti                    | 0 local / 22 service | `gemini/veo-3.1-lite-generate-preview` (90.00) | `fal/fal-ai/pixverse/c1` ($0.0250) | `grok/grok-imagine-video` (21.02s)     |

## Service Aggregates

### Automated Quality Ranking

| Rank | Provider                               | Quality coverage | Avg quality score | Avg speed | Avg cost |
| ---: | -------------------------------------- | ---------------: | ----------------: | --------: | -------: |
|    1 | `gemini/veo-3.1-generate-preview`      |              1/2 |             88.00 |    56.68s |  $2.4000 |
|    2 | `grok/grok-imagine-video`              |              2/2 |             87.00 |    31.31s |  $0.3000 |
|    3 | `gemini/veo-3.1-lite-generate-preview` |              2/2 |             87.00 |    51.73s |  $0.3000 |
|    4 | `minimax/MiniMax-Hailuo-2.3`           |              2/2 |             86.00 |    97.97s |  $0.4200 |
|    5 | `gemini/veo-3.1-fast-generate-preview` |              2/2 |             84.00 |    56.78s |  $0.6000 |
|    6 | `minimax/T2V-01-Director`              |              2/2 |             81.00 |   154.84s |  $0.1900 |
|    7 | `minimax/T2V-01`                       |              2/2 |             80.00 |   283.10s |  $0.1900 |
|    8 | `glm/cogvideox-3`                      |              2/2 |             78.00 |   249.16s |  $0.2000 |
|    9 | `glm/viduq1-text`                      |              2/2 |             73.00 |   193.60s |  $0.4000 |

### Speed Ranking

| Rank | Provider                                | Coverage | Avg speed | Avg quality score | Quality coverage | Avg cost |
| ---: | --------------------------------------- | -------: | --------: | ----------------: | ---------------: | -------: |
|    1 | `grok/grok-imagine-video`               |      2/2 |    31.31s |             87.00 |              2/2 |  $0.3000 |
|    2 | `grok/grok-imagine-video-1.5`           |      2/2 |    32.56s |               n/a |              0/2 |  $0.6400 |
|    3 | `replicate/pixverse/pixverse-v6`        |      2/2 |    38.76s |               n/a |              0/2 |  $0.4538 |
|    4 | `fal/fal-ai/pixverse/c1`                |      2/2 |    48.45s |               n/a |              0/2 |  $0.0250 |
|    5 | `ltx/ltx-2-3-fast`                      |      2/2 |    48.75s |               n/a |              0/2 |  $0.4800 |
|    6 | `lumalabs/ray-3.2`                      |      2/2 |    49.75s |               n/a |              0/2 |  $0.3000 |
|    7 | `gemini/veo-3.1-lite-generate-preview`  |      2/2 |    51.73s |             87.00 |              2/2 |  $0.3000 |
|    8 | `gemini/veo-3.1-generate-preview`       |      2/2 |    56.68s |             88.00 |              1/2 |  $2.4000 |
|    9 | `gemini/veo-3.1-fast-generate-preview`  |      2/2 |    56.78s |             84.00 |              2/2 |  $0.6000 |
|   10 | `ltx/ltx-2-3-pro`                       |      2/2 |    86.37s |               n/a |              0/2 |  $0.6400 |
|   11 | `replicate/alibaba/happyhorse-1.1`      |      2/2 |    96.34s |               n/a |              0/2 |  $0.7228 |
|   12 | `minimax/MiniMax-Hailuo-2.3`            |      2/2 |    97.97s |             86.00 |              2/2 |  $0.4200 |
|   13 | `runway/gen4.5`                         |      2/2 |   101.68s |               n/a |              0/2 |  $0.6000 |
|   14 | `replicate/bytedance/seedance-2.0-fast` |      2/2 |   109.09s |               n/a |              0/2 |  $0.7628 |
|   15 | `replicate/wan-video/wan-2.7-t2v`       |      2/2 |   116.55s |               n/a |              0/2 |  $0.5038 |
|   16 | `replicate/bytedance/seedance-2.0`      |      1/2 |   121.75s |               n/a |              0/2 |  $0.9112 |
|   17 | `replicate/kwaivgi/kling-v3-video`      |      2/2 |   131.98s |               n/a |              0/2 |  $0.8470 |
|   18 | `replicate/kwaivgi/kling-v3-omni-video` |      2/2 |   147.26s |               n/a |              0/2 |  $0.8470 |
|   19 | `minimax/T2V-01-Director`               |      2/2 |   154.84s |             81.00 |              2/2 |  $0.1900 |
|   20 | `glm/viduq1-text`                       |      2/2 |   193.60s |             73.00 |              2/2 |  $0.4000 |
|   21 | `glm/cogvideox-3`                       |      2/2 |   249.16s |             78.00 |              2/2 |  $0.2000 |
|   22 | `fal/minimax/h3`                        |      2/2 |   276.88s |               n/a |              0/2 |  $1.3000 |
|   23 | `minimax/T2V-01`                        |      2/2 |   283.10s |             80.00 |              2/2 |  $0.1900 |

### Price Ranking

| Rank | Provider                                | Coverage | Avg cost | Avg quality score | Quality coverage | Avg speed |
| ---: | --------------------------------------- | -------: | -------: | ----------------: | ---------------: | --------: |
|    1 | `fal/fal-ai/pixverse/c1`                |      2/2 |  $0.0250 |               n/a |              0/2 |    48.45s |
|    2 | `minimax/T2V-01-Director`               |      2/2 |  $0.1900 |             81.00 |              2/2 |   154.84s |
|    3 | `minimax/T2V-01`                        |      2/2 |  $0.1900 |             80.00 |              2/2 |   283.10s |
|    4 | `glm/cogvideox-3`                       |      2/2 |  $0.2000 |             78.00 |              2/2 |   249.16s |
|    5 | `grok/grok-imagine-video`               |      2/2 |  $0.3000 |             87.00 |              2/2 |    31.31s |
|    6 | `gemini/veo-3.1-lite-generate-preview`  |      2/2 |  $0.3000 |             87.00 |              2/2 |    51.73s |
|    7 | `lumalabs/ray-3.2`                      |      2/2 |  $0.3000 |               n/a |              0/2 |    49.75s |
|    8 | `glm/viduq1-text`                       |      2/2 |  $0.4000 |             73.00 |              2/2 |   193.60s |
|    9 | `minimax/MiniMax-Hailuo-2.3`            |      2/2 |  $0.4200 |             86.00 |              2/2 |    97.97s |
|   10 | `replicate/pixverse/pixverse-v6`        |      2/2 |  $0.4538 |               n/a |              0/2 |    38.76s |
|   11 | `ltx/ltx-2-3-fast`                      |      2/2 |  $0.4800 |               n/a |              0/2 |    48.75s |
|   12 | `replicate/wan-video/wan-2.7-t2v`       |      2/2 |  $0.5038 |               n/a |              0/2 |   116.55s |
|   13 | `gemini/veo-3.1-fast-generate-preview`  |      2/2 |  $0.6000 |             84.00 |              2/2 |    56.78s |
|   14 | `runway/gen4.5`                         |      2/2 |  $0.6000 |               n/a |              0/2 |   101.68s |
|   15 | `grok/grok-imagine-video-1.5`           |      2/2 |  $0.6400 |               n/a |              0/2 |    32.56s |
|   16 | `ltx/ltx-2-3-pro`                       |      2/2 |  $0.6400 |               n/a |              0/2 |    86.37s |
|   17 | `replicate/alibaba/happyhorse-1.1`      |      2/2 |  $0.7228 |               n/a |              0/2 |    96.34s |
|   18 | `replicate/bytedance/seedance-2.0-fast` |      2/2 |  $0.7628 |               n/a |              0/2 |   109.09s |
|   19 | `replicate/kwaivgi/kling-v3-video`      |      2/2 |  $0.8470 |               n/a |              0/2 |   131.98s |
|   20 | `replicate/kwaivgi/kling-v3-omni-video` |      2/2 |  $0.8470 |               n/a |              0/2 |   147.26s |
|   21 | `replicate/bytedance/seedance-2.0`      |      1/2 |  $0.9112 |               n/a |              0/2 |   121.75s |
|   22 | `fal/minimax/h3`                        |      2/2 |  $1.3000 |               n/a |              0/2 |   276.88s |
|   23 | `gemini/veo-3.1-generate-preview`       |      2/2 |  $2.4000 |             88.00 |              1/2 |    56.68s |

## Local Aggregates

No local providers were present in either video benchmark run, so no local price, speed, automated-quality, or human-quality aggregate ranking is produced.

## Human Quality Note

No explicit `humanQualityScore` was available in either source run. Generic `qualityScore`, cost, speed, duration, file size, dimensions, bitrate, and artifact metadata are not human-quality proxies, so no human-quality ranking is produced.

## Source Checks

Both source directories contained readable `manifest.json` and `video-quality-report.json` files. The run metadata contained 23 service rows in `2026-05-21_06-50-32-135_video-gen` and 22 service rows in `2026-05-21_06-51-12-517_video-gen`. The quality artifacts contained 9 explicit score rows and 8 explicit score rows. All 45 run rows had cost and processing-time evidence. No local provider or explicit human-quality evidence was present.
