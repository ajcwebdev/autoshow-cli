# Video Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/.grok/worktrees/auto-autoshow-cli/subagent-01a09f1a-40ed-7510-825c-8a26b77d53b8/docs/benchmarks/video/2026-05-21_06-50-32-135_video-gen`
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
| 3 | <code>glm/cogvideox-3</code> | $0.2000 |
| 4 | <code>lumalabs/ray-3.2</code> | $0.3000 |
| 5 | <code>gemini/veo-3.1-lite-generate-preview</code> | $0.4000 |
| 6 | <code>glm/viduq1-text</code> | $0.4000 |
| 7 | <code>replicate/pixverse/pixverse-v6</code> | $0.4538 |
| 8 | <code>replicate/wan-video/wan-2.7-t2v</code> | $0.5038 |
| 9 | <code>minimax/MiniMax-Hailuo-2.3</code> | $0.5600 |
| 10 | <code>runway/gen4.5</code> | $0.6000 |
| 11 | <code>grok/grok-imagine-video-1.5</code> | $0.6400 |
| 12 | <code>replicate/alibaba/happyhorse-1.1</code> | $0.7228 |
| 13 | <code>fal/minimax/h3</code> | $1.3000 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>grok/grok-imagine-video-1.5</code> | 32.37s |
| 2 | <code>replicate/pixverse/pixverse-v6</code> | 39.63s |
| 3 | <code>lumalabs/ray-3.2</code> | 55.13s |
| 4 | <code>gemini/veo-3.1-lite-generate-preview</code> | 62.05s |
| 5 | <code>replicate/alibaba/happyhorse-1.1</code> | 101.40s |
| 6 | <code>runway/gen4.5</code> | 101.80s |
| 7 | <code>replicate/wan-video/wan-2.7-t2v</code> | 111.52s |
| 8 | <code>minimax/MiniMax-Hailuo-2.3</code> | 123.61s |
| 9 | <code>minimax/T2V-01-Director</code> | 155.06s |
| 10 | <code>minimax/T2V-01</code> | 165.16s |
| 11 | <code>fal/minimax/h3</code> | 183.58s |
| 12 | <code>glm/viduq1-text</code> | 196.37s |
| 13 | <code>glm/cogvideox-3</code> | 348.39s |

### Automated Quality

Unavailable: No explicit video qualityScore was available for service providers. File size, dimensions, duration, bitrate, cost, and speed are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>fal/minimax/h3</code> | n/a | 183.58s | $1.3000 |
| <code>gemini/veo-3.1-lite-generate-preview</code> | n/a | 62.05s | $0.4000 |
| <code>glm/cogvideox-3</code> | n/a | 348.39s | $0.2000 |
| <code>glm/viduq1-text</code> | n/a | 196.37s | $0.4000 |
| <code>grok/grok-imagine-video-1.5</code> | n/a | 32.37s | $0.6400 |
| <code>lumalabs/ray-3.2</code> | n/a | 55.13s | $0.3000 |
| <code>minimax/MiniMax-Hailuo-2.3</code> | n/a | 123.61s | $0.5600 |
| <code>minimax/T2V-01</code> | n/a | 165.16s | $0.1900 |
| <code>minimax/T2V-01-Director</code> | n/a | 155.06s | $0.1900 |
| <code>replicate/alibaba/happyhorse-1.1</code> | n/a | 101.40s | $0.7228 |
| <code>replicate/pixverse/pixverse-v6</code> | n/a | 39.63s | $0.4538 |
| <code>replicate/wan-video/wan-2.7-t2v</code> | n/a | 111.52s | $0.5038 |
| <code>runway/gen4.5</code> | n/a | 101.80s | $0.6000 |

## Notes

- No explicit qualityScore or humanQualityScore evidence was found; video quality is not inferred from artifact metadata.
- Video artifact existence, file size, duration, dimensions, format, and bitrate are reported as evidence only and are not used as quality proxies.
