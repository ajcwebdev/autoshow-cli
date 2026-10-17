# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/ocr/01-non-english`
- Total providers: 28 (0 local, 28 third-party service)
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

| Rank | Provider                                               | Value   | Score / 100 | WER     | CER    | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | ------: | ----------: | ------: | -----: | --------------: | ----------: |
| 1    | <code>deepinfra/google/gemma-4-31B-it</code>           | $0.0003 | 38.46       | 61.54%  | 50.08% | 32.14s          | $0.0003     |
| 2    | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0008 | 0.00        | 203.85% | 95.15% | 107.14s         | $0.0008     |
| 3    | <code>anthropic/claude-haiku-5-5</code>                | $0.0013 | 100.00      | 0.00%   | 9.17%  | 26.95s          | $0.0013     |
| 4    | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | $0.0021 | 42.31       | 57.69%  | 24.02% | 12.38s          | $0.0021     |
| 5    | <code>gemini/gemini-3.5-flash-lite</code>              | $0.0022 | 100.00      | 0.00%   | 0.45%  | 2.69s           | $0.0022     |
| 6    | <code>openai/gpt-6-luna</code>                         | $0.0025 | 96.15       | 3.85%   | 5.68%  | 42.32s          | $0.0025     |
| 7    | <code>mistral/mistral-ocr-4-0</code>                   | $0.0040 | 76.92       | 23.08%  | 2.20%  | 1.54s           | $0.0040     |
| 8    | <code>mistral/mistral-ocr-4-1</code>                   | $0.0040 | 96.15       | 3.85%   | 0.15%  | 1.78s           | $0.0040     |
| 9    | <code>openai/gpt-5.6-luna</code>                       | $0.0047 | 65.38       | 34.62%  | 32.65% | 16.41s          | $0.0047     |
| 10   | <code>kimi/kimi-k2.6</code>                            | $0.0050 | 92.31       | 7.69%   | 5.91%  | 20.13s          | $0.0050     |
| 11   | <code>grok/grok-4.6</code>                             | $0.0069 | 53.85       | 46.15%  | 24.70% | 62.57s          | $0.0069     |
| 12   | <code>grok/grok-4.5</code>                             | $0.0070 | 73.08       | 26.92%  | 11.36% | 26.20s          | $0.0070     |
| 13   | <code>gemini/gemini-3.8-flash</code>                   | $0.0073 | 100.00      | 0.00%   | 0.76%  | 3.00s           | $0.0073     |
| 14   | <code>gemini/gemini-3.6-flash</code>                   | $0.0075 | 100.00      | 0.00%   | 0.98%  | 4.30s           | $0.0075     |
| 15   | <code>gemini/gemini-3.5-flash</code>                   | $0.0088 | 100.00      | 0.00%   | 1.14%  | 3.78s           | $0.0088     |
| 16   | <code>gemini/gemini-3.7-flash</code>                   | $0.0153 | 100.00      | 0.00%   | 0.15%  | 5.03s           | $0.0153     |
| 17   | <code>anthropic/claude-sonnet-5</code>                 | $0.0163 | 61.54       | 38.46%  | 33.33% | 22.15s          | $0.0163     |
| 18   | <code>gemini/gemini-4-argon</code>                     | $0.0205 | 100.00      | 0.00%   | 2.12%  | 11.36s          | $0.0205     |
| 19   | <code>openai/gpt-5.6-terra</code>                      | $0.0258 | 69.23       | 30.77%  | 25.76% | 12.58s          | $0.0258     |
| 20   | <code>openai/gpt-6.1-sol</code>                        | $0.0274 | 100.00      | 0.00%   | 0.53%  | 24.12s          | $0.0274     |
| 21   | <code>anthropic/claude-opus-5-5</code>                 | $0.0320 | 100.00      | 0.00%   | 1.29%  | 9.14s           | $0.0320     |
| 22   | <code>anthropic/claude-sonnet-5-5</code>               | $0.0354 | 100.00      | 0.00%   | 2.12%  | 26.52s          | $0.0354     |
| 23   | <code>anthropic/claude-opus-5</code>                   | $0.0354 | 76.92       | 23.08%  | 42.80% | 22.25s          | $0.0354     |
| 24   | <code>kimi/kimi-k3</code>                              | $0.0399 | 100.00      | 0.00%   | 0.08%  | 170.14s         | $0.0399     |
| 25   | <code>anthropic/claude-fable-5-1</code>                | $0.0766 | 100.00      | 0.00%   | 0.30%  | 22.36s          | $0.0766     |
| 26   | <code>openai/gpt-5.6-sol</code>                        | $0.1351 | 96.15       | 3.85%   | 7.95%  | 38.57s          | $0.1351     |
| 27   | <code>anthropic/claude-fable-5</code>                  | $0.1391 | 100.00      | 0.00%   | 0.00%  | 31.52s          | $0.1391     |
| 28   | <code>openai/gpt-6-astra</code>                        | $0.1640 | 100.00      | 0.00%   | 0.08%  | 31.88s          | $0.1640     |

