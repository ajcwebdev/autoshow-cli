# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/ocr/04-pages-don-quixote`
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
| 1    | <code>deepinfra/google/gemma-4-31B-it</code>           | $0.0008 | 98.65       | 1.35%  | 0.65%  | 45.11s          | $0.0008     |
| 2    | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0019 | 99.25       | 0.75%  | 0.25%  | 37.46s          | $0.0019     |
| 3    | <code>anthropic/claude-haiku-5-5</code>                | $0.0026 | 33.58       | 66.42% | 65.83% | 32.68s          | $0.0026     |
| 4    | <code>openai/gpt-6-luna</code>                         | $0.0032 | 99.40       | 0.60%  | 0.64%  | 16.38s          | $0.0032     |
| 5    | <code>gemini/gemini-3.5-flash-lite</code>              | $0.0055 | 97.76       | 2.24%  | 0.93%  | 8.13s           | $0.0055     |
| 6    | <code>glm/glm-5.3-flash</code>                         | $0.0060 | 99.63       | 0.37%  | 0.40%  | 19.54s          | $0.0060     |
| 7    | <code>openai/gpt-5.6-luna</code>                       | $0.0079 | 99.63       | 0.37%  | 0.25%  | 20.06s          | $0.0079     |
| 8    | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | $0.0108 | 98.88       | 1.12%  | 0.30%  | 15.92s          | $0.0108     |
| 9    | <code>mistral/mistral-ocr-4-0</code>                   | $0.0160 | 99.70       | 0.30%  | 0.21%  | 6.15s           | $0.0160     |
| 10   | <code>mistral/mistral-ocr-4-1</code>                   | $0.0160 | 99.85       | 0.15%  | 0.19%  | 6.67s           | $0.0160     |
| 11   | <code>gemini/gemini-3.6-flash</code>                   | $0.0164 | 99.33       | 0.67%  | 0.65%  | 12.19s          | $0.0164     |
| 12   | <code>gemini/gemini-3.7-flash</code>                   | $0.0167 | 99.85       | 0.15%  | 0.19%  | 7.84s           | $0.0167     |
| 13   | <code>gemini/gemini-3.8-flash</code>                   | $0.0167 | 99.85       | 0.15%  | 0.19%  | 10.99s          | $0.0167     |
| 14   | <code>gemini/gemini-3.5-flash</code>                   | $0.0193 | 99.85       | 0.15%  | 0.10%  | 12.94s          | $0.0193     |
| 15   | <code>kimi/kimi-k2.6</code>                            | $0.0231 | 99.33       | 0.67%  | 0.24%  | 21.42s          | $0.0231     |
| 16   | <code>grok/grok-4.5</code>                             | $0.0340 | 98.20       | 1.80%  | 0.53%  | 22.70s          | $0.0340     |
| 17   | <code>grok/grok-4.6</code>                             | $0.0352 | 98.28       | 1.72%  | 0.34%  | 48.26s          | $0.0352     |
| 18   | <code>anthropic/claude-sonnet-5</code>                 | $0.0374 | 99.78       | 0.22%  | 0.19%  | 34.76s          | $0.0374     |
| 19   | <code>anthropic/claude-sonnet-5-5</code>               | $0.0407 | 98.28       | 1.72%  | 0.34%  | 16.70s          | $0.0407     |
| 20   | <code>gemini/gemini-4-argon</code>                     | $0.0508 | 98.43       | 1.57%  | 0.22%  | 31.32s          | $0.0508     |
| 21   | <code>openai/gpt-6.1-sol</code>                        | $0.0593 | 98.35       | 1.65%  | 0.34%  | 19.37s          | $0.0593     |
| 22   | <code>openai/gpt-5.6-terra</code>                      | $0.0625 | 98.28       | 1.72%  | 0.34%  | 12.03s          | $0.0625     |
| 23   | <code>anthropic/claude-opus-5-5</code>                 | $0.0755 | 99.78       | 0.22%  | 0.19%  | 35.67s          | $0.0755     |
| 24   | <code>grok/grok-4.7</code>                             | $0.0781 | 99.70       | 0.30%  | 0.38%  | 95.50s          | $0.0781     |
| 25   | <code>anthropic/claude-opus-5</code>                   | $0.0935 | 99.78       | 0.22%  | 0.19%  | 41.74s          | $0.0935     |
| 26   | <code>openai/gpt-5.6-sol</code>                        | $0.1555 | 99.70       | 0.30%  | 0.38%  | 18.83s          | $0.1555     |
| 27   | <code>anthropic/claude-fable-5</code>                  | $0.1871 | 99.78       | 0.22%  | 0.19%  | 37.14s          | $0.1871     |
| 28   | <code>anthropic/claude-fable-5-1</code>                | $0.2010 | 98.35       | 1.65%  | 0.34%  | 40.07s          | $0.2010     |
| 29   | <code>openai/gpt-6-astra</code>                        | $0.2927 | 98.35       | 1.65%  | 0.34%  | 24.33s          | $0.2927     |
| 30   | <code>kimi/kimi-k3</code>                              | $0.4044 | 99.33       | 0.67%  | 0.25%  | 484.71s         | $0.4044     |

