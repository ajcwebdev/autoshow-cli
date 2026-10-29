# Text Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/write/2026-10-18_04-blog`
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
| 1    | <code>openai/gpt-6-luna</code>           | $0.0010  |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | $0.0017  |
| 3    | <code>openai/gpt-6.1-sol</code>          | $0.0223  |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0305  |
| 5    | <code>anthropic/claude-sonnet-5-5</code> | $0.0336  |
| 6    | <code>gemini/gemini-4-argon</code>       | $0.0357  |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.0617  |
| 8    | <code>grok/grok-4.7</code>               | $0.0844  |

### Speed

| Rank | Provider                                 | Evidence              |
| ---: | ---------------------------------------- | --------------------- |
| 1    | <code>openai/gpt-6-luna</code>           | 2274.539 ms/1K tokens |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 2393.365 ms/1K tokens |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 4123.429 ms/1K tokens |
| 4    | <code>anthropic/claude-opus-5-5</code>   | 4278.637 ms/1K tokens |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 4494.643 ms/1K tokens |
| 6    | <code>gemini/gemini-4-argon</code>       | 4612.335 ms/1K tokens |
| 7    | <code>openai/gpt-6.1-sol</code>          | 6029.844 ms/1K tokens |
| 8    | <code>grok/grok-4.7</code>               | 8021.692 ms/1K tokens |

### Automated Quality

Unavailable: No explicit text quality score was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as human quality proxies.

### Provider Detail

| Provider                                 | Tokens                | Speed                 | Monetary Cost | Output                                | Quality Evidence |
| ---------------------------------------- | --------------------: | --------------------: | ------------: | ------------------------------------- | ---------------- |
| <code>anthropic/claude-haiku-5-5</code>  | 3,660 in / 2,670 out  | 2393.365 ms/1K tokens | $0.0017       | text-anthropic-claude-haiku-5-5.json  | n/a              |
| <code>anthropic/claude-opus-5-5</code>   | 3,660 in / 2,355 out  | 4278.637 ms/1K tokens | $0.0617       | text-anthropic-claude-opus-5-5.json   | n/a              |
| <code>anthropic/claude-sonnet-5-5</code> | 3,660 in / 2,627 out  | 4123.429 ms/1K tokens | $0.0336       | text-anthropic-claude-sonnet-5-5.json | n/a              |
| <code>gemini/gemini-3.8-flash</code>     | 2,620 in / 3,540 out  | 4494.643 ms/1K tokens | $0.0305       | text-gemini-gemini-3.8-flash.json     | n/a              |
| <code>gemini/gemini-4-argon</code>       | 2,879 in / 1,207 out  | 4612.335 ms/1K tokens | $0.0357       | text-gemini-gemini-4-argon.json       | n/a              |
| <code>grok/grok-4.7</code>               | 3,713 in / 12,837 out | 8021.692 ms/1K tokens | $0.0844       | text-grok-grok-4.7.json               | n/a              |
| <code>openai/gpt-6-luna</code>           | 2,409 in / 1,605 out  | 2274.539 ms/1K tokens | $0.0010       | text-openai-gpt-6-luna.json           | n/a              |
| <code>openai/gpt-6.1-sol</code>          | 2,409 in / 1,746 out  | 6029.844 ms/1K tokens | $0.0223       | text-openai-gpt-6.1-sol.json          | n/a              |

## Notes

- Text mode scores existing write outputs only and does not call LLM providers.
- Length, speed, cost, output existence, schema validity, and subjective judgment are not quality proxies.
