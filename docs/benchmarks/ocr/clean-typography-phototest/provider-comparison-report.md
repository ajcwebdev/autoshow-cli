# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-clean-typography/benchmark-runs/clean-typography-phototest`
- Publisher canonical reference: `canonical-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `76ef157baeb6ab275b7d90f310477a8060d5822aea2b2e05d480f459b016a6ed`.
- Publisher source: https://raw.githubusercontent.com/tesseract-ocr/test/232ff181c66516116ec0e84c4963f70de15050fd/testing/phototest.gold.txt (revision `232ff181c66516116ec0e84c4963f70de15050fd`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 100.00 | 0.00% | 0.00% | 0.30s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.30s | 100.00 | 0.00% | 0.00% | 0.30s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.30s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0001 | 100.00 | 0.00% | 0.00% | 3.35s | $0.0001 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0001 | 100.00 | 0.00% | 0.00% | 0.70s | $0.0001 |
| 3 | <code>openai/gpt-6-luna</code> | $0.0001 | 100.00 | 0.00% | 0.00% | 2.86s | $0.0001 |
| 4 | <code>anthropic/claude-haiku-5-5</code> | $0.0002 | 100.00 | 0.00% | 0.00% | 3.07s | $0.0002 |
| 5 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0003 | 100.00 | 0.00% | 0.00% | 1.83s | $0.0003 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0006 | 100.00 | 0.00% | 0.00% | 1.06s | $0.0006 |
| 7 | <code>openai/gpt-6.1-sol</code> | $0.0016 | 100.00 | 0.00% | 0.00% | 2.41s | $0.0016 |
| 8 | <code>openai/gpt-5.6-terra</code> | $0.0018 | 100.00 | 0.00% | 0.00% | 1.64s | $0.0018 |
| 9 | <code>gemini/gemini-3.6-flash</code> | $0.0024 | 100.00 | 0.00% | 0.00% | 1.32s | $0.0024 |
| 10 | <code>gemini/gemini-3.8-flash</code> | $0.0024 | 100.00 | 0.00% | 0.00% | 44.85s | $0.0024 |
| 11 | <code>gemini/gemini-3.5-flash</code> | $0.0025 | 100.00 | 0.00% | 0.00% | 2.84s | $0.0025 |
| 12 | <code>grok/grok-4.5</code> | $0.0031 | 100.00 | 0.00% | 0.00% | 3.72s | $0.0031 |
| 13 | <code>anthropic/claude-sonnet-5-5</code> | $0.0034 | 100.00 | 0.00% | 0.00% | 2.23s | $0.0034 |
| 14 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 100.00 | 0.00% | 0.00% | 0.57s | $0.0040 |
| 15 | <code>grok/grok-4.7</code> | $0.0068 | 100.00 | 0.00% | 0.00% | 6.29s | $0.0068 |
| 16 | <code>anthropic/claude-opus-5-5</code> | $0.0068 | 100.00 | 0.00% | 0.00% | 2.97s | $0.0068 |
| 17 | <code>gemini/gemini-4-argon</code> | $0.0076 | 100.00 | 0.00% | 0.00% | 38.26s | $0.0076 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0081 | 100.00 | 0.00% | 0.00% | 3.37s | $0.0081 |
| 19 | <code>anthropic/claude-fable-5</code> | $0.0169 | 100.00 | 0.00% | 0.00% | 4.91s | $0.0169 |
| 20 | <code>anthropic/claude-fable-5-1</code> | $0.0170 | 100.00 | 0.00% | 0.00% | 2.46s | $0.0170 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-1</code> | 0.57s | 100.00 | 0.00% | 0.00% | 0.57s | $0.0040 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 0.70s | 100.00 | 0.00% | 0.00% | 0.70s | $0.0001 |
| 3 | <code>gemini/gemini-3.5-flash-lite</code> | 1.06s | 100.00 | 0.00% | 0.00% | 1.06s | $0.0006 |
| 4 | <code>gemini/gemini-3.6-flash</code> | 1.32s | 100.00 | 0.00% | 0.00% | 1.32s | $0.0024 |
| 5 | <code>openai/gpt-5.6-terra</code> | 1.64s | 100.00 | 0.00% | 0.00% | 1.64s | $0.0018 |
| 6 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 1.83s | 100.00 | 0.00% | 0.00% | 1.83s | $0.0003 |
| 7 | <code>anthropic/claude-sonnet-5-5</code> | 2.23s | 100.00 | 0.00% | 0.00% | 2.23s | $0.0034 |
| 8 | <code>openai/gpt-6.1-sol</code> | 2.41s | 100.00 | 0.00% | 0.00% | 2.41s | $0.0016 |
| 9 | <code>anthropic/claude-fable-5-1</code> | 2.46s | 100.00 | 0.00% | 0.00% | 2.46s | $0.0170 |
| 10 | <code>gemini/gemini-3.5-flash</code> | 2.84s | 100.00 | 0.00% | 0.00% | 2.84s | $0.0025 |
| 11 | <code>openai/gpt-6-luna</code> | 2.86s | 100.00 | 0.00% | 0.00% | 2.86s | $0.0001 |
| 12 | <code>anthropic/claude-opus-5-5</code> | 2.97s | 100.00 | 0.00% | 0.00% | 2.97s | $0.0068 |
| 13 | <code>anthropic/claude-haiku-5-5</code> | 3.07s | 100.00 | 0.00% | 0.00% | 3.07s | $0.0002 |
| 14 | <code>deepinfra/google/gemma-4-31B-it</code> | 3.35s | 100.00 | 0.00% | 0.00% | 3.35s | $0.0001 |
| 15 | <code>openai/gpt-6-astra</code> | 3.37s | 100.00 | 0.00% | 0.00% | 3.37s | $0.0081 |
| 16 | <code>grok/grok-4.5</code> | 3.72s | 100.00 | 0.00% | 0.00% | 3.72s | $0.0031 |
| 17 | <code>anthropic/claude-fable-5</code> | 4.91s | 100.00 | 0.00% | 0.00% | 4.91s | $0.0169 |
| 18 | <code>grok/grok-4.7</code> | 6.29s | 100.00 | 0.00% | 0.00% | 6.29s | $0.0068 |
| 19 | <code>gemini/gemini-4-argon</code> | 38.26s | 100.00 | 0.00% | 0.00% | 38.26s | $0.0076 |
| 20 | <code>gemini/gemini-3.8-flash</code> | 44.85s | 100.00 | 0.00% | 0.00% | 44.85s | $0.0024 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.91s | $0.0169 |
| 2 | <code>anthropic/claude-fable-5-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.46s | $0.0170 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.07s | $0.0002 |
| 4 | <code>anthropic/claude-opus-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.97s | $0.0068 |
| 5 | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.23s | $0.0034 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.70s | $0.0001 |
| 7 | <code>deepinfra/google/gemma-4-31B-it</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.35s | $0.0001 |
| 8 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.83s | $0.0003 |
| 9 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.84s | $0.0025 |
| 10 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.06s | $0.0006 |
| 11 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.32s | $0.0024 |
| 12 | <code>gemini/gemini-3.8-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 44.85s | $0.0024 |
| 13 | <code>gemini/gemini-4-argon</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 38.26s | $0.0076 |
| 14 | <code>grok/grok-4.5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.72s | $0.0031 |
| 15 | <code>grok/grok-4.7</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 6.29s | $0.0068 |
| 16 | <code>mistral/mistral-ocr-4-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.57s | $0.0040 |
| 17 | <code>openai/gpt-5.6-terra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.64s | $0.0018 |
| 18 | <code>openai/gpt-6-astra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.37s | $0.0081 |
| 19 | <code>openai/gpt-6-luna</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.86s | $0.0001 |
| 20 | <code>openai/gpt-6.1-sol</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.41s | $0.0016 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 100.00 | 0.00% | 0.00% | 0.30s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.91s | $0.0169 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.46s | $0.0170 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.07s | $0.0002 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.97s | $0.0068 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.23s | $0.0034 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 0.70s | $0.0001 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.35s | $0.0001 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.83s | $0.0003 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.84s | $0.0025 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.06s | $0.0006 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.32s | $0.0024 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 44.85s | $0.0024 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 38.26s | $0.0076 |
| <code>grok/grok-4.5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.72s | $0.0031 |
| <code>grok/grok-4.7</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 6.29s | $0.0068 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 0.57s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.64s | $0.0018 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.37s | $0.0081 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.86s | $0.0001 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.41s | $0.0016 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 0 | 0 | 0 | 60 |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 0 | 60 |
| <code>anthropic/claude-fable-5-1</code> | 0 | 0 | 0 | 60 |
| <code>anthropic/claude-haiku-5-5</code> | 0 | 0 | 0 | 60 |
| <code>anthropic/claude-opus-5-5</code> | 0 | 0 | 0 | 60 |
| <code>anthropic/claude-sonnet-5-5</code> | 0 | 0 | 0 | 60 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 0 | 0 | 0 | 60 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 0 | 0 | 0 | 60 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 0 | 0 | 0 | 60 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 60 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 60 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 60 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 0 | 0 | 60 |
| <code>gemini/gemini-4-argon</code> | 0 | 0 | 0 | 60 |
| <code>grok/grok-4.5</code> | 0 | 0 | 0 | 60 |
| <code>grok/grok-4.7</code> | 0 | 0 | 0 | 60 |
| <code>mistral/mistral-ocr-4-1</code> | 0 | 0 | 0 | 60 |
| <code>openai/gpt-5.6-terra</code> | 0 | 0 | 0 | 60 |
| <code>openai/gpt-6-astra</code> | 0 | 0 | 0 | 60 |
| <code>openai/gpt-6-luna</code> | 0 | 0 | 0 | 60 |
| <code>openai/gpt-6.1-sol</code> | 0 | 0 | 0 | 60 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 100.00/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0098¢ ($0.0001).
- Fastest local model: `tesseract/tesseract` at 0.30s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 0.57s.

## Cost accounting

- Reported usage is valued at reviewed rates; prices include settled retry costs and retained unresolved reservations once and are not invoice-reconciled charges.
- Any settled conservative amount or retained unresolved reservation makes the price a conservative upper bound; billing uncertainty remains visible in the separate breakdown.
