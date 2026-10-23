# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-newspaper-expansion/benchmark-runs/newspapers-expansion-bln-morning-chronicle-inquest`
- Publisher canonical reference: `normalized-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `a40c232bb07cdc9b83fc1d337a15eeda7c051704d804af986fb8aacda6c42725`.
- Publisher source: https://ndownloader.figshare.com/files/49365928#Ground%20Truth%2F3207167129.txt (revision `10.15131/shef.data.25439023.v2`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 88.36 | 11.64% | 2.58% | 0.86s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.86s | 88.36 | 11.64% | 2.58% | 0.86s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 88.36/100 quality score | 88.36 | 11.64% | 2.58% | 0.86s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0003 | 97.20 | 2.80% | 0.26% | 37.03s | $0.0003 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0006 | 97.84 | 2.16% | 0.19% | 5.55s | $0.0006 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0007 | 99.57 | 0.43% | 0.04% | 3.86s | $0.0007 |
| 4 | <code>openai/gpt-6-luna</code> | $0.0014 | 100.00 | 0.00% | 0.00% | 17.15s | $0.0014 |
| 5 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0018 | 99.57 | 0.43% | 0.07% | 100.86s | $0.0018 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0019 | 99.57 | 0.43% | 0.04% | 2.27s | $0.0019 |
| 7 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 99.57 | 0.43% | 0.04% | 2.46s | $0.0040 |
| 8 | <code>gemini/gemini-3.6-flash</code> | $0.0065 | 100.00 | 0.00% | 0.00% | 3.46s | $0.0065 |
| 9 | <code>gemini/gemini-3.8-flash</code> | $0.0070 | 97.84 | 2.16% | 0.19% | 6.06s | $0.0070 |
| 10 | <code>gemini/gemini-3.5-flash</code> | $0.0077 | 100.00 | 0.00% | 0.00% | 3.64s | $0.0077 |
| 11 | <code>openai/gpt-6.1-sol</code> | $0.0105 | 97.63 | 2.37% | 0.22% | 10.55s | $0.0105 |
| 12 | <code>grok/grok-4.5</code> | $0.0125 | 99.57 | 0.43% | 0.04% | 19.38s | $0.0125 |
| 13 | <code>anthropic/claude-sonnet-5-5</code> | $0.0144 | 100.00 | 0.00% | 0.00% | 7.10s | $0.0144 |
| 14 | <code>openai/gpt-5.6-terra</code> | $0.0195 | 99.57 | 0.43% | 0.04% | 10.40s | $0.0195 |
| 15 | <code>gemini/gemini-4-argon</code> | $0.0202 | 97.84 | 2.16% | 0.19% | 10.00s | $0.0202 |
| 16 | <code>anthropic/claude-opus-5-5</code> | $0.0292 | 99.57 | 0.43% | 0.04% | 9.98s | $0.0292 |
| 17 | <code>grok/grok-4.7</code> | $0.0512 | 99.57 | 0.43% | 0.04% | 75.04s | $0.0512 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0542 | 97.84 | 2.16% | 0.19% | 6.98s | $0.0542 |
| 19 | <code>anthropic/claude-fable-5-1</code> | $0.0732 | 99.57 | 0.43% | 0.04% | 9.18s | $0.0732 |
| 20 | <code>anthropic/claude-fable-5</code> | $0.0735 | 97.84 | 2.16% | 0.19% | 14.49s | $0.0735 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 2.27s | 99.57 | 0.43% | 0.04% | 2.27s | $0.0019 |
| 2 | <code>mistral/mistral-ocr-4-1</code> | 2.46s | 99.57 | 0.43% | 0.04% | 2.46s | $0.0040 |
| 3 | <code>gemini/gemini-3.6-flash</code> | 3.46s | 100.00 | 0.00% | 0.00% | 3.46s | $0.0065 |
| 4 | <code>gemini/gemini-3.5-flash</code> | 3.64s | 100.00 | 0.00% | 0.00% | 3.64s | $0.0077 |
| 5 | <code>anthropic/claude-haiku-5-5</code> | 3.86s | 99.57 | 0.43% | 0.04% | 3.86s | $0.0007 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 5.55s | 97.84 | 2.16% | 0.19% | 5.55s | $0.0006 |
| 7 | <code>gemini/gemini-3.8-flash</code> | 6.06s | 97.84 | 2.16% | 0.19% | 6.06s | $0.0070 |
| 8 | <code>openai/gpt-6-astra</code> | 6.98s | 97.84 | 2.16% | 0.19% | 6.98s | $0.0542 |
| 9 | <code>anthropic/claude-sonnet-5-5</code> | 7.10s | 100.00 | 0.00% | 0.00% | 7.10s | $0.0144 |
| 10 | <code>anthropic/claude-fable-5-1</code> | 9.18s | 99.57 | 0.43% | 0.04% | 9.18s | $0.0732 |
| 11 | <code>anthropic/claude-opus-5-5</code> | 9.98s | 99.57 | 0.43% | 0.04% | 9.98s | $0.0292 |
| 12 | <code>gemini/gemini-4-argon</code> | 10.00s | 97.84 | 2.16% | 0.19% | 10.00s | $0.0202 |
| 13 | <code>openai/gpt-5.6-terra</code> | 10.40s | 99.57 | 0.43% | 0.04% | 10.40s | $0.0195 |
| 14 | <code>openai/gpt-6.1-sol</code> | 10.55s | 97.63 | 2.37% | 0.22% | 10.55s | $0.0105 |
| 15 | <code>anthropic/claude-fable-5</code> | 14.49s | 97.84 | 2.16% | 0.19% | 14.49s | $0.0735 |
| 16 | <code>openai/gpt-6-luna</code> | 17.15s | 100.00 | 0.00% | 0.00% | 17.15s | $0.0014 |
| 17 | <code>grok/grok-4.5</code> | 19.38s | 99.57 | 0.43% | 0.04% | 19.38s | $0.0125 |
| 18 | <code>deepinfra/google/gemma-4-31B-it</code> | 37.03s | 97.20 | 2.80% | 0.26% | 37.03s | $0.0003 |
| 19 | <code>grok/grok-4.7</code> | 75.04s | 99.57 | 0.43% | 0.04% | 75.04s | $0.0512 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 100.86s | 99.57 | 0.43% | 0.07% | 100.86s | $0.0018 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 7.10s | $0.0144 |
| 2 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.64s | $0.0077 |
| 3 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.46s | $0.0065 |
| 4 | <code>openai/gpt-6-luna</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 17.15s | $0.0014 |
| 5 | <code>anthropic/claude-fable-5-1</code> | 99.57/100 quality score | 99.57 | 0.43% | 0.04% | 9.18s | $0.0732 |
| 6 | <code>anthropic/claude-haiku-5-5</code> | 99.57/100 quality score | 99.57 | 0.43% | 0.04% | 3.86s | $0.0007 |
| 7 | <code>anthropic/claude-opus-5-5</code> | 99.57/100 quality score | 99.57 | 0.43% | 0.04% | 9.98s | $0.0292 |
| 8 | <code>gemini/gemini-3.5-flash-lite</code> | 99.57/100 quality score | 99.57 | 0.43% | 0.04% | 2.27s | $0.0019 |
| 9 | <code>grok/grok-4.5</code> | 99.57/100 quality score | 99.57 | 0.43% | 0.04% | 19.38s | $0.0125 |
| 10 | <code>grok/grok-4.7</code> | 99.57/100 quality score | 99.57 | 0.43% | 0.04% | 75.04s | $0.0512 |
| 11 | <code>mistral/mistral-ocr-4-1</code> | 99.57/100 quality score | 99.57 | 0.43% | 0.04% | 2.46s | $0.0040 |
| 12 | <code>openai/gpt-5.6-terra</code> | 99.57/100 quality score | 99.57 | 0.43% | 0.04% | 10.40s | $0.0195 |
| 13 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 99.57/100 quality score | 99.57 | 0.43% | 0.07% | 100.86s | $0.0018 |
| 14 | <code>anthropic/claude-fable-5</code> | 97.84/100 quality score | 97.84 | 2.16% | 0.19% | 14.49s | $0.0735 |
| 15 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 97.84/100 quality score | 97.84 | 2.16% | 0.19% | 5.55s | $0.0006 |
| 16 | <code>gemini/gemini-3.8-flash</code> | 97.84/100 quality score | 97.84 | 2.16% | 0.19% | 6.06s | $0.0070 |
| 17 | <code>gemini/gemini-4-argon</code> | 97.84/100 quality score | 97.84 | 2.16% | 0.19% | 10.00s | $0.0202 |
| 18 | <code>openai/gpt-6-astra</code> | 97.84/100 quality score | 97.84 | 2.16% | 0.19% | 6.98s | $0.0542 |
| 19 | <code>openai/gpt-6.1-sol</code> | 97.63/100 quality score | 97.63 | 2.37% | 0.22% | 10.55s | $0.0105 |
| 20 | <code>deepinfra/google/gemma-4-31B-it</code> | 97.20/100 quality score | 97.20 | 2.80% | 0.26% | 37.03s | $0.0003 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 88.36 | 11.64% | 2.58% | 0.86s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 97.84 | 2.16% | 0.19% | 14.49s | $0.0735 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 99.57 | 0.43% | 0.04% | 9.18s | $0.0732 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 99.57 | 0.43% | 0.04% | 3.86s | $0.0007 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 99.57 | 0.43% | 0.04% | 9.98s | $0.0292 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 7.10s | $0.0144 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 97.84 | 2.16% | 0.19% | 5.55s | $0.0006 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 97.20 | 2.80% | 0.26% | 37.03s | $0.0003 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 99.57 | 0.43% | 0.07% | 100.86s | $0.0018 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.64s | $0.0077 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 99.57 | 0.43% | 0.04% | 2.27s | $0.0019 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.46s | $0.0065 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 97.84 | 2.16% | 0.19% | 6.06s | $0.0070 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 97.84 | 2.16% | 0.19% | 10.00s | $0.0202 |
| <code>grok/grok-4.5</code> | Third-Party Service | 99.57 | 0.43% | 0.04% | 19.38s | $0.0125 |
| <code>grok/grok-4.7</code> | Third-Party Service | 99.57 | 0.43% | 0.04% | 75.04s | $0.0512 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 99.57 | 0.43% | 0.04% | 2.46s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 99.57 | 0.43% | 0.04% | 10.40s | $0.0195 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 97.84 | 2.16% | 0.19% | 6.98s | $0.0542 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 17.15s | $0.0014 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 97.63 | 2.37% | 0.22% | 10.55s | $0.0105 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 42 | 6 | 6 | 464 |
| <code>anthropic/claude-fable-5</code> | 5 | 0 | 5 | 464 |
| <code>anthropic/claude-fable-5-1</code> | 1 | 1 | 0 | 464 |
| <code>anthropic/claude-haiku-5-5</code> | 1 | 1 | 0 | 464 |
| <code>anthropic/claude-opus-5-5</code> | 1 | 1 | 0 | 464 |
| <code>anthropic/claude-sonnet-5-5</code> | 0 | 0 | 0 | 464 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 5 | 0 | 5 | 464 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 7 | 0 | 6 | 464 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 2 | 0 | 0 | 464 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 464 |
| <code>gemini/gemini-3.5-flash-lite</code> | 1 | 1 | 0 | 464 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 464 |
| <code>gemini/gemini-3.8-flash</code> | 5 | 0 | 5 | 464 |
| <code>gemini/gemini-4-argon</code> | 5 | 0 | 5 | 464 |
| <code>grok/grok-4.5</code> | 1 | 1 | 0 | 464 |
| <code>grok/grok-4.7</code> | 1 | 1 | 0 | 464 |
| <code>mistral/mistral-ocr-4-1</code> | 1 | 1 | 0 | 464 |
| <code>openai/gpt-5.6-terra</code> | 1 | 1 | 0 | 464 |
| <code>openai/gpt-6-astra</code> | 5 | 0 | 5 | 464 |
| <code>openai/gpt-6-luna</code> | 0 | 0 | 0 | 464 |
| <code>openai/gpt-6.1-sol</code> | 6 | 0 | 5 | 464 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 88.36/100.
- Best cloud service: `anthropic/claude-sonnet-5-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0330¢ ($0.0003).
- Fastest local model: `tesseract/tesseract` at 0.86s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 2.27s.

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
