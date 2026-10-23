# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/bc-rerun-04-pages-don-quixote`
- Total providers: 21 (1 local, 20 third-party service)
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

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 96.41 | 3.59% | 1.80% | 4.65s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 4.65s | 96.41 | 3.59% | 1.80% | 4.65s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 96.41/100 quality score | 96.41 | 3.59% | 1.80% | 4.65s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0010 | 98.88 | 1.12% | 0.33% | 69.70s | $0.0010 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0019 | 99.25 | 0.75% | 0.25% | 24.30s | $0.0019 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0033 | 99.40 | 0.60% | 0.64% | 11.51s | $0.0033 |
| 4 | <code>openai/gpt-6-luna</code> | $0.0038 | 98.80 | 1.20% | 0.31% | 45.65s | $0.0038 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0064 | 98.43 | 1.57% | 0.24% | 10.99s | $0.0064 |
| 6 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0093 | 99.03 | 0.97% | 0.28% | 45.99s | $0.0093 |
| 7 | <code>mistral/mistral-ocr-4-1</code> | $0.0160 | 99.85 | 0.15% | 0.19% | 16.82s | $0.0160 |
| 8 | <code>gemini/gemini-3.6-flash</code> | $0.0209 | 98.80 | 1.20% | 0.30% | 18.71s | $0.0209 |
| 9 | <code>gemini/gemini-3.8-flash</code> | $0.0218 | 98.28 | 1.72% | 0.19% | 24.70s | $0.0218 |
| 10 | <code>gemini/gemini-3.5-flash</code> | $0.0237 | 98.80 | 1.20% | 0.30% | 16.05s | $0.0237 |
| 11 | <code>grok/grok-4.5</code> | $0.0405 | 97.76 | 2.24% | 0.89% | 40.23s | $0.0405 |
| 12 | <code>openai/gpt-6.1-sol</code> | $0.0490 | 98.35 | 1.65% | 0.34% | 40.43s | $0.0490 |
| 13 | <code>openai/gpt-5.6-terra</code> | $0.0548 | 98.20 | 1.80% | 0.34% | 19.23s | $0.0548 |
| 14 | <code>gemini/gemini-4-argon</code> | $0.0593 | 98.88 | 1.12% | 0.12% | 58.17s | $0.0593 |
| 15 | <code>anthropic/claude-sonnet-5-5</code> | $0.0679 | 98.43 | 1.57% | 0.33% | 22.47s | $0.0679 |
| 16 | <code>grok/grok-4.7</code> | $0.0836 | 99.70 | 0.30% | 0.38% | 92.73s | $0.0836 |
| 17 | <code>anthropic/claude-opus-5-5</code> | $0.1321 | 99.78 | 0.22% | 0.18% | 24.12s | $0.1321 |
| 18 | <code>openai/gpt-6-astra</code> | $0.2445 | 98.43 | 1.57% | 0.22% | 30.75s | $0.2445 |
| 19 | <code>anthropic/claude-fable-5-1</code> | $0.3410 | 99.25 | 0.75% | 0.25% | 35.25s | $0.3410 |
| 20 | <code>anthropic/claude-fable-5</code> | $0.3453 | 98.35 | 1.65% | 0.34% | 47.45s | $0.3453 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 10.99s | 98.43 | 1.57% | 0.24% | 10.99s | $0.0064 |
| 2 | <code>anthropic/claude-haiku-5-5</code> | 11.51s | 99.40 | 0.60% | 0.64% | 11.51s | $0.0033 |
| 3 | <code>gemini/gemini-3.5-flash</code> | 16.05s | 98.80 | 1.20% | 0.30% | 16.05s | $0.0237 |
| 4 | <code>mistral/mistral-ocr-4-1</code> | 16.82s | 99.85 | 0.15% | 0.19% | 16.82s | $0.0160 |
| 5 | <code>gemini/gemini-3.6-flash</code> | 18.71s | 98.80 | 1.20% | 0.30% | 18.71s | $0.0209 |
| 6 | <code>openai/gpt-5.6-terra</code> | 19.23s | 98.20 | 1.80% | 0.34% | 19.23s | $0.0548 |
| 7 | <code>anthropic/claude-sonnet-5-5</code> | 22.47s | 98.43 | 1.57% | 0.33% | 22.47s | $0.0679 |
| 8 | <code>anthropic/claude-opus-5-5</code> | 24.12s | 99.78 | 0.22% | 0.18% | 24.12s | $0.1321 |
| 9 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 24.30s | 99.25 | 0.75% | 0.25% | 24.30s | $0.0019 |
| 10 | <code>gemini/gemini-3.8-flash</code> | 24.70s | 98.28 | 1.72% | 0.19% | 24.70s | $0.0218 |
| 11 | <code>openai/gpt-6-astra</code> | 30.75s | 98.43 | 1.57% | 0.22% | 30.75s | $0.2445 |
| 12 | <code>anthropic/claude-fable-5-1</code> | 35.25s | 99.25 | 0.75% | 0.25% | 35.25s | $0.3410 |
| 13 | <code>grok/grok-4.5</code> | 40.23s | 97.76 | 2.24% | 0.89% | 40.23s | $0.0405 |
| 14 | <code>openai/gpt-6.1-sol</code> | 40.43s | 98.35 | 1.65% | 0.34% | 40.43s | $0.0490 |
| 15 | <code>openai/gpt-6-luna</code> | 45.65s | 98.80 | 1.20% | 0.31% | 45.65s | $0.0038 |
| 16 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 45.99s | 99.03 | 0.97% | 0.28% | 45.99s | $0.0093 |
| 17 | <code>anthropic/claude-fable-5</code> | 47.45s | 98.35 | 1.65% | 0.34% | 47.45s | $0.3453 |
| 18 | <code>gemini/gemini-4-argon</code> | 58.17s | 98.88 | 1.12% | 0.12% | 58.17s | $0.0593 |
| 19 | <code>deepinfra/google/gemma-4-31B-it</code> | 69.70s | 98.88 | 1.12% | 0.33% | 69.70s | $0.0010 |
| 20 | <code>grok/grok-4.7</code> | 92.73s | 99.70 | 0.30% | 0.38% | 92.73s | $0.0836 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-1</code> | 99.85/100 quality score | 99.85 | 0.15% | 0.19% | 16.82s | $0.0160 |
| 2 | <code>anthropic/claude-opus-5-5</code> | 99.78/100 quality score | 99.78 | 0.22% | 0.18% | 24.12s | $0.1321 |
| 3 | <code>grok/grok-4.7</code> | 99.70/100 quality score | 99.70 | 0.30% | 0.38% | 92.73s | $0.0836 |
| 4 | <code>anthropic/claude-haiku-5-5</code> | 99.40/100 quality score | 99.40 | 0.60% | 0.64% | 11.51s | $0.0033 |
| 5 | <code>anthropic/claude-fable-5-1</code> | 99.25/100 quality score | 99.25 | 0.75% | 0.25% | 35.25s | $0.3410 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 99.25/100 quality score | 99.25 | 0.75% | 0.25% | 24.30s | $0.0019 |
| 7 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 99.03/100 quality score | 99.03 | 0.97% | 0.28% | 45.99s | $0.0093 |
| 8 | <code>gemini/gemini-4-argon</code> | 98.88/100 quality score | 98.88 | 1.12% | 0.12% | 58.17s | $0.0593 |
| 9 | <code>deepinfra/google/gemma-4-31B-it</code> | 98.88/100 quality score | 98.88 | 1.12% | 0.33% | 69.70s | $0.0010 |
| 10 | <code>gemini/gemini-3.5-flash</code> | 98.80/100 quality score | 98.80 | 1.20% | 0.30% | 16.05s | $0.0237 |
| 11 | <code>gemini/gemini-3.6-flash</code> | 98.80/100 quality score | 98.80 | 1.20% | 0.30% | 18.71s | $0.0209 |
| 12 | <code>openai/gpt-6-luna</code> | 98.80/100 quality score | 98.80 | 1.20% | 0.31% | 45.65s | $0.0038 |
| 13 | <code>openai/gpt-6-astra</code> | 98.43/100 quality score | 98.43 | 1.57% | 0.22% | 30.75s | $0.2445 |
| 14 | <code>gemini/gemini-3.5-flash-lite</code> | 98.43/100 quality score | 98.43 | 1.57% | 0.24% | 10.99s | $0.0064 |
| 15 | <code>anthropic/claude-sonnet-5-5</code> | 98.43/100 quality score | 98.43 | 1.57% | 0.33% | 22.47s | $0.0679 |
| 16 | <code>anthropic/claude-fable-5</code> | 98.35/100 quality score | 98.35 | 1.65% | 0.34% | 47.45s | $0.3453 |
| 17 | <code>openai/gpt-6.1-sol</code> | 98.35/100 quality score | 98.35 | 1.65% | 0.34% | 40.43s | $0.0490 |
| 18 | <code>gemini/gemini-3.8-flash</code> | 98.28/100 quality score | 98.28 | 1.72% | 0.19% | 24.70s | $0.0218 |
| 19 | <code>openai/gpt-5.6-terra</code> | 98.20/100 quality score | 98.20 | 1.80% | 0.34% | 19.23s | $0.0548 |
| 20 | <code>grok/grok-4.5</code> | 97.76/100 quality score | 97.76 | 2.24% | 0.89% | 40.23s | $0.0405 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 96.41 | 3.59% | 1.80% | 4.65s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 98.35 | 1.65% | 0.34% | 47.45s | $0.3453 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 99.25 | 0.75% | 0.25% | 35.25s | $0.3410 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 99.40 | 0.60% | 0.64% | 11.51s | $0.0033 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 99.78 | 0.22% | 0.18% | 24.12s | $0.1321 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 98.43 | 1.57% | 0.33% | 22.47s | $0.0679 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 99.25 | 0.75% | 0.25% | 24.30s | $0.0019 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 98.88 | 1.12% | 0.33% | 69.70s | $0.0010 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 99.03 | 0.97% | 0.28% | 45.99s | $0.0093 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 98.80 | 1.20% | 0.30% | 16.05s | $0.0237 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 98.43 | 1.57% | 0.24% | 10.99s | $0.0064 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 98.80 | 1.20% | 0.30% | 18.71s | $0.0209 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 98.28 | 1.72% | 0.19% | 24.70s | $0.0218 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 98.88 | 1.12% | 0.12% | 58.17s | $0.0593 |
| <code>grok/grok-4.5</code> | Third-Party Service | 97.76 | 2.24% | 0.89% | 40.23s | $0.0405 |
| <code>grok/grok-4.7</code> | Third-Party Service | 99.70 | 0.30% | 0.38% | 92.73s | $0.0836 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 99.85 | 0.15% | 0.19% | 16.82s | $0.0160 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 98.20 | 1.80% | 0.34% | 19.23s | $0.0548 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 98.43 | 1.57% | 0.22% | 30.75s | $0.2445 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 98.80 | 1.20% | 0.31% | 45.65s | $0.0038 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 98.35 | 1.65% | 0.34% | 40.43s | $0.0490 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 17 | 13 | 18 | 1337 |
| <code>anthropic/claude-fable-5</code> | 10 | 2 | 10 | 1337 |
| <code>anthropic/claude-fable-5-1</code> | 4 | 2 | 4 | 1337 |
| <code>anthropic/claude-haiku-5-5</code> | 0 | 8 | 0 | 1337 |
| <code>anthropic/claude-opus-5-5</code> | 2 | 1 | 0 | 1337 |
| <code>anthropic/claude-sonnet-5-5</code> | 11 | 1 | 9 | 1337 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 4 | 2 | 4 | 1337 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 8 | 2 | 5 | 1337 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 6 | 2 | 5 | 1337 |
| <code>gemini/gemini-3.5-flash</code> | 7 | 2 | 7 | 1337 |
| <code>gemini/gemini-3.5-flash-lite</code> | 11 | 0 | 10 | 1337 |
| <code>gemini/gemini-3.6-flash</code> | 7 | 2 | 7 | 1337 |
| <code>gemini/gemini-3.8-flash</code> | 12 | 0 | 11 | 1337 |
| <code>gemini/gemini-4-argon</code> | 8 | 0 | 7 | 1337 |
| <code>grok/grok-4.5</code> | 10 | 10 | 10 | 1337 |
| <code>grok/grok-4.7</code> | 0 | 4 | 0 | 1337 |
| <code>mistral/mistral-ocr-4-1</code> | 0 | 2 | 0 | 1337 |
| <code>openai/gpt-5.6-terra</code> | 13 | 1 | 10 | 1337 |
| <code>openai/gpt-6-astra</code> | 10 | 1 | 10 | 1337 |
| <code>openai/gpt-6-luna</code> | 8 | 2 | 6 | 1337 |
| <code>openai/gpt-6.1-sol</code> | 10 | 2 | 10 | 1337 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 96.41/100.
- Best cloud service: `mistral/mistral-ocr-4-1` scored 99.85/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0964¢ ($0.0010).
- Fastest local model: `tesseract/tesseract` at 4.65s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 10.99s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: the existing archived multi-provider consensus is reused byte for byte; it is not independent publisher gold.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
