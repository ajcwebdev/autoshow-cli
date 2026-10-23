# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-newspaper-expansion/benchmark-runs/newspapers-expansion-bln-charter-aldermen`
- Publisher canonical reference: `normalized-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `19aa8edb678d15f72b93634fd5f84bcb9ee4d3bdf75d1c980e9784478dbbbccb`.
- Publisher source: https://ndownloader.figshare.com/files/49365928#Ground%20Truth%2F3205297646.txt (revision `10.15131/shef.data.25439023.v2`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 93.89 | 6.11% | 1.32% | 0.57s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.57s | 93.89 | 6.11% | 1.32% | 0.57s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 93.89/100 quality score | 93.89 | 6.11% | 1.32% | 0.57s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0002 | 97.38 | 2.62% | 0.23% | 12.10s | $0.0002 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0003 | 97.38 | 2.62% | 0.23% | 3.15s | $0.0003 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0004 | 100.00 | 0.00% | 0.00% | 3.05s | $0.0004 |
| 4 | <code>openai/gpt-6-luna</code> | $0.0007 | 97.38 | 2.62% | 0.23% | 10.82s | $0.0007 |
| 5 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0010 | 97.38 | 2.62% | 0.23% | 27.68s | $0.0010 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0012 | 96.94 | 3.06% | 0.39% | 1.72s | $0.0012 |
| 7 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 100.00 | 0.00% | 0.00% | 2.73s | $0.0040 |
| 8 | <code>gemini/gemini-3.8-flash</code> | $0.0040 | 97.38 | 2.62% | 0.23% | 4.54s | $0.0040 |
| 9 | <code>gemini/gemini-3.6-flash</code> | $0.0042 | 97.38 | 2.62% | 0.23% | 2.50s | $0.0042 |
| 10 | <code>gemini/gemini-3.5-flash</code> | $0.0046 | 100.00 | 0.00% | 0.00% | 2.36s | $0.0046 |
| 11 | <code>openai/gpt-6.1-sol</code> | $0.0059 | 97.38 | 2.62% | 0.23% | 6.62s | $0.0059 |
| 12 | <code>openai/gpt-5.6-terra</code> | $0.0071 | 97.38 | 2.62% | 0.23% | 4.61s | $0.0071 |
| 13 | <code>anthropic/claude-sonnet-5-5</code> | $0.0082 | 100.00 | 0.00% | 0.00% | 4.86s | $0.0082 |
| 14 | <code>grok/grok-4.5</code> | $0.0093 | 97.38 | 2.62% | 0.23% | 14.11s | $0.0093 |
| 15 | <code>gemini/gemini-4-argon</code> | $0.0120 | 100.00 | 0.00% | 0.00% | 5.92s | $0.0120 |
| 16 | <code>grok/grok-4.7</code> | $0.0128 | 97.38 | 2.62% | 0.23% | 12.07s | $0.0128 |
| 17 | <code>anthropic/claude-opus-5-5</code> | $0.0165 | 100.00 | 0.00% | 0.00% | 5.17s | $0.0165 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0294 | 96.94 | 3.06% | 0.31% | 4.45s | $0.0294 |
| 19 | <code>anthropic/claude-fable-5</code> | $0.0412 | 100.00 | 0.00% | 0.00% | 7.69s | $0.0412 |
| 20 | <code>anthropic/claude-fable-5-1</code> | $0.0412 | 100.00 | 0.00% | 0.00% | 5.03s | $0.0412 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 1.72s | 96.94 | 3.06% | 0.39% | 1.72s | $0.0012 |
| 2 | <code>gemini/gemini-3.5-flash</code> | 2.36s | 100.00 | 0.00% | 0.00% | 2.36s | $0.0046 |
| 3 | <code>gemini/gemini-3.6-flash</code> | 2.50s | 97.38 | 2.62% | 0.23% | 2.50s | $0.0042 |
| 4 | <code>mistral/mistral-ocr-4-1</code> | 2.73s | 100.00 | 0.00% | 0.00% | 2.73s | $0.0040 |
| 5 | <code>anthropic/claude-haiku-5-5</code> | 3.05s | 100.00 | 0.00% | 0.00% | 3.05s | $0.0004 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 3.15s | 97.38 | 2.62% | 0.23% | 3.15s | $0.0003 |
| 7 | <code>openai/gpt-6-astra</code> | 4.45s | 96.94 | 3.06% | 0.31% | 4.45s | $0.0294 |
| 8 | <code>gemini/gemini-3.8-flash</code> | 4.54s | 97.38 | 2.62% | 0.23% | 4.54s | $0.0040 |
| 9 | <code>openai/gpt-5.6-terra</code> | 4.61s | 97.38 | 2.62% | 0.23% | 4.61s | $0.0071 |
| 10 | <code>anthropic/claude-sonnet-5-5</code> | 4.86s | 100.00 | 0.00% | 0.00% | 4.86s | $0.0082 |
| 11 | <code>anthropic/claude-fable-5-1</code> | 5.03s | 100.00 | 0.00% | 0.00% | 5.03s | $0.0412 |
| 12 | <code>anthropic/claude-opus-5-5</code> | 5.17s | 100.00 | 0.00% | 0.00% | 5.17s | $0.0165 |
| 13 | <code>gemini/gemini-4-argon</code> | 5.92s | 100.00 | 0.00% | 0.00% | 5.92s | $0.0120 |
| 14 | <code>openai/gpt-6.1-sol</code> | 6.62s | 97.38 | 2.62% | 0.23% | 6.62s | $0.0059 |
| 15 | <code>anthropic/claude-fable-5</code> | 7.69s | 100.00 | 0.00% | 0.00% | 7.69s | $0.0412 |
| 16 | <code>openai/gpt-6-luna</code> | 10.82s | 97.38 | 2.62% | 0.23% | 10.82s | $0.0007 |
| 17 | <code>grok/grok-4.7</code> | 12.07s | 97.38 | 2.62% | 0.23% | 12.07s | $0.0128 |
| 18 | <code>deepinfra/google/gemma-4-31B-it</code> | 12.10s | 97.38 | 2.62% | 0.23% | 12.10s | $0.0002 |
| 19 | <code>grok/grok-4.5</code> | 14.11s | 97.38 | 2.62% | 0.23% | 14.11s | $0.0093 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 27.68s | 97.38 | 2.62% | 0.23% | 27.68s | $0.0010 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 7.69s | $0.0412 |
| 2 | <code>anthropic/claude-fable-5-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.03s | $0.0412 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.05s | $0.0004 |
| 4 | <code>anthropic/claude-opus-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.17s | $0.0165 |
| 5 | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.86s | $0.0082 |
| 6 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.36s | $0.0046 |
| 7 | <code>gemini/gemini-4-argon</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.92s | $0.0120 |
| 8 | <code>mistral/mistral-ocr-4-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.73s | $0.0040 |
| 9 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 97.38/100 quality score | 97.38 | 2.62% | 0.23% | 3.15s | $0.0003 |
| 10 | <code>deepinfra/google/gemma-4-31B-it</code> | 97.38/100 quality score | 97.38 | 2.62% | 0.23% | 12.10s | $0.0002 |
| 11 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 97.38/100 quality score | 97.38 | 2.62% | 0.23% | 27.68s | $0.0010 |
| 12 | <code>gemini/gemini-3.6-flash</code> | 97.38/100 quality score | 97.38 | 2.62% | 0.23% | 2.50s | $0.0042 |
| 13 | <code>gemini/gemini-3.8-flash</code> | 97.38/100 quality score | 97.38 | 2.62% | 0.23% | 4.54s | $0.0040 |
| 14 | <code>grok/grok-4.5</code> | 97.38/100 quality score | 97.38 | 2.62% | 0.23% | 14.11s | $0.0093 |
| 15 | <code>grok/grok-4.7</code> | 97.38/100 quality score | 97.38 | 2.62% | 0.23% | 12.07s | $0.0128 |
| 16 | <code>openai/gpt-5.6-terra</code> | 97.38/100 quality score | 97.38 | 2.62% | 0.23% | 4.61s | $0.0071 |
| 17 | <code>openai/gpt-6-luna</code> | 97.38/100 quality score | 97.38 | 2.62% | 0.23% | 10.82s | $0.0007 |
| 18 | <code>openai/gpt-6.1-sol</code> | 97.38/100 quality score | 97.38 | 2.62% | 0.23% | 6.62s | $0.0059 |
| 19 | <code>openai/gpt-6-astra</code> | 96.94/100 quality score | 96.94 | 3.06% | 0.31% | 4.45s | $0.0294 |
| 20 | <code>gemini/gemini-3.5-flash-lite</code> | 96.94/100 quality score | 96.94 | 3.06% | 0.39% | 1.72s | $0.0012 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 93.89 | 6.11% | 1.32% | 0.57s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 7.69s | $0.0412 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.03s | $0.0412 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.05s | $0.0004 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.17s | $0.0165 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.86s | $0.0082 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 97.38 | 2.62% | 0.23% | 3.15s | $0.0003 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 97.38 | 2.62% | 0.23% | 12.10s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 97.38 | 2.62% | 0.23% | 27.68s | $0.0010 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.36s | $0.0046 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 96.94 | 3.06% | 0.39% | 1.72s | $0.0012 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 97.38 | 2.62% | 0.23% | 2.50s | $0.0042 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 97.38 | 2.62% | 0.23% | 4.54s | $0.0040 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.92s | $0.0120 |
| <code>grok/grok-4.5</code> | Third-Party Service | 97.38 | 2.62% | 0.23% | 14.11s | $0.0093 |
| <code>grok/grok-4.7</code> | Third-Party Service | 97.38 | 2.62% | 0.23% | 12.07s | $0.0128 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.73s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 97.38 | 2.62% | 0.23% | 4.61s | $0.0071 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 96.94 | 3.06% | 0.31% | 4.45s | $0.0294 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 97.38 | 2.62% | 0.23% | 10.82s | $0.0007 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 97.38 | 2.62% | 0.23% | 6.62s | $0.0059 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 9 | 0 | 5 | 229 |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 0 | 229 |
| <code>anthropic/claude-fable-5-1</code> | 0 | 0 | 0 | 229 |
| <code>anthropic/claude-haiku-5-5</code> | 0 | 0 | 0 | 229 |
| <code>anthropic/claude-opus-5-5</code> | 0 | 0 | 0 | 229 |
| <code>anthropic/claude-sonnet-5-5</code> | 0 | 0 | 0 | 229 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 3 | 0 | 3 | 229 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 3 | 0 | 3 | 229 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 3 | 0 | 3 | 229 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 229 |
| <code>gemini/gemini-3.5-flash-lite</code> | 4 | 0 | 3 | 229 |
| <code>gemini/gemini-3.6-flash</code> | 3 | 0 | 3 | 229 |
| <code>gemini/gemini-3.8-flash</code> | 3 | 0 | 3 | 229 |
| <code>gemini/gemini-4-argon</code> | 0 | 0 | 0 | 229 |
| <code>grok/grok-4.5</code> | 3 | 0 | 3 | 229 |
| <code>grok/grok-4.7</code> | 3 | 0 | 3 | 229 |
| <code>mistral/mistral-ocr-4-1</code> | 0 | 0 | 0 | 229 |
| <code>openai/gpt-5.6-terra</code> | 3 | 0 | 3 | 229 |
| <code>openai/gpt-6-astra</code> | 4 | 0 | 3 | 229 |
| <code>openai/gpt-6-luna</code> | 3 | 0 | 3 | 229 |
| <code>openai/gpt-6.1-sol</code> | 3 | 0 | 3 | 229 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 93.89/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0192¢ ($0.0002).
- Fastest local model: `tesseract/tesseract` at 0.57s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 1.72s.

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
