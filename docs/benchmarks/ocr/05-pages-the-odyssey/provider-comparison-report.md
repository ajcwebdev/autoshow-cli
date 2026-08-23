# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/05-pages-the-odyssey`
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
| 1 | <code>glm/glm-ocr</code> | $0.0003 | 79.67 | 20.33% | 15.39% | 10.25s | $0.0003 |
| 2 | <code>deepinfra/google/gemma-3-27b-it</code> | $0.0004 | 80.37 | 19.63% | 5.17% | 38.85s | $0.0004 |
| 3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0011 | 84.07 | 15.93% | 4.26% | 22.15s | $0.0011 |
| 4 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | $0.0017 | 77.11 | 22.89% | 7.17% | 26.33s | $0.0017 |
| 5 | <code>openai/gpt-5.4-nano</code> | $0.0036 | 57.48 | 42.52% | 37.16% | 8.85s | $0.0036 |
| 6 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0052 | 88.82 | 11.18% | 4.02% | 39.41s | $0.0052 |
| 7 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0056 | 97.54 | 2.46% | 0.72% | 7.68s | $0.0056 |
| 8 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0071 | 84.07 | 15.93% | 4.10% | 36.15s | $0.0071 |
| 9 | <code>openai/gpt-5.6-luna</code> | $0.0077 | 92.17 | 7.83% | 3.09% | 17.88s | $0.0077 |
| 10 | <code>mistral/mistral-ocr-2512</code> | $0.0100 | 96.39 | 3.61% | 1.47% | 6.18s | $0.0100 |
| 11 | <code>openai/gpt-5.4-mini</code> | $0.0104 | 28.96 | 71.04% | 69.41% | 5.36s | $0.0104 |
| 12 | <code>gemini/gemini-3.6-flash</code> | $0.0184 | 96.30 | 3.70% | 0.76% | 11.15s | $0.0184 |
| 13 | <code>anthropic/claude-haiku-4-5</code> | $0.0193 | 94.28 | 5.72% | 1.38% | 37.88s | $0.0193 |
| 14 | <code>mistral/mistral-ocr-4-0</code> | $0.0200 | 89.79 | 10.21% | 2.50% | 5.93s | $0.0200 |
| 15 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0205 | 87.24 | 12.76% | 3.79% | 6.43s | $0.0205 |
| 16 | <code>grok/grok-4.3</code> | $0.0207 | 95.95 | 4.05% | 0.88% | 12.60s | $0.0207 |
| 17 | <code>gemini/gemini-3.5-flash</code> | $0.0224 | 98.59 | 1.41% | 0.31% | 11.31s | $0.0224 |
| 18 | <code>kimi/kimi-k2.6</code> | $0.0270 | 92.17 | 7.83% | 1.62% | 17.63s | $0.0270 |
| 19 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0312 | 81.07 | 18.93% | 3.91% | 18.57s | $0.0312 |
| 20 | <code>grok/grok-4.5</code> | $0.0404 | 79.05 | 20.95% | 4.12% | 32.85s | $0.0404 |
| 21 | <code>anthropic/claude-sonnet-5</code> | $0.0461 | 81.34 | 18.66% | 3.79% | 43.71s | $0.0461 |
| 22 | <code>openai/gpt-5.6-terra</code> | $0.0574 | 96.48 | 3.52% | 0.69% | 14.80s | $0.0574 |
| 23 | <code>anthropic/claude-opus-5</code> | $0.1150 | 81.07 | 18.93% | 3.86% | 54.38s | $0.1150 |
| 24 | <code>anthropic/claude-opus-4-8</code> | $0.1153 | 82.75 | 17.25% | 3.58% | 55.79s | $0.1153 |
| 25 | <code>openai/gpt-5.6-sol</code> | $0.1512 | 96.74 | 3.26% | 0.64% | 21.92s | $0.1512 |
| 26 | <code>openai/gpt-5.5</code> | $0.2125 | 76.50 | 23.50% | 3.33% | 47.82s | $0.2125 |
| 27 | <code>anthropic/claude-fable-5</code> | $0.2297 | 80.81 | 19.19% | 3.91% | 48.41s | $0.2297 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>openai/gpt-5.4-mini</code> | 5.36s | 28.96 | 71.04% | 69.41% | 5.36s | $0.0104 |
| 2 | <code>mistral/mistral-ocr-4-0</code> | 5.93s | 89.79 | 10.21% | 2.50% | 5.93s | $0.0200 |
| 3 | <code>mistral/mistral-ocr-2512</code> | 6.18s | 96.39 | 3.61% | 1.47% | 6.18s | $0.0100 |
| 4 | <code>grok/grok-4.20-0309-non-reasoning</code> | 6.43s | 87.24 | 12.76% | 3.79% | 6.43s | $0.0205 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | 7.68s | 97.54 | 2.46% | 0.72% | 7.68s | $0.0056 |
| 6 | <code>openai/gpt-5.4-nano</code> | 8.85s | 57.48 | 42.52% | 37.16% | 8.85s | $0.0036 |
| 7 | <code>glm/glm-ocr</code> | 10.25s | 79.67 | 20.33% | 15.39% | 10.25s | $0.0003 |
| 8 | <code>gemini/gemini-3.6-flash</code> | 11.15s | 96.30 | 3.70% | 0.76% | 11.15s | $0.0184 |
| 9 | <code>gemini/gemini-3.5-flash</code> | 11.31s | 98.59 | 1.41% | 0.31% | 11.31s | $0.0224 |
| 10 | <code>grok/grok-4.3</code> | 12.60s | 95.95 | 4.05% | 0.88% | 12.60s | $0.0207 |
| 11 | <code>openai/gpt-5.6-terra</code> | 14.80s | 96.48 | 3.52% | 0.69% | 14.80s | $0.0574 |
| 12 | <code>kimi/kimi-k2.6</code> | 17.63s | 92.17 | 7.83% | 1.62% | 17.63s | $0.0270 |
| 13 | <code>openai/gpt-5.6-luna</code> | 17.88s | 92.17 | 7.83% | 3.09% | 17.88s | $0.0077 |
| 14 | <code>gemini/gemini-3.1-pro-preview</code> | 18.57s | 81.07 | 18.93% | 3.91% | 18.57s | $0.0312 |
| 15 | <code>openai/gpt-5.6-sol</code> | 21.92s | 96.74 | 3.26% | 0.64% | 21.92s | $0.1512 |
| 16 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 22.15s | 84.07 | 15.93% | 4.26% | 22.15s | $0.0011 |
| 17 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 26.33s | 77.11 | 22.89% | 7.17% | 26.33s | $0.0017 |
| 18 | <code>grok/grok-4.5</code> | 32.85s | 79.05 | 20.95% | 4.12% | 32.85s | $0.0404 |
| 19 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 36.15s | 84.07 | 15.93% | 4.10% | 36.15s | $0.0071 |
| 20 | <code>anthropic/claude-haiku-4-5</code> | 37.88s | 94.28 | 5.72% | 1.38% | 37.88s | $0.0193 |
| 21 | <code>deepinfra/google/gemma-3-27b-it</code> | 38.85s | 80.37 | 19.63% | 5.17% | 38.85s | $0.0004 |
| 22 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 39.41s | 88.82 | 11.18% | 4.02% | 39.41s | $0.0052 |
| 23 | <code>anthropic/claude-sonnet-5</code> | 43.71s | 81.34 | 18.66% | 3.79% | 43.71s | $0.0461 |
| 24 | <code>openai/gpt-5.5</code> | 47.82s | 76.50 | 23.50% | 3.33% | 47.82s | $0.2125 |
| 25 | <code>anthropic/claude-fable-5</code> | 48.41s | 80.81 | 19.19% | 3.91% | 48.41s | $0.2297 |
| 26 | <code>anthropic/claude-opus-5</code> | 54.38s | 81.07 | 18.93% | 3.86% | 54.38s | $0.1150 |
| 27 | <code>anthropic/claude-opus-4-8</code> | 55.79s | 82.75 | 17.25% | 3.58% | 55.79s | $0.1153 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash</code> | 98.59/100 quality score | 98.59 | 1.41% | 0.31% | 11.31s | $0.0224 |
| 2 | <code>gemini/gemini-3.5-flash-lite</code> | 97.54/100 quality score | 97.54 | 2.46% | 0.72% | 7.68s | $0.0056 |
| 3 | <code>openai/gpt-5.6-sol</code> | 96.74/100 quality score | 96.74 | 3.26% | 0.64% | 21.92s | $0.1512 |
| 4 | <code>openai/gpt-5.6-terra</code> | 96.48/100 quality score | 96.48 | 3.52% | 0.69% | 14.80s | $0.0574 |
| 5 | <code>mistral/mistral-ocr-2512</code> | 96.39/100 quality score | 96.39 | 3.61% | 1.47% | 6.18s | $0.0100 |
| 6 | <code>gemini/gemini-3.6-flash</code> | 96.30/100 quality score | 96.30 | 3.70% | 0.76% | 11.15s | $0.0184 |
| 7 | <code>grok/grok-4.3</code> | 95.95/100 quality score | 95.95 | 4.05% | 0.88% | 12.60s | $0.0207 |
| 8 | <code>anthropic/claude-haiku-4-5</code> | 94.28/100 quality score | 94.28 | 5.72% | 1.38% | 37.88s | $0.0193 |
| 9 | <code>kimi/kimi-k2.6</code> | 92.17/100 quality score | 92.17 | 7.83% | 1.62% | 17.63s | $0.0270 |
| 10 | <code>openai/gpt-5.6-luna</code> | 92.17/100 quality score | 92.17 | 7.83% | 3.09% | 17.88s | $0.0077 |
| 11 | <code>mistral/mistral-ocr-4-0</code> | 89.79/100 quality score | 89.79 | 10.21% | 2.50% | 5.93s | $0.0200 |
| 12 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 88.82/100 quality score | 88.82 | 11.18% | 4.02% | 39.41s | $0.0052 |
| 13 | <code>grok/grok-4.20-0309-non-reasoning</code> | 87.24/100 quality score | 87.24 | 12.76% | 3.79% | 6.43s | $0.0205 |
| 14 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 84.07/100 quality score | 84.07 | 15.93% | 4.10% | 36.15s | $0.0071 |
| 15 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 84.07/100 quality score | 84.07 | 15.93% | 4.26% | 22.15s | $0.0011 |
| 16 | <code>anthropic/claude-opus-4-8</code> | 82.75/100 quality score | 82.75 | 17.25% | 3.58% | 55.79s | $0.1153 |
| 17 | <code>anthropic/claude-sonnet-5</code> | 81.34/100 quality score | 81.34 | 18.66% | 3.79% | 43.71s | $0.0461 |
| 18 | <code>anthropic/claude-opus-5</code> | 81.07/100 quality score | 81.07 | 18.93% | 3.86% | 54.38s | $0.1150 |
| 19 | <code>gemini/gemini-3.1-pro-preview</code> | 81.07/100 quality score | 81.07 | 18.93% | 3.91% | 18.57s | $0.0312 |
| 20 | <code>anthropic/claude-fable-5</code> | 80.81/100 quality score | 80.81 | 19.19% | 3.91% | 48.41s | $0.2297 |
| 21 | <code>deepinfra/google/gemma-3-27b-it</code> | 80.37/100 quality score | 80.37 | 19.63% | 5.17% | 38.85s | $0.0004 |
| 22 | <code>glm/glm-ocr</code> | 79.67/100 quality score | 79.67 | 20.33% | 15.39% | 10.25s | $0.0003 |
| 23 | <code>grok/grok-4.5</code> | 79.05/100 quality score | 79.05 | 20.95% | 4.12% | 32.85s | $0.0404 |
| 24 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 77.11/100 quality score | 77.11 | 22.89% | 7.17% | 26.33s | $0.0017 |
| 25 | <code>openai/gpt-5.5</code> | 76.50/100 quality score | 76.50 | 23.50% | 3.33% | 47.82s | $0.2125 |
| 26 | <code>openai/gpt-5.4-nano</code> | 57.48/100 quality score | 57.48 | 42.52% | 37.16% | 8.85s | $0.0036 |
| 27 | <code>openai/gpt-5.4-mini</code> | 28.96/100 quality score | 28.96 | 71.04% | 69.41% | 5.36s | $0.0104 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 80.81 | 19.19% | 3.91% | 48.41s | $0.2297 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 94.28 | 5.72% | 1.38% | 37.88s | $0.0193 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 82.75 | 17.25% | 3.58% | 55.79s | $0.1153 |
| <code>anthropic/claude-opus-5</code> | Third-Party Service | 81.07 | 18.93% | 3.86% | 54.38s | $0.1150 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 81.34 | 18.66% | 3.79% | 43.71s | $0.0461 |
| <code>deepinfra/google/gemma-3-27b-it</code> | Third-Party Service | 80.37 | 19.63% | 5.17% | 38.85s | $0.0004 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | Third-Party Service | 77.11 | 22.89% | 7.17% | 26.33s | $0.0017 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service | 84.07 | 15.93% | 4.26% | 22.15s | $0.0011 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 84.07 | 15.93% | 4.10% | 36.15s | $0.0071 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 88.82 | 11.18% | 4.02% | 39.41s | $0.0052 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 81.07 | 18.93% | 3.91% | 18.57s | $0.0312 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 98.59 | 1.41% | 0.31% | 11.31s | $0.0224 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 97.54 | 2.46% | 0.72% | 7.68s | $0.0056 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 96.30 | 3.70% | 0.76% | 11.15s | $0.0184 |
| <code>glm/glm-ocr</code> | Third-Party Service | 79.67 | 20.33% | 15.39% | 10.25s | $0.0003 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 87.24 | 12.76% | 3.79% | 6.43s | $0.0205 |
| <code>grok/grok-4.3</code> | Third-Party Service | 95.95 | 4.05% | 0.88% | 12.60s | $0.0207 |
| <code>grok/grok-4.5</code> | Third-Party Service | 79.05 | 20.95% | 4.12% | 32.85s | $0.0404 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 92.17 | 7.83% | 1.62% | 17.63s | $0.0270 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 96.39 | 3.61% | 1.47% | 6.18s | $0.0100 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 89.79 | 10.21% | 2.50% | 5.93s | $0.0200 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 28.96 | 71.04% | 69.41% | 5.36s | $0.0104 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 57.48 | 42.52% | 37.16% | 8.85s | $0.0036 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 76.50 | 23.50% | 3.33% | 47.82s | $0.2125 |
| <code>openai/gpt-5.6-luna</code> | Third-Party Service | 92.17 | 7.83% | 3.09% | 17.88s | $0.0077 |
| <code>openai/gpt-5.6-sol</code> | Third-Party Service | 96.74 | 3.26% | 0.64% | 21.92s | $0.1512 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 96.48 | 3.52% | 0.69% | 14.80s | $0.0574 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | 189 | 4 | 25 | 1136 |
| <code>anthropic/claude-haiku-4-5</code> | 33 | 29 | 3 | 1136 |
| <code>anthropic/claude-opus-4-8</code> | 187 | 7 | 2 | 1136 |
| <code>anthropic/claude-opus-5</code> | 188 | 2 | 25 | 1136 |
| <code>anthropic/claude-sonnet-5</code> | 187 | 24 | 1 | 1136 |
| <code>deepinfra/google/gemma-3-27b-it</code> | 162 | 28 | 33 | 1136 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 193 | 65 | 2 | 1136 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 128 | 51 | 2 | 1136 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 137 | 38 | 6 | 1136 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 63 | 55 | 9 | 1136 |
| <code>gemini/gemini-3.1-pro-preview</code> | 188 | 1 | 26 | 1136 |
| <code>gemini/gemini-3.5-flash</code> | 10 | 4 | 2 | 1136 |
| <code>gemini/gemini-3.5-flash-lite</code> | 20 | 6 | 2 | 1136 |
| <code>gemini/gemini-3.6-flash</code> | 17 | 24 | 1 | 1136 |
| <code>glm/glm-ocr</code> | 68 | 163 | 0 | 1136 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 89 | 54 | 2 | 1136 |
| <code>grok/grok-4.3</code> | 39 | 6 | 1 | 1136 |
| <code>grok/grok-4.5</code> | 146 | 42 | 50 | 1136 |
| <code>kimi/kimi-k2.6</code> | 61 | 27 | 1 | 1136 |
| <code>mistral/mistral-ocr-2512</code> | 19 | 22 | 0 | 1136 |
| <code>mistral/mistral-ocr-4-0</code> | 97 | 15 | 4 | 1136 |
| <code>openai/gpt-5.4-mini</code> | 12 | 791 | 4 | 1136 |
| <code>openai/gpt-5.4-nano</code> | 88 | 380 | 15 | 1136 |
| <code>openai/gpt-5.5</code> | 182 | 2 | 83 | 1136 |
| <code>openai/gpt-5.6-luna</code> | 22 | 61 | 6 | 1136 |
| <code>openai/gpt-5.6-sol</code> | 11 | 1 | 25 | 1136 |
| <code>openai/gpt-5.6-terra</code> | 15 | 23 | 2 | 1136 |

## Notes

- Best cloud service: `gemini/gemini-3.5-flash` scored 98.59/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0346¢ ($0.0003).
- Fastest cloud service: `openai/gpt-5.4-mini` at 5.36s.
