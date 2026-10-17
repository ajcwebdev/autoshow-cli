# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/ocr/05-pages-the-odyssey`
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

| Rank | Provider                                               | Value   | Score / 100 | WER    | CER   | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | ------: | ----------: | -----: | ----: | --------------: | ----------: |
| 1    | <code>deepinfra/google/gemma-4-31B-it</code>           | $0.0009 | 95.42       | 4.58%  | 1.31% | 15.73s          | $0.0009     |
| 2    | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0021 | 86.36       | 13.64% | 2.41% | 46.05s          | $0.0021     |
| 3    | <code>anthropic/claude-haiku-5-5</code>                | $0.0026 | 98.42       | 1.58%  | 0.29% | 32.20s          | $0.0026     |
| 4    | <code>openai/gpt-6-luna</code>                         | $0.0038 | 94.10       | 5.90%  | 1.74% | 36.85s          | $0.0038     |
| 5    | <code>gemini/gemini-3.5-flash-lite</code>              | $0.0056 | 97.89       | 2.11%  | 0.59% | 7.68s           | $0.0056     |
| 6    | <code>openai/gpt-5.6-luna</code>                       | $0.0077 | 92.34       | 7.66%  | 3.05% | 17.88s          | $0.0077     |
| 7    | <code>glm/glm-5.3-flash</code>                         | $0.0101 | 74.21       | 25.79% | 3.67% | 72.58s          | $0.0101     |
| 8    | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | $0.0104 | 80.90       | 19.10% | 4.34% | 13.27s          | $0.0104     |
| 9    | <code>gemini/gemini-3.6-flash</code>                   | $0.0184 | 96.48       | 3.52%  | 0.66% | 11.15s          | $0.0184     |
| 10   | <code>mistral/mistral-ocr-4-0</code>                   | $0.0200 | 89.88       | 10.12% | 2.41% | 5.93s           | $0.0200     |
| 11   | <code>mistral/mistral-ocr-4-1</code>                   | $0.0200 | 92.43       | 7.57%  | 1.83% | 5.82s           | $0.0200     |
| 12   | <code>gemini/gemini-3.7-flash</code>                   | $0.0208 | 73.94       | 26.06% | 3.72% | 7.48s           | $0.0208     |
| 13   | <code>gemini/gemini-3.5-flash</code>                   | $0.0224 | 98.86       | 1.14%  | 0.19% | 11.31s          | $0.0224     |
| 14   | <code>gemini/gemini-3.8-flash</code>                   | $0.0243 | 81.16       | 18.84% | 3.76% | 15.01s          | $0.0243     |
| 15   | <code>kimi/kimi-k2.6</code>                            | $0.0270 | 92.52       | 7.48%  | 1.48% | 17.63s          | $0.0270     |
| 16   | <code>grok/grok-4.5</code>                             | $0.0404 | 79.23       | 20.77% | 4.09% | 32.85s          | $0.0404     |
| 17   | <code>grok/grok-4.6</code>                             | $0.0418 | 87.41       | 12.59% | 2.29% | 42.91s          | $0.0418     |
| 18   | <code>anthropic/claude-sonnet-5-5</code>               | $0.0443 | 97.10       | 2.90%  | 0.43% | 42.78s          | $0.0443     |
| 19   | <code>anthropic/claude-sonnet-5</code>                 | $0.0461 | 81.51       | 18.49% | 3.69% | 43.71s          | $0.0461     |
| 20   | <code>openai/gpt-6.1-sol</code>                        | $0.0563 | 73.68       | 26.32% | 3.71% | 23.05s          | $0.0563     |
| 21   | <code>gemini/gemini-4-argon</code>                     | $0.0564 | 73.50       | 26.50% | 3.79% | 21.69s          | $0.0564     |
| 22   | <code>openai/gpt-5.6-terra</code>                      | $0.0574 | 96.83       | 3.17%  | 0.55% | 14.80s          | $0.0574     |
| 23   | <code>anthropic/claude-opus-5-5</code>                 | $0.0953 | 73.86       | 26.14% | 3.69% | 25.37s          | $0.0953     |
| 24   | <code>anthropic/claude-opus-5</code>                   | $0.1150 | 81.25       | 18.75% | 3.76% | 54.38s          | $0.1150     |
| 25   | <code>openai/gpt-5.6-sol</code>                        | $0.1512 | 97.10       | 2.90%  | 0.50% | 21.92s          | $0.1512     |
| 26   | <code>kimi/kimi-k3</code>                              | $0.2039 | 97.01       | 2.99%  | 0.47% | 84.51s          | $0.2039     |
| 27   | <code>anthropic/claude-fable-5-1</code>                | $0.2253 | 81.07       | 18.93% | 3.76% | 47.46s          | $0.2253     |
| 28   | <code>anthropic/claude-fable-5</code>                  | $0.2297 | 80.99       | 19.01% | 3.81% | 48.41s          | $0.2297     |
| 29   | <code>openai/gpt-6-astra</code>                        | $0.2688 | 96.65       | 3.35%  | 0.52% | 22.48s          | $0.2688     |
| 30   | <code>grok/grok-4.7</code>                             | $0.2847 | 92.17       | 7.83%  | 1.12% | 492.23s         | $0.2847     |

