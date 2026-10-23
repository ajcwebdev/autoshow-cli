# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-newspaper-expansion/benchmark-runs/newspapers-expansion-new-york-times-1929-10-24-p31`
- Publisher canonical reference: `normalized-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 16 (1 local, 15 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `4c48c8b9b2a2671f077aed24ba71f0f5def695cb243005b8a656bc5a8c07f7d7`.
- Publisher source: https://en.wikisource.org/w/index.php?title=Page%3AThe%20New%20York%20Times%2C%201929-10-24.pdf%2F31&oldid=15532401&action=raw (revision `15532401`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 48.81 | 51.19% | 83.44% | 15.64s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 15.64s | 48.81 | 51.19% | 83.44% | 15.64s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 48.81/100 quality score | 48.81 | 51.19% | 83.44% | 15.64s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-haiku-5-5</code> | $0.0014 | 4.06 | 95.94% | 97.63% | 8.69s | $0.0014 |
| 2 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0014 | 2.86 | 97.14% | 96.91% | 3.37s | $0.0014 |
| 3 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0015 | 6.18 | 93.82% | 97.99% | 141.53s | $0.0015 |
| 4 | <code>openai/gpt-6-luna</code> | $0.0025 | 17.27 | 82.73% | 92.29% | 42.72s | $0.0025 |
| 5 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 6.75 | 93.25% | 89.43% | 35.69s | $0.0040 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0043 | 12.11 | 87.89% | 92.55% | 72.53s | $0.0043 |
| 7 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0095 | 18.17 | 81.83% | 93.16% | 85.25s | $0.0095 |
| 8 | <code>openai/gpt-5.6-terra</code> | $0.0179 | 3.28 | 96.72% | 99.17% | 13.12s | $0.0179 |
| 9 | <code>anthropic/claude-sonnet-5-5</code> | $0.0279 | 4.82 | 95.18% | 97.98% | 11.56s | $0.0279 |
| 10 | <code>openai/gpt-6.1-sol</code> | $0.1181 | 84.52 | 15.48% | 10.92% | 301.29s | $0.1181 |
| 11 | <code>gemini/gemini-4-argon</code> | $0.2483 | 74.37 | 25.63% | 20.46% | 142.34s | $0.2483 |
| 12 | <code>anthropic/claude-opus-5-5</code> | $0.3442 | 63.38 | 36.62% | 57.84% | 125.99s | $0.3442 |
| 13 | <code>openai/gpt-6-astra</code> | $0.5220 | 91.10 | 8.90% | 10.09% | 344.79s | $0.5220 |
| 14 | <code>anthropic/claude-fable-5</code> | $0.8637 | 92.73 | 7.27% | 9.24% | 188.53s | $0.8637 |
| 15 | <code>anthropic/claude-fable-5-1</code> | $0.8877 | 92.35 | 7.65% | 13.77% | 177.39s | $0.8877 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 3.37s | 2.86 | 97.14% | 96.91% | 3.37s | $0.0014 |
| 2 | <code>anthropic/claude-haiku-5-5</code> | 8.69s | 4.06 | 95.94% | 97.63% | 8.69s | $0.0014 |
| 3 | <code>anthropic/claude-sonnet-5-5</code> | 11.56s | 4.82 | 95.18% | 97.98% | 11.56s | $0.0279 |
| 4 | <code>openai/gpt-5.6-terra</code> | 13.12s | 3.28 | 96.72% | 99.17% | 13.12s | $0.0179 |
| 5 | <code>mistral/mistral-ocr-4-1</code> | 35.69s | 6.75 | 93.25% | 89.43% | 35.69s | $0.0040 |
| 6 | <code>openai/gpt-6-luna</code> | 42.72s | 17.27 | 82.73% | 92.29% | 42.72s | $0.0025 |
| 7 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 72.53s | 12.11 | 87.89% | 92.55% | 72.53s | $0.0043 |
| 8 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 85.25s | 18.17 | 81.83% | 93.16% | 85.25s | $0.0095 |
| 9 | <code>anthropic/claude-opus-5-5</code> | 125.99s | 63.38 | 36.62% | 57.84% | 125.99s | $0.3442 |
| 10 | <code>deepinfra/google/gemma-4-31B-it</code> | 141.53s | 6.18 | 93.82% | 97.99% | 141.53s | $0.0015 |
| 11 | <code>gemini/gemini-4-argon</code> | 142.34s | 74.37 | 25.63% | 20.46% | 142.34s | $0.2483 |
| 12 | <code>anthropic/claude-fable-5-1</code> | 177.39s | 92.35 | 7.65% | 13.77% | 177.39s | $0.8877 |
| 13 | <code>anthropic/claude-fable-5</code> | 188.53s | 92.73 | 7.27% | 9.24% | 188.53s | $0.8637 |
| 14 | <code>openai/gpt-6.1-sol</code> | 301.29s | 84.52 | 15.48% | 10.92% | 301.29s | $0.1181 |
| 15 | <code>openai/gpt-6-astra</code> | 344.79s | 91.10 | 8.90% | 10.09% | 344.79s | $0.5220 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 92.73/100 quality score | 92.73 | 7.27% | 9.24% | 188.53s | $0.8637 |
| 2 | <code>anthropic/claude-fable-5-1</code> | 92.35/100 quality score | 92.35 | 7.65% | 13.77% | 177.39s | $0.8877 |
| 3 | <code>openai/gpt-6-astra</code> | 91.10/100 quality score | 91.10 | 8.90% | 10.09% | 344.79s | $0.5220 |
| 4 | <code>openai/gpt-6.1-sol</code> | 84.52/100 quality score | 84.52 | 15.48% | 10.92% | 301.29s | $0.1181 |
| 5 | <code>gemini/gemini-4-argon</code> | 74.37/100 quality score | 74.37 | 25.63% | 20.46% | 142.34s | $0.2483 |
| 6 | <code>anthropic/claude-opus-5-5</code> | 63.38/100 quality score | 63.38 | 36.62% | 57.84% | 125.99s | $0.3442 |
| 7 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 18.17/100 quality score | 18.17 | 81.83% | 93.16% | 85.25s | $0.0095 |
| 8 | <code>openai/gpt-6-luna</code> | 17.27/100 quality score | 17.27 | 82.73% | 92.29% | 42.72s | $0.0025 |
| 9 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 12.11/100 quality score | 12.11 | 87.89% | 92.55% | 72.53s | $0.0043 |
| 10 | <code>mistral/mistral-ocr-4-1</code> | 6.75/100 quality score | 6.75 | 93.25% | 89.43% | 35.69s | $0.0040 |
| 11 | <code>deepinfra/google/gemma-4-31B-it</code> | 6.18/100 quality score | 6.18 | 93.82% | 97.99% | 141.53s | $0.0015 |
| 12 | <code>anthropic/claude-sonnet-5-5</code> | 4.82/100 quality score | 4.82 | 95.18% | 97.98% | 11.56s | $0.0279 |
| 13 | <code>anthropic/claude-haiku-5-5</code> | 4.06/100 quality score | 4.06 | 95.94% | 97.63% | 8.69s | $0.0014 |
| 14 | <code>openai/gpt-5.6-terra</code> | 3.28/100 quality score | 3.28 | 96.72% | 99.17% | 13.12s | $0.0179 |
| 15 | <code>gemini/gemini-3.5-flash-lite</code> | 2.86/100 quality score | 2.86 | 97.14% | 96.91% | 3.37s | $0.0014 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 48.81 | 51.19% | 83.44% | 15.64s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 92.73 | 7.27% | 9.24% | 188.53s | $0.8637 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 92.35 | 7.65% | 13.77% | 177.39s | $0.8877 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 4.06 | 95.94% | 97.63% | 8.69s | $0.0014 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 63.38 | 36.62% | 57.84% | 125.99s | $0.3442 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 4.82 | 95.18% | 97.98% | 11.56s | $0.0279 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 12.11 | 87.89% | 92.55% | 72.53s | $0.0043 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 6.18 | 93.82% | 97.99% | 141.53s | $0.0015 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 18.17 | 81.83% | 93.16% | 85.25s | $0.0095 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 2.86 | 97.14% | 96.91% | 3.37s | $0.0014 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 74.37 | 25.63% | 20.46% | 142.34s | $0.2483 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 6.75 | 93.25% | 89.43% | 35.69s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 3.28 | 96.72% | 99.17% | 13.12s | $0.0179 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 91.10 | 8.90% | 10.09% | 344.79s | $0.5220 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 17.27 | 82.73% | 92.29% | 42.72s | $0.0025 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 84.52 | 15.48% | 10.92% | 301.29s | $0.1181 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 1918 | 1425 | 436 | 7382 |
| <code>anthropic/claude-fable-5</code> | 84 | 235 | 218 | 7382 |
| <code>anthropic/claude-fable-5-1</code> | 71 | 279 | 215 | 7382 |
| <code>anthropic/claude-haiku-5-5</code> | 133 | 6949 | 0 | 7382 |
| <code>anthropic/claude-opus-5-5</code> | 706 | 979 | 1018 | 7382 |
| <code>anthropic/claude-sonnet-5-5</code> | 181 | 6845 | 0 | 7382 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 4371 | 2079 | 38 | 7382 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 1469 | 5454 | 3 | 7382 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 1086 | 4934 | 21 | 7382 |
| <code>gemini/gemini-3.5-flash-lite</code> | 12 | 7150 | 9 | 7382 |
| <code>gemini/gemini-4-argon</code> | 1125 | 256 | 511 | 7382 |
| <code>mistral/mistral-ocr-4-1</code> | 6482 | 83 | 319 | 7382 |
| <code>openai/gpt-5.6-terra</code> | 135 | 7003 | 2 | 7382 |
| <code>openai/gpt-6-astra</code> | 211 | 216 | 230 | 7382 |
| <code>openai/gpt-6-luna</code> | 331 | 5743 | 33 | 7382 |
| <code>openai/gpt-6.1-sol</code> | 455 | 221 | 467 | 7382 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 48.81/100.
- Best cloud service: `anthropic/claude-fable-5` scored 92.73/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.1393¢ ($0.0014).
- Fastest local model: `tesseract/tesseract` at 15.64s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 3.37s.

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
