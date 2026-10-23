# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/ocr/01-handwriting`
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
| 1    | <code>deepinfra/google/gemma-4-31B-it</code>           | $0.0003 | 84.73       | 15.27% | 5.72%  | 13.55s          | $0.0003     |
| 2    | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0003 | 71.43       | 28.57% | 10.40% | 21.42s          | $0.0003     |
| 3    | <code>anthropic/claude-haiku-5-5</code>                | $0.0006 | 71.43       | 28.57% | 10.23% | 9.15s           | $0.0006     |
| 4    | <code>openai/gpt-6-luna</code>                         | $0.0012 | 74.88       | 25.12% | 10.40% | 35.02s          | $0.0012     |
| 5    | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | $0.0016 | 67.98       | 32.02% | 11.96% | 9.45s           | $0.0016     |
| 6    | <code>gemini/gemini-3.5-flash-lite</code>              | $0.0022 | 92.61       | 7.39%  | 2.25%  | 2.20s           | $0.0022     |
| 7    | <code>kimi/kimi-k2.6</code>                            | $0.0024 | 83.25       | 16.75% | 5.72%  | 9.62s           | $0.0024     |
| 8    | <code>openai/gpt-5.6-luna</code>                       | $0.0026 | 71.92       | 28.08% | 13.17% | 9.28s           | $0.0026     |
| 9    | <code>glm/glm-5.3-flash</code>                         | $0.0026 | 83.25       | 16.75% | 7.11%  | 101.48s         | $0.0026     |
| 10   | <code>mistral/mistral-ocr-4-0</code>                   | $0.0040 | 91.63       | 8.37%  | 4.33%  | 1.66s           | $0.0040     |
| 11   | <code>mistral/mistral-ocr-4-1</code>                   | $0.0040 | 89.66       | 10.34% | 3.47%  | 1.40s           | $0.0040     |
| 12   | <code>grok/grok-4.6</code>                             | $0.0050 | 82.76       | 17.24% | 5.89%  | 28.06s          | $0.0050     |
| 13   | <code>grok/grok-4.5</code>                             | $0.0052 | 86.21       | 13.79% | 5.89%  | 18.00s          | $0.0052     |
| 14   | <code>gemini/gemini-3.6-flash</code>                   | $0.0069 | 89.16       | 10.84% | 2.95%  | 3.72s           | $0.0069     |
| 15   | <code>gemini/gemini-3.7-flash</code>                   | $0.0077 | 77.83       | 22.17% | 9.71%  | 3.51s           | $0.0077     |
| 16   | <code>gemini/gemini-3.8-flash</code>                   | $0.0078 | 82.27       | 17.73% | 4.16%  | 2.84s           | $0.0078     |
| 17   | <code>anthropic/claude-sonnet-5</code>                 | $0.0085 | 83.74       | 16.26% | 5.89%  | 7.84s           | $0.0085     |
| 18   | <code>gemini/gemini-3.5-flash</code>                   | $0.0089 | 87.68       | 12.32% | 3.64%  | 3.10s           | $0.0089     |
| 19   | <code>anthropic/claude-sonnet-5-5</code>               | $0.0094 | 81.77       | 18.23% | 4.51%  | 10.73s          | $0.0094     |
| 20   | <code>kimi/kimi-k3</code>                              | $0.0112 | 82.27       | 17.73% | 6.59%  | 340.60s         | $0.0112     |
| 21   | <code>openai/gpt-5.6-terra</code>                      | $0.0135 | 78.33       | 21.67% | 9.36%  | 7.11s           | $0.0135     |
| 22   | <code>anthropic/claude-opus-5-5</code>                 | $0.0157 | 88.18       | 11.82% | 3.99%  | 5.96s           | $0.0157     |
| 23   | <code>gemini/gemini-4-argon</code>                     | $0.0181 | 89.66       | 10.34% | 2.60%  | 8.63s           | $0.0181     |
| 24   | <code>anthropic/claude-opus-5</code>                   | $0.0214 | 85.71       | 14.29% | 6.24%  | 10.81s          | $0.0214     |
| 25   | <code>grok/grok-4.7</code>                             | $0.0230 | 86.21       | 13.79% | 5.72%  | 29.81s          | $0.0230     |
| 26   | <code>openai/gpt-6.1-sol</code>                        | $0.0243 | 80.30       | 19.70% | 6.93%  | 27.26s          | $0.0243     |
| 27   | <code>anthropic/claude-fable-5-1</code>                | $0.0422 | 86.21       | 13.79% | 3.12%  | 8.16s           | $0.0422     |
| 28   | <code>anthropic/claude-fable-5</code>                  | $0.0422 | 90.15       | 9.85%  | 2.25%  | 9.87s           | $0.0422     |
| 29   | <code>openai/gpt-6-astra</code>                        | $0.1056 | 84.24       | 15.76% | 4.85%  | 23.93s          | $0.1056     |
| 30   | <code>openai/gpt-5.6-sol</code>                        | $0.1085 | 68.47       | 31.53% | 10.57% | 30.01s          | $0.1085     |

