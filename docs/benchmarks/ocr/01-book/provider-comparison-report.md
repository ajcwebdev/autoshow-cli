# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/ocr/01-book`
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
| 1    | <code>deepinfra/google/gemma-4-31B-it</code>           | $0.0002 | 95.77       | 4.23% | 0.73% | 33.77s          | $0.0002     |
| 2    | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0004 | 93.90       | 6.10% | 1.27% | 28.20s          | $0.0004     |
| 3    | <code>anthropic/claude-haiku-5-5</code>                | $0.0005 | 94.37       | 5.63% | 0.64% | 6.44s           | $0.0005     |
| 4    | <code>openai/gpt-6-luna</code>                         | $0.0008 | 99.06       | 0.94% | 0.18% | 5.70s           | $0.0008     |
| 5    | <code>glm/glm-5.3-flash</code>                         | $0.0008 | 93.90       | 6.10% | 0.82% | 18.28s          | $0.0008     |
| 6    | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | $0.0012 | 98.59       | 1.41% | 0.36% | 6.16s           | $0.0012     |
| 7    | <code>gemini/gemini-3.5-flash-lite</code>              | $0.0014 | 99.06       | 0.94% | 0.18% | 1.96s           | $0.0014     |
| 8    | <code>openai/gpt-5.6-luna</code>                       | $0.0017 | 97.18       | 2.82% | 0.55% | 5.73s           | $0.0017     |
| 9    | <code>kimi/kimi-k2.6</code>                            | $0.0035 | 100.00      | 0.00% | 0.00% | 9.88s           | $0.0035     |
| 10   | <code>mistral/mistral-ocr-4-0</code>                   | $0.0040 | 93.43       | 6.57% | 0.82% | 0.84s           | $0.0040     |
| 11   | <code>mistral/mistral-ocr-4-1</code>                   | $0.0040 | 94.37       | 5.63% | 0.64% | 1.41s           | $0.0040     |
| 12   | <code>gemini/gemini-3.6-flash</code>                   | $0.0046 | 100.00      | 0.00% | 0.00% | 2.63s           | $0.0046     |
| 13   | <code>gemini/gemini-3.8-flash</code>                   | $0.0048 | 100.00      | 0.00% | 0.00% | 2.23s           | $0.0048     |
| 14   | <code>gemini/gemini-3.7-flash</code>                   | $0.0048 | 100.00      | 0.00% | 0.00% | 2.37s           | $0.0048     |
| 15   | <code>gemini/gemini-3.5-flash</code>                   | $0.0054 | 99.53       | 0.47% | 0.09% | 2.13s           | $0.0054     |
| 16   | <code>grok/grok-4.5</code>                             | $0.0061 | 99.53       | 0.47% | 0.09% | 14.68s          | $0.0061     |
| 17   | <code>grok/grok-4.6</code>                             | $0.0064 | 99.53       | 0.47% | 0.09% | 22.85s          | $0.0064     |
| 18   | <code>openai/gpt-6.1-sol</code>                        | $0.0071 | 100.00      | 0.00% | 0.00% | 3.92s           | $0.0071     |
| 19   | <code>anthropic/claude-sonnet-5</code>                 | $0.0104 | 100.00      | 0.00% | 0.00% | 9.46s           | $0.0104     |
| 20   | <code>anthropic/claude-sonnet-5-5</code>               | $0.0109 | 100.00      | 0.00% | 0.09% | 11.01s          | $0.0109     |
| 21   | <code>openai/gpt-5.6-terra</code>                      | $0.0112 | 99.06       | 0.94% | 0.18% | 5.11s           | $0.0112     |
| 22   | <code>gemini/gemini-4-argon</code>                     | $0.0138 | 100.00      | 0.00% | 0.00% | 6.28s           | $0.0138     |
| 23   | <code>anthropic/claude-opus-5-5</code>                 | $0.0205 | 94.37       | 5.63% | 0.64% | 6.89s           | $0.0205     |
| 24   | <code>grok/grok-4.7</code>                             | $0.0232 | 100.00      | 0.00% | 0.00% | 34.28s          | $0.0232     |
| 25   | <code>anthropic/claude-opus-5</code>                   | $0.0259 | 96.24       | 3.76% | 0.73% | 12.76s          | $0.0259     |
| 26   | <code>kimi/kimi-k3</code>                              | $0.0285 | 99.53       | 0.47% | 0.18% | 112.26s         | $0.0285     |
| 27   | <code>openai/gpt-5.6-sol</code>                        | $0.0320 | 99.06       | 0.94% | 0.27% | 7.54s           | $0.0320     |
| 28   | <code>openai/gpt-6-astra</code>                        | $0.0352 | 100.00      | 0.00% | 0.00% | 4.89s           | $0.0352     |
| 29   | <code>anthropic/claude-fable-5-1</code>                | $0.0517 | 100.00      | 0.00% | 0.00% | 12.29s          | $0.0517     |
| 30   | <code>anthropic/claude-fable-5</code>                  | $0.0521 | 100.00      | 0.00% | 0.00% | 11.67s          | $0.0521     |

