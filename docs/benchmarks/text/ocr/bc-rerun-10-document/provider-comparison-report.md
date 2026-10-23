# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/bc-rerun-10-document`
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
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 90.08 | 9.92% | 8.87% | 9.08s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 9.08s | 90.08 | 9.92% | 8.87% | 9.08s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 90.08/100 quality score | 90.08 | 9.92% | 8.87% | 9.08s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0023 | 99.77 | 0.23% | 0.03% | 138.15s | $0.0023 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0042 | 100.00 | 0.00% | 0.00% | 36.19s | $0.0042 |
| 3 | <code>openai/gpt-6-luna</code> | $0.0066 | 100.00 | 0.00% | 0.00% | 63.59s | $0.0066 |
| 4 | <code>anthropic/claude-haiku-5-5</code> | $0.0086 | 99.89 | 0.11% | 0.02% | 32.67s | $0.0086 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0148 | 99.83 | 0.17% | 0.03% | 24.01s | $0.0148 |
| 6 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0243 | 97.71 | 2.29% | 2.10% | 182.77s | $0.0243 |
| 7 | <code>mistral/mistral-ocr-4-1</code> | $0.0400 | 99.71 | 0.29% | 0.27% | 28.15s | $0.0400 |
| 8 | <code>gemini/gemini-3.6-flash</code> | $0.0509 | 99.94 | 0.06% | 0.01% | 33.62s | $0.0509 |
| 9 | <code>gemini/gemini-3.8-flash</code> | $0.0521 | 100.00 | 0.00% | 0.00% | 68.20s | $0.0521 |
| 10 | <code>gemini/gemini-3.5-flash</code> | $0.0582 | 99.94 | 0.06% | 0.01% | 31.76s | $0.0582 |
| 11 | <code>openai/gpt-6.1-sol</code> | $0.1089 | 100.00 | 0.00% | 0.00% | 72.70s | $0.1089 |
| 12 | <code>gemini/gemini-4-argon</code> | $0.1533 | 100.00 | 0.00% | 0.00% | 167.94s | $0.1533 |
| 13 | <code>anthropic/claude-sonnet-5-5</code> | $0.1727 | 100.00 | 0.00% | 0.00% | 59.49s | $0.1727 |
| 14 | <code>anthropic/claude-opus-5-5</code> | $0.3452 | 100.00 | 0.00% | 0.00% | 65.76s | $0.3452 |
| 15 | <code>grok/grok-4.5</code> | $0.4503 | 100.00 | 0.00% | 0.00% | 83.01s | $0.4503 |
| 16 | <code>openai/gpt-5.6-terra</code> | $0.4795 | 100.00 | 0.00% | 0.00% | 42.02s | $0.4795 |
| 17 | <code>grok/grok-4.7</code> | $0.5021 | 100.00 | 0.00% | 0.00% | 111.21s | $0.5021 |
| 18 | <code>openai/gpt-6-astra</code> | $0.5445 | 100.00 | 0.00% | 0.00% | 55.11s | $0.5445 |
| 19 | <code>anthropic/claude-fable-5</code> | $0.8622 | 99.83 | 0.17% | 0.02% | 86.15s | $0.8622 |
| 20 | <code>anthropic/claude-fable-5-1</code> | $0.8639 | 100.00 | 0.00% | 0.00% | 68.23s | $0.8639 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 24.01s | 99.83 | 0.17% | 0.03% | 24.01s | $0.0148 |
| 2 | <code>mistral/mistral-ocr-4-1</code> | 28.15s | 99.71 | 0.29% | 0.27% | 28.15s | $0.0400 |
| 3 | <code>gemini/gemini-3.5-flash</code> | 31.76s | 99.94 | 0.06% | 0.01% | 31.76s | $0.0582 |
| 4 | <code>anthropic/claude-haiku-5-5</code> | 32.67s | 99.89 | 0.11% | 0.02% | 32.67s | $0.0086 |
| 5 | <code>gemini/gemini-3.6-flash</code> | 33.62s | 99.94 | 0.06% | 0.01% | 33.62s | $0.0509 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 36.19s | 100.00 | 0.00% | 0.00% | 36.19s | $0.0042 |
| 7 | <code>openai/gpt-5.6-terra</code> | 42.02s | 100.00 | 0.00% | 0.00% | 42.02s | $0.4795 |
| 8 | <code>openai/gpt-6-astra</code> | 55.11s | 100.00 | 0.00% | 0.00% | 55.11s | $0.5445 |
| 9 | <code>anthropic/claude-sonnet-5-5</code> | 59.49s | 100.00 | 0.00% | 0.00% | 59.49s | $0.1727 |
| 10 | <code>openai/gpt-6-luna</code> | 63.59s | 100.00 | 0.00% | 0.00% | 63.59s | $0.0066 |
| 11 | <code>anthropic/claude-opus-5-5</code> | 65.76s | 100.00 | 0.00% | 0.00% | 65.76s | $0.3452 |
| 12 | <code>gemini/gemini-3.8-flash</code> | 68.20s | 100.00 | 0.00% | 0.00% | 68.20s | $0.0521 |
| 13 | <code>anthropic/claude-fable-5-1</code> | 68.23s | 100.00 | 0.00% | 0.00% | 68.23s | $0.8639 |
| 14 | <code>openai/gpt-6.1-sol</code> | 72.70s | 100.00 | 0.00% | 0.00% | 72.70s | $0.1089 |
| 15 | <code>grok/grok-4.5</code> | 83.01s | 100.00 | 0.00% | 0.00% | 83.01s | $0.4503 |
| 16 | <code>anthropic/claude-fable-5</code> | 86.15s | 99.83 | 0.17% | 0.02% | 86.15s | $0.8622 |
| 17 | <code>grok/grok-4.7</code> | 111.21s | 100.00 | 0.00% | 0.00% | 111.21s | $0.5021 |
| 18 | <code>deepinfra/google/gemma-4-31B-it</code> | 138.15s | 99.77 | 0.23% | 0.03% | 138.15s | $0.0023 |
| 19 | <code>gemini/gemini-4-argon</code> | 167.94s | 100.00 | 0.00% | 0.00% | 167.94s | $0.1533 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 182.77s | 97.71 | 2.29% | 2.10% | 182.77s | $0.0243 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 68.23s | $0.8639 |
| 2 | <code>anthropic/claude-opus-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 65.76s | $0.3452 |
| 3 | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 59.49s | $0.1727 |
| 4 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 36.19s | $0.0042 |
| 5 | <code>gemini/gemini-3.8-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 68.20s | $0.0521 |
| 6 | <code>gemini/gemini-4-argon</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 167.94s | $0.1533 |
| 7 | <code>grok/grok-4.5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 83.01s | $0.4503 |
| 8 | <code>grok/grok-4.7</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 111.21s | $0.5021 |
| 9 | <code>openai/gpt-5.6-terra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 42.02s | $0.4795 |
| 10 | <code>openai/gpt-6-astra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 55.11s | $0.5445 |
| 11 | <code>openai/gpt-6-luna</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 63.59s | $0.0066 |
| 12 | <code>openai/gpt-6.1-sol</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 72.70s | $0.1089 |
| 13 | <code>gemini/gemini-3.5-flash</code> | 99.94/100 quality score | 99.94 | 0.06% | 0.01% | 31.76s | $0.0582 |
| 14 | <code>gemini/gemini-3.6-flash</code> | 99.94/100 quality score | 99.94 | 0.06% | 0.01% | 33.62s | $0.0509 |
| 15 | <code>anthropic/claude-haiku-5-5</code> | 99.89/100 quality score | 99.89 | 0.11% | 0.02% | 32.67s | $0.0086 |
| 16 | <code>anthropic/claude-fable-5</code> | 99.83/100 quality score | 99.83 | 0.17% | 0.02% | 86.15s | $0.8622 |
| 17 | <code>gemini/gemini-3.5-flash-lite</code> | 99.83/100 quality score | 99.83 | 0.17% | 0.03% | 24.01s | $0.0148 |
| 18 | <code>deepinfra/google/gemma-4-31B-it</code> | 99.77/100 quality score | 99.77 | 0.23% | 0.03% | 138.15s | $0.0023 |
| 19 | <code>mistral/mistral-ocr-4-1</code> | 99.71/100 quality score | 99.71 | 0.29% | 0.27% | 28.15s | $0.0400 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 97.71/100 quality score | 97.71 | 2.29% | 2.10% | 182.77s | $0.0243 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 90.08 | 9.92% | 8.87% | 9.08s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 99.83 | 0.17% | 0.02% | 86.15s | $0.8622 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 68.23s | $0.8639 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 99.89 | 0.11% | 0.02% | 32.67s | $0.0086 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 65.76s | $0.3452 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 59.49s | $0.1727 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 36.19s | $0.0042 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 99.77 | 0.23% | 0.03% | 138.15s | $0.0023 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 97.71 | 2.29% | 2.10% | 182.77s | $0.0243 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 99.94 | 0.06% | 0.01% | 31.76s | $0.0582 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 99.83 | 0.17% | 0.03% | 24.01s | $0.0148 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 99.94 | 0.06% | 0.01% | 33.62s | $0.0509 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 68.20s | $0.0521 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 167.94s | $0.1533 |
| <code>grok/grok-4.5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 83.01s | $0.4503 |
| <code>grok/grok-4.7</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 111.21s | $0.5021 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 99.71 | 0.29% | 0.27% | 28.15s | $0.0400 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 42.02s | $0.4795 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 55.11s | $0.5445 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 63.59s | $0.0066 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 72.70s | $0.1089 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 102 | 43 | 28 | 1744 |
| <code>anthropic/claude-fable-5</code> | 3 | 0 | 0 | 1744 |
| <code>anthropic/claude-fable-5-1</code> | 0 | 0 | 0 | 1744 |
| <code>anthropic/claude-haiku-5-5</code> | 2 | 0 | 0 | 1744 |
| <code>anthropic/claude-opus-5-5</code> | 0 | 0 | 0 | 1744 |
| <code>anthropic/claude-sonnet-5-5</code> | 0 | 0 | 0 | 1744 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 0 | 0 | 0 | 1744 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 3 | 0 | 1 | 1744 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 10 | 17 | 13 | 1744 |
| <code>gemini/gemini-3.5-flash</code> | 1 | 0 | 0 | 1744 |
| <code>gemini/gemini-3.5-flash-lite</code> | 1 | 1 | 1 | 1744 |
| <code>gemini/gemini-3.6-flash</code> | 1 | 0 | 0 | 1744 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 0 | 0 | 1744 |
| <code>gemini/gemini-4-argon</code> | 0 | 0 | 0 | 1744 |
| <code>grok/grok-4.5</code> | 0 | 0 | 0 | 1744 |
| <code>grok/grok-4.7</code> | 0 | 0 | 0 | 1744 |
| <code>mistral/mistral-ocr-4-1</code> | 0 | 0 | 5 | 1744 |
| <code>openai/gpt-5.6-terra</code> | 0 | 0 | 0 | 1744 |
| <code>openai/gpt-6-astra</code> | 0 | 0 | 0 | 1744 |
| <code>openai/gpt-6-luna</code> | 0 | 0 | 0 | 1744 |
| <code>openai/gpt-6.1-sol</code> | 0 | 0 | 0 | 1744 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 90.08/100.
- Best cloud service: `anthropic/claude-fable-5-1` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.2349¢ ($0.0023).
- Fastest local model: `tesseract/tesseract` at 9.08s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 24.01s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: the existing archived multi-provider consensus is reused byte for byte; it is not independent publisher gold.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