#### Speed

| Rank | Provider                                               | Value   | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | ------: | ----------: | -----: | -----: | --------------: | ----------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>                   | 1.40s   | 89.66       | 10.34% | 3.47%  | 1.40s           | $0.0040     |
| 2    | <code>mistral/mistral-ocr-4-0</code>                   | 1.66s   | 91.63       | 8.37%  | 4.33%  | 1.66s           | $0.0040     |
| 3    | <code>gemini/gemini-3.5-flash-lite</code>              | 2.20s   | 92.61       | 7.39%  | 2.25%  | 2.20s           | $0.0022     |
| 4    | <code>gemini/gemini-3.8-flash</code>                   | 2.84s   | 82.27       | 17.73% | 4.16%  | 2.84s           | $0.0078     |
| 5    | <code>gemini/gemini-3.5-flash</code>                   | 3.10s   | 87.68       | 12.32% | 3.64%  | 3.10s           | $0.0089     |
| 6    | <code>gemini/gemini-3.7-flash</code>                   | 3.51s   | 77.83       | 22.17% | 9.71%  | 3.51s           | $0.0077     |
| 7    | <code>gemini/gemini-3.6-flash</code>                   | 3.72s   | 89.16       | 10.84% | 2.95%  | 3.72s           | $0.0069     |
| 8    | <code>anthropic/claude-opus-5-5</code>                 | 5.96s   | 88.18       | 11.82% | 3.99%  | 5.96s           | $0.0157     |
| 9    | <code>openai/gpt-5.6-terra</code>                      | 7.11s   | 78.33       | 21.67% | 9.36%  | 7.11s           | $0.0135     |
| 10   | <code>anthropic/claude-sonnet-5</code>                 | 7.84s   | 83.74       | 16.26% | 5.89%  | 7.84s           | $0.0085     |
| 11   | <code>anthropic/claude-fable-5-1</code>                | 8.16s   | 86.21       | 13.79% | 3.12%  | 8.16s           | $0.0422     |
| 12   | <code>gemini/gemini-4-argon</code>                     | 8.63s   | 89.66       | 10.34% | 2.60%  | 8.63s           | $0.0181     |
| 13   | <code>anthropic/claude-haiku-5-5</code>                | 9.15s   | 71.43       | 28.57% | 10.23% | 9.15s           | $0.0006     |
| 14   | <code>openai/gpt-5.6-luna</code>                       | 9.28s   | 71.92       | 28.08% | 13.17% | 9.28s           | $0.0026     |
| 15   | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 9.45s   | 67.98       | 32.02% | 11.96% | 9.45s           | $0.0016     |
| 16   | <code>kimi/kimi-k2.6</code>                            | 9.62s   | 83.25       | 16.75% | 5.72%  | 9.62s           | $0.0024     |
| 17   | <code>anthropic/claude-fable-5</code>                  | 9.87s   | 90.15       | 9.85%  | 2.25%  | 9.87s           | $0.0422     |
| 18   | <code>anthropic/claude-sonnet-5-5</code>               | 10.73s  | 81.77       | 18.23% | 4.51%  | 10.73s          | $0.0094     |
| 19   | <code>anthropic/claude-opus-5</code>                   | 10.81s  | 85.71       | 14.29% | 6.24%  | 10.81s          | $0.0214     |
| 20   | <code>deepinfra/google/gemma-4-31B-it</code>           | 13.55s  | 84.73       | 15.27% | 5.72%  | 13.55s          | $0.0003     |
| 21   | <code>grok/grok-4.5</code>                             | 18.00s  | 86.21       | 13.79% | 5.89%  | 18.00s          | $0.0052     |
| 22   | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 21.42s  | 71.43       | 28.57% | 10.40% | 21.42s          | $0.0003     |
| 23   | <code>openai/gpt-6-astra</code>                        | 23.93s  | 84.24       | 15.76% | 4.85%  | 23.93s          | $0.1056     |
| 24   | <code>openai/gpt-6.1-sol</code>                        | 27.26s  | 80.30       | 19.70% | 6.93%  | 27.26s          | $0.0243     |
| 25   | <code>grok/grok-4.6</code>                             | 28.06s  | 82.76       | 17.24% | 5.89%  | 28.06s          | $0.0050     |
| 26   | <code>grok/grok-4.7</code>                             | 29.81s  | 86.21       | 13.79% | 5.72%  | 29.81s          | $0.0230     |
| 27   | <code>openai/gpt-5.6-sol</code>                        | 30.01s  | 68.47       | 31.53% | 10.57% | 30.01s          | $0.1085     |
| 28   | <code>openai/gpt-6-luna</code>                         | 35.02s  | 74.88       | 25.12% | 10.40% | 35.02s          | $0.0012     |
| 29   | <code>glm/glm-5.3-flash</code>                         | 101.48s | 83.25       | 16.75% | 7.11%  | 101.48s         | $0.0026     |
| 30   | <code>kimi/kimi-k3</code>                              | 340.60s | 82.27       | 17.73% | 6.59%  | 340.60s         | $0.0112     |

