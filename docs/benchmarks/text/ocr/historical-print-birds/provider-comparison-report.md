# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/historical-print-birds`
- Publisher canonical reference: `historical-print-birds.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `f6f4f04cb5c938ea7930c00813c6fc6837f4e1fbfc3ae41d23c1ff27795e0f25`.
- Publisher source: https://raw.githubusercontent.com/impactcentre/groundtruth-bhl/9eb0fc75166bfaaec24c8523ccb69da48f6cf13f/birdsofgreatbrit02butl_XML/pc-00667895.xml (revision `9eb0fc75166bfaaec24c8523ccb69da48f6cf13f`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 93.08 | 6.92% | 1.59% | 0.82s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.82s | 93.08 | 6.92% | 1.59% | 0.82s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 93.08/100 quality score | 93.08 | 6.92% | 1.59% | 0.82s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0002 | 100.00 | 0.00% | 0.00% | 10.67s | $0.0002 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0004 | 98.74 | 1.26% | 0.11% | 5.30s | $0.0004 |
| 3 | <code>openai/gpt-6-luna</code> | $0.0007 | 100.00 | 0.00% | 0.00% | 7.46s | $0.0007 |
| 4 | <code>anthropic/claude-haiku-5-5</code> | $0.0008 | 100.00 | 0.00% | 0.00% | 2.63s | $0.0008 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0011 | 100.00 | 0.00% | 0.00% | 2.03s | $0.0011 |
| 6 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0021 | 98.74 | 1.26% | 0.21% | 8.85s | $0.0021 |
| 7 | <code>gemini/gemini-3.6-flash</code> | $0.0038 | 100.00 | 0.00% | 0.00% | 2.67s | $0.0038 |
| 8 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 100.00 | 0.00% | 0.00% | 2.38s | $0.0040 |
| 9 | <code>gemini/gemini-3.8-flash</code> | $0.0040 | 100.00 | 0.00% | 0.00% | 6.62s | $0.0040 |
| 10 | <code>gemini/gemini-3.5-flash</code> | $0.0042 | 100.00 | 0.00% | 0.00% | 3.30s | $0.0042 |
| 11 | <code>grok/grok-4.5</code> | $0.0075 | 100.00 | 0.00% | 0.00% | 4.27s | $0.0075 |
| 12 | <code>openai/gpt-6.1-sol</code> | $0.0101 | 100.00 | 0.00% | 0.00% | 6.75s | $0.0101 |
| 13 | <code>openai/gpt-5.6-terra</code> | $0.0111 | 100.00 | 0.00% | 0.00% | 3.48s | $0.0111 |
| 14 | <code>gemini/gemini-4-argon</code> | $0.0120 | 100.00 | 0.00% | 0.00% | 5.65s | $0.0120 |
| 15 | <code>anthropic/claude-sonnet-5-5</code> | $0.0154 | 100.00 | 0.00% | 0.00% | 6.53s | $0.0154 |
| 16 | <code>grok/grok-4.7</code> | $0.0166 | 100.00 | 0.00% | 0.00% | 16.59s | $0.0166 |
| 17 | <code>anthropic/claude-opus-5-5</code> | $0.0309 | 100.00 | 0.00% | 0.00% | 4.99s | $0.0309 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0503 | 100.00 | 0.00% | 0.00% | 5.76s | $0.0503 |
| 19 | <code>anthropic/claude-fable-5</code> | $0.0771 | 100.00 | 0.00% | 0.00% | 8.03s | $0.0771 |
| 20 | <code>anthropic/claude-fable-5-1</code> | $0.0773 | 100.00 | 0.00% | 0.00% | 4.93s | $0.0773 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 2.03s | 100.00 | 0.00% | 0.00% | 2.03s | $0.0011 |
| 2 | <code>mistral/mistral-ocr-4-1</code> | 2.38s | 100.00 | 0.00% | 0.00% | 2.38s | $0.0040 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 2.63s | 100.00 | 0.00% | 0.00% | 2.63s | $0.0008 |
| 4 | <code>gemini/gemini-3.6-flash</code> | 2.67s | 100.00 | 0.00% | 0.00% | 2.67s | $0.0038 |
| 5 | <code>gemini/gemini-3.5-flash</code> | 3.30s | 100.00 | 0.00% | 0.00% | 3.30s | $0.0042 |
| 6 | <code>openai/gpt-5.6-terra</code> | 3.48s | 100.00 | 0.00% | 0.00% | 3.48s | $0.0111 |
| 7 | <code>grok/grok-4.5</code> | 4.27s | 100.00 | 0.00% | 0.00% | 4.27s | $0.0075 |
| 8 | <code>anthropic/claude-fable-5-1</code> | 4.93s | 100.00 | 0.00% | 0.00% | 4.93s | $0.0773 |
| 9 | <code>anthropic/claude-opus-5-5</code> | 4.99s | 100.00 | 0.00% | 0.00% | 4.99s | $0.0309 |
| 10 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 5.30s | 98.74 | 1.26% | 0.11% | 5.30s | $0.0004 |
| 11 | <code>gemini/gemini-4-argon</code> | 5.65s | 100.00 | 0.00% | 0.00% | 5.65s | $0.0120 |
| 12 | <code>openai/gpt-6-astra</code> | 5.76s | 100.00 | 0.00% | 0.00% | 5.76s | $0.0503 |
| 13 | <code>anthropic/claude-sonnet-5-5</code> | 6.53s | 100.00 | 0.00% | 0.00% | 6.53s | $0.0154 |
| 14 | <code>gemini/gemini-3.8-flash</code> | 6.62s | 100.00 | 0.00% | 0.00% | 6.62s | $0.0040 |
| 15 | <code>openai/gpt-6.1-sol</code> | 6.75s | 100.00 | 0.00% | 0.00% | 6.75s | $0.0101 |
| 16 | <code>openai/gpt-6-luna</code> | 7.46s | 100.00 | 0.00% | 0.00% | 7.46s | $0.0007 |
| 17 | <code>anthropic/claude-fable-5</code> | 8.03s | 100.00 | 0.00% | 0.00% | 8.03s | $0.0771 |
| 18 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 8.85s | 98.74 | 1.26% | 0.21% | 8.85s | $0.0021 |
| 19 | <code>deepinfra/google/gemma-4-31B-it</code> | 10.67s | 100.00 | 0.00% | 0.00% | 10.67s | $0.0002 |
| 20 | <code>grok/grok-4.7</code> | 16.59s | 100.00 | 0.00% | 0.00% | 16.59s | $0.0166 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 8.03s | $0.0771 |
| 2 | <code>anthropic/claude-fable-5-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.93s | $0.0773 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.63s | $0.0008 |
| 4 | <code>anthropic/claude-opus-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.99s | $0.0309 |
| 5 | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 6.53s | $0.0154 |
| 6 | <code>deepinfra/google/gemma-4-31B-it</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 10.67s | $0.0002 |
| 7 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.30s | $0.0042 |
| 8 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.03s | $0.0011 |
| 9 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.67s | $0.0038 |
| 10 | <code>gemini/gemini-3.8-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 6.62s | $0.0040 |
| 11 | <code>gemini/gemini-4-argon</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.65s | $0.0120 |
| 12 | <code>grok/grok-4.5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.27s | $0.0075 |
| 13 | <code>grok/grok-4.7</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 16.59s | $0.0166 |
| 14 | <code>mistral/mistral-ocr-4-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.38s | $0.0040 |
| 15 | <code>openai/gpt-5.6-terra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.48s | $0.0111 |
| 16 | <code>openai/gpt-6-astra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.76s | $0.0503 |
| 17 | <code>openai/gpt-6-luna</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 7.46s | $0.0007 |
| 18 | <code>openai/gpt-6.1-sol</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 6.75s | $0.0101 |
| 19 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 98.74/100 quality score | 98.74 | 1.26% | 0.11% | 5.30s | $0.0004 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 98.74/100 quality score | 98.74 | 1.26% | 0.21% | 8.85s | $0.0021 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 93.08 | 6.92% | 1.59% | 0.82s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 8.03s | $0.0771 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.93s | $0.0773 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.63s | $0.0008 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.99s | $0.0309 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 6.53s | $0.0154 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 98.74 | 1.26% | 0.11% | 5.30s | $0.0004 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 10.67s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 98.74 | 1.26% | 0.21% | 8.85s | $0.0021 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.30s | $0.0042 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.03s | $0.0011 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.67s | $0.0038 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 6.62s | $0.0040 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.65s | $0.0120 |
| <code>grok/grok-4.5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.27s | $0.0075 |
| <code>grok/grok-4.7</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 16.59s | $0.0166 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.38s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.48s | $0.0111 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.76s | $0.0503 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 7.46s | $0.0007 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 6.75s | $0.0101 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 9 | 0 | 2 | 159 |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 0 | 159 |
| <code>anthropic/claude-fable-5-1</code> | 0 | 0 | 0 | 159 |
| <code>anthropic/claude-haiku-5-5</code> | 0 | 0 | 0 | 159 |
| <code>anthropic/claude-opus-5-5</code> | 0 | 0 | 0 | 159 |
| <code>anthropic/claude-sonnet-5-5</code> | 0 | 0 | 0 | 159 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 1 | 0 | 1 | 159 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 0 | 0 | 0 | 159 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 2 | 0 | 0 | 159 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 159 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 159 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 159 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 0 | 0 | 159 |
| <code>gemini/gemini-4-argon</code> | 0 | 0 | 0 | 159 |
| <code>grok/grok-4.5</code> | 0 | 0 | 0 | 159 |
| <code>grok/grok-4.7</code> | 0 | 0 | 0 | 159 |
| <code>mistral/mistral-ocr-4-1</code> | 0 | 0 | 0 | 159 |
| <code>openai/gpt-5.6-terra</code> | 0 | 0 | 0 | 159 |
| <code>openai/gpt-6-astra</code> | 0 | 0 | 0 | 159 |
| <code>openai/gpt-6-luna</code> | 0 | 0 | 0 | 159 |
| <code>openai/gpt-6.1-sol</code> | 0 | 0 | 0 | 159 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 93.08/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0168¢ ($0.0002).
- Fastest local model: `tesseract/tesseract` at 0.82s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 2.03s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
