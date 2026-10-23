# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/numeric-tables-inflammatory-pathways`
- Publisher canonical reference: `numeric-tables-inflammatory-pathways.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `45235f27e5bb109fb0d61e218e79c6317940ba8018b2450f37f82d0d4bbac0a1`.
- Publisher source: https://raw.githubusercontent.com/ibm-aur-nlp/PubTabNet/8ffde9024bd331f5a61c3c549fdf30dd3c3e43a5/examples/PubTabNet_Examples.jsonl (revision `8ffde9024bd331f5a61c3c549fdf30dd3c3e43a5`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 4.35 | 95.65% | 81.05% | 0.33s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.33s | 4.35 | 95.65% | 81.05% | 0.33s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 4.35/100 quality score | 4.35 | 95.65% | 81.05% | 0.33s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0005 | 97.34 | 2.66% | 1.79% | 51.20s | $0.0005 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0007 | 85.02 | 14.98% | 3.87% | 7.39s | $0.0007 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0017 | 83.82 | 16.18% | 21.36% | 10.52s | $0.0017 |
| 4 | <code>openai/gpt-6-luna</code> | $0.0021 | 90.58 | 9.42% | 5.17% | 28.55s | $0.0021 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0029 | 100.00 | 0.00% | 0.00% | 2.53s | $0.0029 |
| 6 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0030 | 69.08 | 30.92% | 12.95% | 33.71s | $0.0030 |
| 7 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 99.76 | 0.24% | 0.05% | 3.25s | $0.0040 |
| 8 | <code>grok/grok-4.5</code> | $0.0087 | 85.51 | 14.49% | 5.99% | 18.70s | $0.0087 |
| 9 | <code>gemini/gemini-3.6-flash</code> | $0.0093 | 100.00 | 0.00% | 0.00% | 4.73s | $0.0093 |
| 10 | <code>gemini/gemini-3.8-flash</code> | $0.0094 | 100.00 | 0.00% | 0.00% | 6.82s | $0.0094 |
| 11 | <code>gemini/gemini-3.5-flash</code> | $0.0135 | 100.00 | 0.00% | 0.00% | 5.40s | $0.0135 |
| 12 | <code>anthropic/claude-sonnet-5-5</code> | $0.0161 | 97.34 | 2.66% | 1.30% | 8.29s | $0.0161 |
| 13 | <code>openai/gpt-6.1-sol</code> | $0.0302 | 98.31 | 1.69% | 0.48% | 55.90s | $0.0302 |
| 14 | <code>gemini/gemini-4-argon</code> | $0.0320 | 100.00 | 0.00% | 0.00% | 13.79s | $0.0320 |
| 15 | <code>anthropic/claude-opus-5-5</code> | $0.0325 | 98.55 | 1.45% | 0.97% | 11.56s | $0.0325 |
| 16 | <code>openai/gpt-6-astra</code> | $0.0529 | 98.31 | 1.69% | 0.72% | 16.43s | $0.0529 |
| 17 | <code>openai/gpt-5.6-terra</code> | $0.0557 | 90.82 | 9.18% | 5.12% | 45.49s | $0.0557 |
| 18 | <code>grok/grok-4.7</code> | $0.0726 | 93.00 | 7.00% | 4.45% | 95.97s | $0.0726 |
| 19 | <code>anthropic/claude-fable-5-1</code> | $0.0808 | 94.20 | 5.80% | 3.48% | 14.17s | $0.0808 |
| 20 | <code>anthropic/claude-fable-5</code> | $0.1605 | 93.96 | 6.04% | 2.27% | 29.21s | $0.1605 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 2.53s | 100.00 | 0.00% | 0.00% | 2.53s | $0.0029 |
| 2 | <code>mistral/mistral-ocr-4-1</code> | 3.25s | 99.76 | 0.24% | 0.05% | 3.25s | $0.0040 |
| 3 | <code>gemini/gemini-3.6-flash</code> | 4.73s | 100.00 | 0.00% | 0.00% | 4.73s | $0.0093 |
| 4 | <code>gemini/gemini-3.5-flash</code> | 5.40s | 100.00 | 0.00% | 0.00% | 5.40s | $0.0135 |
| 5 | <code>gemini/gemini-3.8-flash</code> | 6.82s | 100.00 | 0.00% | 0.00% | 6.82s | $0.0094 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 7.39s | 85.02 | 14.98% | 3.87% | 7.39s | $0.0007 |
| 7 | <code>anthropic/claude-sonnet-5-5</code> | 8.29s | 97.34 | 2.66% | 1.30% | 8.29s | $0.0161 |
| 8 | <code>anthropic/claude-haiku-5-5</code> | 10.52s | 83.82 | 16.18% | 21.36% | 10.52s | $0.0017 |
| 9 | <code>anthropic/claude-opus-5-5</code> | 11.56s | 98.55 | 1.45% | 0.97% | 11.56s | $0.0325 |
| 10 | <code>gemini/gemini-4-argon</code> | 13.79s | 100.00 | 0.00% | 0.00% | 13.79s | $0.0320 |
| 11 | <code>anthropic/claude-fable-5-1</code> | 14.17s | 94.20 | 5.80% | 3.48% | 14.17s | $0.0808 |
| 12 | <code>openai/gpt-6-astra</code> | 16.43s | 98.31 | 1.69% | 0.72% | 16.43s | $0.0529 |
| 13 | <code>grok/grok-4.5</code> | 18.70s | 85.51 | 14.49% | 5.99% | 18.70s | $0.0087 |
| 14 | <code>openai/gpt-6-luna</code> | 28.55s | 90.58 | 9.42% | 5.17% | 28.55s | $0.0021 |
| 15 | <code>anthropic/claude-fable-5</code> | 29.21s | 93.96 | 6.04% | 2.27% | 29.21s | $0.1605 |
| 16 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 33.71s | 69.08 | 30.92% | 12.95% | 33.71s | $0.0030 |
| 17 | <code>openai/gpt-5.6-terra</code> | 45.49s | 90.82 | 9.18% | 5.12% | 45.49s | $0.0557 |
| 18 | <code>deepinfra/google/gemma-4-31B-it</code> | 51.20s | 97.34 | 2.66% | 1.79% | 51.20s | $0.0005 |
| 19 | <code>openai/gpt-6.1-sol</code> | 55.90s | 98.31 | 1.69% | 0.48% | 55.90s | $0.0302 |
| 20 | <code>grok/grok-4.7</code> | 95.97s | 93.00 | 7.00% | 4.45% | 95.97s | $0.0726 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.40s | $0.0135 |
| 2 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.53s | $0.0029 |
| 3 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.73s | $0.0093 |
| 4 | <code>gemini/gemini-3.8-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 6.82s | $0.0094 |
| 5 | <code>gemini/gemini-4-argon</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 13.79s | $0.0320 |
| 6 | <code>mistral/mistral-ocr-4-1</code> | 99.76/100 quality score | 99.76 | 0.24% | 0.05% | 3.25s | $0.0040 |
| 7 | <code>anthropic/claude-opus-5-5</code> | 98.55/100 quality score | 98.55 | 1.45% | 0.97% | 11.56s | $0.0325 |
| 8 | <code>openai/gpt-6.1-sol</code> | 98.31/100 quality score | 98.31 | 1.69% | 0.48% | 55.90s | $0.0302 |
| 9 | <code>openai/gpt-6-astra</code> | 98.31/100 quality score | 98.31 | 1.69% | 0.72% | 16.43s | $0.0529 |
| 10 | <code>anthropic/claude-sonnet-5-5</code> | 97.34/100 quality score | 97.34 | 2.66% | 1.30% | 8.29s | $0.0161 |
| 11 | <code>deepinfra/google/gemma-4-31B-it</code> | 97.34/100 quality score | 97.34 | 2.66% | 1.79% | 51.20s | $0.0005 |
| 12 | <code>anthropic/claude-fable-5-1</code> | 94.20/100 quality score | 94.20 | 5.80% | 3.48% | 14.17s | $0.0808 |
| 13 | <code>anthropic/claude-fable-5</code> | 93.96/100 quality score | 93.96 | 6.04% | 2.27% | 29.21s | $0.1605 |
| 14 | <code>grok/grok-4.7</code> | 93.00/100 quality score | 93.00 | 7.00% | 4.45% | 95.97s | $0.0726 |
| 15 | <code>openai/gpt-5.6-terra</code> | 90.82/100 quality score | 90.82 | 9.18% | 5.12% | 45.49s | $0.0557 |
| 16 | <code>openai/gpt-6-luna</code> | 90.58/100 quality score | 90.58 | 9.42% | 5.17% | 28.55s | $0.0021 |
| 17 | <code>grok/grok-4.5</code> | 85.51/100 quality score | 85.51 | 14.49% | 5.99% | 18.70s | $0.0087 |
| 18 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 85.02/100 quality score | 85.02 | 14.98% | 3.87% | 7.39s | $0.0007 |
| 19 | <code>anthropic/claude-haiku-5-5</code> | 83.82/100 quality score | 83.82 | 16.18% | 21.36% | 10.52s | $0.0017 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 69.08/100 quality score | 69.08 | 30.92% | 12.95% | 33.71s | $0.0030 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 4.35 | 95.65% | 81.05% | 0.33s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 93.96 | 6.04% | 2.27% | 29.21s | $0.1605 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 94.20 | 5.80% | 3.48% | 14.17s | $0.0808 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 83.82 | 16.18% | 21.36% | 10.52s | $0.0017 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 98.55 | 1.45% | 0.97% | 11.56s | $0.0325 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 97.34 | 2.66% | 1.30% | 8.29s | $0.0161 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 85.02 | 14.98% | 3.87% | 7.39s | $0.0007 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 97.34 | 2.66% | 1.79% | 51.20s | $0.0005 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 69.08 | 30.92% | 12.95% | 33.71s | $0.0030 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.40s | $0.0135 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.53s | $0.0029 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.73s | $0.0093 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 6.82s | $0.0094 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 13.79s | $0.0320 |
| <code>grok/grok-4.5</code> | Third-Party Service | 85.51 | 14.49% | 5.99% | 18.70s | $0.0087 |
| <code>grok/grok-4.7</code> | Third-Party Service | 93.00 | 7.00% | 4.45% | 95.97s | $0.0726 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 99.76 | 0.24% | 0.05% | 3.25s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 90.82 | 9.18% | 5.12% | 45.49s | $0.0557 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 98.31 | 1.69% | 0.72% | 16.43s | $0.0529 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 90.58 | 9.42% | 5.17% | 28.55s | $0.0021 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 98.31 | 1.69% | 0.48% | 55.90s | $0.0302 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 74 | 322 | 0 | 414 |
| <code>anthropic/claude-fable-5</code> | 25 | 0 | 0 | 414 |
| <code>anthropic/claude-fable-5-1</code> | 19 | 2 | 3 | 414 |
| <code>anthropic/claude-haiku-5-5</code> | 11 | 0 | 56 | 414 |
| <code>anthropic/claude-opus-5-5</code> | 6 | 0 | 0 | 414 |
| <code>anthropic/claude-sonnet-5-5</code> | 11 | 0 | 0 | 414 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 60 | 2 | 0 | 414 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 10 | 0 | 1 | 414 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 105 | 3 | 20 | 414 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 414 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 414 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 414 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 0 | 0 | 414 |
| <code>gemini/gemini-4-argon</code> | 0 | 0 | 0 | 414 |
| <code>grok/grok-4.5</code> | 39 | 0 | 21 | 414 |
| <code>grok/grok-4.7</code> | 20 | 4 | 5 | 414 |
| <code>mistral/mistral-ocr-4-1</code> | 1 | 0 | 0 | 414 |
| <code>openai/gpt-5.6-terra</code> | 29 | 4 | 5 | 414 |
| <code>openai/gpt-6-astra</code> | 7 | 0 | 0 | 414 |
| <code>openai/gpt-6-luna</code> | 19 | 14 | 6 | 414 |
| <code>openai/gpt-6.1-sol</code> | 7 | 0 | 0 | 414 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 4.35/100.
- Best cloud service: `gemini/gemini-3.5-flash` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0451¢ ($0.0005).
- Fastest local model: `tesseract/tesseract` at 0.33s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 2.53s.

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
