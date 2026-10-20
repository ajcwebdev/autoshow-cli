# Text Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/write/2026-10-18_05-rap-song-chapter`
- Total providers: 19 (0 local, 19 service)
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
| 1 | <code>openai/gpt-6-luna</code> | $0.0010 |
| 2 | <code>openai/gpt-5.6-luna</code> | $0.0020 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0028 |
| 4 | <code>together/glm-5.3</code> | $0.0090 |
| 5 | <code>openai/gpt-5.6-terra</code> | $0.0180 |
| 6 | <code>openai/gpt-6.1-sol</code> | $0.0213 |
| 7 | <code>gemini/gemini-3.8-flash</code> | $0.0297 |
| 8 | <code>gemini/gemini-3.7-flash</code> | $0.0349 |
| 9 | <code>kimi/kimi-k3</code> | $0.0359 |
| 10 | <code>openai/gpt-5.6-sol</code> | $0.0407 |
| 11 | <code>gemini/gemini-4-argon</code> | $0.0424 |
| 12 | <code>anthropic/claude-sonnet-5-5</code> | $0.0635 |
| 13 | <code>anthropic/claude-sonnet-5</code> | $0.0747 |
| 14 | <code>anthropic/claude-opus-5-5</code> | $0.0894 |
| 15 | <code>together/kimi-k3</code> | $0.1148 |
| 16 | <code>openai/gpt-6-astra</code> | $0.1154 |
| 17 | <code>anthropic/claude-opus-5</code> | $0.1559 |
| 18 | <code>grok/grok-4.7</code> | $0.2249 |
| 19 | <code>anthropic/claude-fable-5-1</code> | $0.3652 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>openai/gpt-5.6-luna</code> | 1464.012 ms/1K tokens |
| 2 | <code>openai/gpt-6-luna</code> | 1612.002 ms/1K tokens |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 1759.219 ms/1K tokens |
| 4 | <code>together/glm-5.3</code> | 2266.164 ms/1K tokens |
| 5 | <code>openai/gpt-5.6-terra</code> | 2429.538 ms/1K tokens |
| 6 | <code>openai/gpt-5.6-sol</code> | 3059.406 ms/1K tokens |
| 7 | <code>anthropic/claude-sonnet-5-5</code> | 3416.251 ms/1K tokens |
| 8 | <code>gemini/gemini-3.8-flash</code> | 3705.501 ms/1K tokens |
| 9 | <code>anthropic/claude-opus-5-5</code> | 3951.633 ms/1K tokens |
| 10 | <code>gemini/gemini-4-argon</code> | 4058.770 ms/1K tokens |
| 11 | <code>openai/gpt-6.1-sol</code> | 4627.855 ms/1K tokens |
| 12 | <code>gemini/gemini-3.7-flash</code> | 4715.089 ms/1K tokens |
| 13 | <code>anthropic/claude-sonnet-5</code> | 5235.674 ms/1K tokens |
| 14 | <code>anthropic/claude-opus-5</code> | 5777.621 ms/1K tokens |
| 15 | <code>anthropic/claude-fable-5-1</code> | 5910.199 ms/1K tokens |
| 16 | <code>openai/gpt-6-astra</code> | 7813.195 ms/1K tokens |
| 17 | <code>kimi/kimi-k3</code> | 10398.086 ms/1K tokens |
| 18 | <code>grok/grok-4.7</code> | 12756.831 ms/1K tokens |
| 19 | <code>together/kimi-k3</code> | 13593.677 ms/1K tokens |

### Automated Quality

Unavailable: No explicit text quality score was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as human quality proxies.

### Provider Detail

| Provider | Tokens | Speed | Monetary Cost | Output | Quality Evidence |
| --- | ---: | ---: | ---: | --- | --- |
| <code>anthropic/claude-fable-5-1</code> | 6,350 in / 6,033 out | 5910.199 ms/1K tokens | $0.3652 | text-anthropic-claude-fable-5-1.json | n/a |
| <code>anthropic/claude-haiku-5-5</code> | 6,350 in / 4,361 out | 1759.219 ms/1K tokens | $0.0028 | text-anthropic-claude-haiku-5-5.json | n/a |
| <code>anthropic/claude-opus-5</code> | 6,348 in / 4,966 out | 5777.621 ms/1K tokens | $0.1559 | text-anthropic-claude-opus-5.json | n/a |
| <code>anthropic/claude-opus-5-5</code> | 6,350 in / 3,202 out | 3951.633 ms/1K tokens | $0.0894 | text-anthropic-claude-opus-5-5.json | n/a |
| <code>anthropic/claude-sonnet-5</code> | 6,348 in / 6,199 out | 5235.674 ms/1K tokens | $0.0747 | text-anthropic-claude-sonnet-5.json | n/a |
| <code>anthropic/claude-sonnet-5-5</code> | 6,350 in / 5,083 out | 3416.251 ms/1K tokens | $0.0635 | text-anthropic-claude-sonnet-5-5.json | n/a |
| <code>gemini/gemini-3.7-flash</code> | 3,523 in / 3,946 out | 4715.089 ms/1K tokens | $0.0349 | text-gemini-gemini-3.7-flash.json | n/a |
| <code>gemini/gemini-3.8-flash</code> | 3,523 in / 3,258 out | 3705.501 ms/1K tokens | $0.0297 | text-gemini-gemini-3.8-flash.json | n/a |
| <code>gemini/gemini-4-argon</code> | 4,155 in / 1,290 out | 4058.770 ms/1K tokens | $0.0424 | text-gemini-gemini-4-argon.json | n/a |
| <code>grok/grok-4.7</code> | 4,939 in / 35,831 out | 12756.831 ms/1K tokens | $0.2249 | text-grok-grok-4.7.json | n/a |
| <code>kimi/kimi-k3</code> | 3,543 in / 1,682 out | 10398.086 ms/1K tokens | $0.0359 | text-kimi-kimi-k3.json | n/a |
| <code>openai/gpt-5.6-luna</code> | 3,518 in / 1,053 out | 1464.012 ms/1K tokens | $0.0020 | text-openai-gpt-5.6-luna.json | n/a |
| <code>openai/gpt-5.6-sol</code> | 3,518 in / 1,330 out | 3059.406 ms/1K tokens | $0.0407 | text-openai-gpt-5.6-sol.json | n/a |
| <code>openai/gpt-5.6-terra</code> | 3,518 in / 917 out | 2429.538 ms/1K tokens | $0.0180 | text-openai-gpt-5.6-terra.json | n/a |
| <code>openai/gpt-6-astra</code> | 3,518 in / 1,605 out | 7813.195 ms/1K tokens | $0.1154 | text-openai-gpt-6-astra.json | n/a |
| <code>openai/gpt-6-luna</code> | 3,518 in / 1,348 out | 1612.002 ms/1K tokens | $0.0010 | text-openai-gpt-6-luna.json | n/a |
| <code>openai/gpt-6.1-sol</code> | 3,518 in / 1,429 out | 4627.855 ms/1K tokens | $0.0213 | text-openai-gpt-6.1-sol.json | n/a |
| <code>together/glm-5.3</code> | 3,407 in / 970 out | 2266.164 ms/1K tokens | $0.0090 | text-together-glm-5.3.json | n/a |
| <code>together/kimi-k3</code> | 3,793 in / 6,898 out | 13593.677 ms/1K tokens | $0.1148 | text-together-kimi-k3.json | n/a |

## Notes

- Text mode scores existing write outputs only and does not call LLM providers.
- Length, speed, cost, output existence, schema validity, and subjective judgment are not quality proxies.
