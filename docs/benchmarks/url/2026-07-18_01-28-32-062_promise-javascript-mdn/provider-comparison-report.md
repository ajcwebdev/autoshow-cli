# URL Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/url/2026-07-18_01-28-32-062_promise-javascript-mdn`
- Total providers: 5 (0 local, 5 service)
- Local and service providers are intentionally not ranked against each other.
- Reports expose complete price, speed, automated-quality, and human-quality rankings for each group.

## Method

- Price rankings use zero monetary cost for local providers and reported monetary cost for services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Automated quality rankings use WER/CER/coverage-derived extraction accuracy.
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
| 1 | <code>firecrawl</code> | $0.0008 |
| 2 | <code>spider</code> | $0.0012 |
| 3 | <code>zyte</code> | $0.0016 |
| 4 | <code>glm-reader</code> | $0.0100 |
| 5 | <code>supadata</code> | $0.0100 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>firecrawl</code> | 0.93s |
| 2 | <code>supadata</code> | 0.98s |
| 3 | <code>glm-reader</code> | 1.07s |
| 4 | <code>spider</code> | 1.19s |
| 5 | <code>zyte</code> | 6.02s |

### Automated Quality

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>spider</code> | 98.30 accuracy (2.17% WER, 2.44% CER, 100.00% coverage) |
| 2 | <code>supadata</code> | 96.76 accuracy (3.91% WER, 5.13% CER, 100.00% coverage) |
| 3 | <code>zyte</code> | 67.15 accuracy (39.32% WER, 44.30% CER, 91.56% coverage) |
| 4 | <code>firecrawl</code> | 53.15 accuracy (62.53% WER, 62.35% CER, 100.00% coverage) |
| 5 | <code>glm-reader</code> | 6.58 accuracy (98.19% WER, 87.51% CER, 10.19% coverage) |

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>firecrawl</code> | 62.53% WER, 62.35% CER, 100.00% coverage | 0.93s | $0.0008 |
| <code>glm-reader</code> | 98.19% WER, 87.51% CER, 10.19% coverage | 1.07s | $0.0100 |
| <code>spider</code> | 2.17% WER, 2.44% CER, 100.00% coverage | 1.19s | $0.0012 |
| <code>supadata</code> | 3.91% WER, 5.13% CER, 100.00% coverage | 0.98s | $0.0100 |
| <code>zyte</code> | 39.32% WER, 44.30% CER, 91.56% coverage | 6.02s | $0.0016 |

## Notes

- WER and CER use exact Levenshtein distance through 10,000 normalized elements; longer sequences trim common edges, use bounded exact wavefront alignment, then order-preserving token or content anchors with exact gap scoring and conservative edit lower bounds.
