# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-05-21_05-04-05-389_document`
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
| 1 | <code>ocrmypdf/ocrmypdf</code> | $0.00 local monetary cost | 12.89 | 87.11% | 89.16% | 24.62s | $0.00 |
| 2 | <code>paddle-ocr/paddle-ocr</code> | $0.00 local monetary cost | 4.83 | 95.17% | 96.37% | 0.00s | $0.00 |
| 3 | <code>tesseract/tesseract</code> | $0.00 local monetary cost | 4.83 | 95.17% | 96.37% | 0.03s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>paddle-ocr/paddle-ocr</code> | 0.00s | 4.83 | 95.17% | 96.37% | 0.00s | $0.00 |
| 2 | <code>tesseract/tesseract</code> | 0.03s | 4.83 | 95.17% | 96.37% | 0.03s | $0.00 |
| 3 | <code>ocrmypdf/ocrmypdf</code> | 24.62s | 12.89 | 87.11% | 89.16% | 24.62s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>ocrmypdf/ocrmypdf</code> | 12.89/100 quality score | 12.89 | 87.11% | 89.16% | 24.62s | $0.00 |
| 2 | <code>paddle-ocr/paddle-ocr</code> | 4.83/100 quality score | 4.83 | 95.17% | 96.37% | 0.00s | $0.00 |
| 3 | <code>tesseract/tesseract</code> | 4.83/100 quality score | 4.83 | 95.17% | 96.37% | 0.03s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>glm/glm-ocr</code> | $0.0003 | 82.79 | 17.21% | 26.10% | 9.32s | $0.0003 |
| 2 | <code>openai/gpt-5.4-nano</code> | $0.0016 | 4.71 | 95.29% | 95.62% | 23.43s | $0.0016 |
| 3 | <code>gemini/gemini-3.1-flash-lite</code> | $0.0016 | 4.71 | 95.29% | 97.26% | 6.83s | $0.0016 |
| 4 | <code>gemini/gemini-3.1-flash-lite-preview</code> | $0.0018 | 4.71 | 95.29% | 97.14% | 8.13s | $0.0018 |
| 5 | <code>mistral/mistral-ocr-2512</code> | $0.0020 | 29.72 | 70.28% | 74.82% | 10.18s | $0.0020 |
| 6 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0037 | 55.74 | 44.26% | 41.64% | 178.08s | $0.0037 |
| 7 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 74.23 | 25.77% | 14.32% | 25.27s | $0.0040 |
| 8 | <code>openai/gpt-5.4-mini</code> | $0.0040 | 12.93 | 87.07% | 86.62% | 8.59s | $0.0040 |
| 9 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0052 | 96.48 | 3.52% | 2.29% | 115.12s | $0.0052 |
| 10 | <code>anthropic/claude-haiku-4-5</code> | $0.0063 | 12.84 | 87.16% | 87.13% | 12.23s | $0.0063 |
| 11 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0093 | 65.92 | 34.08% | 41.84% | 14.75s | $0.0093 |
| 12 | <code>grok/grok-4.3</code> | $0.0102 | 96.06 | 3.94% | 2.78% | 52.20s | $0.0102 |
| 13 | <code>kimi/kimi-k2.6</code> | $0.0171 | 93.60 | 6.40% | 1.51% | 79.63s | $0.0171 |
| 14 | <code>gemini/gemini-3.5-flash</code> | $0.0291 | 90.33 | 9.67% | 4.14% | 66.45s | $0.0291 |
| 15 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0387 | 98.01 | 1.99% | 1.06% | 101.24s | $0.0387 |
| 16 | <code>anthropic/claude-sonnet-4-6</code> | $0.0521 | 63.08 | 36.92% | 38.25% | 82.37s | $0.0521 |
| 17 | <code>anthropic/claude-sonnet-5</code> | $0.0591 | 85.21 | 14.79% | 6.97% | 75.14s | $0.0591 |
| 18 | <code>openai/gpt-5.5</code> | $0.1190 | 15.52 | 84.48% | 84.92% | 66.22s | $0.1190 |
| 19 | <code>anthropic/claude-opus-4-8</code> | $0.1334 | 89.87 | 10.13% | 4.56% | 86.28s | $0.1334 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.1-flash-lite</code> | 6.83s | 4.71 | 95.29% | 97.26% | 6.83s | $0.0016 |
| 2 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 8.13s | 4.71 | 95.29% | 97.14% | 8.13s | $0.0018 |
| 3 | <code>openai/gpt-5.4-mini</code> | 8.59s | 12.93 | 87.07% | 86.62% | 8.59s | $0.0040 |
| 4 | <code>glm/glm-ocr</code> | 9.32s | 82.79 | 17.21% | 26.10% | 9.32s | $0.0003 |
| 5 | <code>mistral/mistral-ocr-2512</code> | 10.18s | 29.72 | 70.28% | 74.82% | 10.18s | $0.0020 |
| 6 | <code>anthropic/claude-haiku-4-5</code> | 12.23s | 12.84 | 87.16% | 87.13% | 12.23s | $0.0063 |
| 7 | <code>grok/grok-4.20-0309-non-reasoning</code> | 14.75s | 65.92 | 34.08% | 41.84% | 14.75s | $0.0093 |
| 8 | <code>openai/gpt-5.4-nano</code> | 23.43s | 4.71 | 95.29% | 95.62% | 23.43s | $0.0016 |
| 9 | <code>mistral/mistral-ocr-4-0</code> | 25.27s | 74.23 | 25.77% | 14.32% | 25.27s | $0.0040 |
| 10 | <code>grok/grok-4.3</code> | 52.20s | 96.06 | 3.94% | 2.78% | 52.20s | $0.0102 |
| 11 | <code>openai/gpt-5.5</code> | 66.22s | 15.52 | 84.48% | 84.92% | 66.22s | $0.1190 |
| 12 | <code>gemini/gemini-3.5-flash</code> | 66.45s | 90.33 | 9.67% | 4.14% | 66.45s | $0.0291 |
| 13 | <code>anthropic/claude-sonnet-5</code> | 75.14s | 85.21 | 14.79% | 6.97% | 75.14s | $0.0591 |
| 14 | <code>kimi/kimi-k2.6</code> | 79.63s | 93.60 | 6.40% | 1.51% | 79.63s | $0.0171 |
| 15 | <code>anthropic/claude-sonnet-4-6</code> | 82.37s | 63.08 | 36.92% | 38.25% | 82.37s | $0.0521 |
| 16 | <code>anthropic/claude-opus-4-8</code> | 86.28s | 89.87 | 10.13% | 4.56% | 86.28s | $0.1334 |
| 17 | <code>gemini/gemini-3.1-pro-preview</code> | 101.24s | 98.01 | 1.99% | 1.06% | 101.24s | $0.0387 |
| 18 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 115.12s | 96.48 | 3.52% | 2.29% | 115.12s | $0.0052 |
| 19 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 178.08s | 55.74 | 44.26% | 41.64% | 178.08s | $0.0037 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.1-pro-preview</code> | 98.01/100 quality score | 98.01 | 1.99% | 1.06% | 101.24s | $0.0387 |
| 2 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 96.48/100 quality score | 96.48 | 3.52% | 2.29% | 115.12s | $0.0052 |
| 3 | <code>grok/grok-4.3</code> | 96.06/100 quality score | 96.06 | 3.94% | 2.78% | 52.20s | $0.0102 |
| 4 | <code>kimi/kimi-k2.6</code> | 93.60/100 quality score | 93.60 | 6.40% | 1.51% | 79.63s | $0.0171 |
| 5 | <code>gemini/gemini-3.5-flash</code> | 90.33/100 quality score | 90.33 | 9.67% | 4.14% | 66.45s | $0.0291 |
| 6 | <code>anthropic/claude-opus-4-8</code> | 89.87/100 quality score | 89.87 | 10.13% | 4.56% | 86.28s | $0.1334 |
| 7 | <code>anthropic/claude-sonnet-5</code> | 85.21/100 quality score | 85.21 | 14.79% | 6.97% | 75.14s | $0.0591 |
| 8 | <code>glm/glm-ocr</code> | 82.79/100 quality score | 82.79 | 17.21% | 26.10% | 9.32s | $0.0003 |
| 9 | <code>mistral/mistral-ocr-4-0</code> | 74.23/100 quality score | 74.23 | 25.77% | 14.32% | 25.27s | $0.0040 |
| 10 | <code>grok/grok-4.20-0309-non-reasoning</code> | 65.92/100 quality score | 65.92 | 34.08% | 41.84% | 14.75s | $0.0093 |
| 11 | <code>anthropic/claude-sonnet-4-6</code> | 63.08/100 quality score | 63.08 | 36.92% | 38.25% | 82.37s | $0.0521 |
| 12 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 55.74/100 quality score | 55.74 | 44.26% | 41.64% | 178.08s | $0.0037 |
| 13 | <code>mistral/mistral-ocr-2512</code> | 29.72/100 quality score | 29.72 | 70.28% | 74.82% | 10.18s | $0.0020 |
| 14 | <code>openai/gpt-5.5</code> | 15.52/100 quality score | 15.52 | 84.48% | 84.92% | 66.22s | $0.1190 |
| 15 | <code>openai/gpt-5.4-mini</code> | 12.93/100 quality score | 12.93 | 87.07% | 86.62% | 8.59s | $0.0040 |
| 16 | <code>anthropic/claude-haiku-4-5</code> | 12.84/100 quality score | 12.84 | 87.16% | 87.13% | 12.23s | $0.0063 |
| 17 | <code>openai/gpt-5.4-nano</code> | 4.71/100 quality score | 4.71 | 95.29% | 95.62% | 23.43s | $0.0016 |
| 18 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 4.71/100 quality score | 4.71 | 95.29% | 97.14% | 8.13s | $0.0018 |
| 19 | <code>gemini/gemini-3.1-flash-lite</code> | 4.71/100 quality score | 4.71 | 95.29% | 97.26% | 6.83s | $0.0016 |

## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>ocrmypdf/ocrmypdf</code> | Local | 12.89 | 87.11% | 89.16% | 24.62s | $0.00 |
| <code>paddle-ocr/paddle-ocr</code> | Local | 4.83 | 95.17% | 96.37% | 0.00s | $0.00 |
| <code>tesseract/tesseract</code> | Local | 4.83 | 95.17% | 96.37% | 0.03s | $0.00 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 12.84 | 87.16% | 87.13% | 12.23s | $0.0063 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 89.87 | 10.13% | 4.56% | 86.28s | $0.1334 |
| <code>anthropic/claude-sonnet-4-6</code> | Third-Party Service | 63.08 | 36.92% | 38.25% | 82.37s | $0.0521 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 85.21 | 14.79% | 6.97% | 75.14s | $0.0591 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 96.48 | 3.52% | 2.29% | 115.12s | $0.0052 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 55.74 | 44.26% | 41.64% | 178.08s | $0.0037 |
| <code>gemini/gemini-3.1-flash-lite</code> | Third-Party Service | 4.71 | 95.29% | 97.26% | 6.83s | $0.0016 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | Third-Party Service | 4.71 | 95.29% | 97.14% | 8.13s | $0.0018 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 98.01 | 1.99% | 1.06% | 101.24s | $0.0387 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 90.33 | 9.67% | 4.14% | 66.45s | $0.0291 |
| <code>glm/glm-ocr</code> | Third-Party Service | 82.79 | 17.21% | 26.10% | 9.32s | $0.0003 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 65.92 | 34.08% | 41.84% | 14.75s | $0.0093 |
| <code>grok/grok-4.3</code> | Third-Party Service | 96.06 | 3.94% | 2.78% | 52.20s | $0.0102 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 93.60 | 6.40% | 1.51% | 79.63s | $0.0171 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 29.72 | 70.28% | 74.82% | 10.18s | $0.0020 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 74.23 | 25.77% | 14.32% | 25.27s | $0.0040 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 12.93 | 87.07% | 86.62% | 8.59s | $0.0040 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 4.71 | 95.29% | 95.62% | 23.43s | $0.0016 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 15.52 | 84.48% | 84.92% | 66.22s | $0.1190 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>ocrmypdf/ocrmypdf</code> | 1812 | 154 | 89 | 2359 |
| <code>paddle-ocr/paddle-ocr</code> | 458 | 1776 | 11 | 2359 |
| <code>tesseract/tesseract</code> | 458 | 1776 | 11 | 2359 |
| <code>anthropic/claude-haiku-4-5</code> | 29 | 2020 | 7 | 2359 |
| <code>anthropic/claude-opus-4-8</code> | 125 | 34 | 80 | 2359 |
| <code>anthropic/claude-sonnet-4-6</code> | 171 | 551 | 149 | 2359 |
| <code>anthropic/claude-sonnet-5</code> | 207 | 75 | 67 | 2359 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 30 | 39 | 14 | 2359 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 659 | 232 | 153 | 2359 |
| <code>gemini/gemini-3.1-flash-lite</code> | 536 | 1710 | 2 | 2359 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | 534 | 1712 | 2 | 2359 |
| <code>gemini/gemini-3.1-pro-preview</code> | 38 | 5 | 4 | 2359 |
| <code>gemini/gemini-3.5-flash</code> | 115 | 20 | 93 | 2359 |
| <code>glm/glm-ocr</code> | 67 | 157 | 182 | 2359 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 96 | 598 | 110 | 2359 |
| <code>grok/grok-4.3</code> | 42 | 25 | 26 | 2359 |
| <code>kimi/kimi-k2.6</code> | 87 | 8 | 56 | 2359 |
| <code>mistral/mistral-ocr-2512</code> | 611 | 1026 | 21 | 2359 |
| <code>mistral/mistral-ocr-4-0</code> | 510 | 23 | 75 | 2359 |
| <code>openai/gpt-5.4-mini</code> | 61 | 1983 | 10 | 2359 |
| <code>openai/gpt-5.4-nano</code> | 540 | 1706 | 2 | 2359 |
| <code>openai/gpt-5.5</code> | 13 | 1980 | 0 | 2359 |

## Notes

- Best local model: `ocrmypdf/ocrmypdf` scored 12.89/100.
- Best cloud service: `gemini/gemini-3.1-pro-preview` scored 98.01/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0350¢ ($0.0003).
- Fastest local model: `paddle-ocr/paddle-ocr` at 0.00s.
- Fastest cloud service: `gemini/gemini-3.1-flash-lite` at 6.83s.
