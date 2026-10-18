# Text Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/write/2026-10-18_03-medium-chapters`
- Total providers: 22 (0 local, 22 service)
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
| 1 | <code>openai/gpt-6-luna</code> | $0.0004 |
| 2 | <code>openai/gpt-5.6-luna</code> | $0.0009 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0012 |
| 4 | <code>together/glm-5.3-flash</code> | $0.0027 |
| 5 | <code>glm/glm-5.3-flash</code> | $0.0040 |
| 6 | <code>together/glm-5.3</code> | $0.0053 |
| 7 | <code>openai/gpt-6.1-sol</code> | $0.0090 |
| 8 | <code>openai/gpt-5.6-terra</code> | $0.0100 |
| 9 | <code>gemini/gemini-3.7-flash</code> | $0.0142 |
| 10 | <code>anthropic/claude-sonnet-5-5</code> | $0.0156 |
| 11 | <code>kimi/kimi-k3</code> | $0.0174 |
| 12 | <code>gemini/gemini-3.8-flash</code> | $0.0184 |
| 13 | <code>openai/gpt-5.6-sol</code> | $0.0187 |
| 14 | <code>gemini/gemini-4-argon</code> | $0.0190 |
| 15 | <code>grok/grok-4.7</code> | $0.0214 |
| 16 | <code>anthropic/claude-sonnet-5</code> | $0.0215 |
| 17 | <code>anthropic/claude-opus-5-5</code> | $0.0249 |
| 18 | <code>together/kimi-k3</code> | $0.0408 |
| 19 | <code>anthropic/claude-opus-5</code> | $0.0415 |
| 20 | <code>openai/gpt-6-astra</code> | $0.0454 |
| 21 | <code>grok/grok-4.6</code> | $0.0487 |
| 22 | <code>anthropic/claude-fable-5-1</code> | $0.0810 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | <code>openai/gpt-5.6-luna</code> | 935.060 ms/1K tokens |
| 2 | <code>openai/gpt-6-luna</code> | 967.331 ms/1K tokens |
| 3 | <code>openai/gpt-5.6-sol</code> | 1248.652 ms/1K tokens |
| 4 | <code>anthropic/claude-opus-5-5</code> | 1392.532 ms/1K tokens |
| 5 | <code>openai/gpt-5.6-terra</code> | 1433.796 ms/1K tokens |
| 6 | <code>anthropic/claude-haiku-5-5</code> | 1438.278 ms/1K tokens |
| 7 | <code>anthropic/claude-sonnet-5-5</code> | 1483.199 ms/1K tokens |
| 8 | <code>together/glm-5.3</code> | 1657.269 ms/1K tokens |
| 9 | <code>gemini/gemini-4-argon</code> | 1894.567 ms/1K tokens |
| 10 | <code>openai/gpt-6-astra</code> | 1971.088 ms/1K tokens |
| 11 | <code>openai/gpt-6.1-sol</code> | 2136.813 ms/1K tokens |
| 12 | <code>gemini/gemini-3.7-flash</code> | 2292.217 ms/1K tokens |
| 13 | <code>anthropic/claude-fable-5-1</code> | 2295.006 ms/1K tokens |
| 14 | <code>anthropic/claude-opus-5</code> | 2531.543 ms/1K tokens |
| 15 | <code>together/glm-5.3-flash</code> | 2669.050 ms/1K tokens |
| 16 | <code>anthropic/claude-sonnet-5</code> | 2850.642 ms/1K tokens |
| 17 | <code>gemini/gemini-3.8-flash</code> | 2885.714 ms/1K tokens |
| 18 | <code>grok/grok-4.7</code> | 4258.946 ms/1K tokens |
| 19 | <code>kimi/kimi-k3</code> | 5273.202 ms/1K tokens |
| 20 | <code>glm/glm-5.3-flash</code> | 8041.731 ms/1K tokens |
| 21 | <code>together/kimi-k3</code> | 8245.818 ms/1K tokens |
| 22 | <code>grok/grok-4.6</code> | 11808.705 ms/1K tokens |

### Automated Quality

Unavailable: No explicit text quality score was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as automated quality proxies.

### Human Quality

Unavailable: No explicit humanQualityScore was available for service providers. Length, speed, cost, output existence, schema validity, and subjective judgment are not used as human quality proxies.

### Provider Detail

