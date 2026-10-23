# Text Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/write/2026-10-18_04-blog`
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
| 1 | <code>openai/gpt-6-luna</code> | $0.0010 |
| 2 | <code>anthropic/claude-haiku-5-5</code> | $0.0017 |
| 3 | <code>openai/gpt-5.6-luna</code> | $0.0023 |
| 4 | <code>glm/glm-5.3-flash</code> | $0.0038 |
| 5 | <code>together/glm-5.3-flash</code> | $0.0066 |
| 6 | <code>together/glm-5.3</code> | $0.0091 |
| 7 | <code>gemini/gemini-3.7-flash</code> | $0.0198 |
| 8 | <code>grok/grok-4.6</code> | $0.0216 |
| 9 | <code>openai/gpt-6.1-sol</code> | $0.0223 |
| 10 | <code>openai/gpt-5.6-terra</code> | $0.0239 |
| 11 | <code>kimi/kimi-k3</code> | $0.0283 |
| 12 | <code>anthropic/claude-sonnet-5</code> | $0.0295 |
| 13 | <code>gemini/gemini-3.8-flash</code> | $0.0305 |
| 14 | <code>glm/glm-5.3</code> | $0.0326 |
| 15 | <code>anthropic/claude-sonnet-5-5</code> | $0.0336 |
| 16 | <code>gemini/gemini-4-argon</code> | $0.0357 |
| 17 | <code>openai/gpt-5.6-sol</code> | $0.0479 |
| 18 | <code>together/kimi-k3</code> | $0.0614 |
| 19 | <code>anthropic/claude-opus-5-5</code> | $0.0617 |
| 20 | <code>grok/grok-4.7</code> | $0.0844 |
| 21 | <code>anthropic/claude-opus-5</code> | $0.0926 |
| 22 | <code>openai/gpt-6-astra</code> | $0.1058 |
| 23 | <code>anthropic/claude-fable-5-1</code> | $0.1645 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>openai/gpt-6-luna</code> | 2274.539 ms/1K tokens |
| 2 | <code>openai/gpt-5.6-luna</code> | 2368.070 ms/1K tokens |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 2393.365 ms/1K tokens |
| 4 | <code>together/glm-5.3-flash</code> | 2753.509 ms/1K tokens |
| 5 | <code>together/glm-5.3</code> | 3325.806 ms/1K tokens |
| 6 | <code>openai/gpt-5.6-terra</code> | 3703.398 ms/1K tokens |
| 7 | <code>openai/gpt-5.6-sol</code> | 3944.265 ms/1K tokens |
| 8 | <code>anthropic/claude-sonnet-5-5</code> | 4123.429 ms/1K tokens |
| 9 | <code>anthropic/claude-opus-5-5</code> | 4278.637 ms/1K tokens |
| 10 | <code>gemini/gemini-3.7-flash</code> | 4343.948 ms/1K tokens |
| 11 | <code>gemini/gemini-3.8-flash</code> | 4494.643 ms/1K tokens |
| 12 | <code>gemini/gemini-4-argon</code> | 4612.335 ms/1K tokens |
| 13 | <code>anthropic/claude-sonnet-5</code> | 4800.714 ms/1K tokens |
| 14 | <code>openai/gpt-6-astra</code> | 5794.707 ms/1K tokens |
| 15 | <code>openai/gpt-6.1-sol</code> | 6029.844 ms/1K tokens |
| 16 | <code>anthropic/claude-fable-5-1</code> | 6506.111 ms/1K tokens |
| 17 | <code>anthropic/claude-opus-5</code> | 7356.001 ms/1K tokens |
| 18 | <code>glm/glm-5.3</code> | 7945.585 ms/1K tokens |
| 19 | <code>grok/grok-4.7</code> | 8021.692 ms/1K tokens |
| 20 | <code>glm/glm-5.3-flash</code> | 8162.289 ms/1K tokens |
| 21 | <code>together/kimi-k3</code> | 9720.442 ms/1K tokens |
| 22 | <code>kimi/kimi-k3</code> | 10278.207 ms/1K tokens |
| 23 | <code>grok/grok-4.6</code> | 10617.164 ms/1K tokens |

### Automated Quality

Unavailable: No explicit text quality score was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as human quality proxies.

### Provider Detail

