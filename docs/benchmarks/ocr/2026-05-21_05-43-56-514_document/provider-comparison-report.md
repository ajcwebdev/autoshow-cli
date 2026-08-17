# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-05-21_05-43-56-514_document`
- Total providers: 28 (3 local, 25 third-party service)
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
|    1 | <code>ocrmypdf</code>   | $0.00 local monetary cost |       13.18 | 86.82% | 49.74% |          14.36s |       $0.00 |
|    2 | <code>paddle-ocr</code> | $0.00 local monetary cost |        1.57 | 98.43% | 89.96% |          50.89s |       $0.00 |
|    3 | <code>tesseract</code>  | $0.00 local monetary cost |       14.55 | 85.45% | 45.94% |           9.47s |       $0.00 |

#### Speed

| Rank | Provider                |  Value | Score / 100 |    WER |    CER | Processing Time | Actual Cost |
| ---: | ----------------------- | -----: | ----------: | -----: | -----: | --------------: | ----------: |
|    1 | <code>tesseract</code>  |  9.47s |       14.55 | 85.45% | 45.94% |           9.47s |       $0.00 |
|    2 | <code>ocrmypdf</code>   | 14.36s |       13.18 | 86.82% | 49.74% |          14.36s |       $0.00 |
|    3 | <code>paddle-ocr</code> | 50.89s |        1.57 | 98.43% | 89.96% |          50.89s |       $0.00 |

#### Quality Score

| Rank | Provider                |                   Value | Score / 100 |    WER |    CER | Processing Time | Actual Cost |
| ---: | ----------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | ----------: |
|    1 | <code>tesseract</code>  | 14.55/100 quality score |       14.55 | 85.45% | 45.94% |           9.47s |       $0.00 |
|    2 | <code>ocrmypdf</code>   | 13.18/100 quality score |       13.18 | 86.82% | 49.74% |          14.36s |       $0.00 |
|    3 | <code>paddle-ocr</code> |  1.57/100 quality score |        1.57 | 98.43% | 89.96% |          50.89s |       $0.00 |

### Third-Party Service

#### Price

| Rank | Provider                                                             |   Value | Score / 100 |     WER |     CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------------------------------- | ------: | ----------: | ------: | ------: | --------------: | ----------: |
|    1 | <code>glm/glm-ocr</code>                                             | $0.0003 |       83.33 |  16.67% |  15.66% |          21.07s |     $0.0003 |
|    2 | <code>deepinfra/google/gemma-3-27b-it</code>                         | $0.0003 |       79.92 |  20.08% |  16.92% |         126.60s |     $0.0003 |
|    3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0006 |       92.01 |   7.99% |   6.77% |          28.28s |     $0.0006 |
|    4 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     | $0.0007 |       68.78 |  31.22% |  27.87% |          29.92s |     $0.0007 |
|    5 | <code>mistral/mistral-ocr-2512</code>                                | $0.0020 |       86.61 |  13.39% |   9.23% |           9.56s |     $0.0020 |
|    6 | <code>replicate/datalab-to/ocr</code>                                | $0.0020 |       80.33 |  19.67% |  12.51% |          17.61s |     $0.0020 |
|    7 | <code>gemini/gemini-3.1-flash-lite-preview</code>                    | $0.0027 |       91.12 |   8.88% |   9.14% |           7.87s |     $0.0027 |
|    8 | <code>gemini/gemini-3.1-flash-lite</code>                            | $0.0027 |       90.64 |   9.36% |   9.15% |           7.19s |     $0.0027 |
|    9 | <code>openai/gpt-5.4-nano</code>                                     | $0.0032 |       60.18 |  39.82% |  32.32% |          15.02s |     $0.0032 |
|   10 | <code>replicate/lucataco/deepseek-ocr</code>                         | $0.0033 |        0.00 | 341.33% | 304.19% |         285.70s |     $0.0033 |
|   11 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                | $0.0035 |       92.76 |   7.24% |   6.57% |          72.21s |     $0.0035 |
|   12 | <code>mistral/mistral-ocr-4-0</code>                                 | $0.0040 |       89.28 |  10.72% |   5.79% |           7.68s |     $0.0040 |
|   13 | <code>replicate/datalab-to/marker</code>                             | $0.0040 |       92.28 |   7.72% |   5.93% |          24.32s |     $0.0040 |
|   14 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              | $0.0049 |       95.83 |   4.17% |   3.30% |          40.36s |     $0.0049 |
|   15 | <code>fal/fal-ai/florence-2-large/ocr</code>                         | $0.0076 |        9.22 |  90.78% |  69.32% |          20.70s |     $0.0076 |
|   16 | <code>grok/grok-4.3</code>                                           | $0.0077 |       97.68 |   2.32% |   1.53% |          44.00s |     $0.0077 |
|   17 | <code>grok/grok-4.20-0309-non-reasoning</code>                       | $0.0078 |       98.57 |   1.43% |   1.13% |           9.41s |     $0.0078 |
|   18 | <code>openai/gpt-5.4-mini</code>                                     | $0.0107 |       97.34 |   2.66% |   1.74% |           9.20s |     $0.0107 |
|   19 | <code>kimi/kimi-k2.6</code>                                          | $0.0118 |       99.45 |   0.55% |   0.25% |          28.26s |     $0.0118 |
|   20 | <code>anthropic/claude-haiku-4-5</code>                              | $0.0137 |       88.32 |  11.68% |  11.20% |          11.37s |     $0.0137 |
|   21 | <code>gemini/gemini-3.5-flash</code>                                 | $0.0208 |       96.65 |   3.35% |   3.08% |          23.25s |     $0.0208 |
|   22 | <code>gemini/gemini-3.1-pro-preview</code>                           | $0.0269 |       91.12 |   8.88% |   6.84% |          17.48s |     $0.0269 |
|   23 | <code>anthropic/claude-sonnet-5</code>                               | $0.0414 |       99.45 |   0.55% |   0.35% |          38.11s |     $0.0414 |
|   24 | <code>fal/fal-ai/got-ocr/v2</code>                                   | $0.0500 |        0.48 |  99.52% |  98.91% |           6.76s |     $0.0500 |
|   25 | <code>openai/gpt-5.5</code>                                          | $0.1271 |       59.84 |  40.16% |  40.28% |          53.82s |     $0.1271 |

