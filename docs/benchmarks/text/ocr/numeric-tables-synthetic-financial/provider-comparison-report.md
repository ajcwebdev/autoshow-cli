# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/numeric-tables-synthetic-financial`
- Publisher canonical reference: `numeric-tables-synthetic-financial.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `c2e3e6a570084581986032775a83299239bb96ede8e4e31183d00dc23148d455`.
- Publisher source: https://ds4sd-public-artifacts.s3.eu-de.cloud-object-storage.appdomain.cloud/datasets/synthtabnet_public/samples.zip (revision `d4266dc3094e42e82f3b30060d22f3e4e394093c`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 0.00 | 100.00% | 100.00% | 0.14s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.14s | 0.00 | 100.00% | 100.00% | 0.14s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.00/100 quality score | 0.00 | 100.00% | 100.00% | 0.14s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0006 | 98.72 | 1.28% | 0.57% | 51.22s | $0.0006 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0007 | 99.27 | 0.73% | 0.60% | 11.38s | $0.0007 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0013 | 100.00 | 0.00% | 0.00% | 7.97s | $0.0013 |
| 4 | <code>openai/gpt-6-luna</code> | $0.0029 | 97.81 | 2.19% | 0.98% | 49.62s | $0.0029 |
| 5 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0030 | 87.59 | 12.41% | 7.86% | 254.21s | $0.0030 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0036 | 100.00 | 0.00% | 0.00% | 3.12s | $0.0036 |
| 7 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 100.00 | 0.00% | 0.00% | 3.09s | $0.0040 |
| 8 | <code>gemini/gemini-3.6-flash</code> | $0.0108 | 100.00 | 0.00% | 0.00% | 5.11s | $0.0108 |
| 9 | <code>gemini/gemini-3.8-flash</code> | $0.0113 | 100.00 | 0.00% | 0.00% | 8.72s | $0.0113 |
| 10 | <code>gemini/gemini-3.5-flash</code> | $0.0126 | 100.00 | 0.00% | 0.00% | 5.15s | $0.0126 |
| 11 | <code>anthropic/claude-sonnet-5-5</code> | $0.0141 | 100.00 | 0.00% | 0.00% | 9.11s | $0.0141 |
| 12 | <code>grok/grok-4.5</code> | $0.0148 | 88.87 | 11.13% | 6.27% | 26.28s | $0.0148 |
| 13 | <code>openai/gpt-6.1-sol</code> | $0.0149 | 99.64 | 0.36% | 0.11% | 25.02s | $0.0149 |
| 14 | <code>anthropic/claude-opus-5-5</code> | $0.0286 | 100.00 | 0.00% | 0.00% | 9.44s | $0.0286 |
| 15 | <code>gemini/gemini-4-argon</code> | $0.0298 | 100.00 | 0.00% | 0.00% | 16.05s | $0.0298 |
| 16 | <code>openai/gpt-5.6-terra</code> | $0.0528 | 94.89 | 5.11% | 2.80% | 40.51s | $0.0528 |
| 17 | <code>openai/gpt-6-astra</code> | $0.0682 | 95.80 | 4.20% | 1.59% | 23.74s | $0.0682 |
| 18 | <code>anthropic/claude-fable-5-1</code> | $0.0713 | 99.64 | 0.36% | 0.11% | 11.33s | $0.0713 |
| 19 | <code>grok/grok-4.7</code> | $0.1068 | 91.42 | 8.58% | 3.63% | 142.01s | $0.1068 |
| 20 | <code>anthropic/claude-fable-5</code> | $0.1548 | 99.45 | 0.55% | 0.11% | 29.90s | $0.1548 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-1</code> | 3.09s | 100.00 | 0.00% | 0.00% | 3.09s | $0.0040 |
| 2 | <code>gemini/gemini-3.5-flash-lite</code> | 3.12s | 100.00 | 0.00% | 0.00% | 3.12s | $0.0036 |
| 3 | <code>gemini/gemini-3.6-flash</code> | 5.11s | 100.00 | 0.00% | 0.00% | 5.11s | $0.0108 |
| 4 | <code>gemini/gemini-3.5-flash</code> | 5.15s | 100.00 | 0.00% | 0.00% | 5.15s | $0.0126 |
| 5 | <code>anthropic/claude-haiku-5-5</code> | 7.97s | 100.00 | 0.00% | 0.00% | 7.97s | $0.0013 |
| 6 | <code>gemini/gemini-3.8-flash</code> | 8.72s | 100.00 | 0.00% | 0.00% | 8.72s | $0.0113 |
| 7 | <code>anthropic/claude-sonnet-5-5</code> | 9.11s | 100.00 | 0.00% | 0.00% | 9.11s | $0.0141 |
| 8 | <code>anthropic/claude-opus-5-5</code> | 9.44s | 100.00 | 0.00% | 0.00% | 9.44s | $0.0286 |
| 9 | <code>anthropic/claude-fable-5-1</code> | 11.33s | 99.64 | 0.36% | 0.11% | 11.33s | $0.0713 |
| 10 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 11.38s | 99.27 | 0.73% | 0.60% | 11.38s | $0.0007 |
| 11 | <code>gemini/gemini-4-argon</code> | 16.05s | 100.00 | 0.00% | 0.00% | 16.05s | $0.0298 |
| 12 | <code>openai/gpt-6-astra</code> | 23.74s | 95.80 | 4.20% | 1.59% | 23.74s | $0.0682 |
| 13 | <code>openai/gpt-6.1-sol</code> | 25.02s | 99.64 | 0.36% | 0.11% | 25.02s | $0.0149 |
| 14 | <code>grok/grok-4.5</code> | 26.28s | 88.87 | 11.13% | 6.27% | 26.28s | $0.0148 |
| 15 | <code>anthropic/claude-fable-5</code> | 29.90s | 99.45 | 0.55% | 0.11% | 29.90s | $0.1548 |
| 16 | <code>openai/gpt-5.6-terra</code> | 40.51s | 94.89 | 5.11% | 2.80% | 40.51s | $0.0528 |
| 17 | <code>openai/gpt-6-luna</code> | 49.62s | 97.81 | 2.19% | 0.98% | 49.62s | $0.0029 |
| 18 | <code>deepinfra/google/gemma-4-31B-it</code> | 51.22s | 98.72 | 1.28% | 0.57% | 51.22s | $0.0006 |
| 19 | <code>grok/grok-4.7</code> | 142.01s | 91.42 | 8.58% | 3.63% | 142.01s | $0.1068 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 254.21s | 87.59 | 12.41% | 7.86% | 254.21s | $0.0030 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-haiku-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 7.97s | $0.0013 |
| 2 | <code>anthropic/claude-opus-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 9.44s | $0.0286 |
| 3 | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 9.11s | $0.0141 |
| 4 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.15s | $0.0126 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.12s | $0.0036 |
| 6 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.11s | $0.0108 |
| 7 | <code>gemini/gemini-3.8-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 8.72s | $0.0113 |
| 8 | <code>gemini/gemini-4-argon</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 16.05s | $0.0298 |
| 9 | <code>mistral/mistral-ocr-4-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.09s | $0.0040 |
| 10 | <code>anthropic/claude-fable-5-1</code> | 99.64/100 quality score | 99.64 | 0.36% | 0.11% | 11.33s | $0.0713 |
| 11 | <code>openai/gpt-6.1-sol</code> | 99.64/100 quality score | 99.64 | 0.36% | 0.11% | 25.02s | $0.0149 |
| 12 | <code>anthropic/claude-fable-5</code> | 99.45/100 quality score | 99.45 | 0.55% | 0.11% | 29.90s | $0.1548 |
| 13 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 99.27/100 quality score | 99.27 | 0.73% | 0.60% | 11.38s | $0.0007 |
| 14 | <code>deepinfra/google/gemma-4-31B-it</code> | 98.72/100 quality score | 98.72 | 1.28% | 0.57% | 51.22s | $0.0006 |
| 15 | <code>openai/gpt-6-luna</code> | 97.81/100 quality score | 97.81 | 2.19% | 0.98% | 49.62s | $0.0029 |
| 16 | <code>openai/gpt-6-astra</code> | 95.80/100 quality score | 95.80 | 4.20% | 1.59% | 23.74s | $0.0682 |
| 17 | <code>openai/gpt-5.6-terra</code> | 94.89/100 quality score | 94.89 | 5.11% | 2.80% | 40.51s | $0.0528 |
| 18 | <code>grok/grok-4.7</code> | 91.42/100 quality score | 91.42 | 8.58% | 3.63% | 142.01s | $0.1068 |
| 19 | <code>grok/grok-4.5</code> | 88.87/100 quality score | 88.87 | 11.13% | 6.27% | 26.28s | $0.0148 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 87.59/100 quality score | 87.59 | 12.41% | 7.86% | 254.21s | $0.0030 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 0.00 | 100.00% | 100.00% | 0.14s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 99.45 | 0.55% | 0.11% | 29.90s | $0.1548 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 99.64 | 0.36% | 0.11% | 11.33s | $0.0713 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 7.97s | $0.0013 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 9.44s | $0.0286 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 9.11s | $0.0141 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 99.27 | 0.73% | 0.60% | 11.38s | $0.0007 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 98.72 | 1.28% | 0.57% | 51.22s | $0.0006 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 87.59 | 12.41% | 7.86% | 254.21s | $0.0030 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.15s | $0.0126 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.12s | $0.0036 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.11s | $0.0108 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 8.72s | $0.0113 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 16.05s | $0.0298 |
| <code>grok/grok-4.5</code> | Third-Party Service | 88.87 | 11.13% | 6.27% | 26.28s | $0.0148 |
| <code>grok/grok-4.7</code> | Third-Party Service | 91.42 | 8.58% | 3.63% | 142.01s | $0.1068 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.09s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 94.89 | 5.11% | 2.80% | 40.51s | $0.0528 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 95.80 | 4.20% | 1.59% | 23.74s | $0.0682 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 97.81 | 2.19% | 0.98% | 49.62s | $0.0029 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 99.64 | 0.36% | 0.11% | 25.02s | $0.0149 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 0 | 548 | 0 | 548 |
| <code>anthropic/claude-fable-5</code> | 3 | 0 | 0 | 548 |
| <code>anthropic/claude-fable-5-1</code> | 2 | 0 | 0 | 548 |
| <code>anthropic/claude-haiku-5-5</code> | 0 | 0 | 0 | 548 |
| <code>anthropic/claude-opus-5-5</code> | 0 | 0 | 0 | 548 |
| <code>anthropic/claude-sonnet-5-5</code> | 0 | 0 | 0 | 548 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 2 | 1 | 1 | 548 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 4 | 2 | 1 | 548 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 41 | 12 | 15 | 548 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 548 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 548 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 548 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 0 | 0 | 548 |
| <code>gemini/gemini-4-argon</code> | 0 | 0 | 0 | 548 |
| <code>grok/grok-4.5</code> | 34 | 27 | 0 | 548 |
| <code>grok/grok-4.7</code> | 36 | 7 | 4 | 548 |
| <code>mistral/mistral-ocr-4-1</code> | 0 | 0 | 0 | 548 |
| <code>openai/gpt-5.6-terra</code> | 20 | 2 | 6 | 548 |
| <code>openai/gpt-6-astra</code> | 20 | 0 | 3 | 548 |
| <code>openai/gpt-6-luna</code> | 8 | 4 | 0 | 548 |
| <code>openai/gpt-6.1-sol</code> | 2 | 0 | 0 | 548 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 0.00/100.
- Best cloud service: `anthropic/claude-haiku-5-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0551¢ ($0.0006).
- Fastest local model: `tesseract/tesseract` at 0.14s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 3.09s.

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
