# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-06-14_01-28-29-201_document`
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

| Rank | Provider                |                     Value | Score / 100 |    WER |    CER | Processing Time | Actual Cost |
| ---: | ----------------------- | ------------------------: | ----------: | -----: | -----: | --------------: | ----------: |
|    1 | <code>ocrmypdf</code>   | $0.00 local monetary cost |       55.56 | 44.44% | 14.22% |           1.83s |       $0.00 |
|    2 | <code>paddle-ocr</code> | $0.00 local monetary cost |       62.96 | 37.04% |  4.33% |          10.49s |       $0.00 |
|    3 | <code>tesseract</code>  | $0.00 local monetary cost |       54.07 | 45.93% | 19.41% |           0.90s |       $0.00 |

#### Speed

| Rank | Provider                |  Value | Score / 100 |    WER |    CER | Processing Time | Actual Cost |
| ---: | ----------------------- | -----: | ----------: | -----: | -----: | --------------: | ----------: |
|    1 | <code>tesseract</code>  |  0.90s |       54.07 | 45.93% | 19.41% |           0.90s |       $0.00 |
|    2 | <code>ocrmypdf</code>   |  1.83s |       55.56 | 44.44% | 14.22% |           1.83s |       $0.00 |
|    3 | <code>paddle-ocr</code> | 10.49s |       62.96 | 37.04% |  4.33% |          10.49s |       $0.00 |

#### Quality Score

| Rank | Provider                |                   Value | Score / 100 |    WER |    CER | Processing Time | Actual Cost |
| ---: | ----------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | ----------: |
|    1 | <code>paddle-ocr</code> | 62.96/100 quality score |       62.96 | 37.04% |  4.33% |          10.49s |       $0.00 |
|    2 | <code>ocrmypdf</code>   | 55.56/100 quality score |       55.56 | 44.44% | 14.22% |           1.83s |       $0.00 |
|    3 | <code>tesseract</code>  | 54.07/100 quality score |       54.07 | 45.93% | 19.41% |           0.90s |       $0.00 |

### Third-Party Service

#### Price

