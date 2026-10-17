# Combined OCR Provider Comparison Report

## Summary

- Root directory: `docs/benchmarks/ocr`
- Runs aggregated: 13 (29 pages)
  - `01-ad-copy` (30 providers, 1 page)
  - `01-ancient` (30 providers, 1 page)
  - `01-book` (30 providers, 1 page)
  - `01-financial-data` (30 providers, 1 page)
  - `01-handwriting` (30 providers, 1 page)
  - `01-medieval` (30 providers, 1 page)
  - `01-non-english` (28 providers, 1 page)
  - `01-test-picture` (30 providers, 1 page)
  - `04-pages-don-quixote` (30 providers, 4 pages)
  - `05-pages-the-odyssey` (30 providers, 5 pages)
  - `1-page-declaration` (30 providers, 1 page)
  - `1-page-newspaper` (27 providers, 1 page)
  - `10-document` (30 providers, 10 pages)
- Distinct providers: 30 (0 local, 30 third-party service)
- Quality aggregates the per-run WER-derived score as an unweighted mean across runs; speed and price aggregate page-weighted totals (pages per minute, USD per 100 pages).

## Method

- Providers are matched by `providerKey` and aggregated across the runs they appear in; sums and means cover present values only.
- Quality Score rankings use the unweighted mean `metrics.score` descending.
- Per-run WER uses ASCII `[a-z0-9]` token streams after normalization and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence; review it together with the source images for non-Latin cases.
- Weighted WER and Weighted CER are evidence columns: summed errors from the corresponding breakdowns divided by summed reference counts, so longer runs count proportionally more.
- Speed rankings use aggregate pages per minute descending: `sum(pageCount) / sum(processingTimeMs / 60000)`; missing timing sorts last.
- Price rankings use USD per 100 pages ascending: `sum(costCents) / sum(pageCount)` (cents per page is numerically equal to dollars per 100 pages); local providers at zero; missing cost sorts last.
- Tied ranking values break deterministically: price ties by quality descending, then pages/minute descending, then provider key; speed and quality ties by provider key.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages              |
| ---: | -------- | ----: | -------: | ----------------: | -----------: | -----------: | -----------: | -----------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a      | n/a               | n/a          | n/a          | n/a          | n/a          | No providers in this group. |

#### Speed

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages              |
| ---: | -------- | ----: | -------: | ----------------: | -----------: | -----------: | -----------: | -----------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a      | n/a               | n/a          | n/a          | n/a          | n/a          | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages              |
| ---: | -------- | ----: | -------: | ----------------: | -----------: | -----------: | -----------: | -----------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a      | n/a               | n/a          | n/a          | n/a          | n/a          | No providers in this group. |

### Third-Party Service

#### Price

