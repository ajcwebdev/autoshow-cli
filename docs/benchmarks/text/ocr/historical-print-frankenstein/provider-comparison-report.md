# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/historical-print-frankenstein`
- Publisher canonical reference: `historical-print-frankenstein.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `95b0ff13f85c39104500f7ece603aab33dce93a0dba30fb3e5acf6140912d43d`.
- Publisher source: https://en.wikisource.org/w/index.php?title=Page%3AFrankenstein%2C%20or%20the%20Modern%20Prometheus%20(Revised%20Edition%2C%201831).djvu%2F11&oldid=8864833&action=raw (revision `8864833`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 97.88 | 2.12% | 0.31% | 0.96s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.96s | 97.88 | 2.12% | 0.31% | 0.96s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 97.88/100 quality score | 97.88 | 2.12% | 0.31% | 0.96s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0002 | 98.31 | 1.69% | 0.23% | 10.90s | $0.0002 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0004 | 98.31 | 1.69% | 0.23% | 6.32s | $0.0004 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0007 | 99.15 | 0.85% | 0.16% | 2.83s | $0.0007 |
| 4 | <code>openai/gpt-6-luna</code> | $0.0008 | 99.15 | 0.85% | 0.16% | 11.44s | $0.0008 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0012 | 99.15 | 0.85% | 0.16% | 2.27s | $0.0012 |
| 6 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0014 | 98.31 | 1.69% | 0.23% | 12.03s | $0.0014 |
| 7 | <code>gemini/gemini-3.6-flash</code> | $0.0040 | 99.15 | 0.85% | 0.16% | 3.04s | $0.0040 |
| 8 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 99.15 | 0.85% | 0.16% | 3.14s | $0.0040 |
| 9 | <code>gemini/gemini-3.5-flash</code> | $0.0044 | 99.15 | 0.85% | 0.16% | 3.31s | $0.0044 |
| 10 | <code>gemini/gemini-3.8-flash</code> | $0.0045 | 98.31 | 1.69% | 0.23% | 7.27s | $0.0045 |
| 11 | <code>grok/grok-4.5</code> | $0.0078 | 98.31 | 1.69% | 0.23% | 5.19s | $0.0078 |
| 12 | <code>openai/gpt-6.1-sol</code> | $0.0106 | 98.31 | 1.69% | 0.23% | 6.38s | $0.0106 |
| 13 | <code>openai/gpt-5.6-terra</code> | $0.0112 | 98.31 | 1.69% | 0.23% | 3.60s | $0.0112 |
| 14 | <code>gemini/gemini-4-argon</code> | $0.0120 | 99.15 | 0.85% | 0.16% | 20.79s | $0.0120 |
| 15 | <code>anthropic/claude-sonnet-5-5</code> | $0.0136 | 99.15 | 0.85% | 0.16% | 4.10s | $0.0136 |
| 16 | <code>grok/grok-4.7</code> | $0.0192 | 99.15 | 0.85% | 0.16% | 19.60s | $0.0192 |
| 17 | <code>anthropic/claude-opus-5-5</code> | $0.0273 | 99.15 | 0.85% | 0.16% | 4.41s | $0.0273 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0528 | 98.31 | 1.69% | 0.23% | 5.11s | $0.0528 |
| 19 | <code>anthropic/claude-fable-5</code> | $0.0681 | 99.15 | 0.85% | 0.16% | 8.49s | $0.0681 |
| 20 | <code>anthropic/claude-fable-5-1</code> | $0.0682 | 99.15 | 0.85% | 0.16% | 4.92s | $0.0682 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 2.27s | 99.15 | 0.85% | 0.16% | 2.27s | $0.0012 |
| 2 | <code>anthropic/claude-haiku-5-5</code> | 2.83s | 99.15 | 0.85% | 0.16% | 2.83s | $0.0007 |
| 3 | <code>gemini/gemini-3.6-flash</code> | 3.04s | 99.15 | 0.85% | 0.16% | 3.04s | $0.0040 |
| 4 | <code>mistral/mistral-ocr-4-1</code> | 3.14s | 99.15 | 0.85% | 0.16% | 3.14s | $0.0040 |
| 5 | <code>gemini/gemini-3.5-flash</code> | 3.31s | 99.15 | 0.85% | 0.16% | 3.31s | $0.0044 |
| 6 | <code>openai/gpt-5.6-terra</code> | 3.60s | 98.31 | 1.69% | 0.23% | 3.60s | $0.0112 |
| 7 | <code>anthropic/claude-sonnet-5-5</code> | 4.10s | 99.15 | 0.85% | 0.16% | 4.10s | $0.0136 |
| 8 | <code>anthropic/claude-opus-5-5</code> | 4.41s | 99.15 | 0.85% | 0.16% | 4.41s | $0.0273 |
| 9 | <code>anthropic/claude-fable-5-1</code> | 4.92s | 99.15 | 0.85% | 0.16% | 4.92s | $0.0682 |
| 10 | <code>openai/gpt-6-astra</code> | 5.11s | 98.31 | 1.69% | 0.23% | 5.11s | $0.0528 |
| 11 | <code>grok/grok-4.5</code> | 5.19s | 98.31 | 1.69% | 0.23% | 5.19s | $0.0078 |
| 12 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 6.32s | 98.31 | 1.69% | 0.23% | 6.32s | $0.0004 |
| 13 | <code>openai/gpt-6.1-sol</code> | 6.38s | 98.31 | 1.69% | 0.23% | 6.38s | $0.0106 |
| 14 | <code>gemini/gemini-3.8-flash</code> | 7.27s | 98.31 | 1.69% | 0.23% | 7.27s | $0.0045 |
| 15 | <code>anthropic/claude-fable-5</code> | 8.49s | 99.15 | 0.85% | 0.16% | 8.49s | $0.0681 |
| 16 | <code>deepinfra/google/gemma-4-31B-it</code> | 10.90s | 98.31 | 1.69% | 0.23% | 10.90s | $0.0002 |
| 17 | <code>openai/gpt-6-luna</code> | 11.44s | 99.15 | 0.85% | 0.16% | 11.44s | $0.0008 |
| 18 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 12.03s | 98.31 | 1.69% | 0.23% | 12.03s | $0.0014 |
| 19 | <code>grok/grok-4.7</code> | 19.60s | 99.15 | 0.85% | 0.16% | 19.60s | $0.0192 |
| 20 | <code>gemini/gemini-4-argon</code> | 20.79s | 99.15 | 0.85% | 0.16% | 20.79s | $0.0120 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 99.15/100 quality score | 99.15 | 0.85% | 0.16% | 8.49s | $0.0681 |
| 2 | <code>anthropic/claude-fable-5-1</code> | 99.15/100 quality score | 99.15 | 0.85% | 0.16% | 4.92s | $0.0682 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 99.15/100 quality score | 99.15 | 0.85% | 0.16% | 2.83s | $0.0007 |
| 4 | <code>anthropic/claude-opus-5-5</code> | 99.15/100 quality score | 99.15 | 0.85% | 0.16% | 4.41s | $0.0273 |
| 5 | <code>anthropic/claude-sonnet-5-5</code> | 99.15/100 quality score | 99.15 | 0.85% | 0.16% | 4.10s | $0.0136 |
| 6 | <code>gemini/gemini-3.5-flash</code> | 99.15/100 quality score | 99.15 | 0.85% | 0.16% | 3.31s | $0.0044 |
| 7 | <code>gemini/gemini-3.5-flash-lite</code> | 99.15/100 quality score | 99.15 | 0.85% | 0.16% | 2.27s | $0.0012 |
| 8 | <code>gemini/gemini-3.6-flash</code> | 99.15/100 quality score | 99.15 | 0.85% | 0.16% | 3.04s | $0.0040 |
| 9 | <code>gemini/gemini-4-argon</code> | 99.15/100 quality score | 99.15 | 0.85% | 0.16% | 20.79s | $0.0120 |
| 10 | <code>grok/grok-4.7</code> | 99.15/100 quality score | 99.15 | 0.85% | 0.16% | 19.60s | $0.0192 |
| 11 | <code>mistral/mistral-ocr-4-1</code> | 99.15/100 quality score | 99.15 | 0.85% | 0.16% | 3.14s | $0.0040 |
| 12 | <code>openai/gpt-6-luna</code> | 99.15/100 quality score | 99.15 | 0.85% | 0.16% | 11.44s | $0.0008 |
| 13 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 98.31/100 quality score | 98.31 | 1.69% | 0.23% | 6.32s | $0.0004 |
| 14 | <code>deepinfra/google/gemma-4-31B-it</code> | 98.31/100 quality score | 98.31 | 1.69% | 0.23% | 10.90s | $0.0002 |
| 15 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 98.31/100 quality score | 98.31 | 1.69% | 0.23% | 12.03s | $0.0014 |
| 16 | <code>gemini/gemini-3.8-flash</code> | 98.31/100 quality score | 98.31 | 1.69% | 0.23% | 7.27s | $0.0045 |
| 17 | <code>grok/grok-4.5</code> | 98.31/100 quality score | 98.31 | 1.69% | 0.23% | 5.19s | $0.0078 |
| 18 | <code>openai/gpt-5.6-terra</code> | 98.31/100 quality score | 98.31 | 1.69% | 0.23% | 3.60s | $0.0112 |
| 19 | <code>openai/gpt-6-astra</code> | 98.31/100 quality score | 98.31 | 1.69% | 0.23% | 5.11s | $0.0528 |
| 20 | <code>openai/gpt-6.1-sol</code> | 98.31/100 quality score | 98.31 | 1.69% | 0.23% | 6.38s | $0.0106 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 97.88 | 2.12% | 0.31% | 0.96s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 99.15 | 0.85% | 0.16% | 8.49s | $0.0681 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 99.15 | 0.85% | 0.16% | 4.92s | $0.0682 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 99.15 | 0.85% | 0.16% | 2.83s | $0.0007 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 99.15 | 0.85% | 0.16% | 4.41s | $0.0273 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 99.15 | 0.85% | 0.16% | 4.10s | $0.0136 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 98.31 | 1.69% | 0.23% | 6.32s | $0.0004 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 98.31 | 1.69% | 0.23% | 10.90s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 98.31 | 1.69% | 0.23% | 12.03s | $0.0014 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 99.15 | 0.85% | 0.16% | 3.31s | $0.0044 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 99.15 | 0.85% | 0.16% | 2.27s | $0.0012 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 99.15 | 0.85% | 0.16% | 3.04s | $0.0040 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 98.31 | 1.69% | 0.23% | 7.27s | $0.0045 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 99.15 | 0.85% | 0.16% | 20.79s | $0.0120 |
| <code>grok/grok-4.5</code> | Third-Party Service | 98.31 | 1.69% | 0.23% | 5.19s | $0.0078 |
| <code>grok/grok-4.7</code> | Third-Party Service | 99.15 | 0.85% | 0.16% | 19.60s | $0.0192 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 99.15 | 0.85% | 0.16% | 3.14s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 98.31 | 1.69% | 0.23% | 3.60s | $0.0112 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 98.31 | 1.69% | 0.23% | 5.11s | $0.0528 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 99.15 | 0.85% | 0.16% | 11.44s | $0.0008 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 98.31 | 1.69% | 0.23% | 6.38s | $0.0106 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 3 | 1 | 1 | 236 |
| <code>anthropic/claude-fable-5</code> | 1 | 1 | 0 | 236 |
| <code>anthropic/claude-fable-5-1</code> | 1 | 1 | 0 | 236 |
| <code>anthropic/claude-haiku-5-5</code> | 1 | 1 | 0 | 236 |
| <code>anthropic/claude-opus-5-5</code> | 1 | 1 | 0 | 236 |
| <code>anthropic/claude-sonnet-5-5</code> | 1 | 1 | 0 | 236 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 2 | 1 | 1 | 236 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 2 | 1 | 1 | 236 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 2 | 1 | 1 | 236 |
| <code>gemini/gemini-3.5-flash</code> | 1 | 1 | 0 | 236 |
| <code>gemini/gemini-3.5-flash-lite</code> | 1 | 1 | 0 | 236 |
| <code>gemini/gemini-3.6-flash</code> | 1 | 1 | 0 | 236 |
| <code>gemini/gemini-3.8-flash</code> | 2 | 1 | 1 | 236 |
| <code>gemini/gemini-4-argon</code> | 1 | 1 | 0 | 236 |
| <code>grok/grok-4.5</code> | 2 | 1 | 1 | 236 |
| <code>grok/grok-4.7</code> | 1 | 1 | 0 | 236 |
| <code>mistral/mistral-ocr-4-1</code> | 1 | 1 | 0 | 236 |
| <code>openai/gpt-5.6-terra</code> | 2 | 1 | 1 | 236 |
| <code>openai/gpt-6-astra</code> | 2 | 1 | 1 | 236 |
| <code>openai/gpt-6-luna</code> | 1 | 1 | 0 | 236 |
| <code>openai/gpt-6.1-sol</code> | 2 | 1 | 1 | 236 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 97.88/100.
- Best cloud service: `anthropic/claude-fable-5` scored 99.15/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0190¢ ($0.0002).
- Fastest local model: `tesseract/tesseract` at 0.96s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 2.27s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
