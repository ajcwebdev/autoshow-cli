# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/ocr/01-test-picture`
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
| 1    | <code>deepinfra/google/gemma-4-31B-it</code>           | $0.0001 | 100.00      | 0.00% | 0.00% | 2.25s           | $0.0001     |
| 2    | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0001 | 100.00      | 0.00% | 0.00% | 2.04s           | $0.0001     |
| 3    | <code>openai/gpt-6-luna</code>                         | $0.0002 | 100.00      | 0.00% | 0.00% | 2.39s           | $0.0002     |
| 4    | <code>anthropic/claude-haiku-5-5</code>                | $0.0002 | 100.00      | 0.00% | 0.00% | 3.99s           | $0.0002     |
| 5    | <code>glm/glm-5.3-flash</code>                         | $0.0002 | 100.00      | 0.00% | 0.00% | 3.35s           | $0.0002     |
| 6    | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | $0.0003 | 100.00      | 0.00% | 0.00% | 1.49s           | $0.0003     |
| 7    | <code>openai/gpt-5.6-luna</code>                       | $0.0003 | 100.00      | 0.00% | 0.00% | 1.03s           | $0.0003     |
| 8    | <code>gemini/gemini-3.5-flash-lite</code>              | $0.0005 | 100.00      | 0.00% | 0.00% | 0.91s           | $0.0005     |
| 9    | <code>kimi/kimi-k2.6</code>                            | $0.0014 | 100.00      | 0.00% | 0.00% | 2.81s           | $0.0014     |
| 10   | <code>gemini/gemini-3.5-flash</code>                   | $0.0022 | 100.00      | 0.00% | 0.00% | 1.28s           | $0.0022     |
| 11   | <code>gemini/gemini-3.6-flash</code>                   | $0.0023 | 100.00      | 0.00% | 0.00% | 1.14s           | $0.0023     |
| 12   | <code>openai/gpt-6.1-sol</code>                        | $0.0027 | 100.00      | 0.00% | 0.00% | 1.99s           | $0.0027     |
| 13   | <code>openai/gpt-5.6-terra</code>                      | $0.0028 | 100.00      | 0.00% | 0.00% | 1.07s           | $0.0028     |
| 14   | <code>gemini/gemini-3.8-flash</code>                   | $0.0028 | 100.00      | 0.00% | 0.00% | 2.09s           | $0.0028     |
| 15   | <code>grok/grok-4.5</code>                             | $0.0032 | 100.00      | 0.00% | 0.00% | 2.22s           | $0.0032     |
| 16   | <code>gemini/gemini-3.7-flash</code>                   | $0.0032 | 100.00      | 0.00% | 0.00% | 1.80s           | $0.0032     |
| 17   | <code>grok/grok-4.6</code>                             | $0.0035 | 100.00      | 0.00% | 0.00% | 3.30s           | $0.0035     |
| 18   | <code>anthropic/claude-sonnet-5</code>                 | $0.0038 | 100.00      | 0.00% | 0.00% | 1.79s           | $0.0038     |
| 19   | <code>mistral/mistral-ocr-4-0</code>                   | $0.0040 | 100.00      | 0.00% | 0.00% | 0.60s           | $0.0040     |
| 20   | <code>mistral/mistral-ocr-4-1</code>                   | $0.0040 | 100.00      | 0.00% | 0.00% | 0.58s           | $0.0040     |
| 21   | <code>anthropic/claude-sonnet-5-5</code>               | $0.0044 | 100.00      | 0.00% | 0.00% | 2.04s           | $0.0044     |
| 22   | <code>grok/grok-4.7</code>                             | $0.0050 | 100.00      | 0.00% | 0.00% | 1.66s           | $0.0050     |
| 23   | <code>gemini/gemini-4-argon</code>                     | $0.0068 | 100.00      | 0.00% | 0.00% | 3.00s           | $0.0068     |
| 24   | <code>openai/gpt-5.6-sol</code>                        | $0.0070 | 100.00      | 0.00% | 0.00% | 1.43s           | $0.0070     |
| 25   | <code>kimi/kimi-k3</code>                              | $0.0082 | 100.00      | 0.00% | 0.00% | 13.05s          | $0.0082     |
| 26   | <code>anthropic/claude-opus-5-5</code>                 | $0.0088 | 100.00      | 0.00% | 0.00% | 4.02s           | $0.0088     |
| 27   | <code>anthropic/claude-opus-5</code>                   | $0.0095 | 100.00      | 0.00% | 0.00% | 1.98s           | $0.0095     |
| 28   | <code>openai/gpt-6-astra</code>                        | $0.0137 | 100.00      | 0.00% | 0.00% | 1.94s           | $0.0137     |
| 29   | <code>anthropic/claude-fable-5</code>                  | $0.0189 | 100.00      | 0.00% | 0.00% | 3.77s           | $0.0189     |
| 30   | <code>anthropic/claude-fable-5-1</code>                | $0.0189 | 100.00      | 0.00% | 0.00% | 2.73s           | $0.0189     |

