# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/ocr/01-financial-data`
- Total providers: 30 (0 local, 30 third-party service)
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

| Rank | Provider | Value | Score / 100 | WER  | CER  | Processing Time | Actual Cost                 |
| ---: | -------- | ----: | ----------: | ---: | ---: | --------------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a         | n/a  | n/a  | n/a             | No providers in this group. |

#### Speed

| Rank | Provider | Value | Score / 100 | WER  | CER  | Processing Time | Actual Cost                 |
| ---: | -------- | ----: | ----------: | ---: | ---: | --------------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a         | n/a  | n/a  | n/a             | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER  | CER  | Processing Time | Actual Cost                 |
| ---: | -------- | ----: | ----------: | ---: | ---: | --------------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a         | n/a  | n/a  | n/a             | No providers in this group. |

### Third-Party Service

#### Price

| Rank | Provider                                               | Value   | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | ------: | ----------: | -----: | -----: | --------------: | ----------: |
| 1    | <code>deepinfra/google/gemma-4-31B-it</code>           | $0.0004 | 98.55       | 1.45%  | 0.50%  | 28.10s          | $0.0004     |
| 2    | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0005 | 90.70       | 9.30%  | 9.67%  | 56.57s          | $0.0005     |
| 3    | <code>glm/glm-5.3-flash</code>                         | $0.0010 | 90.70       | 9.30%  | 8.42%  | 31.88s          | $0.0010     |
| 4    | <code>anthropic/claude-haiku-5-5</code>                | $0.0010 | 97.38       | 2.62%  | 2.50%  | 12.09s          | $0.0010     |
| 5    | <code>openai/gpt-6-luna</code>                         | $0.0016 | 93.02       | 6.98%  | 6.83%  | 24.48s          | $0.0016     |
| 6    | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | $0.0023 | 92.44       | 7.56%  | 4.00%  | 15.10s          | $0.0023     |
| 7    | <code>openai/gpt-5.6-luna</code>                       | $0.0023 | 90.99       | 9.01%  | 7.67%  | 8.88s           | $0.0023     |
| 8    | <code>gemini/gemini-3.5-flash-lite</code>              | $0.0026 | 15.41       | 84.59% | 56.00% | 2.66s           | $0.0026     |
| 9    | <code>kimi/kimi-k2.6</code>                            | $0.0038 | 23.26       | 76.74% | 50.42% | 17.20s          | $0.0038     |
| 10   | <code>mistral/mistral-ocr-4-0</code>                   | $0.0040 | 92.15       | 7.85%  | 6.92%  | 1.48s           | $0.0040     |
| 11   | <code>mistral/mistral-ocr-4-1</code>                   | $0.0040 | 92.15       | 7.85%  | 6.75%  | 1.91s           | $0.0040     |
| 12   | <code>grok/grok-4.5</code>                             | $0.0065 | 31.10       | 68.90% | 46.92% | 33.64s          | $0.0065     |
| 13   | <code>grok/grok-4.6</code>                             | $0.0069 | 30.52       | 69.48% | 46.58% | 49.56s          | $0.0069     |
| 14   | <code>gemini/gemini-3.6-flash</code>                   | $0.0085 | 99.71       | 0.29%  | 0.08%  | 4.61s           | $0.0085     |
| 15   | <code>gemini/gemini-3.7-flash</code>                   | $0.0089 | 96.51       | 3.49%  | 1.92%  | 2.67s           | $0.0089     |
| 16   | <code>gemini/gemini-3.8-flash</code>                   | $0.0095 | 99.71       | 0.29%  | 0.08%  | 3.10s           | $0.0095     |
| 17   | <code>gemini/gemini-3.5-flash</code>                   | $0.0102 | 98.55       | 1.45%  | 1.67%  | 3.69s           | $0.0102     |
| 18   | <code>anthropic/claude-sonnet-5</code>                 | $0.0110 | 97.97       | 2.03%  | 1.92%  | 13.11s          | $0.0110     |
| 19   | <code>anthropic/claude-sonnet-5-5</code>               | $0.0113 | 99.13       | 0.87%  | 0.25%  | 12.85s          | $0.0113     |
| 20   | <code>openai/gpt-6.1-sol</code>                        | $0.0165 | 98.84       | 1.16%  | 0.33%  | 13.90s          | $0.0165     |
| 21   | <code>anthropic/claude-opus-5-5</code>                 | $0.0225 | 100.00      | 0.00%  | 0.00%  | 6.97s           | $0.0225     |
| 22   | <code>gemini/gemini-4-argon</code>                     | $0.0239 | 100.00      | 0.00%  | 0.00%  | 9.75s           | $0.0239     |
| 23   | <code>kimi/kimi-k3</code>                              | $0.0240 | 31.10       | 68.90% | 47.42% | 95.03s          | $0.0240     |
| 24   | <code>openai/gpt-5.6-terra</code>                      | $0.0407 | 93.31       | 6.69%  | 2.67%  | 23.42s          | $0.0407     |
| 25   | <code>openai/gpt-6-astra</code>                        | $0.0438 | 99.13       | 0.87%  | 0.25%  | 9.18s           | $0.0438     |
| 26   | <code>anthropic/claude-opus-5</code>                   | $0.0520 | 97.09       | 2.91%  | 3.42%  | 22.70s          | $0.0520     |
| 27   | <code>anthropic/claude-fable-5-1</code>                | $0.0526 | 100.00      | 0.00%  | 0.00%  | 11.94s          | $0.0526     |
| 28   | <code>anthropic/claude-fable-5</code>                  | $0.0538 | 100.00      | 0.00%  | 0.00%  | 14.96s          | $0.0538     |
| 29   | <code>grok/grok-4.7</code>                             | $0.0654 | 94.77       | 5.23%  | 6.33%  | 131.88s         | $0.0654     |
| 30   | <code>openai/gpt-5.6-sol</code>                        | $0.0990 | 97.97       | 2.03%  | 0.50%  | 33.11s          | $0.0990     |

