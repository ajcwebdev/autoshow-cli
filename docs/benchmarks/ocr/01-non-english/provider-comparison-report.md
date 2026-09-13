# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/auto/autoshow-cli/docs/benchmarks/ocr/01-non-english`
- Total providers: 19 (0 local, 19 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- Page-level metrics used by the combined report are retained in `page-metrics.json`.

## Method

- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0022 | 100.00 | 0.00% | 0.45% | 2.69s | $0.0022 |
| 2 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 76.92 | 23.08% | 2.20% | 1.54s | $0.0040 |
| 3 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 96.15 | 3.85% | 0.15% | 1.78s | $0.0040 |
| 4 | <code>openai/gpt-5.6-luna</code> | $0.0047 | 65.38 | 34.62% | 32.65% | 16.41s | $0.0047 |
| 5 | <code>kimi/kimi-k2.6</code> | $0.0050 | 92.31 | 7.69% | 5.91% | 20.13s | $0.0050 |
| 6 | <code>grok/grok-4.6</code> | $0.0069 | 53.85 | 46.15% | 24.70% | 62.57s | $0.0069 |
| 7 | <code>grok/grok-4.5</code> | $0.0070 | 73.08 | 26.92% | 11.36% | 26.20s | $0.0070 |
| 8 | <code>gemini/gemini-3.8-flash</code> | $0.0073 | 100.00 | 0.00% | 0.76% | 3.00s | $0.0073 |
| 9 | <code>gemini/gemini-3.6-flash</code> | $0.0075 | 100.00 | 0.00% | 0.98% | 4.30s | $0.0075 |
| 10 | <code>gemini/gemini-3.5-flash</code> | $0.0088 | 100.00 | 0.00% | 1.14% | 3.78s | $0.0088 |
| 11 | <code>gemini/gemini-3.7-flash</code> | $0.0153 | 100.00 | 0.00% | 0.15% | 5.03s | $0.0153 |
| 12 | <code>anthropic/claude-sonnet-5</code> | $0.0163 | 61.54 | 38.46% | 33.33% | 22.15s | $0.0163 |
| 13 | <code>openai/gpt-5.6-terra</code> | $0.0258 | 69.23 | 30.77% | 25.76% | 12.58s | $0.0258 |
| 14 | <code>anthropic/claude-opus-5</code> | $0.0354 | 76.92 | 23.08% | 42.80% | 22.25s | $0.0354 |
| 15 | <code>kimi/kimi-k3</code> | $0.0399 | 100.00 | 0.00% | 0.08% | 170.14s | $0.0399 |
| 16 | <code>anthropic/claude-fable-5-1</code> | $0.0766 | 100.00 | 0.00% | 0.30% | 22.36s | $0.0766 |
| 17 | <code>openai/gpt-5.6-sol</code> | $0.1351 | 96.15 | 3.85% | 7.95% | 38.57s | $0.1351 |
| 18 | <code>anthropic/claude-fable-5</code> | $0.1391 | 100.00 | 0.00% | 0.00% | 31.52s | $0.1391 |
| 19 | <code>openai/gpt-6-astra</code> | $0.1640 | 100.00 | 0.00% | 0.08% | 31.88s | $0.1640 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-0</code> | 1.54s | 76.92 | 23.08% | 2.20% | 1.54s | $0.0040 |
| 2 | <code>mistral/mistral-ocr-4-1</code> | 1.78s | 96.15 | 3.85% | 0.15% | 1.78s | $0.0040 |
| 3 | <code>gemini/gemini-3.5-flash-lite</code> | 2.69s | 100.00 | 0.00% | 0.45% | 2.69s | $0.0022 |
| 4 | <code>gemini/gemini-3.8-flash</code> | 3.00s | 100.00 | 0.00% | 0.76% | 3.00s | $0.0073 |
| 5 | <code>gemini/gemini-3.5-flash</code> | 3.78s | 100.00 | 0.00% | 1.14% | 3.78s | $0.0088 |
| 6 | <code>gemini/gemini-3.6-flash</code> | 4.30s | 100.00 | 0.00% | 0.98% | 4.30s | $0.0075 |
| 7 | <code>gemini/gemini-3.7-flash</code> | 5.03s | 100.00 | 0.00% | 0.15% | 5.03s | $0.0153 |
| 8 | <code>openai/gpt-5.6-terra</code> | 12.58s | 69.23 | 30.77% | 25.76% | 12.58s | $0.0258 |
| 9 | <code>openai/gpt-5.6-luna</code> | 16.41s | 65.38 | 34.62% | 32.65% | 16.41s | $0.0047 |
| 10 | <code>kimi/kimi-k2.6</code> | 20.13s | 92.31 | 7.69% | 5.91% | 20.13s | $0.0050 |
| 11 | <code>anthropic/claude-sonnet-5</code> | 22.15s | 61.54 | 38.46% | 33.33% | 22.15s | $0.0163 |
| 12 | <code>anthropic/claude-opus-5</code> | 22.25s | 76.92 | 23.08% | 42.80% | 22.25s | $0.0354 |
| 13 | <code>anthropic/claude-fable-5-1</code> | 22.36s | 100.00 | 0.00% | 0.30% | 22.36s | $0.0766 |
| 14 | <code>grok/grok-4.5</code> | 26.20s | 73.08 | 26.92% | 11.36% | 26.20s | $0.0070 |
| 15 | <code>anthropic/claude-fable-5</code> | 31.52s | 100.00 | 0.00% | 0.00% | 31.52s | $0.1391 |
| 16 | <code>openai/gpt-6-astra</code> | 31.88s | 100.00 | 0.00% | 0.08% | 31.88s | $0.1640 |
| 17 | <code>openai/gpt-5.6-sol</code> | 38.57s | 96.15 | 3.85% | 7.95% | 38.57s | $0.1351 |
| 18 | <code>grok/grok-4.6</code> | 62.57s | 53.85 | 46.15% | 24.70% | 62.57s | $0.0069 |
| 19 | <code>kimi/kimi-k3</code> | 170.14s | 100.00 | 0.00% | 0.08% | 170.14s | $0.0399 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 31.52s | $0.1391 |
| 2 | <code>kimi/kimi-k3</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.08% | 170.14s | $0.0399 |
| 3 | <code>openai/gpt-6-astra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.08% | 31.88s | $0.1640 |
| 4 | <code>gemini/gemini-3.7-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.15% | 5.03s | $0.0153 |
| 5 | <code>anthropic/claude-fable-5-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.30% | 22.36s | $0.0766 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.45% | 2.69s | $0.0022 |
| 7 | <code>gemini/gemini-3.8-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.76% | 3.00s | $0.0073 |
| 8 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.98% | 4.30s | $0.0075 |
| 9 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 1.14% | 3.78s | $0.0088 |
| 10 | <code>mistral/mistral-ocr-4-1</code> | 96.15/100 quality score | 96.15 | 3.85% | 0.15% | 1.78s | $0.0040 |
| 11 | <code>openai/gpt-5.6-sol</code> | 96.15/100 quality score | 96.15 | 3.85% | 7.95% | 38.57s | $0.1351 |
| 12 | <code>kimi/kimi-k2.6</code> | 92.31/100 quality score | 92.31 | 7.69% | 5.91% | 20.13s | $0.0050 |
| 13 | <code>mistral/mistral-ocr-4-0</code> | 76.92/100 quality score | 76.92 | 23.08% | 2.20% | 1.54s | $0.0040 |
| 14 | <code>anthropic/claude-opus-5</code> | 76.92/100 quality score | 76.92 | 23.08% | 42.80% | 22.25s | $0.0354 |
| 15 | <code>grok/grok-4.5</code> | 73.08/100 quality score | 73.08 | 26.92% | 11.36% | 26.20s | $0.0070 |
| 16 | <code>openai/gpt-5.6-terra</code> | 69.23/100 quality score | 69.23 | 30.77% | 25.76% | 12.58s | $0.0258 |
| 17 | <code>openai/gpt-5.6-luna</code> | 65.38/100 quality score | 65.38 | 34.62% | 32.65% | 16.41s | $0.0047 |
| 18 | <code>anthropic/claude-sonnet-5</code> | 61.54/100 quality score | 61.54 | 38.46% | 33.33% | 22.15s | $0.0163 |
| 19 | <code>grok/grok-4.6</code> | 53.85/100 quality score | 53.85 | 46.15% | 24.70% | 62.57s | $0.0069 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 31.52s | $0.1391 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 100.00 | 0.00% | 0.30% | 22.36s | $0.0766 |
| <code>anthropic/claude-opus-5</code> | Third-Party Service | 76.92 | 23.08% | 42.80% | 22.25s | $0.0354 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 61.54 | 38.46% | 33.33% | 22.15s | $0.0163 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 1.14% | 3.78s | $0.0088 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.45% | 2.69s | $0.0022 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.98% | 4.30s | $0.0075 |
| <code>gemini/gemini-3.7-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.15% | 5.03s | $0.0153 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.76% | 3.00s | $0.0073 |
| <code>grok/grok-4.5</code> | Third-Party Service | 73.08 | 26.92% | 11.36% | 26.20s | $0.0070 |
| <code>grok/grok-4.6</code> | Third-Party Service | 53.85 | 46.15% | 24.70% | 62.57s | $0.0069 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 92.31 | 7.69% | 5.91% | 20.13s | $0.0050 |
| <code>kimi/kimi-k3</code> | Third-Party Service | 100.00 | 0.00% | 0.08% | 170.14s | $0.0399 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 76.92 | 23.08% | 2.20% | 1.54s | $0.0040 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 96.15 | 3.85% | 0.15% | 1.78s | $0.0040 |
| <code>openai/gpt-5.6-luna</code> | Third-Party Service | 65.38 | 34.62% | 32.65% | 16.41s | $0.0047 |
| <code>openai/gpt-5.6-sol</code> | Third-Party Service | 96.15 | 3.85% | 7.95% | 38.57s | $0.1351 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 69.23 | 30.77% | 25.76% | 12.58s | $0.0258 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 100.00 | 0.00% | 0.08% | 31.88s | $0.1640 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 0 | 26 |
| <code>anthropic/claude-fable-5-1</code> | 0 | 0 | 0 | 26 |
| <code>anthropic/claude-opus-5</code> | 6 | 0 | 0 | 26 |
| <code>anthropic/claude-sonnet-5</code> | 0 | 4 | 6 | 26 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 26 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 26 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 26 |
| <code>gemini/gemini-3.7-flash</code> | 0 | 0 | 0 | 26 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 0 | 0 | 26 |
| <code>grok/grok-4.5</code> | 3 | 4 | 0 | 26 |
| <code>grok/grok-4.6</code> | 3 | 6 | 3 | 26 |
| <code>kimi/kimi-k2.6</code> | 2 | 0 | 0 | 26 |
| <code>kimi/kimi-k3</code> | 0 | 0 | 0 | 26 |
| <code>mistral/mistral-ocr-4-0</code> | 2 | 4 | 0 | 26 |
| <code>mistral/mistral-ocr-4-1</code> | 1 | 0 | 0 | 26 |
| <code>openai/gpt-5.6-luna</code> | 3 | 6 | 0 | 26 |
| <code>openai/gpt-5.6-sol</code> | 0 | 1 | 0 | 26 |
| <code>openai/gpt-5.6-terra</code> | 6 | 2 | 0 | 26 |
| <code>openai/gpt-6-astra</code> | 0 | 0 | 0 | 26 |

## Notes

- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `gemini/gemini-3.5-flash-lite` at 0.2176¢ ($0.0022).
- Fastest cloud service: `mistral/mistral-ocr-4-0` at 1.54s.
