# URL Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/url/2026-07-18_01-28-55-132_pride-and-prejudice-project-gutenberg`
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
|    1 | <code>spider</code>     | 2.65s    |
|    2 | <code>glm-reader</code> | 3.87s    |
|    3 | <code>firecrawl</code>  | 5.92s    |
|    4 | <code>supadata</code>   | 9.92s    |
|    5 | <code>zyte</code>       | 11.38s   |

### Automated Quality

| Rank | Provider                | Evidence                                                |
| ---: | ----------------------- | ------------------------------------------------------- |
|    1 | <code>zyte</code>       | 99.78 accuracy (0.27% WER, 0.28% CER, 99.93% coverage)  |
|    2 | <code>spider</code>     | 99.56 accuracy (0.57% WER, 0.60% CER, 99.97% coverage)  |
|    3 | <code>glm-reader</code> | 99.48 accuracy (0.67% WER, 0.76% CER, 100.00% coverage) |
|    4 | <code>firecrawl</code>  | 99.26 accuracy (0.95% WER, 1.06% CER, 100.00% coverage) |
|    5 | <code>supadata</code>   | 99.25 accuracy (0.94% WER, 1.10% CER, 100.00% coverage) |

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider                | Quality Evidence                       | Processing Time | Monetary Cost |
| ----------------------- | -------------------------------------- | --------------: | ------------: |
| <code>firecrawl</code>  | 0.95% WER, 1.06% CER, 100.00% coverage |           5.92s |       $0.0008 |
| <code>glm-reader</code> | 0.67% WER, 0.76% CER, 100.00% coverage |           3.87s |       $0.0100 |
| <code>spider</code>     | 0.57% WER, 0.60% CER, 99.97% coverage  |           2.65s |       $0.0012 |
| <code>supadata</code>   | 0.94% WER, 1.10% CER, 100.00% coverage |           9.92s |       $0.0100 |
| <code>zyte</code>       | 0.27% WER, 0.28% CER, 99.93% coverage  |          11.38s |       $0.0016 |

## Notes

- WER and CER use exact Levenshtein distance through 10,000 normalized elements; longer sequences trim common edges, use bounded exact wavefront alignment, then order-preserving token or content anchors with exact gap scoring and conservative edit lower bounds.
