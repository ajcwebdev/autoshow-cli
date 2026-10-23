# Text Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/write/2026-10-18_05-rap-song-chapter/reruns/02`
- Total providers: 5 (0 local, 5 service)
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

| Rank | Provider                            | Evidence |
| ---: | ----------------------------------- | -------- |
| 1    | <code>glm/glm-5.3-flash</code>      | $0.0085  |
| 2    | <code>together/glm-5.3-flash</code> | $0.0118  |
| 3    | <code>glm/glm-5.3</code>            | $0.0752  |
| 4    | <code>grok/grok-4.6</code>          | $0.0787  |
| 5    | <code>grok/grok-4.7</code>          | $0.2658  |

### Speed

| Rank | Provider                            | Evidence               |
| ---: | ----------------------------------- | ---------------------- |
| 1    | <code>together/glm-5.3-flash</code> | 4205.430 ms/1K tokens  |
| 2    | <code>glm/glm-5.3</code>            | 9428.711 ms/1K tokens  |
| 3    | <code>glm/glm-5.3-flash</code>      | 11641.624 ms/1K tokens |
| 4    | <code>grok/grok-4.6</code>          | 12381.577 ms/1K tokens |
| 5    | <code>grok/grok-4.7</code>          | 13497.531 ms/1K tokens |

### Automated Quality

Unavailable: No explicit text quality score was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as human quality proxies.

### Provider Detail

| Provider                            | Tokens                | Speed                  | Monetary Cost | Output                           | Quality Evidence |
| ----------------------------------- | --------------------: | ---------------------: | ------------: | -------------------------------- | ---------------- |
| <code>glm/glm-5.3</code>            | 3,407 in / 16,000 out | 9428.711 ms/1K tokens  | $0.0752       | n/a                              | n/a              |
| <code>glm/glm-5.3-flash</code>      | 3,407 in / 16,000 out | 11641.624 ms/1K tokens | $0.0085       | n/a                              | n/a              |
| <code>grok/grok-4.6</code>          | 4,333 in / 11,669 out | 12381.577 ms/1K tokens | $0.0787       | text-grok-grok-4.6.json          | n/a              |
| <code>grok/grok-4.7</code>          | 4,939 in / 42,650 out | 13497.531 ms/1K tokens | $0.2658       | text-grok-grok-4.7.json          | n/a              |
| <code>together/glm-5.3-flash</code> | 3,407 in / 22,670 out | 4205.430 ms/1K tokens  | $0.0118       | text-together-glm-5.3-flash.json | n/a              |

## Notes

- Text mode scores existing write outputs only and does not call LLM providers.
- Length, speed, cost, output existence, schema validity, and subjective judgment are not quality proxies.
