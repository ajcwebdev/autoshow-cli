# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-06-14_01-28-27-392_document`
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
| 1 | <code>ocrmypdf</code> | $0.00 local monetary cost | 0.00 | 1207.69% | 96.52% | 3.12s | $0.00 |
| 2 | <code>paddle-ocr</code> | $0.00 local monetary cost | 26.92 | 73.08% | 80.08% | 13.82s | $0.00 |
| 3 | <code>tesseract</code> | $0.00 local monetary cost | 0.00 | 1176.92% | 103.26% | 2.47s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 2.47s | 0.00 | 1176.92% | 103.26% | 2.47s | $0.00 |
| 2 | <code>ocrmypdf</code> | 3.12s | 0.00 | 1207.69% | 96.52% | 3.12s | $0.00 |
| 3 | <code>paddle-ocr</code> | 13.82s | 26.92 | 73.08% | 80.08% | 13.82s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>paddle-ocr</code> | 26.92/100 quality score | 26.92 | 73.08% | 80.08% | 13.82s | $0.00 |
| 2 | <code>tesseract</code> | 0.00/100 quality score | 0.00 | 1176.92% | 103.26% | 2.47s | $0.00 |
| 3 | <code>ocrmypdf</code> | 0.00/100 quality score | 0.00 | 1207.69% | 96.52% | 3.12s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>glm/glm-ocr</code> | $0.0005 | 57.69 | 42.31% | 40.68% | 22.97s | $0.0005 |
| 2 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0006 | 42.31 | 57.69% | 22.05% | 17.85s | $0.0006 |
| 3 | <code>openai/gpt-5.4-nano</code> | $0.0010 | 30.77 | 69.23% | 85.53% | 5.15s | $0.0010 |
| 4 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0010 | 50.00 | 50.00% | 3.41% | 29.37s | $0.0010 |
| 5 | <code>gemini/gemini-3.1-flash-lite-preview</code> | $0.0015 | 100.00 | 0.00% | 1.06% | 3.74s | $0.0015 |
| 6 | <code>gemini/gemini-3.1-flash-lite</code> | $0.0015 | 100.00 | 0.00% | 0.98% | 3.64s | $0.0015 |
| 7 | <code>mistral/mistral-ocr-2512</code> | $0.0020 | 100.00 | 0.00% | 0.45% | 2.20s | $0.0020 |
| 8 | <code>grok/grok-4.3</code> | $0.0029 | 76.92 | 23.08% | 35.08% | 13.93s | $0.0029 |
| 9 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0032 | 80.77 | 19.23% | 10.76% | 4.18s | $0.0032 |
| 10 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 76.92 | 23.08% | 2.20% | 2.66s | $0.0040 |
| 11 | <code>openai/gpt-5.4-mini</code> | $0.0045 | 61.54 | 38.46% | 54.92% | 4.28s | $0.0045 |
| 12 | <code>kimi/kimi-k2.6</code> | $0.0052 | 65.38 | 34.62% | 8.18% | 31.84s | $0.0052 |
| 13 | <code>anthropic/claude-haiku-4-5</code> | $0.0062 | 26.92 | 73.08% | 86.29% | 8.80s | $0.0062 |
| 14 | <code>gemini/gemini-3.5-flash</code> | $0.0086 | 100.00 | 0.00% | 0.00% | 22.74s | $0.0086 |
| 15 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0118 | 100.00 | 0.00% | 1.06% | 6.98s | $0.0118 |
| 16 | <code>anthropic/claude-sonnet-5</code> | $0.0182 | 46.15 | 53.85% | 52.27% | 24.23s | $0.0182 |
| 17 | <code>anthropic/claude-sonnet-4-6</code> | $0.0228 | 96.15 | 3.85% | 13.11% | 29.37s | $0.0228 |
| 18 | <code>anthropic/claude-opus-4-8</code> | $0.0382 | 100.00 | 0.00% | 1.29% | 24.75s | $0.0382 |
| 19 | <code>openai/gpt-5.5</code> | $0.2089 | 69.23 | 30.77% | 10.15% | 63.27s | $0.2089 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-2512</code> | 2.20s | 100.00 | 0.00% | 0.45% | 2.20s | $0.0020 |
| 2 | <code>mistral/mistral-ocr-4-0</code> | 2.66s | 76.92 | 23.08% | 2.20% | 2.66s | $0.0040 |
| 3 | <code>gemini/gemini-3.1-flash-lite</code> | 3.64s | 100.00 | 0.00% | 0.98% | 3.64s | $0.0015 |
| 4 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 3.74s | 100.00 | 0.00% | 1.06% | 3.74s | $0.0015 |
| 5 | <code>grok/grok-4.20-0309-non-reasoning</code> | 4.18s | 80.77 | 19.23% | 10.76% | 4.18s | $0.0032 |
| 6 | <code>openai/gpt-5.4-mini</code> | 4.28s | 61.54 | 38.46% | 54.92% | 4.28s | $0.0045 |
| 7 | <code>openai/gpt-5.4-nano</code> | 5.15s | 30.77 | 69.23% | 85.53% | 5.15s | $0.0010 |
| 8 | <code>gemini/gemini-3.1-pro-preview</code> | 6.98s | 100.00 | 0.00% | 1.06% | 6.98s | $0.0118 |
| 9 | <code>anthropic/claude-haiku-4-5</code> | 8.80s | 26.92 | 73.08% | 86.29% | 8.80s | $0.0062 |
| 10 | <code>grok/grok-4.3</code> | 13.93s | 76.92 | 23.08% | 35.08% | 13.93s | $0.0029 |
| 11 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 17.85s | 42.31 | 57.69% | 22.05% | 17.85s | $0.0006 |
| 12 | <code>gemini/gemini-3.5-flash</code> | 22.74s | 100.00 | 0.00% | 0.00% | 22.74s | $0.0086 |
| 13 | <code>glm/glm-ocr</code> | 22.97s | 57.69 | 42.31% | 40.68% | 22.97s | $0.0005 |
| 14 | <code>anthropic/claude-sonnet-5</code> | 24.23s | 46.15 | 53.85% | 52.27% | 24.23s | $0.0182 |
| 15 | <code>anthropic/claude-opus-4-8</code> | 24.75s | 100.00 | 0.00% | 1.29% | 24.75s | $0.0382 |
| 16 | <code>anthropic/claude-sonnet-4-6</code> | 29.37s | 96.15 | 3.85% | 13.11% | 29.37s | $0.0228 |
| 17 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 29.37s | 50.00 | 50.00% | 3.41% | 29.37s | $0.0010 |
| 18 | <code>kimi/kimi-k2.6</code> | 31.84s | 65.38 | 34.62% | 8.18% | 31.84s | $0.0052 |
| 19 | <code>openai/gpt-5.5</code> | 63.27s | 69.23 | 30.77% | 10.15% | 63.27s | $0.2089 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 22.74s | $0.0086 |
| 2 | <code>mistral/mistral-ocr-2512</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.45% | 2.20s | $0.0020 |
| 3 | <code>gemini/gemini-3.1-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.98% | 3.64s | $0.0015 |
| 4 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 100.00/100 quality score | 100.00 | 0.00% | 1.06% | 3.74s | $0.0015 |
| 5 | <code>gemini/gemini-3.1-pro-preview</code> | 100.00/100 quality score | 100.00 | 0.00% | 1.06% | 6.98s | $0.0118 |
| 6 | <code>anthropic/claude-opus-4-8</code> | 100.00/100 quality score | 100.00 | 0.00% | 1.29% | 24.75s | $0.0382 |
| 7 | <code>anthropic/claude-sonnet-4-6</code> | 96.15/100 quality score | 96.15 | 3.85% | 13.11% | 29.37s | $0.0228 |
| 8 | <code>grok/grok-4.20-0309-non-reasoning</code> | 80.77/100 quality score | 80.77 | 19.23% | 10.76% | 4.18s | $0.0032 |
| 9 | <code>mistral/mistral-ocr-4-0</code> | 76.92/100 quality score | 76.92 | 23.08% | 2.20% | 2.66s | $0.0040 |
| 10 | <code>grok/grok-4.3</code> | 76.92/100 quality score | 76.92 | 23.08% | 35.08% | 13.93s | $0.0029 |
| 11 | <code>openai/gpt-5.5</code> | 69.23/100 quality score | 69.23 | 30.77% | 10.15% | 63.27s | $0.2089 |
| 12 | <code>kimi/kimi-k2.6</code> | 65.38/100 quality score | 65.38 | 34.62% | 8.18% | 31.84s | $0.0052 |
| 13 | <code>openai/gpt-5.4-mini</code> | 61.54/100 quality score | 61.54 | 38.46% | 54.92% | 4.28s | $0.0045 |
| 14 | <code>glm/glm-ocr</code> | 57.69/100 quality score | 57.69 | 42.31% | 40.68% | 22.97s | $0.0005 |
| 15 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 50.00/100 quality score | 50.00 | 50.00% | 3.41% | 29.37s | $0.0010 |
| 16 | <code>anthropic/claude-sonnet-5</code> | 46.15/100 quality score | 46.15 | 53.85% | 52.27% | 24.23s | $0.0182 |
| 17 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 42.31/100 quality score | 42.31 | 57.69% | 22.05% | 17.85s | $0.0006 |
| 18 | <code>openai/gpt-5.4-nano</code> | 30.77/100 quality score | 30.77 | 69.23% | 85.53% | 5.15s | $0.0010 |
| 19 | <code>anthropic/claude-haiku-4-5</code> | 26.92/100 quality score | 26.92 | 73.08% | 86.29% | 8.80s | $0.0062 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | Local | 0.00 | 1207.69% | 96.52% | 3.12s | $0.00 |
| <code>paddle-ocr</code> | Local | 26.92 | 73.08% | 80.08% | 13.82s | $0.00 |
| <code>tesseract</code> | Local | 0.00 | 1176.92% | 103.26% | 2.47s | $0.00 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 26.92 | 73.08% | 86.29% | 8.80s | $0.0062 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 100.00 | 0.00% | 1.29% | 24.75s | $0.0382 |
| <code>anthropic/claude-sonnet-4-6</code> | Third-Party Service | 96.15 | 3.85% | 13.11% | 29.37s | $0.0228 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 46.15 | 53.85% | 52.27% | 24.23s | $0.0182 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 50.00 | 50.00% | 3.41% | 29.37s | $0.0010 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 42.31 | 57.69% | 22.05% | 17.85s | $0.0006 |
| <code>gemini/gemini-3.1-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.98% | 3.64s | $0.0015 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | Third-Party Service | 100.00 | 0.00% | 1.06% | 3.74s | $0.0015 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 100.00 | 0.00% | 1.06% | 6.98s | $0.0118 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 22.74s | $0.0086 |
| <code>glm/glm-ocr</code> | Third-Party Service | 57.69 | 42.31% | 40.68% | 22.97s | $0.0005 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 80.77 | 19.23% | 10.76% | 4.18s | $0.0032 |
| <code>grok/grok-4.3</code> | Third-Party Service | 76.92 | 23.08% | 35.08% | 13.93s | $0.0029 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 65.38 | 34.62% | 8.18% | 31.84s | $0.0052 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 100.00 | 0.00% | 0.45% | 2.20s | $0.0020 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 76.92 | 23.08% | 2.20% | 2.66s | $0.0040 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 61.54 | 38.46% | 54.92% | 4.28s | $0.0045 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 30.77 | 69.23% | 85.53% | 5.15s | $0.0010 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 69.23 | 30.77% | 10.15% | 63.27s | $0.2089 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | 9 | 0 | 305 | 26 |
| <code>paddle-ocr</code> | 8 | 6 | 5 | 26 |
| <code>tesseract</code> | 7 | 0 | 299 | 26 |
| <code>anthropic/claude-haiku-4-5</code> | 8 | 11 | 0 | 26 |
| <code>anthropic/claude-opus-4-8</code> | 0 | 0 | 0 | 26 |
| <code>anthropic/claude-sonnet-4-6</code> | 1 | 0 | 0 | 26 |
| <code>anthropic/claude-sonnet-5</code> | 4 | 3 | 7 | 26 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 11 | 2 | 0 | 26 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 9 | 6 | 0 | 26 |
| <code>gemini/gemini-3.1-flash-lite</code> | 0 | 0 | 0 | 26 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | 0 | 0 | 0 | 26 |
| <code>gemini/gemini-3.1-pro-preview</code> | 0 | 0 | 0 | 26 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 26 |
| <code>glm/glm-ocr</code> | 3 | 7 | 1 | 26 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 4 | 1 | 0 | 26 |
| <code>grok/grok-4.3</code> | 5 | 0 | 1 | 26 |
| <code>kimi/kimi-k2.6</code> | 7 | 2 | 0 | 26 |
| <code>mistral/mistral-ocr-2512</code> | 0 | 0 | 0 | 26 |
| <code>mistral/mistral-ocr-4-0</code> | 2 | 4 | 0 | 26 |
| <code>openai/gpt-5.4-mini</code> | 1 | 9 | 0 | 26 |
| <code>openai/gpt-5.4-nano</code> | 0 | 18 | 0 | 26 |
| <code>openai/gpt-5.5</code> | 2 | 6 | 0 | 26 |

## Notes

- Best local model: `paddle-ocr/paddle-ocr` scored 26.92/100.
- Best cloud service: `gemini/gemini-3.5-flash` scored 100.00/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0531¢ ($0.0005).
- Fastest local model: `tesseract/tesseract` at 2.47s.
- Fastest cloud service: `mistral/mistral-ocr-2512` at 2.20s.
