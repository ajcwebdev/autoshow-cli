# URL Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/url/2026-07-18_01-29-01-024_thinking-in-react-react`
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

| Rank | Provider                | Evidence |
| ---: | ----------------------- | -------- |
|    1 | <code>firecrawl</code>  | $0.0008  |
|    2 | <code>spider</code>     | $0.0012  |
|    3 | <code>zyte</code>       | $0.0016  |
|    4 | <code>glm-reader</code> | $0.0100  |
|    5 | <code>supadata</code>   | $0.0100  |

### Speed

| Rank | Provider                | Evidence |
| ---: | ----------------------- | -------- |
|    1 | <code>firecrawl</code>  | 0.54s    |
|    2 | <code>supadata</code>   | 0.89s    |
|    3 | <code>spider</code>     | 1.48s    |
|    4 | <code>glm-reader</code> | 1.79s    |
|    5 | <code>zyte</code>       | 12.17s   |

### Automated Quality

| Rank | Provider                | Evidence                                                  |
| ---: | ----------------------- | --------------------------------------------------------- |
|    1 | <code>spider</code>     | 93.61 accuracy (8.09% WER, 8.97% CER, 99.58% coverage)    |
|    2 | <code>glm-reader</code> | 84.76 accuracy (19.12% WER, 22.32% CER, 99.58% coverage)  |
|    3 | <code>supadata</code>   | 76.05 accuracy (28.05% WER, 39.72% CER, 100.00% coverage) |
|    4 | <code>firecrawl</code>  | 60.52 accuracy (50.60% WER, 56.72% CER, 100.00% coverage) |
|    5 | <code>zyte</code>       | 19.16 accuracy (84.79% WER, 84.67% CER, 30.90% coverage)  |

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider                | Quality Evidence                         | Processing Time | Monetary Cost |
| ----------------------- | ---------------------------------------- | --------------: | ------------: |
| <code>firecrawl</code>  | 50.60% WER, 56.72% CER, 100.00% coverage |           0.54s |       $0.0008 |
| <code>glm-reader</code> | 19.12% WER, 22.32% CER, 99.58% coverage  |           1.79s |       $0.0100 |
| <code>spider</code>     | 8.09% WER, 8.97% CER, 99.58% coverage    |           1.48s |       $0.0012 |
| <code>supadata</code>   | 28.05% WER, 39.72% CER, 100.00% coverage |           0.89s |       $0.0100 |
| <code>zyte</code>       | 84.79% WER, 84.67% CER, 30.90% coverage  |          12.17s |       $0.0016 |

## Notes

- WER and CER use exact Levenshtein distance through 10,000 normalized elements; longer sequences trim common edges, use bounded exact wavefront alignment, then order-preserving token or content anchors with exact gap scoring and conservative edit lower bounds.
