# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/bc-rerun-05-pages-the-odyssey`
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 76.06 | 23.94% | 6.48% | 4.39s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 4.39s | 76.06 | 23.94% | 6.48% | 4.39s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 76.06/100 quality score | 76.06 | 23.94% | 6.48% | 4.39s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0010 | 94.98 | 5.02% | 1.17% | 48.75s | $0.0010 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0022 | 86.80 | 13.20% | 2.29% | 30.42s | $0.0022 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0041 | 94.28 | 5.72% | 1.26% | 17.81s | $0.0041 |
| 4 | <code>openai/gpt-6-luna</code> | $0.0048 | 95.95 | 4.05% | 0.64% | 60.68s | $0.0048 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0069 | 89.44 | 10.56% | 1.95% | 12.81s | $0.0069 |
| 6 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0102 | 85.48 | 14.52% | 4.07% | 75.63s | $0.0102 |
| 7 | <code>mistral/mistral-ocr-4-1</code> | $0.0200 | 94.01 | 5.99% | 1.57% | 17.96s | $0.0200 |
| 8 | <code>gemini/gemini-3.6-flash</code> | $0.0231 | 95.77 | 4.23% | 0.84% | 17.00s | $0.0231 |
| 9 | <code>gemini/gemini-3.8-flash</code> | $0.0232 | 97.36 | 2.64% | 0.50% | 27.06s | $0.0232 |
| 10 | <code>gemini/gemini-3.5-flash</code> | $0.0264 | 90.67 | 9.33% | 2.16% | 19.51s | $0.0264 |
| 11 | <code>openai/gpt-6.1-sol</code> | $0.0630 | 89.17 | 10.83% | 1.50% | 58.70s | $0.0630 |
| 12 | <code>grok/grok-4.5</code> | $0.0668 | 89.44 | 10.56% | 2.47% | 103.76s | $0.0668 |
| 13 | <code>gemini/gemini-4-argon</code> | $0.0713 | 76.50 | 23.50% | 3.38% | 83.13s | $0.0713 |
| 14 | <code>anthropic/claude-sonnet-5-5</code> | $0.0810 | 97.62 | 2.38% | 0.36% | 25.56s | $0.0810 |
| 15 | <code>openai/gpt-5.6-terra</code> | $0.1062 | 92.08 | 7.92% | 1.40% | 62.17s | $0.1062 |
| 16 | <code>grok/grok-4.7</code> | $0.1538 | 92.61 | 7.39% | 1.02% | 237.11s | $0.1538 |
| 17 | <code>anthropic/claude-opus-5-5</code> | $0.1681 | 74.47 | 25.53% | 3.60% | 32.06s | $0.1681 |
| 18 | <code>openai/gpt-6-astra</code> | $0.3229 | 78.79 | 21.21% | 3.07% | 53.28s | $0.3229 |
| 19 | <code>anthropic/claude-fable-5</code> | $0.4145 | 81.87 | 18.13% | 3.67% | 59.88s | $0.4145 |
| 20 | <code>anthropic/claude-fable-5-1</code> | $0.4150 | 84.33 | 15.67% | 2.88% | 31.73s | $0.4150 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 12.81s | 89.44 | 10.56% | 1.95% | 12.81s | $0.0069 |
| 2 | <code>gemini/gemini-3.6-flash</code> | 17.00s | 95.77 | 4.23% | 0.84% | 17.00s | $0.0231 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 17.81s | 94.28 | 5.72% | 1.26% | 17.81s | $0.0041 |
| 4 | <code>mistral/mistral-ocr-4-1</code> | 17.96s | 94.01 | 5.99% | 1.57% | 17.96s | $0.0200 |
| 5 | <code>gemini/gemini-3.5-flash</code> | 19.51s | 90.67 | 9.33% | 2.16% | 19.51s | $0.0264 |
| 6 | <code>anthropic/claude-sonnet-5-5</code> | 25.56s | 97.62 | 2.38% | 0.36% | 25.56s | $0.0810 |
| 7 | <code>gemini/gemini-3.8-flash</code> | 27.06s | 97.36 | 2.64% | 0.50% | 27.06s | $0.0232 |
| 8 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 30.42s | 86.80 | 13.20% | 2.29% | 30.42s | $0.0022 |
| 9 | <code>anthropic/claude-fable-5-1</code> | 31.73s | 84.33 | 15.67% | 2.88% | 31.73s | $0.4150 |
| 10 | <code>anthropic/claude-opus-5-5</code> | 32.06s | 74.47 | 25.53% | 3.60% | 32.06s | $0.1681 |
| 11 | <code>deepinfra/google/gemma-4-31B-it</code> | 48.75s | 94.98 | 5.02% | 1.17% | 48.75s | $0.0010 |
| 12 | <code>openai/gpt-6-astra</code> | 53.28s | 78.79 | 21.21% | 3.07% | 53.28s | $0.3229 |
| 13 | <code>openai/gpt-6.1-sol</code> | 58.70s | 89.17 | 10.83% | 1.50% | 58.70s | $0.0630 |
| 14 | <code>anthropic/claude-fable-5</code> | 59.88s | 81.87 | 18.13% | 3.67% | 59.88s | $0.4145 |
| 15 | <code>openai/gpt-6-luna</code> | 60.68s | 95.95 | 4.05% | 0.64% | 60.68s | $0.0048 |
| 16 | <code>openai/gpt-5.6-terra</code> | 62.17s | 92.08 | 7.92% | 1.40% | 62.17s | $0.1062 |
| 17 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 75.63s | 85.48 | 14.52% | 4.07% | 75.63s | $0.0102 |
| 18 | <code>gemini/gemini-4-argon</code> | 83.13s | 76.50 | 23.50% | 3.38% | 83.13s | $0.0713 |
| 19 | <code>grok/grok-4.5</code> | 103.76s | 89.44 | 10.56% | 2.47% | 103.76s | $0.0668 |
| 20 | <code>grok/grok-4.7</code> | 237.11s | 92.61 | 7.39% | 1.02% | 237.11s | $0.1538 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-sonnet-5-5</code> | 97.62/100 quality score | 97.62 | 2.38% | 0.36% | 25.56s | $0.0810 |
| 2 | <code>gemini/gemini-3.8-flash</code> | 97.36/100 quality score | 97.36 | 2.64% | 0.50% | 27.06s | $0.0232 |
| 3 | <code>openai/gpt-6-luna</code> | 95.95/100 quality score | 95.95 | 4.05% | 0.64% | 60.68s | $0.0048 |
| 4 | <code>gemini/gemini-3.6-flash</code> | 95.77/100 quality score | 95.77 | 4.23% | 0.84% | 17.00s | $0.0231 |
| 5 | <code>deepinfra/google/gemma-4-31B-it</code> | 94.98/100 quality score | 94.98 | 5.02% | 1.17% | 48.75s | $0.0010 |
| 6 | <code>anthropic/claude-haiku-5-5</code> | 94.28/100 quality score | 94.28 | 5.72% | 1.26% | 17.81s | $0.0041 |
| 7 | <code>mistral/mistral-ocr-4-1</code> | 94.01/100 quality score | 94.01 | 5.99% | 1.57% | 17.96s | $0.0200 |
| 8 | <code>grok/grok-4.7</code> | 92.61/100 quality score | 92.61 | 7.39% | 1.02% | 237.11s | $0.1538 |
| 9 | <code>openai/gpt-5.6-terra</code> | 92.08/100 quality score | 92.08 | 7.92% | 1.40% | 62.17s | $0.1062 |
| 10 | <code>gemini/gemini-3.5-flash</code> | 90.67/100 quality score | 90.67 | 9.33% | 2.16% | 19.51s | $0.0264 |
| 11 | <code>gemini/gemini-3.5-flash-lite</code> | 89.44/100 quality score | 89.44 | 10.56% | 1.95% | 12.81s | $0.0069 |
| 12 | <code>grok/grok-4.5</code> | 89.44/100 quality score | 89.44 | 10.56% | 2.47% | 103.76s | $0.0668 |
| 13 | <code>openai/gpt-6.1-sol</code> | 89.17/100 quality score | 89.17 | 10.83% | 1.50% | 58.70s | $0.0630 |
| 14 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 86.80/100 quality score | 86.80 | 13.20% | 2.29% | 30.42s | $0.0022 |
| 15 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 85.48/100 quality score | 85.48 | 14.52% | 4.07% | 75.63s | $0.0102 |
| 16 | <code>anthropic/claude-fable-5-1</code> | 84.33/100 quality score | 84.33 | 15.67% | 2.88% | 31.73s | $0.4150 |
| 17 | <code>anthropic/claude-fable-5</code> | 81.87/100 quality score | 81.87 | 18.13% | 3.67% | 59.88s | $0.4145 |
| 18 | <code>openai/gpt-6-astra</code> | 78.79/100 quality score | 78.79 | 21.21% | 3.07% | 53.28s | $0.3229 |
| 19 | <code>gemini/gemini-4-argon</code> | 76.50/100 quality score | 76.50 | 23.50% | 3.38% | 83.13s | $0.0713 |
| 20 | <code>anthropic/claude-opus-5-5</code> | 74.47/100 quality score | 74.47 | 25.53% | 3.60% | 32.06s | $0.1681 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 76.06 | 23.94% | 6.48% | 4.39s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 81.87 | 18.13% | 3.67% | 59.88s | $0.4145 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 84.33 | 15.67% | 2.88% | 31.73s | $0.4150 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 94.28 | 5.72% | 1.26% | 17.81s | $0.0041 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 74.47 | 25.53% | 3.60% | 32.06s | $0.1681 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 97.62 | 2.38% | 0.36% | 25.56s | $0.0810 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 86.80 | 13.20% | 2.29% | 30.42s | $0.0022 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 94.98 | 5.02% | 1.17% | 48.75s | $0.0010 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 85.48 | 14.52% | 4.07% | 75.63s | $0.0102 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 90.67 | 9.33% | 2.16% | 19.51s | $0.0264 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 89.44 | 10.56% | 1.95% | 12.81s | $0.0069 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 95.77 | 4.23% | 0.84% | 17.00s | $0.0231 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 97.36 | 2.64% | 0.50% | 27.06s | $0.0232 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 76.50 | 23.50% | 3.38% | 83.13s | $0.0713 |
| <code>grok/grok-4.5</code> | Third-Party Service | 89.44 | 10.56% | 2.47% | 103.76s | $0.0668 |
| <code>grok/grok-4.7</code> | Third-Party Service | 92.61 | 7.39% | 1.02% | 237.11s | $0.1538 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 94.01 | 5.99% | 1.57% | 17.96s | $0.0200 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 92.08 | 7.92% | 1.40% | 62.17s | $0.1062 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 78.79 | 21.21% | 3.07% | 53.28s | $0.3229 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 95.95 | 4.05% | 0.64% | 60.68s | $0.0048 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 89.17 | 10.83% | 1.50% | 58.70s | $0.0630 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 219 | 40 | 13 | 1136 |
| <code>anthropic/claude-fable-5</code> | 187 | 3 | 16 | 1136 |
| <code>anthropic/claude-fable-5-1</code> | 148 | 0 | 30 | 1136 |
| <code>anthropic/claude-haiku-5-5</code> | 57 | 7 | 1 | 1136 |
| <code>anthropic/claude-opus-5-5</code> | 187 | 18 | 85 | 1136 |
| <code>anthropic/claude-sonnet-5-5</code> | 9 | 18 | 0 | 1136 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 126 | 4 | 20 | 1136 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 28 | 5 | 24 | 1136 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 124 | 29 | 12 | 1136 |
| <code>gemini/gemini-3.5-flash</code> | 70 | 31 | 5 | 1136 |
| <code>gemini/gemini-3.5-flash-lite</code> | 75 | 21 | 24 | 1136 |
| <code>gemini/gemini-3.6-flash</code> | 30 | 17 | 1 | 1136 |
| <code>gemini/gemini-3.8-flash</code> | 11 | 19 | 0 | 1136 |
| <code>gemini/gemini-4-argon</code> | 182 | 1 | 84 | 1136 |
| <code>grok/grok-4.5</code> | 68 | 38 | 14 | 1136 |
| <code>grok/grok-4.7</code> | 46 | 18 | 20 | 1136 |
| <code>mistral/mistral-ocr-4-1</code> | 52 | 14 | 2 | 1136 |
| <code>openai/gpt-5.6-terra</code> | 47 | 23 | 20 | 1136 |
| <code>openai/gpt-6-astra</code> | 151 | 24 | 66 | 1136 |
| <code>openai/gpt-6-luna</code> | 18 | 24 | 4 | 1136 |
| <code>openai/gpt-6.1-sol</code> | 67 | 21 | 35 | 1136 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 76.06/100.
- Best cloud service: `anthropic/claude-sonnet-5-5` scored 97.62/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.1043¢ ($0.0010).
- Fastest local model: `tesseract/tesseract` at 4.39s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 12.81s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: the existing archived multi-provider consensus is reused byte for byte; it is not independent publisher gold.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