#### Speed

| Rank | Provider                                               | Value   | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | ------: | ----------: | -----: | -----: | --------------: | ----------: |
| 1    | <code>mistral/mistral-ocr-4-0</code>                   | 1.48s   | 92.15       | 7.85%  | 6.92%  | 1.48s           | $0.0040     |
| 2    | <code>mistral/mistral-ocr-4-1</code>                   | 1.91s   | 92.15       | 7.85%  | 6.75%  | 1.91s           | $0.0040     |
| 3    | <code>gemini/gemini-3.5-flash-lite</code>              | 2.66s   | 15.41       | 84.59% | 56.00% | 2.66s           | $0.0026     |
| 4    | <code>gemini/gemini-3.7-flash</code>                   | 2.67s   | 96.51       | 3.49%  | 1.92%  | 2.67s           | $0.0089     |
| 5    | <code>gemini/gemini-3.8-flash</code>                   | 3.10s   | 99.71       | 0.29%  | 0.08%  | 3.10s           | $0.0095     |
| 6    | <code>gemini/gemini-3.5-flash</code>                   | 3.69s   | 98.55       | 1.45%  | 1.67%  | 3.69s           | $0.0102     |
| 7    | <code>gemini/gemini-3.6-flash</code>                   | 4.61s   | 99.71       | 0.29%  | 0.08%  | 4.61s           | $0.0085     |
| 8    | <code>anthropic/claude-opus-5-5</code>                 | 6.97s   | 100.00      | 0.00%  | 0.00%  | 6.97s           | $0.0225     |
| 9    | <code>openai/gpt-5.6-luna</code>                       | 8.88s   | 90.99       | 9.01%  | 7.67%  | 8.88s           | $0.0023     |
| 10   | <code>openai/gpt-6-astra</code>                        | 9.18s   | 99.13       | 0.87%  | 0.25%  | 9.18s           | $0.0438     |
| 11   | <code>gemini/gemini-4-argon</code>                     | 9.75s   | 100.00      | 0.00%  | 0.00%  | 9.75s           | $0.0239     |
| 12   | <code>anthropic/claude-fable-5-1</code>                | 11.94s  | 100.00      | 0.00%  | 0.00%  | 11.94s          | $0.0526     |
| 13   | <code>anthropic/claude-haiku-5-5</code>                | 12.09s  | 97.38       | 2.62%  | 2.50%  | 12.09s          | $0.0010     |
| 14   | <code>anthropic/claude-sonnet-5-5</code>               | 12.85s  | 99.13       | 0.87%  | 0.25%  | 12.85s          | $0.0113     |
| 15   | <code>anthropic/claude-sonnet-5</code>                 | 13.11s  | 97.97       | 2.03%  | 1.92%  | 13.11s          | $0.0110     |
| 16   | <code>openai/gpt-6.1-sol</code>                        | 13.90s  | 98.84       | 1.16%  | 0.33%  | 13.90s          | $0.0165     |
| 17   | <code>anthropic/claude-fable-5</code>                  | 14.96s  | 100.00      | 0.00%  | 0.00%  | 14.96s          | $0.0538     |
| 18   | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 15.10s  | 92.44       | 7.56%  | 4.00%  | 15.10s          | $0.0023     |
| 19   | <code>kimi/kimi-k2.6</code>                            | 17.20s  | 23.26       | 76.74% | 50.42% | 17.20s          | $0.0038     |
| 20   | <code>anthropic/claude-opus-5</code>                   | 22.70s  | 97.09       | 2.91%  | 3.42%  | 22.70s          | $0.0520     |
| 21   | <code>openai/gpt-5.6-terra</code>                      | 23.42s  | 93.31       | 6.69%  | 2.67%  | 23.42s          | $0.0407     |
| 22   | <code>openai/gpt-6-luna</code>                         | 24.48s  | 93.02       | 6.98%  | 6.83%  | 24.48s          | $0.0016     |
| 23   | <code>deepinfra/google/gemma-4-31B-it</code>           | 28.10s  | 98.55       | 1.45%  | 0.50%  | 28.10s          | $0.0004     |
| 24   | <code>glm/glm-5.3-flash</code>                         | 31.88s  | 90.70       | 9.30%  | 8.42%  | 31.88s          | $0.0010     |
| 25   | <code>openai/gpt-5.6-sol</code>                        | 33.11s  | 97.97       | 2.03%  | 0.50%  | 33.11s          | $0.0990     |
| 26   | <code>grok/grok-4.5</code>                             | 33.64s  | 31.10       | 68.90% | 46.92% | 33.64s          | $0.0065     |
| 27   | <code>grok/grok-4.6</code>                             | 49.56s  | 30.52       | 69.48% | 46.58% | 49.56s          | $0.0069     |
| 28   | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 56.57s  | 90.70       | 9.30%  | 9.67%  | 56.57s          | $0.0005     |
| 29   | <code>kimi/kimi-k3</code>                              | 95.03s  | 31.10       | 68.90% | 47.42% | 95.03s          | $0.0240     |
| 30   | <code>grok/grok-4.7</code>                             | 131.88s | 94.77       | 5.23%  | 6.33%  | 131.88s         | $0.0654     |

