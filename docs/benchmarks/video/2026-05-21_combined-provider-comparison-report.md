# Combined video provider comparison

Reconstructed from retained per-run comparison reports. Historical evaluator judgments were removed; no quality claim or replacement judgment is made. Cost and speed use the mean of available observations, grouped by provider/model identity. No provider calls were made.

## Sources

- [2026-05-21_06-50-32-135_video-gen](./2026-05-21_06-50-32-135_video-gen/provider-comparison-report.md)
- [2026-05-21_06-51-12-517_video-gen](./2026-05-21_06-51-12-517_video-gen/provider-comparison-report.md)

## Cost

| Rank | Provider/model                       | Coverage |     Mean |
| ---: | ------------------------------------ | -------: | -------: |
|    1 | minimax/T2V-01                       |      2/2 | $0.19000 |
|    2 | minimax/T2V-01-Director              |      2/2 | $0.19000 |
|    3 | glm/cogvideox-3                      |      2/2 | $0.20000 |
|    4 | gemini/veo-3.1-lite-generate-preview |      2/2 | $0.30000 |
|    5 | lumalabs/ray-3.2                     |      2/2 | $0.30000 |
|    6 | glm/viduq1-text                      |      2/2 | $0.40000 |
|    7 | minimax/MiniMax-Hailuo-2.3           |      2/2 | $0.42000 |
|    8 | replicate/pixverse/pixverse-v6       |      2/2 | $0.45375 |
|    9 | replicate/wan-video/wan-2.7-t2v      |      2/2 | $0.50380 |
|   10 | runway/gen4.5                        |      2/2 | $0.60000 |
|   11 | grok/grok-imagine-video-1.5          |      2/2 | $0.64000 |
|   12 | replicate/alibaba/happyhorse-1.1     |      2/2 | $0.72277 |
|   13 | fal/minimax/h3                       |      2/2 | $1.30000 |

## Processing time

| Rank | Provider/model                       | Coverage |      Mean |
| ---: | ------------------------------------ | -------: | --------: |
|    1 | grok/grok-imagine-video-1.5          |      2/2 |  32.557 s |
|    2 | replicate/pixverse/pixverse-v6       |      2/2 |  38.762 s |
|    3 | lumalabs/ray-3.2                     |      2/2 |  49.755 s |
|    4 | gemini/veo-3.1-lite-generate-preview |      2/2 |  51.728 s |
|    5 | replicate/alibaba/happyhorse-1.1     |      2/2 |  96.338 s |
|    6 | minimax/MiniMax-Hailuo-2.3           |      2/2 |  97.972 s |
|    7 | runway/gen4.5                        |      2/2 | 101.683 s |
|    8 | replicate/wan-video/wan-2.7-t2v      |      2/2 | 116.555 s |
|    9 | minimax/T2V-01-Director              |      2/2 | 154.844 s |
|   10 | glm/viduq1-text                      |      2/2 | 193.605 s |
|   11 | glm/cogvideox-3                      |      2/2 | 249.165 s |
|   12 | fal/minimax/h3                       |      2/2 | 276.875 s |
|   13 | minimax/T2V-01                       |      2/2 | 283.097 s |

## Quality

Unavailable: retained evidence contains no eligible automated or human quality scores.
