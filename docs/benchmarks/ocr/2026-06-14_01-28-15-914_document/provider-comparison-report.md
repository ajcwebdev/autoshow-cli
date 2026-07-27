# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/2026-06-14_01-28-15-914_document`
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
| 1 | <code>ocrmypdf</code> | $0.00 local monetary cost | 100.00 | 0.00% | 0.00% | 0.71s | $0.00 |
| 2 | <code>paddle-ocr</code> | $0.00 local monetary cost | 100.00 | 0.00% | 0.00% | 8.67s | $0.00 |
| 3 | <code>tesseract</code> | $0.00 local monetary cost | 100.00 | 0.00% | 0.00% | 0.17s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.17s | 100.00 | 0.00% | 0.00% | 0.17s | $0.00 |
| 2 | <code>ocrmypdf</code> | 0.71s | 100.00 | 0.00% | 0.00% | 0.71s | $0.00 |
| 3 | <code>paddle-ocr</code> | 8.67s | 100.00 | 0.00% | 0.00% | 8.67s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>ocrmypdf</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.71s | $0.00 |
| 2 | <code>paddle-ocr</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 8.67s | $0.00 |
| 3 | <code>tesseract</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.17s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>glm/glm-ocr</code> | $0.0000 | 100.00 | 0.00% | 0.00% | 1.27s | $0.0000 |
| 2 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0002 | 80.00 | 20.00% | 20.22% | 0.88s | $0.0002 |
| 3 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0002 | 100.00 | 0.00% | 0.00% | 1.39s | $0.0002 |
| 4 | <code>openai/gpt-5.4-nano</code> | $0.0003 | 100.00 | 0.00% | 0.00% | 1.05s | $0.0003 |
| 5 | <code>gemini/gemini-3.1-flash-lite</code> | $0.0004 | 100.00 | 0.00% | 0.00% | 1.38s | $0.0004 |
| 6 | <code>gemini/gemini-3.1-flash-lite-preview</code> | $0.0004 | 100.00 | 0.00% | 0.00% | 1.25s | $0.0004 |
| 7 | <code>openai/gpt-5.4-mini</code> | $0.0010 | 100.00 | 0.00% | 0.00% | 1.32s | $0.0010 |
| 8 | <code>kimi/kimi-k2.6</code> | $0.0014 | 100.00 | 0.00% | 0.00% | 3.36s | $0.0014 |
| 9 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0015 | 100.00 | 0.00% | 0.00% | 0.55s | $0.0015 |
| 10 | <code>grok/grok-4.3</code> | $0.0015 | 100.00 | 0.00% | 0.00% | 3.83s | $0.0015 |
| 11 | <code>anthropic/claude-haiku-4-5</code> | $0.0018 | 100.00 | 0.00% | 0.00% | 1.09s | $0.0018 |
| 12 | <code>mistral/mistral-ocr-2512</code> | $0.0020 | 100.00 | 0.00% | 0.00% | 0.63s | $0.0020 |
| 13 | <code>gemini/gemini-3.5-flash</code> | $0.0022 | 100.00 | 0.00% | 0.00% | 5.34s | $0.0022 |
| 14 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0032 | 100.00 | 0.00% | 0.00% | 2.35s | $0.0032 |
| 15 | <code>anthropic/claude-sonnet-5</code> | $0.0038 | 100.00 | 0.00% | 0.00% | 2.04s | $0.0038 |
| 16 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 100.00 | 0.00% | 0.00% | 0.77s | $0.0040 |
| 17 | <code>anthropic/claude-sonnet-4-6</code> | $0.0052 | 100.00 | 0.00% | 0.00% | 4.12s | $0.0052 |
| 18 | <code>openai/gpt-5.5</code> | $0.0070 | 100.00 | 0.00% | 0.00% | 1.47s | $0.0070 |
| 19 | <code>anthropic/claude-opus-4-8</code> | $0.0095 | 100.00 | 0.00% | 0.00% | 2.38s | $0.0095 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>grok/grok-4.20-0309-non-reasoning</code> | 0.55s | 100.00 | 0.00% | 0.00% | 0.55s | $0.0015 |
| 2 | <code>mistral/mistral-ocr-2512</code> | 0.63s | 100.00 | 0.00% | 0.00% | 0.63s | $0.0020 |
| 3 | <code>mistral/mistral-ocr-4-0</code> | 0.77s | 100.00 | 0.00% | 0.00% | 0.77s | $0.0040 |
| 4 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 0.88s | 80.00 | 20.00% | 20.22% | 0.88s | $0.0002 |
| 5 | <code>openai/gpt-5.4-nano</code> | 1.05s | 100.00 | 0.00% | 0.00% | 1.05s | $0.0003 |
| 6 | <code>anthropic/claude-haiku-4-5</code> | 1.09s | 100.00 | 0.00% | 0.00% | 1.09s | $0.0018 |
| 7 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 1.25s | 100.00 | 0.00% | 0.00% | 1.25s | $0.0004 |
| 8 | <code>glm/glm-ocr</code> | 1.27s | 100.00 | 0.00% | 0.00% | 1.27s | $0.0000 |
| 9 | <code>openai/gpt-5.4-mini</code> | 1.32s | 100.00 | 0.00% | 0.00% | 1.32s | $0.0010 |
| 10 | <code>gemini/gemini-3.1-flash-lite</code> | 1.38s | 100.00 | 0.00% | 0.00% | 1.38s | $0.0004 |
| 11 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 1.39s | 100.00 | 0.00% | 0.00% | 1.39s | $0.0002 |
| 12 | <code>openai/gpt-5.5</code> | 1.47s | 100.00 | 0.00% | 0.00% | 1.47s | $0.0070 |
| 13 | <code>anthropic/claude-sonnet-5</code> | 2.04s | 100.00 | 0.00% | 0.00% | 2.04s | $0.0038 |
| 14 | <code>gemini/gemini-3.1-pro-preview</code> | 2.35s | 100.00 | 0.00% | 0.00% | 2.35s | $0.0032 |
| 15 | <code>anthropic/claude-opus-4-8</code> | 2.38s | 100.00 | 0.00% | 0.00% | 2.38s | $0.0095 |
| 16 | <code>kimi/kimi-k2.6</code> | 3.36s | 100.00 | 0.00% | 0.00% | 3.36s | $0.0014 |
| 17 | <code>grok/grok-4.3</code> | 3.83s | 100.00 | 0.00% | 0.00% | 3.83s | $0.0015 |
| 18 | <code>anthropic/claude-sonnet-4-6</code> | 4.12s | 100.00 | 0.00% | 0.00% | 4.12s | $0.0052 |
| 19 | <code>gemini/gemini-3.5-flash</code> | 5.34s | 100.00 | 0.00% | 0.00% | 5.34s | $0.0022 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-haiku-4-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.09s | $0.0018 |
| 2 | <code>anthropic/claude-opus-4-8</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.38s | $0.0095 |
| 3 | <code>anthropic/claude-sonnet-4-6</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.12s | $0.0052 |
| 4 | <code>anthropic/claude-sonnet-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.04s | $0.0038 |
| 5 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.39s | $0.0002 |
| 6 | <code>gemini/gemini-3.1-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.38s | $0.0004 |
| 7 | <code>gemini/gemini-3.1-flash-lite-preview</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.25s | $0.0004 |
| 8 | <code>gemini/gemini-3.1-pro-preview</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.35s | $0.0032 |
| 9 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.34s | $0.0022 |
| 10 | <code>glm/glm-ocr</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.27s | $0.0000 |
| 11 | <code>grok/grok-4.20-0309-non-reasoning</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.55s | $0.0015 |
| 12 | <code>grok/grok-4.3</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.83s | $0.0015 |
| 13 | <code>kimi/kimi-k2.6</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.36s | $0.0014 |
| 14 | <code>mistral/mistral-ocr-2512</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.63s | $0.0020 |
| 15 | <code>mistral/mistral-ocr-4-0</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.77s | $0.0040 |
| 16 | <code>openai/gpt-5.4-mini</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.32s | $0.0010 |
| 17 | <code>openai/gpt-5.4-nano</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.05s | $0.0003 |
| 18 | <code>openai/gpt-5.5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.47s | $0.0070 |
| 19 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 80.00/100 quality score | 80.00 | 20.00% | 20.22% | 0.88s | $0.0002 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | Local | 100.00 | 0.00% | 0.00% | 0.71s | $0.00 |
| <code>paddle-ocr</code> | Local | 100.00 | 0.00% | 0.00% | 8.67s | $0.00 |
| <code>tesseract</code> | Local | 100.00 | 0.00% | 0.00% | 0.17s | $0.00 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.09s | $0.0018 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.38s | $0.0095 |
| <code>anthropic/claude-sonnet-4-6</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.12s | $0.0052 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.04s | $0.0038 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.39s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 80.00 | 20.00% | 20.22% | 0.88s | $0.0002 |
| <code>gemini/gemini-3.1-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.38s | $0.0004 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.25s | $0.0004 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.35s | $0.0032 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.34s | $0.0022 |
| <code>glm/glm-ocr</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.27s | $0.0000 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 0.55s | $0.0015 |
| <code>grok/grok-4.3</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.83s | $0.0015 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.36s | $0.0014 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 0.63s | $0.0020 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 0.77s | $0.0040 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.32s | $0.0010 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.05s | $0.0003 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.47s | $0.0070 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>ocrmypdf</code> | 0 | 0 | 0 | 20 |
| <code>paddle-ocr</code> | 0 | 0 | 0 | 20 |
| <code>tesseract</code> | 0 | 0 | 0 | 20 |
| <code>anthropic/claude-haiku-4-5</code> | 0 | 0 | 0 | 20 |
| <code>anthropic/claude-opus-4-8</code> | 0 | 0 | 0 | 20 |
| <code>anthropic/claude-sonnet-4-6</code> | 0 | 0 | 0 | 20 |
| <code>anthropic/claude-sonnet-5</code> | 0 | 0 | 0 | 20 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 0 | 0 | 0 | 20 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 0 | 4 | 0 | 20 |
| <code>gemini/gemini-3.1-flash-lite</code> | 0 | 0 | 0 | 20 |
| <code>gemini/gemini-3.1-flash-lite-preview</code> | 0 | 0 | 0 | 20 |
| <code>gemini/gemini-3.1-pro-preview</code> | 0 | 0 | 0 | 20 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 20 |
| <code>glm/glm-ocr</code> | 0 | 0 | 0 | 20 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 0 | 0 | 0 | 20 |
| <code>grok/grok-4.3</code> | 0 | 0 | 0 | 20 |
| <code>kimi/kimi-k2.6</code> | 0 | 0 | 0 | 20 |
| <code>mistral/mistral-ocr-2512</code> | 0 | 0 | 0 | 20 |
| <code>mistral/mistral-ocr-4-0</code> | 0 | 0 | 0 | 20 |
| <code>openai/gpt-5.4-mini</code> | 0 | 0 | 0 | 20 |
| <code>openai/gpt-5.4-nano</code> | 0 | 0 | 0 | 20 |
| <code>openai/gpt-5.5</code> | 0 | 0 | 0 | 20 |

## Notes

- Best local model: `ocrmypdf/ocrmypdf` scored 100.00/100.
- Best cloud service: `anthropic/claude-haiku-4-5` scored 100.00/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0010¢ ($0.0000).
- Fastest local model: `tesseract/tesseract` at 0.17s.
- Fastest cloud service: `grok/grok-4.20-0309-non-reasoning` at 0.55s.
