# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/ocr/10-document`
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
| 1    | <code>deepinfra/google/gemma-4-31B-it</code>           | $0.0020 | 99.71       | 0.29%  | 0.05%  | 32.73s          | $0.0020     |
| 2    | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0042 | 100.00      | 0.00%  | 0.00%  | 30.62s          | $0.0042     |
| 3    | <code>openai/gpt-6-luna</code>                         | $0.0048 | 100.00      | 0.00%  | 0.00%  | 26.86s          | $0.0048     |
| 4    | <code>openai/gpt-5.6-luna</code>                       | $0.0052 | 100.00      | 0.00%  | 0.00%  | 14.66s          | $0.0052     |
| 5    | <code>anthropic/claude-haiku-5-5</code>                | $0.0055 | 100.00      | 0.00%  | 0.00%  | 64.41s          | $0.0055     |
| 6    | <code>gemini/gemini-3.5-flash-lite</code>              | $0.0129 | 100.00      | 0.00%  | 0.00%  | 11.47s          | $0.0129     |
| 7    | <code>glm/glm-5.3-flash</code>                         | $0.0159 | 99.54       | 0.46%  | 0.50%  | 24.46s          | $0.0159     |
| 8    | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | $0.0264 | 83.54       | 16.46% | 16.65% | 28.64s          | $0.0264     |
| 9    | <code>mistral/mistral-ocr-4-0</code>                   | $0.0400 | 99.71       | 0.29%  | 0.27%  | 1.67s           | $0.0400     |
| 10   | <code>mistral/mistral-ocr-4-1</code>                   | $0.0400 | 99.77       | 0.23%  | 0.17%  | 2.01s           | $0.0400     |
| 11   | <code>gemini/gemini-3.6-flash</code>                   | $0.0408 | 100.00      | 0.00%  | 0.00%  | 17.73s          | $0.0408     |
| 12   | <code>gemini/gemini-3.7-flash</code>                   | $0.0417 | 100.00      | 0.00%  | 0.00%  | 7.37s           | $0.0417     |
| 13   | <code>gemini/gemini-3.8-flash</code>                   | $0.0433 | 100.00      | 0.00%  | 0.00%  | 10.89s          | $0.0433     |
| 14   | <code>gemini/gemini-3.5-flash</code>                   | $0.0487 | 100.00      | 0.00%  | 0.00%  | 15.83s          | $0.0487     |
| 15   | <code>kimi/kimi-k2.6</code>                            | $0.0535 | 100.00      | 0.00%  | 0.00%  | 38.30s          | $0.0535     |
| 16   | <code>openai/gpt-5.6-terra</code>                      | $0.0537 | 100.00      | 0.00%  | 0.00%  | 14.42s          | $0.0537     |
| 17   | <code>grok/grok-4.5</code>                             | $0.0802 | 98.74       | 1.26%  | 1.36%  | 20.51s          | $0.0802     |
| 18   | <code>grok/grok-4.6</code>                             | $0.0841 | 99.66       | 0.34%  | 0.36%  | 35.25s          | $0.0841     |
| 19   | <code>openai/gpt-6.1-sol</code>                        | $0.0929 | 100.00      | 0.00%  | 0.00%  | 26.82s          | $0.0929     |
| 20   | <code>anthropic/claude-sonnet-5</code>                 | $0.1058 | 100.00      | 0.00%  | 0.00%  | 48.83s          | $0.1058     |
| 21   | <code>anthropic/claude-sonnet-5-5</code>               | $0.1081 | 100.00      | 0.00%  | 0.00%  | 31.86s          | $0.1081     |
| 22   | <code>openai/gpt-5.6-sol</code>                        | $0.1302 | 100.00      | 0.00%  | 0.00%  | 24.22s          | $0.1302     |
| 23   | <code>gemini/gemini-4-argon</code>                     | $0.1315 | 100.00      | 0.00%  | 0.00%  | 38.27s          | $0.1315     |
| 24   | <code>anthropic/claude-opus-5-5</code>                 | $0.2177 | 100.00      | 0.00%  | 0.00%  | 75.60s          | $0.2177     |
| 25   | <code>openai/gpt-6-astra</code>                        | $0.2225 | 100.00      | 0.00%  | 0.00%  | 30.50s          | $0.2225     |
| 26   | <code>grok/grok-4.7</code>                             | $0.2485 | 100.00      | 0.00%  | 0.00%  | 342.05s         | $0.2485     |
| 27   | <code>anthropic/claude-opus-5</code>                   | $0.2720 | 100.00      | 0.00%  | 0.00%  | 62.20s          | $0.2720     |
| 28   | <code>kimi/kimi-k3</code>                              | $0.4535 | 99.94       | 0.06%  | 0.01%  | 75.16s          | $0.4535     |
| 29   | <code>anthropic/claude-fable-5</code>                  | $0.5401 | 100.00      | 0.00%  | 0.00%  | 60.51s          | $0.5401     |
| 30   | <code>anthropic/claude-fable-5-1</code>                | $0.5456 | 100.00      | 0.00%  | 0.00%  | 66.93s          | $0.5456     |