#### Speed

| Rank | Provider                                                             |   Value | Score / 100 |     WER |     CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------------------------------- | ------: | ----------: | ------: | ------: | --------------: | ----------: |
|    1 | <code>fal/fal-ai/got-ocr/v2</code>                                   |   6.76s |        0.48 |  99.52% |  98.91% |           6.76s |     $0.0500 |
|    2 | <code>gemini/gemini-3.1-flash-lite</code>                            |   7.19s |       90.64 |   9.36% |   9.15% |           7.19s |     $0.0027 |
|    3 | <code>mistral/mistral-ocr-4-0</code>                                 |   7.68s |       89.28 |  10.72% |   5.79% |           7.68s |     $0.0040 |
|    4 | <code>gemini/gemini-3.1-flash-lite-preview</code>                    |   7.87s |       91.12 |   8.88% |   9.14% |           7.87s |     $0.0027 |
|    5 | <code>openai/gpt-5.4-mini</code>                                     |   9.20s |       97.34 |   2.66% |   1.74% |           9.20s |     $0.0107 |
|    6 | <code>grok/grok-4.20-0309-non-reasoning</code>                       |   9.41s |       98.57 |   1.43% |   1.13% |           9.41s |     $0.0078 |
|    7 | <code>mistral/mistral-ocr-2512</code>                                |   9.56s |       86.61 |  13.39% |   9.23% |           9.56s |     $0.0020 |
|    8 | <code>anthropic/claude-haiku-4-5</code>                              |  11.37s |       88.32 |  11.68% |  11.20% |          11.37s |     $0.0137 |
|    9 | <code>openai/gpt-5.4-nano</code>                                     |  15.02s |       60.18 |  39.82% |  32.32% |          15.02s |     $0.0032 |
|   10 | <code>gemini/gemini-3.1-pro-preview</code>                           |  17.48s |       91.12 |   8.88% |   6.84% |          17.48s |     $0.0269 |
|   11 | <code>replicate/datalab-to/ocr</code>                                |  17.61s |       80.33 |  19.67% |  12.51% |          17.61s |     $0.0020 |
|   12 | <code>fal/fal-ai/florence-2-large/ocr</code>                         |  20.70s |        9.22 |  90.78% |  69.32% |          20.70s |     $0.0076 |
|   13 | <code>glm/glm-ocr</code>                                             |  21.07s |       83.33 |  16.67% |  15.66% |          21.07s |     $0.0003 |
|   14 | <code>gemini/gemini-3.5-flash</code>                                 |  23.25s |       96.65 |   3.35% |   3.08% |          23.25s |     $0.0208 |
|   15 | <code>replicate/datalab-to/marker</code>                             |  24.32s |       92.28 |   7.72% |   5.93% |          24.32s |     $0.0040 |
|   16 | <code>kimi/kimi-k2.6</code>                                          |  28.26s |       99.45 |   0.55% |   0.25% |          28.26s |     $0.0118 |
|   17 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> |  28.28s |       92.01 |   7.99% |   6.77% |          28.28s |     $0.0006 |
|   18 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     |  29.92s |       68.78 |  31.22% |  27.87% |          29.92s |     $0.0007 |
|   19 | <code>anthropic/claude-sonnet-5</code>                               |  38.11s |       99.45 |   0.55% |   0.35% |          38.11s |     $0.0414 |
|   20 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              |  40.36s |       95.83 |   4.17% |   3.30% |          40.36s |     $0.0049 |
|   21 | <code>grok/grok-4.3</code>                                           |  44.00s |       97.68 |   2.32% |   1.53% |          44.00s |     $0.0077 |
|   22 | <code>openai/gpt-5.5</code>                                          |  53.82s |       59.84 |  40.16% |  40.28% |          53.82s |     $0.1271 |
|   23 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                |  72.21s |       92.76 |   7.24% |   6.57% |          72.21s |     $0.0035 |
|   24 | <code>deepinfra/google/gemma-3-27b-it</code>                         | 126.60s |       79.92 |  20.08% |  16.92% |         126.60s |     $0.0003 |
|   25 | <code>replicate/lucataco/deepseek-ocr</code>                         | 285.70s |        0.00 | 341.33% | 304.19% |         285.70s |     $0.0033 |

