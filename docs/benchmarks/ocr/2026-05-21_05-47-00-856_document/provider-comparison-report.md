# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-05-21_05-47-00-856_document`
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

| Rank | Provider                |                     Value | Score / 100 |   WER |   CER | Processing Time | Actual Cost |
| ---: | ----------------------- | ------------------------: | ----------: | ----: | ----: | --------------: | ----------: |
|    1 | <code>ocrmypdf</code>   | $0.00 local monetary cost |       96.33 | 3.67% | 1.63% |          10.99s |       $0.00 |
|    2 | <code>paddle-ocr</code> | $0.00 local monetary cost |       92.21 | 7.79% | 1.52% |          87.01s |       $0.00 |
|    3 | <code>tesseract</code>  | $0.00 local monetary cost |       96.48 | 3.52% | 1.63% |           8.55s |       $0.00 |

#### Speed

| Rank | Provider                |  Value | Score / 100 |   WER |   CER | Processing Time | Actual Cost |
| ---: | ----------------------- | -----: | ----------: | ----: | ----: | --------------: | ----------: |
|    1 | <code>tesseract</code>  |  8.55s |       96.48 | 3.52% | 1.63% |           8.55s |       $0.00 |
|    2 | <code>ocrmypdf</code>   | 10.99s |       96.33 | 3.67% | 1.63% |          10.99s |       $0.00 |
|    3 | <code>paddle-ocr</code> | 87.01s |       92.21 | 7.79% | 1.52% |          87.01s |       $0.00 |

#### Quality Score

| Rank | Provider                |                   Value | Score / 100 |   WER |   CER | Processing Time | Actual Cost |
| ---: | ----------------------- | ----------------------: | ----------: | ----: | ----: | --------------: | ----------: |
|    1 | <code>tesseract</code>  | 96.48/100 quality score |       96.48 | 3.52% | 1.63% |           8.55s |       $0.00 |
|    2 | <code>ocrmypdf</code>   | 96.33/100 quality score |       96.33 | 3.67% | 1.63% |          10.99s |       $0.00 |
|    3 | <code>paddle-ocr</code> | 92.21/100 quality score |       92.21 | 7.79% | 1.52% |          87.01s |       $0.00 |

### Third-Party Service

#### Price

