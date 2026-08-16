# Image Combined Provider Comparison Report (2026-05-21)

This standalone report aggregates the two image benchmark runs dated 2026-05-21 directly from the existing `manifest.json` and `image-quality-report.json` files. No images were regenerated and no judge was run.

## Source Inventory

- Runs: 2
- Provider result rows: 74
- Service providers: 37 models; all observed in 2/2 runs
- Local providers: 0
- Automated quality score rows: 26 across 13 models
- Human quality score rows: 0

Aggregate quality is the unweighted average `qualityScore` across rows where an explicit judge score was present. Quality coverage is shown as score observations over total runs; cost and speed coverage is shown as observed provider rows over total runs. Cost is USD converted from report cents. For judged historical rows, the retained cost in `image-quality-report.json` takes precedence over a recomputed registry fallback; all other costs come from `manifest.json`. Speed is average processing time in seconds. Rankings are grouped by service providers because no local providers were present. Unjudged models remain in price and speed rankings with `n/a` quality and are not included in the automated-quality ranking.

| Run                                 | Prompt                       |            Providers | Best automated quality        | Cheapest service                        | Fastest service                              |
| ----------------------------------- | ---------------------------- | -------------------: | ----------------------------- | --------------------------------------- | -------------------------------------------- |
| `2026-05-21_10-33-37-508_image-gen` | media-processing infographic | 0 local / 37 service | `recraft/recraftv4_1` (90.00) | `fal/microsoft/mai-image-2.5` ($0.0021) | `gemini/gemini-3.1-flash-lite-image` (2.54s) |
| `2026-05-21_10-35-24-459_image-gen` | recursive pencil drawing     | 0 local / 37 service | `openai/gpt-image-2` (90.00)  | `fal/microsoft/mai-image-2.5` ($0.0021) | `gemini/gemini-3.1-flash-lite-image` (3.16s) |

## Service Aggregates

### Automated Quality Ranking

| Rank | Provider                                | Quality coverage | Avg quality score | Avg speed | Avg cost |
| ---: | --------------------------------------- | ---------------: | ----------------: | --------: | -------: |
|    1 | `openai/gpt-image-2`                    |              2/2 |             89.00 |   105.69s |  $0.0530 |
|    2 | `recraft/recraftv4_1`                   |              2/2 |             88.00 |     8.60s |  $0.0400 |
|    3 | `recraft/recraftv4_1_utility_pro`       |              2/2 |             86.00 |    15.69s |  $0.2500 |
|    4 | `recraft/recraftv4_1_utility`           |              2/2 |             86.00 |    17.11s |  $0.0400 |
|    5 | `recraft/recraftv4_1_pro`               |              2/2 |             85.00 |    12.65s |  $0.2500 |
|    6 | `gemini/gemini-3.1-flash-image-preview` |              2/2 |             85.00 |    20.56s |  $0.0670 |
|    7 | `grok/grok-imagine-image-quality`       |              2/2 |             84.00 |     4.88s |  $0.0500 |
|    8 | `bfl/flux-2-flex`                       |              2/2 |             82.00 |    16.41s |  $0.0500 |
|    9 | `bfl/flux-2-max`                        |              2/2 |             80.00 |    44.41s |  $0.0700 |
|   10 | `grok/grok-imagine-image`               |              2/2 |             78.00 |     5.75s |  $0.0200 |
|   11 | `bfl/flux-2-pro`                        |              2/2 |             77.00 |    14.16s |  $0.0300 |
|   12 | `reve/latest`                           |              2/2 |             75.00 |     6.50s |  $0.0240 |
|   13 | `reve/reve-create@20250915`             |              2/2 |             70.00 |     6.32s |  $0.0240 |

### Speed Ranking

