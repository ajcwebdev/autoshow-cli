# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-clean-typography/benchmark-runs/clean-typography-good-talk`
- Publisher canonical reference: `canonical-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `b829d2120657ee4b9a97d7ecc9cb827daac50d6152e5fb9c8a11b4dbea7c10d8`.
- Publisher source: https://huggingface.co/datasets/opendatalab/OmniDocBench/resolve/aa1ee96d106dbe53d0ae59474d75c6e6d9b53fec/OmniDocBench.json (revision `aa1ee96d106dbe53d0ae59474d75c6e6d9b53fec`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 82.50 | 17.50% | 6.28% | 0.27s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.27s | 82.50 | 17.50% | 6.28% | 0.27s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 82.50/100 quality score | 82.50 | 17.50% | 6.28% | 0.27s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0001 | 100.00 | 0.00% | 0.00% | 1.96s | $0.0001 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0002 | 100.00 | 0.00% | 0.00% | 1.49s | $0.0002 |
| 3 | <code>openai/gpt-6-luna</code> | $0.0004 | 100.00 | 0.00% | 0.00% | 2.74s | $0.0004 |
| 4 | <code>anthropic/claude-haiku-5-5</code> | $0.0005 | 100.00 | 0.00% | 0.00% | 1.61s | $0.0005 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0006 | 100.00 | 0.00% | 0.00% | 1.32s | $0.0006 |
| 6 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0007 | 100.00 | 0.00% | 0.00% | 2.06s | $0.0007 |
| 7 | <code>gemini/gemini-3.6-flash</code> | $0.0024 | 100.00 | 0.00% | 0.00% | 2.11s | $0.0024 |
| 8 | <code>gemini/gemini-3.5-flash</code> | $0.0025 | 100.00 | 0.00% | 0.00% | 2.34s | $0.0025 |
| 9 | <code>gemini/gemini-3.8-flash</code> | $0.0025 | 100.00 | 0.00% | 0.00% | 115.99s | $0.0025 |
| 10 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 70.00 | 30.00% | 21.26% | 2.00s | $0.0040 |
| 11 | <code>grok/grok-4.5</code> | $0.0062 | 100.00 | 0.00% | 0.00% | 1.59s | $0.0062 |
| 12 | <code>gemini/gemini-4-argon</code> | $0.0073 | 100.00 | 0.00% | 0.00% | 5.17s | $0.0073 |
| 13 | <code>openai/gpt-6.1-sol</code> | $0.0081 | 100.00 | 0.00% | 0.00% | 3.97s | $0.0081 |
| 14 | <code>openai/gpt-5.6-terra</code> | $0.0082 | 100.00 | 0.00% | 0.00% | 1.51s | $0.0082 |
| 15 | <code>grok/grok-4.7</code> | $0.0088 | 100.00 | 0.00% | 0.00% | 2.68s | $0.0088 |
| 16 | <code>anthropic/claude-sonnet-5-5</code> | $0.0102 | 100.00 | 0.00% | 0.00% | 4.70s | $0.0102 |
| 17 | <code>anthropic/claude-opus-5-5</code> | $0.0203 | 100.00 | 0.00% | 0.00% | 4.62s | $0.0203 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0406 | 100.00 | 0.00% | 0.00% | 2.15s | $0.0406 |
| 19 | <code>anthropic/claude-fable-5</code> | $0.0513 | 100.00 | 0.00% | 0.00% | 4.08s | $0.0513 |
| 20 | <code>anthropic/claude-fable-5-1</code> | $0.0513 | 100.00 | 0.00% | 0.00% | 2.62s | $0.0513 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 1.32s | 100.00 | 0.00% | 0.00% | 1.32s | $0.0006 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 1.49s | 100.00 | 0.00% | 0.00% | 1.49s | $0.0002 |
| 3 | <code>openai/gpt-5.6-terra</code> | 1.51s | 100.00 | 0.00% | 0.00% | 1.51s | $0.0082 |
| 4 | <code>grok/grok-4.5</code> | 1.59s | 100.00 | 0.00% | 0.00% | 1.59s | $0.0062 |
| 5 | <code>anthropic/claude-haiku-5-5</code> | 1.61s | 100.00 | 0.00% | 0.00% | 1.61s | $0.0005 |
| 6 | <code>deepinfra/google/gemma-4-31B-it</code> | 1.96s | 100.00 | 0.00% | 0.00% | 1.96s | $0.0001 |
| 7 | <code>mistral/mistral-ocr-4-1</code> | 2.00s | 70.00 | 30.00% | 21.26% | 2.00s | $0.0040 |
| 8 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 2.06s | 100.00 | 0.00% | 0.00% | 2.06s | $0.0007 |
| 9 | <code>gemini/gemini-3.6-flash</code> | 2.11s | 100.00 | 0.00% | 0.00% | 2.11s | $0.0024 |
| 10 | <code>openai/gpt-6-astra</code> | 2.15s | 100.00 | 0.00% | 0.00% | 2.15s | $0.0406 |
| 11 | <code>gemini/gemini-3.5-flash</code> | 2.34s | 100.00 | 0.00% | 0.00% | 2.34s | $0.0025 |
| 12 | <code>anthropic/claude-fable-5-1</code> | 2.62s | 100.00 | 0.00% | 0.00% | 2.62s | $0.0513 |
| 13 | <code>grok/grok-4.7</code> | 2.68s | 100.00 | 0.00% | 0.00% | 2.68s | $0.0088 |
| 14 | <code>openai/gpt-6-luna</code> | 2.74s | 100.00 | 0.00% | 0.00% | 2.74s | $0.0004 |
| 15 | <code>openai/gpt-6.1-sol</code> | 3.97s | 100.00 | 0.00% | 0.00% | 3.97s | $0.0081 |
| 16 | <code>anthropic/claude-fable-5</code> | 4.08s | 100.00 | 0.00% | 0.00% | 4.08s | $0.0513 |
| 17 | <code>anthropic/claude-opus-5-5</code> | 4.62s | 100.00 | 0.00% | 0.00% | 4.62s | $0.0203 |
| 18 | <code>anthropic/claude-sonnet-5-5</code> | 4.70s | 100.00 | 0.00% | 0.00% | 4.70s | $0.0102 |
| 19 | <code>gemini/gemini-4-argon</code> | 5.17s | 100.00 | 0.00% | 0.00% | 5.17s | $0.0073 |
| 20 | <code>gemini/gemini-3.8-flash</code> | 115.99s | 100.00 | 0.00% | 0.00% | 115.99s | $0.0025 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.08s | $0.0513 |
| 2 | <code>anthropic/claude-fable-5-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.62s | $0.0513 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.61s | $0.0005 |
| 4 | <code>anthropic/claude-opus-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.62s | $0.0203 |
| 5 | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.70s | $0.0102 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.49s | $0.0002 |
| 7 | <code>deepinfra/google/gemma-4-31B-it</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.96s | $0.0001 |
| 8 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.06s | $0.0007 |
| 9 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.34s | $0.0025 |
| 10 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.32s | $0.0006 |
| 11 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.11s | $0.0024 |
| 12 | <code>gemini/gemini-3.8-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 115.99s | $0.0025 |
| 13 | <code>gemini/gemini-4-argon</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.17s | $0.0073 |
| 14 | <code>grok/grok-4.5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.59s | $0.0062 |
| 15 | <code>grok/grok-4.7</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.68s | $0.0088 |
| 16 | <code>openai/gpt-5.6-terra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.51s | $0.0082 |
| 17 | <code>openai/gpt-6-astra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.15s | $0.0406 |
| 18 | <code>openai/gpt-6-luna</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.74s | $0.0004 |
| 19 | <code>openai/gpt-6.1-sol</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.97s | $0.0081 |
| 20 | <code>mistral/mistral-ocr-4-1</code> | 70.00/100 quality score | 70.00 | 30.00% | 21.26% | 2.00s | $0.0040 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 82.50 | 17.50% | 6.28% | 0.27s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.08s | $0.0513 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.62s | $0.0513 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.61s | $0.0005 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.62s | $0.0203 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.70s | $0.0102 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.49s | $0.0002 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.96s | $0.0001 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.06s | $0.0007 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.34s | $0.0025 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.32s | $0.0006 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.11s | $0.0024 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 115.99s | $0.0025 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.17s | $0.0073 |
| <code>grok/grok-4.5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.59s | $0.0062 |
| <code>grok/grok-4.7</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.68s | $0.0088 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 70.00 | 30.00% | 21.26% | 2.00s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.51s | $0.0082 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.15s | $0.0406 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.74s | $0.0004 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.97s | $0.0081 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 5 | 1 | 1 | 40 |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 0 | 40 |
| <code>anthropic/claude-fable-5-1</code> | 0 | 0 | 0 | 40 |
| <code>anthropic/claude-haiku-5-5</code> | 0 | 0 | 0 | 40 |
| <code>anthropic/claude-opus-5-5</code> | 0 | 0 | 0 | 40 |
| <code>anthropic/claude-sonnet-5-5</code> | 0 | 0 | 0 | 40 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 0 | 0 | 0 | 40 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 0 | 0 | 0 | 40 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 0 | 0 | 0 | 40 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 40 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 40 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 40 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 0 | 0 | 40 |
| <code>gemini/gemini-4-argon</code> | 0 | 0 | 0 | 40 |
| <code>grok/grok-4.5</code> | 0 | 0 | 0 | 40 |
| <code>grok/grok-4.7</code> | 0 | 0 | 0 | 40 |
| <code>mistral/mistral-ocr-4-1</code> | 0 | 0 | 12 | 40 |
| <code>openai/gpt-5.6-terra</code> | 0 | 0 | 0 | 40 |
| <code>openai/gpt-6-astra</code> | 0 | 0 | 0 | 40 |
| <code>openai/gpt-6-luna</code> | 0 | 0 | 0 | 40 |
| <code>openai/gpt-6.1-sol</code> | 0 | 0 | 0 | 40 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 82.50/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0092¢ ($0.0001).
- Fastest local model: `tesseract/tesseract` at 0.27s.
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 1.32s.

## Cost accounting

- Reported usage is valued at reviewed rates; prices include settled retry costs and retained unresolved reservations once and are not invoice-reconciled charges.
- Any settled conservative amount or retained unresolved reservation makes the price a conservative upper bound; billing uncertainty remains visible in the separate breakdown.