#### Speed

| Rank | Provider                                               | Value   | Score / 100 | WER   | CER   | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | ------: | ----------: | ----: | ----: | --------------: | ----------: |
| 1    | <code>mistral/mistral-ocr-4-0</code>                   | 0.84s   | 93.43       | 6.57% | 0.82% | 0.84s           | $0.0040     |
| 2    | <code>mistral/mistral-ocr-4-1</code>                   | 1.41s   | 94.37       | 5.63% | 0.64% | 1.41s           | $0.0040     |
| 3    | <code>gemini/gemini-3.5-flash-lite</code>              | 1.96s   | 99.06       | 0.94% | 0.18% | 1.96s           | $0.0014     |
| 4    | <code>gemini/gemini-3.5-flash</code>                   | 2.13s   | 99.53       | 0.47% | 0.09% | 2.13s           | $0.0054     |
| 5    | <code>gemini/gemini-3.8-flash</code>                   | 2.23s   | 100.00      | 0.00% | 0.00% | 2.23s           | $0.0048     |
| 6    | <code>gemini/gemini-3.7-flash</code>                   | 2.37s   | 100.00      | 0.00% | 0.00% | 2.37s           | $0.0048     |
| 7    | <code>gemini/gemini-3.6-flash</code>                   | 2.63s   | 100.00      | 0.00% | 0.00% | 2.63s           | $0.0046     |
| 8    | <code>openai/gpt-6.1-sol</code>                        | 3.92s   | 100.00      | 0.00% | 0.00% | 3.92s           | $0.0071     |
| 9    | <code>openai/gpt-6-astra</code>                        | 4.89s   | 100.00      | 0.00% | 0.00% | 4.89s           | $0.0352     |
| 10   | <code>openai/gpt-5.6-terra</code>                      | 5.11s   | 99.06       | 0.94% | 0.18% | 5.11s           | $0.0112     |
| 11   | <code>openai/gpt-6-luna</code>                         | 5.70s   | 99.06       | 0.94% | 0.18% | 5.70s           | $0.0008     |
| 12   | <code>openai/gpt-5.6-luna</code>                       | 5.73s   | 97.18       | 2.82% | 0.55% | 5.73s           | $0.0017     |
| 13   | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 6.16s   | 98.59       | 1.41% | 0.36% | 6.16s           | $0.0012     |
| 14   | <code>gemini/gemini-4-argon</code>                     | 6.28s   | 100.00      | 0.00% | 0.00% | 6.28s           | $0.0138     |
| 15   | <code>anthropic/claude-haiku-5-5</code>                | 6.44s   | 94.37       | 5.63% | 0.64% | 6.44s           | $0.0005     |
| 16   | <code>anthropic/claude-opus-5-5</code>                 | 6.89s   | 94.37       | 5.63% | 0.64% | 6.89s           | $0.0205     |
| 17   | <code>openai/gpt-5.6-sol</code>                        | 7.54s   | 99.06       | 0.94% | 0.27% | 7.54s           | $0.0320     |
| 18   | <code>anthropic/claude-sonnet-5</code>                 | 9.46s   | 100.00      | 0.00% | 0.00% | 9.46s           | $0.0104     |
| 19   | <code>kimi/kimi-k2.6</code>                            | 9.88s   | 100.00      | 0.00% | 0.00% | 9.88s           | $0.0035     |
| 20   | <code>anthropic/claude-sonnet-5-5</code>               | 11.01s  | 100.00      | 0.00% | 0.09% | 11.01s          | $0.0109     |
| 21   | <code>anthropic/claude-fable-5</code>                  | 11.67s  | 100.00      | 0.00% | 0.00% | 11.67s          | $0.0521     |
| 22   | <code>anthropic/claude-fable-5-1</code>                | 12.29s  | 100.00      | 0.00% | 0.00% | 12.29s          | $0.0517     |
| 23   | <code>anthropic/claude-opus-5</code>                   | 12.76s  | 96.24       | 3.76% | 0.73% | 12.76s          | $0.0259     |
| 24   | <code>grok/grok-4.5</code>                             | 14.68s  | 99.53       | 0.47% | 0.09% | 14.68s          | $0.0061     |
| 25   | <code>glm/glm-5.3-flash</code>                         | 18.28s  | 93.90       | 6.10% | 0.82% | 18.28s          | $0.0008     |
| 26   | <code>grok/grok-4.6</code>                             | 22.85s  | 99.53       | 0.47% | 0.09% | 22.85s          | $0.0064     |
| 27   | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 28.20s  | 93.90       | 6.10% | 1.27% | 28.20s          | $0.0004     |
| 28   | <code>deepinfra/google/gemma-4-31B-it</code>           | 33.77s  | 95.77       | 4.23% | 0.73% | 33.77s          | $0.0002     |
| 29   | <code>grok/grok-4.7</code>                             | 34.28s  | 100.00      | 0.00% | 0.00% | 34.28s          | $0.0232     |
| 30   | <code>kimi/kimi-k3</code>                              | 112.26s | 99.53       | 0.47% | 0.18% | 112.26s         | $0.0285     |