| Rank | Provider                                                             |   Value | Score / 100 |     WER |    CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------------------------------- | ------: | ----------: | ------: | -----: | --------------: | ----------: |
|    1 | <code>deepinfra/google/gemma-3-27b-it</code>                         | $0.0001 |       65.19 |  34.81% |  9.52% |          21.98s |     $0.0001 |
|    2 | <code>glm/glm-ocr</code>                                             | $0.0001 |       65.19 |  34.81% |  6.55% |           2.55s |     $0.0001 |
|    3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0002 |       60.74 |  39.26% |  4.57% |          11.35s |     $0.0002 |
|    4 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     | $0.0003 |       70.37 |  29.63% |  4.57% |           6.82s |     $0.0003 |
|    5 | <code>gemini/gemini-3.1-flash-lite-preview</code>                    | $0.0007 |       72.59 |  27.41% |  3.34% |           2.24s |     $0.0007 |
|    6 | <code>gemini/gemini-3.1-flash-lite</code>                            | $0.0008 |       72.59 |  27.41% |  3.34% |           2.35s |     $0.0008 |
|    7 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                | $0.0009 |       69.63 |  30.37% |  4.08% |           7.87s |     $0.0009 |
|    8 | <code>openai/gpt-5.4-nano</code>                                     | $0.0009 |       58.52 |  41.48% |  7.54% |           2.93s |     $0.0009 |
|    9 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              | $0.0012 |       70.37 |  29.63% |  4.20% |          10.67s |     $0.0012 |
|   10 | <code>mistral/mistral-ocr-2512</code>                                | $0.0020 |       53.33 |  46.67% | 11.00% |           1.39s |     $0.0020 |
|   11 | <code>replicate/datalab-to/ocr</code>                                | $0.0020 |       72.59 |  27.41% |  3.58% |           5.13s |     $0.0020 |
|   12 | <code>replicate/lucataco/deepseek-ocr</code>                         | $0.0033 |       35.56 |  64.44% | 31.15% |           9.26s |     $0.0033 |
|   13 | <code>openai/gpt-5.4-mini</code>                                     | $0.0034 |       71.11 |  28.89% |  4.33% |           2.88s |     $0.0034 |
|   14 | <code>anthropic/claude-haiku-4-5</code>                              | $0.0035 |       74.81 |  25.19% |  3.71% |           9.36s |     $0.0035 |
|   15 | <code>grok/grok-4.3</code>                                           | $0.0038 |       73.33 |  26.67% |  3.46% |          13.10s |     $0.0038 |
|   16 | <code>grok/grok-4.20-0309-non-reasoning</code>                       | $0.0039 |       90.37 |   9.63% |  1.48% |           2.81s |     $0.0039 |
|   17 | <code>mistral/mistral-ocr-4-0</code>                                 | $0.0040 |       65.93 |  34.07% |  8.53% |           2.05s |     $0.0040 |
|   18 | <code>replicate/datalab-to/marker</code>                             | $0.0040 |        0.00 | 113.33% | 90.85% |           8.11s |     $0.0040 |
|   19 | <code>gemini/gemini-3.5-flash</code>                                 | $0.0046 |       74.07 |  25.93% |  3.21% |          16.52s |     $0.0046 |
|   20 | <code>kimi/kimi-k2.6</code>                                          | $0.0054 |       98.52 |   1.48% |  0.25% |           8.69s |     $0.0054 |
|   21 | <code>gemini/gemini-3.1-pro-preview</code>                           | $0.0061 |       74.07 |  25.93% |  3.21% |           4.54s |     $0.0061 |
|   22 | <code>fal/fal-ai/florence-2-large/ocr</code>                         | $0.0076 |       58.52 |  41.48% |  8.03% |          10.35s |     $0.0076 |
|   23 | <code>anthropic/claude-sonnet-4-6</code>                             | $0.0113 |       90.37 |   9.63% |  1.24% |          15.87s |     $0.0113 |
|   24 | <code>anthropic/claude-sonnet-5</code>                               | $0.0141 |       62.22 |  37.78% |  4.70% |           9.00s |     $0.0141 |
|   25 | <code>anthropic/claude-opus-4-8</code>                               | $0.0367 |       74.07 |  25.93% |  3.21% |          15.77s |     $0.0367 |
|   26 | <code>fal/fal-ai/got-ocr/v2</code>                                   | $0.0500 |       54.81 |  45.19% |  8.16% |          10.38s |     $0.0500 |
|   27 | <code>openai/gpt-5.5</code>                                          | $0.1168 |      100.00 |   0.00% |  0.00% |          49.88s |     $0.1168 |

#### Speed

