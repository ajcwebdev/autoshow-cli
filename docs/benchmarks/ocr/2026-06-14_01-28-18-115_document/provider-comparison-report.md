# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-06-14_01-28-18-115_document`
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

| Rank | Provider                |                     Value | Score / 100 |    WER |   CER | Processing Time | Actual Cost |
| ---: | ----------------------- | ------------------------: | ----------: | -----: | ----: | --------------: | ----------: |
|    1 | <code>ocrmypdf</code>   | $0.00 local monetary cost |       84.04 | 15.96% | 4.55% |           2.27s |       $0.00 |
|    2 | <code>paddle-ocr</code> | $0.00 local monetary cost |       83.10 | 16.90% | 3.36% |          13.24s |       $0.00 |
|    3 | <code>tesseract</code>  | $0.00 local monetary cost |       84.04 | 15.96% | 5.09% |           0.85s |       $0.00 |

#### Speed

| Rank | Provider                |  Value | Score / 100 |    WER |   CER | Processing Time | Actual Cost |
| ---: | ----------------------- | -----: | ----------: | -----: | ----: | --------------: | ----------: |
|    1 | <code>tesseract</code>  |  0.85s |       84.04 | 15.96% | 5.09% |           0.85s |       $0.00 |
|    2 | <code>ocrmypdf</code>   |  2.27s |       84.04 | 15.96% | 4.55% |           2.27s |       $0.00 |
|    3 | <code>paddle-ocr</code> | 13.24s |       83.10 | 16.90% | 3.36% |          13.24s |       $0.00 |

#### Quality Score

| Rank | Provider                |                   Value | Score / 100 |    WER |   CER | Processing Time | Actual Cost |
| ---: | ----------------------- | ----------------------: | ----------: | -----: | ----: | --------------: | ----------: |
|    1 | <code>ocrmypdf</code>   | 84.04/100 quality score |       84.04 | 15.96% | 4.55% |           2.27s |       $0.00 |
|    2 | <code>tesseract</code>  | 84.04/100 quality score |       84.04 | 15.96% | 5.09% |           0.85s |       $0.00 |
|    3 | <code>paddle-ocr</code> | 83.10/100 quality score |       83.10 | 16.90% | 3.36% |          13.24s |       $0.00 |

### Third-Party Service

#### Price

