# Text Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/write/2026-10-18_03-medium-chapters/reruns/02`
- Total providers: 1 (0 local, 1 service)
- Local and service providers are intentionally not ranked against each other.
- Reports expose complete price, speed, automated-quality, and human-quality rankings for each group.

## Method

- Price rankings use zero monetary cost for local providers and reported monetary cost for services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Automated quality rankings use only explicit text quality score evidence.
- Human quality rankings use only explicit humanQualityScore evidence.
- Length, speed, cost, output existence, schema validity, and subjective judgment are not used as quality proxies.

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

| Rank | Provider                 | Evidence |
| ---: | ------------------------ | -------- |
| 1    | <code>glm/glm-5.3</code> | $0.0059  |

### Speed

| Rank | Provider                 | Evidence              |
| ---: | ------------------------ | --------------------- |
| 1    | <code>glm/glm-5.3</code> | 2591.115 ms/1K tokens |

### Automated Quality

Unavailable: No explicit text quality score was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as human quality proxies.

### Provider Detail

| Provider                 | Tokens             | Speed                 | Monetary Cost | Output                | Quality Evidence |
| ------------------------ | -----------------: | --------------------: | ------------: | --------------------- | ---------------- |
| <code>glm/glm-5.3</code> | 2,554 in / 530 out | 2591.115 ms/1K tokens | $0.0059       | text-glm-glm-5.3.json | n/a              |

## Notes

- Text mode scores existing write outputs only and does not call LLM providers.
- Length, speed, cost, output existence, schema validity, and subjective judgment are not quality proxies.
