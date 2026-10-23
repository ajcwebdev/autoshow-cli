# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/ocr/1-page-declaration`
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
| 1    | <code>deepinfra/google/gemma-4-31B-it</code>           | $0.0006 | 51.50       | 48.50% | 39.70% | 71.16s          | $0.0006     |
| 2    | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0015 | 90.64       | 9.36%  | 9.75%  | 129.75s         | $0.0015     |
| 3    | <code>openai/gpt-6-luna</code>                         | $0.0016 | 97.54       | 2.46%  | 1.74%  | 33.69s          | $0.0016     |
| 4    | <code>anthropic/claude-haiku-5-5</code>                | $0.0022 | 97.75       | 2.25%  | 1.57%  | 27.83s          | $0.0022     |
| 5    | <code>openai/gpt-5.6-luna</code>                       | $0.0032 | 89.69       | 10.31% | 9.05%  | 11.12s          | $0.0032     |
| 6    | <code>mistral/mistral-ocr-4-0</code>                   | $0.0040 | 89.14       | 10.86% | 6.13%  | 4.18s           | $0.0040     |
| 7    | <code>mistral/mistral-ocr-4-1</code>                   | $0.0040 | 86.82       | 13.18% | 9.67%  | 4.59s           | $0.0040     |
| 8    | <code>gemini/gemini-3.5-flash-lite</code>              | $0.0051 | 98.84       | 1.16%  | 0.66%  | 7.04s           | $0.0051     |
| 9    | <code>glm/glm-5.3-flash</code>                         | $0.0053 | 99.52       | 0.48%  | 0.13%  | 149.17s         | $0.0053     |
| 10   | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | $0.0081 | 94.67       | 5.33%  | 3.83%  | 46.51s          | $0.0081     |
| 11   | <code>kimi/kimi-k2.6</code>                            | $0.0118 | 99.45       | 0.55%  | 0.25%  | 45.17s          | $0.0118     |
| 12   | <code>gemini/gemini-3.7-flash</code>                   | $0.0165 | 99.86       | 0.14%  | 0.02%  | 7.20s           | $0.0165     |
| 13   | <code>gemini/gemini-3.8-flash</code>                   | $0.0166 | 100.00      | 0.00%  | 0.00%  | 8.01s           | $0.0166     |
| 14   | <code>grok/grok-4.5</code>                             | $0.0171 | 95.70       | 4.30%  | 4.46%  | 54.36s          | $0.0171     |
| 15   | <code>gemini/gemini-3.6-flash</code>                   | $0.0172 | 99.04       | 0.96%  | 0.27%  | 11.31s          | $0.0172     |
| 16   | <code>grok/grok-4.6</code>                             | $0.0174 | 99.45       | 0.55%  | 0.25%  | 75.23s          | $0.0174     |
| 17   | <code>gemini/gemini-3.5-flash</code>                   | $0.0197 | 99.59       | 0.41%  | 0.23%  | 8.33s           | $0.0197     |
| 18   | <code>openai/gpt-5.6-terra</code>                      | $0.0299 | 98.43       | 1.57%  | 0.58%  | 17.14s          | $0.0299     |
| 19   | <code>openai/gpt-6.1-sol</code>                        | $0.0303 | 99.80       | 0.20%  | 0.03%  | 29.05s          | $0.0303     |
| 20   | <code>grok/grok-4.7</code>                             | $0.0339 | 99.45       | 0.55%  | 0.40%  | 43.33s          | $0.0339     |
| 21   | <code>anthropic/claude-sonnet-5</code>                 | $0.0414 | 99.18       | 0.82%  | 0.16%  | 38.30s          | $0.0414     |
| 22   | <code>anthropic/claude-sonnet-5-5</code>               | $0.0417 | 99.11       | 0.89%  | 0.15%  | 38.98s          | $0.0417     |
| 23   | <code>gemini/gemini-4-argon</code>                     | $0.0463 | 99.32       | 0.68%  | 0.07%  | 21.68s          | $0.0463     |
| 24   | <code>kimi/kimi-k3</code>                              | $0.0687 | 99.39       | 0.61%  | 0.31%  | 81.24s          | $0.0687     |
| 25   | <code>anthropic/claude-opus-5-5</code>                 | $0.0843 | 99.73       | 0.27%  | 0.06%  | 22.70s          | $0.0843     |
| 26   | <code>anthropic/claude-opus-5</code>                   | $0.1045 | 99.80       | 0.20%  | 0.03%  | 45.86s          | $0.1045     |
| 27   | <code>openai/gpt-5.6-sol</code>                        | $0.1186 | 97.54       | 2.46%  | 2.32%  | 40.74s          | $0.1186     |
| 28   | <code>openai/gpt-6-astra</code>                        | $0.1520 | 99.18       | 0.82%  | 0.13%  | 32.64s          | $0.1520     |
| 29   | <code>anthropic/claude-fable-5</code>                  | $0.2177 | 97.20       | 2.80%  | 1.92%  | 43.72s          | $0.2177     |
| 30   | <code>anthropic/claude-fable-5-1</code>                | $0.3804 | 99.39       | 0.61%  | 0.06%  | 72.11s          | $0.3804     |

