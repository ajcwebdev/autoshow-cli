# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-newspaper-expansion/benchmark-runs/newspapers-expansion-bln-era-burglars`
- Publisher canonical reference: `normalized-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `87a9802ff3ef8c81c2001f71d27f67c1101369279b02c82da0c87eeda296710f`.
- Publisher source: https://ndownloader.figshare.com/files/49365928#Ground%20Truth%2F3202448316.txt (revision `10.15131/shef.data.25439023.v2`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 94.51 | 5.49% | 1.05% | 0.67s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.67s | 94.51 | 5.49% | 1.05% | 0.67s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 94.51/100 quality score | 94.51 | 5.49% | 1.05% | 0.67s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0003 | 99.42 | 0.58% | 0.05% | 19.82s | $0.0003 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0004 | 99.42 | 0.58% | 0.05% | 5.01s | $0.0004 |
| 3 | <code>openai/gpt-6-luna</code> | $0.0007 | 99.42 | 0.58% | 0.05% | 14.30s | $0.0007 |
| 4 | <code>anthropic/claude-haiku-5-5</code> | $0.0009 | 99.42 | 0.58% | 0.05% | 5.72s | $0.0009 |
| 5 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0014 | 99.42 | 0.58% | 0.05% | 82.62s | $0.0014 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0016 | 99.42 | 0.58% | 0.05% | 3.02s | $0.0016 |
| 7 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 99.42 | 0.58% | 0.05% | 1.34s | $0.0040 |
| 8 | <code>gemini/gemini-3.6-flash</code> | $0.0053 | 99.42 | 0.58% | 0.05% | 2.64s | $0.0053 |
| 9 | <code>gemini/gemini-3.8-flash</code> | $0.0055 | 99.42 | 0.58% | 0.05% | 5.39s | $0.0055 |
| 10 | <code>gemini/gemini-3.5-flash</code> | $0.0060 | 99.42 | 0.58% | 0.05% | 2.75s | $0.0060 |
| 11 | <code>openai/gpt-6.1-sol</code> | $0.0068 | 99.42 | 0.58% | 0.05% | 7.90s | $0.0068 |
| 12 | <code>anthropic/claude-sonnet-5-5</code> | $0.0100 | 99.42 | 0.58% | 0.05% | 6.38s | $0.0100 |
| 13 | <code>openai/gpt-5.6-terra</code> | $0.0105 | 98.84 | 1.16% | 0.31% | 6.74s | $0.0105 |
| 14 | <code>grok/grok-4.5</code> | $0.0124 | 99.42 | 0.58% | 0.05% | 21.24s | $0.0124 |
| 15 | <code>gemini/gemini-4-argon</code> | $0.0150 | 99.42 | 0.58% | 0.05% | 7.48s | $0.0150 |
| 16 | <code>anthropic/claude-opus-5-5</code> | $0.0198 | 99.42 | 0.58% | 0.05% | 6.18s | $0.0198 |
| 17 | <code>grok/grok-4.7</code> | $0.0220 | 99.42 | 0.58% | 0.05% | 22.41s | $0.0220 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0355 | 99.13 | 0.87% | 0.10% | 7.76s | $0.0355 |
| 19 | <code>anthropic/claude-fable-5-1</code> | $0.0500 | 99.42 | 0.58% | 0.05% | 6.55s | $0.0500 |
| 20 | <code>anthropic/claude-fable-5</code> | $0.0534 | 99.42 | 0.58% | 0.05% | 11.83s | $0.0534 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-1</code> | 1.34s | 99.42 | 0.58% | 0.05% | 1.34s | $0.0040 |
| 2 | <code>gemini/gemini-3.6-flash</code> | 2.64s | 99.42 | 0.58% | 0.05% | 2.64s | $0.0053 |
| 3 | <code>gemini/gemini-3.5-flash</code> | 2.75s | 99.42 | 0.58% | 0.05% | 2.75s | $0.0060 |
| 4 | <code>gemini/gemini-3.5-flash-lite</code> | 3.02s | 99.42 | 0.58% | 0.05% | 3.02s | $0.0016 |
| 5 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 5.01s | 99.42 | 0.58% | 0.05% | 5.01s | $0.0004 |
| 6 | <code>gemini/gemini-3.8-flash</code> | 5.39s | 99.42 | 0.58% | 0.05% | 5.39s | $0.0055 |
| 7 | <code>anthropic/claude-haiku-5-5</code> | 5.72s | 99.42 | 0.58% | 0.05% | 5.72s | $0.0009 |
| 8 | <code>anthropic/claude-opus-5-5</code> | 6.18s | 99.42 | 0.58% | 0.05% | 6.18s | $0.0198 |
| 9 | <code>anthropic/claude-sonnet-5-5</code> | 6.38s | 99.42 | 0.58% | 0.05% | 6.38s | $0.0100 |
| 10 | <code>anthropic/claude-fable-5-1</code> | 6.55s | 99.42 | 0.58% | 0.05% | 6.55s | $0.0500 |
| 11 | <code>openai/gpt-5.6-terra</code> | 6.74s | 98.84 | 1.16% | 0.31% | 6.74s | $0.0105 |
| 12 | <code>gemini/gemini-4-argon</code> | 7.48s | 99.42 | 0.58% | 0.05% | 7.48s | $0.0150 |
| 13 | <code>openai/gpt-6-astra</code> | 7.76s | 99.13 | 0.87% | 0.10% | 7.76s | $0.0355 |
| 14 | <code>openai/gpt-6.1-sol</code> | 7.90s | 99.42 | 0.58% | 0.05% | 7.90s | $0.0068 |
| 15 | <code>anthropic/claude-fable-5</code> | 11.83s | 99.42 | 0.58% | 0.05% | 11.83s | $0.0534 |
| 16 | <code>openai/gpt-6-luna</code> | 14.30s | 99.42 | 0.58% | 0.05% | 14.30s | $0.0007 |
| 17 | <code>deepinfra/google/gemma-4-31B-it</code> | 19.82s | 99.42 | 0.58% | 0.05% | 19.82s | $0.0003 |
| 18 | <code>grok/grok-4.5</code> | 21.24s | 99.42 | 0.58% | 0.05% | 21.24s | $0.0124 |
| 19 | <code>grok/grok-4.7</code> | 22.41s | 99.42 | 0.58% | 0.05% | 22.41s | $0.0220 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 82.62s | 99.42 | 0.58% | 0.05% | 82.62s | $0.0014 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 99.42/100 quality score | 99.42 | 0.58% | 0.05% | 11.83s | $0.0534 |
| 2 | <code>anthropic/claude-fable-5-1</code> | 99.42/100 quality score | 99.42 | 0.58% | 0.05% | 6.55s | $0.0500 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 99.42/100 quality score | 99.42 | 0.58% | 0.05% | 5.72s | $0.0009 |
| 4 | <code>anthropic/claude-opus-5-5</code> | 99.42/100 quality score | 99.42 | 0.58% | 0.05% | 6.18s | $0.0198 |
| 5 | <code>anthropic/claude-sonnet-5-5</code> | 99.42/100 quality score | 99.42 | 0.58% | 0.05% | 6.38s | $0.0100 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 99.42/100 quality score | 99.42 | 0.58% | 0.05% | 5.01s | $0.0004 |
| 7 | <code>deepinfra/google/gemma-4-31B-it</code> | 99.42/100 quality score | 99.42 | 0.58% | 0.05% | 19.82s | $0.0003 |
| 8 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 99.42/100 quality score | 99.42 | 0.58% | 0.05% | 82.62s | $0.0014 |
| 9 | <code>gemini/gemini-3.5-flash</code> | 99.42/100 quality score | 99.42 | 0.58% | 0.05% | 2.75s | $0.0060 |
| 10 | <code>gemini/gemini-3.5-flash-lite</code> | 99.42/100 quality score | 99.42 | 0.58% | 0.05% | 3.02s | $0.0016 |
| 11 | <code>gemini/gemini-3.6-flash</code> | 99.42/100 quality score | 99.42 | 0.58% | 0.05% | 2.64s | $0.0053 |
| 12 | <code>gemini/gemini-3.8-flash</code> | 99.42/100 quality score | 99.42 | 0.58% | 0.05% | 5.39s | $0.0055 |
| 13 | <code>gemini/gemini-4-argon</code> | 99.42/100 quality score | 99.42 | 0.58% | 0.05% | 7.48s | $0.0150 |
| 14 | <code>grok/grok-4.5</code> | 99.42/100 quality score | 99.42 | 0.58% | 0.05% | 21.24s | $0.0124 |
| 15 | <code>grok/grok-4.7</code> | 99.42/100 quality score | 99.42 | 0.58% | 0.05% | 22.41s | $0.0220 |
| 16 | <code>mistral/mistral-ocr-4-1</code> | 99.42/100 quality score | 99.42 | 0.58% | 0.05% | 1.34s | $0.0040 |
| 17 | <code>openai/gpt-6-luna</code> | 99.42/100 quality score | 99.42 | 0.58% | 0.05% | 14.30s | $0.0007 |
| 18 | <code>openai/gpt-6.1-sol</code> | 99.42/100 quality score | 99.42 | 0.58% | 0.05% | 7.90s | $0.0068 |
| 19 | <code>openai/gpt-6-astra</code> | 99.13/100 quality score | 99.13 | 0.87% | 0.10% | 7.76s | $0.0355 |
| 20 | <code>openai/gpt-5.6-terra</code> | 98.84/100 quality score | 98.84 | 1.16% | 0.31% | 6.74s | $0.0105 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 94.51 | 5.49% | 1.05% | 0.67s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 99.42 | 0.58% | 0.05% | 11.83s | $0.0534 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 99.42 | 0.58% | 0.05% | 6.55s | $0.0500 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 99.42 | 0.58% | 0.05% | 5.72s | $0.0009 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 99.42 | 0.58% | 0.05% | 6.18s | $0.0198 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 99.42 | 0.58% | 0.05% | 6.38s | $0.0100 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 99.42 | 0.58% | 0.05% | 5.01s | $0.0004 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 99.42 | 0.58% | 0.05% | 19.82s | $0.0003 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 99.42 | 0.58% | 0.05% | 82.62s | $0.0014 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 99.42 | 0.58% | 0.05% | 2.75s | $0.0060 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 99.42 | 0.58% | 0.05% | 3.02s | $0.0016 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 99.42 | 0.58% | 0.05% | 2.64s | $0.0053 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 99.42 | 0.58% | 0.05% | 5.39s | $0.0055 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 99.42 | 0.58% | 0.05% | 7.48s | $0.0150 |
| <code>grok/grok-4.5</code> | Third-Party Service | 99.42 | 0.58% | 0.05% | 21.24s | $0.0124 |
| <code>grok/grok-4.7</code> | Third-Party Service | 99.42 | 0.58% | 0.05% | 22.41s | $0.0220 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 99.42 | 0.58% | 0.05% | 1.34s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 98.84 | 1.16% | 0.31% | 6.74s | $0.0105 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 99.13 | 0.87% | 0.10% | 7.76s | $0.0355 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 99.42 | 0.58% | 0.05% | 14.30s | $0.0007 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 99.42 | 0.58% | 0.05% | 7.90s | $0.0068 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 18 | 0 | 1 | 346 |
| <code>anthropic/claude-fable-5</code> | 1 | 0 | 1 | 346 |
| <code>anthropic/claude-fable-5-1</code> | 1 | 0 | 1 | 346 |
| <code>anthropic/claude-haiku-5-5</code> | 1 | 0 | 1 | 346 |
| <code>anthropic/claude-opus-5-5</code> | 1 | 0 | 1 | 346 |
| <code>anthropic/claude-sonnet-5-5</code> | 1 | 0 | 1 | 346 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 1 | 0 | 1 | 346 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 1 | 0 | 1 | 346 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 1 | 0 | 1 | 346 |
| <code>gemini/gemini-3.5-flash</code> | 1 | 0 | 1 | 346 |
| <code>gemini/gemini-3.5-flash-lite</code> | 1 | 0 | 1 | 346 |
| <code>gemini/gemini-3.6-flash</code> | 1 | 0 | 1 | 346 |
| <code>gemini/gemini-3.8-flash</code> | 1 | 0 | 1 | 346 |
| <code>gemini/gemini-4-argon</code> | 1 | 0 | 1 | 346 |
| <code>grok/grok-4.5</code> | 1 | 0 | 1 | 346 |
| <code>grok/grok-4.7</code> | 1 | 0 | 1 | 346 |
| <code>mistral/mistral-ocr-4-1</code> | 1 | 0 | 1 | 346 |
| <code>openai/gpt-5.6-terra</code> | 2 | 1 | 1 | 346 |
| <code>openai/gpt-6-astra</code> | 2 | 0 | 1 | 346 |
| <code>openai/gpt-6-luna</code> | 1 | 0 | 1 | 346 |
| <code>openai/gpt-6.1-sol</code> | 1 | 0 | 1 | 346 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 94.51/100.
- Best cloud service: `anthropic/claude-fable-5` scored 99.42/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0253¢ ($0.0003).
- Fastest local model: `tesseract/tesseract` at 0.67s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.34s.

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
