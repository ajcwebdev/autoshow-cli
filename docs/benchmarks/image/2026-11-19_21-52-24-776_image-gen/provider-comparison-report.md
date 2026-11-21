# Image Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/image/2026-11-19_21-52-24-776_image-gen`
- Total providers: 4 (0 local, 4 service)
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
| 1 | <code>gemini/gemini-nano-banana-2.1</code> | $0.0336 |
| 2 | <code>grok/grok-imagine-image-2.0</code> | $0.0400 |
| 3 | <code>openai/gpt-image-2.6-sunburst</code> | $0.0599 |
| 4 | <code>openai/gpt-image-2.6-flare</code> | $0.0745 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>grok/grok-imagine-image-2.0</code> | 10.98s |
| 2 | <code>gemini/gemini-nano-banana-2.1</code> | 13.00s |
| 3 | <code>openai/gpt-image-2.6-flare</code> | 14.78s |
| 4 | <code>openai/gpt-image-2.6-sunburst</code> | 33.85s |

### Automated Quality

Unavailable: No explicit image qualityScore was available for service providers. File size, dimensions, duration, bitrate, cost, and speed are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>gemini/gemini-nano-banana-2.1</code> | n/a | 13.00s | $0.0336 |
| <code>grok/grok-imagine-image-2.0</code> | n/a | 10.98s | $0.0400 |
| <code>openai/gpt-image-2.6-flare</code> | n/a | 14.78s | $0.0745 |
| <code>openai/gpt-image-2.6-sunburst</code> | n/a | 33.85s | $0.0599 |

## Notes

- Image existence, dimensions, and file size are reported as evidence only; they are not scoring inputs.
