# Video Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/video/2026-05-21_06-51-12-517_video-gen`
- Total providers: 3 (0 local, 3 service)
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

| Rank | Provider                                      | Evidence |
| ---: | --------------------------------------------- | -------- |
| 1    | <code>grok/grok-imagine-video-1.5-lite</code> | $0.1600  |
| 2    | <code>grok/grok-imagine-video-1.5</code>      | $0.6400  |
| 3    | <code>gemini/gemini-omni-1.1-flash</code>     | $1.0000  |

### Speed

| Rank | Provider                                      | Evidence |
| ---: | --------------------------------------------- | -------- |
| 1    | <code>grok/grok-imagine-video-1.5-lite</code> | 22.46s   |
| 2    | <code>grok/grok-imagine-video-1.5</code>      | 32.75s   |
| 3    | <code>gemini/gemini-omni-1.1-flash</code>     | 33.28s   |

### Automated Quality

Unavailable: No explicit video qualityScore was available for service providers. File size, dimensions, duration, bitrate, cost, and speed are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider                                      | Quality Evidence | Processing Time | Monetary Cost |
| --------------------------------------------- | ---------------- | --------------: | ------------: |
| <code>gemini/gemini-omni-1.1-flash</code>     | n/a              | 33.28s          | $1.0000       |
| <code>grok/grok-imagine-video-1.5</code>      | n/a              | 32.75s          | $0.6400       |
| <code>grok/grok-imagine-video-1.5-lite</code> | n/a              | 22.46s          | $0.1600       |

## Notes

- No explicit qualityScore or humanQualityScore evidence was found; video quality is not inferred from artifact metadata.
- Video artifact existence, file size, duration, dimensions, format, and bitrate are reported as evidence only and are not used as quality proxies.
