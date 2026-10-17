# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/ocr/01-medieval`
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

| Rank | Provider                                               | Value   | Score / 100 | WER   | CER   | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | ------: | ----------: | ----: | ----: | --------------: | ----------: |
| 1    | <code>deepinfra/google/gemma-4-31B-it</code>           | $0.0002 | 95.41       | 4.59% | 0.50% | 14.55s          | $0.0002     |
| 2    | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0004 | 95.87       | 4.13% | 0.42% | 23.98s          | $0.0004     |
| 3    | <code>anthropic/claude-haiku-5-5</code>                | $0.0005 | 97.71       | 2.29% | 0.34% | 9.39s           | $0.0005     |
| 4    | <code>openai/gpt-6-luna</code>                         | $0.0005 | 95.87       | 4.13% | 0.59% | 6.67s           | $0.0005     |
| 5    | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | $0.0011 | 90.37       | 9.63% | 1.77% | 6.80s           | $0.0011     |
| 6    | <code>openai/gpt-5.6-luna</code>                       | $0.0013 | 94.50       | 5.50% | 1.09% | 4.98s           | $0.0013     |
| 7    | <code>gemini/gemini-3.5-flash-lite</code>              | $0.0014 | 96.33       | 3.67% | 0.34% | 2.08s           | $0.0014     |
| 8    | <code>glm/glm-5.3-flash</code>                         | $0.0016 | 98.62       | 1.38% | 0.25% | 67.32s          | $0.0016     |
| 9    | <code>kimi/kimi-k2.6</code>                            | $0.0029 | 95.41       | 4.59% | 0.42% | 11.49s          | $0.0029     |
| 10   | <code>mistral/mistral-ocr-4-0</code>                   | $0.0040 | 98.17       | 1.83% | 0.34% | 1.44s           | $0.0040     |
| 11   | <code>mistral/mistral-ocr-4-1</code>                   | $0.0040 | 95.87       | 4.13% | 0.42% | 1.08s           | $0.0040     |
| 12   | <code>gemini/gemini-3.6-flash</code>                   | $0.0045 | 100.00      | 0.00% | 0.00% | 2.40s           | $0.0045     |
| 13   | <code>gemini/gemini-3.7-flash</code>                   | $0.0047 | 96.33       | 3.67% | 0.34% | 1.98s           | $0.0047     |
| 14   | <code>gemini/gemini-3.8-flash</code>                   | $0.0048 | 96.33       | 3.67% | 0.34% | 2.26s           | $0.0048     |
| 15   | <code>grok/grok-4.5</code>                             | $0.0049 | 95.87       | 4.13% | 0.42% | 15.98s          | $0.0049     |
| 16   | <code>grok/grok-4.6</code>                             | $0.0052 | 96.33       | 3.67% | 0.34% | 32.45s          | $0.0052     |
| 17   | <code>gemini/gemini-3.5-flash</code>                   | $0.0054 | 96.33       | 3.67% | 0.34% | 2.83s           | $0.0054     |
| 18   | <code>openai/gpt-6.1-sol</code>                        | $0.0070 | 96.33       | 3.67% | 0.34% | 6.01s           | $0.0070     |
| 19   | <code>anthropic/claude-sonnet-5</code>                 | $0.0096 | 96.33       | 3.67% | 0.34% | 11.74s          | $0.0096     |
| 20   | <code>anthropic/claude-sonnet-5-5</code>               | $0.0096 | 96.33       | 3.67% | 0.34% | 4.52s           | $0.0096     |
| 21   | <code>grok/grok-4.7</code>                             | $0.0128 | 96.33       | 3.67% | 0.34% | 13.51s          | $0.0128     |
| 22   | <code>gemini/gemini-4-argon</code>                     | $0.0129 | 100.00      | 0.00% | 0.00% | 7.37s           | $0.0129     |
| 23   | <code>openai/gpt-5.6-terra</code>                      | $0.0184 | 93.12       | 6.88% | 1.77% | 11.82s          | $0.0184     |
| 24   | <code>anthropic/claude-opus-5-5</code>                 | $0.0192 | 100.00      | 0.00% | 0.00% | 10.82s          | $0.0192     |
| 25   | <code>anthropic/claude-opus-5</code>                   | $0.0225 | 99.54       | 0.46% | 0.08% | 12.39s          | $0.0225     |
| 26   | <code>openai/gpt-6-astra</code>                        | $0.0350 | 96.33       | 3.67% | 0.34% | 6.69s           | $0.0350     |
| 27   | <code>openai/gpt-5.6-sol</code>                        | $0.0470 | 96.33       | 3.67% | 0.34% | 14.48s          | $0.0470     |
| 28   | <code>anthropic/claude-fable-5-1</code>                | $0.0476 | 96.33       | 3.67% | 0.34% | 12.54s          | $0.0476     |
| 29   | <code>anthropic/claude-fable-5</code>                  | $0.0485 | 96.33       | 3.67% | 0.34% | 12.47s          | $0.0485     |
| 30   | <code>kimi/kimi-k3</code>                              | $0.0518 | 95.87       | 4.13% | 0.42% | 92.00s          | $0.0518     |