#### Speed

| Rank | Provider                                               | Value   | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | ------: | ----------: | -----: | -----: | --------------: | ----------: |
| 1    | <code>mistral/mistral-ocr-4-0</code>                   | 6.15s   | 99.70       | 0.30%  | 0.21%  | 6.15s           | $0.0160     |
| 2    | <code>mistral/mistral-ocr-4-1</code>                   | 6.67s   | 99.85       | 0.15%  | 0.19%  | 6.67s           | $0.0160     |
| 3    | <code>gemini/gemini-3.7-flash</code>                   | 7.84s   | 99.85       | 0.15%  | 0.19%  | 7.84s           | $0.0167     |
| 4    | <code>gemini/gemini-3.5-flash-lite</code>              | 8.13s   | 97.76       | 2.24%  | 0.93%  | 8.13s           | $0.0055     |
| 5    | <code>gemini/gemini-3.8-flash</code>                   | 10.99s  | 99.85       | 0.15%  | 0.19%  | 10.99s          | $0.0167     |
| 6    | <code>openai/gpt-5.6-terra</code>                      | 12.03s  | 98.28       | 1.72%  | 0.34%  | 12.03s          | $0.0625     |
| 7    | <code>gemini/gemini-3.6-flash</code>                   | 12.19s  | 99.33       | 0.67%  | 0.65%  | 12.19s          | $0.0164     |
| 8    | <code>gemini/gemini-3.5-flash</code>                   | 12.94s  | 99.85       | 0.15%  | 0.10%  | 12.94s          | $0.0193     |
| 9    | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 15.92s  | 98.88       | 1.12%  | 0.30%  | 15.92s          | $0.0108     |
| 10   | <code>openai/gpt-6-luna</code>                         | 16.38s  | 99.40       | 0.60%  | 0.64%  | 16.38s          | $0.0032     |
| 11   | <code>anthropic/claude-sonnet-5-5</code>               | 16.70s  | 98.28       | 1.72%  | 0.34%  | 16.70s          | $0.0407     |
| 12   | <code>openai/gpt-5.6-sol</code>                        | 18.83s  | 99.70       | 0.30%  | 0.38%  | 18.83s          | $0.1555     |
| 13   | <code>openai/gpt-6.1-sol</code>                        | 19.37s  | 98.35       | 1.65%  | 0.34%  | 19.37s          | $0.0593     |
| 14   | <code>glm/glm-5.3-flash</code>                         | 19.54s  | 99.63       | 0.37%  | 0.40%  | 19.54s          | $0.0060     |
| 15   | <code>openai/gpt-5.6-luna</code>                       | 20.06s  | 99.63       | 0.37%  | 0.25%  | 20.06s          | $0.0079     |
| 16   | <code>kimi/kimi-k2.6</code>                            | 21.42s  | 99.33       | 0.67%  | 0.24%  | 21.42s          | $0.0231     |
| 17   | <code>grok/grok-4.5</code>                             | 22.70s  | 98.20       | 1.80%  | 0.53%  | 22.70s          | $0.0340     |
| 18   | <code>openai/gpt-6-astra</code>                        | 24.33s  | 98.35       | 1.65%  | 0.34%  | 24.33s          | $0.2927     |
| 19   | <code>gemini/gemini-4-argon</code>                     | 31.32s  | 98.43       | 1.57%  | 0.22%  | 31.32s          | $0.0508     |
| 20   | <code>anthropic/claude-haiku-5-5</code>                | 32.68s  | 33.58       | 66.42% | 65.83% | 32.68s          | $0.0026     |
| 21   | <code>anthropic/claude-sonnet-5</code>                 | 34.76s  | 99.78       | 0.22%  | 0.19%  | 34.76s          | $0.0374     |
| 22   | <code>anthropic/claude-opus-5-5</code>                 | 35.67s  | 99.78       | 0.22%  | 0.19%  | 35.67s          | $0.0755     |
| 23   | <code>anthropic/claude-fable-5</code>                  | 37.14s  | 99.78       | 0.22%  | 0.19%  | 37.14s          | $0.1871     |
| 24   | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 37.46s  | 99.25       | 0.75%  | 0.25%  | 37.46s          | $0.0019     |
| 25   | <code>anthropic/claude-fable-5-1</code>                | 40.07s  | 98.35       | 1.65%  | 0.34%  | 40.07s          | $0.2010     |
| 26   | <code>anthropic/claude-opus-5</code>                   | 41.74s  | 99.78       | 0.22%  | 0.19%  | 41.74s          | $0.0935     |
| 27   | <code>deepinfra/google/gemma-4-31B-it</code>           | 45.11s  | 98.65       | 1.35%  | 0.65%  | 45.11s          | $0.0008     |
| 28   | <code>grok/grok-4.6</code>                             | 48.26s  | 98.28       | 1.72%  | 0.34%  | 48.26s          | $0.0352     |
| 29   | <code>grok/grok-4.7</code>                             | 95.50s  | 99.70       | 0.30%  | 0.38%  | 95.50s          | $0.0781     |
| 30   | <code>kimi/kimi-k3</code>                              | 484.71s | 99.33       | 0.67%  | 0.25%  | 484.71s         | $0.4044     |