#### Speed

| Rank | Provider                                               | Value   | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | ------: | ----------: | -----: | -----: | --------------: | ----------: |
| 1    | <code>mistral/mistral-ocr-4-0</code>                   | 1.67s   | 99.71       | 0.29%  | 0.27%  | 1.67s           | $0.0400     |
| 2    | <code>mistral/mistral-ocr-4-1</code>                   | 2.01s   | 99.77       | 0.23%  | 0.17%  | 2.01s           | $0.0400     |
| 3    | <code>gemini/gemini-3.7-flash</code>                   | 7.37s   | 100.00      | 0.00%  | 0.00%  | 7.37s           | $0.0417     |
| 4    | <code>gemini/gemini-3.8-flash</code>                   | 10.89s  | 100.00      | 0.00%  | 0.00%  | 10.89s          | $0.0433     |
| 5    | <code>gemini/gemini-3.5-flash-lite</code>              | 11.47s  | 100.00      | 0.00%  | 0.00%  | 11.47s          | $0.0129     |
| 6    | <code>openai/gpt-5.6-terra</code>                      | 14.42s  | 100.00      | 0.00%  | 0.00%  | 14.42s          | $0.0537     |
| 7    | <code>openai/gpt-5.6-luna</code>                       | 14.66s  | 100.00      | 0.00%  | 0.00%  | 14.66s          | $0.0052     |
| 8    | <code>gemini/gemini-3.5-flash</code>                   | 15.83s  | 100.00      | 0.00%  | 0.00%  | 15.83s          | $0.0487     |
| 9    | <code>gemini/gemini-3.6-flash</code>                   | 17.73s  | 100.00      | 0.00%  | 0.00%  | 17.73s          | $0.0408     |
| 10   | <code>grok/grok-4.5</code>                             | 20.51s  | 98.74       | 1.26%  | 1.36%  | 20.51s          | $0.0802     |
| 11   | <code>openai/gpt-5.6-sol</code>                        | 24.22s  | 100.00      | 0.00%  | 0.00%  | 24.22s          | $0.1302     |
| 12   | <code>glm/glm-5.3-flash</code>                         | 24.46s  | 99.54       | 0.46%  | 0.50%  | 24.46s          | $0.0159     |
| 13   | <code>openai/gpt-6.1-sol</code>                        | 26.82s  | 100.00      | 0.00%  | 0.00%  | 26.82s          | $0.0929     |
| 14   | <code>openai/gpt-6-luna</code>                         | 26.86s  | 100.00      | 0.00%  | 0.00%  | 26.86s          | $0.0048     |
| 15   | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 28.64s  | 83.54       | 16.46% | 16.65% | 28.64s          | $0.0264     |
| 16   | <code>openai/gpt-6-astra</code>                        | 30.50s  | 100.00      | 0.00%  | 0.00%  | 30.50s          | $0.2225     |
| 17   | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 30.62s  | 100.00      | 0.00%  | 0.00%  | 30.62s          | $0.0042     |
| 18   | <code>anthropic/claude-sonnet-5-5</code>               | 31.86s  | 100.00      | 0.00%  | 0.00%  | 31.86s          | $0.1081     |
| 19   | <code>deepinfra/google/gemma-4-31B-it</code>           | 32.73s  | 99.71       | 0.29%  | 0.05%  | 32.73s          | $0.0020     |
| 20   | <code>grok/grok-4.6</code>                             | 35.25s  | 99.66       | 0.34%  | 0.36%  | 35.25s          | $0.0841     |
| 21   | <code>gemini/gemini-4-argon</code>                     | 38.27s  | 100.00      | 0.00%  | 0.00%  | 38.27s          | $0.1315     |
| 22   | <code>kimi/kimi-k2.6</code>                            | 38.30s  | 100.00      | 0.00%  | 0.00%  | 38.30s          | $0.0535     |
| 23   | <code>anthropic/claude-sonnet-5</code>                 | 48.83s  | 100.00      | 0.00%  | 0.00%  | 48.83s          | $0.1058     |
| 24   | <code>anthropic/claude-fable-5</code>                  | 60.51s  | 100.00      | 0.00%  | 0.00%  | 60.51s          | $0.5401     |
| 25   | <code>anthropic/claude-opus-5</code>                   | 62.20s  | 100.00      | 0.00%  | 0.00%  | 62.20s          | $0.2720     |
| 26   | <code>anthropic/claude-haiku-5-5</code>                | 64.41s  | 100.00      | 0.00%  | 0.00%  | 64.41s          | $0.0055     |
| 27   | <code>anthropic/claude-fable-5-1</code>                | 66.93s  | 100.00      | 0.00%  | 0.00%  | 66.93s          | $0.5456     |
| 28   | <code>kimi/kimi-k3</code>                              | 75.16s  | 99.94       | 0.06%  | 0.01%  | 75.16s          | $0.4535     |
| 29   | <code>anthropic/claude-opus-5-5</code>                 | 75.60s  | 100.00      | 0.00%  | 0.00%  | 75.60s          | $0.2177     |
| 30   | <code>grok/grok-4.7</code>                             | 342.05s | 100.00      | 0.00%  | 0.00%  | 342.05s         | $0.2485     |