| Rank | Provider                                                             |   Value | Score / 100 |    WER |    CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------------------------------- | ------: | ----------: | -----: | -----: | --------------: | ----------: |
|    1 | <code>glm/glm-ocr</code>                                             | $0.0000 |       80.75 | 19.25% | 11.91% |           1.71s |     $0.0000 |
|    2 | <code>deepinfra/google/gemma-3-27b-it</code>                         | $0.0001 |       97.65 |  2.35% |  0.73% |          24.08s |     $0.0001 |
|    3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0002 |       93.43 |  6.57% |  0.91% |           6.42s |     $0.0002 |
|    4 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     | $0.0003 |       97.65 |  2.35% |  0.55% |           7.72s |     $0.0003 |
|    5 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                | $0.0004 |       93.43 |  6.57% |  0.91% |           9.66s |     $0.0004 |
|    6 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              | $0.0006 |       99.53 |  0.47% |  0.09% |          13.37s |     $0.0006 |
|    7 | <code>openai/gpt-5.4-nano</code>                                     | $0.0008 |       93.43 |  6.57% |  1.18% |           3.21s |     $0.0008 |
|    8 | <code>gemini/gemini-3.1-flash-lite-preview</code>                    | $0.0008 |       90.14 |  9.86% |  1.36% |           2.09s |     $0.0008 |
|    9 | <code>gemini/gemini-3.1-flash-lite</code>                            | $0.0009 |       95.77 |  4.23% |  0.73% |           2.42s |     $0.0009 |
|   10 | <code>mistral/mistral-ocr-2512</code>                                | $0.0020 |       93.43 |  6.57% |  0.82% |           0.89s |     $0.0020 |
|   11 | <code>replicate/datalab-to/ocr</code>                                | $0.0020 |       93.43 |  6.57% |  4.91% |           5.72s |     $0.0020 |
|   12 | <code>openai/gpt-5.4-mini</code>                                     | $0.0029 |       98.12 |  1.88% |  0.45% |           2.76s |     $0.0029 |
|   13 | <code>grok/grok-4.20-0309-non-reasoning</code>                       | $0.0029 |       99.06 |  0.94% |  0.27% |           2.04s |     $0.0029 |
|   14 | <code>grok/grok-4.3</code>                                           | $0.0029 |      100.00 |  0.00% |  0.00% |          10.38s |     $0.0029 |
|   15 | <code>replicate/lucataco/deepseek-ocr</code>                         | $0.0033 |       68.54 | 31.46% | 20.82% |           7.41s |     $0.0033 |
|   16 | <code>kimi/kimi-k2.6</code>                                          | $0.0035 |       99.53 |  0.47% |  0.09% |          13.45s |     $0.0035 |
|   17 | <code>mistral/mistral-ocr-4-0</code>                                 | $0.0040 |       92.96 |  7.04% |  0.91% |           1.43s |     $0.0040 |
|   18 | <code>replicate/datalab-to/marker</code>                             | $0.0040 |       97.18 |  2.82% |  1.36% |           5.12s |     $0.0040 |
|   19 | <code>anthropic/claude-haiku-4-5</code>                              | $0.0042 |       99.06 |  0.94% |  0.18% |           7.54s |     $0.0042 |
|   20 | <code>gemini/gemini-3.5-flash</code>                                 | $0.0054 |       99.53 |  0.47% |  0.09% |          12.72s |     $0.0054 |
|   21 | <code>gemini/gemini-3.1-pro-preview</code>                           | $0.0071 |       95.31 |  4.69% |  1.00% |           4.94s |     $0.0071 |
|   22 | <code>fal/fal-ai/florence-2-large/ocr</code>                         | $0.0076 |       86.38 | 13.62% |  3.36% |           5.26s |     $0.0076 |
|   23 | <code>anthropic/claude-sonnet-5</code>                               | $0.0104 |       99.53 |  0.47% |  0.09% |          10.26s |     $0.0104 |
|   24 | <code>anthropic/claude-sonnet-4-6</code>                             | $0.0124 |       99.53 |  0.47% |  0.18% |          13.73s |     $0.0124 |
|   25 | <code>anthropic/claude-opus-4-8</code>                               | $0.0261 |       99.53 |  0.47% |  0.09% |          12.96s |     $0.0261 |
|   26 | <code>openai/gpt-5.5</code>                                          | $0.0348 |      100.00 |  0.00% |  0.00% |          11.37s |     $0.0348 |
|   27 | <code>fal/fal-ai/got-ocr/v2</code>                                   | $0.0500 |       84.98 | 15.02% |  4.18% |          10.31s |     $0.0500 |

#### Speed