#### Quality Score

| Rank | Provider                                               | Value                   | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | ----------------------: | ----------: | -----: | -----: | --------------: | ----------: |
| 1    | <code>gemini/gemini-3.5-flash</code>                   | 99.85/100 quality score | 99.85       | 0.15%  | 0.10%  | 12.94s          | $0.0193     |
| 2    | <code>gemini/gemini-3.7-flash</code>                   | 99.85/100 quality score | 99.85       | 0.15%  | 0.19%  | 7.84s           | $0.0167     |
| 3    | <code>gemini/gemini-3.8-flash</code>                   | 99.85/100 quality score | 99.85       | 0.15%  | 0.19%  | 10.99s          | $0.0167     |
| 4    | <code>mistral/mistral-ocr-4-1</code>                   | 99.85/100 quality score | 99.85       | 0.15%  | 0.19%  | 6.67s           | $0.0160     |
| 5    | <code>anthropic/claude-fable-5</code>                  | 99.78/100 quality score | 99.78       | 0.22%  | 0.19%  | 37.14s          | $0.1871     |
| 6    | <code>anthropic/claude-opus-5</code>                   | 99.78/100 quality score | 99.78       | 0.22%  | 0.19%  | 41.74s          | $0.0935     |
| 7    | <code>anthropic/claude-opus-5-5</code>                 | 99.78/100 quality score | 99.78       | 0.22%  | 0.19%  | 35.67s          | $0.0755     |
| 8    | <code>anthropic/claude-sonnet-5</code>                 | 99.78/100 quality score | 99.78       | 0.22%  | 0.19%  | 34.76s          | $0.0374     |
| 9    | <code>mistral/mistral-ocr-4-0</code>                   | 99.70/100 quality score | 99.70       | 0.30%  | 0.21%  | 6.15s           | $0.0160     |
| 10   | <code>grok/grok-4.7</code>                             | 99.70/100 quality score | 99.70       | 0.30%  | 0.38%  | 95.50s          | $0.0781     |
| 11   | <code>openai/gpt-5.6-sol</code>                        | 99.70/100 quality score | 99.70       | 0.30%  | 0.38%  | 18.83s          | $0.1555     |
| 12   | <code>openai/gpt-5.6-luna</code>                       | 99.63/100 quality score | 99.63       | 0.37%  | 0.25%  | 20.06s          | $0.0079     |
| 13   | <code>glm/glm-5.3-flash</code>                         | 99.63/100 quality score | 99.63       | 0.37%  | 0.40%  | 19.54s          | $0.0060     |
| 14   | <code>openai/gpt-6-luna</code>                         | 99.40/100 quality score | 99.40       | 0.60%  | 0.64%  | 16.38s          | $0.0032     |
| 15   | <code>kimi/kimi-k2.6</code>                            | 99.33/100 quality score | 99.33       | 0.67%  | 0.24%  | 21.42s          | $0.0231     |
| 16   | <code>kimi/kimi-k3</code>                              | 99.33/100 quality score | 99.33       | 0.67%  | 0.25%  | 484.71s         | $0.4044     |
| 17   | <code>gemini/gemini-3.6-flash</code>                   | 99.33/100 quality score | 99.33       | 0.67%  | 0.65%  | 12.19s          | $0.0164     |
| 18   | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 99.25/100 quality score | 99.25       | 0.75%  | 0.25%  | 37.46s          | $0.0019     |
| 19   | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 98.88/100 quality score | 98.88       | 1.12%  | 0.30%  | 15.92s          | $0.0108     |
| 20   | <code>deepinfra/google/gemma-4-31B-it</code>           | 98.65/100 quality score | 98.65       | 1.35%  | 0.65%  | 45.11s          | $0.0008     |
| 21   | <code>gemini/gemini-4-argon</code>                     | 98.43/100 quality score | 98.43       | 1.57%  | 0.22%  | 31.32s          | $0.0508     |
| 22   | <code>anthropic/claude-fable-5-1</code>                | 98.35/100 quality score | 98.35       | 1.65%  | 0.34%  | 40.07s          | $0.2010     |
| 23   | <code>openai/gpt-6-astra</code>                        | 98.35/100 quality score | 98.35       | 1.65%  | 0.34%  | 24.33s          | $0.2927     |
| 24   | <code>openai/gpt-6.1-sol</code>                        | 98.35/100 quality score | 98.35       | 1.65%  | 0.34%  | 19.37s          | $0.0593     |
| 25   | <code>anthropic/claude-sonnet-5-5</code>               | 98.28/100 quality score | 98.28       | 1.72%  | 0.34%  | 16.70s          | $0.0407     |
| 26   | <code>grok/grok-4.6</code>                             | 98.28/100 quality score | 98.28       | 1.72%  | 0.34%  | 48.26s          | $0.0352     |
| 27   | <code>openai/gpt-5.6-terra</code>                      | 98.28/100 quality score | 98.28       | 1.72%  | 0.34%  | 12.03s          | $0.0625     |
| 28   | <code>grok/grok-4.5</code>                             | 98.20/100 quality score | 98.20       | 1.80%  | 0.53%  | 22.70s          | $0.0340     |
| 29   | <code>gemini/gemini-3.5-flash-lite</code>              | 97.76/100 quality score | 97.76       | 2.24%  | 0.93%  | 8.13s           | $0.0055     |
| 30   | <code>anthropic/claude-haiku-5-5</code>                | 33.58/100 quality score | 33.58       | 66.42% | 65.83% | 32.68s          | $0.0026     |