#### Quality Score

| Rank | Provider                                               | Value                    | Score / 100 | WER   | CER   | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | -----------------------: | ----------: | ----: | ----: | --------------: | ----------: |
| 1    | <code>anthropic/claude-fable-5</code>                  | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 11.67s          | $0.0521     |
| 2    | <code>anthropic/claude-fable-5-1</code>                | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 12.29s          | $0.0517     |
| 3    | <code>anthropic/claude-sonnet-5</code>                 | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 9.46s           | $0.0104     |
| 4    | <code>gemini/gemini-3.6-flash</code>                   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.63s           | $0.0046     |
| 5    | <code>gemini/gemini-3.7-flash</code>                   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.37s           | $0.0048     |
| 6    | <code>gemini/gemini-3.8-flash</code>                   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.23s           | $0.0048     |
| 7    | <code>gemini/gemini-4-argon</code>                     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 6.28s           | $0.0138     |
| 8    | <code>grok/grok-4.7</code>                             | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 34.28s          | $0.0232     |
| 9    | <code>kimi/kimi-k2.6</code>                            | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 9.88s           | $0.0035     |
| 10   | <code>openai/gpt-6-astra</code>                        | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 4.89s           | $0.0352     |
| 11   | <code>openai/gpt-6.1-sol</code>                        | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 3.92s           | $0.0071     |
| 12   | <code>anthropic/claude-sonnet-5-5</code>               | 100.00/100 quality score | 100.00      | 0.00% | 0.09% | 11.01s          | $0.0109     |
| 13   | <code>gemini/gemini-3.5-flash</code>                   | 99.53/100 quality score  | 99.53       | 0.47% | 0.09% | 2.13s           | $0.0054     |
| 14   | <code>grok/grok-4.5</code>                             | 99.53/100 quality score  | 99.53       | 0.47% | 0.09% | 14.68s          | $0.0061     |
| 15   | <code>grok/grok-4.6</code>                             | 99.53/100 quality score  | 99.53       | 0.47% | 0.09% | 22.85s          | $0.0064     |
| 16   | <code>kimi/kimi-k3</code>                              | 99.53/100 quality score  | 99.53       | 0.47% | 0.18% | 112.26s         | $0.0285     |
| 17   | <code>gemini/gemini-3.5-flash-lite</code>              | 99.06/100 quality score  | 99.06       | 0.94% | 0.18% | 1.96s           | $0.0014     |
| 18   | <code>openai/gpt-5.6-terra</code>                      | 99.06/100 quality score  | 99.06       | 0.94% | 0.18% | 5.11s           | $0.0112     |
| 19   | <code>openai/gpt-6-luna</code>                         | 99.06/100 quality score  | 99.06       | 0.94% | 0.18% | 5.70s           | $0.0008     |
| 20   | <code>openai/gpt-5.6-sol</code>                        | 99.06/100 quality score  | 99.06       | 0.94% | 0.27% | 7.54s           | $0.0320     |
| 21   | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 98.59/100 quality score  | 98.59       | 1.41% | 0.36% | 6.16s           | $0.0012     |
| 22   | <code>openai/gpt-5.6-luna</code>                       | 97.18/100 quality score  | 97.18       | 2.82% | 0.55% | 5.73s           | $0.0017     |
| 23   | <code>anthropic/claude-opus-5</code>                   | 96.24/100 quality score  | 96.24       | 3.76% | 0.73% | 12.76s          | $0.0259     |
| 24   | <code>deepinfra/google/gemma-4-31B-it</code>           | 95.77/100 quality score  | 95.77       | 4.23% | 0.73% | 33.77s          | $0.0002     |
| 25   | <code>anthropic/claude-haiku-5-5</code>                | 94.37/100 quality score  | 94.37       | 5.63% | 0.64% | 6.44s           | $0.0005     |
| 26   | <code>anthropic/claude-opus-5-5</code>                 | 94.37/100 quality score  | 94.37       | 5.63% | 0.64% | 6.89s           | $0.0205     |
| 27   | <code>mistral/mistral-ocr-4-1</code>                   | 94.37/100 quality score  | 94.37       | 5.63% | 0.64% | 1.41s           | $0.0040     |
| 28   | <code>glm/glm-5.3-flash</code>                         | 93.90/100 quality score  | 93.90       | 6.10% | 0.82% | 18.28s          | $0.0008     |
| 29   | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 93.90/100 quality score  | 93.90       | 6.10% | 1.27% | 28.20s          | $0.0004     |
| 30   | <code>mistral/mistral-ocr-4-0</code>                   | 93.43/100 quality score  | 93.43       | 6.57% | 0.82% | 0.84s           | $0.0040     |


