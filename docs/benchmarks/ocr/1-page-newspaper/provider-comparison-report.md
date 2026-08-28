# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/1-page-newspaper`
- Total providers: 27 (0 local, 27 third-party service)
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

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-3-27b-it</code> | $0.0003 | 9.61 | 90.39% | 93.82% | 52.34s | $0.0003 |
| 2 | <code>glm/glm-ocr</code> | $0.0003 | 83.48 | 16.52% | 25.60% | 6.16s | $0.0003 |
| 3 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | $0.0006 | 23.59 | 76.41% | 80.03% | 66.47s | $0.0006 |
| 4 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0010 | 0.00 | 105.21% | 96.24% | 74.66s | $0.0010 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0012 | 2.16 | 97.84% | 98.68% | 2.34s | $0.0012 |
| 6 | <code>openai/gpt-5.4-nano</code> | $0.0013 | 8.39 | 91.61% | 88.17% | 5.56s | $0.0013 |
| 7 | <code>mistral/mistral-ocr-2512</code> | $0.0020 | 43.80 | 56.20% | 53.92% | 7.38s | $0.0020 |
| 8 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 73.49 | 26.51% | 15.16% | 10.86s | $0.0040 |
| 9 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0045 | 11.10 | 88.90% | 104.56% | 102.82s | $0.0045 |
| 10 | <code>openai/gpt-5.6-luna</code> | $0.0048 | 67.26 | 32.74% | 38.87% | 14.67s | $0.0048 |
| 11 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0053 | 25.71 | 74.29% | 72.80% | 115.74s | $0.0053 |
| 12 | <code>openai/gpt-5.4-mini</code> | $0.0071 | 14.78 | 85.22% | 85.36% | 7.90s | $0.0071 |
| 13 | <code>grok/grok-4.3</code> | $0.0087 | 70.99 | 29.01% | 29.08% | 29.33s | $0.0087 |
| 14 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0094 | 66.37 | 33.63% | 41.82% | 28.02s | $0.0094 |
| 15 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0138 | 4.70 | 95.30% | 97.30% | 9.92s | $0.0138 |
| 16 | <code>anthropic/claude-haiku-4-5</code> | $0.0159 | 14.02 | 85.98% | 91.68% | 38.58s | $0.0159 |
| 17 | <code>kimi/kimi-k2.6</code> | $0.0171 | 93.94 | 6.06% | 1.49% | 100.68s | $0.0171 |
| 18 | <code>gemini/gemini-3.6-flash</code> | $0.0231 | 79.37 | 20.63% | 18.39% | 17.60s | $0.0231 |
| 19 | <code>grok/grok-4.5</code> | $0.0251 | 94.96 | 5.04% | 0.94% | 82.77s | $0.0251 |
| 20 | <code>openai/gpt-5.6-terra</code> | $0.0477 | 91.66 | 8.34% | 5.83% | 25.72s | $0.0477 |
| 21 | <code>gemini/gemini-3.5-flash</code> | $0.0537 | 0.00 | 186.07% | 94.35% | 29.57s | $0.0537 |
| 22 | <code>anthropic/claude-sonnet-5</code> | $0.0580 | 92.38 | 7.62% | 3.93% | 71.49s | $0.0580 |
| 23 | <code>openai/gpt-5.5</code> | $0.1032 | 30.62 | 69.38% | 83.13% | 33.62s | $0.1032 |
| 24 | <code>anthropic/claude-opus-4-8</code> | $0.1329 | 94.75 | 5.25% | 3.69% | 88.35s | $0.1329 |
| 25 | <code>anthropic/claude-opus-5</code> | $0.1330 | 97.37 | 2.63% | 1.37% | 79.18s | $0.1330 |
| 26 | <code>openai/gpt-5.6-sol</code> | $0.2569 | 97.33 | 2.67% | 1.61% | 71.66s | $0.2569 |
| 27 | <code>anthropic/claude-fable-5</code> | $0.3038 | 98.26 | 1.74% | 1.05% | 75.57s | $0.3038 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 2.34s | 2.16 | 97.84% | 98.68% | 2.34s | $0.0012 |
| 2 | <code>openai/gpt-5.4-nano</code> | 5.56s | 8.39 | 91.61% | 88.17% | 5.56s | $0.0013 |
| 3 | <code>glm/glm-ocr</code> | 6.16s | 83.48 | 16.52% | 25.60% | 6.16s | $0.0003 |
| 4 | <code>mistral/mistral-ocr-2512</code> | 7.38s | 43.80 | 56.20% | 53.92% | 7.38s | $0.0020 |
| 5 | <code>openai/gpt-5.4-mini</code> | 7.90s | 14.78 | 85.22% | 85.36% | 7.90s | $0.0071 |
| 6 | <code>gemini/gemini-3.1-pro-preview</code> | 9.92s | 4.70 | 95.30% | 97.30% | 9.92s | $0.0138 |
| 7 | <code>mistral/mistral-ocr-4-0</code> | 10.86s | 73.49 | 26.51% | 15.16% | 10.86s | $0.0040 |
| 8 | <code>openai/gpt-5.6-luna</code> | 14.67s | 67.26 | 32.74% | 38.87% | 14.67s | $0.0048 |
| 9 | <code>gemini/gemini-3.6-flash</code> | 17.60s | 79.37 | 20.63% | 18.39% | 17.60s | $0.0231 |
| 10 | <code>openai/gpt-5.6-terra</code> | 25.72s | 91.66 | 8.34% | 5.83% | 25.72s | $0.0477 |
| 11 | <code>grok/grok-4.20-0309-non-reasoning</code> | 28.02s | 66.37 | 33.63% | 41.82% | 28.02s | $0.0094 |
| 12 | <code>grok/grok-4.3</code> | 29.33s | 70.99 | 29.01% | 29.08% | 29.33s | $0.0087 |
| 13 | <code>gemini/gemini-3.5-flash</code> | 29.57s | 0.00 | 186.07% | 94.35% | 29.57s | $0.0537 |
| 14 | <code>openai/gpt-5.5</code> | 33.62s | 30.62 | 69.38% | 83.13% | 33.62s | $0.1032 |
| 15 | <code>anthropic/claude-haiku-4-5</code> | 38.58s | 14.02 | 85.98% | 91.68% | 38.58s | $0.0159 |
| 16 | <code>deepinfra/google/gemma-3-27b-it</code> | 52.34s | 9.61 | 90.39% | 93.82% | 52.34s | $0.0003 |
| 17 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 66.47s | 23.59 | 76.41% | 80.03% | 66.47s | $0.0006 |
| 18 | <code>anthropic/claude-sonnet-5</code> | 71.49s | 92.38 | 7.62% | 3.93% | 71.49s | $0.0580 |
| 19 | <code>openai/gpt-5.6-sol</code> | 71.66s | 97.33 | 2.67% | 1.61% | 71.66s | $0.2569 |
| 20 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 74.66s | 0.00 | 105.21% | 96.24% | 74.66s | $0.0010 |
| 21 | <code>anthropic/claude-fable-5</code> | 75.57s | 98.26 | 1.74% | 1.05% | 75.57s | $0.3038 |
| 22 | <code>anthropic/claude-opus-5</code> | 79.18s | 97.37 | 2.63% | 1.37% | 79.18s | $0.1330 |
| 23 | <code>grok/grok-4.5</code> | 82.77s | 94.96 | 5.04% | 0.94% | 82.77s | $0.0251 |
| 24 | <code>anthropic/claude-opus-4-8</code> | 88.35s | 94.75 | 5.25% | 3.69% | 88.35s | $0.1329 |
| 25 | <code>kimi/kimi-k2.6</code> | 100.68s | 93.94 | 6.06% | 1.49% | 100.68s | $0.0171 |
| 26 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 102.82s | 11.10 | 88.90% | 104.56% | 102.82s | $0.0045 |
| 27 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 115.74s | 25.71 | 74.29% | 72.80% | 115.74s | $0.0053 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 98.26/100 quality score | 98.26 | 1.74% | 1.05% | 75.57s | $0.3038 |
| 2 | <code>anthropic/claude-opus-5</code> | 97.37/100 quality score | 97.37 | 2.63% | 1.37% | 79.18s | $0.1330 |
| 3 | <code>openai/gpt-5.6-sol</code> | 97.33/100 quality score | 97.33 | 2.67% | 1.61% | 71.66s | $0.2569 |
| 4 | <code>grok/grok-4.5</code> | 94.96/100 quality score | 94.96 | 5.04% | 0.94% | 82.77s | $0.0251 |
| 5 | <code>anthropic/claude-opus-4-8</code> | 94.75/100 quality score | 94.75 | 5.25% | 3.69% | 88.35s | $0.1329 |
| 6 | <code>kimi/kimi-k2.6</code> | 93.94/100 quality score | 93.94 | 6.06% | 1.49% | 100.68s | $0.0171 |
| 7 | <code>anthropic/claude-sonnet-5</code> | 92.38/100 quality score | 92.38 | 7.62% | 3.93% | 71.49s | $0.0580 |
| 8 | <code>openai/gpt-5.6-terra</code> | 91.66/100 quality score | 91.66 | 8.34% | 5.83% | 25.72s | $0.0477 |
| 9 | <code>glm/glm-ocr</code> | 83.48/100 quality score | 83.48 | 16.52% | 25.60% | 6.16s | $0.0003 |
| 10 | <code>gemini/gemini-3.6-flash</code> | 79.37/100 quality score | 79.37 | 20.63% | 18.39% | 17.60s | $0.0231 |
| 11 | <code>mistral/mistral-ocr-4-0</code> | 73.49/100 quality score | 73.49 | 26.51% | 15.16% | 10.86s | $0.0040 |
| 12 | <code>grok/grok-4.3</code> | 70.99/100 quality score | 70.99 | 29.01% | 29.08% | 29.33s | $0.0087 |
| 13 | <code>openai/gpt-5.6-luna</code> | 67.26/100 quality score | 67.26 | 32.74% | 38.87% | 14.67s | $0.0048 |
| 14 | <code>grok/grok-4.20-0309-non-reasoning</code> | 66.37/100 quality score | 66.37 | 33.63% | 41.82% | 28.02s | $0.0094 |
| 15 | <code>mistral/mistral-ocr-2512</code> | 43.80/100 quality score | 43.80 | 56.20% | 53.92% | 7.38s | $0.0020 |
| 16 | <code>openai/gpt-5.5</code> | 30.62/100 quality score | 30.62 | 69.38% | 83.13% | 33.62s | $0.1032 |
| 17 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 25.71/100 quality score | 25.71 | 74.29% | 72.80% | 115.74s | $0.0053 |
| 18 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 23.59/100 quality score | 23.59 | 76.41% | 80.03% | 66.47s | $0.0006 |
| 19 | <code>openai/gpt-5.4-mini</code> | 14.78/100 quality score | 14.78 | 85.22% | 85.36% | 7.90s | $0.0071 |
| 20 | <code>anthropic/claude-haiku-4-5</code> | 14.02/100 quality score | 14.02 | 85.98% | 91.68% | 38.58s | $0.0159 |
| 21 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 11.10/100 quality score | 11.10 | 88.90% | 104.56% | 102.82s | $0.0045 |
| 22 | <code>deepinfra/google/gemma-3-27b-it</code> | 9.61/100 quality score | 9.61 | 90.39% | 93.82% | 52.34s | $0.0003 |
| 23 | <code>openai/gpt-5.4-nano</code> | 8.39/100 quality score | 8.39 | 91.61% | 88.17% | 5.56s | $0.0013 |
| 24 | <code>gemini/gemini-3.1-pro-preview</code> | 4.70/100 quality score | 4.70 | 95.30% | 97.30% | 9.92s | $0.0138 |
| 25 | <code>gemini/gemini-3.5-flash-lite</code> | 2.16/100 quality score | 2.16 | 97.84% | 98.68% | 2.34s | $0.0012 |
| 26 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 0.00/100 quality score | 0.00 | 105.21% | 96.24% | 74.66s | $0.0010 |
| 27 | <code>gemini/gemini-3.5-flash</code> | 0.00/100 quality score | 0.00 | 186.07% | 94.35% | 29.57s | $0.0537 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 98.26 | 1.74% | 1.05% | 75.57s | $0.3038 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 14.02 | 85.98% | 91.68% | 38.58s | $0.0159 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 94.75 | 5.25% | 3.69% | 88.35s | $0.1329 |
| <code>anthropic/claude-opus-5</code> | Third-Party Service | 97.37 | 2.63% | 1.37% | 79.18s | $0.1330 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 92.38 | 7.62% | 3.93% | 71.49s | $0.0580 |
| <code>deepinfra/google/gemma-3-27b-it</code> | Third-Party Service | 9.61 | 90.39% | 93.82% | 52.34s | $0.0003 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | Third-Party Service | 23.59 | 76.41% | 80.03% | 66.47s | $0.0006 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service | 0.00 | 105.21% | 96.24% | 74.66s | $0.0010 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 25.71 | 74.29% | 72.80% | 115.74s | $0.0053 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 11.10 | 88.90% | 104.56% | 102.82s | $0.0045 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 4.70 | 95.30% | 97.30% | 9.92s | $0.0138 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 0.00 | 186.07% | 94.35% | 29.57s | $0.0537 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 2.16 | 97.84% | 98.68% | 2.34s | $0.0012 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 79.37 | 20.63% | 18.39% | 17.60s | $0.0231 |
| <code>glm/glm-ocr</code> | Third-Party Service | 83.48 | 16.52% | 25.60% | 6.16s | $0.0003 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 66.37 | 33.63% | 41.82% | 28.02s | $0.0094 |
| <code>grok/grok-4.3</code> | Third-Party Service | 70.99 | 29.01% | 29.08% | 29.33s | $0.0087 |
| <code>grok/grok-4.5</code> | Third-Party Service | 94.96 | 5.04% | 0.94% | 82.77s | $0.0251 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 93.94 | 6.06% | 1.49% | 100.68s | $0.0171 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 43.80 | 56.20% | 53.92% | 7.38s | $0.0020 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 73.49 | 26.51% | 15.16% | 10.86s | $0.0040 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 14.78 | 85.22% | 85.36% | 7.90s | $0.0071 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 8.39 | 91.61% | 88.17% | 5.56s | $0.0013 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 30.62 | 69.38% | 83.13% | 33.62s | $0.1032 |
| <code>openai/gpt-5.6-luna</code> | Third-Party Service | 67.26 | 32.74% | 38.87% | 14.67s | $0.0048 |
| <code>openai/gpt-5.6-sol</code> | Third-Party Service | 97.33 | 2.67% | 1.61% | 71.66s | $0.2569 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 91.66 | 8.34% | 5.83% | 25.72s | $0.0477 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | 27 | 5 | 9 | 2361 |
| <code>anthropic/claude-haiku-4-5</code> | 1023 | 871 | 136 | 2361 |
| <code>anthropic/claude-opus-4-8</code> | 83 | 25 | 16 | 2361 |
| <code>anthropic/claude-opus-5</code> | 47 | 7 | 8 | 2361 |
| <code>anthropic/claude-sonnet-5</code> | 109 | 43 | 28 | 2361 |
| <code>deepinfra/google/gemma-3-27b-it</code> | 782 | 1344 | 8 | 2361 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 372 | 1418 | 14 | 2361 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 1613 | 52 | 819 | 2361 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 1519 | 158 | 77 | 2361 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 840 | 97 | 1162 | 2361 |
| <code>gemini/gemini-3.1-pro-preview</code> | 535 | 1714 | 1 | 2361 |
| <code>gemini/gemini-3.5-flash</code> | 1962 | 4 | 2427 | 2361 |
| <code>gemini/gemini-3.5-flash-lite</code> | 197 | 2113 | 0 | 2361 |
| <code>gemini/gemini-3.6-flash</code> | 330 | 104 | 53 | 2361 |
| <code>glm/glm-ocr</code> | 55 | 156 | 179 | 2361 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 83 | 609 | 102 | 2361 |
| <code>grok/grok-4.3</code> | 40 | 588 | 57 | 2361 |
| <code>grok/grok-4.5</code> | 67 | 4 | 48 | 2361 |
| <code>kimi/kimi-k2.6</code> | 83 | 7 | 53 | 2361 |
| <code>mistral/mistral-ocr-2512</code> | 639 | 661 | 27 | 2361 |
| <code>mistral/mistral-ocr-4-0</code> | 502 | 27 | 97 | 2361 |
| <code>openai/gpt-5.4-mini</code> | 477 | 1500 | 35 | 2361 |
| <code>openai/gpt-5.4-nano</code> | 206 | 1916 | 41 | 2361 |
| <code>openai/gpt-5.5</code> | 32 | 1606 | 0 | 2361 |
| <code>openai/gpt-5.6-luna</code> | 332 | 418 | 23 | 2361 |
| <code>openai/gpt-5.6-sol</code> | 41 | 18 | 4 | 2361 |
| <code>openai/gpt-5.6-terra</code> | 109 | 21 | 67 | 2361 |

## Notes

- Best cloud service: `anthropic/claude-fable-5` scored 98.26/100.
- The cheapest cloud provider was `deepinfra/google/gemma-3-27b-it` at 0.0286¢ ($0.0003).
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 2.34s.