#### Speed

| Rank | Provider                                               | Value   | Score / 100 | WER    | CER   | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | ------: | ----------: | -----: | ----: | --------------: | ----------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>                   | 5.82s   | 92.43       | 7.57%  | 1.83% | 5.82s           | $0.0200     |
| 2    | <code>mistral/mistral-ocr-4-0</code>                   | 5.93s   | 89.88       | 10.12% | 2.41% | 5.93s           | $0.0200     |
| 3    | <code>gemini/gemini-3.7-flash</code>                   | 7.48s   | 73.94       | 26.06% | 3.72% | 7.48s           | $0.0208     |
| 4    | <code>gemini/gemini-3.5-flash-lite</code>              | 7.68s   | 97.89       | 2.11%  | 0.59% | 7.68s           | $0.0056     |
| 5    | <code>gemini/gemini-3.6-flash</code>                   | 11.15s  | 96.48       | 3.52%  | 0.66% | 11.15s          | $0.0184     |
| 6    | <code>gemini/gemini-3.5-flash</code>                   | 11.31s  | 98.86       | 1.14%  | 0.19% | 11.31s          | $0.0224     |
| 7    | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 13.27s  | 80.90       | 19.10% | 4.34% | 13.27s          | $0.0104     |
| 8    | <code>openai/gpt-5.6-terra</code>                      | 14.80s  | 96.83       | 3.17%  | 0.55% | 14.80s          | $0.0574     |
| 9    | <code>gemini/gemini-3.8-flash</code>                   | 15.01s  | 81.16       | 18.84% | 3.76% | 15.01s          | $0.0243     |
| 10   | <code>deepinfra/google/gemma-4-31B-it</code>           | 15.73s  | 95.42       | 4.58%  | 1.31% | 15.73s          | $0.0009     |
| 11   | <code>kimi/kimi-k2.6</code>                            | 17.63s  | 92.52       | 7.48%  | 1.48% | 17.63s          | $0.0270     |
| 12   | <code>openai/gpt-5.6-luna</code>                       | 17.88s  | 92.34       | 7.66%  | 3.05% | 17.88s          | $0.0077     |
| 13   | <code>gemini/gemini-4-argon</code>                     | 21.69s  | 73.50       | 26.50% | 3.79% | 21.69s          | $0.0564     |
| 14   | <code>openai/gpt-5.6-sol</code>                        | 21.92s  | 97.10       | 2.90%  | 0.50% | 21.92s          | $0.1512     |
| 15   | <code>openai/gpt-6-astra</code>                        | 22.48s  | 96.65       | 3.35%  | 0.52% | 22.48s          | $0.2688     |
| 16   | <code>openai/gpt-6.1-sol</code>                        | 23.05s  | 73.68       | 26.32% | 3.71% | 23.05s          | $0.0563     |
| 17   | <code>anthropic/claude-opus-5-5</code>                 | 25.37s  | 73.86       | 26.14% | 3.69% | 25.37s          | $0.0953     |
| 18   | <code>anthropic/claude-haiku-5-5</code>                | 32.20s  | 98.42       | 1.58%  | 0.29% | 32.20s          | $0.0026     |
| 19   | <code>grok/grok-4.5</code>                             | 32.85s  | 79.23       | 20.77% | 4.09% | 32.85s          | $0.0404     |
| 20   | <code>openai/gpt-6-luna</code>                         | 36.85s  | 94.10       | 5.90%  | 1.74% | 36.85s          | $0.0038     |
| 21   | <code>anthropic/claude-sonnet-5-5</code>               | 42.78s  | 97.10       | 2.90%  | 0.43% | 42.78s          | $0.0443     |
| 22   | <code>grok/grok-4.6</code>                             | 42.91s  | 87.41       | 12.59% | 2.29% | 42.91s          | $0.0418     |
| 23   | <code>anthropic/claude-sonnet-5</code>                 | 43.71s  | 81.51       | 18.49% | 3.69% | 43.71s          | $0.0461     |
| 24   | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 46.05s  | 86.36       | 13.64% | 2.41% | 46.05s          | $0.0021     |
| 25   | <code>anthropic/claude-fable-5-1</code>                | 47.46s  | 81.07       | 18.93% | 3.76% | 47.46s          | $0.2253     |
| 26   | <code>anthropic/claude-fable-5</code>                  | 48.41s  | 80.99       | 19.01% | 3.81% | 48.41s          | $0.2297     |
| 27   | <code>anthropic/claude-opus-5</code>                   | 54.38s  | 81.25       | 18.75% | 3.76% | 54.38s          | $0.1150     |
| 28   | <code>glm/glm-5.3-flash</code>                         | 72.58s  | 74.21       | 25.79% | 3.67% | 72.58s          | $0.0101     |
| 29   | <code>kimi/kimi-k3</code>                              | 84.51s  | 97.01       | 2.99%  | 0.47% | 84.51s          | $0.2039     |
| 30   | <code>grok/grok-4.7</code>                             | 492.23s | 92.17       | 7.83%  | 1.12% | 492.23s         | $0.2847     |