#### Speed

| Rank | Provider                                               | Value   | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | ------: | ----------: | -----: | -----: | --------------: | ----------: |
| 1    | <code>mistral/mistral-ocr-4-0</code>                   | 4.18s   | 89.14       | 10.86% | 6.13%  | 4.18s           | $0.0040     |
| 2    | <code>mistral/mistral-ocr-4-1</code>                   | 4.59s   | 86.82       | 13.18% | 9.67%  | 4.59s           | $0.0040     |
| 3    | <code>gemini/gemini-3.5-flash-lite</code>              | 7.04s   | 98.84       | 1.16%  | 0.66%  | 7.04s           | $0.0051     |
| 4    | <code>gemini/gemini-3.7-flash</code>                   | 7.20s   | 99.86       | 0.14%  | 0.02%  | 7.20s           | $0.0165     |
| 5    | <code>gemini/gemini-3.8-flash</code>                   | 8.01s   | 100.00      | 0.00%  | 0.00%  | 8.01s           | $0.0166     |
| 6    | <code>gemini/gemini-3.5-flash</code>                   | 8.33s   | 99.59       | 0.41%  | 0.23%  | 8.33s           | $0.0197     |
| 7    | <code>openai/gpt-5.6-luna</code>                       | 11.12s  | 89.69       | 10.31% | 9.05%  | 11.12s          | $0.0032     |
| 8    | <code>gemini/gemini-3.6-flash</code>                   | 11.31s  | 99.04       | 0.96%  | 0.27%  | 11.31s          | $0.0172     |
| 9    | <code>openai/gpt-5.6-terra</code>                      | 17.14s  | 98.43       | 1.57%  | 0.58%  | 17.14s          | $0.0299     |
| 10   | <code>gemini/gemini-4-argon</code>                     | 21.68s  | 99.32       | 0.68%  | 0.07%  | 21.68s          | $0.0463     |
| 11   | <code>anthropic/claude-opus-5-5</code>                 | 22.70s  | 99.73       | 0.27%  | 0.06%  | 22.70s          | $0.0843     |
| 12   | <code>anthropic/claude-haiku-5-5</code>                | 27.83s  | 97.75       | 2.25%  | 1.57%  | 27.83s          | $0.0022     |
| 13   | <code>openai/gpt-6.1-sol</code>                        | 29.05s  | 99.80       | 0.20%  | 0.03%  | 29.05s          | $0.0303     |
| 14   | <code>openai/gpt-6-astra</code>                        | 32.64s  | 99.18       | 0.82%  | 0.13%  | 32.64s          | $0.1520     |
| 15   | <code>openai/gpt-6-luna</code>                         | 33.69s  | 97.54       | 2.46%  | 1.74%  | 33.69s          | $0.0016     |
| 16   | <code>anthropic/claude-sonnet-5</code>                 | 38.30s  | 99.18       | 0.82%  | 0.16%  | 38.30s          | $0.0414     |
| 17   | <code>anthropic/claude-sonnet-5-5</code>               | 38.98s  | 99.11       | 0.89%  | 0.15%  | 38.98s          | $0.0417     |
| 18   | <code>openai/gpt-5.6-sol</code>                        | 40.74s  | 97.54       | 2.46%  | 2.32%  | 40.74s          | $0.1186     |
| 19   | <code>grok/grok-4.7</code>                             | 43.33s  | 99.45       | 0.55%  | 0.40%  | 43.33s          | $0.0339     |
| 20   | <code>anthropic/claude-fable-5</code>                  | 43.72s  | 97.20       | 2.80%  | 1.92%  | 43.72s          | $0.2177     |
| 21   | <code>kimi/kimi-k2.6</code>                            | 45.17s  | 99.45       | 0.55%  | 0.25%  | 45.17s          | $0.0118     |
| 22   | <code>anthropic/claude-opus-5</code>                   | 45.86s  | 99.80       | 0.20%  | 0.03%  | 45.86s          | $0.1045     |
| 23   | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 46.51s  | 94.67       | 5.33%  | 3.83%  | 46.51s          | $0.0081     |
| 24   | <code>grok/grok-4.5</code>                             | 54.36s  | 95.70       | 4.30%  | 4.46%  | 54.36s          | $0.0171     |
| 25   | <code>deepinfra/google/gemma-4-31B-it</code>           | 71.16s  | 51.50       | 48.50% | 39.70% | 71.16s          | $0.0006     |
| 26   | <code>anthropic/claude-fable-5-1</code>                | 72.11s  | 99.39       | 0.61%  | 0.06%  | 72.11s          | $0.3804     |
| 27   | <code>grok/grok-4.6</code>                             | 75.23s  | 99.45       | 0.55%  | 0.25%  | 75.23s          | $0.0174     |
| 28   | <code>kimi/kimi-k3</code>                              | 81.24s  | 99.39       | 0.61%  | 0.31%  | 81.24s          | $0.0687     |
| 29   | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 129.75s | 90.64       | 9.36%  | 9.75%  | 129.75s         | $0.0015     |
| 30   | <code>glm/glm-5.3-flash</code>                         | 149.17s | 99.52       | 0.48%  | 0.13%  | 149.17s         | $0.0053     |

