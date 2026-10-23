# Text Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/write/2026-10-18_02-long-summary`
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
| 1    | <code>openai/gpt-6-luna</code>           | $0.0011  |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | $0.0016  |
| 3    | <code>openai/gpt-6.1-sol</code>          | $0.0224  |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0258  |
| 5    | <code>grok/grok-4.7</code>               | $0.0281  |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0318  |
| 7    | <code>gemini/gemini-4-argon</code>       | $0.0495  |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0664  |

### Speed

| Rank | Provider                                 | Evidence             |
| ---: | ---------------------------------------- | -------------------- |
| 1    | <code>openai/gpt-6-luna</code>           | 219.246 ms/1K tokens |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 243.241 ms/1K tokens |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 315.238 ms/1K tokens |
| 4    | <code>openai/gpt-6.1-sol</code>          | 380.971 ms/1K tokens |
| 5    | <code>anthropic/claude-opus-5-5</code>   | 441.918 ms/1K tokens |
| 6    | <code>gemini/gemini-4-argon</code>       | 471.281 ms/1K tokens |
| 7    | <code>gemini/gemini-3.8-flash</code>     | 742.757 ms/1K tokens |
| 8    | <code>grok/grok-4.7</code>               | 918.987 ms/1K tokens |

### Automated Quality

Unavailable: No explicit text quality score was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as human quality proxies.

### Provider Detail

| Provider                                 | Tokens                | Speed                | Monetary Cost | Output                                | Quality Evidence |
| ---------------------------------------- | --------------------: | -------------------: | ------------: | ------------------------------------- | ---------------- |
| <code>anthropic/claude-haiku-5-5</code>  | 14,152 in / 459 out   | 243.241 ms/1K tokens | $0.0016       | text-anthropic-claude-haiku-5-5.json  | n/a              |
| <code>anthropic/claude-opus-5-5</code>   | 14,152 in / 491 out   | 441.918 ms/1K tokens | $0.0664       | text-anthropic-claude-opus-5-5.json   | n/a              |
| <code>anthropic/claude-sonnet-5-5</code> | 14,152 in / 345 out   | 315.238 ms/1K tokens | $0.0318       | text-anthropic-claude-sonnet-5-5.json | n/a              |
| <code>gemini/gemini-3.8-flash</code>     | 11,103 in / 1,220 out | 742.757 ms/1K tokens | $0.0258       | text-gemini-gemini-3.8-flash.json     | n/a              |
| <code>gemini/gemini-4-argon</code>       | 11,336 in / 207 out   | 471.281 ms/1K tokens | $0.0495       | text-gemini-gemini-4-argon.json       | n/a              |
| <code>grok/grok-4.7</code>               | 11,502 in / 854 out   | 918.987 ms/1K tokens | $0.0281       | text-grok-grok-4.7.json               | n/a              |
| <code>openai/gpt-6-luna</code>           | 10,205 in / 249 out   | 219.246 ms/1K tokens | $0.0011       | text-openai-gpt-6-luna.json           | n/a              |
| <code>openai/gpt-6.1-sol</code>          | 10,205 in / 200 out   | 380.971 ms/1K tokens | $0.0224       | text-openai-gpt-6.1-sol.json          | n/a              |

## Notes

- Text mode scores existing write outputs only and does not call LLM providers.
- Length, speed, cost, output existence, schema validity, and subjective judgment are not quality proxies.