| Rank | Provider                                                             |  Value | Score / 100 |    WER |    CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------------------------------- | -----: | ----------: | -----: | -----: | --------------: | ----------: |
|    1 | <code>mistral/mistral-ocr-2512</code>                                |  0.89s |       93.43 |  6.57% |  0.82% |           0.89s |     $0.0020 |
|    2 | <code>mistral/mistral-ocr-4-0</code>                                 |  1.43s |       92.96 |  7.04% |  0.91% |           1.43s |     $0.0040 |
|    3 | <code>glm/glm-ocr</code>                                             |  1.71s |       80.75 | 19.25% | 11.91% |           1.71s |     $0.0000 |
|    4 | <code>grok/grok-4.20-0309-non-reasoning</code>                       |  2.04s |       99.06 |  0.94% |  0.27% |           2.04s |     $0.0029 |
|    5 | <code>gemini/gemini-3.1-flash-lite-preview</code>                    |  2.09s |       90.14 |  9.86% |  1.36% |           2.09s |     $0.0008 |
|    6 | <code>gemini/gemini-3.1-flash-lite</code>                            |  2.42s |       95.77 |  4.23% |  0.73% |           2.42s |     $0.0009 |
|    7 | <code>openai/gpt-5.4-mini</code>                                     |  2.76s |       98.12 |  1.88% |  0.45% |           2.76s |     $0.0029 |
|    8 | <code>openai/gpt-5.4-nano</code>                                     |  3.21s |       93.43 |  6.57% |  1.18% |           3.21s |     $0.0008 |
|    9 | <code>gemini/gemini-3.1-pro-preview</code>                           |  4.94s |       95.31 |  4.69% |  1.00% |           4.94s |     $0.0071 |
|   10 | <code>replicate/datalab-to/marker</code>                             |  5.12s |       97.18 |  2.82% |  1.36% |           5.12s |     $0.0040 |
|   11 | <code>fal/fal-ai/florence-2-large/ocr</code>                         |  5.26s |       86.38 | 13.62% |  3.36% |           5.26s |     $0.0076 |
|   12 | <code>replicate/datalab-to/ocr</code>                                |  5.72s |       93.43 |  6.57% |  4.91% |           5.72s |     $0.0020 |
|   13 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> |  6.42s |       93.43 |  6.57% |  0.91% |           6.42s |     $0.0002 |
|   14 | <code>replicate/lucataco/deepseek-ocr</code>                         |  7.41s |       68.54 | 31.46% | 20.82% |           7.41s |     $0.0033 |
|   15 | <code>anthropic/claude-haiku-4-5</code>                              |  7.54s |       99.06 |  0.94% |  0.18% |           7.54s |     $0.0042 |
|   16 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     |  7.72s |       97.65 |  2.35% |  0.55% |           7.72s |     $0.0003 |
|   17 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                |  9.66s |       93.43 |  6.57% |  0.91% |           9.66s |     $0.0004 |
|   18 | <code>anthropic/claude-sonnet-5</code>                               | 10.26s |       99.53 |  0.47% |  0.09% |          10.26s |     $0.0104 |
|   19 | <code>fal/fal-ai/got-ocr/v2</code>                                   | 10.31s |       84.98 | 15.02% |  4.18% |          10.31s |     $0.0500 |
|   20 | <code>grok/grok-4.3</code>                                           | 10.38s |      100.00 |  0.00% |  0.00% |          10.38s |     $0.0029 |
|   21 | <code>openai/gpt-5.5</code>                                          | 11.37s |      100.00 |  0.00% |  0.00% |          11.37s |     $0.0348 |
|   22 | <code>gemini/gemini-3.5-flash</code>                                 | 12.72s |       99.53 |  0.47% |  0.09% |          12.72s |     $0.0054 |
|   23 | <code>anthropic/claude-opus-4-8</code>                               | 12.96s |       99.53 |  0.47% |  0.09% |          12.96s |     $0.0261 |
|   24 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              | 13.37s |       99.53 |  0.47% |  0.09% |          13.37s |     $0.0006 |
|   25 | <code>kimi/kimi-k2.6</code>                                          | 13.45s |       99.53 |  0.47% |  0.09% |          13.45s |     $0.0035 |
|   26 | <code>anthropic/claude-sonnet-4-6</code>                             | 13.73s |       99.53 |  0.47% |  0.18% |          13.73s |     $0.0124 |
|   27 | <code>deepinfra/google/gemma-3-27b-it</code>                         | 24.08s |       97.65 |  2.35% |  0.73% |          24.08s |     $0.0001 |

#### Quality Score