#### Speed

| Rank | Provider                                               | Value  | Score / 100 | WER   | CER   | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | -----: | ----------: | ----: | ----: | --------------: | ----------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>                   | 1.08s  | 95.87       | 4.13% | 0.42% | 1.08s           | $0.0040     |
| 2    | <code>mistral/mistral-ocr-4-0</code>                   | 1.44s  | 98.17       | 1.83% | 0.34% | 1.44s           | $0.0040     |
| 3    | <code>gemini/gemini-3.7-flash</code>                   | 1.98s  | 96.33       | 3.67% | 0.34% | 1.98s           | $0.0047     |
| 4    | <code>gemini/gemini-3.5-flash-lite</code>              | 2.08s  | 96.33       | 3.67% | 0.34% | 2.08s           | $0.0014     |
| 5    | <code>gemini/gemini-3.8-flash</code>                   | 2.26s  | 96.33       | 3.67% | 0.34% | 2.26s           | $0.0048     |
| 6    | <code>gemini/gemini-3.6-flash</code>                   | 2.40s  | 100.00      | 0.00% | 0.00% | 2.40s           | $0.0045     |
| 7    | <code>gemini/gemini-3.5-flash</code>                   | 2.83s  | 96.33       | 3.67% | 0.34% | 2.83s           | $0.0054     |
| 8    | <code>anthropic/claude-sonnet-5-5</code>               | 4.52s  | 96.33       | 3.67% | 0.34% | 4.52s           | $0.0096     |
| 9    | <code>openai/gpt-5.6-luna</code>                       | 4.98s  | 94.50       | 5.50% | 1.09% | 4.98s           | $0.0013     |
| 10   | <code>openai/gpt-6.1-sol</code>                        | 6.01s  | 96.33       | 3.67% | 0.34% | 6.01s           | $0.0070     |
| 11   | <code>openai/gpt-6-luna</code>                         | 6.67s  | 95.87       | 4.13% | 0.59% | 6.67s           | $0.0005     |
| 12   | <code>openai/gpt-6-astra</code>                        | 6.69s  | 96.33       | 3.67% | 0.34% | 6.69s           | $0.0350     |
| 13   | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 6.80s  | 90.37       | 9.63% | 1.77% | 6.80s           | $0.0011     |
| 14   | <code>gemini/gemini-4-argon</code>                     | 7.37s  | 100.00      | 0.00% | 0.00% | 7.37s           | $0.0129     |
| 15   | <code>anthropic/claude-haiku-5-5</code>                | 9.39s  | 97.71       | 2.29% | 0.34% | 9.39s           | $0.0005     |
| 16   | <code>anthropic/claude-opus-5-5</code>                 | 10.82s | 100.00      | 0.00% | 0.00% | 10.82s          | $0.0192     |
| 17   | <code>kimi/kimi-k2.6</code>                            | 11.49s | 95.41       | 4.59% | 0.42% | 11.49s          | $0.0029     |
| 18   | <code>anthropic/claude-sonnet-5</code>                 | 11.74s | 96.33       | 3.67% | 0.34% | 11.74s          | $0.0096     |
| 19   | <code>openai/gpt-5.6-terra</code>                      | 11.82s | 93.12       | 6.88% | 1.77% | 11.82s          | $0.0184     |
| 20   | <code>anthropic/claude-opus-5</code>                   | 12.39s | 99.54       | 0.46% | 0.08% | 12.39s          | $0.0225     |
| 21   | <code>anthropic/claude-fable-5</code>                  | 12.47s | 96.33       | 3.67% | 0.34% | 12.47s          | $0.0485     |
| 22   | <code>anthropic/claude-fable-5-1</code>                | 12.54s | 96.33       | 3.67% | 0.34% | 12.54s          | $0.0476     |
| 23   | <code>grok/grok-4.7</code>                             | 13.51s | 96.33       | 3.67% | 0.34% | 13.51s          | $0.0128     |
| 24   | <code>openai/gpt-5.6-sol</code>                        | 14.48s | 96.33       | 3.67% | 0.34% | 14.48s          | $0.0470     |
| 25   | <code>deepinfra/google/gemma-4-31B-it</code>           | 14.55s | 95.41       | 4.59% | 0.50% | 14.55s          | $0.0002     |
| 26   | <code>grok/grok-4.5</code>                             | 15.98s | 95.87       | 4.13% | 0.42% | 15.98s          | $0.0049     |
| 27   | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 23.98s | 95.87       | 4.13% | 0.42% | 23.98s          | $0.0004     |
| 28   | <code>grok/grok-4.6</code>                             | 32.45s | 96.33       | 3.67% | 0.34% | 32.45s          | $0.0052     |
| 29   | <code>glm/glm-5.3-flash</code>                         | 67.32s | 98.62       | 1.38% | 0.25% | 67.32s          | $0.0016     |
| 30   | <code>kimi/kimi-k3</code>                              | 92.00s | 95.87       | 4.13% | 0.42% | 92.00s          | $0.0518     |

