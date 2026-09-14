# Video Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/.grok/worktrees/auto-autoshow-cli/subagent-01a09f1a-40ed-7510-825c-8a26b77d53b8/docs/benchmarks/video/2026-05-21_06-51-12-517_video-gen`
- Total providers: 13 (0 local, 13 service)
- Local and service providers are intentionally not ranked against each other.
- Reports expose complete price, speed, automated-quality, and human-quality rankings for each group.

## Method

- Price rankings use zero monetary cost for local providers and reported monetary cost for services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Automated quality rankings use only explicit qualityScore evidence.
- Human quality rankings use only explicit humanQualityScore evidence.
- File size, dimensions, duration, bitrate, cost, and speed are not used as quality proxies.

## Local Providers

### Price

Unavailable: No local providers were found.

### Speed

Unavailable: No local providers were found.

### Automated Quality

Unavailable: No local providers were found.

### Human Quality

Unavailable: No local providers were found.

### Provider Detail

No local providers were found.

## Service Providers

### Price

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>minimax/T2V-01</code> | $0.1900 |
| 2 | <code>minimax/T2V-01-Director</code> | $0.1900 |
| 3 | <code>gemini/veo-3.1-lite-generate-preview</code> | $0.2000 |
| 4 | <code>glm/cogvideox-3</code> | $0.2000 |
| 5 | <code>minimax/MiniMax-Hailuo-2.3</code> | $0.2800 |
| 6 | <code>lumalabs/ray-3.2</code> | $0.3000 |
| 7 | <code>glm/viduq1-text</code> | $0.4000 |
| 8 | <code>replicate/pixverse/pixverse-v6</code> | $0.4538 |
| 9 | <code>replicate/wan-video/wan-2.7-t2v</code> | $0.5038 |
| 10 | <code>runway/gen4.5</code> | $0.6000 |
| 11 | <code>grok/grok-imagine-video-1.5</code> | $0.6400 |
| 12 | <code>replicate/alibaba/happyhorse-1.1</code> | $0.7228 |
| 13 | <code>fal/minimax/h3</code> | $1.3000 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>grok/grok-imagine-video-1.5</code> | 32.75s |
| 2 | <code>replicate/pixverse/pixverse-v6</code> | 37.90s |
| 3 | <code>gemini/veo-3.1-lite-generate-preview</code> | 41.41s |
| 4 | <code>lumalabs/ray-3.2</code> | 44.38s |
| 5 | <code>minimax/MiniMax-Hailuo-2.3</code> | 72.33s |
| 6 | <code>replicate/alibaba/happyhorse-1.1</code> | 91.28s |
| 7 | <code>runway/gen4.5</code> | 101.56s |
| 8 | <code>replicate/wan-video/wan-2.7-t2v</code> | 121.59s |
| 9 | <code>glm/cogvideox-3</code> | 149.94s |
| 10 | <code>minimax/T2V-01-Director</code> | 154.63s |
| 11 | <code>glm/viduq1-text</code> | 190.84s |
| 12 | <code>fal/minimax/h3</code> | 370.17s |
| 13 | <code>minimax/T2V-01</code> | 401.03s |

### Automated Quality

Unavailable: No explicit video qualityScore was available for service providers. File size, dimensions, duration, bitrate, cost, and speed are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>fal/minimax/h3</code> | n/a | 370.17s | $1.3000 |
| <code>gemini/veo-3.1-lite-generate-preview</code> | n/a | 41.41s | $0.2000 |
| <code>glm/cogvideox-3</code> | n/a | 149.94s | $0.2000 |
| <code>glm/viduq1-text</code> | n/a | 190.84s | $0.4000 |
| <code>grok/grok-imagine-video-1.5</code> | n/a | 32.75s | $0.6400 |
| <code>lumalabs/ray-3.2</code> | n/a | 44.38s | $0.3000 |
| <code>minimax/MiniMax-Hailuo-2.3</code> | n/a | 72.33s | $0.2800 |
| <code>minimax/T2V-01</code> | n/a | 401.03s | $0.1900 |
| <code>minimax/T2V-01-Director</code> | n/a | 154.63s | $0.1900 |
| <code>replicate/alibaba/happyhorse-1.1</code> | n/a | 91.28s | $0.7228 |
| <code>replicate/pixverse/pixverse-v6</code> | n/a | 37.90s | $0.4538 |
| <code>replicate/wan-video/wan-2.7-t2v</code> | n/a | 121.59s | $0.5038 |
| <code>runway/gen4.5</code> | n/a | 101.56s | $0.6000 |

## Notes

- No explicit qualityScore or humanQualityScore evidence was found; video quality is not inferred from artifact metadata.
- Video artifact existence, file size, duration, dimensions, format, and bitrate are reported as evidence only and are not used as quality proxies.
