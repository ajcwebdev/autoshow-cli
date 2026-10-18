# Text Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/write/2026-10-18_01-short-summary`
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
| 1 | <code>openai/gpt-6-luna</code> | $0.0001 |
| 2 | <code>anthropic/claude-haiku-5-5</code> | $0.0001 |
| 3 | <code>openai/gpt-5.6-luna</code> | $0.0002 |
| 4 | <code>together/glm-5.3-flash</code> | $0.0003 |
| 5 | <code>glm/glm-5.3-flash</code> | $0.0003 |
| 6 | <code>together/glm-5.3</code> | $0.0008 |
| 7 | <code>openai/gpt-5.6-terra</code> | $0.0013 |
| 8 | <code>openai/gpt-6.1-sol</code> | $0.0013 |
| 9 | <code>anthropic/claude-sonnet-5</code> | $0.0022 |
| 10 | <code>anthropic/claude-sonnet-5-5</code> | $0.0023 |
| 11 | <code>openai/gpt-5.6-sol</code> | $0.0026 |
| 12 | <code>glm/glm-5.3</code> | $0.0030 |
| 13 | <code>gemini/gemini-4-argon</code> | $0.0038 |
| 14 | <code>gemini/gemini-3.7-flash</code> | $0.0039 |
| 15 | <code>gemini/gemini-3.8-flash</code> | $0.0040 |
| 16 | <code>together/kimi-k3</code> | $0.0040 |
| 17 | <code>kimi/kimi-k3</code> | $0.0040 |
| 18 | <code>anthropic/claude-opus-5-5</code> | $0.0046 |
| 19 | <code>anthropic/claude-opus-5</code> | $0.0055 |
| 20 | <code>grok/grok-4.7</code> | $0.0079 |
| 21 | <code>openai/gpt-6-astra</code> | $0.0092 |
| 22 | <code>anthropic/claude-fable-5-1</code> | $0.0112 |
| 23 | <code>grok/grok-4.6</code> | $0.0161 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>anthropic/claude-haiku-5-5</code> | 1183.180 ms/1K tokens |
| 2 | <code>anthropic/claude-sonnet-5</code> | 1623.288 ms/1K tokens |
| 3 | <code>anthropic/claude-opus-5</code> | 1931.350 ms/1K tokens |
| 4 | <code>openai/gpt-5.6-luna</code> | 2391.051 ms/1K tokens |
| 5 | <code>grok/grok-4.7</code> | 2715.914 ms/1K tokens |
| 6 | <code>anthropic/claude-sonnet-5-5</code> | 2778.531 ms/1K tokens |
| 7 | <code>together/glm-5.3-flash</code> | 2994.652 ms/1K tokens |
| 8 | <code>openai/gpt-5.6-terra</code> | 3264.271 ms/1K tokens |
| 9 | <code>anthropic/claude-opus-5-5</code> | 3275.706 ms/1K tokens |
| 10 | <code>openai/gpt-5.6-sol</code> | 3640.167 ms/1K tokens |
| 11 | <code>anthropic/claude-fable-5-1</code> | 4019.362 ms/1K tokens |
| 12 | <code>gemini/gemini-3.8-flash</code> | 4184.735 ms/1K tokens |
| 13 | <code>gemini/gemini-3.7-flash</code> | 4493.841 ms/1K tokens |
| 14 | <code>openai/gpt-6-luna</code> | 5315.589 ms/1K tokens |
| 15 | <code>openai/gpt-6-astra</code> | 5537.453 ms/1K tokens |
| 16 | <code>together/glm-5.3</code> | 5940.171 ms/1K tokens |
| 17 | <code>openai/gpt-6.1-sol</code> | 6004.167 ms/1K tokens |
| 18 | <code>together/kimi-k3</code> | 6277.174 ms/1K tokens |
| 19 | <code>gemini/gemini-4-argon</code> | 7688.797 ms/1K tokens |
| 20 | <code>glm/glm-5.3</code> | 7753.564 ms/1K tokens |
| 21 | <code>kimi/kimi-k3</code> | 7958.571 ms/1K tokens |
| 22 | <code>glm/glm-5.3-flash</code> | 8865.751 ms/1K tokens |
| 23 | <code>grok/grok-4.6</code> | 10870.949 ms/1K tokens |

### Automated Quality

Unavailable: No explicit text quality score was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as human quality proxies.

### Provider Detail