## Provider Detail

| Provider                                               | Group               | Score / 100 | WER   | CER   | Processing Time | Actual Cost |
| ------------------------------------------------------ | ------------------- | ----------: | ----: | ----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>                  | Third-Party Service | 100.00      | 0.00% | 0.00% | 11.67s          | $0.0521     |
| <code>anthropic/claude-fable-5-1</code>                | Third-Party Service | 100.00      | 0.00% | 0.00% | 12.29s          | $0.0517     |
| <code>anthropic/claude-haiku-5-5</code>                | Third-Party Service | 94.37       | 5.63% | 0.64% | 6.44s           | $0.0005     |
| <code>anthropic/claude-opus-5</code>                   | Third-Party Service | 96.24       | 3.76% | 0.73% | 12.76s          | $0.0259     |
| <code>anthropic/claude-opus-5-5</code>                 | Third-Party Service | 94.37       | 5.63% | 0.64% | 6.89s           | $0.0205     |
| <code>anthropic/claude-sonnet-5</code>                 | Third-Party Service | 100.00      | 0.00% | 0.00% | 9.46s           | $0.0104     |
| <code>anthropic/claude-sonnet-5-5</code>               | Third-Party Service | 100.00      | 0.00% | 0.09% | 11.01s          | $0.0109     |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 93.90       | 6.10% | 1.27% | 28.20s          | $0.0004     |
| <code>deepinfra/google/gemma-4-31B-it</code>           | Third-Party Service | 95.77       | 4.23% | 0.73% | 33.77s          | $0.0002     |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>                | Third-Party Service | 98.59       | 1.41% | 0.36% | 6.16s           | $0.0012     |
| <code>gemini/gemini-3.5-flash</code>                   | Third-Party Service | 99.53       | 0.47% | 0.09% | 2.13s           | $0.0054     |
| <code>gemini/gemini-3.5-flash-lite</code>              | Third-Party Service | 99.06       | 0.94% | 0.18% | 1.96s           | $0.0014     |
| <code>gemini/gemini-3.6-flash</code>                   | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.63s           | $0.0046     |
| <code>gemini/gemini-3.7-flash</code>                   | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.37s           | $0.0048     |
| <code>gemini/gemini-3.8-flash</code>                   | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.23s           | $0.0048     |
| <code>gemini/gemini-4-argon</code>                     | Third-Party Service | 100.00      | 0.00% | 0.00% | 6.28s           | $0.0138     |
| <code>glm/glm-5.3-flash</code>                         | Third-Party Service | 93.90       | 6.10% | 0.82% | 18.28s          | $0.0008     |
| <code>grok/grok-4.5</code>                             | Third-Party Service | 99.53       | 0.47% | 0.09% | 14.68s          | $0.0061     |
| <code>grok/grok-4.6</code>                             | Third-Party Service | 99.53       | 0.47% | 0.09% | 22.85s          | $0.0064     |
| <code>grok/grok-4.7</code>                             | Third-Party Service | 100.00      | 0.00% | 0.00% | 34.28s          | $0.0232     |
| <code>kimi/kimi-k2.6</code>                            | Third-Party Service | 100.00      | 0.00% | 0.00% | 9.88s           | $0.0035     |
| <code>kimi/kimi-k3</code>                              | Third-Party Service | 99.53       | 0.47% | 0.18% | 112.26s         | $0.0285     |
| <code>mistral/mistral-ocr-4-0</code>                   | Third-Party Service | 93.43       | 6.57% | 0.82% | 0.84s           | $0.0040     |
| <code>mistral/mistral-ocr-4-1</code>                   | Third-Party Service | 94.37       | 5.63% | 0.64% | 1.41s           | $0.0040     |
| <code>openai/gpt-5.6-luna</code>                       | Third-Party Service | 97.18       | 2.82% | 0.55% | 5.73s           | $0.0017     |
| <code>openai/gpt-5.6-sol</code>                        | Third-Party Service | 99.06       | 0.94% | 0.27% | 7.54s           | $0.0320     |
| <code>openai/gpt-5.6-terra</code>                      | Third-Party Service | 99.06       | 0.94% | 0.18% | 5.11s           | $0.0112     |
| <code>openai/gpt-6-astra</code>                        | Third-Party Service | 100.00      | 0.00% | 0.00% | 4.89s           | $0.0352     |
| <code>openai/gpt-6-luna</code>                         | Third-Party Service | 99.06       | 0.94% | 0.18% | 5.70s           | $0.0008     |
| <code>openai/gpt-6.1-sol</code>                        | Third-Party Service | 100.00      | 0.00% | 0.00% | 3.92s           | $0.0071     |

