# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/efg-rerun-1-page-newspaper`
- Total providers: 20 (1 local, 19 third-party service)
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
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 6.99 | 93.01% | 91.91% | 5.30s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 5.30s | 6.99 | 93.01% | 91.91% | 5.30s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 6.99/100 quality score | 6.99 | 93.01% | 91.91% | 5.30s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-haiku-5-5</code> | $0.0025 | 73.99 | 26.01% | 25.91% | 19.09s | $0.0025 |
| 2 | <code>openai/gpt-6-luna</code> | $0.0035 | 58.24 | 41.76% | 47.75% | 58.22s | $0.0035 |
| 3 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0038 | 0.00 | 134.01% | 137.51% | 57.48s | $0.0038 |
| 4 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 79.71 | 20.29% | 10.91% | 23.08s | $0.0040 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0093 | 89.33 | 10.67% | 3.41% | 13.61s | $0.0093 |
| 6 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0094 | 89.37 | 10.63% | 6.65% | 193.39s | $0.0094 |
| 7 | <code>gemini/gemini-3.5-flash</code> | $0.0291 | 98.48 | 1.52% | 0.50% | 20.22s | $0.0291 |
| 8 | <code>gemini/gemini-3.6-flash</code> | $0.0291 | 94.75 | 5.25% | 0.91% | 18.49s | $0.0291 |
| 9 | <code>gemini/gemini-3.8-flash</code> | $0.0292 | 94.92 | 5.08% | 0.86% | 29.22s | $0.0292 |
| 10 | <code>openai/gpt-6.1-sol</code> | $0.0407 | 94.20 | 5.80% | 1.20% | 80.25s | $0.0407 |
| 11 | <code>grok/grok-4.5</code> | $0.0508 | 94.37 | 5.63% | 1.06% | 88.71s | $0.0508 |
| 12 | <code>openai/gpt-5.6-terra</code> | $0.0541 | 69.08 | 30.92% | 29.72% | 56.31s | $0.0541 |
| 13 | <code>anthropic/claude-sonnet-5-5</code> | $0.0562 | 99.24 | 0.76% | 0.18% | 29.12s | $0.0562 |
| 14 | <code>gemini/gemini-4-argon</code> | $0.0662 | 98.86 | 1.14% | 0.23% | 34.13s | $0.0662 |
| 15 | <code>anthropic/claude-opus-5-5</code> | $0.1123 | 99.20 | 0.80% | 0.16% | 36.95s | $0.1123 |
| 16 | <code>openai/gpt-6-astra</code> | $0.2020 | 94.62 | 5.38% | 0.89% | 69.86s | $0.2020 |
| 17 | <code>anthropic/claude-fable-5</code> | $0.2841 | 99.20 | 0.80% | 0.21% | 65.05s | $0.2841 |
| 18 | <code>anthropic/claude-fable-5-1</code> | $0.5040 | 99.45 | 0.55% | 0.11% | 80.82s | $0.5040 |
| 19 | <code>grok/grok-4.7</code> | $1.0476 | 98.69 | 1.31% | 0.44% | 365.86s | $1.0476 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 13.61s | 89.33 | 10.67% | 3.41% | 13.61s | $0.0093 |
| 2 | <code>gemini/gemini-3.6-flash</code> | 18.49s | 94.75 | 5.25% | 0.91% | 18.49s | $0.0291 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 19.09s | 73.99 | 26.01% | 25.91% | 19.09s | $0.0025 |
| 4 | <code>gemini/gemini-3.5-flash</code> | 20.22s | 98.48 | 1.52% | 0.50% | 20.22s | $0.0291 |
| 5 | <code>mistral/mistral-ocr-4-1</code> | 23.08s | 79.71 | 20.29% | 10.91% | 23.08s | $0.0040 |
| 6 | <code>anthropic/claude-sonnet-5-5</code> | 29.12s | 99.24 | 0.76% | 0.18% | 29.12s | $0.0562 |
| 7 | <code>gemini/gemini-3.8-flash</code> | 29.22s | 94.92 | 5.08% | 0.86% | 29.22s | $0.0292 |
| 8 | <code>gemini/gemini-4-argon</code> | 34.13s | 98.86 | 1.14% | 0.23% | 34.13s | $0.0662 |
| 9 | <code>anthropic/claude-opus-5-5</code> | 36.95s | 99.20 | 0.80% | 0.16% | 36.95s | $0.1123 |
| 10 | <code>openai/gpt-5.6-terra</code> | 56.31s | 69.08 | 30.92% | 29.72% | 56.31s | $0.0541 |
| 11 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 57.48s | 0.00 | 134.01% | 137.51% | 57.48s | $0.0038 |
| 12 | <code>openai/gpt-6-luna</code> | 58.22s | 58.24 | 41.76% | 47.75% | 58.22s | $0.0035 |
| 13 | <code>anthropic/claude-fable-5</code> | 65.05s | 99.20 | 0.80% | 0.21% | 65.05s | $0.2841 |
| 14 | <code>openai/gpt-6-astra</code> | 69.86s | 94.62 | 5.38% | 0.89% | 69.86s | $0.2020 |
| 15 | <code>openai/gpt-6.1-sol</code> | 80.25s | 94.20 | 5.80% | 1.20% | 80.25s | $0.0407 |
| 16 | <code>anthropic/claude-fable-5-1</code> | 80.82s | 99.45 | 0.55% | 0.11% | 80.82s | $0.5040 |
| 17 | <code>grok/grok-4.5</code> | 88.71s | 94.37 | 5.63% | 1.06% | 88.71s | $0.0508 |
| 18 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 193.39s | 89.37 | 10.63% | 6.65% | 193.39s | $0.0094 |
| 19 | <code>grok/grok-4.7</code> | 365.86s | 98.69 | 1.31% | 0.44% | 365.86s | $1.0476 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5-1</code> | 99.45/100 quality score | 99.45 | 0.55% | 0.11% | 80.82s | $0.5040 |
| 2 | <code>anthropic/claude-sonnet-5-5</code> | 99.24/100 quality score | 99.24 | 0.76% | 0.18% | 29.12s | $0.0562 |
| 3 | <code>anthropic/claude-opus-5-5</code> | 99.20/100 quality score | 99.20 | 0.80% | 0.16% | 36.95s | $0.1123 |
| 4 | <code>anthropic/claude-fable-5</code> | 99.20/100 quality score | 99.20 | 0.80% | 0.21% | 65.05s | $0.2841 |
| 5 | <code>gemini/gemini-4-argon</code> | 98.86/100 quality score | 98.86 | 1.14% | 0.23% | 34.13s | $0.0662 |
| 6 | <code>grok/grok-4.7</code> | 98.69/100 quality score | 98.69 | 1.31% | 0.44% | 365.86s | $1.0476 |
| 7 | <code>gemini/gemini-3.5-flash</code> | 98.48/100 quality score | 98.48 | 1.52% | 0.50% | 20.22s | $0.0291 |
| 8 | <code>gemini/gemini-3.8-flash</code> | 94.92/100 quality score | 94.92 | 5.08% | 0.86% | 29.22s | $0.0292 |
| 9 | <code>gemini/gemini-3.6-flash</code> | 94.75/100 quality score | 94.75 | 5.25% | 0.91% | 18.49s | $0.0291 |
| 10 | <code>openai/gpt-6-astra</code> | 94.62/100 quality score | 94.62 | 5.38% | 0.89% | 69.86s | $0.2020 |
| 11 | <code>grok/grok-4.5</code> | 94.37/100 quality score | 94.37 | 5.63% | 1.06% | 88.71s | $0.0508 |
| 12 | <code>openai/gpt-6.1-sol</code> | 94.20/100 quality score | 94.20 | 5.80% | 1.20% | 80.25s | $0.0407 |
| 13 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 89.37/100 quality score | 89.37 | 10.63% | 6.65% | 193.39s | $0.0094 |
| 14 | <code>gemini/gemini-3.5-flash-lite</code> | 89.33/100 quality score | 89.33 | 10.67% | 3.41% | 13.61s | $0.0093 |
| 15 | <code>mistral/mistral-ocr-4-1</code> | 79.71/100 quality score | 79.71 | 20.29% | 10.91% | 23.08s | $0.0040 |
| 16 | <code>anthropic/claude-haiku-5-5</code> | 73.99/100 quality score | 73.99 | 26.01% | 25.91% | 19.09s | $0.0025 |
| 17 | <code>openai/gpt-5.6-terra</code> | 69.08/100 quality score | 69.08 | 30.92% | 29.72% | 56.31s | $0.0541 |
| 18 | <code>openai/gpt-6-luna</code> | 58.24/100 quality score | 58.24 | 41.76% | 47.75% | 58.22s | $0.0035 |
| 19 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 0.00/100 quality score | 0.00 | 134.01% | 137.51% | 57.48s | $0.0038 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 6.99 | 93.01% | 91.91% | 5.30s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 99.20 | 0.80% | 0.21% | 65.05s | $0.2841 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 99.45 | 0.55% | 0.11% | 80.82s | $0.5040 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 73.99 | 26.01% | 25.91% | 19.09s | $0.0025 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 99.20 | 0.80% | 0.16% | 36.95s | $0.1123 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 99.24 | 0.76% | 0.18% | 29.12s | $0.0562 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 0.00 | 134.01% | 137.51% | 57.48s | $0.0038 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 89.37 | 10.63% | 6.65% | 193.39s | $0.0094 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 98.48 | 1.52% | 0.50% | 20.22s | $0.0291 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 89.33 | 10.67% | 3.41% | 13.61s | $0.0093 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 94.75 | 5.25% | 0.91% | 18.49s | $0.0291 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 94.92 | 5.08% | 0.86% | 29.22s | $0.0292 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 98.86 | 1.14% | 0.23% | 34.13s | $0.0662 |
| <code>grok/grok-4.5</code> | Third-Party Service | 94.37 | 5.63% | 1.06% | 88.71s | $0.0508 |
| <code>grok/grok-4.7</code> | Third-Party Service | 98.69 | 1.31% | 0.44% | 365.86s | $1.0476 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 79.71 | 20.29% | 10.91% | 23.08s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 69.08 | 30.92% | 29.72% | 56.31s | $0.0541 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 94.62 | 5.38% | 0.89% | 69.86s | $0.2020 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 58.24 | 41.76% | 47.75% | 58.22s | $0.0035 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 94.20 | 5.80% | 1.20% | 80.25s | $0.0407 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 1784 | 411 | 1 | 2361 |
| <code>anthropic/claude-fable-5</code> | 16 | 2 | 1 | 2361 |
| <code>anthropic/claude-fable-5-1</code> | 11 | 2 | 0 | 2361 |
| <code>anthropic/claude-haiku-5-5</code> | 23 | 589 | 2 | 2361 |
| <code>anthropic/claude-opus-5-5</code> | 14 | 3 | 2 | 2361 |
| <code>anthropic/claude-sonnet-5-5</code> | 12 | 4 | 2 | 2361 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 984 | 14 | 2166 | 2361 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 107 | 91 | 53 | 2361 |
| <code>gemini/gemini-3.5-flash</code> | 26 | 7 | 3 | 2361 |
| <code>gemini/gemini-3.5-flash-lite</code> | 151 | 29 | 72 | 2361 |
| <code>gemini/gemini-3.6-flash</code> | 74 | 4 | 46 | 2361 |
| <code>gemini/gemini-3.8-flash</code> | 70 | 3 | 47 | 2361 |
| <code>gemini/gemini-4-argon</code> | 20 | 2 | 5 | 2361 |
| <code>grok/grok-4.5</code> | 81 | 4 | 48 | 2361 |
| <code>grok/grok-4.7</code> | 25 | 5 | 1 | 2361 |
| <code>mistral/mistral-ocr-4-1</code> | 381 | 25 | 73 | 2361 |
| <code>openai/gpt-5.6-terra</code> | 331 | 346 | 53 | 2361 |
| <code>openai/gpt-6-astra</code> | 77 | 1 | 49 | 2361 |
| <code>openai/gpt-6-luna</code> | 66 | 890 | 30 | 2361 |
| <code>openai/gpt-6.1-sol</code> | 85 | 3 | 49 | 2361 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 6.99/100.
- Best cloud service: `anthropic/claude-fable-5-1` scored 99.45/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.2548¢ ($0.0025).
- Fastest local model: `tesseract/tesseract` at 5.30s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 13.61s.

## Lexical evaluation scope

Reference scope: full-page. Existing archived multi-provider consensus; not independent publisher gold.

Headline WER/CER use the existing case-insensitive lexical normalization and declared reference order. Reading-order or serialization differences can increase edit distance; these scores do not measure layout or exact glyph/punctuation fidelity.

Text-only OCR does not establish column/region localization or page layout. An article crop does not establish whole-page reading order.

Literal numeric, punctuation and whitespace comparisons are representation-fidelity diagnostics. TSV tabs, span-continuation blanks, Markdown wrappers and source case conventions can differ without establishing a recognition error.

[Literal numeric, punctuation and alternate-reading diagnostics](evaluation-diagnostics.json) retain all source and provider text privately.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: the existing archived multi-provider consensus is reused byte for byte; it is not independent publisher gold.
- Each provider received the same pinned original PNG/JPEG or the declared rendered-PNG baseline variant. Reference text, table cells, manuscript deletions and graph/layout annotations were never sent to providers. Text recognition is scored separately from unavailable cell, branch and page-geometry accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