| Rank | Provider                                                             |                    Value | Score / 100 |    WER |    CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------------------------------- | -----------------------: | ----------: | -----: | -----: | --------------: | ----------: |
|    1 | <code>grok/grok-4.3</code>                                           | 100.00/100 quality score |      100.00 |  0.00% |  0.00% |          10.38s |     $0.0029 |
|    2 | <code>openai/gpt-5.5</code>                                          | 100.00/100 quality score |      100.00 |  0.00% |  0.00% |          11.37s |     $0.0348 |
|    3 | <code>anthropic/claude-opus-4-8</code>                               |  99.53/100 quality score |       99.53 |  0.47% |  0.09% |          12.96s |     $0.0261 |
|    4 | <code>anthropic/claude-sonnet-5</code>                               |  99.53/100 quality score |       99.53 |  0.47% |  0.09% |          10.26s |     $0.0104 |
|    5 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              |  99.53/100 quality score |       99.53 |  0.47% |  0.09% |          13.37s |     $0.0006 |
|    6 | <code>gemini/gemini-3.5-flash</code>                                 |  99.53/100 quality score |       99.53 |  0.47% |  0.09% |          12.72s |     $0.0054 |
|    7 | <code>kimi/kimi-k2.6</code>                                          |  99.53/100 quality score |       99.53 |  0.47% |  0.09% |          13.45s |     $0.0035 |
|    8 | <code>anthropic/claude-sonnet-4-6</code>                             |  99.53/100 quality score |       99.53 |  0.47% |  0.18% |          13.73s |     $0.0124 |
|    9 | <code>anthropic/claude-haiku-4-5</code>                              |  99.06/100 quality score |       99.06 |  0.94% |  0.18% |           7.54s |     $0.0042 |
|   10 | <code>grok/grok-4.20-0309-non-reasoning</code>                       |  99.06/100 quality score |       99.06 |  0.94% |  0.27% |           2.04s |     $0.0029 |
|   11 | <code>openai/gpt-5.4-mini</code>                                     |  98.12/100 quality score |       98.12 |  1.88% |  0.45% |           2.76s |     $0.0029 |
|   12 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     |  97.65/100 quality score |       97.65 |  2.35% |  0.55% |           7.72s |     $0.0003 |
|   13 | <code>deepinfra/google/gemma-3-27b-it</code>                         |  97.65/100 quality score |       97.65 |  2.35% |  0.73% |          24.08s |     $0.0001 |
|   14 | <code>replicate/datalab-to/marker</code>                             |  97.18/100 quality score |       97.18 |  2.82% |  1.36% |           5.12s |     $0.0040 |
|   15 | <code>gemini/gemini-3.1-flash-lite</code>                            |  95.77/100 quality score |       95.77 |  4.23% |  0.73% |           2.42s |     $0.0009 |
|   16 | <code>gemini/gemini-3.1-pro-preview</code>                           |  95.31/100 quality score |       95.31 |  4.69% |  1.00% |           4.94s |     $0.0071 |
|   17 | <code>mistral/mistral-ocr-2512</code>                                |  93.43/100 quality score |       93.43 |  6.57% |  0.82% |           0.89s |     $0.0020 |
|   18 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> |  93.43/100 quality score |       93.43 |  6.57% |  0.91% |           6.42s |     $0.0002 |
|   19 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                |  93.43/100 quality score |       93.43 |  6.57% |  0.91% |           9.66s |     $0.0004 |
|   20 | <code>openai/gpt-5.4-nano</code>                                     |  93.43/100 quality score |       93.43 |  6.57% |  1.18% |           3.21s |     $0.0008 |
|   21 | <code>replicate/datalab-to/ocr</code>                                |  93.43/100 quality score |       93.43 |  6.57% |  4.91% |           5.72s |     $0.0020 |
|   22 | <code>mistral/mistral-ocr-4-0</code>                                 |  92.96/100 quality score |       92.96 |  7.04% |  0.91% |           1.43s |     $0.0040 |
|   23 | <code>gemini/gemini-3.1-flash-lite-preview</code>                    |  90.14/100 quality score |       90.14 |  9.86% |  1.36% |           2.09s |     $0.0008 |
|   24 | <code>fal/fal-ai/florence-2-large/ocr</code>                         |  86.38/100 quality score |       86.38 | 13.62% |  3.36% |           5.26s |     $0.0076 |
|   25 | <code>fal/fal-ai/got-ocr/v2</code>                                   |  84.98/100 quality score |       84.98 | 15.02% |  4.18% |          10.31s |     $0.0500 |
|   26 | <code>glm/glm-ocr</code>                                             |  80.75/100 quality score |       80.75 | 19.25% | 11.91% |           1.71s |     $0.0000 |
|   27 | <code>replicate/lucataco/deepseek-ocr</code>                         |  68.54/100 quality score |       68.54 | 31.46% | 20.82% |           7.41s |     $0.0033 |


