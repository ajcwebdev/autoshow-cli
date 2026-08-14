# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-06-14_01-22-42-930_document`
- Total providers: 30 (3 local, 27 third-party service)
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
| 1 | <code>ocrmypdf</code> | $0.00 local monetary cost | 14.53 | 85.47% | 68.25% | 1.04s | $0.00 |
| 2 | <code>paddle-ocr</code> | $0.00 local monetary cost | 10.17 | 89.83% | 62.75% | 13.67s | $0.00 |
| 3 | <code>tesseract</code> | $0.00 local monetary cost | 42.73 | 57.27% | 36.08% | 0.64s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.64s | 42.73 | 57.27% | 36.08% | 0.64s | $0.00 |
| 2 | <code>ocrmypdf</code> | 1.04s | 14.53 | 85.47% | 68.25% | 1.04s | $0.00 |
| 3 | <code>paddle-ocr</code> | 13.67s | 10.17 | 89.83% | 62.75% | 13.67s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 42.73/100 quality score | 42.73 | 57.27% | 36.08% | 0.64s | $0.00 |
| 2 | <code>ocrmypdf</code> | 14.53/100 quality score | 14.53 | 85.47% | 68.25% | 1.04s | $0.00 |
| 3 | <code>paddle-ocr</code> | 10.17/100 quality score | 10.17 | 89.83% | 62.75% | 13.67s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>glm/glm-ocr</code> | $0.0001 | 0.00 | 176.74% | 140.00% | 4.52s | $0.0001 |
| 2 | <code>deepinfra/google/gemma-3-27b-it</code> | $0.0002 | 23.26 | 76.74% | 50.92% | 51.63s | $0.0002 |
| 3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0002 | 94.77 | 5.23% | 3.00% | 18.46s | $0.0002 |
| 4 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | $0.0003 | 22.67 | 77.33% | 51.33% | 12.09s | $0.0003 |
| 5 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0006 | 95.93 | 4.07% | 3.08% | 25.17s | $0.0006 |
| 6 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0008 | 98.55 | 1.45% | 1.58% | 21.09s | $0.0008 |
| 7 | <code>openai/gpt-5.4-nano</code> | $0.0011 | 79.07 | 20.93% | 11.83% | 6.13s | $0.0011 |
| 8 | <code>gemini/gemini-3.1-flash-lite-preview</code> | $0.0017 | 63.66 | 36.34% | 26.83% | 3.64s | $0.0017 |
| 9 | <code>gemini/gemini-3.1-flash-lite</code> | $0.0017 | 32.85 | 67.15% | 48.58% | 3.54s | $0.0017 |
| 10 | <code>mistral/mistral-ocr-2512</code> | $0.0020 | 12.21 | 87.79% | 57.50% | 2.00s | $0.0020 |
| 11 | <code>replicate/datalab-to/ocr</code> | $0.0020 | 1.16 | 98.84% | 76.67% | 5.72s | $0.0020 |
| 12 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0023 | 96.80 | 3.20% | 2.08% | 3.17s | $0.0023 |
| 13 | <code>grok/grok-4.3</code> | $0.0028 | 22.09 | 77.91% | 51.83% | 10.15s | $0.0028 |
| 14 | <code>kimi/kimi-k2.6</code> | $0.0032 | 91.86 | 8.14% | 7.75% | 11.29s | $0.0032 |
| 15 | <code>replicate/lucataco/deepseek-ocr</code> | $0.0033 | 0.00 | 165.41% | 131.42% | 18.09s | $0.0033 |
| 16 | <code>openai/gpt-5.4-mini</code> | $0.0033 | 90.99 | 9.01% | 7.75% | 3.37s | $0.0033 |
| 17 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 91.57 | 8.43% | 7.08% | 2.96s | $0.0040 |
| 18 | <code>replicate/datalab-to/marker</code> | $0.0040 | 73.55 | 26.45% | 25.33% | 8.10s | $0.0040 |
| 19 | <code>anthropic/claude-haiku-4-5</code> | $0.0046 | 18.90 | 81.10% | 52.25% | 12.41s | $0.0046 |
| 20 | <code>fal/fal-ai/florence-2-large/ocr</code> | $0.0076 | 11.63 | 88.37% | 58.92% | 10.29s | $0.0076 |
| 21 | <code>gemini/gemini-3.5-flash</code> | $0.0102 | 98.55 | 1.45% | 1.50% | 23.38s | $0.0102 |
| 22 | <code>anthropic/claude-sonnet-5</code> | $0.0109 | 97.67 | 2.33% | 2.17% | 14.57s | $0.0109 |
| 23 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0141 | 86.63 | 13.37% | 6.33% | 8.02s | $0.0141 |
| 24 | <code>anthropic/claude-sonnet-4-6</code> | $0.0155 | 95.35 | 4.65% | 3.50% | 23.09s | $0.0155 |
| 25 | <code>anthropic/claude-opus-4-8</code> | $0.0276 | 100.00 | 0.00% | 0.00% | 14.66s | $0.0276 |
| 26 | <code>fal/fal-ai/got-ocr/v2</code> | $0.0500 | 0.00 | 319.19% | 356.50% | 95.78s | $0.0500 |
| 27 | <code>openai/gpt-5.5</code> | $0.0572 | 98.55 | 1.45% | 0.42% | 19.17s | $0.0572 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-2512</code> | 2.00s | 12.21 | 87.79% | 57.50% | 2.00s | $0.0020 |
| 2 | <code>mistral/mistral-ocr-4-0</code> | 2.96s | 91.57 | 8.43% | 7.08% | 2.96s | $0.0040 |
| 3 | <code>grok/grok-4.20-0309-non-reasoning</code> | 3.17s | 96.80 | 3.20% | 2.08% | 3.17s | $0.0023 |
| 4 | <code>openai/gpt-5.4-mini</code> | 3.37s | 90.99 | 9.01% | 7.75% | 3.37s | $0.0033 |
| 5 | <code>gemini/gemini-3.1-flash-lite</code> | 3.54s | 32.85 | 67.15% | 48.58% | 3.54s | $0.0017 |
| 6 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 3.64s | 63.66 | 36.34% | 26.83% | 3.64s | $0.0017 |
| 7 | <code>glm/glm-ocr</code> | 4.52s | 0.00 | 176.74% | 140.00% | 4.52s | $0.0001 |
| 8 | <code>replicate/datalab-to/ocr</code> | 5.72s | 1.16 | 98.84% | 76.67% | 5.72s | $0.0020 |
| 9 | <code>openai/gpt-5.4-nano</code> | 6.13s | 79.07 | 20.93% | 11.83% | 6.13s | $0.0011 |
| 10 | <code>gemini/gemini-3.1-pro-preview</code> | 8.02s | 86.63 | 13.37% | 6.33% | 8.02s | $0.0141 |
| 11 | <code>replicate/datalab-to/marker</code> | 8.10s | 73.55 | 26.45% | 25.33% | 8.10s | $0.0040 |
| 12 | <code>grok/grok-4.3</code> | 10.15s | 22.09 | 77.91% | 51.83% | 10.15s | $0.0028 |
| 13 | <code>fal/fal-ai/florence-2-large/ocr</code> | 10.29s | 11.63 | 88.37% | 58.92% | 10.29s | $0.0076 |
| 14 | <code>kimi/kimi-k2.6</code> | 11.29s | 91.86 | 8.14% | 7.75% | 11.29s | $0.0032 |
| 15 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 12.09s | 22.67 | 77.33% | 51.33% | 12.09s | $0.0003 |
| 16 | <code>anthropic/claude-haiku-4-5</code> | 12.41s | 18.90 | 81.10% | 52.25% | 12.41s | $0.0046 |
| 17 | <code>anthropic/claude-sonnet-5</code> | 14.57s | 97.67 | 2.33% | 2.17% | 14.57s | $0.0109 |
| 18 | <code>anthropic/claude-opus-4-8</code> | 14.66s | 100.00 | 0.00% | 0.00% | 14.66s | $0.0276 |
| 19 | <code>replicate/lucataco/deepseek-ocr</code> | 18.09s | 0.00 | 165.41% | 131.42% | 18.09s | $0.0033 |
| 20 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 18.46s | 94.77 | 5.23% | 3.00% | 18.46s | $0.0002 |
| 21 | <code>openai/gpt-5.5</code> | 19.17s | 98.55 | 1.45% | 0.42% | 19.17s | $0.0572 |
| 22 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 21.09s | 98.55 | 1.45% | 1.58% | 21.09s | $0.0008 |
| 23 | <code>anthropic/claude-sonnet-4-6</code> | 23.09s | 95.35 | 4.65% | 3.50% | 23.09s | $0.0155 |
| 24 | <code>gemini/gemini-3.5-flash</code> | 23.38s | 98.55 | 1.45% | 1.50% | 23.38s | $0.0102 |
| 25 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 25.17s | 95.93 | 4.07% | 3.08% | 25.17s | $0.0006 |
| 26 | <code>deepinfra/google/gemma-3-27b-it</code> | 51.63s | 23.26 | 76.74% | 50.92% | 51.63s | $0.0002 |
| 27 | <code>fal/fal-ai/got-ocr/v2</code> | 95.78s | 0.00 | 319.19% | 356.50% | 95.78s | $0.0500 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-opus-4-8</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 14.66s | $0.0276 |
| 2 | <code>openai/gpt-5.5</code> | 98.55/100 quality score | 98.55 | 1.45% | 0.42% | 19.17s | $0.0572 |
| 3 | <code>gemini/gemini-3.5-flash</code> | 98.55/100 quality score | 98.55 | 1.45% | 1.50% | 23.38s | $0.0102 |
| 4 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 98.55/100 quality score | 98.55 | 1.45% | 1.58% | 21.09s | $0.0008 |
| 5 | <code>anthropic/claude-sonnet-5</code> | 97.67/100 quality score | 97.67 | 2.33% | 2.17% | 14.57s | $0.0109 |
| 6 | <code>grok/grok-4.20-0309-non-reasoning</code> | 96.80/100 quality score | 96.80 | 3.20% | 2.08% | 3.17s | $0.0023 |
| 7 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 95.93/100 quality score | 95.93 | 4.07% | 3.08% | 25.17s | $0.0006 |
| 8 | <code>anthropic/claude-sonnet-4-6</code> | 95.35/100 quality score | 95.35 | 4.65% | 3.50% | 23.09s | $0.0155 |
| 9 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 94.77/100 quality score | 94.77 | 5.23% | 3.00% | 18.46s | $0.0002 |
| 10 | <code>kimi/kimi-k2.6</code> | 91.86/100 quality score | 91.86 | 8.14% | 7.75% | 11.29s | $0.0032 |
| 11 | <code>mistral/mistral-ocr-4-0</code> | 91.57/100 quality score | 91.57 | 8.43% | 7.08% | 2.96s | $0.0040 |
| 12 | <code>openai/gpt-5.4-mini</code> | 90.99/100 quality score | 90.99 | 9.01% | 7.75% | 3.37s | $0.0033 |
| 13 | <code>gemini/gemini-3.1-pro-preview</code> | 86.63/100 quality score | 86.63 | 13.37% | 6.33% | 8.02s | $0.0141 |
| 14 | <code>openai/gpt-5.4-nano</code> | 79.07/100 quality score | 79.07 | 20.93% | 11.83% | 6.13s | $0.0011 |
| 15 | <code>replicate/datalab-to/marker</code> | 73.55/100 quality score | 73.55 | 26.45% | 25.33% | 8.10s | $0.0040 |
| 16 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 63.66/100 quality score | 63.66 | 36.34% | 26.83% | 3.64s | $0.0017 |
| 17 | <code>gemini/gemini-3.1-flash-lite</code> | 32.85/100 quality score | 32.85 | 67.15% | 48.58% | 3.54s | $0.0017 |
| 18 | <code>deepinfra/google/gemma-3-27b-it</code> | 23.26/100 quality score | 23.26 | 76.74% | 50.92% | 51.63s | $0.0002 |
| 19 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 22.67/100 quality score | 22.67 | 77.33% | 51.33% | 12.09s | $0.0003 |
| 20 | <code>grok/grok-4.3</code> | 22.09/100 quality score | 22.09 | 77.91% | 51.83% | 10.15s | $0.0028 |
| 21 | <code>anthropic/claude-haiku-4-5</code> | 18.90/100 quality score | 18.90 | 81.10% | 52.25% | 12.41s | $0.0046 |
| 22 | <code>mistral/mistral-ocr-2512</code> | 12.21/100 quality score | 12.21 | 87.79% | 57.50% | 2.00s | $0.0020 |
| 23 | <code>fal/fal-ai/florence-2-large/ocr</code> | 11.63/100 quality score | 11.63 | 88.37% | 58.92% | 10.29s | $0.0076 |
| 24 | <code>replicate/datalab-to/ocr</code> | 1.16/100 quality score | 1.16 | 98.84% | 76.67% | 5.72s | $0.0020 |
| 25 | <code>replicate/lucataco/deepseek-ocr</code> | 0.00/100 quality score | 0.00 | 165.41% | 131.42% | 18.09s | $0.0033 |
| 26 | <code>glm/glm-ocr</code> | 0.00/100 quality score | 0.00 | 176.74% | 140.00% | 4.52s | $0.0001 |
| 27 | <code>fal/fal-ai/got-ocr/v2</code> | 0.00/100 quality score | 0.00 | 319.19% | 356.50% | 95.78s | $0.0500 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | Local | 14.53 | 85.47% | 68.25% | 1.04s | $0.00 |
| <code>paddle-ocr</code> | Local | 10.17 | 89.83% | 62.75% | 13.67s | $0.00 |
| <code>tesseract</code> | Local | 42.73 | 57.27% | 36.08% | 0.64s | $0.00 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 18.90 | 81.10% | 52.25% | 12.41s | $0.0046 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 14.66s | $0.0276 |
| <code>anthropic/claude-sonnet-4-6</code> | Third-Party Service | 95.35 | 4.65% | 3.50% | 23.09s | $0.0155 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 97.67 | 2.33% | 2.17% | 14.57s | $0.0109 |
| <code>deepinfra/google/gemma-3-27b-it</code> | Third-Party Service | 23.26 | 76.74% | 50.92% | 51.63s | $0.0002 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | Third-Party Service | 22.67 | 77.33% | 51.33% | 12.09s | $0.0003 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service | 94.77 | 5.23% | 3.00% | 18.46s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 98.55 | 1.45% | 1.58% | 21.09s | $0.0008 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 95.93 | 4.07% | 3.08% | 25.17s | $0.0006 |
| <code>fal/fal-ai/florence-2-large/ocr</code> | Third-Party Service | 11.63 | 88.37% | 58.92% | 10.29s | $0.0076 |
| <code>fal/fal-ai/got-ocr/v2</code> | Third-Party Service | 0.00 | 319.19% | 356.50% | 95.78s | $0.0500 |
| <code>gemini/gemini-3.1-flash-lite</code> | Third-Party Service | 32.85 | 67.15% | 48.58% | 3.54s | $0.0017 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | Third-Party Service | 63.66 | 36.34% | 26.83% | 3.64s | $0.0017 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 86.63 | 13.37% | 6.33% | 8.02s | $0.0141 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 98.55 | 1.45% | 1.50% | 23.38s | $0.0102 |
| <code>glm/glm-ocr</code> | Third-Party Service | 0.00 | 176.74% | 140.00% | 4.52s | $0.0001 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 96.80 | 3.20% | 2.08% | 3.17s | $0.0023 |
| <code>grok/grok-4.3</code> | Third-Party Service | 22.09 | 77.91% | 51.83% | 10.15s | $0.0028 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 91.86 | 8.14% | 7.75% | 11.29s | $0.0032 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 12.21 | 87.79% | 57.50% | 2.00s | $0.0020 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 91.57 | 8.43% | 7.08% | 2.96s | $0.0040 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 90.99 | 9.01% | 7.75% | 3.37s | $0.0033 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 79.07 | 20.93% | 11.83% | 6.13s | $0.0011 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 98.55 | 1.45% | 0.42% | 19.17s | $0.0572 |
| <code>replicate/datalab-to/marker</code> | Third-Party Service | 73.55 | 26.45% | 25.33% | 8.10s | $0.0040 |
| <code>replicate/datalab-to/ocr</code> | Third-Party Service | 1.16 | 98.84% | 76.67% | 5.72s | $0.0020 |
| <code>replicate/lucataco/deepseek-ocr</code> | Third-Party Service | 0.00 | 165.41% | 131.42% | 18.09s | $0.0033 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | 40 | 248 | 6 | 344 |
| <code>paddle-ocr</code> | 235 | 43 | 31 | 344 |
| <code>tesseract</code> | 114 | 80 | 3 | 344 |
| <code>anthropic/claude-haiku-4-5</code> | 173 | 61 | 45 | 344 |
| <code>anthropic/claude-opus-4-8</code> | 0 | 0 | 0 | 344 |
| <code>anthropic/claude-sonnet-4-6</code> | 4 | 0 | 12 | 344 |
| <code>anthropic/claude-sonnet-5</code> | 2 | 0 | 6 | 344 |
| <code>deepinfra/google/gemma-3-27b-it</code> | 163 | 68 | 33 | 344 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 152 | 71 | 43 | 344 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 11 | 4 | 3 | 344 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 2 | 3 | 0 | 344 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 5 | 0 | 9 | 344 |
| <code>fal/fal-ai/florence-2-large/ocr</code> | 272 | 8 | 24 | 344 |
| <code>fal/fal-ai/got-ocr/v2</code> | 313 | 1 | 784 | 344 |
| <code>gemini/gemini-3.1-flash-lite</code> | 59 | 86 | 86 | 344 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | 45 | 40 | 40 | 344 |
| <code>gemini/gemini-3.1-pro-preview</code> | 12 | 16 | 18 | 344 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 5 | 344 |
| <code>glm/glm-ocr</code> | 197 | 3 | 408 | 344 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 7 | 0 | 4 | 344 |
| <code>grok/grok-4.3</code> | 166 | 48 | 54 | 344 |
| <code>kimi/kimi-k2.6</code> | 10 | 7 | 11 | 344 |
| <code>mistral/mistral-ocr-2512</code> | 125 | 77 | 100 | 344 |
| <code>mistral/mistral-ocr-4-0</code> | 7 | 0 | 22 | 344 |
| <code>openai/gpt-5.4-mini</code> | 13 | 7 | 11 | 344 |
| <code>openai/gpt-5.4-nano</code> | 50 | 7 | 15 | 344 |
| <code>openai/gpt-5.5</code> | 5 | 0 | 0 | 344 |
| <code>replicate/datalab-to/marker</code> | 1 | 0 | 90 | 344 |
| <code>replicate/datalab-to/ocr</code> | 254 | 7 | 79 | 344 |
| <code>replicate/lucataco/deepseek-ocr</code> | 202 | 0 | 367 | 344 |

## Notes

- Best local model: `tesseract/tesseract` scored 42.73/100.
- Best cloud service: `anthropic/claude-opus-4-8` scored 100.00/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0063¢ ($0.0001).
- Fastest local model: `tesseract/tesseract` at 0.64s.
- Fastest cloud service: `mistral/mistral-ocr-2512` at 2.00s.
