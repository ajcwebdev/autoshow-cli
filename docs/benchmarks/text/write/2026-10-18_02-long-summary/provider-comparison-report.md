# Text Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/write/2026-10-18_02-long-summary`
- Total providers: 23 (0 local, 23 service)
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

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>openai/gpt-6-luna</code> | $0.0011 |
| 2 | <code>anthropic/claude-haiku-5-5</code> | $0.0016 |
| 3 | <code>openai/gpt-5.6-luna</code> | $0.0024 |
| 4 | <code>glm/glm-5.3-flash</code> | $0.0026 |
| 5 | <code>together/glm-5.3-flash</code> | $0.0028 |
| 6 | <code>together/glm-5.3</code> | $0.0165 |
| 7 | <code>openai/gpt-6.1-sol</code> | $0.0224 |
| 8 | <code>openai/gpt-5.6-terra</code> | $0.0234 |
| 9 | <code>gemini/gemini-3.7-flash</code> | $0.0241 |
| 10 | <code>glm/glm-5.3</code> | $0.0246 |
| 11 | <code>gemini/gemini-3.8-flash</code> | $0.0258 |
| 12 | <code>grok/grok-4.7</code> | $0.0281 |
| 13 | <code>anthropic/claude-sonnet-5-5</code> | $0.0318 |
| 14 | <code>anthropic/claude-sonnet-5</code> | $0.0333 |
| 15 | <code>kimi/kimi-k3</code> | $0.0355 |
| 16 | <code>openai/gpt-5.6-sol</code> | $0.0461 |
| 17 | <code>gemini/gemini-4-argon</code> | $0.0495 |
| 18 | <code>together/kimi-k3</code> | $0.0498 |
| 19 | <code>grok/grok-4.6</code> | $0.0516 |
| 20 | <code>anthropic/claude-opus-5-5</code> | $0.0664 |
| 21 | <code>anthropic/claude-opus-5</code> | $0.0842 |
| 22 | <code>openai/gpt-6-astra</code> | $0.1121 |
| 23 | <code>anthropic/claude-fable-5-1</code> | $0.1653 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>openai/gpt-6-luna</code> | 219.246 ms/1K tokens |
| 2 | <code>openai/gpt-5.6-luna</code> | 232.288 ms/1K tokens |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 243.241 ms/1K tokens |
| 4 | <code>anthropic/claude-sonnet-5-5</code> | 315.238 ms/1K tokens |
| 5 | <code>openai/gpt-6-astra</code> | 360.719 ms/1K tokens |
| 6 | <code>openai/gpt-5.6-terra</code> | 369.669 ms/1K tokens |
| 7 | <code>openai/gpt-6.1-sol</code> | 380.971 ms/1K tokens |
| 8 | <code>openai/gpt-5.6-sol</code> | 384.160 ms/1K tokens |
| 9 | <code>anthropic/claude-sonnet-5</code> | 399.809 ms/1K tokens |
| 10 | <code>anthropic/claude-opus-5-5</code> | 441.918 ms/1K tokens |
| 11 | <code>gemini/gemini-4-argon</code> | 471.281 ms/1K tokens |
| 12 | <code>anthropic/claude-fable-5-1</code> | 513.981 ms/1K tokens |
| 13 | <code>anthropic/claude-opus-5</code> | 596.732 ms/1K tokens |
| 14 | <code>together/glm-5.3</code> | 688.394 ms/1K tokens |
| 15 | <code>gemini/gemini-3.7-flash</code> | 696.371 ms/1K tokens |
| 16 | <code>gemini/gemini-3.8-flash</code> | 742.757 ms/1K tokens |
| 17 | <code>grok/grok-4.7</code> | 918.987 ms/1K tokens |
| 18 | <code>kimi/kimi-k3</code> | 1195.896 ms/1K tokens |
| 19 | <code>together/glm-5.3-flash</code> | 1223.176 ms/1K tokens |
| 20 | <code>glm/glm-5.3-flash</code> | 1684.678 ms/1K tokens |
| 21 | <code>together/kimi-k3</code> | 1757.208 ms/1K tokens |
| 22 | <code>glm/glm-5.3</code> | 3469.295 ms/1K tokens |
| 23 | <code>grok/grok-4.6</code> | 4757.801 ms/1K tokens |

### Automated Quality

Unavailable: No explicit text quality score was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as human quality proxies.

### Provider Detail

