# Video Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/auto/autoshow-cli/docs/benchmarks/video/2026-05-21_06-51-12-517_video-gen`
- Total providers: 5 (0 local, 5 service)
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
| 1 | <code>lumalabs/ray-3.2</code> | $0.3000 |
| 2 | <code>replicate/pixverse/pixverse-v6</code> | $0.4538 |
| 3 | <code>grok/grok-imagine-video-1.5</code> | $0.6400 |
| 4 | <code>replicate/alibaba/happyhorse-1.1</code> | $0.7228 |
| 5 | <code>fal/minimax/h3</code> | $1.3000 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>grok/grok-imagine-video-1.5</code> | 32.75s |
| 2 | <code>replicate/pixverse/pixverse-v6</code> | 37.90s |
| 3 | <code>lumalabs/ray-3.2</code> | 44.38s |
| 4 | <code>replicate/alibaba/happyhorse-1.1</code> | 91.28s |
| 5 | <code>fal/minimax/h3</code> | 370.17s |

### Automated Quality

Unavailable: No explicit video qualityScore was available for service providers. File size, dimensions, duration, bitrate, cost, and speed are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>fal/minimax/h3</code> | n/a | 370.17s | $1.3000 |
| <code>grok/grok-imagine-video-1.5</code> | n/a | 32.75s | $0.6400 |
| <code>lumalabs/ray-3.2</code> | n/a | 44.38s | $0.3000 |
| <code>replicate/alibaba/happyhorse-1.1</code> | n/a | 91.28s | $0.7228 |
| <code>replicate/pixverse/pixverse-v6</code> | n/a | 37.90s | $0.4538 |

## Notes

- No explicit qualityScore or humanQualityScore evidence was found; video quality is not inferred from artifact metadata.
- Video artifact existence, file size, duration, dimensions, format, and bitrate are reported as evidence only and are not used as quality proxies.