## Provider Detail

| Provider                                               | Group               | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ------------------------------------------------------ | ------------------- | ----------: | -----: | -----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>                  | Third-Party Service | 99.78       | 0.22%  | 0.19%  | 37.14s          | $0.1871     |
| <code>anthropic/claude-fable-5-1</code>                | Third-Party Service | 98.35       | 1.65%  | 0.34%  | 40.07s          | $0.2010     |
| <code>anthropic/claude-haiku-5-5</code>                | Third-Party Service | 33.58       | 66.42% | 65.83% | 32.68s          | $0.0026     |
| <code>anthropic/claude-opus-5</code>                   | Third-Party Service | 99.78       | 0.22%  | 0.19%  | 41.74s          | $0.0935     |
| <code>anthropic/claude-opus-5-5</code>                 | Third-Party Service | 99.78       | 0.22%  | 0.19%  | 35.67s          | $0.0755     |
| <code>anthropic/claude-sonnet-5</code>                 | Third-Party Service | 99.78       | 0.22%  | 0.19%  | 34.76s          | $0.0374     |
| <code>anthropic/claude-sonnet-5-5</code>               | Third-Party Service | 98.28       | 1.72%  | 0.34%  | 16.70s          | $0.0407     |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 99.25       | 0.75%  | 0.25%  | 37.46s          | $0.0019     |
| <code>deepinfra/google/gemma-4-31B-it</code>           | Third-Party Service | 98.65       | 1.35%  | 0.65%  | 45.11s          | $0.0008     |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>                | Third-Party Service | 98.88       | 1.12%  | 0.30%  | 15.92s          | $0.0108     |
| <code>gemini/gemini-3.5-flash</code>                   | Third-Party Service | 99.85       | 0.15%  | 0.10%  | 12.94s          | $0.0193     |
| <code>gemini/gemini-3.5-flash-lite</code>              | Third-Party Service | 97.76       | 2.24%  | 0.93%  | 8.13s           | $0.0055     |
| <code>gemini/gemini-3.6-flash</code>                   | Third-Party Service | 99.33       | 0.67%  | 0.65%  | 12.19s          | $0.0164     |
| <code>gemini/gemini-3.7-flash</code>                   | Third-Party Service | 99.85       | 0.15%  | 0.19%  | 7.84s           | $0.0167     |
| <code>gemini/gemini-3.8-flash</code>                   | Third-Party Service | 99.85       | 0.15%  | 0.19%  | 10.99s          | $0.0167     |
| <code>gemini/gemini-4-argon</code>                     | Third-Party Service | 98.43       | 1.57%  | 0.22%  | 31.32s          | $0.0508     |
| <code>glm/glm-5.3-flash</code>                         | Third-Party Service | 99.63       | 0.37%  | 0.40%  | 19.54s          | $0.0060     |
| <code>grok/grok-4.5</code>                             | Third-Party Service | 98.20       | 1.80%  | 0.53%  | 22.70s          | $0.0340     |
| <code>grok/grok-4.6</code>                             | Third-Party Service | 98.28       | 1.72%  | 0.34%  | 48.26s          | $0.0352     |
| <code>grok/grok-4.7</code>                             | Third-Party Service | 99.70       | 0.30%  | 0.38%  | 95.50s          | $0.0781     |
| <code>kimi/kimi-k2.6</code>                            | Third-Party Service | 99.33       | 0.67%  | 0.24%  | 21.42s          | $0.0231     |
| <code>kimi/kimi-k3</code>                              | Third-Party Service | 99.33       | 0.67%  | 0.25%  | 484.71s         | $0.4044     |
| <code>mistral/mistral-ocr-4-0</code>                   | Third-Party Service | 99.70       | 0.30%  | 0.21%  | 6.15s           | $0.0160     |
| <code>mistral/mistral-ocr-4-1</code>                   | Third-Party Service | 99.85       | 0.15%  | 0.19%  | 6.67s           | $0.0160     |
| <code>openai/gpt-5.6-luna</code>                       | Third-Party Service | 99.63       | 0.37%  | 0.25%  | 20.06s          | $0.0079     |
| <code>openai/gpt-5.6-sol</code>                        | Third-Party Service | 99.70       | 0.30%  | 0.38%  | 18.83s          | $0.1555     |
| <code>openai/gpt-5.6-terra</code>                      | Third-Party Service | 98.28       | 1.72%  | 0.34%  | 12.03s          | $0.0625     |
| <code>openai/gpt-6-astra</code>                        | Third-Party Service | 98.35       | 1.65%  | 0.34%  | 24.33s          | $0.2927     |
| <code>openai/gpt-6-luna</code>                         | Third-Party Service | 99.40       | 0.60%  | 0.64%  | 16.38s          | $0.0032     |
| <code>openai/gpt-6.1-sol</code>                        | Third-Party Service | 98.35       | 1.65%  | 0.34%  | 19.37s          | $0.0593     |

