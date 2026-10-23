# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/handwriting-marker-flowchart`
- Publisher canonical reference: `reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `b033e75b1d542a51a1127747b82ce4974e39d5a03e42825a54db075cef7a5890`.
- Publisher source: https://huggingface.co/datasets/danielrosehill/Whiteboards/resolve/4b31e86e15743ffea20204a8f6992b0173ecbdf9/data/metadata.jsonl (revision `4b31e86e15743ffea20204a8f6992b0173ecbdf9`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 5.26 | 94.74% | 55.42% | 0.82s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.82s | 5.26 | 94.74% | 55.42% | 0.82s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 5.26/100 quality score | 5.26 | 94.74% | 55.42% | 0.82s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0001 | 89.47 | 10.53% | 4.82% | 3.00s | $0.0001 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0002 | 89.47 | 10.53% | 4.82% | 2.75s | $0.0002 |
| 3 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0005 | 100.00 | 0.00% | 0.00% | 3.00s | $0.0005 |
| 4 | <code>anthropic/claude-haiku-5-5</code> | $0.0006 | 84.21 | 15.79% | 6.02% | 2.65s | $0.0006 |
| 5 | <code>openai/gpt-6-luna</code> | $0.0006 | 100.00 | 0.00% | 0.00% | 7.89s | $0.0006 |
| 6 | <code>gemini/gemini-3.6-flash</code> | $0.0020 | 100.00 | 0.00% | 0.00% | 3.18s | $0.0020 |
| 7 | <code>gemini/gemini-3.5-flash</code> | $0.0021 | 100.00 | 0.00% | 0.00% | 3.41s | $0.0021 |
| 8 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0026 | 84.21 | 15.79% | 6.02% | 94.06s | $0.0026 |
| 9 | <code>gemini/gemini-3.8-flash</code> | $0.0033 | 100.00 | 0.00% | 0.00% | 5.41s | $0.0033 |
| 10 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 47.37 | 52.63% | 32.53% | 5.31s | $0.0040 |
| 11 | <code>gemini/gemini-4-argon</code> | $0.0069 | 100.00 | 0.00% | 0.00% | 11.74s | $0.0069 |
| 12 | <code>grok/grok-4.5</code> | $0.0072 | 89.47 | 10.53% | 4.82% | 4.07s | $0.0072 |
| 13 | <code>openai/gpt-6.1-sol</code> | $0.0083 | 100.00 | 0.00% | 0.00% | 5.18s | $0.0083 |
| 14 | <code>openai/gpt-5.6-terra</code> | $0.0088 | 89.47 | 10.53% | 4.82% | 3.49s | $0.0088 |
| 15 | <code>grok/grok-4.7</code> | $0.0092 | 100.00 | 0.00% | 0.00% | 4.98s | $0.0092 |
| 16 | <code>anthropic/claude-sonnet-5-5</code> | $0.0116 | 100.00 | 0.00% | 0.00% | 3.48s | $0.0116 |
| 17 | <code>anthropic/claude-opus-5-5</code> | $0.0231 | 100.00 | 0.00% | 0.00% | 4.21s | $0.0231 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0411 | 100.00 | 0.00% | 0.00% | 7.06s | $0.0411 |
| 19 | <code>anthropic/claude-fable-5</code> | $0.0579 | 100.00 | 0.00% | 0.00% | 5.04s | $0.0579 |
| 20 | <code>anthropic/claude-fable-5-1</code> | $0.0579 | 100.00 | 0.00% | 0.00% | 5.95s | $0.0579 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-haiku-5-5</code> | 2.65s | 84.21 | 15.79% | 6.02% | 2.65s | $0.0006 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 2.75s | 89.47 | 10.53% | 4.82% | 2.75s | $0.0002 |
| 3 | <code>gemini/gemini-3.5-flash-lite</code> | 3.00s | 100.00 | 0.00% | 0.00% | 3.00s | $0.0005 |
| 4 | <code>deepinfra/google/gemma-4-31B-it</code> | 3.00s | 89.47 | 10.53% | 4.82% | 3.00s | $0.0001 |
| 5 | <code>gemini/gemini-3.6-flash</code> | 3.18s | 100.00 | 0.00% | 0.00% | 3.18s | $0.0020 |
| 6 | <code>gemini/gemini-3.5-flash</code> | 3.41s | 100.00 | 0.00% | 0.00% | 3.41s | $0.0021 |
| 7 | <code>anthropic/claude-sonnet-5-5</code> | 3.48s | 100.00 | 0.00% | 0.00% | 3.48s | $0.0116 |
| 8 | <code>openai/gpt-5.6-terra</code> | 3.49s | 89.47 | 10.53% | 4.82% | 3.49s | $0.0088 |
| 9 | <code>grok/grok-4.5</code> | 4.07s | 89.47 | 10.53% | 4.82% | 4.07s | $0.0072 |
| 10 | <code>anthropic/claude-opus-5-5</code> | 4.21s | 100.00 | 0.00% | 0.00% | 4.21s | $0.0231 |
| 11 | <code>grok/grok-4.7</code> | 4.98s | 100.00 | 0.00% | 0.00% | 4.98s | $0.0092 |
| 12 | <code>anthropic/claude-fable-5</code> | 5.04s | 100.00 | 0.00% | 0.00% | 5.04s | $0.0579 |
| 13 | <code>openai/gpt-6.1-sol</code> | 5.18s | 100.00 | 0.00% | 0.00% | 5.18s | $0.0083 |
| 14 | <code>mistral/mistral-ocr-4-1</code> | 5.31s | 47.37 | 52.63% | 32.53% | 5.31s | $0.0040 |
| 15 | <code>gemini/gemini-3.8-flash</code> | 5.41s | 100.00 | 0.00% | 0.00% | 5.41s | $0.0033 |
| 16 | <code>anthropic/claude-fable-5-1</code> | 5.95s | 100.00 | 0.00% | 0.00% | 5.95s | $0.0579 |
| 17 | <code>openai/gpt-6-astra</code> | 7.06s | 100.00 | 0.00% | 0.00% | 7.06s | $0.0411 |
| 18 | <code>openai/gpt-6-luna</code> | 7.89s | 100.00 | 0.00% | 0.00% | 7.89s | $0.0006 |
| 19 | <code>gemini/gemini-4-argon</code> | 11.74s | 100.00 | 0.00% | 0.00% | 11.74s | $0.0069 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 94.06s | 84.21 | 15.79% | 6.02% | 94.06s | $0.0026 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.04s | $0.0579 |
| 2 | <code>anthropic/claude-fable-5-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.95s | $0.0579 |
| 3 | <code>anthropic/claude-opus-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.21s | $0.0231 |
| 4 | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.48s | $0.0116 |
| 5 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.41s | $0.0021 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.00s | $0.0005 |
| 7 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.18s | $0.0020 |
| 8 | <code>gemini/gemini-3.8-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.41s | $0.0033 |
| 9 | <code>gemini/gemini-4-argon</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 11.74s | $0.0069 |
| 10 | <code>grok/grok-4.7</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.98s | $0.0092 |
| 11 | <code>openai/gpt-6-astra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 7.06s | $0.0411 |
| 12 | <code>openai/gpt-6-luna</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 7.89s | $0.0006 |
| 13 | <code>openai/gpt-6.1-sol</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.18s | $0.0083 |
| 14 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 89.47/100 quality score | 89.47 | 10.53% | 4.82% | 2.75s | $0.0002 |
| 15 | <code>deepinfra/google/gemma-4-31B-it</code> | 89.47/100 quality score | 89.47 | 10.53% | 4.82% | 3.00s | $0.0001 |
| 16 | <code>grok/grok-4.5</code> | 89.47/100 quality score | 89.47 | 10.53% | 4.82% | 4.07s | $0.0072 |
| 17 | <code>openai/gpt-5.6-terra</code> | 89.47/100 quality score | 89.47 | 10.53% | 4.82% | 3.49s | $0.0088 |
| 18 | <code>anthropic/claude-haiku-5-5</code> | 84.21/100 quality score | 84.21 | 15.79% | 6.02% | 2.65s | $0.0006 |
| 19 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 84.21/100 quality score | 84.21 | 15.79% | 6.02% | 94.06s | $0.0026 |
| 20 | <code>mistral/mistral-ocr-4-1</code> | 47.37/100 quality score | 47.37 | 52.63% | 32.53% | 5.31s | $0.0040 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 5.26 | 94.74% | 55.42% | 0.82s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.04s | $0.0579 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.95s | $0.0579 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 84.21 | 15.79% | 6.02% | 2.65s | $0.0006 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.21s | $0.0231 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.48s | $0.0116 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 89.47 | 10.53% | 4.82% | 2.75s | $0.0002 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 89.47 | 10.53% | 4.82% | 3.00s | $0.0001 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 84.21 | 15.79% | 6.02% | 94.06s | $0.0026 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.41s | $0.0021 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.00s | $0.0005 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.18s | $0.0020 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.41s | $0.0033 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 11.74s | $0.0069 |
| <code>grok/grok-4.5</code> | Third-Party Service | 89.47 | 10.53% | 4.82% | 4.07s | $0.0072 |
| <code>grok/grok-4.7</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.98s | $0.0092 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 47.37 | 52.63% | 32.53% | 5.31s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 89.47 | 10.53% | 4.82% | 3.49s | $0.0088 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 7.06s | $0.0411 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 7.89s | $0.0006 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.18s | $0.0083 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 13 | 5 | 0 | 19 |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 0 | 19 |
| <code>anthropic/claude-fable-5-1</code> | 0 | 0 | 0 | 19 |
| <code>anthropic/claude-haiku-5-5</code> | 2 | 1 | 0 | 19 |
| <code>anthropic/claude-opus-5-5</code> | 0 | 0 | 0 | 19 |
| <code>anthropic/claude-sonnet-5-5</code> | 0 | 0 | 0 | 19 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 0 | 1 | 1 | 19 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 0 | 1 | 1 | 19 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 3 | 0 | 0 | 19 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 19 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 19 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 19 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 0 | 0 | 19 |
| <code>gemini/gemini-4-argon</code> | 0 | 0 | 0 | 19 |
| <code>grok/grok-4.5</code> | 0 | 1 | 1 | 19 |
| <code>grok/grok-4.7</code> | 0 | 0 | 0 | 19 |
| <code>mistral/mistral-ocr-4-1</code> | 7 | 0 | 3 | 19 |
| <code>openai/gpt-5.6-terra</code> | 0 | 2 | 0 | 19 |
| <code>openai/gpt-6-astra</code> | 0 | 0 | 0 | 19 |
| <code>openai/gpt-6-luna</code> | 0 | 0 | 0 | 19 |
| <code>openai/gpt-6.1-sol</code> | 0 | 0 | 0 | 19 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 5.26/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0080¢ ($0.0001).
- Fastest local model: `tesseract/tesseract` at 0.82s.
- Fastest cloud service: `anthropic/claude-haiku-5-5` at 2.65s.

## Lexical evaluation scope

Reference scope: full-page. Exhaustive lexical target for the declared input page/crop; drawing syntax is excluded where the publisher serialization declares it.

Headline WER/CER use the existing case-insensitive lexical normalization and declared reference order. Reading-order or serialization differences can increase edit distance; these scores do not measure layout or exact glyph/punctuation fidelity.

Text-only OCR does not establish node placement, edge direction or label-to-branch association. Correct label text is not graph-topology accuracy.

Literal numeric, punctuation and whitespace comparisons are representation-fidelity diagnostics. TSV tabs, span-continuation blanks, Markdown wrappers and source case conventions can differ without establishing a recognition error.

[Literal numeric, punctuation and alternate-reading diagnostics](evaluation-diagnostics.json) retain all source and provider text privately.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- Each provider received the same pinned original PNG/JPEG or the declared rendered-PNG baseline variant. Reference text, table cells, manuscript deletions and graph/layout annotations were never sent to providers. Text recognition is scored separately from unavailable cell, branch and page-geometry accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
