# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/ocr/01-medieval`
- Total providers: 23 (0 local, 23 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0002 | 95.41 | 4.59% | 0.50% | 14.55s | $0.0002 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0004 | 95.87 | 4.13% | 0.42% | 23.98s | $0.0004 |
| 3 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0011 | 90.37 | 9.63% | 1.77% | 6.80s | $0.0011 |
| 4 | <code>openai/gpt-5.6-luna</code> | $0.0013 | 94.50 | 5.50% | 1.09% | 4.98s | $0.0013 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0014 | 96.33 | 3.67% | 0.34% | 2.08s | $0.0014 |
| 6 | <code>glm/glm-5.3-flash</code> | $0.0016 | 98.62 | 1.38% | 0.25% | 67.32s | $0.0016 |
| 7 | <code>kimi/kimi-k2.6</code> | $0.0029 | 95.41 | 4.59% | 0.42% | 11.49s | $0.0029 |
| 8 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 98.17 | 1.83% | 0.34% | 1.44s | $0.0040 |
| 9 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 95.87 | 4.13% | 0.42% | 1.08s | $0.0040 |
| 10 | <code>gemini/gemini-3.6-flash</code> | $0.0045 | 100.00 | 0.00% | 0.00% | 2.40s | $0.0045 |
| 11 | <code>gemini/gemini-3.7-flash</code> | $0.0047 | 96.33 | 3.67% | 0.34% | 1.98s | $0.0047 |
| 12 | <code>gemini/gemini-3.8-flash</code> | $0.0048 | 96.33 | 3.67% | 0.34% | 2.26s | $0.0048 |
| 13 | <code>grok/grok-4.5</code> | $0.0049 | 95.87 | 4.13% | 0.42% | 15.98s | $0.0049 |
| 14 | <code>grok/grok-4.6</code> | $0.0052 | 96.33 | 3.67% | 0.34% | 32.45s | $0.0052 |
| 15 | <code>gemini/gemini-3.5-flash</code> | $0.0054 | 96.33 | 3.67% | 0.34% | 2.83s | $0.0054 |
| 16 | <code>anthropic/claude-sonnet-5</code> | $0.0096 | 96.33 | 3.67% | 0.34% | 11.74s | $0.0096 |
| 17 | <code>openai/gpt-5.6-terra</code> | $0.0184 | 93.12 | 6.88% | 1.77% | 11.82s | $0.0184 |
| 18 | <code>anthropic/claude-opus-5</code> | $0.0225 | 99.54 | 0.46% | 0.08% | 12.39s | $0.0225 |
| 19 | <code>openai/gpt-6-astra</code> | $0.0350 | 96.33 | 3.67% | 0.34% | 6.69s | $0.0350 |
| 20 | <code>openai/gpt-5.6-sol</code> | $0.0470 | 96.33 | 3.67% | 0.34% | 14.48s | $0.0470 |
| 21 | <code>anthropic/claude-fable-5-1</code> | $0.0476 | 96.33 | 3.67% | 0.34% | 12.54s | $0.0476 |
| 22 | <code>anthropic/claude-fable-5</code> | $0.0485 | 96.33 | 3.67% | 0.34% | 12.47s | $0.0485 |
| 23 | <code>kimi/kimi-k3</code> | $0.0518 | 95.87 | 4.13% | 0.42% | 92.00s | $0.0518 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-1</code> | 1.08s | 95.87 | 4.13% | 0.42% | 1.08s | $0.0040 |
| 2 | <code>mistral/mistral-ocr-4-0</code> | 1.44s | 98.17 | 1.83% | 0.34% | 1.44s | $0.0040 |
| 3 | <code>gemini/gemini-3.7-flash</code> | 1.98s | 96.33 | 3.67% | 0.34% | 1.98s | $0.0047 |
| 4 | <code>gemini/gemini-3.5-flash-lite</code> | 2.08s | 96.33 | 3.67% | 0.34% | 2.08s | $0.0014 |
| 5 | <code>gemini/gemini-3.8-flash</code> | 2.26s | 96.33 | 3.67% | 0.34% | 2.26s | $0.0048 |
| 6 | <code>gemini/gemini-3.6-flash</code> | 2.40s | 100.00 | 0.00% | 0.00% | 2.40s | $0.0045 |
| 7 | <code>gemini/gemini-3.5-flash</code> | 2.83s | 96.33 | 3.67% | 0.34% | 2.83s | $0.0054 |
| 8 | <code>openai/gpt-5.6-luna</code> | 4.98s | 94.50 | 5.50% | 1.09% | 4.98s | $0.0013 |
| 9 | <code>openai/gpt-6-astra</code> | 6.69s | 96.33 | 3.67% | 0.34% | 6.69s | $0.0350 |
| 10 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 6.80s | 90.37 | 9.63% | 1.77% | 6.80s | $0.0011 |
| 11 | <code>kimi/kimi-k2.6</code> | 11.49s | 95.41 | 4.59% | 0.42% | 11.49s | $0.0029 |
| 12 | <code>anthropic/claude-sonnet-5</code> | 11.74s | 96.33 | 3.67% | 0.34% | 11.74s | $0.0096 |
| 13 | <code>openai/gpt-5.6-terra</code> | 11.82s | 93.12 | 6.88% | 1.77% | 11.82s | $0.0184 |
| 14 | <code>anthropic/claude-opus-5</code> | 12.39s | 99.54 | 0.46% | 0.08% | 12.39s | $0.0225 |
| 15 | <code>anthropic/claude-fable-5</code> | 12.47s | 96.33 | 3.67% | 0.34% | 12.47s | $0.0485 |
| 16 | <code>anthropic/claude-fable-5-1</code> | 12.54s | 96.33 | 3.67% | 0.34% | 12.54s | $0.0476 |
| 17 | <code>openai/gpt-5.6-sol</code> | 14.48s | 96.33 | 3.67% | 0.34% | 14.48s | $0.0470 |
| 18 | <code>deepinfra/google/gemma-4-31B-it</code> | 14.55s | 95.41 | 4.59% | 0.50% | 14.55s | $0.0002 |
| 19 | <code>grok/grok-4.5</code> | 15.98s | 95.87 | 4.13% | 0.42% | 15.98s | $0.0049 |
| 20 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 23.98s | 95.87 | 4.13% | 0.42% | 23.98s | $0.0004 |
| 21 | <code>grok/grok-4.6</code> | 32.45s | 96.33 | 3.67% | 0.34% | 32.45s | $0.0052 |
| 22 | <code>glm/glm-5.3-flash</code> | 67.32s | 98.62 | 1.38% | 0.25% | 67.32s | $0.0016 |
| 23 | <code>kimi/kimi-k3</code> | 92.00s | 95.87 | 4.13% | 0.42% | 92.00s | $0.0518 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.40s | $0.0045 |
| 2 | <code>anthropic/claude-opus-5</code> | 99.54/100 quality score | 99.54 | 0.46% | 0.08% | 12.39s | $0.0225 |
| 3 | <code>glm/glm-5.3-flash</code> | 98.62/100 quality score | 98.62 | 1.38% | 0.25% | 67.32s | $0.0016 |
| 4 | <code>mistral/mistral-ocr-4-0</code> | 98.17/100 quality score | 98.17 | 1.83% | 0.34% | 1.44s | $0.0040 |
| 5 | <code>anthropic/claude-fable-5</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 12.47s | $0.0485 |
| 6 | <code>anthropic/claude-fable-5-1</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 12.54s | $0.0476 |
| 7 | <code>anthropic/claude-sonnet-5</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 11.74s | $0.0096 |
| 8 | <code>gemini/gemini-3.5-flash</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 2.83s | $0.0054 |
| 9 | <code>gemini/gemini-3.5-flash-lite</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 2.08s | $0.0014 |
| 10 | <code>gemini/gemini-3.7-flash</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 1.98s | $0.0047 |
| 11 | <code>gemini/gemini-3.8-flash</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 2.26s | $0.0048 |
| 12 | <code>grok/grok-4.6</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 32.45s | $0.0052 |
| 13 | <code>openai/gpt-5.6-sol</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 14.48s | $0.0470 |
| 14 | <code>openai/gpt-6-astra</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 6.69s | $0.0350 |
| 15 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 95.87/100 quality score | 95.87 | 4.13% | 0.42% | 23.98s | $0.0004 |
| 16 | <code>grok/grok-4.5</code> | 95.87/100 quality score | 95.87 | 4.13% | 0.42% | 15.98s | $0.0049 |
| 17 | <code>kimi/kimi-k3</code> | 95.87/100 quality score | 95.87 | 4.13% | 0.42% | 92.00s | $0.0518 |
| 18 | <code>mistral/mistral-ocr-4-1</code> | 95.87/100 quality score | 95.87 | 4.13% | 0.42% | 1.08s | $0.0040 |
| 19 | <code>kimi/kimi-k2.6</code> | 95.41/100 quality score | 95.41 | 4.59% | 0.42% | 11.49s | $0.0029 |
| 20 | <code>deepinfra/google/gemma-4-31B-it</code> | 95.41/100 quality score | 95.41 | 4.59% | 0.50% | 14.55s | $0.0002 |
| 21 | <code>openai/gpt-5.6-luna</code> | 94.50/100 quality score | 94.50 | 5.50% | 1.09% | 4.98s | $0.0013 |
| 22 | <code>openai/gpt-5.6-terra</code> | 93.12/100 quality score | 93.12 | 6.88% | 1.77% | 11.82s | $0.0184 |
| 23 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 90.37/100 quality score | 90.37 | 9.63% | 1.77% | 6.80s | $0.0011 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 12.47s | $0.0485 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 12.54s | $0.0476 |
| <code>anthropic/claude-opus-5</code> | Third-Party Service | 99.54 | 0.46% | 0.08% | 12.39s | $0.0225 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 11.74s | $0.0096 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 95.87 | 4.13% | 0.42% | 23.98s | $0.0004 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 95.41 | 4.59% | 0.50% | 14.55s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 90.37 | 9.63% | 1.77% | 6.80s | $0.0011 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 2.83s | $0.0054 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 2.08s | $0.0014 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.40s | $0.0045 |
| <code>gemini/gemini-3.7-flash</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 1.98s | $0.0047 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 2.26s | $0.0048 |
| <code>glm/glm-5.3-flash</code> | Third-Party Service | 98.62 | 1.38% | 0.25% | 67.32s | $0.0016 |
| <code>grok/grok-4.5</code> | Third-Party Service | 95.87 | 4.13% | 0.42% | 15.98s | $0.0049 |
| <code>grok/grok-4.6</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 32.45s | $0.0052 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 95.41 | 4.59% | 0.42% | 11.49s | $0.0029 |
| <code>kimi/kimi-k3</code> | Third-Party Service | 95.87 | 4.13% | 0.42% | 92.00s | $0.0518 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 98.17 | 1.83% | 0.34% | 1.44s | $0.0040 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 95.87 | 4.13% | 0.42% | 1.08s | $0.0040 |
| <code>openai/gpt-5.6-luna</code> | Third-Party Service | 94.50 | 5.50% | 1.09% | 4.98s | $0.0013 |
| <code>openai/gpt-5.6-sol</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 14.48s | $0.0470 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 93.12 | 6.88% | 1.77% | 11.82s | $0.0184 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 6.69s | $0.0350 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | 4 | 0 | 4 | 218 |
| <code>anthropic/claude-fable-5-1</code> | 4 | 0 | 4 | 218 |
| <code>anthropic/claude-opus-5</code> | 1 | 0 | 0 | 218 |
| <code>anthropic/claude-sonnet-5</code> | 4 | 0 | 4 | 218 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 5 | 0 | 4 | 218 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 6 | 0 | 4 | 218 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 13 | 0 | 8 | 218 |
| <code>gemini/gemini-3.5-flash</code> | 4 | 0 | 4 | 218 |
| <code>gemini/gemini-3.5-flash-lite</code> | 4 | 0 | 4 | 218 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 218 |
| <code>gemini/gemini-3.7-flash</code> | 4 | 0 | 4 | 218 |
| <code>gemini/gemini-3.8-flash</code> | 4 | 0 | 4 | 218 |
| <code>glm/glm-5.3-flash</code> | 3 | 0 | 0 | 218 |
| <code>grok/grok-4.5</code> | 5 | 0 | 4 | 218 |
| <code>grok/grok-4.6</code> | 4 | 0 | 4 | 218 |
| <code>kimi/kimi-k2.6</code> | 5 | 1 | 4 | 218 |
| <code>kimi/kimi-k3</code> | 5 | 0 | 4 | 218 |
| <code>mistral/mistral-ocr-4-0</code> | 4 | 0 | 0 | 218 |
| <code>mistral/mistral-ocr-4-1</code> | 4 | 0 | 5 | 218 |
| <code>openai/gpt-5.6-luna</code> | 7 | 0 | 5 | 218 |
| <code>openai/gpt-5.6-sol</code> | 4 | 0 | 4 | 218 |
| <code>openai/gpt-5.6-terra</code> | 9 | 2 | 4 | 218 |
| <code>openai/gpt-6-astra</code> | 4 | 0 | 4 | 218 |

## Notes

- Best cloud service: `gemini/gemini-3.6-flash` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0183¢ ($0.0002).
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.08s.