## Error Breakdown (WER)

| Provider                                               | Substitutions | Deletions | Insertions | Ref. Words |
| ------------------------------------------------------ | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>                  | 0             | 0         | 0          | 213        |
| <code>anthropic/claude-fable-5-1</code>                | 0             | 0         | 0          | 213        |
| <code>anthropic/claude-haiku-5-5</code>                | 6             | 6         | 0          | 213        |
| <code>anthropic/claude-opus-5</code>                   | 1             | 0         | 7          | 213        |
| <code>anthropic/claude-opus-5-5</code>                 | 6             | 6         | 0          | 213        |
| <code>anthropic/claude-sonnet-5</code>                 | 0             | 0         | 0          | 213        |
| <code>anthropic/claude-sonnet-5-5</code>               | 0             | 0         | 0          | 213        |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 6             | 0         | 7          | 213        |
| <code>deepinfra/google/gemma-4-31B-it</code>           | 2             | 0         | 7          | 213        |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 3             | 0         | 0          | 213        |
| <code>gemini/gemini-3.5-flash</code>                   | 1             | 0         | 0          | 213        |
| <code>gemini/gemini-3.5-flash-lite</code>              | 2             | 0         | 0          | 213        |
| <code>gemini/gemini-3.6-flash</code>                   | 0             | 0         | 0          | 213        |
| <code>gemini/gemini-3.7-flash</code>                   | 0             | 0         | 0          | 213        |
| <code>gemini/gemini-3.8-flash</code>                   | 0             | 0         | 0          | 213        |
| <code>gemini/gemini-4-argon</code>                     | 0             | 0         | 0          | 213        |
| <code>glm/glm-5.3-flash</code>                         | 7             | 6         | 0          | 213        |
| <code>grok/grok-4.5</code>                             | 1             | 0         | 0          | 213        |
| <code>grok/grok-4.6</code>                             | 1             | 0         | 0          | 213        |
| <code>grok/grok-4.7</code>                             | 0             | 0         | 0          | 213        |
| <code>kimi/kimi-k2.6</code>                            | 0             | 0         | 0          | 213        |
| <code>kimi/kimi-k3</code>                              | 1             | 0         | 0          | 213        |
| <code>mistral/mistral-ocr-4-0</code>                   | 8             | 6         | 0          | 213        |
| <code>mistral/mistral-ocr-4-1</code>                   | 6             | 6         | 0          | 213        |
| <code>openai/gpt-5.6-luna</code>                       | 5             | 1         | 0          | 213        |
| <code>openai/gpt-5.6-sol</code>                        | 2             | 0         | 0          | 213        |
| <code>openai/gpt-5.6-terra</code>                      | 2             | 0         | 0          | 213        |
| <code>openai/gpt-6-astra</code>                        | 0             | 0         | 0          | 213        |
| <code>openai/gpt-6-luna</code>                         | 2             | 0         | 0          | 213        |
| <code>openai/gpt-6.1-sol</code>                        | 0             | 0         | 0          | 213        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0184¢ ($0.0002).
- Fastest cloud service: `mistral/mistral-ocr-4-0` at 0.84s.