#### Speed

| Rank | Provider                                               | Value  | Score / 100 | WER   | CER   | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | -----: | ----------: | ----: | ----: | --------------: | ----------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>                   | 0.58s  | 100.00      | 0.00% | 0.00% | 0.58s           | $0.0040     |
| 2    | <code>mistral/mistral-ocr-4-0</code>                   | 0.60s  | 100.00      | 0.00% | 0.00% | 0.60s           | $0.0040     |
| 3    | <code>gemini/gemini-3.5-flash-lite</code>              | 0.91s  | 100.00      | 0.00% | 0.00% | 0.91s           | $0.0005     |
| 4    | <code>openai/gpt-5.6-luna</code>                       | 1.03s  | 100.00      | 0.00% | 0.00% | 1.03s           | $0.0003     |
| 5    | <code>openai/gpt-5.6-terra</code>                      | 1.07s  | 100.00      | 0.00% | 0.00% | 1.07s           | $0.0028     |
| 6    | <code>gemini/gemini-3.6-flash</code>                   | 1.14s  | 100.00      | 0.00% | 0.00% | 1.14s           | $0.0023     |
| 7    | <code>gemini/gemini-3.5-flash</code>                   | 1.28s  | 100.00      | 0.00% | 0.00% | 1.28s           | $0.0022     |
| 8    | <code>openai/gpt-5.6-sol</code>                        | 1.43s  | 100.00      | 0.00% | 0.00% | 1.43s           | $0.0070     |
| 9    | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 1.49s  | 100.00      | 0.00% | 0.00% | 1.49s           | $0.0003     |
| 10   | <code>grok/grok-4.7</code>                             | 1.66s  | 100.00      | 0.00% | 0.00% | 1.66s           | $0.0050     |
| 11   | <code>anthropic/claude-sonnet-5</code>                 | 1.79s  | 100.00      | 0.00% | 0.00% | 1.79s           | $0.0038     |
| 12   | <code>gemini/gemini-3.7-flash</code>                   | 1.80s  | 100.00      | 0.00% | 0.00% | 1.80s           | $0.0032     |
| 13   | <code>openai/gpt-6-astra</code>                        | 1.94s  | 100.00      | 0.00% | 0.00% | 1.94s           | $0.0137     |
| 14   | <code>anthropic/claude-opus-5</code>                   | 1.98s  | 100.00      | 0.00% | 0.00% | 1.98s           | $0.0095     |
| 15   | <code>openai/gpt-6.1-sol</code>                        | 1.99s  | 100.00      | 0.00% | 0.00% | 1.99s           | $0.0027     |
| 16   | <code>anthropic/claude-sonnet-5-5</code>               | 2.04s  | 100.00      | 0.00% | 0.00% | 2.04s           | $0.0044     |
| 17   | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 2.04s  | 100.00      | 0.00% | 0.00% | 2.04s           | $0.0001     |
| 18   | <code>gemini/gemini-3.8-flash</code>                   | 2.09s  | 100.00      | 0.00% | 0.00% | 2.09s           | $0.0028     |
| 19   | <code>grok/grok-4.5</code>                             | 2.22s  | 100.00      | 0.00% | 0.00% | 2.22s           | $0.0032     |
| 20   | <code>deepinfra/google/gemma-4-31B-it</code>           | 2.25s  | 100.00      | 0.00% | 0.00% | 2.25s           | $0.0001     |
| 21   | <code>openai/gpt-6-luna</code>                         | 2.39s  | 100.00      | 0.00% | 0.00% | 2.39s           | $0.0002     |
| 22   | <code>anthropic/claude-fable-5-1</code>                | 2.73s  | 100.00      | 0.00% | 0.00% | 2.73s           | $0.0189     |
| 23   | <code>kimi/kimi-k2.6</code>                            | 2.81s  | 100.00      | 0.00% | 0.00% | 2.81s           | $0.0014     |
| 24   | <code>gemini/gemini-4-argon</code>                     | 3.00s  | 100.00      | 0.00% | 0.00% | 3.00s           | $0.0068     |
| 25   | <code>grok/grok-4.6</code>                             | 3.30s  | 100.00      | 0.00% | 0.00% | 3.30s           | $0.0035     |
| 26   | <code>glm/glm-5.3-flash</code>                         | 3.35s  | 100.00      | 0.00% | 0.00% | 3.35s           | $0.0002     |
| 27   | <code>anthropic/claude-fable-5</code>                  | 3.77s  | 100.00      | 0.00% | 0.00% | 3.77s           | $0.0189     |
| 28   | <code>anthropic/claude-haiku-5-5</code>                | 3.99s  | 100.00      | 0.00% | 0.00% | 3.99s           | $0.0002     |
| 29   | <code>anthropic/claude-opus-5-5</code>                 | 4.02s  | 100.00      | 0.00% | 0.00% | 4.02s           | $0.0088     |
| 30   | <code>kimi/kimi-k3</code>                              | 13.05s | 100.00      | 0.00% | 0.00% | 13.05s          | $0.0082     |

