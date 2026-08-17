# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-06-14_01-22-40-317_document`
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
|    1 | <code>ocrmypdf</code>   | $0.00 local monetary cost |       34.92 | 65.08% | 68.97% |           0.94s |       $0.00 |
|    2 | <code>paddle-ocr</code> | $0.00 local monetary cost |       38.10 | 61.90% | 40.26% |           7.99s |       $0.00 |
|    3 | <code>tesseract</code>  | $0.00 local monetary cost |       28.57 | 71.43% | 67.18% |           0.22s |       $0.00 |

#### Speed

| Rank | Provider                | Value | Score / 100 |    WER |    CER | Processing Time | Actual Cost |
| ---: | ----------------------- | ----: | ----------: | -----: | -----: | --------------: | ----------: |
|    1 | <code>tesseract</code>  | 0.22s |       28.57 | 71.43% | 67.18% |           0.22s |       $0.00 |
|    2 | <code>ocrmypdf</code>   | 0.94s |       34.92 | 65.08% | 68.97% |           0.94s |       $0.00 |
|    3 | <code>paddle-ocr</code> | 7.99s |       38.10 | 61.90% | 40.26% |           7.99s |       $0.00 |

#### Quality Score

| Rank | Provider                |                   Value | Score / 100 |    WER |    CER | Processing Time | Actual Cost |
| ---: | ----------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | ----------: |
|    1 | <code>paddle-ocr</code> | 38.10/100 quality score |       38.10 | 61.90% | 40.26% |           7.99s |       $0.00 |
|    2 | <code>ocrmypdf</code>   | 34.92/100 quality score |       34.92 | 65.08% | 68.97% |           0.94s |       $0.00 |
|    3 | <code>tesseract</code>  | 28.57/100 quality score |       28.57 | 71.43% | 67.18% |           0.22s |       $0.00 |

### Third-Party Service

#### Price

