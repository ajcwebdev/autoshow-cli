# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-06-14_01-28-15-914_document`
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
|    1 | <code>ocrmypdf</code>   | $0.00 local monetary cost |      100.00 | 0.00% | 0.00% |           0.71s |       $0.00 |
|    2 | <code>paddle-ocr</code> | $0.00 local monetary cost |      100.00 | 0.00% | 0.00% |           8.67s |       $0.00 |
|    3 | <code>tesseract</code>  | $0.00 local monetary cost |      100.00 | 0.00% | 0.00% |           0.17s |       $0.00 |

#### Speed

| Rank | Provider                | Value | Score / 100 |   WER |   CER | Processing Time | Actual Cost |
| ---: | ----------------------- | ----: | ----------: | ----: | ----: | --------------: | ----------: |
|    1 | <code>tesseract</code>  | 0.17s |      100.00 | 0.00% | 0.00% |           0.17s |       $0.00 |
|    2 | <code>ocrmypdf</code>   | 0.71s |      100.00 | 0.00% | 0.00% |           0.71s |       $0.00 |
|    3 | <code>paddle-ocr</code> | 8.67s |      100.00 | 0.00% | 0.00% |           8.67s |       $0.00 |

#### Quality Score

| Rank | Provider                |                    Value | Score / 100 |   WER |   CER | Processing Time | Actual Cost |
| ---: | ----------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | ----------: |
|    1 | <code>ocrmypdf</code>   | 100.00/100 quality score |      100.00 | 0.00% | 0.00% |           0.71s |       $0.00 |
|    2 | <code>paddle-ocr</code> | 100.00/100 quality score |      100.00 | 0.00% | 0.00% |           8.67s |       $0.00 |
|    3 | <code>tesseract</code>  | 100.00/100 quality score |      100.00 | 0.00% | 0.00% |           0.17s |       $0.00 |

### Third-Party Service

#### Price

| Rank | Provider                                                             |   Value | Score / 100 |     WER |     CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------------------------------- | ------: | ----------: | ------: | ------: | --------------: | ----------: |
|    1 | <code>glm/glm-ocr</code>                                             | $0.0000 |      100.00 |   0.00% |   0.00% |           1.27s |     $0.0000 |
|    2 | <code>deepinfra/google/gemma-3-27b-it</code>                         | $0.0000 |      100.00 |   0.00% |   0.00% |           1.57s |     $0.0000 |
|    3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0001 |      100.00 |   0.00% |   0.00% |           0.88s |     $0.0001 |
|    4 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                | $0.0002 |       80.00 |  20.00% |  20.22% |           0.88s |     $0.0002 |
|    5 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     | $0.0002 |      100.00 |   0.00% |   0.00% |           0.95s |     $0.0002 |
|    6 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              | $0.0002 |      100.00 |   0.00% |   0.00% |           1.39s |     $0.0002 |
|    7 | <code>openai/gpt-5.4-nano</code>                                     | $0.0003 |      100.00 |   0.00% |   0.00% |           1.05s |     $0.0003 |
|    8 | <code>gemini/gemini-3.1-flash-lite</code>                            | $0.0004 |      100.00 |   0.00% |   0.00% |           1.38s |     $0.0004 |
|    9 | <code>gemini/gemini-3.1-flash-lite-preview</code>                    | $0.0004 |      100.00 |   0.00% |   0.00% |           1.25s |     $0.0004 |
|   10 | <code>openai/gpt-5.4-mini</code>                                     | $0.0010 |      100.00 |   0.00% |   0.00% |           1.32s |     $0.0010 |
|   11 | <code>kimi/kimi-k2.6</code>                                          | $0.0014 |      100.00 |   0.00% |   0.00% |           3.36s |     $0.0014 |
|   12 | <code>grok/grok-4.20-0309-non-reasoning</code>                       | $0.0015 |      100.00 |   0.00% |   0.00% |           0.55s |     $0.0015 |
|   13 | <code>grok/grok-4.3</code>                                           | $0.0015 |      100.00 |   0.00% |   0.00% |           3.83s |     $0.0015 |
|   14 | <code>anthropic/claude-haiku-4-5</code>                              | $0.0018 |      100.00 |   0.00% |   0.00% |           1.09s |     $0.0018 |
|   15 | <code>mistral/mistral-ocr-2512</code>                                | $0.0020 |      100.00 |   0.00% |   0.00% |           0.63s |     $0.0020 |
|   16 | <code>replicate/datalab-to/ocr</code>                                | $0.0020 |      100.00 |   0.00% |   0.00% |           7.02s |     $0.0020 |
|   17 | <code>gemini/gemini-3.5-flash</code>                                 | $0.0022 |      100.00 |   0.00% |   0.00% |           5.34s |     $0.0022 |
|   18 | <code>gemini/gemini-3.1-pro-preview</code>                           | $0.0032 |      100.00 |   0.00% |   0.00% |           2.35s |     $0.0032 |
|   19 | <code>replicate/lucataco/deepseek-ocr</code>                         | $0.0033 |        0.00 | 225.00% | 201.12% |           2.87s |     $0.0033 |
|   20 | <code>anthropic/claude-sonnet-5</code>                               | $0.0038 |      100.00 |   0.00% |   0.00% |           2.04s |     $0.0038 |
|   21 | <code>mistral/mistral-ocr-4-0</code>                                 | $0.0040 |      100.00 |   0.00% |   0.00% |           0.77s |     $0.0040 |
|   22 | <code>replicate/datalab-to/marker</code>                             | $0.0040 |      100.00 |   0.00% |   0.00% |           5.28s |     $0.0040 |
|   23 | <code>anthropic/claude-sonnet-4-6</code>                             | $0.0052 |      100.00 |   0.00% |   0.00% |           4.12s |     $0.0052 |
|   24 | <code>openai/gpt-5.5</code>                                          | $0.0070 |      100.00 |   0.00% |   0.00% |           1.47s |     $0.0070 |
|   25 | <code>fal/fal-ai/florence-2-large/ocr</code>                         | $0.0076 |       65.00 |  35.00% |  17.98% |           5.28s |     $0.0076 |
|   26 | <code>anthropic/claude-opus-4-8</code>                               | $0.0095 |      100.00 |   0.00% |   0.00% |           2.38s |     $0.0095 |
|   27 | <code>fal/fal-ai/got-ocr/v2</code>                                   | $0.0500 |       95.00 |   5.00% |   6.74% |           5.34s |     $0.0500 |