#### Quality Score

| Rank | Provider                                               | Value                    | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | -----------------------: | ----------: | -----: | -----: | --------------: | ----------: |
| 1    | <code>gemini/gemini-3.8-flash</code>                   | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 8.01s           | $0.0166     |
| 2    | <code>gemini/gemini-3.7-flash</code>                   | 99.86/100 quality score  | 99.86       | 0.14%  | 0.02%  | 7.20s           | $0.0165     |
| 3    | <code>anthropic/claude-opus-5</code>                   | 99.80/100 quality score  | 99.80       | 0.20%  | 0.03%  | 45.86s          | $0.1045     |
| 4    | <code>openai/gpt-6.1-sol</code>                        | 99.80/100 quality score  | 99.80       | 0.20%  | 0.03%  | 29.05s          | $0.0303     |
| 5    | <code>anthropic/claude-opus-5-5</code>                 | 99.73/100 quality score  | 99.73       | 0.27%  | 0.06%  | 22.70s          | $0.0843     |
| 6    | <code>gemini/gemini-3.5-flash</code>                   | 99.59/100 quality score  | 99.59       | 0.41%  | 0.23%  | 8.33s           | $0.0197     |
| 7    | <code>glm/glm-5.3-flash</code>                         | 99.52/100 quality score  | 99.52       | 0.48%  | 0.13%  | 149.17s         | $0.0053     |
| 8    | <code>grok/grok-4.6</code>                             | 99.45/100 quality score  | 99.45       | 0.55%  | 0.25%  | 75.23s          | $0.0174     |
| 9    | <code>kimi/kimi-k2.6</code>                            | 99.45/100 quality score  | 99.45       | 0.55%  | 0.25%  | 45.17s          | $0.0118     |
| 10   | <code>grok/grok-4.7</code>                             | 99.45/100 quality score  | 99.45       | 0.55%  | 0.40%  | 43.33s          | $0.0339     |
| 11   | <code>anthropic/claude-fable-5-1</code>                | 99.39/100 quality score  | 99.39       | 0.61%  | 0.06%  | 72.11s          | $0.3804     |
| 12   | <code>kimi/kimi-k3</code>                              | 99.39/100 quality score  | 99.39       | 0.61%  | 0.31%  | 81.24s          | $0.0687     |
| 13   | <code>gemini/gemini-4-argon</code>                     | 99.32/100 quality score  | 99.32       | 0.68%  | 0.07%  | 21.68s          | $0.0463     |
| 14   | <code>openai/gpt-6-astra</code>                        | 99.18/100 quality score  | 99.18       | 0.82%  | 0.13%  | 32.64s          | $0.1520     |
| 15   | <code>anthropic/claude-sonnet-5</code>                 | 99.18/100 quality score  | 99.18       | 0.82%  | 0.16%  | 38.30s          | $0.0414     |
| 16   | <code>anthropic/claude-sonnet-5-5</code>               | 99.11/100 quality score  | 99.11       | 0.89%  | 0.15%  | 38.98s          | $0.0417     |
| 17   | <code>gemini/gemini-3.6-flash</code>                   | 99.04/100 quality score  | 99.04       | 0.96%  | 0.27%  | 11.31s          | $0.0172     |
| 18   | <code>gemini/gemini-3.5-flash-lite</code>              | 98.84/100 quality score  | 98.84       | 1.16%  | 0.66%  | 7.04s           | $0.0051     |
| 19   | <code>openai/gpt-5.6-terra</code>                      | 98.43/100 quality score  | 98.43       | 1.57%  | 0.58%  | 17.14s          | $0.0299     |
| 20   | <code>anthropic/claude-haiku-5-5</code>                | 97.75/100 quality score  | 97.75       | 2.25%  | 1.57%  | 27.83s          | $0.0022     |
| 21   | <code>openai/gpt-6-luna</code>                         | 97.54/100 quality score  | 97.54       | 2.46%  | 1.74%  | 33.69s          | $0.0016     |
| 22   | <code>openai/gpt-5.6-sol</code>                        | 97.54/100 quality score  | 97.54       | 2.46%  | 2.32%  | 40.74s          | $0.1186     |
| 23   | <code>anthropic/claude-fable-5</code>                  | 97.20/100 quality score  | 97.20       | 2.80%  | 1.92%  | 43.72s          | $0.2177     |
| 24   | <code>grok/grok-4.5</code>                             | 95.70/100 quality score  | 95.70       | 4.30%  | 4.46%  | 54.36s          | $0.0171     |
| 25   | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 94.67/100 quality score  | 94.67       | 5.33%  | 3.83%  | 46.51s          | $0.0081     |
| 26   | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 90.64/100 quality score  | 90.64       | 9.36%  | 9.75%  | 129.75s         | $0.0015     |
| 27   | <code>openai/gpt-5.6-luna</code>                       | 89.69/100 quality score  | 89.69       | 10.31% | 9.05%  | 11.12s          | $0.0032     |
| 28   | <code>mistral/mistral-ocr-4-0</code>                   | 89.14/100 quality score  | 89.14       | 10.86% | 6.13%  | 4.18s           | $0.0040     |
| 29   | <code>mistral/mistral-ocr-4-1</code>                   | 86.82/100 quality score  | 86.82       | 13.18% | 9.67%  | 4.59s           | $0.0040     |
| 30   | <code>deepinfra/google/gemma-4-31B-it</code>           | 51.50/100 quality score  | 51.50       | 48.50% | 39.70% | 71.16s          | $0.0006     |