| Rank | Provider                                                             |   Value | Score / 100 |      WER |      CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------------------------------- | ------: | ----------: | -------: | -------: | --------------: | ----------: |
|    1 | <code>glm/glm-ocr</code>                                             | $0.0000 |       42.86 |   57.14% |   60.26% |           1.77s |     $0.0000 |
|    2 | <code>deepinfra/google/gemma-3-27b-it</code>                         | $0.0000 |       80.95 |   19.05% |   15.38% |           6.56s |     $0.0000 |
|    3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0001 |       98.41 |    1.59% |    1.28% |           3.05s |     $0.0001 |
|    4 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     | $0.0001 |       90.48 |    9.52% |    7.95% |           3.14s |     $0.0001 |
|    5 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                | $0.0002 |       87.30 |   12.70% |    7.69% |           3.98s |     $0.0002 |
|    6 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              | $0.0002 |       90.48 |    9.52% |    7.18% |           3.56s |     $0.0002 |
|    7 | <code>openai/gpt-5.4-nano</code>                                     | $0.0003 |       74.60 |   25.40% |   15.13% |           1.53s |     $0.0003 |
|    8 | <code>gemini/gemini-3.1-flash-lite</code>                            | $0.0005 |       84.13 |   15.87% |   13.08% |           1.69s |     $0.0005 |
|    9 | <code>gemini/gemini-3.1-flash-lite-preview</code>                    | $0.0005 |       98.41 |    1.59% |    0.26% |           1.67s |     $0.0005 |
|   10 | <code>openai/gpt-5.4-mini</code>                                     | $0.0011 |       93.65 |    6.35% |    3.85% |           1.67s |     $0.0011 |
|   11 | <code>grok/grok-4.20-0309-non-reasoning</code>                       | $0.0012 |       92.06 |    7.94% |    6.67% |           0.85s |     $0.0012 |
|   12 | <code>grok/grok-4.3</code>                                           | $0.0012 |       92.06 |    7.94% |    6.67% |           5.81s |     $0.0012 |
|   13 | <code>kimi/kimi-k2.6</code>                                          | $0.0013 |       92.06 |    7.94% |    4.87% |           6.23s |     $0.0013 |
|   14 | <code>anthropic/claude-haiku-4-5</code>                              | $0.0019 |       92.06 |    7.94% |    6.92% |           3.10s |     $0.0019 |
|   15 | <code>mistral/mistral-ocr-2512</code>                                | $0.0020 |       74.60 |   25.40% |   19.74% |           1.29s |     $0.0020 |
|   16 | <code>replicate/datalab-to/ocr</code>                                | $0.0020 |       57.14 |   42.86% |   30.26% |           5.14s |     $0.0020 |
|   17 | <code>replicate/lucataco/deepseek-ocr</code>                         | $0.0033 |        0.00 |  106.35% |   69.49% |          70.74s |     $0.0033 |
|   18 | <code>gemini/gemini-3.5-flash</code>                                 | $0.0033 |       92.06 |    7.94% |    4.87% |           7.93s |     $0.0033 |
|   19 | <code>mistral/mistral-ocr-4-0</code>                                 | $0.0040 |       74.60 |   25.40% |   20.00% |           1.63s |     $0.0040 |
|   20 | <code>replicate/datalab-to/marker</code>                             | $0.0040 |       90.48 |    9.52% |    7.18% |           9.84s |     $0.0040 |
|   21 | <code>gemini/gemini-3.1-pro-preview</code>                           | $0.0044 |       98.41 |    1.59% |    0.26% |           3.16s |     $0.0044 |
|   22 | <code>anthropic/claude-sonnet-5</code>                               | $0.0046 |      100.00 |    0.00% |    0.00% |           4.27s |     $0.0046 |
|   23 | <code>anthropic/claude-sonnet-4-6</code>                             | $0.0060 |       96.83 |    3.17% |    2.56% |           7.44s |     $0.0060 |
|   24 | <code>fal/fal-ai/florence-2-large/ocr</code>                         | $0.0076 |       65.08 |   34.92% |   24.87% |           5.35s |     $0.0076 |
|   25 | <code>anthropic/claude-opus-4-8</code>                               | $0.0116 |       90.48 |    9.52% |    7.18% |           6.42s |     $0.0116 |
|   26 | <code>openai/gpt-5.5</code>                                          | $0.0224 |       98.41 |    1.59% |    2.05% |           9.57s |     $0.0224 |
|   27 | <code>fal/fal-ai/got-ocr/v2</code>                                   | $0.0500 |        0.00 | 1344.44% | 1045.90% |          90.93s |     $0.0500 |

#### Speed