| Rank | Provider                                               | Value  | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | ------------------------------------------------------ | -----: | -------: | ----------------: | -----------: | -----------: | -----------: | -----------: | -------------: |
| 1    | <code>deepinfra/google/gemma-4-31B-it</code>           | $0.021 | 12/13    | 87.58             | 12.53%       | 10.80%       | 5.4          | 25.72s       | $0.021         |
| 2    | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.046 | 12/13    | 82.83             | 7.33%        | 6.28%        | 3.3          | 42.94s       | $0.046         |
| 3    | <code>anthropic/claude-haiku-5-5</code>                | $0.071 | 13/13    | 86.39             | 21.18%       | 24.18%       | 5.9          | 22.57s       | $0.071         |
| 4    | <code>openai/gpt-6-luna</code>                         | $0.084 | 13/13    | 93.16             | 9.12%        | 7.17%        | 6.4          | 20.96s       | $0.084         |
| 5    | <code>gemini/gemini-3.5-flash-lite</code>              | $0.147 | 13/13    | 81.38             | 29.62%       | 24.83%       | 33.3         | 4.02s        | $0.147         |
| 6    | <code>openai/gpt-5.6-luna</code>                       | $0.155 | 13/13    | 88.74             | 12.38%       | 12.22%       | 12.6         | 10.61s       | $0.155         |
| 7    | <code>glm/glm-5.3-flash</code>                         | $0.196 | 12/13    | 91.84             | 5.08%        | 1.17%        | 2.0          | 69.15s       | $0.196         |
| 8    | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | $0.267 | 13/13    | 85.41             | 10.16%       | 6.38%        | 6.8          | 19.66s       | $0.267         |
| 9    | <code>mistral/mistral-ocr-4-0</code>                   | $0.400 | 13/13    | 89.91             | 10.91%       | 5.42%        | 44.8         | 2.99s        | $0.400         |
| 10   | <code>mistral/mistral-ocr-4-1</code>                   | $0.400 | 13/13    | 89.76             | 11.43%       | 6.63%        | 41.1         | 3.25s        | $0.400         |
| 11   | <code>gemini/gemini-3.6-flash</code>                   | $0.542 | 13/13    | 94.46             | 6.63%        | 4.63%        | 18.6         | 7.18s        | $0.542         |
| 12   | <code>kimi/kimi-k2.6</code>                            | $0.545 | 13/13    | 87.42             | 6.47%        | 2.11%        | 5.6          | 23.84s       | $0.545         |
| 13   | <code>gemini/gemini-3.8-flash</code>                   | $0.585 | 13/13    | 94.14             | 5.12%        | 1.89%        | 21.4         | 6.24s        | $0.585         |
| 14   | <code>gemini/gemini-3.7-flash</code>                   | $0.605 | 13/13    | 92.87             | 6.64%        | 1.56%        | 27.1         | 4.94s        | $0.605         |
| 15   | <code>gemini/gemini-3.5-flash</code>                   | $0.734 | 13/13    | 90.55             | 48.17%       | 22.26%       | 17.6         | 7.61s        | $0.734         |
| 16   | <code>grok/grok-4.5</code>                             | $0.828 | 13/13    | 88.48             | 8.09%        | 3.26%        | 5.1          | 26.49s       | $0.828         |
| 17   | <code>grok/grok-4.6</code>                             | $0.857 | 13/13    | 87.91             | 6.41%        | 2.39%        | 3.4          | 38.87s       | $0.857         |
| 18   | <code>anthropic/claude-sonnet-5</code>                 | $1.268 | 13/13    | 93.14             | 5.03%        | 2.34%        | 5.5          | 24.44s       | $1.268         |
| 19   | <code>openai/gpt-6.1-sol</code>                        | $1.301 | 13/13    | 93.23             | 4.76%        | 0.76%        | 8.2          | 16.31s       | $1.301         |
| 20   | <code>anthropic/claude-sonnet-5-5</code>               | $1.342 | 13/13    | 95.33             | 2.39%        | 0.68%        | 6.3          | 21.39s       | $1.342         |
| 21   | <code>openai/gpt-5.6-terra</code>                      | $1.343 | 13/13    | 91.08             | 4.41%        | 2.52%        | 10.8         | 12.37s       | $1.343         |
| 22   | <code>gemini/gemini-4-argon</code>                     | $1.669 | 13/13    | 94.59             | 6.82%        | 2.09%        | 7.5          | 17.88s       | $1.669         |
| 23   | <code>anthropic/claude-opus-5-5</code>                 | $2.546 | 13/13    | 94.37             | 4.37%        | 0.71%        | 6.8          | 19.58s       | $2.546         |
| 24   | <code>grok/grok-4.7</code>                             | $3.210 | 11/13    | 97.07             | 2.27%        | 0.62%        | 1.2          | 124.84s      | $3.210         |
| 25   | <code>anthropic/claude-opus-5</code>                   | $3.219 | 13/13    | 92.82             | 3.98%        | 2.06%        | 4.5          | 29.46s       | $3.219         |
| 26   | <code>openai/gpt-5.6-sol</code>                        | $4.533 | 13/13    | 94.95             | 2.51%        | 1.29%        | 5.3          | 25.09s       | $4.533         |
| 27   | <code>kimi/kimi-k3</code>                              | $5.166 | 13/13    | 91.16             | 4.20%        | 1.48%        | 0.9          | 147.35s      | $5.166         |
| 28   | <code>openai/gpt-6-astra</code>                        | $5.551 | 13/13    | 95.69             | 1.92%        | 0.36%        | 7.4          | 17.99s       | $5.551         |
| 29   | <code>anthropic/claude-fable-5</code>                  | $6.652 | 13/13    | 95.57             | 3.79%        | 1.12%        | 4.7          | 28.78s       | $6.652         |
| 30   | <code>anthropic/claude-fable-5-1</code>                | $7.678 | 13/13    | 96.76             | 3.53%        | 0.77%        | 4.1          | 32.77s       | $7.678         |

#### Speed

