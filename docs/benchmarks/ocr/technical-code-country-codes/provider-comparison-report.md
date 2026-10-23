# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/technical-code-country-codes`
- Publisher canonical reference: `technical-code-country-codes.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `9c29beebf785e753956ca1cf7c10c275cb8a6d4b29149d39187f36db2422eb5f`.
- Publisher source: https://zenodo.org/records/3743394/files/replication.zip?download=1 (revision `Zenodo 3743394, published archive MD5 48c44b34e47ee02b0fec281f86393e48`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 93.94 | 6.06% | 0.60% | 0.47s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.47s | 93.94 | 6.06% | 0.60% | 0.47s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 93.94/100 quality score | 93.94 | 6.06% | 0.60% | 0.47s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0002 | 100.00 | 0.00% | 0.00% | 8.93s | $0.0002 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0003 | 100.00 | 0.00% | 0.00% | 2.15s | $0.0003 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0004 | 100.00 | 0.00% | 0.00% | 2.10s | $0.0004 |
| 4 | <code>openai/gpt-6-luna</code> | $0.0005 | 100.00 | 0.00% | 0.00% | 4.42s | $0.0005 |
| 5 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0009 | 98.48 | 1.52% | 0.75% | 6.48s | $0.0009 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0010 | 100.00 | 0.00% | 0.00% | 1.71s | $0.0010 |
| 7 | <code>gemini/gemini-3.8-flash</code> | $0.0037 | 100.00 | 0.00% | 0.00% | 9.21s | $0.0037 |
| 8 | <code>gemini/gemini-3.6-flash</code> | $0.0039 | 100.00 | 0.00% | 0.00% | 1.92s | $0.0039 |
| 9 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 96.97 | 3.03% | 0.30% | 1.04s | $0.0040 |
| 10 | <code>gemini/gemini-3.5-flash</code> | $0.0041 | 100.00 | 0.00% | 0.00% | 2.10s | $0.0041 |
| 11 | <code>grok/grok-4.5</code> | $0.0050 | 100.00 | 0.00% | 0.00% | 2.59s | $0.0050 |
| 12 | <code>openai/gpt-6.1-sol</code> | $0.0062 | 100.00 | 0.00% | 0.00% | 4.81s | $0.0062 |
| 13 | <code>openai/gpt-5.6-terra</code> | $0.0066 | 100.00 | 0.00% | 0.00% | 2.18s | $0.0066 |
| 14 | <code>anthropic/claude-sonnet-5-5</code> | $0.0089 | 100.00 | 0.00% | 0.00% | 3.56s | $0.0089 |
| 15 | <code>grok/grok-4.7</code> | $0.0105 | 100.00 | 0.00% | 0.00% | 6.11s | $0.0105 |
| 16 | <code>gemini/gemini-4-argon</code> | $0.0112 | 100.00 | 0.00% | 0.00% | 5.45s | $0.0112 |
| 17 | <code>anthropic/claude-opus-5-5</code> | $0.0178 | 100.00 | 0.00% | 0.00% | 7.56s | $0.0178 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0311 | 100.00 | 0.00% | 0.00% | 4.76s | $0.0311 |
| 19 | <code>anthropic/claude-fable-5</code> | $0.0446 | 100.00 | 0.00% | 0.00% | 5.96s | $0.0446 |
| 20 | <code>anthropic/claude-fable-5-1</code> | $0.0446 | 100.00 | 0.00% | 0.00% | 4.67s | $0.0446 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-1</code> | 1.04s | 96.97 | 3.03% | 0.30% | 1.04s | $0.0040 |
| 2 | <code>gemini/gemini-3.5-flash-lite</code> | 1.71s | 100.00 | 0.00% | 0.00% | 1.71s | $0.0010 |
| 3 | <code>gemini/gemini-3.6-flash</code> | 1.92s | 100.00 | 0.00% | 0.00% | 1.92s | $0.0039 |
| 4 | <code>anthropic/claude-haiku-5-5</code> | 2.10s | 100.00 | 0.00% | 0.00% | 2.10s | $0.0004 |
| 5 | <code>gemini/gemini-3.5-flash</code> | 2.10s | 100.00 | 0.00% | 0.00% | 2.10s | $0.0041 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 2.15s | 100.00 | 0.00% | 0.00% | 2.15s | $0.0003 |
| 7 | <code>openai/gpt-5.6-terra</code> | 2.18s | 100.00 | 0.00% | 0.00% | 2.18s | $0.0066 |
| 8 | <code>grok/grok-4.5</code> | 2.59s | 100.00 | 0.00% | 0.00% | 2.59s | $0.0050 |
| 9 | <code>anthropic/claude-sonnet-5-5</code> | 3.56s | 100.00 | 0.00% | 0.00% | 3.56s | $0.0089 |
| 10 | <code>openai/gpt-6-luna</code> | 4.42s | 100.00 | 0.00% | 0.00% | 4.42s | $0.0005 |
| 11 | <code>anthropic/claude-fable-5-1</code> | 4.67s | 100.00 | 0.00% | 0.00% | 4.67s | $0.0446 |
| 12 | <code>openai/gpt-6-astra</code> | 4.76s | 100.00 | 0.00% | 0.00% | 4.76s | $0.0311 |
| 13 | <code>openai/gpt-6.1-sol</code> | 4.81s | 100.00 | 0.00% | 0.00% | 4.81s | $0.0062 |
| 14 | <code>gemini/gemini-4-argon</code> | 5.45s | 100.00 | 0.00% | 0.00% | 5.45s | $0.0112 |
| 15 | <code>anthropic/claude-fable-5</code> | 5.96s | 100.00 | 0.00% | 0.00% | 5.96s | $0.0446 |
| 16 | <code>grok/grok-4.7</code> | 6.11s | 100.00 | 0.00% | 0.00% | 6.11s | $0.0105 |
| 17 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 6.48s | 98.48 | 1.52% | 0.75% | 6.48s | $0.0009 |
| 18 | <code>anthropic/claude-opus-5-5</code> | 7.56s | 100.00 | 0.00% | 0.00% | 7.56s | $0.0178 |
| 19 | <code>deepinfra/google/gemma-4-31B-it</code> | 8.93s | 100.00 | 0.00% | 0.00% | 8.93s | $0.0002 |
| 20 | <code>gemini/gemini-3.8-flash</code> | 9.21s | 100.00 | 0.00% | 0.00% | 9.21s | $0.0037 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.96s | $0.0446 |
| 2 | <code>anthropic/claude-fable-5-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.67s | $0.0446 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.10s | $0.0004 |
| 4 | <code>anthropic/claude-opus-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 7.56s | $0.0178 |
| 5 | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.56s | $0.0089 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.15s | $0.0003 |
| 7 | <code>deepinfra/google/gemma-4-31B-it</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 8.93s | $0.0002 |
| 8 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.10s | $0.0041 |
| 9 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.71s | $0.0010 |
| 10 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.92s | $0.0039 |
| 11 | <code>gemini/gemini-3.8-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 9.21s | $0.0037 |
| 12 | <code>gemini/gemini-4-argon</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.45s | $0.0112 |
| 13 | <code>grok/grok-4.5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.59s | $0.0050 |
| 14 | <code>grok/grok-4.7</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 6.11s | $0.0105 |
| 15 | <code>openai/gpt-5.6-terra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.18s | $0.0066 |
| 16 | <code>openai/gpt-6-astra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.76s | $0.0311 |
| 17 | <code>openai/gpt-6-luna</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.42s | $0.0005 |
| 18 | <code>openai/gpt-6.1-sol</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.81s | $0.0062 |
| 19 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 98.48/100 quality score | 98.48 | 1.52% | 0.75% | 6.48s | $0.0009 |
| 20 | <code>mistral/mistral-ocr-4-1</code> | 96.97/100 quality score | 96.97 | 3.03% | 0.30% | 1.04s | $0.0040 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 93.94 | 6.06% | 0.60% | 0.47s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.96s | $0.0446 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.67s | $0.0446 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.10s | $0.0004 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 7.56s | $0.0178 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.56s | $0.0089 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.15s | $0.0003 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 8.93s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 98.48 | 1.52% | 0.75% | 6.48s | $0.0009 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.10s | $0.0041 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.71s | $0.0010 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.92s | $0.0039 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 9.21s | $0.0037 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.45s | $0.0112 |
| <code>grok/grok-4.5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.59s | $0.0050 |
| <code>grok/grok-4.7</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 6.11s | $0.0105 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 96.97 | 3.03% | 0.30% | 1.04s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.18s | $0.0066 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.76s | $0.0311 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.42s | $0.0005 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.81s | $0.0062 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 4 | 0 | 0 | 66 |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 0 | 66 |
| <code>anthropic/claude-fable-5-1</code> | 0 | 0 | 0 | 66 |
| <code>anthropic/claude-haiku-5-5</code> | 0 | 0 | 0 | 66 |
| <code>anthropic/claude-opus-5-5</code> | 0 | 0 | 0 | 66 |
| <code>anthropic/claude-sonnet-5-5</code> | 0 | 0 | 0 | 66 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 0 | 0 | 0 | 66 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 0 | 0 | 0 | 66 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 0 | 0 | 1 | 66 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 66 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 66 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 66 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 0 | 0 | 66 |
| <code>gemini/gemini-4-argon</code> | 0 | 0 | 0 | 66 |
| <code>grok/grok-4.5</code> | 0 | 0 | 0 | 66 |
| <code>grok/grok-4.7</code> | 0 | 0 | 0 | 66 |
| <code>mistral/mistral-ocr-4-1</code> | 2 | 0 | 0 | 66 |
| <code>openai/gpt-5.6-terra</code> | 0 | 0 | 0 | 66 |
| <code>openai/gpt-6-astra</code> | 0 | 0 | 0 | 66 |
| <code>openai/gpt-6-luna</code> | 0 | 0 | 0 | 66 |
| <code>openai/gpt-6.1-sol</code> | 0 | 0 | 0 | 66 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 93.94/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0155¢ ($0.0002).
- Fastest local model: `tesseract/tesseract` at 0.47s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.04s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