#### Speed

| Rank | Provider                                               | Value   | Score / 100 | WER     | CER    | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | ------: | ----------: | ------: | -----: | --------------: | ----------: |
| 1    | <code>mistral/mistral-ocr-4-0</code>                   | 1.54s   | 76.92       | 23.08%  | 2.20%  | 1.54s           | $0.0040     |
| 2    | <code>mistral/mistral-ocr-4-1</code>                   | 1.78s   | 96.15       | 3.85%   | 0.15%  | 1.78s           | $0.0040     |
| 3    | <code>gemini/gemini-3.5-flash-lite</code>              | 2.69s   | 100.00      | 0.00%   | 0.45%  | 2.69s           | $0.0022     |
| 4    | <code>gemini/gemini-3.8-flash</code>                   | 3.00s   | 100.00      | 0.00%   | 0.76%  | 3.00s           | $0.0073     |
| 5    | <code>gemini/gemini-3.5-flash</code>                   | 3.78s   | 100.00      | 0.00%   | 1.14%  | 3.78s           | $0.0088     |
| 6    | <code>gemini/gemini-3.6-flash</code>                   | 4.30s   | 100.00      | 0.00%   | 0.98%  | 4.30s           | $0.0075     |
| 7    | <code>gemini/gemini-3.7-flash</code>                   | 5.03s   | 100.00      | 0.00%   | 0.15%  | 5.03s           | $0.0153     |
| 8    | <code>anthropic/claude-opus-5-5</code>                 | 9.14s   | 100.00      | 0.00%   | 1.29%  | 9.14s           | $0.0320     |
| 9    | <code>gemini/gemini-4-argon</code>                     | 11.36s  | 100.00      | 0.00%   | 2.12%  | 11.36s          | $0.0205     |
| 10   | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 12.38s  | 42.31       | 57.69%  | 24.02% | 12.38s          | $0.0021     |
| 11   | <code>openai/gpt-5.6-terra</code>                      | 12.58s  | 69.23       | 30.77%  | 25.76% | 12.58s          | $0.0258     |
| 12   | <code>openai/gpt-5.6-luna</code>                       | 16.41s  | 65.38       | 34.62%  | 32.65% | 16.41s          | $0.0047     |
| 13   | <code>kimi/kimi-k2.6</code>                            | 20.13s  | 92.31       | 7.69%   | 5.91%  | 20.13s          | $0.0050     |
| 14   | <code>anthropic/claude-sonnet-5</code>                 | 22.15s  | 61.54       | 38.46%  | 33.33% | 22.15s          | $0.0163     |
| 15   | <code>anthropic/claude-opus-5</code>                   | 22.25s  | 76.92       | 23.08%  | 42.80% | 22.25s          | $0.0354     |
| 16   | <code>anthropic/claude-fable-5-1</code>                | 22.36s  | 100.00      | 0.00%   | 0.30%  | 22.36s          | $0.0766     |
| 17   | <code>openai/gpt-6.1-sol</code>                        | 24.12s  | 100.00      | 0.00%   | 0.53%  | 24.12s          | $0.0274     |
| 18   | <code>grok/grok-4.5</code>                             | 26.20s  | 73.08       | 26.92%  | 11.36% | 26.20s          | $0.0070     |
| 19   | <code>anthropic/claude-sonnet-5-5</code>               | 26.52s  | 100.00      | 0.00%   | 2.12%  | 26.52s          | $0.0354     |
| 20   | <code>anthropic/claude-haiku-5-5</code>                | 26.95s  | 100.00      | 0.00%   | 9.17%  | 26.95s          | $0.0013     |
| 21   | <code>anthropic/claude-fable-5</code>                  | 31.52s  | 100.00      | 0.00%   | 0.00%  | 31.52s          | $0.1391     |
| 22   | <code>openai/gpt-6-astra</code>                        | 31.88s  | 100.00      | 0.00%   | 0.08%  | 31.88s          | $0.1640     |
| 23   | <code>deepinfra/google/gemma-4-31B-it</code>           | 32.14s  | 38.46       | 61.54%  | 50.08% | 32.14s          | $0.0003     |
| 24   | <code>openai/gpt-5.6-sol</code>                        | 38.57s  | 96.15       | 3.85%   | 7.95%  | 38.57s          | $0.1351     |
| 25   | <code>openai/gpt-6-luna</code>                         | 42.32s  | 96.15       | 3.85%   | 5.68%  | 42.32s          | $0.0025     |
| 26   | <code>grok/grok-4.6</code>                             | 62.57s  | 53.85       | 46.15%  | 24.70% | 62.57s          | $0.0069     |
| 27   | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 107.14s | 0.00        | 203.85% | 95.15% | 107.14s         | $0.0008     |
| 28   | <code>kimi/kimi-k3</code>                              | 170.14s | 100.00      | 0.00%   | 0.08%  | 170.14s         | $0.0399     |