#### Quality Score

| Rank | Provider                                                             |                   Value | Score / 100 |     WER |     CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------------------------------- | ----------------------: | ----------: | ------: | ------: | --------------: | ----------: |
|    1 | <code>kimi/kimi-k2.6</code>                                          | 99.45/100 quality score |       99.45 |   0.55% |   0.25% |          28.26s |     $0.0118 |
|    2 | <code>anthropic/claude-sonnet-5</code>                               | 99.45/100 quality score |       99.45 |   0.55% |   0.35% |          38.11s |     $0.0414 |
|    3 | <code>grok/grok-4.20-0309-non-reasoning</code>                       | 98.57/100 quality score |       98.57 |   1.43% |   1.13% |           9.41s |     $0.0078 |
|    4 | <code>grok/grok-4.3</code>                                           | 97.68/100 quality score |       97.68 |   2.32% |   1.53% |          44.00s |     $0.0077 |
|    5 | <code>openai/gpt-5.4-mini</code>                                     | 97.34/100 quality score |       97.34 |   2.66% |   1.74% |           9.20s |     $0.0107 |
|    6 | <code>gemini/gemini-3.5-flash</code>                                 | 96.65/100 quality score |       96.65 |   3.35% |   3.08% |          23.25s |     $0.0208 |
|    7 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              | 95.83/100 quality score |       95.83 |   4.17% |   3.30% |          40.36s |     $0.0049 |
|    8 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                | 92.76/100 quality score |       92.76 |   7.24% |   6.57% |          72.21s |     $0.0035 |
|    9 | <code>replicate/datalab-to/marker</code>                             | 92.28/100 quality score |       92.28 |   7.72% |   5.93% |          24.32s |     $0.0040 |
|   10 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 92.01/100 quality score |       92.01 |   7.99% |   6.77% |          28.28s |     $0.0006 |
|   11 | <code>gemini/gemini-3.1-pro-preview</code>                           | 91.12/100 quality score |       91.12 |   8.88% |   6.84% |          17.48s |     $0.0269 |
|   12 | <code>gemini/gemini-3.1-flash-lite-preview</code>                    | 91.12/100 quality score |       91.12 |   8.88% |   9.14% |           7.87s |     $0.0027 |
|   13 | <code>gemini/gemini-3.1-flash-lite</code>                            | 90.64/100 quality score |       90.64 |   9.36% |   9.15% |           7.19s |     $0.0027 |
|   14 | <code>mistral/mistral-ocr-4-0</code>                                 | 89.28/100 quality score |       89.28 |  10.72% |   5.79% |           7.68s |     $0.0040 |
|   15 | <code>anthropic/claude-haiku-4-5</code>                              | 88.32/100 quality score |       88.32 |  11.68% |  11.20% |          11.37s |     $0.0137 |
|   16 | <code>mistral/mistral-ocr-2512</code>                                | 86.61/100 quality score |       86.61 |  13.39% |   9.23% |           9.56s |     $0.0020 |
|   17 | <code>glm/glm-ocr</code>                                             | 83.33/100 quality score |       83.33 |  16.67% |  15.66% |          21.07s |     $0.0003 |
|   18 | <code>replicate/datalab-to/ocr</code>                                | 80.33/100 quality score |       80.33 |  19.67% |  12.51% |          17.61s |     $0.0020 |
|   19 | <code>deepinfra/google/gemma-3-27b-it</code>                         | 79.92/100 quality score |       79.92 |  20.08% |  16.92% |         126.60s |     $0.0003 |
|   20 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     | 68.78/100 quality score |       68.78 |  31.22% |  27.87% |          29.92s |     $0.0007 |
|   21 | <code>openai/gpt-5.4-nano</code>                                     | 60.18/100 quality score |       60.18 |  39.82% |  32.32% |          15.02s |     $0.0032 |
|   22 | <code>openai/gpt-5.5</code>                                          | 59.84/100 quality score |       59.84 |  40.16% |  40.28% |          53.82s |     $0.1271 |
|   23 | <code>fal/fal-ai/florence-2-large/ocr</code>                         |  9.22/100 quality score |        9.22 |  90.78% |  69.32% |          20.70s |     $0.0076 |
|   24 | <code>fal/fal-ai/got-ocr/v2</code>                                   |  0.48/100 quality score |        0.48 |  99.52% |  98.91% |           6.76s |     $0.0500 |
|   25 | <code>replicate/lucataco/deepseek-ocr</code>                         |  0.00/100 quality score |        0.00 | 341.33% | 304.19% |         285.70s |     $0.0033 |


