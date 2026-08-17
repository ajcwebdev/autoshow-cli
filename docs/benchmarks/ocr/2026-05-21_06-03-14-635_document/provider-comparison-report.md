# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-05-21_06-03-14-635_document`
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

| Rank | Provider                |                     Value | Score / 100 |   WER |   CER | Processing Time | Actual Cost |
| ---: | ----------------------- | ------------------------: | ----------: | ----: | ----: | --------------: | ----------: |
|    1 | <code>ocrmypdf</code>   | $0.00 local monetary cost |       91.57 | 8.43% | 7.10% |          10.36s |       $0.00 |
|    2 | <code>paddle-ocr</code> | $0.00 local monetary cost |      100.00 | 0.00% | 0.00% |           0.00s |       $0.00 |
|    3 | <code>tesseract</code>  | $0.00 local monetary cost |      100.00 | 0.00% | 0.00% |           0.05s |       $0.00 |

#### Speed

| Rank | Provider                |  Value | Score / 100 |   WER |   CER | Processing Time | Actual Cost |
| ---: | ----------------------- | -----: | ----------: | ----: | ----: | --------------: | ----------: |
|    1 | <code>paddle-ocr</code> |  0.00s |      100.00 | 0.00% | 0.00% |           0.00s |       $0.00 |
|    2 | <code>tesseract</code>  |  0.05s |      100.00 | 0.00% | 0.00% |           0.05s |       $0.00 |
|    3 | <code>ocrmypdf</code>   | 10.36s |       91.57 | 8.43% | 7.10% |          10.36s |       $0.00 |

#### Quality Score

| Rank | Provider                |                    Value | Score / 100 |   WER |   CER | Processing Time | Actual Cost |
| ---: | ----------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | ----------: |
|    1 | <code>paddle-ocr</code> | 100.00/100 quality score |      100.00 | 0.00% | 0.00% |           0.00s |       $0.00 |
|    2 | <code>tesseract</code>  | 100.00/100 quality score |      100.00 | 0.00% | 0.00% |           0.05s |       $0.00 |
|    3 | <code>ocrmypdf</code>   |  91.57/100 quality score |       91.57 | 8.43% | 7.10% |          10.36s |       $0.00 |

### Third-Party Service

#### Price

