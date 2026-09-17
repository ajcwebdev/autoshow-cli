# Text Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/auto/autoshow-cli/docs/benchmarks/write/2026-09-16_06-51-18-238_1-audio`
- Total providers: 16 (0 local, 16 service)
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
| 1 | <code>openai/gpt-5.6-luna</code> | $0.0002 |
| 2 | <code>together/glm-5.3-flash</code> | $0.0006 |
| 3 | <code>together/glm-5.3</code> | $0.0008 |
| 4 | <code>glm/glm-5.3-flash</code> | $0.0008 |
| 5 | <code>gemini/gemini-3.7-flash</code> | $0.0009 |
| 6 | <code>gemini/gemini-3.8-flash</code> | $0.0010 |
| 7 | <code>openai/gpt-5.6-terra</code> | $0.0014 |
| 8 | <code>anthropic/claude-sonnet-5</code> | $0.0023 |
| 9 | <code>grok/grok-4.6</code> | $0.0025 |
| 10 | <code>kimi/kimi-k3</code> | $0.0025 |
| 11 | <code>glm/glm-5.3</code> | $0.0027 |
| 12 | <code>openai/gpt-5.6-sol</code> | $0.0034 |
| 13 | <code>together/kimi-k3</code> | $0.0045 |
| 14 | <code>anthropic/claude-opus-5</code> | $0.0057 |
| 15 | <code>openai/gpt-6-astra</code> | $0.0066 |
| 16 | <code>anthropic/claude-fable-5-1</code> | $0.0117 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>together/glm-5.3</code> | 2296.680 ms/1K tokens |
| 2 | <code>anthropic/claude-sonnet-5</code> | 2964.004 ms/1K tokens |
| 3 | <code>openai/gpt-5.6-terra</code> | 3200.409 ms/1K tokens |
| 4 | <code>openai/gpt-5.6-luna</code> | 3309.259 ms/1K tokens |
| 5 | <code>together/kimi-k3</code> | 3563.707 ms/1K tokens |
| 6 | <code>anthropic/claude-opus-5</code> | 3846.240 ms/1K tokens |
| 7 | <code>gemini/gemini-3.7-flash</code> | 4213.725 ms/1K tokens |
| 8 | <code>openai/gpt-5.6-sol</code> | 5879.346 ms/1K tokens |
| 9 | <code>anthropic/claude-fable-5-1</code> | 6176.863 ms/1K tokens |
| 10 | <code>together/glm-5.3-flash</code> | 6485.876 ms/1K tokens |
| 11 | <code>gemini/gemini-3.8-flash</code> | 6811.650 ms/1K tokens |
| 12 | <code>glm/glm-5.3</code> | 7624.211 ms/1K tokens |
| 13 | <code>openai/gpt-6-astra</code> | 7857.434 ms/1K tokens |
| 14 | <code>glm/glm-5.3-flash</code> | 8224.304 ms/1K tokens |
| 15 | <code>kimi/kimi-k3</code> | 8804.918 ms/1K tokens |
| 16 | <code>grok/grok-4.6</code> | 14830.596 ms/1K tokens |

### Automated Quality

Unavailable: No explicit text quality score was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as human quality proxies.

### Provider Detail

| Provider | Tokens | Speed | Monetary Cost | Output | Quality Evidence |
| --- | ---: | ---: | ---: | --- | --- |
| <code>anthropic/claude-fable-5-1</code> | 830 in / 69 out | 6176.863 ms/1K tokens | $0.0117 | text-claude-fable-5-1.json | n/a |
| <code>anthropic/claude-opus-5</code> | 828 in / 63 out | 3846.240 ms/1K tokens | $0.0057 | text-claude-opus-5.json | n/a |
| <code>anthropic/claude-sonnet-5</code> | 828 in / 61 out | 2964.004 ms/1K tokens | $0.0023 | text-claude-sonnet-5.json | n/a |
| <code>gemini/gemini-3.7-flash</code> | 482 in / 28 out | 4213.725 ms/1K tokens | $0.0009 | text-gemini-3.7-flash.json | n/a |
| <code>gemini/gemini-3.8-flash</code> | 482 in / 33 out | 6811.650 ms/1K tokens | $0.0010 | text-gemini-3.8-flash.json | n/a |
| <code>glm/glm-5.3</code> | 500 in / 450 out | 7624.211 ms/1K tokens | $0.0027 | text-glm-glm-5.3.json | n/a |
| <code>glm/glm-5.3-flash</code> | 500 in / 1,475 out | 8224.304 ms/1K tokens | $0.0008 | text-glm-glm-5.3-flash.json | n/a |
| <code>grok/grok-4.6</code> | 1,122 in / 35 out | 14830.596 ms/1K tokens | $0.0025 | text-grok-4.6.json | n/a |
| <code>kimi/kimi-k3</code> | 552 in / 58 out | 8804.918 ms/1K tokens | $0.0025 | text-kimi-kimi-k3.json | n/a |
| <code>openai/gpt-5.6-luna</code> | 449 in / 91 out | 3309.259 ms/1K tokens | $0.0002 | text-gpt-5.6-luna.json | n/a |
| <code>openai/gpt-5.6-sol</code> | 449 in / 40 out | 5879.346 ms/1K tokens | $0.0034 | text-gpt-5.6-sol.json | n/a |
| <code>openai/gpt-5.6-terra</code> | 449 in / 40 out | 3200.409 ms/1K tokens | $0.0014 | text-gpt-5.6-terra.json | n/a |
| <code>openai/gpt-6-astra</code> | 449 in / 42 out | 7857.434 ms/1K tokens | $0.0066 | text-gpt-6-astra.json | n/a |
| <code>together/glm-5.3</code> | 439 in / 43 out | 2296.680 ms/1K tokens | $0.0008 | text-together-glm-5.3.json | n/a |
| <code>together/glm-5.3-flash</code> | 439 in / 977 out | 6485.876 ms/1K tokens | $0.0006 | text-together-glm-5.3-flash.json | n/a |
| <code>together/kimi-k3</code> | 599 in / 178 out | 3563.707 ms/1K tokens | $0.0045 | text-together-kimi-k3.json | n/a |

## Notes

- Text mode scores existing write outputs only and does not call LLM providers.
- Length, speed, cost, output existence, schema validity, and subjective judgment are not quality proxies.
