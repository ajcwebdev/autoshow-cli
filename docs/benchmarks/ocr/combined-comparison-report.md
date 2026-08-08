# Combined OCR Provider Comparison Report

## Summary

- Root directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr`
- Runs aggregated: 14 (46 pages)
  - `2026-05-21_05-04-05-389_document` (22 providers, 2 pages)
  - `2026-05-21_05-43-56-514_document` (20 providers, 1 page)
  - `2026-05-21_05-47-00-856_document` (22 providers, 5 pages)
  - `2026-05-21_05-55-32-490_document` (22 providers, 5 pages)
  - `2026-05-21_06-03-14-635_document` (22 providers, 10 pages)
  - `2026-05-21_06-13-18-792_document` (22 providers, 10 pages)
  - `2026-06-14_01-22-25-538_document` (22 providers, 1 page)
  - `2026-06-14_01-22-40-317_document` (22 providers, 2 pages)
  - `2026-06-14_01-22-42-930_document` (22 providers, 2 pages)
  - `2026-06-14_01-28-14-268_document` (21 providers, 1 page)
  - `2026-06-14_01-28-15-914_document` (22 providers, 2 pages)
  - `2026-06-14_01-28-18-115_document` (22 providers, 1 page)
  - `2026-06-14_01-28-27-392_document` (22 providers, 2 pages)
  - `2026-06-14_01-28-29-201_document` (22 providers, 2 pages)
- Distinct providers: 22 (3 local, 19 third-party service)
- Quality aggregates the per-run WER-derived score as an unweighted mean across runs; speed and price aggregate page-weighted totals (pages per minute, USD per 100 pages).

## Method

- Providers are matched by `providerKey` and aggregated across the runs they appear in; sums and means cover present values only.
- Quality Score rankings use the unweighted mean `metrics.score` descending.
- Weighted WER and Weighted CER are evidence columns: summed errors from the corresponding breakdowns divided by summed reference counts, so longer runs count proportionally more.
- Speed rankings use aggregate pages per minute descending: `sum(pageCount) / sum(processingTimeMs / 60000)`; missing timing sorts last.
- Price rankings use USD per 100 pages ascending: `sum(costCents) / sum(pageCount)` (cents per page is numerically equal to dollars per 100 pages); local providers at zero; missing cost sorts last.
- Tied ranking values break deterministically: price ties by quality descending, then pages/minute descending, then provider key; speed and quality ties by provider key.

**Weighted composites** are built separately for each provider group in three steps:

1. Within each run and provider group, every provider gets three 0-100 subscores. **Q** = `100 * (value - min) / (max - min)` over quality score (higher is better). **S** and **C** = `100 * (1 - (value - min) / (max - min))` over processing time and cost (lower is better). If a dimension has identical min/max values, every pooled provider receives 100 for that dimension.
2. Each provider's Q, S, and C are averaged across the runs it participated in. A provider missing a value in a run is excluded from that run's normalization pool for that dimension; a dimension missing in every covered run scores 0 and is flagged under the affected tables.
3. Composite = `w_q*Q + w_s*S + w_c*C` for each weight set below.

| Weight set | Quality | Speed | Cost |
| --- | ---: | ---: | ---: |
| Strong quality | 0.8 | 0.1 | 0.1 |
| Moderate quality | 0.6 | 0.2 | 0.2 |
| Strong speed | 0.1 | 0.8 | 0.1 |
| Moderate speed | 0.2 | 0.6 | 0.2 |
| Strong cost | 0.1 | 0.1 | 0.8 |
| Moderate cost | 0.2 | 0.2 | 0.6 |
| Quality + cost | 0.45 | 0.1 | 0.45 |
| Cost + speed | 0.1 | 0.45 | 0.45 |

**Model tiers** are computed per group with `quality-cost-terciles-v1` from the group's `qualityCost` weighted ranking only; groups are never compared against each other. That ranking orders composite descending, then quality subscore descending, then provider key. Its models are divided into three contiguous tiers of `floor(n / 3)` models, with remainder models assigned to Tier 1 and then Tier 2. Every model appears exactly once.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>paddle-ocr/paddle-ocr</code> | $0.000 | 14/14 | 54.54 | 44.01% | 35.20% | 9.4 | 21.02s | $0.000 |
| 2 | <code>tesseract/tesseract</code> | $0.000 | 14/14 | 54.02 | 43.19% | 29.84% | 86.6 | 2.28s | $0.000 |
| 3 | <code>ocrmypdf/ocrmypdf</code> | $0.000 | 14/14 | 51.55 | 45.45% | 31.90% | 29.7 | 6.63s | $0.000 |

#### Speed

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract/tesseract</code> | 86.6 pages/minute | 14/14 | 54.02 | 43.19% | 29.84% | 86.6 | 2.28s | $0.000 |
| 2 | <code>ocrmypdf/ocrmypdf</code> | 29.7 pages/minute | 14/14 | 51.55 | 45.45% | 31.90% | 29.7 | 6.63s | $0.000 |
| 3 | <code>paddle-ocr/paddle-ocr</code> | 9.4 pages/minute | 14/14 | 54.54 | 44.01% | 35.20% | 9.4 | 21.02s | $0.000 |

#### Quality Score

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>paddle-ocr/paddle-ocr</code> | 54.54/100 avg quality score | 14/14 | 54.54 | 44.01% | 35.20% | 9.4 | 21.02s | $0.000 |
| 2 | <code>tesseract/tesseract</code> | 54.02/100 avg quality score | 14/14 | 54.02 | 43.19% | 29.84% | 86.6 | 2.28s | $0.000 |
| 3 | <code>ocrmypdf/ocrmypdf</code> | 51.55/100 avg quality score | 14/14 | 51.55 | 45.45% | 31.90% | 29.7 | 6.63s | $0.000 |

#### Weighted Rankings

Q, S, and C are each provider's per-run normalized quality, speed, and cost subscores averaged across covered runs.

##### Strong quality (0.8 quality / 0.1 speed / 0.1 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract/tesseract</code> | 14/14 | 71.42 | 64.29 | 99.92 | 100.00 |
| 2 | <code>ocrmypdf/ocrmypdf</code> | 14/14 | 58.94 | 52.08 | 72.79 | 100.00 |
| 3 | <code>paddle-ocr/paddle-ocr</code> | 14/14 | 52.14 | 50.00 | 21.43 | 100.00 |

##### Moderate quality (0.6 quality / 0.2 speed / 0.2 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract/tesseract</code> | 14/14 | 78.56 | 64.29 | 99.92 | 100.00 |
| 2 | <code>ocrmypdf/ocrmypdf</code> | 14/14 | 65.80 | 52.08 | 72.79 | 100.00 |
| 3 | <code>paddle-ocr/paddle-ocr</code> | 14/14 | 54.29 | 50.00 | 21.43 | 100.00 |

##### Strong speed (0.1 quality / 0.8 speed / 0.1 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract/tesseract</code> | 14/14 | 96.37 | 64.29 | 99.92 | 100.00 |
| 2 | <code>ocrmypdf/ocrmypdf</code> | 14/14 | 73.44 | 52.08 | 72.79 | 100.00 |
| 3 | <code>paddle-ocr/paddle-ocr</code> | 14/14 | 32.14 | 50.00 | 21.43 | 100.00 |

##### Moderate speed (0.2 quality / 0.6 speed / 0.2 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract/tesseract</code> | 14/14 | 92.81 | 64.29 | 99.92 | 100.00 |
| 2 | <code>ocrmypdf/ocrmypdf</code> | 14/14 | 74.09 | 52.08 | 72.79 | 100.00 |
| 3 | <code>paddle-ocr/paddle-ocr</code> | 14/14 | 42.86 | 50.00 | 21.43 | 100.00 |

##### Strong cost (0.1 quality / 0.1 speed / 0.8 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract/tesseract</code> | 14/14 | 96.42 | 64.29 | 99.92 | 100.00 |
| 2 | <code>ocrmypdf/ocrmypdf</code> | 14/14 | 92.49 | 52.08 | 72.79 | 100.00 |
| 3 | <code>paddle-ocr/paddle-ocr</code> | 14/14 | 87.14 | 50.00 | 21.43 | 100.00 |

##### Moderate cost (0.2 quality / 0.2 speed / 0.6 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract/tesseract</code> | 14/14 | 92.84 | 64.29 | 99.92 | 100.00 |
| 2 | <code>ocrmypdf/ocrmypdf</code> | 14/14 | 84.97 | 52.08 | 72.79 | 100.00 |
| 3 | <code>paddle-ocr/paddle-ocr</code> | 14/14 | 74.29 | 50.00 | 21.43 | 100.00 |

##### Quality + cost (0.45 quality / 0.10 speed / 0.45 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract/tesseract</code> | 14/14 | 83.92 | 64.29 | 99.92 | 100.00 |
| 2 | <code>ocrmypdf/ocrmypdf</code> | 14/14 | 75.71 | 52.08 | 72.79 | 100.00 |
| 3 | <code>paddle-ocr/paddle-ocr</code> | 14/14 | 69.64 | 50.00 | 21.43 | 100.00 |

##### Cost + speed (0.10 quality / 0.45 speed / 0.45 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract/tesseract</code> | 14/14 | 96.39 | 64.29 | 99.92 | 100.00 |
| 2 | <code>ocrmypdf/ocrmypdf</code> | 14/14 | 82.96 | 52.08 | 72.79 | 100.00 |
| 3 | <code>paddle-ocr/paddle-ocr</code> | 14/14 | 59.64 | 50.00 | 21.43 | 100.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>glm/glm-ocr</code> | $0.010 | 14/14 | 69.08 | 20.67% | 16.55% | 20.3 | 9.73s | $0.010 |
| 2 | <code>openai/gpt-5.4-nano</code> | $0.066 | 14/14 | 69.12 | 33.76% | 28.14% | 13.7 | 14.36s | $0.066 |
| 3 | <code>gemini/gemini-3.1-flash-lite-preview</code> | $0.075 | 14/14 | 86.09 | 23.82% | 20.44% | 35.5 | 5.56s | $0.075 |
| 4 | <code>gemini/gemini-3.1-flash-lite</code> | $0.076 | 14/14 | 77.65 | 36.38% | 52.62% | 35.0 | 5.64s | $0.076 |
| 5 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.112 | 14/14 | 83.00 | 15.48% | 12.50% | 3.4 | 57.95s | $0.112 |
| 6 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.152 | 14/14 | 89.36 | 4.98% | 2.72% | 5.0 | 39.61s | $0.152 |
| 7 | <code>mistral/mistral-ocr-2512</code> | $0.170 | 14/14 | 79.77 | 22.39% | 18.35% | 54.0 | 3.65s | $0.170 |
| 8 | <code>openai/gpt-5.4-mini</code> | $0.229 | 14/14 | 77.24 | 32.57% | 38.86% | 20.2 | 9.76s | $0.229 |
| 9 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.336 | 14/14 | 88.13 | 15.54% | 24.20% | 51.0 | 3.87s | $0.336 |
| 10 | <code>grok/grok-4.3</code> | $0.339 | 14/14 | 87.93 | 5.35% | 3.53% | 4.8 | 41.00s | $0.339 |
| 11 | <code>mistral/mistral-ocr-4-0</code> | $0.339 | 14/14 | 85.85 | 14.11% | 18.80% | 40.7 | 4.85s | $0.339 |
| 12 | <code>anthropic/claude-haiku-4-5</code> | $0.374 | 14/14 | 71.59 | 31.90% | 37.64% | 11.0 | 17.96s | $0.374 |
| 13 | <code>kimi/kimi-k2.6</code> | $0.460 | 14/14 | 93.78 | 3.34% | 0.93% | 4.6 | 42.77s | $0.460 |
| 14 | <code>gemini/gemini-3.5-flash</code> | $0.520 | 14/14 | 91.75 | 8.60% | 15.75% | 7.9 | 24.89s | $0.520 |
| 15 | <code>gemini/gemini-3.1-pro-preview</code> | $0.686 | 14/14 | 94.13 | 3.56% | 1.48% | 6.0 | 32.97s | $0.686 |
| 16 | <code>anthropic/claude-sonnet-5</code> | $1.013 | 14/14 | 78.57 | 27.74% | 24.76% | 6.9 | 28.72s | $1.013 |
| 17 | <code>anthropic/claude-sonnet-4-6</code> | $1.059 | 12/14 | 93.04 | 11.52% | 9.53% | 3.3 | 67.20s | $1.059 |
| 18 | <code>anthropic/claude-opus-4-8</code> | $2.371 | 13/14 | 88.51 | 16.06% | 36.30% | 6.6 | 31.36s | $2.371 |
| 19 | <code>openai/gpt-5.5</code> | $3.104 | 14/14 | 86.37 | 24.50% | 21.97% | 5.8 | 34.04s | $3.104 |

#### Speed

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-2512</code> | 54.0 pages/minute | 14/14 | 79.77 | 22.39% | 18.35% | 54.0 | 3.65s | $0.170 |
| 2 | <code>grok/grok-4.20-0309-non-reasoning</code> | 51.0 pages/minute | 14/14 | 88.13 | 15.54% | 24.20% | 51.0 | 3.87s | $0.336 |
| 3 | <code>mistral/mistral-ocr-4-0</code> | 40.7 pages/minute | 14/14 | 85.85 | 14.11% | 18.80% | 40.7 | 4.85s | $0.339 |
| 4 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 35.5 pages/minute | 14/14 | 86.09 | 23.82% | 20.44% | 35.5 | 5.56s | $0.075 |
| 5 | <code>gemini/gemini-3.1-flash-lite</code> | 35.0 pages/minute | 14/14 | 77.65 | 36.38% | 52.62% | 35.0 | 5.64s | $0.076 |
| 6 | <code>glm/glm-ocr</code> | 20.3 pages/minute | 14/14 | 69.08 | 20.67% | 16.55% | 20.3 | 9.73s | $0.010 |
| 7 | <code>openai/gpt-5.4-mini</code> | 20.2 pages/minute | 14/14 | 77.24 | 32.57% | 38.86% | 20.2 | 9.76s | $0.229 |
| 8 | <code>openai/gpt-5.4-nano</code> | 13.7 pages/minute | 14/14 | 69.12 | 33.76% | 28.14% | 13.7 | 14.36s | $0.066 |
| 9 | <code>anthropic/claude-haiku-4-5</code> | 11.0 pages/minute | 14/14 | 71.59 | 31.90% | 37.64% | 11.0 | 17.96s | $0.374 |
| 10 | <code>gemini/gemini-3.5-flash</code> | 7.9 pages/minute | 14/14 | 91.75 | 8.60% | 15.75% | 7.9 | 24.89s | $0.520 |
| 11 | <code>anthropic/claude-sonnet-5</code> | 6.9 pages/minute | 14/14 | 78.57 | 27.74% | 24.76% | 6.9 | 28.72s | $1.013 |
| 12 | <code>anthropic/claude-opus-4-8</code> | 6.6 pages/minute | 13/14 | 88.51 | 16.06% | 36.30% | 6.6 | 31.36s | $2.371 |
| 13 | <code>gemini/gemini-3.1-pro-preview</code> | 6.0 pages/minute | 14/14 | 94.13 | 3.56% | 1.48% | 6.0 | 32.97s | $0.686 |
| 14 | <code>openai/gpt-5.5</code> | 5.8 pages/minute | 14/14 | 86.37 | 24.50% | 21.97% | 5.8 | 34.04s | $3.104 |
| 15 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 5.0 pages/minute | 14/14 | 89.36 | 4.98% | 2.72% | 5.0 | 39.61s | $0.152 |
| 16 | <code>grok/grok-4.3</code> | 4.8 pages/minute | 14/14 | 87.93 | 5.35% | 3.53% | 4.8 | 41.00s | $0.339 |
| 17 | <code>kimi/kimi-k2.6</code> | 4.6 pages/minute | 14/14 | 93.78 | 3.34% | 0.93% | 4.6 | 42.77s | $0.460 |
| 18 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 3.4 pages/minute | 14/14 | 83.00 | 15.48% | 12.50% | 3.4 | 57.95s | $0.112 |
| 19 | <code>anthropic/claude-sonnet-4-6</code> | 3.3 pages/minute | 12/14 | 93.04 | 11.52% | 9.53% | 3.3 | 67.20s | $1.059 |

#### Quality Score

| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.1-pro-preview</code> | 94.13/100 avg quality score | 14/14 | 94.13 | 3.56% | 1.48% | 6.0 | 32.97s | $0.686 |
| 2 | <code>kimi/kimi-k2.6</code> | 93.78/100 avg quality score | 14/14 | 93.78 | 3.34% | 0.93% | 4.6 | 42.77s | $0.460 |
| 3 | <code>anthropic/claude-sonnet-4-6</code> | 93.04/100 avg quality score | 12/14 | 93.04 | 11.52% | 9.53% | 3.3 | 67.20s | $1.059 |
| 4 | <code>gemini/gemini-3.5-flash</code> | 91.75/100 avg quality score | 14/14 | 91.75 | 8.60% | 15.75% | 7.9 | 24.89s | $0.520 |
| 5 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 89.36/100 avg quality score | 14/14 | 89.36 | 4.98% | 2.72% | 5.0 | 39.61s | $0.152 |
| 6 | <code>anthropic/claude-opus-4-8</code> | 88.51/100 avg quality score | 13/14 | 88.51 | 16.06% | 36.30% | 6.6 | 31.36s | $2.371 |
| 7 | <code>grok/grok-4.20-0309-non-reasoning</code> | 88.13/100 avg quality score | 14/14 | 88.13 | 15.54% | 24.20% | 51.0 | 3.87s | $0.336 |
| 8 | <code>grok/grok-4.3</code> | 87.93/100 avg quality score | 14/14 | 87.93 | 5.35% | 3.53% | 4.8 | 41.00s | $0.339 |
| 9 | <code>openai/gpt-5.5</code> | 86.37/100 avg quality score | 14/14 | 86.37 | 24.50% | 21.97% | 5.8 | 34.04s | $3.104 |
| 10 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 86.09/100 avg quality score | 14/14 | 86.09 | 23.82% | 20.44% | 35.5 | 5.56s | $0.075 |
| 11 | <code>mistral/mistral-ocr-4-0</code> | 85.85/100 avg quality score | 14/14 | 85.85 | 14.11% | 18.80% | 40.7 | 4.85s | $0.339 |
| 12 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 83.00/100 avg quality score | 14/14 | 83.00 | 15.48% | 12.50% | 3.4 | 57.95s | $0.112 |
| 13 | <code>mistral/mistral-ocr-2512</code> | 79.77/100 avg quality score | 14/14 | 79.77 | 22.39% | 18.35% | 54.0 | 3.65s | $0.170 |
| 14 | <code>anthropic/claude-sonnet-5</code> | 78.57/100 avg quality score | 14/14 | 78.57 | 27.74% | 24.76% | 6.9 | 28.72s | $1.013 |
| 15 | <code>gemini/gemini-3.1-flash-lite</code> | 77.65/100 avg quality score | 14/14 | 77.65 | 36.38% | 52.62% | 35.0 | 5.64s | $0.076 |
| 16 | <code>openai/gpt-5.4-mini</code> | 77.24/100 avg quality score | 14/14 | 77.24 | 32.57% | 38.86% | 20.2 | 9.76s | $0.229 |
| 17 | <code>anthropic/claude-haiku-4-5</code> | 71.59/100 avg quality score | 14/14 | 71.59 | 31.90% | 37.64% | 11.0 | 17.96s | $0.374 |
| 18 | <code>openai/gpt-5.4-nano</code> | 69.12/100 avg quality score | 14/14 | 69.12 | 33.76% | 28.14% | 13.7 | 14.36s | $0.066 |
| 19 | <code>glm/glm-ocr</code> | 69.08/100 avg quality score | 14/14 | 69.08 | 20.67% | 16.55% | 20.3 | 9.73s | $0.010 |

#### Weighted Rankings

Q, S, and C are each provider's per-run normalized quality, speed, and cost subscores averaged across covered runs.

##### Strong quality (0.8 quality / 0.1 speed / 0.1 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>kimi/kimi-k2.6</code> | 14/14 | 86.98 | 91.55 | 47.70 | 89.71 |
| 2 | <code>grok/grok-4.20-0309-non-reasoning</code> | 14/14 | 86.75 | 84.71 | 97.65 | 92.13 |
| 3 | <code>gemini/gemini-3.1-pro-preview</code> | 14/14 | 86.58 | 89.48 | 69.52 | 80.36 |
| 4 | <code>anthropic/claude-sonnet-4-6</code> | 12/14 | 83.97 | 91.57 | 36.60 | 70.56 |
| 5 | <code>gemini/gemini-3.5-flash</code> | 14/14 | 83.91 | 88.06 | 49.28 | 85.35 |
| 6 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 14/14 | 83.63 | 80.42 | 94.92 | 97.98 |
| 7 | <code>grok/grok-4.3</code> | 14/14 | 82.65 | 85.35 | 51.68 | 92.01 |
| 8 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 14/14 | 81.43 | 83.10 | 52.28 | 97.18 |
| 9 | <code>mistral/mistral-ocr-4-0</code> | 14/14 | 80.24 | 77.10 | 96.73 | 88.84 |
| 10 | <code>mistral/mistral-ocr-2512</code> | 14/14 | 76.30 | 71.21 | 98.84 | 94.51 |
| 11 | <code>gemini/gemini-3.1-flash-lite</code> | 14/14 | 75.50 | 70.31 | 94.55 | 97.96 |
| 12 | <code>anthropic/claude-opus-4-8</code> | 13/14 | 74.92 | 82.17 | 56.38 | 35.39 |
| 13 | <code>openai/gpt-5.5</code> | 14/14 | 69.96 | 80.93 | 42.46 | 9.65 |
| 14 | <code>openai/gpt-5.4-mini</code> | 14/14 | 69.17 | 63.28 | 91.72 | 93.77 |
| 15 | <code>anthropic/claude-sonnet-5</code> | 14/14 | 68.82 | 68.98 | 62.70 | 73.66 |
| 16 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 14/14 | 68.58 | 67.99 | 43.87 | 97.99 |
| 17 | <code>anthropic/claude-haiku-4-5</code> | 14/14 | 66.95 | 63.34 | 72.62 | 90.19 |
| 18 | <code>glm/glm-ocr</code> | 14/14 | 59.03 | 50.11 | 89.47 | 99.99 |
| 19 | <code>openai/gpt-5.4-nano</code> | 14/14 | 56.20 | 47.05 | 87.25 | 98.36 |

##### Moderate quality (0.6 quality / 0.2 speed / 0.2 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>grok/grok-4.20-0309-non-reasoning</code> | 14/14 | 88.78 | 84.71 | 97.65 | 92.13 |
| 2 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 14/14 | 86.83 | 80.42 | 94.92 | 97.98 |
| 3 | <code>gemini/gemini-3.1-pro-preview</code> | 14/14 | 83.67 | 89.48 | 69.52 | 80.36 |
| 4 | <code>mistral/mistral-ocr-4-0</code> | 14/14 | 83.37 | 77.10 | 96.73 | 88.84 |
| 5 | <code>kimi/kimi-k2.6</code> | 14/14 | 82.41 | 91.55 | 47.70 | 89.71 |
| 6 | <code>mistral/mistral-ocr-2512</code> | 14/14 | 81.39 | 71.21 | 98.84 | 94.51 |
| 7 | <code>gemini/gemini-3.1-flash-lite</code> | 14/14 | 80.69 | 70.31 | 94.55 | 97.96 |
| 8 | <code>grok/grok-4.3</code> | 14/14 | 79.95 | 85.35 | 51.68 | 92.01 |
| 9 | <code>gemini/gemini-3.5-flash</code> | 14/14 | 79.76 | 88.06 | 49.28 | 85.35 |
| 10 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 14/14 | 79.75 | 83.10 | 52.28 | 97.18 |
| 11 | <code>anthropic/claude-sonnet-4-6</code> | 12/14 | 76.37 | 91.57 | 36.60 | 70.56 |
| 12 | <code>openai/gpt-5.4-mini</code> | 14/14 | 75.06 | 63.28 | 91.72 | 93.77 |
| 13 | <code>anthropic/claude-haiku-4-5</code> | 14/14 | 70.57 | 63.34 | 72.62 | 90.19 |
| 14 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 14/14 | 69.17 | 67.99 | 43.87 | 97.99 |
| 15 | <code>anthropic/claude-sonnet-5</code> | 14/14 | 68.66 | 68.98 | 62.70 | 73.66 |
| 16 | <code>glm/glm-ocr</code> | 14/14 | 67.96 | 50.11 | 89.47 | 99.99 |
| 17 | <code>anthropic/claude-opus-4-8</code> | 13/14 | 67.66 | 82.17 | 56.38 | 35.39 |
| 18 | <code>openai/gpt-5.4-nano</code> | 14/14 | 65.35 | 47.05 | 87.25 | 98.36 |
| 19 | <code>openai/gpt-5.5</code> | 14/14 | 58.98 | 80.93 | 42.46 | 9.65 |

##### Strong speed (0.1 quality / 0.8 speed / 0.1 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>grok/grok-4.20-0309-non-reasoning</code> | 14/14 | 95.81 | 84.71 | 97.65 | 92.13 |
| 2 | <code>mistral/mistral-ocr-2512</code> | 14/14 | 95.64 | 71.21 | 98.84 | 94.51 |
| 3 | <code>mistral/mistral-ocr-4-0</code> | 14/14 | 93.98 | 77.10 | 96.73 | 88.84 |
| 4 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 14/14 | 93.78 | 80.42 | 94.92 | 97.98 |
| 5 | <code>gemini/gemini-3.1-flash-lite</code> | 14/14 | 92.47 | 70.31 | 94.55 | 97.96 |
| 6 | <code>openai/gpt-5.4-mini</code> | 14/14 | 89.08 | 63.28 | 91.72 | 93.77 |
| 7 | <code>glm/glm-ocr</code> | 14/14 | 86.59 | 50.11 | 89.47 | 99.99 |
| 8 | <code>openai/gpt-5.4-nano</code> | 14/14 | 84.34 | 47.05 | 87.25 | 98.36 |
| 9 | <code>anthropic/claude-haiku-4-5</code> | 14/14 | 73.45 | 63.34 | 72.62 | 90.19 |
| 10 | <code>gemini/gemini-3.1-pro-preview</code> | 14/14 | 72.60 | 89.48 | 69.52 | 80.36 |
| 11 | <code>anthropic/claude-sonnet-5</code> | 14/14 | 64.43 | 68.98 | 62.70 | 73.66 |
| 12 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 14/14 | 59.85 | 83.10 | 52.28 | 97.18 |
| 13 | <code>grok/grok-4.3</code> | 14/14 | 59.08 | 85.35 | 51.68 | 92.01 |
| 14 | <code>anthropic/claude-opus-4-8</code> | 13/14 | 56.86 | 82.17 | 56.38 | 35.39 |
| 15 | <code>gemini/gemini-3.5-flash</code> | 14/14 | 56.76 | 88.06 | 49.28 | 85.35 |
| 16 | <code>kimi/kimi-k2.6</code> | 14/14 | 56.28 | 91.55 | 47.70 | 89.71 |
| 17 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 14/14 | 51.69 | 67.99 | 43.87 | 97.99 |
| 18 | <code>anthropic/claude-sonnet-4-6</code> | 12/14 | 45.49 | 91.57 | 36.60 | 70.56 |
| 19 | <code>openai/gpt-5.5</code> | 14/14 | 43.03 | 80.93 | 42.46 | 9.65 |

##### Moderate speed (0.2 quality / 0.6 speed / 0.2 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>grok/grok-4.20-0309-non-reasoning</code> | 14/14 | 93.96 | 84.71 | 97.65 | 92.13 |
| 2 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 14/14 | 92.63 | 80.42 | 94.92 | 97.98 |
| 3 | <code>mistral/mistral-ocr-2512</code> | 14/14 | 92.45 | 71.21 | 98.84 | 94.51 |
| 4 | <code>mistral/mistral-ocr-4-0</code> | 14/14 | 91.23 | 77.10 | 96.73 | 88.84 |
| 5 | <code>gemini/gemini-3.1-flash-lite</code> | 14/14 | 90.38 | 70.31 | 94.55 | 97.96 |
| 6 | <code>openai/gpt-5.4-mini</code> | 14/14 | 86.44 | 63.28 | 91.72 | 93.77 |
| 7 | <code>glm/glm-ocr</code> | 14/14 | 83.70 | 50.11 | 89.47 | 99.99 |
| 8 | <code>openai/gpt-5.4-nano</code> | 14/14 | 81.43 | 47.05 | 87.25 | 98.36 |
| 9 | <code>gemini/gemini-3.1-pro-preview</code> | 14/14 | 75.68 | 89.48 | 69.52 | 80.36 |
| 10 | <code>anthropic/claude-haiku-4-5</code> | 14/14 | 74.28 | 63.34 | 72.62 | 90.19 |
| 11 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 14/14 | 67.42 | 83.10 | 52.28 | 97.18 |
| 12 | <code>grok/grok-4.3</code> | 14/14 | 66.48 | 85.35 | 51.68 | 92.01 |
| 13 | <code>anthropic/claude-sonnet-5</code> | 14/14 | 66.15 | 68.98 | 62.70 | 73.66 |
| 14 | <code>kimi/kimi-k2.6</code> | 14/14 | 64.87 | 91.55 | 47.70 | 89.71 |
| 15 | <code>gemini/gemini-3.5-flash</code> | 14/14 | 64.25 | 88.06 | 49.28 | 85.35 |
| 16 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 14/14 | 59.52 | 67.99 | 43.87 | 97.99 |
| 17 | <code>anthropic/claude-opus-4-8</code> | 13/14 | 57.34 | 82.17 | 56.38 | 35.39 |
| 18 | <code>anthropic/claude-sonnet-4-6</code> | 12/14 | 54.38 | 91.57 | 36.60 | 70.56 |
| 19 | <code>openai/gpt-5.5</code> | 14/14 | 43.59 | 80.93 | 42.46 | 9.65 |

##### Strong cost (0.1 quality / 0.1 speed / 0.8 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 14/14 | 95.92 | 80.42 | 94.92 | 97.98 |
| 2 | <code>gemini/gemini-3.1-flash-lite</code> | 14/14 | 94.85 | 70.31 | 94.55 | 97.96 |
| 3 | <code>glm/glm-ocr</code> | 14/14 | 93.95 | 50.11 | 89.47 | 99.99 |
| 4 | <code>mistral/mistral-ocr-2512</code> | 14/14 | 92.61 | 71.21 | 98.84 | 94.51 |
| 5 | <code>openai/gpt-5.4-nano</code> | 14/14 | 92.11 | 47.05 | 87.25 | 98.36 |
| 6 | <code>grok/grok-4.20-0309-non-reasoning</code> | 14/14 | 91.94 | 84.71 | 97.65 | 92.13 |
| 7 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 14/14 | 91.28 | 83.10 | 52.28 | 97.18 |
| 8 | <code>openai/gpt-5.4-mini</code> | 14/14 | 90.52 | 63.28 | 91.72 | 93.77 |
| 9 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 14/14 | 89.58 | 67.99 | 43.87 | 97.99 |
| 10 | <code>mistral/mistral-ocr-4-0</code> | 14/14 | 88.45 | 77.10 | 96.73 | 88.84 |
| 11 | <code>grok/grok-4.3</code> | 14/14 | 87.31 | 85.35 | 51.68 | 92.01 |
| 12 | <code>anthropic/claude-haiku-4-5</code> | 14/14 | 85.74 | 63.34 | 72.62 | 90.19 |
| 13 | <code>kimi/kimi-k2.6</code> | 14/14 | 85.69 | 91.55 | 47.70 | 89.71 |
| 14 | <code>gemini/gemini-3.5-flash</code> | 14/14 | 82.01 | 88.06 | 49.28 | 85.35 |
| 15 | <code>gemini/gemini-3.1-pro-preview</code> | 14/14 | 80.19 | 89.48 | 69.52 | 80.36 |
| 16 | <code>anthropic/claude-sonnet-5</code> | 14/14 | 72.09 | 68.98 | 62.70 | 73.66 |
| 17 | <code>anthropic/claude-sonnet-4-6</code> | 12/14 | 69.27 | 91.57 | 36.60 | 70.56 |
| 18 | <code>anthropic/claude-opus-4-8</code> | 13/14 | 42.17 | 82.17 | 56.38 | 35.39 |
| 19 | <code>openai/gpt-5.5</code> | 14/14 | 20.06 | 80.93 | 42.46 | 9.65 |

##### Moderate cost (0.2 quality / 0.2 speed / 0.6 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 14/14 | 93.86 | 80.42 | 94.92 | 97.98 |
| 2 | <code>grok/grok-4.20-0309-non-reasoning</code> | 14/14 | 91.75 | 84.71 | 97.65 | 92.13 |
| 3 | <code>gemini/gemini-3.1-flash-lite</code> | 14/14 | 91.75 | 70.31 | 94.55 | 97.96 |
| 4 | <code>mistral/mistral-ocr-2512</code> | 14/14 | 90.71 | 71.21 | 98.84 | 94.51 |
| 5 | <code>mistral/mistral-ocr-4-0</code> | 14/14 | 88.07 | 77.10 | 96.73 | 88.84 |
| 6 | <code>glm/glm-ocr</code> | 14/14 | 87.91 | 50.11 | 89.47 | 99.99 |
| 7 | <code>openai/gpt-5.4-mini</code> | 14/14 | 87.26 | 63.28 | 91.72 | 93.77 |
| 8 | <code>openai/gpt-5.4-nano</code> | 14/14 | 85.87 | 47.05 | 87.25 | 98.36 |
| 9 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 14/14 | 85.38 | 83.10 | 52.28 | 97.18 |
| 10 | <code>grok/grok-4.3</code> | 14/14 | 82.61 | 85.35 | 51.68 | 92.01 |
| 11 | <code>kimi/kimi-k2.6</code> | 14/14 | 81.68 | 91.55 | 47.70 | 89.71 |
| 12 | <code>anthropic/claude-haiku-4-5</code> | 14/14 | 81.30 | 63.34 | 72.62 | 90.19 |
| 13 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 14/14 | 81.17 | 67.99 | 43.87 | 97.99 |
| 14 | <code>gemini/gemini-3.1-pro-preview</code> | 14/14 | 80.02 | 89.48 | 69.52 | 80.36 |
| 15 | <code>gemini/gemini-3.5-flash</code> | 14/14 | 78.68 | 88.06 | 49.28 | 85.35 |
| 16 | <code>anthropic/claude-sonnet-5</code> | 14/14 | 70.53 | 68.98 | 62.70 | 73.66 |
| 17 | <code>anthropic/claude-sonnet-4-6</code> | 12/14 | 67.97 | 91.57 | 36.60 | 70.56 |
| 18 | <code>anthropic/claude-opus-4-8</code> | 13/14 | 48.95 | 82.17 | 56.38 | 35.39 |
| 19 | <code>openai/gpt-5.5</code> | 14/14 | 30.47 | 80.93 | 42.46 | 9.65 |

##### Quality + cost (0.45 quality / 0.10 speed / 0.45 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 14/14 | 89.77 | 80.42 | 94.92 | 97.98 |
| 2 | <code>grok/grok-4.20-0309-non-reasoning</code> | 14/14 | 89.35 | 84.71 | 97.65 | 92.13 |
| 3 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 14/14 | 86.35 | 83.10 | 52.28 | 97.18 |
| 4 | <code>kimi/kimi-k2.6</code> | 14/14 | 86.34 | 91.55 | 47.70 | 89.71 |
| 5 | <code>gemini/gemini-3.1-flash-lite</code> | 14/14 | 85.18 | 70.31 | 94.55 | 97.96 |
| 6 | <code>grok/grok-4.3</code> | 14/14 | 84.98 | 85.35 | 51.68 | 92.01 |
| 7 | <code>mistral/mistral-ocr-2512</code> | 14/14 | 84.45 | 71.21 | 98.84 | 94.51 |
| 8 | <code>mistral/mistral-ocr-4-0</code> | 14/14 | 84.34 | 77.10 | 96.73 | 88.84 |
| 9 | <code>gemini/gemini-3.1-pro-preview</code> | 14/14 | 83.38 | 89.48 | 69.52 | 80.36 |
| 10 | <code>gemini/gemini-3.5-flash</code> | 14/14 | 82.96 | 88.06 | 49.28 | 85.35 |
| 11 | <code>openai/gpt-5.4-mini</code> | 14/14 | 79.84 | 63.28 | 91.72 | 93.77 |
| 12 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 14/14 | 79.08 | 67.99 | 43.87 | 97.99 |
| 13 | <code>anthropic/claude-sonnet-4-6</code> | 12/14 | 76.62 | 91.57 | 36.60 | 70.56 |
| 14 | <code>glm/glm-ocr</code> | 14/14 | 76.49 | 50.11 | 89.47 | 99.99 |
| 15 | <code>anthropic/claude-haiku-4-5</code> | 14/14 | 76.35 | 63.34 | 72.62 | 90.19 |
| 16 | <code>openai/gpt-5.4-nano</code> | 14/14 | 74.16 | 47.05 | 87.25 | 98.36 |
| 17 | <code>anthropic/claude-sonnet-5</code> | 14/14 | 70.46 | 68.98 | 62.70 | 73.66 |
| 18 | <code>anthropic/claude-opus-4-8</code> | 13/14 | 58.54 | 82.17 | 56.38 | 35.39 |
| 19 | <code>openai/gpt-5.5</code> | 14/14 | 45.01 | 80.93 | 42.46 | 9.65 |

##### Cost + speed (0.10 quality / 0.45 speed / 0.45 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 14/14 | 94.85 | 80.42 | 94.92 | 97.98 |
| 2 | <code>mistral/mistral-ocr-2512</code> | 14/14 | 94.13 | 71.21 | 98.84 | 94.51 |
| 3 | <code>grok/grok-4.20-0309-non-reasoning</code> | 14/14 | 93.87 | 84.71 | 97.65 | 92.13 |
| 4 | <code>gemini/gemini-3.1-flash-lite</code> | 14/14 | 93.66 | 70.31 | 94.55 | 97.96 |
| 5 | <code>mistral/mistral-ocr-4-0</code> | 14/14 | 91.22 | 77.10 | 96.73 | 88.84 |
| 6 | <code>glm/glm-ocr</code> | 14/14 | 90.27 | 50.11 | 89.47 | 99.99 |
| 7 | <code>openai/gpt-5.4-mini</code> | 14/14 | 89.80 | 63.28 | 91.72 | 93.77 |
| 8 | <code>openai/gpt-5.4-nano</code> | 14/14 | 88.23 | 47.05 | 87.25 | 98.36 |
| 9 | <code>anthropic/claude-haiku-4-5</code> | 14/14 | 79.60 | 63.34 | 72.62 | 90.19 |
| 10 | <code>gemini/gemini-3.1-pro-preview</code> | 14/14 | 76.40 | 89.48 | 69.52 | 80.36 |
| 11 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 14/14 | 75.56 | 83.10 | 52.28 | 97.18 |
| 12 | <code>grok/grok-4.3</code> | 14/14 | 73.20 | 85.35 | 51.68 | 92.01 |
| 13 | <code>kimi/kimi-k2.6</code> | 14/14 | 70.99 | 91.55 | 47.70 | 89.71 |
| 14 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 14/14 | 70.64 | 67.99 | 43.87 | 97.99 |
| 15 | <code>gemini/gemini-3.5-flash</code> | 14/14 | 69.39 | 88.06 | 49.28 | 85.35 |
| 16 | <code>anthropic/claude-sonnet-5</code> | 14/14 | 68.26 | 68.98 | 62.70 | 73.66 |
| 17 | <code>anthropic/claude-sonnet-4-6</code> | 12/14 | 57.38 | 91.57 | 36.60 | 70.56 |
| 18 | <code>anthropic/claude-opus-4-8</code> | 13/14 | 49.51 | 82.17 | 56.38 | 35.39 |
| 19 | <code>openai/gpt-5.5</code> | 14/14 | 31.54 | 80.93 | 42.46 | 9.65 |

## Per-Run Quality Score

WER-derived quality score per provider in each run, sorted by mean.

### Local

| Provider | Mean | 2026-05-21_05-04-05-389_document | 2026-05-21_05-43-56-514_document | 2026-05-21_05-47-00-856_document | 2026-05-21_05-55-32-490_document | 2026-05-21_06-03-14-635_document | 2026-05-21_06-13-18-792_document | 2026-06-14_01-22-25-538_document | 2026-06-14_01-22-40-317_document | 2026-06-14_01-22-42-930_document | 2026-06-14_01-28-14-268_document | 2026-06-14_01-28-15-914_document | 2026-06-14_01-28-18-115_document | 2026-06-14_01-28-27-392_document | 2026-06-14_01-28-29-201_document |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| <code>paddle-ocr/paddle-ocr</code> | 54.54 | 4.83 | 1.57 | 92.21 | 71.12 | 100.00 | 100.00 | 41.33 | 38.10 | 10.17 | 31.19 | 100.00 | 83.10 | 26.92 | 62.96 |
| <code>tesseract/tesseract</code> | 54.02 | 4.83 | 14.55 | 96.48 | 77.22 | 100.00 | 100.00 | 9.69 | 28.57 | 42.73 | 44.04 | 100.00 | 84.04 | 0.00 | 54.07 |
| <code>ocrmypdf/ocrmypdf</code> | 51.55 | 12.89 | 13.18 | 96.33 | 75.52 | 91.57 | 91.57 | 11.73 | 34.92 | 14.53 | 39.91 | 100.00 | 84.04 | 0.00 | 55.56 |

### Third-Party Service

| Provider | Mean | 2026-05-21_05-04-05-389_document | 2026-05-21_05-43-56-514_document | 2026-05-21_05-47-00-856_document | 2026-05-21_05-55-32-490_document | 2026-05-21_06-03-14-635_document | 2026-05-21_06-13-18-792_document | 2026-06-14_01-22-25-538_document | 2026-06-14_01-22-40-317_document | 2026-06-14_01-22-42-930_document | 2026-06-14_01-28-14-268_document | 2026-06-14_01-28-15-914_document | 2026-06-14_01-28-18-115_document | 2026-06-14_01-28-27-392_document | 2026-06-14_01-28-29-201_document |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| <code>gemini/gemini-3.1-pro-preview</code> | 94.13 | 98.01 | 91.12 | 98.50 | 94.17 | 100.00 | 100.00 | 85.20 | 98.41 | 86.63 | 96.33 | 100.00 | 95.31 | 100.00 | 74.07 |
| <code>kimi/kimi-k2.6</code> | 93.78 | 93.60 | 99.45 | 99.10 | 89.33 | 100.00 | 100.00 | 88.27 | 92.06 | 91.86 | 95.87 | 100.00 | 99.53 | 65.38 | 98.52 |
| <code>anthropic/claude-sonnet-4-6</code> | 93.04 | 63.08 | — | 90.49 | 98.92 | 100.00 | 100.00 | 85.71 | 96.83 | 95.35 | — | 100.00 | 99.53 | 96.15 | 90.37 |
| <code>gemini/gemini-3.5-flash</code> | 91.75 | 90.33 | 96.65 | 98.35 | 92.91 | 67.07 | 100.00 | 78.57 | 92.06 | 98.55 | 96.33 | 100.00 | 99.53 | 100.00 | 74.07 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 89.36 | 96.48 | 95.83 | 99.40 | 84.84 | 97.19 | 96.85 | 76.53 | 90.48 | 98.55 | 94.95 | 100.00 | 99.53 | 50.00 | 70.37 |
| <code>anthropic/claude-opus-4-8</code> | 88.51 | 89.87 | — | 99.85 | 81.70 | 67.07 | 67.07 | 84.69 | 90.48 | 100.00 | 96.33 | 100.00 | 99.53 | 100.00 | 74.07 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 88.13 | 65.92 | 98.57 | 97.53 | 88.53 | 63.72 | 96.04 | 65.82 | 92.06 | 96.80 | 98.62 | 100.00 | 99.06 | 80.77 | 90.37 |
| <code>grok/grok-4.3</code> | 87.93 | 96.06 | 97.68 | 99.18 | 98.74 | 97.42 | 97.99 | 79.59 | 92.06 | 22.09 | 100.00 | 100.00 | 100.00 | 76.92 | 73.33 |
| <code>openai/gpt-5.5</code> | 86.37 | 15.52 | 59.84 | 99.85 | 96.95 | 100.00 | 100.00 | 74.49 | 98.41 | 98.55 | 96.33 | 100.00 | 100.00 | 69.23 | 100.00 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | 86.09 | 4.71 | 91.12 | 99.18 | 98.65 | 100.00 | 100.00 | 86.73 | 98.41 | 63.66 | 100.00 | 100.00 | 90.14 | 100.00 | 72.59 |
| <code>mistral/mistral-ocr-4-0</code> | 85.85 | 74.23 | 89.28 | 99.85 | 88.34 | 66.69 | 99.71 | 83.67 | 74.60 | 91.57 | 98.17 | 100.00 | 92.96 | 76.92 | 65.93 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 83.00 | 55.74 | 92.76 | 97.75 | 91.21 | 96.67 | 88.02 | 78.57 | 87.30 | 95.93 | 92.66 | 80.00 | 93.43 | 42.31 | 69.63 |
| <code>mistral/mistral-ocr-2512</code> | 79.77 | 29.72 | 86.61 | 99.85 | 96.05 | 96.62 | 96.62 | 79.08 | 74.60 | 12.21 | 98.62 | 100.00 | 93.43 | 100.00 | 53.33 |
| <code>anthropic/claude-sonnet-5</code> | 78.57 | 85.21 | 99.45 | 99.55 | 81.90 | 12.04 | 37.79 | 82.14 | 100.00 | 97.67 | 96.33 | 100.00 | 99.53 | 46.15 | 62.22 |
| <code>gemini/gemini-3.1-flash-lite</code> | 77.65 | 4.71 | 90.64 | 99.03 | 91.57 | 67.07 | 67.07 | 81.63 | 84.13 | 32.85 | 100.00 | 100.00 | 95.77 | 100.00 | 72.59 |
| <code>openai/gpt-5.4-mini</code> | 77.24 | 12.93 | 97.34 | 57.83 | 88.43 | 67.00 | 100.00 | 70.41 | 93.65 | 90.99 | 72.02 | 100.00 | 98.12 | 61.54 | 71.11 |
| <code>anthropic/claude-haiku-4-5</code> | 71.59 | 12.84 | 88.32 | 98.05 | 95.15 | 60.75 | 95.99 | 48.98 | 92.06 | 18.90 | 90.37 | 100.00 | 99.06 | 26.92 | 74.81 |
| <code>openai/gpt-5.4-nano</code> | 69.12 | 4.71 | 60.18 | 96.63 | 58.12 | 99.54 | 100.00 | 43.37 | 74.60 | 79.07 | 68.81 | 100.00 | 93.43 | 30.77 | 58.52 |
| <code>glm/glm-ocr</code> | 69.08 | 82.79 | 83.33 | 98.58 | 80.36 | 95.13 | 95.13 | 0.00 | 42.86 | 0.00 | 85.32 | 100.00 | 80.75 | 57.69 | 65.19 |

## Model Tiers

Tiers are `quality-cost-terciles-v1`: contiguous, near-equal slices of each group's `qualityCost` weighted ranking, with remainder models assigned to higher tiers first. Groups are never compared against each other.

### Local

| Tier | Models (quality-cost rank · composite) | Basis |
| --- | --- | --- |
| Tier 1 | <code>tesseract/tesseract</code> (#1 · 83.92) | Highest quality-cost tercile (rank 1). |
| Tier 2 | <code>ocrmypdf/ocrmypdf</code> (#2 · 75.71) | Middle quality-cost tercile (rank 2). |
| Tier 3 | <code>paddle-ocr/paddle-ocr</code> (#3 · 69.64) | Lower quality-cost tercile (rank 3). |

### Third-Party Service

| Tier | Models (quality-cost rank · composite) | Basis |
| --- | --- | --- |
| Tier 1 | <code>gemini/gemini-3.1-flash-lite-preview</code> (#1 · 89.77), <code>grok/grok-4.20-0309-non-reasoning</code> (#2 · 89.35), <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> (#3 · 86.35), <code>kimi/kimi-k2.6</code> (#4 · 86.34), <code>gemini/gemini-3.1-flash-lite</code> (#5 · 85.18), <code>grok/grok-4.3</code> (#6 · 84.98), <code>mistral/mistral-ocr-2512</code> (#7 · 84.45) | Highest quality-cost tercile (ranks 1-7). |
| Tier 2 | <code>mistral/mistral-ocr-4-0</code> (#8 · 84.34), <code>gemini/gemini-3.1-pro-preview</code> (#9 · 83.38), <code>gemini/gemini-3.5-flash</code> (#10 · 82.96), <code>openai/gpt-5.4-mini</code> (#11 · 79.84), <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> (#12 · 79.08), <code>anthropic/claude-sonnet-4-6</code> (#13 · 76.62) | Middle quality-cost tercile (ranks 8-13). |
| Tier 3 | <code>glm/glm-ocr</code> (#14 · 76.49), <code>anthropic/claude-haiku-4-5</code> (#15 · 76.35), <code>openai/gpt-5.4-nano</code> (#16 · 74.16), <code>anthropic/claude-sonnet-5</code> (#17 · 70.46), <code>anthropic/claude-opus-4-8</code> (#18 · 58.54), <code>openai/gpt-5.5</code> (#19 · 45.01) | Lower quality-cost tercile (ranks 14-19). |

## Notes

- Each provider is aggregated by providerKey across the runs it appears in; sums and means cover present values only.
- Groups follow the single-run OCR contract: local, thirdPartyService; local and service providers are never ranked against each other.
- Weighted WER and weighted CER are evidence columns: summed breakdown errors divided by summed reference counts, so longer runs count proportionally more.
- Weighted composite rankings and quality-cost tercile model tiers are emitted per group; no cross-group overall or rankingSurfaces leaderboard is emitted, and single-run reports remain tier-free.
- Supersedes the hand-authored 2026-06-14 combined report, which is preserved as a historical record.