#### Quality Score

| Rank | Provider                                               | Value                    | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | -----------------------: | ----------: | -----: | -----: | --------------: | ----------: |
| 1    | <code>anthropic/claude-fable-5</code>                  | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 60.51s          | $0.5401     |
| 2    | <code>anthropic/claude-fable-5-1</code>                | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 66.93s          | $0.5456     |
| 3    | <code>anthropic/claude-haiku-5-5</code>                | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 64.41s          | $0.0055     |
| 4    | <code>anthropic/claude-opus-5</code>                   | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 62.20s          | $0.2720     |
| 5    | <code>anthropic/claude-opus-5-5</code>                 | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 75.60s          | $0.2177     |
| 6    | <code>anthropic/claude-sonnet-5</code>                 | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 48.83s          | $0.1058     |
| 7    | <code>anthropic/claude-sonnet-5-5</code>               | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 31.86s          | $0.1081     |
| 8    | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 30.62s          | $0.0042     |
| 9    | <code>gemini/gemini-3.5-flash</code>                   | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 15.83s          | $0.0487     |
| 10   | <code>gemini/gemini-3.5-flash-lite</code>              | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 11.47s          | $0.0129     |
| 11   | <code>gemini/gemini-3.6-flash</code>                   | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 17.73s          | $0.0408     |
| 12   | <code>gemini/gemini-3.7-flash</code>                   | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 7.37s           | $0.0417     |
| 13   | <code>gemini/gemini-3.8-flash</code>                   | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 10.89s          | $0.0433     |
| 14   | <code>gemini/gemini-4-argon</code>                     | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 38.27s          | $0.1315     |
| 15   | <code>grok/grok-4.7</code>                             | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 342.05s         | $0.2485     |
| 16   | <code>kimi/kimi-k2.6</code>                            | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 38.30s          | $0.0535     |
| 17   | <code>openai/gpt-5.6-luna</code>                       | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 14.66s          | $0.0052     |
| 18   | <code>openai/gpt-5.6-sol</code>                        | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 24.22s          | $0.1302     |
| 19   | <code>openai/gpt-5.6-terra</code>                      | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 14.42s          | $0.0537     |
| 20   | <code>openai/gpt-6-astra</code>                        | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 30.50s          | $0.2225     |
| 21   | <code>openai/gpt-6-luna</code>                         | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 26.86s          | $0.0048     |
| 22   | <code>openai/gpt-6.1-sol</code>                        | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 26.82s          | $0.0929     |
| 23   | <code>kimi/kimi-k3</code>                              | 99.94/100 quality score  | 99.94       | 0.06%  | 0.01%  | 75.16s          | $0.4535     |
| 24   | <code>mistral/mistral-ocr-4-1</code>                   | 99.77/100 quality score  | 99.77       | 0.23%  | 0.17%  | 2.01s           | $0.0400     |
| 25   | <code>deepinfra/google/gemma-4-31B-it</code>           | 99.71/100 quality score  | 99.71       | 0.29%  | 0.05%  | 32.73s          | $0.0020     |
| 26   | <code>mistral/mistral-ocr-4-0</code>                   | 99.71/100 quality score  | 99.71       | 0.29%  | 0.27%  | 1.67s           | $0.0400     |
| 27   | <code>grok/grok-4.6</code>                             | 99.66/100 quality score  | 99.66       | 0.34%  | 0.36%  | 35.25s          | $0.0841     |
| 28   | <code>glm/glm-5.3-flash</code>                         | 99.54/100 quality score  | 99.54       | 0.46%  | 0.50%  | 24.46s          | $0.0159     |
| 29   | <code>grok/grok-4.5</code>                             | 98.74/100 quality score  | 98.74       | 1.26%  | 1.36%  | 20.51s          | $0.0802     |
| 30   | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 83.54/100 quality score  | 83.54       | 16.46% | 16.65% | 28.64s          | $0.0264     |