#### Quality Score

| Rank | Provider                                               | Value                   | Score / 100 | WER    | CER   | Processing Time | Actual Cost |
| ---: | ------------------------------------------------------ | ----------------------: | ----------: | -----: | ----: | --------------: | ----------: |
| 1    | <code>gemini/gemini-3.5-flash</code>                   | 98.86/100 quality score | 98.86       | 1.14%  | 0.19% | 11.31s          | $0.0224     |
| 2    | <code>anthropic/claude-haiku-5-5</code>                | 98.42/100 quality score | 98.42       | 1.58%  | 0.29% | 32.20s          | $0.0026     |
| 3    | <code>gemini/gemini-3.5-flash-lite</code>              | 97.89/100 quality score | 97.89       | 2.11%  | 0.59% | 7.68s           | $0.0056     |
| 4    | <code>anthropic/claude-sonnet-5-5</code>               | 97.10/100 quality score | 97.10       | 2.90%  | 0.43% | 42.78s          | $0.0443     |
| 5    | <code>openai/gpt-5.6-sol</code>                        | 97.10/100 quality score | 97.10       | 2.90%  | 0.50% | 21.92s          | $0.1512     |
| 6    | <code>kimi/kimi-k3</code>                              | 97.01/100 quality score | 97.01       | 2.99%  | 0.47% | 84.51s          | $0.2039     |
| 7    | <code>openai/gpt-5.6-terra</code>                      | 96.83/100 quality score | 96.83       | 3.17%  | 0.55% | 14.80s          | $0.0574     |
| 8    | <code>openai/gpt-6-astra</code>                        | 96.65/100 quality score | 96.65       | 3.35%  | 0.52% | 22.48s          | $0.2688     |
| 9    | <code>gemini/gemini-3.6-flash</code>                   | 96.48/100 quality score | 96.48       | 3.52%  | 0.66% | 11.15s          | $0.0184     |
| 10   | <code>deepinfra/google/gemma-4-31B-it</code>           | 95.42/100 quality score | 95.42       | 4.58%  | 1.31% | 15.73s          | $0.0009     |
| 11   | <code>openai/gpt-6-luna</code>                         | 94.10/100 quality score | 94.10       | 5.90%  | 1.74% | 36.85s          | $0.0038     |
| 12   | <code>kimi/kimi-k2.6</code>                            | 92.52/100 quality score | 92.52       | 7.48%  | 1.48% | 17.63s          | $0.0270     |
| 13   | <code>mistral/mistral-ocr-4-1</code>                   | 92.43/100 quality score | 92.43       | 7.57%  | 1.83% | 5.82s           | $0.0200     |
| 14   | <code>openai/gpt-5.6-luna</code>                       | 92.34/100 quality score | 92.34       | 7.66%  | 3.05% | 17.88s          | $0.0077     |
| 15   | <code>grok/grok-4.7</code>                             | 92.17/100 quality score | 92.17       | 7.83%  | 1.12% | 492.23s         | $0.2847     |
| 16   | <code>mistral/mistral-ocr-4-0</code>                   | 89.88/100 quality score | 89.88       | 10.12% | 2.41% | 5.93s           | $0.0200     |
| 17   | <code>grok/grok-4.6</code>                             | 87.41/100 quality score | 87.41       | 12.59% | 2.29% | 42.91s          | $0.0418     |
| 18   | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 86.36/100 quality score | 86.36       | 13.64% | 2.41% | 46.05s          | $0.0021     |
| 19   | <code>anthropic/claude-sonnet-5</code>                 | 81.51/100 quality score | 81.51       | 18.49% | 3.69% | 43.71s          | $0.0461     |
| 20   | <code>anthropic/claude-opus-5</code>                   | 81.25/100 quality score | 81.25       | 18.75% | 3.76% | 54.38s          | $0.1150     |
| 21   | <code>gemini/gemini-3.8-flash</code>                   | 81.16/100 quality score | 81.16       | 18.84% | 3.76% | 15.01s          | $0.0243     |
| 22   | <code>anthropic/claude-fable-5-1</code>                | 81.07/100 quality score | 81.07       | 18.93% | 3.76% | 47.46s          | $0.2253     |
| 23   | <code>anthropic/claude-fable-5</code>                  | 80.99/100 quality score | 80.99       | 19.01% | 3.81% | 48.41s          | $0.2297     |
| 24   | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 80.90/100 quality score | 80.90       | 19.10% | 4.34% | 13.27s          | $0.0104     |
| 25   | <code>grok/grok-4.5</code>                             | 79.23/100 quality score | 79.23       | 20.77% | 4.09% | 32.85s          | $0.0404     |
| 26   | <code>glm/glm-5.3-flash</code>                         | 74.21/100 quality score | 74.21       | 25.79% | 3.67% | 72.58s          | $0.0101     |
| 27   | <code>gemini/gemini-3.7-flash</code>                   | 73.94/100 quality score | 73.94       | 26.06% | 3.72% | 7.48s           | $0.0208     |
| 28   | <code>anthropic/claude-opus-5-5</code>                 | 73.86/100 quality score | 73.86       | 26.14% | 3.69% | 25.37s          | $0.0953     |
| 29   | <code>openai/gpt-6.1-sol</code>                        | 73.68/100 quality score | 73.68       | 26.32% | 3.71% | 23.05s          | $0.0563     |
| 30   | <code>gemini/gemini-4-argon</code>                     | 73.50/100 quality score | 73.50       | 26.50% | 3.79% | 21.69s          | $0.0564     |