| Rank | Provider                                                             |  Value | Score / 100 |     WER |    CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------------------------------- | -----: | ----------: | ------: | -----: | --------------: | ----------: |
|    1 | <code>mistral/mistral-ocr-2512</code>                                |  1.39s |       53.33 |  46.67% | 11.00% |           1.39s |     $0.0020 |
|    2 | <code>mistral/mistral-ocr-4-0</code>                                 |  2.05s |       65.93 |  34.07% |  8.53% |           2.05s |     $0.0040 |
|    3 | <code>gemini/gemini-3.1-flash-lite-preview</code>                    |  2.24s |       72.59 |  27.41% |  3.34% |           2.24s |     $0.0007 |
|    4 | <code>gemini/gemini-3.1-flash-lite</code>                            |  2.35s |       72.59 |  27.41% |  3.34% |           2.35s |     $0.0008 |
|    5 | <code>glm/glm-ocr</code>                                             |  2.55s |       65.19 |  34.81% |  6.55% |           2.55s |     $0.0001 |
|    6 | <code>grok/grok-4.20-0309-non-reasoning</code>                       |  2.81s |       90.37 |   9.63% |  1.48% |           2.81s |     $0.0039 |
|    7 | <code>openai/gpt-5.4-mini</code>                                     |  2.88s |       71.11 |  28.89% |  4.33% |           2.88s |     $0.0034 |
|    8 | <code>openai/gpt-5.4-nano</code>                                     |  2.93s |       58.52 |  41.48% |  7.54% |           2.93s |     $0.0009 |
|    9 | <code>gemini/gemini-3.1-pro-preview</code>                           |  4.54s |       74.07 |  25.93% |  3.21% |           4.54s |     $0.0061 |
|   10 | <code>replicate/datalab-to/ocr</code>                                |  5.13s |       72.59 |  27.41% |  3.58% |           5.13s |     $0.0020 |
|   11 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     |  6.82s |       70.37 |  29.63% |  4.57% |           6.82s |     $0.0003 |
|   12 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                |  7.87s |       69.63 |  30.37% |  4.08% |           7.87s |     $0.0009 |
|   13 | <code>replicate/datalab-to/marker</code>                             |  8.11s |        0.00 | 113.33% | 90.85% |           8.11s |     $0.0040 |
|   14 | <code>kimi/kimi-k2.6</code>                                          |  8.69s |       98.52 |   1.48% |  0.25% |           8.69s |     $0.0054 |
|   15 | <code>anthropic/claude-sonnet-5</code>                               |  9.00s |       62.22 |  37.78% |  4.70% |           9.00s |     $0.0141 |
|   16 | <code>replicate/lucataco/deepseek-ocr</code>                         |  9.26s |       35.56 |  64.44% | 31.15% |           9.26s |     $0.0033 |
|   17 | <code>anthropic/claude-haiku-4-5</code>                              |  9.36s |       74.81 |  25.19% |  3.71% |           9.36s |     $0.0035 |
|   18 | <code>fal/fal-ai/florence-2-large/ocr</code>                         | 10.35s |       58.52 |  41.48% |  8.03% |          10.35s |     $0.0076 |
|   19 | <code>fal/fal-ai/got-ocr/v2</code>                                   | 10.38s |       54.81 |  45.19% |  8.16% |          10.38s |     $0.0500 |
|   20 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              | 10.67s |       70.37 |  29.63% |  4.20% |          10.67s |     $0.0012 |
|   21 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 11.35s |       60.74 |  39.26% |  4.57% |          11.35s |     $0.0002 |
|   22 | <code>grok/grok-4.3</code>                                           | 13.10s |       73.33 |  26.67% |  3.46% |          13.10s |     $0.0038 |
|   23 | <code>anthropic/claude-opus-4-8</code>                               | 15.77s |       74.07 |  25.93% |  3.21% |          15.77s |     $0.0367 |
|   24 | <code>anthropic/claude-sonnet-4-6</code>                             | 15.87s |       90.37 |   9.63% |  1.24% |          15.87s |     $0.0113 |
|   25 | <code>gemini/gemini-3.5-flash</code>                                 | 16.52s |       74.07 |  25.93% |  3.21% |          16.52s |     $0.0046 |
|   26 | <code>deepinfra/google/gemma-3-27b-it</code>                         | 21.98s |       65.19 |  34.81% |  9.52% |          21.98s |     $0.0001 |
|   27 | <code>openai/gpt-5.5</code>                                          | 49.88s |      100.00 |   0.00% |  0.00% |          49.88s |     $0.1168 |

#### Quality Score