## Provider Detail

| Provider                                               | Group               | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ------------------------------------------------------ | ------------------- | ----------: | -----: | -----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>                  | Third-Party Service | 97.20       | 2.80%  | 1.92%  | 43.72s          | $0.2177     |
| <code>anthropic/claude-fable-5-1</code>                | Third-Party Service | 99.39       | 0.61%  | 0.06%  | 72.11s          | $0.3804     |
| <code>anthropic/claude-haiku-5-5</code>                | Third-Party Service | 97.75       | 2.25%  | 1.57%  | 27.83s          | $0.0022     |
| <code>anthropic/claude-opus-5</code>                   | Third-Party Service | 99.80       | 0.20%  | 0.03%  | 45.86s          | $0.1045     |
| <code>anthropic/claude-opus-5-5</code>                 | Third-Party Service | 99.73       | 0.27%  | 0.06%  | 22.70s          | $0.0843     |
| <code>anthropic/claude-sonnet-5</code>                 | Third-Party Service | 99.18       | 0.82%  | 0.16%  | 38.30s          | $0.0414     |
| <code>anthropic/claude-sonnet-5-5</code>               | Third-Party Service | 99.11       | 0.89%  | 0.15%  | 38.98s          | $0.0417     |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 90.64       | 9.36%  | 9.75%  | 129.75s         | $0.0015     |
| <code>deepinfra/google/gemma-4-31B-it</code>           | Third-Party Service | 51.50       | 48.50% | 39.70% | 71.16s          | $0.0006     |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>                | Third-Party Service | 94.67       | 5.33%  | 3.83%  | 46.51s          | $0.0081     |
| <code>gemini/gemini-3.5-flash</code>                   | Third-Party Service | 99.59       | 0.41%  | 0.23%  | 8.33s           | $0.0197     |
| <code>gemini/gemini-3.5-flash-lite</code>              | Third-Party Service | 98.84       | 1.16%  | 0.66%  | 7.04s           | $0.0051     |
| <code>gemini/gemini-3.6-flash</code>                   | Third-Party Service | 99.04       | 0.96%  | 0.27%  | 11.31s          | $0.0172     |
| <code>gemini/gemini-3.7-flash</code>                   | Third-Party Service | 99.86       | 0.14%  | 0.02%  | 7.20s           | $0.0165     |
| <code>gemini/gemini-3.8-flash</code>                   | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 8.01s           | $0.0166     |
| <code>gemini/gemini-4-argon</code>                     | Third-Party Service | 99.32       | 0.68%  | 0.07%  | 21.68s          | $0.0463     |
| <code>glm/glm-5.3-flash</code>                         | Third-Party Service | 99.52       | 0.48%  | 0.13%  | 149.17s         | $0.0053     |
| <code>grok/grok-4.5</code>                             | Third-Party Service | 95.70       | 4.30%  | 4.46%  | 54.36s          | $0.0171     |
| <code>grok/grok-4.6</code>                             | Third-Party Service | 99.45       | 0.55%  | 0.25%  | 75.23s          | $0.0174     |
| <code>grok/grok-4.7</code>                             | Third-Party Service | 99.45       | 0.55%  | 0.40%  | 43.33s          | $0.0339     |
| <code>kimi/kimi-k2.6</code>                            | Third-Party Service | 99.45       | 0.55%  | 0.25%  | 45.17s          | $0.0118     |
| <code>kimi/kimi-k3</code>                              | Third-Party Service | 99.39       | 0.61%  | 0.31%  | 81.24s          | $0.0687     |
| <code>mistral/mistral-ocr-4-0</code>                   | Third-Party Service | 89.14       | 10.86% | 6.13%  | 4.18s           | $0.0040     |
| <code>mistral/mistral-ocr-4-1</code>                   | Third-Party Service | 86.82       | 13.18% | 9.67%  | 4.59s           | $0.0040     |
| <code>openai/gpt-5.6-luna</code>                       | Third-Party Service | 89.69       | 10.31% | 9.05%  | 11.12s          | $0.0032     |
| <code>openai/gpt-5.6-sol</code>                        | Third-Party Service | 97.54       | 2.46%  | 2.32%  | 40.74s          | $0.1186     |
| <code>openai/gpt-5.6-terra</code>                      | Third-Party Service | 98.43       | 1.57%  | 0.58%  | 17.14s          | $0.0299     |
| <code>openai/gpt-6-astra</code>                        | Third-Party Service | 99.18       | 0.82%  | 0.13%  | 32.64s          | $0.1520     |
| <code>openai/gpt-6-luna</code>                         | Third-Party Service | 97.54       | 2.46%  | 1.74%  | 33.69s          | $0.0016     |
| <code>openai/gpt-6.1-sol</code>                        | Third-Party Service | 99.80       | 0.20%  | 0.03%  | 29.05s          | $0.0303     |

