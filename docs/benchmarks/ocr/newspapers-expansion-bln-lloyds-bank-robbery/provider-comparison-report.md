# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-newspaper-expansion/benchmark-runs/newspapers-expansion-bln-lloyds-bank-robbery`
- Publisher canonical reference: `normalized-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `aecf2cc157b5f82d2d77e7df91a2c9da22eeb9442e150d00d47396b0d6c33a97`.
- Publisher source: https://ndownloader.figshare.com/files/49365928#Ground%20Truth%2F3206277683.txt (revision `10.15131/shef.data.25439023.v2`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 41.83 | 58.17% | 35.85% | 0.28s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.28s | 41.83 | 58.17% | 35.85% | 0.28s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 41.83/100 quality score | 41.83 | 58.17% | 35.85% | 0.28s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0002 | 96.08 | 3.92% | 0.35% | 12.23s | $0.0002 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0002 | 89.54 | 10.46% | 4.52% | 2.63s | $0.0002 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0003 | 100.00 | 0.00% | 0.00% | 1.56s | $0.0003 |
| 4 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0007 | 96.08 | 3.92% | 0.35% | 46.95s | $0.0007 |
| 5 | <code>openai/gpt-6-luna</code> | $0.0008 | 96.08 | 3.92% | 0.35% | 26.29s | $0.0008 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0010 | 96.08 | 3.92% | 0.35% | 1.62s | $0.0010 |
| 7 | <code>gemini/gemini-3.6-flash</code> | $0.0032 | 100.00 | 0.00% | 0.00% | 2.35s | $0.0032 |
| 8 | <code>gemini/gemini-3.5-flash</code> | $0.0035 | 100.00 | 0.00% | 0.00% | 1.91s | $0.0035 |
| 9 | <code>gemini/gemini-3.8-flash</code> | $0.0035 | 96.08 | 3.92% | 0.35% | 3.25s | $0.0035 |
| 10 | <code>openai/gpt-6.1-sol</code> | $0.0036 | 96.08 | 3.92% | 0.35% | 4.90s | $0.0036 |
| 11 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 100.00 | 0.00% | 0.00% | 0.91s | $0.0040 |
| 12 | <code>anthropic/claude-sonnet-5-5</code> | $0.0054 | 100.00 | 0.00% | 0.00% | 2.93s | $0.0054 |
| 13 | <code>grok/grok-4.5</code> | $0.0066 | 96.08 | 3.92% | 0.35% | 10.00s | $0.0066 |
| 14 | <code>openai/gpt-5.6-terra</code> | $0.0071 | 95.42 | 4.58% | 0.46% | 4.99s | $0.0071 |
| 15 | <code>grok/grok-4.7</code> | $0.0100 | 96.08 | 3.92% | 0.35% | 9.43s | $0.0100 |
| 16 | <code>anthropic/claude-opus-5-5</code> | $0.0107 | 100.00 | 0.00% | 0.00% | 3.40s | $0.0107 |
| 17 | <code>gemini/gemini-4-argon</code> | $0.0108 | 96.08 | 3.92% | 0.35% | 13.60s | $0.0108 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0219 | 96.08 | 3.92% | 0.35% | 7.32s | $0.0219 |
| 19 | <code>anthropic/claude-fable-5</code> | $0.0268 | 100.00 | 0.00% | 0.00% | 5.91s | $0.0268 |
| 20 | <code>anthropic/claude-fable-5-1</code> | $0.0268 | 100.00 | 0.00% | 0.00% | 3.37s | $0.0268 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-1</code> | 0.91s | 100.00 | 0.00% | 0.00% | 0.91s | $0.0040 |
| 2 | <code>anthropic/claude-haiku-5-5</code> | 1.56s | 100.00 | 0.00% | 0.00% | 1.56s | $0.0003 |
| 3 | <code>gemini/gemini-3.5-flash-lite</code> | 1.62s | 96.08 | 3.92% | 0.35% | 1.62s | $0.0010 |
| 4 | <code>gemini/gemini-3.5-flash</code> | 1.91s | 100.00 | 0.00% | 0.00% | 1.91s | $0.0035 |
| 5 | <code>gemini/gemini-3.6-flash</code> | 2.35s | 100.00 | 0.00% | 0.00% | 2.35s | $0.0032 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 2.63s | 89.54 | 10.46% | 4.52% | 2.63s | $0.0002 |
| 7 | <code>anthropic/claude-sonnet-5-5</code> | 2.93s | 100.00 | 0.00% | 0.00% | 2.93s | $0.0054 |
| 8 | <code>gemini/gemini-3.8-flash</code> | 3.25s | 96.08 | 3.92% | 0.35% | 3.25s | $0.0035 |
| 9 | <code>anthropic/claude-fable-5-1</code> | 3.37s | 100.00 | 0.00% | 0.00% | 3.37s | $0.0268 |
| 10 | <code>anthropic/claude-opus-5-5</code> | 3.40s | 100.00 | 0.00% | 0.00% | 3.40s | $0.0107 |
| 11 | <code>openai/gpt-6.1-sol</code> | 4.90s | 96.08 | 3.92% | 0.35% | 4.90s | $0.0036 |
| 12 | <code>openai/gpt-5.6-terra</code> | 4.99s | 95.42 | 4.58% | 0.46% | 4.99s | $0.0071 |
| 13 | <code>anthropic/claude-fable-5</code> | 5.91s | 100.00 | 0.00% | 0.00% | 5.91s | $0.0268 |
| 14 | <code>openai/gpt-6-astra</code> | 7.32s | 96.08 | 3.92% | 0.35% | 7.32s | $0.0219 |
| 15 | <code>grok/grok-4.7</code> | 9.43s | 96.08 | 3.92% | 0.35% | 9.43s | $0.0100 |
| 16 | <code>grok/grok-4.5</code> | 10.00s | 96.08 | 3.92% | 0.35% | 10.00s | $0.0066 |
| 17 | <code>deepinfra/google/gemma-4-31B-it</code> | 12.23s | 96.08 | 3.92% | 0.35% | 12.23s | $0.0002 |
| 18 | <code>gemini/gemini-4-argon</code> | 13.60s | 96.08 | 3.92% | 0.35% | 13.60s | $0.0108 |
| 19 | <code>openai/gpt-6-luna</code> | 26.29s | 96.08 | 3.92% | 0.35% | 26.29s | $0.0008 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 46.95s | 96.08 | 3.92% | 0.35% | 46.95s | $0.0007 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.91s | $0.0268 |
| 2 | <code>anthropic/claude-fable-5-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.37s | $0.0268 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.56s | $0.0003 |
| 4 | <code>anthropic/claude-opus-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.40s | $0.0107 |
| 5 | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.93s | $0.0054 |
| 6 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.91s | $0.0035 |
| 7 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.35s | $0.0032 |
| 8 | <code>mistral/mistral-ocr-4-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.91s | $0.0040 |
| 9 | <code>deepinfra/google/gemma-4-31B-it</code> | 96.08/100 quality score | 96.08 | 3.92% | 0.35% | 12.23s | $0.0002 |
| 10 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 96.08/100 quality score | 96.08 | 3.92% | 0.35% | 46.95s | $0.0007 |
| 11 | <code>gemini/gemini-3.5-flash-lite</code> | 96.08/100 quality score | 96.08 | 3.92% | 0.35% | 1.62s | $0.0010 |
| 12 | <code>gemini/gemini-3.8-flash</code> | 96.08/100 quality score | 96.08 | 3.92% | 0.35% | 3.25s | $0.0035 |
| 13 | <code>gemini/gemini-4-argon</code> | 96.08/100 quality score | 96.08 | 3.92% | 0.35% | 13.60s | $0.0108 |
| 14 | <code>grok/grok-4.5</code> | 96.08/100 quality score | 96.08 | 3.92% | 0.35% | 10.00s | $0.0066 |
| 15 | <code>grok/grok-4.7</code> | 96.08/100 quality score | 96.08 | 3.92% | 0.35% | 9.43s | $0.0100 |
| 16 | <code>openai/gpt-6-astra</code> | 96.08/100 quality score | 96.08 | 3.92% | 0.35% | 7.32s | $0.0219 |
| 17 | <code>openai/gpt-6-luna</code> | 96.08/100 quality score | 96.08 | 3.92% | 0.35% | 26.29s | $0.0008 |
| 18 | <code>openai/gpt-6.1-sol</code> | 96.08/100 quality score | 96.08 | 3.92% | 0.35% | 4.90s | $0.0036 |
| 19 | <code>openai/gpt-5.6-terra</code> | 95.42/100 quality score | 95.42 | 4.58% | 0.46% | 4.99s | $0.0071 |
| 20 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 89.54/100 quality score | 89.54 | 10.46% | 4.52% | 2.63s | $0.0002 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 41.83 | 58.17% | 35.85% | 0.28s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.91s | $0.0268 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.37s | $0.0268 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.56s | $0.0003 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.40s | $0.0107 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.93s | $0.0054 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 89.54 | 10.46% | 4.52% | 2.63s | $0.0002 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 96.08 | 3.92% | 0.35% | 12.23s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 96.08 | 3.92% | 0.35% | 46.95s | $0.0007 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.91s | $0.0035 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 96.08 | 3.92% | 0.35% | 1.62s | $0.0010 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.35s | $0.0032 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 96.08 | 3.92% | 0.35% | 3.25s | $0.0035 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 96.08 | 3.92% | 0.35% | 13.60s | $0.0108 |
| <code>grok/grok-4.5</code> | Third-Party Service | 96.08 | 3.92% | 0.35% | 10.00s | $0.0066 |
| <code>grok/grok-4.7</code> | Third-Party Service | 96.08 | 3.92% | 0.35% | 9.43s | $0.0100 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 0.91s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 95.42 | 4.58% | 0.46% | 4.99s | $0.0071 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 96.08 | 3.92% | 0.35% | 7.32s | $0.0219 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 96.08 | 3.92% | 0.35% | 26.29s | $0.0008 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 96.08 | 3.92% | 0.35% | 4.90s | $0.0036 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 38 | 49 | 2 | 153 |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 0 | 153 |
| <code>anthropic/claude-fable-5-1</code> | 0 | 0 | 0 | 153 |
| <code>anthropic/claude-haiku-5-5</code> | 0 | 0 | 0 | 153 |
| <code>anthropic/claude-opus-5-5</code> | 0 | 0 | 0 | 153 |
| <code>anthropic/claude-sonnet-5-5</code> | 0 | 0 | 0 | 153 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 9 | 0 | 7 | 153 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 3 | 0 | 3 | 153 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 3 | 0 | 3 | 153 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 153 |
| <code>gemini/gemini-3.5-flash-lite</code> | 3 | 0 | 3 | 153 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 153 |
| <code>gemini/gemini-3.8-flash</code> | 3 | 0 | 3 | 153 |
| <code>gemini/gemini-4-argon</code> | 3 | 0 | 3 | 153 |
| <code>grok/grok-4.5</code> | 3 | 0 | 3 | 153 |
| <code>grok/grok-4.7</code> | 3 | 0 | 3 | 153 |
| <code>mistral/mistral-ocr-4-1</code> | 0 | 0 | 0 | 153 |
| <code>openai/gpt-5.6-terra</code> | 4 | 0 | 3 | 153 |
| <code>openai/gpt-6-astra</code> | 3 | 0 | 3 | 153 |
| <code>openai/gpt-6-luna</code> | 3 | 0 | 3 | 153 |
| <code>openai/gpt-6.1-sol</code> | 3 | 0 | 3 | 153 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 41.83/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0154¢ ($0.0002).
- Fastest local model: `tesseract/tesseract` at 0.28s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 0.91s.

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
