# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/ocr/01-handwriting`
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
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0003 | 85.22 | 14.78% | 5.55% | 13.55s | $0.0003 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0003 | 71.43 | 28.57% | 10.57% | 21.42s | $0.0003 |
| 3 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0016 | 67.98 | 32.02% | 11.96% | 9.45s | $0.0016 |
| 4 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0022 | 92.12 | 7.88% | 2.43% | 2.20s | $0.0022 |
| 5 | <code>kimi/kimi-k2.6</code> | $0.0024 | 83.74 | 16.26% | 5.55% | 9.62s | $0.0024 |
| 6 | <code>openai/gpt-5.6-luna</code> | $0.0026 | 71.92 | 28.08% | 13.17% | 9.28s | $0.0026 |
| 7 | <code>glm/glm-5.3-flash</code> | $0.0026 | 83.74 | 16.26% | 6.93% | 101.48s | $0.0026 |
| 8 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 92.12 | 7.88% | 4.16% | 1.66s | $0.0040 |
| 9 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 90.15 | 9.85% | 3.29% | 1.40s | $0.0040 |
| 10 | <code>grok/grok-4.6</code> | $0.0050 | 83.25 | 16.75% | 5.72% | 28.06s | $0.0050 |
| 11 | <code>grok/grok-4.5</code> | $0.0052 | 86.70 | 13.30% | 5.72% | 18.00s | $0.0052 |
| 12 | <code>gemini/gemini-3.6-flash</code> | $0.0069 | 88.67 | 11.33% | 3.12% | 3.72s | $0.0069 |
| 13 | <code>gemini/gemini-3.7-flash</code> | $0.0077 | 77.34 | 22.66% | 9.88% | 3.51s | $0.0077 |
| 14 | <code>gemini/gemini-3.8-flash</code> | $0.0078 | 81.77 | 18.23% | 4.33% | 2.84s | $0.0078 |
| 15 | <code>anthropic/claude-sonnet-5</code> | $0.0085 | 83.25 | 16.75% | 6.07% | 7.84s | $0.0085 |
| 16 | <code>gemini/gemini-3.5-flash</code> | $0.0089 | 88.18 | 11.82% | 3.47% | 3.10s | $0.0089 |
| 17 | <code>kimi/kimi-k3</code> | $0.0112 | 82.76 | 17.24% | 6.41% | 340.60s | $0.0112 |
| 18 | <code>openai/gpt-5.6-terra</code> | $0.0135 | 78.33 | 21.67% | 9.36% | 7.11s | $0.0135 |
| 19 | <code>anthropic/claude-opus-5</code> | $0.0214 | 85.22 | 14.78% | 6.41% | 10.81s | $0.0214 |
| 20 | <code>anthropic/claude-fable-5-1</code> | $0.0422 | 85.71 | 14.29% | 3.29% | 8.16s | $0.0422 |
| 21 | <code>anthropic/claude-fable-5</code> | $0.0422 | 89.66 | 10.34% | 2.43% | 9.87s | $0.0422 |
| 22 | <code>openai/gpt-6-astra</code> | $0.1056 | 83.74 | 16.26% | 5.03% | 23.93s | $0.1056 |
| 23 | <code>openai/gpt-5.6-sol</code> | $0.1085 | 67.98 | 32.02% | 10.75% | 30.01s | $0.1085 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-1</code> | 1.40s | 90.15 | 9.85% | 3.29% | 1.40s | $0.0040 |
| 2 | <code>mistral/mistral-ocr-4-0</code> | 1.66s | 92.12 | 7.88% | 4.16% | 1.66s | $0.0040 |
| 3 | <code>gemini/gemini-3.5-flash-lite</code> | 2.20s | 92.12 | 7.88% | 2.43% | 2.20s | $0.0022 |
| 4 | <code>gemini/gemini-3.8-flash</code> | 2.84s | 81.77 | 18.23% | 4.33% | 2.84s | $0.0078 |
| 5 | <code>gemini/gemini-3.5-flash</code> | 3.10s | 88.18 | 11.82% | 3.47% | 3.10s | $0.0089 |
| 6 | <code>gemini/gemini-3.7-flash</code> | 3.51s | 77.34 | 22.66% | 9.88% | 3.51s | $0.0077 |
| 7 | <code>gemini/gemini-3.6-flash</code> | 3.72s | 88.67 | 11.33% | 3.12% | 3.72s | $0.0069 |
| 8 | <code>openai/gpt-5.6-terra</code> | 7.11s | 78.33 | 21.67% | 9.36% | 7.11s | $0.0135 |
| 9 | <code>anthropic/claude-sonnet-5</code> | 7.84s | 83.25 | 16.75% | 6.07% | 7.84s | $0.0085 |
| 10 | <code>anthropic/claude-fable-5-1</code> | 8.16s | 85.71 | 14.29% | 3.29% | 8.16s | $0.0422 |
| 11 | <code>openai/gpt-5.6-luna</code> | 9.28s | 71.92 | 28.08% | 13.17% | 9.28s | $0.0026 |
| 12 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 9.45s | 67.98 | 32.02% | 11.96% | 9.45s | $0.0016 |
| 13 | <code>kimi/kimi-k2.6</code> | 9.62s | 83.74 | 16.26% | 5.55% | 9.62s | $0.0024 |
| 14 | <code>anthropic/claude-fable-5</code> | 9.87s | 89.66 | 10.34% | 2.43% | 9.87s | $0.0422 |
| 15 | <code>anthropic/claude-opus-5</code> | 10.81s | 85.22 | 14.78% | 6.41% | 10.81s | $0.0214 |
| 16 | <code>deepinfra/google/gemma-4-31B-it</code> | 13.55s | 85.22 | 14.78% | 5.55% | 13.55s | $0.0003 |
| 17 | <code>grok/grok-4.5</code> | 18.00s | 86.70 | 13.30% | 5.72% | 18.00s | $0.0052 |
| 18 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 21.42s | 71.43 | 28.57% | 10.57% | 21.42s | $0.0003 |
| 19 | <code>openai/gpt-6-astra</code> | 23.93s | 83.74 | 16.26% | 5.03% | 23.93s | $0.1056 |
| 20 | <code>grok/grok-4.6</code> | 28.06s | 83.25 | 16.75% | 5.72% | 28.06s | $0.0050 |
| 21 | <code>openai/gpt-5.6-sol</code> | 30.01s | 67.98 | 32.02% | 10.75% | 30.01s | $0.1085 |
| 22 | <code>glm/glm-5.3-flash</code> | 101.48s | 83.74 | 16.26% | 6.93% | 101.48s | $0.0026 |
| 23 | <code>kimi/kimi-k3</code> | 340.60s | 82.76 | 17.24% | 6.41% | 340.60s | $0.0112 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 92.12/100 quality score | 92.12 | 7.88% | 2.43% | 2.20s | $0.0022 |
| 2 | <code>mistral/mistral-ocr-4-0</code> | 92.12/100 quality score | 92.12 | 7.88% | 4.16% | 1.66s | $0.0040 |
| 3 | <code>mistral/mistral-ocr-4-1</code> | 90.15/100 quality score | 90.15 | 9.85% | 3.29% | 1.40s | $0.0040 |
| 4 | <code>anthropic/claude-fable-5</code> | 89.66/100 quality score | 89.66 | 10.34% | 2.43% | 9.87s | $0.0422 |
| 5 | <code>gemini/gemini-3.6-flash</code> | 88.67/100 quality score | 88.67 | 11.33% | 3.12% | 3.72s | $0.0069 |
| 6 | <code>gemini/gemini-3.5-flash</code> | 88.18/100 quality score | 88.18 | 11.82% | 3.47% | 3.10s | $0.0089 |
| 7 | <code>grok/grok-4.5</code> | 86.70/100 quality score | 86.70 | 13.30% | 5.72% | 18.00s | $0.0052 |
| 8 | <code>anthropic/claude-fable-5-1</code> | 85.71/100 quality score | 85.71 | 14.29% | 3.29% | 8.16s | $0.0422 |
| 9 | <code>deepinfra/google/gemma-4-31B-it</code> | 85.22/100 quality score | 85.22 | 14.78% | 5.55% | 13.55s | $0.0003 |
| 10 | <code>anthropic/claude-opus-5</code> | 85.22/100 quality score | 85.22 | 14.78% | 6.41% | 10.81s | $0.0214 |
| 11 | <code>openai/gpt-6-astra</code> | 83.74/100 quality score | 83.74 | 16.26% | 5.03% | 23.93s | $0.1056 |
| 12 | <code>kimi/kimi-k2.6</code> | 83.74/100 quality score | 83.74 | 16.26% | 5.55% | 9.62s | $0.0024 |
| 13 | <code>glm/glm-5.3-flash</code> | 83.74/100 quality score | 83.74 | 16.26% | 6.93% | 101.48s | $0.0026 |
| 14 | <code>grok/grok-4.6</code> | 83.25/100 quality score | 83.25 | 16.75% | 5.72% | 28.06s | $0.0050 |
| 15 | <code>anthropic/claude-sonnet-5</code> | 83.25/100 quality score | 83.25 | 16.75% | 6.07% | 7.84s | $0.0085 |
| 16 | <code>kimi/kimi-k3</code> | 82.76/100 quality score | 82.76 | 17.24% | 6.41% | 340.60s | $0.0112 |
| 17 | <code>gemini/gemini-3.8-flash</code> | 81.77/100 quality score | 81.77 | 18.23% | 4.33% | 2.84s | $0.0078 |
| 18 | <code>openai/gpt-5.6-terra</code> | 78.33/100 quality score | 78.33 | 21.67% | 9.36% | 7.11s | $0.0135 |
| 19 | <code>gemini/gemini-3.7-flash</code> | 77.34/100 quality score | 77.34 | 22.66% | 9.88% | 3.51s | $0.0077 |
| 20 | <code>openai/gpt-5.6-luna</code> | 71.92/100 quality score | 71.92 | 28.08% | 13.17% | 9.28s | $0.0026 |
| 21 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 71.43/100 quality score | 71.43 | 28.57% | 10.57% | 21.42s | $0.0003 |
| 22 | <code>openai/gpt-5.6-sol</code> | 67.98/100 quality score | 67.98 | 32.02% | 10.75% | 30.01s | $0.1085 |
| 23 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 67.98/100 quality score | 67.98 | 32.02% | 11.96% | 9.45s | $0.0016 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 89.66 | 10.34% | 2.43% | 9.87s | $0.0422 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 85.71 | 14.29% | 3.29% | 8.16s | $0.0422 |
| <code>anthropic/claude-opus-5</code> | Third-Party Service | 85.22 | 14.78% | 6.41% | 10.81s | $0.0214 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 83.25 | 16.75% | 6.07% | 7.84s | $0.0085 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 71.43 | 28.57% | 10.57% | 21.42s | $0.0003 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 85.22 | 14.78% | 5.55% | 13.55s | $0.0003 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 67.98 | 32.02% | 11.96% | 9.45s | $0.0016 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 88.18 | 11.82% | 3.47% | 3.10s | $0.0089 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 92.12 | 7.88% | 2.43% | 2.20s | $0.0022 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 88.67 | 11.33% | 3.12% | 3.72s | $0.0069 |
| <code>gemini/gemini-3.7-flash</code> | Third-Party Service | 77.34 | 22.66% | 9.88% | 3.51s | $0.0077 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 81.77 | 18.23% | 4.33% | 2.84s | $0.0078 |
| <code>glm/glm-5.3-flash</code> | Third-Party Service | 83.74 | 16.26% | 6.93% | 101.48s | $0.0026 |
| <code>grok/grok-4.5</code> | Third-Party Service | 86.70 | 13.30% | 5.72% | 18.00s | $0.0052 |
| <code>grok/grok-4.6</code> | Third-Party Service | 83.25 | 16.75% | 5.72% | 28.06s | $0.0050 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 83.74 | 16.26% | 5.55% | 9.62s | $0.0024 |
| <code>kimi/kimi-k3</code> | Third-Party Service | 82.76 | 17.24% | 6.41% | 340.60s | $0.0112 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 92.12 | 7.88% | 4.16% | 1.66s | $0.0040 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 90.15 | 9.85% | 3.29% | 1.40s | $0.0040 |
| <code>openai/gpt-5.6-luna</code> | Third-Party Service | 71.92 | 28.08% | 13.17% | 9.28s | $0.0026 |
| <code>openai/gpt-5.6-sol</code> | Third-Party Service | 67.98 | 32.02% | 10.75% | 30.01s | $0.1085 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 78.33 | 21.67% | 9.36% | 7.11s | $0.0135 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 83.74 | 16.26% | 5.03% | 23.93s | $0.1056 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | 13 | 6 | 2 | 203 |
| <code>anthropic/claude-fable-5-1</code> | 18 | 1 | 10 | 203 |
| <code>anthropic/claude-opus-5</code> | 19 | 7 | 4 | 203 |
| <code>anthropic/claude-sonnet-5</code> | 24 | 8 | 2 | 203 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 43 | 1 | 14 | 203 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 24 | 4 | 2 | 203 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 54 | 1 | 10 | 203 |
| <code>gemini/gemini-3.5-flash</code> | 16 | 0 | 8 | 203 |
| <code>gemini/gemini-3.5-flash-lite</code> | 12 | 0 | 4 | 203 |
| <code>gemini/gemini-3.6-flash</code> | 16 | 1 | 6 | 203 |
| <code>gemini/gemini-3.7-flash</code> | 28 | 4 | 14 | 203 |
| <code>gemini/gemini-3.8-flash</code> | 23 | 0 | 14 | 203 |
| <code>glm/glm-5.3-flash</code> | 29 | 2 | 2 | 203 |
| <code>grok/grok-4.5</code> | 24 | 2 | 1 | 203 |
| <code>grok/grok-4.6</code> | 24 | 9 | 1 | 203 |
| <code>kimi/kimi-k2.6</code> | 23 | 9 | 1 | 203 |
| <code>kimi/kimi-k3</code> | 27 | 5 | 3 | 203 |
| <code>mistral/mistral-ocr-4-0</code> | 11 | 1 | 4 | 203 |
| <code>mistral/mistral-ocr-4-1</code> | 18 | 1 | 1 | 203 |
| <code>openai/gpt-5.6-luna</code> | 45 | 10 | 2 | 203 |
| <code>openai/gpt-5.6-sol</code> | 49 | 0 | 16 | 203 |
| <code>openai/gpt-5.6-terra</code> | 31 | 7 | 6 | 203 |
| <code>openai/gpt-6-astra</code> | 28 | 5 | 0 | 203 |

## Notes

- Best cloud service: `gemini/gemini-3.5-flash-lite` scored 92.12/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0261¢ ($0.0003).
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.40s.