| Rank | Provider                                     | Coverage | Avg speed | Avg quality score | Quality coverage | Avg cost |
| ---: | -------------------------------------------- | -------: | --------: | ----------------: | ---------------: | -------: |
|    1 | `gemini/gemini-3.1-flash-lite-image`         |      2/2 |     2.85s |               n/a |              0/2 |  $0.0336 |
|    2 | `grok/grok-imagine-image-quality`            |      2/2 |     4.88s |             84.00 |              2/2 |  $0.0500 |
|    3 | `grok/grok-imagine-image`                    |      2/2 |     5.75s |             78.00 |              2/2 |  $0.0200 |
|    4 | `reve/reve-create@20250915`                  |      2/2 |     6.32s |             70.00 |              2/2 |  $0.0240 |
|    5 | `reve/latest`                                |      2/2 |     6.50s |             75.00 |              2/2 |  $0.0240 |
|    6 | `bfl/flux-2-klein-4b`                        |      2/2 |     7.06s |               n/a |              0/2 |  $0.0140 |
|    7 | `gemini/gemini-3.1-flash-image`              |      2/2 |     7.36s |               n/a |              0/2 |  $0.0670 |
|    8 | `bfl/flux-2-klein-9b`                        |      2/2 |     7.38s |               n/a |              0/2 |  $0.0150 |
|    9 | `recraft/recraftv4_1`                        |      2/2 |     8.60s |             88.00 |              2/2 |  $0.0400 |
|   10 | `recraft/recraftv4_1_pro`                    |      2/2 |    12.65s |             85.00 |              2/2 |  $0.2500 |
|   11 | `bfl/flux-2-pro`                             |      2/2 |    14.16s |             77.00 |              2/2 |  $0.0300 |
|   12 | `replicate/qwen/qwen-image-2`                |      2/2 |    14.27s |               n/a |              0/2 |  $0.0350 |
|   13 | `replicate/qwen/qwen-image-2-pro`            |      2/2 |    14.51s |               n/a |              0/2 |  $0.0750 |
|   14 | `recraft/recraftv4_1_utility_pro`            |      2/2 |    15.69s |             86.00 |              2/2 |  $0.2500 |
|   15 | `bfl/flux-2-flex`                            |      2/2 |    16.41s |             82.00 |              2/2 |  $0.0500 |
|   16 | `recraft/recraftv4_1_utility`                |      2/2 |    17.11s |             86.00 |              2/2 |  $0.0400 |
|   17 | `gemini/gemini-3-pro-image`                  |      2/2 |    18.33s |               n/a |              0/2 |  $0.1340 |
|   18 | `replicate/bytedance/seedream-4.5`           |      2/2 |    18.82s |               n/a |              0/2 |  $0.0400 |
|   19 | `gemini/gemini-3.1-flash-image-preview`      |      2/2 |    20.56s |             85.00 |              2/2 |  $0.0670 |
|   20 | `replicate/ideogram-ai/ideogram-v4-turbo`    |      2/2 |    20.60s |               n/a |              0/2 |  $0.0300 |
|   21 | `replicate/ideogram-ai/ideogram-v4-quality`  |      2/2 |    34.12s |               n/a |              0/2 |  $0.1000 |
|   22 | `replicate/wan-video/wan-2.7-image`          |      2/2 |    35.53s |               n/a |              0/2 |  $0.0300 |
|   23 | `fal/fal-ai/hidream-o1-image`                |      2/2 |    35.85s |               n/a |              0/2 |  $0.0100 |
|   24 | `fal/microsoft/mai-image-2.5`                |      2/2 |    36.42s |               n/a |              0/2 |  $0.0021 |
|   25 | `replicate/ideogram-ai/ideogram-v4-balanced` |      2/2 |    43.27s |               n/a |              0/2 |  $0.0600 |
|   26 | `fal/microsoft/mai-image-2.5-pro`            |      2/2 |    43.43s |               n/a |              0/2 |  $1.5000 |
|   27 | `bfl/flux-2-max`                             |      2/2 |    44.41s |             80.00 |              2/2 |  $0.0700 |
|   28 | `replicate/wan-video/wan-2.7-image-pro`      |      2/2 |    48.50s |               n/a |              0/2 |  $0.0300 |
|   29 | `fal/reve/2.1`                               |      2/2 |    53.51s |               n/a |              0/2 |  $0.2500 |
|   30 | `replicate/bytedance/seedream-5-lite`        |      2/2 |    66.50s |               n/a |              0/2 |  $0.0350 |
|   31 | `lumalabs/uni-1`                             |      2/2 |    72.09s |               n/a |              0/2 |  $0.0404 |
|   32 | `replicate/prunaai/ernie-image`              |      2/2 |    80.78s |               n/a |              0/2 |  $0.0528 |
|   33 | `openai/gpt-image-2`                         |      2/2 |   105.69s |             89.00 |              2/2 |  $0.0530 |
|   34 | `lumalabs/uni-1-max`                         |      2/2 |   113.55s |               n/a |              0/2 |  $0.1000 |
|   35 | `replicate/bytedance/seedream-5-pro`         |      2/2 |   175.24s |               n/a |              0/2 |  $0.0450 |
|   36 | `replicate/prunaai/ernie-image-turbo`        |      2/2 |   200.38s |               n/a |              0/2 |  $0.0115 |
|   37 | `fal/alibaba/qwen-image-3`                   |      2/2 |   481.42s |               n/a |              0/2 |  $0.0051 |

