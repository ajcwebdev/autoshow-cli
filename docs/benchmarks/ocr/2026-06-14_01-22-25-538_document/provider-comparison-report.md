# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-06-14_01-22-25-538_document`
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
| 1 | <code>ocrmypdf</code> | $0.00 local monetary cost | 11.73 | 88.27% | 58.07% | 1.57s | $0.00 |
| 2 | <code>paddle-ocr</code> | $0.00 local monetary cost | 41.33 | 58.67% | 32.63% | 10.98s | $0.00 |
| 3 | <code>tesseract</code> | $0.00 local monetary cost | 9.69 | 90.31% | 85.61% | 0.26s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.26s | 9.69 | 90.31% | 85.61% | 0.26s | $0.00 |
| 2 | <code>ocrmypdf</code> | 1.57s | 11.73 | 88.27% | 58.07% | 1.57s | $0.00 |
| 3 | <code>paddle-ocr</code> | 10.98s | 41.33 | 58.67% | 32.63% | 10.98s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>paddle-ocr</code> | 41.33/100 quality score | 41.33 | 58.67% | 32.63% | 10.98s | $0.00 |
| 2 | <code>ocrmypdf</code> | 11.73/100 quality score | 11.73 | 88.27% | 58.07% | 1.57s | $0.00 |
| 3 | <code>tesseract</code> | 9.69/100 quality score | 9.69 | 90.31% | 85.61% | 0.26s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>glm/glm-ocr</code> | $0.0001 | 0.00 | 222.45% | 219.30% | 4.37s | $0.0001 |
| 2 | <code>deepinfra/google/gemma-3-27b-it</code> | $0.0001 | 31.63 | 68.37% | 47.89% | 29.26s | $0.0001 |
| 3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0002 | 55.61 | 44.39% | 15.96% | 7.09s | $0.0002 |
| 4 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | $0.0003 | 70.92 | 29.08% | 15.44% | 10.08s | $0.0003 |
| 5 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0004 | 78.57 | 21.43% | 7.19% | 10.36s | $0.0004 |
| 6 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0006 | 76.53 | 23.47% | 7.37% | 12.18s | $0.0006 |
| 7 | <code>openai/gpt-5.4-nano</code> | $0.0006 | 43.37 | 56.63% | 25.79% | 3.26s | $0.0006 |
| 8 | <code>gemini/gemini-3.1-flash-lite</code> | $0.0012 | 81.63 | 18.37% | 5.44% | 2.89s | $0.0012 |
| 9 | <code>gemini/gemini-3.1-flash-lite-preview</code> | $0.0012 | 86.73 | 13.27% | 3.33% | 2.84s | $0.0012 |
| 10 | <code>mistral/mistral-ocr-2512</code> | $0.0020 | 79.08 | 20.92% | 5.44% | 1.55s | $0.0020 |
| 11 | <code>replicate/datalab-to/ocr</code> | $0.0020 | 46.94 | 53.06% | 33.68% | 5.79s | $0.0020 |
| 12 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0021 | 65.82 | 34.18% | 10.35% | 2.21s | $0.0021 |
| 13 | <code>grok/grok-4.3</code> | $0.0022 | 79.59 | 20.41% | 6.49% | 12.91s | $0.0022 |
| 14 | <code>openai/gpt-5.4-mini</code> | $0.0023 | 70.41 | 29.59% | 12.11% | 2.99s | $0.0023 |
| 15 | <code>kimi/kimi-k2.6</code> | $0.0024 | 88.27 | 11.73% | 4.21% | 14.86s | $0.0024 |
| 16 | <code>replicate/lucataco/deepseek-ocr</code> | $0.0033 | 0.00 | 164.80% | 158.60% | 10.81s | $0.0033 |
| 17 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 83.67 | 16.33% | 6.49% | 2.71s | $0.0040 |
| 18 | <code>replicate/datalab-to/marker</code> | $0.0040 | 80.61 | 19.39% | 5.44% | 5.72s | $0.0040 |
| 19 | <code>anthropic/claude-haiku-4-5</code> | $0.0043 | 48.98 | 51.02% | 19.65% | 8.56s | $0.0043 |
| 20 | <code>anthropic/claude-sonnet-5</code> | $0.0070 | 82.14 | 17.86% | 5.79% | 8.73s | $0.0070 |
| 21 | <code>fal/fal-ai/florence-2-large/ocr</code> | $0.0076 | 51.02 | 48.98% | 24.21% | 5.26s | $0.0076 |
| 22 | <code>gemini/gemini-3.5-flash</code> | $0.0082 | 78.57 | 21.43% | 6.14% | 23.19s | $0.0082 |
| 23 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0106 | 85.20 | 14.80% | 4.91% | 6.41s | $0.0106 |
| 24 | <code>anthropic/claude-sonnet-4-6</code> | $0.0123 | 85.71 | 14.29% | 4.91% | 13.01s | $0.0123 |
| 25 | <code>anthropic/claude-opus-4-8</code> | $0.0195 | 84.69 | 15.31% | 5.61% | 9.52s | $0.0195 |
| 26 | <code>fal/fal-ai/got-ocr/v2</code> | $0.0500 | 0.00 | 558.67% | 497.72% | 95.84s | $0.0500 |
| 27 | <code>openai/gpt-5.5</code> | $0.0709 | 74.49 | 25.51% | 9.47% | 20.89s | $0.0709 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-2512</code> | 1.55s | 79.08 | 20.92% | 5.44% | 1.55s | $0.0020 |
| 2 | <code>grok/grok-4.20-0309-non-reasoning</code> | 2.21s | 65.82 | 34.18% | 10.35% | 2.21s | $0.0021 |
| 3 | <code>mistral/mistral-ocr-4-0</code> | 2.71s | 83.67 | 16.33% | 6.49% | 2.71s | $0.0040 |
| 4 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 2.84s | 86.73 | 13.27% | 3.33% | 2.84s | $0.0012 |
| 5 | <code>gemini/gemini-3.1-flash-lite</code> | 2.89s | 81.63 | 18.37% | 5.44% | 2.89s | $0.0012 |
| 6 | <code>openai/gpt-5.4-mini</code> | 2.99s | 70.41 | 29.59% | 12.11% | 2.99s | $0.0023 |
| 7 | <code>openai/gpt-5.4-nano</code> | 3.26s | 43.37 | 56.63% | 25.79% | 3.26s | $0.0006 |
| 8 | <code>glm/glm-ocr</code> | 4.37s | 0.00 | 222.45% | 219.30% | 4.37s | $0.0001 |
| 9 | <code>fal/fal-ai/florence-2-large/ocr</code> | 5.26s | 51.02 | 48.98% | 24.21% | 5.26s | $0.0076 |
| 10 | <code>replicate/datalab-to/marker</code> | 5.72s | 80.61 | 19.39% | 5.44% | 5.72s | $0.0040 |
| 11 | <code>replicate/datalab-to/ocr</code> | 5.79s | 46.94 | 53.06% | 33.68% | 5.79s | $0.0020 |
| 12 | <code>gemini/gemini-3.1-pro-preview</code> | 6.41s | 85.20 | 14.80% | 4.91% | 6.41s | $0.0106 |
| 13 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 7.09s | 55.61 | 44.39% | 15.96% | 7.09s | $0.0002 |
| 14 | <code>anthropic/claude-haiku-4-5</code> | 8.56s | 48.98 | 51.02% | 19.65% | 8.56s | $0.0043 |
| 15 | <code>anthropic/claude-sonnet-5</code> | 8.73s | 82.14 | 17.86% | 5.79% | 8.73s | $0.0070 |
| 16 | <code>anthropic/claude-opus-4-8</code> | 9.52s | 84.69 | 15.31% | 5.61% | 9.52s | $0.0195 |
| 17 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 10.08s | 70.92 | 29.08% | 15.44% | 10.08s | $0.0003 |
| 18 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 10.36s | 78.57 | 21.43% | 7.19% | 10.36s | $0.0004 |
| 19 | <code>replicate/lucataco/deepseek-ocr</code> | 10.81s | 0.00 | 164.80% | 158.60% | 10.81s | $0.0033 |
| 20 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 12.18s | 76.53 | 23.47% | 7.37% | 12.18s | $0.0006 |
| 21 | <code>grok/grok-4.3</code> | 12.91s | 79.59 | 20.41% | 6.49% | 12.91s | $0.0022 |
| 22 | <code>anthropic/claude-sonnet-4-6</code> | 13.01s | 85.71 | 14.29% | 4.91% | 13.01s | $0.0123 |
| 23 | <code>kimi/kimi-k2.6</code> | 14.86s | 88.27 | 11.73% | 4.21% | 14.86s | $0.0024 |
| 24 | <code>openai/gpt-5.5</code> | 20.89s | 74.49 | 25.51% | 9.47% | 20.89s | $0.0709 |
| 25 | <code>gemini/gemini-3.5-flash</code> | 23.19s | 78.57 | 21.43% | 6.14% | 23.19s | $0.0082 |
| 26 | <code>deepinfra/google/gemma-3-27b-it</code> | 29.26s | 31.63 | 68.37% | 47.89% | 29.26s | $0.0001 |
| 27 | <code>fal/fal-ai/got-ocr/v2</code> | 95.84s | 0.00 | 558.67% | 497.72% | 95.84s | $0.0500 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>kimi/kimi-k2.6</code> | 88.27/100 quality score | 88.27 | 11.73% | 4.21% | 14.86s | $0.0024 |
| 2 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 86.73/100 quality score | 86.73 | 13.27% | 3.33% | 2.84s | $0.0012 |
| 3 | <code>anthropic/claude-sonnet-4-6</code> | 85.71/100 quality score | 85.71 | 14.29% | 4.91% | 13.01s | $0.0123 |
| 4 | <code>gemini/gemini-3.1-pro-preview</code> | 85.20/100 quality score | 85.20 | 14.80% | 4.91% | 6.41s | $0.0106 |
| 5 | <code>anthropic/claude-opus-4-8</code> | 84.69/100 quality score | 84.69 | 15.31% | 5.61% | 9.52s | $0.0195 |
| 6 | <code>mistral/mistral-ocr-4-0</code> | 83.67/100 quality score | 83.67 | 16.33% | 6.49% | 2.71s | $0.0040 |
| 7 | <code>anthropic/claude-sonnet-5</code> | 82.14/100 quality score | 82.14 | 17.86% | 5.79% | 8.73s | $0.0070 |
| 8 | <code>gemini/gemini-3.1-flash-lite</code> | 81.63/100 quality score | 81.63 | 18.37% | 5.44% | 2.89s | $0.0012 |
| 9 | <code>replicate/datalab-to/marker</code> | 80.61/100 quality score | 80.61 | 19.39% | 5.44% | 5.72s | $0.0040 |
| 10 | <code>grok/grok-4.3</code> | 79.59/100 quality score | 79.59 | 20.41% | 6.49% | 12.91s | $0.0022 |
| 11 | <code>mistral/mistral-ocr-2512</code> | 79.08/100 quality score | 79.08 | 20.92% | 5.44% | 1.55s | $0.0020 |
| 12 | <code>gemini/gemini-3.5-flash</code> | 78.57/100 quality score | 78.57 | 21.43% | 6.14% | 23.19s | $0.0082 |
| 13 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 78.57/100 quality score | 78.57 | 21.43% | 7.19% | 10.36s | $0.0004 |
| 14 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 76.53/100 quality score | 76.53 | 23.47% | 7.37% | 12.18s | $0.0006 |
| 15 | <code>openai/gpt-5.5</code> | 74.49/100 quality score | 74.49 | 25.51% | 9.47% | 20.89s | $0.0709 |
| 16 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 70.92/100 quality score | 70.92 | 29.08% | 15.44% | 10.08s | $0.0003 |
| 17 | <code>openai/gpt-5.4-mini</code> | 70.41/100 quality score | 70.41 | 29.59% | 12.11% | 2.99s | $0.0023 |
| 18 | <code>grok/grok-4.20-0309-non-reasoning</code> | 65.82/100 quality score | 65.82 | 34.18% | 10.35% | 2.21s | $0.0021 |
| 19 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 55.61/100 quality score | 55.61 | 44.39% | 15.96% | 7.09s | $0.0002 |
| 20 | <code>fal/fal-ai/florence-2-large/ocr</code> | 51.02/100 quality score | 51.02 | 48.98% | 24.21% | 5.26s | $0.0076 |
| 21 | <code>anthropic/claude-haiku-4-5</code> | 48.98/100 quality score | 48.98 | 51.02% | 19.65% | 8.56s | $0.0043 |
| 22 | <code>replicate/datalab-to/ocr</code> | 46.94/100 quality score | 46.94 | 53.06% | 33.68% | 5.79s | $0.0020 |
| 23 | <code>openai/gpt-5.4-nano</code> | 43.37/100 quality score | 43.37 | 56.63% | 25.79% | 3.26s | $0.0006 |
| 24 | <code>deepinfra/google/gemma-3-27b-it</code> | 31.63/100 quality score | 31.63 | 68.37% | 47.89% | 29.26s | $0.0001 |
| 25 | <code>replicate/lucataco/deepseek-ocr</code> | 0.00/100 quality score | 0.00 | 164.80% | 158.60% | 10.81s | $0.0033 |
| 26 | <code>glm/glm-ocr</code> | 0.00/100 quality score | 0.00 | 222.45% | 219.30% | 4.37s | $0.0001 |
| 27 | <code>fal/fal-ai/got-ocr/v2</code> | 0.00/100 quality score | 0.00 | 558.67% | 497.72% | 95.84s | $0.0500 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | Local | 11.73 | 88.27% | 58.07% | 1.57s | $0.00 |
| <code>paddle-ocr</code> | Local | 41.33 | 58.67% | 32.63% | 10.98s | $0.00 |
| <code>tesseract</code> | Local | 9.69 | 90.31% | 85.61% | 0.26s | $0.00 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 48.98 | 51.02% | 19.65% | 8.56s | $0.0043 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 84.69 | 15.31% | 5.61% | 9.52s | $0.0195 |
| <code>anthropic/claude-sonnet-4-6</code> | Third-Party Service | 85.71 | 14.29% | 4.91% | 13.01s | $0.0123 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 82.14 | 17.86% | 5.79% | 8.73s | $0.0070 |
| <code>deepinfra/google/gemma-3-27b-it</code> | Third-Party Service | 31.63 | 68.37% | 47.89% | 29.26s | $0.0001 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | Third-Party Service | 70.92 | 29.08% | 15.44% | 10.08s | $0.0003 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service | 55.61 | 44.39% | 15.96% | 7.09s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 76.53 | 23.47% | 7.37% | 12.18s | $0.0006 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 78.57 | 21.43% | 7.19% | 10.36s | $0.0004 |
| <code>fal/fal-ai/florence-2-large/ocr</code> | Third-Party Service | 51.02 | 48.98% | 24.21% | 5.26s | $0.0076 |
| <code>fal/fal-ai/got-ocr/v2</code> | Third-Party Service | 0.00 | 558.67% | 497.72% | 95.84s | $0.0500 |
| <code>gemini/gemini-3.1-flash-lite</code> | Third-Party Service | 81.63 | 18.37% | 5.44% | 2.89s | $0.0012 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | Third-Party Service | 86.73 | 13.27% | 3.33% | 2.84s | $0.0012 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 85.20 | 14.80% | 4.91% | 6.41s | $0.0106 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 78.57 | 21.43% | 6.14% | 23.19s | $0.0082 |
| <code>glm/glm-ocr</code> | Third-Party Service | 0.00 | 222.45% | 219.30% | 4.37s | $0.0001 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 65.82 | 34.18% | 10.35% | 2.21s | $0.0021 |
| <code>grok/grok-4.3</code> | Third-Party Service | 79.59 | 20.41% | 6.49% | 12.91s | $0.0022 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 88.27 | 11.73% | 4.21% | 14.86s | $0.0024 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 79.08 | 20.92% | 5.44% | 1.55s | $0.0020 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 83.67 | 16.33% | 6.49% | 2.71s | $0.0040 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 70.41 | 29.59% | 12.11% | 2.99s | $0.0023 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 43.37 | 56.63% | 25.79% | 3.26s | $0.0006 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 74.49 | 25.51% | 9.47% | 20.89s | $0.0709 |
| <code>replicate/datalab-to/marker</code> | Third-Party Service | 80.61 | 19.39% | 5.44% | 5.72s | $0.0040 |
| <code>replicate/datalab-to/ocr</code> | Third-Party Service | 46.94 | 53.06% | 33.68% | 5.79s | $0.0020 |
| <code>replicate/lucataco/deepseek-ocr</code> | Third-Party Service | 0.00 | 164.80% | 158.60% | 10.81s | $0.0033 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | 112 | 61 | 0 | 196 |
| <code>paddle-ocr</code> | 66 | 41 | 8 | 196 |
| <code>tesseract</code> | 13 | 164 | 0 | 196 |
| <code>anthropic/claude-haiku-4-5</code> | 79 | 9 | 12 | 196 |
| <code>anthropic/claude-opus-4-8</code> | 21 | 2 | 7 | 196 |
| <code>anthropic/claude-sonnet-4-6</code> | 21 | 3 | 4 | 196 |
| <code>anthropic/claude-sonnet-5</code> | 27 | 2 | 6 | 196 |
| <code>deepinfra/google/gemma-3-27b-it</code> | 81 | 50 | 3 | 196 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 40 | 11 | 6 | 196 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 59 | 4 | 24 | 196 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 35 | 3 | 8 | 196 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 36 | 2 | 4 | 196 |
| <code>fal/fal-ai/florence-2-large/ocr</code> | 68 | 17 | 11 | 196 |
| <code>fal/fal-ai/got-ocr/v2</code> | 122 | 0 | 973 | 196 |
| <code>gemini/gemini-3.1-flash-lite</code> | 23 | 3 | 10 | 196 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | 16 | 2 | 8 | 196 |
| <code>gemini/gemini-3.1-pro-preview</code> | 19 | 6 | 4 | 196 |
| <code>gemini/gemini-3.5-flash</code> | 24 | 1 | 17 | 196 |
| <code>glm/glm-ocr</code> | 36 | 0 | 400 | 196 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 45 | 0 | 22 | 196 |
| <code>grok/grok-4.3</code> | 31 | 4 | 5 | 196 |
| <code>kimi/kimi-k2.6</code> | 18 | 2 | 3 | 196 |
| <code>mistral/mistral-ocr-2512</code> | 27 | 0 | 14 | 196 |
| <code>mistral/mistral-ocr-4-0</code> | 20 | 1 | 11 | 196 |
| <code>openai/gpt-5.4-mini</code> | 47 | 8 | 3 | 196 |
| <code>openai/gpt-5.4-nano</code> | 84 | 19 | 8 | 196 |
| <code>openai/gpt-5.5</code> | 42 | 1 | 7 | 196 |
| <code>replicate/datalab-to/marker</code> | 28 | 0 | 10 | 196 |
| <code>replicate/datalab-to/ocr</code> | 62 | 37 | 5 | 196 |
| <code>replicate/lucataco/deepseek-ocr</code> | 39 | 0 | 284 | 196 |

## Notes

- Best local model: `paddle-ocr/paddle-ocr` scored 41.33/100.
- Best cloud service: `kimi/kimi-k2.6` scored 88.27/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0064¢ ($0.0001).
- Fastest local model: `tesseract/tesseract` at 0.26s.
- Fastest cloud service: `mistral/mistral-ocr-2512` at 1.55s.
