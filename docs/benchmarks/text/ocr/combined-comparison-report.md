# Combined OCR Provider Comparison Report

## Summary

- Root directory: `docs/benchmarks/text/ocr`
- Runs aggregated: 64 (96 pages)
  - `01-ad-copy` (30 providers, 1 page)
  - `01-financial-data` (30 providers, 1 page)
  - `01-handwriting` (30 providers, 1 page)
  - `01-test-picture` (30 providers, 1 page)
  - `04-pages-don-quixote` (30 providers, 4 pages)
  - `05-pages-the-odyssey` (30 providers, 5 pages)
  - `1-page-declaration` (30 providers, 1 page)
  - `1-page-newspaper` (27 providers, 1 page)
  - `10-document` (30 providers, 10 pages)
  - `advertisement-legend-1900` (21 providers, 1 page)
  - `advertisement-metrolink` (21 providers, 1 page)
  - `advertisement-newtown-cruise` (21 providers, 1 page)
  - `advertisement-nyc-skate` (21 providers, 1 page)
  - `advertisement-three-masons` (21 providers, 1 page)
  - `bc-rerun-04-pages-don-quixote` (21 providers, 4 pages)
  - `bc-rerun-05-pages-the-odyssey` (21 providers, 5 pages)
  - `bc-rerun-10-document` (21 providers, 10 pages)
  - `clean-typography-federal-assistance` (21 providers, 1 page)
  - `clean-typography-good-talk` (21 providers, 1 page)
  - `clean-typography-language-teaching` (21 providers, 1 page)
  - `clean-typography-phototest` (21 providers, 1 page)
  - `clean-typography-suitcase` (21 providers, 1 page)
  - `d-rerun-01-ad-copy` (21 providers, 1 page)
  - `efg-rerun-01-financial-data` (21 providers, 1 page)
  - `efg-rerun-01-handwriting` (21 providers, 1 page)
  - `efg-rerun-1-page-declaration` (21 providers, 1 page)
  - `efg-rerun-1-page-newspaper` (20 providers, 1 page)
  - `handwriting-marker-flowchart` (21 providers, 1 page)
  - `handwriting-marker-prose` (21 providers, 1 page)
  - `handwriting-marker-table` (21 providers, 1 page)
  - `handwriting-patton-travel` (21 providers, 1 page)
  - `handwriting-washington-receipt` (21 providers, 1 page)
  - `historical-print-birds` (21 providers, 1 page)
  - `historical-print-frankenstein` (21 providers, 1 page)
  - `historical-print-leaves-of-grass` (21 providers, 1 page)
  - `historical-print-origin-of-species` (21 providers, 1 page)
  - `historical-print-paradise-lost` (21 providers, 1 page)
  - `newspapers-expansion-bln-charter-aldermen` (21 providers, 1 page)
  - `newspapers-expansion-bln-era-burglars` (21 providers, 1 page)
  - `newspapers-expansion-bln-lloyds-bank-robbery` (21 providers, 1 page)
  - `newspapers-expansion-bln-morning-chronicle-inquest` (21 providers, 1 page)
  - `newspapers-expansion-bln-police-news-putney` (21 providers, 1 page)
  - `newspapers-expansion-courant-1721-article` (21 providers, 1 page)
  - `newspapers-expansion-independent-hindustan-1920-p3` (21 providers, 1 page)
  - `newspapers-expansion-london-gazette-1815-p3` (21 providers, 1 page)
  - `newspapers-expansion-london-gazette-1815-p4` (21 providers, 1 page)
  - `newspapers-expansion-new-york-times-1929-10-24-p31` (16 providers, 1 page)
  - `newspapers-expansion-perth-gazette-1833-03-02-p1` (20 providers, 1 page)
  - `newspapers-expansion-perth-gazette-1833-04-13-p1` (21 providers, 1 page)
  - `newspapers-leader` (21 providers, 1 page)
  - `newspapers-london-gazette` (21 providers, 1 page)
  - `newspapers-monthly-repository` (21 providers, 1 page)
  - `newspapers-northern-star` (21 providers, 1 page)
  - `newspapers-tomahawk` (21 providers, 1 page)
  - `numeric-tables-inflammatory-pathways` (21 providers, 1 page)
  - `numeric-tables-practitioner-attitudes` (21 providers, 1 page)
  - `numeric-tables-program-implementation` (21 providers, 1 page)
  - `numeric-tables-synthetic-financial` (21 providers, 1 page)
  - `numeric-tables-synthetic-marketing` (21 providers, 1 page)
  - `technical-code-cli-parser` (21 providers, 1 page)
  - `technical-code-country-codes` (21 providers, 1 page)
  - `technical-code-nbitcoin` (21 providers, 1 page)
  - `technical-code-pinta` (21 providers, 1 page)
  - `technical-code-podio` (21 providers, 1 page)
- Distinct providers: 31 (1 local, 30 third-party service)
- Quality aggregates the per-run WER-derived score as an unweighted mean across runs; speed and price aggregate page-weighted totals (pages per minute, USD per 100 pages).

## Method

- Providers are matched by `providerKey` and aggregated across the runs they appear in; sums and means cover present values only.
- Quality Score rankings use the unweighted mean `metrics.score` descending.
- 5 runs use partial annotated-word references with text-only OCR. They contribute cost and speed, but no primary quality score or weighted error counts. Annotated-target token coverage and derived-order WER/CER are separate diagnostics; they do not establish region localization or exhaustive full-page accuracy.
- Per-run WER uses ASCII `[a-z0-9]` token streams after normalization and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence; review it together with the source images for non-Latin cases.
- Weighted WER and Weighted CER are evidence columns: summed errors from the corresponding breakdowns divided by summed reference counts, so longer runs count proportionally more.
- Speed rankings use aggregate pages per minute descending: `sum(pageCount) / sum(processingTimeMs / 60000)`; missing timing sorts last.
- Price rankings use USD per 100 pages ascending: `sum(costCents) / sum(pageCount)` (cents per page is numerically equal to dollars per 100 pages); local providers at zero; missing cost sorts last.
- Tied ranking values break deterministically: price ties by quality descending, then pages/minute descending, then provider key; speed and quality ties by provider key.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract/tesseract</code> | $0.000 | 55/64 | 60.57 | 43.34% | 41.48% | 53.1 | 1.46s | $0.000 |