| Provider | Tokens | Speed | Monetary Cost | Output | Quality Evidence |
| --- | ---: | ---: | ---: | --- | --- |
| <code>anthropic/claude-fable-5-1</code> | 3,932 in / 834 out | 2295.006 ms/1K tokens | $0.0810 | text-anthropic-claude-fable-5-1.json | n/a |
| <code>anthropic/claude-haiku-5-5</code> | 3,932 in / 1,528 out | 1438.278 ms/1K tokens | $0.0012 | text-anthropic-claude-haiku-5-5.json | n/a |
| <code>anthropic/claude-opus-5</code> | 3,930 in / 873 out | 2531.543 ms/1K tokens | $0.0415 | text-anthropic-claude-opus-5.json | n/a |
| <code>anthropic/claude-opus-5-5</code> | 3,932 in / 460 out | 1392.532 ms/1K tokens | $0.0249 | text-anthropic-claude-opus-5-5.json | n/a |
| <code>anthropic/claude-sonnet-5</code> | 3,930 in / 1,366 out | 2850.642 ms/1K tokens | $0.0215 | text-anthropic-claude-sonnet-5.json | n/a |
| <code>anthropic/claude-sonnet-5-5</code> | 3,932 in / 770 out | 1483.199 ms/1K tokens | $0.0156 | text-anthropic-claude-sonnet-5-5.json | n/a |
| <code>gemini/gemini-3.7-flash</code> | 2,747 in / 1,339 out | 2292.217 ms/1K tokens | $0.0142 | text-gemini-gemini-3.7-flash.json | n/a |
| <code>gemini/gemini-3.8-flash</code> | 2,747 in / 1,908 out | 2885.714 ms/1K tokens | $0.0184 | text-gemini-gemini-3.8-flash.json | n/a |
| <code>gemini/gemini-4-argon</code> | 3,067 in / 338 out | 1894.567 ms/1K tokens | $0.0190 | text-gemini-gemini-4-argon.json | n/a |
| <code>glm/glm-5.3-flash</code> | 2,554 in / 7,223 out | 8041.731 ms/1K tokens | $0.0040 | text-glm-glm-5.3-flash.json | n/a |
| <code>grok/grok-4.6</code> | 3,269 in / 7,024 out | 11808.705 ms/1K tokens | $0.0487 | text-grok-grok-4.6.json | n/a |
| <code>grok/grok-4.7</code> | 3,875 in / 2,273 out | 4258.946 ms/1K tokens | $0.0214 | text-grok-grok-4.7.json | n/a |
| <code>kimi/kimi-k3</code> | 2,615 in / 639 out | 5273.202 ms/1K tokens | $0.0174 | text-kimi-kimi-k3.json | n/a |
| <code>openai/gpt-5.6-luna</code> | 2,540 in / 355 out | 935.060 ms/1K tokens | $0.0009 | text-openai-gpt-5.6-luna.json | n/a |
| <code>openai/gpt-5.6-sol</code> | 2,540 in / 428 out | 1248.652 ms/1K tokens | $0.0187 | text-openai-gpt-5.6-sol.json | n/a |
| <code>openai/gpt-5.6-terra</code> | 2,540 in / 413 out | 1433.796 ms/1K tokens | $0.0100 | text-openai-gpt-5.6-terra.json | n/a |
| <code>openai/gpt-6-astra</code> | 2,540 in / 400 out | 1971.088 ms/1K tokens | $0.0454 | text-openai-gpt-6-astra.json | n/a |
| <code>openai/gpt-6-luna</code> | 2,540 in / 368 out | 967.331 ms/1K tokens | $0.0004 | text-openai-gpt-6-luna.json | n/a |
| <code>openai/gpt-6.1-sol</code> | 2,540 in / 391 out | 2136.813 ms/1K tokens | $0.0090 | text-openai-gpt-6.1-sol.json | n/a |
| <code>together/glm-5.3</code> | 2,554 in / 390 out | 1657.269 ms/1K tokens | $0.0053 | text-together-glm-5.3.json | n/a |
| <code>together/glm-5.3-flash</code> | 2,554 in / 4,580 out | 2669.050 ms/1K tokens | $0.0027 | text-together-glm-5.3-flash.json | n/a |
| <code>together/kimi-k3</code> | 2,726 in / 2,176 out | 8245.818 ms/1K tokens | $0.0408 | text-together-kimi-k3.json | n/a |

## Notes

- Text mode scores existing write outputs only and does not call LLM providers.
- Length, speed, cost, output existence, schema validity, and subjective judgment are not quality proxies.