| Rank | Provider                                                             |  Value | Score / 100 |      WER |      CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------------------------------- | -----: | ----------: | -------: | -------: | --------------: | ----------: |
|    1 | <code>grok/grok-4.20-0309-non-reasoning</code>                       |  0.85s |       92.06 |    7.94% |    6.67% |           0.85s |     $0.0012 |
|    2 | <code>mistral/mistral-ocr-2512</code>                                |  1.29s |       74.60 |   25.40% |   19.74% |           1.29s |     $0.0020 |
|    3 | <code>openai/gpt-5.4-nano</code>                                     |  1.53s |       74.60 |   25.40% |   15.13% |           1.53s |     $0.0003 |
|    4 | <code>mistral/mistral-ocr-4-0</code>                                 |  1.63s |       74.60 |   25.40% |   20.00% |           1.63s |     $0.0040 |
|    5 | <code>openai/gpt-5.4-mini</code>                                     |  1.67s |       93.65 |    6.35% |    3.85% |           1.67s |     $0.0011 |
|    6 | <code>gemini/gemini-3.1-flash-lite-preview</code>                    |  1.67s |       98.41 |    1.59% |    0.26% |           1.67s |     $0.0005 |
|    7 | <code>gemini/gemini-3.1-flash-lite</code>                            |  1.69s |       84.13 |   15.87% |   13.08% |           1.69s |     $0.0005 |
|    8 | <code>glm/glm-ocr</code>                                             |  1.77s |       42.86 |   57.14% |   60.26% |           1.77s |     $0.0000 |
|    9 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> |  3.05s |       98.41 |    1.59% |    1.28% |           3.05s |     $0.0001 |
|   10 | <code>anthropic/claude-haiku-4-5</code>                              |  3.10s |       92.06 |    7.94% |    6.92% |           3.10s |     $0.0019 |
|   11 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     |  3.14s |       90.48 |    9.52% |    7.95% |           3.14s |     $0.0001 |
|   12 | <code>gemini/gemini-3.1-pro-preview</code>                           |  3.16s |       98.41 |    1.59% |    0.26% |           3.16s |     $0.0044 |
|   13 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              |  3.56s |       90.48 |    9.52% |    7.18% |           3.56s |     $0.0002 |
|   14 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                |  3.98s |       87.30 |   12.70% |    7.69% |           3.98s |     $0.0002 |
|   15 | <code>anthropic/claude-sonnet-5</code>                               |  4.27s |      100.00 |    0.00% |    0.00% |           4.27s |     $0.0046 |
|   16 | <code>replicate/datalab-to/ocr</code>                                |  5.14s |       57.14 |   42.86% |   30.26% |           5.14s |     $0.0020 |
|   17 | <code>fal/fal-ai/florence-2-large/ocr</code>                         |  5.35s |       65.08 |   34.92% |   24.87% |           5.35s |     $0.0076 |
|   18 | <code>grok/grok-4.3</code>                                           |  5.81s |       92.06 |    7.94% |    6.67% |           5.81s |     $0.0012 |
|   19 | <code>kimi/kimi-k2.6</code>                                          |  6.23s |       92.06 |    7.94% |    4.87% |           6.23s |     $0.0013 |
|   20 | <code>anthropic/claude-opus-4-8</code>                               |  6.42s |       90.48 |    9.52% |    7.18% |           6.42s |     $0.0116 |
|   21 | <code>deepinfra/google/gemma-3-27b-it</code>                         |  6.56s |       80.95 |   19.05% |   15.38% |           6.56s |     $0.0000 |
|   22 | <code>anthropic/claude-sonnet-4-6</code>                             |  7.44s |       96.83 |    3.17% |    2.56% |           7.44s |     $0.0060 |
|   23 | <code>gemini/gemini-3.5-flash</code>                                 |  7.93s |       92.06 |    7.94% |    4.87% |           7.93s |     $0.0033 |
|   24 | <code>openai/gpt-5.5</code>                                          |  9.57s |       98.41 |    1.59% |    2.05% |           9.57s |     $0.0224 |
|   25 | <code>replicate/datalab-to/marker</code>                             |  9.84s |       90.48 |    9.52% |    7.18% |           9.84s |     $0.0040 |
|   26 | <code>replicate/lucataco/deepseek-ocr</code>                         | 70.74s |        0.00 |  106.35% |   69.49% |          70.74s |     $0.0033 |
|   27 | <code>fal/fal-ai/got-ocr/v2</code>                                   | 90.93s |        0.00 | 1344.44% | 1045.90% |          90.93s |     $0.0500 |

#### Quality Score