#### Speed

| Rank | Provider                                                             | Value | Score / 100 |     WER |     CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------------------------------- | ----: | ----------: | ------: | ------: | --------------: | ----------: |
|    1 | <code>grok/grok-4.20-0309-non-reasoning</code>                       | 0.55s |      100.00 |   0.00% |   0.00% |           0.55s |     $0.0015 |
|    2 | <code>mistral/mistral-ocr-2512</code>                                | 0.63s |      100.00 |   0.00% |   0.00% |           0.63s |     $0.0020 |
|    3 | <code>mistral/mistral-ocr-4-0</code>                                 | 0.77s |      100.00 |   0.00% |   0.00% |           0.77s |     $0.0040 |
|    4 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 0.88s |      100.00 |   0.00% |   0.00% |           0.88s |     $0.0001 |
|    5 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                | 0.88s |       80.00 |  20.00% |  20.22% |           0.88s |     $0.0002 |
|    6 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     | 0.95s |      100.00 |   0.00% |   0.00% |           0.95s |     $0.0002 |
|    7 | <code>openai/gpt-5.4-nano</code>                                     | 1.05s |      100.00 |   0.00% |   0.00% |           1.05s |     $0.0003 |
|    8 | <code>anthropic/claude-haiku-4-5</code>                              | 1.09s |      100.00 |   0.00% |   0.00% |           1.09s |     $0.0018 |
|    9 | <code>gemini/gemini-3.1-flash-lite-preview</code>                    | 1.25s |      100.00 |   0.00% |   0.00% |           1.25s |     $0.0004 |
|   10 | <code>glm/glm-ocr</code>                                             | 1.27s |      100.00 |   0.00% |   0.00% |           1.27s |     $0.0000 |
|   11 | <code>openai/gpt-5.4-mini</code>                                     | 1.32s |      100.00 |   0.00% |   0.00% |           1.32s |     $0.0010 |
|   12 | <code>gemini/gemini-3.1-flash-lite</code>                            | 1.38s |      100.00 |   0.00% |   0.00% |           1.38s |     $0.0004 |
|   13 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              | 1.39s |      100.00 |   0.00% |   0.00% |           1.39s |     $0.0002 |
|   14 | <code>openai/gpt-5.5</code>                                          | 1.47s |      100.00 |   0.00% |   0.00% |           1.47s |     $0.0070 |
|   15 | <code>deepinfra/google/gemma-3-27b-it</code>                         | 1.57s |      100.00 |   0.00% |   0.00% |           1.57s |     $0.0000 |
|   16 | <code>anthropic/claude-sonnet-5</code>                               | 2.04s |      100.00 |   0.00% |   0.00% |           2.04s |     $0.0038 |
|   17 | <code>gemini/gemini-3.1-pro-preview</code>                           | 2.35s |      100.00 |   0.00% |   0.00% |           2.35s |     $0.0032 |
|   18 | <code>anthropic/claude-opus-4-8</code>                               | 2.38s |      100.00 |   0.00% |   0.00% |           2.38s |     $0.0095 |
|   19 | <code>replicate/lucataco/deepseek-ocr</code>                         | 2.87s |        0.00 | 225.00% | 201.12% |           2.87s |     $0.0033 |
|   20 | <code>kimi/kimi-k2.6</code>                                          | 3.36s |      100.00 |   0.00% |   0.00% |           3.36s |     $0.0014 |
|   21 | <code>grok/grok-4.3</code>                                           | 3.83s |      100.00 |   0.00% |   0.00% |           3.83s |     $0.0015 |
|   22 | <code>anthropic/claude-sonnet-4-6</code>                             | 4.12s |      100.00 |   0.00% |   0.00% |           4.12s |     $0.0052 |
|   23 | <code>replicate/datalab-to/marker</code>                             | 5.28s |      100.00 |   0.00% |   0.00% |           5.28s |     $0.0040 |
|   24 | <code>fal/fal-ai/florence-2-large/ocr</code>                         | 5.28s |       65.00 |  35.00% |  17.98% |           5.28s |     $0.0076 |
|   25 | <code>gemini/gemini-3.5-flash</code>                                 | 5.34s |      100.00 |   0.00% |   0.00% |           5.34s |     $0.0022 |
|   26 | <code>fal/fal-ai/got-ocr/v2</code>                                   | 5.34s |       95.00 |   5.00% |   6.74% |           5.34s |     $0.0500 |
|   27 | <code>replicate/datalab-to/ocr</code>                                | 7.02s |      100.00 |   0.00% |   0.00% |           7.02s |     $0.0020 |

