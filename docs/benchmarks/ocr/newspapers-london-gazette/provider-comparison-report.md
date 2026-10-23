# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/newspapers-london-gazette`
- Publisher canonical reference: `newspapers-london-gazette.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `db8c828e442cf84097361112b36aad1c625a04dbc21b4601e996c62dd4d3a9d0`.
- Publisher source: https://en.wikisource.org/w/index.php?title=Page%3AThe%20London%20Gazette%2019345.djvu%2F2&oldid=13200057&action=raw (revision `2015-01-17T16:08:01Z`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 94.39 | 5.61% | 1.24% | 2.28s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 2.28s | 94.39 | 5.61% | 1.24% | 2.28s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 94.39/100 quality score | 94.39 | 5.61% | 1.24% | 2.28s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0006 | 91.44 | 8.56% | 3.59% | 61.10s | $0.0006 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0009 | 99.58 | 0.42% | 0.07% | 13.09s | $0.0009 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0015 | 100.00 | 0.00% | 0.00% | 7.36s | $0.0015 |
| 4 | <code>openai/gpt-6-luna</code> | $0.0017 | 99.72 | 0.28% | 0.10% | 14.59s | $0.0017 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0040 | 98.18 | 1.82% | 0.17% | 4.54s | $0.0040 |
| 6 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 100.00 | 0.00% | 0.00% | 5.01s | $0.0040 |
| 7 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0045 | 97.90 | 2.10% | 0.22% | 118.31s | $0.0045 |
| 8 | <code>gemini/gemini-3.6-flash</code> | $0.0114 | 99.72 | 0.28% | 0.02% | 9.55s | $0.0114 |
| 9 | <code>gemini/gemini-3.8-flash</code> | $0.0116 | 100.00 | 0.00% | 0.00% | 14.02s | $0.0116 |
| 10 | <code>grok/grok-4.5</code> | $0.0130 | 98.32 | 1.68% | 0.14% | 12.12s | $0.0130 |
| 11 | <code>gemini/gemini-3.5-flash</code> | $0.0135 | 100.00 | 0.00% | 0.00% | 11.07s | $0.0135 |
| 12 | <code>openai/gpt-6.1-sol</code> | $0.0200 | 98.32 | 1.68% | 0.14% | 20.34s | $0.0200 |
| 13 | <code>openai/gpt-5.6-terra</code> | $0.0236 | 98.18 | 1.82% | 0.17% | 12.14s | $0.0236 |
| 14 | <code>anthropic/claude-sonnet-5-5</code> | $0.0304 | 100.00 | 0.00% | 0.00% | 13.28s | $0.0304 |
| 15 | <code>gemini/gemini-4-argon</code> | $0.0347 | 98.32 | 1.68% | 0.14% | 18.41s | $0.0347 |
| 16 | <code>grok/grok-4.7</code> | $0.0432 | 99.86 | 0.14% | 0.05% | 44.60s | $0.0432 |
| 17 | <code>anthropic/claude-opus-5-5</code> | $0.0608 | 100.00 | 0.00% | 0.00% | 16.56s | $0.0608 |
| 18 | <code>openai/gpt-6-astra</code> | $0.1001 | 98.32 | 1.68% | 0.14% | 10.65s | $0.1001 |
| 19 | <code>anthropic/claude-fable-5</code> | $0.1523 | 100.00 | 0.00% | 0.00% | 22.93s | $0.1523 |
| 20 | <code>anthropic/claude-fable-5-1</code> | $0.1523 | 100.00 | 0.00% | 0.00% | 17.56s | $0.1523 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 4.54s | 98.18 | 1.82% | 0.17% | 4.54s | $0.0040 |
| 2 | <code>mistral/mistral-ocr-4-1</code> | 5.01s | 100.00 | 0.00% | 0.00% | 5.01s | $0.0040 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 7.36s | 100.00 | 0.00% | 0.00% | 7.36s | $0.0015 |
| 4 | <code>gemini/gemini-3.6-flash</code> | 9.55s | 99.72 | 0.28% | 0.02% | 9.55s | $0.0114 |
| 5 | <code>openai/gpt-6-astra</code> | 10.65s | 98.32 | 1.68% | 0.14% | 10.65s | $0.1001 |
| 6 | <code>gemini/gemini-3.5-flash</code> | 11.07s | 100.00 | 0.00% | 0.00% | 11.07s | $0.0135 |
| 7 | <code>grok/grok-4.5</code> | 12.12s | 98.32 | 1.68% | 0.14% | 12.12s | $0.0130 |
| 8 | <code>openai/gpt-5.6-terra</code> | 12.14s | 98.18 | 1.82% | 0.17% | 12.14s | $0.0236 |
| 9 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 13.09s | 99.58 | 0.42% | 0.07% | 13.09s | $0.0009 |
| 10 | <code>anthropic/claude-sonnet-5-5</code> | 13.28s | 100.00 | 0.00% | 0.00% | 13.28s | $0.0304 |
| 11 | <code>gemini/gemini-3.8-flash</code> | 14.02s | 100.00 | 0.00% | 0.00% | 14.02s | $0.0116 |
| 12 | <code>openai/gpt-6-luna</code> | 14.59s | 99.72 | 0.28% | 0.10% | 14.59s | $0.0017 |
| 13 | <code>anthropic/claude-opus-5-5</code> | 16.56s | 100.00 | 0.00% | 0.00% | 16.56s | $0.0608 |
| 14 | <code>anthropic/claude-fable-5-1</code> | 17.56s | 100.00 | 0.00% | 0.00% | 17.56s | $0.1523 |
| 15 | <code>gemini/gemini-4-argon</code> | 18.41s | 98.32 | 1.68% | 0.14% | 18.41s | $0.0347 |
| 16 | <code>openai/gpt-6.1-sol</code> | 20.34s | 98.32 | 1.68% | 0.14% | 20.34s | $0.0200 |
| 17 | <code>anthropic/claude-fable-5</code> | 22.93s | 100.00 | 0.00% | 0.00% | 22.93s | $0.1523 |
| 18 | <code>grok/grok-4.7</code> | 44.60s | 99.86 | 0.14% | 0.05% | 44.60s | $0.0432 |
| 19 | <code>deepinfra/google/gemma-4-31B-it</code> | 61.10s | 91.44 | 8.56% | 3.59% | 61.10s | $0.0006 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 118.31s | 97.90 | 2.10% | 0.22% | 118.31s | $0.0045 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 22.93s | $0.1523 |
| 2 | <code>anthropic/claude-fable-5-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 17.56s | $0.1523 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 7.36s | $0.0015 |
| 4 | <code>anthropic/claude-opus-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 16.56s | $0.0608 |
| 5 | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 13.28s | $0.0304 |
| 6 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 11.07s | $0.0135 |
| 7 | <code>gemini/gemini-3.8-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 14.02s | $0.0116 |
| 8 | <code>mistral/mistral-ocr-4-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.01s | $0.0040 |
| 9 | <code>grok/grok-4.7</code> | 99.86/100 quality score | 99.86 | 0.14% | 0.05% | 44.60s | $0.0432 |
| 10 | <code>gemini/gemini-3.6-flash</code> | 99.72/100 quality score | 99.72 | 0.28% | 0.02% | 9.55s | $0.0114 |
| 11 | <code>openai/gpt-6-luna</code> | 99.72/100 quality score | 99.72 | 0.28% | 0.10% | 14.59s | $0.0017 |
| 12 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 99.58/100 quality score | 99.58 | 0.42% | 0.07% | 13.09s | $0.0009 |
| 13 | <code>gemini/gemini-4-argon</code> | 98.32/100 quality score | 98.32 | 1.68% | 0.14% | 18.41s | $0.0347 |
| 14 | <code>grok/grok-4.5</code> | 98.32/100 quality score | 98.32 | 1.68% | 0.14% | 12.12s | $0.0130 |
| 15 | <code>openai/gpt-6-astra</code> | 98.32/100 quality score | 98.32 | 1.68% | 0.14% | 10.65s | $0.1001 |
| 16 | <code>openai/gpt-6.1-sol</code> | 98.32/100 quality score | 98.32 | 1.68% | 0.14% | 20.34s | $0.0200 |
| 17 | <code>gemini/gemini-3.5-flash-lite</code> | 98.18/100 quality score | 98.18 | 1.82% | 0.17% | 4.54s | $0.0040 |
| 18 | <code>openai/gpt-5.6-terra</code> | 98.18/100 quality score | 98.18 | 1.82% | 0.17% | 12.14s | $0.0236 |
| 19 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 97.90/100 quality score | 97.90 | 2.10% | 0.22% | 118.31s | $0.0045 |
| 20 | <code>deepinfra/google/gemma-4-31B-it</code> | 91.44/100 quality score | 91.44 | 8.56% | 3.59% | 61.10s | $0.0006 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 94.39 | 5.61% | 1.24% | 2.28s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 22.93s | $0.1523 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 17.56s | $0.1523 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 7.36s | $0.0015 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 16.56s | $0.0608 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 13.28s | $0.0304 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 99.58 | 0.42% | 0.07% | 13.09s | $0.0009 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 91.44 | 8.56% | 3.59% | 61.10s | $0.0006 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 97.90 | 2.10% | 0.22% | 118.31s | $0.0045 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 11.07s | $0.0135 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 98.18 | 1.82% | 0.17% | 4.54s | $0.0040 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 99.72 | 0.28% | 0.02% | 9.55s | $0.0114 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 14.02s | $0.0116 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 98.32 | 1.68% | 0.14% | 18.41s | $0.0347 |
| <code>grok/grok-4.5</code> | Third-Party Service | 98.32 | 1.68% | 0.14% | 12.12s | $0.0130 |
| <code>grok/grok-4.7</code> | Third-Party Service | 99.86 | 0.14% | 0.05% | 44.60s | $0.0432 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.01s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 98.18 | 1.82% | 0.17% | 12.14s | $0.0236 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 98.32 | 1.68% | 0.14% | 10.65s | $0.1001 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 99.72 | 0.28% | 0.10% | 14.59s | $0.0017 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 98.32 | 1.68% | 0.14% | 20.34s | $0.0200 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 31 | 1 | 8 | 713 |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 0 | 713 |
| <code>anthropic/claude-fable-5-1</code> | 0 | 0 | 0 | 713 |
| <code>anthropic/claude-haiku-5-5</code> | 0 | 0 | 0 | 713 |
| <code>anthropic/claude-opus-5-5</code> | 0 | 0 | 0 | 713 |
| <code>anthropic/claude-sonnet-5-5</code> | 0 | 0 | 0 | 713 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 3 | 0 | 0 | 713 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 53 | 2 | 6 | 713 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 9 | 0 | 6 | 713 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 713 |
| <code>gemini/gemini-3.5-flash-lite</code> | 7 | 0 | 6 | 713 |
| <code>gemini/gemini-3.6-flash</code> | 1 | 0 | 1 | 713 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 0 | 0 | 713 |
| <code>gemini/gemini-4-argon</code> | 6 | 0 | 6 | 713 |
| <code>grok/grok-4.5</code> | 6 | 0 | 6 | 713 |
| <code>grok/grok-4.7</code> | 1 | 0 | 0 | 713 |
| <code>mistral/mistral-ocr-4-1</code> | 0 | 0 | 0 | 713 |
| <code>openai/gpt-5.6-terra</code> | 7 | 0 | 6 | 713 |
| <code>openai/gpt-6-astra</code> | 6 | 0 | 6 | 713 |
| <code>openai/gpt-6-luna</code> | 2 | 0 | 0 | 713 |
| <code>openai/gpt-6.1-sol</code> | 6 | 0 | 6 | 713 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 94.39/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0595¢ ($0.0006).
- Fastest local model: `tesseract/tesseract` at 2.28s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 4.54s.

## Lexical evaluation scope

Reference scope: full-page. Exhaustive lexical target for the declared input page/crop; drawing syntax is excluded where the publisher serialization declares it.

Headline WER/CER use the existing case-insensitive lexical normalization and declared reference order. Reading-order or serialization differences can increase edit distance; these scores do not measure layout or exact glyph/punctuation fidelity.

Text-only OCR does not establish column/region localization or page layout. An article crop does not establish whole-page reading order.

Literal numeric, punctuation and whitespace comparisons are representation-fidelity diagnostics. TSV tabs, span-continuation blanks, Markdown wrappers and source case conventions can differ without establishing a recognition error.

[Literal numeric, punctuation and alternate-reading diagnostics](evaluation-diagnostics.json) retain all source and provider text privately.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- Each provider received the same pinned original PNG/JPEG or the declared rendered-PNG baseline variant. Reference text, table cells, manuscript deletions and graph/layout annotations were never sent to providers. Text recognition is scored separately from unavailable cell, branch and page-geometry accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
