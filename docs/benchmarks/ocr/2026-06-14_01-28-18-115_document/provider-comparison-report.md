# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-06-14_01-28-18-115_document`
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
| 1 | <code>ocrmypdf</code> | $0.00 local monetary cost | 84.04 | 15.96% | 4.55% | 2.27s | $0.00 |
| 2 | <code>paddle-ocr</code> | $0.00 local monetary cost | 83.10 | 16.90% | 3.36% | 13.24s | $0.00 |
| 3 | <code>tesseract</code> | $0.00 local monetary cost | 84.04 | 15.96% | 5.09% | 0.85s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.85s | 84.04 | 15.96% | 5.09% | 0.85s | $0.00 |
| 2 | <code>ocrmypdf</code> | 2.27s | 84.04 | 15.96% | 4.55% | 2.27s | $0.00 |
| 3 | <code>paddle-ocr</code> | 13.24s | 83.10 | 16.90% | 3.36% | 13.24s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>ocrmypdf</code> | 84.04/100 quality score | 84.04 | 15.96% | 4.55% | 2.27s | $0.00 |
| 2 | <code>tesseract</code> | 84.04/100 quality score | 84.04 | 15.96% | 5.09% | 0.85s | $0.00 |
| 3 | <code>paddle-ocr</code> | 83.10/100 quality score | 83.10 | 16.90% | 3.36% | 13.24s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>glm/glm-ocr</code> | $0.0000 | 80.75 | 19.25% | 11.91% | 1.71s | $0.0000 |
| 2 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0004 | 93.43 | 6.57% | 0.91% | 9.66s | $0.0004 |
| 3 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0006 | 99.53 | 0.47% | 0.09% | 13.37s | $0.0006 |
| 4 | <code>openai/gpt-5.4-nano</code> | $0.0008 | 93.43 | 6.57% | 1.18% | 3.21s | $0.0008 |
| 5 | <code>gemini/gemini-3.1-flash-lite-preview</code> | $0.0008 | 90.14 | 9.86% | 1.36% | 2.09s | $0.0008 |
| 6 | <code>gemini/gemini-3.1-flash-lite</code> | $0.0009 | 95.77 | 4.23% | 0.73% | 2.42s | $0.0009 |
| 7 | <code>mistral/mistral-ocr-2512</code> | $0.0020 | 93.43 | 6.57% | 0.82% | 0.89s | $0.0020 |
| 8 | <code>openai/gpt-5.4-mini</code> | $0.0029 | 98.12 | 1.88% | 0.45% | 2.76s | $0.0029 |
| 9 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0029 | 99.06 | 0.94% | 0.27% | 2.04s | $0.0029 |
| 10 | <code>grok/grok-4.3</code> | $0.0029 | 100.00 | 0.00% | 0.00% | 10.38s | $0.0029 |
| 11 | <code>kimi/kimi-k2.6</code> | $0.0035 | 99.53 | 0.47% | 0.09% | 13.45s | $0.0035 |
| 12 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 92.96 | 7.04% | 0.91% | 1.43s | $0.0040 |
| 13 | <code>anthropic/claude-haiku-4-5</code> | $0.0042 | 99.06 | 0.94% | 0.18% | 7.54s | $0.0042 |
| 14 | <code>gemini/gemini-3.5-flash</code> | $0.0054 | 99.53 | 0.47% | 0.09% | 12.72s | $0.0054 |
| 15 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0071 | 95.31 | 4.69% | 1.00% | 4.94s | $0.0071 |
| 16 | <code>anthropic/claude-sonnet-5</code> | $0.0104 | 99.53 | 0.47% | 0.09% | 10.26s | $0.0104 |
| 17 | <code>anthropic/claude-sonnet-4-6</code> | $0.0124 | 99.53 | 0.47% | 0.18% | 13.73s | $0.0124 |
| 18 | <code>anthropic/claude-opus-4-8</code> | $0.0261 | 99.53 | 0.47% | 0.09% | 12.96s | $0.0261 |
| 19 | <code>openai/gpt-5.5</code> | $0.0348 | 100.00 | 0.00% | 0.00% | 11.37s | $0.0348 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-2512</code> | 0.89s | 93.43 | 6.57% | 0.82% | 0.89s | $0.0020 |
| 2 | <code>mistral/mistral-ocr-4-0</code> | 1.43s | 92.96 | 7.04% | 0.91% | 1.43s | $0.0040 |
| 3 | <code>glm/glm-ocr</code> | 1.71s | 80.75 | 19.25% | 11.91% | 1.71s | $0.0000 |
| 4 | <code>grok/grok-4.20-0309-non-reasoning</code> | 2.04s | 99.06 | 0.94% | 0.27% | 2.04s | $0.0029 |
| 5 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 2.09s | 90.14 | 9.86% | 1.36% | 2.09s | $0.0008 |
| 6 | <code>gemini/gemini-3.1-flash-lite</code> | 2.42s | 95.77 | 4.23% | 0.73% | 2.42s | $0.0009 |
| 7 | <code>openai/gpt-5.4-mini</code> | 2.76s | 98.12 | 1.88% | 0.45% | 2.76s | $0.0029 |
| 8 | <code>openai/gpt-5.4-nano</code> | 3.21s | 93.43 | 6.57% | 1.18% | 3.21s | $0.0008 |
| 9 | <code>gemini/gemini-3.1-pro-preview</code> | 4.94s | 95.31 | 4.69% | 1.00% | 4.94s | $0.0071 |
| 10 | <code>anthropic/claude-haiku-4-5</code> | 7.54s | 99.06 | 0.94% | 0.18% | 7.54s | $0.0042 |
| 11 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 9.66s | 93.43 | 6.57% | 0.91% | 9.66s | $0.0004 |
| 12 | <code>anthropic/claude-sonnet-5</code> | 10.26s | 99.53 | 0.47% | 0.09% | 10.26s | $0.0104 |
| 13 | <code>grok/grok-4.3</code> | 10.38s | 100.00 | 0.00% | 0.00% | 10.38s | $0.0029 |
| 14 | <code>openai/gpt-5.5</code> | 11.37s | 100.00 | 0.00% | 0.00% | 11.37s | $0.0348 |
| 15 | <code>gemini/gemini-3.5-flash</code> | 12.72s | 99.53 | 0.47% | 0.09% | 12.72s | $0.0054 |
| 16 | <code>anthropic/claude-opus-4-8</code> | 12.96s | 99.53 | 0.47% | 0.09% | 12.96s | $0.0261 |
| 17 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 13.37s | 99.53 | 0.47% | 0.09% | 13.37s | $0.0006 |
| 18 | <code>kimi/kimi-k2.6</code> | 13.45s | 99.53 | 0.47% | 0.09% | 13.45s | $0.0035 |
| 19 | <code>anthropic/claude-sonnet-4-6</code> | 13.73s | 99.53 | 0.47% | 0.18% | 13.73s | $0.0124 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>grok/grok-4.3</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 10.38s | $0.0029 |
| 2 | <code>openai/gpt-5.5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 11.37s | $0.0348 |
| 3 | <code>anthropic/claude-opus-4-8</code> | 99.53/100 quality score | 99.53 | 0.47% | 0.09% | 12.96s | $0.0261 |
| 4 | <code>anthropic/claude-sonnet-5</code> | 99.53/100 quality score | 99.53 | 0.47% | 0.09% | 10.26s | $0.0104 |
| 5 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 99.53/100 quality score | 99.53 | 0.47% | 0.09% | 13.37s | $0.0006 |
| 6 | <code>gemini/gemini-3.5-flash</code> | 99.53/100 quality score | 99.53 | 0.47% | 0.09% | 12.72s | $0.0054 |
| 7 | <code>kimi/kimi-k2.6</code> | 99.53/100 quality score | 99.53 | 0.47% | 0.09% | 13.45s | $0.0035 |
| 8 | <code>anthropic/claude-sonnet-4-6</code> | 99.53/100 quality score | 99.53 | 0.47% | 0.18% | 13.73s | $0.0124 |
| 9 | <code>anthropic/claude-haiku-4-5</code> | 99.06/100 quality score | 99.06 | 0.94% | 0.18% | 7.54s | $0.0042 |
| 10 | <code>grok/grok-4.20-0309-non-reasoning</code> | 99.06/100 quality score | 99.06 | 0.94% | 0.27% | 2.04s | $0.0029 |
| 11 | <code>openai/gpt-5.4-mini</code> | 98.12/100 quality score | 98.12 | 1.88% | 0.45% | 2.76s | $0.0029 |
| 12 | <code>gemini/gemini-3.1-flash-lite</code> | 95.77/100 quality score | 95.77 | 4.23% | 0.73% | 2.42s | $0.0009 |
| 13 | <code>gemini/gemini-3.1-pro-preview</code> | 95.31/100 quality score | 95.31 | 4.69% | 1.00% | 4.94s | $0.0071 |
| 14 | <code>mistral/mistral-ocr-2512</code> | 93.43/100 quality score | 93.43 | 6.57% | 0.82% | 0.89s | $0.0020 |
| 15 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 93.43/100 quality score | 93.43 | 6.57% | 0.91% | 9.66s | $0.0004 |
| 16 | <code>openai/gpt-5.4-nano</code> | 93.43/100 quality score | 93.43 | 6.57% | 1.18% | 3.21s | $0.0008 |
| 17 | <code>mistral/mistral-ocr-4-0</code> | 92.96/100 quality score | 92.96 | 7.04% | 0.91% | 1.43s | $0.0040 |
| 18 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 90.14/100 quality score | 90.14 | 9.86% | 1.36% | 2.09s | $0.0008 |
| 19 | <code>glm/glm-ocr</code> | 80.75/100 quality score | 80.75 | 19.25% | 11.91% | 1.71s | $0.0000 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | Local | 84.04 | 15.96% | 4.55% | 2.27s | $0.00 |
| <code>paddle-ocr</code> | Local | 83.10 | 16.90% | 3.36% | 13.24s | $0.00 |
| <code>tesseract</code> | Local | 84.04 | 15.96% | 5.09% | 0.85s | $0.00 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 99.06 | 0.94% | 0.18% | 7.54s | $0.0042 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 99.53 | 0.47% | 0.09% | 12.96s | $0.0261 |
| <code>anthropic/claude-sonnet-4-6</code> | Third-Party Service | 99.53 | 0.47% | 0.18% | 13.73s | $0.0124 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 99.53 | 0.47% | 0.09% | 10.26s | $0.0104 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 99.53 | 0.47% | 0.09% | 13.37s | $0.0006 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 93.43 | 6.57% | 0.91% | 9.66s | $0.0004 |
| <code>gemini/gemini-3.1-flash-lite</code> | Third-Party Service | 95.77 | 4.23% | 0.73% | 2.42s | $0.0009 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | Third-Party Service | 90.14 | 9.86% | 1.36% | 2.09s | $0.0008 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 95.31 | 4.69% | 1.00% | 4.94s | $0.0071 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 99.53 | 0.47% | 0.09% | 12.72s | $0.0054 |
| <code>glm/glm-ocr</code> | Third-Party Service | 80.75 | 19.25% | 11.91% | 1.71s | $0.0000 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 99.06 | 0.94% | 0.27% | 2.04s | $0.0029 |
| <code>grok/grok-4.3</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 10.38s | $0.0029 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 99.53 | 0.47% | 0.09% | 13.45s | $0.0035 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 93.43 | 6.57% | 0.82% | 0.89s | $0.0020 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 92.96 | 7.04% | 0.91% | 1.43s | $0.0040 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 98.12 | 1.88% | 0.45% | 2.76s | $0.0029 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 93.43 | 6.57% | 1.18% | 3.21s | $0.0008 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 11.37s | $0.0348 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | 24 | 6 | 4 | 213 |
| <code>paddle-ocr</code> | 22 | 10 | 4 | 213 |
| <code>tesseract</code> | 25 | 4 | 5 | 213 |
| <code>anthropic/claude-haiku-4-5</code> | 2 | 0 | 0 | 213 |
| <code>anthropic/claude-opus-4-8</code> | 1 | 0 | 0 | 213 |
| <code>anthropic/claude-sonnet-4-6</code> | 1 | 0 | 0 | 213 |
| <code>anthropic/claude-sonnet-5</code> | 1 | 0 | 0 | 213 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 1 | 0 | 0 | 213 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 8 | 6 | 0 | 213 |
| <code>gemini/gemini-3.1-flash-lite</code> | 2 | 0 | 7 | 213 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | 8 | 6 | 7 | 213 |
| <code>gemini/gemini-3.1-pro-preview</code> | 3 | 0 | 7 | 213 |
| <code>gemini/gemini-3.5-flash</code> | 1 | 0 | 0 | 213 |
| <code>glm/glm-ocr</code> | 7 | 34 | 0 | 213 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 2 | 0 | 0 | 213 |
| <code>grok/grok-4.3</code> | 0 | 0 | 0 | 213 |
| <code>kimi/kimi-k2.6</code> | 1 | 0 | 0 | 213 |
| <code>mistral/mistral-ocr-2512</code> | 8 | 6 | 0 | 213 |
| <code>mistral/mistral-ocr-4-0</code> | 9 | 6 | 0 | 213 |
| <code>openai/gpt-5.4-mini</code> | 4 | 0 | 0 | 213 |
| <code>openai/gpt-5.4-nano</code> | 11 | 0 | 3 | 213 |
| <code>openai/gpt-5.5</code> | 0 | 0 | 0 | 213 |

## Notes

- Best local model: `ocrmypdf/ocrmypdf` scored 84.04/100.
- Best cloud service: `grok/grok-4.3` scored 100.00/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0047¢ ($0.0000).
- Fastest local model: `tesseract/tesseract` at 0.85s.
- Fastest cloud service: `mistral/mistral-ocr-2512` at 0.89s.
