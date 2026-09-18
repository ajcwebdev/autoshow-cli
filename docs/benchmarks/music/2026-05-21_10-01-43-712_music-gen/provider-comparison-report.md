# Music Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/music/2026-05-21_10-01-43-712_music-gen`
- Total providers: 2 (0 local, 2 service)
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
| 1 | <code>minimax/music-3.0</code> | $0.1600 |
| 2 | <code>elevenlabs/music_v2</code> | $0.4500 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>elevenlabs/music_v2</code> | 22.05s |
| 2 | <code>minimax/music-3.0</code> | 112.17s |

### Automated Quality

Unavailable: No explicit music qualityScore was available for service providers. File size, dimensions, duration, bitrate, cost, and speed are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>elevenlabs/music_v2</code> | n/a | 22.05s | $0.4500 |
| <code>minimax/music-3.0</code> | n/a | 112.17s | $0.1600 |

## Notes

- Music artifact existence, file size, duration, lyrics, and audio metadata are reported as evidence only; audio/music quality is not assessed or scored.
