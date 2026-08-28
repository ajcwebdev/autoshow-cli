# Combined OCR Provider Comparison Report

## Summary

- Root directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr`
- Runs aggregated: 13 (29 pages)
  - `01-ad-copy` (28 providers, 1 page)
  - `01-ancient` (27 providers, 1 page)
  - `01-book` (27 providers, 1 page)
  - `01-financial-data` (27 providers, 1 page)
  - `01-handwriting` (27 providers, 1 page)
  - `01-medieval` (28 providers, 1 page)
  - `01-non-english` (28 providers, 1 page)
  - `01-test-picture` (28 providers, 1 page)
  - `04-pages-don-quixote` (27 providers, 4 pages)
  - `05-pages-the-odyssey` (27 providers, 5 pages)
  - `1-page-declaration` (28 providers, 1 page)
  - `1-page-newspaper` (27 providers, 1 page)
  - `10-document` (30 providers, 10 pages)
- Distinct providers: 31 (0 local, 31 third-party service)
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
| 1 | <code>deepinfra/google/gemma-3-27b-it</code> | $0.010 | 13/13 | 70.92 | 34.56% | 30.26% | 1.5 | 90.08s | $0.010 |
| 2 | <code>glm/glm-ocr</code> | $0.011 | 13/13 | 69.03 | 23.27% | 19.06% | 19.0 | 7.06s | $0.011 |
| 3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.027 | 13/13 | 76.26 | 32.95% | 27.88% | 1.7 | 78.24s | $0.027 |
| 4 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | $0.035 | 13/13 | 76.22 | 31.67% | 31.03% | 1.7 | 79.12s | $0.035 |
| 5 | <code>openai/gpt-5.4-nano</code> | $0.075 | 13/13 | 65.75 | 42.23% | 36.94% | 1.8 | 73.01s | $0.075 |
| 6 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.120 | 12/13 | 79.38 | 33.32% | 35.01% | 3.4 | 28.19s | $0.120 |
| 7 | <code>gemini/gemini-3.5-flash-lite</code> | $0.147 | 13/13 | 81.31 | 29.67% | 24.85% | 33.3 | 4.02s | $0.147 |
| 8 | <code>openai/gpt-5.6-luna</code> | $0.155 | 13/13 | 88.72 | 12.40% | 12.23% | 12.6 | 10.61s | $0.155 |
| 9 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.173 | 13/13 | 85.25 | 22.92% | 19.01% | 1.4 | 94.49s | $0.173 |
| 10 | <code>mistral/mistral-ocr-2512</code> | $0.200 | 13/13 | 80.89 | 22.00% | 16.81% | 37.5 | 3.57s | $0.200 |
| 11 | <code>openai/gpt-5.4-mini</code> | $0.276 | 12/13 | 77.80 | 38.50% | 34.88% | 29.3 | 4.27s | $0.276 |
| 12 | <code>mistral/mistral-ocr-4-0</code> | $0.400 | 13/13 | 89.94 | 10.91% | 5.43% | 44.8 | 2.99s | $0.400 |
| 13 | <code>grok/grok-4.3</code> | $0.402 | 13/13 | 86.09 | 11.80% | 9.89% | 11.7 | 11.41s | $0.402 |
| 14 | <code>gemini/gemini-3.7-flash</code> | $0.417 | 1/13 | 100.00 | 0.00% | 0.00% | 81.5 | 7.37s | $0.417 |
| 15 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.428 | 13/13 | 74.66 | 18.59% | 25.86% | 15.0 | 8.94s | $0.428 |
| 16 | <code>anthropic/claude-haiku-4-5</code> | $0.472 | 13/13 | 72.33 | 32.57% | 39.07% | 7.4 | 18.10s | $0.472 |
| 17 | <code>gemini/gemini-3.6-flash</code> | $0.542 | 13/13 | 94.41 | 6.66% | 4.65% | 18.6 | 7.18s | $0.542 |
| 18 | <code>kimi/kimi-k2.6</code> | $0.545 | 13/13 | 87.43 | 6.51% | 2.13% | 5.6 | 23.84s | $0.545 |
| 19 | <code>gemini/gemini-3.5-flash</code> | $0.734 | 13/13 | 90.57 | 48.19% | 22.27% | 17.6 | 7.61s | $0.734 |
| 20 | <code>gemini/gemini-3.1-pro-preview</code> | $0.794 | 13/13 | 80.86 | 30.98% | 24.84% | 12.7 | 10.57s | $0.794 |
| 21 | <code>grok/grok-4.5</code> | $0.828 | 13/13 | 88.50 | 8.10% | 3.26% | 5.1 | 26.49s | $0.828 |
| 22 | <code>grok/grok-4.6</code> | $0.841 | 1/13 | 99.66 | 0.34% | 0.36% | 17.0 | 35.25s | $0.841 |
| 23 | <code>anthropic/claude-sonnet-5</code> | $1.268 | 13/13 | 93.09 | 5.06% | 2.35% | 5.5 | 24.44s | $1.268 |
| 24 | <code>openai/gpt-5.6-terra</code> | $1.343 | 13/13 | 91.06 | 4.45% | 2.54% | 10.8 | 12.37s | $1.343 |
| 25 | <code>anthropic/claude-sonnet-4-6</code> | $1.352 | 1/13 | 100.00 | 0.00% | 0.00% | 7.0 | 85.78s | $1.352 |
| 26 | <code>anthropic/claude-opus-4-8</code> | $3.130 | 13/13 | 93.85 | 4.30% | 1.48% | 4.3 | 30.82s | $3.130 |
| 27 | <code>anthropic/claude-opus-5</code> | $3.219 | 13/13 | 92.77 | 4.01% | 2.07% | 4.5 | 29.46s | $3.219 |
| 28 | <code>openai/gpt-5.5</code> | $3.855 | 13/13 | 87.46 | 21.95% | 20.60% | 6.8 | 19.73s | $3.855 |
| 29 | <code>openai/gpt-5.6-sol</code> | $4.533 | 13/13 | 94.88 | 2.56% | 1.31% | 5.3 | 25.09s | $4.533 |
| 30 | <code>kimi/kimi-k3</code> | $5.569 | 7/13 | 98.99 | 0.60% | 0.17% | 1.2 | 140.07s | $5.569 |
| 31 | <code>anthropic/claude-fable-5</code> | $6.652 | 13/13 | 95.52 | 3.83% | 1.14% | 4.7 | 28.78s | $6.652 |

#### Speed

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.7-flash</code> | 81.5 pages/minute | 1/13 | 100.00 | 0.00% | 0.00% | 81.5 | 7.37s | $0.417 |
| 2 | <code>mistral/mistral-ocr-4-0</code> | 44.8 pages/minute | 13/13 | 89.94 | 10.91% | 5.43% | 44.8 | 2.99s | $0.400 |
| 3 | <code>mistral/mistral-ocr-2512</code> | 37.5 pages/minute | 13/13 | 80.89 | 22.00% | 16.81% | 37.5 | 3.57s | $0.200 |
| 4 | <code>gemini/gemini-3.5-flash-lite</code> | 33.3 pages/minute | 13/13 | 81.31 | 29.67% | 24.85% | 33.3 | 4.02s | $0.147 |
| 5 | <code>openai/gpt-5.4-mini</code> | 29.3 pages/minute | 12/13 | 77.80 | 38.50% | 34.88% | 29.3 | 4.27s | $0.276 |
| 6 | <code>glm/glm-ocr</code> | 19.0 pages/minute | 13/13 | 69.03 | 23.27% | 19.06% | 19.0 | 7.06s | $0.011 |
| 7 | <code>gemini/gemini-3.6-flash</code> | 18.6 pages/minute | 13/13 | 94.41 | 6.66% | 4.65% | 18.6 | 7.18s | $0.542 |
| 8 | <code>gemini/gemini-3.5-flash</code> | 17.6 pages/minute | 13/13 | 90.57 | 48.19% | 22.27% | 17.6 | 7.61s | $0.734 |
| 9 | <code>grok/grok-4.6</code> | 17.0 pages/minute | 1/13 | 99.66 | 0.34% | 0.36% | 17.0 | 35.25s | $0.841 |
| 10 | <code>grok/grok-4.20-0309-non-reasoning</code> | 15.0 pages/minute | 13/13 | 74.66 | 18.59% | 25.86% | 15.0 | 8.94s | $0.428 |
| 11 | <code>gemini/gemini-3.1-pro-preview</code> | 12.7 pages/minute | 13/13 | 80.86 | 30.98% | 24.84% | 12.7 | 10.57s | $0.794 |
| 12 | <code>openai/gpt-5.6-luna</code> | 12.6 pages/minute | 13/13 | 88.72 | 12.40% | 12.23% | 12.6 | 10.61s | $0.155 |
| 13 | <code>grok/grok-4.3</code> | 11.7 pages/minute | 13/13 | 86.09 | 11.80% | 9.89% | 11.7 | 11.41s | $0.402 |
| 14 | <code>openai/gpt-5.6-terra</code> | 10.8 pages/minute | 13/13 | 91.06 | 4.45% | 2.54% | 10.8 | 12.37s | $1.343 |
| 15 | <code>anthropic/claude-haiku-4-5</code> | 7.4 pages/minute | 13/13 | 72.33 | 32.57% | 39.07% | 7.4 | 18.10s | $0.472 |
| 16 | <code>anthropic/claude-sonnet-4-6</code> | 7.0 pages/minute | 1/13 | 100.00 | 0.00% | 0.00% | 7.0 | 85.78s | $1.352 |
| 17 | <code>openai/gpt-5.5</code> | 6.8 pages/minute | 13/13 | 87.46 | 21.95% | 20.60% | 6.8 | 19.73s | $3.855 |
| 18 | <code>kimi/kimi-k2.6</code> | 5.6 pages/minute | 13/13 | 87.43 | 6.51% | 2.13% | 5.6 | 23.84s | $0.545 |
| 19 | <code>anthropic/claude-sonnet-5</code> | 5.5 pages/minute | 13/13 | 93.09 | 5.06% | 2.35% | 5.5 | 24.44s | $1.268 |
| 20 | <code>openai/gpt-5.6-sol</code> | 5.3 pages/minute | 13/13 | 94.88 | 2.56% | 1.31% | 5.3 | 25.09s | $4.533 |
| 21 | <code>grok/grok-4.5</code> | 5.1 pages/minute | 13/13 | 88.50 | 8.10% | 3.26% | 5.1 | 26.49s | $0.828 |
| 22 | <code>anthropic/claude-fable-5</code> | 4.7 pages/minute | 13/13 | 95.52 | 3.83% | 1.14% | 4.7 | 28.78s | $6.652 |
| 23 | <code>anthropic/claude-opus-5</code> | 4.5 pages/minute | 13/13 | 92.77 | 4.01% | 2.07% | 4.5 | 29.46s | $3.219 |
| 24 | <code>anthropic/claude-opus-4-8</code> | 4.3 pages/minute | 13/13 | 93.85 | 4.30% | 1.48% | 4.3 | 30.82s | $3.130 |
| 25 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 3.4 pages/minute | 12/13 | 79.38 | 33.32% | 35.01% | 3.4 | 28.19s | $0.120 |
| 26 | <code>openai/gpt-5.4-nano</code> | 1.8 pages/minute | 13/13 | 65.75 | 42.23% | 36.94% | 1.8 | 73.01s | $0.075 |
| 27 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 1.7 pages/minute | 13/13 | 76.26 | 32.95% | 27.88% | 1.7 | 78.24s | $0.027 |
| 28 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 1.7 pages/minute | 13/13 | 76.22 | 31.67% | 31.03% | 1.7 | 79.12s | $0.035 |
| 29 | <code>deepinfra/google/gemma-3-27b-it</code> | 1.5 pages/minute | 13/13 | 70.92 | 34.56% | 30.26% | 1.5 | 90.08s | $0.010 |
| 30 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 1.4 pages/minute | 13/13 | 85.25 | 22.92% | 19.01% | 1.4 | 94.49s | $0.173 |
| 31 | <code>kimi/kimi-k3</code> | 1.2 pages/minute | 7/13 | 98.99 | 0.60% | 0.17% | 1.2 | 140.07s | $5.569 |

#### Quality Score

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-sonnet-4-6</code> | 100.00/100 avg quality score | 1/13 | 100.00 | 0.00% | 0.00% | 7.0 | 85.78s | $1.352 |
| 2 | <code>gemini/gemini-3.7-flash</code> | 100.00/100 avg quality score | 1/13 | 100.00 | 0.00% | 0.00% | 81.5 | 7.37s | $0.417 |
| 3 | <code>grok/grok-4.6</code> | 99.66/100 avg quality score | 1/13 | 99.66 | 0.34% | 0.36% | 17.0 | 35.25s | $0.841 |
| 4 | <code>kimi/kimi-k3</code> | 98.99/100 avg quality score | 7/13 | 98.99 | 0.60% | 0.17% | 1.2 | 140.07s | $5.569 |
| 5 | <code>anthropic/claude-fable-5</code> | 95.52/100 avg quality score | 13/13 | 95.52 | 3.83% | 1.14% | 4.7 | 28.78s | $6.652 |
| 6 | <code>openai/gpt-5.6-sol</code> | 94.88/100 avg quality score | 13/13 | 94.88 | 2.56% | 1.31% | 5.3 | 25.09s | $4.533 |
| 7 | <code>gemini/gemini-3.6-flash</code> | 94.41/100 avg quality score | 13/13 | 94.41 | 6.66% | 4.65% | 18.6 | 7.18s | $0.542 |
| 8 | <code>anthropic/claude-opus-4-8</code> | 93.85/100 avg quality score | 13/13 | 93.85 | 4.30% | 1.48% | 4.3 | 30.82s | $3.130 |
| 9 | <code>anthropic/claude-sonnet-5</code> | 93.09/100 avg quality score | 13/13 | 93.09 | 5.06% | 2.35% | 5.5 | 24.44s | $1.268 |
| 10 | <code>anthropic/claude-opus-5</code> | 92.77/100 avg quality score | 13/13 | 92.77 | 4.01% | 2.07% | 4.5 | 29.46s | $3.219 |
| 11 | <code>openai/gpt-5.6-terra</code> | 91.06/100 avg quality score | 13/13 | 91.06 | 4.45% | 2.54% | 10.8 | 12.37s | $1.343 |
| 12 | <code>gemini/gemini-3.5-flash</code> | 90.57/100 avg quality score | 13/13 | 90.57 | 48.19% | 22.27% | 17.6 | 7.61s | $0.734 |
| 13 | <code>mistral/mistral-ocr-4-0</code> | 89.94/100 avg quality score | 13/13 | 89.94 | 10.91% | 5.43% | 44.8 | 2.99s | $0.400 |
| 14 | <code>openai/gpt-5.6-luna</code> | 88.72/100 avg quality score | 13/13 | 88.72 | 12.40% | 12.23% | 12.6 | 10.61s | $0.155 |
| 15 | <code>grok/grok-4.5</code> | 88.50/100 avg quality score | 13/13 | 88.50 | 8.10% | 3.26% | 5.1 | 26.49s | $0.828 |
| 16 | <code>openai/gpt-5.5</code> | 87.46/100 avg quality score | 13/13 | 87.46 | 21.95% | 20.60% | 6.8 | 19.73s | $3.855 |
| 17 | <code>kimi/kimi-k2.6</code> | 87.43/100 avg quality score | 13/13 | 87.43 | 6.51% | 2.13% | 5.6 | 23.84s | $0.545 |
| 18 | <code>grok/grok-4.3</code> | 86.09/100 avg quality score | 13/13 | 86.09 | 11.80% | 9.89% | 11.7 | 11.41s | $0.402 |
| 19 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 85.25/100 avg quality score | 13/13 | 85.25 | 22.92% | 19.01% | 1.4 | 94.49s | $0.173 |
| 20 | <code>gemini/gemini-3.5-flash-lite</code> | 81.31/100 avg quality score | 13/13 | 81.31 | 29.67% | 24.85% | 33.3 | 4.02s | $0.147 |
| 21 | <code>mistral/mistral-ocr-2512</code> | 80.89/100 avg quality score | 13/13 | 80.89 | 22.00% | 16.81% | 37.5 | 3.57s | $0.200 |
| 22 | <code>gemini/gemini-3.1-pro-preview</code> | 80.86/100 avg quality score | 13/13 | 80.86 | 30.98% | 24.84% | 12.7 | 10.57s | $0.794 |
| 23 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 79.38/100 avg quality score | 12/13 | 79.38 | 33.32% | 35.01% | 3.4 | 28.19s | $0.120 |
| 24 | <code>openai/gpt-5.4-mini</code> | 77.80/100 avg quality score | 12/13 | 77.80 | 38.50% | 34.88% | 29.3 | 4.27s | $0.276 |
| 25 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 76.26/100 avg quality score | 13/13 | 76.26 | 32.95% | 27.88% | 1.7 | 78.24s | $0.027 |
| 26 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 76.22/100 avg quality score | 13/13 | 76.22 | 31.67% | 31.03% | 1.7 | 79.12s | $0.035 |
| 27 | <code>grok/grok-4.20-0309-non-reasoning</code> | 74.66/100 avg quality score | 13/13 | 74.66 | 18.59% | 25.86% | 15.0 | 8.94s | $0.428 |
| 28 | <code>anthropic/claude-haiku-4-5</code> | 72.33/100 avg quality score | 13/13 | 72.33 | 32.57% | 39.07% | 7.4 | 18.10s | $0.472 |
| 29 | <code>deepinfra/google/gemma-3-27b-it</code> | 70.92/100 avg quality score | 13/13 | 70.92 | 34.56% | 30.26% | 1.5 | 90.08s | $0.010 |
| 30 | <code>glm/glm-ocr</code> | 69.03/100 avg quality score | 13/13 | 69.03 | 23.27% | 19.06% | 19.0 | 7.06s | $0.011 |
| 31 | <code>openai/gpt-5.4-nano</code> | 65.75/100 avg quality score | 13/13 | 65.75 | 42.23% | 36.94% | 1.8 | 73.01s | $0.075 |

## Per-Run Quality Score

WER-derived quality score per provider in each run, sorted by mean.

### Third-Party Service

| Provider | Mean | 01-ad-copy | 01-ancient | 01-book | 01-financial-data | 01-handwriting | 01-medieval | 01-non-english | 01-test-picture | 04-pages-don-quixote | 05-pages-the-odyssey | 1-page-declaration | 1-page-newspaper | 10-document |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-sonnet-4-6</code> | 100.00 | — | — | — | — | — | — | — | — | — | — | — | — | 100.00 |
| <code>gemini/gemini-3.7-flash</code> | 100.00 | — | — | — | — | — | — | — | — | — | — | — | — | 100.00 |
| <code>grok/grok-4.6</code> | 99.66 | — | — | — | — | — | — | — | — | — | — | — | — | 99.66 |
| <code>kimi/kimi-k3</code> | 98.99 | 98.41 | — | — | — | — | 95.87 | 100.00 | 100.00 | 99.33 | — | 99.39 | — | 99.94 |
| <code>anthropic/claude-fable-5</code> | 95.52 | 95.24 | 84.43 | 100.00 | 100.00 | 89.66 | 96.33 | 100.00 | 100.00 | 99.78 | 80.81 | 97.20 | 98.26 | 100.00 |
| <code>openai/gpt-5.6-sol</code> | 94.88 | 92.06 | 92.62 | 99.06 | 97.97 | 67.98 | 96.33 | 96.15 | 100.00 | 99.70 | 96.74 | 97.54 | 97.33 | 100.00 |
| <code>gemini/gemini-3.6-flash</code> | 94.41 | 95.24 | 69.67 | 100.00 | 99.71 | 88.67 | 100.00 | 100.00 | 100.00 | 99.33 | 96.30 | 99.04 | 79.37 | 100.00 |
| <code>anthropic/claude-opus-4-8</code> | 93.85 | 96.83 | 97.54 | 96.24 | 98.84 | 81.28 | 95.41 | 76.92 | 100.00 | 99.78 | 82.75 | 99.73 | 94.75 | 100.00 |
| <code>anthropic/claude-sonnet-5</code> | 93.09 | 100.00 | 98.36 | 100.00 | 97.97 | 83.25 | 96.33 | 61.54 | 100.00 | 99.78 | 81.34 | 99.18 | 92.38 | 100.00 |
| <code>anthropic/claude-opus-5</code> | 92.77 | 100.00 | 72.95 | 96.24 | 97.09 | 85.22 | 99.54 | 76.92 | 100.00 | 99.78 | 81.07 | 99.80 | 97.37 | 100.00 |
| <code>openai/gpt-5.6-terra</code> | 91.06 | 92.06 | 73.77 | 99.06 | 93.31 | 78.33 | 93.12 | 69.23 | 100.00 | 98.28 | 96.48 | 98.43 | 91.66 | 100.00 |
| <code>gemini/gemini-3.5-flash</code> | 90.57 | 98.41 | 98.36 | 99.53 | 98.55 | 88.18 | 96.33 | 100.00 | 100.00 | 99.85 | 98.59 | 99.59 | 0.00 | 100.00 |
| <code>mistral/mistral-ocr-4-0</code> | 89.94 | 80.95 | 83.61 | 93.43 | 92.15 | 92.12 | 98.17 | 76.92 | 100.00 | 99.70 | 89.79 | 89.14 | 73.49 | 99.71 |
| <code>openai/gpt-5.6-luna</code> | 88.72 | 92.06 | 92.62 | 97.18 | 90.99 | 71.92 | 94.50 | 65.38 | 100.00 | 99.63 | 92.17 | 89.69 | 67.26 | 100.00 |
| <code>grok/grok-4.5</code> | 88.50 | 98.41 | 99.18 | 99.53 | 31.10 | 86.70 | 95.87 | 73.08 | 100.00 | 98.20 | 79.05 | 95.70 | 94.96 | 98.74 |
| <code>openai/gpt-5.5</code> | 87.46 | 92.06 | 98.36 | 99.53 | 98.55 | 75.37 | 96.33 | 73.08 | 100.00 | 98.35 | 76.50 | 98.22 | 30.62 | 100.00 |
| <code>kimi/kimi-k2.6</code> | 87.43 | 85.71 | 71.31 | 100.00 | 23.26 | 83.74 | 95.41 | 92.31 | 100.00 | 99.33 | 92.17 | 99.45 | 93.94 | 100.00 |
| <code>grok/grok-4.3</code> | 86.09 | 90.48 | 95.08 | 99.53 | 28.49 | 80.30 | 100.00 | 61.54 | 100.00 | 99.03 | 95.95 | 99.80 | 70.99 | 97.94 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 85.25 | 96.83 | 89.34 | 99.53 | 97.38 | 80.30 | 94.95 | 46.15 | 100.00 | 99.25 | 84.07 | 97.40 | 25.71 | 97.31 |
| <code>gemini/gemini-3.5-flash-lite</code> | 81.31 | 85.71 | 72.13 | 99.06 | 15.41 | 92.12 | 96.33 | 100.00 | 100.00 | 97.76 | 97.54 | 98.84 | 2.16 | 100.00 |
| <code>mistral/mistral-ocr-2512</code> | 80.89 | 79.37 | 60.66 | 92.96 | 12.21 | 85.22 | 97.71 | 100.00 | 100.00 | 99.93 | 96.39 | 86.68 | 43.80 | 96.67 |
| <code>gemini/gemini-3.1-pro-preview</code> | 80.86 | 96.83 | 72.13 | 99.06 | 12.50 | 91.13 | 96.33 | 100.00 | 100.00 | 97.98 | 81.07 | 99.39 | 4.70 | 100.00 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 79.38 | 90.48 | 87.70 | 93.43 | 95.35 | 83.74 | 94.50 | 38.46 | 80.00 | 97.61 | 88.82 | 91.33 | 11.10 | — |
| <code>openai/gpt-5.4-mini</code> | 77.80 | 87.30 | 88.52 | 99.06 | 96.80 | 79.31 | 93.58 | 53.85 | 100.00 | — | 28.96 | 91.46 | 14.78 | 100.00 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 76.26 | 92.06 | 72.13 | 93.90 | 95.06 | 71.92 | 96.33 | 0.00 | 100.00 | 99.18 | 84.07 | 93.10 | 0.00 | 93.64 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 76.22 | 96.83 | 79.51 | 95.77 | 84.30 | 71.43 | 96.33 | 0.00 | 100.00 | 98.95 | 77.11 | 81.28 | 23.59 | 85.78 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 74.66 | 93.65 | 68.03 | 99.53 | 32.27 | 34.98 | 99.54 | 0.00 | 100.00 | 98.73 | 87.24 | 98.70 | 66.37 | 91.57 |
| <code>anthropic/claude-haiku-4-5</code> | 72.33 | 88.89 | 88.52 | 99.06 | 15.99 | 48.77 | 92.20 | 26.92 | 100.00 | 97.76 | 94.28 | 93.24 | 14.02 | 80.68 |
| <code>deepinfra/google/gemma-3-27b-it</code> | 70.92 | 82.54 | 71.31 | 95.77 | 22.09 | 53.69 | 94.50 | 38.46 | 100.00 | 94.39 | 80.37 | 84.84 | 9.61 | 94.38 |
| <code>glm/glm-ocr</code> | 69.03 | 49.21 | 84.43 | 80.75 | 0.00 | 0.00 | 85.32 | 57.69 | 100.00 | 98.43 | 79.67 | 83.27 | 83.48 | 95.13 |
| <code>openai/gpt-5.4-nano</code> | 65.75 | 80.95 | 61.48 | 92.02 | 87.21 | 37.93 | 80.28 | 19.23 | 100.00 | 38.82 | 57.48 | 91.19 | 8.39 | 99.77 |

## Notes

- Each provider is aggregated by providerKey across the runs it appears in; sums and means cover present values only.
- Groups follow the single-run OCR contract: local, thirdPartyService; local and service providers are never ranked against each other.
- Weighted WER and weighted CER are evidence columns: summed breakdown errors divided by summed reference counts, so longer runs count proportionally more.
- Each group ranks price, speed, and quality score independently. No weighted composite or model-tier ranking is emitted.
- Supersedes the hand-authored 2026-06-14 combined report, which is preserved as a historical record.