#### Speed

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract/tesseract</code> | 53.1 pages/minute | 55/64 | 60.57 | 43.34% | 41.48% | 53.1 | 1.46s | $0.000 |

#### Quality Score

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract/tesseract</code> | 60.57/100 avg quality score | 55/64 | 60.57 | 43.34% | 41.48% | 53.1 | 1.46s | $0.000 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.042 | 61/64 | 90.29 | 32.58% | 30.81% | 3.4 | 26.68s | $0.042 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.052 | 63/64 | 90.49 | 31.49% | 29.87% | 6.7 | 13.57s | $0.052 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.080 | 64/64 | 90.98 | 27.73% | 27.99% | 10.1 | 8.88s | $0.080 |
| 4 | <code>openai/gpt-6-luna</code> | $0.095 | 64/64 | 92.65 | 22.94% | 23.88% | 4.5 | 19.84s | $0.095 |
| 5 | <code>openai/gpt-5.6-luna</code> | $0.138 | 9/64 | 89.32 | 12.79% | 12.39% | 14.9 | 11.17s | $0.138 |
| 6 | <code>glm/glm-5.3-flash</code> | $0.202 | 9/64 | 93.41 | 4.79% | 1.16% | 2.1 | 79.17s | $0.202 |
| 7 | <code>gemini/gemini-3.5-flash-lite</code> | $0.212 | 64/64 | 90.52 | 30.42% | 27.62% | 23.5 | 3.83s | $0.212 |
| 8 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.237 | 64/64 | 87.78 | 25.84% | 24.61% | 1.6 | 55.95s | $0.237 |
| 9 | <code>mistral/mistral-ocr-4-1</code> | $0.400 | 64/64 | 92.29 | 24.32% | 21.58% | 19.0 | 4.73s | $0.400 |
| 10 | <code>mistral/mistral-ocr-4-0</code> | $0.400 | 9/64 | 90.74 | 11.13% | 5.73% | 44.1 | 3.78s | $0.400 |
| 11 | <code>kimi/kimi-k2.6</code> | $0.566 | 9/64 | 86.38 | 6.37% | 2.08% | 5.8 | 28.56s | $0.566 |
| 12 | <code>gemini/gemini-3.7-flash</code> | $0.585 | 9/64 | 93.03 | 6.62% | 1.65% | 28.5 | 5.85s | $0.585 |
| 13 | <code>gemini/gemini-3.5-flash</code> | $0.878 | 63/64 | 95.07 | 16.86% | 7.70% | 15.7 | 5.78s | $0.878 |
| 14 | <code>grok/grok-4.6</code> | $0.890 | 9/64 | 88.12 | 6.60% | 1.92% | 4.3 | 38.90s | $0.890 |
| 15 | <code>gemini/gemini-3.6-flash</code> | $0.919 | 63/64 | 97.30 | 4.01% | 1.99% | 16.2 | 5.57s | $0.919 |
| 16 | <code>gemini/gemini-3.8-flash</code> | $0.934 | 63/64 | 97.50 | 3.05% | 1.11% | 4.0 | 22.47s | $0.934 |
| 17 | <code>anthropic/claude-sonnet-5</code> | $1.267 | 9/64 | 94.95 | 5.13% | 1.63% | 5.7 | 29.47s | $1.267 |
| 18 | <code>openai/gpt-6.1-sol</code> | $1.302 | 64/64 | 96.51 | 6.03% | 3.00% | 3.9 | 23.02s | $1.302 |
| 19 | <code>grok/grok-4.5</code> | $1.402 | 63/64 | 92.39 | 6.68% | 2.53% | 4.5 | 20.27s | $1.402 |
| 20 | <code>anthropic/claude-sonnet-5-5</code> | $1.430 | 64/64 | 95.94 | 20.21% | 20.13% | 8.2 | 11.02s | $1.430 |
| 21 | <code>gemini/gemini-4-argon</code> | $1.973 | 64/64 | 96.43 | 8.66% | 5.09% | 4.1 | 22.00s | $1.973 |
| 22 | <code>openai/gpt-5.6-terra</code> | $1.974 | 64/64 | 90.81 | 25.12% | 23.66% | 6.2 | 14.56s | $1.974 |
| 23 | <code>anthropic/claude-opus-5-5</code> | $3.153 | 64/64 | 96.94 | 9.70% | 12.19% | 6.4 | 14.06s | $3.153 |
| 24 | <code>anthropic/claude-opus-5</code> | $3.250 | 9/64 | 95.67 | 3.69% | 1.00% | 4.6 | 35.97s | $3.250 |
| 25 | <code>openai/gpt-5.6-sol</code> | $4.153 | 9/64 | 94.46 | 2.44% | 1.15% | 6.1 | 27.47s | $4.153 |
| 26 | <code>grok/grok-4.7</code> | $4.621 | 62/64 | 96.66 | 2.71% | 0.90% | 1.3 | 67.96s | $4.621 |
| 27 | <code>kimi/kimi-k3</code> | $5.334 | 9/64 | 89.57 | 4.14% | 1.58% | 1.1 | 155.57s | $5.334 |
| 28 | <code>openai/gpt-6-astra</code> | $5.922 | 64/64 | 95.89 | 4.79% | 2.96% | 4.4 | 20.52s | $5.922 |
| 29 | <code>anthropic/claude-fable-5</code> | $8.275 | 64/64 | 96.62 | 4.40% | 2.88% | 4.2 | 21.51s | $8.275 |
| 30 | <code>anthropic/claude-fable-5-1</code> | $8.866 | 64/64 | 96.78 | 3.96% | 3.40% | 4.7 | 19.23s | $8.866 |

