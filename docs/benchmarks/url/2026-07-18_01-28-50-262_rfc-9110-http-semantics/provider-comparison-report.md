# URL Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/url/2026-07-18_01-28-50-262_rfc-9110-http-semantics`
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
|    1 | <code>firecrawl</code>  | 1.05s    |
|    2 | <code>spider</code>     | 1.67s    |
|    3 | <code>glm-reader</code> | 7.54s    |
|    4 | <code>zyte</code>       | 10.87s   |
|    5 | <code>supadata</code>   | 13.41s   |

### Automated Quality

| Rank | Provider                | Evidence                                                |
| ---: | ----------------------- | ------------------------------------------------------- |
|    1 | <code>firecrawl</code>  | 99.83 accuracy (0.22% WER, 0.14% CER, 99.90% coverage)  |
|    2 | <code>spider</code>     | 98.31 accuracy (2.24% WER, 2.29% CER, 100.00% coverage) |
|    3 | <code>glm-reader</code> | 96.76 accuracy (4.45% WER, 4.08% CER, 100.00% coverage) |
|    4 | <code>supadata</code>   | 96.28 accuracy (5.13% WER, 4.58% CER, 99.97% coverage)  |
|    5 | <code>zyte</code>       | 6.80 accuracy (96.62% WER, 96.47% CER, 16.92% coverage) |

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider                | Quality Evidence                        | Processing Time | Monetary Cost |
| ----------------------- | --------------------------------------- | --------------: | ------------: |
| <code>firecrawl</code>  | 0.22% WER, 0.14% CER, 99.90% coverage   |           1.05s |       $0.0008 |
| <code>glm-reader</code> | 4.45% WER, 4.08% CER, 100.00% coverage  |           7.54s |       $0.0100 |
| <code>spider</code>     | 2.24% WER, 2.29% CER, 100.00% coverage  |           1.67s |       $0.0012 |
| <code>supadata</code>   | 5.13% WER, 4.58% CER, 99.97% coverage   |          13.41s |       $0.0100 |
| <code>zyte</code>       | 96.62% WER, 96.47% CER, 16.92% coverage |          10.87s |       $0.0016 |

## Notes

- WER and CER use exact Levenshtein distance through 10,000 normalized elements; longer sequences trim common edges, use bounded exact wavefront alignment, then order-preserving token or content anchors with exact gap scoring and conservative edit lower bounds.