#### Quality Score

| Rank | Provider                                                             |                    Value | Score / 100 |     WER |     CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------------------------------- | -----------------------: | ----------: | ------: | ------: | --------------: | ----------: |
|    1 | <code>anthropic/claude-haiku-4-5</code>                              | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           1.09s |     $0.0018 |
|    2 | <code>anthropic/claude-opus-4-8</code>                               | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           2.38s |     $0.0095 |
|    3 | <code>anthropic/claude-sonnet-4-6</code>                             | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           4.12s |     $0.0052 |
|    4 | <code>anthropic/claude-sonnet-5</code>                               | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           2.04s |     $0.0038 |
|    5 | <code>deepinfra/google/gemma-3-27b-it</code>                         | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           1.57s |     $0.0000 |
|    6 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           0.95s |     $0.0002 |
|    7 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           0.88s |     $0.0001 |
|    8 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           1.39s |     $0.0002 |
|    9 | <code>gemini/gemini-3.1-flash-lite</code>                            | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           1.38s |     $0.0004 |
|   10 | <code>gemini/gemini-3.1-flash-lite-preview</code>                    | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           1.25s |     $0.0004 |
|   11 | <code>gemini/gemini-3.1-pro-preview</code>                           | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           2.35s |     $0.0032 |
|   12 | <code>gemini/gemini-3.5-flash</code>                                 | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           5.34s |     $0.0022 |
|   13 | <code>glm/glm-ocr</code>                                             | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           1.27s |     $0.0000 |
|   14 | <code>grok/grok-4.20-0309-non-reasoning</code>                       | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           0.55s |     $0.0015 |
|   15 | <code>grok/grok-4.3</code>                                           | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           3.83s |     $0.0015 |
|   16 | <code>kimi/kimi-k2.6</code>                                          | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           3.36s |     $0.0014 |
|   17 | <code>mistral/mistral-ocr-2512</code>                                | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           0.63s |     $0.0020 |
|   18 | <code>mistral/mistral-ocr-4-0</code>                                 | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           0.77s |     $0.0040 |
|   19 | <code>openai/gpt-5.4-mini</code>                                     | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           1.32s |     $0.0010 |
|   20 | <code>openai/gpt-5.4-nano</code>                                     | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           1.05s |     $0.0003 |
|   21 | <code>openai/gpt-5.5</code>                                          | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           1.47s |     $0.0070 |
|   22 | <code>replicate/datalab-to/marker</code>                             | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           5.28s |     $0.0040 |
|   23 | <code>replicate/datalab-to/ocr</code>                                | 100.00/100 quality score |      100.00 |   0.00% |   0.00% |           7.02s |     $0.0020 |
|   24 | <code>fal/fal-ai/got-ocr/v2</code>                                   |  95.00/100 quality score |       95.00 |   5.00% |   6.74% |           5.34s |     $0.0500 |
|   25 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                |  80.00/100 quality score |       80.00 |  20.00% |  20.22% |           0.88s |     $0.0002 |
|   26 | <code>fal/fal-ai/florence-2-large/ocr</code>                         |  65.00/100 quality score |       65.00 |  35.00% |  17.98% |           5.28s |     $0.0076 |
|   27 | <code>replicate/lucataco/deepseek-ocr</code>                         |   0.00/100 quality score |        0.00 | 225.00% | 201.12% |           2.87s |     $0.0033 |