| Rank | Provider                                                             |   Value | Score / 100 |    WER |    CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------------------------------- | ------: | ----------: | -----: | -----: | --------------: | ----------: |
|    1 | <code>anthropic/claude-sonnet-4-6</code>                             |   $0.00 |       90.49 |  9.51% |  3.46% |         378.34s |       $0.00 |
|    2 | <code>glm/glm-ocr</code>                                             | $0.0003 |       98.58 |  1.42% |  1.36% |          23.37s |     $0.0003 |
|    3 | <code>deepinfra/google/gemma-3-27b-it</code>                         | $0.0004 |       95.13 |  4.87% |  3.20% |          47.78s |     $0.0004 |
|    4 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0010 |       99.33 |  0.67% |  0.58% |           0.02s |     $0.0010 |
|    5 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     | $0.0015 |       99.10 |  0.90% |  0.83% |          15.44s |     $0.0015 |
|    6 | <code>gemini/gemini-3.1-flash-lite</code>                            | $0.0031 |       99.03 |  0.97% |  0.71% |          11.42s |     $0.0031 |
|    7 | <code>gemini/gemini-3.1-flash-lite-preview</code>                    | $0.0032 |       99.18 |  0.82% |  0.70% |          11.95s |     $0.0032 |
|    8 | <code>openai/gpt-5.4-nano</code>                                     | $0.0048 |       96.63 |  3.37% |  0.80% |          19.17s |     $0.0048 |
|    9 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                | $0.0058 |       97.75 |  2.25% |  0.87% |          76.46s |     $0.0058 |
|   10 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              | $0.0079 |       99.40 |  0.60% |  0.06% |          42.59s |     $0.0079 |
|   11 | <code>mistral/mistral-ocr-2512</code>                                | $0.0080 |       99.85 |  0.15% |  0.19% |           7.52s |     $0.0080 |
|   12 | <code>replicate/datalab-to/ocr</code>                                | $0.0080 |       97.75 |  2.25% |  0.67% |          16.29s |     $0.0080 |
|   13 | <code>replicate/lucataco/deepseek-ocr</code>                         | $0.0132 |       94.38 |  5.62% |  4.19% |          38.46s |     $0.0132 |
|   14 | <code>openai/gpt-5.4-mini</code>                                     | $0.0142 |       57.83 | 42.17% | 41.19% |          34.81s |     $0.0142 |
|   15 | <code>mistral/mistral-ocr-4-0</code>                                 | $0.0160 |       99.85 |  0.15% |  0.01% |           6.96s |     $0.0160 |
|   16 | <code>replicate/datalab-to/marker</code>                             | $0.0160 |       97.83 |  2.17% |  2.65% |          15.38s |     $0.0160 |
|   17 | <code>anthropic/claude-haiku-4-5</code>                              | $0.0161 |       98.05 |  1.95% |  0.68% |          35.08s |     $0.0161 |
|   18 | <code>grok/grok-4.20-0309-non-reasoning</code>                       | $0.0170 |       97.53 |  2.47% |  1.04% |           3.67s |     $0.0170 |
|   19 | <code>grok/grok-4.3</code>                                           | $0.0170 |       99.18 |  0.82% |  0.22% |          64.29s |     $0.0170 |
|   20 | <code>gemini/gemini-3.5-flash</code>                                 | $0.0212 |       98.35 |  1.65% |  0.43% |          21.63s |     $0.0212 |
|   21 | <code>kimi/kimi-k2.6</code>                                          | $0.0230 |       99.10 |  0.90% |  0.49% |          47.28s |     $0.0230 |
|   22 | <code>gemini/gemini-3.1-pro-preview</code>                           | $0.0273 |       98.50 |  1.50% |  0.15% |          44.33s |     $0.0273 |
|   23 | <code>fal/fal-ai/florence-2-large/ocr</code>                         | $0.0302 |       76.33 | 23.67% | 16.58% |          17.43s |     $0.0302 |
|   24 | <code>anthropic/claude-sonnet-5</code>                               | $0.0373 |       99.55 |  0.45% |  0.44% |          36.26s |     $0.0373 |
|   25 | <code>anthropic/claude-opus-4-8</code>                               | $0.0944 |       99.85 |  0.15% |  0.01% |          50.81s |     $0.0944 |
|   26 | <code>openai/gpt-5.5</code>                                          | $0.1749 |       99.85 |  0.15% |  0.01% |          50.26s |     $0.1749 |
|   27 | <code>fal/fal-ai/got-ocr/v2</code>                                   | $0.2000 |       98.58 |  1.42% |  0.70% |          56.53s |     $0.2000 |

#### Speed

