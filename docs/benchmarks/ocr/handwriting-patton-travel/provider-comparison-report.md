# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/handwriting-patton-travel`
- Publisher canonical reference: `reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `1d968d2ba075a7b7f7661d55dfe8241328ec3f0040e720eb00d80586daf62011`.
- Publisher source: https://tile.loc.gov/storage-services/master/gdc/gdcdatasets/2021386762/2021386762.zip (revision `LOC dataset 2021386762, 2023-04-26`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 0.00 | 100.00% | 100.00% | 0.16s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.16s | 0.00 | 100.00% | 100.00% | 0.16s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.00/100 quality score | 0.00 | 100.00% | 100.00% | 0.16s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0001 | 95.00 | 5.00% | 4.61% | 6.38s | $0.0001 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0002 | 85.00 | 15.00% | 8.25% | 2.10s | $0.0002 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0005 | 92.50 | 7.50% | 4.37% | 4.25s | $0.0005 |
| 4 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0005 | 88.75 | 11.25% | 10.19% | 6.34s | $0.0005 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0007 | 98.75 | 1.25% | 1.21% | 1.92s | $0.0007 |
| 6 | <code>openai/gpt-6-luna</code> | $0.0012 | 75.00 | 25.00% | 19.17% | 19.73s | $0.0012 |
| 7 | <code>gemini/gemini-3.6-flash</code> | $0.0029 | 98.75 | 1.25% | 1.21% | 2.76s | $0.0029 |
| 8 | <code>gemini/gemini-3.8-flash</code> | $0.0029 | 96.25 | 3.75% | 1.21% | 4.18s | $0.0029 |
| 9 | <code>gemini/gemini-3.5-flash</code> | $0.0031 | 97.50 | 2.50% | 2.67% | 1.99s | $0.0031 |
| 10 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 91.25 | 8.75% | 4.13% | 2.41s | $0.0040 |
| 11 | <code>anthropic/claude-sonnet-5-5</code> | $0.0061 | 97.50 | 2.50% | 1.21% | 3.04s | $0.0061 |
| 12 | <code>grok/grok-4.5</code> | $0.0074 | 90.00 | 10.00% | 6.07% | 9.01s | $0.0074 |
| 13 | <code>openai/gpt-6.1-sol</code> | $0.0076 | 97.50 | 2.50% | 2.67% | 12.66s | $0.0076 |
| 14 | <code>anthropic/claude-opus-5-5</code> | $0.0119 | 98.75 | 1.25% | 0.73% | 3.29s | $0.0119 |
| 15 | <code>gemini/gemini-4-argon</code> | $0.0128 | 97.50 | 2.50% | 2.67% | 7.83s | $0.0128 |
| 16 | <code>anthropic/claude-fable-5-1</code> | $0.0298 | 97.50 | 2.50% | 1.21% | 3.27s | $0.0298 |
| 17 | <code>grok/grok-4.7</code> | $0.0304 | 96.25 | 3.75% | 3.40% | 56.10s | $0.0304 |
| 18 | <code>openai/gpt-5.6-terra</code> | $0.0341 | 85.00 | 15.00% | 11.41% | 33.09s | $0.0341 |
| 19 | <code>openai/gpt-6-astra</code> | $0.0342 | 96.25 | 3.75% | 2.18% | 10.07s | $0.0342 |
| 20 | <code>anthropic/claude-fable-5</code> | $0.0385 | 97.50 | 2.50% | 1.21% | 6.95s | $0.0385 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 1.92s | 98.75 | 1.25% | 1.21% | 1.92s | $0.0007 |
| 2 | <code>gemini/gemini-3.5-flash</code> | 1.99s | 97.50 | 2.50% | 2.67% | 1.99s | $0.0031 |
| 3 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 2.10s | 85.00 | 15.00% | 8.25% | 2.10s | $0.0002 |
| 4 | <code>mistral/mistral-ocr-4-1</code> | 2.41s | 91.25 | 8.75% | 4.13% | 2.41s | $0.0040 |
| 5 | <code>gemini/gemini-3.6-flash</code> | 2.76s | 98.75 | 1.25% | 1.21% | 2.76s | $0.0029 |
| 6 | <code>anthropic/claude-sonnet-5-5</code> | 3.04s | 97.50 | 2.50% | 1.21% | 3.04s | $0.0061 |
| 7 | <code>anthropic/claude-fable-5-1</code> | 3.27s | 97.50 | 2.50% | 1.21% | 3.27s | $0.0298 |
| 8 | <code>anthropic/claude-opus-5-5</code> | 3.29s | 98.75 | 1.25% | 0.73% | 3.29s | $0.0119 |
| 9 | <code>gemini/gemini-3.8-flash</code> | 4.18s | 96.25 | 3.75% | 1.21% | 4.18s | $0.0029 |
| 10 | <code>anthropic/claude-haiku-5-5</code> | 4.25s | 92.50 | 7.50% | 4.37% | 4.25s | $0.0005 |
| 11 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 6.34s | 88.75 | 11.25% | 10.19% | 6.34s | $0.0005 |
| 12 | <code>deepinfra/google/gemma-4-31B-it</code> | 6.38s | 95.00 | 5.00% | 4.61% | 6.38s | $0.0001 |
| 13 | <code>anthropic/claude-fable-5</code> | 6.95s | 97.50 | 2.50% | 1.21% | 6.95s | $0.0385 |
| 14 | <code>gemini/gemini-4-argon</code> | 7.83s | 97.50 | 2.50% | 2.67% | 7.83s | $0.0128 |
| 15 | <code>grok/grok-4.5</code> | 9.01s | 90.00 | 10.00% | 6.07% | 9.01s | $0.0074 |
| 16 | <code>openai/gpt-6-astra</code> | 10.07s | 96.25 | 3.75% | 2.18% | 10.07s | $0.0342 |
| 17 | <code>openai/gpt-6.1-sol</code> | 12.66s | 97.50 | 2.50% | 2.67% | 12.66s | $0.0076 |
| 18 | <code>openai/gpt-6-luna</code> | 19.73s | 75.00 | 25.00% | 19.17% | 19.73s | $0.0012 |
| 19 | <code>openai/gpt-5.6-terra</code> | 33.09s | 85.00 | 15.00% | 11.41% | 33.09s | $0.0341 |
| 20 | <code>grok/grok-4.7</code> | 56.10s | 96.25 | 3.75% | 3.40% | 56.10s | $0.0304 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-opus-5-5</code> | 98.75/100 quality score | 98.75 | 1.25% | 0.73% | 3.29s | $0.0119 |
| 2 | <code>gemini/gemini-3.5-flash-lite</code> | 98.75/100 quality score | 98.75 | 1.25% | 1.21% | 1.92s | $0.0007 |
| 3 | <code>gemini/gemini-3.6-flash</code> | 98.75/100 quality score | 98.75 | 1.25% | 1.21% | 2.76s | $0.0029 |
| 4 | <code>anthropic/claude-fable-5</code> | 97.50/100 quality score | 97.50 | 2.50% | 1.21% | 6.95s | $0.0385 |
| 5 | <code>anthropic/claude-fable-5-1</code> | 97.50/100 quality score | 97.50 | 2.50% | 1.21% | 3.27s | $0.0298 |
| 6 | <code>anthropic/claude-sonnet-5-5</code> | 97.50/100 quality score | 97.50 | 2.50% | 1.21% | 3.04s | $0.0061 |
| 7 | <code>gemini/gemini-3.5-flash</code> | 97.50/100 quality score | 97.50 | 2.50% | 2.67% | 1.99s | $0.0031 |
| 8 | <code>gemini/gemini-4-argon</code> | 97.50/100 quality score | 97.50 | 2.50% | 2.67% | 7.83s | $0.0128 |
| 9 | <code>openai/gpt-6.1-sol</code> | 97.50/100 quality score | 97.50 | 2.50% | 2.67% | 12.66s | $0.0076 |
| 10 | <code>gemini/gemini-3.8-flash</code> | 96.25/100 quality score | 96.25 | 3.75% | 1.21% | 4.18s | $0.0029 |
| 11 | <code>openai/gpt-6-astra</code> | 96.25/100 quality score | 96.25 | 3.75% | 2.18% | 10.07s | $0.0342 |
| 12 | <code>grok/grok-4.7</code> | 96.25/100 quality score | 96.25 | 3.75% | 3.40% | 56.10s | $0.0304 |
| 13 | <code>deepinfra/google/gemma-4-31B-it</code> | 95.00/100 quality score | 95.00 | 5.00% | 4.61% | 6.38s | $0.0001 |
| 14 | <code>anthropic/claude-haiku-5-5</code> | 92.50/100 quality score | 92.50 | 7.50% | 4.37% | 4.25s | $0.0005 |
| 15 | <code>mistral/mistral-ocr-4-1</code> | 91.25/100 quality score | 91.25 | 8.75% | 4.13% | 2.41s | $0.0040 |
| 16 | <code>grok/grok-4.5</code> | 90.00/100 quality score | 90.00 | 10.00% | 6.07% | 9.01s | $0.0074 |
| 17 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 88.75/100 quality score | 88.75 | 11.25% | 10.19% | 6.34s | $0.0005 |
| 18 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 85.00/100 quality score | 85.00 | 15.00% | 8.25% | 2.10s | $0.0002 |
| 19 | <code>openai/gpt-5.6-terra</code> | 85.00/100 quality score | 85.00 | 15.00% | 11.41% | 33.09s | $0.0341 |
| 20 | <code>openai/gpt-6-luna</code> | 75.00/100 quality score | 75.00 | 25.00% | 19.17% | 19.73s | $0.0012 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 0.00 | 100.00% | 100.00% | 0.16s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 97.50 | 2.50% | 1.21% | 6.95s | $0.0385 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 97.50 | 2.50% | 1.21% | 3.27s | $0.0298 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 92.50 | 7.50% | 4.37% | 4.25s | $0.0005 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 98.75 | 1.25% | 0.73% | 3.29s | $0.0119 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 97.50 | 2.50% | 1.21% | 3.04s | $0.0061 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 85.00 | 15.00% | 8.25% | 2.10s | $0.0002 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 95.00 | 5.00% | 4.61% | 6.38s | $0.0001 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 88.75 | 11.25% | 10.19% | 6.34s | $0.0005 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 97.50 | 2.50% | 2.67% | 1.99s | $0.0031 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 98.75 | 1.25% | 1.21% | 1.92s | $0.0007 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 98.75 | 1.25% | 1.21% | 2.76s | $0.0029 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 96.25 | 3.75% | 1.21% | 4.18s | $0.0029 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 97.50 | 2.50% | 2.67% | 7.83s | $0.0128 |
| <code>grok/grok-4.5</code> | Third-Party Service | 90.00 | 10.00% | 6.07% | 9.01s | $0.0074 |
| <code>grok/grok-4.7</code> | Third-Party Service | 96.25 | 3.75% | 3.40% | 56.10s | $0.0304 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 91.25 | 8.75% | 4.13% | 2.41s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 85.00 | 15.00% | 11.41% | 33.09s | $0.0341 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 96.25 | 3.75% | 2.18% | 10.07s | $0.0342 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 75.00 | 25.00% | 19.17% | 19.73s | $0.0012 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 97.50 | 2.50% | 2.67% | 12.66s | $0.0076 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 0 | 80 | 0 | 80 |
| <code>anthropic/claude-fable-5</code> | 2 | 0 | 0 | 80 |
| <code>anthropic/claude-fable-5-1</code> | 2 | 0 | 0 | 80 |
| <code>anthropic/claude-haiku-5-5</code> | 3 | 2 | 1 | 80 |
| <code>anthropic/claude-opus-5-5</code> | 1 | 0 | 0 | 80 |
| <code>anthropic/claude-sonnet-5-5</code> | 2 | 0 | 0 | 80 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 9 | 0 | 3 | 80 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 4 | 0 | 0 | 80 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 5 | 4 | 0 | 80 |
| <code>gemini/gemini-3.5-flash</code> | 1 | 1 | 0 | 80 |
| <code>gemini/gemini-3.5-flash-lite</code> | 1 | 0 | 0 | 80 |
| <code>gemini/gemini-3.6-flash</code> | 1 | 0 | 0 | 80 |
| <code>gemini/gemini-3.8-flash</code> | 2 | 0 | 1 | 80 |
| <code>gemini/gemini-4-argon</code> | 0 | 2 | 0 | 80 |
| <code>grok/grok-4.5</code> | 8 | 0 | 0 | 80 |
| <code>grok/grok-4.7</code> | 2 | 1 | 0 | 80 |
| <code>mistral/mistral-ocr-4-1</code> | 7 | 0 | 0 | 80 |
| <code>openai/gpt-5.6-terra</code> | 10 | 0 | 2 | 80 |
| <code>openai/gpt-6-astra</code> | 2 | 1 | 0 | 80 |
| <code>openai/gpt-6-luna</code> | 15 | 3 | 2 | 80 |
| <code>openai/gpt-6.1-sol</code> | 0 | 2 | 0 | 80 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 0.00/100.
- Best cloud service: `anthropic/claude-opus-5-5` scored 98.75/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0118¢ ($0.0001).
- Fastest local model: `tesseract/tesseract` at 0.16s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 1.92s.

## Lexical evaluation scope

Reference scope: region-crop. Exhaustive lexical target for the declared input page/crop; drawing syntax is excluded where the publisher serialization declares it.

Headline WER/CER use the existing case-insensitive lexical normalization and declared reference order. Reading-order or serialization differences can increase edit distance; these scores do not measure layout or exact glyph/punctuation fidelity.

Text-only OCR does not establish handwriting placement, drawing geometry or spatial association.

Literal numeric, punctuation and whitespace comparisons are representation-fidelity diagnostics. TSV tabs, span-continuation blanks, Markdown wrappers and source case conventions can differ without establishing a recognition error.

[Literal numeric, punctuation and alternate-reading diagnostics](evaluation-diagnostics.json) retain all source and provider text privately.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- Each provider received the same pinned original PNG/JPEG or the declared rendered-PNG baseline variant. Reference text, table cells, manuscript deletions and graph/layout annotations were never sent to providers. Text recognition is scored separately from unavailable cell, branch and page-geometry accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