## Provider Detail

| Provider                                                             | Group               | Score / 100 |     WER |     CER | Processing Time | Actual Cost |
| -------------------------------------------------------------------- | ------------------- | ----------: | ------: | ------: | --------------: | ----------: |
| <code>ocrmypdf</code>                                                | Local               |      100.00 |   0.00% |   0.00% |           0.71s |       $0.00 |
| <code>paddle-ocr</code>                                              | Local               |      100.00 |   0.00% |   0.00% |           8.67s |       $0.00 |
| <code>tesseract</code>                                               | Local               |      100.00 |   0.00% |   0.00% |           0.17s |       $0.00 |
| <code>anthropic/claude-haiku-4-5</code>                              | Third-Party Service |      100.00 |   0.00% |   0.00% |           1.09s |     $0.0018 |
| <code>anthropic/claude-opus-4-8</code>                               | Third-Party Service |      100.00 |   0.00% |   0.00% |           2.38s |     $0.0095 |
| <code>anthropic/claude-sonnet-4-6</code>                             | Third-Party Service |      100.00 |   0.00% |   0.00% |           4.12s |     $0.0052 |
| <code>anthropic/claude-sonnet-5</code>                               | Third-Party Service |      100.00 |   0.00% |   0.00% |           2.04s |     $0.0038 |
| <code>deepinfra/google/gemma-3-27b-it</code>                         | Third-Party Service |      100.00 |   0.00% |   0.00% |           1.57s |     $0.0000 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     | Third-Party Service |      100.00 |   0.00% |   0.00% |           0.95s |     $0.0002 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service |      100.00 |   0.00% |   0.00% |           0.88s |     $0.0001 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              | Third-Party Service |      100.00 |   0.00% |   0.00% |           1.39s |     $0.0002 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                | Third-Party Service |       80.00 |  20.00% |  20.22% |           0.88s |     $0.0002 |
| <code>fal/fal-ai/florence-2-large/ocr</code>                         | Third-Party Service |       65.00 |  35.00% |  17.98% |           5.28s |     $0.0076 |
| <code>fal/fal-ai/got-ocr/v2</code>                                   | Third-Party Service |       95.00 |   5.00% |   6.74% |           5.34s |     $0.0500 |
| <code>gemini/gemini-3.1-flash-lite</code>                            | Third-Party Service |      100.00 |   0.00% |   0.00% |           1.38s |     $0.0004 |
| <code>gemini/gemini-3.1-flash-lite-preview</code>                    | Third-Party Service |      100.00 |   0.00% |   0.00% |           1.25s |     $0.0004 |
| <code>gemini/gemini-3.1-pro-preview</code>                           | Third-Party Service |      100.00 |   0.00% |   0.00% |           2.35s |     $0.0032 |
| <code>gemini/gemini-3.5-flash</code>                                 | Third-Party Service |      100.00 |   0.00% |   0.00% |           5.34s |     $0.0022 |
| <code>glm/glm-ocr</code>                                             | Third-Party Service |      100.00 |   0.00% |   0.00% |           1.27s |     $0.0000 |
| <code>grok/grok-4.20-0309-non-reasoning</code>                       | Third-Party Service |      100.00 |   0.00% |   0.00% |           0.55s |     $0.0015 |
| <code>grok/grok-4.3</code>                                           | Third-Party Service |      100.00 |   0.00% |   0.00% |           3.83s |     $0.0015 |
| <code>kimi/kimi-k2.6</code>                                          | Third-Party Service |      100.00 |   0.00% |   0.00% |           3.36s |     $0.0014 |
| <code>mistral/mistral-ocr-2512</code>                                | Third-Party Service |      100.00 |   0.00% |   0.00% |           0.63s |     $0.0020 |
| <code>mistral/mistral-ocr-4-0</code>                                 | Third-Party Service |      100.00 |   0.00% |   0.00% |           0.77s |     $0.0040 |
| <code>openai/gpt-5.4-mini</code>                                     | Third-Party Service |      100.00 |   0.00% |   0.00% |           1.32s |     $0.0010 |
| <code>openai/gpt-5.4-nano</code>                                     | Third-Party Service |      100.00 |   0.00% |   0.00% |           1.05s |     $0.0003 |
| <code>openai/gpt-5.5</code>                                          | Third-Party Service |      100.00 |   0.00% |   0.00% |           1.47s |     $0.0070 |
| <code>replicate/datalab-to/marker</code>                             | Third-Party Service |      100.00 |   0.00% |   0.00% |           5.28s |     $0.0040 |
| <code>replicate/datalab-to/ocr</code>                                | Third-Party Service |      100.00 |   0.00% |   0.00% |           7.02s |     $0.0020 |
| <code>replicate/lucataco/deepseek-ocr</code>                         | Third-Party Service |        0.00 | 225.00% | 201.12% |           2.87s |     $0.0033 |

