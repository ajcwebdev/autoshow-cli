# Text Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/write/2026-10-18_05-rap-song-chapter`
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
| 2    | <code>anthropic/claude-haiku-5-5</code>  | $0.0028  |
| 3    | <code>openai/gpt-6.1-sol</code>          | $0.0213  |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0297  |
| 5    | <code>gemini/gemini-4-argon</code>       | $0.0424  |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0635  |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.0894  |
| 8    | <code>grok/grok-4.7</code>               | $0.2249  |

### Speed

| Rank | Provider                                 | Evidence               |
| ---: | ---------------------------------------- | ---------------------- |
| 1    | <code>openai/gpt-6-luna</code>           | 1612.002 ms/1K tokens  |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 1759.219 ms/1K tokens  |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 3416.251 ms/1K tokens  |
| 4    | <code>gemini/gemini-3.8-flash</code>     | 3705.501 ms/1K tokens  |
| 5    | <code>anthropic/claude-opus-5-5</code>   | 3951.633 ms/1K tokens  |
| 6    | <code>gemini/gemini-4-argon</code>       | 4058.770 ms/1K tokens  |
| 7    | <code>openai/gpt-6.1-sol</code>          | 4627.855 ms/1K tokens  |
| 8    | <code>grok/grok-4.7</code>               | 12756.831 ms/1K tokens |

### Automated Quality

Unavailable: No explicit text quality score was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as human quality proxies.

### Provider Detail

| Provider                                 | Tokens                | Speed                  | Monetary Cost | Output                                | Quality Evidence |
| ---------------------------------------- | --------------------: | ---------------------: | ------------: | ------------------------------------- | ---------------- |
| <code>anthropic/claude-haiku-5-5</code>  | 6,350 in / 4,361 out  | 1759.219 ms/1K tokens  | $0.0028       | text-anthropic-claude-haiku-5-5.json  | n/a              |
| <code>anthropic/claude-opus-5-5</code>   | 6,350 in / 3,202 out  | 3951.633 ms/1K tokens  | $0.0894       | text-anthropic-claude-opus-5-5.json   | n/a              |
| <code>anthropic/claude-sonnet-5-5</code> | 6,350 in / 5,083 out  | 3416.251 ms/1K tokens  | $0.0635       | text-anthropic-claude-sonnet-5-5.json | n/a              |
| <code>gemini/gemini-3.8-flash</code>     | 3,523 in / 3,258 out  | 3705.501 ms/1K tokens  | $0.0297       | text-gemini-gemini-3.8-flash.json     | n/a              |
| <code>gemini/gemini-4-argon</code>       | 4,155 in / 1,290 out  | 4058.770 ms/1K tokens  | $0.0424       | text-gemini-gemini-4-argon.json       | n/a              |
| <code>grok/grok-4.7</code>               | 4,939 in / 35,831 out | 12756.831 ms/1K tokens | $0.2249       | text-grok-grok-4.7.json               | n/a              |
| <code>openai/gpt-6-luna</code>           | 3,518 in / 1,348 out  | 1612.002 ms/1K tokens  | $0.0010       | text-openai-gpt-6-luna.json           | n/a              |
| <code>openai/gpt-6.1-sol</code>          | 3,518 in / 1,429 out  | 4627.855 ms/1K tokens  | $0.0213       | text-openai-gpt-6.1-sol.json          | n/a              |

## Notes

- Text mode scores existing write outputs only and does not call LLM providers.
- Length, speed, cost, output existence, schema validity, and subjective judgment are not quality proxies.
