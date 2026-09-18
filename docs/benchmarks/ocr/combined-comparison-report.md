# Combined OCR Provider Comparison Report

## Summary

- Root directory: `docs/benchmarks/ocr`
- Runs aggregated: 13 (29 pages)
  - `01-ad-copy` (23 providers, 1 page)
  - `01-ancient` (23 providers, 1 page)
  - `01-book` (23 providers, 1 page)
  - `01-financial-data` (23 providers, 1 page)
  - `01-handwriting` (23 providers, 1 page)
  - `01-medieval` (23 providers, 1 page)
  - `01-non-english` (22 providers, 1 page)
  - `01-test-picture` (23 providers, 1 page)
  - `04-pages-don-quixote` (23 providers, 4 pages)
  - `05-pages-the-odyssey` (23 providers, 5 pages)
  - `1-page-declaration` (23 providers, 1 page)
  - `1-page-newspaper` (21 providers, 1 page)
  - `10-document` (23 providers, 10 pages)
- Distinct providers: 23 (0 local, 23 third-party service)
- Quality aggregates the per-run WER-derived score as an unweighted mean across runs; speed and price aggregate page-weighted totals (pages per minute, USD per 100 pages).

## Method

- Providers are matched by `providerKey` and aggregated across the runs they appear in; sums and means cover present values only.
- Quality Score rankings use the unweighted mean `metrics.score` descending.
- Weighted WER and Weighted CER are evidence columns: summed errors from the corresponding breakdowns divided by summed reference counts, so longer runs count proportionally more.
- Speed rankings use aggregate pages per minute descending: `sum(pageCount) / sum(processingTimeMs / 60000)`; missing timing sorts last.
- Price rankings use USD per 100 pages ascending: `sum(costCents) / sum(pageCount)` (cents per page is numerically equal to dollars per 100 pages); local providers at zero; missing cost sorts last.
- Tied ranking values break deterministically: price ties by quality descending, then pages/minute descending, then provider key; speed and quality ties by provider key.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Speed

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

### Third-Party Service

#### Price

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.021 | 12/13 | 87.61 | 12.54% | 10.81% | 5.4 | 25.72s | $0.021 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.046 | 12/13 | 82.81 | 7.37% | 6.30% | 3.3 | 42.94s | $0.046 |
| 3 | <code>gemini/gemini-3.5-flash-lite</code> | $0.147 | 13/13 | 81.31 | 29.67% | 24.85% | 33.3 | 4.02s | $0.147 |
| 4 | <code>openai/gpt-5.6-luna</code> | $0.155 | 13/13 | 88.72 | 12.40% | 12.23% | 12.6 | 10.61s | $0.155 |
| 5 | <code>glm/glm-5.3-flash</code> | $0.196 | 12/13 | 91.85 | 5.12% | 1.18% | 2.0 | 69.15s | $0.196 |
| 6 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.267 | 13/13 | 85.39 | 10.19% | 6.40% | 6.8 | 19.66s | $0.267 |
| 7 | <code>mistral/mistral-ocr-4-0</code> | $0.400 | 13/13 | 89.94 | 10.91% | 5.43% | 44.8 | 2.99s | $0.400 |
| 8 | <code>mistral/mistral-ocr-4-1</code> | $0.400 | 13/13 | 89.79 | 11.44% | 6.64% | 41.1 | 3.25s | $0.400 |
| 9 | <code>gemini/gemini-3.6-flash</code> | $0.542 | 13/13 | 94.41 | 6.66% | 4.65% | 18.6 | 7.18s | $0.542 |
| 10 | <code>kimi/kimi-k2.6</code> | $0.545 | 13/13 | 87.43 | 6.51% | 2.13% | 5.6 | 23.84s | $0.545 |
| 11 | <code>gemini/gemini-3.8-flash</code> | $0.585 | 13/13 | 94.08 | 5.18% | 1.91% | 21.4 | 6.24s | $0.585 |
| 12 | <code>gemini/gemini-3.7-flash</code> | $0.605 | 13/13 | 92.81 | 6.69% | 1.58% | 27.1 | 4.94s | $0.605 |
| 13 | <code>gemini/gemini-3.5-flash</code> | $0.734 | 13/13 | 90.57 | 48.19% | 22.27% | 17.6 | 7.61s | $0.734 |
| 14 | <code>grok/grok-4.5</code> | $0.828 | 13/13 | 88.50 | 8.10% | 3.26% | 5.1 | 26.49s | $0.828 |
| 15 | <code>grok/grok-4.6</code> | $0.857 | 13/13 | 87.92 | 6.43% | 2.40% | 3.4 | 38.87s | $0.857 |
| 16 | <code>anthropic/claude-sonnet-5</code> | $1.268 | 13/13 | 93.09 | 5.06% | 2.35% | 5.5 | 24.44s | $1.268 |
| 17 | <code>openai/gpt-5.6-terra</code> | $1.343 | 13/13 | 91.06 | 4.45% | 2.54% | 10.8 | 12.37s | $1.343 |
| 18 | <code>anthropic/claude-opus-5</code> | $3.219 | 13/13 | 92.77 | 4.01% | 2.07% | 4.5 | 29.46s | $3.219 |
| 19 | <code>openai/gpt-5.6-sol</code> | $4.533 | 13/13 | 94.88 | 2.56% | 1.31% | 5.3 | 25.09s | $4.533 |
| 20 | <code>kimi/kimi-k3</code> | $5.166 | 13/13 | 91.18 | 4.23% | 1.49% | 0.9 | 147.35s | $5.166 |
| 21 | <code>openai/gpt-6-astra</code> | $5.551 | 13/13 | 95.64 | 1.96% | 0.38% | 7.4 | 17.99s | $5.551 |
| 22 | <code>anthropic/claude-fable-5</code> | $6.652 | 13/13 | 95.52 | 3.83% | 1.14% | 4.7 | 28.78s | $6.652 |
| 23 | <code>anthropic/claude-fable-5-1</code> | $7.678 | 13/13 | 96.70 | 3.58% | 0.78% | 4.1 | 32.77s | $7.678 |