## Provider Detail

| Provider                                               | Group               | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ------------------------------------------------------ | ------------------- | ----------: | -----: | -----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>                  | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 60.51s          | $0.5401     |
| <code>anthropic/claude-fable-5-1</code>                | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 66.93s          | $0.5456     |
| <code>anthropic/claude-haiku-5-5</code>                | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 64.41s          | $0.0055     |
| <code>anthropic/claude-opus-5</code>                   | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 62.20s          | $0.2720     |
| <code>anthropic/claude-opus-5-5</code>                 | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 75.60s          | $0.2177     |
| <code>anthropic/claude-sonnet-5</code>                 | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 48.83s          | $0.1058     |
| <code>anthropic/claude-sonnet-5-5</code>               | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 31.86s          | $0.1081     |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 30.62s          | $0.0042     |
| <code>deepinfra/google/gemma-4-31B-it</code>           | Third-Party Service | 99.71       | 0.29%  | 0.05%  | 32.73s          | $0.0020     |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>                | Third-Party Service | 83.54       | 16.46% | 16.65% | 28.64s          | $0.0264     |
| <code>gemini/gemini-3.5-flash</code>                   | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 15.83s          | $0.0487     |
| <code>gemini/gemini-3.5-flash-lite</code>              | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 11.47s          | $0.0129     |
| <code>gemini/gemini-3.6-flash</code>                   | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 17.73s          | $0.0408     |
| <code>gemini/gemini-3.7-flash</code>                   | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 7.37s           | $0.0417     |
| <code>gemini/gemini-3.8-flash</code>                   | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 10.89s          | $0.0433     |
| <code>gemini/gemini-4-argon</code>                     | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 38.27s          | $0.1315     |
| <code>glm/glm-5.3-flash</code>                         | Third-Party Service | 99.54       | 0.46%  | 0.50%  | 24.46s          | $0.0159     |
| <code>grok/grok-4.5</code>                             | Third-Party Service | 98.74       | 1.26%  | 1.36%  | 20.51s          | $0.0802     |
| <code>grok/grok-4.6</code>                             | Third-Party Service | 99.66       | 0.34%  | 0.36%  | 35.25s          | $0.0841     |
| <code>grok/grok-4.7</code>                             | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 342.05s         | $0.2485     |
| <code>kimi/kimi-k2.6</code>                            | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 38.30s          | $0.0535     |
| <code>kimi/kimi-k3</code>                              | Third-Party Service | 99.94       | 0.06%  | 0.01%  | 75.16s          | $0.4535     |
| <code>mistral/mistral-ocr-4-0</code>                   | Third-Party Service | 99.71       | 0.29%  | 0.27%  | 1.67s           | $0.0400     |
| <code>mistral/mistral-ocr-4-1</code>                   | Third-Party Service | 99.77       | 0.23%  | 0.17%  | 2.01s           | $0.0400     |
| <code>openai/gpt-5.6-luna</code>                       | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 14.66s          | $0.0052     |
| <code>openai/gpt-5.6-sol</code>                        | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 24.22s          | $0.1302     |
| <code>openai/gpt-5.6-terra</code>                      | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 14.42s          | $0.0537     |
| <code>openai/gpt-6-astra</code>                        | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 30.50s          | $0.2225     |
| <code>openai/gpt-6-luna</code>                         | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 26.86s          | $0.0048     |
| <code>openai/gpt-6.1-sol</code>                        | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 26.82s          | $0.0929     |