## Provider Detail

| Provider                                                             | Group               | Score / 100 |    WER |    CER | Processing Time | Actual Cost |
| -------------------------------------------------------------------- | ------------------- | ----------: | -----: | -----: | --------------: | ----------: |
| <code>ocrmypdf</code>                                                | Local               |       84.04 | 15.96% |  4.55% |           2.27s |       $0.00 |
| <code>paddle-ocr</code>                                              | Local               |       83.10 | 16.90% |  3.36% |          13.24s |       $0.00 |
| <code>tesseract</code>                                               | Local               |       84.04 | 15.96% |  5.09% |           0.85s |       $0.00 |
| <code>anthropic/claude-haiku-4-5</code>                              | Third-Party Service |       99.06 |  0.94% |  0.18% |           7.54s |     $0.0042 |
| <code>anthropic/claude-opus-4-8</code>                               | Third-Party Service |       99.53 |  0.47% |  0.09% |          12.96s |     $0.0261 |
| <code>anthropic/claude-sonnet-4-6</code>                             | Third-Party Service |       99.53 |  0.47% |  0.18% |          13.73s |     $0.0124 |
| <code>anthropic/claude-sonnet-5</code>                               | Third-Party Service |       99.53 |  0.47% |  0.09% |          10.26s |     $0.0104 |
| <code>deepinfra/google/gemma-3-27b-it</code>                         | Third-Party Service |       97.65 |  2.35% |  0.73% |          24.08s |     $0.0001 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     | Third-Party Service |       97.65 |  2.35% |  0.55% |           7.72s |     $0.0003 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service |       93.43 |  6.57% |  0.91% |           6.42s |     $0.0002 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              | Third-Party Service |       99.53 |  0.47% |  0.09% |          13.37s |     $0.0006 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                | Third-Party Service |       93.43 |  6.57% |  0.91% |           9.66s |     $0.0004 |
| <code>fal/fal-ai/florence-2-large/ocr</code>                         | Third-Party Service |       86.38 | 13.62% |  3.36% |           5.26s |     $0.0076 |
| <code>fal/fal-ai/got-ocr/v2</code>                                   | Third-Party Service |       84.98 | 15.02% |  4.18% |          10.31s |     $0.0500 |
| <code>gemini/gemini-3.1-flash-lite</code>                            | Third-Party Service |       95.77 |  4.23% |  0.73% |           2.42s |     $0.0009 |
| <code>gemini/gemini-3.1-flash-lite-preview</code>                    | Third-Party Service |       90.14 |  9.86% |  1.36% |           2.09s |     $0.0008 |
| <code>gemini/gemini-3.1-pro-preview</code>                           | Third-Party Service |       95.31 |  4.69% |  1.00% |           4.94s |     $0.0071 |
| <code>gemini/gemini-3.5-flash</code>                                 | Third-Party Service |       99.53 |  0.47% |  0.09% |          12.72s |     $0.0054 |
| <code>glm/glm-ocr</code>                                             | Third-Party Service |       80.75 | 19.25% | 11.91% |           1.71s |     $0.0000 |
| <code>grok/grok-4.20-0309-non-reasoning</code>                       | Third-Party Service |       99.06 |  0.94% |  0.27% |           2.04s |     $0.0029 |
| <code>grok/grok-4.3</code>                                           | Third-Party Service |      100.00 |  0.00% |  0.00% |          10.38s |     $0.0029 |
| <code>kimi/kimi-k2.6</code>                                          | Third-Party Service |       99.53 |  0.47% |  0.09% |          13.45s |     $0.0035 |
| <code>mistral/mistral-ocr-2512</code>                                | Third-Party Service |       93.43 |  6.57% |  0.82% |           0.89s |     $0.0020 |
| <code>mistral/mistral-ocr-4-0</code>                                 | Third-Party Service |       92.96 |  7.04% |  0.91% |           1.43s |     $0.0040 |
| <code>openai/gpt-5.4-mini</code>                                     | Third-Party Service |       98.12 |  1.88% |  0.45% |           2.76s |     $0.0029 |
| <code>openai/gpt-5.4-nano</code>                                     | Third-Party Service |       93.43 |  6.57% |  1.18% |           3.21s |     $0.0008 |
| <code>openai/gpt-5.5</code>                                          | Third-Party Service |      100.00 |  0.00% |  0.00% |          11.37s |     $0.0348 |
| <code>replicate/datalab-to/marker</code>                             | Third-Party Service |       97.18 |  2.82% |  1.36% |           5.12s |     $0.0040 |
| <code>replicate/datalab-to/ocr</code>                                | Third-Party Service |       93.43 |  6.57% |  4.91% |           5.72s |     $0.0020 |
| <code>replicate/lucataco/deepseek-ocr</code>                         | Third-Party Service |       68.54 | 31.46% | 20.82% |           7.41s |     $0.0033 |