#### Speed

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-0</code> | 44.8 pages/minute | 13/13 | 89.94 | 10.91% | 5.43% | 44.8 | 2.99s | $0.400 |
| 2 | <code>mistral/mistral-ocr-4-1</code> | 41.1 pages/minute | 13/13 | 89.79 | 11.44% | 6.64% | 41.1 | 3.25s | $0.400 |
| 3 | <code>gemini/gemini-3.5-flash-lite</code> | 33.3 pages/minute | 13/13 | 81.31 | 29.67% | 24.85% | 33.3 | 4.02s | $0.147 |
| 4 | <code>gemini/gemini-3.7-flash</code> | 27.1 pages/minute | 13/13 | 92.81 | 6.69% | 1.58% | 27.1 | 4.94s | $0.605 |
| 5 | <code>gemini/gemini-3.8-flash</code> | 21.4 pages/minute | 13/13 | 94.08 | 5.18% | 1.91% | 21.4 | 6.24s | $0.585 |
| 6 | <code>gemini/gemini-3.6-flash</code> | 18.6 pages/minute | 13/13 | 94.41 | 6.66% | 4.65% | 18.6 | 7.18s | $0.542 |
| 7 | <code>gemini/gemini-3.5-flash</code> | 17.6 pages/minute | 13/13 | 90.57 | 48.19% | 22.27% | 17.6 | 7.61s | $0.734 |
| 8 | <code>openai/gpt-5.6-luna</code> | 12.6 pages/minute | 13/13 | 88.72 | 12.40% | 12.23% | 12.6 | 10.61s | $0.155 |
| 9 | <code>openai/gpt-5.6-terra</code> | 10.8 pages/minute | 13/13 | 91.06 | 4.45% | 2.54% | 10.8 | 12.37s | $1.343 |
| 10 | <code>openai/gpt-6-astra</code> | 7.4 pages/minute | 13/13 | 95.64 | 1.96% | 0.38% | 7.4 | 17.99s | $5.551 |
| 11 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 6.8 pages/minute | 13/13 | 85.39 | 10.19% | 6.40% | 6.8 | 19.66s | $0.267 |
| 12 | <code>kimi/kimi-k2.6</code> | 5.6 pages/minute | 13/13 | 87.43 | 6.51% | 2.13% | 5.6 | 23.84s | $0.545 |
| 13 | <code>anthropic/claude-sonnet-5</code> | 5.5 pages/minute | 13/13 | 93.09 | 5.06% | 2.35% | 5.5 | 24.44s | $1.268 |
| 14 | <code>deepinfra/google/gemma-4-31B-it</code> | 5.4 pages/minute | 12/13 | 87.61 | 12.54% | 10.81% | 5.4 | 25.72s | $0.021 |
| 15 | <code>openai/gpt-5.6-sol</code> | 5.3 pages/minute | 13/13 | 94.88 | 2.56% | 1.31% | 5.3 | 25.09s | $4.533 |
| 16 | <code>grok/grok-4.5</code> | 5.1 pages/minute | 13/13 | 88.50 | 8.10% | 3.26% | 5.1 | 26.49s | $0.828 |
| 17 | <code>anthropic/claude-fable-5</code> | 4.7 pages/minute | 13/13 | 95.52 | 3.83% | 1.14% | 4.7 | 28.78s | $6.652 |
| 18 | <code>anthropic/claude-opus-5</code> | 4.5 pages/minute | 13/13 | 92.77 | 4.01% | 2.07% | 4.5 | 29.46s | $3.219 |
| 19 | <code>anthropic/claude-fable-5-1</code> | 4.1 pages/minute | 13/13 | 96.70 | 3.58% | 0.78% | 4.1 | 32.77s | $7.678 |
| 20 | <code>grok/grok-4.6</code> | 3.4 pages/minute | 13/13 | 87.92 | 6.43% | 2.40% | 3.4 | 38.87s | $0.857 |
| 21 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 3.3 pages/minute | 12/13 | 82.81 | 7.37% | 6.30% | 3.3 | 42.94s | $0.046 |
| 22 | <code>glm/glm-5.3-flash</code> | 2.0 pages/minute | 12/13 | 91.85 | 5.12% | 1.18% | 2.0 | 69.15s | $0.196 |
| 23 | <code>kimi/kimi-k3</code> | 0.9 pages/minute | 13/13 | 91.18 | 4.23% | 1.49% | 0.9 | 147.35s | $5.166 |

