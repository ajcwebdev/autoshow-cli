# Text Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/as/autoshow-cli/docs/benchmarks/write/2026-06-10_16-33-20-777_1-audio`
- Total providers: 15 (0 local, 15 service)
- Text mode scores existing `write` outputs only and does not call providers.
- Write has no local LLM group.

## Method

- Price rankings use reported actual or estimated service cost from `manifest.json`.
- Speed rankings prefer `msPerUnit` normalized timing when present, then fall back to wall-clock processing time.
- Token counts, output file presence, schema mode, speed, and cost are evidence only.
- Text quality is not inferred from length, speed, cost, output existence, schema validity, or subjective judgment.

## Service Providers

### Price

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `groq/openai/gpt-oss-20b` | $0.0001 |
| 2 | `groq/openai/gpt-oss-120b` | $0.0001 |
| 3 | `openai/gpt-5.4-nano` | $0.0001 |
| 4 | `gemini/gemini-3.1-flash-lite` | $0.0002 |
| 5 | `gemini/gemini-3.1-flash-lite-preview` | $0.0002 |
| 6 | `openai/gpt-5.4-mini` | $0.0005 |
| 7 | `kimi/kimi-k2.6` | $0.0005 |
| 8 | `minimax/MiniMax-M3` | $0.0007 |
| 9 | `anthropic/claude-haiku-4-5` | $0.0008 |
| 10 | `grok/grok-4.3` | $0.0008 |
| 11 | `glm/glm-5.1` | $0.0009 |
| 12 | `gemini/gemini-3.1-pro-preview` | $0.0014 |
| 13 | `anthropic/claude-sonnet-4-6` | $0.0025 |
| 14 | `openai/gpt-5.5` | $0.0033 |
| 15 | `anthropic/claude-opus-4-8` | $0.0056 |

### Speed

| Rank | Provider | Evidence |
| ---: | --- | --- |
| 1 | `groq/openai/gpt-oss-120b` | 663.383 ms/1K tokens |
| 2 | `groq/openai/gpt-oss-20b` | 739.057 ms/1K tokens |
| 3 | `gemini/gemini-3.1-flash-lite` | 1616.896 ms/1K tokens |
| 4 | `gemini/gemini-3.1-flash-lite-preview` | 1635.659 ms/1K tokens |
| 5 | `openai/gpt-5.4-nano` | 2205.231 ms/1K tokens |
| 6 | `openai/gpt-5.4-mini` | 2474.542 ms/1K tokens |
| 7 | `anthropic/claude-haiku-4-5` | 2570.790 ms/1K tokens |
| 8 | `openai/gpt-5.5` | 3319.672 ms/1K tokens |
| 9 | `anthropic/claude-opus-4-8` | 3401.776 ms/1K tokens |
| 10 | `glm/glm-5.1` | 3760.748 ms/1K tokens |
| 11 | `kimi/kimi-k2.6` | 4509.677 ms/1K tokens |
| 12 | `anthropic/claude-sonnet-4-6` | 5349.630 ms/1K tokens |
| 13 | `minimax/MiniMax-M3` | 5958.438 ms/1K tokens |
| 14 | `grok/grok-4.3` | 8885.400 ms/1K tokens |
| 15 | `gemini/gemini-3.1-pro-preview` | 13780.583 ms/1K tokens |

### Automated Quality

Unavailable: No explicit text quality scores were available. Text benchmark quality is not inferred from length, speed, cost, schema validity, output existence, or subjective judgment.

### Human Quality

Unavailable: No explicit humanQualityScore was available. Text benchmark human quality is not inferred from length, speed, cost, schema validity, output existence, or subjective judgment.

### Provider Detail

| Provider | Tokens | Speed | Monetary Cost | Output | Quality Evidence |
| --- | ---: | ---: | ---: | --- | --- |
| `anthropic/claude-haiku-4-5` | 635 in / 36 out | 2570.790 ms/1K tokens | $0.0008 | text-claude-haiku-4-5.json | n/a |
| `anthropic/claude-opus-4-8` | 846 in / 55 out | 3401.776 ms/1K tokens | $0.0056 | text-claude-opus-4-8.json | n/a |
| `anthropic/claude-sonnet-4-6` | 636 in / 39 out | 5349.630 ms/1K tokens | $0.0025 | text-claude-sonnet-4-6.json | n/a |
| `gemini/gemini-3.1-flash-lite` | 475 in / 34 out | 1616.896 ms/1K tokens | $0.0002 | text-gemini-3.1-flash-lite.json | n/a |
| `gemini/gemini-3.1-flash-lite-preview` | 475 in / 41 out | 1635.659 ms/1K tokens | $0.0002 | text-gemini-3.1-flash-lite-preview.json | n/a |
| `gemini/gemini-3.1-pro-preview` | 475 in / 40 out | 13780.583 ms/1K tokens | $0.0014 | text-gemini-3.1-pro-preview.json | n/a |
| `glm/glm-5.1` | 497 in / 38 out | 3760.748 ms/1K tokens | $0.0009 | text-glm-5.1.json | n/a |
| `grok/grok-4.3` | 602 in / 35 out | 8885.400 ms/1K tokens | $0.0008 | text-grok-4.3.json | n/a |
| `groq/openai/gpt-oss-120b` | 541 in / 68 out | 663.383 ms/1K tokens | $0.0001 | text-openai-gpt-oss-120b.json | n/a |
| `groq/openai/gpt-oss-20b` | 541 in / 53 out | 739.057 ms/1K tokens | $0.0001 | text-openai-gpt-oss-20b.json | n/a |
| `kimi/kimi-k2.6` | 431 in / 34 out | 4509.677 ms/1K tokens | $0.0005 | text-kimi-k2.6.json | n/a |
| `minimax/MiniMax-M3` | 695 in / 99 out | 5958.438 ms/1K tokens | $0.0007 | text-MiniMax-M3.json | n/a |
| `openai/gpt-5.4-mini` | 452 in / 39 out | 2474.542 ms/1K tokens | $0.0005 | text-gpt-5.4-mini.json | n/a |
| `openai/gpt-5.4-nano` | 452 in / 45 out | 2205.231 ms/1K tokens | $0.0001 | text-gpt-5.4-nano.json | n/a |
| `openai/gpt-5.5` | 452 in / 36 out | 3319.672 ms/1K tokens | $0.0033 | text-gpt-5.5.json | n/a |

## Notes

- Text mode scores existing write outputs only and does not call LLM providers.
- Price rankings use reported actual or estimated service costs from manifest.json.
- Speed rankings prefer normalized msPerUnit timing when present, falling back to wall-clock processing time.
- Automated and human quality rankings require explicit quality fields and are otherwise unavailable.
