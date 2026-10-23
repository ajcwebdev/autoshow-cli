# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/technical-code-podio`
- Publisher canonical reference: `technical-code-podio.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `43f3bc04789cfa3d8ee7f2c244a6765f05f05a54ce3430c396fc24697fe79d08`.
- Publisher source: https://zenodo.org/records/3743394/files/replication.zip?download=1 (revision `Zenodo 3743394, published archive MD5 48c44b34e47ee02b0fec281f86393e48`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 68.52 | 31.48% | 18.88% | 0.21s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.21s | 68.52 | 31.48% | 18.88% | 0.21s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 68.52/100 quality score | 68.52 | 31.48% | 18.88% | 0.21s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0001 | 100.00 | 0.00% | 0.00% | 5.75s | $0.0001 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0002 | 98.15 | 1.85% | 1.17% | 1.06s | $0.0002 |
| 3 | <code>openai/gpt-6-luna</code> | $0.0004 | 100.00 | 0.00% | 0.00% | 4.70s | $0.0004 |
| 4 | <code>anthropic/claude-haiku-5-5</code> | $0.0004 | 100.00 | 0.00% | 0.00% | 1.80s | $0.0004 |
| 5 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0006 | 98.15 | 1.85% | 1.17% | 6.55s | $0.0006 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0008 | 100.00 | 0.00% | 0.00% | 2.10s | $0.0008 |
| 7 | <code>gemini/gemini-3.6-flash</code> | $0.0030 | 100.00 | 0.00% | 0.00% | 1.79s | $0.0030 |
| 8 | <code>gemini/gemini-3.8-flash</code> | $0.0030 | 100.00 | 0.00% | 0.00% | 113.86s | $0.0030 |
| 9 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 100.00 | 0.00% | 0.00% | 0.82s | $0.0040 |
| 10 | <code>grok/grok-4.5</code> | $0.0045 | 98.15 | 1.85% | 3.96% | 1.92s | $0.0045 |
| 11 | <code>openai/gpt-6.1-sol</code> | $0.0052 | 100.00 | 0.00% | 0.00% | 3.04s | $0.0052 |
| 12 | <code>openai/gpt-5.6-terra</code> | $0.0054 | 100.00 | 0.00% | 0.00% | 1.71s | $0.0054 |
| 13 | <code>anthropic/claude-sonnet-5-5</code> | $0.0074 | 100.00 | 0.00% | 0.00% | 6.77s | $0.0074 |
| 14 | <code>gemini/gemini-4-argon</code> | $0.0094 | 100.00 | 0.00% | 0.00% | 7.18s | $0.0094 |
| 15 | <code>grok/grok-4.7</code> | $0.0102 | 100.00 | 0.00% | 0.00% | 7.00s | $0.0102 |
| 16 | <code>anthropic/claude-opus-5-5</code> | $0.0147 | 100.00 | 0.00% | 0.00% | 3.04s | $0.0147 |
| 17 | <code>openai/gpt-6-astra</code> | $0.0260 | 100.00 | 0.00% | 0.00% | 2.47s | $0.0260 |
| 18 | <code>anthropic/claude-fable-5</code> | $0.0362 | 100.00 | 0.00% | 0.00% | 4.61s | $0.0362 |
| 19 | <code>anthropic/claude-fable-5-1</code> | $0.0368 | 100.00 | 0.00% | 0.00% | 3.53s | $0.0368 |
| 20 | <code>gemini/gemini-3.5-flash</code> | $0.1729 | 100.00 | 0.00% | 0.00% | 1.75s | $0.1729 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-1</code> | 0.82s | 100.00 | 0.00% | 0.00% | 0.82s | $0.0040 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 1.06s | 98.15 | 1.85% | 1.17% | 1.06s | $0.0002 |
| 3 | <code>openai/gpt-5.6-terra</code> | 1.71s | 100.00 | 0.00% | 0.00% | 1.71s | $0.0054 |
| 4 | <code>gemini/gemini-3.5-flash</code> | 1.75s | 100.00 | 0.00% | 0.00% | 1.75s | $0.1729 |
| 5 | <code>gemini/gemini-3.6-flash</code> | 1.79s | 100.00 | 0.00% | 0.00% | 1.79s | $0.0030 |
| 6 | <code>anthropic/claude-haiku-5-5</code> | 1.80s | 100.00 | 0.00% | 0.00% | 1.80s | $0.0004 |
| 7 | <code>grok/grok-4.5</code> | 1.92s | 98.15 | 1.85% | 3.96% | 1.92s | $0.0045 |
| 8 | <code>gemini/gemini-3.5-flash-lite</code> | 2.10s | 100.00 | 0.00% | 0.00% | 2.10s | $0.0008 |
| 9 | <code>openai/gpt-6-astra</code> | 2.47s | 100.00 | 0.00% | 0.00% | 2.47s | $0.0260 |
| 10 | <code>anthropic/claude-opus-5-5</code> | 3.04s | 100.00 | 0.00% | 0.00% | 3.04s | $0.0147 |
| 11 | <code>openai/gpt-6.1-sol</code> | 3.04s | 100.00 | 0.00% | 0.00% | 3.04s | $0.0052 |
| 12 | <code>anthropic/claude-fable-5-1</code> | 3.53s | 100.00 | 0.00% | 0.00% | 3.53s | $0.0368 |
| 13 | <code>anthropic/claude-fable-5</code> | 4.61s | 100.00 | 0.00% | 0.00% | 4.61s | $0.0362 |
| 14 | <code>openai/gpt-6-luna</code> | 4.70s | 100.00 | 0.00% | 0.00% | 4.70s | $0.0004 |
| 15 | <code>deepinfra/google/gemma-4-31B-it</code> | 5.75s | 100.00 | 0.00% | 0.00% | 5.75s | $0.0001 |
| 16 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 6.55s | 98.15 | 1.85% | 1.17% | 6.55s | $0.0006 |
| 17 | <code>anthropic/claude-sonnet-5-5</code> | 6.77s | 100.00 | 0.00% | 0.00% | 6.77s | $0.0074 |
| 18 | <code>grok/grok-4.7</code> | 7.00s | 100.00 | 0.00% | 0.00% | 7.00s | $0.0102 |
| 19 | <code>gemini/gemini-4-argon</code> | 7.18s | 100.00 | 0.00% | 0.00% | 7.18s | $0.0094 |
| 20 | <code>gemini/gemini-3.8-flash</code> | 113.86s | 100.00 | 0.00% | 0.00% | 113.86s | $0.0030 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.61s | $0.0362 |
| 2 | <code>anthropic/claude-fable-5-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.53s | $0.0368 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.80s | $0.0004 |
| 4 | <code>anthropic/claude-opus-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.04s | $0.0147 |
| 5 | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 6.77s | $0.0074 |
| 6 | <code>deepinfra/google/gemma-4-31B-it</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.75s | $0.0001 |
| 7 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.75s | $0.1729 |
| 8 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.10s | $0.0008 |
| 9 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.79s | $0.0030 |
| 10 | <code>gemini/gemini-3.8-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 113.86s | $0.0030 |
| 11 | <code>gemini/gemini-4-argon</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 7.18s | $0.0094 |
| 12 | <code>grok/grok-4.7</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 7.00s | $0.0102 |
| 13 | <code>mistral/mistral-ocr-4-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.82s | $0.0040 |
| 14 | <code>openai/gpt-5.6-terra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.71s | $0.0054 |
| 15 | <code>openai/gpt-6-astra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.47s | $0.0260 |
| 16 | <code>openai/gpt-6-luna</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.70s | $0.0004 |
| 17 | <code>openai/gpt-6.1-sol</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.04s | $0.0052 |
| 18 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 98.15/100 quality score | 98.15 | 1.85% | 1.17% | 1.06s | $0.0002 |
| 19 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 98.15/100 quality score | 98.15 | 1.85% | 1.17% | 6.55s | $0.0006 |
| 20 | <code>grok/grok-4.5</code> | 98.15/100 quality score | 98.15 | 1.85% | 3.96% | 1.92s | $0.0045 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 68.52 | 31.48% | 18.88% | 0.21s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.61s | $0.0362 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.53s | $0.0368 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.80s | $0.0004 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.04s | $0.0147 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 6.77s | $0.0074 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 98.15 | 1.85% | 1.17% | 1.06s | $0.0002 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.75s | $0.0001 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 98.15 | 1.85% | 1.17% | 6.55s | $0.0006 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.75s | $0.1729 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.10s | $0.0008 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.79s | $0.0030 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 113.86s | $0.0030 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 7.18s | $0.0094 |
| <code>grok/grok-4.5</code> | Third-Party Service | 98.15 | 1.85% | 3.96% | 1.92s | $0.0045 |
| <code>grok/grok-4.7</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 7.00s | $0.0102 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 0.82s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.71s | $0.0054 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.47s | $0.0260 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.70s | $0.0004 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.04s | $0.0052 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 17 | 0 | 0 | 54 |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 0 | 54 |
| <code>anthropic/claude-fable-5-1</code> | 0 | 0 | 0 | 54 |
| <code>anthropic/claude-haiku-5-5</code> | 0 | 0 | 0 | 54 |
| <code>anthropic/claude-opus-5-5</code> | 0 | 0 | 0 | 54 |
| <code>anthropic/claude-sonnet-5-5</code> | 0 | 0 | 0 | 54 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 0 | 0 | 1 | 54 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 0 | 0 | 0 | 54 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 0 | 0 | 1 | 54 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 54 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 54 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 54 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 0 | 0 | 54 |
| <code>gemini/gemini-4-argon</code> | 0 | 0 | 0 | 54 |
| <code>grok/grok-4.5</code> | 0 | 1 | 0 | 54 |
| <code>grok/grok-4.7</code> | 0 | 0 | 0 | 54 |
| <code>mistral/mistral-ocr-4-1</code> | 0 | 0 | 0 | 54 |
| <code>openai/gpt-5.6-terra</code> | 0 | 0 | 0 | 54 |
| <code>openai/gpt-6-astra</code> | 0 | 0 | 0 | 54 |
| <code>openai/gpt-6-luna</code> | 0 | 0 | 0 | 54 |
| <code>openai/gpt-6.1-sol</code> | 0 | 0 | 0 | 54 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 68.52/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0116¢ ($0.0001).
- Fastest local model: `tesseract/tesseract` at 0.21s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 0.82s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