## Error Breakdown (WER)

| Provider                                                             | Substitutions | Deletions | Insertions | Ref. Words |
| -------------------------------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>ocrmypdf</code>                                                |             0 |         0 |          0 |         20 |
| <code>paddle-ocr</code>                                              |             0 |         0 |          0 |         20 |
| <code>tesseract</code>                                               |             0 |         0 |          0 |         20 |
| <code>anthropic/claude-haiku-4-5</code>                              |             0 |         0 |          0 |         20 |
| <code>anthropic/claude-opus-4-8</code>                               |             0 |         0 |          0 |         20 |
| <code>anthropic/claude-sonnet-4-6</code>                             |             0 |         0 |          0 |         20 |
| <code>anthropic/claude-sonnet-5</code>                               |             0 |         0 |          0 |         20 |
| <code>deepinfra/google/gemma-3-27b-it</code>                         |             0 |         0 |          0 |         20 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     |             0 |         0 |          0 |         20 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> |             0 |         0 |          0 |         20 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              |             0 |         0 |          0 |         20 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                |             0 |         4 |          0 |         20 |
| <code>fal/fal-ai/florence-2-large/ocr</code>                         |             4 |         3 |          0 |         20 |
| <code>fal/fal-ai/got-ocr/v2</code>                                   |             0 |         0 |          1 |         20 |
| <code>gemini/gemini-3.1-flash-lite</code>                            |             0 |         0 |          0 |         20 |
| <code>gemini/gemini-3.1-flash-lite-preview</code>                    |             0 |         0 |          0 |         20 |
| <code>gemini/gemini-3.1-pro-preview</code>                           |             0 |         0 |          0 |         20 |
| <code>gemini/gemini-3.5-flash</code>                                 |             0 |         0 |          0 |         20 |
| <code>glm/glm-ocr</code>                                             |             0 |         0 |          0 |         20 |
| <code>grok/grok-4.20-0309-non-reasoning</code>                       |             0 |         0 |          0 |         20 |
| <code>grok/grok-4.3</code>                                           |             0 |         0 |          0 |         20 |
| <code>kimi/kimi-k2.6</code>                                          |             0 |         0 |          0 |         20 |
| <code>mistral/mistral-ocr-2512</code>                                |             0 |         0 |          0 |         20 |
| <code>mistral/mistral-ocr-4-0</code>                                 |             0 |         0 |          0 |         20 |
| <code>openai/gpt-5.4-mini</code>                                     |             0 |         0 |          0 |         20 |
| <code>openai/gpt-5.4-nano</code>                                     |             0 |         0 |          0 |         20 |
| <code>openai/gpt-5.5</code>                                          |             0 |         0 |          0 |         20 |
| <code>replicate/datalab-to/marker</code>                             |             0 |         0 |          0 |         20 |
| <code>replicate/datalab-to/ocr</code>                                |             0 |         0 |          0 |         20 |
| <code>replicate/lucataco/deepseek-ocr</code>                         |             0 |         0 |         45 |         20 |

## Notes

- Best local model: `ocrmypdf/ocrmypdf` scored 100.00/100.
- Best cloud service: `anthropic/claude-haiku-4-5` scored 100.00/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0010¢ ($0.0000).
- Fastest local model: `tesseract/tesseract` at 0.17s.
- Fastest cloud service: `grok/grok-4.20-0309-non-reasoning` at 0.55s.
