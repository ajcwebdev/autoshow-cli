# Text Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/write/2026-10-18_03-medium-chapters`
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
| 1    | <code>openai/gpt-6-luna</code>           | $0.0004  |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | $0.0012  |
| 3    | <code>openai/gpt-6.1-sol</code>          | $0.0090  |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | $0.0156  |
| 5    | <code>gemini/gemini-3.8-flash</code>     | $0.0184  |
| 6    | <code>gemini/gemini-4-argon</code>       | $0.0190  |
| 7    | <code>grok/grok-4.7</code>               | $0.0214  |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0249  |

### Speed

| Rank | Provider                                 | Evidence              |
| ---: | ---------------------------------------- | --------------------- |
| 1    | <code>openai/gpt-6-luna</code>           | 967.331 ms/1K tokens  |
| 2    | <code>anthropic/claude-opus-5-5</code>   | 1392.532 ms/1K tokens |
| 3    | <code>anthropic/claude-haiku-5-5</code>  | 1438.278 ms/1K tokens |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 1483.199 ms/1K tokens |
| 5    | <code>gemini/gemini-4-argon</code>       | 1894.567 ms/1K tokens |
| 6    | <code>openai/gpt-6.1-sol</code>          | 2136.813 ms/1K tokens |
| 7    | <code>gemini/gemini-3.8-flash</code>     | 2885.714 ms/1K tokens |
| 8    | <code>grok/grok-4.7</code>               | 4258.946 ms/1K tokens |

### Automated Quality

Unavailable: No explicit text quality score was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as human quality proxies.

### Provider Detail

| Provider                                 | Tokens               | Speed                 | Monetary Cost | Output                                | Quality Evidence |
| ---------------------------------------- | -------------------: | --------------------: | ------------: | ------------------------------------- | ---------------- |
| <code>anthropic/claude-haiku-5-5</code>  | 3,932 in / 1,528 out | 1438.278 ms/1K tokens | $0.0012       | text-anthropic-claude-haiku-5-5.json  | n/a              |
| <code>anthropic/claude-opus-5-5</code>   | 3,932 in / 460 out   | 1392.532 ms/1K tokens | $0.0249       | text-anthropic-claude-opus-5-5.json   | n/a              |
| <code>anthropic/claude-sonnet-5-5</code> | 3,932 in / 770 out   | 1483.199 ms/1K tokens | $0.0156       | text-anthropic-claude-sonnet-5-5.json | n/a              |
| <code>gemini/gemini-3.8-flash</code>     | 2,747 in / 1,908 out | 2885.714 ms/1K tokens | $0.0184       | text-gemini-gemini-3.8-flash.json     | n/a              |
| <code>gemini/gemini-4-argon</code>       | 3,067 in / 338 out   | 1894.567 ms/1K tokens | $0.0190       | text-gemini-gemini-4-argon.json       | n/a              |
| <code>grok/grok-4.7</code>               | 3,875 in / 2,273 out | 4258.946 ms/1K tokens | $0.0214       | text-grok-grok-4.7.json               | n/a              |
| <code>openai/gpt-6-luna</code>           | 2,540 in / 368 out   | 967.331 ms/1K tokens  | $0.0004       | text-openai-gpt-6-luna.json           | n/a              |
| <code>openai/gpt-6.1-sol</code>          | 2,540 in / 391 out   | 2136.813 ms/1K tokens | $0.0090       | text-openai-gpt-6.1-sol.json          | n/a              |

## Notes

- Text mode scores existing write outputs only and does not call LLM providers.
- Length, speed, cost, output existence, schema validity, and subjective judgment are not quality proxies.