#### Quality Score

| Rank | Provider                                               | Value                    | Score / 100 | WER     | CER    | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | -----------------------: | ----------: | ------: | -----: | --------------: | ----------: |
| 1    | <code>anthropic/claude-fable-5</code>                  | 100.00/100 quality score | 100.00      | 0.00%   | 0.00%  | 31.52s          | $0.1391     |
| 2    | <code>kimi/kimi-k3</code>                              | 100.00/100 quality score | 100.00      | 0.00%   | 0.08%  | 170.14s         | $0.0399     |
| 3    | <code>openai/gpt-6-astra</code>                        | 100.00/100 quality score | 100.00      | 0.00%   | 0.08%  | 31.88s          | $0.1640     |
| 4    | <code>gemini/gemini-3.7-flash</code>                   | 100.00/100 quality score | 100.00      | 0.00%   | 0.15%  | 5.03s           | $0.0153     |
| 5    | <code>anthropic/claude-fable-5-1</code>                | 100.00/100 quality score | 100.00      | 0.00%   | 0.30%  | 22.36s          | $0.0766     |
| 6    | <code>gemini/gemini-3.5-flash-lite</code>              | 100.00/100 quality score | 100.00      | 0.00%   | 0.45%  | 2.69s           | $0.0022     |
| 7    | <code>openai/gpt-6.1-sol</code>                        | 100.00/100 quality score | 100.00      | 0.00%   | 0.53%  | 24.12s          | $0.0274     |
| 8    | <code>gemini/gemini-3.8-flash</code>                   | 100.00/100 quality score | 100.00      | 0.00%   | 0.76%  | 3.00s           | $0.0073     |
| 9    | <code>gemini/gemini-3.6-flash</code>                   | 100.00/100 quality score | 100.00      | 0.00%   | 0.98%  | 4.30s           | $0.0075     |
| 10   | <code>gemini/gemini-3.5-flash</code>                   | 100.00/100 quality score | 100.00      | 0.00%   | 1.14%  | 3.78s           | $0.0088     |
| 11   | <code>anthropic/claude-opus-5-5</code>                 | 100.00/100 quality score | 100.00      | 0.00%   | 1.29%  | 9.14s           | $0.0320     |
| 12   | <code>anthropic/claude-sonnet-5-5</code>               | 100.00/100 quality score | 100.00      | 0.00%   | 2.12%  | 26.52s          | $0.0354     |
| 13   | <code>gemini/gemini-4-argon</code>                     | 100.00/100 quality score | 100.00      | 0.00%   | 2.12%  | 11.36s          | $0.0205     |
| 14   | <code>anthropic/claude-haiku-5-5</code>                | 100.00/100 quality score | 100.00      | 0.00%   | 9.17%  | 26.95s          | $0.0013     |
| 15   | <code>mistral/mistral-ocr-4-1</code>                   | 96.15/100 quality score  | 96.15       | 3.85%   | 0.15%  | 1.78s           | $0.0040     |
| 16   | <code>openai/gpt-6-luna</code>                         | 96.15/100 quality score  | 96.15       | 3.85%   | 5.68%  | 42.32s          | $0.0025     |
| 17   | <code>openai/gpt-5.6-sol</code>                        | 96.15/100 quality score  | 96.15       | 3.85%   | 7.95%  | 38.57s          | $0.1351     |
| 18   | <code>kimi/kimi-k2.6</code>                            | 92.31/100 quality score  | 92.31       | 7.69%   | 5.91%  | 20.13s          | $0.0050     |
| 19   | <code>mistral/mistral-ocr-4-0</code>                   | 76.92/100 quality score  | 76.92       | 23.08%  | 2.20%  | 1.54s           | $0.0040     |
| 20   | <code>anthropic/claude-opus-5</code>                   | 76.92/100 quality score  | 76.92       | 23.08%  | 42.80% | 22.25s          | $0.0354     |
| 21   | <code>grok/grok-4.5</code>                             | 73.08/100 quality score  | 73.08       | 26.92%  | 11.36% | 26.20s          | $0.0070     |
| 22   | <code>openai/gpt-5.6-terra</code>                      | 69.23/100 quality score  | 69.23       | 30.77%  | 25.76% | 12.58s          | $0.0258     |
| 23   | <code>openai/gpt-5.6-luna</code>                       | 65.38/100 quality score  | 65.38       | 34.62%  | 32.65% | 16.41s          | $0.0047     |
| 24   | <code>anthropic/claude-sonnet-5</code>                 | 61.54/100 quality score  | 61.54       | 38.46%  | 33.33% | 22.15s          | $0.0163     |
| 25   | <code>grok/grok-4.6</code>                             | 53.85/100 quality score  | 53.85       | 46.15%  | 24.70% | 62.57s          | $0.0069     |
| 26   | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 42.31/100 quality score  | 42.31       | 57.69%  | 24.02% | 12.38s          | $0.0021     |
| 27   | <code>deepinfra/google/gemma-4-31B-it</code>           | 38.46/100 quality score  | 38.46       | 61.54%  | 50.08% | 32.14s          | $0.0003     |
| 28   | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 0.00/100 quality score   | 0.00        | 203.85% | 95.15% | 107.14s         | $0.0008     |


