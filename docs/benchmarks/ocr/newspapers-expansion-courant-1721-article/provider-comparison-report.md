# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-newspaper-expansion/benchmark-runs/newspapers-expansion-courant-1721-article`
- Publisher canonical reference: `normalized-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `7e3311b7f58d15735370a2809bc5869a9d7939c95e41b8694ae7bef0ab299d9e`.
- Publisher source: https://en.wikisource.org/w/index.php?title=Page%3AThe%20New-England%20Courant%20-%20Nos%20001.djvu%2F1&oldid=14351086&action=raw (revision `14351086`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 59.52 | 40.48% | 13.14% | 0.48s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.48s | 59.52 | 40.48% | 13.14% | 0.48s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 59.52/100 quality score | 59.52 | 40.48% | 13.14% | 0.48s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0002 | 96.26 | 3.74% | 1.18% | 14.82s | $0.0002 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0003 | 84.01 | 15.99% | 3.87% | 7.40s | $0.0003 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0008 | 97.96 | 2.04% | 0.55% | 5.05s | $0.0008 |
| 4 | <code>openai/gpt-6-luna</code> | $0.0010 | 93.54 | 6.46% | 1.80% | 19.61s | $0.0010 |
| 5 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0011 | 92.18 | 7.82% | 2.77% | 74.22s | $0.0011 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0015 | 95.24 | 4.76% | 0.76% | 2.12s | $0.0015 |
| 7 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 97.28 | 2.72% | 0.83% | 2.31s | $0.0040 |
| 8 | <code>gemini/gemini-3.6-flash</code> | $0.0047 | 96.94 | 3.06% | 0.76% | 2.58s | $0.0047 |
| 9 | <code>gemini/gemini-3.8-flash</code> | $0.0050 | 97.62 | 2.38% | 0.28% | 9.69s | $0.0050 |
| 10 | <code>gemini/gemini-3.5-flash</code> | $0.0053 | 95.24 | 4.76% | 0.83% | 2.87s | $0.0053 |
| 11 | <code>anthropic/claude-sonnet-5-5</code> | $0.0090 | 97.62 | 2.38% | 0.28% | 5.39s | $0.0090 |
| 12 | <code>openai/gpt-6.1-sol</code> | $0.0092 | 96.26 | 3.74% | 1.24% | 15.35s | $0.0092 |
| 13 | <code>grok/grok-4.5</code> | $0.0099 | 98.64 | 1.36% | 0.69% | 15.79s | $0.0099 |
| 14 | <code>openai/gpt-5.6-terra</code> | $0.0125 | 92.86 | 7.14% | 2.90% | 8.86s | $0.0125 |
| 15 | <code>anthropic/claude-opus-5-5</code> | $0.0166 | 99.32 | 0.68% | 0.21% | 5.24s | $0.0166 |
| 16 | <code>gemini/gemini-4-argon</code> | $0.0181 | 82.31 | 17.69% | 2.49% | 8.38s | $0.0181 |
| 17 | <code>anthropic/claude-fable-5-1</code> | $0.0414 | 99.66 | 0.34% | 0.07% | 5.48s | $0.0414 |
| 18 | <code>anthropic/claude-fable-5</code> | $0.0421 | 98.64 | 1.36% | 0.28% | 10.79s | $0.0421 |
| 19 | <code>openai/gpt-6-astra</code> | $0.0668 | 96.60 | 3.40% | 0.90% | 18.73s | $0.0668 |
| 20 | <code>grok/grok-4.7</code> | $0.0775 | 95.58 | 4.42% | 0.83% | 149.60s | $0.0775 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 2.12s | 95.24 | 4.76% | 0.76% | 2.12s | $0.0015 |
| 2 | <code>mistral/mistral-ocr-4-1</code> | 2.31s | 97.28 | 2.72% | 0.83% | 2.31s | $0.0040 |
| 3 | <code>gemini/gemini-3.6-flash</code> | 2.58s | 96.94 | 3.06% | 0.76% | 2.58s | $0.0047 |
| 4 | <code>gemini/gemini-3.5-flash</code> | 2.87s | 95.24 | 4.76% | 0.83% | 2.87s | $0.0053 |
| 5 | <code>anthropic/claude-haiku-5-5</code> | 5.05s | 97.96 | 2.04% | 0.55% | 5.05s | $0.0008 |
| 6 | <code>anthropic/claude-opus-5-5</code> | 5.24s | 99.32 | 0.68% | 0.21% | 5.24s | $0.0166 |
| 7 | <code>anthropic/claude-sonnet-5-5</code> | 5.39s | 97.62 | 2.38% | 0.28% | 5.39s | $0.0090 |
| 8 | <code>anthropic/claude-fable-5-1</code> | 5.48s | 99.66 | 0.34% | 0.07% | 5.48s | $0.0414 |
| 9 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 7.40s | 84.01 | 15.99% | 3.87% | 7.40s | $0.0003 |
| 10 | <code>gemini/gemini-4-argon</code> | 8.38s | 82.31 | 17.69% | 2.49% | 8.38s | $0.0181 |
| 11 | <code>openai/gpt-5.6-terra</code> | 8.86s | 92.86 | 7.14% | 2.90% | 8.86s | $0.0125 |
| 12 | <code>gemini/gemini-3.8-flash</code> | 9.69s | 97.62 | 2.38% | 0.28% | 9.69s | $0.0050 |
| 13 | <code>anthropic/claude-fable-5</code> | 10.79s | 98.64 | 1.36% | 0.28% | 10.79s | $0.0421 |
| 14 | <code>deepinfra/google/gemma-4-31B-it</code> | 14.82s | 96.26 | 3.74% | 1.18% | 14.82s | $0.0002 |
| 15 | <code>openai/gpt-6.1-sol</code> | 15.35s | 96.26 | 3.74% | 1.24% | 15.35s | $0.0092 |
| 16 | <code>grok/grok-4.5</code> | 15.79s | 98.64 | 1.36% | 0.69% | 15.79s | $0.0099 |
| 17 | <code>openai/gpt-6-astra</code> | 18.73s | 96.60 | 3.40% | 0.90% | 18.73s | $0.0668 |
| 18 | <code>openai/gpt-6-luna</code> | 19.61s | 93.54 | 6.46% | 1.80% | 19.61s | $0.0010 |
| 19 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 74.22s | 92.18 | 7.82% | 2.77% | 74.22s | $0.0011 |
| 20 | <code>grok/grok-4.7</code> | 149.60s | 95.58 | 4.42% | 0.83% | 149.60s | $0.0775 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5-1</code> | 99.66/100 quality score | 99.66 | 0.34% | 0.07% | 5.48s | $0.0414 |
| 2 | <code>anthropic/claude-opus-5-5</code> | 99.32/100 quality score | 99.32 | 0.68% | 0.21% | 5.24s | $0.0166 |
| 3 | <code>anthropic/claude-fable-5</code> | 98.64/100 quality score | 98.64 | 1.36% | 0.28% | 10.79s | $0.0421 |
| 4 | <code>grok/grok-4.5</code> | 98.64/100 quality score | 98.64 | 1.36% | 0.69% | 15.79s | $0.0099 |
| 5 | <code>anthropic/claude-haiku-5-5</code> | 97.96/100 quality score | 97.96 | 2.04% | 0.55% | 5.05s | $0.0008 |
| 6 | <code>anthropic/claude-sonnet-5-5</code> | 97.62/100 quality score | 97.62 | 2.38% | 0.28% | 5.39s | $0.0090 |
| 7 | <code>gemini/gemini-3.8-flash</code> | 97.62/100 quality score | 97.62 | 2.38% | 0.28% | 9.69s | $0.0050 |
| 8 | <code>mistral/mistral-ocr-4-1</code> | 97.28/100 quality score | 97.28 | 2.72% | 0.83% | 2.31s | $0.0040 |
| 9 | <code>gemini/gemini-3.6-flash</code> | 96.94/100 quality score | 96.94 | 3.06% | 0.76% | 2.58s | $0.0047 |
| 10 | <code>openai/gpt-6-astra</code> | 96.60/100 quality score | 96.60 | 3.40% | 0.90% | 18.73s | $0.0668 |
| 11 | <code>deepinfra/google/gemma-4-31B-it</code> | 96.26/100 quality score | 96.26 | 3.74% | 1.18% | 14.82s | $0.0002 |
| 12 | <code>openai/gpt-6.1-sol</code> | 96.26/100 quality score | 96.26 | 3.74% | 1.24% | 15.35s | $0.0092 |
| 13 | <code>grok/grok-4.7</code> | 95.58/100 quality score | 95.58 | 4.42% | 0.83% | 149.60s | $0.0775 |
| 14 | <code>gemini/gemini-3.5-flash-lite</code> | 95.24/100 quality score | 95.24 | 4.76% | 0.76% | 2.12s | $0.0015 |
| 15 | <code>gemini/gemini-3.5-flash</code> | 95.24/100 quality score | 95.24 | 4.76% | 0.83% | 2.87s | $0.0053 |
| 16 | <code>openai/gpt-6-luna</code> | 93.54/100 quality score | 93.54 | 6.46% | 1.80% | 19.61s | $0.0010 |
| 17 | <code>openai/gpt-5.6-terra</code> | 92.86/100 quality score | 92.86 | 7.14% | 2.90% | 8.86s | $0.0125 |
| 18 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 92.18/100 quality score | 92.18 | 7.82% | 2.77% | 74.22s | $0.0011 |
| 19 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 84.01/100 quality score | 84.01 | 15.99% | 3.87% | 7.40s | $0.0003 |
| 20 | <code>gemini/gemini-4-argon</code> | 82.31/100 quality score | 82.31 | 17.69% | 2.49% | 8.38s | $0.0181 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 59.52 | 40.48% | 13.14% | 0.48s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 98.64 | 1.36% | 0.28% | 10.79s | $0.0421 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 99.66 | 0.34% | 0.07% | 5.48s | $0.0414 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 97.96 | 2.04% | 0.55% | 5.05s | $0.0008 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 99.32 | 0.68% | 0.21% | 5.24s | $0.0166 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 97.62 | 2.38% | 0.28% | 5.39s | $0.0090 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 84.01 | 15.99% | 3.87% | 7.40s | $0.0003 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 96.26 | 3.74% | 1.18% | 14.82s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 92.18 | 7.82% | 2.77% | 74.22s | $0.0011 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 95.24 | 4.76% | 0.83% | 2.87s | $0.0053 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 95.24 | 4.76% | 0.76% | 2.12s | $0.0015 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 96.94 | 3.06% | 0.76% | 2.58s | $0.0047 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 97.62 | 2.38% | 0.28% | 9.69s | $0.0050 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 82.31 | 17.69% | 2.49% | 8.38s | $0.0181 |
| <code>grok/grok-4.5</code> | Third-Party Service | 98.64 | 1.36% | 0.69% | 15.79s | $0.0099 |
| <code>grok/grok-4.7</code> | Third-Party Service | 95.58 | 4.42% | 0.83% | 149.60s | $0.0775 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 97.28 | 2.72% | 0.83% | 2.31s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 92.86 | 7.14% | 2.90% | 8.86s | $0.0125 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 96.60 | 3.40% | 0.90% | 18.73s | $0.0668 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 93.54 | 6.46% | 1.80% | 19.61s | $0.0010 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 96.26 | 3.74% | 1.24% | 15.35s | $0.0092 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 98 | 16 | 5 | 294 |
| <code>anthropic/claude-fable-5</code> | 3 | 0 | 1 | 294 |
| <code>anthropic/claude-fable-5-1</code> | 1 | 0 | 0 | 294 |
| <code>anthropic/claude-haiku-5-5</code> | 3 | 1 | 2 | 294 |
| <code>anthropic/claude-opus-5-5</code> | 2 | 0 | 0 | 294 |
| <code>anthropic/claude-sonnet-5-5</code> | 4 | 0 | 3 | 294 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 38 | 2 | 7 | 294 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 5 | 3 | 3 | 294 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 15 | 2 | 6 | 294 |
| <code>gemini/gemini-3.5-flash</code> | 6 | 2 | 6 | 294 |
| <code>gemini/gemini-3.5-flash-lite</code> | 8 | 0 | 6 | 294 |
| <code>gemini/gemini-3.6-flash</code> | 4 | 2 | 3 | 294 |
| <code>gemini/gemini-3.8-flash</code> | 4 | 0 | 3 | 294 |
| <code>gemini/gemini-4-argon</code> | 35 | 1 | 16 | 294 |
| <code>grok/grok-4.5</code> | 4 | 0 | 0 | 294 |
| <code>grok/grok-4.7</code> | 8 | 0 | 5 | 294 |
| <code>mistral/mistral-ocr-4-1</code> | 7 | 0 | 1 | 294 |
| <code>openai/gpt-5.6-terra</code> | 14 | 4 | 3 | 294 |
| <code>openai/gpt-6-astra</code> | 7 | 0 | 3 | 294 |
| <code>openai/gpt-6-luna</code> | 13 | 1 | 5 | 294 |
| <code>openai/gpt-6.1-sol</code> | 8 | 0 | 3 | 294 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 59.52/100.
- Best cloud service: `anthropic/claude-fable-5-1` scored 99.66/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0226¢ ($0.0002).
- Fastest local model: `tesseract/tesseract` at 0.48s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 2.12s.

## Lexical evaluation scope

Reference scope: region-crop. Exhaustive lexical target for the declared input page/crop; drawing syntax is excluded where the publisher serialization declares it.

Headline WER/CER use the existing case-insensitive lexical normalization and declared reference order. Reading-order or serialization differences can increase edit distance; these scores do not measure layout or exact glyph/punctuation fidelity.

Text-only OCR does not establish column/region localization or page layout. An article crop does not establish whole-page reading order.

Literal numeric, punctuation and whitespace comparisons are representation-fidelity diagnostics. TSV tabs, span-continuation blanks, Markdown wrappers and source case conventions can differ without establishing a recognition error.

[Literal numeric, punctuation and alternate-reading diagnostics](evaluation-diagnostics.json) retain all source and provider text privately.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- Every selected model received the same pinned PNG for each admitted input. Independent reference text and reading-order annotations were never sent to providers. Lexical analysis applies the declared NFKC, quote/dash and whitespace conversion to both reference and candidate in private derivatives; raw saved outputs and diplomatic references remain unchanged. Whole-page layout, region recognition and long-page capacity are reported separately.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
