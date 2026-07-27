# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-05-21_06-13-18-792_document`
- Total providers: 22 (3 local, 19 third-party service)
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

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>ocrmypdf/ocrmypdf</code> | $0.00 local monetary cost | 91.57 | 8.43% | 7.10% | 10.45s | $0.00 |
| 2 | <code>paddle-ocr/paddle-ocr</code> | $0.00 local monetary cost | 100.00 | 0.00% | 0.00% | 0.00s | $0.00 |
| 3 | <code>tesseract/tesseract</code> | $0.00 local monetary cost | 100.00 | 0.00% | 0.00% | 0.05s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>paddle-ocr/paddle-ocr</code> | 0.00s | 100.00 | 0.00% | 0.00% | 0.00s | $0.00 |
| 2 | <code>tesseract/tesseract</code> | 0.05s | 100.00 | 0.00% | 0.00% | 0.05s | $0.00 |
| 3 | <code>ocrmypdf/ocrmypdf</code> | 10.45s | 91.57 | 8.43% | 7.10% | 10.45s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>paddle-ocr/paddle-ocr</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.00s | $0.00 |
| 2 | <code>tesseract/tesseract</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.05s | $0.00 |
| 3 | <code>ocrmypdf/ocrmypdf</code> | 91.57/100 quality score | 91.57 | 8.43% | 7.10% | 10.45s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>glm/glm-ocr</code> | $0.0012 | 95.13 | 4.87% | 4.90% | 12.65s | $0.0012 |
| 2 | <code>openai/gpt-5.4-nano</code> | $0.0055 | 100.00 | 0.00% | 0.00% | 33.40s | $0.0055 |
| 3 | <code>gemini/gemini-3.1-flash-lite</code> | $0.0078 | 67.07 | 32.93% | 94.26% | 11.71s | $0.0078 |
| 4 | <code>gemini/gemini-3.1-flash-lite-preview</code> | $0.0078 | 100.00 | 0.00% | 0.00% | 11.31s | $0.0078 |
| 5 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0151 | 88.02 | 11.98% | 10.80% | 181.54s | $0.0151 |
| 6 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0198 | 96.85 | 3.15% | 3.35% | 93.51s | $0.0198 |
| 7 | <code>openai/gpt-5.4-mini</code> | $0.0200 | 100.00 | 0.00% | 0.00% | 15.40s | $0.0200 |
| 8 | <code>mistral/mistral-ocr-2512</code> | $0.0200 | 96.62 | 3.38% | 3.48% | 3.46s | $0.0200 |
| 9 | <code>mistral/mistral-ocr-4-0</code> | $0.0400 | 99.71 | 0.29% | 0.27% | 2.62s | $0.0400 |
| 10 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0403 | 96.04 | 3.96% | 4.27% | 2.60s | $0.0403 |
| 11 | <code>grok/grok-4.3</code> | $0.0406 | 97.99 | 2.01% | 2.10% | 137.12s | $0.0406 |
| 12 | <code>anthropic/claude-haiku-4-5</code> | $0.0435 | 95.99 | 4.01% | 6.02% | 40.65s | $0.0435 |
| 13 | <code>gemini/gemini-3.5-flash</code> | $0.0505 | 100.00 | 0.00% | 0.00% | 27.93s | $0.0505 |
| 14 | <code>kimi/kimi-k2.6</code> | $0.0535 | 100.00 | 0.00% | 0.00% | 118.49s | $0.0535 |
| 15 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0665 | 100.00 | 0.00% | 0.00% | 61.58s | $0.0665 |
| 16 | <code>anthropic/claude-sonnet-5</code> | $0.1027 | 37.79 | 62.21% | 57.78% | 64.80s | $0.1027 |
| 17 | <code>openai/gpt-5.5</code> | $0.1346 | 100.00 | 0.00% | 0.00% | 37.92s | $0.1346 |
| 18 | <code>anthropic/claude-sonnet-4-6</code> | $0.1351 | 100.00 | 0.00% | 0.00% | 86.80s | $0.1351 |
| 19 | <code>anthropic/claude-opus-4-8</code> | $0.2660 | 67.07 | 32.93% | 94.26% | 60.17s | $0.2660 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>grok/grok-4.20-0309-non-reasoning</code> | 2.60s | 96.04 | 3.96% | 4.27% | 2.60s | $0.0403 |
| 2 | <code>mistral/mistral-ocr-4-0</code> | 2.62s | 99.71 | 0.29% | 0.27% | 2.62s | $0.0400 |
| 3 | <code>mistral/mistral-ocr-2512</code> | 3.46s | 96.62 | 3.38% | 3.48% | 3.46s | $0.0200 |
| 4 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 11.31s | 100.00 | 0.00% | 0.00% | 11.31s | $0.0078 |
| 5 | <code>gemini/gemini-3.1-flash-lite</code> | 11.71s | 67.07 | 32.93% | 94.26% | 11.71s | $0.0078 |
| 6 | <code>glm/glm-ocr</code> | 12.65s | 95.13 | 4.87% | 4.90% | 12.65s | $0.0012 |
| 7 | <code>openai/gpt-5.4-mini</code> | 15.40s | 100.00 | 0.00% | 0.00% | 15.40s | $0.0200 |
| 8 | <code>gemini/gemini-3.5-flash</code> | 27.93s | 100.00 | 0.00% | 0.00% | 27.93s | $0.0505 |
| 9 | <code>openai/gpt-5.4-nano</code> | 33.40s | 100.00 | 0.00% | 0.00% | 33.40s | $0.0055 |
| 10 | <code>openai/gpt-5.5</code> | 37.92s | 100.00 | 0.00% | 0.00% | 37.92s | $0.1346 |
| 11 | <code>anthropic/claude-haiku-4-5</code> | 40.65s | 95.99 | 4.01% | 6.02% | 40.65s | $0.0435 |
| 12 | <code>anthropic/claude-opus-4-8</code> | 60.17s | 67.07 | 32.93% | 94.26% | 60.17s | $0.2660 |
| 13 | <code>gemini/gemini-3.1-pro-preview</code> | 61.58s | 100.00 | 0.00% | 0.00% | 61.58s | $0.0665 |
| 14 | <code>anthropic/claude-sonnet-5</code> | 64.80s | 37.79 | 62.21% | 57.78% | 64.80s | $0.1027 |
| 15 | <code>anthropic/claude-sonnet-4-6</code> | 86.80s | 100.00 | 0.00% | 0.00% | 86.80s | $0.1351 |
| 16 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 93.51s | 96.85 | 3.15% | 3.35% | 93.51s | $0.0198 |
| 17 | <code>kimi/kimi-k2.6</code> | 118.49s | 100.00 | 0.00% | 0.00% | 118.49s | $0.0535 |
| 18 | <code>grok/grok-4.3</code> | 137.12s | 97.99 | 2.01% | 2.10% | 137.12s | $0.0406 |
| 19 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 181.54s | 88.02 | 11.98% | 10.80% | 181.54s | $0.0151 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-sonnet-4-6</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 86.80s | $0.1351 |
| 2 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 11.31s | $0.0078 |
| 3 | <code>gemini/gemini-3.1-pro-preview</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 61.58s | $0.0665 |
| 4 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 27.93s | $0.0505 |
| 5 | <code>kimi/kimi-k2.6</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 118.49s | $0.0535 |
| 6 | <code>openai/gpt-5.4-mini</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 15.40s | $0.0200 |
| 7 | <code>openai/gpt-5.4-nano</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 33.40s | $0.0055 |
| 8 | <code>openai/gpt-5.5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 37.92s | $0.1346 |
| 9 | <code>mistral/mistral-ocr-4-0</code> | 99.71/100 quality score | 99.71 | 0.29% | 0.27% | 2.62s | $0.0400 |
| 10 | <code>grok/grok-4.3</code> | 97.99/100 quality score | 97.99 | 2.01% | 2.10% | 137.12s | $0.0406 |
| 11 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 96.85/100 quality score | 96.85 | 3.15% | 3.35% | 93.51s | $0.0198 |
| 12 | <code>mistral/mistral-ocr-2512</code> | 96.62/100 quality score | 96.62 | 3.38% | 3.48% | 3.46s | $0.0200 |
| 13 | <code>grok/grok-4.20-0309-non-reasoning</code> | 96.04/100 quality score | 96.04 | 3.96% | 4.27% | 2.60s | $0.0403 |
| 14 | <code>anthropic/claude-haiku-4-5</code> | 95.99/100 quality score | 95.99 | 4.01% | 6.02% | 40.65s | $0.0435 |
| 15 | <code>glm/glm-ocr</code> | 95.13/100 quality score | 95.13 | 4.87% | 4.90% | 12.65s | $0.0012 |
| 16 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 88.02/100 quality score | 88.02 | 11.98% | 10.80% | 181.54s | $0.0151 |
| 17 | <code>anthropic/claude-opus-4-8</code> | 67.07/100 quality score | 67.07 | 32.93% | 94.26% | 60.17s | $0.2660 |
| 18 | <code>gemini/gemini-3.1-flash-lite</code> | 67.07/100 quality score | 67.07 | 32.93% | 94.26% | 11.71s | $0.0078 |
| 19 | <code>anthropic/claude-sonnet-5</code> | 37.79/100 quality score | 37.79 | 62.21% | 57.78% | 64.80s | $0.1027 |

## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>ocrmypdf/ocrmypdf</code> | Local | 91.57 | 8.43% | 7.10% | 10.45s | $0.00 |
| <code>paddle-ocr/paddle-ocr</code> | Local | 100.00 | 0.00% | 0.00% | 0.00s | $0.00 |
| <code>tesseract/tesseract</code> | Local | 100.00 | 0.00% | 0.00% | 0.05s | $0.00 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 67.07 | 32.93% | 94.26% | 60.17s | $0.2660 |
| <code>anthropic/claude-sonnet-4-6</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 86.80s | $0.1351 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 96.85 | 3.15% | 3.35% | 93.51s | $0.0198 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 88.02 | 11.98% | 10.80% | 181.54s | $0.0151 |
| <code>gemini/gemini-3.1-flash-lite</code> | Third-Party Service | 67.07 | 32.93% | 94.26% | 11.71s | $0.0078 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 11.31s | $0.0078 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 61.58s | $0.0665 |
| <code>glm/glm-ocr</code> | Third-Party Service | 95.13 | 4.87% | 4.90% | 12.65s | $0.0012 |
| <code>grok/grok-4.3</code> | Third-Party Service | 97.99 | 2.01% | 2.10% | 137.12s | $0.0406 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 118.49s | $0.0535 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 96.62 | 3.38% | 3.48% | 3.46s | $0.0200 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 33.40s | $0.0055 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 37.92s | $0.1346 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 95.99 | 4.01% | 6.02% | 40.65s | $0.0435 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 37.79 | 62.21% | 57.78% | 64.80s | $0.1027 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 27.93s | $0.0505 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 96.04 | 3.96% | 4.27% | 2.60s | $0.0403 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 99.71 | 0.29% | 0.27% | 2.62s | $0.0400 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 15.40s | $0.0200 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>ocrmypdf/ocrmypdf</code> | 92 | 32 | 23 | 1744 |
| <code>paddle-ocr/paddle-ocr</code> | 0 | 0 | 0 | 1744 |
| <code>tesseract/tesseract</code> | 0 | 0 | 0 | 1744 |
| <code>anthropic/claude-opus-4-8</code> | 0 | 0 | 432 | 1312 |
| <code>anthropic/claude-sonnet-4-6</code> | 0 | 0 | 0 | 1744 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 1 | 54 | 0 | 1744 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 15 | 56 | 138 | 1744 |
| <code>gemini/gemini-3.1-flash-lite</code> | 0 | 0 | 432 | 1312 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | 0 | 0 | 0 | 1744 |
| <code>gemini/gemini-3.1-pro-preview</code> | 0 | 0 | 0 | 1744 |
| <code>glm/glm-ocr</code> | 9 | 69 | 7 | 1744 |
| <code>grok/grok-4.3</code> | 0 | 35 | 0 | 1744 |
| <code>kimi/kimi-k2.6</code> | 0 | 0 | 0 | 1744 |
| <code>mistral/mistral-ocr-2512</code> | 3 | 6 | 50 | 1744 |
| <code>openai/gpt-5.4-nano</code> | 0 | 0 | 0 | 1744 |
| <code>openai/gpt-5.5</code> | 0 | 0 | 0 | 1744 |
| <code>anthropic/claude-haiku-4-5</code> | 15 | 41 | 14 | 1744 |
| <code>anthropic/claude-sonnet-5</code> | 175 | 708 | 202 | 1744 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 1744 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 0 | 69 | 0 | 1744 |
| <code>mistral/mistral-ocr-4-0</code> | 0 | 0 | 5 | 1744 |
| <code>openai/gpt-5.4-mini</code> | 0 | 0 | 0 | 1744 |

## Notes

- Best local model: `paddle-ocr/paddle-ocr` scored 100.00/100.
- Best cloud service: `anthropic/claude-sonnet-4-6` scored 100.00/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.1165¢ ($0.0012).
- Fastest local model: `paddle-ocr/paddle-ocr` at 0.00s.
- Fastest cloud service: `grok/grok-4.20-0309-non-reasoning` at 2.60s.