#### Speed

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-0</code> | 44.1 pages/minute | 9/64 | 90.74 | 11.13% | 5.73% | 44.1 | 3.78s | $0.400 |
| 2 | <code>gemini/gemini-3.7-flash</code> | 28.5 pages/minute | 9/64 | 93.03 | 6.62% | 1.65% | 28.5 | 5.85s | $0.585 |
| 3 | <code>gemini/gemini-3.5-flash-lite</code> | 23.5 pages/minute | 64/64 | 90.52 | 30.42% | 27.62% | 23.5 | 3.83s | $0.212 |
| 4 | <code>mistral/mistral-ocr-4-1</code> | 19.0 pages/minute | 64/64 | 92.29 | 24.32% | 21.58% | 19.0 | 4.73s | $0.400 |
| 5 | <code>gemini/gemini-3.6-flash</code> | 16.2 pages/minute | 63/64 | 97.30 | 4.01% | 1.99% | 16.2 | 5.57s | $0.919 |
| 6 | <code>gemini/gemini-3.5-flash</code> | 15.7 pages/minute | 63/64 | 95.07 | 16.86% | 7.70% | 15.7 | 5.78s | $0.878 |
| 7 | <code>openai/gpt-5.6-luna</code> | 14.9 pages/minute | 9/64 | 89.32 | 12.79% | 12.39% | 14.9 | 11.17s | $0.138 |
| 8 | <code>anthropic/claude-haiku-5-5</code> | 10.1 pages/minute | 64/64 | 90.98 | 27.73% | 27.99% | 10.1 | 8.88s | $0.080 |
| 9 | <code>anthropic/claude-sonnet-5-5</code> | 8.2 pages/minute | 64/64 | 95.94 | 20.21% | 20.13% | 8.2 | 11.02s | $1.430 |
| 10 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 6.7 pages/minute | 63/64 | 90.49 | 31.49% | 29.87% | 6.7 | 13.57s | $0.052 |
| 11 | <code>anthropic/claude-opus-5-5</code> | 6.4 pages/minute | 64/64 | 96.94 | 9.70% | 12.19% | 6.4 | 14.06s | $3.153 |
| 12 | <code>openai/gpt-5.6-terra</code> | 6.2 pages/minute | 64/64 | 90.81 | 25.12% | 23.66% | 6.2 | 14.56s | $1.974 |
| 13 | <code>openai/gpt-5.6-sol</code> | 6.1 pages/minute | 9/64 | 94.46 | 2.44% | 1.15% | 6.1 | 27.47s | $4.153 |
| 14 | <code>kimi/kimi-k2.6</code> | 5.8 pages/minute | 9/64 | 86.38 | 6.37% | 2.08% | 5.8 | 28.56s | $0.566 |
| 15 | <code>anthropic/claude-sonnet-5</code> | 5.7 pages/minute | 9/64 | 94.95 | 5.13% | 1.63% | 5.7 | 29.47s | $1.267 |
| 16 | <code>anthropic/claude-fable-5-1</code> | 4.7 pages/minute | 64/64 | 96.78 | 3.96% | 3.40% | 4.7 | 19.23s | $8.866 |
| 17 | <code>anthropic/claude-opus-5</code> | 4.6 pages/minute | 9/64 | 95.67 | 3.69% | 1.00% | 4.6 | 35.97s | $3.250 |
| 18 | <code>openai/gpt-6-luna</code> | 4.5 pages/minute | 64/64 | 92.65 | 22.94% | 23.88% | 4.5 | 19.84s | $0.095 |
| 19 | <code>grok/grok-4.5</code> | 4.5 pages/minute | 63/64 | 92.39 | 6.68% | 2.53% | 4.5 | 20.27s | $1.402 |
| 20 | <code>openai/gpt-6-astra</code> | 4.4 pages/minute | 64/64 | 95.89 | 4.79% | 2.96% | 4.4 | 20.52s | $5.922 |
| 21 | <code>grok/grok-4.6</code> | 4.3 pages/minute | 9/64 | 88.12 | 6.60% | 1.92% | 4.3 | 38.90s | $0.890 |
| 22 | <code>anthropic/claude-fable-5</code> | 4.2 pages/minute | 64/64 | 96.62 | 4.40% | 2.88% | 4.2 | 21.51s | $8.275 |
| 23 | <code>gemini/gemini-4-argon</code> | 4.1 pages/minute | 64/64 | 96.43 | 8.66% | 5.09% | 4.1 | 22.00s | $1.973 |
| 24 | <code>gemini/gemini-3.8-flash</code> | 4.0 pages/minute | 63/64 | 97.50 | 3.05% | 1.11% | 4.0 | 22.47s | $0.934 |
| 25 | <code>openai/gpt-6.1-sol</code> | 3.9 pages/minute | 64/64 | 96.51 | 6.03% | 3.00% | 3.9 | 23.02s | $1.302 |
| 26 | <code>deepinfra/google/gemma-4-31B-it</code> | 3.4 pages/minute | 61/64 | 90.29 | 32.58% | 30.81% | 3.4 | 26.68s | $0.042 |
| 27 | <code>glm/glm-5.3-flash</code> | 2.1 pages/minute | 9/64 | 93.41 | 4.79% | 1.16% | 2.1 | 79.17s | $0.202 |
| 28 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 1.6 pages/minute | 64/64 | 87.78 | 25.84% | 24.61% | 1.6 | 55.95s | $0.237 |
| 29 | <code>grok/grok-4.7</code> | 1.3 pages/minute | 62/64 | 96.66 | 2.71% | 0.90% | 1.3 | 67.96s | $4.621 |
| 30 | <code>kimi/kimi-k3</code> | 1.1 pages/minute | 9/64 | 89.57 | 4.14% | 1.58% | 1.1 | 155.57s | $5.334 |