| Rank | Provider                                                             |                    Value | Score / 100 |      WER |      CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------------------------------- | -----------------------: | ----------: | -------: | -------: | --------------: | ----------: |
|    1 | <code>anthropic/claude-sonnet-5</code>                               | 100.00/100 quality score |      100.00 |    0.00% |    0.00% |           4.27s |     $0.0046 |
|    2 | <code>gemini/gemini-3.1-flash-lite-preview</code>                    |  98.41/100 quality score |       98.41 |    1.59% |    0.26% |           1.67s |     $0.0005 |
|    3 | <code>gemini/gemini-3.1-pro-preview</code>                           |  98.41/100 quality score |       98.41 |    1.59% |    0.26% |           3.16s |     $0.0044 |
|    4 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> |  98.41/100 quality score |       98.41 |    1.59% |    1.28% |           3.05s |     $0.0001 |
|    5 | <code>openai/gpt-5.5</code>                                          |  98.41/100 quality score |       98.41 |    1.59% |    2.05% |           9.57s |     $0.0224 |
|    6 | <code>anthropic/claude-sonnet-4-6</code>                             |  96.83/100 quality score |       96.83 |    3.17% |    2.56% |           7.44s |     $0.0060 |
|    7 | <code>openai/gpt-5.4-mini</code>                                     |  93.65/100 quality score |       93.65 |    6.35% |    3.85% |           1.67s |     $0.0011 |
|    8 | <code>gemini/gemini-3.5-flash</code>                                 |  92.06/100 quality score |       92.06 |    7.94% |    4.87% |           7.93s |     $0.0033 |
|    9 | <code>kimi/kimi-k2.6</code>                                          |  92.06/100 quality score |       92.06 |    7.94% |    4.87% |           6.23s |     $0.0013 |
|   10 | <code>grok/grok-4.20-0309-non-reasoning</code>                       |  92.06/100 quality score |       92.06 |    7.94% |    6.67% |           0.85s |     $0.0012 |
|   11 | <code>grok/grok-4.3</code>                                           |  92.06/100 quality score |       92.06 |    7.94% |    6.67% |           5.81s |     $0.0012 |
|   12 | <code>anthropic/claude-haiku-4-5</code>                              |  92.06/100 quality score |       92.06 |    7.94% |    6.92% |           3.10s |     $0.0019 |
|   13 | <code>anthropic/claude-opus-4-8</code>                               |  90.48/100 quality score |       90.48 |    9.52% |    7.18% |           6.42s |     $0.0116 |
|   14 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              |  90.48/100 quality score |       90.48 |    9.52% |    7.18% |           3.56s |     $0.0002 |
|   15 | <code>replicate/datalab-to/marker</code>                             |  90.48/100 quality score |       90.48 |    9.52% |    7.18% |           9.84s |     $0.0040 |
|   16 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     |  90.48/100 quality score |       90.48 |    9.52% |    7.95% |           3.14s |     $0.0001 |
|   17 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                |  87.30/100 quality score |       87.30 |   12.70% |    7.69% |           3.98s |     $0.0002 |
|   18 | <code>gemini/gemini-3.1-flash-lite</code>                            |  84.13/100 quality score |       84.13 |   15.87% |   13.08% |           1.69s |     $0.0005 |
|   19 | <code>deepinfra/google/gemma-3-27b-it</code>                         |  80.95/100 quality score |       80.95 |   19.05% |   15.38% |           6.56s |     $0.0000 |
|   20 | <code>openai/gpt-5.4-nano</code>                                     |  74.60/100 quality score |       74.60 |   25.40% |   15.13% |           1.53s |     $0.0003 |
|   21 | <code>mistral/mistral-ocr-2512</code>                                |  74.60/100 quality score |       74.60 |   25.40% |   19.74% |           1.29s |     $0.0020 |
|   22 | <code>mistral/mistral-ocr-4-0</code>                                 |  74.60/100 quality score |       74.60 |   25.40% |   20.00% |           1.63s |     $0.0040 |
|   23 | <code>fal/fal-ai/florence-2-large/ocr</code>                         |  65.08/100 quality score |       65.08 |   34.92% |   24.87% |           5.35s |     $0.0076 |
|   24 | <code>replicate/datalab-to/ocr</code>                                |  57.14/100 quality score |       57.14 |   42.86% |   30.26% |           5.14s |     $0.0020 |
|   25 | <code>glm/glm-ocr</code>                                             |  42.86/100 quality score |       42.86 |   57.14% |   60.26% |           1.77s |     $0.0000 |
|   26 | <code>replicate/lucataco/deepseek-ocr</code>                         |   0.00/100 quality score |        0.00 |  106.35% |   69.49% |          70.74s |     $0.0033 |
|   27 | <code>fal/fal-ai/got-ocr/v2</code>                                   |   0.00/100 quality score |        0.00 | 1344.44% | 1045.90% |          90.93s |     $0.0500 |


## Provider Detail