| Rank | Provider                                                             |   Value | Score / 100 |    WER |    CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------------------------------- | ------: | ----------: | -----: | -----: | --------------: | ----------: |
|    1 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> |   0.02s |       99.33 |  0.67% |  0.58% |           0.02s |     $0.0010 |
|    2 | <code>grok/grok-4.20-0309-non-reasoning</code>                       |   3.67s |       97.53 |  2.47% |  1.04% |           3.67s |     $0.0170 |
|    3 | <code>mistral/mistral-ocr-4-0</code>                                 |   6.96s |       99.85 |  0.15% |  0.01% |           6.96s |     $0.0160 |
|    4 | <code>mistral/mistral-ocr-2512</code>                                |   7.52s |       99.85 |  0.15% |  0.19% |           7.52s |     $0.0080 |
|    5 | <code>gemini/gemini-3.1-flash-lite</code>                            |  11.42s |       99.03 |  0.97% |  0.71% |          11.42s |     $0.0031 |
|    6 | <code>gemini/gemini-3.1-flash-lite-preview</code>                    |  11.95s |       99.18 |  0.82% |  0.70% |          11.95s |     $0.0032 |
|    7 | <code>replicate/datalab-to/marker</code>                             |  15.38s |       97.83 |  2.17% |  2.65% |          15.38s |     $0.0160 |
|    8 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     |  15.44s |       99.10 |  0.90% |  0.83% |          15.44s |     $0.0015 |
|    9 | <code>replicate/datalab-to/ocr</code>                                |  16.29s |       97.75 |  2.25% |  0.67% |          16.29s |     $0.0080 |
|   10 | <code>fal/fal-ai/florence-2-large/ocr</code>                         |  17.43s |       76.33 | 23.67% | 16.58% |          17.43s |     $0.0302 |
|   11 | <code>openai/gpt-5.4-nano</code>                                     |  19.17s |       96.63 |  3.37% |  0.80% |          19.17s |     $0.0048 |
|   12 | <code>gemini/gemini-3.5-flash</code>                                 |  21.63s |       98.35 |  1.65% |  0.43% |          21.63s |     $0.0212 |
|   13 | <code>glm/glm-ocr</code>                                             |  23.37s |       98.58 |  1.42% |  1.36% |          23.37s |     $0.0003 |
|   14 | <code>openai/gpt-5.4-mini</code>                                     |  34.81s |       57.83 | 42.17% | 41.19% |          34.81s |     $0.0142 |
|   15 | <code>anthropic/claude-haiku-4-5</code>                              |  35.08s |       98.05 |  1.95% |  0.68% |          35.08s |     $0.0161 |
|   16 | <code>anthropic/claude-sonnet-5</code>                               |  36.26s |       99.55 |  0.45% |  0.44% |          36.26s |     $0.0373 |
|   17 | <code>replicate/lucataco/deepseek-ocr</code>                         |  38.46s |       94.38 |  5.62% |  4.19% |          38.46s |     $0.0132 |
|   18 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              |  42.59s |       99.40 |  0.60% |  0.06% |          42.59s |     $0.0079 |
|   19 | <code>gemini/gemini-3.1-pro-preview</code>                           |  44.33s |       98.50 |  1.50% |  0.15% |          44.33s |     $0.0273 |
|   20 | <code>kimi/kimi-k2.6</code>                                          |  47.28s |       99.10 |  0.90% |  0.49% |          47.28s |     $0.0230 |
|   21 | <code>deepinfra/google/gemma-3-27b-it</code>                         |  47.78s |       95.13 |  4.87% |  3.20% |          47.78s |     $0.0004 |
|   22 | <code>openai/gpt-5.5</code>                                          |  50.26s |       99.85 |  0.15% |  0.01% |          50.26s |     $0.1749 |
|   23 | <code>anthropic/claude-opus-4-8</code>                               |  50.81s |       99.85 |  0.15% |  0.01% |          50.81s |     $0.0944 |
|   24 | <code>fal/fal-ai/got-ocr/v2</code>                                   |  56.53s |       98.58 |  1.42% |  0.70% |          56.53s |     $0.2000 |
|   25 | <code>grok/grok-4.3</code>                                           |  64.29s |       99.18 |  0.82% |  0.22% |          64.29s |     $0.0170 |
|   26 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                |  76.46s |       97.75 |  2.25% |  0.87% |          76.46s |     $0.0058 |
|   27 | <code>anthropic/claude-sonnet-4-6</code>                             | 378.34s |       90.49 |  9.51% |  3.46% |         378.34s |       $0.00 |

#### Quality Score

