# Text Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/write/2026-10-18_01-short-summary`
- Total providers: 8 (0 local, 8 service)
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

| Rank | Provider                                 | Evidence |
| ---: | ---------------------------------------- | -------- |
| 1    | <code>openai/gpt-6-luna</code>           | $0.0001  |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | $0.0001  |
| 3    | <code>openai/gpt-6.1-sol</code>          | $0.0013  |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | $0.0023  |
| 5    | <code>gemini/gemini-4-argon</code>       | $0.0038  |
| 6    | <code>gemini/gemini-3.8-flash</code>     | $0.0040  |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.0046  |
| 8    | <code>grok/grok-4.7</code>               | $0.0079  |

### Speed

| Rank | Provider                                 | Evidence              |
| ---: | ---------------------------------------- | --------------------- |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | 1183.180 ms/1K tokens |
| 2    | <code>grok/grok-4.7</code>               | 2715.914 ms/1K tokens |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 2778.531 ms/1K tokens |
| 4    | <code>anthropic/claude-opus-5-5</code>   | 3275.706 ms/1K tokens |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 4184.735 ms/1K tokens |
| 6    | <code>openai/gpt-6-luna</code>           | 5315.589 ms/1K tokens |
| 7    | <code>openai/gpt-6.1-sol</code>          | 6004.167 ms/1K tokens |
| 8    | <code>gemini/gemini-4-argon</code>       | 7688.797 ms/1K tokens |

### Automated Quality

Unavailable: No explicit text quality score was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as human quality proxies.

### Provider Detail

| Provider                                 | Tokens             | Speed                 | Monetary Cost | Output                                | Quality Evidence |
| ---------------------------------------- | -----------------: | --------------------: | ------------: | ------------------------------------- | ---------------- |
| <code>anthropic/claude-haiku-5-5</code>  | 817 in / 51 out    | 1183.180 ms/1K tokens | $0.0001       | text-anthropic-claude-haiku-5-5.json  | n/a              |
| <code>anthropic/claude-opus-5-5</code>   | 817 in / 68 out    | 3275.706 ms/1K tokens | $0.0046       | text-anthropic-claude-opus-5-5.json   | n/a              |
| <code>anthropic/claude-sonnet-5-5</code> | 817 in / 68 out    | 2778.531 ms/1K tokens | $0.0023       | text-anthropic-claude-sonnet-5-5.json | n/a              |
| <code>gemini/gemini-3.8-flash</code>     | 468 in / 436 out   | 4184.735 ms/1K tokens | $0.0040       | text-gemini-gemini-3.8-flash.json     | n/a              |
| <code>gemini/gemini-4-argon</code>       | 666 in / 57 out    | 7688.797 ms/1K tokens | $0.0038       | text-gemini-gemini-4-argon.json       | n/a              |
| <code>grok/grok-4.7</code>               | 1,714 in / 743 out | 2715.914 ms/1K tokens | $0.0079       | text-grok-grok-4.7.json               | n/a              |
| <code>openai/gpt-6-luna</code>           | 438 in / 88 out    | 5315.589 ms/1K tokens | $0.0001       | text-openai-gpt-6-luna.json           | n/a              |
| <code>openai/gpt-6.1-sol</code>          | 438 in / 42 out    | 6004.167 ms/1K tokens | $0.0013       | text-openai-gpt-6.1-sol.json          | n/a              |

## Notes

- Text mode scores existing write outputs only and does not call LLM providers.
- Length, speed, cost, output existence, schema validity, and subjective judgment are not quality proxies.