| Provider                                                             | Group               | Score / 100 |      WER |      CER | Processing Time | Actual Cost |
| -------------------------------------------------------------------- | ------------------- | ----------: | -------: | -------: | --------------: | ----------: |
| <code>ocrmypdf</code>                                                | Local               |       34.92 |   65.08% |   68.97% |           0.94s |       $0.00 |
| <code>paddle-ocr</code>                                              | Local               |       38.10 |   61.90% |   40.26% |           7.99s |       $0.00 |
| <code>tesseract</code>                                               | Local               |       28.57 |   71.43% |   67.18% |           0.22s |       $0.00 |
| <code>anthropic/claude-haiku-4-5</code>                              | Third-Party Service |       92.06 |    7.94% |    6.92% |           3.10s |     $0.0019 |
| <code>anthropic/claude-opus-4-8</code>                               | Third-Party Service |       90.48 |    9.52% |    7.18% |           6.42s |     $0.0116 |
| <code>anthropic/claude-sonnet-4-6</code>                             | Third-Party Service |       96.83 |    3.17% |    2.56% |           7.44s |     $0.0060 |
| <code>anthropic/claude-sonnet-5</code>                               | Third-Party Service |      100.00 |    0.00% |    0.00% |           4.27s |     $0.0046 |
| <code>deepinfra/google/gemma-3-27b-it</code>                         | Third-Party Service |       80.95 |   19.05% |   15.38% |           6.56s |     $0.0000 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     | Third-Party Service |       90.48 |    9.52% |    7.95% |           3.14s |     $0.0001 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service |       98.41 |    1.59% |    1.28% |           3.05s |     $0.0001 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              | Third-Party Service |       90.48 |    9.52% |    7.18% |           3.56s |     $0.0002 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                | Third-Party Service |       87.30 |   12.70% |    7.69% |           3.98s |     $0.0002 |
| <code>fal/fal-ai/florence-2-large/ocr</code>                         | Third-Party Service |       65.08 |   34.92% |   24.87% |           5.35s |     $0.0076 |
| <code>fal/fal-ai/got-ocr/v2</code>                                   | Third-Party Service |        0.00 | 1344.44% | 1045.90% |          90.93s |     $0.0500 |
| <code>gemini/gemini-3.1-flash-lite</code>                            | Third-Party Service |       84.13 |   15.87% |   13.08% |           1.69s |     $0.0005 |
| <code>gemini/gemini-3.1-flash-lite-preview</code>                    | Third-Party Service |       98.41 |    1.59% |    0.26% |           1.67s |     $0.0005 |
| <code>gemini/gemini-3.1-pro-preview</code>                           | Third-Party Service |       98.41 |    1.59% |    0.26% |           3.16s |     $0.0044 |
| <code>gemini/gemini-3.5-flash</code>                                 | Third-Party Service |       92.06 |    7.94% |    4.87% |           7.93s |     $0.0033 |
| <code>glm/glm-ocr</code>                                             | Third-Party Service |       42.86 |   57.14% |   60.26% |           1.77s |     $0.0000 |
| <code>grok/grok-4.20-0309-non-reasoning</code>                       | Third-Party Service |       92.06 |    7.94% |    6.67% |           0.85s |     $0.0012 |
| <code>grok/grok-4.3</code>                                           | Third-Party Service |       92.06 |    7.94% |    6.67% |           5.81s |     $0.0012 |
| <code>kimi/kimi-k2.6</code>                                          | Third-Party Service |       92.06 |    7.94% |    4.87% |           6.23s |     $0.0013 |
| <code>mistral/mistral-ocr-2512</code>                                | Third-Party Service |       74.60 |   25.40% |   19.74% |           1.29s |     $0.0020 |
| <code>mistral/mistral-ocr-4-0</code>                                 | Third-Party Service |       74.60 |   25.40% |   20.00% |           1.63s |     $0.0040 |
| <code>openai/gpt-5.4-mini</code>                                     | Third-Party Service |       93.65 |    6.35% |    3.85% |           1.67s |     $0.0011 |
| <code>openai/gpt-5.4-nano</code>                                     | Third-Party Service |       74.60 |   25.40% |   15.13% |           1.53s |     $0.0003 |
| <code>openai/gpt-5.5</code>                                          | Third-Party Service |       98.41 |    1.59% |    2.05% |           9.57s |     $0.0224 |
| <code>replicate/datalab-to/marker</code>                             | Third-Party Service |       90.48 |    9.52% |    7.18% |           9.84s |     $0.0040 |
| <code>replicate/datalab-to/ocr</code>                                | Third-Party Service |       57.14 |   42.86% |   30.26% |           5.14s |     $0.0020 |
| <code>replicate/lucataco/deepseek-ocr</code>                         | Third-Party Service |        0.00 |  106.35% |   69.49% |          70.74s |     $0.0033 |