#### Quality Score

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5-1</code> | 96.70/100 avg quality score | 13/13 | 96.70 | 3.58% | 0.78% | 4.1 | 32.77s | $7.678 |
| 2 | <code>openai/gpt-6-astra</code> | 95.64/100 avg quality score | 13/13 | 95.64 | 1.96% | 0.38% | 7.4 | 17.99s | $5.551 |
| 3 | <code>anthropic/claude-fable-5</code> | 95.52/100 avg quality score | 13/13 | 95.52 | 3.83% | 1.14% | 4.7 | 28.78s | $6.652 |
| 4 | <code>openai/gpt-5.6-sol</code> | 94.88/100 avg quality score | 13/13 | 94.88 | 2.56% | 1.31% | 5.3 | 25.09s | $4.533 |
| 5 | <code>gemini/gemini-3.6-flash</code> | 94.41/100 avg quality score | 13/13 | 94.41 | 6.66% | 4.65% | 18.6 | 7.18s | $0.542 |
| 6 | <code>gemini/gemini-3.8-flash</code> | 94.08/100 avg quality score | 13/13 | 94.08 | 5.18% | 1.91% | 21.4 | 6.24s | $0.585 |
| 7 | <code>anthropic/claude-sonnet-5</code> | 93.09/100 avg quality score | 13/13 | 93.09 | 5.06% | 2.35% | 5.5 | 24.44s | $1.268 |
| 8 | <code>gemini/gemini-3.7-flash</code> | 92.81/100 avg quality score | 13/13 | 92.81 | 6.69% | 1.58% | 27.1 | 4.94s | $0.605 |
| 9 | <code>anthropic/claude-opus-5</code> | 92.77/100 avg quality score | 13/13 | 92.77 | 4.01% | 2.07% | 4.5 | 29.46s | $3.219 |
| 10 | <code>glm/glm-5.3-flash</code> | 91.85/100 avg quality score | 12/13 | 91.85 | 5.12% | 1.18% | 2.0 | 69.15s | $0.196 |
| 11 | <code>kimi/kimi-k3</code> | 91.18/100 avg quality score | 13/13 | 91.18 | 4.23% | 1.49% | 0.9 | 147.35s | $5.166 |
| 12 | <code>openai/gpt-5.6-terra</code> | 91.06/100 avg quality score | 13/13 | 91.06 | 4.45% | 2.54% | 10.8 | 12.37s | $1.343 |
| 13 | <code>gemini/gemini-3.5-flash</code> | 90.57/100 avg quality score | 13/13 | 90.57 | 48.19% | 22.27% | 17.6 | 7.61s | $0.734 |
| 14 | <code>mistral/mistral-ocr-4-0</code> | 89.94/100 avg quality score | 13/13 | 89.94 | 10.91% | 5.43% | 44.8 | 2.99s | $0.400 |
| 15 | <code>mistral/mistral-ocr-4-1</code> | 89.79/100 avg quality score | 13/13 | 89.79 | 11.44% | 6.64% | 41.1 | 3.25s | $0.400 |
| 16 | <code>openai/gpt-5.6-luna</code> | 88.72/100 avg quality score | 13/13 | 88.72 | 12.40% | 12.23% | 12.6 | 10.61s | $0.155 |
| 17 | <code>grok/grok-4.5</code> | 88.50/100 avg quality score | 13/13 | 88.50 | 8.10% | 3.26% | 5.1 | 26.49s | $0.828 |
| 18 | <code>grok/grok-4.6</code> | 87.92/100 avg quality score | 13/13 | 87.92 | 6.43% | 2.40% | 3.4 | 38.87s | $0.857 |
| 19 | <code>deepinfra/google/gemma-4-31B-it</code> | 87.61/100 avg quality score | 12/13 | 87.61 | 12.54% | 10.81% | 5.4 | 25.72s | $0.021 |
| 20 | <code>kimi/kimi-k2.6</code> | 87.43/100 avg quality score | 13/13 | 87.43 | 6.51% | 2.13% | 5.6 | 23.84s | $0.545 |
| 21 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 85.39/100 avg quality score | 13/13 | 85.39 | 10.19% | 6.40% | 6.8 | 19.66s | $0.267 |
| 22 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 82.81/100 avg quality score | 12/13 | 82.81 | 7.37% | 6.30% | 3.3 | 42.94s | $0.046 |
| 23 | <code>gemini/gemini-3.5-flash-lite</code> | 81.31/100 avg quality score | 13/13 | 81.31 | 29.67% | 24.85% | 33.3 | 4.02s | $0.147 |