| Rank | Provider                                                             |   Value | Score / 100 |    WER |     CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------------------------------- | ------: | ----------: | -----: | ------: | --------------: | ----------: |
|    1 | <code>deepinfra/google/gemma-3-27b-it</code>                         | $0.0009 |       63.57 | 36.43% |  85.96% |          48.25s |     $0.0009 |
|    2 | <code>glm/glm-ocr</code>                                             | $0.0012 |       95.13 |  4.87% |   4.90% |          12.63s |     $0.0012 |
|    3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0026 |       63.64 | 36.36% |  96.39% |           0.02s |     $0.0026 |
|    4 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     | $0.0033 |       55.18 | 44.82% |  75.77% |          13.70s |     $0.0033 |
|    5 | <code>openai/gpt-5.4-nano</code>                                     | $0.0055 |       99.54 |  0.46% |   0.50% |          29.43s |     $0.0055 |
|    6 | <code>gemini/gemini-3.1-flash-lite-preview</code>                    | $0.0081 |      100.00 |  0.00% |   0.00% |          12.56s |     $0.0081 |
|    7 | <code>gemini/gemini-3.1-flash-lite</code>                            | $0.0081 |       67.07 | 32.93% |  94.26% |          13.38s |     $0.0081 |
|    8 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                | $0.0146 |       96.67 |  3.33% |   3.02% |         147.66s |     $0.0146 |
|    9 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              | $0.0198 |       97.19 |  2.81% |   2.98% |         114.39s |     $0.0198 |
|   10 | <code>openai/gpt-5.4-mini</code>                                     | $0.0200 |       67.00 | 33.00% |  94.07% |          14.21s |     $0.0200 |
|   11 | <code>mistral/mistral-ocr-2512</code>                                | $0.0200 |       96.62 |  3.38% |   3.48% |           2.53s |     $0.0200 |
|   12 | <code>replicate/datalab-to/ocr</code>                                | $0.0200 |       64.02 | 35.98% |  95.05% |           8.28s |     $0.0200 |
|   13 | <code>replicate/lucataco/deepseek-ocr</code>                         | $0.0330 |        6.02 | 93.98% | 125.72% |          96.30s |     $0.0330 |
|   14 | <code>mistral/mistral-ocr-4-0</code>                                 | $0.0400 |       66.69 | 33.31% |  94.59% |           2.37s |     $0.0400 |
|   15 | <code>replicate/datalab-to/marker</code>                             | $0.0400 |       65.24 | 34.76% |  92.33% |           7.86s |     $0.0400 |
|   16 | <code>grok/grok-4.3</code>                                           | $0.0405 |       97.42 |  2.58% |   2.81% |         112.03s |     $0.0405 |
|   17 | <code>grok/grok-4.20-0309-non-reasoning</code>                       | $0.0405 |       63.72 | 36.28% |  91.85% |           2.60s |     $0.0405 |
|   18 | <code>anthropic/claude-haiku-4-5</code>                              | $0.0426 |       60.75 | 39.25% |  90.57% |          38.44s |     $0.0426 |
|   19 | <code>gemini/gemini-3.5-flash</code>                                 | $0.0473 |       67.07 | 32.93% |  94.26% |          41.94s |     $0.0473 |
|   20 | <code>kimi/kimi-k2.6</code>                                          | $0.0535 |      100.00 |  0.00% |   0.00% |         167.25s |     $0.0535 |
|   21 | <code>gemini/gemini-3.1-pro-preview</code>                           | $0.0628 |      100.00 |  0.00% |   0.00% |          68.14s |     $0.0628 |
|   22 | <code>fal/fal-ai/florence-2-large/ocr</code>                         | $0.0755 |       48.25 | 51.75% |  98.49% |          41.01s |     $0.0755 |
|   23 | <code>anthropic/claude-sonnet-5</code>                               | $0.1011 |       12.04 | 87.96% |  66.39% |          60.67s |     $0.1011 |
|   24 | <code>anthropic/claude-sonnet-4-6</code>                             | $0.1351 |      100.00 |  0.00% |   0.00% |          86.12s |     $0.1351 |
|   25 | <code>openai/gpt-5.5</code>                                          | $0.1376 |      100.00 |  0.00% |   0.00% |          29.32s |     $0.1376 |
|   26 | <code>anthropic/claude-opus-4-8</code>                               | $0.2663 |       67.07 | 32.93% |  94.26% |          59.71s |     $0.2663 |

#### Speed

