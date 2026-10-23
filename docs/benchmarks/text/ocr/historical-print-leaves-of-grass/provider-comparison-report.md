# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/historical-print-leaves-of-grass`
- Publisher canonical reference: `historical-print-leaves-of-grass.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `47d9087334b2e7f8cf2f5e21647b08d7e0a76bf07cff2481ec73ea5bc1234a37`.
- Publisher source: https://en.wikisource.org/w/index.php?title=Page%3ALeaves%20of%20Grass%20(1860).djvu%2F192&oldid=15832799&action=raw (revision `15832799`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 96.83 | 3.17% | 0.48% | 1.03s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 1.03s | 96.83 | 3.17% | 0.48% | 1.03s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 96.83/100 quality score | 96.83 | 3.17% | 0.48% | 1.03s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0002 | 98.19 | 1.81% | 0.16% | 7.01s | $0.0002 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0004 | 98.19 | 1.81% | 0.16% | 4.29s | $0.0004 |
| 3 | <code>openai/gpt-6-luna</code> | $0.0007 | 98.19 | 1.81% | 0.16% | 8.12s | $0.0007 |
| 4 | <code>anthropic/claude-haiku-5-5</code> | $0.0008 | 100.00 | 0.00% | 0.00% | 3.37s | $0.0008 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0013 | 98.19 | 1.81% | 0.16% | 2.27s | $0.0013 |
| 6 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0020 | 97.74 | 2.26% | 0.24% | 10.67s | $0.0020 |
| 7 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 97.74 | 2.26% | 0.24% | 3.77s | $0.0040 |
| 8 | <code>gemini/gemini-3.6-flash</code> | $0.0046 | 98.19 | 1.81% | 0.16% | 3.22s | $0.0046 |
| 9 | <code>gemini/gemini-3.8-flash</code> | $0.0047 | 98.19 | 1.81% | 0.16% | 6.41s | $0.0047 |
| 10 | <code>gemini/gemini-3.5-flash</code> | $0.0051 | 98.19 | 1.81% | 0.16% | 3.33s | $0.0051 |
| 11 | <code>openai/gpt-6.1-sol</code> | $0.0109 | 98.19 | 1.81% | 0.16% | 6.84s | $0.0109 |
| 12 | <code>grok/grok-4.5</code> | $0.0109 | 98.19 | 1.81% | 0.16% | 11.36s | $0.0109 |
| 13 | <code>openai/gpt-5.6-terra</code> | $0.0121 | 96.83 | 3.17% | 0.32% | 4.43s | $0.0121 |
| 14 | <code>gemini/gemini-4-argon</code> | $0.0138 | 98.19 | 1.81% | 0.16% | 7.42s | $0.0138 |
| 15 | <code>anthropic/claude-sonnet-5-5</code> | $0.0163 | 98.19 | 1.81% | 0.16% | 4.90s | $0.0163 |
| 16 | <code>grok/grok-4.7</code> | $0.0207 | 98.19 | 1.81% | 0.16% | 19.92s | $0.0207 |
| 17 | <code>anthropic/claude-opus-5-5</code> | $0.0325 | 98.19 | 1.81% | 0.16% | 6.27s | $0.0325 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0543 | 98.19 | 1.81% | 0.16% | 3.97s | $0.0543 |
| 19 | <code>anthropic/claude-fable-5</code> | $0.0814 | 98.19 | 1.81% | 0.16% | 10.01s | $0.0814 |
| 20 | <code>anthropic/claude-fable-5-1</code> | $0.0815 | 98.19 | 1.81% | 0.16% | 5.78s | $0.0815 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 2.27s | 98.19 | 1.81% | 0.16% | 2.27s | $0.0013 |
| 2 | <code>gemini/gemini-3.6-flash</code> | 3.22s | 98.19 | 1.81% | 0.16% | 3.22s | $0.0046 |
| 3 | <code>gemini/gemini-3.5-flash</code> | 3.33s | 98.19 | 1.81% | 0.16% | 3.33s | $0.0051 |
| 4 | <code>anthropic/claude-haiku-5-5</code> | 3.37s | 100.00 | 0.00% | 0.00% | 3.37s | $0.0008 |
| 5 | <code>mistral/mistral-ocr-4-1</code> | 3.77s | 97.74 | 2.26% | 0.24% | 3.77s | $0.0040 |
| 6 | <code>openai/gpt-6-astra</code> | 3.97s | 98.19 | 1.81% | 0.16% | 3.97s | $0.0543 |
| 7 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 4.29s | 98.19 | 1.81% | 0.16% | 4.29s | $0.0004 |
| 8 | <code>openai/gpt-5.6-terra</code> | 4.43s | 96.83 | 3.17% | 0.32% | 4.43s | $0.0121 |
| 9 | <code>anthropic/claude-sonnet-5-5</code> | 4.90s | 98.19 | 1.81% | 0.16% | 4.90s | $0.0163 |
| 10 | <code>anthropic/claude-fable-5-1</code> | 5.78s | 98.19 | 1.81% | 0.16% | 5.78s | $0.0815 |
| 11 | <code>anthropic/claude-opus-5-5</code> | 6.27s | 98.19 | 1.81% | 0.16% | 6.27s | $0.0325 |
| 12 | <code>gemini/gemini-3.8-flash</code> | 6.41s | 98.19 | 1.81% | 0.16% | 6.41s | $0.0047 |
| 13 | <code>openai/gpt-6.1-sol</code> | 6.84s | 98.19 | 1.81% | 0.16% | 6.84s | $0.0109 |
| 14 | <code>deepinfra/google/gemma-4-31B-it</code> | 7.01s | 98.19 | 1.81% | 0.16% | 7.01s | $0.0002 |
| 15 | <code>gemini/gemini-4-argon</code> | 7.42s | 98.19 | 1.81% | 0.16% | 7.42s | $0.0138 |
| 16 | <code>openai/gpt-6-luna</code> | 8.12s | 98.19 | 1.81% | 0.16% | 8.12s | $0.0007 |
| 17 | <code>anthropic/claude-fable-5</code> | 10.01s | 98.19 | 1.81% | 0.16% | 10.01s | $0.0814 |
| 18 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 10.67s | 97.74 | 2.26% | 0.24% | 10.67s | $0.0020 |
| 19 | <code>grok/grok-4.5</code> | 11.36s | 98.19 | 1.81% | 0.16% | 11.36s | $0.0109 |
| 20 | <code>grok/grok-4.7</code> | 19.92s | 98.19 | 1.81% | 0.16% | 19.92s | $0.0207 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-haiku-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.37s | $0.0008 |
| 2 | <code>anthropic/claude-fable-5</code> | 98.19/100 quality score | 98.19 | 1.81% | 0.16% | 10.01s | $0.0814 |
| 3 | <code>anthropic/claude-fable-5-1</code> | 98.19/100 quality score | 98.19 | 1.81% | 0.16% | 5.78s | $0.0815 |
| 4 | <code>anthropic/claude-opus-5-5</code> | 98.19/100 quality score | 98.19 | 1.81% | 0.16% | 6.27s | $0.0325 |
| 5 | <code>anthropic/claude-sonnet-5-5</code> | 98.19/100 quality score | 98.19 | 1.81% | 0.16% | 4.90s | $0.0163 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 98.19/100 quality score | 98.19 | 1.81% | 0.16% | 4.29s | $0.0004 |
| 7 | <code>deepinfra/google/gemma-4-31B-it</code> | 98.19/100 quality score | 98.19 | 1.81% | 0.16% | 7.01s | $0.0002 |
| 8 | <code>gemini/gemini-3.5-flash</code> | 98.19/100 quality score | 98.19 | 1.81% | 0.16% | 3.33s | $0.0051 |
| 9 | <code>gemini/gemini-3.5-flash-lite</code> | 98.19/100 quality score | 98.19 | 1.81% | 0.16% | 2.27s | $0.0013 |
| 10 | <code>gemini/gemini-3.6-flash</code> | 98.19/100 quality score | 98.19 | 1.81% | 0.16% | 3.22s | $0.0046 |
| 11 | <code>gemini/gemini-3.8-flash</code> | 98.19/100 quality score | 98.19 | 1.81% | 0.16% | 6.41s | $0.0047 |
| 12 | <code>gemini/gemini-4-argon</code> | 98.19/100 quality score | 98.19 | 1.81% | 0.16% | 7.42s | $0.0138 |
| 13 | <code>grok/grok-4.5</code> | 98.19/100 quality score | 98.19 | 1.81% | 0.16% | 11.36s | $0.0109 |
| 14 | <code>grok/grok-4.7</code> | 98.19/100 quality score | 98.19 | 1.81% | 0.16% | 19.92s | $0.0207 |
| 15 | <code>openai/gpt-6-astra</code> | 98.19/100 quality score | 98.19 | 1.81% | 0.16% | 3.97s | $0.0543 |
| 16 | <code>openai/gpt-6-luna</code> | 98.19/100 quality score | 98.19 | 1.81% | 0.16% | 8.12s | $0.0007 |
| 17 | <code>openai/gpt-6.1-sol</code> | 98.19/100 quality score | 98.19 | 1.81% | 0.16% | 6.84s | $0.0109 |
| 18 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 97.74/100 quality score | 97.74 | 2.26% | 0.24% | 10.67s | $0.0020 |
| 19 | <code>mistral/mistral-ocr-4-1</code> | 97.74/100 quality score | 97.74 | 2.26% | 0.24% | 3.77s | $0.0040 |
| 20 | <code>openai/gpt-5.6-terra</code> | 96.83/100 quality score | 96.83 | 3.17% | 0.32% | 4.43s | $0.0121 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 96.83 | 3.17% | 0.48% | 1.03s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 98.19 | 1.81% | 0.16% | 10.01s | $0.0814 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 98.19 | 1.81% | 0.16% | 5.78s | $0.0815 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.37s | $0.0008 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 98.19 | 1.81% | 0.16% | 6.27s | $0.0325 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 98.19 | 1.81% | 0.16% | 4.90s | $0.0163 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 98.19 | 1.81% | 0.16% | 4.29s | $0.0004 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 98.19 | 1.81% | 0.16% | 7.01s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 97.74 | 2.26% | 0.24% | 10.67s | $0.0020 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 98.19 | 1.81% | 0.16% | 3.33s | $0.0051 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 98.19 | 1.81% | 0.16% | 2.27s | $0.0013 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 98.19 | 1.81% | 0.16% | 3.22s | $0.0046 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 98.19 | 1.81% | 0.16% | 6.41s | $0.0047 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 98.19 | 1.81% | 0.16% | 7.42s | $0.0138 |
| <code>grok/grok-4.5</code> | Third-Party Service | 98.19 | 1.81% | 0.16% | 11.36s | $0.0109 |
| <code>grok/grok-4.7</code> | Third-Party Service | 98.19 | 1.81% | 0.16% | 19.92s | $0.0207 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 97.74 | 2.26% | 0.24% | 3.77s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 96.83 | 3.17% | 0.32% | 4.43s | $0.0121 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 98.19 | 1.81% | 0.16% | 3.97s | $0.0543 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 98.19 | 1.81% | 0.16% | 8.12s | $0.0007 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 98.19 | 1.81% | 0.16% | 6.84s | $0.0109 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 5 | 0 | 2 | 221 |
| <code>anthropic/claude-fable-5</code> | 2 | 0 | 2 | 221 |
| <code>anthropic/claude-fable-5-1</code> | 2 | 0 | 2 | 221 |
| <code>anthropic/claude-haiku-5-5</code> | 0 | 0 | 0 | 221 |
| <code>anthropic/claude-opus-5-5</code> | 2 | 0 | 2 | 221 |
| <code>anthropic/claude-sonnet-5-5</code> | 2 | 0 | 2 | 221 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 2 | 0 | 2 | 221 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 2 | 0 | 2 | 221 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 3 | 0 | 2 | 221 |
| <code>gemini/gemini-3.5-flash</code> | 2 | 0 | 2 | 221 |
| <code>gemini/gemini-3.5-flash-lite</code> | 2 | 0 | 2 | 221 |
| <code>gemini/gemini-3.6-flash</code> | 2 | 0 | 2 | 221 |
| <code>gemini/gemini-3.8-flash</code> | 2 | 0 | 2 | 221 |
| <code>gemini/gemini-4-argon</code> | 2 | 0 | 2 | 221 |
| <code>grok/grok-4.5</code> | 2 | 0 | 2 | 221 |
| <code>grok/grok-4.7</code> | 2 | 0 | 2 | 221 |
| <code>mistral/mistral-ocr-4-1</code> | 3 | 0 | 2 | 221 |
| <code>openai/gpt-5.6-terra</code> | 4 | 0 | 3 | 221 |
| <code>openai/gpt-6-astra</code> | 2 | 0 | 2 | 221 |
| <code>openai/gpt-6-luna</code> | 2 | 0 | 2 | 221 |
| <code>openai/gpt-6.1-sol</code> | 2 | 0 | 2 | 221 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 96.83/100.
- Best cloud service: `anthropic/claude-haiku-5-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0208¢ ($0.0002).
- Fastest local model: `tesseract/tesseract` at 1.03s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 2.27s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
