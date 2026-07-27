# URL Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/url/2026-07-18_01-28-41-200_apollo-11-wikipedia`
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
| 1 | <code>firecrawl</code> | 0.92s |
| 2 | <code>spider</code> | 1.55s |
| 3 | <code>glm-reader</code> | 4.34s |
| 4 | <code>supadata</code> | 7.23s |
| 5 | <code>zyte</code> | 10.06s |

### Automated Quality

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>spider</code> | 69.40 accuracy (39.96% WER, 40.01% CER, 97.55% coverage) |
| 2 | <code>glm-reader</code> | 69.03 accuracy (39.46% WER, 38.68% CER, 93.72% coverage) |
| 3 | <code>zyte</code> | 61.50 accuracy (49.70% WER, 48.50% CER, 93.92% coverage) |
| 4 | <code>firecrawl</code> | 60.70 accuracy (52.27% WER, 52.64% CER, 100.00% coverage) |
| 5 | <code>supadata</code> | 51.02 accuracy (50.69% WER, 92.57% CER, 98.03% coverage) |

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider | Quality Evidence | Processing Time | Monetary Cost |
| --- | --- | ---: | ---: |
| <code>firecrawl</code> | 52.27% WER, 52.64% CER, 100.00% coverage | 0.92s | $0.0008 |
| <code>glm-reader</code> | 39.46% WER, 38.68% CER, 93.72% coverage | 4.34s | $0.0100 |
| <code>spider</code> | 39.96% WER, 40.01% CER, 97.55% coverage | 1.55s | $0.0012 |
| <code>supadata</code> | 50.69% WER, 92.57% CER, 98.03% coverage | 7.23s | $0.0100 |
| <code>zyte</code> | 49.70% WER, 48.50% CER, 93.92% coverage | 10.06s | $0.0016 |

## Notes

- WER and CER use exact Levenshtein distance through 10,000 normalized elements; longer sequences trim common edges, use bounded exact wavefront alignment, then order-preserving token or content anchors with exact gap scoring and conservative edit lower bounds.