| Rank | Provider                                                             |                    Value | Score / 100 |     WER |    CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------------------------------- | -----------------------: | ----------: | ------: | -----: | --------------: | ----------: |
|    1 | <code>openai/gpt-5.5</code>                                          | 100.00/100 quality score |      100.00 |   0.00% |  0.00% |          49.88s |     $0.1168 |
|    2 | <code>kimi/kimi-k2.6</code>                                          |  98.52/100 quality score |       98.52 |   1.48% |  0.25% |           8.69s |     $0.0054 |
|    3 | <code>anthropic/claude-sonnet-4-6</code>                             |  90.37/100 quality score |       90.37 |   9.63% |  1.24% |          15.87s |     $0.0113 |
|    4 | <code>grok/grok-4.20-0309-non-reasoning</code>                       |  90.37/100 quality score |       90.37 |   9.63% |  1.48% |           2.81s |     $0.0039 |
|    5 | <code>anthropic/claude-haiku-4-5</code>                              |  74.81/100 quality score |       74.81 |  25.19% |  3.71% |           9.36s |     $0.0035 |
|    6 | <code>anthropic/claude-opus-4-8</code>                               |  74.07/100 quality score |       74.07 |  25.93% |  3.21% |          15.77s |     $0.0367 |
|    7 | <code>gemini/gemini-3.1-pro-preview</code>                           |  74.07/100 quality score |       74.07 |  25.93% |  3.21% |           4.54s |     $0.0061 |
|    8 | <code>gemini/gemini-3.5-flash</code>                                 |  74.07/100 quality score |       74.07 |  25.93% |  3.21% |          16.52s |     $0.0046 |
|    9 | <code>grok/grok-4.3</code>                                           |  73.33/100 quality score |       73.33 |  26.67% |  3.46% |          13.10s |     $0.0038 |
|   10 | <code>gemini/gemini-3.1-flash-lite</code>                            |  72.59/100 quality score |       72.59 |  27.41% |  3.34% |           2.35s |     $0.0008 |
|   11 | <code>gemini/gemini-3.1-flash-lite-preview</code>                    |  72.59/100 quality score |       72.59 |  27.41% |  3.34% |           2.24s |     $0.0007 |
|   12 | <code>replicate/datalab-to/ocr</code>                                |  72.59/100 quality score |       72.59 |  27.41% |  3.58% |           5.13s |     $0.0020 |
|   13 | <code>openai/gpt-5.4-mini</code>                                     |  71.11/100 quality score |       71.11 |  28.89% |  4.33% |           2.88s |     $0.0034 |
|   14 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              |  70.37/100 quality score |       70.37 |  29.63% |  4.20% |          10.67s |     $0.0012 |
|   15 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     |  70.37/100 quality score |       70.37 |  29.63% |  4.57% |           6.82s |     $0.0003 |
|   16 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                |  69.63/100 quality score |       69.63 |  30.37% |  4.08% |           7.87s |     $0.0009 |
|   17 | <code>mistral/mistral-ocr-4-0</code>                                 |  65.93/100 quality score |       65.93 |  34.07% |  8.53% |           2.05s |     $0.0040 |
|   18 | <code>glm/glm-ocr</code>                                             |  65.19/100 quality score |       65.19 |  34.81% |  6.55% |           2.55s |     $0.0001 |
|   19 | <code>deepinfra/google/gemma-3-27b-it</code>                         |  65.19/100 quality score |       65.19 |  34.81% |  9.52% |          21.98s |     $0.0001 |
|   20 | <code>anthropic/claude-sonnet-5</code>                               |  62.22/100 quality score |       62.22 |  37.78% |  4.70% |           9.00s |     $0.0141 |
|   21 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> |  60.74/100 quality score |       60.74 |  39.26% |  4.57% |          11.35s |     $0.0002 |
|   22 | <code>openai/gpt-5.4-nano</code>                                     |  58.52/100 quality score |       58.52 |  41.48% |  7.54% |           2.93s |     $0.0009 |
|   23 | <code>fal/fal-ai/florence-2-large/ocr</code>                         |  58.52/100 quality score |       58.52 |  41.48% |  8.03% |          10.35s |     $0.0076 |
|   24 | <code>fal/fal-ai/got-ocr/v2</code>                                   |  54.81/100 quality score |       54.81 |  45.19% |  8.16% |          10.38s |     $0.0500 |
|   25 | <code>mistral/mistral-ocr-2512</code>                                |  53.33/100 quality score |       53.33 |  46.67% | 11.00% |           1.39s |     $0.0020 |
|   26 | <code>replicate/lucataco/deepseek-ocr</code>                         |  35.56/100 quality score |       35.56 |  64.44% | 31.15% |           9.26s |     $0.0033 |
|   27 | <code>replicate/datalab-to/marker</code>                             |   0.00/100 quality score |        0.00 | 113.33% | 90.85% |           8.11s |     $0.0040 |


## Provider Detail