#### Quality Score

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.8-flash</code> | 97.50/100 avg quality score | 63/64 | 97.50 | 3.05% | 1.11% | 4.0 | 22.47s | $0.934 |
| 2 | <code>gemini/gemini-3.6-flash</code> | 97.30/100 avg quality score | 63/64 | 97.30 | 4.01% | 1.99% | 16.2 | 5.57s | $0.919 |
| 3 | <code>anthropic/claude-opus-5-5</code> | 96.94/100 avg quality score | 64/64 | 96.94 | 9.70% | 12.19% | 6.4 | 14.06s | $3.153 |
| 4 | <code>anthropic/claude-fable-5-1</code> | 96.78/100 avg quality score | 64/64 | 96.78 | 3.96% | 3.40% | 4.7 | 19.23s | $8.866 |
| 5 | <code>grok/grok-4.7</code> | 96.66/100 avg quality score | 62/64 | 96.66 | 2.71% | 0.90% | 1.3 | 67.96s | $4.621 |
| 6 | <code>anthropic/claude-fable-5</code> | 96.62/100 avg quality score | 64/64 | 96.62 | 4.40% | 2.88% | 4.2 | 21.51s | $8.275 |
| 7 | <code>openai/gpt-6.1-sol</code> | 96.51/100 avg quality score | 64/64 | 96.51 | 6.03% | 3.00% | 3.9 | 23.02s | $1.302 |
| 8 | <code>gemini/gemini-4-argon</code> | 96.43/100 avg quality score | 64/64 | 96.43 | 8.66% | 5.09% | 4.1 | 22.00s | $1.973 |
| 9 | <code>anthropic/claude-sonnet-5-5</code> | 95.94/100 avg quality score | 64/64 | 95.94 | 20.21% | 20.13% | 8.2 | 11.02s | $1.430 |
| 10 | <code>openai/gpt-6-astra</code> | 95.89/100 avg quality score | 64/64 | 95.89 | 4.79% | 2.96% | 4.4 | 20.52s | $5.922 |
| 11 | <code>anthropic/claude-opus-5</code> | 95.67/100 avg quality score | 9/64 | 95.67 | 3.69% | 1.00% | 4.6 | 35.97s | $3.250 |
| 12 | <code>gemini/gemini-3.5-flash</code> | 95.07/100 avg quality score | 63/64 | 95.07 | 16.86% | 7.70% | 15.7 | 5.78s | $0.878 |
| 13 | <code>anthropic/claude-sonnet-5</code> | 94.95/100 avg quality score | 9/64 | 94.95 | 5.13% | 1.63% | 5.7 | 29.47s | $1.267 |
| 14 | <code>openai/gpt-5.6-sol</code> | 94.46/100 avg quality score | 9/64 | 94.46 | 2.44% | 1.15% | 6.1 | 27.47s | $4.153 |
| 15 | <code>glm/glm-5.3-flash</code> | 93.41/100 avg quality score | 9/64 | 93.41 | 4.79% | 1.16% | 2.1 | 79.17s | $0.202 |
| 16 | <code>gemini/gemini-3.7-flash</code> | 93.03/100 avg quality score | 9/64 | 93.03 | 6.62% | 1.65% | 28.5 | 5.85s | $0.585 |
| 17 | <code>openai/gpt-6-luna</code> | 92.65/100 avg quality score | 64/64 | 92.65 | 22.94% | 23.88% | 4.5 | 19.84s | $0.095 |
| 18 | <code>grok/grok-4.5</code> | 92.39/100 avg quality score | 63/64 | 92.39 | 6.68% | 2.53% | 4.5 | 20.27s | $1.402 |
| 19 | <code>mistral/mistral-ocr-4-1</code> | 92.29/100 avg quality score | 64/64 | 92.29 | 24.32% | 21.58% | 19.0 | 4.73s | $0.400 |
| 20 | <code>anthropic/claude-haiku-5-5</code> | 90.98/100 avg quality score | 64/64 | 90.98 | 27.73% | 27.99% | 10.1 | 8.88s | $0.080 |
| 21 | <code>openai/gpt-5.6-terra</code> | 90.81/100 avg quality score | 64/64 | 90.81 | 25.12% | 23.66% | 6.2 | 14.56s | $1.974 |
| 22 | <code>mistral/mistral-ocr-4-0</code> | 90.74/100 avg quality score | 9/64 | 90.74 | 11.13% | 5.73% | 44.1 | 3.78s | $0.400 |
| 23 | <code>gemini/gemini-3.5-flash-lite</code> | 90.52/100 avg quality score | 64/64 | 90.52 | 30.42% | 27.62% | 23.5 | 3.83s | $0.212 |
| 24 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 90.49/100 avg quality score | 63/64 | 90.49 | 31.49% | 29.87% | 6.7 | 13.57s | $0.052 |
| 25 | <code>deepinfra/google/gemma-4-31B-it</code> | 90.29/100 avg quality score | 61/64 | 90.29 | 32.58% | 30.81% | 3.4 | 26.68s | $0.042 |
| 26 | <code>kimi/kimi-k3</code> | 89.57/100 avg quality score | 9/64 | 89.57 | 4.14% | 1.58% | 1.1 | 155.57s | $5.334 |
| 27 | <code>openai/gpt-5.6-luna</code> | 89.32/100 avg quality score | 9/64 | 89.32 | 12.79% | 12.39% | 14.9 | 11.17s | $0.138 |
| 28 | <code>grok/grok-4.6</code> | 88.12/100 avg quality score | 9/64 | 88.12 | 6.60% | 1.92% | 4.3 | 38.90s | $0.890 |
| 29 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 87.78/100 avg quality score | 64/64 | 87.78 | 25.84% | 24.61% | 1.6 | 55.95s | $0.237 |
| 30 | <code>kimi/kimi-k2.6</code> | 86.38/100 avg quality score | 9/64 | 86.38 | 6.37% | 2.08% | 5.8 | 28.56s | $0.566 |

## Per-Run Quality Score

WER-derived quality score per provider in each run, sorted by mean.

### Local