## Error Breakdown (WER)

| Provider                                                             | Substitutions | Deletions | Insertions | Ref. Words |
| -------------------------------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>ocrmypdf</code>                                                |             3 |        38 |          0 |         63 |
| <code>paddle-ocr</code>                                              |            17 |        16 |          6 |         63 |
| <code>tesseract</code>                                               |             9 |        36 |          0 |         63 |
| <code>anthropic/claude-haiku-4-5</code>                              |             1 |         3 |          1 |         63 |
| <code>anthropic/claude-opus-4-8</code>                               |             0 |         3 |          3 |         63 |
| <code>anthropic/claude-sonnet-4-6</code>                             |             0 |         1 |          1 |         63 |
| <code>anthropic/claude-sonnet-5</code>                               |             0 |         0 |          0 |         63 |
| <code>deepinfra/google/gemma-3-27b-it</code>                         |             5 |         5 |          2 |         63 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     |             0 |         4 |          2 |         63 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> |             0 |         0 |          1 |         63 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              |             0 |         3 |          3 |         63 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                |             1 |         3 |          4 |         63 |
| <code>fal/fal-ai/florence-2-large/ocr</code>                         |            16 |         2 |          4 |         63 |
| <code>fal/fal-ai/got-ocr/v2</code>                                   |            59 |         0 |        788 |         63 |
| <code>gemini/gemini-3.1-flash-lite</code>                            |             0 |         7 |          3 |         63 |
| <code>gemini/gemini-3.1-flash-lite-preview</code>                    |             1 |         0 |          0 |         63 |
| <code>gemini/gemini-3.1-pro-preview</code>                           |             1 |         0 |          0 |         63 |
| <code>gemini/gemini-3.5-flash</code>                                 |             1 |         2 |          2 |         63 |
| <code>glm/glm-ocr</code>                                             |             0 |        34 |          2 |         63 |
| <code>grok/grok-4.20-0309-non-reasoning</code>                       |             0 |         3 |          2 |         63 |
| <code>grok/grok-4.3</code>                                           |             0 |         3 |          2 |         63 |
| <code>kimi/kimi-k2.6</code>                                          |             1 |         2 |          2 |         63 |
| <code>mistral/mistral-ocr-2512</code>                                |             6 |         5 |          5 |         63 |
| <code>mistral/mistral-ocr-4-0</code>                                 |             8 |         4 |          4 |         63 |
| <code>openai/gpt-5.4-mini</code>                                     |             3 |         1 |          0 |         63 |
| <code>openai/gpt-5.4-nano</code>                                     |            14 |         2 |          0 |         63 |
| <code>openai/gpt-5.5</code>                                          |             0 |         1 |          0 |         63 |
| <code>replicate/datalab-to/marker</code>                             |             2 |         0 |          4 |         63 |
| <code>replicate/datalab-to/ocr</code>                                |             5 |        13 |          9 |         63 |
| <code>replicate/lucataco/deepseek-ocr</code>                         |            21 |         1 |         45 |         63 |

## Notes

- Best local model: `paddle-ocr/paddle-ocr` scored 38.10/100.
- Best cloud service: `anthropic/claude-sonnet-5` scored 100.00/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0008¢ ($0.0000).
- Fastest local model: `tesseract/tesseract` at 0.22s.
- Fastest cloud service: `grok/grok-4.20-0309-non-reasoning` at 0.85s.