## Provider Detail

| Provider                                                             | Group               | Score / 100 |     WER |     CER | Processing Time | Actual Cost |
| -------------------------------------------------------------------- | ------------------- | ----------: | ------: | ------: | --------------: | ----------: |
| <code>ocrmypdf</code>                                                | Local               |       13.18 |  86.82% |  49.74% |          14.36s |       $0.00 |
| <code>paddle-ocr</code>                                              | Local               |        1.57 |  98.43% |  89.96% |          50.89s |       $0.00 |
| <code>tesseract</code>                                               | Local               |       14.55 |  85.45% |  45.94% |           9.47s |       $0.00 |
| <code>anthropic/claude-haiku-4-5</code>                              | Third-Party Service |       88.32 |  11.68% |  11.20% |          11.37s |     $0.0137 |
| <code>anthropic/claude-sonnet-5</code>                               | Third-Party Service |       99.45 |   0.55% |   0.35% |          38.11s |     $0.0414 |
| <code>deepinfra/google/gemma-3-27b-it</code>                         | Third-Party Service |       79.92 |  20.08% |  16.92% |         126.60s |     $0.0003 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     | Third-Party Service |       68.78 |  31.22% |  27.87% |          29.92s |     $0.0007 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service |       92.01 |   7.99% |   6.77% |          28.28s |     $0.0006 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              | Third-Party Service |       95.83 |   4.17% |   3.30% |          40.36s |     $0.0049 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                | Third-Party Service |       92.76 |   7.24% |   6.57% |          72.21s |     $0.0035 |
| <code>fal/fal-ai/florence-2-large/ocr</code>                         | Third-Party Service |        9.22 |  90.78% |  69.32% |          20.70s |     $0.0076 |
| <code>fal/fal-ai/got-ocr/v2</code>                                   | Third-Party Service |        0.48 |  99.52% |  98.91% |           6.76s |     $0.0500 |
| <code>gemini/gemini-3.1-flash-lite</code>                            | Third-Party Service |       90.64 |   9.36% |   9.15% |           7.19s |     $0.0027 |
| <code>gemini/gemini-3.1-flash-lite-preview</code>                    | Third-Party Service |       91.12 |   8.88% |   9.14% |           7.87s |     $0.0027 |
| <code>gemini/gemini-3.1-pro-preview</code>                           | Third-Party Service |       91.12 |   8.88% |   6.84% |          17.48s |     $0.0269 |
| <code>gemini/gemini-3.5-flash</code>                                 | Third-Party Service |       96.65 |   3.35% |   3.08% |          23.25s |     $0.0208 |
| <code>glm/glm-ocr</code>                                             | Third-Party Service |       83.33 |  16.67% |  15.66% |          21.07s |     $0.0003 |
| <code>grok/grok-4.20-0309-non-reasoning</code>                       | Third-Party Service |       98.57 |   1.43% |   1.13% |           9.41s |     $0.0078 |
| <code>grok/grok-4.3</code>                                           | Third-Party Service |       97.68 |   2.32% |   1.53% |          44.00s |     $0.0077 |
| <code>kimi/kimi-k2.6</code>                                          | Third-Party Service |       99.45 |   0.55% |   0.25% |          28.26s |     $0.0118 |
| <code>mistral/mistral-ocr-2512</code>                                | Third-Party Service |       86.61 |  13.39% |   9.23% |           9.56s |     $0.0020 |
| <code>mistral/mistral-ocr-4-0</code>                                 | Third-Party Service |       89.28 |  10.72% |   5.79% |           7.68s |     $0.0040 |
| <code>openai/gpt-5.4-mini</code>                                     | Third-Party Service |       97.34 |   2.66% |   1.74% |           9.20s |     $0.0107 |
| <code>openai/gpt-5.4-nano</code>                                     | Third-Party Service |       60.18 |  39.82% |  32.32% |          15.02s |     $0.0032 |
| <code>openai/gpt-5.5</code>                                          | Third-Party Service |       59.84 |  40.16% |  40.28% |          53.82s |     $0.1271 |
| <code>replicate/datalab-to/marker</code>                             | Third-Party Service |       92.28 |   7.72% |   5.93% |          24.32s |     $0.0040 |
| <code>replicate/datalab-to/ocr</code>                                | Third-Party Service |       80.33 |  19.67% |  12.51% |          17.61s |     $0.0020 |
| <code>replicate/lucataco/deepseek-ocr</code>                         | Third-Party Service |        0.00 | 341.33% | 304.19% |         285.70s |     $0.0033 |

