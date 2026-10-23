# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/numeric-tables-program-implementation`
- Publisher canonical reference: `numeric-tables-program-implementation.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `953f6c47d8c316c7d920a001002ef15b72760d26cca51b99109505128053071e`.
- Publisher source: https://raw.githubusercontent.com/ibm-aur-nlp/PubTabNet/8ffde9024bd331f5a61c3c549fdf30dd3c3e43a5/examples/PubTabNet_Examples.jsonl (revision `8ffde9024bd331f5a61c3c549fdf30dd3c3e43a5`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 2.76 | 97.24% | 90.86% | 0.20s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.20s | 2.76 | 97.24% | 90.86% | 0.20s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 2.76/100 quality score | 2.76 | 97.24% | 90.86% | 0.20s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0004 | 100.00 | 0.00% | 0.00% | 31.93s | $0.0004 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0005 | 96.01 | 3.99% | 6.34% | 8.89s | $0.0005 |
| 3 | <code>openai/gpt-6-luna</code> | $0.0009 | 98.77 | 1.23% | 2.80% | 14.06s | $0.0009 |
| 4 | <code>anthropic/claude-haiku-5-5</code> | $0.0011 | 99.69 | 0.31% | 0.08% | 7.04s | $0.0011 |
| 5 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0023 | 87.42 | 12.58% | 6.43% | 41.15s | $0.0023 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0025 | 100.00 | 0.00% | 0.00% | 2.42s | $0.0025 |
| 7 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 100.00 | 0.00% | 0.00% | 2.10s | $0.0040 |
| 8 | <code>gemini/gemini-3.8-flash</code> | $0.0079 | 100.00 | 0.00% | 0.00% | 7.03s | $0.0079 |
| 9 | <code>gemini/gemini-3.6-flash</code> | $0.0083 | 100.00 | 0.00% | 0.00% | 3.77s | $0.0083 |
| 10 | <code>gemini/gemini-3.5-flash</code> | $0.0093 | 100.00 | 0.00% | 0.00% | 4.11s | $0.0093 |
| 11 | <code>grok/grok-4.5</code> | $0.0108 | 88.96 | 11.04% | 6.43% | 17.60s | $0.0108 |
| 12 | <code>anthropic/claude-sonnet-5-5</code> | $0.0110 | 100.00 | 0.00% | 0.00% | 5.50s | $0.0110 |
| 13 | <code>openai/gpt-6.1-sol</code> | $0.0163 | 95.40 | 4.60% | 3.21% | 33.13s | $0.0163 |
| 14 | <code>openai/gpt-5.6-terra</code> | $0.0206 | 98.16 | 1.84% | 0.66% | 14.29s | $0.0206 |
| 15 | <code>anthropic/claude-opus-5-5</code> | $0.0218 | 100.00 | 0.00% | 0.00% | 7.10s | $0.0218 |
| 16 | <code>gemini/gemini-4-argon</code> | $0.0221 | 95.40 | 4.60% | 3.21% | 100.51s | $0.0221 |
| 17 | <code>grok/grok-4.7</code> | $0.0266 | 91.41 | 8.59% | 7.83% | 27.73s | $0.0266 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0393 | 95.40 | 4.60% | 3.21% | 13.88s | $0.0393 |
| 19 | <code>anthropic/claude-fable-5-1</code> | $0.0553 | 98.47 | 1.53% | 0.58% | 11.45s | $0.0553 |
| 20 | <code>anthropic/claude-fable-5</code> | $0.1090 | 98.16 | 1.84% | 1.32% | 18.89s | $0.1090 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-1</code> | 2.10s | 100.00 | 0.00% | 0.00% | 2.10s | $0.0040 |
| 2 | <code>gemini/gemini-3.5-flash-lite</code> | 2.42s | 100.00 | 0.00% | 0.00% | 2.42s | $0.0025 |
| 3 | <code>gemini/gemini-3.6-flash</code> | 3.77s | 100.00 | 0.00% | 0.00% | 3.77s | $0.0083 |
| 4 | <code>gemini/gemini-3.5-flash</code> | 4.11s | 100.00 | 0.00% | 0.00% | 4.11s | $0.0093 |
| 5 | <code>anthropic/claude-sonnet-5-5</code> | 5.50s | 100.00 | 0.00% | 0.00% | 5.50s | $0.0110 |
| 6 | <code>gemini/gemini-3.8-flash</code> | 7.03s | 100.00 | 0.00% | 0.00% | 7.03s | $0.0079 |
| 7 | <code>anthropic/claude-haiku-5-5</code> | 7.04s | 99.69 | 0.31% | 0.08% | 7.04s | $0.0011 |
| 8 | <code>anthropic/claude-opus-5-5</code> | 7.10s | 100.00 | 0.00% | 0.00% | 7.10s | $0.0218 |
| 9 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 8.89s | 96.01 | 3.99% | 6.34% | 8.89s | $0.0005 |
| 10 | <code>anthropic/claude-fable-5-1</code> | 11.45s | 98.47 | 1.53% | 0.58% | 11.45s | $0.0553 |
| 11 | <code>openai/gpt-6-astra</code> | 13.88s | 95.40 | 4.60% | 3.21% | 13.88s | $0.0393 |
| 12 | <code>openai/gpt-6-luna</code> | 14.06s | 98.77 | 1.23% | 2.80% | 14.06s | $0.0009 |
| 13 | <code>openai/gpt-5.6-terra</code> | 14.29s | 98.16 | 1.84% | 0.66% | 14.29s | $0.0206 |
| 14 | <code>grok/grok-4.5</code> | 17.60s | 88.96 | 11.04% | 6.43% | 17.60s | $0.0108 |
| 15 | <code>anthropic/claude-fable-5</code> | 18.89s | 98.16 | 1.84% | 1.32% | 18.89s | $0.1090 |
| 16 | <code>grok/grok-4.7</code> | 27.73s | 91.41 | 8.59% | 7.83% | 27.73s | $0.0266 |
| 17 | <code>deepinfra/google/gemma-4-31B-it</code> | 31.93s | 100.00 | 0.00% | 0.00% | 31.93s | $0.0004 |
| 18 | <code>openai/gpt-6.1-sol</code> | 33.13s | 95.40 | 4.60% | 3.21% | 33.13s | $0.0163 |
| 19 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 41.15s | 87.42 | 12.58% | 6.43% | 41.15s | $0.0023 |
| 20 | <code>gemini/gemini-4-argon</code> | 100.51s | 95.40 | 4.60% | 3.21% | 100.51s | $0.0221 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-opus-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 7.10s | $0.0218 |
| 2 | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.50s | $0.0110 |
| 3 | <code>deepinfra/google/gemma-4-31B-it</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 31.93s | $0.0004 |
| 4 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.11s | $0.0093 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.42s | $0.0025 |
| 6 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.77s | $0.0083 |
| 7 | <code>gemini/gemini-3.8-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 7.03s | $0.0079 |
| 8 | <code>mistral/mistral-ocr-4-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.10s | $0.0040 |
| 9 | <code>anthropic/claude-haiku-5-5</code> | 99.69/100 quality score | 99.69 | 0.31% | 0.08% | 7.04s | $0.0011 |
| 10 | <code>openai/gpt-6-luna</code> | 98.77/100 quality score | 98.77 | 1.23% | 2.80% | 14.06s | $0.0009 |
| 11 | <code>anthropic/claude-fable-5-1</code> | 98.47/100 quality score | 98.47 | 1.53% | 0.58% | 11.45s | $0.0553 |
| 12 | <code>openai/gpt-5.6-terra</code> | 98.16/100 quality score | 98.16 | 1.84% | 0.66% | 14.29s | $0.0206 |
| 13 | <code>anthropic/claude-fable-5</code> | 98.16/100 quality score | 98.16 | 1.84% | 1.32% | 18.89s | $0.1090 |
| 14 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 96.01/100 quality score | 96.01 | 3.99% | 6.34% | 8.89s | $0.0005 |
| 15 | <code>gemini/gemini-4-argon</code> | 95.40/100 quality score | 95.40 | 4.60% | 3.21% | 100.51s | $0.0221 |
| 16 | <code>openai/gpt-6-astra</code> | 95.40/100 quality score | 95.40 | 4.60% | 3.21% | 13.88s | $0.0393 |
| 17 | <code>openai/gpt-6.1-sol</code> | 95.40/100 quality score | 95.40 | 4.60% | 3.21% | 33.13s | $0.0163 |
| 18 | <code>grok/grok-4.7</code> | 91.41/100 quality score | 91.41 | 8.59% | 7.83% | 27.73s | $0.0266 |
| 19 | <code>grok/grok-4.5</code> | 88.96/100 quality score | 88.96 | 11.04% | 6.43% | 17.60s | $0.0108 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 87.42/100 quality score | 87.42 | 12.58% | 6.43% | 41.15s | $0.0023 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 2.76 | 97.24% | 90.86% | 0.20s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 98.16 | 1.84% | 1.32% | 18.89s | $0.1090 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 98.47 | 1.53% | 0.58% | 11.45s | $0.0553 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 99.69 | 0.31% | 0.08% | 7.04s | $0.0011 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 7.10s | $0.0218 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.50s | $0.0110 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 96.01 | 3.99% | 6.34% | 8.89s | $0.0005 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 31.93s | $0.0004 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 87.42 | 12.58% | 6.43% | 41.15s | $0.0023 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.11s | $0.0093 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.42s | $0.0025 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.77s | $0.0083 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 7.03s | $0.0079 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 95.40 | 4.60% | 3.21% | 100.51s | $0.0221 |
| <code>grok/grok-4.5</code> | Third-Party Service | 88.96 | 11.04% | 6.43% | 17.60s | $0.0108 |
| <code>grok/grok-4.7</code> | Third-Party Service | 91.41 | 8.59% | 7.83% | 27.73s | $0.0266 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.10s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 98.16 | 1.84% | 0.66% | 14.29s | $0.0206 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 95.40 | 4.60% | 3.21% | 13.88s | $0.0393 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 98.77 | 1.23% | 2.80% | 14.06s | $0.0009 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 95.40 | 4.60% | 3.21% | 33.13s | $0.0163 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 21 | 296 | 0 | 326 |
| <code>anthropic/claude-fable-5</code> | 3 | 3 | 0 | 326 |
| <code>anthropic/claude-fable-5-1</code> | 5 | 0 | 0 | 326 |
| <code>anthropic/claude-haiku-5-5</code> | 1 | 0 | 0 | 326 |
| <code>anthropic/claude-opus-5-5</code> | 0 | 0 | 0 | 326 |
| <code>anthropic/claude-sonnet-5-5</code> | 0 | 0 | 0 | 326 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 1 | 2 | 10 | 326 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 0 | 0 | 0 | 326 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 35 | 0 | 6 | 326 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 326 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 326 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 326 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 0 | 0 | 326 |
| <code>gemini/gemini-4-argon</code> | 11 | 2 | 2 | 326 |
| <code>grok/grok-4.5</code> | 32 | 2 | 2 | 326 |
| <code>grok/grok-4.7</code> | 20 | 4 | 4 | 326 |
| <code>mistral/mistral-ocr-4-1</code> | 0 | 0 | 0 | 326 |
| <code>openai/gpt-5.6-terra</code> | 6 | 0 | 0 | 326 |
| <code>openai/gpt-6-astra</code> | 11 | 2 | 2 | 326 |
| <code>openai/gpt-6-luna</code> | 0 | 2 | 2 | 326 |
| <code>openai/gpt-6.1-sol</code> | 11 | 2 | 2 | 326 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 2.76/100.
- Best cloud service: `anthropic/claude-opus-5-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0380¢ ($0.0004).
- Fastest local model: `tesseract/tesseract` at 0.20s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 2.10s.

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