| Provider | Mean | 01-ad-copy | 01-financial-data | 01-handwriting | 01-test-picture | 04-pages-don-quixote | 05-pages-the-odyssey | 1-page-declaration | 1-page-newspaper | 10-document | advertisement-legend-1900 | advertisement-metrolink | advertisement-newtown-cruise | advertisement-nyc-skate | advertisement-three-masons | bc-rerun-04-pages-don-quixote | bc-rerun-05-pages-the-odyssey | bc-rerun-10-document | clean-typography-federal-assistance | clean-typography-good-talk | clean-typography-language-teaching | clean-typography-phototest | clean-typography-suitcase | d-rerun-01-ad-copy | efg-rerun-01-financial-data | efg-rerun-01-handwriting | efg-rerun-1-page-declaration | efg-rerun-1-page-newspaper | handwriting-marker-flowchart | handwriting-marker-prose | handwriting-marker-table | handwriting-patton-travel | handwriting-washington-receipt | historical-print-birds | historical-print-frankenstein | historical-print-leaves-of-grass | historical-print-origin-of-species | historical-print-paradise-lost | newspapers-expansion-bln-charter-aldermen | newspapers-expansion-bln-era-burglars | newspapers-expansion-bln-lloyds-bank-robbery | newspapers-expansion-bln-morning-chronicle-inquest | newspapers-expansion-bln-police-news-putney | newspapers-expansion-courant-1721-article | newspapers-expansion-independent-hindustan-1920-p3 | newspapers-expansion-london-gazette-1815-p3 | newspapers-expansion-london-gazette-1815-p4 | newspapers-expansion-new-york-times-1929-10-24-p31 | newspapers-expansion-perth-gazette-1833-03-02-p1 | newspapers-expansion-perth-gazette-1833-04-13-p1 | newspapers-leader | newspapers-london-gazette | newspapers-monthly-repository | newspapers-northern-star | newspapers-tomahawk | numeric-tables-inflammatory-pathways | numeric-tables-practitioner-attitudes | numeric-tables-program-implementation | numeric-tables-synthetic-financial | numeric-tables-synthetic-marketing | technical-code-cli-parser | technical-code-country-codes | technical-code-nbitcoin | technical-code-pinta | technical-code-podio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract/tesseract</code> | 60.57 | — | — | — | — | — | — | — | — | — | — | — | — | — | — | 96.41 | 76.06 | 90.08 | 100.00 | 82.50 | 90.48 | 100.00 | 98.04 | 25.40 | 49.13 | 8.37 | 14.55 | 6.99 | 5.26 | 11.76 | 0.00 | 0.00 | 0.00 | 93.08 | 97.88 | 96.83 | 96.03 | 71.53 | 93.89 | 94.51 | 41.83 | 88.36 | 83.54 | 59.52 | 88.94 | 66.20 | 68.96 | 48.81 | 55.27 | 74.24 | 66.05 | 94.39 | 88.67 | 90.27 | 96.12 | 4.35 | 1.79 | 2.76 | 0.00 | 0.00 | 74.70 | 93.94 | 82.35 | 90.14 | 68.52 |

### Third-Party Service

