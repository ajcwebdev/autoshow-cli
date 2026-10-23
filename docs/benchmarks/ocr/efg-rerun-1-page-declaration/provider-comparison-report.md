# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/efg-rerun-1-page-declaration`
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
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 14.55 | 85.45% | 45.95% | 8.55s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 8.55s | 14.55 | 85.45% | 45.95% | 8.55s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 14.55/100 quality score | 14.55 | 85.45% | 45.95% | 8.55s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0013 | 99.80 | 0.20% | 0.13% | 20.48s | $0.0013 |
| 2 | <code>openai/gpt-6-luna</code> | $0.0019 | 94.33 | 5.67% | 4.85% | 37.06s | $0.0019 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0034 | 95.15 | 4.85% | 3.87% | 20.55s | $0.0034 |
| 4 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 75.00 | 25.00% | 22.75% | 11.02s | $0.0040 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0047 | 91.39 | 8.61% | 8.92% | 8.79s | $0.0047 |
| 6 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0080 | 94.47 | 5.53% | 4.45% | 216.66s | $0.0080 |
| 7 | <code>gemini/gemini-3.8-flash</code> | $0.0165 | 99.93 | 0.07% | 0.06% | 28.03s | $0.0165 |
| 8 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0166 | 35.52 | 64.48% | 51.17% | 93.05s | $0.0166 |
| 9 | <code>gemini/gemini-3.6-flash</code> | $0.0171 | 99.04 | 0.96% | 0.27% | 11.79s | $0.0171 |
| 10 | <code>gemini/gemini-3.5-flash</code> | $0.0201 | 99.39 | 0.61% | 0.06% | 12.36s | $0.0201 |
| 11 | <code>openai/gpt-6.1-sol</code> | $0.0275 | 99.86 | 0.14% | 0.02% | 47.13s | $0.0275 |
| 12 | <code>grok/grok-4.5</code> | $0.0284 | 99.11 | 0.89% | 0.63% | 51.53s | $0.0284 |
| 13 | <code>openai/gpt-5.6-terra</code> | $0.0313 | 97.75 | 2.25% | 1.58% | 29.77s | $0.0313 |
| 14 | <code>grok/grok-4.7</code> | $0.0350 | 99.73 | 0.27% | 0.30% | 45.87s | $0.0350 |
| 15 | <code>anthropic/claude-sonnet-5-5</code> | $0.0420 | 98.63 | 1.37% | 0.43% | 20.67s | $0.0420 |
| 16 | <code>gemini/gemini-4-argon</code> | $0.0455 | 99.32 | 0.68% | 0.07% | 26.19s | $0.0455 |
| 17 | <code>anthropic/claude-opus-5-5</code> | $0.0842 | 99.25 | 0.75% | 0.40% | 24.19s | $0.0842 |
| 18 | <code>openai/gpt-6-astra</code> | $0.1444 | 99.25 | 0.75% | 0.08% | 40.98s | $0.1444 |
| 19 | <code>anthropic/claude-fable-5</code> | $0.2124 | 99.86 | 0.14% | 0.02% | 42.72s | $0.2124 |
| 20 | <code>anthropic/claude-fable-5-1</code> | $0.2273 | 98.57 | 1.43% | 0.55% | 33.81s | $0.2273 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 8.79s | 91.39 | 8.61% | 8.92% | 8.79s | $0.0047 |
| 2 | <code>mistral/mistral-ocr-4-1</code> | 11.02s | 75.00 | 25.00% | 22.75% | 11.02s | $0.0040 |
| 3 | <code>gemini/gemini-3.6-flash</code> | 11.79s | 99.04 | 0.96% | 0.27% | 11.79s | $0.0171 |
| 4 | <code>gemini/gemini-3.5-flash</code> | 12.36s | 99.39 | 0.61% | 0.06% | 12.36s | $0.0201 |
| 5 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 20.48s | 99.80 | 0.20% | 0.13% | 20.48s | $0.0013 |
| 6 | <code>anthropic/claude-haiku-5-5</code> | 20.55s | 95.15 | 4.85% | 3.87% | 20.55s | $0.0034 |
| 7 | <code>anthropic/claude-sonnet-5-5</code> | 20.67s | 98.63 | 1.37% | 0.43% | 20.67s | $0.0420 |
| 8 | <code>anthropic/claude-opus-5-5</code> | 24.19s | 99.25 | 0.75% | 0.40% | 24.19s | $0.0842 |
| 9 | <code>gemini/gemini-4-argon</code> | 26.19s | 99.32 | 0.68% | 0.07% | 26.19s | $0.0455 |
| 10 | <code>gemini/gemini-3.8-flash</code> | 28.03s | 99.93 | 0.07% | 0.06% | 28.03s | $0.0165 |
| 11 | <code>openai/gpt-5.6-terra</code> | 29.77s | 97.75 | 2.25% | 1.58% | 29.77s | $0.0313 |
| 12 | <code>anthropic/claude-fable-5-1</code> | 33.81s | 98.57 | 1.43% | 0.55% | 33.81s | $0.2273 |
| 13 | <code>openai/gpt-6-luna</code> | 37.06s | 94.33 | 5.67% | 4.85% | 37.06s | $0.0019 |
| 14 | <code>openai/gpt-6-astra</code> | 40.98s | 99.25 | 0.75% | 0.08% | 40.98s | $0.1444 |
| 15 | <code>anthropic/claude-fable-5</code> | 42.72s | 99.86 | 0.14% | 0.02% | 42.72s | $0.2124 |
| 16 | <code>grok/grok-4.7</code> | 45.87s | 99.73 | 0.27% | 0.30% | 45.87s | $0.0350 |
| 17 | <code>openai/gpt-6.1-sol</code> | 47.13s | 99.86 | 0.14% | 0.02% | 47.13s | $0.0275 |
| 18 | <code>grok/grok-4.5</code> | 51.53s | 99.11 | 0.89% | 0.63% | 51.53s | $0.0284 |
| 19 | <code>deepinfra/google/gemma-4-31B-it</code> | 93.05s | 35.52 | 64.48% | 51.17% | 93.05s | $0.0166 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 216.66s | 94.47 | 5.53% | 4.45% | 216.66s | $0.0080 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.8-flash</code> | 99.93/100 quality score | 99.93 | 0.07% | 0.06% | 28.03s | $0.0165 |
| 2 | <code>anthropic/claude-fable-5</code> | 99.86/100 quality score | 99.86 | 0.14% | 0.02% | 42.72s | $0.2124 |
| 3 | <code>openai/gpt-6.1-sol</code> | 99.86/100 quality score | 99.86 | 0.14% | 0.02% | 47.13s | $0.0275 |
| 4 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 99.80/100 quality score | 99.80 | 0.20% | 0.13% | 20.48s | $0.0013 |
| 5 | <code>grok/grok-4.7</code> | 99.73/100 quality score | 99.73 | 0.27% | 0.30% | 45.87s | $0.0350 |
| 6 | <code>gemini/gemini-3.5-flash</code> | 99.39/100 quality score | 99.39 | 0.61% | 0.06% | 12.36s | $0.0201 |
| 7 | <code>gemini/gemini-4-argon</code> | 99.32/100 quality score | 99.32 | 0.68% | 0.07% | 26.19s | $0.0455 |
| 8 | <code>openai/gpt-6-astra</code> | 99.25/100 quality score | 99.25 | 0.75% | 0.08% | 40.98s | $0.1444 |
| 9 | <code>anthropic/claude-opus-5-5</code> | 99.25/100 quality score | 99.25 | 0.75% | 0.40% | 24.19s | $0.0842 |
| 10 | <code>grok/grok-4.5</code> | 99.11/100 quality score | 99.11 | 0.89% | 0.63% | 51.53s | $0.0284 |
| 11 | <code>gemini/gemini-3.6-flash</code> | 99.04/100 quality score | 99.04 | 0.96% | 0.27% | 11.79s | $0.0171 |
| 12 | <code>anthropic/claude-sonnet-5-5</code> | 98.63/100 quality score | 98.63 | 1.37% | 0.43% | 20.67s | $0.0420 |
| 13 | <code>anthropic/claude-fable-5-1</code> | 98.57/100 quality score | 98.57 | 1.43% | 0.55% | 33.81s | $0.2273 |
| 14 | <code>openai/gpt-5.6-terra</code> | 97.75/100 quality score | 97.75 | 2.25% | 1.58% | 29.77s | $0.0313 |
| 15 | <code>anthropic/claude-haiku-5-5</code> | 95.15/100 quality score | 95.15 | 4.85% | 3.87% | 20.55s | $0.0034 |
| 16 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 94.47/100 quality score | 94.47 | 5.53% | 4.45% | 216.66s | $0.0080 |
| 17 | <code>openai/gpt-6-luna</code> | 94.33/100 quality score | 94.33 | 5.67% | 4.85% | 37.06s | $0.0019 |
| 18 | <code>gemini/gemini-3.5-flash-lite</code> | 91.39/100 quality score | 91.39 | 8.61% | 8.92% | 8.79s | $0.0047 |
| 19 | <code>mistral/mistral-ocr-4-1</code> | 75.00/100 quality score | 75.00 | 25.00% | 22.75% | 11.02s | $0.0040 |
| 20 | <code>deepinfra/google/gemma-4-31B-it</code> | 35.52/100 quality score | 35.52 | 64.48% | 51.17% | 93.05s | $0.0166 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 14.55 | 85.45% | 45.95% | 8.55s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 99.86 | 0.14% | 0.02% | 42.72s | $0.2124 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 98.57 | 1.43% | 0.55% | 33.81s | $0.2273 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 95.15 | 4.85% | 3.87% | 20.55s | $0.0034 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 99.25 | 0.75% | 0.40% | 24.19s | $0.0842 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 98.63 | 1.37% | 0.43% | 20.67s | $0.0420 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 99.80 | 0.20% | 0.13% | 20.48s | $0.0013 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 35.52 | 64.48% | 51.17% | 93.05s | $0.0166 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 94.47 | 5.53% | 4.45% | 216.66s | $0.0080 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 99.39 | 0.61% | 0.06% | 12.36s | $0.0201 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 91.39 | 8.61% | 8.92% | 8.79s | $0.0047 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 99.04 | 0.96% | 0.27% | 11.79s | $0.0171 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 99.93 | 0.07% | 0.06% | 28.03s | $0.0165 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 99.32 | 0.68% | 0.07% | 26.19s | $0.0455 |
| <code>grok/grok-4.5</code> | Third-Party Service | 99.11 | 0.89% | 0.63% | 51.53s | $0.0284 |
| <code>grok/grok-4.7</code> | Third-Party Service | 99.73 | 0.27% | 0.30% | 45.87s | $0.0350 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 75.00 | 25.00% | 22.75% | 11.02s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 97.75 | 2.25% | 1.58% | 29.77s | $0.0313 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 99.25 | 0.75% | 0.08% | 40.98s | $0.1444 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 94.33 | 5.67% | 4.85% | 37.06s | $0.0019 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 99.86 | 0.14% | 0.02% | 47.13s | $0.0275 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 1035 | 196 | 20 | 1464 |
| <code>anthropic/claude-fable-5</code> | 2 | 0 | 0 | 1464 |
| <code>anthropic/claude-fable-5-1</code> | 7 | 5 | 9 | 1464 |
| <code>anthropic/claude-haiku-5-5</code> | 70 | 1 | 0 | 1464 |
| <code>anthropic/claude-opus-5-5</code> | 6 | 2 | 3 | 1464 |
| <code>anthropic/claude-sonnet-5-5</code> | 11 | 2 | 7 | 1464 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 3 | 0 | 0 | 1464 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 500 | 441 | 3 | 1464 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 53 | 19 | 9 | 1464 |
| <code>gemini/gemini-3.5-flash</code> | 5 | 0 | 4 | 1464 |
| <code>gemini/gemini-3.5-flash-lite</code> | 1 | 125 | 0 | 1464 |
| <code>gemini/gemini-3.6-flash</code> | 5 | 5 | 4 | 1464 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 1 | 0 | 1464 |
| <code>gemini/gemini-4-argon</code> | 5 | 0 | 5 | 1464 |
| <code>grok/grok-4.5</code> | 2 | 11 | 0 | 1464 |
| <code>grok/grok-4.7</code> | 0 | 2 | 2 | 1464 |
| <code>mistral/mistral-ocr-4-1</code> | 77 | 285 | 4 | 1464 |
| <code>openai/gpt-5.6-terra</code> | 11 | 5 | 17 | 1464 |
| <code>openai/gpt-6-astra</code> | 7 | 0 | 4 | 1464 |
| <code>openai/gpt-6-luna</code> | 44 | 19 | 20 | 1464 |
| <code>openai/gpt-6.1-sol</code> | 2 | 0 | 0 | 1464 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 14.55/100.
- Best cloud service: `gemini/gemini-3.8-flash` scored 99.93/100.
- The cheapest cloud provider was `deepinfra/deepseek-ai/DeepSeek-V4.1-Flash` at 0.1325¢ ($0.0013).
- Fastest local model: `tesseract/tesseract` at 8.55s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 8.79s.

## Lexical evaluation scope

Reference scope: full-page. Existing archived multi-provider consensus; not independent publisher gold.

Headline WER/CER use the existing case-insensitive lexical normalization and declared reference order. Reading-order or serialization differences can increase edit distance; these scores do not measure layout or exact glyph/punctuation fidelity.

Text-only OCR does not establish handwriting placement, drawing geometry or spatial association.

Literal numeric, punctuation and whitespace comparisons are representation-fidelity diagnostics. TSV tabs, span-continuation blanks, Markdown wrappers and source case conventions can differ without establishing a recognition error.

[Literal numeric, punctuation and alternate-reading diagnostics](evaluation-diagnostics.json) retain all source and provider text privately.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: the existing archived multi-provider consensus is reused byte for byte; it is not independent publisher gold.
- Each provider received the same pinned original PNG/JPEG or the declared rendered-PNG baseline variant. Reference text, table cells, manuscript deletions and graph/layout annotations were never sent to providers. Text recognition is scored separately from unavailable cell, branch and page-geometry accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