## Provider Detail

| Provider                                               | Group               | Score / 100 | WER    | CER   | Processing Time | Actual Cost |
| ------------------------------------------------------ | ------------------- | ----------: | -----: | ----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>                  | Third-Party Service | 80.99       | 19.01% | 3.81% | 48.41s          | $0.2297     |
| <code>anthropic/claude-fable-5-1</code>                | Third-Party Service | 81.07       | 18.93% | 3.76% | 47.46s          | $0.2253     |
| <code>anthropic/claude-haiku-5-5</code>                | Third-Party Service | 98.42       | 1.58%  | 0.29% | 32.20s          | $0.0026     |
| <code>anthropic/claude-opus-5</code>                   | Third-Party Service | 81.25       | 18.75% | 3.76% | 54.38s          | $0.1150     |
| <code>anthropic/claude-opus-5-5</code>                 | Third-Party Service | 73.86       | 26.14% | 3.69% | 25.37s          | $0.0953     |
| <code>anthropic/claude-sonnet-5</code>                 | Third-Party Service | 81.51       | 18.49% | 3.69% | 43.71s          | $0.0461     |
| <code>anthropic/claude-sonnet-5-5</code>               | Third-Party Service | 97.10       | 2.90%  | 0.43% | 42.78s          | $0.0443     |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 86.36       | 13.64% | 2.41% | 46.05s          | $0.0021     |
| <code>deepinfra/google/gemma-4-31B-it</code>           | Third-Party Service | 95.42       | 4.58%  | 1.31% | 15.73s          | $0.0009     |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>                | Third-Party Service | 80.90       | 19.10% | 4.34% | 13.27s          | $0.0104     |
| <code>gemini/gemini-3.5-flash</code>                   | Third-Party Service | 98.86       | 1.14%  | 0.19% | 11.31s          | $0.0224     |
| <code>gemini/gemini-3.5-flash-lite</code>              | Third-Party Service | 97.89       | 2.11%  | 0.59% | 7.68s           | $0.0056     |
| <code>gemini/gemini-3.6-flash</code>                   | Third-Party Service | 96.48       | 3.52%  | 0.66% | 11.15s          | $0.0184     |
| <code>gemini/gemini-3.7-flash</code>                   | Third-Party Service | 73.94       | 26.06% | 3.72% | 7.48s           | $0.0208     |
| <code>gemini/gemini-3.8-flash</code>                   | Third-Party Service | 81.16       | 18.84% | 3.76% | 15.01s          | $0.0243     |
| <code>gemini/gemini-4-argon</code>                     | Third-Party Service | 73.50       | 26.50% | 3.79% | 21.69s          | $0.0564     |
| <code>glm/glm-5.3-flash</code>                         | Third-Party Service | 74.21       | 25.79% | 3.67% | 72.58s          | $0.0101     |
| <code>grok/grok-4.5</code>                             | Third-Party Service | 79.23       | 20.77% | 4.09% | 32.85s          | $0.0404     |
| <code>grok/grok-4.6</code>                             | Third-Party Service | 87.41       | 12.59% | 2.29% | 42.91s          | $0.0418     |
| <code>grok/grok-4.7</code>                             | Third-Party Service | 92.17       | 7.83%  | 1.12% | 492.23s         | $0.2847     |
| <code>kimi/kimi-k2.6</code>                            | Third-Party Service | 92.52       | 7.48%  | 1.48% | 17.63s          | $0.0270     |
| <code>kimi/kimi-k3</code>                              | Third-Party Service | 97.01       | 2.99%  | 0.47% | 84.51s          | $0.2039     |
| <code>mistral/mistral-ocr-4-0</code>                   | Third-Party Service | 89.88       | 10.12% | 2.41% | 5.93s           | $0.0200     |
| <code>mistral/mistral-ocr-4-1</code>                   | Third-Party Service | 92.43       | 7.57%  | 1.83% | 5.82s           | $0.0200     |
| <code>openai/gpt-5.6-luna</code>                       | Third-Party Service | 92.34       | 7.66%  | 3.05% | 17.88s          | $0.0077     |
| <code>openai/gpt-5.6-sol</code>                        | Third-Party Service | 97.10       | 2.90%  | 0.50% | 21.92s          | $0.1512     |
| <code>openai/gpt-5.6-terra</code>                      | Third-Party Service | 96.83       | 3.17%  | 0.55% | 14.80s          | $0.0574     |
| <code>openai/gpt-6-astra</code>                        | Third-Party Service | 96.65       | 3.35%  | 0.52% | 22.48s          | $0.2688     |
| <code>openai/gpt-6-luna</code>                         | Third-Party Service | 94.10       | 5.90%  | 1.74% | 36.85s          | $0.0038     |
| <code>openai/gpt-6.1-sol</code>                        | Third-Party Service | 73.68       | 26.32% | 3.71% | 23.05s          | $0.0563     |

