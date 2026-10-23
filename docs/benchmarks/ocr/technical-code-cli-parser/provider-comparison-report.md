# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/technical-code-cli-parser`
- Publisher canonical reference: `technical-code-cli-parser.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `a6108564b74d0680f34fec3e0f0dc7c1b16cfae7caf05eb6f25af760e7d7863f`.
- Publisher source: https://zenodo.org/records/3743394/files/replication.zip?download=1 (revision `Zenodo 3743394, published archive MD5 48c44b34e47ee02b0fec281f86393e48`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 74.70 | 25.30% | 5.83% | 0.20s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.20s | 74.70 | 25.30% | 5.83% | 0.20s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 74.70/100 quality score | 74.70 | 25.30% | 5.83% | 0.20s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0002 | 100.00 | 0.00% | 0.00% | 6.35s | $0.0002 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0003 | 98.80 | 1.20% | 1.51% | 1.68s | $0.0003 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0004 | 100.00 | 0.00% | 0.00% | 2.09s | $0.0004 |
| 4 | <code>openai/gpt-6-luna</code> | $0.0005 | 100.00 | 0.00% | 0.00% | 7.23s | $0.0005 |
| 5 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0008 | 98.80 | 1.20% | 1.51% | 135.57s | $0.0008 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0011 | 100.00 | 0.00% | 0.00% | 4.08s | $0.0011 |
| 7 | <code>gemini/gemini-3.8-flash</code> | $0.0039 | 100.00 | 0.00% | 0.00% | 104.32s | $0.0039 |
| 8 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 100.00 | 0.00% | 0.00% | 0.95s | $0.0040 |
| 9 | <code>gemini/gemini-3.5-flash</code> | $0.0044 | 100.00 | 0.00% | 0.00% | 2.38s | $0.0044 |
| 10 | <code>openai/gpt-6.1-sol</code> | $0.0058 | 100.00 | 0.00% | 0.00% | 6.25s | $0.0058 |
| 11 | <code>grok/grok-4.5</code> | $0.0063 | 100.00 | 0.00% | 0.00% | 6.17s | $0.0063 |
| 12 | <code>anthropic/claude-sonnet-5-5</code> | $0.0077 | 100.00 | 0.00% | 0.00% | 3.16s | $0.0077 |
| 13 | <code>openai/gpt-5.6-terra</code> | $0.0095 | 100.00 | 0.00% | 0.00% | 3.99s | $0.0095 |
| 14 | <code>gemini/gemini-4-argon</code> | $0.0123 | 100.00 | 0.00% | 0.00% | 7.63s | $0.0123 |
| 15 | <code>anthropic/claude-opus-5-5</code> | $0.0155 | 100.00 | 0.00% | 0.00% | 3.96s | $0.0155 |
| 16 | <code>grok/grok-4.7</code> | $0.0199 | 100.00 | 0.00% | 0.00% | 22.38s | $0.0199 |
| 17 | <code>openai/gpt-6-astra</code> | $0.0285 | 100.00 | 0.00% | 0.00% | 4.43s | $0.0285 |
| 18 | <code>anthropic/claude-fable-5</code> | $0.0387 | 100.00 | 0.00% | 0.00% | 5.82s | $0.0387 |
| 19 | <code>anthropic/claude-fable-5-1</code> | $0.0387 | 100.00 | 0.00% | 0.00% | 4.01s | $0.0387 |
| 20 | <code>gemini/gemini-3.6-flash</code> | $0.1614 | 100.00 | 0.00% | 0.00% | 2.34s | $0.1614 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-1</code> | 0.95s | 100.00 | 0.00% | 0.00% | 0.95s | $0.0040 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 1.68s | 98.80 | 1.20% | 1.51% | 1.68s | $0.0003 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 2.09s | 100.00 | 0.00% | 0.00% | 2.09s | $0.0004 |
| 4 | <code>gemini/gemini-3.6-flash</code> | 2.34s | 100.00 | 0.00% | 0.00% | 2.34s | $0.1614 |
| 5 | <code>gemini/gemini-3.5-flash</code> | 2.38s | 100.00 | 0.00% | 0.00% | 2.38s | $0.0044 |
| 6 | <code>anthropic/claude-sonnet-5-5</code> | 3.16s | 100.00 | 0.00% | 0.00% | 3.16s | $0.0077 |
| 7 | <code>anthropic/claude-opus-5-5</code> | 3.96s | 100.00 | 0.00% | 0.00% | 3.96s | $0.0155 |
| 8 | <code>openai/gpt-5.6-terra</code> | 3.99s | 100.00 | 0.00% | 0.00% | 3.99s | $0.0095 |
| 9 | <code>anthropic/claude-fable-5-1</code> | 4.01s | 100.00 | 0.00% | 0.00% | 4.01s | $0.0387 |
| 10 | <code>gemini/gemini-3.5-flash-lite</code> | 4.08s | 100.00 | 0.00% | 0.00% | 4.08s | $0.0011 |
| 11 | <code>openai/gpt-6-astra</code> | 4.43s | 100.00 | 0.00% | 0.00% | 4.43s | $0.0285 |
| 12 | <code>anthropic/claude-fable-5</code> | 5.82s | 100.00 | 0.00% | 0.00% | 5.82s | $0.0387 |
| 13 | <code>grok/grok-4.5</code> | 6.17s | 100.00 | 0.00% | 0.00% | 6.17s | $0.0063 |
| 14 | <code>openai/gpt-6.1-sol</code> | 6.25s | 100.00 | 0.00% | 0.00% | 6.25s | $0.0058 |
| 15 | <code>deepinfra/google/gemma-4-31B-it</code> | 6.35s | 100.00 | 0.00% | 0.00% | 6.35s | $0.0002 |
| 16 | <code>openai/gpt-6-luna</code> | 7.23s | 100.00 | 0.00% | 0.00% | 7.23s | $0.0005 |
| 17 | <code>gemini/gemini-4-argon</code> | 7.63s | 100.00 | 0.00% | 0.00% | 7.63s | $0.0123 |
| 18 | <code>grok/grok-4.7</code> | 22.38s | 100.00 | 0.00% | 0.00% | 22.38s | $0.0199 |
| 19 | <code>gemini/gemini-3.8-flash</code> | 104.32s | 100.00 | 0.00% | 0.00% | 104.32s | $0.0039 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 135.57s | 98.80 | 1.20% | 1.51% | 135.57s | $0.0008 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.82s | $0.0387 |
| 2 | <code>anthropic/claude-fable-5-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.01s | $0.0387 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.09s | $0.0004 |
| 4 | <code>anthropic/claude-opus-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.96s | $0.0155 |
| 5 | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.16s | $0.0077 |
| 6 | <code>deepinfra/google/gemma-4-31B-it</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 6.35s | $0.0002 |
| 7 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.38s | $0.0044 |
| 8 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.08s | $0.0011 |
| 9 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.34s | $0.1614 |
| 10 | <code>gemini/gemini-3.8-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 104.32s | $0.0039 |
| 11 | <code>gemini/gemini-4-argon</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 7.63s | $0.0123 |
| 12 | <code>grok/grok-4.5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 6.17s | $0.0063 |
| 13 | <code>grok/grok-4.7</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 22.38s | $0.0199 |
| 14 | <code>mistral/mistral-ocr-4-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.95s | $0.0040 |
| 15 | <code>openai/gpt-5.6-terra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.99s | $0.0095 |
| 16 | <code>openai/gpt-6-astra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.43s | $0.0285 |
| 17 | <code>openai/gpt-6-luna</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 7.23s | $0.0005 |
| 18 | <code>openai/gpt-6.1-sol</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 6.25s | $0.0058 |
| 19 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 98.80/100 quality score | 98.80 | 1.20% | 1.51% | 1.68s | $0.0003 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 98.80/100 quality score | 98.80 | 1.20% | 1.51% | 135.57s | $0.0008 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 74.70 | 25.30% | 5.83% | 0.20s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.82s | $0.0387 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.01s | $0.0387 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.09s | $0.0004 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.96s | $0.0155 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.16s | $0.0077 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 98.80 | 1.20% | 1.51% | 1.68s | $0.0003 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 6.35s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 98.80 | 1.20% | 1.51% | 135.57s | $0.0008 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.38s | $0.0044 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.08s | $0.0011 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.34s | $0.1614 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 104.32s | $0.0039 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 7.63s | $0.0123 |
| <code>grok/grok-4.5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 6.17s | $0.0063 |
| <code>grok/grok-4.7</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 22.38s | $0.0199 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 0.95s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.99s | $0.0095 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.43s | $0.0285 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 7.23s | $0.0005 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 6.25s | $0.0058 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 10 | 7 | 4 | 83 |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 0 | 83 |
| <code>anthropic/claude-fable-5-1</code> | 0 | 0 | 0 | 83 |
| <code>anthropic/claude-haiku-5-5</code> | 0 | 0 | 0 | 83 |
| <code>anthropic/claude-opus-5-5</code> | 0 | 0 | 0 | 83 |
| <code>anthropic/claude-sonnet-5-5</code> | 0 | 0 | 0 | 83 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 0 | 0 | 1 | 83 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 0 | 0 | 0 | 83 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 0 | 0 | 1 | 83 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 83 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 83 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 83 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 0 | 0 | 83 |
| <code>gemini/gemini-4-argon</code> | 0 | 0 | 0 | 83 |
| <code>grok/grok-4.5</code> | 0 | 0 | 0 | 83 |
| <code>grok/grok-4.7</code> | 0 | 0 | 0 | 83 |
| <code>mistral/mistral-ocr-4-1</code> | 0 | 0 | 0 | 83 |
| <code>openai/gpt-5.6-terra</code> | 0 | 0 | 0 | 83 |
| <code>openai/gpt-6-astra</code> | 0 | 0 | 0 | 83 |
| <code>openai/gpt-6-luna</code> | 0 | 0 | 0 | 83 |
| <code>openai/gpt-6.1-sol</code> | 0 | 0 | 0 | 83 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 74.70/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0172¢ ($0.0002).
- Fastest local model: `tesseract/tesseract` at 0.20s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 0.95s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
