# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/ocr/04-pages-don-quixote`
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
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0008 | 98.65 | 1.35% | 0.65% | 45.11s | $0.0008 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0019 | 99.25 | 0.75% | 0.25% | 37.46s | $0.0019 |
| 3 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0055 | 97.76 | 2.24% | 0.93% | 8.13s | $0.0055 |
| 4 | <code>glm/glm-5.3-flash</code> | $0.0060 | 99.63 | 0.37% | 0.40% | 19.54s | $0.0060 |
| 5 | <code>openai/gpt-5.6-luna</code> | $0.0079 | 99.63 | 0.37% | 0.25% | 20.06s | $0.0079 |
| 6 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0108 | 98.88 | 1.12% | 0.30% | 15.92s | $0.0108 |
| 7 | <code>mistral/mistral-ocr-4-0</code> | $0.0160 | 99.70 | 0.30% | 0.21% | 6.15s | $0.0160 |
| 8 | <code>mistral/mistral-ocr-4-1</code> | $0.0160 | 99.85 | 0.15% | 0.19% | 6.67s | $0.0160 |
| 9 | <code>gemini/gemini-3.6-flash</code> | $0.0164 | 99.33 | 0.67% | 0.65% | 12.19s | $0.0164 |
| 10 | <code>gemini/gemini-3.7-flash</code> | $0.0167 | 99.85 | 0.15% | 0.19% | 7.84s | $0.0167 |
| 11 | <code>gemini/gemini-3.8-flash</code> | $0.0167 | 99.85 | 0.15% | 0.19% | 10.99s | $0.0167 |
| 12 | <code>gemini/gemini-3.5-flash</code> | $0.0193 | 99.85 | 0.15% | 0.10% | 12.94s | $0.0193 |
| 13 | <code>kimi/kimi-k2.6</code> | $0.0231 | 99.33 | 0.67% | 0.24% | 21.42s | $0.0231 |
| 14 | <code>grok/grok-4.5</code> | $0.0340 | 98.20 | 1.80% | 0.53% | 22.70s | $0.0340 |
| 15 | <code>grok/grok-4.6</code> | $0.0352 | 98.28 | 1.72% | 0.34% | 48.26s | $0.0352 |
| 16 | <code>anthropic/claude-sonnet-5</code> | $0.0374 | 99.78 | 0.22% | 0.19% | 34.76s | $0.0374 |
| 17 | <code>openai/gpt-5.6-terra</code> | $0.0625 | 98.28 | 1.72% | 0.34% | 12.03s | $0.0625 |
| 18 | <code>anthropic/claude-opus-5</code> | $0.0935 | 99.78 | 0.22% | 0.19% | 41.74s | $0.0935 |
| 19 | <code>openai/gpt-5.6-sol</code> | $0.1555 | 99.70 | 0.30% | 0.38% | 18.83s | $0.1555 |
| 20 | <code>anthropic/claude-fable-5</code> | $0.1871 | 99.78 | 0.22% | 0.19% | 37.14s | $0.1871 |
| 21 | <code>anthropic/claude-fable-5-1</code> | $0.2010 | 98.35 | 1.65% | 0.34% | 40.07s | $0.2010 |
| 22 | <code>openai/gpt-6-astra</code> | $0.2927 | 98.35 | 1.65% | 0.34% | 24.33s | $0.2927 |
| 23 | <code>kimi/kimi-k3</code> | $0.4044 | 99.33 | 0.67% | 0.25% | 484.71s | $0.4044 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-0</code> | 6.15s | 99.70 | 0.30% | 0.21% | 6.15s | $0.0160 |
| 2 | <code>mistral/mistral-ocr-4-1</code> | 6.67s | 99.85 | 0.15% | 0.19% | 6.67s | $0.0160 |
| 3 | <code>gemini/gemini-3.7-flash</code> | 7.84s | 99.85 | 0.15% | 0.19% | 7.84s | $0.0167 |
| 4 | <code>gemini/gemini-3.5-flash-lite</code> | 8.13s | 97.76 | 2.24% | 0.93% | 8.13s | $0.0055 |
| 5 | <code>gemini/gemini-3.8-flash</code> | 10.99s | 99.85 | 0.15% | 0.19% | 10.99s | $0.0167 |
| 6 | <code>openai/gpt-5.6-terra</code> | 12.03s | 98.28 | 1.72% | 0.34% | 12.03s | $0.0625 |
| 7 | <code>gemini/gemini-3.6-flash</code> | 12.19s | 99.33 | 0.67% | 0.65% | 12.19s | $0.0164 |
| 8 | <code>gemini/gemini-3.5-flash</code> | 12.94s | 99.85 | 0.15% | 0.10% | 12.94s | $0.0193 |
| 9 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 15.92s | 98.88 | 1.12% | 0.30% | 15.92s | $0.0108 |
| 10 | <code>openai/gpt-5.6-sol</code> | 18.83s | 99.70 | 0.30% | 0.38% | 18.83s | $0.1555 |
| 11 | <code>glm/glm-5.3-flash</code> | 19.54s | 99.63 | 0.37% | 0.40% | 19.54s | $0.0060 |
| 12 | <code>openai/gpt-5.6-luna</code> | 20.06s | 99.63 | 0.37% | 0.25% | 20.06s | $0.0079 |
| 13 | <code>kimi/kimi-k2.6</code> | 21.42s | 99.33 | 0.67% | 0.24% | 21.42s | $0.0231 |
| 14 | <code>grok/grok-4.5</code> | 22.70s | 98.20 | 1.80% | 0.53% | 22.70s | $0.0340 |
| 15 | <code>openai/gpt-6-astra</code> | 24.33s | 98.35 | 1.65% | 0.34% | 24.33s | $0.2927 |
| 16 | <code>anthropic/claude-sonnet-5</code> | 34.76s | 99.78 | 0.22% | 0.19% | 34.76s | $0.0374 |
| 17 | <code>anthropic/claude-fable-5</code> | 37.14s | 99.78 | 0.22% | 0.19% | 37.14s | $0.1871 |
| 18 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 37.46s | 99.25 | 0.75% | 0.25% | 37.46s | $0.0019 |
| 19 | <code>anthropic/claude-fable-5-1</code> | 40.07s | 98.35 | 1.65% | 0.34% | 40.07s | $0.2010 |
| 20 | <code>anthropic/claude-opus-5</code> | 41.74s | 99.78 | 0.22% | 0.19% | 41.74s | $0.0935 |
| 21 | <code>deepinfra/google/gemma-4-31B-it</code> | 45.11s | 98.65 | 1.35% | 0.65% | 45.11s | $0.0008 |
| 22 | <code>grok/grok-4.6</code> | 48.26s | 98.28 | 1.72% | 0.34% | 48.26s | $0.0352 |
| 23 | <code>kimi/kimi-k3</code> | 484.71s | 99.33 | 0.67% | 0.25% | 484.71s | $0.4044 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash</code> | 99.85/100 quality score | 99.85 | 0.15% | 0.10% | 12.94s | $0.0193 |
| 2 | <code>gemini/gemini-3.7-flash</code> | 99.85/100 quality score | 99.85 | 0.15% | 0.19% | 7.84s | $0.0167 |
| 3 | <code>gemini/gemini-3.8-flash</code> | 99.85/100 quality score | 99.85 | 0.15% | 0.19% | 10.99s | $0.0167 |
| 4 | <code>mistral/mistral-ocr-4-1</code> | 99.85/100 quality score | 99.85 | 0.15% | 0.19% | 6.67s | $0.0160 |
| 5 | <code>anthropic/claude-fable-5</code> | 99.78/100 quality score | 99.78 | 0.22% | 0.19% | 37.14s | $0.1871 |
| 6 | <code>anthropic/claude-opus-5</code> | 99.78/100 quality score | 99.78 | 0.22% | 0.19% | 41.74s | $0.0935 |
| 7 | <code>anthropic/claude-sonnet-5</code> | 99.78/100 quality score | 99.78 | 0.22% | 0.19% | 34.76s | $0.0374 |
| 8 | <code>mistral/mistral-ocr-4-0</code> | 99.70/100 quality score | 99.70 | 0.30% | 0.21% | 6.15s | $0.0160 |
| 9 | <code>openai/gpt-5.6-sol</code> | 99.70/100 quality score | 99.70 | 0.30% | 0.38% | 18.83s | $0.1555 |
| 10 | <code>openai/gpt-5.6-luna</code> | 99.63/100 quality score | 99.63 | 0.37% | 0.25% | 20.06s | $0.0079 |
| 11 | <code>glm/glm-5.3-flash</code> | 99.63/100 quality score | 99.63 | 0.37% | 0.40% | 19.54s | $0.0060 |
| 12 | <code>kimi/kimi-k2.6</code> | 99.33/100 quality score | 99.33 | 0.67% | 0.24% | 21.42s | $0.0231 |
| 13 | <code>kimi/kimi-k3</code> | 99.33/100 quality score | 99.33 | 0.67% | 0.25% | 484.71s | $0.4044 |
| 14 | <code>gemini/gemini-3.6-flash</code> | 99.33/100 quality score | 99.33 | 0.67% | 0.65% | 12.19s | $0.0164 |
| 15 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 99.25/100 quality score | 99.25 | 0.75% | 0.25% | 37.46s | $0.0019 |
| 16 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 98.88/100 quality score | 98.88 | 1.12% | 0.30% | 15.92s | $0.0108 |
| 17 | <code>deepinfra/google/gemma-4-31B-it</code> | 98.65/100 quality score | 98.65 | 1.35% | 0.65% | 45.11s | $0.0008 |
| 18 | <code>anthropic/claude-fable-5-1</code> | 98.35/100 quality score | 98.35 | 1.65% | 0.34% | 40.07s | $0.2010 |
| 19 | <code>openai/gpt-6-astra</code> | 98.35/100 quality score | 98.35 | 1.65% | 0.34% | 24.33s | $0.2927 |
| 20 | <code>grok/grok-4.6</code> | 98.28/100 quality score | 98.28 | 1.72% | 0.34% | 48.26s | $0.0352 |
| 21 | <code>openai/gpt-5.6-terra</code> | 98.28/100 quality score | 98.28 | 1.72% | 0.34% | 12.03s | $0.0625 |
| 22 | <code>grok/grok-4.5</code> | 98.20/100 quality score | 98.20 | 1.80% | 0.53% | 22.70s | $0.0340 |
| 23 | <code>gemini/gemini-3.5-flash-lite</code> | 97.76/100 quality score | 97.76 | 2.24% | 0.93% | 8.13s | $0.0055 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 99.78 | 0.22% | 0.19% | 37.14s | $0.1871 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 98.35 | 1.65% | 0.34% | 40.07s | $0.2010 |
| <code>anthropic/claude-opus-5</code> | Third-Party Service | 99.78 | 0.22% | 0.19% | 41.74s | $0.0935 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 99.78 | 0.22% | 0.19% | 34.76s | $0.0374 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 99.25 | 0.75% | 0.25% | 37.46s | $0.0019 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 98.65 | 1.35% | 0.65% | 45.11s | $0.0008 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 98.88 | 1.12% | 0.30% | 15.92s | $0.0108 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 99.85 | 0.15% | 0.10% | 12.94s | $0.0193 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 97.76 | 2.24% | 0.93% | 8.13s | $0.0055 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 99.33 | 0.67% | 0.65% | 12.19s | $0.0164 |
| <code>gemini/gemini-3.7-flash</code> | Third-Party Service | 99.85 | 0.15% | 0.19% | 7.84s | $0.0167 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 99.85 | 0.15% | 0.19% | 10.99s | $0.0167 |
| <code>glm/glm-5.3-flash</code> | Third-Party Service | 99.63 | 0.37% | 0.40% | 19.54s | $0.0060 |
| <code>grok/grok-4.5</code> | Third-Party Service | 98.20 | 1.80% | 0.53% | 22.70s | $0.0340 |
| <code>grok/grok-4.6</code> | Third-Party Service | 98.28 | 1.72% | 0.34% | 48.26s | $0.0352 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 99.33 | 0.67% | 0.24% | 21.42s | $0.0231 |
| <code>kimi/kimi-k3</code> | Third-Party Service | 99.33 | 0.67% | 0.25% | 484.71s | $0.4044 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 99.70 | 0.30% | 0.21% | 6.15s | $0.0160 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 99.85 | 0.15% | 0.19% | 6.67s | $0.0160 |
| <code>openai/gpt-5.6-luna</code> | Third-Party Service | 99.63 | 0.37% | 0.25% | 20.06s | $0.0079 |
| <code>openai/gpt-5.6-sol</code> | Third-Party Service | 99.70 | 0.30% | 0.38% | 18.83s | $0.1555 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 98.28 | 1.72% | 0.34% | 12.03s | $0.0625 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 98.35 | 1.65% | 0.34% | 24.33s | $0.2927 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | 2 | 1 | 0 | 1337 |
| <code>anthropic/claude-fable-5-1</code> | 10 | 2 | 10 | 1337 |
| <code>anthropic/claude-opus-5</code> | 2 | 1 | 0 | 1337 |
| <code>anthropic/claude-sonnet-5</code> | 2 | 1 | 0 | 1337 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 4 | 2 | 4 | 1337 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 8 | 2 | 8 | 1337 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 8 | 0 | 7 | 1337 |
| <code>gemini/gemini-3.5-flash</code> | 2 | 0 | 0 | 1337 |
| <code>gemini/gemini-3.5-flash-lite</code> | 10 | 11 | 9 | 1337 |
| <code>gemini/gemini-3.6-flash</code> | 1 | 8 | 0 | 1337 |
| <code>gemini/gemini-3.7-flash</code> | 0 | 2 | 0 | 1337 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 2 | 0 | 1337 |
| <code>glm/glm-5.3-flash</code> | 2 | 3 | 0 | 1337 |
| <code>grok/grok-4.5</code> | 10 | 4 | 10 | 1337 |
| <code>grok/grok-4.6</code> | 11 | 2 | 10 | 1337 |
| <code>kimi/kimi-k2.6</code> | 5 | 1 | 3 | 1337 |
| <code>kimi/kimi-k3</code> | 4 | 2 | 3 | 1337 |
| <code>mistral/mistral-ocr-4-0</code> | 1 | 2 | 1 | 1337 |
| <code>mistral/mistral-ocr-4-1</code> | 0 | 2 | 0 | 1337 |
| <code>openai/gpt-5.6-luna</code> | 1 | 3 | 1 | 1337 |
| <code>openai/gpt-5.6-sol</code> | 0 | 4 | 0 | 1337 |
| <code>openai/gpt-5.6-terra</code> | 11 | 2 | 10 | 1337 |
| <code>openai/gpt-6-astra</code> | 10 | 2 | 10 | 1337 |

## Notes

- Best cloud service: `gemini/gemini-3.5-flash` scored 99.85/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0835¢ ($0.0008).
- Fastest cloud service: `mistral/mistral-ocr-4-0` at 6.15s.
