# Text Provider Comparison Report

## Summary

- Run directory: `.`
- Total providers: 15 (0 local, 15 service)
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
| 1 | <code>openai/gpt-5.4-nano</code> | $0.0001 |
| 2 | <code>gemini/gemini-3.1-flash-lite</code> | $0.0002 |
| 3 | <code>gemini/gemini-3.1-flash-lite-preview</code> | $0.0002 |
| 4 | <code>openai/gpt-5.4-mini</code> | $0.0005 |
| 5 | <code>kimi/kimi-k2.6</code> | $0.0005 |
| 6 | <code>minimax/MiniMax-M3</code> | $0.0007 |
| 7 | <code>together/kimi-k2.6</code> | $0.0007 |
| 8 | <code>together/glm-5.1</code> | $0.0008 |
| 9 | <code>anthropic/claude-haiku-4-5</code> | $0.0008 |
| 10 | <code>grok/grok-4.3</code> | $0.0008 |
| 11 | <code>glm/glm-5.1</code> | $0.0009 |
| 12 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0014 |
| 13 | <code>anthropic/claude-sonnet-4-6</code> | $0.0025 |
| 14 | <code>openai/gpt-5.5</code> | $0.0033 |
| 15 | <code>anthropic/claude-opus-4-8</code> | $0.0056 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>gemini/gemini-3.1-flash-lite</code> | 1616.896 ms/1K tokens |
| 2 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 1635.659 ms/1K tokens |
| 3 | <code>openai/gpt-5.4-nano</code> | 2205.231 ms/1K tokens |
| 4 | <code>openai/gpt-5.4-mini</code> | 2474.542 ms/1K tokens |
| 5 | <code>anthropic/claude-haiku-4-5</code> | 2570.790 ms/1K tokens |
| 6 | <code>openai/gpt-5.5</code> | 3319.672 ms/1K tokens |
| 7 | <code>anthropic/claude-opus-4-8</code> | 3401.776 ms/1K tokens |
| 8 | <code>glm/glm-5.1</code> | 3760.748 ms/1K tokens |
| 9 | <code>together/glm-5.1</code> | 4339.623 ms/1K tokens |
| 10 | <code>kimi/kimi-k2.6</code> | 4509.677 ms/1K tokens |
| 11 | <code>anthropic/claude-sonnet-4-6</code> | 5349.630 ms/1K tokens |
| 12 | <code>minimax/MiniMax-M3</code> | 5958.438 ms/1K tokens |
| 13 | <code>together/kimi-k2.6</code> | 8740.977 ms/1K tokens |
| 14 | <code>grok/grok-4.3</code> | 8885.400 ms/1K tokens |
| 15 | <code>gemini/gemini-3.1-pro-preview</code> | 13780.583 ms/1K tokens |

### Automated Quality

Unavailable: No explicit text quality score was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as human quality proxies.

### Provider Detail

| Provider | Tokens | Speed | Monetary Cost | Output | Quality Evidence |
| --- | ---: | ---: | ---: | --- | --- |
| <code>anthropic/claude-haiku-4-5</code> | 635 in / 36 out | 2570.790 ms/1K tokens | $0.0008 | text-claude-haiku-4-5.json | n/a |
| <code>anthropic/claude-opus-4-8</code> | 846 in / 55 out | 3401.776 ms/1K tokens | $0.0056 | text-claude-opus-4-8.json | n/a |
| <code>anthropic/claude-sonnet-4-6</code> | 636 in / 39 out | 5349.630 ms/1K tokens | $0.0025 | text-claude-sonnet-4-6.json | n/a |
| <code>gemini/gemini-3.1-flash-lite</code> | 475 in / 34 out | 1616.896 ms/1K tokens | $0.0002 | text-gemini-3.1-flash-lite.json | n/a |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | 475 in / 41 out | 1635.659 ms/1K tokens | $0.0002 | text-gemini-3.1-flash-lite-preview.json | n/a |
| <code>gemini/gemini-3.1-pro-preview</code> | 475 in / 40 out | 13780.583 ms/1K tokens | $0.0014 | text-gemini-3.1-pro-preview.json | n/a |
| <code>glm/glm-5.1</code> | 497 in / 38 out | 3760.748 ms/1K tokens | $0.0009 | text-glm-5.1.json | n/a |
| <code>grok/grok-4.3</code> | 602 in / 35 out | 8885.400 ms/1K tokens | $0.0008 | text-grok-4.3.json | n/a |
| <code>kimi/kimi-k2.6</code> | 431 in / 34 out | 4509.677 ms/1K tokens | $0.0005 | text-kimi-k2.6.json | n/a |
| <code>minimax/MiniMax-M3</code> | 695 in / 99 out | 5958.438 ms/1K tokens | $0.0007 | text-MiniMax-M3.json | n/a |
| <code>openai/gpt-5.4-mini</code> | 452 in / 39 out | 2474.542 ms/1K tokens | $0.0005 | text-gpt-5.4-mini.json | n/a |
| <code>openai/gpt-5.4-nano</code> | 452 in / 45 out | 2205.231 ms/1K tokens | $0.0001 | text-gpt-5.4-nano.json | n/a |
| <code>openai/gpt-5.5</code> | 452 in / 36 out | 3319.672 ms/1K tokens | $0.0033 | text-gpt-5.5.json | n/a |
| <code>together/glm-5.1</code> | 436 in / 41 out | 4339.623 ms/1K tokens | $0.0008 | text-together-glm-5.1.json | n/a |
| <code>together/kimi-k2.6</code> | 432 in / 39 out | 8740.977 ms/1K tokens | $0.0007 | text-together-kimi-k2.6.json | n/a |

## Notes

- Text mode scores existing write outputs only and does not call LLM providers.
- Length, speed, cost, output existence, schema validity, and subjective judgment are not quality proxies.