## Error Breakdown (WER)

| Provider                                               | Substitutions | Deletions | Insertions | Ref. Words |
| ------------------------------------------------------ | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>                  | 2             | 1         | 0          | 1337       |
| <code>anthropic/claude-fable-5-1</code>                | 10            | 2         | 10         | 1337       |
| <code>anthropic/claude-haiku-5-5</code>                | 4             | 5         | 879        | 1337       |
| <code>anthropic/claude-opus-5</code>                   | 2             | 1         | 0          | 1337       |
| <code>anthropic/claude-opus-5-5</code>                 | 2             | 1         | 0          | 1337       |
| <code>anthropic/claude-sonnet-5</code>                 | 2             | 1         | 0          | 1337       |
| <code>anthropic/claude-sonnet-5-5</code>               | 12            | 1         | 10         | 1337       |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 4             | 2         | 4          | 1337       |
| <code>deepinfra/google/gemma-4-31B-it</code>           | 8             | 2         | 8          | 1337       |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 8             | 0         | 7          | 1337       |
| <code>gemini/gemini-3.5-flash</code>                   | 2             | 0         | 0          | 1337       |
| <code>gemini/gemini-3.5-flash-lite</code>              | 10            | 11        | 9          | 1337       |
| <code>gemini/gemini-3.6-flash</code>                   | 1             | 8         | 0          | 1337       |
| <code>gemini/gemini-3.7-flash</code>                   | 0             | 2         | 0          | 1337       |
| <code>gemini/gemini-3.8-flash</code>                   | 0             | 2         | 0          | 1337       |
| <code>gemini/gemini-4-argon</code>                     | 10            | 1         | 10         | 1337       |
| <code>glm/glm-5.3-flash</code>                         | 2             | 3         | 0          | 1337       |
| <code>grok/grok-4.5</code>                             | 10            | 4         | 10         | 1337       |
| <code>grok/grok-4.6</code>                             | 11            | 2         | 10         | 1337       |
| <code>grok/grok-4.7</code>                             | 0             | 4         | 0          | 1337       |
| <code>kimi/kimi-k2.6</code>                            | 5             | 1         | 3          | 1337       |
| <code>kimi/kimi-k3</code>                              | 4             | 2         | 3          | 1337       |
| <code>mistral/mistral-ocr-4-0</code>                   | 1             | 2         | 1          | 1337       |
| <code>mistral/mistral-ocr-4-1</code>                   | 0             | 2         | 0          | 1337       |
| <code>openai/gpt-5.6-luna</code>                       | 1             | 3         | 1          | 1337       |
| <code>openai/gpt-5.6-sol</code>                        | 0             | 4         | 0          | 1337       |
| <code>openai/gpt-5.6-terra</code>                      | 11            | 2         | 10         | 1337       |
| <code>openai/gpt-6-astra</code>                        | 10            | 2         | 10         | 1337       |
| <code>openai/gpt-6-luna</code>                         | 0             | 8         | 0          | 1337       |
| <code>openai/gpt-6.1-sol</code>                        | 10            | 2         | 10         | 1337       |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best cloud service: `gemini/gemini-3.5-flash` scored 99.85/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0835¢ ($0.0008).
- Fastest cloud service: `mistral/mistral-ocr-4-0` at 6.15s.
