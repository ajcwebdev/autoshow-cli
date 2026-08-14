# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-06-14_01-28-14-268_document`
- Total providers: 29 (3 local, 26 third-party service)
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
| 1 | <code>ocrmypdf</code> | $0.00 local monetary cost | 39.91 | 60.09% | 15.22% | 1.45s | $0.00 |
| 2 | <code>paddle-ocr</code> | $0.00 local monetary cost | 31.19 | 68.81% | 18.76% | 12.60s | $0.00 |
| 3 | <code>tesseract</code> | $0.00 local monetary cost | 44.04 | 55.96% | 14.30% | 0.83s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.83s | 44.04 | 55.96% | 14.30% | 0.83s | $0.00 |
| 2 | <code>ocrmypdf</code> | 1.45s | 39.91 | 60.09% | 15.22% | 1.45s | $0.00 |
| 3 | <code>paddle-ocr</code> | 12.60s | 31.19 | 68.81% | 18.76% | 12.60s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 44.04/100 quality score | 44.04 | 55.96% | 14.30% | 0.83s | $0.00 |
| 2 | <code>ocrmypdf</code> | 39.91/100 quality score | 39.91 | 60.09% | 15.22% | 1.45s | $0.00 |
| 3 | <code>paddle-ocr</code> | 31.19/100 quality score | 31.19 | 68.81% | 18.76% | 12.60s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>glm/glm-ocr</code> | $0.0000 | 85.32 | 14.68% | 3.62% | 2.90s | $0.0000 |
| 2 | <code>deepinfra/google/gemma-3-27b-it</code> | $0.0001 | 94.95 | 5.05% | 0.59% | 21.95s | $0.0001 |
| 3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0002 | 96.79 | 3.21% | 1.35% | 5.14s | $0.0002 |
| 4 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | $0.0003 | 96.79 | 3.21% | 1.35% | 6.73s | $0.0003 |
| 5 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0004 | 92.66 | 7.34% | 1.26% | 8.94s | $0.0004 |
| 6 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0005 | 94.95 | 5.05% | 0.59% | 12.80s | $0.0005 |
| 7 | <code>openai/gpt-5.4-nano</code> | $0.0006 | 68.81 | 31.19% | 20.44% | 3.46s | $0.0006 |
| 8 | <code>gemini/gemini-3.1-flash-lite</code> | $0.0008 | 100.00 | 0.00% | 0.00% | 2.16s | $0.0008 |
| 9 | <code>gemini/gemini-3.1-flash-lite-preview</code> | $0.0008 | 100.00 | 0.00% | 0.00% | 2.31s | $0.0008 |
| 10 | <code>mistral/mistral-ocr-2512</code> | $0.0020 | 98.62 | 1.38% | 0.25% | 1.62s | $0.0020 |
| 11 | <code>replicate/datalab-to/ocr</code> | $0.0020 | 74.77 | 25.23% | 5.21% | 11.14s | $0.0020 |
| 12 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0021 | 98.62 | 1.38% | 0.25% | 1.94s | $0.0021 |
| 13 | <code>grok/grok-4.3</code> | $0.0021 | 100.00 | 0.00% | 0.00% | 10.49s | $0.0021 |
| 14 | <code>openai/gpt-5.4-mini</code> | $0.0026 | 72.02 | 27.98% | 3.95% | 3.17s | $0.0026 |
| 15 | <code>kimi/kimi-k2.6</code> | $0.0029 | 95.87 | 4.13% | 0.59% | 13.98s | $0.0029 |
| 16 | <code>replicate/lucataco/deepseek-ocr</code> | $0.0033 | 74.31 | 25.69% | 14.38% | 8.56s | $0.0033 |
| 17 | <code>anthropic/claude-haiku-4-5</code> | $0.0038 | 90.37 | 9.63% | 3.03% | 23.44s | $0.0038 |
| 18 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 98.17 | 1.83% | 0.34% | 1.93s | $0.0040 |
| 19 | <code>replicate/datalab-to/marker</code> | $0.0040 | 99.54 | 0.46% | 0.25% | 8.30s | $0.0040 |
| 20 | <code>gemini/gemini-3.5-flash</code> | $0.0054 | 96.33 | 3.67% | 0.34% | 11.34s | $0.0054 |
| 21 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0072 | 96.33 | 3.67% | 0.34% | 4.59s | $0.0072 |
| 22 | <code>fal/fal-ai/florence-2-large/ocr</code> | $0.0076 | 31.65 | 68.35% | 20.61% | 10.46s | $0.0076 |
| 23 | <code>anthropic/claude-sonnet-5</code> | $0.0096 | 96.33 | 3.67% | 0.34% | 10.64s | $0.0096 |
| 24 | <code>anthropic/claude-opus-4-8</code> | $0.0227 | 96.33 | 3.67% | 0.34% | 12.09s | $0.0227 |
| 25 | <code>openai/gpt-5.5</code> | $0.0315 | 96.33 | 3.67% | 0.34% | 12.08s | $0.0315 |
| 26 | <code>fal/fal-ai/got-ocr/v2</code> | $0.0500 | 34.86 | 65.14% | 20.10% | 15.57s | $0.0500 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-2512</code> | 1.62s | 98.62 | 1.38% | 0.25% | 1.62s | $0.0020 |
| 2 | <code>mistral/mistral-ocr-4-0</code> | 1.93s | 98.17 | 1.83% | 0.34% | 1.93s | $0.0040 |
| 3 | <code>grok/grok-4.20-0309-non-reasoning</code> | 1.94s | 98.62 | 1.38% | 0.25% | 1.94s | $0.0021 |
| 4 | <code>gemini/gemini-3.1-flash-lite</code> | 2.16s | 100.00 | 0.00% | 0.00% | 2.16s | $0.0008 |
| 5 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 2.31s | 100.00 | 0.00% | 0.00% | 2.31s | $0.0008 |
| 6 | <code>glm/glm-ocr</code> | 2.90s | 85.32 | 14.68% | 3.62% | 2.90s | $0.0000 |
| 7 | <code>openai/gpt-5.4-mini</code> | 3.17s | 72.02 | 27.98% | 3.95% | 3.17s | $0.0026 |
| 8 | <code>openai/gpt-5.4-nano</code> | 3.46s | 68.81 | 31.19% | 20.44% | 3.46s | $0.0006 |
| 9 | <code>gemini/gemini-3.1-pro-preview</code> | 4.59s | 96.33 | 3.67% | 0.34% | 4.59s | $0.0072 |
| 10 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 5.14s | 96.79 | 3.21% | 1.35% | 5.14s | $0.0002 |
| 11 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 6.73s | 96.79 | 3.21% | 1.35% | 6.73s | $0.0003 |
| 12 | <code>replicate/datalab-to/marker</code> | 8.30s | 99.54 | 0.46% | 0.25% | 8.30s | $0.0040 |
| 13 | <code>replicate/lucataco/deepseek-ocr</code> | 8.56s | 74.31 | 25.69% | 14.38% | 8.56s | $0.0033 |
| 14 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 8.94s | 92.66 | 7.34% | 1.26% | 8.94s | $0.0004 |
| 15 | <code>fal/fal-ai/florence-2-large/ocr</code> | 10.46s | 31.65 | 68.35% | 20.61% | 10.46s | $0.0076 |
| 16 | <code>grok/grok-4.3</code> | 10.49s | 100.00 | 0.00% | 0.00% | 10.49s | $0.0021 |
| 17 | <code>anthropic/claude-sonnet-5</code> | 10.64s | 96.33 | 3.67% | 0.34% | 10.64s | $0.0096 |
| 18 | <code>replicate/datalab-to/ocr</code> | 11.14s | 74.77 | 25.23% | 5.21% | 11.14s | $0.0020 |
| 19 | <code>gemini/gemini-3.5-flash</code> | 11.34s | 96.33 | 3.67% | 0.34% | 11.34s | $0.0054 |
| 20 | <code>openai/gpt-5.5</code> | 12.08s | 96.33 | 3.67% | 0.34% | 12.08s | $0.0315 |
| 21 | <code>anthropic/claude-opus-4-8</code> | 12.09s | 96.33 | 3.67% | 0.34% | 12.09s | $0.0227 |
| 22 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 12.80s | 94.95 | 5.05% | 0.59% | 12.80s | $0.0005 |
| 23 | <code>kimi/kimi-k2.6</code> | 13.98s | 95.87 | 4.13% | 0.59% | 13.98s | $0.0029 |
| 24 | <code>fal/fal-ai/got-ocr/v2</code> | 15.57s | 34.86 | 65.14% | 20.10% | 15.57s | $0.0500 |
| 25 | <code>deepinfra/google/gemma-3-27b-it</code> | 21.95s | 94.95 | 5.05% | 0.59% | 21.95s | $0.0001 |
| 26 | <code>anthropic/claude-haiku-4-5</code> | 23.44s | 90.37 | 9.63% | 3.03% | 23.44s | $0.0038 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.1-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.16s | $0.0008 |
| 2 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.31s | $0.0008 |
| 3 | <code>grok/grok-4.3</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 10.49s | $0.0021 |
| 4 | <code>replicate/datalab-to/marker</code> | 99.54/100 quality score | 99.54 | 0.46% | 0.25% | 8.30s | $0.0040 |
| 5 | <code>grok/grok-4.20-0309-non-reasoning</code> | 98.62/100 quality score | 98.62 | 1.38% | 0.25% | 1.94s | $0.0021 |
| 6 | <code>mistral/mistral-ocr-2512</code> | 98.62/100 quality score | 98.62 | 1.38% | 0.25% | 1.62s | $0.0020 |
| 7 | <code>mistral/mistral-ocr-4-0</code> | 98.17/100 quality score | 98.17 | 1.83% | 0.34% | 1.93s | $0.0040 |
| 8 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 96.79/100 quality score | 96.79 | 3.21% | 1.35% | 6.73s | $0.0003 |
| 9 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 96.79/100 quality score | 96.79 | 3.21% | 1.35% | 5.14s | $0.0002 |
| 10 | <code>anthropic/claude-opus-4-8</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 12.09s | $0.0227 |
| 11 | <code>anthropic/claude-sonnet-5</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 10.64s | $0.0096 |
| 12 | <code>gemini/gemini-3.1-pro-preview</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 4.59s | $0.0072 |
| 13 | <code>gemini/gemini-3.5-flash</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 11.34s | $0.0054 |
| 14 | <code>openai/gpt-5.5</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 12.08s | $0.0315 |
| 15 | <code>kimi/kimi-k2.6</code> | 95.87/100 quality score | 95.87 | 4.13% | 0.59% | 13.98s | $0.0029 |
| 16 | <code>deepinfra/google/gemma-3-27b-it</code> | 94.95/100 quality score | 94.95 | 5.05% | 0.59% | 21.95s | $0.0001 |
| 17 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 94.95/100 quality score | 94.95 | 5.05% | 0.59% | 12.80s | $0.0005 |
| 18 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 92.66/100 quality score | 92.66 | 7.34% | 1.26% | 8.94s | $0.0004 |
| 19 | <code>anthropic/claude-haiku-4-5</code> | 90.37/100 quality score | 90.37 | 9.63% | 3.03% | 23.44s | $0.0038 |
| 20 | <code>glm/glm-ocr</code> | 85.32/100 quality score | 85.32 | 14.68% | 3.62% | 2.90s | $0.0000 |
| 21 | <code>replicate/datalab-to/ocr</code> | 74.77/100 quality score | 74.77 | 25.23% | 5.21% | 11.14s | $0.0020 |
| 22 | <code>replicate/lucataco/deepseek-ocr</code> | 74.31/100 quality score | 74.31 | 25.69% | 14.38% | 8.56s | $0.0033 |
| 23 | <code>openai/gpt-5.4-mini</code> | 72.02/100 quality score | 72.02 | 27.98% | 3.95% | 3.17s | $0.0026 |
| 24 | <code>openai/gpt-5.4-nano</code> | 68.81/100 quality score | 68.81 | 31.19% | 20.44% | 3.46s | $0.0006 |
| 25 | <code>fal/fal-ai/got-ocr/v2</code> | 34.86/100 quality score | 34.86 | 65.14% | 20.10% | 15.57s | $0.0500 |
| 26 | <code>fal/fal-ai/florence-2-large/ocr</code> | 31.65/100 quality score | 31.65 | 68.35% | 20.61% | 10.46s | $0.0076 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | Local | 39.91 | 60.09% | 15.22% | 1.45s | $0.00 |
| <code>paddle-ocr</code> | Local | 31.19 | 68.81% | 18.76% | 12.60s | $0.00 |
| <code>tesseract</code> | Local | 44.04 | 55.96% | 14.30% | 0.83s | $0.00 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 90.37 | 9.63% | 3.03% | 23.44s | $0.0038 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 12.09s | $0.0227 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 10.64s | $0.0096 |
| <code>deepinfra/google/gemma-3-27b-it</code> | Third-Party Service | 94.95 | 5.05% | 0.59% | 21.95s | $0.0001 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | Third-Party Service | 96.79 | 3.21% | 1.35% | 6.73s | $0.0003 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service | 96.79 | 3.21% | 1.35% | 5.14s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 94.95 | 5.05% | 0.59% | 12.80s | $0.0005 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 92.66 | 7.34% | 1.26% | 8.94s | $0.0004 |
| <code>fal/fal-ai/florence-2-large/ocr</code> | Third-Party Service | 31.65 | 68.35% | 20.61% | 10.46s | $0.0076 |
| <code>fal/fal-ai/got-ocr/v2</code> | Third-Party Service | 34.86 | 65.14% | 20.10% | 15.57s | $0.0500 |
| <code>gemini/gemini-3.1-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.16s | $0.0008 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.31s | $0.0008 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 4.59s | $0.0072 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 11.34s | $0.0054 |
| <code>glm/glm-ocr</code> | Third-Party Service | 85.32 | 14.68% | 3.62% | 2.90s | $0.0000 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 98.62 | 1.38% | 0.25% | 1.94s | $0.0021 |
| <code>grok/grok-4.3</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 10.49s | $0.0021 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 95.87 | 4.13% | 0.59% | 13.98s | $0.0029 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 98.62 | 1.38% | 0.25% | 1.62s | $0.0020 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 98.17 | 1.83% | 0.34% | 1.93s | $0.0040 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 72.02 | 27.98% | 3.95% | 3.17s | $0.0026 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 68.81 | 31.19% | 20.44% | 3.46s | $0.0006 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 12.08s | $0.0315 |
| <code>replicate/datalab-to/marker</code> | Third-Party Service | 99.54 | 0.46% | 0.25% | 8.30s | $0.0040 |
| <code>replicate/datalab-to/ocr</code> | Third-Party Service | 74.77 | 25.23% | 5.21% | 11.14s | $0.0020 |
| <code>replicate/lucataco/deepseek-ocr</code> | Third-Party Service | 74.31 | 25.69% | 14.38% | 8.56s | $0.0033 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | 117 | 12 | 2 | 218 |
| <code>paddle-ocr</code> | 131 | 18 | 1 | 218 |
| <code>tesseract</code> | 109 | 12 | 1 | 218 |
| <code>anthropic/claude-haiku-4-5</code> | 17 | 1 | 3 | 218 |
| <code>anthropic/claude-opus-4-8</code> | 4 | 0 | 4 | 218 |
| <code>anthropic/claude-sonnet-5</code> | 4 | 0 | 4 | 218 |
| <code>deepinfra/google/gemma-3-27b-it</code> | 7 | 0 | 4 | 218 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 6 | 1 | 0 | 218 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 7 | 0 | 0 | 218 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 7 | 0 | 4 | 218 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 11 | 1 | 4 | 218 |
| <code>fal/fal-ai/florence-2-large/ocr</code> | 135 | 2 | 12 | 218 |
| <code>fal/fal-ai/got-ocr/v2</code> | 133 | 2 | 7 | 218 |
| <code>gemini/gemini-3.1-flash-lite</code> | 0 | 0 | 0 | 218 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | 0 | 0 | 0 | 218 |
| <code>gemini/gemini-3.1-pro-preview</code> | 4 | 0 | 4 | 218 |
| <code>gemini/gemini-3.5-flash</code> | 4 | 0 | 4 | 218 |
| <code>glm/glm-ocr</code> | 30 | 1 | 1 | 218 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 3 | 0 | 0 | 218 |
| <code>grok/grok-4.3</code> | 0 | 0 | 0 | 218 |
| <code>kimi/kimi-k2.6</code> | 5 | 0 | 4 | 218 |
| <code>mistral/mistral-ocr-2512</code> | 2 | 0 | 1 | 218 |
| <code>mistral/mistral-ocr-4-0</code> | 4 | 0 | 0 | 218 |
| <code>openai/gpt-5.4-mini</code> | 36 | 0 | 25 | 218 |
| <code>openai/gpt-5.4-nano</code> | 34 | 3 | 31 | 218 |
| <code>openai/gpt-5.5</code> | 4 | 0 | 4 | 218 |
| <code>replicate/datalab-to/marker</code> | 0 | 1 | 0 | 218 |
| <code>replicate/datalab-to/ocr</code> | 46 | 3 | 6 | 218 |
| <code>replicate/lucataco/deepseek-ocr</code> | 15 | 0 | 41 | 218 |

## Notes

- Best local model: `tesseract/tesseract` scored 44.04/100.
- Best cloud service: `gemini/gemini-3.1-flash-lite` scored 100.00/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0030¢ ($0.0000).
- Fastest local model: `tesseract/tesseract` at 0.83s.
- Fastest cloud service: `mistral/mistral-ocr-2512` at 1.62s.