| Rank | Provider                                               | Value             | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | ------------------------------------------------------ | ----------------: | -------: | ----------------: | -----------: | -----------: | -----------: | -----------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-0</code>                   | 44.8 pages/minute | 13/13    | 89.91             | 10.91%       | 5.42%        | 44.8         | 2.99s        | $0.400         |
| 2    | <code>mistral/mistral-ocr-4-1</code>                   | 41.1 pages/minute | 13/13    | 89.76             | 11.43%       | 6.63%        | 41.1         | 3.25s        | $0.400         |
| 3    | <code>gemini/gemini-3.5-flash-lite</code>              | 33.3 pages/minute | 13/13    | 81.38             | 29.62%       | 24.83%       | 33.3         | 4.02s        | $0.147         |
| 4    | <code>gemini/gemini-3.7-flash</code>                   | 27.1 pages/minute | 13/13    | 92.87             | 6.64%        | 1.56%        | 27.1         | 4.94s        | $0.605         |
| 5    | <code>gemini/gemini-3.8-flash</code>                   | 21.4 pages/minute | 13/13    | 94.14             | 5.12%        | 1.89%        | 21.4         | 6.24s        | $0.585         |
| 6    | <code>gemini/gemini-3.6-flash</code>                   | 18.6 pages/minute | 13/13    | 94.46             | 6.63%        | 4.63%        | 18.6         | 7.18s        | $0.542         |
| 7    | <code>gemini/gemini-3.5-flash</code>                   | 17.6 pages/minute | 13/13    | 90.55             | 48.17%       | 22.26%       | 17.6         | 7.61s        | $0.734         |
| 8    | <code>openai/gpt-5.6-luna</code>                       | 12.6 pages/minute | 13/13    | 88.74             | 12.38%       | 12.22%       | 12.6         | 10.61s       | $0.155         |
| 9    | <code>openai/gpt-5.6-terra</code>                      | 10.8 pages/minute | 13/13    | 91.08             | 4.41%        | 2.52%        | 10.8         | 12.37s       | $1.343         |
| 10   | <code>openai/gpt-6.1-sol</code>                        | 8.2 pages/minute  | 13/13    | 93.23             | 4.76%        | 0.76%        | 8.2          | 16.31s       | $1.301         |
| 11   | <code>gemini/gemini-4-argon</code>                     | 7.5 pages/minute  | 13/13    | 94.59             | 6.82%        | 2.09%        | 7.5          | 17.88s       | $1.669         |
| 12   | <code>openai/gpt-6-astra</code>                        | 7.4 pages/minute  | 13/13    | 95.69             | 1.92%        | 0.36%        | 7.4          | 17.99s       | $5.551         |
| 13   | <code>anthropic/claude-opus-5-5</code>                 | 6.8 pages/minute  | 13/13    | 94.37             | 4.37%        | 0.71%        | 6.8          | 19.58s       | $2.546         |
| 14   | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 6.8 pages/minute  | 13/13    | 85.41             | 10.16%       | 6.38%        | 6.8          | 19.66s       | $0.267         |
| 15   | <code>openai/gpt-6-luna</code>                         | 6.4 pages/minute  | 13/13    | 93.16             | 9.12%        | 7.17%        | 6.4          | 20.96s       | $0.084         |
| 16   | <code>anthropic/claude-sonnet-5-5</code>               | 6.3 pages/minute  | 13/13    | 95.33             | 2.39%        | 0.68%        | 6.3          | 21.39s       | $1.342         |
| 17   | <code>anthropic/claude-haiku-5-5</code>                | 5.9 pages/minute  | 13/13    | 86.39             | 21.18%       | 24.18%       | 5.9          | 22.57s       | $0.071         |
| 18   | <code>kimi/kimi-k2.6</code>                            | 5.6 pages/minute  | 13/13    | 87.42             | 6.47%        | 2.11%        | 5.6          | 23.84s       | $0.545         |
| 19   | <code>anthropic/claude-sonnet-5</code>                 | 5.5 pages/minute  | 13/13    | 93.14             | 5.03%        | 2.34%        | 5.5          | 24.44s       | $1.268         |
| 20   | <code>deepinfra/google/gemma-4-31B-it</code>           | 5.4 pages/minute  | 12/13    | 87.58             | 12.53%       | 10.80%       | 5.4          | 25.72s       | $0.021         |
| 21   | <code>openai/gpt-5.6-sol</code>                        | 5.3 pages/minute  | 13/13    | 94.95             | 2.51%        | 1.29%        | 5.3          | 25.09s       | $4.533         |
| 22   | <code>grok/grok-4.5</code>                             | 5.1 pages/minute  | 13/13    | 88.48             | 8.09%        | 3.26%        | 5.1          | 26.49s       | $0.828         |
| 23   | <code>anthropic/claude-fable-5</code>                  | 4.7 pages/minute  | 13/13    | 95.57             | 3.79%        | 1.12%        | 4.7          | 28.78s       | $6.652         |
| 24   | <code>anthropic/claude-opus-5</code>                   | 4.5 pages/minute  | 13/13    | 92.82             | 3.98%        | 2.06%        | 4.5          | 29.46s       | $3.219         |
| 25   | <code>anthropic/claude-fable-5-1</code>                | 4.1 pages/minute  | 13/13    | 96.76             | 3.53%        | 0.77%        | 4.1          | 32.77s       | $7.678         |
| 26   | <code>grok/grok-4.6</code>                             | 3.4 pages/minute  | 13/13    | 87.91             | 6.41%        | 2.39%        | 3.4          | 38.87s       | $0.857         |
| 27   | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 3.3 pages/minute  | 12/13    | 82.83             | 7.33%        | 6.28%        | 3.3          | 42.94s       | $0.046         |
| 28   | <code>glm/glm-5.3-flash</code>                         | 2.0 pages/minute  | 12/13    | 91.84             | 5.08%        | 1.17%        | 2.0          | 69.15s       | $0.196         |
| 29   | <code>grok/grok-4.7</code>                             | 1.2 pages/minute  | 11/13    | 97.07             | 2.27%        | 0.62%        | 1.2          | 124.84s      | $3.210         |
| 30   | <code>kimi/kimi-k3</code>                              | 0.9 pages/minute  | 13/13    | 91.16             | 4.20%        | 1.48%        | 0.9          | 147.35s      | $5.166         |