#### Quality Score

| Rank | Provider                                               | Value                   | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | ----------------------: | ----------: | -----: | -----: | --------------: | ----------: |
| 1    | <code>gemini/gemini-3.5-flash-lite</code>              | 92.61/100 quality score | 92.61       | 7.39%  | 2.25%  | 2.20s           | $0.0022     |
| 2    | <code>mistral/mistral-ocr-4-0</code>                   | 91.63/100 quality score | 91.63       | 8.37%  | 4.33%  | 1.66s           | $0.0040     |
| 3    | <code>anthropic/claude-fable-5</code>                  | 90.15/100 quality score | 90.15       | 9.85%  | 2.25%  | 9.87s           | $0.0422     |
| 4    | <code>gemini/gemini-4-argon</code>                     | 89.66/100 quality score | 89.66       | 10.34% | 2.60%  | 8.63s           | $0.0181     |
| 5    | <code>mistral/mistral-ocr-4-1</code>                   | 89.66/100 quality score | 89.66       | 10.34% | 3.47%  | 1.40s           | $0.0040     |
| 6    | <code>gemini/gemini-3.6-flash</code>                   | 89.16/100 quality score | 89.16       | 10.84% | 2.95%  | 3.72s           | $0.0069     |
| 7    | <code>anthropic/claude-opus-5-5</code>                 | 88.18/100 quality score | 88.18       | 11.82% | 3.99%  | 5.96s           | $0.0157     |
| 8    | <code>gemini/gemini-3.5-flash</code>                   | 87.68/100 quality score | 87.68       | 12.32% | 3.64%  | 3.10s           | $0.0089     |
| 9    | <code>anthropic/claude-fable-5-1</code>                | 86.21/100 quality score | 86.21       | 13.79% | 3.12%  | 8.16s           | $0.0422     |
| 10   | <code>grok/grok-4.7</code>                             | 86.21/100 quality score | 86.21       | 13.79% | 5.72%  | 29.81s          | $0.0230     |
| 11   | <code>grok/grok-4.5</code>                             | 86.21/100 quality score | 86.21       | 13.79% | 5.89%  | 18.00s          | $0.0052     |
| 12   | <code>anthropic/claude-opus-5</code>                   | 85.71/100 quality score | 85.71       | 14.29% | 6.24%  | 10.81s          | $0.0214     |
| 13   | <code>deepinfra/google/gemma-4-31B-it</code>           | 84.73/100 quality score | 84.73       | 15.27% | 5.72%  | 13.55s          | $0.0003     |
| 14   | <code>openai/gpt-6-astra</code>                        | 84.24/100 quality score | 84.24       | 15.76% | 4.85%  | 23.93s          | $0.1056     |
| 15   | <code>anthropic/claude-sonnet-5</code>                 | 83.74/100 quality score | 83.74       | 16.26% | 5.89%  | 7.84s           | $0.0085     |
| 16   | <code>kimi/kimi-k2.6</code>                            | 83.25/100 quality score | 83.25       | 16.75% | 5.72%  | 9.62s           | $0.0024     |
| 17   | <code>glm/glm-5.3-flash</code>                         | 83.25/100 quality score | 83.25       | 16.75% | 7.11%  | 101.48s         | $0.0026     |
| 18   | <code>grok/grok-4.6</code>                             | 82.76/100 quality score | 82.76       | 17.24% | 5.89%  | 28.06s          | $0.0050     |
| 19   | <code>gemini/gemini-3.8-flash</code>                   | 82.27/100 quality score | 82.27       | 17.73% | 4.16%  | 2.84s           | $0.0078     |
| 20   | <code>kimi/kimi-k3</code>                              | 82.27/100 quality score | 82.27       | 17.73% | 6.59%  | 340.60s         | $0.0112     |
| 21   | <code>anthropic/claude-sonnet-5-5</code>               | 81.77/100 quality score | 81.77       | 18.23% | 4.51%  | 10.73s          | $0.0094     |
| 22   | <code>openai/gpt-6.1-sol</code>                        | 80.30/100 quality score | 80.30       | 19.70% | 6.93%  | 27.26s          | $0.0243     |
| 23   | <code>openai/gpt-5.6-terra</code>                      | 78.33/100 quality score | 78.33       | 21.67% | 9.36%  | 7.11s           | $0.0135     |
| 24   | <code>gemini/gemini-3.7-flash</code>                   | 77.83/100 quality score | 77.83       | 22.17% | 9.71%  | 3.51s           | $0.0077     |
| 25   | <code>openai/gpt-6-luna</code>                         | 74.88/100 quality score | 74.88       | 25.12% | 10.40% | 35.02s          | $0.0012     |
| 26   | <code>openai/gpt-5.6-luna</code>                       | 71.92/100 quality score | 71.92       | 28.08% | 13.17% | 9.28s           | $0.0026     |
| 27   | <code>anthropic/claude-haiku-5-5</code>                | 71.43/100 quality score | 71.43       | 28.57% | 10.23% | 9.15s           | $0.0006     |
| 28   | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 71.43/100 quality score | 71.43       | 28.57% | 10.40% | 21.42s          | $0.0003     |
| 29   | <code>openai/gpt-5.6-sol</code>                        | 68.47/100 quality score | 68.47       | 31.53% | 10.57% | 30.01s          | $0.1085     |
| 30   | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 67.98/100 quality score | 67.98       | 32.02% | 11.96% | 9.45s           | $0.0016     |


