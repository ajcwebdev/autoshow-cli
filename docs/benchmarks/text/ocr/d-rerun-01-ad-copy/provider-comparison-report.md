# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-category-d-run/benchmark-runs/d-rerun-01-ad-copy`
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
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 25.40 | 74.60% | 68.21% | 0.15s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.15s | 25.40 | 74.60% | 68.21% | 0.15s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 25.40/100 quality score | 25.40 | 74.60% | 68.21% | 0.15s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0001 | 96.83 | 3.17% | 2.56% | 4.88s | $0.0001 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0002 | 95.24 | 4.76% | 6.41% | 1.52s | $0.0002 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0002 | 92.06 | 7.94% | 4.87% | 1.78s | $0.0002 |
| 4 | <code>openai/gpt-6-luna</code> | $0.0003 | 92.06 | 7.94% | 6.67% | 4.38s | $0.0003 |
| 5 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0005 | 93.65 | 6.35% | 1.28% | 4.39s | $0.0005 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0007 | 92.06 | 7.94% | 10.77% | 1.22s | $0.0007 |
| 7 | <code>openai/gpt-6.1-sol</code> | $0.0027 | 92.06 | 7.94% | 5.13% | 4.02s | $0.0027 |
| 8 | <code>gemini/gemini-3.8-flash</code> | $0.0030 | 95.24 | 4.76% | 2.82% | 4.43s | $0.0030 |
| 9 | <code>gemini/gemini-3.5-flash</code> | $0.0030 | 95.24 | 4.76% | 2.82% | 1.69s | $0.0030 |
| 10 | <code>gemini/gemini-3.6-flash</code> | $0.0031 | 95.24 | 4.76% | 2.82% | 1.99s | $0.0031 |
| 11 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 82.54 | 17.46% | 14.36% | 1.70s | $0.0040 |
| 12 | <code>openai/gpt-5.6-terra</code> | $0.0048 | 90.48 | 9.52% | 7.95% | 4.09s | $0.0048 |
| 13 | <code>anthropic/claude-sonnet-5-5</code> | $0.0051 | 98.41 | 1.59% | 0.26% | 2.76s | $0.0051 |
| 14 | <code>grok/grok-4.5</code> | $0.0051 | 93.65 | 6.35% | 4.62% | 5.38s | $0.0051 |
| 15 | <code>grok/grok-4.7</code> | $0.0071 | 100.00 | 0.00% | 0.00% | 5.94s | $0.0071 |
| 16 | <code>gemini/gemini-4-argon</code> | $0.0094 | 96.83 | 3.17% | 0.77% | 6.95s | $0.0094 |
| 17 | <code>anthropic/claude-opus-5-5</code> | $0.0101 | 98.41 | 1.59% | 0.26% | 3.30s | $0.0101 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0175 | 88.89 | 11.11% | 7.95% | 6.84s | $0.0175 |
| 19 | <code>anthropic/claude-fable-5-1</code> | $0.0256 | 98.41 | 1.59% | 0.26% | 2.96s | $0.0256 |
| 20 | <code>anthropic/claude-fable-5</code> | $0.0260 | 88.89 | 11.11% | 7.44% | 4.48s | $0.0260 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 1.22s | 92.06 | 7.94% | 10.77% | 1.22s | $0.0007 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 1.52s | 95.24 | 4.76% | 6.41% | 1.52s | $0.0002 |
| 3 | <code>gemini/gemini-3.5-flash</code> | 1.69s | 95.24 | 4.76% | 2.82% | 1.69s | $0.0030 |
| 4 | <code>mistral/mistral-ocr-4-1</code> | 1.70s | 82.54 | 17.46% | 14.36% | 1.70s | $0.0040 |
| 5 | <code>anthropic/claude-haiku-5-5</code> | 1.78s | 92.06 | 7.94% | 4.87% | 1.78s | $0.0002 |
| 6 | <code>gemini/gemini-3.6-flash</code> | 1.99s | 95.24 | 4.76% | 2.82% | 1.99s | $0.0031 |
| 7 | <code>anthropic/claude-sonnet-5-5</code> | 2.76s | 98.41 | 1.59% | 0.26% | 2.76s | $0.0051 |
| 8 | <code>anthropic/claude-fable-5-1</code> | 2.96s | 98.41 | 1.59% | 0.26% | 2.96s | $0.0256 |
| 9 | <code>anthropic/claude-opus-5-5</code> | 3.30s | 98.41 | 1.59% | 0.26% | 3.30s | $0.0101 |
| 10 | <code>openai/gpt-6.1-sol</code> | 4.02s | 92.06 | 7.94% | 5.13% | 4.02s | $0.0027 |
| 11 | <code>openai/gpt-5.6-terra</code> | 4.09s | 90.48 | 9.52% | 7.95% | 4.09s | $0.0048 |
| 12 | <code>openai/gpt-6-luna</code> | 4.38s | 92.06 | 7.94% | 6.67% | 4.38s | $0.0003 |
| 13 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 4.39s | 93.65 | 6.35% | 1.28% | 4.39s | $0.0005 |
| 14 | <code>gemini/gemini-3.8-flash</code> | 4.43s | 95.24 | 4.76% | 2.82% | 4.43s | $0.0030 |
| 15 | <code>anthropic/claude-fable-5</code> | 4.48s | 88.89 | 11.11% | 7.44% | 4.48s | $0.0260 |
| 16 | <code>deepinfra/google/gemma-4-31B-it</code> | 4.88s | 96.83 | 3.17% | 2.56% | 4.88s | $0.0001 |
| 17 | <code>grok/grok-4.5</code> | 5.38s | 93.65 | 6.35% | 4.62% | 5.38s | $0.0051 |
| 18 | <code>grok/grok-4.7</code> | 5.94s | 100.00 | 0.00% | 0.00% | 5.94s | $0.0071 |
| 19 | <code>openai/gpt-6-astra</code> | 6.84s | 88.89 | 11.11% | 7.95% | 6.84s | $0.0175 |
| 20 | <code>gemini/gemini-4-argon</code> | 6.95s | 96.83 | 3.17% | 0.77% | 6.95s | $0.0094 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>grok/grok-4.7</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.94s | $0.0071 |
| 2 | <code>anthropic/claude-fable-5-1</code> | 98.41/100 quality score | 98.41 | 1.59% | 0.26% | 2.96s | $0.0256 |
| 3 | <code>anthropic/claude-opus-5-5</code> | 98.41/100 quality score | 98.41 | 1.59% | 0.26% | 3.30s | $0.0101 |
| 4 | <code>anthropic/claude-sonnet-5-5</code> | 98.41/100 quality score | 98.41 | 1.59% | 0.26% | 2.76s | $0.0051 |
| 5 | <code>gemini/gemini-4-argon</code> | 96.83/100 quality score | 96.83 | 3.17% | 0.77% | 6.95s | $0.0094 |
| 6 | <code>deepinfra/google/gemma-4-31B-it</code> | 96.83/100 quality score | 96.83 | 3.17% | 2.56% | 4.88s | $0.0001 |
| 7 | <code>gemini/gemini-3.5-flash</code> | 95.24/100 quality score | 95.24 | 4.76% | 2.82% | 1.69s | $0.0030 |
| 8 | <code>gemini/gemini-3.6-flash</code> | 95.24/100 quality score | 95.24 | 4.76% | 2.82% | 1.99s | $0.0031 |
| 9 | <code>gemini/gemini-3.8-flash</code> | 95.24/100 quality score | 95.24 | 4.76% | 2.82% | 4.43s | $0.0030 |
| 10 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 95.24/100 quality score | 95.24 | 4.76% | 6.41% | 1.52s | $0.0002 |
| 11 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 93.65/100 quality score | 93.65 | 6.35% | 1.28% | 4.39s | $0.0005 |
| 12 | <code>grok/grok-4.5</code> | 93.65/100 quality score | 93.65 | 6.35% | 4.62% | 5.38s | $0.0051 |
| 13 | <code>anthropic/claude-haiku-5-5</code> | 92.06/100 quality score | 92.06 | 7.94% | 4.87% | 1.78s | $0.0002 |
| 14 | <code>openai/gpt-6.1-sol</code> | 92.06/100 quality score | 92.06 | 7.94% | 5.13% | 4.02s | $0.0027 |
| 15 | <code>openai/gpt-6-luna</code> | 92.06/100 quality score | 92.06 | 7.94% | 6.67% | 4.38s | $0.0003 |
| 16 | <code>gemini/gemini-3.5-flash-lite</code> | 92.06/100 quality score | 92.06 | 7.94% | 10.77% | 1.22s | $0.0007 |
| 17 | <code>openai/gpt-5.6-terra</code> | 90.48/100 quality score | 90.48 | 9.52% | 7.95% | 4.09s | $0.0048 |
| 18 | <code>anthropic/claude-fable-5</code> | 88.89/100 quality score | 88.89 | 11.11% | 7.44% | 4.48s | $0.0260 |
| 19 | <code>openai/gpt-6-astra</code> | 88.89/100 quality score | 88.89 | 11.11% | 7.95% | 6.84s | $0.0175 |
| 20 | <code>mistral/mistral-ocr-4-1</code> | 82.54/100 quality score | 82.54 | 17.46% | 14.36% | 1.70s | $0.0040 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 25.40 | 74.60% | 68.21% | 0.15s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 88.89 | 11.11% | 7.44% | 4.48s | $0.0260 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 98.41 | 1.59% | 0.26% | 2.96s | $0.0256 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 92.06 | 7.94% | 4.87% | 1.78s | $0.0002 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 98.41 | 1.59% | 0.26% | 3.30s | $0.0101 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 98.41 | 1.59% | 0.26% | 2.76s | $0.0051 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 95.24 | 4.76% | 6.41% | 1.52s | $0.0002 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 96.83 | 3.17% | 2.56% | 4.88s | $0.0001 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 93.65 | 6.35% | 1.28% | 4.39s | $0.0005 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 95.24 | 4.76% | 2.82% | 1.69s | $0.0030 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 92.06 | 7.94% | 10.77% | 1.22s | $0.0007 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 95.24 | 4.76% | 2.82% | 1.99s | $0.0031 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 95.24 | 4.76% | 2.82% | 4.43s | $0.0030 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 96.83 | 3.17% | 0.77% | 6.95s | $0.0094 |
| <code>grok/grok-4.5</code> | Third-Party Service | 93.65 | 6.35% | 4.62% | 5.38s | $0.0051 |
| <code>grok/grok-4.7</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.94s | $0.0071 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 82.54 | 17.46% | 14.36% | 1.70s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 90.48 | 9.52% | 7.95% | 4.09s | $0.0048 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 88.89 | 11.11% | 7.95% | 6.84s | $0.0175 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 92.06 | 7.94% | 6.67% | 4.38s | $0.0003 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 92.06 | 7.94% | 5.13% | 4.02s | $0.0027 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 12 | 35 | 0 | 63 |
| <code>anthropic/claude-fable-5</code> | 1 | 3 | 3 | 63 |
| <code>anthropic/claude-fable-5-1</code> | 1 | 0 | 0 | 63 |
| <code>anthropic/claude-haiku-5-5</code> | 1 | 2 | 2 | 63 |
| <code>anthropic/claude-opus-5-5</code> | 1 | 0 | 0 | 63 |
| <code>anthropic/claude-sonnet-5-5</code> | 1 | 0 | 0 | 63 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 1 | 1 | 1 | 63 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 0 | 1 | 1 | 63 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 1 | 0 | 3 | 63 |
| <code>gemini/gemini-3.5-flash</code> | 1 | 1 | 1 | 63 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 3 | 2 | 63 |
| <code>gemini/gemini-3.6-flash</code> | 1 | 1 | 1 | 63 |
| <code>gemini/gemini-3.8-flash</code> | 1 | 1 | 1 | 63 |
| <code>gemini/gemini-4-argon</code> | 1 | 0 | 1 | 63 |
| <code>grok/grok-4.5</code> | 0 | 2 | 2 | 63 |
| <code>grok/grok-4.7</code> | 0 | 0 | 0 | 63 |
| <code>mistral/mistral-ocr-4-1</code> | 6 | 4 | 1 | 63 |
| <code>openai/gpt-5.6-terra</code> | 0 | 3 | 3 | 63 |
| <code>openai/gpt-6-astra</code> | 1 | 3 | 3 | 63 |
| <code>openai/gpt-6-luna</code> | 0 | 3 | 2 | 63 |
| <code>openai/gpt-6.1-sol</code> | 1 | 2 | 2 | 63 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 25.40/100.
- Best cloud service: `grok/grok-4.7` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0113¢ ($0.0001).
- Fastest local model: `tesseract/tesseract` at 0.15s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 1.22s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: the existing archived multi-provider consensus is reused byte for byte; it is not independent publisher gold.
- Every provider received the same full original JPEG. No gold words or annotation coordinates were sent to providers. Text-only outputs do not establish word-region localization or full-image exhaustive accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
