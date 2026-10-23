# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/historical-print-paradise-lost`
- Publisher canonical reference: `historical-print-paradise-lost.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `33bee72da84b8d05a207b87e47a26570234d2039ca3921c454509dac534ac50b`.
- Publisher source: https://en.wikisource.org/w/index.php?title=Page%3AParadise%20Lost%20(1667).djvu%2F46&oldid=15859582&action=raw (revision `15859582`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 71.53 | 28.47% | 5.40% | 0.74s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.74s | 71.53 | 28.47% | 5.40% | 0.74s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 71.53/100 quality score | 71.53 | 28.47% | 5.40% | 0.74s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0002 | 72.54 | 27.46% | 4.54% | 12.65s | $0.0002 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0005 | 73.90 | 26.10% | 3.60% | 6.52s | $0.0005 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0007 | 73.56 | 26.44% | 4.11% | 3.62s | $0.0007 |
| 4 | <code>openai/gpt-6-luna</code> | $0.0014 | 71.86 | 28.14% | 4.68% | 21.49s | $0.0014 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0015 | 73.56 | 26.44% | 3.89% | 2.43s | $0.0015 |
| 6 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0016 | 73.90 | 26.10% | 4.25% | 16.34s | $0.0016 |
| 7 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 97.97 | 2.03% | 1.01% | 2.78s | $0.0040 |
| 8 | <code>gemini/gemini-3.6-flash</code> | $0.0053 | 74.24 | 25.76% | 3.46% | 3.09s | $0.0053 |
| 9 | <code>gemini/gemini-3.8-flash</code> | $0.0054 | 98.64 | 1.36% | 0.14% | 104.00s | $0.0054 |
| 10 | <code>gemini/gemini-3.5-flash</code> | $0.0060 | 74.24 | 25.76% | 3.46% | 4.72s | $0.0060 |
| 11 | <code>grok/grok-4.5</code> | $0.0081 | 73.22 | 26.78% | 3.96% | 6.33s | $0.0081 |
| 12 | <code>openai/gpt-6.1-sol</code> | $0.0124 | 99.66 | 0.34% | 0.07% | 12.46s | $0.0124 |
| 13 | <code>anthropic/claude-sonnet-5-5</code> | $0.0140 | 74.24 | 25.76% | 3.67% | 5.31s | $0.0140 |
| 14 | <code>gemini/gemini-4-argon</code> | $0.0157 | 99.66 | 0.34% | 0.07% | 14.35s | $0.0157 |
| 15 | <code>openai/gpt-5.6-terra</code> | $0.0234 | 72.20 | 27.80% | 4.25% | 12.48s | $0.0234 |
| 16 | <code>anthropic/claude-opus-5-5</code> | $0.0294 | 99.66 | 0.34% | 0.07% | 10.83s | $0.0294 |
| 17 | <code>openai/gpt-6-astra</code> | $0.0627 | 99.66 | 0.34% | 0.07% | 11.13s | $0.0627 |
| 18 | <code>anthropic/claude-fable-5</code> | $0.0700 | 74.24 | 25.76% | 3.67% | 12.23s | $0.0700 |
| 19 | <code>anthropic/claude-fable-5-1</code> | $0.0701 | 73.90 | 26.10% | 3.75% | 6.65s | $0.0701 |
| 20 | <code>grok/grok-4.7</code> | $0.2133 | 98.31 | 1.69% | 0.43% | 93.16s | $0.2133 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 2.43s | 73.56 | 26.44% | 3.89% | 2.43s | $0.0015 |
| 2 | <code>mistral/mistral-ocr-4-1</code> | 2.78s | 97.97 | 2.03% | 1.01% | 2.78s | $0.0040 |
| 3 | <code>gemini/gemini-3.6-flash</code> | 3.09s | 74.24 | 25.76% | 3.46% | 3.09s | $0.0053 |
| 4 | <code>anthropic/claude-haiku-5-5</code> | 3.62s | 73.56 | 26.44% | 4.11% | 3.62s | $0.0007 |
| 5 | <code>gemini/gemini-3.5-flash</code> | 4.72s | 74.24 | 25.76% | 3.46% | 4.72s | $0.0060 |
| 6 | <code>anthropic/claude-sonnet-5-5</code> | 5.31s | 74.24 | 25.76% | 3.67% | 5.31s | $0.0140 |
| 7 | <code>grok/grok-4.5</code> | 6.33s | 73.22 | 26.78% | 3.96% | 6.33s | $0.0081 |
| 8 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 6.52s | 73.90 | 26.10% | 3.60% | 6.52s | $0.0005 |
| 9 | <code>anthropic/claude-fable-5-1</code> | 6.65s | 73.90 | 26.10% | 3.75% | 6.65s | $0.0701 |
| 10 | <code>anthropic/claude-opus-5-5</code> | 10.83s | 99.66 | 0.34% | 0.07% | 10.83s | $0.0294 |
| 11 | <code>openai/gpt-6-astra</code> | 11.13s | 99.66 | 0.34% | 0.07% | 11.13s | $0.0627 |
| 12 | <code>anthropic/claude-fable-5</code> | 12.23s | 74.24 | 25.76% | 3.67% | 12.23s | $0.0700 |
| 13 | <code>openai/gpt-6.1-sol</code> | 12.46s | 99.66 | 0.34% | 0.07% | 12.46s | $0.0124 |
| 14 | <code>openai/gpt-5.6-terra</code> | 12.48s | 72.20 | 27.80% | 4.25% | 12.48s | $0.0234 |
| 15 | <code>deepinfra/google/gemma-4-31B-it</code> | 12.65s | 72.54 | 27.46% | 4.54% | 12.65s | $0.0002 |
| 16 | <code>gemini/gemini-4-argon</code> | 14.35s | 99.66 | 0.34% | 0.07% | 14.35s | $0.0157 |
| 17 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 16.34s | 73.90 | 26.10% | 4.25% | 16.34s | $0.0016 |
| 18 | <code>openai/gpt-6-luna</code> | 21.49s | 71.86 | 28.14% | 4.68% | 21.49s | $0.0014 |
| 19 | <code>grok/grok-4.7</code> | 93.16s | 98.31 | 1.69% | 0.43% | 93.16s | $0.2133 |
| 20 | <code>gemini/gemini-3.8-flash</code> | 104.00s | 98.64 | 1.36% | 0.14% | 104.00s | $0.0054 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-opus-5-5</code> | 99.66/100 quality score | 99.66 | 0.34% | 0.07% | 10.83s | $0.0294 |
| 2 | <code>gemini/gemini-4-argon</code> | 99.66/100 quality score | 99.66 | 0.34% | 0.07% | 14.35s | $0.0157 |
| 3 | <code>openai/gpt-6-astra</code> | 99.66/100 quality score | 99.66 | 0.34% | 0.07% | 11.13s | $0.0627 |
| 4 | <code>openai/gpt-6.1-sol</code> | 99.66/100 quality score | 99.66 | 0.34% | 0.07% | 12.46s | $0.0124 |
| 5 | <code>gemini/gemini-3.8-flash</code> | 98.64/100 quality score | 98.64 | 1.36% | 0.14% | 104.00s | $0.0054 |
| 6 | <code>grok/grok-4.7</code> | 98.31/100 quality score | 98.31 | 1.69% | 0.43% | 93.16s | $0.2133 |
| 7 | <code>mistral/mistral-ocr-4-1</code> | 97.97/100 quality score | 97.97 | 2.03% | 1.01% | 2.78s | $0.0040 |
| 8 | <code>gemini/gemini-3.5-flash</code> | 74.24/100 quality score | 74.24 | 25.76% | 3.46% | 4.72s | $0.0060 |
| 9 | <code>gemini/gemini-3.6-flash</code> | 74.24/100 quality score | 74.24 | 25.76% | 3.46% | 3.09s | $0.0053 |
| 10 | <code>anthropic/claude-fable-5</code> | 74.24/100 quality score | 74.24 | 25.76% | 3.67% | 12.23s | $0.0700 |
| 11 | <code>anthropic/claude-sonnet-5-5</code> | 74.24/100 quality score | 74.24 | 25.76% | 3.67% | 5.31s | $0.0140 |
| 12 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 73.90/100 quality score | 73.90 | 26.10% | 3.60% | 6.52s | $0.0005 |
| 13 | <code>anthropic/claude-fable-5-1</code> | 73.90/100 quality score | 73.90 | 26.10% | 3.75% | 6.65s | $0.0701 |
| 14 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 73.90/100 quality score | 73.90 | 26.10% | 4.25% | 16.34s | $0.0016 |
| 15 | <code>gemini/gemini-3.5-flash-lite</code> | 73.56/100 quality score | 73.56 | 26.44% | 3.89% | 2.43s | $0.0015 |
| 16 | <code>anthropic/claude-haiku-5-5</code> | 73.56/100 quality score | 73.56 | 26.44% | 4.11% | 3.62s | $0.0007 |
| 17 | <code>grok/grok-4.5</code> | 73.22/100 quality score | 73.22 | 26.78% | 3.96% | 6.33s | $0.0081 |
| 18 | <code>deepinfra/google/gemma-4-31B-it</code> | 72.54/100 quality score | 72.54 | 27.46% | 4.54% | 12.65s | $0.0002 |
| 19 | <code>openai/gpt-5.6-terra</code> | 72.20/100 quality score | 72.20 | 27.80% | 4.25% | 12.48s | $0.0234 |
| 20 | <code>openai/gpt-6-luna</code> | 71.86/100 quality score | 71.86 | 28.14% | 4.68% | 21.49s | $0.0014 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 71.53 | 28.47% | 5.40% | 0.74s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 74.24 | 25.76% | 3.67% | 12.23s | $0.0700 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 73.90 | 26.10% | 3.75% | 6.65s | $0.0701 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 73.56 | 26.44% | 4.11% | 3.62s | $0.0007 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 99.66 | 0.34% | 0.07% | 10.83s | $0.0294 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 74.24 | 25.76% | 3.67% | 5.31s | $0.0140 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 73.90 | 26.10% | 3.60% | 6.52s | $0.0005 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 72.54 | 27.46% | 4.54% | 12.65s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 73.90 | 26.10% | 4.25% | 16.34s | $0.0016 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 74.24 | 25.76% | 3.46% | 4.72s | $0.0060 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 73.56 | 26.44% | 3.89% | 2.43s | $0.0015 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 74.24 | 25.76% | 3.46% | 3.09s | $0.0053 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 98.64 | 1.36% | 0.14% | 104.00s | $0.0054 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 99.66 | 0.34% | 0.07% | 14.35s | $0.0157 |
| <code>grok/grok-4.5</code> | Third-Party Service | 73.22 | 26.78% | 3.96% | 6.33s | $0.0081 |
| <code>grok/grok-4.7</code> | Third-Party Service | 98.31 | 1.69% | 0.43% | 93.16s | $0.2133 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 97.97 | 2.03% | 1.01% | 2.78s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 72.20 | 27.80% | 4.25% | 12.48s | $0.0234 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 99.66 | 0.34% | 0.07% | 11.13s | $0.0627 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 71.86 | 28.14% | 4.68% | 21.49s | $0.0014 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 99.66 | 0.34% | 0.07% | 12.46s | $0.0124 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 48 | 35 | 1 | 295 |
| <code>anthropic/claude-fable-5</code> | 44 | 32 | 0 | 295 |
| <code>anthropic/claude-fable-5-1</code> | 45 | 32 | 0 | 295 |
| <code>anthropic/claude-haiku-5-5</code> | 46 | 32 | 0 | 295 |
| <code>anthropic/claude-opus-5-5</code> | 1 | 0 | 0 | 295 |
| <code>anthropic/claude-sonnet-5-5</code> | 44 | 32 | 0 | 295 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 45 | 32 | 0 | 295 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 48 | 32 | 1 | 295 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 45 | 32 | 0 | 295 |
| <code>gemini/gemini-3.5-flash</code> | 44 | 32 | 0 | 295 |
| <code>gemini/gemini-3.5-flash-lite</code> | 46 | 32 | 0 | 295 |
| <code>gemini/gemini-3.6-flash</code> | 44 | 32 | 0 | 295 |
| <code>gemini/gemini-3.8-flash</code> | 2 | 2 | 0 | 295 |
| <code>gemini/gemini-4-argon</code> | 1 | 0 | 0 | 295 |
| <code>grok/grok-4.5</code> | 46 | 33 | 0 | 295 |
| <code>grok/grok-4.7</code> | 3 | 2 | 0 | 295 |
| <code>mistral/mistral-ocr-4-1</code> | 4 | 2 | 0 | 295 |
| <code>openai/gpt-5.6-terra</code> | 49 | 33 | 0 | 295 |
| <code>openai/gpt-6-astra</code> | 1 | 0 | 0 | 295 |
| <code>openai/gpt-6-luna</code> | 48 | 34 | 1 | 295 |
| <code>openai/gpt-6.1-sol</code> | 1 | 0 | 0 | 295 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 71.53/100.
- Best cloud service: `anthropic/claude-opus-5-5` scored 99.66/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0228¢ ($0.0002).
- Fastest local model: `tesseract/tesseract` at 0.74s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 2.43s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