### Price Ranking

| Rank | Provider                                     | Coverage | Avg cost | Avg quality score | Quality coverage | Avg speed |
| ---: | -------------------------------------------- | -------: | -------: | ----------------: | ---------------: | --------: |
|    1 | `fal/microsoft/mai-image-2.5`                |      2/2 |  $0.0021 |               n/a |              0/2 |    36.42s |
|    2 | `fal/alibaba/qwen-image-3`                   |      2/2 |  $0.0051 |               n/a |              0/2 |   481.42s |
|    3 | `fal/fal-ai/hidream-o1-image`                |      2/2 |  $0.0100 |               n/a |              0/2 |    35.85s |
|    4 | `replicate/prunaai/ernie-image-turbo`        |      2/2 |  $0.0115 |               n/a |              0/2 |   200.38s |
|    5 | `bfl/flux-2-klein-4b`                        |      2/2 |  $0.0140 |               n/a |              0/2 |     7.06s |
|    6 | `bfl/flux-2-klein-9b`                        |      2/2 |  $0.0150 |               n/a |              0/2 |     7.38s |
|    7 | `grok/grok-imagine-image`                    |      2/2 |  $0.0200 |             78.00 |              2/2 |     5.75s |
|    8 | `reve/latest`                                |      2/2 |  $0.0240 |             75.00 |              2/2 |     6.50s |
|    9 | `reve/reve-create@20250915`                  |      2/2 |  $0.0240 |             70.00 |              2/2 |     6.32s |
|   10 | `bfl/flux-2-pro`                             |      2/2 |  $0.0300 |             77.00 |              2/2 |    14.16s |
|   11 | `replicate/ideogram-ai/ideogram-v4-turbo`    |      2/2 |  $0.0300 |               n/a |              0/2 |    20.60s |
|   12 | `replicate/wan-video/wan-2.7-image`          |      2/2 |  $0.0300 |               n/a |              0/2 |    35.53s |
|   13 | `replicate/wan-video/wan-2.7-image-pro`      |      2/2 |  $0.0300 |               n/a |              0/2 |    48.50s |
|   14 | `gemini/gemini-3.1-flash-lite-image`         |      2/2 |  $0.0336 |               n/a |              0/2 |     2.85s |
|   15 | `replicate/qwen/qwen-image-2`                |      2/2 |  $0.0350 |               n/a |              0/2 |    14.27s |
|   16 | `replicate/bytedance/seedream-5-lite`        |      2/2 |  $0.0350 |               n/a |              0/2 |    66.50s |
|   17 | `recraft/recraftv4_1`                        |      2/2 |  $0.0400 |             88.00 |              2/2 |     8.60s |
|   18 | `recraft/recraftv4_1_utility`                |      2/2 |  $0.0400 |             86.00 |              2/2 |    17.11s |
|   19 | `replicate/bytedance/seedream-4.5`           |      2/2 |  $0.0400 |               n/a |              0/2 |    18.82s |
|   20 | `lumalabs/uni-1`                             |      2/2 |  $0.0404 |               n/a |              0/2 |    72.09s |
|   21 | `replicate/bytedance/seedream-5-pro`         |      2/2 |  $0.0450 |               n/a |              0/2 |   175.24s |
|   22 | `grok/grok-imagine-image-quality`            |      2/2 |  $0.0500 |             84.00 |              2/2 |     4.88s |
|   23 | `bfl/flux-2-flex`                            |      2/2 |  $0.0500 |             82.00 |              2/2 |    16.41s |
|   24 | `replicate/prunaai/ernie-image`              |      2/2 |  $0.0528 |               n/a |              0/2 |    80.78s |
|   25 | `openai/gpt-image-2`                         |      2/2 |  $0.0530 |             89.00 |              2/2 |   105.69s |
|   26 | `replicate/ideogram-ai/ideogram-v4-balanced` |      2/2 |  $0.0600 |               n/a |              0/2 |    43.27s |
|   27 | `gemini/gemini-3.1-flash-image-preview`      |      2/2 |  $0.0670 |             85.00 |              2/2 |    20.56s |
|   28 | `gemini/gemini-3.1-flash-image`              |      2/2 |  $0.0670 |               n/a |              0/2 |     7.36s |
|   29 | `bfl/flux-2-max`                             |      2/2 |  $0.0700 |             80.00 |              2/2 |    44.41s |
|   30 | `replicate/qwen/qwen-image-2-pro`            |      2/2 |  $0.0750 |               n/a |              0/2 |    14.51s |
|   31 | `replicate/ideogram-ai/ideogram-v4-quality`  |      2/2 |  $0.1000 |               n/a |              0/2 |    34.12s |
|   32 | `lumalabs/uni-1-max`                         |      2/2 |  $0.1000 |               n/a |              0/2 |   113.55s |
|   33 | `gemini/gemini-3-pro-image`                  |      2/2 |  $0.1340 |               n/a |              0/2 |    18.33s |
|   34 | `recraft/recraftv4_1_utility_pro`            |      2/2 |  $0.2500 |             86.00 |              2/2 |    15.69s |
|   35 | `recraft/recraftv4_1_pro`                    |      2/2 |  $0.2500 |             85.00 |              2/2 |    12.65s |
|   36 | `fal/reve/2.1`                               |      2/2 |  $0.2500 |               n/a |              0/2 |    53.51s |
|   37 | `fal/microsoft/mai-image-2.5-pro`            |      2/2 |  $1.5000 |               n/a |              0/2 |    43.43s |

## Local Aggregates

No local providers were present in either image benchmark run, so no local price, speed, automated-quality, or human-quality aggregate ranking is produced.

## Human Quality Note

No explicit `humanQualityScore` was available in either source run. Generic `qualityScore`, cost, speed, duration, file size, dimensions, bitrate, and artifact metadata are not human-quality proxies, so no human-quality ranking is produced.

## Source Checks

Both source directories contained readable `manifest.json` and `image-quality-report.json` files. The run metadata contained 37 service rows in `2026-05-21_10-33-37-508_image-gen` and 37 service rows in `2026-05-21_10-35-24-459_image-gen`. The quality artifacts contained 13 explicit score rows and 13 explicit score rows. All 74 run rows had cost and processing-time evidence. No local provider or explicit human-quality evidence was present.
