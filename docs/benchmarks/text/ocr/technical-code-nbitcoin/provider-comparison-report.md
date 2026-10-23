# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/technical-code-nbitcoin`
- Publisher canonical reference: `technical-code-nbitcoin.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `f6008b7a33e1029c749339dbf3890867f0aa4e7e594303925fca3aa9a2fa3118`.
- Publisher source: https://zenodo.org/records/3743394/files/replication.zip?download=1 (revision `Zenodo 3743394, published archive MD5 48c44b34e47ee02b0fec281f86393e48`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 82.35 | 17.65% | 9.74% | 0.32s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.32s | 82.35 | 17.65% | 9.74% | 0.32s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 82.35/100 quality score | 82.35 | 17.65% | 9.74% | 0.32s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0001 | 100.00 | 0.00% | 0.00% | 5.94s | $0.0001 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0002 | 98.04 | 1.96% | 1.42% | 1.23s | $0.0002 |
| 3 | <code>openai/gpt-6-luna</code> | $0.0003 | 100.00 | 0.00% | 0.00% | 5.78s | $0.0003 |
| 4 | <code>anthropic/claude-haiku-5-5</code> | $0.0004 | 100.00 | 0.00% | 0.00% | 2.17s | $0.0004 |
| 5 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0007 | 96.08 | 3.92% | 1.62% | 11.47s | $0.0007 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0009 | 100.00 | 0.00% | 0.00% | 1.12s | $0.0009 |
| 7 | <code>gemini/gemini-3.5-flash</code> | $0.0037 | 100.00 | 0.00% | 0.00% | 1.82s | $0.0037 |
| 8 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 100.00 | 0.00% | 0.00% | 1.13s | $0.0040 |
| 9 | <code>grok/grok-4.5</code> | $0.0046 | 100.00 | 0.00% | 0.00% | 2.87s | $0.0046 |
| 10 | <code>openai/gpt-6.1-sol</code> | $0.0046 | 100.00 | 0.00% | 0.00% | 4.27s | $0.0046 |
| 11 | <code>openai/gpt-5.6-terra</code> | $0.0049 | 100.00 | 0.00% | 0.00% | 2.67s | $0.0049 |
| 12 | <code>anthropic/claude-sonnet-5-5</code> | $0.0074 | 100.00 | 0.00% | 0.00% | 3.06s | $0.0074 |
| 13 | <code>gemini/gemini-4-argon</code> | $0.0100 | 100.00 | 0.00% | 0.00% | 26.54s | $0.0100 |
| 14 | <code>grok/grok-4.7</code> | $0.0119 | 100.00 | 0.00% | 0.00% | 9.49s | $0.0119 |
| 15 | <code>anthropic/claude-opus-5-5</code> | $0.0147 | 100.00 | 0.00% | 0.00% | 4.19s | $0.0147 |
| 16 | <code>openai/gpt-6-astra</code> | $0.0232 | 100.00 | 0.00% | 0.00% | 2.78s | $0.0232 |
| 17 | <code>anthropic/claude-fable-5</code> | $0.0368 | 100.00 | 0.00% | 0.00% | 5.20s | $0.0368 |
| 18 | <code>anthropic/claude-fable-5-1</code> | $0.0368 | 100.00 | 0.00% | 0.00% | 4.19s | $0.0368 |
| 19 | <code>gemini/gemini-3.6-flash</code> | $0.1612 | 100.00 | 0.00% | 0.00% | 1.97s | $0.1612 |
| 20 | <code>gemini/gemini-3.8-flash</code> | $0.3181 | 100.00 | 0.00% | 0.00% | 82.32s | $0.3181 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 1.12s | 100.00 | 0.00% | 0.00% | 1.12s | $0.0009 |
| 2 | <code>mistral/mistral-ocr-4-1</code> | 1.13s | 100.00 | 0.00% | 0.00% | 1.13s | $0.0040 |
| 3 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 1.23s | 98.04 | 1.96% | 1.42% | 1.23s | $0.0002 |
| 4 | <code>gemini/gemini-3.5-flash</code> | 1.82s | 100.00 | 0.00% | 0.00% | 1.82s | $0.0037 |
| 5 | <code>gemini/gemini-3.6-flash</code> | 1.97s | 100.00 | 0.00% | 0.00% | 1.97s | $0.1612 |
| 6 | <code>anthropic/claude-haiku-5-5</code> | 2.17s | 100.00 | 0.00% | 0.00% | 2.17s | $0.0004 |
| 7 | <code>openai/gpt-5.6-terra</code> | 2.67s | 100.00 | 0.00% | 0.00% | 2.67s | $0.0049 |
| 8 | <code>openai/gpt-6-astra</code> | 2.78s | 100.00 | 0.00% | 0.00% | 2.78s | $0.0232 |
| 9 | <code>grok/grok-4.5</code> | 2.87s | 100.00 | 0.00% | 0.00% | 2.87s | $0.0046 |
| 10 | <code>anthropic/claude-sonnet-5-5</code> | 3.06s | 100.00 | 0.00% | 0.00% | 3.06s | $0.0074 |
| 11 | <code>anthropic/claude-fable-5-1</code> | 4.19s | 100.00 | 0.00% | 0.00% | 4.19s | $0.0368 |
| 12 | <code>anthropic/claude-opus-5-5</code> | 4.19s | 100.00 | 0.00% | 0.00% | 4.19s | $0.0147 |
| 13 | <code>openai/gpt-6.1-sol</code> | 4.27s | 100.00 | 0.00% | 0.00% | 4.27s | $0.0046 |
| 14 | <code>anthropic/claude-fable-5</code> | 5.20s | 100.00 | 0.00% | 0.00% | 5.20s | $0.0368 |
| 15 | <code>openai/gpt-6-luna</code> | 5.78s | 100.00 | 0.00% | 0.00% | 5.78s | $0.0003 |
| 16 | <code>deepinfra/google/gemma-4-31B-it</code> | 5.94s | 100.00 | 0.00% | 0.00% | 5.94s | $0.0001 |
| 17 | <code>grok/grok-4.7</code> | 9.49s | 100.00 | 0.00% | 0.00% | 9.49s | $0.0119 |
| 18 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 11.47s | 96.08 | 3.92% | 1.62% | 11.47s | $0.0007 |
| 19 | <code>gemini/gemini-4-argon</code> | 26.54s | 100.00 | 0.00% | 0.00% | 26.54s | $0.0100 |
| 20 | <code>gemini/gemini-3.8-flash</code> | 82.32s | 100.00 | 0.00% | 0.00% | 82.32s | $0.3181 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.20s | $0.0368 |
| 2 | <code>anthropic/claude-fable-5-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.19s | $0.0368 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.17s | $0.0004 |
| 4 | <code>anthropic/claude-opus-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.19s | $0.0147 |
| 5 | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.06s | $0.0074 |
| 6 | <code>deepinfra/google/gemma-4-31B-it</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.94s | $0.0001 |
| 7 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.82s | $0.0037 |
| 8 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.12s | $0.0009 |
| 9 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.97s | $0.1612 |
| 10 | <code>gemini/gemini-3.8-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 82.32s | $0.3181 |
| 11 | <code>gemini/gemini-4-argon</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 26.54s | $0.0100 |
| 12 | <code>grok/grok-4.5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.87s | $0.0046 |
| 13 | <code>grok/grok-4.7</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 9.49s | $0.0119 |
| 14 | <code>mistral/mistral-ocr-4-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.13s | $0.0040 |
| 15 | <code>openai/gpt-5.6-terra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.67s | $0.0049 |
| 16 | <code>openai/gpt-6-astra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.78s | $0.0232 |
| 17 | <code>openai/gpt-6-luna</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.78s | $0.0003 |
| 18 | <code>openai/gpt-6.1-sol</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.27s | $0.0046 |
| 19 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 98.04/100 quality score | 98.04 | 1.96% | 1.42% | 1.23s | $0.0002 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 96.08/100 quality score | 96.08 | 3.92% | 1.62% | 11.47s | $0.0007 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 82.35 | 17.65% | 9.74% | 0.32s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.20s | $0.0368 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.19s | $0.0368 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.17s | $0.0004 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.19s | $0.0147 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.06s | $0.0074 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 98.04 | 1.96% | 1.42% | 1.23s | $0.0002 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.94s | $0.0001 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 96.08 | 3.92% | 1.62% | 11.47s | $0.0007 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.82s | $0.0037 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.12s | $0.0009 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.97s | $0.1612 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 82.32s | $0.3181 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 26.54s | $0.0100 |
| <code>grok/grok-4.5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.87s | $0.0046 |
| <code>grok/grok-4.7</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 9.49s | $0.0119 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.13s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.67s | $0.0049 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.78s | $0.0232 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.78s | $0.0003 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.27s | $0.0046 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 3 | 3 | 3 | 51 |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 0 | 51 |
| <code>anthropic/claude-fable-5-1</code> | 0 | 0 | 0 | 51 |
| <code>anthropic/claude-haiku-5-5</code> | 0 | 0 | 0 | 51 |
| <code>anthropic/claude-opus-5-5</code> | 0 | 0 | 0 | 51 |
| <code>anthropic/claude-sonnet-5-5</code> | 0 | 0 | 0 | 51 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 0 | 0 | 1 | 51 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 0 | 0 | 0 | 51 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 1 | 0 | 1 | 51 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 51 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 51 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 51 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 0 | 0 | 51 |
| <code>gemini/gemini-4-argon</code> | 0 | 0 | 0 | 51 |
| <code>grok/grok-4.5</code> | 0 | 0 | 0 | 51 |
| <code>grok/grok-4.7</code> | 0 | 0 | 0 | 51 |
| <code>mistral/mistral-ocr-4-1</code> | 0 | 0 | 0 | 51 |
| <code>openai/gpt-5.6-terra</code> | 0 | 0 | 0 | 51 |
| <code>openai/gpt-6-astra</code> | 0 | 0 | 0 | 51 |
| <code>openai/gpt-6-luna</code> | 0 | 0 | 0 | 51 |
| <code>openai/gpt-6.1-sol</code> | 0 | 0 | 0 | 51 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 82.35/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0139¢ ($0.0001).
- Fastest local model: `tesseract/tesseract` at 0.32s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 1.12s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