## Error Breakdown (WER)

| Provider                                               | Substitutions | Deletions | Insertions | Ref. Words |
| ------------------------------------------------------ | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>                  | 189           | 3         | 24         | 1136       |
| <code>anthropic/claude-fable-5-1</code>                | 189           | 25        | 1          | 1136       |
| <code>anthropic/claude-haiku-5-5</code>                | 14            | 3         | 1          | 1136       |
| <code>anthropic/claude-opus-5</code>                   | 188           | 1         | 24         | 1136       |
| <code>anthropic/claude-opus-5-5</code>                 | 189           | 24        | 84         | 1136       |
| <code>anthropic/claude-sonnet-5</code>                 | 187           | 23        | 0          | 1136       |
| <code>anthropic/claude-sonnet-5-5</code>               | 11            | 22        | 0          | 1136       |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 115           | 19        | 21         | 1136       |
| <code>deepinfra/google/gemma-4-31B-it</code>           | 36            | 6         | 10         | 1136       |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 158           | 22        | 37         | 1136       |
| <code>gemini/gemini-3.5-flash</code>                   | 9             | 3         | 1          | 1136       |
| <code>gemini/gemini-3.5-flash-lite</code>              | 18            | 5         | 1          | 1136       |
| <code>gemini/gemini-3.6-flash</code>                   | 17            | 23        | 0          | 1136       |
| <code>gemini/gemini-3.7-flash</code>                   | 185           | 1         | 110        | 1136       |
| <code>gemini/gemini-3.8-flash</code>                   | 187           | 3         | 24         | 1136       |
| <code>gemini/gemini-4-argon</code>                     | 188           | 3         | 110        | 1136       |
| <code>glm/glm-5.3-flash</code>                         | 186           | 21        | 86         | 1136       |
| <code>grok/grok-4.5</code>                             | 144           | 42        | 50         | 1136       |
| <code>grok/grok-4.6</code>                             | 114           | 17        | 12         | 1136       |
| <code>grok/grok-4.7</code>                             | 51            | 18        | 20         | 1136       |
| <code>kimi/kimi-k2.6</code>                            | 59            | 26        | 0          | 1136       |
| <code>kimi/kimi-k3</code>                              | 13            | 21        | 0          | 1136       |
| <code>mistral/mistral-ocr-4-0</code>                   | 98            | 14        | 3          | 1136       |
| <code>mistral/mistral-ocr-4-1</code>                   | 55            | 29        | 2          | 1136       |
| <code>openai/gpt-5.6-luna</code>                       | 20            | 61        | 6          | 1136       |
| <code>openai/gpt-5.6-sol</code>                        | 9             | 0         | 24         | 1136       |
| <code>openai/gpt-5.6-terra</code>                      | 13            | 22        | 1          | 1136       |
| <code>openai/gpt-6-astra</code>                        | 13            | 25        | 0          | 1136       |
| <code>openai/gpt-6-luna</code>                         | 17            | 50        | 0          | 1136       |
| <code>openai/gpt-6.1-sol</code>                        | 191           | 23        | 85         | 1136       |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best cloud service: `gemini/gemini-3.5-flash` scored 98.86/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0891¢ ($0.0009).
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 5.82s.