## Error Breakdown (WER)

| Provider                                                             | Substitutions | Deletions | Insertions | Ref. Words |
| -------------------------------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>ocrmypdf</code>                                                |            24 |         6 |          4 |        213 |
| <code>paddle-ocr</code>                                              |            22 |        10 |          4 |        213 |
| <code>tesseract</code>                                               |            25 |         4 |          5 |        213 |
| <code>anthropic/claude-haiku-4-5</code>                              |             2 |         0 |          0 |        213 |
| <code>anthropic/claude-opus-4-8</code>                               |             1 |         0 |          0 |        213 |
| <code>anthropic/claude-sonnet-4-6</code>                             |             1 |         0 |          0 |        213 |
| <code>anthropic/claude-sonnet-5</code>                               |             1 |         0 |          0 |        213 |
| <code>deepinfra/google/gemma-3-27b-it</code>                         |             5 |         0 |          0 |        213 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     |             5 |         0 |          0 |        213 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> |             8 |         6 |          0 |        213 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              |             1 |         0 |          0 |        213 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                |             8 |         6 |          0 |        213 |
| <code>fal/fal-ai/florence-2-large/ocr</code>                         |            23 |         5 |          1 |        213 |
| <code>fal/fal-ai/got-ocr/v2</code>                                   |            24 |         1 |          7 |        213 |
| <code>gemini/gemini-3.1-flash-lite</code>                            |             2 |         0 |          7 |        213 |
| <code>gemini/gemini-3.1-flash-lite-preview</code>                    |             8 |         6 |          7 |        213 |
| <code>gemini/gemini-3.1-pro-preview</code>                           |             3 |         0 |          7 |        213 |
| <code>gemini/gemini-3.5-flash</code>                                 |             1 |         0 |          0 |        213 |
| <code>glm/glm-ocr</code>                                             |             7 |        34 |          0 |        213 |
| <code>grok/grok-4.20-0309-non-reasoning</code>                       |             2 |         0 |          0 |        213 |
| <code>grok/grok-4.3</code>                                           |             0 |         0 |          0 |        213 |
| <code>kimi/kimi-k2.6</code>                                          |             1 |         0 |          0 |        213 |
| <code>mistral/mistral-ocr-2512</code>                                |             8 |         6 |          0 |        213 |
| <code>mistral/mistral-ocr-4-0</code>                                 |             9 |         6 |          0 |        213 |
| <code>openai/gpt-5.4-mini</code>                                     |             4 |         0 |          0 |        213 |
| <code>openai/gpt-5.4-nano</code>                                     |            11 |         0 |          3 |        213 |
| <code>openai/gpt-5.5</code>                                          |             0 |         0 |          0 |        213 |
| <code>replicate/datalab-to/marker</code>                             |             2 |         4 |          0 |        213 |
| <code>replicate/datalab-to/ocr</code>                                |             5 |         0 |          9 |        213 |
| <code>replicate/lucataco/deepseek-ocr</code>                         |             9 |        31 |         27 |        213 |

## Notes

- Best local model: `ocrmypdf/ocrmypdf` scored 84.04/100.
- Best cloud service: `grok/grok-4.3` scored 100.00/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0047¢ ($0.0000).
- Fastest local model: `tesseract/tesseract` at 0.85s.
- Fastest cloud service: `mistral/mistral-ocr-2512` at 0.89s.
