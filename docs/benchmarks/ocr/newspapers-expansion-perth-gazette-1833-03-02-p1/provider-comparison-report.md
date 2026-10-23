# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-newspaper-expansion/benchmark-runs/newspapers-expansion-perth-gazette-1833-03-02-p1`
- Publisher canonical reference: `normalized-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 20 (1 local, 19 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `3b15e1b242b2f28876754e968b28bfef63f6390788fea83bc6f5ec1837d38deb`.
- Publisher source: https://en.wikisource.org/w/index.php?title=Page%3AThe%20Perth%20Gazette%20and%20Western%20Australian%20Journal%201(9).djvu%2F1&oldid=7397214&action=raw (revision `7397214`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 55.27 | 44.73% | 23.15% | 2.12s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 2.12s | 55.27 | 44.73% | 23.15% | 2.12s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 55.27/100 quality score | 55.27 | 44.73% | 23.15% | 2.12s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0015 | 82.43 | 17.57% | 12.01% | 33.50s | $0.0015 |
| 2 | <code>anthropic/claude-haiku-5-5</code> | $0.0021 | 95.35 | 4.65% | 3.66% | 14.35s | $0.0021 |
| 3 | <code>openai/gpt-6-luna</code> | $0.0028 | 93.10 | 6.90% | 5.01% | 44.08s | $0.0028 |
| 4 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 92.88 | 7.12% | 4.59% | 9.45s | $0.0040 |
| 5 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0061 | 61.07 | 38.93% | 30.13% | 176.51s | $0.0061 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0062 | 62.09 | 37.91% | 27.48% | 6.46s | $0.0062 |
| 7 | <code>gemini/gemini-3.8-flash</code> | $0.0195 | 92.88 | 7.12% | 3.73% | 17.33s | $0.0195 |
| 8 | <code>gemini/gemini-3.6-flash</code> | $0.0195 | 92.23 | 7.77% | 4.08% | 10.61s | $0.0195 |
| 9 | <code>gemini/gemini-3.5-flash</code> | $0.0231 | 92.08 | 7.92% | 4.25% | 10.21s | $0.0231 |
| 10 | <code>openai/gpt-6.1-sol</code> | $0.0250 | 94.48 | 5.52% | 4.24% | 50.77s | $0.0250 |
| 11 | <code>grok/grok-4.5</code> | $0.0287 | 91.79 | 8.21% | 6.04% | 60.24s | $0.0287 |
| 12 | <code>openai/gpt-5.6-terra</code> | $0.0297 | 84.53 | 15.47% | 12.76% | 30.76s | $0.0297 |
| 13 | <code>anthropic/claude-sonnet-5-5</code> | $0.0374 | 96.22 | 3.78% | 2.95% | 18.23s | $0.0374 |
| 14 | <code>gemini/gemini-4-argon</code> | $0.0526 | 92.96 | 7.04% | 3.69% | 32.43s | $0.0526 |
| 15 | <code>anthropic/claude-opus-5-5</code> | $0.0744 | 95.79 | 4.21% | 3.49% | 24.00s | $0.0744 |
| 16 | <code>grok/grok-4.7</code> | $0.1042 | 98.47 | 1.53% | 0.75% | 168.13s | $0.1042 |
| 17 | <code>openai/gpt-6-astra</code> | $0.1246 | 94.77 | 5.23% | 3.90% | 43.25s | $0.1246 |
| 18 | <code>anthropic/claude-fable-5</code> | $0.1905 | 89.62 | 10.38% | 9.01% | 43.11s | $0.1905 |
| 19 | <code>anthropic/claude-fable-5-1</code> | $0.3431 | 98.18 | 1.82% | 1.22% | 56.62s | $0.3431 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 6.46s | 62.09 | 37.91% | 27.48% | 6.46s | $0.0062 |
| 2 | <code>mistral/mistral-ocr-4-1</code> | 9.45s | 92.88 | 7.12% | 4.59% | 9.45s | $0.0040 |
| 3 | <code>gemini/gemini-3.5-flash</code> | 10.21s | 92.08 | 7.92% | 4.25% | 10.21s | $0.0231 |
| 4 | <code>gemini/gemini-3.6-flash</code> | 10.61s | 92.23 | 7.77% | 4.08% | 10.61s | $0.0195 |
| 5 | <code>anthropic/claude-haiku-5-5</code> | 14.35s | 95.35 | 4.65% | 3.66% | 14.35s | $0.0021 |
| 6 | <code>gemini/gemini-3.8-flash</code> | 17.33s | 92.88 | 7.12% | 3.73% | 17.33s | $0.0195 |
| 7 | <code>anthropic/claude-sonnet-5-5</code> | 18.23s | 96.22 | 3.78% | 2.95% | 18.23s | $0.0374 |
| 8 | <code>anthropic/claude-opus-5-5</code> | 24.00s | 95.79 | 4.21% | 3.49% | 24.00s | $0.0744 |
| 9 | <code>openai/gpt-5.6-terra</code> | 30.76s | 84.53 | 15.47% | 12.76% | 30.76s | $0.0297 |
| 10 | <code>gemini/gemini-4-argon</code> | 32.43s | 92.96 | 7.04% | 3.69% | 32.43s | $0.0526 |
| 11 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 33.50s | 82.43 | 17.57% | 12.01% | 33.50s | $0.0015 |
| 12 | <code>anthropic/claude-fable-5</code> | 43.11s | 89.62 | 10.38% | 9.01% | 43.11s | $0.1905 |
| 13 | <code>openai/gpt-6-astra</code> | 43.25s | 94.77 | 5.23% | 3.90% | 43.25s | $0.1246 |
| 14 | <code>openai/gpt-6-luna</code> | 44.08s | 93.10 | 6.90% | 5.01% | 44.08s | $0.0028 |
| 15 | <code>openai/gpt-6.1-sol</code> | 50.77s | 94.48 | 5.52% | 4.24% | 50.77s | $0.0250 |
| 16 | <code>anthropic/claude-fable-5-1</code> | 56.62s | 98.18 | 1.82% | 1.22% | 56.62s | $0.3431 |
| 17 | <code>grok/grok-4.5</code> | 60.24s | 91.79 | 8.21% | 6.04% | 60.24s | $0.0287 |
| 18 | <code>grok/grok-4.7</code> | 168.13s | 98.47 | 1.53% | 0.75% | 168.13s | $0.1042 |
| 19 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 176.51s | 61.07 | 38.93% | 30.13% | 176.51s | $0.0061 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>grok/grok-4.7</code> | 98.47/100 quality score | 98.47 | 1.53% | 0.75% | 168.13s | $0.1042 |
| 2 | <code>anthropic/claude-fable-5-1</code> | 98.18/100 quality score | 98.18 | 1.82% | 1.22% | 56.62s | $0.3431 |
| 3 | <code>anthropic/claude-sonnet-5-5</code> | 96.22/100 quality score | 96.22 | 3.78% | 2.95% | 18.23s | $0.0374 |
| 4 | <code>anthropic/claude-opus-5-5</code> | 95.79/100 quality score | 95.79 | 4.21% | 3.49% | 24.00s | $0.0744 |
| 5 | <code>anthropic/claude-haiku-5-5</code> | 95.35/100 quality score | 95.35 | 4.65% | 3.66% | 14.35s | $0.0021 |
| 6 | <code>openai/gpt-6-astra</code> | 94.77/100 quality score | 94.77 | 5.23% | 3.90% | 43.25s | $0.1246 |
| 7 | <code>openai/gpt-6.1-sol</code> | 94.48/100 quality score | 94.48 | 5.52% | 4.24% | 50.77s | $0.0250 |
| 8 | <code>openai/gpt-6-luna</code> | 93.10/100 quality score | 93.10 | 6.90% | 5.01% | 44.08s | $0.0028 |
| 9 | <code>gemini/gemini-4-argon</code> | 92.96/100 quality score | 92.96 | 7.04% | 3.69% | 32.43s | $0.0526 |
| 10 | <code>gemini/gemini-3.8-flash</code> | 92.88/100 quality score | 92.88 | 7.12% | 3.73% | 17.33s | $0.0195 |
| 11 | <code>mistral/mistral-ocr-4-1</code> | 92.88/100 quality score | 92.88 | 7.12% | 4.59% | 9.45s | $0.0040 |
| 12 | <code>gemini/gemini-3.6-flash</code> | 92.23/100 quality score | 92.23 | 7.77% | 4.08% | 10.61s | $0.0195 |
| 13 | <code>gemini/gemini-3.5-flash</code> | 92.08/100 quality score | 92.08 | 7.92% | 4.25% | 10.21s | $0.0231 |
| 14 | <code>grok/grok-4.5</code> | 91.79/100 quality score | 91.79 | 8.21% | 6.04% | 60.24s | $0.0287 |
| 15 | <code>anthropic/claude-fable-5</code> | 89.62/100 quality score | 89.62 | 10.38% | 9.01% | 43.11s | $0.1905 |
| 16 | <code>openai/gpt-5.6-terra</code> | 84.53/100 quality score | 84.53 | 15.47% | 12.76% | 30.76s | $0.0297 |
| 17 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 82.43/100 quality score | 82.43 | 17.57% | 12.01% | 33.50s | $0.0015 |
| 18 | <code>gemini/gemini-3.5-flash-lite</code> | 62.09/100 quality score | 62.09 | 37.91% | 27.48% | 6.46s | $0.0062 |
| 19 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 61.07/100 quality score | 61.07 | 38.93% | 30.13% | 176.51s | $0.0061 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 55.27 | 44.73% | 23.15% | 2.12s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 89.62 | 10.38% | 9.01% | 43.11s | $0.1905 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 98.18 | 1.82% | 1.22% | 56.62s | $0.3431 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 95.35 | 4.65% | 3.66% | 14.35s | $0.0021 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 95.79 | 4.21% | 3.49% | 24.00s | $0.0744 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 96.22 | 3.78% | 2.95% | 18.23s | $0.0374 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 82.43 | 17.57% | 12.01% | 33.50s | $0.0015 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 61.07 | 38.93% | 30.13% | 176.51s | $0.0061 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 92.08 | 7.92% | 4.25% | 10.21s | $0.0231 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 62.09 | 37.91% | 27.48% | 6.46s | $0.0062 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 92.23 | 7.77% | 4.08% | 10.61s | $0.0195 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 92.88 | 7.12% | 3.73% | 17.33s | $0.0195 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 92.96 | 7.04% | 3.69% | 32.43s | $0.0526 |
| <code>grok/grok-4.5</code> | Third-Party Service | 91.79 | 8.21% | 6.04% | 60.24s | $0.0287 |
| <code>grok/grok-4.7</code> | Third-Party Service | 98.47 | 1.53% | 0.75% | 168.13s | $0.1042 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 92.88 | 7.12% | 4.59% | 9.45s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 84.53 | 15.47% | 12.76% | 30.76s | $0.0297 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 94.77 | 5.23% | 3.90% | 43.25s | $0.1246 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 93.10 | 6.90% | 5.01% | 44.08s | $0.0028 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 94.48 | 5.52% | 4.24% | 50.77s | $0.0250 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 476 | 97 | 43 | 1377 |
| <code>anthropic/claude-fable-5</code> | 6 | 67 | 70 | 1377 |
| <code>anthropic/claude-fable-5-1</code> | 4 | 14 | 7 | 1377 |
| <code>anthropic/claude-haiku-5-5</code> | 12 | 25 | 27 | 1377 |
| <code>anthropic/claude-opus-5-5</code> | 6 | 25 | 27 | 1377 |
| <code>anthropic/claude-sonnet-5-5</code> | 22 | 14 | 16 | 1377 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 105 | 7 | 130 | 1377 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 331 | 90 | 115 | 1377 |
| <code>gemini/gemini-3.5-flash</code> | 32 | 27 | 50 | 1377 |
| <code>gemini/gemini-3.5-flash-lite</code> | 311 | 91 | 120 | 1377 |
| <code>gemini/gemini-3.6-flash</code> | 32 | 25 | 50 | 1377 |
| <code>gemini/gemini-3.8-flash</code> | 26 | 24 | 48 | 1377 |
| <code>gemini/gemini-4-argon</code> | 25 | 24 | 48 | 1377 |
| <code>grok/grok-4.5</code> | 94 | 5 | 14 | 1377 |
| <code>grok/grok-4.7</code> | 8 | 6 | 7 | 1377 |
| <code>mistral/mistral-ocr-4-1</code> | 48 | 25 | 25 | 1377 |
| <code>openai/gpt-5.6-terra</code> | 46 | 96 | 71 | 1377 |
| <code>openai/gpt-6-astra</code> | 17 | 25 | 30 | 1377 |
| <code>openai/gpt-6-luna</code> | 28 | 38 | 29 | 1377 |
| <code>openai/gpt-6.1-sol</code> | 22 | 26 | 28 | 1377 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 55.27/100.
- Best cloud service: `grok/grok-4.7` scored 98.47/100.
- The cheapest cloud provider was `deepinfra/deepseek-ai/DeepSeek-V4.1-Flash` at 0.1489¢ ($0.0015).
- Fastest local model: `tesseract/tesseract` at 2.12s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 6.46s.

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
