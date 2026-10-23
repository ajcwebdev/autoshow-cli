# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-clean-typography/benchmark-runs/clean-typography-suitcase`
- Publisher canonical reference: `canonical-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `8187ac89ddb13f303d8a4793a12ca27fba4a1e5672c0aa66a2c01602c3099df1`.
- Publisher source: https://huggingface.co/datasets/opendatalab/OmniDocBench/resolve/aa1ee96d106dbe53d0ae59474d75c6e6d9b53fec/OmniDocBench.json (revision `aa1ee96d106dbe53d0ae59474d75c6e6d9b53fec`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 98.04 | 1.96% | 0.80% | 0.28s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.28s | 98.04 | 1.96% | 0.80% | 0.28s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 98.04/100 quality score | 98.04 | 1.96% | 0.80% | 0.28s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0001 | 100.00 | 0.00% | 0.00% | 6.25s | $0.0001 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0003 | 100.00 | 0.00% | 0.00% | 1.22s | $0.0003 |
| 3 | <code>openai/gpt-6-luna</code> | $0.0004 | 100.00 | 0.00% | 0.00% | 2.73s | $0.0004 |
| 4 | <code>anthropic/claude-haiku-5-5</code> | $0.0005 | 100.00 | 0.00% | 0.00% | 1.65s | $0.0005 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0006 | 100.00 | 0.00% | 0.00% | 1.76s | $0.0006 |
| 6 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0008 | 100.00 | 0.00% | 0.00% | 2.16s | $0.0008 |
| 7 | <code>gemini/gemini-3.8-flash</code> | $0.0023 | 100.00 | 0.00% | 0.00% | 45.97s | $0.0023 |
| 8 | <code>gemini/gemini-3.6-flash</code> | $0.0024 | 100.00 | 0.00% | 0.00% | 2.57s | $0.0024 |
| 9 | <code>gemini/gemini-3.5-flash</code> | $0.0026 | 100.00 | 0.00% | 0.00% | 3.72s | $0.0026 |
| 10 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 100.00 | 0.00% | 0.00% | 0.85s | $0.0040 |
| 11 | <code>grok/grok-4.5</code> | $0.0063 | 100.00 | 0.00% | 0.00% | 1.70s | $0.0063 |
| 12 | <code>gemini/gemini-4-argon</code> | $0.0078 | 100.00 | 0.00% | 0.00% | 4.03s | $0.0078 |
| 13 | <code>openai/gpt-6.1-sol</code> | $0.0083 | 100.00 | 0.00% | 0.00% | 3.10s | $0.0083 |
| 14 | <code>openai/gpt-5.6-terra</code> | $0.0084 | 100.00 | 0.00% | 0.00% | 1.71s | $0.0084 |
| 15 | <code>grok/grok-4.7</code> | $0.0093 | 100.00 | 0.00% | 0.00% | 3.66s | $0.0093 |
| 16 | <code>anthropic/claude-sonnet-5-5</code> | $0.0101 | 100.00 | 0.00% | 0.00% | 3.28s | $0.0101 |
| 17 | <code>anthropic/claude-opus-5-5</code> | $0.0204 | 100.00 | 0.00% | 0.00% | 2.85s | $0.0204 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0414 | 100.00 | 0.00% | 0.00% | 5.10s | $0.0414 |
| 19 | <code>anthropic/claude-fable-5</code> | $0.0501 | 100.00 | 0.00% | 0.00% | 4.43s | $0.0501 |
| 20 | <code>anthropic/claude-fable-5-1</code> | $0.0510 | 100.00 | 0.00% | 0.00% | 2.49s | $0.0510 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-1</code> | 0.85s | 100.00 | 0.00% | 0.00% | 0.85s | $0.0040 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 1.22s | 100.00 | 0.00% | 0.00% | 1.22s | $0.0003 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 1.65s | 100.00 | 0.00% | 0.00% | 1.65s | $0.0005 |
| 4 | <code>grok/grok-4.5</code> | 1.70s | 100.00 | 0.00% | 0.00% | 1.70s | $0.0063 |
| 5 | <code>openai/gpt-5.6-terra</code> | 1.71s | 100.00 | 0.00% | 0.00% | 1.71s | $0.0084 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | 1.76s | 100.00 | 0.00% | 0.00% | 1.76s | $0.0006 |
| 7 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 2.16s | 100.00 | 0.00% | 0.00% | 2.16s | $0.0008 |
| 8 | <code>anthropic/claude-fable-5-1</code> | 2.49s | 100.00 | 0.00% | 0.00% | 2.49s | $0.0510 |
| 9 | <code>gemini/gemini-3.6-flash</code> | 2.57s | 100.00 | 0.00% | 0.00% | 2.57s | $0.0024 |
| 10 | <code>openai/gpt-6-luna</code> | 2.73s | 100.00 | 0.00% | 0.00% | 2.73s | $0.0004 |
| 11 | <code>anthropic/claude-opus-5-5</code> | 2.85s | 100.00 | 0.00% | 0.00% | 2.85s | $0.0204 |
| 12 | <code>openai/gpt-6.1-sol</code> | 3.10s | 100.00 | 0.00% | 0.00% | 3.10s | $0.0083 |
| 13 | <code>anthropic/claude-sonnet-5-5</code> | 3.28s | 100.00 | 0.00% | 0.00% | 3.28s | $0.0101 |
| 14 | <code>grok/grok-4.7</code> | 3.66s | 100.00 | 0.00% | 0.00% | 3.66s | $0.0093 |
| 15 | <code>gemini/gemini-3.5-flash</code> | 3.72s | 100.00 | 0.00% | 0.00% | 3.72s | $0.0026 |
| 16 | <code>gemini/gemini-4-argon</code> | 4.03s | 100.00 | 0.00% | 0.00% | 4.03s | $0.0078 |
| 17 | <code>anthropic/claude-fable-5</code> | 4.43s | 100.00 | 0.00% | 0.00% | 4.43s | $0.0501 |
| 18 | <code>openai/gpt-6-astra</code> | 5.10s | 100.00 | 0.00% | 0.00% | 5.10s | $0.0414 |
| 19 | <code>deepinfra/google/gemma-4-31B-it</code> | 6.25s | 100.00 | 0.00% | 0.00% | 6.25s | $0.0001 |
| 20 | <code>gemini/gemini-3.8-flash</code> | 45.97s | 100.00 | 0.00% | 0.00% | 45.97s | $0.0023 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.43s | $0.0501 |
| 2 | <code>anthropic/claude-fable-5-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.49s | $0.0510 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.65s | $0.0005 |
| 4 | <code>anthropic/claude-opus-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.85s | $0.0204 |
| 5 | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.28s | $0.0101 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.22s | $0.0003 |
| 7 | <code>deepinfra/google/gemma-4-31B-it</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 6.25s | $0.0001 |
| 8 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.16s | $0.0008 |
| 9 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.72s | $0.0026 |
| 10 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.76s | $0.0006 |
| 11 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.57s | $0.0024 |
| 12 | <code>gemini/gemini-3.8-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 45.97s | $0.0023 |
| 13 | <code>gemini/gemini-4-argon</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.03s | $0.0078 |
| 14 | <code>grok/grok-4.5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.70s | $0.0063 |
| 15 | <code>grok/grok-4.7</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.66s | $0.0093 |
| 16 | <code>mistral/mistral-ocr-4-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.85s | $0.0040 |
| 17 | <code>openai/gpt-5.6-terra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.71s | $0.0084 |
| 18 | <code>openai/gpt-6-astra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.10s | $0.0414 |
| 19 | <code>openai/gpt-6-luna</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.73s | $0.0004 |
| 20 | <code>openai/gpt-6.1-sol</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.10s | $0.0083 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 98.04 | 1.96% | 0.80% | 0.28s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.43s | $0.0501 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.49s | $0.0510 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.65s | $0.0005 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.85s | $0.0204 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.28s | $0.0101 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.22s | $0.0003 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 6.25s | $0.0001 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.16s | $0.0008 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.72s | $0.0026 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.76s | $0.0006 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.57s | $0.0024 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 45.97s | $0.0023 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.03s | $0.0078 |
| <code>grok/grok-4.5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.70s | $0.0063 |
| <code>grok/grok-4.7</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.66s | $0.0093 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 0.85s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.71s | $0.0084 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.10s | $0.0414 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.73s | $0.0004 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.10s | $0.0083 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 0 | 1 | 0 | 51 |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 0 | 51 |
| <code>anthropic/claude-fable-5-1</code> | 0 | 0 | 0 | 51 |
| <code>anthropic/claude-haiku-5-5</code> | 0 | 0 | 0 | 51 |
| <code>anthropic/claude-opus-5-5</code> | 0 | 0 | 0 | 51 |
| <code>anthropic/claude-sonnet-5-5</code> | 0 | 0 | 0 | 51 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 0 | 0 | 0 | 51 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 0 | 0 | 0 | 51 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 0 | 0 | 0 | 51 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 51 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 51 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 51 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 0 | 0 | 51 |
| <code>gemini/gemini-4-argon</code> | 0 | 0 | 0 | 51 |
| <code>grok/grok-4.5</code> | 0 | 0 | 0 | 51 |
| <code>grok/grok-4.7</code> | 0 | 0 | 0 | 51 |
| <code>mistral/mistral-ocr-4-1</code> | 0 | 0 | 0 | 51 |
| <code>openai/gpt-5.6-terra</code> | 0 | 0 | 0 | 51 |
| <code>openai/gpt-6-astra</code> | 0 | 0 | 0 | 51 |
| <code>openai/gpt-6-luna</code> | 0 | 0 | 0 | 51 |
| <code>openai/gpt-6.1-sol</code> | 0 | 0 | 0 | 51 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 98.04/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0095¢ ($0.0001).
- Fastest local model: `tesseract/tesseract` at 0.28s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 0.85s.

## Cost accounting

- Reported usage is valued at reviewed rates; prices include settled retry costs and retained unresolved reservations once and are not invoice-reconciled charges.
- Any settled conservative amount or retained unresolved reservation makes the price a conservative upper bound; billing uncertainty remains visible in the separate breakdown.