| Rank | Provider                                                             |   Value | Score / 100 |    WER |     CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------------------------------- | ------: | ----------: | -----: | ------: | --------------: | ----------: |
|    1 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> |   0.02s |       63.64 | 36.36% |  96.39% |           0.02s |     $0.0026 |
|    2 | <code>mistral/mistral-ocr-4-0</code>                                 |   2.37s |       66.69 | 33.31% |  94.59% |           2.37s |     $0.0400 |
|    3 | <code>mistral/mistral-ocr-2512</code>                                |   2.53s |       96.62 |  3.38% |   3.48% |           2.53s |     $0.0200 |
|    4 | <code>grok/grok-4.20-0309-non-reasoning</code>                       |   2.60s |       63.72 | 36.28% |  91.85% |           2.60s |     $0.0405 |
|    5 | <code>replicate/datalab-to/marker</code>                             |   7.86s |       65.24 | 34.76% |  92.33% |           7.86s |     $0.0400 |
|    6 | <code>replicate/datalab-to/ocr</code>                                |   8.28s |       64.02 | 35.98% |  95.05% |           8.28s |     $0.0200 |
|    7 | <code>gemini/gemini-3.1-flash-lite-preview</code>                    |  12.56s |      100.00 |  0.00% |   0.00% |          12.56s |     $0.0081 |
|    8 | <code>glm/glm-ocr</code>                                             |  12.63s |       95.13 |  4.87% |   4.90% |          12.63s |     $0.0012 |
|    9 | <code>gemini/gemini-3.1-flash-lite</code>                            |  13.38s |       67.07 | 32.93% |  94.26% |          13.38s |     $0.0081 |
|   10 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     |  13.70s |       55.18 | 44.82% |  75.77% |          13.70s |     $0.0033 |
|   11 | <code>openai/gpt-5.4-mini</code>                                     |  14.21s |       67.00 | 33.00% |  94.07% |          14.21s |     $0.0200 |
|   12 | <code>openai/gpt-5.5</code>                                          |  29.32s |      100.00 |  0.00% |   0.00% |          29.32s |     $0.1376 |
|   13 | <code>openai/gpt-5.4-nano</code>                                     |  29.43s |       99.54 |  0.46% |   0.50% |          29.43s |     $0.0055 |
|   14 | <code>anthropic/claude-haiku-4-5</code>                              |  38.44s |       60.75 | 39.25% |  90.57% |          38.44s |     $0.0426 |
|   15 | <code>fal/fal-ai/florence-2-large/ocr</code>                         |  41.01s |       48.25 | 51.75% |  98.49% |          41.01s |     $0.0755 |
|   16 | <code>gemini/gemini-3.5-flash</code>                                 |  41.94s |       67.07 | 32.93% |  94.26% |          41.94s |     $0.0473 |
|   17 | <code>deepinfra/google/gemma-3-27b-it</code>                         |  48.25s |       63.57 | 36.43% |  85.96% |          48.25s |     $0.0009 |
|   18 | <code>anthropic/claude-opus-4-8</code>                               |  59.71s |       67.07 | 32.93% |  94.26% |          59.71s |     $0.2663 |
|   19 | <code>anthropic/claude-sonnet-5</code>                               |  60.67s |       12.04 | 87.96% |  66.39% |          60.67s |     $0.1011 |
|   20 | <code>gemini/gemini-3.1-pro-preview</code>                           |  68.14s |      100.00 |  0.00% |   0.00% |          68.14s |     $0.0628 |
|   21 | <code>anthropic/claude-sonnet-4-6</code>                             |  86.12s |      100.00 |  0.00% |   0.00% |          86.12s |     $0.1351 |
|   22 | <code>replicate/lucataco/deepseek-ocr</code>                         |  96.30s |        6.02 | 93.98% | 125.72% |          96.30s |     $0.0330 |
|   23 | <code>grok/grok-4.3</code>                                           | 112.03s |       97.42 |  2.58% |   2.81% |         112.03s |     $0.0405 |
|   24 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              | 114.39s |       97.19 |  2.81% |   2.98% |         114.39s |     $0.0198 |
|   25 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                | 147.66s |       96.67 |  3.33% |   3.02% |         147.66s |     $0.0146 |
|   26 | <code>kimi/kimi-k2.6</code>                                          | 167.25s |      100.00 |  0.00% |   0.00% |         167.25s |     $0.0535 |

#### Quality Score