#### Quality Score

| Rank | Provider                                               | Value                       | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | ------------------------------------------------------ | --------------------------: | -------: | ----------------: | -----------: | -----------: | -----------: | -----------: | -------------: |
| 1    | <code>grok/grok-4.7</code>                             | 97.07/100 avg quality score | 11/13    | 97.07             | 2.27%        | 0.62%        | 1.2          | 124.84s      | $3.210         |
| 2    | <code>anthropic/claude-fable-5-1</code>                | 96.76/100 avg quality score | 13/13    | 96.76             | 3.53%        | 0.77%        | 4.1          | 32.77s       | $7.678         |
| 3    | <code>openai/gpt-6-astra</code>                        | 95.69/100 avg quality score | 13/13    | 95.69             | 1.92%        | 0.36%        | 7.4          | 17.99s       | $5.551         |
| 4    | <code>anthropic/claude-fable-5</code>                  | 95.57/100 avg quality score | 13/13    | 95.57             | 3.79%        | 1.12%        | 4.7          | 28.78s       | $6.652         |
| 5    | <code>anthropic/claude-sonnet-5-5</code>               | 95.33/100 avg quality score | 13/13    | 95.33             | 2.39%        | 0.68%        | 6.3          | 21.39s       | $1.342         |
| 6    | <code>openai/gpt-5.6-sol</code>                        | 94.95/100 avg quality score | 13/13    | 94.95             | 2.51%        | 1.29%        | 5.3          | 25.09s       | $4.533         |
| 7    | <code>gemini/gemini-4-argon</code>                     | 94.59/100 avg quality score | 13/13    | 94.59             | 6.82%        | 2.09%        | 7.5          | 17.88s       | $1.669         |
| 8    | <code>gemini/gemini-3.6-flash</code>                   | 94.46/100 avg quality score | 13/13    | 94.46             | 6.63%        | 4.63%        | 18.6         | 7.18s        | $0.542         |
| 9    | <code>anthropic/claude-opus-5-5</code>                 | 94.37/100 avg quality score | 13/13    | 94.37             | 4.37%        | 0.71%        | 6.8          | 19.58s       | $2.546         |
| 10   | <code>gemini/gemini-3.8-flash</code>                   | 94.14/100 avg quality score | 13/13    | 94.14             | 5.12%        | 1.89%        | 21.4         | 6.24s        | $0.585         |
| 11   | <code>openai/gpt-6.1-sol</code>                        | 93.23/100 avg quality score | 13/13    | 93.23             | 4.76%        | 0.76%        | 8.2          | 16.31s       | $1.301         |
| 12   | <code>openai/gpt-6-luna</code>                         | 93.16/100 avg quality score | 13/13    | 93.16             | 9.12%        | 7.17%        | 6.4          | 20.96s       | $0.084         |
| 13   | <code>anthropic/claude-sonnet-5</code>                 | 93.14/100 avg quality score | 13/13    | 93.14             | 5.03%        | 2.34%        | 5.5          | 24.44s       | $1.268         |
| 14   | <code>gemini/gemini-3.7-flash</code>                   | 92.87/100 avg quality score | 13/13    | 92.87             | 6.64%        | 1.56%        | 27.1         | 4.94s        | $0.605         |
| 15   | <code>anthropic/claude-opus-5</code>                   | 92.82/100 avg quality score | 13/13    | 92.82             | 3.98%        | 2.06%        | 4.5          | 29.46s       | $3.219         |
| 16   | <code>glm/glm-5.3-flash</code>                         | 91.84/100 avg quality score | 12/13    | 91.84             | 5.08%        | 1.17%        | 2.0          | 69.15s       | $0.196         |
| 17   | <code>kimi/kimi-k3</code>                              | 91.16/100 avg quality score | 13/13    | 91.16             | 4.20%        | 1.48%        | 0.9          | 147.35s      | $5.166         |
| 18   | <code>openai/gpt-5.6-terra</code>                      | 91.08/100 avg quality score | 13/13    | 91.08             | 4.41%        | 2.52%        | 10.8         | 12.37s       | $1.343         |
| 19   | <code>gemini/gemini-3.5-flash</code>                   | 90.55/100 avg quality score | 13/13    | 90.55             | 48.17%       | 22.26%       | 17.6         | 7.61s        | $0.734         |
| 20   | <code>mistral/mistral-ocr-4-0</code>                   | 89.91/100 avg quality score | 13/13    | 89.91             | 10.91%       | 5.42%        | 44.8         | 2.99s        | $0.400         |
| 21   | <code>mistral/mistral-ocr-4-1</code>                   | 89.76/100 avg quality score | 13/13    | 89.76             | 11.43%       | 6.63%        | 41.1         | 3.25s        | $0.400         |
| 22   | <code>openai/gpt-5.6-luna</code>                       | 88.74/100 avg quality score | 13/13    | 88.74             | 12.38%       | 12.22%       | 12.6         | 10.61s       | $0.155         |
| 23   | <code>grok/grok-4.5</code>                             | 88.48/100 avg quality score | 13/13    | 88.48             | 8.09%        | 3.26%        | 5.1          | 26.49s       | $0.828         |
| 24   | <code>grok/grok-4.6</code>                             | 87.91/100 avg quality score | 13/13    | 87.91             | 6.41%        | 2.39%        | 3.4          | 38.87s       | $0.857         |
| 25   | <code>deepinfra/google/gemma-4-31B-it</code>           | 87.58/100 avg quality score | 12/13    | 87.58             | 12.53%       | 10.80%       | 5.4          | 25.72s       | $0.021         |
| 26   | <code>kimi/kimi-k2.6</code>                            | 87.42/100 avg quality score | 13/13    | 87.42             | 6.47%        | 2.11%        | 5.6          | 23.84s       | $0.545         |
| 27   | <code>anthropic/claude-haiku-5-5</code>                | 86.39/100 avg quality score | 13/13    | 86.39             | 21.18%       | 24.18%       | 5.9          | 22.57s       | $0.071         |
| 28   | <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 85.41/100 avg quality score | 13/13    | 85.41             | 10.16%       | 6.38%        | 6.8          | 19.66s       | $0.267         |
| 29   | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 82.83/100 avg quality score | 12/13    | 82.83             | 7.33%        | 6.28%        | 3.3          | 42.94s       | $0.046         |
| 30   | <code>gemini/gemini-3.5-flash-lite</code>              | 81.38/100 avg quality score | 13/13    | 81.38             | 29.62%       | 24.83%       | 33.3         | 4.02s        | $0.147         |