| Provider | Tokens | Speed | Monetary Cost | Output | Quality Evidence |
| --- | ---: | ---: | ---: | --- | --- |
| <code>anthropic/claude-fable-5-1</code> | 3,660 in / 2,558 out | 6506.111 ms/1K tokens | $0.1645 | text-anthropic-claude-fable-5-1.json | n/a |
| <code>anthropic/claude-haiku-5-5</code> | 3,660 in / 2,670 out | 2393.365 ms/1K tokens | $0.0017 | text-anthropic-claude-haiku-5-5.json | n/a |
| <code>anthropic/claude-opus-5</code> | 3,658 in / 2,974 out | 7356.001 ms/1K tokens | $0.0926 | text-anthropic-claude-opus-5.json | n/a |
| <code>anthropic/claude-opus-5-5</code> | 3,660 in / 2,355 out | 4278.637 ms/1K tokens | $0.0617 | text-anthropic-claude-opus-5-5.json | n/a |
| <code>anthropic/claude-sonnet-5</code> | 3,658 in / 2,223 out | 4800.714 ms/1K tokens | $0.0295 | text-anthropic-claude-sonnet-5.json | n/a |
| <code>anthropic/claude-sonnet-5-5</code> | 3,660 in / 2,627 out | 4123.429 ms/1K tokens | $0.0336 | text-anthropic-claude-sonnet-5-5.json | n/a |
| <code>gemini/gemini-3.7-flash</code> | 2,620 in / 2,122 out | 4343.948 ms/1K tokens | $0.0198 | text-gemini-gemini-3.7-flash.json | n/a |
| <code>gemini/gemini-3.8-flash</code> | 2,620 in / 3,540 out | 4494.643 ms/1K tokens | $0.0305 | text-gemini-gemini-3.8-flash.json | n/a |
| <code>gemini/gemini-4-argon</code> | 2,879 in / 1,207 out | 4612.335 ms/1K tokens | $0.0357 | text-gemini-gemini-4-argon.json | n/a |
| <code>glm/glm-5.3</code> | 2,434 in / 6,626 out | 7945.585 ms/1K tokens | $0.0326 | text-glm-glm-5.3.json | n/a |
| <code>glm/glm-5.3-flash</code> | 2,434 in / 6,932 out | 8162.289 ms/1K tokens | $0.0038 | text-glm-glm-5.3-flash.json | n/a |
| <code>grok/grok-4.6</code> | 3,107 in / 2,556 out | 10617.164 ms/1K tokens | $0.0216 | text-grok-grok-4.6.json | n/a |
| <code>grok/grok-4.7</code> | 3,713 in / 12,837 out | 8021.692 ms/1K tokens | $0.0844 | text-grok-grok-4.7.json | n/a |
| <code>kimi/kimi-k3</code> | 2,497 in / 1,385 out | 10278.207 ms/1K tokens | $0.0283 | text-kimi-kimi-k3.json | n/a |
| <code>openai/gpt-5.6-luna</code> | 2,409 in / 1,487 out | 2368.070 ms/1K tokens | $0.0023 | text-openai-gpt-5.6-luna.json | n/a |
| <code>openai/gpt-5.6-sol</code> | 2,409 in / 1,915 out | 3944.265 ms/1K tokens | $0.0479 | text-openai-gpt-5.6-sol.json | n/a |
| <code>openai/gpt-5.6-terra</code> | 2,409 in / 1,593 out | 3703.398 ms/1K tokens | $0.0239 | text-openai-gpt-5.6-terra.json | n/a |
| <code>openai/gpt-6-astra</code> | 2,409 in / 1,634 out | 5794.707 ms/1K tokens | $0.1058 | text-openai-gpt-6-astra.json | n/a |
| <code>openai/gpt-6-luna</code> | 2,409 in / 1,605 out | 2274.539 ms/1K tokens | $0.0010 | text-openai-gpt-6-luna.json | n/a |
| <code>openai/gpt-6.1-sol</code> | 2,409 in / 1,746 out | 6029.844 ms/1K tokens | $0.0223 | text-openai-gpt-6.1-sol.json | n/a |
| <code>together/glm-5.3</code> | 2,434 in / 1,286 out | 3325.806 ms/1K tokens | $0.0091 | text-together-glm-5.3.json | n/a |
| <code>together/glm-5.3-flash</code> | 2,434 in / 12,455 out | 2753.509 ms/1K tokens | $0.0066 | text-together-glm-5.3-flash.json | n/a |
| <code>together/kimi-k3</code> | 2,569 in / 3,580 out | 9720.442 ms/1K tokens | $0.0614 | text-together-kimi-k3.json | n/a |

## Notes

- Text mode scores existing write outputs only and does not call LLM providers.
- Length, speed, cost, output existence, schema validity, and subjective judgment are not quality proxies.