| Rank | Provider                                                             |                    Value | Score / 100 |    WER |     CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------------------------------- | -----------------------: | ----------: | -----: | ------: | --------------: | ----------: |
|    1 | <code>anthropic/claude-sonnet-4-6</code>                             | 100.00/100 quality score |      100.00 |  0.00% |   0.00% |          86.12s |     $0.1351 |
|    2 | <code>gemini/gemini-3.1-flash-lite-preview</code>                    | 100.00/100 quality score |      100.00 |  0.00% |   0.00% |          12.56s |     $0.0081 |
|    3 | <code>gemini/gemini-3.1-pro-preview</code>                           | 100.00/100 quality score |      100.00 |  0.00% |   0.00% |          68.14s |     $0.0628 |
|    4 | <code>kimi/kimi-k2.6</code>                                          | 100.00/100 quality score |      100.00 |  0.00% |   0.00% |         167.25s |     $0.0535 |
|    5 | <code>openai/gpt-5.5</code>                                          | 100.00/100 quality score |      100.00 |  0.00% |   0.00% |          29.32s |     $0.1376 |
|    6 | <code>openai/gpt-5.4-nano</code>                                     |  99.54/100 quality score |       99.54 |  0.46% |   0.50% |          29.43s |     $0.0055 |
|    7 | <code>grok/grok-4.3</code>                                           |  97.42/100 quality score |       97.42 |  2.58% |   2.81% |         112.03s |     $0.0405 |
|    8 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              |  97.19/100 quality score |       97.19 |  2.81% |   2.98% |         114.39s |     $0.0198 |
|    9 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                |  96.67/100 quality score |       96.67 |  3.33% |   3.02% |         147.66s |     $0.0146 |
|   10 | <code>mistral/mistral-ocr-2512</code>                                |  96.62/100 quality score |       96.62 |  3.38% |   3.48% |           2.53s |     $0.0200 |
|   11 | <code>glm/glm-ocr</code>                                             |  95.13/100 quality score |       95.13 |  4.87% |   4.90% |          12.63s |     $0.0012 |
|   12 | <code>anthropic/claude-opus-4-8</code>                               |  67.07/100 quality score |       67.07 | 32.93% |  94.26% |          59.71s |     $0.2663 |
|   13 | <code>gemini/gemini-3.1-flash-lite</code>                            |  67.07/100 quality score |       67.07 | 32.93% |  94.26% |          13.38s |     $0.0081 |
|   14 | <code>gemini/gemini-3.5-flash</code>                                 |  67.07/100 quality score |       67.07 | 32.93% |  94.26% |          41.94s |     $0.0473 |
|   15 | <code>openai/gpt-5.4-mini</code>                                     |  67.00/100 quality score |       67.00 | 33.00% |  94.07% |          14.21s |     $0.0200 |
|   16 | <code>mistral/mistral-ocr-4-0</code>                                 |  66.69/100 quality score |       66.69 | 33.31% |  94.59% |           2.37s |     $0.0400 |
|   17 | <code>replicate/datalab-to/marker</code>                             |  65.24/100 quality score |       65.24 | 34.76% |  92.33% |           7.86s |     $0.0400 |
|   18 | <code>replicate/datalab-to/ocr</code>                                |  64.02/100 quality score |       64.02 | 35.98% |  95.05% |           8.28s |     $0.0200 |
|   19 | <code>grok/grok-4.20-0309-non-reasoning</code>                       |  63.72/100 quality score |       63.72 | 36.28% |  91.85% |           2.60s |     $0.0405 |
|   20 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> |  63.64/100 quality score |       63.64 | 36.36% |  96.39% |           0.02s |     $0.0026 |
|   21 | <code>deepinfra/google/gemma-3-27b-it</code>                         |  63.57/100 quality score |       63.57 | 36.43% |  85.96% |          48.25s |     $0.0009 |
|   22 | <code>anthropic/claude-haiku-4-5</code>                              |  60.75/100 quality score |       60.75 | 39.25% |  90.57% |          38.44s |     $0.0426 |
|   23 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     |  55.18/100 quality score |       55.18 | 44.82% |  75.77% |          13.70s |     $0.0033 |
|   24 | <code>fal/fal-ai/florence-2-large/ocr</code>                         |  48.25/100 quality score |       48.25 | 51.75% |  98.49% |          41.01s |     $0.0755 |
|   25 | <code>anthropic/claude-sonnet-5</code>                               |  12.04/100 quality score |       12.04 | 87.96% |  66.39% |          60.67s |     $0.1011 |
|   26 | <code>replicate/lucataco/deepseek-ocr</code>                         |   6.02/100 quality score |        6.02 | 93.98% | 125.72% |          96.30s |     $0.0330 |


## Provider Detail