#### Quality Score

| Rank | Provider                                               | Value                    | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | -----------------------: | ----------: | -----: | -----: | --------------: | ----------: |
| 1    | <code>anthropic/claude-fable-5</code>                  | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 14.96s          | $0.0538     |
| 2    | <code>anthropic/claude-fable-5-1</code>                | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 11.94s          | $0.0526     |
| 3    | <code>anthropic/claude-opus-5-5</code>                 | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 6.97s           | $0.0225     |
| 4    | <code>gemini/gemini-4-argon</code>                     | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 9.75s           | $0.0239     |
| 5    | <code>gemini/gemini-3.6-flash</code>                   | 99.71/100 quality score  | 99.71       | 0.29%  | 0.08%  | 4.61s           | $0.0085     |
| 6    | <code>gemini/gemini-3.8-flash</code>                   | 99.71/100 quality score  | 99.71       | 0.29%  | 0.08%  | 3.10s           | $0.0095     |
| 7    | <code>anthropic/claude-sonnet-5-5</code>               | 99.13/100 quality score  | 99.13       | 0.87%  | 0.25%  | 12.85s          | $0.0113     |
| 8    | <code>openai/gpt-6-astra</code>                        | 99.13/100 quality score  | 99.13       | 0.87%  | 0.25%  | 9.18s           | $0.0438     |
| 9    | <code>openai/gpt-6.1-sol</code>                        | 98.84/100 quality score  | 98.84       | 1.16%  | 0.33%  | 13.90s          | $0.0165     |
| 10   | <code>deepinfra/google/gemma-4-31B-it</code>           | 98.55/100 quality score  | 98.55       | 1.45%  | 0.50%  | 28.10s          | $0.0004     |
| 11   | <code>gemini/gemini-3.5-flash</code>                   | 98.55/100 quality score  | 98.55       | 1.45%  | 1.67%  | 3.69s           | $0.0102     |
| 12   | <code>openai/gpt-5.6-sol</code>                        | 97.97/100 quality score  | 97.97       | 2.03%  | 0.50%  | 33.11s          | $0.0990     |
| 13   | <code>anthropic/claude-sonnet-5</code>                 | 97.97/100 quality score  | 97.97       | 2.03%  | 1.92%  | 13.11s          | $0.0110     |
| 14   | <code>anthropic/claude-haiku-5-5</code>                | 97.38/100 quality score  | 97.38       | 2.62%  | 2.50%  | 12.09s          | $0.0010     |
| 15   | <code>anthropic/claude-opus-5</code>                   | 97.09/100 quality score  | 97.09       | 2.91%  | 3.42%  | 22.70s          | $0.0520     |
| 16   | <code>gemini/gemini-3.7-flash</code>                   | 96.51/100 quality score  | 96.51       | 3.49%  | 1.92%  | 2.67s           | $0.0089     |
| 17   | <code>grok/grok-4.7</code>                             | 94.77/100 quality score  | 94.77       | 5.23%  | 6.33%  | 131.88s         | $0.0654     |
| 18   | <code>openai/gpt-5.6-terra</code>                      | 93.31/100 quality score  | 93.31       | 6.69%  | 2.67%  | 23.42s          | $0.0407     |
| 19   | <code>openai/gpt-6-luna</code>                         | 93.02/100 quality score  | 93.02       | 6.98%  | 6.83%  | 24.48s          | $0.0016     |
| 20   | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 92.44/100 quality score  | 92.44       | 7.56%  | 4.00%  | 15.10s          | $0.0023     |
| 21   | <code>mistral/mistral-ocr-4-1</code>                   | 92.15/100 quality score  | 92.15       | 7.85%  | 6.75%  | 1.91s           | $0.0040     |
| 22   | <code>mistral/mistral-ocr-4-0</code>                   | 92.15/100 quality score  | 92.15       | 7.85%  | 6.92%  | 1.48s           | $0.0040     |
| 23   | <code>openai/gpt-5.6-luna</code>                       | 90.99/100 quality score  | 90.99       | 9.01%  | 7.67%  | 8.88s           | $0.0023     |
| 24   | <code>glm/glm-5.3-flash</code>                         | 90.70/100 quality score  | 90.70       | 9.30%  | 8.42%  | 31.88s          | $0.0010     |
| 25   | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 90.70/100 quality score  | 90.70       | 9.30%  | 9.67%  | 56.57s          | $0.0005     |
| 26   | <code>grok/grok-4.5</code>                             | 31.10/100 quality score  | 31.10       | 68.90% | 46.92% | 33.64s          | $0.0065     |
| 27   | <code>kimi/kimi-k3</code>                              | 31.10/100 quality score  | 31.10       | 68.90% | 47.42% | 95.03s          | $0.0240     |
| 28   | <code>grok/grok-4.6</code>                             | 30.52/100 quality score  | 30.52       | 69.48% | 46.58% | 49.56s          | $0.0069     |
| 29   | <code>kimi/kimi-k2.6</code>                            | 23.26/100 quality score  | 23.26       | 76.74% | 50.42% | 17.20s          | $0.0038     |
| 30   | <code>gemini/gemini-3.5-flash-lite</code>              | 15.41/100 quality score  | 15.41       | 84.59% | 56.00% | 2.66s           | $0.0026     |


