# Image Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/image/2026-05-21_10-33-37-508_image-gen`
- Total providers: 13
- Judge model: `gpt-5.5`
- Local and service providers are intentionally not ranked against each other.

## Method

- Price rankings use zero monetary cost for local providers and reported monetary cost for services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Automated quality rankings use the explicit OpenAI vision judge score from `image-quality-report.json`.
- Human quality rankings use only explicit `humanQualityScore` evidence.
- File size, dimensions, latency, and cost are not used as quality proxies.

## Local Providers

### Price

Unavailable: No providers were found.

### Speed

Unavailable: No providers were found.

### Automated Quality

Unavailable: No providers were found.

### Human Quality

Unavailable: No providers were found.

### Provider Detail

No local providers were found.

## Service Providers

### Price

| Rank | Provider                                | Evidence |
| ---: | --------------------------------------- | -------- |
|    1 | `grok/grok-imagine-image`               | $0.0200  |
|    2 | `reve/latest`                           | $0.0240  |
|    3 | `reve/reve-create@20250915`             | $0.0240  |
|    4 | `bfl/flux-2-pro`                        | $0.0300  |
|    5 | `recraft/recraftv4_1`                   | $0.0400  |
|    6 | `recraft/recraftv4_1_utility`           | $0.0400  |
|    7 | `bfl/flux-2-flex`                       | $0.0500  |
|    8 | `grok/grok-imagine-image-quality`       | $0.0500  |
|    9 | `openai/gpt-image-2`                    | $0.0530  |
|   10 | `gemini/gemini-3.1-flash-image-preview` | $0.0670  |
|   11 | `bfl/flux-2-max`                        | $0.0700  |
|   12 | `recraft/recraftv4_1_pro`               | $0.2500  |
|   13 | `recraft/recraftv4_1_utility_pro`       | $0.2500  |

### Speed

| Rank | Provider                                | Evidence |
| ---: | --------------------------------------- | -------- |
|    1 | `grok/grok-imagine-image-quality`       | 4.71s    |
|    2 | `grok/grok-imagine-image`               | 5.49s    |
|    3 | `reve/reve-create@20250915`             | 6.34s    |
|    4 | `reve/latest`                           | 6.87s    |
|    5 | `recraft/recraftv4_1`                   | 9.51s    |
|    6 | `recraft/recraftv4_1_pro`               | 13.28s   |
|    7 | `gemini/gemini-3.1-flash-image-preview` | 16.11s   |
|    8 | `bfl/flux-2-flex`                       | 16.65s   |
|    9 | `bfl/flux-2-pro`                        | 16.79s   |
|   10 | `recraft/recraftv4_1_utility_pro`       | 16.89s   |
|   11 | `recraft/recraftv4_1_utility`           | 24.13s   |
|   12 | `bfl/flux-2-max`                        | 47.13s   |
|   13 | `openai/gpt-image-2`                    | 59.03s   |

### Automated Quality

| Rank | Provider                                | Evidence  |
| ---: | --------------------------------------- | --------- |
|    1 | `recraft/recraftv4_1`                   | 90.00/100 |
|    2 | `gemini/gemini-3.1-flash-image-preview` | 88.00/100 |
|    3 | `openai/gpt-image-2`                    | 88.00/100 |
|    4 | `recraft/recraftv4_1_utility`           | 86.00/100 |
|    5 | `grok/grok-imagine-image-quality`       | 84.00/100 |
|    6 | `recraft/recraftv4_1_utility_pro`       | 84.00/100 |
|    7 | `recraft/recraftv4_1_pro`               | 82.00/100 |
|    8 | `bfl/flux-2-flex`                       | 76.00/100 |
|    9 | `grok/grok-imagine-image`               | 76.00/100 |
|   10 | `bfl/flux-2-max`                        | 74.00/100 |
|   11 | `reve/latest`                           | 74.00/100 |
|   12 | `bfl/flux-2-pro`                        | 72.00/100 |
|   13 | `reve/reve-create@20250915`             | 60.00/100 |

### Human Quality

Unavailable: No explicit humanQualityScore was available for these providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.

### Provider Detail

| Provider                                | Quality Evidence | Processing Time | Monetary Cost |
| --------------------------------------- | ---------------- | --------------: | ------------: |
| `bfl/flux-2-flex`                       | 76.00/100        |          16.65s |       $0.0500 |
| `bfl/flux-2-max`                        | 74.00/100        |          47.13s |       $0.0700 |
| `bfl/flux-2-pro`                        | 72.00/100        |          16.79s |       $0.0300 |
| `gemini/gemini-3.1-flash-image-preview` | 88.00/100        |          16.11s |       $0.0670 |
| `grok/grok-imagine-image`               | 76.00/100        |           5.49s |       $0.0200 |
| `grok/grok-imagine-image-quality`       | 84.00/100        |           4.71s |       $0.0500 |
| `openai/gpt-image-2`                    | 88.00/100        |          59.03s |       $0.0530 |
| `recraft/recraftv4_1`                   | 90.00/100        |           9.51s |       $0.0400 |
| `recraft/recraftv4_1_pro`               | 82.00/100        |          13.28s |       $0.2500 |
| `recraft/recraftv4_1_utility`           | 86.00/100        |          24.13s |       $0.0400 |
| `recraft/recraftv4_1_utility_pro`       | 84.00/100        |          16.89s |       $0.2500 |
| `reve/latest`                           | 74.00/100        |           6.87s |       $0.0240 |
| `reve/reve-create@20250915`             | 60.00/100        |           6.34s |       $0.0240 |

## Notes

- Image mode evaluates existing generated images only; it does not generate new images.
- Quality scores are explicit judge scores and are not inferred from file size, dimensions, latency, or cost.