## Provider Detail

| Provider                                               | Group               | Score / 100 | WER     | CER    | Processing Time | Actual Cost |
| ------------------------------------------------------ | ------------------- | ----------: | ------: | -----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>                  | Third-Party Service | 100.00      | 0.00%   | 0.00%  | 31.52s          | $0.1391     |
| <code>anthropic/claude-fable-5-1</code>                | Third-Party Service | 100.00      | 0.00%   | 0.30%  | 22.36s          | $0.0766     |
| <code>anthropic/claude-haiku-5-5</code>                | Third-Party Service | 100.00      | 0.00%   | 9.17%  | 26.95s          | $0.0013     |
| <code>anthropic/claude-opus-5</code>                   | Third-Party Service | 76.92       | 23.08%  | 42.80% | 22.25s          | $0.0354     |
| <code>anthropic/claude-opus-5-5</code>                 | Third-Party Service | 100.00      | 0.00%   | 1.29%  | 9.14s           | $0.0320     |
| <code>anthropic/claude-sonnet-5</code>                 | Third-Party Service | 61.54       | 38.46%  | 33.33% | 22.15s          | $0.0163     |
| <code>anthropic/claude-sonnet-5-5</code>               | Third-Party Service | 100.00      | 0.00%   | 2.12%  | 26.52s          | $0.0354     |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 0.00        | 203.85% | 95.15% | 107.14s         | $0.0008     |
| <code>deepinfra/google/gemma-4-31B-it</code>           | Third-Party Service | 38.46       | 61.54%  | 50.08% | 32.14s          | $0.0003     |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>                | Third-Party Service | 42.31       | 57.69%  | 24.02% | 12.38s          | $0.0021     |
| <code>gemini/gemini-3.5-flash</code>                   | Third-Party Service | 100.00      | 0.00%   | 1.14%  | 3.78s           | $0.0088     |
| <code>gemini/gemini-3.5-flash-lite</code>              | Third-Party Service | 100.00      | 0.00%   | 0.45%  | 2.69s           | $0.0022     |
| <code>gemini/gemini-3.6-flash</code>                   | Third-Party Service | 100.00      | 0.00%   | 0.98%  | 4.30s           | $0.0075     |
| <code>gemini/gemini-3.7-flash</code>                   | Third-Party Service | 100.00      | 0.00%   | 0.15%  | 5.03s           | $0.0153     |
| <code>gemini/gemini-3.8-flash</code>                   | Third-Party Service | 100.00      | 0.00%   | 0.76%  | 3.00s           | $0.0073     |
| <code>gemini/gemini-4-argon</code>                     | Third-Party Service | 100.00      | 0.00%   | 2.12%  | 11.36s          | $0.0205     |
| <code>grok/grok-4.5</code>                             | Third-Party Service | 73.08       | 26.92%  | 11.36% | 26.20s          | $0.0070     |
| <code>grok/grok-4.6</code>                             | Third-Party Service | 53.85       | 46.15%  | 24.70% | 62.57s          | $0.0069     |
| <code>kimi/kimi-k2.6</code>                            | Third-Party Service | 92.31       | 7.69%   | 5.91%  | 20.13s          | $0.0050     |
| <code>kimi/kimi-k3</code>                              | Third-Party Service | 100.00      | 0.00%   | 0.08%  | 170.14s         | $0.0399     |
| <code>mistral/mistral-ocr-4-0</code>                   | Third-Party Service | 76.92       | 23.08%  | 2.20%  | 1.54s           | $0.0040     |
| <code>mistral/mistral-ocr-4-1</code>                   | Third-Party Service | 96.15       | 3.85%   | 0.15%  | 1.78s           | $0.0040     |
| <code>openai/gpt-5.6-luna</code>                       | Third-Party Service | 65.38       | 34.62%  | 32.65% | 16.41s          | $0.0047     |
| <code>openai/gpt-5.6-sol</code>                        | Third-Party Service | 96.15       | 3.85%   | 7.95%  | 38.57s          | $0.1351     |
| <code>openai/gpt-5.6-terra</code>                      | Third-Party Service | 69.23       | 30.77%  | 25.76% | 12.58s          | $0.0258     |
| <code>openai/gpt-6-astra</code>                        | Third-Party Service | 100.00      | 0.00%   | 0.08%  | 31.88s          | $0.1640     |
| <code>openai/gpt-6-luna</code>                         | Third-Party Service | 96.15       | 3.85%   | 5.68%  | 42.32s          | $0.0025     |
| <code>openai/gpt-6.1-sol</code>                        | Third-Party Service | 100.00      | 0.00%   | 0.53%  | 24.12s          | $0.0274     |