## Provider Detail

| Provider                                               | Group               | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ------------------------------------------------------ | ------------------- | ----------: | -----: | -----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>                  | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 14.96s          | $0.0538     |
| <code>anthropic/claude-fable-5-1</code>                | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 11.94s          | $0.0526     |
| <code>anthropic/claude-haiku-5-5</code>                | Third-Party Service | 97.38       | 2.62%  | 2.50%  | 12.09s          | $0.0010     |
| <code>anthropic/claude-opus-5</code>                   | Third-Party Service | 97.09       | 2.91%  | 3.42%  | 22.70s          | $0.0520     |
| <code>anthropic/claude-opus-5-5</code>                 | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 6.97s           | $0.0225     |
| <code>anthropic/claude-sonnet-5</code>                 | Third-Party Service | 97.97       | 2.03%  | 1.92%  | 13.11s          | $0.0110     |
| <code>anthropic/claude-sonnet-5-5</code>               | Third-Party Service | 99.13       | 0.87%  | 0.25%  | 12.85s          | $0.0113     |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 90.70       | 9.30%  | 9.67%  | 56.57s          | $0.0005     |
| <code>deepinfra/google/gemma-4-31B-it</code>           | Third-Party Service | 98.55       | 1.45%  | 0.50%  | 28.10s          | $0.0004     |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>                | Third-Party Service | 92.44       | 7.56%  | 4.00%  | 15.10s          | $0.0023     |
| <code>gemini/gemini-3.5-flash</code>                   | Third-Party Service | 98.55       | 1.45%  | 1.67%  | 3.69s           | $0.0102     |
| <code>gemini/gemini-3.5-flash-lite</code>              | Third-Party Service | 15.41       | 84.59% | 56.00% | 2.66s           | $0.0026     |
| <code>gemini/gemini-3.6-flash</code>                   | Third-Party Service | 99.71       | 0.29%  | 0.08%  | 4.61s           | $0.0085     |
| <code>gemini/gemini-3.7-flash</code>                   | Third-Party Service | 96.51       | 3.49%  | 1.92%  | 2.67s           | $0.0089     |
| <code>gemini/gemini-3.8-flash</code>                   | Third-Party Service | 99.71       | 0.29%  | 0.08%  | 3.10s           | $0.0095     |
| <code>gemini/gemini-4-argon</code>                     | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 9.75s           | $0.0239     |
| <code>glm/glm-5.3-flash</code>                         | Third-Party Service | 90.70       | 9.30%  | 8.42%  | 31.88s          | $0.0010     |
| <code>grok/grok-4.5</code>                             | Third-Party Service | 31.10       | 68.90% | 46.92% | 33.64s          | $0.0065     |
| <code>grok/grok-4.6</code>                             | Third-Party Service | 30.52       | 69.48% | 46.58% | 49.56s          | $0.0069     |
| <code>grok/grok-4.7</code>                             | Third-Party Service | 94.77       | 5.23%  | 6.33%  | 131.88s         | $0.0654     |
| <code>kimi/kimi-k2.6</code>                            | Third-Party Service | 23.26       | 76.74% | 50.42% | 17.20s          | $0.0038     |
| <code>kimi/kimi-k3</code>                              | Third-Party Service | 31.10       | 68.90% | 47.42% | 95.03s          | $0.0240     |
| <code>mistral/mistral-ocr-4-0</code>                   | Third-Party Service | 92.15       | 7.85%  | 6.92%  | 1.48s           | $0.0040     |
| <code>mistral/mistral-ocr-4-1</code>                   | Third-Party Service | 92.15       | 7.85%  | 6.75%  | 1.91s           | $0.0040     |
| <code>openai/gpt-5.6-luna</code>                       | Third-Party Service | 90.99       | 9.01%  | 7.67%  | 8.88s           | $0.0023     |
| <code>openai/gpt-5.6-sol</code>                        | Third-Party Service | 97.97       | 2.03%  | 0.50%  | 33.11s          | $0.0990     |
| <code>openai/gpt-5.6-terra</code>                      | Third-Party Service | 93.31       | 6.69%  | 2.67%  | 23.42s          | $0.0407     |
| <code>openai/gpt-6-astra</code>                        | Third-Party Service | 99.13       | 0.87%  | 0.25%  | 9.18s           | $0.0438     |
| <code>openai/gpt-6-luna</code>                         | Third-Party Service | 93.02       | 6.98%  | 6.83%  | 24.48s          | $0.0016     |
| <code>openai/gpt-6.1-sol</code>                        | Third-Party Service | 98.84       | 1.16%  | 0.33%  | 13.90s          | $0.0165     |