| Provider | Mean | 01-ad-copy | 01-financial-data | 01-handwriting | 01-test-picture | 04-pages-don-quixote | 05-pages-the-odyssey | 1-page-declaration | 1-page-newspaper | 10-document | advertisement-legend-1900 | advertisement-metrolink | advertisement-newtown-cruise | advertisement-nyc-skate | advertisement-three-masons | bc-rerun-04-pages-don-quixote | bc-rerun-05-pages-the-odyssey | bc-rerun-10-document | clean-typography-federal-assistance | clean-typography-good-talk | clean-typography-language-teaching | clean-typography-phototest | clean-typography-suitcase | d-rerun-01-ad-copy | efg-rerun-01-financial-data | efg-rerun-01-handwriting | efg-rerun-1-page-declaration | efg-rerun-1-page-newspaper | handwriting-marker-flowchart | handwriting-marker-prose | handwriting-marker-table | handwriting-patton-travel | handwriting-washington-receipt | historical-print-birds | historical-print-frankenstein | historical-print-leaves-of-grass | historical-print-origin-of-species | historical-print-paradise-lost | newspapers-expansion-bln-charter-aldermen | newspapers-expansion-bln-era-burglars | newspapers-expansion-bln-lloyds-bank-robbery | newspapers-expansion-bln-morning-chronicle-inquest | newspapers-expansion-bln-police-news-putney | newspapers-expansion-courant-1721-article | newspapers-expansion-independent-hindustan-1920-p3 | newspapers-expansion-london-gazette-1815-p3 | newspapers-expansion-london-gazette-1815-p4 | newspapers-expansion-new-york-times-1929-10-24-p31 | newspapers-expansion-perth-gazette-1833-03-02-p1 | newspapers-expansion-perth-gazette-1833-04-13-p1 | newspapers-leader | newspapers-london-gazette | newspapers-monthly-repository | newspapers-northern-star | newspapers-tomahawk | numeric-tables-inflammatory-pathways | numeric-tables-practitioner-attitudes | numeric-tables-program-implementation | numeric-tables-synthetic-financial | numeric-tables-synthetic-marketing | technical-code-cli-parser | technical-code-country-codes | technical-code-nbitcoin | technical-code-pinta | technical-code-podio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| <code>gemini/gemini-3.8-flash</code> | 97.50 | 98.41 | 99.71 | 82.27 | 100.00 | 99.85 | 81.16 | 100.00 | 92.38 | 100.00 | — | — | — | — | — | 98.28 | 97.36 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 95.24 | 99.13 | 81.28 | 99.93 | 94.92 | 100.00 | 97.06 | 100.00 | 96.25 | 82.50 | 100.00 | 98.31 | 98.19 | 96.03 | 98.64 | 97.38 | 99.42 | 96.08 | 97.84 | 100.00 | 97.62 | 99.57 | 96.03 | 97.88 | — | 92.88 | 95.51 | 100.00 | 100.00 | 99.52 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 98.25 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 |
| <code>gemini/gemini-3.6-flash</code> | 97.30 | 95.24 | 99.71 | 89.16 | 100.00 | 99.33 | 96.48 | 99.04 | 79.37 | 100.00 | — | — | — | — | — | 98.80 | 95.77 | 99.94 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 95.24 | 99.71 | 93.10 | 99.04 | 94.75 | 100.00 | 100.00 | 100.00 | 98.75 | 81.25 | 100.00 | 99.15 | 98.19 | 96.03 | 74.24 | 97.38 | 99.42 | 100.00 | 100.00 | 100.00 | 96.94 | 92.67 | 96.24 | 97.71 | — | 92.23 | 92.19 | 100.00 | 99.72 | 99.76 | 99.84 | 96.90 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 |
| <code>anthropic/claude-opus-5-5</code> | 96.94 | 98.41 | 100.00 | 88.18 | 100.00 | 99.78 | 73.86 | 99.73 | 98.69 | 100.00 | — | — | — | — | — | 99.78 | 74.47 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 98.41 | 100.00 | 87.68 | 99.25 | 99.20 | 100.00 | 100.00 | 100.00 | 98.75 | 80.00 | 100.00 | 99.15 | 98.19 | 100.00 | 99.66 | 100.00 | 99.42 | 100.00 | 99.57 | 100.00 | 99.32 | 99.43 | 98.61 | 98.41 | 63.38 | 95.79 | 95.42 | 96.04 | 100.00 | 92.77 | 98.12 | 96.90 | 98.55 | 100.00 | 100.00 | 100.00 | 94.54 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 |
| <code>anthropic/claude-fable-5-1</code> | 96.78 | 98.41 | 100.00 | 86.21 | 100.00 | 98.35 | 81.07 | 99.39 | 98.14 | 100.00 | — | — | — | — | — | 99.25 | 84.33 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 98.41 | 99.71 | 79.80 | 98.57 | 99.45 | 100.00 | 100.00 | 100.00 | 97.50 | 71.25 | 100.00 | 99.15 | 98.19 | 96.03 | 73.90 | 100.00 | 99.42 | 100.00 | 99.57 | 100.00 | 99.66 | 99.28 | 98.39 | 98.06 | 92.35 | 98.18 | 95.42 | 96.04 | 100.00 | 92.77 | 98.12 | 96.90 | 94.20 | 100.00 | 98.47 | 99.64 | 96.72 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 |
| <code>grok/grok-4.7</code> | 96.66 | 100.00 | 94.77 | 86.21 | 100.00 | 99.70 | 92.17 | 99.45 | — | 100.00 | — | — | — | — | — | 99.70 | 92.61 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 98.84 | 85.71 | 99.73 | 98.69 | 100.00 | 97.06 | 100.00 | 96.25 | 57.50 | 100.00 | 99.15 | 98.19 | 100.00 | 98.31 | 97.38 | 99.42 | 96.08 | 99.57 | 99.37 | 95.58 | 99.57 | 98.18 | 97.71 | — | 98.47 | 95.33 | 96.04 | 99.86 | 93.01 | 99.84 | 99.22 | 93.00 | 99.55 | 91.41 | 91.42 | 75.55 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 |
| <code>anthropic/claude-fable-5</code> | 96.62 | 95.24 | 100.00 | 90.15 | 100.00 | 99.78 | 80.99 | 97.20 | 98.26 | 100.00 | — | — | — | — | — | 98.35 | 81.87 | 99.83 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 88.89 | 97.09 | 88.67 | 99.86 | 99.20 | 100.00 | 97.06 | 100.00 | 97.50 | 88.75 | 100.00 | 99.15 | 98.19 | 96.03 | 74.24 | 100.00 | 99.42 | 100.00 | 97.84 | 100.00 | 98.64 | 93.10 | 98.61 | 97.88 | 92.73 | 89.62 | 95.42 | 96.04 | 100.00 | 92.77 | 98.12 | 96.90 | 93.96 | 100.00 | 98.16 | 99.45 | 95.85 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 |
| <code>openai/gpt-6.1-sol</code> | 96.51 | 92.06 | 98.84 | 80.30 | 100.00 | 98.35 | 73.68 | 99.80 | 98.86 | 100.00 | — | — | — | — | — | 98.35 | 89.17 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 92.06 | 99.13 | 82.27 | 99.86 | 94.20 | 100.00 | 97.06 | 100.00 | 97.50 | 86.25 | 100.00 | 98.31 | 98.19 | 96.03 | 99.66 | 97.38 | 99.42 | 96.08 | 97.63 | 99.37 | 96.26 | 98.99 | 95.71 | 95.06 | 84.52 | 94.48 | 89.86 | 99.15 | 98.32 | 99.76 | 99.84 | 99.61 | 98.31 | 95.98 | 95.40 | 99.64 | 93.45 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 |
| <code>gemini/gemini-4-argon</code> | 96.43 | 96.83 | 100.00 | 89.66 | 100.00 | 98.43 | 73.50 | 99.32 | 89.20 | 100.00 | — | — | — | — | — | 98.88 | 76.50 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 96.83 | 100.00 | 90.64 | 99.32 | 98.86 | 100.00 | 97.06 | 100.00 | 97.50 | 85.00 | 100.00 | 99.15 | 98.19 | 96.03 | 99.66 | 100.00 | 99.42 | 96.08 | 97.84 | 99.37 | 82.31 | 93.25 | 96.24 | 96.12 | 74.37 | 92.96 | 91.56 | 100.00 | 98.32 | 99.52 | 97.96 | 100.00 | 100.00 | 100.00 | 95.40 | 100.00 | 98.25 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 |
| <code>anthropic/claude-sonnet-5-5</code> | 95.94 | 98.41 | 99.13 | 81.77 | 100.00 | 98.28 | 97.10 | 99.11 | 97.08 | 100.00 | — | — | — | — | — | 98.43 | 97.62 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 98.41 | 99.42 | 79.80 | 98.63 | 99.24 | 100.00 | 100.00 | 100.00 | 97.50 | 82.50 | 100.00 | 99.15 | 98.19 | 96.03 | 74.24 | 100.00 | 99.42 | 100.00 | 100.00 | 100.00 | 97.62 | 98.99 | 98.39 | 97.71 | 4.82 | 96.22 | 95.24 | 96.04 | 100.00 | 99.52 | 100.00 | 96.90 | 97.34 | 100.00 | 100.00 | 100.00 | 91.92 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 |
| <code>openai/gpt-6-astra</code> | 95.89 | 98.41 | 99.13 | 84.24 | 100.00 | 98.35 | 96.65 | 99.18 | 98.77 | 100.00 | — | — | — | — | — | 98.43 | 78.79 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 88.89 | 98.84 | 73.40 | 99.25 | 94.62 | 100.00 | 97.06 | 100.00 | 96.25 | 83.75 | 100.00 | 98.31 | 98.19 | 96.03 | 99.66 | 96.94 | 99.13 | 96.08 | 97.84 | 99.37 | 96.60 | 92.53 | 95.92 | 95.94 | 91.10 | 94.77 | 90.75 | 99.43 | 98.32 | 99.76 | 99.84 | 100.00 | 98.31 | 54.91 | 95.40 | 95.80 | 92.58 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 |
| <code>anthropic/claude-opus-5</code> | 95.67 | 100.00 | 97.09 | 85.71 | 100.00 | 99.78 | 81.25 | 99.80 | 97.37 | 100.00 | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| <code>gemini/gemini-3.5-flash</code> | 95.07 | 98.41 | 98.55 | 87.68 | 100.00 | 99.85 | 98.86 | 99.59 | 0.00 | 100.00 | — | — | — | — | — | 98.80 | 90.67 | 99.94 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 95.24 | 99.71 | 82.27 | 99.39 | 98.48 | 100.00 | 100.00 | 100.00 | 97.50 | 82.50 | 100.00 | 99.15 | 98.19 | 96.03 | 74.24 | 100.00 | 99.42 | 100.00 | 100.00 | 100.00 | 95.24 | 98.99 | 96.14 | 97.88 | — | 92.08 | 92.19 | 100.00 | 100.00 | 99.28 | 98.43 | 96.90 | 100.00 | 54.91 | 100.00 | 100.00 | 97.38 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 |
| <code>anthropic/claude-sonnet-5</code> | 94.95 | 100.00 | 97.97 | 83.74 | 100.00 | 99.78 | 81.51 | 99.18 | 92.38 | 100.00 | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| <code>openai/gpt-5.6-sol</code> | 94.46 | 92.06 | 97.97 | 68.47 | 100.00 | 99.70 | 97.10 | 97.54 | 97.33 | 100.00 | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| <code>glm/glm-5.3-flash</code> | 93.41 | 95.24 | 90.70 | 83.25 | 100.00 | 99.63 | 74.21 | 99.52 | 98.60 | 99.54 | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| <code>gemini/gemini-3.7-flash</code> | 93.03 | 98.41 | 96.51 | 77.83 | 100.00 | 99.85 | 73.94 | 99.86 | 90.85 | 100.00 | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| <code>openai/gpt-6-luna</code> | 92.65 | 92.06 | 93.02 | 74.88 | 100.00 | 99.40 | 94.10 | 97.54 | 73.06 | 100.00 | — | — | — | — | — | 98.80 | 95.95 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 92.06 | 98.26 | 68.47 | 94.33 | 58.24 | 100.00 | 97.06 | 100.00 | 75.00 | 51.25 | 100.00 | 99.15 | 98.19 | 100.00 | 71.86 | 97.38 | 99.42 | 96.08 | 100.00 | 99.37 | 93.54 | 98.71 | 96.89 | 95.06 | 17.27 | 93.10 | 95.69 | 94.91 | 99.72 | 99.52 | 97.96 | 100.00 | 90.58 | 98.66 | 98.77 | 97.81 | 83.41 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 |
| <code>grok/grok-4.5</code> | 92.39 | 98.41 | 31.10 | 86.21 | 100.00 | 98.20 | 79.23 | 95.70 | 94.96 | 98.74 | — | — | — | — | — | 97.76 | 89.44 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 93.65 | 31.10 | 88.67 | 99.11 | 94.37 | 89.47 | 97.06 | 100.00 | 90.00 | 56.25 | 100.00 | 98.31 | 98.19 | 96.03 | 73.22 | 97.38 | 99.42 | 96.08 | 99.57 | 99.37 | 98.64 | 93.25 | 95.49 | 96.83 | — | 91.79 | 99.01 | 99.01 | 98.32 | 99.76 | 99.69 | 96.90 | 85.51 | 96.88 | 88.96 | 88.87 | 64.63 | 100.00 | 100.00 | 100.00 | 100.00 | 98.15 |
| <code>mistral/mistral-ocr-4-1</code> | 92.29 | 82.54 | 92.15 | 89.66 | 100.00 | 99.85 | 92.43 | 86.82 | 72.55 | 99.77 | — | — | — | — | — | 99.85 | 94.01 | 99.71 | 100.00 | 70.00 | 100.00 | 100.00 | 100.00 | 82.54 | 92.15 | 85.71 | 75.00 | 79.71 | 47.37 | 100.00 | 93.33 | 91.25 | 61.25 | 100.00 | 99.15 | 97.74 | 100.00 | 97.97 | 100.00 | 99.42 | 100.00 | 99.57 | 99.68 | 97.28 | 98.99 | 97.85 | 97.18 | 6.75 | 92.88 | 94.70 | 95.47 | 100.00 | 93.01 | 97.80 | 96.90 | 99.76 | 100.00 | 100.00 | 100.00 | 98.47 | 100.00 | 96.97 | 100.00 | 100.00 | 100.00 |
| <code>anthropic/claude-haiku-5-5</code> | 90.98 | 92.06 | 97.38 | 71.43 | 100.00 | 33.58 | 98.42 | 97.75 | 61.67 | 100.00 | — | — | — | — | — | 99.40 | 94.28 | 99.89 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 92.06 | 32.56 | 87.19 | 95.15 | 73.99 | 84.21 | 100.00 | 100.00 | 92.50 | 56.25 | 100.00 | 99.15 | 100.00 | 96.03 | 73.56 | 100.00 | 99.42 | 100.00 | 99.57 | 100.00 | 97.96 | 99.28 | 96.89 | 97.18 | 4.06 | 95.35 | 95.15 | 95.19 | 100.00 | 92.77 | 98.12 | 96.90 | 83.82 | 98.66 | 99.69 | 100.00 | 89.52 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 |
| <code>openai/gpt-5.6-terra</code> | 90.81 | 92.06 | 93.31 | 78.33 | 100.00 | 98.28 | 96.83 | 98.43 | 91.66 | 100.00 | — | — | — | — | — | 98.20 | 92.08 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 90.48 | 90.12 | 69.95 | 97.75 | 69.08 | 89.47 | 100.00 | 100.00 | 85.00 | 30.00 | 100.00 | 98.31 | 96.83 | 96.03 | 72.20 | 97.38 | 98.84 | 95.42 | 99.57 | 99.37 | 92.86 | 98.85 | 94.21 | 92.24 | 3.28 | 84.53 | 89.77 | 94.06 | 98.18 | 99.76 | 99.06 | 99.61 | 90.82 | 54.02 | 98.16 | 94.89 | 58.52 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 |
| <code>mistral/mistral-ocr-4-0</code> | 90.74 | 80.95 | 92.15 | 91.63 | 100.00 | 99.70 | 89.88 | 89.14 | 73.49 | 99.71 | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| <code>gemini/gemini-3.5-flash-lite</code> | 90.52 | 85.71 | 15.41 | 92.61 | 100.00 | 97.76 | 97.89 | 98.84 | 2.16 | 100.00 | — | — | — | — | — | 98.43 | 89.44 | 99.83 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 92.06 | 31.10 | 91.13 | 91.39 | 89.33 | 100.00 | 100.00 | 100.00 | 98.75 | 78.75 | 100.00 | 99.15 | 98.19 | 100.00 | 73.56 | 96.94 | 99.42 | 96.08 | 99.57 | 99.68 | 95.24 | 93.10 | 95.92 | 95.77 | 2.86 | 62.09 | 91.38 | 100.00 | 98.18 | 99.52 | 97.65 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 95.63 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 90.49 | 93.65 | 90.70 | 71.43 | 100.00 | 99.25 | 86.36 | 90.64 | — | 100.00 | — | — | — | — | — | 99.25 | 86.80 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 95.24 | 91.86 | 73.89 | 99.80 | 0.00 | 89.47 | 100.00 | 100.00 | 85.00 | 50.00 | 98.74 | 98.31 | 98.19 | 96.03 | 73.90 | 97.38 | 99.42 | 89.54 | 97.84 | 98.73 | 84.01 | 92.53 | 95.28 | 94.00 | 12.11 | 82.43 | 90.39 | 97.88 | 99.58 | 99.52 | 99.22 | 100.00 | 85.02 | 97.32 | 96.01 | 99.27 | 78.17 | 98.80 | 100.00 | 98.04 | 99.30 | 98.15 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 90.29 | 96.83 | 98.55 | 84.73 | 100.00 | 98.65 | 95.42 | 51.50 | — | 99.71 | — | — | — | — | — | 98.88 | 94.98 | 99.77 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 96.83 | 97.97 | 87.19 | 35.52 | — | 89.47 | 97.06 | 100.00 | 95.00 | 61.25 | 100.00 | 98.31 | 98.19 | 95.70 | 72.54 | 97.38 | 99.42 | 96.08 | 97.20 | 100.00 | 96.26 | 87.93 | 65.67 | 43.03 | 6.18 | — | 53.59 | 98.02 | 91.44 | 98.55 | 94.98 | 100.00 | 97.34 | 97.32 | 100.00 | 98.72 | 93.01 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 |
| <code>kimi/kimi-k3</code> | 89.57 | 98.41 | 31.10 | 82.27 | 100.00 | 99.33 | 97.01 | 99.39 | 98.64 | 99.94 | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| <code>openai/gpt-5.6-luna</code> | 89.32 | 92.06 | 90.99 | 71.92 | 100.00 | 99.63 | 92.34 | 89.69 | 67.26 | 100.00 | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| <code>grok/grok-4.6</code> | 88.12 | 100.00 | 30.52 | 82.76 | 100.00 | 98.28 | 87.41 | 99.45 | 95.00 | 99.66 | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 87.78 | 92.06 | 92.44 | 67.98 | 100.00 | 98.88 | 80.90 | 94.67 | 92.42 | 83.54 | — | — | — | — | — | 99.03 | 85.48 | 97.71 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 | 93.65 | 94.48 | 7.88 | 94.47 | 89.37 | 84.21 | 100.00 | 93.33 | 88.75 | 42.50 | 98.74 | 98.31 | 97.74 | 95.70 | 73.90 | 97.38 | 99.42 | 96.08 | 99.57 | 98.73 | 92.18 | 98.71 | 94.31 | 94.00 | 18.17 | 61.07 | 29.35 | 98.87 | 97.90 | 99.76 | 99.53 | 96.12 | 69.08 | 77.68 | 87.42 | 87.59 | 57.42 | 98.80 | 98.48 | 96.08 | 99.30 | 98.15 |
| <code>kimi/kimi-k2.6</code> | 86.38 | 85.71 | 23.26 | 83.25 | 100.00 | 99.33 | 92.52 | 99.45 | 93.94 | 100.00 | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |

## Notes

- Each provider is aggregated by providerKey across the runs it appears in; sums and means cover present values only.
- Groups follow the single-run OCR contract: local, thirdPartyService; local and service providers are never ranked against each other.
- Weighted WER and weighted CER are evidence columns: summed breakdown errors divided by summed reference counts, so longer runs count proportionally more.
- Per-run WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Each group ranks price, speed, and quality score independently. No weighted composite or model-tier ranking is emitted.
- Supersedes the hand-authored 2026-06-14 combined report, which is preserved as a historical record.
- 5 runs use partial annotated-word references with text-only OCR. They contribute cost and speed, but no primary quality score or weighted error counts. Annotated-target token coverage and derived-order WER/CER are separate diagnostics; they do not establish region localization or exhaustive full-page accuracy.