#### Quality Score

| Rank | Provider                                               | Value                    | Score / 100 | WER   | CER   | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | -----------------------: | ----------: | ----: | ----: | --------------: | ----------: |
| 1    | <code>anthropic/claude-fable-5</code>                  | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 3.77s           | $0.0189     |
| 2    | <code>anthropic/claude-fable-5-1</code>                | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.73s           | $0.0189     |
| 3    | <code>anthropic/claude-haiku-5-5</code>                | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 3.99s           | $0.0002     |
| 4    | <code>anthropic/claude-opus-5</code>                   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 1.98s           | $0.0095     |
| 5    | <code>anthropic/claude-opus-5-5</code>                 | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 4.02s           | $0.0088     |
| 6    | <code>anthropic/claude-sonnet-5</code>                 | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 1.79s           | $0.0038     |
| 7    | <code>anthropic/claude-sonnet-5-5</code>               | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.04s           | $0.0044     |
| 8    | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.04s           | $0.0001     |
| 9    | <code>deepinfra/google/gemma-4-31B-it</code>           | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.25s           | $0.0001     |
| 10   | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 1.49s           | $0.0003     |
| 11   | <code>gemini/gemini-3.5-flash</code>                   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 1.28s           | $0.0022     |
| 12   | <code>gemini/gemini-3.5-flash-lite</code>              | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 0.91s           | $0.0005     |
| 13   | <code>gemini/gemini-3.6-flash</code>                   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 1.14s           | $0.0023     |
| 14   | <code>gemini/gemini-3.7-flash</code>                   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 1.80s           | $0.0032     |
| 15   | <code>gemini/gemini-3.8-flash</code>                   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.09s           | $0.0028     |
| 16   | <code>gemini/gemini-4-argon</code>                     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 3.00s           | $0.0068     |
| 17   | <code>glm/glm-5.3-flash</code>                         | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 3.35s           | $0.0002     |
| 18   | <code>grok/grok-4.5</code>                             | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.22s           | $0.0032     |
| 19   | <code>grok/grok-4.6</code>                             | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 3.30s           | $0.0035     |
| 20   | <code>grok/grok-4.7</code>                             | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 1.66s           | $0.0050     |
| 21   | <code>kimi/kimi-k2.6</code>                            | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.81s           | $0.0014     |
| 22   | <code>kimi/kimi-k3</code>                              | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 13.05s          | $0.0082     |
| 23   | <code>mistral/mistral-ocr-4-0</code>                   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 0.60s           | $0.0040     |
| 24   | <code>mistral/mistral-ocr-4-1</code>                   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 0.58s           | $0.0040     |
| 25   | <code>openai/gpt-5.6-luna</code>                       | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 1.03s           | $0.0003     |
| 26   | <code>openai/gpt-5.6-sol</code>                        | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 1.43s           | $0.0070     |
| 27   | <code>openai/gpt-5.6-terra</code>                      | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 1.07s           | $0.0028     |
| 28   | <code>openai/gpt-6-astra</code>                        | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 1.94s           | $0.0137     |
| 29   | <code>openai/gpt-6-luna</code>                         | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.39s           | $0.0002     |
| 30   | <code>openai/gpt-6.1-sol</code>                        | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 1.99s           | $0.0027     |