## Error Breakdown (WER)

| Provider                                               | Substitutions | Deletions | Insertions | Ref. Words |
| ------------------------------------------------------ | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>                  | 0             | 0         | 0          | 344        |
| <code>anthropic/claude-fable-5-1</code>                | 0             | 0         | 0          | 344        |
| <code>anthropic/claude-haiku-5-5</code>                | 1             | 0         | 8          | 344        |
| <code>anthropic/claude-opus-5</code>                   | 0             | 0         | 10         | 344        |
| <code>anthropic/claude-opus-5-5</code>                 | 0             | 0         | 0          | 344        |
| <code>anthropic/claude-sonnet-5</code>                 | 1             | 0         | 6          | 344        |
| <code>anthropic/claude-sonnet-5-5</code>               | 3             | 0         | 0          | 344        |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 8             | 7         | 17         | 344        |
| <code>deepinfra/google/gemma-4-31B-it</code>           | 5             | 0         | 0          | 344        |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 14            | 4         | 8          | 344        |
| <code>gemini/gemini-3.5-flash</code>                   | 0             | 0         | 5          | 344        |
| <code>gemini/gemini-3.5-flash-lite</code>              | 240           | 25        | 26         | 344        |
| <code>gemini/gemini-3.6-flash</code>                   | 1             | 0         | 0          | 344        |
| <code>gemini/gemini-3.7-flash</code>                   | 2             | 0         | 10         | 344        |
| <code>gemini/gemini-3.8-flash</code>                   | 1             | 0         | 0          | 344        |
| <code>gemini/gemini-4-argon</code>                     | 0             | 0         | 0          | 344        |
| <code>glm/glm-5.3-flash</code>                         | 9             | 0         | 23         | 344        |
| <code>grok/grok-4.5</code>                             | 133           | 52        | 52         | 344        |
| <code>grok/grok-4.6</code>                             | 135           | 52        | 52         | 344        |
| <code>grok/grok-4.7</code>                             | 4             | 7         | 7          | 344        |
| <code>kimi/kimi-k2.6</code>                            | 167           | 48        | 49         | 344        |
| <code>kimi/kimi-k3</code>                              | 130           | 55        | 52         | 344        |
| <code>mistral/mistral-ocr-4-0</code>                   | 5             | 0         | 22         | 344        |
| <code>mistral/mistral-ocr-4-1</code>                   | 5             | 0         | 22         | 344        |
| <code>openai/gpt-5.6-luna</code>                       | 13            | 11        | 7          | 344        |
| <code>openai/gpt-5.6-sol</code>                        | 6             | 0         | 1          | 344        |
| <code>openai/gpt-5.6-terra</code>                      | 17            | 2         | 4          | 344        |
| <code>openai/gpt-6-astra</code>                        | 3             | 0         | 0          | 344        |
| <code>openai/gpt-6-luna</code>                         | 7             | 9         | 8          | 344        |
| <code>openai/gpt-6.1-sol</code>                        | 4             | 0         | 0          | 344        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0365¢ ($0.0004).
- Fastest cloud service: `mistral/mistral-ocr-4-0` at 1.48s.