## Provider Detail

| Provider                                               | Group               | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ------------------------------------------------------ | ------------------- | ----------: | -----: | -----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>                  | Third-Party Service | 90.15       | 9.85%  | 2.25%  | 9.87s           | $0.0422     |
| <code>anthropic/claude-fable-5-1</code>                | Third-Party Service | 86.21       | 13.79% | 3.12%  | 8.16s           | $0.0422     |
| <code>anthropic/claude-haiku-5-5</code>                | Third-Party Service | 71.43       | 28.57% | 10.23% | 9.15s           | $0.0006     |
| <code>anthropic/claude-opus-5</code>                   | Third-Party Service | 85.71       | 14.29% | 6.24%  | 10.81s          | $0.0214     |
| <code>anthropic/claude-opus-5-5</code>                 | Third-Party Service | 88.18       | 11.82% | 3.99%  | 5.96s           | $0.0157     |
| <code>anthropic/claude-sonnet-5</code>                 | Third-Party Service | 83.74       | 16.26% | 5.89%  | 7.84s           | $0.0085     |
| <code>anthropic/claude-sonnet-5-5</code>               | Third-Party Service | 81.77       | 18.23% | 4.51%  | 10.73s          | $0.0094     |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 71.43       | 28.57% | 10.40% | 21.42s          | $0.0003     |
| <code>deepinfra/google/gemma-4-31B-it</code>           | Third-Party Service | 84.73       | 15.27% | 5.72%  | 13.55s          | $0.0003     |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>                | Third-Party Service | 67.98       | 32.02% | 11.96% | 9.45s           | $0.0016     |
| <code>gemini/gemini-3.5-flash</code>                   | Third-Party Service | 87.68       | 12.32% | 3.64%  | 3.10s           | $0.0089     |
| <code>gemini/gemini-3.5-flash-lite</code>              | Third-Party Service | 92.61       | 7.39%  | 2.25%  | 2.20s           | $0.0022     |
| <code>gemini/gemini-3.6-flash</code>                   | Third-Party Service | 89.16       | 10.84% | 2.95%  | 3.72s           | $0.0069     |
| <code>gemini/gemini-3.7-flash</code>                   | Third-Party Service | 77.83       | 22.17% | 9.71%  | 3.51s           | $0.0077     |
| <code>gemini/gemini-3.8-flash</code>                   | Third-Party Service | 82.27       | 17.73% | 4.16%  | 2.84s           | $0.0078     |
| <code>gemini/gemini-4-argon</code>                     | Third-Party Service | 89.66       | 10.34% | 2.60%  | 8.63s           | $0.0181     |
| <code>glm/glm-5.3-flash</code>                         | Third-Party Service | 83.25       | 16.75% | 7.11%  | 101.48s         | $0.0026     |
| <code>grok/grok-4.5</code>                             | Third-Party Service | 86.21       | 13.79% | 5.89%  | 18.00s          | $0.0052     |
| <code>grok/grok-4.6</code>                             | Third-Party Service | 82.76       | 17.24% | 5.89%  | 28.06s          | $0.0050     |
| <code>grok/grok-4.7</code>                             | Third-Party Service | 86.21       | 13.79% | 5.72%  | 29.81s          | $0.0230     |
| <code>kimi/kimi-k2.6</code>                            | Third-Party Service | 83.25       | 16.75% | 5.72%  | 9.62s           | $0.0024     |
| <code>kimi/kimi-k3</code>                              | Third-Party Service | 82.27       | 17.73% | 6.59%  | 340.60s         | $0.0112     |
| <code>mistral/mistral-ocr-4-0</code>                   | Third-Party Service | 91.63       | 8.37%  | 4.33%  | 1.66s           | $0.0040     |
| <code>mistral/mistral-ocr-4-1</code>                   | Third-Party Service | 89.66       | 10.34% | 3.47%  | 1.40s           | $0.0040     |
| <code>openai/gpt-5.6-luna</code>                       | Third-Party Service | 71.92       | 28.08% | 13.17% | 9.28s           | $0.0026     |
| <code>openai/gpt-5.6-sol</code>                        | Third-Party Service | 68.47       | 31.53% | 10.57% | 30.01s          | $0.1085     |
| <code>openai/gpt-5.6-terra</code>                      | Third-Party Service | 78.33       | 21.67% | 9.36%  | 7.11s           | $0.0135     |
| <code>openai/gpt-6-astra</code>                        | Third-Party Service | 84.24       | 15.76% | 4.85%  | 23.93s          | $0.1056     |
| <code>openai/gpt-6-luna</code>                         | Third-Party Service | 74.88       | 25.12% | 10.40% | 35.02s          | $0.0012     |
| <code>openai/gpt-6.1-sol</code>                        | Third-Party Service | 80.30       | 19.70% | 6.93%  | 27.26s          | $0.0243     |

