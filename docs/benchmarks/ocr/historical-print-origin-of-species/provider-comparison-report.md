# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-bc-run/benchmark-runs/historical-print-origin-of-species`
- Publisher canonical reference: `historical-print-origin-of-species.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `2affdf333a4b3e7317f63ca55e910926c8bb672ec40bef41194c9dc44958edeb`.
- Publisher source: https://en.wikisource.org/w/index.php?title=Page%3AOrigin%20of%20Species%201859%20facsimile.djvu%2F13&oldid=7963369&action=raw (revision `7963369`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 96.03 | 3.97% | 0.32% | 1.03s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 1.03s | 96.03 | 3.97% | 0.32% | 1.03s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 96.03/100 quality score | 96.03 | 3.97% | 0.32% | 1.03s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0002 | 95.70 | 4.30% | 0.49% | 9.00s | $0.0002 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0005 | 96.03 | 3.97% | 0.32% | 4.70s | $0.0005 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | $0.0007 | 96.03 | 3.97% | 0.32% | 3.31s | $0.0007 |
| 4 | <code>openai/gpt-6-luna</code> | $0.0008 | 100.00 | 0.00% | 0.00% | 7.97s | $0.0008 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0014 | 100.00 | 0.00% | 0.00% | 7.37s | $0.0014 |
| 6 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0016 | 95.70 | 4.30% | 0.49% | 12.94s | $0.0016 |
| 7 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 100.00 | 0.00% | 0.00% | 1.75s | $0.0040 |
| 8 | <code>gemini/gemini-3.6-flash</code> | $0.0051 | 96.03 | 3.97% | 0.32% | 2.90s | $0.0051 |
| 9 | <code>gemini/gemini-3.8-flash</code> | $0.0051 | 96.03 | 3.97% | 0.32% | 5.19s | $0.0051 |
| 10 | <code>gemini/gemini-3.5-flash</code> | $0.0058 | 96.03 | 3.97% | 0.32% | 3.00s | $0.0058 |
| 11 | <code>openai/gpt-6.1-sol</code> | $0.0114 | 96.03 | 3.97% | 0.32% | 7.99s | $0.0114 |
| 12 | <code>grok/grok-4.5</code> | $0.0119 | 96.03 | 3.97% | 0.32% | 12.48s | $0.0119 |
| 13 | <code>anthropic/claude-sonnet-5-5</code> | $0.0143 | 96.03 | 3.97% | 0.32% | 6.65s | $0.0143 |
| 14 | <code>gemini/gemini-4-argon</code> | $0.0150 | 96.03 | 3.97% | 0.32% | 28.58s | $0.0150 |
| 15 | <code>openai/gpt-5.6-terra</code> | $0.0152 | 96.03 | 3.97% | 0.32% | 5.89s | $0.0152 |
| 16 | <code>grok/grok-4.7</code> | $0.0186 | 100.00 | 0.00% | 0.00% | 19.23s | $0.0186 |
| 17 | <code>anthropic/claude-opus-5-5</code> | $0.0267 | 100.00 | 0.00% | 0.00% | 9.38s | $0.0267 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0571 | 96.03 | 3.97% | 0.32% | 9.02s | $0.0571 |
| 19 | <code>anthropic/claude-fable-5</code> | $0.0709 | 96.03 | 3.97% | 0.32% | 10.96s | $0.0709 |
| 20 | <code>anthropic/claude-fable-5-1</code> | $0.0711 | 96.03 | 3.97% | 0.32% | 6.68s | $0.0711 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-1</code> | 1.75s | 100.00 | 0.00% | 0.00% | 1.75s | $0.0040 |
| 2 | <code>gemini/gemini-3.6-flash</code> | 2.90s | 96.03 | 3.97% | 0.32% | 2.90s | $0.0051 |
| 3 | <code>gemini/gemini-3.5-flash</code> | 3.00s | 96.03 | 3.97% | 0.32% | 3.00s | $0.0058 |
| 4 | <code>anthropic/claude-haiku-5-5</code> | 3.31s | 96.03 | 3.97% | 0.32% | 3.31s | $0.0007 |
| 5 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 4.70s | 96.03 | 3.97% | 0.32% | 4.70s | $0.0005 |
| 6 | <code>gemini/gemini-3.8-flash</code> | 5.19s | 96.03 | 3.97% | 0.32% | 5.19s | $0.0051 |
| 7 | <code>openai/gpt-5.6-terra</code> | 5.89s | 96.03 | 3.97% | 0.32% | 5.89s | $0.0152 |
| 8 | <code>anthropic/claude-sonnet-5-5</code> | 6.65s | 96.03 | 3.97% | 0.32% | 6.65s | $0.0143 |
| 9 | <code>anthropic/claude-fable-5-1</code> | 6.68s | 96.03 | 3.97% | 0.32% | 6.68s | $0.0711 |
| 10 | <code>gemini/gemini-3.5-flash-lite</code> | 7.37s | 100.00 | 0.00% | 0.00% | 7.37s | $0.0014 |
| 11 | <code>openai/gpt-6-luna</code> | 7.97s | 100.00 | 0.00% | 0.00% | 7.97s | $0.0008 |
| 12 | <code>openai/gpt-6.1-sol</code> | 7.99s | 96.03 | 3.97% | 0.32% | 7.99s | $0.0114 |
| 13 | <code>deepinfra/google/gemma-4-31B-it</code> | 9.00s | 95.70 | 4.30% | 0.49% | 9.00s | $0.0002 |
| 14 | <code>openai/gpt-6-astra</code> | 9.02s | 96.03 | 3.97% | 0.32% | 9.02s | $0.0571 |
| 15 | <code>anthropic/claude-opus-5-5</code> | 9.38s | 100.00 | 0.00% | 0.00% | 9.38s | $0.0267 |
| 16 | <code>anthropic/claude-fable-5</code> | 10.96s | 96.03 | 3.97% | 0.32% | 10.96s | $0.0709 |
| 17 | <code>grok/grok-4.5</code> | 12.48s | 96.03 | 3.97% | 0.32% | 12.48s | $0.0119 |
| 18 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 12.94s | 95.70 | 4.30% | 0.49% | 12.94s | $0.0016 |
| 19 | <code>grok/grok-4.7</code> | 19.23s | 100.00 | 0.00% | 0.00% | 19.23s | $0.0186 |
| 20 | <code>gemini/gemini-4-argon</code> | 28.58s | 96.03 | 3.97% | 0.32% | 28.58s | $0.0150 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-opus-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 9.38s | $0.0267 |
| 2 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 7.37s | $0.0014 |
| 3 | <code>grok/grok-4.7</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 19.23s | $0.0186 |
| 4 | <code>mistral/mistral-ocr-4-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.75s | $0.0040 |
| 5 | <code>openai/gpt-6-luna</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 7.97s | $0.0008 |
| 6 | <code>anthropic/claude-fable-5</code> | 96.03/100 quality score | 96.03 | 3.97% | 0.32% | 10.96s | $0.0709 |
| 7 | <code>anthropic/claude-fable-5-1</code> | 96.03/100 quality score | 96.03 | 3.97% | 0.32% | 6.68s | $0.0711 |
| 8 | <code>anthropic/claude-haiku-5-5</code> | 96.03/100 quality score | 96.03 | 3.97% | 0.32% | 3.31s | $0.0007 |
| 9 | <code>anthropic/claude-sonnet-5-5</code> | 96.03/100 quality score | 96.03 | 3.97% | 0.32% | 6.65s | $0.0143 |
| 10 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 96.03/100 quality score | 96.03 | 3.97% | 0.32% | 4.70s | $0.0005 |
| 11 | <code>gemini/gemini-3.5-flash</code> | 96.03/100 quality score | 96.03 | 3.97% | 0.32% | 3.00s | $0.0058 |
| 12 | <code>gemini/gemini-3.6-flash</code> | 96.03/100 quality score | 96.03 | 3.97% | 0.32% | 2.90s | $0.0051 |
| 13 | <code>gemini/gemini-3.8-flash</code> | 96.03/100 quality score | 96.03 | 3.97% | 0.32% | 5.19s | $0.0051 |
| 14 | <code>gemini/gemini-4-argon</code> | 96.03/100 quality score | 96.03 | 3.97% | 0.32% | 28.58s | $0.0150 |
| 15 | <code>grok/grok-4.5</code> | 96.03/100 quality score | 96.03 | 3.97% | 0.32% | 12.48s | $0.0119 |
| 16 | <code>openai/gpt-5.6-terra</code> | 96.03/100 quality score | 96.03 | 3.97% | 0.32% | 5.89s | $0.0152 |
| 17 | <code>openai/gpt-6-astra</code> | 96.03/100 quality score | 96.03 | 3.97% | 0.32% | 9.02s | $0.0571 |
| 18 | <code>openai/gpt-6.1-sol</code> | 96.03/100 quality score | 96.03 | 3.97% | 0.32% | 7.99s | $0.0114 |
| 19 | <code>deepinfra/google/gemma-4-31B-it</code> | 95.70/100 quality score | 95.70 | 4.30% | 0.49% | 9.00s | $0.0002 |
| 20 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 95.70/100 quality score | 95.70 | 4.30% | 0.49% | 12.94s | $0.0016 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 96.03 | 3.97% | 0.32% | 1.03s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 96.03 | 3.97% | 0.32% | 10.96s | $0.0709 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 96.03 | 3.97% | 0.32% | 6.68s | $0.0711 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 96.03 | 3.97% | 0.32% | 3.31s | $0.0007 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 9.38s | $0.0267 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 96.03 | 3.97% | 0.32% | 6.65s | $0.0143 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 96.03 | 3.97% | 0.32% | 4.70s | $0.0005 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 95.70 | 4.30% | 0.49% | 9.00s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 95.70 | 4.30% | 0.49% | 12.94s | $0.0016 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 96.03 | 3.97% | 0.32% | 3.00s | $0.0058 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 7.37s | $0.0014 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 96.03 | 3.97% | 0.32% | 2.90s | $0.0051 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 96.03 | 3.97% | 0.32% | 5.19s | $0.0051 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 96.03 | 3.97% | 0.32% | 28.58s | $0.0150 |
| <code>grok/grok-4.5</code> | Third-Party Service | 96.03 | 3.97% | 0.32% | 12.48s | $0.0119 |
| <code>grok/grok-4.7</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 19.23s | $0.0186 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.75s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 96.03 | 3.97% | 0.32% | 5.89s | $0.0152 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 96.03 | 3.97% | 0.32% | 9.02s | $0.0571 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 7.97s | $0.0008 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 96.03 | 3.97% | 0.32% | 7.99s | $0.0114 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 6 | 0 | 6 | 302 |
| <code>anthropic/claude-fable-5</code> | 6 | 0 | 6 | 302 |
| <code>anthropic/claude-fable-5-1</code> | 6 | 0 | 6 | 302 |
| <code>anthropic/claude-haiku-5-5</code> | 6 | 0 | 6 | 302 |
| <code>anthropic/claude-opus-5-5</code> | 0 | 0 | 0 | 302 |
| <code>anthropic/claude-sonnet-5-5</code> | 6 | 0 | 6 | 302 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 6 | 0 | 6 | 302 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 7 | 0 | 6 | 302 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 7 | 0 | 6 | 302 |
| <code>gemini/gemini-3.5-flash</code> | 6 | 0 | 6 | 302 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 302 |
| <code>gemini/gemini-3.6-flash</code> | 6 | 0 | 6 | 302 |
| <code>gemini/gemini-3.8-flash</code> | 6 | 0 | 6 | 302 |
| <code>gemini/gemini-4-argon</code> | 6 | 0 | 6 | 302 |
| <code>grok/grok-4.5</code> | 6 | 0 | 6 | 302 |
| <code>grok/grok-4.7</code> | 0 | 0 | 0 | 302 |
| <code>mistral/mistral-ocr-4-1</code> | 0 | 0 | 0 | 302 |
| <code>openai/gpt-5.6-terra</code> | 6 | 0 | 6 | 302 |
| <code>openai/gpt-6-astra</code> | 6 | 0 | 6 | 302 |
| <code>openai/gpt-6-luna</code> | 0 | 0 | 0 | 302 |
| <code>openai/gpt-6.1-sol</code> | 6 | 0 | 6 | 302 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 96.03/100.
- Best cloud service: `anthropic/claude-opus-5-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0234¢ ($0.0002).
- Fastest local model: `tesseract/tesseract` at 1.03s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.75s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- The protocol uses pinned page PNGs for every provider, including rendered baseline PDFs. Archived original runs remain separate.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental fidelity-metrics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