#### Quality Score

| Rank | Provider                                               | Value                    | Score / 100 | WER   | CER   | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | -----------------------: | ----------: | ----: | ----: | --------------: | ----------: |
| 1    | <code>anthropic/claude-opus-5-5</code>                 | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 10.82s          | $0.0192     |
| 2    | <code>gemini/gemini-3.6-flash</code>                   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.40s           | $0.0045     |
| 3    | <code>gemini/gemini-4-argon</code>                     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 7.37s           | $0.0129     |
| 4    | <code>anthropic/claude-opus-5</code>                   | 99.54/100 quality score  | 99.54       | 0.46% | 0.08% | 12.39s          | $0.0225     |
| 5    | <code>glm/glm-5.3-flash</code>                         | 98.62/100 quality score  | 98.62       | 1.38% | 0.25% | 67.32s          | $0.0016     |
| 6    | <code>mistral/mistral-ocr-4-0</code>                   | 98.17/100 quality score  | 98.17       | 1.83% | 0.34% | 1.44s           | $0.0040     |
| 7    | <code>anthropic/claude-haiku-5-5</code>                | 97.71/100 quality score  | 97.71       | 2.29% | 0.34% | 9.39s           | $0.0005     |
| 8    | <code>anthropic/claude-fable-5</code>                  | 96.33/100 quality score  | 96.33       | 3.67% | 0.34% | 12.47s          | $0.0485     |
| 9    | <code>anthropic/claude-fable-5-1</code>                | 96.33/100 quality score  | 96.33       | 3.67% | 0.34% | 12.54s          | $0.0476     |
| 10   | <code>anthropic/claude-sonnet-5</code>                 | 96.33/100 quality score  | 96.33       | 3.67% | 0.34% | 11.74s          | $0.0096     |
| 11   | <code>anthropic/claude-sonnet-5-5</code>               | 96.33/100 quality score  | 96.33       | 3.67% | 0.34% | 4.52s           | $0.0096     |
| 12   | <code>gemini/gemini-3.5-flash</code>                   | 96.33/100 quality score  | 96.33       | 3.67% | 0.34% | 2.83s           | $0.0054     |
| 13   | <code>gemini/gemini-3.5-flash-lite</code>              | 96.33/100 quality score  | 96.33       | 3.67% | 0.34% | 2.08s           | $0.0014     |
| 14   | <code>gemini/gemini-3.7-flash</code>                   | 96.33/100 quality score  | 96.33       | 3.67% | 0.34% | 1.98s           | $0.0047     |
| 15   | <code>gemini/gemini-3.8-flash</code>                   | 96.33/100 quality score  | 96.33       | 3.67% | 0.34% | 2.26s           | $0.0048     |
| 16   | <code>grok/grok-4.6</code>                             | 96.33/100 quality score  | 96.33       | 3.67% | 0.34% | 32.45s          | $0.0052     |
| 17   | <code>grok/grok-4.7</code>                             | 96.33/100 quality score  | 96.33       | 3.67% | 0.34% | 13.51s          | $0.0128     |
| 18   | <code>openai/gpt-5.6-sol</code>                        | 96.33/100 quality score  | 96.33       | 3.67% | 0.34% | 14.48s          | $0.0470     |
| 19   | <code>openai/gpt-6-astra</code>                        | 96.33/100 quality score  | 96.33       | 3.67% | 0.34% | 6.69s           | $0.0350     |
| 20   | <code>openai/gpt-6.1-sol</code>                        | 96.33/100 quality score  | 96.33       | 3.67% | 0.34% | 6.01s           | $0.0070     |
| 21   | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 95.87/100 quality score  | 95.87       | 4.13% | 0.42% | 23.98s          | $0.0004     |
| 22   | <code>grok/grok-4.5</code>                             | 95.87/100 quality score  | 95.87       | 4.13% | 0.42% | 15.98s          | $0.0049     |
| 23   | <code>kimi/kimi-k3</code>                              | 95.87/100 quality score  | 95.87       | 4.13% | 0.42% | 92.00s          | $0.0518     |
| 24   | <code>mistral/mistral-ocr-4-1</code>                   | 95.87/100 quality score  | 95.87       | 4.13% | 0.42% | 1.08s           | $0.0040     |
| 25   | <code>openai/gpt-6-luna</code>                         | 95.87/100 quality score  | 95.87       | 4.13% | 0.59% | 6.67s           | $0.0005     |
| 26   | <code>kimi/kimi-k2.6</code>                            | 95.41/100 quality score  | 95.41       | 4.59% | 0.42% | 11.49s          | $0.0029     |
| 27   | <code>deepinfra/google/gemma-4-31B-it</code>           | 95.41/100 quality score  | 95.41       | 4.59% | 0.50% | 14.55s          | $0.0002     |
| 28   | <code>openai/gpt-5.6-luna</code>                       | 94.50/100 quality score  | 94.50       | 5.50% | 1.09% | 4.98s           | $0.0013     |
| 29   | <code>openai/gpt-5.6-terra</code>                      | 93.12/100 quality score  | 93.12       | 6.88% | 1.77% | 11.82s          | $0.0184     |
| 30   | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 90.37/100 quality score  | 90.37       | 9.63% | 1.77% | 6.80s           | $0.0011     |