## Error Breakdown (WER)

| Provider                                               | Substitutions | Deletions | Insertions | Ref. Words |
| ------------------------------------------------------ | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>                  | 12            | 6         | 2          | 203        |
| <code>anthropic/claude-fable-5-1</code>                | 17            | 1         | 10         | 203        |
| <code>anthropic/claude-haiku-5-5</code>                | 35            | 2         | 21         | 203        |
| <code>anthropic/claude-opus-5</code>                   | 18            | 7         | 4          | 203        |
| <code>anthropic/claude-opus-5-5</code>                 | 15            | 8         | 1          | 203        |
| <code>anthropic/claude-sonnet-5</code>                 | 23            | 8         | 2          | 203        |
| <code>anthropic/claude-sonnet-5-5</code>               | 26            | 1         | 10         | 203        |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 43            | 1         | 14         | 203        |
| <code>deepinfra/google/gemma-4-31B-it</code>           | 25            | 4         | 2          | 203        |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 54            | 1         | 10         | 203        |
| <code>gemini/gemini-3.5-flash</code>                   | 17            | 0         | 8          | 203        |
| <code>gemini/gemini-3.5-flash-lite</code>              | 11            | 0         | 4          | 203        |
| <code>gemini/gemini-3.6-flash</code>                   | 15            | 1         | 6          | 203        |
| <code>gemini/gemini-3.7-flash</code>                   | 27            | 4         | 14         | 203        |
| <code>gemini/gemini-3.8-flash</code>                   | 22            | 0         | 14         | 203        |
| <code>gemini/gemini-4-argon</code>                     | 14            | 6         | 1          | 203        |
| <code>glm/glm-5.3-flash</code>                         | 30            | 2         | 2          | 203        |
| <code>grok/grok-4.5</code>                             | 25            | 2         | 1          | 203        |
| <code>grok/grok-4.6</code>                             | 25            | 9         | 1          | 203        |
| <code>grok/grok-4.7</code>                             | 24            | 3         | 1          | 203        |
| <code>kimi/kimi-k2.6</code>                            | 24            | 9         | 1          | 203        |
| <code>kimi/kimi-k3</code>                              | 28            | 5         | 3          | 203        |
| <code>mistral/mistral-ocr-4-0</code>                   | 12            | 1         | 4          | 203        |
| <code>mistral/mistral-ocr-4-1</code>                   | 19            | 1         | 1          | 203        |
| <code>openai/gpt-5.6-luna</code>                       | 45            | 10        | 2          | 203        |
| <code>openai/gpt-5.6-sol</code>                        | 48            | 0         | 16         | 203        |
| <code>openai/gpt-5.6-terra</code>                      | 31            | 7         | 6          | 203        |
| <code>openai/gpt-6-astra</code>                        | 27            | 5         | 0          | 203        |
| <code>openai/gpt-6-luna</code>                         | 37            | 7         | 7          | 203        |
| <code>openai/gpt-6.1-sol</code>                        | 31            | 0         | 9          | 203        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best cloud service: `gemini/gemini-3.5-flash-lite` scored 92.61/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0261¢ ($0.0003).
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.40s.
