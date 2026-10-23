# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-clean-typography/benchmark-runs/clean-typography-federal-assistance`
- Publisher canonical reference: `canonical-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `b06f4296ccdb53b724619c5d2aaaf1e5166391bde5ce2e329c0b5388b1947ac1`.
- Publisher source: https://huggingface.co/datasets/opendatalab/OmniDocBench/resolve/aa1ee96d106dbe53d0ae59474d75c6e6d9b53fec/OmniDocBench.json (revision `aa1ee96d106dbe53d0ae59474d75c6e6d9b53fec`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | 100.00 | 0.00% | 0.00% | 0.48s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.48s | 100.00 | 0.00% | 0.00% | 0.48s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.48s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0001 | 100.00 | 0.00% | 0.00% | 8.45s | $0.0001 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0003 | 100.00 | 0.00% | 0.00% | 1.66s | $0.0003 |
| 3 | <code>openai/gpt-6-luna</code> | $0.0005 | 100.00 | 0.00% | 0.00% | 5.23s | $0.0005 |
| 4 | <code>anthropic/claude-haiku-5-5</code> | $0.0006 | 100.00 | 0.00% | 0.00% | 2.65s | $0.0006 |
| 5 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0008 | 100.00 | 0.00% | 0.00% | 1.76s | $0.0008 |
| 6 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0009 | 100.00 | 0.00% | 0.00% | 5.16s | $0.0009 |
| 7 | <code>gemini/gemini-3.6-flash</code> | $0.0030 | 100.00 | 0.00% | 0.00% | 2.06s | $0.0030 |
| 8 | <code>gemini/gemini-3.8-flash</code> | $0.0032 | 100.00 | 0.00% | 0.00% | 117.10s | $0.0032 |
| 9 | <code>gemini/gemini-3.5-flash</code> | $0.0033 | 100.00 | 0.00% | 0.00% | 2.67s | $0.0033 |
| 10 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 100.00 | 0.00% | 0.00% | 1.91s | $0.0040 |
| 11 | <code>grok/grok-4.5</code> | $0.0080 | 100.00 | 0.00% | 0.00% | 5.00s | $0.0080 |
| 12 | <code>openai/gpt-6.1-sol</code> | $0.0090 | 100.00 | 0.00% | 0.00% | 3.65s | $0.0090 |
| 13 | <code>openai/gpt-5.6-terra</code> | $0.0093 | 100.00 | 0.00% | 0.00% | 3.01s | $0.0093 |
| 14 | <code>gemini/gemini-4-argon</code> | $0.0094 | 100.00 | 0.00% | 0.00% | 5.70s | $0.0094 |
| 15 | <code>grok/grok-4.7</code> | $0.0110 | 100.00 | 0.00% | 0.00% | 5.32s | $0.0110 |
| 16 | <code>anthropic/claude-sonnet-5-5</code> | $0.0119 | 100.00 | 0.00% | 0.00% | 3.33s | $0.0119 |
| 17 | <code>anthropic/claude-opus-5-5</code> | $0.0236 | 100.00 | 0.00% | 0.00% | 4.43s | $0.0236 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0449 | 100.00 | 0.00% | 0.00% | 3.06s | $0.0449 |
| 19 | <code>anthropic/claude-fable-5-1</code> | $0.0590 | 100.00 | 0.00% | 0.00% | 7.89s | $0.0590 |
| 20 | <code>anthropic/claude-fable-5</code> | $0.0593 | 100.00 | 0.00% | 0.00% | 5.81s | $0.0593 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 1.66s | 100.00 | 0.00% | 0.00% | 1.66s | $0.0003 |
| 2 | <code>gemini/gemini-3.5-flash-lite</code> | 1.76s | 100.00 | 0.00% | 0.00% | 1.76s | $0.0008 |
| 3 | <code>mistral/mistral-ocr-4-1</code> | 1.91s | 100.00 | 0.00% | 0.00% | 1.91s | $0.0040 |
| 4 | <code>gemini/gemini-3.6-flash</code> | 2.06s | 100.00 | 0.00% | 0.00% | 2.06s | $0.0030 |
| 5 | <code>anthropic/claude-haiku-5-5</code> | 2.65s | 100.00 | 0.00% | 0.00% | 2.65s | $0.0006 |
| 6 | <code>gemini/gemini-3.5-flash</code> | 2.67s | 100.00 | 0.00% | 0.00% | 2.67s | $0.0033 |
| 7 | <code>openai/gpt-5.6-terra</code> | 3.01s | 100.00 | 0.00% | 0.00% | 3.01s | $0.0093 |
| 8 | <code>openai/gpt-6-astra</code> | 3.06s | 100.00 | 0.00% | 0.00% | 3.06s | $0.0449 |
| 9 | <code>anthropic/claude-sonnet-5-5</code> | 3.33s | 100.00 | 0.00% | 0.00% | 3.33s | $0.0119 |
| 10 | <code>openai/gpt-6.1-sol</code> | 3.65s | 100.00 | 0.00% | 0.00% | 3.65s | $0.0090 |
| 11 | <code>anthropic/claude-opus-5-5</code> | 4.43s | 100.00 | 0.00% | 0.00% | 4.43s | $0.0236 |
| 12 | <code>grok/grok-4.5</code> | 5.00s | 100.00 | 0.00% | 0.00% | 5.00s | $0.0080 |
| 13 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 5.16s | 100.00 | 0.00% | 0.00% | 5.16s | $0.0009 |
| 14 | <code>openai/gpt-6-luna</code> | 5.23s | 100.00 | 0.00% | 0.00% | 5.23s | $0.0005 |
| 15 | <code>grok/grok-4.7</code> | 5.32s | 100.00 | 0.00% | 0.00% | 5.32s | $0.0110 |
| 16 | <code>gemini/gemini-4-argon</code> | 5.70s | 100.00 | 0.00% | 0.00% | 5.70s | $0.0094 |
| 17 | <code>anthropic/claude-fable-5</code> | 5.81s | 100.00 | 0.00% | 0.00% | 5.81s | $0.0593 |
| 18 | <code>anthropic/claude-fable-5-1</code> | 7.89s | 100.00 | 0.00% | 0.00% | 7.89s | $0.0590 |
| 19 | <code>deepinfra/google/gemma-4-31B-it</code> | 8.45s | 100.00 | 0.00% | 0.00% | 8.45s | $0.0001 |
| 20 | <code>gemini/gemini-3.8-flash</code> | 117.10s | 100.00 | 0.00% | 0.00% | 117.10s | $0.0032 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.81s | $0.0593 |
| 2 | <code>anthropic/claude-fable-5-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 7.89s | $0.0590 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.65s | $0.0006 |
| 4 | <code>anthropic/claude-opus-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.43s | $0.0236 |
| 5 | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.33s | $0.0119 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.66s | $0.0003 |
| 7 | <code>deepinfra/google/gemma-4-31B-it</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 8.45s | $0.0001 |
| 8 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.16s | $0.0009 |
| 9 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.67s | $0.0033 |
| 10 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.76s | $0.0008 |
| 11 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.06s | $0.0030 |
| 12 | <code>gemini/gemini-3.8-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 117.10s | $0.0032 |
| 13 | <code>gemini/gemini-4-argon</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.70s | $0.0094 |
| 14 | <code>grok/grok-4.5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.00s | $0.0080 |
| 15 | <code>grok/grok-4.7</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.32s | $0.0110 |
| 16 | <code>mistral/mistral-ocr-4-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.91s | $0.0040 |
| 17 | <code>openai/gpt-5.6-terra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.01s | $0.0093 |
| 18 | <code>openai/gpt-6-astra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.06s | $0.0449 |
| 19 | <code>openai/gpt-6-luna</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.23s | $0.0005 |
| 20 | <code>openai/gpt-6.1-sol</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.65s | $0.0090 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | 100.00 | 0.00% | 0.00% | 0.48s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.81s | $0.0593 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 7.89s | $0.0590 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.65s | $0.0006 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.43s | $0.0236 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.33s | $0.0119 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.66s | $0.0003 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 8.45s | $0.0001 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.16s | $0.0009 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.67s | $0.0033 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.76s | $0.0008 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.06s | $0.0030 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 117.10s | $0.0032 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.70s | $0.0094 |
| <code>grok/grok-4.5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.00s | $0.0080 |
| <code>grok/grok-4.7</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.32s | $0.0110 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.91s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.01s | $0.0093 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.06s | $0.0449 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.23s | $0.0005 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.65s | $0.0090 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | 0 | 0 | 0 | 102 |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 0 | 102 |
| <code>anthropic/claude-fable-5-1</code> | 0 | 0 | 0 | 102 |
| <code>anthropic/claude-haiku-5-5</code> | 0 | 0 | 0 | 102 |
| <code>anthropic/claude-opus-5-5</code> | 0 | 0 | 0 | 102 |
| <code>anthropic/claude-sonnet-5-5</code> | 0 | 0 | 0 | 102 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 0 | 0 | 0 | 102 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 0 | 0 | 0 | 102 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 0 | 0 | 0 | 102 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 102 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 102 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 102 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 0 | 0 | 102 |
| <code>gemini/gemini-4-argon</code> | 0 | 0 | 0 | 102 |
| <code>grok/grok-4.5</code> | 0 | 0 | 0 | 102 |
| <code>grok/grok-4.7</code> | 0 | 0 | 0 | 102 |
| <code>mistral/mistral-ocr-4-1</code> | 0 | 0 | 0 | 102 |
| <code>openai/gpt-5.6-terra</code> | 0 | 0 | 0 | 102 |
| <code>openai/gpt-6-astra</code> | 0 | 0 | 0 | 102 |
| <code>openai/gpt-6-luna</code> | 0 | 0 | 0 | 102 |
| <code>openai/gpt-6.1-sol</code> | 0 | 0 | 0 | 102 |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 100.00/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0126¢ ($0.0001).
- Fastest local model: `tesseract/tesseract` at 0.48s.
- Fastest cloud service: `deepinfra/deepseek-ai/DeepSeek-V4.1-Flash` at 1.66s.

## Cost accounting

- Reported usage is valued at reviewed rates; prices include settled retry costs and retained unresolved reservations once and are not invoice-reconciled charges.
- Any settled conservative amount or retained unresolved reservation makes the price a conservative upper bound; billing uncertainty remains visible in the separate breakdown.