## Provider Detail

| Provider                                               | Group               | Score / 100 | WER   | CER   | Processing Time | Actual Cost |
| ------------------------------------------------------ | ------------------- | ----------: | ----: | ----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>                  | Third-Party Service | 100.00      | 0.00% | 0.00% | 3.77s           | $0.0189     |
| <code>anthropic/claude-fable-5-1</code>                | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.73s           | $0.0189     |
| <code>anthropic/claude-haiku-5-5</code>                | Third-Party Service | 100.00      | 0.00% | 0.00% | 3.99s           | $0.0002     |
| <code>anthropic/claude-opus-5</code>                   | Third-Party Service | 100.00      | 0.00% | 0.00% | 1.98s           | $0.0095     |
| <code>anthropic/claude-opus-5-5</code>                 | Third-Party Service | 100.00      | 0.00% | 0.00% | 4.02s           | $0.0088     |
| <code>anthropic/claude-sonnet-5</code>                 | Third-Party Service | 100.00      | 0.00% | 0.00% | 1.79s           | $0.0038     |
| <code>anthropic/claude-sonnet-5-5</code>               | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.04s           | $0.0044     |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.04s           | $0.0001     |
| <code>deepinfra/google/gemma-4-31B-it</code>           | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.25s           | $0.0001     |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>                | Third-Party Service | 100.00      | 0.00% | 0.00% | 1.49s           | $0.0003     |
| <code>gemini/gemini-3.5-flash</code>                   | Third-Party Service | 100.00      | 0.00% | 0.00% | 1.28s           | $0.0022     |
| <code>gemini/gemini-3.5-flash-lite</code>              | Third-Party Service | 100.00      | 0.00% | 0.00% | 0.91s           | $0.0005     |
| <code>gemini/gemini-3.6-flash</code>                   | Third-Party Service | 100.00      | 0.00% | 0.00% | 1.14s           | $0.0023     |
| <code>gemini/gemini-3.7-flash</code>                   | Third-Party Service | 100.00      | 0.00% | 0.00% | 1.80s           | $0.0032     |
| <code>gemini/gemini-3.8-flash</code>                   | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.09s           | $0.0028     |
| <code>gemini/gemini-4-argon</code>                     | Third-Party Service | 100.00      | 0.00% | 0.00% | 3.00s           | $0.0068     |
| <code>glm/glm-5.3-flash</code>                         | Third-Party Service | 100.00      | 0.00% | 0.00% | 3.35s           | $0.0002     |
| <code>grok/grok-4.5</code>                             | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.22s           | $0.0032     |
| <code>grok/grok-4.6</code>                             | Third-Party Service | 100.00      | 0.00% | 0.00% | 3.30s           | $0.0035     |
| <code>grok/grok-4.7</code>                             | Third-Party Service | 100.00      | 0.00% | 0.00% | 1.66s           | $0.0050     |
| <code>kimi/kimi-k2.6</code>                            | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.81s           | $0.0014     |
| <code>kimi/kimi-k3</code>                              | Third-Party Service | 100.00      | 0.00% | 0.00% | 13.05s          | $0.0082     |
| <code>mistral/mistral-ocr-4-0</code>                   | Third-Party Service | 100.00      | 0.00% | 0.00% | 0.60s           | $0.0040     |
| <code>mistral/mistral-ocr-4-1</code>                   | Third-Party Service | 100.00      | 0.00% | 0.00% | 0.58s           | $0.0040     |
| <code>openai/gpt-5.6-luna</code>                       | Third-Party Service | 100.00      | 0.00% | 0.00% | 1.03s           | $0.0003     |
| <code>openai/gpt-5.6-sol</code>                        | Third-Party Service | 100.00      | 0.00% | 0.00% | 1.43s           | $0.0070     |
| <code>openai/gpt-5.6-terra</code>                      | Third-Party Service | 100.00      | 0.00% | 0.00% | 1.07s           | $0.0028     |
| <code>openai/gpt-6-astra</code>                        | Third-Party Service | 100.00      | 0.00% | 0.00% | 1.94s           | $0.0137     |
| <code>openai/gpt-6-luna</code>                         | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.39s           | $0.0002     |
| <code>openai/gpt-6.1-sol</code>                        | Third-Party Service | 100.00      | 0.00% | 0.00% | 1.99s           | $0.0027     |