| Rank | Provider                                                             |                   Value | Score / 100 |    WER |    CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------------------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | ----------: |
|    1 | <code>anthropic/claude-opus-4-8</code>                               | 99.85/100 quality score |       99.85 |  0.15% |  0.01% |          50.81s |     $0.0944 |
|    2 | <code>mistral/mistral-ocr-4-0</code>                                 | 99.85/100 quality score |       99.85 |  0.15% |  0.01% |           6.96s |     $0.0160 |
|    3 | <code>openai/gpt-5.5</code>                                          | 99.85/100 quality score |       99.85 |  0.15% |  0.01% |          50.26s |     $0.1749 |
|    4 | <code>mistral/mistral-ocr-2512</code>                                | 99.85/100 quality score |       99.85 |  0.15% |  0.19% |           7.52s |     $0.0080 |
|    5 | <code>anthropic/claude-sonnet-5</code>                               | 99.55/100 quality score |       99.55 |  0.45% |  0.44% |          36.26s |     $0.0373 |
|    6 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              | 99.40/100 quality score |       99.40 |  0.60% |  0.06% |          42.59s |     $0.0079 |
|    7 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 99.33/100 quality score |       99.33 |  0.67% |  0.58% |           0.02s |     $0.0010 |
|    8 | <code>grok/grok-4.3</code>                                           | 99.18/100 quality score |       99.18 |  0.82% |  0.22% |          64.29s |     $0.0170 |
|    9 | <code>gemini/gemini-3.1-flash-lite-preview</code>                    | 99.18/100 quality score |       99.18 |  0.82% |  0.70% |          11.95s |     $0.0032 |
|   10 | <code>kimi/kimi-k2.6</code>                                          | 99.10/100 quality score |       99.10 |  0.90% |  0.49% |          47.28s |     $0.0230 |
|   11 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     | 99.10/100 quality score |       99.10 |  0.90% |  0.83% |          15.44s |     $0.0015 |
|   12 | <code>gemini/gemini-3.1-flash-lite</code>                            | 99.03/100 quality score |       99.03 |  0.97% |  0.71% |          11.42s |     $0.0031 |
|   13 | <code>fal/fal-ai/got-ocr/v2</code>                                   | 98.58/100 quality score |       98.58 |  1.42% |  0.70% |          56.53s |     $0.2000 |
|   14 | <code>glm/glm-ocr</code>                                             | 98.58/100 quality score |       98.58 |  1.42% |  1.36% |          23.37s |     $0.0003 |
|   15 | <code>gemini/gemini-3.1-pro-preview</code>                           | 98.50/100 quality score |       98.50 |  1.50% |  0.15% |          44.33s |     $0.0273 |
|   16 | <code>gemini/gemini-3.5-flash</code>                                 | 98.35/100 quality score |       98.35 |  1.65% |  0.43% |          21.63s |     $0.0212 |
|   17 | <code>anthropic/claude-haiku-4-5</code>                              | 98.05/100 quality score |       98.05 |  1.95% |  0.68% |          35.08s |     $0.0161 |
|   18 | <code>replicate/datalab-to/marker</code>                             | 97.83/100 quality score |       97.83 |  2.17% |  2.65% |          15.38s |     $0.0160 |
|   19 | <code>replicate/datalab-to/ocr</code>                                | 97.75/100 quality score |       97.75 |  2.25% |  0.67% |          16.29s |     $0.0080 |
|   20 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                | 97.75/100 quality score |       97.75 |  2.25% |  0.87% |          76.46s |     $0.0058 |
|   21 | <code>grok/grok-4.20-0309-non-reasoning</code>                       | 97.53/100 quality score |       97.53 |  2.47% |  1.04% |           3.67s |     $0.0170 |
|   22 | <code>openai/gpt-5.4-nano</code>                                     | 96.63/100 quality score |       96.63 |  3.37% |  0.80% |          19.17s |     $0.0048 |
|   23 | <code>deepinfra/google/gemma-3-27b-it</code>                         | 95.13/100 quality score |       95.13 |  4.87% |  3.20% |          47.78s |     $0.0004 |
|   24 | <code>replicate/lucataco/deepseek-ocr</code>                         | 94.38/100 quality score |       94.38 |  5.62% |  4.19% |          38.46s |     $0.0132 |
|   25 | <code>anthropic/claude-sonnet-4-6</code>                             | 90.49/100 quality score |       90.49 |  9.51% |  3.46% |         378.34s |       $0.00 |
|   26 | <code>fal/fal-ai/florence-2-large/ocr</code>                         | 76.33/100 quality score |       76.33 | 23.67% | 16.58% |          17.43s |     $0.0302 |
|   27 | <code>openai/gpt-5.4-mini</code>                                     | 57.83/100 quality score |       57.83 | 42.17% | 41.19% |          34.81s |     $0.0142 |


## Provider Detail