## Provider Detail

| Provider                                               | Group               | Score / 100 | WER   | CER   | Processing Time | Actual Cost |
| ------------------------------------------------------ | ------------------- | ----------: | ----: | ----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>                  | Third-Party Service | 96.33       | 3.67% | 0.34% | 12.47s          | $0.0485     |
| <code>anthropic/claude-fable-5-1</code>                | Third-Party Service | 96.33       | 3.67% | 0.34% | 12.54s          | $0.0476     |
| <code>anthropic/claude-haiku-5-5</code>                | Third-Party Service | 97.71       | 2.29% | 0.34% | 9.39s           | $0.0005     |
| <code>anthropic/claude-opus-5</code>                   | Third-Party Service | 99.54       | 0.46% | 0.08% | 12.39s          | $0.0225     |
| <code>anthropic/claude-opus-5-5</code>                 | Third-Party Service | 100.00      | 0.00% | 0.00% | 10.82s          | $0.0192     |
| <code>anthropic/claude-sonnet-5</code>                 | Third-Party Service | 96.33       | 3.67% | 0.34% | 11.74s          | $0.0096     |
| <code>anthropic/claude-sonnet-5-5</code>               | Third-Party Service | 96.33       | 3.67% | 0.34% | 4.52s           | $0.0096     |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 95.87       | 4.13% | 0.42% | 23.98s          | $0.0004     |
| <code>deepinfra/google/gemma-4-31B-it</code>           | Third-Party Service | 95.41       | 4.59% | 0.50% | 14.55s          | $0.0002     |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>                | Third-Party Service | 90.37       | 9.63% | 1.77% | 6.80s           | $0.0011     |
| <code>gemini/gemini-3.5-flash</code>                   | Third-Party Service | 96.33       | 3.67% | 0.34% | 2.83s           | $0.0054     |
| <code>gemini/gemini-3.5-flash-lite</code>              | Third-Party Service | 96.33       | 3.67% | 0.34% | 2.08s           | $0.0014     |
| <code>gemini/gemini-3.6-flash</code>                   | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.40s           | $0.0045     |
| <code>gemini/gemini-3.7-flash</code>                   | Third-Party Service | 96.33       | 3.67% | 0.34% | 1.98s           | $0.0047     |
| <code>gemini/gemini-3.8-flash</code>                   | Third-Party Service | 96.33       | 3.67% | 0.34% | 2.26s           | $0.0048     |
| <code>gemini/gemini-4-argon</code>                     | Third-Party Service | 100.00      | 0.00% | 0.00% | 7.37s           | $0.0129     |
| <code>glm/glm-5.3-flash</code>                         | Third-Party Service | 98.62       | 1.38% | 0.25% | 67.32s          | $0.0016     |
| <code>grok/grok-4.5</code>                             | Third-Party Service | 95.87       | 4.13% | 0.42% | 15.98s          | $0.0049     |
| <code>grok/grok-4.6</code>                             | Third-Party Service | 96.33       | 3.67% | 0.34% | 32.45s          | $0.0052     |
| <code>grok/grok-4.7</code>                             | Third-Party Service | 96.33       | 3.67% | 0.34% | 13.51s          | $0.0128     |
| <code>kimi/kimi-k2.6</code>                            | Third-Party Service | 95.41       | 4.59% | 0.42% | 11.49s          | $0.0029     |
| <code>kimi/kimi-k3</code>                              | Third-Party Service | 95.87       | 4.13% | 0.42% | 92.00s          | $0.0518     |
| <code>mistral/mistral-ocr-4-0</code>                   | Third-Party Service | 98.17       | 1.83% | 0.34% | 1.44s           | $0.0040     |
| <code>mistral/mistral-ocr-4-1</code>                   | Third-Party Service | 95.87       | 4.13% | 0.42% | 1.08s           | $0.0040     |
| <code>openai/gpt-5.6-luna</code>                       | Third-Party Service | 94.50       | 5.50% | 1.09% | 4.98s           | $0.0013     |
| <code>openai/gpt-5.6-sol</code>                        | Third-Party Service | 96.33       | 3.67% | 0.34% | 14.48s          | $0.0470     |
| <code>openai/gpt-5.6-terra</code>                      | Third-Party Service | 93.12       | 6.88% | 1.77% | 11.82s          | $0.0184     |
| <code>openai/gpt-6-astra</code>                        | Third-Party Service | 96.33       | 3.67% | 0.34% | 6.69s           | $0.0350     |
| <code>openai/gpt-6-luna</code>                         | Third-Party Service | 95.87       | 4.13% | 0.59% | 6.67s           | $0.0005     |
| <code>openai/gpt-6.1-sol</code>                        | Third-Party Service | 96.33       | 3.67% | 0.34% | 6.01s           | $0.0070     |