| Provider                                                             | Group               | Score / 100 |     WER |    CER | Processing Time | Actual Cost |
| -------------------------------------------------------------------- | ------------------- | ----------: | ------: | -----: | --------------: | ----------: |
| <code>ocrmypdf</code>                                                | Local               |       55.56 |  44.44% | 14.22% |           1.83s |       $0.00 |
| <code>paddle-ocr</code>                                              | Local               |       62.96 |  37.04% |  4.33% |          10.49s |       $0.00 |
| <code>tesseract</code>                                               | Local               |       54.07 |  45.93% | 19.41% |           0.90s |       $0.00 |
| <code>anthropic/claude-haiku-4-5</code>                              | Third-Party Service |       74.81 |  25.19% |  3.71% |           9.36s |     $0.0035 |
| <code>anthropic/claude-opus-4-8</code>                               | Third-Party Service |       74.07 |  25.93% |  3.21% |          15.77s |     $0.0367 |
| <code>anthropic/claude-sonnet-4-6</code>                             | Third-Party Service |       90.37 |   9.63% |  1.24% |          15.87s |     $0.0113 |
| <code>anthropic/claude-sonnet-5</code>                               | Third-Party Service |       62.22 |  37.78% |  4.70% |           9.00s |     $0.0141 |
| <code>deepinfra/google/gemma-3-27b-it</code>                         | Third-Party Service |       65.19 |  34.81% |  9.52% |          21.98s |     $0.0001 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     | Third-Party Service |       70.37 |  29.63% |  4.57% |           6.82s |     $0.0003 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service |       60.74 |  39.26% |  4.57% |          11.35s |     $0.0002 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              | Third-Party Service |       70.37 |  29.63% |  4.20% |          10.67s |     $0.0012 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                | Third-Party Service |       69.63 |  30.37% |  4.08% |           7.87s |     $0.0009 |
| <code>fal/fal-ai/florence-2-large/ocr</code>                         | Third-Party Service |       58.52 |  41.48% |  8.03% |          10.35s |     $0.0076 |
| <code>fal/fal-ai/got-ocr/v2</code>                                   | Third-Party Service |       54.81 |  45.19% |  8.16% |          10.38s |     $0.0500 |
| <code>gemini/gemini-3.1-flash-lite</code>                            | Third-Party Service |       72.59 |  27.41% |  3.34% |           2.35s |     $0.0008 |
| <code>gemini/gemini-3.1-flash-lite-preview</code>                    | Third-Party Service |       72.59 |  27.41% |  3.34% |           2.24s |     $0.0007 |
| <code>gemini/gemini-3.1-pro-preview</code>                           | Third-Party Service |       74.07 |  25.93% |  3.21% |           4.54s |     $0.0061 |
| <code>gemini/gemini-3.5-flash</code>                                 | Third-Party Service |       74.07 |  25.93% |  3.21% |          16.52s |     $0.0046 |
| <code>glm/glm-ocr</code>                                             | Third-Party Service |       65.19 |  34.81% |  6.55% |           2.55s |     $0.0001 |
| <code>grok/grok-4.20-0309-non-reasoning</code>                       | Third-Party Service |       90.37 |   9.63% |  1.48% |           2.81s |     $0.0039 |
| <code>grok/grok-4.3</code>                                           | Third-Party Service |       73.33 |  26.67% |  3.46% |          13.10s |     $0.0038 |
| <code>kimi/kimi-k2.6</code>                                          | Third-Party Service |       98.52 |   1.48% |  0.25% |           8.69s |     $0.0054 |
| <code>mistral/mistral-ocr-2512</code>                                | Third-Party Service |       53.33 |  46.67% | 11.00% |           1.39s |     $0.0020 |
| <code>mistral/mistral-ocr-4-0</code>                                 | Third-Party Service |       65.93 |  34.07% |  8.53% |           2.05s |     $0.0040 |
| <code>openai/gpt-5.4-mini</code>                                     | Third-Party Service |       71.11 |  28.89% |  4.33% |           2.88s |     $0.0034 |
| <code>openai/gpt-5.4-nano</code>                                     | Third-Party Service |       58.52 |  41.48% |  7.54% |           2.93s |     $0.0009 |
| <code>openai/gpt-5.5</code>                                          | Third-Party Service |      100.00 |   0.00% |  0.00% |          49.88s |     $0.1168 |
| <code>replicate/datalab-to/marker</code>                             | Third-Party Service |        0.00 | 113.33% | 90.85% |           8.11s |     $0.0040 |
| <code>replicate/datalab-to/ocr</code>                                | Third-Party Service |       72.59 |  27.41% |  3.58% |           5.13s |     $0.0020 |
| <code>replicate/lucataco/deepseek-ocr</code>                         | Third-Party Service |       35.56 |  64.44% | 31.15% |           9.26s |     $0.0033 |