## Error Breakdown (WER)

| Provider                                                             | Substitutions | Deletions | Insertions | Ref. Words |
| -------------------------------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>ocrmypdf</code>                                                |           959 |       298 |         14 |       1464 |
| <code>paddle-ocr</code>                                              |           138 |      1303 |          0 |       1464 |
| <code>tesseract</code>                                               |          1035 |       196 |         20 |       1464 |
| <code>anthropic/claude-haiku-4-5</code>                              |            96 |         3 |         72 |       1464 |
| <code>anthropic/claude-sonnet-5</code>                               |             3 |         2 |          3 |       1464 |
| <code>deepinfra/google/gemma-3-27b-it</code>                         |           175 |        95 |         24 |       1464 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code>     |           160 |       296 |          1 |       1464 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> |            75 |        10 |         32 |       1464 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code>              |            29 |        28 |          4 |       1464 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code>                |            26 |        79 |          1 |       1464 |
| <code>fal/fal-ai/florence-2-large/ocr</code>                         |           677 |       652 |          0 |       1464 |
| <code>fal/fal-ai/got-ocr/v2</code>                                   |             8 |      1448 |          1 |       1464 |
| <code>gemini/gemini-3.1-flash-lite</code>                            |             6 |       127 |          4 |       1464 |
| <code>gemini/gemini-3.1-flash-lite-preview</code>                    |             2 |       128 |          0 |       1464 |
| <code>gemini/gemini-3.1-pro-preview</code>                           |           119 |         6 |          5 |       1464 |
| <code>gemini/gemini-3.5-flash</code>                                 |             6 |         5 |         38 |       1464 |
| <code>glm/glm-ocr</code>                                             |            25 |       209 |         10 |       1464 |
| <code>grok/grok-4.20-0309-non-reasoning</code>                       |             5 |        15 |          1 |       1464 |
| <code>grok/grok-4.3</code>                                           |            11 |        23 |          0 |       1464 |
| <code>kimi/kimi-k2.6</code>                                          |             3 |         5 |          0 |       1464 |
| <code>mistral/mistral-ocr-2512</code>                                |           133 |        56 |          7 |       1464 |
| <code>mistral/mistral-ocr-4-0</code>                                 |           145 |         6 |          6 |       1464 |
| <code>openai/gpt-5.4-mini</code>                                     |             9 |        26 |          4 |       1464 |
| <code>openai/gpt-5.4-nano</code>                                     |           117 |       141 |        325 |       1464 |
| <code>openai/gpt-5.5</code>                                          |             2 |       586 |          0 |       1464 |
| <code>replicate/datalab-to/marker</code>                             |            99 |         6 |          8 |       1464 |
| <code>replicate/datalab-to/ocr</code>                                |           173 |       108 |          7 |       1464 |
| <code>replicate/lucataco/deepseek-ocr</code>                         |          1224 |         3 |       3770 |       1464 |

## Notes

- Best local model: `tesseract/tesseract` scored 14.55/100.
- Best cloud service: `kimi/kimi-k2.6` scored 99.45/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0286¢ ($0.0003).
- Fastest local model: `tesseract/tesseract` at 9.47s.
- Fastest cloud service: `fal/fal-ai/got-ocr/v2` at 6.76s.
