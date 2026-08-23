# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/1-page-declaration`
- Total providers: 28 (0 local, 28 third-party service)
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
| 1 | <code>glm/glm-ocr</code> | $0.0003 | 83.27 | 16.73% | 15.69% | 15.58s | $0.0003 |
| 2 | <code>deepinfra/google/gemma-3-27b-it</code> | $0.0003 | 84.84 | 15.16% | 12.76% | 113.56s | $0.0003 |
| 3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0006 | 93.10 | 6.90% | 5.48% | 35.83s | $0.0006 |
| 4 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | $0.0007 | 81.28 | 18.72% | 16.81% | 42.57s | $0.0007 |
| 5 | <code>mistral/mistral-ocr-2512</code> | $0.0020 | 86.68 | 13.32% | 9.35% | 6.74s | $0.0020 |
| 6 | <code>openai/gpt-5.4-nano</code> | $0.0028 | 91.19 | 8.81% | 7.03% | 10.36s | $0.0028 |
| 7 | <code>openai/gpt-5.6-luna</code> | $0.0032 | 89.69 | 10.31% | 9.05% | 11.12s | $0.0032 |
| 8 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0036 | 91.33 | 8.67% | 6.49% | 45.25s | $0.0036 |
| 9 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 89.14 | 10.86% | 6.13% | 4.18s | $0.0040 |
| 10 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0050 | 97.40 | 2.60% | 1.95% | 74.95s | $0.0050 |
| 11 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0051 | 98.84 | 1.16% | 0.66% | 7.04s | $0.0051 |
| 12 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0078 | 98.70 | 1.30% | 1.00% | 17.68s | $0.0078 |
| 13 | <code>grok/grok-4.3</code> | $0.0080 | 99.80 | 0.20% | 0.03% | 18.33s | $0.0080 |
| 14 | <code>openai/gpt-5.4-mini</code> | $0.0112 | 91.46 | 8.54% | 6.67% | 8.15s | $0.0112 |
| 15 | <code>kimi/kimi-k2.6</code> | $0.0118 | 99.45 | 0.55% | 0.25% | 45.17s | $0.0118 |
| 16 | <code>anthropic/claude-haiku-4-5</code> | $0.0139 | 93.24 | 6.76% | 6.01% | 13.01s | $0.0139 |
| 17 | <code>grok/grok-4.5</code> | $0.0171 | 95.70 | 4.30% | 4.46% | 54.36s | $0.0171 |
| 18 | <code>gemini/gemini-3.6-flash</code> | $0.0172 | 99.04 | 0.96% | 0.27% | 11.31s | $0.0172 |
| 19 | <code>gemini/gemini-3.5-flash</code> | $0.0197 | 99.59 | 0.41% | 0.23% | 8.33s | $0.0197 |
| 20 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0260 | 99.39 | 0.61% | 0.52% | 16.20s | $0.0260 |
| 21 | <code>openai/gpt-5.6-terra</code> | $0.0299 | 98.43 | 1.57% | 0.58% | 17.14s | $0.0299 |
| 22 | <code>anthropic/claude-sonnet-5</code> | $0.0414 | 99.18 | 0.82% | 0.16% | 38.30s | $0.0414 |
| 23 | <code>kimi/kimi-k3</code> | $0.0687 | 99.39 | 0.61% | 0.31% | 81.24s | $0.0687 |
| 24 | <code>anthropic/claude-opus-5</code> | $0.1045 | 99.80 | 0.20% | 0.03% | 45.86s | $0.1045 |
| 25 | <code>anthropic/claude-opus-4-8</code> | $0.1055 | 99.73 | 0.27% | 0.05% | 47.83s | $0.1055 |
| 26 | <code>openai/gpt-5.6-sol</code> | $0.1186 | 97.54 | 2.46% | 2.32% | 40.74s | $0.1186 |
| 27 | <code>openai/gpt-5.5</code> | $0.1295 | 98.22 | 1.78% | 1.52% | 37.45s | $0.1295 |
| 28 | <code>anthropic/claude-fable-5</code> | $0.2177 | 97.20 | 2.80% | 1.92% | 43.72s | $0.2177 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-0</code> | 4.18s | 89.14 | 10.86% | 6.13% | 4.18s | $0.0040 |
| 2 | <code>mistral/mistral-ocr-2512</code> | 6.74s | 86.68 | 13.32% | 9.35% | 6.74s | $0.0020 |
| 3 | <code>gemini/gemini-3.5-flash-lite</code> | 7.04s | 98.84 | 1.16% | 0.66% | 7.04s | $0.0051 |
| 4 | <code>openai/gpt-5.4-mini</code> | 8.15s | 91.46 | 8.54% | 6.67% | 8.15s | $0.0112 |
| 5 | <code>gemini/gemini-3.5-flash</code> | 8.33s | 99.59 | 0.41% | 0.23% | 8.33s | $0.0197 |
| 6 | <code>openai/gpt-5.4-nano</code> | 10.36s | 91.19 | 8.81% | 7.03% | 10.36s | $0.0028 |
| 7 | <code>openai/gpt-5.6-luna</code> | 11.12s | 89.69 | 10.31% | 9.05% | 11.12s | $0.0032 |
| 8 | <code>gemini/gemini-3.6-flash</code> | 11.31s | 99.04 | 0.96% | 0.27% | 11.31s | $0.0172 |
| 9 | <code>anthropic/claude-haiku-4-5</code> | 13.01s | 93.24 | 6.76% | 6.01% | 13.01s | $0.0139 |
| 10 | <code>glm/glm-ocr</code> | 15.58s | 83.27 | 16.73% | 15.69% | 15.58s | $0.0003 |
| 11 | <code>gemini/gemini-3.1-pro-preview</code> | 16.20s | 99.39 | 0.61% | 0.52% | 16.20s | $0.0260 |
| 12 | <code>openai/gpt-5.6-terra</code> | 17.14s | 98.43 | 1.57% | 0.58% | 17.14s | $0.0299 |
| 13 | <code>grok/grok-4.20-0309-non-reasoning</code> | 17.68s | 98.70 | 1.30% | 1.00% | 17.68s | $0.0078 |
| 14 | <code>grok/grok-4.3</code> | 18.33s | 99.80 | 0.20% | 0.03% | 18.33s | $0.0080 |
| 15 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 35.83s | 93.10 | 6.90% | 5.48% | 35.83s | $0.0006 |
| 16 | <code>openai/gpt-5.5</code> | 37.45s | 98.22 | 1.78% | 1.52% | 37.45s | $0.1295 |
| 17 | <code>anthropic/claude-sonnet-5</code> | 38.30s | 99.18 | 0.82% | 0.16% | 38.30s | $0.0414 |
| 18 | <code>openai/gpt-5.6-sol</code> | 40.74s | 97.54 | 2.46% | 2.32% | 40.74s | $0.1186 |
| 19 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 42.57s | 81.28 | 18.72% | 16.81% | 42.57s | $0.0007 |
| 20 | <code>anthropic/claude-fable-5</code> | 43.72s | 97.20 | 2.80% | 1.92% | 43.72s | $0.2177 |
| 21 | <code>kimi/kimi-k2.6</code> | 45.17s | 99.45 | 0.55% | 0.25% | 45.17s | $0.0118 |
| 22 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 45.25s | 91.33 | 8.67% | 6.49% | 45.25s | $0.0036 |
| 23 | <code>anthropic/claude-opus-5</code> | 45.86s | 99.80 | 0.20% | 0.03% | 45.86s | $0.1045 |
| 24 | <code>anthropic/claude-opus-4-8</code> | 47.83s | 99.73 | 0.27% | 0.05% | 47.83s | $0.1055 |
| 25 | <code>grok/grok-4.5</code> | 54.36s | 95.70 | 4.30% | 4.46% | 54.36s | $0.0171 |
| 26 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 74.95s | 97.40 | 2.60% | 1.95% | 74.95s | $0.0050 |
| 27 | <code>kimi/kimi-k3</code> | 81.24s | 99.39 | 0.61% | 0.31% | 81.24s | $0.0687 |
| 28 | <code>deepinfra/google/gemma-3-27b-it</code> | 113.56s | 84.84 | 15.16% | 12.76% | 113.56s | $0.0003 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-opus-5</code> | 99.80/100 quality score | 99.80 | 0.20% | 0.03% | 45.86s | $0.1045 |
| 2 | <code>grok/grok-4.3</code> | 99.80/100 quality score | 99.80 | 0.20% | 0.03% | 18.33s | $0.0080 |
| 3 | <code>anthropic/claude-opus-4-8</code> | 99.73/100 quality score | 99.73 | 0.27% | 0.05% | 47.83s | $0.1055 |
| 4 | <code>gemini/gemini-3.5-flash</code> | 99.59/100 quality score | 99.59 | 0.41% | 0.23% | 8.33s | $0.0197 |
| 5 | <code>kimi/kimi-k2.6</code> | 99.45/100 quality score | 99.45 | 0.55% | 0.25% | 45.17s | $0.0118 |
| 6 | <code>kimi/kimi-k3</code> | 99.39/100 quality score | 99.39 | 0.61% | 0.31% | 81.24s | $0.0687 |
| 7 | <code>gemini/gemini-3.1-pro-preview</code> | 99.39/100 quality score | 99.39 | 0.61% | 0.52% | 16.20s | $0.0260 |
| 8 | <code>anthropic/claude-sonnet-5</code> | 99.18/100 quality score | 99.18 | 0.82% | 0.16% | 38.30s | $0.0414 |
| 9 | <code>gemini/gemini-3.6-flash</code> | 99.04/100 quality score | 99.04 | 0.96% | 0.27% | 11.31s | $0.0172 |
| 10 | <code>gemini/gemini-3.5-flash-lite</code> | 98.84/100 quality score | 98.84 | 1.16% | 0.66% | 7.04s | $0.0051 |
| 11 | <code>grok/grok-4.20-0309-non-reasoning</code> | 98.70/100 quality score | 98.70 | 1.30% | 1.00% | 17.68s | $0.0078 |
| 12 | <code>openai/gpt-5.6-terra</code> | 98.43/100 quality score | 98.43 | 1.57% | 0.58% | 17.14s | $0.0299 |
| 13 | <code>openai/gpt-5.5</code> | 98.22/100 quality score | 98.22 | 1.78% | 1.52% | 37.45s | $0.1295 |
| 14 | <code>openai/gpt-5.6-sol</code> | 97.54/100 quality score | 97.54 | 2.46% | 2.32% | 40.74s | $0.1186 |
| 15 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 97.40/100 quality score | 97.40 | 2.60% | 1.95% | 74.95s | $0.0050 |
| 16 | <code>anthropic/claude-fable-5</code> | 97.20/100 quality score | 97.20 | 2.80% | 1.92% | 43.72s | $0.2177 |
| 17 | <code>grok/grok-4.5</code> | 95.70/100 quality score | 95.70 | 4.30% | 4.46% | 54.36s | $0.0171 |
| 18 | <code>anthropic/claude-haiku-4-5</code> | 93.24/100 quality score | 93.24 | 6.76% | 6.01% | 13.01s | $0.0139 |
| 19 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 93.10/100 quality score | 93.10 | 6.90% | 5.48% | 35.83s | $0.0006 |
| 20 | <code>openai/gpt-5.4-mini</code> | 91.46/100 quality score | 91.46 | 8.54% | 6.67% | 8.15s | $0.0112 |
| 21 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 91.33/100 quality score | 91.33 | 8.67% | 6.49% | 45.25s | $0.0036 |
| 22 | <code>openai/gpt-5.4-nano</code> | 91.19/100 quality score | 91.19 | 8.81% | 7.03% | 10.36s | $0.0028 |
| 23 | <code>openai/gpt-5.6-luna</code> | 89.69/100 quality score | 89.69 | 10.31% | 9.05% | 11.12s | $0.0032 |
| 24 | <code>mistral/mistral-ocr-4-0</code> | 89.14/100 quality score | 89.14 | 10.86% | 6.13% | 4.18s | $0.0040 |
| 25 | <code>mistral/mistral-ocr-2512</code> | 86.68/100 quality score | 86.68 | 13.32% | 9.35% | 6.74s | $0.0020 |
| 26 | <code>deepinfra/google/gemma-3-27b-it</code> | 84.84/100 quality score | 84.84 | 15.16% | 12.76% | 113.56s | $0.0003 |
| 27 | <code>glm/glm-ocr</code> | 83.27/100 quality score | 83.27 | 16.73% | 15.69% | 15.58s | $0.0003 |
| 28 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 81.28/100 quality score | 81.28 | 18.72% | 16.81% | 42.57s | $0.0007 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 97.20 | 2.80% | 1.92% | 43.72s | $0.2177 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 93.24 | 6.76% | 6.01% | 13.01s | $0.0139 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 99.73 | 0.27% | 0.05% | 47.83s | $0.1055 |
| <code>anthropic/claude-opus-5</code> | Third-Party Service | 99.80 | 0.20% | 0.03% | 45.86s | $0.1045 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 99.18 | 0.82% | 0.16% | 38.30s | $0.0414 |
| <code>deepinfra/google/gemma-3-27b-it</code> | Third-Party Service | 84.84 | 15.16% | 12.76% | 113.56s | $0.0003 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | Third-Party Service | 81.28 | 18.72% | 16.81% | 42.57s | $0.0007 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service | 93.10 | 6.90% | 5.48% | 35.83s | $0.0006 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 97.40 | 2.60% | 1.95% | 74.95s | $0.0050 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 91.33 | 8.67% | 6.49% | 45.25s | $0.0036 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 99.39 | 0.61% | 0.52% | 16.20s | $0.0260 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 99.59 | 0.41% | 0.23% | 8.33s | $0.0197 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 98.84 | 1.16% | 0.66% | 7.04s | $0.0051 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 99.04 | 0.96% | 0.27% | 11.31s | $0.0172 |
| <code>glm/glm-ocr</code> | Third-Party Service | 83.27 | 16.73% | 15.69% | 15.58s | $0.0003 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 98.70 | 1.30% | 1.00% | 17.68s | $0.0078 |
| <code>grok/grok-4.3</code> | Third-Party Service | 99.80 | 0.20% | 0.03% | 18.33s | $0.0080 |
| <code>grok/grok-4.5</code> | Third-Party Service | 95.70 | 4.30% | 4.46% | 54.36s | $0.0171 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 99.45 | 0.55% | 0.25% | 45.17s | $0.0118 |
| <code>kimi/kimi-k3</code> | Third-Party Service | 99.39 | 0.61% | 0.31% | 81.24s | $0.0687 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 86.68 | 13.32% | 9.35% | 6.74s | $0.0020 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 89.14 | 10.86% | 6.13% | 4.18s | $0.0040 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 91.46 | 8.54% | 6.67% | 8.15s | $0.0112 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 91.19 | 8.81% | 7.03% | 10.36s | $0.0028 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 98.22 | 1.78% | 1.52% | 37.45s | $0.1295 |
| <code>openai/gpt-5.6-luna</code> | Third-Party Service | 89.69 | 10.31% | 9.05% | 11.12s | $0.0032 |
| <code>openai/gpt-5.6-sol</code> | Third-Party Service | 97.54 | 2.46% | 2.32% | 40.74s | $0.1186 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 98.43 | 1.57% | 0.58% | 17.14s | $0.0299 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | 6 | 15 | 20 | 1464 |
| <code>anthropic/claude-haiku-4-5</code> | 38 | 4 | 57 | 1464 |
| <code>anthropic/claude-opus-4-8</code> | 3 | 0 | 1 | 1464 |
| <code>anthropic/claude-opus-5</code> | 2 | 0 | 1 | 1464 |
| <code>anthropic/claude-sonnet-5</code> | 10 | 1 | 1 | 1464 |
| <code>deepinfra/google/gemma-3-27b-it</code> | 152 | 43 | 27 | 1464 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 91 | 181 | 2 | 1464 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 75 | 24 | 2 | 1464 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 21 | 17 | 0 | 1464 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 83 | 12 | 32 | 1464 |
| <code>gemini/gemini-3.1-pro-preview</code> | 0 | 7 | 2 | 1464 |
| <code>gemini/gemini-3.5-flash</code> | 1 | 5 | 0 | 1464 |
| <code>gemini/gemini-3.5-flash-lite</code> | 8 | 9 | 0 | 1464 |
| <code>gemini/gemini-3.6-flash</code> | 5 | 5 | 4 | 1464 |
| <code>glm/glm-ocr</code> | 26 | 209 | 10 | 1464 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 4 | 15 | 0 | 1464 |
| <code>grok/grok-4.3</code> | 3 | 0 | 0 | 1464 |
| <code>grok/grok-4.5</code> | 3 | 33 | 27 | 1464 |
| <code>kimi/kimi-k2.6</code> | 3 | 5 | 0 | 1464 |
| <code>kimi/kimi-k3</code> | 4 | 5 | 0 | 1464 |
| <code>mistral/mistral-ocr-2512</code> | 130 | 59 | 6 | 1464 |
| <code>mistral/mistral-ocr-4-0</code> | 142 | 9 | 8 | 1464 |
| <code>openai/gpt-5.4-mini</code> | 84 | 7 | 34 | 1464 |
| <code>openai/gpt-5.4-nano</code> | 52 | 74 | 3 | 1464 |
| <code>openai/gpt-5.5</code> | 5 | 20 | 1 | 1464 |
| <code>openai/gpt-5.6-luna</code> | 81 | 9 | 61 | 1464 |
| <code>openai/gpt-5.6-sol</code> | 14 | 12 | 10 | 1464 |
| <code>openai/gpt-5.6-terra</code> | 14 | 3 | 6 | 1464 |

## Notes

- Best cloud service: `anthropic/claude-opus-5` scored 99.80/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0286¢ ($0.0003).
- Fastest cloud service: `mistral/mistral-ocr-4-0` at 4.18s.