## Error Breakdown (WER)

| Provider                                                             | Substitutions | Deletions | Insertions | Ref. Words |
| -------------------------------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>ocrmypdf</code>                                                |            35 |        24 |          1 |        135 |
| <code>paddle-ocr</code>                                              |            28 |        22 |          0 |        135 |
| <code>tesseract</code>                                               |            29 |        33 |          0 |        135 |
| <code>anthropic/claude-haiku-4-5</code>                              |            21 |        13 |          0 |        135 |
| <code>anthropic/claude-opus-4-8</code>                               |            21 |        14 |          0 |        135 |
| <code>anthropic/claude-sonnet-4-6</code>                             |             8 |         1 |          4 |        135 |
| <code>anthropic/claude-sonnet-5</code>                               |            29 |        22 |          0 |        135 |
| <code>deepinfra/google/gemma-3-27b-it</code>                         |            26 |        20 |          1 |        135 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     |            27 |        13 |          0 |        135 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> |            29 |        24 |          0 |        135 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              |            28 |        11 |          1 |        135 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                |            26 |        14 |          1 |        135 |
| <code>fal/fal-ai/florence-2-large/ocr</code>                         |            39 |        16 |          1 |        135 |
| <code>fal/fal-ai/got-ocr/v2</code>                                   |            38 |        23 |          0 |        135 |
| <code>gemini/gemini-3.1-flash-lite</code>                            |            22 |        14 |          1 |        135 |
| <code>gemini/gemini-3.1-flash-lite-preview</code>                    |            22 |        14 |          1 |        135 |
| <code>gemini/gemini-3.1-pro-preview</code>                           |            21 |        14 |          0 |        135 |
| <code>gemini/gemini-3.5-flash</code>                                 |            21 |        14 |          0 |        135 |
| <code>glm/glm-ocr</code>                                             |            32 |        15 |          0 |        135 |
| <code>grok/grok-4.20-0309-non-reasoning</code>                       |             8 |         1 |          4 |        135 |
| <code>grok/grok-4.3</code>                                           |            22 |        14 |          0 |        135 |
| <code>kimi/kimi-k2.6</code>                                          |             1 |         0 |          1 |        135 |
| <code>mistral/mistral-ocr-2512</code>                                |            37 |        17 |          9 |        135 |
| <code>mistral/mistral-ocr-4-0</code>                                 |            22 |        12 |         12 |        135 |
| <code>openai/gpt-5.4-mini</code>                                     |            24 |        15 |          0 |        135 |
| <code>openai/gpt-5.4-nano</code>                                     |            40 |        15 |          1 |        135 |
| <code>openai/gpt-5.5</code>                                          |             0 |         0 |          0 |        135 |
| <code>replicate/datalab-to/marker</code>                             |            36 |        18 |         99 |        135 |
| <code>replicate/datalab-to/ocr</code>                                |            24 |        12 |          1 |        135 |
| <code>replicate/lucataco/deepseek-ocr</code>                         |            22 |        12 |         53 |        135 |

## Notes

- Best local model: `paddle-ocr/paddle-ocr` scored 62.96/100.
- Best cloud service: `openai/gpt-5.5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-3-27b-it` at 0.0072¢ ($0.0001).
- Fastest local model: `tesseract/tesseract` at 0.90s.
- Fastest cloud service: `mistral/mistral-ocr-2512` at 1.39s.
