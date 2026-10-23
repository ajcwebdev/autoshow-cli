# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/newspapers-tomahawk`
- Publisher canonical reference: `newspapers-tomahawk.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `168cd7bb0c94116f673cdc2c576dfa45d5b22c22479d0bf333589e1cd33eb0c0`.
- Publisher source: https://ndownloader.figshare.com/files/52256378 (revision `10.5522/04/28381610.v1`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 96.12 | 3.88% | 0.95% | 0.64s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.64s | 96.12 | 3.88% | 0.95% | 0.64s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 96.12/100 quality score | 96.12 | 3.88% | 0.95% | 0.64s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0002 | 100.00 | 0.00% | 0.00% | 22.04s | $0.0002 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0003 | 100.00 | 0.00% | 0.00% | 6.89s | $0.0003 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0004 | 96.90 | 3.10% | 0.27% | 2.98s | $0.0004 |
| 4 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0010 | 96.12 | 3.88% | 0.48% | 14.37s | $0.0010 |
| 5 | <code>openai/gpt-6-luna</code> | $0.0010 | 100.00 | 0.00% | 0.00% | 22.98s | $0.0010 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0014 | 100.00 | 0.00% | 0.00% | 1.92s | $0.0014 |
| 7 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 96.90 | 3.10% | 0.27% | 1.30s | $0.0040 |
| 8 | <code>gemini/gemini-3.6-flash</code> | $0.0044 | 96.90 | 3.10% | 0.27% | 5.48s | $0.0044 |
| 9 | <code>gemini/gemini-3.8-flash</code> | $0.0048 | 100.00 | 0.00% | 0.00% | 4.79s | $0.0048 |
| 10 | <code>gemini/gemini-3.5-flash</code> | $0.0050 | 96.90 | 3.10% | 0.27% | 5.00s | $0.0050 |
| 11 | <code>openai/gpt-6.1-sol</code> | $0.0057 | 99.61 | 0.39% | 0.14% | 8.91s | $0.0057 |
| 12 | <code>grok/grok-4.5</code> | $0.0071 | 96.90 | 3.10% | 0.27% | 8.99s | $0.0071 |
| 13 | <code>openai/gpt-5.6-terra</code> | $0.0075 | 99.61 | 0.39% | 0.20% | 6.59s | $0.0075 |
| 14 | <code>anthropic/claude-sonnet-5-5</code> | $0.0084 | 96.90 | 3.10% | 0.27% | 3.95s | $0.0084 |
| 15 | <code>gemini/gemini-4-argon</code> | $0.0138 | 100.00 | 0.00% | 0.00% | 16.00s | $0.0138 |
| 16 | <code>anthropic/claude-opus-5-5</code> | $0.0170 | 96.90 | 3.10% | 0.27% | 6.23s | $0.0170 |
| 17 | <code>grok/grok-4.7</code> | $0.0270 | 99.22 | 0.78% | 0.14% | 37.95s | $0.0270 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0325 | 100.00 | 0.00% | 0.00% | 10.72s | $0.0325 |
| 19 | <code>anthropic/claude-fable-5</code> | $0.0424 | 96.90 | 3.10% | 0.27% | 9.62s | $0.0424 |
| 20 | <code>anthropic/claude-fable-5-1</code> | $0.0425 | 96.90 | 3.10% | 0.27% | 5.55s | $0.0425 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-1</code> | 1.30s | 96.90 | 3.10% | 0.27% | 1.30s | $0.0040 |
| 2 | <code>gemini/gemini-3.5-flash-lite</code> | 1.92s | 100.00 | 0.00% | 0.00% | 1.92s | $0.0014 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 2.98s | 96.90 | 3.10% | 0.27% | 2.98s | $0.0004 |
| 4 | <code>anthropic/claude-sonnet-5-5</code> | 3.95s | 96.90 | 3.10% | 0.27% | 3.95s | $0.0084 |
| 5 | <code>gemini/gemini-3.8-flash</code> | 4.79s | 100.00 | 0.00% | 0.00% | 4.79s | $0.0048 |
| 6 | <code>gemini/gemini-3.5-flash</code> | 5.00s | 96.90 | 3.10% | 0.27% | 5.00s | $0.0050 |
| 7 | <code>gemini/gemini-3.6-flash</code> | 5.48s | 96.90 | 3.10% | 0.27% | 5.48s | $0.0044 |
| 8 | <code>anthropic/claude-fable-5-1</code> | 5.55s | 96.90 | 3.10% | 0.27% | 5.55s | $0.0425 |
| 9 | <code>anthropic/claude-opus-5-5</code> | 6.23s | 96.90 | 3.10% | 0.27% | 6.23s | $0.0170 |
| 10 | <code>openai/gpt-5.6-terra</code> | 6.59s | 99.61 | 0.39% | 0.20% | 6.59s | $0.0075 |
| 11 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 6.89s | 100.00 | 0.00% | 0.00% | 6.89s | $0.0003 |
| 12 | <code>openai/gpt-6.1-sol</code> | 8.91s | 99.61 | 0.39% | 0.14% | 8.91s | $0.0057 |
| 13 | <code>grok/grok-4.5</code> | 8.99s | 96.90 | 3.10% | 0.27% | 8.99s | $0.0071 |
| 14 | <code>anthropic/claude-fable-5</code> | 9.62s | 96.90 | 3.10% | 0.27% | 9.62s | $0.0424 |
| 15 | <code>openai/gpt-6-astra</code> | 10.72s | 100.00 | 0.00% | 0.00% | 10.72s | $0.0325 |
| 16 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 14.37s | 96.12 | 3.88% | 0.48% | 14.37s | $0.0010 |
| 17 | <code>gemini/gemini-4-argon</code> | 16.00s | 100.00 | 0.00% | 0.00% | 16.00s | $0.0138 |
| 18 | <code>deepinfra/google/gemma-4-31B-it</code> | 22.04s | 100.00 | 0.00% | 0.00% | 22.04s | $0.0002 |
| 19 | <code>openai/gpt-6-luna</code> | 22.98s | 100.00 | 0.00% | 0.00% | 22.98s | $0.0010 |
| 20 | <code>grok/grok-4.7</code> | 37.95s | 99.22 | 0.78% | 0.14% | 37.95s | $0.0270 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 6.89s | $0.0003 |
| 2 | <code>deepinfra/google/gemma-4-31B-it</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 22.04s | $0.0002 |
| 3 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.92s | $0.0014 |
| 4 | <code>gemini/gemini-3.8-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.79s | $0.0048 |
| 5 | <code>gemini/gemini-4-argon</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 16.00s | $0.0138 |
| 6 | <code>openai/gpt-6-astra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 10.72s | $0.0325 |
| 7 | <code>openai/gpt-6-luna</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 22.98s | $0.0010 |
| 8 | <code>openai/gpt-6.1-sol</code> | 99.61/100 quality score | 99.61 | 0.39% | 0.14% | 8.91s | $0.0057 |
| 9 | <code>openai/gpt-5.6-terra</code> | 99.61/100 quality score | 99.61 | 0.39% | 0.20% | 6.59s | $0.0075 |
| 10 | <code>grok/grok-4.7</code> | 99.22/100 quality score | 99.22 | 0.78% | 0.14% | 37.95s | $0.0270 |
| 11 | <code>anthropic/claude-fable-5</code> | 96.90/100 quality score | 96.90 | 3.10% | 0.27% | 9.62s | $0.0424 |
| 12 | <code>anthropic/claude-fable-5-1</code> | 96.90/100 quality score | 96.90 | 3.10% | 0.27% | 5.55s | $0.0425 |
| 13 | <code>anthropic/claude-haiku-5-5</code> | 96.90/100 quality score | 96.90 | 3.10% | 0.27% | 2.98s | $0.0004 |
| 14 | <code>anthropic/claude-opus-5-5</code> | 96.90/100 quality score | 96.90 | 3.10% | 0.27% | 6.23s | $0.0170 |
| 15 | <code>anthropic/claude-sonnet-5-5</code> | 96.90/100 quality score | 96.90 | 3.10% | 0.27% | 3.95s | $0.0084 |
| 16 | <code>gemini/gemini-3.5-flash</code> | 96.90/100 quality score | 96.90 | 3.10% | 0.27% | 5.00s | $0.0050 |
| 17 | <code>gemini/gemini-3.6-flash</code> | 96.90/100 quality score | 96.90 | 3.10% | 0.27% | 5.48s | $0.0044 |
| 18 | <code>grok/grok-4.5</code> | 96.90/100 quality score | 96.90 | 3.10% | 0.27% | 8.99s | $0.0071 |
| 19 | <code>mistral/mistral-ocr-4-1</code> | 96.90/100 quality score | 96.90 | 3.10% | 0.27% | 1.30s | $0.0040 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 96.12/100 quality score | 96.12 | 3.88% | 0.48% | 14.37s | $0.0010 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 96.12 | 3.88% | 0.95% | 0.64s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 96.90 | 3.10% | 0.27% | 9.62s | $0.0424 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 96.90 | 3.10% | 0.27% | 5.55s | $0.0425 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 96.90 | 3.10% | 0.27% | 2.98s | $0.0004 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 96.90 | 3.10% | 0.27% | 6.23s | $0.0170 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 96.90 | 3.10% | 0.27% | 3.95s | $0.0084 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 6.89s | $0.0003 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 22.04s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 96.12 | 3.88% | 0.48% | 14.37s | $0.0010 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 96.90 | 3.10% | 0.27% | 5.00s | $0.0050 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.92s | $0.0014 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 96.90 | 3.10% | 0.27% | 5.48s | $0.0044 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.79s | $0.0048 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 16.00s | $0.0138 |
| <code>grok/grok-4.5</code> | Third-Party Service | 96.90 | 3.10% | 0.27% | 8.99s | $0.0071 |
| <code>grok/grok-4.7</code> | Third-Party Service | 99.22 | 0.78% | 0.14% | 37.95s | $0.0270 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 96.90 | 3.10% | 0.27% | 1.30s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 99.61 | 0.39% | 0.20% | 6.59s | $0.0075 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 10.72s | $0.0325 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 22.98s | $0.0010 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 99.61 | 0.39% | 0.14% | 8.91s | $0.0057 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 9 | 1 | 0 | 258 |
| <code>anthropic/claude-fable-5</code> | 4 | 4 | 0 | 258 |
| <code>anthropic/claude-fable-5-1</code> | 4 | 4 | 0 | 258 |
| <code>anthropic/claude-haiku-5-5</code> | 4 | 4 | 0 | 258 |
| <code>anthropic/claude-opus-5-5</code> | 4 | 4 | 0 | 258 |
| <code>anthropic/claude-sonnet-5-5</code> | 4 | 4 | 0 | 258 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 0 | 0 | 0 | 258 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 0 | 0 | 0 | 258 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 6 | 4 | 0 | 258 |
| <code>gemini/gemini-3.5-flash</code> | 4 | 4 | 0 | 258 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 258 |
| <code>gemini/gemini-3.6-flash</code> | 4 | 4 | 0 | 258 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 0 | 0 | 258 |
| <code>gemini/gemini-4-argon</code> | 0 | 0 | 0 | 258 |
| <code>grok/grok-4.5</code> | 4 | 4 | 0 | 258 |
| <code>grok/grok-4.7</code> | 2 | 0 | 0 | 258 |
| <code>mistral/mistral-ocr-4-1</code> | 4 | 4 | 0 | 258 |
| <code>openai/gpt-5.6-terra</code> | 1 | 0 | 0 | 258 |
| <code>openai/gpt-6-astra</code> | 0 | 0 | 0 | 258 |
| <code>openai/gpt-6-luna</code> | 0 | 0 | 0 | 258 |
| <code>openai/gpt-6.1-sol</code> | 1 | 0 | 0 | 258 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 96.12/100.
- Best cloud service: `deepinfra/deepseek-ai/DeepSeek-V4.1-Flash` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0217¢ ($0.0002).
- Fastest local model: `tesseract/tesseract` at 0.64s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.30s.

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
