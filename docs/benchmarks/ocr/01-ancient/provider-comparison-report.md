# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/01-ancient`
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
| 1 | <code>deepinfra/google/gemma-3-27b-it</code> | $0.0001 | 71.31 | 28.69% | 8.90% | 11.84s | $0.0001 |
| 2 | <code>glm/glm-ocr</code> | $0.0001 | 84.43 | 15.57% | 4.20% | 1.43s | $0.0001 |
| 3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0002 | 72.13 | 27.87% | 3.96% | 3.31s | $0.0002 |
| 4 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | $0.0003 | 79.51 | 20.49% | 4.20% | 8.85s | $0.0003 |
| 5 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0009 | 87.70 | 12.30% | 1.73% | 9.49s | $0.0009 |
| 6 | <code>openai/gpt-5.4-nano</code> | $0.0009 | 61.48 | 38.52% | 7.17% | 2.35s | $0.0009 |
| 7 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0012 | 89.34 | 10.66% | 1.61% | 13.70s | $0.0012 |
| 8 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0012 | 72.13 | 27.87% | 3.09% | 1.73s | $0.0012 |
| 9 | <code>mistral/mistral-ocr-2512</code> | $0.0020 | 60.66 | 39.34% | 10.14% | 1.85s | $0.0020 |
| 10 | <code>openai/gpt-5.6-luna</code> | $0.0028 | 92.62 | 7.38% | 1.36% | 10.28s | $0.0028 |
| 11 | <code>openai/gpt-5.4-mini</code> | $0.0034 | 88.52 | 11.48% | 1.61% | 2.39s | $0.0034 |
| 12 | <code>anthropic/claude-haiku-4-5</code> | $0.0035 | 88.52 | 11.48% | 2.60% | 6.98s | $0.0035 |
| 13 | <code>grok/grok-4.3</code> | $0.0039 | 95.08 | 4.92% | 0.62% | 7.44s | $0.0039 |
| 14 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0040 | 68.03 | 31.97% | 4.20% | 3.85s | $0.0040 |
| 15 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 83.61 | 16.39% | 5.93% | 1.03s | $0.0040 |
| 16 | <code>gemini/gemini-3.6-flash</code> | $0.0042 | 69.67 | 30.33% | 3.21% | 2.65s | $0.0042 |
| 17 | <code>gemini/gemini-3.5-flash</code> | $0.0046 | 98.36 | 1.64% | 0.25% | 2.57s | $0.0046 |
| 18 | <code>kimi/kimi-k2.6</code> | $0.0054 | 71.31 | 28.69% | 3.09% | 11.40s | $0.0054 |
| 19 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0065 | 72.13 | 27.87% | 3.96% | 4.96s | $0.0065 |
| 20 | <code>grok/grok-4.5</code> | $0.0074 | 99.18 | 0.82% | 0.12% | 15.64s | $0.0074 |
| 21 | <code>anthropic/claude-sonnet-5</code> | $0.0147 | 98.36 | 1.64% | 0.25% | 9.13s | $0.0147 |
| 22 | <code>openai/gpt-5.6-terra</code> | $0.0218 | 73.77 | 26.23% | 3.21% | 12.69s | $0.0218 |
| 23 | <code>anthropic/claude-opus-4-8</code> | $0.0367 | 97.54 | 2.46% | 0.25% | 11.34s | $0.0367 |
| 24 | <code>anthropic/claude-opus-5</code> | $0.0372 | 72.95 | 27.05% | 2.97% | 11.86s | $0.0372 |
| 25 | <code>openai/gpt-5.5</code> | $0.0535 | 98.36 | 1.64% | 0.12% | 13.39s | $0.0535 |
| 26 | <code>openai/gpt-5.6-sol</code> | $0.0623 | 92.62 | 7.38% | 1.98% | 18.26s | $0.0623 |
| 27 | <code>anthropic/claude-fable-5</code> | $0.0735 | 84.43 | 15.57% | 2.84% | 17.39s | $0.0735 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-0</code> | 1.03s | 83.61 | 16.39% | 5.93% | 1.03s | $0.0040 |
| 2 | <code>glm/glm-ocr</code> | 1.43s | 84.43 | 15.57% | 4.20% | 1.43s | $0.0001 |
| 3 | <code>gemini/gemini-3.5-flash-lite</code> | 1.73s | 72.13 | 27.87% | 3.09% | 1.73s | $0.0012 |
| 4 | <code>mistral/mistral-ocr-2512</code> | 1.85s | 60.66 | 39.34% | 10.14% | 1.85s | $0.0020 |
| 5 | <code>openai/gpt-5.4-nano</code> | 2.35s | 61.48 | 38.52% | 7.17% | 2.35s | $0.0009 |
| 6 | <code>openai/gpt-5.4-mini</code> | 2.39s | 88.52 | 11.48% | 1.61% | 2.39s | $0.0034 |
| 7 | <code>gemini/gemini-3.5-flash</code> | 2.57s | 98.36 | 1.64% | 0.25% | 2.57s | $0.0046 |
| 8 | <code>gemini/gemini-3.6-flash</code> | 2.65s | 69.67 | 30.33% | 3.21% | 2.65s | $0.0042 |
| 9 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 3.31s | 72.13 | 27.87% | 3.96% | 3.31s | $0.0002 |
| 10 | <code>grok/grok-4.20-0309-non-reasoning</code> | 3.85s | 68.03 | 31.97% | 4.20% | 3.85s | $0.0040 |
| 11 | <code>gemini/gemini-3.1-pro-preview</code> | 4.96s | 72.13 | 27.87% | 3.96% | 4.96s | $0.0065 |
| 12 | <code>anthropic/claude-haiku-4-5</code> | 6.98s | 88.52 | 11.48% | 2.60% | 6.98s | $0.0035 |
| 13 | <code>grok/grok-4.3</code> | 7.44s | 95.08 | 4.92% | 0.62% | 7.44s | $0.0039 |
| 14 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 8.85s | 79.51 | 20.49% | 4.20% | 8.85s | $0.0003 |
| 15 | <code>anthropic/claude-sonnet-5</code> | 9.13s | 98.36 | 1.64% | 0.25% | 9.13s | $0.0147 |
| 16 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 9.49s | 87.70 | 12.30% | 1.73% | 9.49s | $0.0009 |
| 17 | <code>openai/gpt-5.6-luna</code> | 10.28s | 92.62 | 7.38% | 1.36% | 10.28s | $0.0028 |
| 18 | <code>anthropic/claude-opus-4-8</code> | 11.34s | 97.54 | 2.46% | 0.25% | 11.34s | $0.0367 |
| 19 | <code>kimi/kimi-k2.6</code> | 11.40s | 71.31 | 28.69% | 3.09% | 11.40s | $0.0054 |
| 20 | <code>deepinfra/google/gemma-3-27b-it</code> | 11.84s | 71.31 | 28.69% | 8.90% | 11.84s | $0.0001 |
| 21 | <code>anthropic/claude-opus-5</code> | 11.86s | 72.95 | 27.05% | 2.97% | 11.86s | $0.0372 |
| 22 | <code>openai/gpt-5.6-terra</code> | 12.69s | 73.77 | 26.23% | 3.21% | 12.69s | $0.0218 |
| 23 | <code>openai/gpt-5.5</code> | 13.39s | 98.36 | 1.64% | 0.12% | 13.39s | $0.0535 |
| 24 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 13.70s | 89.34 | 10.66% | 1.61% | 13.70s | $0.0012 |
| 25 | <code>grok/grok-4.5</code> | 15.64s | 99.18 | 0.82% | 0.12% | 15.64s | $0.0074 |
| 26 | <code>anthropic/claude-fable-5</code> | 17.39s | 84.43 | 15.57% | 2.84% | 17.39s | $0.0735 |
| 27 | <code>openai/gpt-5.6-sol</code> | 18.26s | 92.62 | 7.38% | 1.98% | 18.26s | $0.0623 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>grok/grok-4.5</code> | 99.18/100 quality score | 99.18 | 0.82% | 0.12% | 15.64s | $0.0074 |
| 2 | <code>openai/gpt-5.5</code> | 98.36/100 quality score | 98.36 | 1.64% | 0.12% | 13.39s | $0.0535 |
| 3 | <code>anthropic/claude-sonnet-5</code> | 98.36/100 quality score | 98.36 | 1.64% | 0.25% | 9.13s | $0.0147 |
| 4 | <code>gemini/gemini-3.5-flash</code> | 98.36/100 quality score | 98.36 | 1.64% | 0.25% | 2.57s | $0.0046 |
| 5 | <code>anthropic/claude-opus-4-8</code> | 97.54/100 quality score | 97.54 | 2.46% | 0.25% | 11.34s | $0.0367 |
| 6 | <code>grok/grok-4.3</code> | 95.08/100 quality score | 95.08 | 4.92% | 0.62% | 7.44s | $0.0039 |
| 7 | <code>openai/gpt-5.6-luna</code> | 92.62/100 quality score | 92.62 | 7.38% | 1.36% | 10.28s | $0.0028 |
| 8 | <code>openai/gpt-5.6-sol</code> | 92.62/100 quality score | 92.62 | 7.38% | 1.98% | 18.26s | $0.0623 |
| 9 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 89.34/100 quality score | 89.34 | 10.66% | 1.61% | 13.70s | $0.0012 |
| 10 | <code>openai/gpt-5.4-mini</code> | 88.52/100 quality score | 88.52 | 11.48% | 1.61% | 2.39s | $0.0034 |
| 11 | <code>anthropic/claude-haiku-4-5</code> | 88.52/100 quality score | 88.52 | 11.48% | 2.60% | 6.98s | $0.0035 |
| 12 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 87.70/100 quality score | 87.70 | 12.30% | 1.73% | 9.49s | $0.0009 |
| 13 | <code>anthropic/claude-fable-5</code> | 84.43/100 quality score | 84.43 | 15.57% | 2.84% | 17.39s | $0.0735 |
| 14 | <code>glm/glm-ocr</code> | 84.43/100 quality score | 84.43 | 15.57% | 4.20% | 1.43s | $0.0001 |
| 15 | <code>mistral/mistral-ocr-4-0</code> | 83.61/100 quality score | 83.61 | 16.39% | 5.93% | 1.03s | $0.0040 |
| 16 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 79.51/100 quality score | 79.51 | 20.49% | 4.20% | 8.85s | $0.0003 |
| 17 | <code>openai/gpt-5.6-terra</code> | 73.77/100 quality score | 73.77 | 26.23% | 3.21% | 12.69s | $0.0218 |
| 18 | <code>anthropic/claude-opus-5</code> | 72.95/100 quality score | 72.95 | 27.05% | 2.97% | 11.86s | $0.0372 |
| 19 | <code>gemini/gemini-3.5-flash-lite</code> | 72.13/100 quality score | 72.13 | 27.87% | 3.09% | 1.73s | $0.0012 |
| 20 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 72.13/100 quality score | 72.13 | 27.87% | 3.96% | 3.31s | $0.0002 |
| 21 | <code>gemini/gemini-3.1-pro-preview</code> | 72.13/100 quality score | 72.13 | 27.87% | 3.96% | 4.96s | $0.0065 |
| 22 | <code>kimi/kimi-k2.6</code> | 71.31/100 quality score | 71.31 | 28.69% | 3.09% | 11.40s | $0.0054 |
| 23 | <code>deepinfra/google/gemma-3-27b-it</code> | 71.31/100 quality score | 71.31 | 28.69% | 8.90% | 11.84s | $0.0001 |
| 24 | <code>gemini/gemini-3.6-flash</code> | 69.67/100 quality score | 69.67 | 30.33% | 3.21% | 2.65s | $0.0042 |
| 25 | <code>grok/grok-4.20-0309-non-reasoning</code> | 68.03/100 quality score | 68.03 | 31.97% | 4.20% | 3.85s | $0.0040 |
| 26 | <code>openai/gpt-5.4-nano</code> | 61.48/100 quality score | 61.48 | 38.52% | 7.17% | 2.35s | $0.0009 |
| 27 | <code>mistral/mistral-ocr-2512</code> | 60.66/100 quality score | 60.66 | 39.34% | 10.14% | 1.85s | $0.0020 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 84.43 | 15.57% | 2.84% | 17.39s | $0.0735 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 88.52 | 11.48% | 2.60% | 6.98s | $0.0035 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 97.54 | 2.46% | 0.25% | 11.34s | $0.0367 |
| <code>anthropic/claude-opus-5</code> | Third-Party Service | 72.95 | 27.05% | 2.97% | 11.86s | $0.0372 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 98.36 | 1.64% | 0.25% | 9.13s | $0.0147 |
| <code>deepinfra/google/gemma-3-27b-it</code> | Third-Party Service | 71.31 | 28.69% | 8.90% | 11.84s | $0.0001 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | Third-Party Service | 79.51 | 20.49% | 4.20% | 8.85s | $0.0003 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service | 72.13 | 27.87% | 3.96% | 3.31s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 89.34 | 10.66% | 1.61% | 13.70s | $0.0012 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 87.70 | 12.30% | 1.73% | 9.49s | $0.0009 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 72.13 | 27.87% | 3.96% | 4.96s | $0.0065 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 98.36 | 1.64% | 0.25% | 2.57s | $0.0046 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 72.13 | 27.87% | 3.09% | 1.73s | $0.0012 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 69.67 | 30.33% | 3.21% | 2.65s | $0.0042 |
| <code>glm/glm-ocr</code> | Third-Party Service | 84.43 | 15.57% | 4.20% | 1.43s | $0.0001 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 68.03 | 31.97% | 4.20% | 3.85s | $0.0040 |
| <code>grok/grok-4.3</code> | Third-Party Service | 95.08 | 4.92% | 0.62% | 7.44s | $0.0039 |
| <code>grok/grok-4.5</code> | Third-Party Service | 99.18 | 0.82% | 0.12% | 15.64s | $0.0074 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 71.31 | 28.69% | 3.09% | 11.40s | $0.0054 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 60.66 | 39.34% | 10.14% | 1.85s | $0.0020 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 83.61 | 16.39% | 5.93% | 1.03s | $0.0040 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 88.52 | 11.48% | 1.61% | 2.39s | $0.0034 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 61.48 | 38.52% | 7.17% | 2.35s | $0.0009 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 98.36 | 1.64% | 0.12% | 13.39s | $0.0535 |
| <code>openai/gpt-5.6-luna</code> | Third-Party Service | 92.62 | 7.38% | 1.36% | 10.28s | $0.0028 |
| <code>openai/gpt-5.6-sol</code> | Third-Party Service | 92.62 | 7.38% | 1.98% | 18.26s | $0.0623 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 73.77 | 26.23% | 3.21% | 12.69s | $0.0218 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | 19 | 0 | 0 | 122 |
| <code>anthropic/claude-haiku-4-5</code> | 12 | 1 | 1 | 122 |
| <code>anthropic/claude-opus-4-8</code> | 2 | 1 | 0 | 122 |
| <code>anthropic/claude-opus-5</code> | 20 | 0 | 13 | 122 |
| <code>anthropic/claude-sonnet-5</code> | 2 | 0 | 0 | 122 |
| <code>deepinfra/google/gemma-3-27b-it</code> | 21 | 7 | 7 | 122 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 21 | 2 | 2 | 122 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 25 | 9 | 0 | 122 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 11 | 0 | 2 | 122 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 13 | 1 | 1 | 122 |
| <code>gemini/gemini-3.1-pro-preview</code> | 27 | 1 | 6 | 122 |
| <code>gemini/gemini-3.5-flash</code> | 2 | 0 | 0 | 122 |
| <code>gemini/gemini-3.5-flash-lite</code> | 21 | 1 | 12 | 122 |
| <code>gemini/gemini-3.6-flash</code> | 21 | 0 | 16 | 122 |
| <code>glm/glm-ocr</code> | 9 | 6 | 4 | 122 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 23 | 1 | 15 | 122 |
| <code>grok/grok-4.3</code> | 4 | 0 | 2 | 122 |
| <code>grok/grok-4.5</code> | 1 | 0 | 0 | 122 |
| <code>kimi/kimi-k2.6</code> | 21 | 0 | 14 | 122 |
| <code>mistral/mistral-ocr-2512</code> | 29 | 7 | 12 | 122 |
| <code>mistral/mistral-ocr-4-0</code> | 5 | 1 | 14 | 122 |
| <code>openai/gpt-5.4-mini</code> | 12 | 1 | 1 | 122 |
| <code>openai/gpt-5.4-nano</code> | 37 | 2 | 8 | 122 |
| <code>openai/gpt-5.5</code> | 1 | 1 | 0 | 122 |
| <code>openai/gpt-5.6-luna</code> | 9 | 0 | 0 | 122 |
| <code>openai/gpt-5.6-sol</code> | 8 | 0 | 1 | 122 |
| <code>openai/gpt-5.6-terra</code> | 20 | 0 | 12 | 122 |

## Notes

- Best cloud service: `grok/grok-4.5` scored 99.18/100.
- The cheapest cloud provider was `deepinfra/google/gemma-3-27b-it` at 0.0072¢ ($0.0001).
- Fastest cloud service: `mistral/mistral-ocr-4-0` at 1.03s.