| Provider                                                             | Group               | Score / 100 |    WER |     CER | Processing Time | Actual Cost |
| -------------------------------------------------------------------- | ------------------- | ----------: | -----: | ------: | --------------: | ----------: |
| <code>ocrmypdf</code>                                                | Local               |       91.57 |  8.43% |   7.10% |          10.36s |       $0.00 |
| <code>paddle-ocr</code>                                              | Local               |      100.00 |  0.00% |   0.00% |           0.00s |       $0.00 |
| <code>tesseract</code>                                               | Local               |      100.00 |  0.00% |   0.00% |           0.05s |       $0.00 |
| <code>anthropic/claude-haiku-4-5</code>                              | Third-Party Service |       60.75 | 39.25% |  90.57% |          38.44s |     $0.0426 |
| <code>anthropic/claude-opus-4-8</code>                               | Third-Party Service |       67.07 | 32.93% |  94.26% |          59.71s |     $0.2663 |
| <code>anthropic/claude-sonnet-4-6</code>                             | Third-Party Service |      100.00 |  0.00% |   0.00% |          86.12s |     $0.1351 |
| <code>anthropic/claude-sonnet-5</code>                               | Third-Party Service |       12.04 | 87.96% |  66.39% |          60.67s |     $0.1011 |
| <code>deepinfra/google/gemma-3-27b-it</code>                         | Third-Party Service |       63.57 | 36.43% |  85.96% |          48.25s |     $0.0009 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     | Third-Party Service |       55.18 | 44.82% |  75.77% |          13.70s |     $0.0033 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service |       63.64 | 36.36% |  96.39% |           0.02s |     $0.0026 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              | Third-Party Service |       97.19 |  2.81% |   2.98% |         114.39s |     $0.0198 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                | Third-Party Service |       96.67 |  3.33% |   3.02% |         147.66s |     $0.0146 |
| <code>fal/fal-ai/florence-2-large/ocr</code>                         | Third-Party Service |       48.25 | 51.75% |  98.49% |          41.01s |     $0.0755 |
| <code>gemini/gemini-3.1-flash-lite</code>                            | Third-Party Service |       67.07 | 32.93% |  94.26% |          13.38s |     $0.0081 |
| <code>gemini/gemini-3.1-flash-lite-preview</code>                    | Third-Party Service |      100.00 |  0.00% |   0.00% |          12.56s |     $0.0081 |
| <code>gemini/gemini-3.1-pro-preview</code>                           | Third-Party Service |      100.00 |  0.00% |   0.00% |          68.14s |     $0.0628 |
| <code>gemini/gemini-3.5-flash</code>                                 | Third-Party Service |       67.07 | 32.93% |  94.26% |          41.94s |     $0.0473 |
| <code>glm/glm-ocr</code>                                             | Third-Party Service |       95.13 |  4.87% |   4.90% |          12.63s |     $0.0012 |
| <code>grok/grok-4.20-0309-non-reasoning</code>                       | Third-Party Service |       63.72 | 36.28% |  91.85% |           2.60s |     $0.0405 |
| <code>grok/grok-4.3</code>                                           | Third-Party Service |       97.42 |  2.58% |   2.81% |         112.03s |     $0.0405 |
| <code>kimi/kimi-k2.6</code>                                          | Third-Party Service |      100.00 |  0.00% |   0.00% |         167.25s |     $0.0535 |
| <code>mistral/mistral-ocr-2512</code>                                | Third-Party Service |       96.62 |  3.38% |   3.48% |           2.53s |     $0.0200 |
| <code>mistral/mistral-ocr-4-0</code>                                 | Third-Party Service |       66.69 | 33.31% |  94.59% |           2.37s |     $0.0400 |
| <code>openai/gpt-5.4-mini</code>                                     | Third-Party Service |       67.00 | 33.00% |  94.07% |          14.21s |     $0.0200 |
| <code>openai/gpt-5.4-nano</code>                                     | Third-Party Service |       99.54 |  0.46% |   0.50% |          29.43s |     $0.0055 |
| <code>openai/gpt-5.5</code>                                          | Third-Party Service |      100.00 |  0.00% |   0.00% |          29.32s |     $0.1376 |
| <code>replicate/datalab-to/marker</code>                             | Third-Party Service |       65.24 | 34.76% |  92.33% |           7.86s |     $0.0400 |
| <code>replicate/datalab-to/ocr</code>                                | Third-Party Service |       64.02 | 35.98% |  95.05% |           8.28s |     $0.0200 |
| <code>replicate/lucataco/deepseek-ocr</code>                         | Third-Party Service |        6.02 | 93.98% | 125.72% |          96.30s |     $0.0330 |

