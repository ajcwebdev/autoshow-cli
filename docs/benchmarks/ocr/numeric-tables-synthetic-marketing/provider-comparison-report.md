# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/numeric-tables-synthetic-marketing`
- Publisher canonical reference: `numeric-tables-synthetic-marketing.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `b32dbf5c5a3c2371b9a85c1c025c723784f19e73ca5feedf6b7b444b9651bdef`.
- Publisher source: https://ds4sd-public-artifacts.s3.eu-de.cloud-object-storage.appdomain.cloud/datasets/synthtabnet_public/samples.zip (revision `d4266dc3094e42e82f3b30060d22f3e4e394093c`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 0.00 | 100.00% | 100.00% | 0.09s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.09s | 0.00 | 100.00% | 100.00% | 0.09s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.00/100 quality score | 0.00 | 100.00% | 100.00% | 0.09s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0005 | 93.01 | 6.99% | 6.65% | 42.22s | $0.0005 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0005 | 78.17 | 21.83% | 14.51% | 4.37s | $0.0005 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0012 | 89.52 | 10.48% | 5.02% | 8.60s | $0.0012 |
| 4 | <code>openai/gpt-6-luna</code> | $0.0019 | 83.41 | 16.59% | 12.10% | 32.92s | $0.0019 |
| 5 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0032 | 57.42 | 42.58% | 29.44% | 41.22s | $0.0032 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0034 | 95.63 | 4.37% | 4.55% | 3.09s | $0.0034 |
| 7 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 98.47 | 1.53% | 0.39% | 2.59s | $0.0040 |
| 8 | <code>gemini/gemini-3.8-flash</code> | $0.0097 | 98.25 | 1.75% | 2.15% | 8.10s | $0.0097 |
| 9 | <code>gemini/gemini-3.6-flash</code> | $0.0101 | 100.00 | 0.00% | 0.00% | 5.00s | $0.0101 |
| 10 | <code>anthropic/claude-sonnet-5-5</code> | $0.0121 | 91.92 | 8.08% | 5.36% | 7.25s | $0.0121 |
| 11 | <code>gemini/gemini-3.5-flash</code> | $0.0133 | 97.38 | 2.62% | 2.66% | 5.42s | $0.0133 |
| 12 | <code>grok/grok-4.5</code> | $0.0147 | 64.63 | 35.37% | 21.42% | 24.78s | $0.0147 |
| 13 | <code>grok/grok-4.7</code> | $0.0149 | 75.55 | 24.45% | 14.21% | 17.63s | $0.0149 |
| 14 | <code>openai/gpt-6.1-sol</code> | $0.0236 | 93.45 | 6.55% | 3.69% | 52.32s | $0.0236 |
| 15 | <code>anthropic/claude-opus-5-5</code> | $0.0241 | 94.54 | 5.46% | 3.86% | 10.71s | $0.0241 |
| 16 | <code>gemini/gemini-4-argon</code> | $0.0284 | 98.25 | 1.75% | 2.15% | 12.90s | $0.0284 |
| 17 | <code>openai/gpt-5.6-terra</code> | $0.0520 | 58.52 | 41.48% | 31.12% | 41.25s | $0.0520 |
| 18 | <code>anthropic/claude-fable-5-1</code> | $0.0608 | 96.72 | 3.28% | 2.92% | 11.32s | $0.0608 |
| 19 | <code>openai/gpt-6-astra</code> | $0.1176 | 92.58 | 7.42% | 4.38% | 53.94s | $0.1176 |
| 20 | <code>anthropic/claude-fable-5</code> | $0.1187 | 95.85 | 4.15% | 1.80% | 24.30s | $0.1187 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-1</code> | 2.59s | 98.47 | 1.53% | 0.39% | 2.59s | $0.0040 |
| 2 | <code>gemini/gemini-3.5-flash-lite</code> | 3.09s | 95.63 | 4.37% | 4.55% | 3.09s | $0.0034 |
| 3 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 4.37s | 78.17 | 21.83% | 14.51% | 4.37s | $0.0005 |
| 4 | <code>gemini/gemini-3.6-flash</code> | 5.00s | 100.00 | 0.00% | 0.00% | 5.00s | $0.0101 |
| 5 | <code>gemini/gemini-3.5-flash</code> | 5.42s | 97.38 | 2.62% | 2.66% | 5.42s | $0.0133 |
| 6 | <code>anthropic/claude-sonnet-5-5</code> | 7.25s | 91.92 | 8.08% | 5.36% | 7.25s | $0.0121 |
| 7 | <code>gemini/gemini-3.8-flash</code> | 8.10s | 98.25 | 1.75% | 2.15% | 8.10s | $0.0097 |
| 8 | <code>anthropic/claude-haiku-5-5</code> | 8.60s | 89.52 | 10.48% | 5.02% | 8.60s | $0.0012 |
| 9 | <code>anthropic/claude-opus-5-5</code> | 10.71s | 94.54 | 5.46% | 3.86% | 10.71s | $0.0241 |
| 10 | <code>anthropic/claude-fable-5-1</code> | 11.32s | 96.72 | 3.28% | 2.92% | 11.32s | $0.0608 |
| 11 | <code>gemini/gemini-4-argon</code> | 12.90s | 98.25 | 1.75% | 2.15% | 12.90s | $0.0284 |
| 12 | <code>grok/grok-4.7</code> | 17.63s | 75.55 | 24.45% | 14.21% | 17.63s | $0.0149 |
| 13 | <code>anthropic/claude-fable-5</code> | 24.30s | 95.85 | 4.15% | 1.80% | 24.30s | $0.1187 |
| 14 | <code>grok/grok-4.5</code> | 24.78s | 64.63 | 35.37% | 21.42% | 24.78s | $0.0147 |
| 15 | <code>openai/gpt-6-luna</code> | 32.92s | 83.41 | 16.59% | 12.10% | 32.92s | $0.0019 |
| 16 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 41.22s | 57.42 | 42.58% | 29.44% | 41.22s | $0.0032 |
| 17 | <code>openai/gpt-5.6-terra</code> | 41.25s | 58.52 | 41.48% | 31.12% | 41.25s | $0.0520 |
| 18 | <code>deepinfra/google/gemma-4-31B-it</code> | 42.22s | 93.01 | 6.99% | 6.65% | 42.22s | $0.0005 |
| 19 | <code>openai/gpt-6.1-sol</code> | 52.32s | 93.45 | 6.55% | 3.69% | 52.32s | $0.0236 |
| 20 | <code>openai/gpt-6-astra</code> | 53.94s | 92.58 | 7.42% | 4.38% | 53.94s | $0.1176 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.00s | $0.0101 |
| 2 | <code>mistral/mistral-ocr-4-1</code> | 98.47/100 quality score | 98.47 | 1.53% | 0.39% | 2.59s | $0.0040 |
| 3 | <code>gemini/gemini-3.8-flash</code> | 98.25/100 quality score | 98.25 | 1.75% | 2.15% | 8.10s | $0.0097 |
| 4 | <code>gemini/gemini-4-argon</code> | 98.25/100 quality score | 98.25 | 1.75% | 2.15% | 12.90s | $0.0284 |
| 5 | <code>gemini/gemini-3.5-flash</code> | 97.38/100 quality score | 97.38 | 2.62% | 2.66% | 5.42s | $0.0133 |
| 6 | <code>anthropic/claude-fable-5-1</code> | 96.72/100 quality score | 96.72 | 3.28% | 2.92% | 11.32s | $0.0608 |
| 7 | <code>anthropic/claude-fable-5</code> | 95.85/100 quality score | 95.85 | 4.15% | 1.80% | 24.30s | $0.1187 |
| 8 | <code>gemini/gemini-3.5-flash-lite</code> | 95.63/100 quality score | 95.63 | 4.37% | 4.55% | 3.09s | $0.0034 |
| 9 | <code>anthropic/claude-opus-5-5</code> | 94.54/100 quality score | 94.54 | 5.46% | 3.86% | 10.71s | $0.0241 |
| 10 | <code>openai/gpt-6.1-sol</code> | 93.45/100 quality score | 93.45 | 6.55% | 3.69% | 52.32s | $0.0236 |
| 11 | <code>deepinfra/google/gemma-4-31B-it</code> | 93.01/100 quality score | 93.01 | 6.99% | 6.65% | 42.22s | $0.0005 |
| 12 | <code>openai/gpt-6-astra</code> | 92.58/100 quality score | 92.58 | 7.42% | 4.38% | 53.94s | $0.1176 |
| 13 | <code>anthropic/claude-sonnet-5-5</code> | 91.92/100 quality score | 91.92 | 8.08% | 5.36% | 7.25s | $0.0121 |
| 14 | <code>anthropic/claude-haiku-5-5</code> | 89.52/100 quality score | 89.52 | 10.48% | 5.02% | 8.60s | $0.0012 |
| 15 | <code>openai/gpt-6-luna</code> | 83.41/100 quality score | 83.41 | 16.59% | 12.10% | 32.92s | $0.0019 |
| 16 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 78.17/100 quality score | 78.17 | 21.83% | 14.51% | 4.37s | $0.0005 |
| 17 | <code>grok/grok-4.7</code> | 75.55/100 quality score | 75.55 | 24.45% | 14.21% | 17.63s | $0.0149 |
| 18 | <code>grok/grok-4.5</code> | 64.63/100 quality score | 64.63 | 35.37% | 21.42% | 24.78s | $0.0147 |
| 19 | <code>openai/gpt-5.6-terra</code> | 58.52/100 quality score | 58.52 | 41.48% | 31.12% | 41.25s | $0.0520 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 57.42/100 quality score | 57.42 | 42.58% | 29.44% | 41.22s | $0.0032 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 0.00 | 100.00% | 100.00% | 0.09s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 95.85 | 4.15% | 1.80% | 24.30s | $0.1187 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 96.72 | 3.28% | 2.92% | 11.32s | $0.0608 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 89.52 | 10.48% | 5.02% | 8.60s | $0.0012 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 94.54 | 5.46% | 3.86% | 10.71s | $0.0241 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 91.92 | 8.08% | 5.36% | 7.25s | $0.0121 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 78.17 | 21.83% | 14.51% | 4.37s | $0.0005 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 93.01 | 6.99% | 6.65% | 42.22s | $0.0005 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 57.42 | 42.58% | 29.44% | 41.22s | $0.0032 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 97.38 | 2.62% | 2.66% | 5.42s | $0.0133 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 95.63 | 4.37% | 4.55% | 3.09s | $0.0034 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.00s | $0.0101 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 98.25 | 1.75% | 2.15% | 8.10s | $0.0097 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 98.25 | 1.75% | 2.15% | 12.90s | $0.0284 |
| <code>grok/grok-4.5</code> | Third-Party Service | 64.63 | 35.37% | 21.42% | 24.78s | $0.0147 |
| <code>grok/grok-4.7</code> | Third-Party Service | 75.55 | 24.45% | 14.21% | 17.63s | $0.0149 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 98.47 | 1.53% | 0.39% | 2.59s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 58.52 | 41.48% | 31.12% | 41.25s | $0.0520 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 92.58 | 7.42% | 4.38% | 53.94s | $0.1176 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 83.41 | 16.59% | 12.10% | 32.92s | $0.0019 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 93.45 | 6.55% | 3.69% | 52.32s | $0.0236 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 0 | 458 | 0 | 458 |
| <code>anthropic/claude-fable-5</code> | 13 | 3 | 3 | 458 |
| <code>anthropic/claude-fable-5-1</code> | 6 | 5 | 4 | 458 |
| <code>anthropic/claude-haiku-5-5</code> | 34 | 9 | 5 | 458 |
| <code>anthropic/claude-opus-5-5</code> | 11 | 7 | 7 | 458 |
| <code>anthropic/claude-sonnet-5-5</code> | 17 | 10 | 10 | 458 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 52 | 25 | 23 | 458 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 2 | 13 | 17 | 458 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 124 | 47 | 24 | 458 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 6 | 6 | 458 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 10 | 10 | 458 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 458 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 4 | 4 | 458 |
| <code>gemini/gemini-4-argon</code> | 0 | 4 | 4 | 458 |
| <code>grok/grok-4.5</code> | 107 | 29 | 26 | 458 |
| <code>grok/grok-4.7</code> | 78 | 20 | 14 | 458 |
| <code>mistral/mistral-ocr-4-1</code> | 7 | 0 | 0 | 458 |
| <code>openai/gpt-5.6-terra</code> | 93 | 77 | 20 | 458 |
| <code>openai/gpt-6-astra</code> | 17 | 10 | 7 | 458 |
| <code>openai/gpt-6-luna</code> | 44 | 27 | 5 | 458 |
| <code>openai/gpt-6.1-sol</code> | 20 | 3 | 7 | 458 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 0.00/100.
- Best cloud service: `gemini/gemini-3.6-flash` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0460¢ ($0.0005).
- Fastest local model: `tesseract/tesseract` at 0.09s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 2.59s.

## Lexical evaluation scope

Reference scope: region-crop. Exhaustive lexical target for the declared input page/crop; drawing syntax is excluded where the publisher serialization declares it.

Headline WER/CER use the existing case-insensitive lexical normalization and declared reference order. Reading-order or serialization differences can increase edit distance; these scores do not measure layout or exact glyph/punctuation fidelity.

Text-only OCR does not establish cell assignment, row/column mapping, spans or blank-cell geometry. Numeric/text presence is not table-structure accuracy.

Literal numeric, punctuation and whitespace comparisons are representation-fidelity diagnostics. TSV tabs, span-continuation blanks, Markdown wrappers and source case conventions can differ without establishing a recognition error.

[Literal numeric, punctuation and alternate-reading diagnostics](evaluation-diagnostics.json) retain all source and provider text privately.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- Each provider received the same pinned original PNG/JPEG or the declared rendered-PNG baseline variant. Reference text, table cells, manuscript deletions and graph/layout annotations were never sent to providers. Text recognition is scored separately from unavailable cell, branch and page-geometry accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