## Error Breakdown (WER)

| Provider                                               | Substitutions | Deletions | Insertions | Ref. Words |
| ------------------------------------------------------ | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>                  | 0             | 0         | 0          | 26         |
| <code>anthropic/claude-fable-5-1</code>                | 0             | 0         | 0          | 26         |
| <code>anthropic/claude-haiku-5-5</code>                | 0             | 0         | 0          | 26         |
| <code>anthropic/claude-opus-5</code>                   | 6             | 0         | 0          | 26         |
| <code>anthropic/claude-opus-5-5</code>                 | 0             | 0         | 0          | 26         |
| <code>anthropic/claude-sonnet-5</code>                 | 0             | 4         | 6          | 26         |
| <code>anthropic/claude-sonnet-5-5</code>               | 0             | 0         | 0          | 26         |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 16            | 0         | 37         | 26         |
| <code>deepinfra/google/gemma-4-31B-it</code>           | 12            | 2         | 2          | 26         |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 13            | 0         | 2          | 26         |
| <code>gemini/gemini-3.5-flash</code>                   | 0             | 0         | 0          | 26         |
| <code>gemini/gemini-3.5-flash-lite</code>              | 0             | 0         | 0          | 26         |
| <code>gemini/gemini-3.6-flash</code>                   | 0             | 0         | 0          | 26         |
| <code>gemini/gemini-3.7-flash</code>                   | 0             | 0         | 0          | 26         |
| <code>gemini/gemini-3.8-flash</code>                   | 0             | 0         | 0          | 26         |
| <code>gemini/gemini-4-argon</code>                     | 0             | 0         | 0          | 26         |
| <code>grok/grok-4.5</code>                             | 3             | 4         | 0          | 26         |
| <code>grok/grok-4.6</code>                             | 3             | 6         | 3          | 26         |
| <code>kimi/kimi-k2.6</code>                            | 2             | 0         | 0          | 26         |
| <code>kimi/kimi-k3</code>                              | 0             | 0         | 0          | 26         |
| <code>mistral/mistral-ocr-4-0</code>                   | 2             | 4         | 0          | 26         |
| <code>mistral/mistral-ocr-4-1</code>                   | 1             | 0         | 0          | 26         |
| <code>openai/gpt-5.6-luna</code>                       | 3             | 6         | 0          | 26         |
| <code>openai/gpt-5.6-sol</code>                        | 0             | 1         | 0          | 26         |
| <code>openai/gpt-5.6-terra</code>                      | 6             | 2         | 0          | 26         |
| <code>openai/gpt-6-astra</code>                        | 0             | 0         | 0          | 26         |
| <code>openai/gpt-6-luna</code>                         | 0             | 0         | 1          | 26         |
| <code>openai/gpt-6.1-sol</code>                        | 0             | 0         | 0          | 26         |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0291¢ ($0.0003).
- Fastest cloud service: `mistral/mistral-ocr-4-0` at 1.54s.
