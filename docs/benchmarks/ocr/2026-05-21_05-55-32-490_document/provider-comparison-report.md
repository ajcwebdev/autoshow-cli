# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-05-21_05-55-32-490_document`
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
| 1 | <code>ocrmypdf</code> | $0.00 local monetary cost | 75.52 | 24.48% | 7.00% | 9.09s | $0.00 |
| 2 | <code>paddle-ocr</code> | $0.00 local monetary cost | 71.12 | 28.88% | 7.76% | 64.94s | $0.00 |
| 3 | <code>tesseract</code> | $0.00 local monetary cost | 77.22 | 22.78% | 6.22% | 7.35s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 7.35s | 77.22 | 22.78% | 6.22% | 7.35s | $0.00 |
| 2 | <code>ocrmypdf</code> | 9.09s | 75.52 | 24.48% | 7.00% | 9.09s | $0.00 |
| 3 | <code>paddle-ocr</code> | 64.94s | 71.12 | 28.88% | 7.76% | 64.94s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 77.22/100 quality score | 77.22 | 22.78% | 6.22% | 7.35s | $0.00 |
| 2 | <code>ocrmypdf</code> | 75.52/100 quality score | 75.52 | 24.48% | 7.00% | 9.09s | $0.00 |
| 3 | <code>paddle-ocr</code> | 71.12/100 quality score | 71.12 | 28.88% | 7.76% | 64.94s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>glm/glm-ocr</code> | $0.0003 | 80.36 | 19.64% | 15.28% | 15.17s | $0.0003 |
| 2 | <code>deepinfra/google/gemma-3-27b-it</code> | $0.0004 | 83.23 | 16.77% | 5.48% | 0.02s | $0.0004 |
| 3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0011 | 87.35 | 12.65% | 3.73% | 0.01s | $0.0011 |
| 4 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | $0.0017 | 84.22 | 15.78% | 5.22% | 10.98s | $0.0017 |
| 5 | <code>gemini/gemini-3.1-flash-lite-preview</code> | $0.0033 | 98.65 | 1.35% | 0.40% | 6.26s | $0.0033 |
| 6 | <code>gemini/gemini-3.1-flash-lite</code> | $0.0035 | 91.57 | 8.43% | 2.21% | 8.28s | $0.0035 |
| 7 | <code>openai/gpt-5.4-nano</code> | $0.0039 | 58.12 | 41.88% | 28.95% | 53.85s | $0.0039 |
| 8 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0052 | 91.21 | 8.79% | 2.99% | 70.58s | $0.0052 |
| 9 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0071 | 84.84 | 15.16% | 4.04% | 44.17s | $0.0071 |
| 10 | <code>mistral/mistral-ocr-2512</code> | $0.0100 | 96.05 | 3.95% | 1.54% | 6.32s | $0.0100 |
| 11 | <code>replicate/datalab-to/ocr</code> | $0.0100 | 89.15 | 10.85% | 2.94% | 10.51s | $0.0100 |
| 12 | <code>openai/gpt-5.4-mini</code> | $0.0151 | 88.43 | 11.57% | 7.29% | 31.93s | $0.0151 |
| 13 | <code>replicate/lucataco/deepseek-ocr</code> | $0.0165 | 58.74 | 41.26% | 23.28% | 44.75s | $0.0165 |
| 14 | <code>anthropic/claude-haiku-4-5</code> | $0.0193 | 95.15 | 4.85% | 1.24% | 39.42s | $0.0193 |
| 15 | <code>mistral/mistral-ocr-4-0</code> | $0.0200 | 88.34 | 11.66% | 2.68% | 6.83s | $0.0200 |
| 16 | <code>replicate/datalab-to/marker</code> | $0.0200 | 90.40 | 9.60% | 2.78% | 13.54s | $0.0200 |
| 17 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0202 | 88.53 | 11.47% | 3.41% | 3.38s | $0.0202 |
| 18 | <code>grok/grok-4.3</code> | $0.0202 | 98.74 | 1.26% | 0.24% | 83.79s | $0.0202 |
| 19 | <code>gemini/gemini-3.5-flash</code> | $0.0223 | 92.91 | 7.09% | 0.32% | 44.05s | $0.0223 |
| 20 | <code>kimi/kimi-k2.6</code> | $0.0274 | 89.33 | 10.67% | 1.85% | 54.20s | $0.0274 |
| 21 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0287 | 94.17 | 5.83% | 0.90% | 127.83s | $0.0287 |
| 22 | <code>fal/fal-ai/florence-2-large/ocr</code> | $0.0377 | 79.37 | 20.63% | 6.66% | 12.41s | $0.0377 |
| 23 | <code>anthropic/claude-sonnet-5</code> | $0.0456 | 81.90 | 18.10% | 4.16% | 43.29s | $0.0456 |
| 24 | <code>anthropic/claude-sonnet-4-6</code> | $0.0581 | 98.92 | 1.08% | 0.17% | 66.18s | $0.0581 |
| 25 | <code>anthropic/claude-opus-4-8</code> | $0.1152 | 81.70 | 18.30% | 3.75% | 52.11s | $0.1152 |
| 26 | <code>openai/gpt-5.5</code> | $0.1853 | 96.95 | 3.05% | 0.43% | 51.40s | $0.1853 |
| 27 | <code>fal/fal-ai/got-ocr/v2</code> | $0.2500 | 73.36 | 26.64% | 11.15% | 74.88s | $0.2500 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 0.01s | 87.35 | 12.65% | 3.73% | 0.01s | $0.0011 |
| 2 | <code>deepinfra/google/gemma-3-27b-it</code> | 0.02s | 83.23 | 16.77% | 5.48% | 0.02s | $0.0004 |
| 3 | <code>grok/grok-4.20-0309-non-reasoning</code> | 3.38s | 88.53 | 11.47% | 3.41% | 3.38s | $0.0202 |
| 4 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 6.26s | 98.65 | 1.35% | 0.40% | 6.26s | $0.0033 |
| 5 | <code>mistral/mistral-ocr-2512</code> | 6.32s | 96.05 | 3.95% | 1.54% | 6.32s | $0.0100 |
| 6 | <code>mistral/mistral-ocr-4-0</code> | 6.83s | 88.34 | 11.66% | 2.68% | 6.83s | $0.0200 |
| 7 | <code>gemini/gemini-3.1-flash-lite</code> | 8.28s | 91.57 | 8.43% | 2.21% | 8.28s | $0.0035 |
| 8 | <code>replicate/datalab-to/ocr</code> | 10.51s | 89.15 | 10.85% | 2.94% | 10.51s | $0.0100 |
| 9 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 10.98s | 84.22 | 15.78% | 5.22% | 10.98s | $0.0017 |
| 10 | <code>fal/fal-ai/florence-2-large/ocr</code> | 12.41s | 79.37 | 20.63% | 6.66% | 12.41s | $0.0377 |
| 11 | <code>replicate/datalab-to/marker</code> | 13.54s | 90.40 | 9.60% | 2.78% | 13.54s | $0.0200 |
| 12 | <code>glm/glm-ocr</code> | 15.17s | 80.36 | 19.64% | 15.28% | 15.17s | $0.0003 |
| 13 | <code>openai/gpt-5.4-mini</code> | 31.93s | 88.43 | 11.57% | 7.29% | 31.93s | $0.0151 |
| 14 | <code>anthropic/claude-haiku-4-5</code> | 39.42s | 95.15 | 4.85% | 1.24% | 39.42s | $0.0193 |
| 15 | <code>anthropic/claude-sonnet-5</code> | 43.29s | 81.90 | 18.10% | 4.16% | 43.29s | $0.0456 |
| 16 | <code>gemini/gemini-3.5-flash</code> | 44.05s | 92.91 | 7.09% | 0.32% | 44.05s | $0.0223 |
| 17 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 44.17s | 84.84 | 15.16% | 4.04% | 44.17s | $0.0071 |
| 18 | <code>replicate/lucataco/deepseek-ocr</code> | 44.75s | 58.74 | 41.26% | 23.28% | 44.75s | $0.0165 |
| 19 | <code>openai/gpt-5.5</code> | 51.40s | 96.95 | 3.05% | 0.43% | 51.40s | $0.1853 |
| 20 | <code>anthropic/claude-opus-4-8</code> | 52.11s | 81.70 | 18.30% | 3.75% | 52.11s | $0.1152 |
| 21 | <code>openai/gpt-5.4-nano</code> | 53.85s | 58.12 | 41.88% | 28.95% | 53.85s | $0.0039 |
| 22 | <code>kimi/kimi-k2.6</code> | 54.20s | 89.33 | 10.67% | 1.85% | 54.20s | $0.0274 |
| 23 | <code>anthropic/claude-sonnet-4-6</code> | 66.18s | 98.92 | 1.08% | 0.17% | 66.18s | $0.0581 |
| 24 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 70.58s | 91.21 | 8.79% | 2.99% | 70.58s | $0.0052 |
| 25 | <code>fal/fal-ai/got-ocr/v2</code> | 74.88s | 73.36 | 26.64% | 11.15% | 74.88s | $0.2500 |
| 26 | <code>grok/grok-4.3</code> | 83.79s | 98.74 | 1.26% | 0.24% | 83.79s | $0.0202 |
| 27 | <code>gemini/gemini-3.1-pro-preview</code> | 127.83s | 94.17 | 5.83% | 0.90% | 127.83s | $0.0287 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-sonnet-4-6</code> | 98.92/100 quality score | 98.92 | 1.08% | 0.17% | 66.18s | $0.0581 |
| 2 | <code>grok/grok-4.3</code> | 98.74/100 quality score | 98.74 | 1.26% | 0.24% | 83.79s | $0.0202 |
| 3 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 98.65/100 quality score | 98.65 | 1.35% | 0.40% | 6.26s | $0.0033 |
| 4 | <code>openai/gpt-5.5</code> | 96.95/100 quality score | 96.95 | 3.05% | 0.43% | 51.40s | $0.1853 |
| 5 | <code>mistral/mistral-ocr-2512</code> | 96.05/100 quality score | 96.05 | 3.95% | 1.54% | 6.32s | $0.0100 |
| 6 | <code>anthropic/claude-haiku-4-5</code> | 95.15/100 quality score | 95.15 | 4.85% | 1.24% | 39.42s | $0.0193 |
| 7 | <code>gemini/gemini-3.1-pro-preview</code> | 94.17/100 quality score | 94.17 | 5.83% | 0.90% | 127.83s | $0.0287 |
| 8 | <code>gemini/gemini-3.5-flash</code> | 92.91/100 quality score | 92.91 | 7.09% | 0.32% | 44.05s | $0.0223 |
| 9 | <code>gemini/gemini-3.1-flash-lite</code> | 91.57/100 quality score | 91.57 | 8.43% | 2.21% | 8.28s | $0.0035 |
| 10 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 91.21/100 quality score | 91.21 | 8.79% | 2.99% | 70.58s | $0.0052 |
| 11 | <code>replicate/datalab-to/marker</code> | 90.40/100 quality score | 90.40 | 9.60% | 2.78% | 13.54s | $0.0200 |
| 12 | <code>kimi/kimi-k2.6</code> | 89.33/100 quality score | 89.33 | 10.67% | 1.85% | 54.20s | $0.0274 |
| 13 | <code>replicate/datalab-to/ocr</code> | 89.15/100 quality score | 89.15 | 10.85% | 2.94% | 10.51s | $0.0100 |
| 14 | <code>grok/grok-4.20-0309-non-reasoning</code> | 88.53/100 quality score | 88.53 | 11.47% | 3.41% | 3.38s | $0.0202 |
| 15 | <code>openai/gpt-5.4-mini</code> | 88.43/100 quality score | 88.43 | 11.57% | 7.29% | 31.93s | $0.0151 |
| 16 | <code>mistral/mistral-ocr-4-0</code> | 88.34/100 quality score | 88.34 | 11.66% | 2.68% | 6.83s | $0.0200 |
| 17 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 87.35/100 quality score | 87.35 | 12.65% | 3.73% | 0.01s | $0.0011 |
| 18 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 84.84/100 quality score | 84.84 | 15.16% | 4.04% | 44.17s | $0.0071 |
| 19 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 84.22/100 quality score | 84.22 | 15.78% | 5.22% | 10.98s | $0.0017 |
| 20 | <code>deepinfra/google/gemma-3-27b-it</code> | 83.23/100 quality score | 83.23 | 16.77% | 5.48% | 0.02s | $0.0004 |
| 21 | <code>anthropic/claude-sonnet-5</code> | 81.90/100 quality score | 81.90 | 18.10% | 4.16% | 43.29s | $0.0456 |
| 22 | <code>anthropic/claude-opus-4-8</code> | 81.70/100 quality score | 81.70 | 18.30% | 3.75% | 52.11s | $0.1152 |
| 23 | <code>glm/glm-ocr</code> | 80.36/100 quality score | 80.36 | 19.64% | 15.28% | 15.17s | $0.0003 |
| 24 | <code>fal/fal-ai/florence-2-large/ocr</code> | 79.37/100 quality score | 79.37 | 20.63% | 6.66% | 12.41s | $0.0377 |
| 25 | <code>fal/fal-ai/got-ocr/v2</code> | 73.36/100 quality score | 73.36 | 26.64% | 11.15% | 74.88s | $0.2500 |
| 26 | <code>replicate/lucataco/deepseek-ocr</code> | 58.74/100 quality score | 58.74 | 41.26% | 23.28% | 44.75s | $0.0165 |
| 27 | <code>openai/gpt-5.4-nano</code> | 58.12/100 quality score | 58.12 | 41.88% | 28.95% | 53.85s | $0.0039 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | Local | 75.52 | 24.48% | 7.00% | 9.09s | $0.00 |
| <code>paddle-ocr</code> | Local | 71.12 | 28.88% | 7.76% | 64.94s | $0.00 |
| <code>tesseract</code> | Local | 77.22 | 22.78% | 6.22% | 7.35s | $0.00 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 95.15 | 4.85% | 1.24% | 39.42s | $0.0193 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 81.70 | 18.30% | 3.75% | 52.11s | $0.1152 |
| <code>anthropic/claude-sonnet-4-6</code> | Third-Party Service | 98.92 | 1.08% | 0.17% | 66.18s | $0.0581 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 81.90 | 18.10% | 4.16% | 43.29s | $0.0456 |
| <code>deepinfra/google/gemma-3-27b-it</code> | Third-Party Service | 83.23 | 16.77% | 5.48% | 0.02s | $0.0004 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | Third-Party Service | 84.22 | 15.78% | 5.22% | 10.98s | $0.0017 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service | 87.35 | 12.65% | 3.73% | 0.01s | $0.0011 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 84.84 | 15.16% | 4.04% | 44.17s | $0.0071 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 91.21 | 8.79% | 2.99% | 70.58s | $0.0052 |
| <code>fal/fal-ai/florence-2-large/ocr</code> | Third-Party Service | 79.37 | 20.63% | 6.66% | 12.41s | $0.0377 |
| <code>fal/fal-ai/got-ocr/v2</code> | Third-Party Service | 73.36 | 26.64% | 11.15% | 74.88s | $0.2500 |
| <code>gemini/gemini-3.1-flash-lite</code> | Third-Party Service | 91.57 | 8.43% | 2.21% | 8.28s | $0.0035 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | Third-Party Service | 98.65 | 1.35% | 0.40% | 6.26s | $0.0033 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 94.17 | 5.83% | 0.90% | 127.83s | $0.0287 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 92.91 | 7.09% | 0.32% | 44.05s | $0.0223 |
| <code>glm/glm-ocr</code> | Third-Party Service | 80.36 | 19.64% | 15.28% | 15.17s | $0.0003 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 88.53 | 11.47% | 3.41% | 3.38s | $0.0202 |
| <code>grok/grok-4.3</code> | Third-Party Service | 98.74 | 1.26% | 0.24% | 83.79s | $0.0202 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 89.33 | 10.67% | 1.85% | 54.20s | $0.0274 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 96.05 | 3.95% | 1.54% | 6.32s | $0.0100 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 88.34 | 11.66% | 2.68% | 6.83s | $0.0200 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 88.43 | 11.57% | 7.29% | 31.93s | $0.0151 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 58.12 | 41.88% | 28.95% | 53.85s | $0.0039 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 96.95 | 3.05% | 0.43% | 51.40s | $0.1853 |
| <code>replicate/datalab-to/marker</code> | Third-Party Service | 90.40 | 9.60% | 2.78% | 13.54s | $0.0200 |
| <code>replicate/datalab-to/ocr</code> | Third-Party Service | 89.15 | 10.85% | 2.94% | 10.51s | $0.0100 |
| <code>replicate/lucataco/deepseek-ocr</code> | Third-Party Service | 58.74 | 41.26% | 23.28% | 44.75s | $0.0165 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | 225 | 27 | 21 | 1115 |
| <code>paddle-ocr</code> | 242 | 73 | 7 | 1115 |
| <code>tesseract</code> | 216 | 22 | 16 | 1115 |
| <code>anthropic/claude-haiku-4-5</code> | 41 | 11 | 0 | 1072 |
| <code>anthropic/claude-opus-4-8</code> | 187 | 0 | 17 | 1115 |
| <code>anthropic/claude-sonnet-4-6</code> | 6 | 3 | 3 | 1115 |
| <code>anthropic/claude-sonnet-5</code> | 187 | 7 | 0 | 1072 |
| <code>deepinfra/google/gemma-3-27b-it</code> | 151 | 18 | 18 | 1115 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 132 | 42 | 2 | 1115 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 111 | 29 | 1 | 1115 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 130 | 24 | 15 | 1115 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 62 | 27 | 9 | 1115 |
| <code>fal/fal-ai/florence-2-large/ocr</code> | 198 | 20 | 12 | 1115 |
| <code>fal/fal-ai/got-ocr/v2</code> | 203 | 25 | 69 | 1115 |
| <code>gemini/gemini-3.1-flash-lite</code> | 22 | 21 | 51 | 1115 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | 12 | 3 | 0 | 1115 |
| <code>gemini/gemini-3.1-pro-preview</code> | 20 | 0 | 45 | 1115 |
| <code>gemini/gemini-3.5-flash</code> | 25 | 0 | 51 | 1072 |
| <code>glm/glm-ocr</code> | 63 | 149 | 7 | 1115 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 86 | 29 | 8 | 1072 |
| <code>grok/grok-4.3</code> | 13 | 0 | 1 | 1115 |
| <code>kimi/kimi-k2.6</code> | 90 | 7 | 22 | 1115 |
| <code>mistral/mistral-ocr-2512</code> | 15 | 15 | 14 | 1115 |
| <code>mistral/mistral-ocr-4-0</code> | 103 | 8 | 14 | 1072 |
| <code>openai/gpt-5.4-mini</code> | 37 | 86 | 1 | 1072 |
| <code>openai/gpt-5.4-nano</code> | 167 | 287 | 13 | 1115 |
| <code>openai/gpt-5.5</code> | 13 | 3 | 18 | 1115 |
| <code>replicate/datalab-to/marker</code> | 46 | 23 | 38 | 1115 |
| <code>replicate/datalab-to/ocr</code> | 93 | 9 | 19 | 1115 |
| <code>replicate/lucataco/deepseek-ocr</code> | 197 | 40 | 223 | 1115 |

## Notes

- Best local model: `tesseract/tesseract` scored 77.22/100.
- Best cloud service: `anthropic/claude-sonnet-4-6` scored 98.92/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0346¢ ($0.0003).
- Fastest local model: `tesseract/tesseract` at 7.35s.
- Fastest cloud service: `deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506` at 0.01s.