## Error Breakdown (WER)

| Provider                                               | Substitutions | Deletions | Insertions | Ref. Words |
| ------------------------------------------------------ | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>                  | 4             | 0         | 4          | 218        |
| <code>anthropic/claude-fable-5-1</code>                | 4             | 0         | 4          | 218        |
| <code>anthropic/claude-haiku-5-5</code>                | 4             | 0         | 1          | 218        |
| <code>anthropic/claude-opus-5</code>                   | 1             | 0         | 0          | 218        |
| <code>anthropic/claude-opus-5-5</code>                 | 0             | 0         | 0          | 218        |
| <code>anthropic/claude-sonnet-5</code>                 | 4             | 0         | 4          | 218        |
| <code>anthropic/claude-sonnet-5-5</code>               | 4             | 0         | 4          | 218        |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 5             | 0         | 4          | 218        |
| <code>deepinfra/google/gemma-4-31B-it</code>           | 6             | 0         | 4          | 218        |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 13            | 0         | 8          | 218        |
| <code>gemini/gemini-3.5-flash</code>                   | 4             | 0         | 4          | 218        |
| <code>gemini/gemini-3.5-flash-lite</code>              | 4             | 0         | 4          | 218        |
| <code>gemini/gemini-3.6-flash</code>                   | 0             | 0         | 0          | 218        |
| <code>gemini/gemini-3.7-flash</code>                   | 4             | 0         | 4          | 218        |
| <code>gemini/gemini-3.8-flash</code>                   | 4             | 0         | 4          | 218        |
| <code>gemini/gemini-4-argon</code>                     | 0             | 0         | 0          | 218        |
| <code>glm/glm-5.3-flash</code>                         | 3             | 0         | 0          | 218        |
| <code>grok/grok-4.5</code>                             | 5             | 0         | 4          | 218        |
| <code>grok/grok-4.6</code>                             | 4             | 0         | 4          | 218        |
| <code>grok/grok-4.7</code>                             | 4             | 0         | 4          | 218        |
| <code>kimi/kimi-k2.6</code>                            | 5             | 1         | 4          | 218        |
| <code>kimi/kimi-k3</code>                              | 5             | 0         | 4          | 218        |
| <code>mistral/mistral-ocr-4-0</code>                   | 4             | 0         | 0          | 218        |
| <code>mistral/mistral-ocr-4-1</code>                   | 4             | 0         | 5          | 218        |
| <code>openai/gpt-5.6-luna</code>                       | 7             | 0         | 5          | 218        |
| <code>openai/gpt-5.6-sol</code>                        | 4             | 0         | 4          | 218        |
| <code>openai/gpt-5.6-terra</code>                      | 9             | 2         | 4          | 218        |
| <code>openai/gpt-6-astra</code>                        | 4             | 0         | 4          | 218        |
| <code>openai/gpt-6-luna</code>                         | 5             | 0         | 4          | 218        |
| <code>openai/gpt-6.1-sol</code>                        | 4             | 0         | 4          | 218        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best cloud service: `anthropic/claude-opus-5-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0183¢ ($0.0002).
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.08s.
