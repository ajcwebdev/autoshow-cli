# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/efg-rerun-01-financial-data`
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
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 49.13 | 50.87% | 35.58% | 0.45s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.45s | 49.13 | 50.87% | 35.58% | 0.45s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 49.13/100 quality score | 49.13 | 50.87% | 35.58% | 0.45s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0004 | 97.97 | 2.03% | 0.67% | 49.64s | $0.0004 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0005 | 91.86 | 8.14% | 9.17% | 3.74s | $0.0005 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0011 | 32.56 | 67.44% | 46.25% | 6.79s | $0.0011 |
| 4 | <code>openai/gpt-6-luna</code> | $0.0011 | 98.26 | 1.74% | 0.58% | 19.42s | $0.0011 |
| 5 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0025 | 94.48 | 5.52% | 3.75% | 99.09s | $0.0025 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0027 | 31.10 | 68.90% | 48.58% | 2.85s | $0.0027 |
| 7 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 92.15 | 7.85% | 6.75% | 2.99s | $0.0040 |
| 8 | <code>gemini/gemini-3.8-flash</code> | $0.0085 | 99.13 | 0.87% | 0.17% | 8.58s | $0.0085 |
| 9 | <code>gemini/gemini-3.6-flash</code> | $0.0086 | 99.71 | 0.29% | 0.08% | 4.09s | $0.0086 |
| 10 | <code>gemini/gemini-3.5-flash</code> | $0.0098 | 99.71 | 0.29% | 0.08% | 4.13s | $0.0098 |
| 11 | <code>grok/grok-4.5</code> | $0.0106 | 31.10 | 68.90% | 46.83% | 17.37s | $0.0106 |
| 12 | <code>anthropic/claude-sonnet-5-5</code> | $0.0113 | 99.42 | 0.58% | 0.17% | 6.44s | $0.0113 |
| 13 | <code>openai/gpt-6.1-sol</code> | $0.0172 | 99.13 | 0.87% | 0.25% | 27.48s | $0.0172 |
| 14 | <code>anthropic/claude-opus-5-5</code> | $0.0225 | 100.00 | 0.00% | 0.00% | 7.20s | $0.0225 |
| 15 | <code>gemini/gemini-4-argon</code> | $0.0239 | 100.00 | 0.00% | 0.00% | 15.80s | $0.0239 |
| 16 | <code>openai/gpt-5.6-terra</code> | $0.0288 | 90.12 | 9.88% | 7.83% | 24.12s | $0.0288 |
| 17 | <code>openai/gpt-6-astra</code> | $0.0436 | 98.84 | 1.16% | 0.33% | 9.76s | $0.0436 |
| 18 | <code>anthropic/claude-fable-5-1</code> | $0.0559 | 99.71 | 0.29% | 0.08% | 8.64s | $0.0559 |
| 19 | <code>anthropic/claude-fable-5</code> | $0.0580 | 97.09 | 2.91% | 2.83% | 13.35s | $0.0580 |
| 20 | <code>grok/grok-4.7</code> | $0.0807 | 98.84 | 1.16% | 0.58% | 123.82s | $0.0807 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 2.85s | 31.10 | 68.90% | 48.58% | 2.85s | $0.0027 |
| 2 | <code>mistral/mistral-ocr-4-1</code> | 2.99s | 92.15 | 7.85% | 6.75% | 2.99s | $0.0040 |
| 3 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 3.74s | 91.86 | 8.14% | 9.17% | 3.74s | $0.0005 |
| 4 | <code>gemini/gemini-3.6-flash</code> | 4.09s | 99.71 | 0.29% | 0.08% | 4.09s | $0.0086 |
| 5 | <code>gemini/gemini-3.5-flash</code> | 4.13s | 99.71 | 0.29% | 0.08% | 4.13s | $0.0098 |
| 6 | <code>anthropic/claude-sonnet-5-5</code> | 6.44s | 99.42 | 0.58% | 0.17% | 6.44s | $0.0113 |
| 7 | <code>anthropic/claude-haiku-5-5</code> | 6.79s | 32.56 | 67.44% | 46.25% | 6.79s | $0.0011 |
| 8 | <code>anthropic/claude-opus-5-5</code> | 7.20s | 100.00 | 0.00% | 0.00% | 7.20s | $0.0225 |
| 9 | <code>gemini/gemini-3.8-flash</code> | 8.58s | 99.13 | 0.87% | 0.17% | 8.58s | $0.0085 |
| 10 | <code>anthropic/claude-fable-5-1</code> | 8.64s | 99.71 | 0.29% | 0.08% | 8.64s | $0.0559 |
| 11 | <code>openai/gpt-6-astra</code> | 9.76s | 98.84 | 1.16% | 0.33% | 9.76s | $0.0436 |
| 12 | <code>anthropic/claude-fable-5</code> | 13.35s | 97.09 | 2.91% | 2.83% | 13.35s | $0.0580 |
| 13 | <code>gemini/gemini-4-argon</code> | 15.80s | 100.00 | 0.00% | 0.00% | 15.80s | $0.0239 |
| 14 | <code>grok/grok-4.5</code> | 17.37s | 31.10 | 68.90% | 46.83% | 17.37s | $0.0106 |
| 15 | <code>openai/gpt-6-luna</code> | 19.42s | 98.26 | 1.74% | 0.58% | 19.42s | $0.0011 |
| 16 | <code>openai/gpt-5.6-terra</code> | 24.12s | 90.12 | 9.88% | 7.83% | 24.12s | $0.0288 |
| 17 | <code>openai/gpt-6.1-sol</code> | 27.48s | 99.13 | 0.87% | 0.25% | 27.48s | $0.0172 |
| 18 | <code>deepinfra/google/gemma-4-31B-it</code> | 49.64s | 97.97 | 2.03% | 0.67% | 49.64s | $0.0004 |
| 19 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 99.09s | 94.48 | 5.52% | 3.75% | 99.09s | $0.0025 |
| 20 | <code>grok/grok-4.7</code> | 123.82s | 98.84 | 1.16% | 0.58% | 123.82s | $0.0807 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-opus-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 7.20s | $0.0225 |
| 2 | <code>gemini/gemini-4-argon</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 15.80s | $0.0239 |
| 3 | <code>anthropic/claude-fable-5-1</code> | 99.71/100 quality score | 99.71 | 0.29% | 0.08% | 8.64s | $0.0559 |
| 4 | <code>gemini/gemini-3.5-flash</code> | 99.71/100 quality score | 99.71 | 0.29% | 0.08% | 4.13s | $0.0098 |
| 5 | <code>gemini/gemini-3.6-flash</code> | 99.71/100 quality score | 99.71 | 0.29% | 0.08% | 4.09s | $0.0086 |
| 6 | <code>anthropic/claude-sonnet-5-5</code> | 99.42/100 quality score | 99.42 | 0.58% | 0.17% | 6.44s | $0.0113 |
| 7 | <code>gemini/gemini-3.8-flash</code> | 99.13/100 quality score | 99.13 | 0.87% | 0.17% | 8.58s | $0.0085 |
| 8 | <code>openai/gpt-6.1-sol</code> | 99.13/100 quality score | 99.13 | 0.87% | 0.25% | 27.48s | $0.0172 |
| 9 | <code>openai/gpt-6-astra</code> | 98.84/100 quality score | 98.84 | 1.16% | 0.33% | 9.76s | $0.0436 |
| 10 | <code>grok/grok-4.7</code> | 98.84/100 quality score | 98.84 | 1.16% | 0.58% | 123.82s | $0.0807 |
| 11 | <code>openai/gpt-6-luna</code> | 98.26/100 quality score | 98.26 | 1.74% | 0.58% | 19.42s | $0.0011 |
| 12 | <code>deepinfra/google/gemma-4-31B-it</code> | 97.97/100 quality score | 97.97 | 2.03% | 0.67% | 49.64s | $0.0004 |
| 13 | <code>anthropic/claude-fable-5</code> | 97.09/100 quality score | 97.09 | 2.91% | 2.83% | 13.35s | $0.0580 |
| 14 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 94.48/100 quality score | 94.48 | 5.52% | 3.75% | 99.09s | $0.0025 |
| 15 | <code>mistral/mistral-ocr-4-1</code> | 92.15/100 quality score | 92.15 | 7.85% | 6.75% | 2.99s | $0.0040 |
| 16 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 91.86/100 quality score | 91.86 | 8.14% | 9.17% | 3.74s | $0.0005 |
| 17 | <code>openai/gpt-5.6-terra</code> | 90.12/100 quality score | 90.12 | 9.88% | 7.83% | 24.12s | $0.0288 |
| 18 | <code>anthropic/claude-haiku-5-5</code> | 32.56/100 quality score | 32.56 | 67.44% | 46.25% | 6.79s | $0.0011 |
| 19 | <code>grok/grok-4.5</code> | 31.10/100 quality score | 31.10 | 68.90% | 46.83% | 17.37s | $0.0106 |
| 20 | <code>gemini/gemini-3.5-flash-lite</code> | 31.10/100 quality score | 31.10 | 68.90% | 48.58% | 2.85s | $0.0027 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 49.13 | 50.87% | 35.58% | 0.45s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 97.09 | 2.91% | 2.83% | 13.35s | $0.0580 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 99.71 | 0.29% | 0.08% | 8.64s | $0.0559 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 32.56 | 67.44% | 46.25% | 6.79s | $0.0011 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 7.20s | $0.0225 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 99.42 | 0.58% | 0.17% | 6.44s | $0.0113 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 91.86 | 8.14% | 9.17% | 3.74s | $0.0005 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 97.97 | 2.03% | 0.67% | 49.64s | $0.0004 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 94.48 | 5.52% | 3.75% | 99.09s | $0.0025 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 99.71 | 0.29% | 0.08% | 4.13s | $0.0098 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 31.10 | 68.90% | 48.58% | 2.85s | $0.0027 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 99.71 | 0.29% | 0.08% | 4.09s | $0.0086 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 99.13 | 0.87% | 0.17% | 8.58s | $0.0085 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 15.80s | $0.0239 |
| <code>grok/grok-4.5</code> | Third-Party Service | 31.10 | 68.90% | 46.83% | 17.37s | $0.0106 |
| <code>grok/grok-4.7</code> | Third-Party Service | 98.84 | 1.16% | 0.58% | 123.82s | $0.0807 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 92.15 | 7.85% | 6.75% | 2.99s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 90.12 | 9.88% | 7.83% | 24.12s | $0.0288 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 98.84 | 1.16% | 0.33% | 9.76s | $0.0436 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 98.26 | 1.74% | 0.58% | 19.42s | $0.0011 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 99.13 | 0.87% | 0.25% | 27.48s | $0.0172 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 102 | 69 | 4 | 344 |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 10 | 344 |
| <code>anthropic/claude-fable-5-1</code> | 1 | 0 | 0 | 344 |
| <code>anthropic/claude-haiku-5-5</code> | 128 | 52 | 52 | 344 |
| <code>anthropic/claude-opus-5-5</code> | 0 | 0 | 0 | 344 |
| <code>anthropic/claude-sonnet-5-5</code> | 2 | 0 | 0 | 344 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 7 | 7 | 14 | 344 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 7 | 0 | 0 | 344 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 10 | 0 | 9 | 344 |
| <code>gemini/gemini-3.5-flash</code> | 1 | 0 | 0 | 344 |
| <code>gemini/gemini-3.5-flash-lite</code> | 92 | 71 | 74 | 344 |
| <code>gemini/gemini-3.6-flash</code> | 1 | 0 | 0 | 344 |
| <code>gemini/gemini-3.8-flash</code> | 2 | 0 | 1 | 344 |
| <code>gemini/gemini-4-argon</code> | 0 | 0 | 0 | 344 |
| <code>grok/grok-4.5</code> | 133 | 52 | 52 | 344 |
| <code>grok/grok-4.7</code> | 3 | 0 | 1 | 344 |
| <code>mistral/mistral-ocr-4-1</code> | 5 | 0 | 22 | 344 |
| <code>openai/gpt-5.6-terra</code> | 17 | 8 | 9 | 344 |
| <code>openai/gpt-6-astra</code> | 4 | 0 | 0 | 344 |
| <code>openai/gpt-6-luna</code> | 6 | 0 | 0 | 344 |
| <code>openai/gpt-6.1-sol</code> | 3 | 0 | 0 | 344 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 49.13/100.
- Best cloud service: `anthropic/claude-opus-5-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0404¢ ($0.0004).
- Fastest local model: `tesseract/tesseract` at 0.45s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 2.85s.

## Lexical evaluation scope

Reference scope: full-page. Existing archived multi-provider consensus; not independent publisher gold.

Headline WER/CER use the existing case-insensitive lexical normalization and declared reference order. Reading-order or serialization differences can increase edit distance; these scores do not measure layout or exact glyph/punctuation fidelity.

Text-only OCR does not establish cell assignment, row/column mapping, spans or blank-cell geometry. Numeric/text presence is not table-structure accuracy.

Literal numeric, punctuation and whitespace comparisons are representation-fidelity diagnostics. TSV tabs, span-continuation blanks, Markdown wrappers and source case conventions can differ without establishing a recognition error.

[Literal numeric, punctuation and alternate-reading diagnostics](evaluation-diagnostics.json) retain all source and provider text privately.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: the existing archived multi-provider consensus is reused byte for byte; it is not independent publisher gold.
- Each provider received the same pinned original PNG/JPEG or the declared rendered-PNG baseline variant. Reference text, table cells, manuscript deletions and graph/layout annotations were never sent to providers. Text recognition is scored separately from unavailable cell, branch and page-geometry accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