## Per-Run Quality Score

WER-derived quality score per provider in each run, sorted by mean.

### Third-Party Service

| Provider | Mean | 01-ad-copy | 01-ancient | 01-book | 01-financial-data | 01-handwriting | 01-medieval | 01-non-english | 01-test-picture | 04-pages-don-quixote | 05-pages-the-odyssey | 1-page-declaration | 1-page-newspaper | 10-document |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5-1</code> | 96.70 | 98.41 | 100.00 | 100.00 | 100.00 | 85.71 | 96.33 | 100.00 | 100.00 | 98.35 | 80.81 | 99.39 | 98.14 | 100.00 |
| <code>openai/gpt-6-astra</code> | 95.64 | 98.41 | 72.95 | 100.00 | 99.13 | 83.74 | 96.33 | 100.00 | 100.00 | 98.35 | 96.48 | 99.18 | 98.77 | 100.00 |
| <code>anthropic/claude-fable-5</code> | 95.52 | 95.24 | 84.43 | 100.00 | 100.00 | 89.66 | 96.33 | 100.00 | 100.00 | 99.78 | 80.81 | 97.20 | 98.26 | 100.00 |
| <code>openai/gpt-5.6-sol</code> | 94.88 | 92.06 | 92.62 | 99.06 | 97.97 | 67.98 | 96.33 | 96.15 | 100.00 | 99.70 | 96.74 | 97.54 | 97.33 | 100.00 |
| <code>gemini/gemini-3.6-flash</code> | 94.41 | 95.24 | 69.67 | 100.00 | 99.71 | 88.67 | 100.00 | 100.00 | 100.00 | 99.33 | 96.30 | 99.04 | 79.37 | 100.00 |
| <code>gemini/gemini-3.8-flash</code> | 94.08 | 98.41 | 73.77 | 100.00 | 99.71 | 81.77 | 96.33 | 100.00 | 100.00 | 99.85 | 80.81 | 100.00 | 92.38 | 100.00 |
| <code>anthropic/claude-sonnet-5</code> | 93.09 | 100.00 | 98.36 | 100.00 | 97.97 | 83.25 | 96.33 | 61.54 | 100.00 | 99.78 | 81.34 | 99.18 | 92.38 | 100.00 |
| <code>gemini/gemini-3.7-flash</code> | 92.81 | 98.41 | 73.77 | 100.00 | 96.51 | 77.34 | 96.33 | 100.00 | 100.00 | 99.85 | 73.59 | 99.86 | 90.85 | 100.00 |
| <code>anthropic/claude-opus-5</code> | 92.77 | 100.00 | 72.95 | 96.24 | 97.09 | 85.22 | 99.54 | 76.92 | 100.00 | 99.78 | 81.07 | 99.80 | 97.37 | 100.00 |
| <code>glm/glm-5.3-flash</code> | 91.85 | 95.24 | 68.85 | 93.90 | 90.70 | 83.74 | 98.62 | — | 100.00 | 99.63 | 73.86 | 99.52 | 98.60 | 99.54 |
| <code>kimi/kimi-k3</code> | 91.18 | 98.41 | 83.61 | 99.53 | 31.10 | 82.76 | 95.87 | 100.00 | 100.00 | 99.33 | 96.74 | 99.39 | 98.64 | 99.94 |
| <code>openai/gpt-5.6-terra</code> | 91.06 | 92.06 | 73.77 | 99.06 | 93.31 | 78.33 | 93.12 | 69.23 | 100.00 | 98.28 | 96.48 | 98.43 | 91.66 | 100.00 |
| <code>gemini/gemini-3.5-flash</code> | 90.57 | 98.41 | 98.36 | 99.53 | 98.55 | 88.18 | 96.33 | 100.00 | 100.00 | 99.85 | 98.59 | 99.59 | 0.00 | 100.00 |
| <code>mistral/mistral-ocr-4-0</code> | 89.94 | 80.95 | 83.61 | 93.43 | 92.15 | 92.12 | 98.17 | 76.92 | 100.00 | 99.70 | 89.79 | 89.14 | 73.49 | 99.71 |
| <code>mistral/mistral-ocr-4-1</code> | 89.79 | 82.54 | 64.75 | 94.37 | 92.15 | 90.15 | 95.87 | 96.15 | 100.00 | 99.85 | 92.25 | 86.82 | 72.55 | 99.77 |
| <code>openai/gpt-5.6-luna</code> | 88.72 | 92.06 | 92.62 | 97.18 | 90.99 | 71.92 | 94.50 | 65.38 | 100.00 | 99.63 | 92.17 | 89.69 | 67.26 | 100.00 |
| <code>grok/grok-4.5</code> | 88.50 | 98.41 | 99.18 | 99.53 | 31.10 | 86.70 | 95.87 | 73.08 | 100.00 | 98.20 | 79.05 | 95.70 | 94.96 | 98.74 |
| <code>grok/grok-4.6</code> | 87.92 | 100.00 | 100.00 | 99.53 | 30.52 | 83.25 | 96.33 | 53.85 | 100.00 | 98.28 | 87.15 | 99.45 | 95.00 | 99.66 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 87.61 | 96.83 | 95.90 | 95.77 | 98.55 | 85.22 | 95.41 | 38.46 | 100.00 | 98.65 | 95.25 | 51.50 | — | 99.71 |
| <code>kimi/kimi-k2.6</code> | 87.43 | 85.71 | 71.31 | 100.00 | 23.26 | 83.74 | 95.41 | 92.31 | 100.00 | 99.33 | 92.17 | 99.45 | 93.94 | 100.00 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 85.39 | 92.06 | 76.23 | 98.59 | 92.44 | 67.98 | 90.37 | 42.31 | 100.00 | 98.88 | 80.63 | 94.67 | 92.42 | 83.54 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 82.81 | 93.65 | 72.13 | 93.90 | 90.70 | 71.43 | 95.87 | 0.00 | 100.00 | 99.25 | 86.09 | 90.64 | — | 100.00 |
| <code>gemini/gemini-3.5-flash-lite</code> | 81.31 | 85.71 | 72.13 | 99.06 | 15.41 | 92.12 | 96.33 | 100.00 | 100.00 | 97.76 | 97.54 | 98.84 | 2.16 | 100.00 |

## Notes

- Each provider is aggregated by providerKey across the runs it appears in; sums and means cover present values only.
- Groups follow the single-run OCR contract: local, thirdPartyService; local and service providers are never ranked against each other.
- Weighted WER and weighted CER are evidence columns: summed breakdown errors divided by summed reference counts, so longer runs count proportionally more.
- Each group ranks price, speed, and quality score independently. No weighted composite or model-tier ranking is emitted.
- Supersedes the hand-authored 2026-06-14 combined report, which is preserved as a historical record.
