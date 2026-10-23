# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/handwriting-marker-table`
- Publisher canonical reference: `reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `21b46f03911b866916042379dc49f3c1179e01c28ac84aac5e1eb531994c0fb3`.
- Publisher source: https://huggingface.co/datasets/danielrosehill/Whiteboards/resolve/4b31e86e15743ffea20204a8f6992b0173ecbdf9/data/metadata.jsonl (revision `4b31e86e15743ffea20204a8f6992b0173ecbdf9`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 0.00 | 106.67% | 59.14% | 0.84s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.84s | 0.00 | 106.67% | 59.14% | 0.84s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.00/100 quality score | 0.00 | 106.67% | 59.14% | 0.84s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0001 | 100.00 | 0.00% | 0.00% | 4.58s | $0.0001 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0002 | 100.00 | 0.00% | 0.00% | 2.99s | $0.0002 |
| 3 | <code>openai/gpt-6-luna</code> | $0.0004 | 100.00 | 0.00% | 0.00% | 13.80s | $0.0004 |
| 4 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0005 | 100.00 | 0.00% | 0.00% | 3.64s | $0.0005 |
| 5 | <code>anthropic/claude-haiku-5-5</code> | $0.0006 | 100.00 | 0.00% | 0.00% | 8.65s | $0.0006 |
| 6 | <code>gemini/gemini-3.5-flash</code> | $0.0021 | 100.00 | 0.00% | 0.00% | 3.44s | $0.0021 |
| 7 | <code>gemini/gemini-3.6-flash</code> | $0.0022 | 100.00 | 0.00% | 0.00% | 3.32s | $0.0022 |
| 8 | <code>gemini/gemini-3.8-flash</code> | $0.0024 | 100.00 | 0.00% | 0.00% | 5.60s | $0.0024 |
| 9 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0026 | 93.33 | 6.67% | 1.08% | 6.73s | $0.0026 |
| 10 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 93.33 | 6.67% | 2.15% | 5.20s | $0.0040 |
| 11 | <code>gemini/gemini-4-argon</code> | $0.0068 | 100.00 | 0.00% | 0.00% | 9.28s | $0.0068 |
| 12 | <code>grok/grok-4.5</code> | $0.0073 | 100.00 | 0.00% | 0.00% | 4.97s | $0.0073 |
| 13 | <code>openai/gpt-6.1-sol</code> | $0.0082 | 100.00 | 0.00% | 0.00% | 10.18s | $0.0082 |
| 14 | <code>openai/gpt-5.6-terra</code> | $0.0085 | 100.00 | 0.00% | 0.00% | 11.61s | $0.0085 |
| 15 | <code>grok/grok-4.7</code> | $0.0086 | 100.00 | 0.00% | 0.00% | 4.93s | $0.0086 |
| 16 | <code>anthropic/claude-sonnet-5-5</code> | $0.0116 | 100.00 | 0.00% | 0.00% | 14.05s | $0.0116 |
| 17 | <code>anthropic/claude-opus-5-5</code> | $0.0231 | 100.00 | 0.00% | 0.00% | 11.49s | $0.0231 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0392 | 100.00 | 0.00% | 0.00% | 12.01s | $0.0392 |
| 19 | <code>anthropic/claude-fable-5</code> | $0.0578 | 100.00 | 0.00% | 0.00% | 4.75s | $0.0578 |
| 20 | <code>anthropic/claude-fable-5-1</code> | $0.0578 | 100.00 | 0.00% | 0.00% | 5.61s | $0.0578 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 2.99s | 100.00 | 0.00% | 0.00% | 2.99s | $0.0002 |
| 2 | <code>gemini/gemini-3.6-flash</code> | 3.32s | 100.00 | 0.00% | 0.00% | 3.32s | $0.0022 |
| 3 | <code>gemini/gemini-3.5-flash</code> | 3.44s | 100.00 | 0.00% | 0.00% | 3.44s | $0.0021 |
| 4 | <code>gemini/gemini-3.5-flash-lite</code> | 3.64s | 100.00 | 0.00% | 0.00% | 3.64s | $0.0005 |
| 5 | <code>deepinfra/google/gemma-4-31B-it</code> | 4.58s | 100.00 | 0.00% | 0.00% | 4.58s | $0.0001 |
| 6 | <code>anthropic/claude-fable-5</code> | 4.75s | 100.00 | 0.00% | 0.00% | 4.75s | $0.0578 |
| 7 | <code>grok/grok-4.7</code> | 4.93s | 100.00 | 0.00% | 0.00% | 4.93s | $0.0086 |
| 8 | <code>grok/grok-4.5</code> | 4.97s | 100.00 | 0.00% | 0.00% | 4.97s | $0.0073 |
| 9 | <code>mistral/mistral-ocr-4-1</code> | 5.20s | 93.33 | 6.67% | 2.15% | 5.20s | $0.0040 |
| 10 | <code>gemini/gemini-3.8-flash</code> | 5.60s | 100.00 | 0.00% | 0.00% | 5.60s | $0.0024 |
| 11 | <code>anthropic/claude-fable-5-1</code> | 5.61s | 100.00 | 0.00% | 0.00% | 5.61s | $0.0578 |
| 12 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 6.73s | 93.33 | 6.67% | 1.08% | 6.73s | $0.0026 |
| 13 | <code>anthropic/claude-haiku-5-5</code> | 8.65s | 100.00 | 0.00% | 0.00% | 8.65s | $0.0006 |
| 14 | <code>gemini/gemini-4-argon</code> | 9.28s | 100.00 | 0.00% | 0.00% | 9.28s | $0.0068 |
| 15 | <code>openai/gpt-6.1-sol</code> | 10.18s | 100.00 | 0.00% | 0.00% | 10.18s | $0.0082 |
| 16 | <code>anthropic/claude-opus-5-5</code> | 11.49s | 100.00 | 0.00% | 0.00% | 11.49s | $0.0231 |
| 17 | <code>openai/gpt-5.6-terra</code> | 11.61s | 100.00 | 0.00% | 0.00% | 11.61s | $0.0085 |
| 18 | <code>openai/gpt-6-astra</code> | 12.01s | 100.00 | 0.00% | 0.00% | 12.01s | $0.0392 |
| 19 | <code>openai/gpt-6-luna</code> | 13.80s | 100.00 | 0.00% | 0.00% | 13.80s | $0.0004 |
| 20 | <code>anthropic/claude-sonnet-5-5</code> | 14.05s | 100.00 | 0.00% | 0.00% | 14.05s | $0.0116 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.75s | $0.0578 |
| 2 | <code>anthropic/claude-fable-5-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.61s | $0.0578 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 8.65s | $0.0006 |
| 4 | <code>anthropic/claude-opus-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 11.49s | $0.0231 |
| 5 | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 14.05s | $0.0116 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.99s | $0.0002 |
| 7 | <code>deepinfra/google/gemma-4-31B-it</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.58s | $0.0001 |
| 8 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.44s | $0.0021 |
| 9 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.64s | $0.0005 |
| 10 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.32s | $0.0022 |
| 11 | <code>gemini/gemini-3.8-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.60s | $0.0024 |
| 12 | <code>gemini/gemini-4-argon</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 9.28s | $0.0068 |
| 13 | <code>grok/grok-4.5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.97s | $0.0073 |
| 14 | <code>grok/grok-4.7</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.93s | $0.0086 |
| 15 | <code>openai/gpt-5.6-terra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 11.61s | $0.0085 |
| 16 | <code>openai/gpt-6-astra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 12.01s | $0.0392 |
| 17 | <code>openai/gpt-6-luna</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 13.80s | $0.0004 |
| 18 | <code>openai/gpt-6.1-sol</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 10.18s | $0.0082 |
| 19 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 93.33/100 quality score | 93.33 | 6.67% | 1.08% | 6.73s | $0.0026 |
| 20 | <code>mistral/mistral-ocr-4-1</code> | 93.33/100 quality score | 93.33 | 6.67% | 2.15% | 5.20s | $0.0040 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 0.00 | 106.67% | 59.14% | 0.84s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.75s | $0.0578 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.61s | $0.0578 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 8.65s | $0.0006 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 11.49s | $0.0231 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 14.05s | $0.0116 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.99s | $0.0002 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.58s | $0.0001 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 93.33 | 6.67% | 1.08% | 6.73s | $0.0026 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.44s | $0.0021 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.64s | $0.0005 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.32s | $0.0022 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.60s | $0.0024 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 9.28s | $0.0068 |
| <code>grok/grok-4.5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.97s | $0.0073 |
| <code>grok/grok-4.7</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.93s | $0.0086 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 93.33 | 6.67% | 2.15% | 5.20s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 11.61s | $0.0085 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 12.01s | $0.0392 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 13.80s | $0.0004 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 10.18s | $0.0082 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 14 | 0 | 2 | 15 |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 0 | 15 |
| <code>anthropic/claude-fable-5-1</code> | 0 | 0 | 0 | 15 |
| <code>anthropic/claude-haiku-5-5</code> | 0 | 0 | 0 | 15 |
| <code>anthropic/claude-opus-5-5</code> | 0 | 0 | 0 | 15 |
| <code>anthropic/claude-sonnet-5-5</code> | 0 | 0 | 0 | 15 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 0 | 0 | 0 | 15 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 0 | 0 | 0 | 15 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 1 | 0 | 0 | 15 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 15 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 15 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 15 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 0 | 0 | 15 |
| <code>gemini/gemini-4-argon</code> | 0 | 0 | 0 | 15 |
| <code>grok/grok-4.5</code> | 0 | 0 | 0 | 15 |
| <code>grok/grok-4.7</code> | 0 | 0 | 0 | 15 |
| <code>mistral/mistral-ocr-4-1</code> | 1 | 0 | 0 | 15 |
| <code>openai/gpt-5.6-terra</code> | 0 | 0 | 0 | 15 |
| <code>openai/gpt-6-astra</code> | 0 | 0 | 0 | 15 |
| <code>openai/gpt-6-luna</code> | 0 | 0 | 0 | 15 |
| <code>openai/gpt-6.1-sol</code> | 0 | 0 | 0 | 15 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 0.00/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0080¢ ($0.0001).
- Fastest local model: `tesseract/tesseract` at 0.84s.
- Fastest cloud service: `deepinfra/deepseek-ai/DeepSeek-V4.1-Flash` at 2.99s.

## Lexical evaluation scope

Reference scope: full-page. Exhaustive lexical target for the declared input page/crop; drawing syntax is excluded where the publisher serialization declares it.

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