| Provider                                                             | Group               | Score / 100 |    WER |    CER | Processing Time | Actual Cost |
| -------------------------------------------------------------------- | ------------------- | ----------: | -----: | -----: | --------------: | ----------: |
| <code>ocrmypdf</code>                                                | Local               |       96.33 |  3.67% |  1.63% |          10.99s |       $0.00 |
| <code>paddle-ocr</code>                                              | Local               |       92.21 |  7.79% |  1.52% |          87.01s |       $0.00 |
| <code>tesseract</code>                                               | Local               |       96.48 |  3.52% |  1.63% |           8.55s |       $0.00 |
| <code>anthropic/claude-haiku-4-5</code>                              | Third-Party Service |       98.05 |  1.95% |  0.68% |          35.08s |     $0.0161 |
| <code>anthropic/claude-opus-4-8</code>                               | Third-Party Service |       99.85 |  0.15% |  0.01% |          50.81s |     $0.0944 |
| <code>anthropic/claude-sonnet-4-6</code>                             | Third-Party Service |       90.49 |  9.51% |  3.46% |         378.34s |       $0.00 |
| <code>anthropic/claude-sonnet-5</code>                               | Third-Party Service |       99.55 |  0.45% |  0.44% |          36.26s |     $0.0373 |
| <code>deepinfra/google/gemma-3-27b-it</code>                         | Third-Party Service |       95.13 |  4.87% |  3.20% |          47.78s |     $0.0004 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     | Third-Party Service |       99.10 |  0.90% |  0.83% |          15.44s |     $0.0015 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service |       99.33 |  0.67% |  0.58% |           0.02s |     $0.0010 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              | Third-Party Service |       99.40 |  0.60% |  0.06% |          42.59s |     $0.0079 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                | Third-Party Service |       97.75 |  2.25% |  0.87% |          76.46s |     $0.0058 |
| <code>fal/fal-ai/florence-2-large/ocr</code>                         | Third-Party Service |       76.33 | 23.67% | 16.58% |          17.43s |     $0.0302 |
| <code>fal/fal-ai/got-ocr/v2</code>                                   | Third-Party Service |       98.58 |  1.42% |  0.70% |          56.53s |     $0.2000 |
| <code>gemini/gemini-3.1-flash-lite</code>                            | Third-Party Service |       99.03 |  0.97% |  0.71% |          11.42s |     $0.0031 |
| <code>gemini/gemini-3.1-flash-lite-preview</code>                    | Third-Party Service |       99.18 |  0.82% |  0.70% |          11.95s |     $0.0032 |
| <code>gemini/gemini-3.1-pro-preview</code>                           | Third-Party Service |       98.50 |  1.50% |  0.15% |          44.33s |     $0.0273 |
| <code>gemini/gemini-3.5-flash</code>                                 | Third-Party Service |       98.35 |  1.65% |  0.43% |          21.63s |     $0.0212 |
| <code>glm/glm-ocr</code>                                             | Third-Party Service |       98.58 |  1.42% |  1.36% |          23.37s |     $0.0003 |
| <code>grok/grok-4.20-0309-non-reasoning</code>                       | Third-Party Service |       97.53 |  2.47% |  1.04% |           3.67s |     $0.0170 |
| <code>grok/grok-4.3</code>                                           | Third-Party Service |       99.18 |  0.82% |  0.22% |          64.29s |     $0.0170 |
| <code>kimi/kimi-k2.6</code>                                          | Third-Party Service |       99.10 |  0.90% |  0.49% |          47.28s |     $0.0230 |
| <code>mistral/mistral-ocr-2512</code>                                | Third-Party Service |       99.85 |  0.15% |  0.19% |           7.52s |     $0.0080 |
| <code>mistral/mistral-ocr-4-0</code>                                 | Third-Party Service |       99.85 |  0.15% |  0.01% |           6.96s |     $0.0160 |
| <code>openai/gpt-5.4-mini</code>                                     | Third-Party Service |       57.83 | 42.17% | 41.19% |          34.81s |     $0.0142 |
| <code>openai/gpt-5.4-nano</code>                                     | Third-Party Service |       96.63 |  3.37% |  0.80% |          19.17s |     $0.0048 |
| <code>openai/gpt-5.5</code>                                          | Third-Party Service |       99.85 |  0.15% |  0.01% |          50.26s |     $0.1749 |
| <code>replicate/datalab-to/marker</code>                             | Third-Party Service |       97.83 |  2.17% |  2.65% |          15.38s |     $0.0160 |
| <code>replicate/datalab-to/ocr</code>                                | Third-Party Service |       97.75 |  2.25% |  0.67% |          16.29s |     $0.0080 |
| <code>replicate/lucataco/deepseek-ocr</code>                         | Third-Party Service |       94.38 |  5.62% |  4.19% |          38.46s |     $0.0132 |

