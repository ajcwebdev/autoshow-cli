# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-06-14_01-22-40-317_document`
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
| 1 | <code>ocrmypdf</code> | $0.00 local monetary cost | 34.92 | 65.08% | 68.97% | 0.94s | $0.00 |
| 2 | <code>paddle-ocr</code> | $0.00 local monetary cost | 38.10 | 61.90% | 40.26% | 7.99s | $0.00 |
| 3 | <code>tesseract</code> | $0.00 local monetary cost | 28.57 | 71.43% | 67.18% | 0.22s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.22s | 28.57 | 71.43% | 67.18% | 0.22s | $0.00 |
| 2 | <code>ocrmypdf</code> | 0.94s | 34.92 | 65.08% | 68.97% | 0.94s | $0.00 |
| 3 | <code>paddle-ocr</code> | 7.99s | 38.10 | 61.90% | 40.26% | 7.99s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>paddle-ocr</code> | 38.10/100 quality score | 38.10 | 61.90% | 40.26% | 7.99s | $0.00 |
| 2 | <code>ocrmypdf</code> | 34.92/100 quality score | 34.92 | 65.08% | 68.97% | 0.94s | $0.00 |
| 3 | <code>tesseract</code> | 28.57/100 quality score | 28.57 | 71.43% | 67.18% | 0.22s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>glm/glm-ocr</code> | $0.0000 | 42.86 | 57.14% | 60.26% | 1.77s | $0.0000 |
| 2 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0002 | 87.30 | 12.70% | 7.69% | 3.98s | $0.0002 |
| 3 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0002 | 90.48 | 9.52% | 7.18% | 3.56s | $0.0002 |
| 4 | <code>openai/gpt-5.4-nano</code> | $0.0003 | 74.60 | 25.40% | 15.13% | 1.53s | $0.0003 |
| 5 | <code>gemini/gemini-3.1-flash-lite</code> | $0.0005 | 84.13 | 15.87% | 13.08% | 1.69s | $0.0005 |
| 6 | <code>gemini/gemini-3.1-flash-lite-preview</code> | $0.0005 | 98.41 | 1.59% | 0.26% | 1.67s | $0.0005 |
| 7 | <code>openai/gpt-5.4-mini</code> | $0.0011 | 93.65 | 6.35% | 3.85% | 1.67s | $0.0011 |
| 8 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0012 | 92.06 | 7.94% | 6.67% | 0.85s | $0.0012 |
| 9 | <code>grok/grok-4.3</code> | $0.0012 | 92.06 | 7.94% | 6.67% | 5.81s | $0.0012 |
| 10 | <code>kimi/kimi-k2.6</code> | $0.0013 | 92.06 | 7.94% | 4.87% | 6.23s | $0.0013 |
| 11 | <code>anthropic/claude-haiku-4-5</code> | $0.0019 | 92.06 | 7.94% | 6.92% | 3.10s | $0.0019 |
| 12 | <code>mistral/mistral-ocr-2512</code> | $0.0020 | 74.60 | 25.40% | 19.74% | 1.29s | $0.0020 |
| 13 | <code>gemini/gemini-3.5-flash</code> | $0.0033 | 92.06 | 7.94% | 4.87% | 7.93s | $0.0033 |
| 14 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 74.60 | 25.40% | 20.00% | 1.63s | $0.0040 |
| 15 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0044 | 98.41 | 1.59% | 0.26% | 3.16s | $0.0044 |
| 16 | <code>anthropic/claude-sonnet-5</code> | $0.0046 | 100.00 | 0.00% | 0.00% | 4.27s | $0.0046 |
| 17 | <code>anthropic/claude-sonnet-4-6</code> | $0.0060 | 96.83 | 3.17% | 2.56% | 7.44s | $0.0060 |
| 18 | <code>anthropic/claude-opus-4-8</code> | $0.0116 | 90.48 | 9.52% | 7.18% | 6.42s | $0.0116 |
| 19 | <code>openai/gpt-5.5</code> | $0.0224 | 98.41 | 1.59% | 2.05% | 9.57s | $0.0224 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>grok/grok-4.20-0309-non-reasoning</code> | 0.85s | 92.06 | 7.94% | 6.67% | 0.85s | $0.0012 |
| 2 | <code>mistral/mistral-ocr-2512</code> | 1.29s | 74.60 | 25.40% | 19.74% | 1.29s | $0.0020 |
| 3 | <code>openai/gpt-5.4-nano</code> | 1.53s | 74.60 | 25.40% | 15.13% | 1.53s | $0.0003 |
| 4 | <code>mistral/mistral-ocr-4-0</code> | 1.63s | 74.60 | 25.40% | 20.00% | 1.63s | $0.0040 |
| 5 | <code>openai/gpt-5.4-mini</code> | 1.67s | 93.65 | 6.35% | 3.85% | 1.67s | $0.0011 |
| 6 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 1.67s | 98.41 | 1.59% | 0.26% | 1.67s | $0.0005 |
| 7 | <code>gemini/gemini-3.1-flash-lite</code> | 1.69s | 84.13 | 15.87% | 13.08% | 1.69s | $0.0005 |
| 8 | <code>glm/glm-ocr</code> | 1.77s | 42.86 | 57.14% | 60.26% | 1.77s | $0.0000 |
| 9 | <code>anthropic/claude-haiku-4-5</code> | 3.10s | 92.06 | 7.94% | 6.92% | 3.10s | $0.0019 |
| 10 | <code>gemini/gemini-3.1-pro-preview</code> | 3.16s | 98.41 | 1.59% | 0.26% | 3.16s | $0.0044 |
| 11 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 3.56s | 90.48 | 9.52% | 7.18% | 3.56s | $0.0002 |
| 12 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 3.98s | 87.30 | 12.70% | 7.69% | 3.98s | $0.0002 |
| 13 | <code>anthropic/claude-sonnet-5</code> | 4.27s | 100.00 | 0.00% | 0.00% | 4.27s | $0.0046 |
| 14 | <code>grok/grok-4.3</code> | 5.81s | 92.06 | 7.94% | 6.67% | 5.81s | $0.0012 |
| 15 | <code>kimi/kimi-k2.6</code> | 6.23s | 92.06 | 7.94% | 4.87% | 6.23s | $0.0013 |
| 16 | <code>anthropic/claude-opus-4-8</code> | 6.42s | 90.48 | 9.52% | 7.18% | 6.42s | $0.0116 |
| 17 | <code>anthropic/claude-sonnet-4-6</code> | 7.44s | 96.83 | 3.17% | 2.56% | 7.44s | $0.0060 |
| 18 | <code>gemini/gemini-3.5-flash</code> | 7.93s | 92.06 | 7.94% | 4.87% | 7.93s | $0.0033 |
| 19 | <code>openai/gpt-5.5</code> | 9.57s | 98.41 | 1.59% | 2.05% | 9.57s | $0.0224 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-sonnet-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.27s | $0.0046 |
| 2 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 98.41/100 quality score | 98.41 | 1.59% | 0.26% | 1.67s | $0.0005 |
| 3 | <code>gemini/gemini-3.1-pro-preview</code> | 98.41/100 quality score | 98.41 | 1.59% | 0.26% | 3.16s | $0.0044 |
| 4 | <code>openai/gpt-5.5</code> | 98.41/100 quality score | 98.41 | 1.59% | 2.05% | 9.57s | $0.0224 |
| 5 | <code>anthropic/claude-sonnet-4-6</code> | 96.83/100 quality score | 96.83 | 3.17% | 2.56% | 7.44s | $0.0060 |
| 6 | <code>openai/gpt-5.4-mini</code> | 93.65/100 quality score | 93.65 | 6.35% | 3.85% | 1.67s | $0.0011 |
| 7 | <code>gemini/gemini-3.5-flash</code> | 92.06/100 quality score | 92.06 | 7.94% | 4.87% | 7.93s | $0.0033 |
| 8 | <code>kimi/kimi-k2.6</code> | 92.06/100 quality score | 92.06 | 7.94% | 4.87% | 6.23s | $0.0013 |
| 9 | <code>grok/grok-4.20-0309-non-reasoning</code> | 92.06/100 quality score | 92.06 | 7.94% | 6.67% | 0.85s | $0.0012 |
| 10 | <code>grok/grok-4.3</code> | 92.06/100 quality score | 92.06 | 7.94% | 6.67% | 5.81s | $0.0012 |
| 11 | <code>anthropic/claude-haiku-4-5</code> | 92.06/100 quality score | 92.06 | 7.94% | 6.92% | 3.10s | $0.0019 |
| 12 | <code>anthropic/claude-opus-4-8</code> | 90.48/100 quality score | 90.48 | 9.52% | 7.18% | 6.42s | $0.0116 |
| 13 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 90.48/100 quality score | 90.48 | 9.52% | 7.18% | 3.56s | $0.0002 |
| 14 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 87.30/100 quality score | 87.30 | 12.70% | 7.69% | 3.98s | $0.0002 |
| 15 | <code>gemini/gemini-3.1-flash-lite</code> | 84.13/100 quality score | 84.13 | 15.87% | 13.08% | 1.69s | $0.0005 |
| 16 | <code>openai/gpt-5.4-nano</code> | 74.60/100 quality score | 74.60 | 25.40% | 15.13% | 1.53s | $0.0003 |
| 17 | <code>mistral/mistral-ocr-2512</code> | 74.60/100 quality score | 74.60 | 25.40% | 19.74% | 1.29s | $0.0020 |
| 18 | <code>mistral/mistral-ocr-4-0</code> | 74.60/100 quality score | 74.60 | 25.40% | 20.00% | 1.63s | $0.0040 |
| 19 | <code>glm/glm-ocr</code> | 42.86/100 quality score | 42.86 | 57.14% | 60.26% | 1.77s | $0.0000 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | Local | 34.92 | 65.08% | 68.97% | 0.94s | $0.00 |
| <code>paddle-ocr</code> | Local | 38.10 | 61.90% | 40.26% | 7.99s | $0.00 |
| <code>tesseract</code> | Local | 28.57 | 71.43% | 67.18% | 0.22s | $0.00 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 92.06 | 7.94% | 6.92% | 3.10s | $0.0019 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 90.48 | 9.52% | 7.18% | 6.42s | $0.0116 |
| <code>anthropic/claude-sonnet-4-6</code> | Third-Party Service | 96.83 | 3.17% | 2.56% | 7.44s | $0.0060 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.27s | $0.0046 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 90.48 | 9.52% | 7.18% | 3.56s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 87.30 | 12.70% | 7.69% | 3.98s | $0.0002 |
| <code>gemini/gemini-3.1-flash-lite</code> | Third-Party Service | 84.13 | 15.87% | 13.08% | 1.69s | $0.0005 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | Third-Party Service | 98.41 | 1.59% | 0.26% | 1.67s | $0.0005 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 98.41 | 1.59% | 0.26% | 3.16s | $0.0044 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 92.06 | 7.94% | 4.87% | 7.93s | $0.0033 |
| <code>glm/glm-ocr</code> | Third-Party Service | 42.86 | 57.14% | 60.26% | 1.77s | $0.0000 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 92.06 | 7.94% | 6.67% | 0.85s | $0.0012 |
| <code>grok/grok-4.3</code> | Third-Party Service | 92.06 | 7.94% | 6.67% | 5.81s | $0.0012 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 92.06 | 7.94% | 4.87% | 6.23s | $0.0013 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 74.60 | 25.40% | 19.74% | 1.29s | $0.0020 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 74.60 | 25.40% | 20.00% | 1.63s | $0.0040 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 93.65 | 6.35% | 3.85% | 1.67s | $0.0011 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 74.60 | 25.40% | 15.13% | 1.53s | $0.0003 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 98.41 | 1.59% | 2.05% | 9.57s | $0.0224 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | 3 | 38 | 0 | 63 |
| <code>paddle-ocr</code> | 17 | 16 | 6 | 63 |
| <code>tesseract</code> | 9 | 36 | 0 | 63 |
| <code>anthropic/claude-haiku-4-5</code> | 1 | 3 | 1 | 63 |
| <code>anthropic/claude-opus-4-8</code> | 0 | 3 | 3 | 63 |
| <code>anthropic/claude-sonnet-4-6</code> | 0 | 1 | 1 | 63 |
| <code>anthropic/claude-sonnet-5</code> | 0 | 0 | 0 | 63 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 0 | 3 | 3 | 63 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 1 | 3 | 4 | 63 |
| <code>gemini/gemini-3.1-flash-lite</code> | 0 | 7 | 3 | 63 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | 1 | 0 | 0 | 63 |
| <code>gemini/gemini-3.1-pro-preview</code> | 1 | 0 | 0 | 63 |
| <code>gemini/gemini-3.5-flash</code> | 1 | 2 | 2 | 63 |
| <code>glm/glm-ocr</code> | 0 | 34 | 2 | 63 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 0 | 3 | 2 | 63 |
| <code>grok/grok-4.3</code> | 0 | 3 | 2 | 63 |
| <code>kimi/kimi-k2.6</code> | 1 | 2 | 2 | 63 |
| <code>mistral/mistral-ocr-2512</code> | 6 | 5 | 5 | 63 |
| <code>mistral/mistral-ocr-4-0</code> | 8 | 4 | 4 | 63 |
| <code>openai/gpt-5.4-mini</code> | 3 | 1 | 0 | 63 |
| <code>openai/gpt-5.4-nano</code> | 14 | 2 | 0 | 63 |
| <code>openai/gpt-5.5</code> | 0 | 1 | 0 | 63 |

## Notes

- Best local model: `paddle-ocr/paddle-ocr` scored 38.10/100.
- Best cloud service: `anthropic/claude-sonnet-5` scored 100.00/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0008¢ ($0.0000).
- Fastest local model: `tesseract/tesseract` at 0.22s.
- Fastest cloud service: `grok/grok-4.20-0309-non-reasoning` at 0.85s.