## Error Breakdown (WER)

| Provider                                               | Substitutions | Deletions | Insertions | Ref. Words |
| ------------------------------------------------------ | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>                  | 0             | 0         | 0          | 20         |
| <code>anthropic/claude-fable-5-1</code>                | 0             | 0         | 0          | 20         |
| <code>anthropic/claude-haiku-5-5</code>                | 0             | 0         | 0          | 20         |
| <code>anthropic/claude-opus-5</code>                   | 0             | 0         | 0          | 20         |
| <code>anthropic/claude-opus-5-5</code>                 | 0             | 0         | 0          | 20         |
| <code>anthropic/claude-sonnet-5</code>                 | 0             | 0         | 0          | 20         |
| <code>anthropic/claude-sonnet-5-5</code>               | 0             | 0         | 0          | 20         |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 0             | 0         | 0          | 20         |
| <code>deepinfra/google/gemma-4-31B-it</code>           | 0             | 0         | 0          | 20         |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 0             | 0         | 0          | 20         |
| <code>gemini/gemini-3.5-flash</code>                   | 0             | 0         | 0          | 20         |
| <code>gemini/gemini-3.5-flash-lite</code>              | 0             | 0         | 0          | 20         |
| <code>gemini/gemini-3.6-flash</code>                   | 0             | 0         | 0          | 20         |
| <code>gemini/gemini-3.7-flash</code>                   | 0             | 0         | 0          | 20         |
| <code>gemini/gemini-3.8-flash</code>                   | 0             | 0         | 0          | 20         |
| <code>gemini/gemini-4-argon</code>                     | 0             | 0         | 0          | 20         |
| <code>glm/glm-5.3-flash</code>                         | 0             | 0         | 0          | 20         |
| <code>grok/grok-4.5</code>                             | 0             | 0         | 0          | 20         |
| <code>grok/grok-4.6</code>                             | 0             | 0         | 0          | 20         |
| <code>grok/grok-4.7</code>                             | 0             | 0         | 0          | 20         |
| <code>kimi/kimi-k2.6</code>                            | 0             | 0         | 0          | 20         |
| <code>kimi/kimi-k3</code>                              | 0             | 0         | 0          | 20         |
| <code>mistral/mistral-ocr-4-0</code>                   | 0             | 0         | 0          | 20         |
| <code>mistral/mistral-ocr-4-1</code>                   | 0             | 0         | 0          | 20         |
| <code>openai/gpt-5.6-luna</code>                       | 0             | 0         | 0          | 20         |
| <code>openai/gpt-5.6-sol</code>                        | 0             | 0         | 0          | 20         |
| <code>openai/gpt-5.6-terra</code>                      | 0             | 0         | 0          | 20         |
| <code>openai/gpt-6-astra</code>                        | 0             | 0         | 0          | 20         |
| <code>openai/gpt-6-luna</code>                         | 0             | 0         | 0          | 20         |
| <code>openai/gpt-6.1-sol</code>                        | 0             | 0         | 0          | 20         |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0055¢ ($0.0001).
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 0.58s.