| Provider | Tokens | Speed | Monetary Cost | Output | Quality Evidence |
| --- | ---: | ---: | ---: | --- | --- |
| <code>anthropic/claude-fable-5-1</code> | 817 in / 61 out | 4019.362 ms/1K tokens | $0.0112 | text-anthropic-claude-fable-5-1.json | n/a |
| <code>anthropic/claude-haiku-5-5</code> | 817 in / 51 out | 1183.180 ms/1K tokens | $0.0001 | text-anthropic-claude-haiku-5-5.json | n/a |
| <code>anthropic/claude-opus-5</code> | 815 in / 59 out | 1931.350 ms/1K tokens | $0.0055 | text-anthropic-claude-opus-5.json | n/a |
| <code>anthropic/claude-opus-5-5</code> | 817 in / 68 out | 3275.706 ms/1K tokens | $0.0046 | text-anthropic-claude-opus-5-5.json | n/a |
| <code>anthropic/claude-sonnet-5</code> | 815 in / 61 out | 1623.288 ms/1K tokens | $0.0022 | text-anthropic-claude-sonnet-5.json | n/a |
| <code>anthropic/claude-sonnet-5-5</code> | 817 in / 68 out | 2778.531 ms/1K tokens | $0.0023 | text-anthropic-claude-sonnet-5-5.json | n/a |
| <code>gemini/gemini-3.7-flash</code> | 468 in / 425 out | 4493.841 ms/1K tokens | $0.0039 | text-gemini-gemini-3.7-flash.json | n/a |
| <code>gemini/gemini-3.8-flash</code> | 468 in / 436 out | 4184.735 ms/1K tokens | $0.0040 | text-gemini-gemini-3.8-flash.json | n/a |
| <code>gemini/gemini-4-argon</code> | 666 in / 57 out | 7688.797 ms/1K tokens | $0.0038 | text-gemini-gemini-4-argon.json | n/a |
| <code>glm/glm-5.3</code> | 429 in / 553 out | 7753.564 ms/1K tokens | $0.0030 | text-glm-glm-5.3.json | n/a |
| <code>glm/glm-5.3-flash</code> | 429 in / 517 out | 8865.751 ms/1K tokens | $0.0003 | text-glm-glm-5.3-flash.json | n/a |
| <code>grok/grok-4.6</code> | 1,108 in / 2,317 out | 10870.949 ms/1K tokens | $0.0161 | text-grok-grok-4.6.json | n/a |
| <code>grok/grok-4.7</code> | 1,714 in / 743 out | 2715.914 ms/1K tokens | $0.0079 | text-grok-grok-4.7.json | n/a |
| <code>kimi/kimi-k3</code> | 542 in / 158 out | 7958.571 ms/1K tokens | $0.0040 | text-kimi-kimi-k3.json | n/a |
| <code>openai/gpt-5.6-luna</code> | 438 in / 76 out | 2391.051 ms/1K tokens | $0.0002 | text-openai-gpt-5.6-luna.json | n/a |
| <code>openai/gpt-5.6-sol</code> | 438 in / 40 out | 3640.167 ms/1K tokens | $0.0026 | text-openai-gpt-5.6-sol.json | n/a |
| <code>openai/gpt-5.6-terra</code> | 438 in / 35 out | 3264.271 ms/1K tokens | $0.0013 | text-openai-gpt-5.6-terra.json | n/a |
| <code>openai/gpt-6-astra</code> | 438 in / 96 out | 5537.453 ms/1K tokens | $0.0092 | text-openai-gpt-6-astra.json | n/a |
| <code>openai/gpt-6-luna</code> | 438 in / 88 out | 5315.589 ms/1K tokens | $0.0001 | text-openai-gpt-6-luna.json | n/a |
| <code>openai/gpt-6.1-sol</code> | 438 in / 42 out | 6004.167 ms/1K tokens | $0.0013 | text-openai-gpt-6.1-sol.json | n/a |
| <code>together/glm-5.3</code> | 429 in / 39 out | 5940.171 ms/1K tokens | $0.0008 | text-together-glm-5.3.json | n/a |
| <code>together/glm-5.3-flash</code> | 429 in / 506 out | 2994.652 ms/1K tokens | $0.0003 | text-together-glm-5.3-flash.json | n/a |
| <code>together/kimi-k3</code> | 589 in / 147 out | 6277.174 ms/1K tokens | $0.0040 | text-together-kimi-k3.json | n/a |

## Notes

- Text mode scores existing write outputs only and does not call LLM providers.
- Length, speed, cost, output existence, schema validity, and subjective judgment are not quality proxies.