## Error Breakdown (WER)

| Provider                                               | Substitutions | Deletions | Insertions | Ref. Words |
| ------------------------------------------------------ | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>                  | 6             | 15        | 20         | 1464       |
| <code>anthropic/claude-fable-5-1</code>                | 5             | 0         | 4          | 1464       |
| <code>anthropic/claude-haiku-5-5</code>                | 26            | 5         | 2          | 1464       |
| <code>anthropic/claude-opus-5</code>                   | 2             | 0         | 1          | 1464       |
| <code>anthropic/claude-opus-5-5</code>                 | 4             | 0         | 0          | 1464       |
| <code>anthropic/claude-sonnet-5</code>                 | 10            | 1         | 1          | 1464       |
| <code>anthropic/claude-sonnet-5-5</code>               | 12            | 0         | 1          | 1464       |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 8             | 4         | 125        | 1464       |
| <code>deepinfra/google/gemma-4-31B-it</code>           | 318           | 379       | 13         | 1464       |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 58            | 12        | 8          | 1464       |
| <code>gemini/gemini-3.5-flash</code>                   | 1             | 5         | 0          | 1464       |
| <code>gemini/gemini-3.5-flash-lite</code>              | 8             | 9         | 0          | 1464       |
| <code>gemini/gemini-3.6-flash</code>                   | 5             | 5         | 4          | 1464       |
| <code>gemini/gemini-3.7-flash</code>                   | 2             | 0         | 0          | 1464       |
| <code>gemini/gemini-3.8-flash</code>                   | 0             | 0         | 0          | 1464       |
| <code>gemini/gemini-4-argon</code>                     | 5             | 0         | 5          | 1464       |
| <code>glm/glm-5.3-flash</code>                         | 7             | 0         | 0          | 1464       |
| <code>grok/grok-4.5</code>                             | 3             | 33        | 27         | 1464       |
| <code>grok/grok-4.6</code>                             | 3             | 5         | 0          | 1464       |
| <code>grok/grok-4.7</code>                             | 2             | 6         | 0          | 1464       |
| <code>kimi/kimi-k2.6</code>                            | 3             | 5         | 0          | 1464       |
| <code>kimi/kimi-k3</code>                              | 4             | 5         | 0          | 1464       |
| <code>mistral/mistral-ocr-4-0</code>                   | 142           | 9         | 8          | 1464       |
| <code>mistral/mistral-ocr-4-1</code>                   | 153           | 35        | 5          | 1464       |
| <code>openai/gpt-5.6-luna</code>                       | 81            | 9         | 61         | 1464       |
| <code>openai/gpt-5.6-sol</code>                        | 14            | 12        | 10         | 1464       |
| <code>openai/gpt-5.6-terra</code>                      | 14            | 3         | 6          | 1464       |
| <code>openai/gpt-6-astra</code>                        | 8             | 0         | 4          | 1464       |
| <code>openai/gpt-6-luna</code>                         | 14            | 14        | 8          | 1464       |
| <code>openai/gpt-6.1-sol</code>                        | 3             | 0         | 0          | 1464       |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best cloud service: `gemini/gemini-3.8-flash` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0554¢ ($0.0006).
- Fastest cloud service: `mistral/mistral-ocr-4-0` at 4.18s.
