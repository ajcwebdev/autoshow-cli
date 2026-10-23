# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/newspapers-leader`
- Publisher canonical reference: `newspapers-leader.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `87cde1ccc10eb3cec39d04ca4385a49964d39b4c7e7d2df1fe043551f6d594ed`.
- Publisher source: https://ndownloader.figshare.com/files/52256378 (revision `10.5522/04/28381610.v1`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 66.05 | 33.95% | 16.98% | 1.21s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 1.21s | 66.05 | 33.95% | 16.98% | 1.21s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 66.05/100 quality score | 66.05 | 33.95% | 16.98% | 1.21s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0004 | 98.02 | 1.98% | 1.05% | 36.32s | $0.0004 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0006 | 97.88 | 2.12% | 1.03% | 6.32s | $0.0006 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0007 | 95.19 | 4.81% | 0.50% | 4.44s | $0.0007 |
| 4 | <code>openai/gpt-6-luna</code> | $0.0021 | 94.91 | 5.09% | 1.00% | 34.41s | $0.0021 |
| 5 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0024 | 98.87 | 1.13% | 0.33% | 126.81s | $0.0024 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0027 | 100.00 | 0.00% | 0.00% | 2.92s | $0.0027 |
| 7 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 95.47 | 4.53% | 0.73% | 2.04s | $0.0040 |
| 8 | <code>gemini/gemini-3.6-flash</code> | $0.0080 | 100.00 | 0.00% | 0.00% | 4.25s | $0.0080 |
| 9 | <code>gemini/gemini-3.8-flash</code> | $0.0086 | 100.00 | 0.00% | 0.00% | 8.03s | $0.0086 |
| 10 | <code>gemini/gemini-3.5-flash</code> | $0.0092 | 100.00 | 0.00% | 0.00% | 3.99s | $0.0092 |
| 11 | <code>openai/gpt-6.1-sol</code> | $0.0104 | 99.15 | 0.85% | 0.53% | 21.21s | $0.0104 |
| 12 | <code>anthropic/claude-sonnet-5-5</code> | $0.0141 | 96.04 | 3.96% | 0.35% | 9.88s | $0.0141 |
| 13 | <code>grok/grok-4.5</code> | $0.0199 | 99.01 | 0.99% | 0.15% | 30.05s | $0.0199 |
| 14 | <code>gemini/gemini-4-argon</code> | $0.0244 | 100.00 | 0.00% | 0.00% | 10.64s | $0.0244 |
| 15 | <code>grok/grok-4.7</code> | $0.0254 | 96.04 | 3.96% | 0.35% | 28.15s | $0.0254 |
| 16 | <code>anthropic/claude-opus-5-5</code> | $0.0281 | 96.04 | 3.96% | 0.35% | 10.76s | $0.0281 |
| 17 | <code>openai/gpt-5.6-terra</code> | $0.0344 | 94.06 | 5.94% | 1.40% | 29.49s | $0.0344 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0530 | 99.43 | 0.57% | 0.25% | 13.45s | $0.0530 |
| 19 | <code>anthropic/claude-fable-5-1</code> | $0.0703 | 96.04 | 3.96% | 0.35% | 10.47s | $0.0703 |
| 20 | <code>anthropic/claude-fable-5</code> | $0.0711 | 96.04 | 3.96% | 0.35% | 16.35s | $0.0711 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-1</code> | 2.04s | 95.47 | 4.53% | 0.73% | 2.04s | $0.0040 |
| 2 | <code>gemini/gemini-3.5-flash-lite</code> | 2.92s | 100.00 | 0.00% | 0.00% | 2.92s | $0.0027 |
| 3 | <code>gemini/gemini-3.5-flash</code> | 3.99s | 100.00 | 0.00% | 0.00% | 3.99s | $0.0092 |
| 4 | <code>gemini/gemini-3.6-flash</code> | 4.25s | 100.00 | 0.00% | 0.00% | 4.25s | $0.0080 |
| 5 | <code>anthropic/claude-haiku-5-5</code> | 4.44s | 95.19 | 4.81% | 0.50% | 4.44s | $0.0007 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 6.32s | 97.88 | 2.12% | 1.03% | 6.32s | $0.0006 |
| 7 | <code>gemini/gemini-3.8-flash</code> | 8.03s | 100.00 | 0.00% | 0.00% | 8.03s | $0.0086 |
| 8 | <code>anthropic/claude-sonnet-5-5</code> | 9.88s | 96.04 | 3.96% | 0.35% | 9.88s | $0.0141 |
| 9 | <code>anthropic/claude-fable-5-1</code> | 10.47s | 96.04 | 3.96% | 0.35% | 10.47s | $0.0703 |
| 10 | <code>gemini/gemini-4-argon</code> | 10.64s | 100.00 | 0.00% | 0.00% | 10.64s | $0.0244 |
| 11 | <code>anthropic/claude-opus-5-5</code> | 10.76s | 96.04 | 3.96% | 0.35% | 10.76s | $0.0281 |
| 12 | <code>openai/gpt-6-astra</code> | 13.45s | 99.43 | 0.57% | 0.25% | 13.45s | $0.0530 |
| 13 | <code>anthropic/claude-fable-5</code> | 16.35s | 96.04 | 3.96% | 0.35% | 16.35s | $0.0711 |
| 14 | <code>openai/gpt-6.1-sol</code> | 21.21s | 99.15 | 0.85% | 0.53% | 21.21s | $0.0104 |
| 15 | <code>grok/grok-4.7</code> | 28.15s | 96.04 | 3.96% | 0.35% | 28.15s | $0.0254 |
| 16 | <code>openai/gpt-5.6-terra</code> | 29.49s | 94.06 | 5.94% | 1.40% | 29.49s | $0.0344 |
| 17 | <code>grok/grok-4.5</code> | 30.05s | 99.01 | 0.99% | 0.15% | 30.05s | $0.0199 |
| 18 | <code>openai/gpt-6-luna</code> | 34.41s | 94.91 | 5.09% | 1.00% | 34.41s | $0.0021 |
| 19 | <code>deepinfra/google/gemma-4-31B-it</code> | 36.32s | 98.02 | 1.98% | 1.05% | 36.32s | $0.0004 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 126.81s | 98.87 | 1.13% | 0.33% | 126.81s | $0.0024 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.99s | $0.0092 |
| 2 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.92s | $0.0027 |
| 3 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.25s | $0.0080 |
| 4 | <code>gemini/gemini-3.8-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 8.03s | $0.0086 |
| 5 | <code>gemini/gemini-4-argon</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 10.64s | $0.0244 |
| 6 | <code>openai/gpt-6-astra</code> | 99.43/100 quality score | 99.43 | 0.57% | 0.25% | 13.45s | $0.0530 |
| 7 | <code>openai/gpt-6.1-sol</code> | 99.15/100 quality score | 99.15 | 0.85% | 0.53% | 21.21s | $0.0104 |
| 8 | <code>grok/grok-4.5</code> | 99.01/100 quality score | 99.01 | 0.99% | 0.15% | 30.05s | $0.0199 |
| 9 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 98.87/100 quality score | 98.87 | 1.13% | 0.33% | 126.81s | $0.0024 |
| 10 | <code>deepinfra/google/gemma-4-31B-it</code> | 98.02/100 quality score | 98.02 | 1.98% | 1.05% | 36.32s | $0.0004 |
| 11 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 97.88/100 quality score | 97.88 | 2.12% | 1.03% | 6.32s | $0.0006 |
| 12 | <code>anthropic/claude-fable-5</code> | 96.04/100 quality score | 96.04 | 3.96% | 0.35% | 16.35s | $0.0711 |
| 13 | <code>anthropic/claude-fable-5-1</code> | 96.04/100 quality score | 96.04 | 3.96% | 0.35% | 10.47s | $0.0703 |
| 14 | <code>anthropic/claude-opus-5-5</code> | 96.04/100 quality score | 96.04 | 3.96% | 0.35% | 10.76s | $0.0281 |
| 15 | <code>anthropic/claude-sonnet-5-5</code> | 96.04/100 quality score | 96.04 | 3.96% | 0.35% | 9.88s | $0.0141 |
| 16 | <code>grok/grok-4.7</code> | 96.04/100 quality score | 96.04 | 3.96% | 0.35% | 28.15s | $0.0254 |
| 17 | <code>mistral/mistral-ocr-4-1</code> | 95.47/100 quality score | 95.47 | 4.53% | 0.73% | 2.04s | $0.0040 |
| 18 | <code>anthropic/claude-haiku-5-5</code> | 95.19/100 quality score | 95.19 | 4.81% | 0.50% | 4.44s | $0.0007 |
| 19 | <code>openai/gpt-6-luna</code> | 94.91/100 quality score | 94.91 | 5.09% | 1.00% | 34.41s | $0.0021 |
| 20 | <code>openai/gpt-5.6-terra</code> | 94.06/100 quality score | 94.06 | 5.94% | 1.40% | 29.49s | $0.0344 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 66.05 | 33.95% | 16.98% | 1.21s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 96.04 | 3.96% | 0.35% | 16.35s | $0.0711 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 96.04 | 3.96% | 0.35% | 10.47s | $0.0703 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 95.19 | 4.81% | 0.50% | 4.44s | $0.0007 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 96.04 | 3.96% | 0.35% | 10.76s | $0.0281 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 96.04 | 3.96% | 0.35% | 9.88s | $0.0141 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 97.88 | 2.12% | 1.03% | 6.32s | $0.0006 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 98.02 | 1.98% | 1.05% | 36.32s | $0.0004 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 98.87 | 1.13% | 0.33% | 126.81s | $0.0024 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.99s | $0.0092 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.92s | $0.0027 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.25s | $0.0080 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 8.03s | $0.0086 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 10.64s | $0.0244 |
| <code>grok/grok-4.5</code> | Third-Party Service | 99.01 | 0.99% | 0.15% | 30.05s | $0.0199 |
| <code>grok/grok-4.7</code> | Third-Party Service | 96.04 | 3.96% | 0.35% | 28.15s | $0.0254 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 95.47 | 4.53% | 0.73% | 2.04s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 94.06 | 5.94% | 1.40% | 29.49s | $0.0344 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 99.43 | 0.57% | 0.25% | 13.45s | $0.0530 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 94.91 | 5.09% | 1.00% | 34.41s | $0.0021 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 99.15 | 0.85% | 0.53% | 21.21s | $0.0104 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 194 | 41 | 5 | 707 |
| <code>anthropic/claude-fable-5</code> | 14 | 14 | 0 | 707 |
| <code>anthropic/claude-fable-5-1</code> | 14 | 14 | 0 | 707 |
| <code>anthropic/claude-haiku-5-5</code> | 20 | 14 | 0 | 707 |
| <code>anthropic/claude-opus-5-5</code> | 14 | 14 | 0 | 707 |
| <code>anthropic/claude-sonnet-5-5</code> | 14 | 14 | 0 | 707 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 12 | 3 | 0 | 707 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 10 | 1 | 3 | 707 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 7 | 0 | 1 | 707 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 707 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 707 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 707 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 0 | 0 | 707 |
| <code>gemini/gemini-4-argon</code> | 0 | 0 | 0 | 707 |
| <code>grok/grok-4.5</code> | 4 | 1 | 2 | 707 |
| <code>grok/grok-4.7</code> | 14 | 14 | 0 | 707 |
| <code>mistral/mistral-ocr-4-1</code> | 18 | 14 | 0 | 707 |
| <code>openai/gpt-5.6-terra</code> | 20 | 19 | 3 | 707 |
| <code>openai/gpt-6-astra</code> | 3 | 1 | 0 | 707 |
| <code>openai/gpt-6-luna</code> | 19 | 15 | 2 | 707 |
| <code>openai/gpt-6.1-sol</code> | 5 | 0 | 1 | 707 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 66.05/100.
- Best cloud service: `gemini/gemini-3.5-flash` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0421¢ ($0.0004).
- Fastest local model: `tesseract/tesseract` at 1.21s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 2.04s.

## Lexical evaluation scope

Reference scope: region-crop. Exhaustive lexical target for the declared input page/crop; drawing syntax is excluded where the publisher serialization declares it.

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