| Provider | Tokens | Speed | Monetary Cost | Output | Quality Evidence |
| --- | ---: | ---: | ---: | --- | --- |
| <code>anthropic/claude-fable-5-1</code> | 14,152 in / 475 out | 513.981 ms/1K tokens | $0.1653 | text-anthropic-claude-fable-5-1.json | n/a |
| <code>anthropic/claude-haiku-5-5</code> | 14,152 in / 459 out | 243.241 ms/1K tokens | $0.0016 | text-anthropic-claude-haiku-5-5.json | n/a |
| <code>anthropic/claude-opus-5</code> | 14,150 in / 540 out | 596.732 ms/1K tokens | $0.0842 | text-anthropic-claude-opus-5.json | n/a |
| <code>anthropic/claude-opus-5-5</code> | 14,152 in / 491 out | 441.918 ms/1K tokens | $0.0664 | text-anthropic-claude-opus-5-5.json | n/a |
| <code>anthropic/claude-sonnet-5</code> | 14,150 in / 497 out | 399.809 ms/1K tokens | $0.0333 | text-anthropic-claude-sonnet-5.json | n/a |
| <code>anthropic/claude-sonnet-5-5</code> | 14,152 in / 345 out | 315.238 ms/1K tokens | $0.0318 | text-anthropic-claude-sonnet-5-5.json | n/a |
| <code>gemini/gemini-3.7-flash</code> | 11,103 in / 994 out | 696.371 ms/1K tokens | $0.0241 | text-gemini-gemini-3.7-flash.json | n/a |
| <code>gemini/gemini-3.8-flash</code> | 11,103 in / 1,220 out | 742.757 ms/1K tokens | $0.0258 | text-gemini-gemini-3.8-flash.json | n/a |
| <code>gemini/gemini-4-argon</code> | 11,336 in / 207 out | 471.281 ms/1K tokens | $0.0495 | text-gemini-gemini-4-argon.json | n/a |
| <code>glm/glm-5.3</code> | 10,489 in / 2,245 out | 3469.295 ms/1K tokens | $0.0246 | text-glm-glm-5.3.json | n/a |
| <code>glm/glm-5.3-flash</code> | 10,489 in / 2,003 out | 1684.678 ms/1K tokens | $0.0026 | text-glm-glm-5.3-flash.json | n/a |
| <code>grok/grok-4.6</code> | 10,896 in / 4,967 out | 4757.801 ms/1K tokens | $0.0516 | text-grok-grok-4.6.json | n/a |
| <code>grok/grok-4.7</code> | 11,502 in / 854 out | 918.987 ms/1K tokens | $0.0281 | text-grok-grok-4.7.json | n/a |
| <code>kimi/kimi-k3</code> | 10,323 in / 300 out | 1195.896 ms/1K tokens | $0.0355 | text-kimi-kimi-k3.json | n/a |
| <code>openai/gpt-5.6-luna</code> | 10,205 in / 282 out | 232.288 ms/1K tokens | $0.0024 | text-openai-gpt-5.6-luna.json | n/a |
| <code>openai/gpt-5.6-sol</code> | 10,205 in / 262 out | 384.160 ms/1K tokens | $0.0461 | text-openai-gpt-5.6-sol.json | n/a |
| <code>openai/gpt-5.6-terra</code> | 10,205 in / 253 out | 369.669 ms/1K tokens | $0.0234 | text-openai-gpt-5.6-terra.json | n/a |
| <code>openai/gpt-6-astra</code> | 10,205 in / 202 out | 360.719 ms/1K tokens | $0.1121 | text-openai-gpt-6-astra.json | n/a |
| <code>openai/gpt-6-luna</code> | 10,205 in / 249 out | 219.246 ms/1K tokens | $0.0011 | text-openai-gpt-6-luna.json | n/a |
| <code>openai/gpt-6.1-sol</code> | 10,205 in / 200 out | 380.971 ms/1K tokens | $0.0224 | text-openai-gpt-6.1-sol.json | n/a |
| <code>together/glm-5.3</code> | 10,489 in / 419 out | 688.394 ms/1K tokens | $0.0165 | text-together-glm-5.3.json | n/a |
| <code>together/glm-5.3-flash</code> | 10,489 in / 2,438 out | 1223.176 ms/1K tokens | $0.0028 | text-together-glm-5.3-flash.json | n/a |
| <code>together/kimi-k3</code> | 10,371 in / 1,248 out | 1757.208 ms/1K tokens | $0.0498 | text-together-kimi-k3.json | n/a |

## Notes

- Text mode scores existing write outputs only and does not call LLM providers.
- Length, speed, cost, output existence, schema validity, and subjective judgment are not quality proxies.