## Per-Run Quality Score

WER-derived quality score per provider in each run, sorted by mean.

### Third-Party Service

| Provider                                               | Mean  | 01-ad-copy | 01-ancient | 01-book | 01-financial-data | 01-handwriting | 01-medieval | 01-non-english | 01-test-picture | 04-pages-don-quixote | 05-pages-the-odyssey | 1-page-declaration | 1-page-newspaper | 10-document |
| ------------------------------------------------------ | ----: | ---------: | ---------: | ------: | ----------------: | -------------: | ----------: | -------------: | --------------: | -------------------: | -------------------: | -----------------: | ---------------: | ----------: |
| <code>grok/grok-4.7</code>                             | 97.07 | 100.00     | 99.18      | 100.00  | 94.77             | 86.21          | 96.33       | —              | 100.00          | 99.70                | 92.17                | 99.45              | —                | 100.00      |
| <code>anthropic/claude-fable-5-1</code>                | 96.76 | 98.41      | 100.00     | 100.00  | 100.00            | 86.21          | 96.33       | 100.00         | 100.00          | 98.35                | 81.07                | 99.39              | 98.14            | 100.00      |
| <code>openai/gpt-6-astra</code>                        | 95.69 | 98.41      | 72.95      | 100.00  | 99.13             | 84.24          | 96.33       | 100.00         | 100.00          | 98.35                | 96.65                | 99.18              | 98.77            | 100.00      |
| <code>anthropic/claude-fable-5</code>                  | 95.57 | 95.24      | 84.43      | 100.00  | 100.00            | 90.15          | 96.33       | 100.00         | 100.00          | 99.78                | 80.99                | 97.20              | 98.26            | 100.00      |
| <code>anthropic/claude-sonnet-5-5</code>               | 95.33 | 98.41      | 72.13      | 100.00  | 99.13             | 81.77          | 96.33       | 100.00         | 100.00          | 98.28                | 97.10                | 99.11              | 97.08            | 100.00      |
| <code>openai/gpt-5.6-sol</code>                        | 94.95 | 92.06      | 92.62      | 99.06   | 97.97             | 68.47          | 96.33       | 96.15          | 100.00          | 99.70                | 97.10                | 97.54              | 97.33            | 100.00      |
| <code>gemini/gemini-4-argon</code>                     | 94.59 | 96.83      | 82.79      | 100.00  | 100.00            | 89.66          | 100.00      | 100.00         | 100.00          | 98.43                | 73.50                | 99.32              | 89.20            | 100.00      |
| <code>gemini/gemini-3.6-flash</code>                   | 94.46 | 95.24      | 69.67      | 100.00  | 99.71             | 89.16          | 100.00      | 100.00         | 100.00          | 99.33                | 96.48                | 99.04              | 79.37            | 100.00      |
| <code>anthropic/claude-opus-5-5</code>                 | 94.37 | 98.41      | 73.77      | 94.37   | 100.00            | 88.18          | 100.00      | 100.00         | 100.00          | 99.78                | 73.86                | 99.73              | 98.69            | 100.00      |
| <code>gemini/gemini-3.8-flash</code>                   | 94.14 | 98.41      | 73.77      | 100.00  | 99.71             | 82.27          | 96.33       | 100.00         | 100.00          | 99.85                | 81.16                | 100.00             | 92.38            | 100.00      |
| <code>openai/gpt-6.1-sol</code>                        | 93.23 | 92.06      | 73.77      | 100.00  | 98.84             | 80.30          | 96.33       | 100.00         | 100.00          | 98.35                | 73.68                | 99.80              | 98.86            | 100.00      |
| <code>openai/gpt-6-luna</code>                         | 93.16 | 92.06      | 95.90      | 99.06   | 93.02             | 74.88          | 95.87       | 96.15          | 100.00          | 99.40                | 94.10                | 97.54              | 73.06            | 100.00      |
| <code>anthropic/claude-sonnet-5</code>                 | 93.14 | 100.00     | 98.36      | 100.00  | 97.97             | 83.74          | 96.33       | 61.54          | 100.00          | 99.78                | 81.51                | 99.18              | 92.38            | 100.00      |
| <code>gemini/gemini-3.7-flash</code>                   | 92.87 | 98.41      | 73.77      | 100.00  | 96.51             | 77.83          | 96.33       | 100.00         | 100.00          | 99.85                | 73.94                | 99.86              | 90.85            | 100.00      |
| <code>anthropic/claude-opus-5</code>                   | 92.82 | 100.00     | 72.95      | 96.24   | 97.09             | 85.71          | 99.54       | 76.92          | 100.00          | 99.78                | 81.25                | 99.80              | 97.37            | 100.00      |
| <code>glm/glm-5.3-flash</code>                         | 91.84 | 95.24      | 68.85      | 93.90   | 90.70             | 83.25          | 98.62       | —              | 100.00          | 99.63                | 74.21                | 99.52              | 98.60            | 99.54       |
| <code>kimi/kimi-k3</code>                              | 91.16 | 98.41      | 83.61      | 99.53   | 31.10             | 82.27          | 95.87       | 100.00         | 100.00          | 99.33                | 97.01                | 99.39              | 98.64            | 99.94       |
| <code>openai/gpt-5.6-terra</code>                      | 91.08 | 92.06      | 73.77      | 99.06   | 93.31             | 78.33          | 93.12       | 69.23          | 100.00          | 98.28                | 96.83                | 98.43              | 91.66            | 100.00      |
| <code>gemini/gemini-3.5-flash</code>                   | 90.55 | 98.41      | 98.36      | 99.53   | 98.55             | 87.68          | 96.33       | 100.00         | 100.00          | 99.85                | 98.86                | 99.59              | 0.00             | 100.00      |
| <code>mistral/mistral-ocr-4-0</code>                   | 89.91 | 80.95      | 83.61      | 93.43   | 92.15             | 91.63          | 98.17       | 76.92          | 100.00          | 99.70                | 89.88                | 89.14              | 73.49            | 99.71       |
| <code>mistral/mistral-ocr-4-1</code>                   | 89.76 | 82.54      | 64.75      | 94.37   | 92.15             | 89.66          | 95.87       | 96.15          | 100.00          | 99.85                | 92.43                | 86.82              | 72.55            | 99.77       |
| <code>openai/gpt-5.6-luna</code>                       | 88.74 | 92.06      | 92.62      | 97.18   | 90.99             | 71.92          | 94.50       | 65.38          | 100.00          | 99.63                | 92.34                | 89.69              | 67.26            | 100.00      |
| <code>grok/grok-4.5</code>                             | 88.48 | 98.41      | 99.18      | 99.53   | 31.10             | 86.21          | 95.87       | 73.08          | 100.00          | 98.20                | 79.23                | 95.70              | 94.96            | 98.74       |
| <code>grok/grok-4.6</code>                             | 87.91 | 100.00     | 100.00     | 99.53   | 30.52             | 82.76          | 96.33       | 53.85          | 100.00          | 98.28                | 87.41                | 99.45              | 95.00            | 99.66       |
| <code>deepinfra/google/gemma-4-31B-it</code>           | 87.58 | 96.83      | 95.90      | 95.77   | 98.55             | 84.73          | 95.41       | 38.46          | 100.00          | 98.65                | 95.42                | 51.50              | —                | 99.71       |
| <code>kimi/kimi-k2.6</code>                            | 87.42 | 85.71      | 71.31      | 100.00  | 23.26             | 83.25          | 95.41       | 92.31          | 100.00          | 99.33                | 92.52                | 99.45              | 93.94            | 100.00      |
| <code>anthropic/claude-haiku-5-5</code>                | 86.39 | 92.06      | 78.69      | 94.37   | 97.38             | 71.43          | 97.71       | 100.00         | 100.00          | 33.58                | 98.42                | 97.75              | 61.67            | 100.00      |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>                | 85.41 | 92.06      | 76.23      | 98.59   | 92.44             | 67.98          | 90.37       | 42.31          | 100.00          | 98.88                | 80.90                | 94.67              | 92.42            | 83.54       |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 82.83 | 93.65      | 72.13      | 93.90   | 90.70             | 71.43          | 95.87       | 0.00           | 100.00          | 99.25                | 86.36                | 90.64              | —                | 100.00      |
| <code>gemini/gemini-3.5-flash-lite</code>              | 81.38 | 85.71      | 72.13      | 99.06   | 15.41             | 92.61          | 96.33       | 100.00         | 100.00          | 97.76                | 97.89                | 98.84              | 2.16             | 100.00      |

## Notes

- Each provider is aggregated by providerKey across the runs it appears in; sums and means cover present values only.
- Groups follow the single-run OCR contract: local, thirdPartyService; local and service providers are never ranked against each other.
- Weighted WER and weighted CER are evidence columns: summed breakdown errors divided by summed reference counts, so longer runs count proportionally more.
- Per-run WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Each group ranks price, speed, and quality score independently. No weighted composite or model-tier ranking is emitted.
- Supersedes the hand-authored 2026-06-14 combined report, which is preserved as a historical record.
