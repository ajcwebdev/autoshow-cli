# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-newspaper-expansion/benchmark-runs/newspapers-expansion-london-gazette-1815-p4`
- Publisher canonical reference: `normalized-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `999928600801e58f9c337c97d5e71ea03490074bef35b81b6cdbec6b41ed56f5`.
- Publisher source: https://en.wikisource.org/w/index.php?title=Page%3AThe%20London%20Gazette%2017028.pdf%2F4&oldid=16226633&action=raw (revision `16226633`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 68.96 | 31.04% | 11.18% | 1.33s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 1.33s | 68.96 | 31.04% | 11.18% | 1.33s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 68.96/100 quality score | 68.96 | 31.04% | 11.18% | 1.33s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0005 | 43.03 | 56.97% | 43.59% | 39.33s | $0.0005 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0009 | 94.00 | 6.00% | 1.50% | 11.04s | $0.0009 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0014 | 97.18 | 2.82% | 0.93% | 7.50s | $0.0014 |
| 4 | <code>openai/gpt-6-luna</code> | $0.0020 | 95.06 | 4.94% | 1.35% | 31.39s | $0.0020 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0035 | 95.77 | 4.23% | 1.06% | 5.11s | $0.0035 |
| 6 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0037 | 94.00 | 6.00% | 1.45% | 72.21s | $0.0037 |
| 7 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 97.18 | 2.82% | 0.91% | 7.02s | $0.0040 |
| 8 | <code>gemini/gemini-3.6-flash</code> | $0.0108 | 97.71 | 2.29% | 0.60% | 5.46s | $0.0108 |
| 9 | <code>gemini/gemini-3.8-flash</code> | $0.0108 | 97.88 | 2.12% | 0.57% | 10.66s | $0.0108 |
| 10 | <code>gemini/gemini-3.5-flash</code> | $0.0125 | 97.88 | 2.12% | 0.57% | 5.72s | $0.0125 |
| 11 | <code>openai/gpt-6.1-sol</code> | $0.0168 | 95.06 | 4.94% | 1.04% | 22.33s | $0.0168 |
| 12 | <code>openai/gpt-5.6-terra</code> | $0.0193 | 92.24 | 7.76% | 2.05% | 14.00s | $0.0193 |
| 13 | <code>grok/grok-4.5</code> | $0.0194 | 96.83 | 3.17% | 1.11% | 28.98s | $0.0194 |
| 14 | <code>anthropic/claude-sonnet-5-5</code> | $0.0274 | 97.71 | 2.29% | 0.96% | 13.22s | $0.0274 |
| 15 | <code>gemini/gemini-4-argon</code> | $0.0311 | 96.12 | 3.88% | 0.65% | 16.02s | $0.0311 |
| 16 | <code>grok/grok-4.7</code> | $0.0476 | 97.71 | 2.29% | 1.11% | 63.11s | $0.0476 |
| 17 | <code>anthropic/claude-opus-5-5</code> | $0.0549 | 98.41 | 1.59% | 0.44% | 15.89s | $0.0549 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0835 | 95.94 | 4.06% | 0.75% | 13.64s | $0.0835 |
| 19 | <code>anthropic/claude-fable-5-1</code> | $0.1378 | 98.06 | 1.94% | 0.49% | 19.75s | $0.1378 |
| 20 | <code>anthropic/claude-fable-5</code> | $0.1387 | 97.88 | 2.12% | 0.85% | 23.61s | $0.1387 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 5.11s | 95.77 | 4.23% | 1.06% | 5.11s | $0.0035 |
| 2 | <code>gemini/gemini-3.6-flash</code> | 5.46s | 97.71 | 2.29% | 0.60% | 5.46s | $0.0108 |
| 3 | <code>gemini/gemini-3.5-flash</code> | 5.72s | 97.88 | 2.12% | 0.57% | 5.72s | $0.0125 |
| 4 | <code>mistral/mistral-ocr-4-1</code> | 7.02s | 97.18 | 2.82% | 0.91% | 7.02s | $0.0040 |
| 5 | <code>anthropic/claude-haiku-5-5</code> | 7.50s | 97.18 | 2.82% | 0.93% | 7.50s | $0.0014 |
| 6 | <code>gemini/gemini-3.8-flash</code> | 10.66s | 97.88 | 2.12% | 0.57% | 10.66s | $0.0108 |
| 7 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 11.04s | 94.00 | 6.00% | 1.50% | 11.04s | $0.0009 |
| 8 | <code>anthropic/claude-sonnet-5-5</code> | 13.22s | 97.71 | 2.29% | 0.96% | 13.22s | $0.0274 |
| 9 | <code>openai/gpt-6-astra</code> | 13.64s | 95.94 | 4.06% | 0.75% | 13.64s | $0.0835 |
| 10 | <code>openai/gpt-5.6-terra</code> | 14.00s | 92.24 | 7.76% | 2.05% | 14.00s | $0.0193 |
| 11 | <code>anthropic/claude-opus-5-5</code> | 15.89s | 98.41 | 1.59% | 0.44% | 15.89s | $0.0549 |
| 12 | <code>gemini/gemini-4-argon</code> | 16.02s | 96.12 | 3.88% | 0.65% | 16.02s | $0.0311 |
| 13 | <code>anthropic/claude-fable-5-1</code> | 19.75s | 98.06 | 1.94% | 0.49% | 19.75s | $0.1378 |
| 14 | <code>openai/gpt-6.1-sol</code> | 22.33s | 95.06 | 4.94% | 1.04% | 22.33s | $0.0168 |
| 15 | <code>anthropic/claude-fable-5</code> | 23.61s | 97.88 | 2.12% | 0.85% | 23.61s | $0.1387 |
| 16 | <code>grok/grok-4.5</code> | 28.98s | 96.83 | 3.17% | 1.11% | 28.98s | $0.0194 |
| 17 | <code>openai/gpt-6-luna</code> | 31.39s | 95.06 | 4.94% | 1.35% | 31.39s | $0.0020 |
| 18 | <code>deepinfra/google/gemma-4-31B-it</code> | 39.33s | 43.03 | 56.97% | 43.59% | 39.33s | $0.0005 |
| 19 | <code>grok/grok-4.7</code> | 63.11s | 97.71 | 2.29% | 1.11% | 63.11s | $0.0476 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 72.21s | 94.00 | 6.00% | 1.45% | 72.21s | $0.0037 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-opus-5-5</code> | 98.41/100 quality score | 98.41 | 1.59% | 0.44% | 15.89s | $0.0549 |
| 2 | <code>anthropic/claude-fable-5-1</code> | 98.06/100 quality score | 98.06 | 1.94% | 0.49% | 19.75s | $0.1378 |
| 3 | <code>gemini/gemini-3.5-flash</code> | 97.88/100 quality score | 97.88 | 2.12% | 0.57% | 5.72s | $0.0125 |
| 4 | <code>gemini/gemini-3.8-flash</code> | 97.88/100 quality score | 97.88 | 2.12% | 0.57% | 10.66s | $0.0108 |
| 5 | <code>anthropic/claude-fable-5</code> | 97.88/100 quality score | 97.88 | 2.12% | 0.85% | 23.61s | $0.1387 |
| 6 | <code>gemini/gemini-3.6-flash</code> | 97.71/100 quality score | 97.71 | 2.29% | 0.60% | 5.46s | $0.0108 |
| 7 | <code>anthropic/claude-sonnet-5-5</code> | 97.71/100 quality score | 97.71 | 2.29% | 0.96% | 13.22s | $0.0274 |
| 8 | <code>grok/grok-4.7</code> | 97.71/100 quality score | 97.71 | 2.29% | 1.11% | 63.11s | $0.0476 |
| 9 | <code>mistral/mistral-ocr-4-1</code> | 97.18/100 quality score | 97.18 | 2.82% | 0.91% | 7.02s | $0.0040 |
| 10 | <code>anthropic/claude-haiku-5-5</code> | 97.18/100 quality score | 97.18 | 2.82% | 0.93% | 7.50s | $0.0014 |
| 11 | <code>grok/grok-4.5</code> | 96.83/100 quality score | 96.83 | 3.17% | 1.11% | 28.98s | $0.0194 |
| 12 | <code>gemini/gemini-4-argon</code> | 96.12/100 quality score | 96.12 | 3.88% | 0.65% | 16.02s | $0.0311 |
| 13 | <code>openai/gpt-6-astra</code> | 95.94/100 quality score | 95.94 | 4.06% | 0.75% | 13.64s | $0.0835 |
| 14 | <code>gemini/gemini-3.5-flash-lite</code> | 95.77/100 quality score | 95.77 | 4.23% | 1.06% | 5.11s | $0.0035 |
| 15 | <code>openai/gpt-6.1-sol</code> | 95.06/100 quality score | 95.06 | 4.94% | 1.04% | 22.33s | $0.0168 |
| 16 | <code>openai/gpt-6-luna</code> | 95.06/100 quality score | 95.06 | 4.94% | 1.35% | 31.39s | $0.0020 |
| 17 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 94.00/100 quality score | 94.00 | 6.00% | 1.45% | 72.21s | $0.0037 |
| 18 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 94.00/100 quality score | 94.00 | 6.00% | 1.50% | 11.04s | $0.0009 |
| 19 | <code>openai/gpt-5.6-terra</code> | 92.24/100 quality score | 92.24 | 7.76% | 2.05% | 14.00s | $0.0193 |
| 20 | <code>deepinfra/google/gemma-4-31B-it</code> | 43.03/100 quality score | 43.03 | 56.97% | 43.59% | 39.33s | $0.0005 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 68.96 | 31.04% | 11.18% | 1.33s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 97.88 | 2.12% | 0.85% | 23.61s | $0.1387 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 98.06 | 1.94% | 0.49% | 19.75s | $0.1378 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 97.18 | 2.82% | 0.93% | 7.50s | $0.0014 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 98.41 | 1.59% | 0.44% | 15.89s | $0.0549 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 97.71 | 2.29% | 0.96% | 13.22s | $0.0274 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 94.00 | 6.00% | 1.50% | 11.04s | $0.0009 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 43.03 | 56.97% | 43.59% | 39.33s | $0.0005 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 94.00 | 6.00% | 1.45% | 72.21s | $0.0037 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 97.88 | 2.12% | 0.57% | 5.72s | $0.0125 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 95.77 | 4.23% | 1.06% | 5.11s | $0.0035 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 97.71 | 2.29% | 0.60% | 5.46s | $0.0108 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 97.88 | 2.12% | 0.57% | 10.66s | $0.0108 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 96.12 | 3.88% | 0.65% | 16.02s | $0.0311 |
| <code>grok/grok-4.5</code> | Third-Party Service | 96.83 | 3.17% | 1.11% | 28.98s | $0.0194 |
| <code>grok/grok-4.7</code> | Third-Party Service | 97.71 | 2.29% | 1.11% | 63.11s | $0.0476 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 97.18 | 2.82% | 0.91% | 7.02s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 92.24 | 7.76% | 2.05% | 14.00s | $0.0193 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 95.94 | 4.06% | 0.75% | 13.64s | $0.0835 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 95.06 | 4.94% | 1.35% | 31.39s | $0.0020 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 95.06 | 4.94% | 1.04% | 22.33s | $0.0168 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 123 | 14 | 39 | 567 |
| <code>anthropic/claude-fable-5</code> | 7 | 4 | 1 | 567 |
| <code>anthropic/claude-fable-5-1</code> | 8 | 2 | 1 | 567 |
| <code>anthropic/claude-haiku-5-5</code> | 10 | 4 | 2 | 567 |
| <code>anthropic/claude-opus-5-5</code> | 6 | 2 | 1 | 567 |
| <code>anthropic/claude-sonnet-5-5</code> | 8 | 4 | 1 | 567 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 24 | 4 | 6 | 567 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 58 | 145 | 120 | 567 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 25 | 2 | 7 | 567 |
| <code>gemini/gemini-3.5-flash</code> | 9 | 2 | 1 | 567 |
| <code>gemini/gemini-3.5-flash-lite</code> | 14 | 4 | 6 | 567 |
| <code>gemini/gemini-3.6-flash</code> | 10 | 2 | 1 | 567 |
| <code>gemini/gemini-3.8-flash</code> | 9 | 2 | 1 | 567 |
| <code>gemini/gemini-4-argon</code> | 14 | 2 | 6 | 567 |
| <code>grok/grok-4.5</code> | 13 | 4 | 1 | 567 |
| <code>grok/grok-4.7</code> | 7 | 5 | 1 | 567 |
| <code>mistral/mistral-ocr-4-1</code> | 13 | 2 | 1 | 567 |
| <code>openai/gpt-5.6-terra</code> | 33 | 4 | 7 | 567 |
| <code>openai/gpt-6-astra</code> | 15 | 2 | 6 | 567 |
| <code>openai/gpt-6-luna</code> | 19 | 4 | 5 | 567 |
| <code>openai/gpt-6.1-sol</code> | 18 | 2 | 8 | 567 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 68.96/100.
- Best cloud service: `anthropic/claude-opus-5-5` scored 98.41/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0539¢ ($0.0005).
- Fastest local model: `tesseract/tesseract` at 1.33s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 5.11s.

## Lexical evaluation scope

Reference scope: full-page. Exhaustive lexical target for the declared input page/crop; drawing syntax is excluded where the publisher serialization declares it.

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