## Error Breakdown (WER)

| Provider                                                             | Substitutions | Deletions | Insertions | Ref. Words |
| -------------------------------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>ocrmypdf</code>                                                |            92 |        32 |         23 |       1744 |
| <code>paddle-ocr</code>                                              |             0 |         0 |          0 |       1744 |
| <code>tesseract</code>                                               |             0 |         0 |          0 |       1744 |
| <code>anthropic/claude-haiku-4-5</code>                              |            29 |        70 |        416 |       1312 |
| <code>anthropic/claude-opus-4-8</code>                               |             0 |         0 |        432 |       1312 |
| <code>anthropic/claude-sonnet-4-6</code>                             |             0 |         0 |          0 |       1744 |
| <code>anthropic/claude-sonnet-5</code>                               |           872 |       199 |         83 |       1312 |
| <code>deepinfra/google/gemma-3-27b-it</code>                         |            60 |        20 |        398 |       1312 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     |            25 |       189 |        374 |       1312 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> |            23 |        17 |        437 |       1312 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              |             1 |        48 |          0 |       1744 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                |            10 |        48 |          0 |       1744 |
| <code>fal/fal-ai/florence-2-large/ocr</code>                         |           142 |        18 |        519 |       1312 |
| <code>gemini/gemini-3.1-flash-lite</code>                            |             0 |         0 |        432 |       1312 |
| <code>gemini/gemini-3.1-flash-lite-preview</code>                    |             0 |         0 |          0 |       1744 |
| <code>gemini/gemini-3.1-pro-preview</code>                           |             0 |         0 |          0 |       1744 |
| <code>gemini/gemini-3.5-flash</code>                                 |             0 |         0 |        432 |       1312 |
| <code>glm/glm-ocr</code>                                             |             9 |        69 |          7 |       1744 |
| <code>grok/grok-4.20-0309-non-reasoning</code>                       |            31 |        35 |        410 |       1312 |
| <code>grok/grok-4.3</code>                                           |             1 |        44 |          0 |       1744 |
| <code>kimi/kimi-k2.6</code>                                          |             0 |         0 |          0 |       1744 |
| <code>mistral/mistral-ocr-2512</code>                                |             3 |         6 |         50 |       1744 |
| <code>mistral/mistral-ocr-4-0</code>                                 |             0 |         0 |        437 |       1312 |
| <code>openai/gpt-5.4-mini</code>                                     |             0 |         1 |        432 |       1312 |
| <code>openai/gpt-5.4-nano</code>                                     |             0 |         8 |          0 |       1744 |
| <code>openai/gpt-5.5</code>                                          |             0 |         0 |          0 |       1744 |
| <code>replicate/datalab-to/marker</code>                             |            18 |        39 |        399 |       1312 |
| <code>replicate/datalab-to/ocr</code>                                |            13 |         2 |        457 |       1312 |
| <code>replicate/lucataco/deepseek-ocr</code>                         |            50 |        11 |       1172 |       1312 |

## Notes

- Best local model: `paddle-ocr/paddle-ocr` scored 100.00/100.
- Best cloud service: `anthropic/claude-sonnet-4-6` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-3-27b-it` at 0.0894¢ ($0.0009).
- Fastest local model: `paddle-ocr/paddle-ocr` at 0.00s.
- Fastest cloud service: `deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506` at 0.02s.