## Error Breakdown (WER)

| Provider                                                             | Substitutions | Deletions | Insertions | Ref. Words |
| -------------------------------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>ocrmypdf</code>                                                |            20 |        13 |         16 |       1335 |
| <code>paddle-ocr</code>                                              |            51 |        45 |          8 |       1335 |
| <code>tesseract</code>                                               |            17 |        12 |         18 |       1335 |
| <code>anthropic/claude-haiku-4-5</code>                              |             9 |         8 |          9 |       1335 |
| <code>anthropic/claude-opus-4-8</code>                               |             1 |         0 |          1 |       1335 |
| <code>anthropic/claude-sonnet-4-6</code>                             |            92 |         0 |         35 |       1335 |
| <code>anthropic/claude-sonnet-5</code>                               |             0 |         6 |          0 |       1335 |
| <code>deepinfra/google/gemma-3-27b-it</code>                         |            26 |        30 |          9 |       1335 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     |             0 |        12 |          0 |       1335 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> |             0 |         9 |          0 |       1335 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              |             4 |         0 |          4 |       1335 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                |            10 |        10 |         10 |       1335 |
| <code>fal/fal-ai/florence-2-large/ocr</code>                         |           143 |       127 |         46 |       1335 |
| <code>fal/fal-ai/got-ocr/v2</code>                                   |             8 |         7 |          4 |       1335 |
| <code>gemini/gemini-3.1-flash-lite</code>                            |             1 |        11 |          1 |       1335 |
| <code>gemini/gemini-3.1-flash-lite-preview</code>                    |             0 |        10 |          1 |       1335 |
| <code>gemini/gemini-3.1-pro-preview</code>                           |            10 |         0 |         10 |       1335 |
| <code>gemini/gemini-3.5-flash</code>                                 |            10 |         0 |         12 |       1335 |
| <code>glm/glm-ocr</code>                                             |             3 |        15 |          1 |       1335 |
| <code>grok/grok-4.20-0309-non-reasoning</code>                       |            10 |        13 |         10 |       1335 |
| <code>grok/grok-4.3</code>                                           |             4 |         3 |          4 |       1335 |
| <code>kimi/kimi-k2.6</code>                                          |             3 |         6 |          3 |       1335 |
| <code>mistral/mistral-ocr-2512</code>                                |             0 |         0 |          2 |       1335 |
| <code>mistral/mistral-ocr-4-0</code>                                 |             1 |         0 |          1 |       1335 |
| <code>openai/gpt-5.4-mini</code>                                     |             9 |       545 |          9 |       1335 |
| <code>openai/gpt-5.4-nano</code>                                     |            31 |         3 |         11 |       1335 |
| <code>openai/gpt-5.5</code>                                          |             1 |         0 |          1 |       1335 |
| <code>replicate/datalab-to/marker</code>                             |             2 |        15 |         12 |       1335 |
| <code>replicate/datalab-to/ocr</code>                                |            13 |         4 |         13 |       1335 |
| <code>replicate/lucataco/deepseek-ocr</code>                         |            19 |         0 |         56 |       1335 |

## Notes

- Best local model: `tesseract/tesseract` scored 96.48/100.
- Best cloud service: `anthropic/claude-opus-4-8` scored 99.85/100.
- The cheapest cloud provider was `anthropic/claude-sonnet-4-6` at 0.0000¢ ($0.0000).
- Fastest local model: `tesseract/tesseract` at 8.55s.
- Fastest cloud service: `deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506` at 0.02s.