## Error Breakdown (WER)

| Provider                                               | Substitutions | Deletions | Insertions | Ref. Words |
| ------------------------------------------------------ | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>                  | 0             | 0         | 0          | 1744       |
| <code>anthropic/claude-fable-5-1</code>                | 0             | 0         | 0          | 1744       |
| <code>anthropic/claude-haiku-5-5</code>                | 0             | 0         | 0          | 1744       |
| <code>anthropic/claude-opus-5</code>                   | 0             | 0         | 0          | 1744       |
| <code>anthropic/claude-opus-5-5</code>                 | 0             | 0         | 0          | 1744       |
| <code>anthropic/claude-sonnet-5</code>                 | 0             | 0         | 0          | 1744       |
| <code>anthropic/claude-sonnet-5-5</code>               | 0             | 0         | 0          | 1744       |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 0             | 0         | 0          | 1744       |
| <code>deepinfra/google/gemma-4-31B-it</code>           | 4             | 0         | 1          | 1744       |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 51            | 167       | 69         | 1744       |
| <code>gemini/gemini-3.5-flash</code>                   | 0             | 0         | 0          | 1744       |
| <code>gemini/gemini-3.5-flash-lite</code>              | 0             | 0         | 0          | 1744       |
| <code>gemini/gemini-3.6-flash</code>                   | 0             | 0         | 0          | 1744       |
| <code>gemini/gemini-3.7-flash</code>                   | 0             | 0         | 0          | 1744       |
| <code>gemini/gemini-3.8-flash</code>                   | 0             | 0         | 0          | 1744       |
| <code>gemini/gemini-4-argon</code>                     | 0             | 0         | 0          | 1744       |
| <code>glm/glm-5.3-flash</code>                         | 0             | 8         | 0          | 1744       |
| <code>grok/grok-4.5</code>                             | 0             | 22        | 0          | 1744       |
| <code>grok/grok-4.6</code>                             | 0             | 6         | 0          | 1744       |
| <code>grok/grok-4.7</code>                             | 0             | 0         | 0          | 1744       |
| <code>kimi/kimi-k2.6</code>                            | 0             | 0         | 0          | 1744       |
| <code>kimi/kimi-k3</code>                              | 1             | 0         | 0          | 1744       |
| <code>mistral/mistral-ocr-4-0</code>                   | 0             | 0         | 5          | 1744       |
| <code>mistral/mistral-ocr-4-1</code>                   | 1             | 0         | 3          | 1744       |
| <code>openai/gpt-5.6-luna</code>                       | 0             | 0         | 0          | 1744       |
| <code>openai/gpt-5.6-sol</code>                        | 0             | 0         | 0          | 1744       |
| <code>openai/gpt-5.6-terra</code>                      | 0             | 0         | 0          | 1744       |
| <code>openai/gpt-6-astra</code>                        | 0             | 0         | 0          | 1744       |
| <code>openai/gpt-6-luna</code>                         | 0             | 0         | 0          | 1744       |
| <code>openai/gpt-6.1-sol</code>                        | 0             | 0         | 0          | 1744       |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.2001¢ ($0.0020).
- Fastest cloud service: `mistral/mistral-ocr-4-0` at 1.67s.
