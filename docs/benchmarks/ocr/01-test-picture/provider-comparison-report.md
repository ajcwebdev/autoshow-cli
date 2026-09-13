# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/auto/autoshow-cli/docs/benchmarks/ocr/01-test-picture`
- Total providers: 21 (0 local, 21 third-party service)
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
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0001 | 100.00 | 0.00% | 0.00% | 2.25s | $0.0001 |
| 2 | <code>glm/glm-5.3-flash</code> | $0.0002 | 100.00 | 0.00% | 0.00% | 3.35s | $0.0002 |
| 3 | <code>openai/gpt-5.6-luna</code> | $0.0003 | 100.00 | 0.00% | 0.00% | 1.03s | $0.0003 |
| 4 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0005 | 100.00 | 0.00% | 0.00% | 0.91s | $0.0005 |
| 5 | <code>kimi/kimi-k2.6</code> | $0.0014 | 100.00 | 0.00% | 0.00% | 2.81s | $0.0014 |
| 6 | <code>gemini/gemini-3.5-flash</code> | $0.0022 | 100.00 | 0.00% | 0.00% | 1.28s | $0.0022 |
| 7 | <code>gemini/gemini-3.6-flash</code> | $0.0023 | 100.00 | 0.00% | 0.00% | 1.14s | $0.0023 |
| 8 | <code>openai/gpt-5.6-terra</code> | $0.0028 | 100.00 | 0.00% | 0.00% | 1.07s | $0.0028 |
| 9 | <code>gemini/gemini-3.8-flash</code> | $0.0028 | 100.00 | 0.00% | 0.00% | 2.09s | $0.0028 |
| 10 | <code>grok/grok-4.5</code> | $0.0032 | 100.00 | 0.00% | 0.00% | 2.22s | $0.0032 |
| 11 | <code>gemini/gemini-3.7-flash</code> | $0.0032 | 100.00 | 0.00% | 0.00% | 1.80s | $0.0032 |
| 12 | <code>grok/grok-4.6</code> | $0.0035 | 100.00 | 0.00% | 0.00% | 3.30s | $0.0035 |
| 13 | <code>anthropic/claude-sonnet-5</code> | $0.0038 | 100.00 | 0.00% | 0.00% | 1.79s | $0.0038 |
| 14 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 100.00 | 0.00% | 0.00% | 0.60s | $0.0040 |
| 15 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 100.00 | 0.00% | 0.00% | 0.58s | $0.0040 |
| 16 | <code>openai/gpt-5.6-sol</code> | $0.0070 | 100.00 | 0.00% | 0.00% | 1.43s | $0.0070 |
| 17 | <code>kimi/kimi-k3</code> | $0.0082 | 100.00 | 0.00% | 0.00% | 13.05s | $0.0082 |
| 18 | <code>anthropic/claude-opus-5</code> | $0.0095 | 100.00 | 0.00% | 0.00% | 1.98s | $0.0095 |
| 19 | <code>openai/gpt-6-astra</code> | $0.0137 | 100.00 | 0.00% | 0.00% | 1.94s | $0.0137 |
| 20 | <code>anthropic/claude-fable-5</code> | $0.0189 | 100.00 | 0.00% | 0.00% | 3.77s | $0.0189 |
| 21 | <code>anthropic/claude-fable-5-1</code> | $0.0189 | 100.00 | 0.00% | 0.00% | 2.73s | $0.0189 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-1</code> | 0.58s | 100.00 | 0.00% | 0.00% | 0.58s | $0.0040 |
| 2 | <code>mistral/mistral-ocr-4-0</code> | 0.60s | 100.00 | 0.00% | 0.00% | 0.60s | $0.0040 |
| 3 | <code>gemini/gemini-3.5-flash-lite</code> | 0.91s | 100.00 | 0.00% | 0.00% | 0.91s | $0.0005 |
| 4 | <code>openai/gpt-5.6-luna</code> | 1.03s | 100.00 | 0.00% | 0.00% | 1.03s | $0.0003 |
| 5 | <code>openai/gpt-5.6-terra</code> | 1.07s | 100.00 | 0.00% | 0.00% | 1.07s | $0.0028 |
| 6 | <code>gemini/gemini-3.6-flash</code> | 1.14s | 100.00 | 0.00% | 0.00% | 1.14s | $0.0023 |
| 7 | <code>gemini/gemini-3.5-flash</code> | 1.28s | 100.00 | 0.00% | 0.00% | 1.28s | $0.0022 |
| 8 | <code>openai/gpt-5.6-sol</code> | 1.43s | 100.00 | 0.00% | 0.00% | 1.43s | $0.0070 |
| 9 | <code>anthropic/claude-sonnet-5</code> | 1.79s | 100.00 | 0.00% | 0.00% | 1.79s | $0.0038 |
| 10 | <code>gemini/gemini-3.7-flash</code> | 1.80s | 100.00 | 0.00% | 0.00% | 1.80s | $0.0032 |
| 11 | <code>openai/gpt-6-astra</code> | 1.94s | 100.00 | 0.00% | 0.00% | 1.94s | $0.0137 |
| 12 | <code>anthropic/claude-opus-5</code> | 1.98s | 100.00 | 0.00% | 0.00% | 1.98s | $0.0095 |
| 13 | <code>gemini/gemini-3.8-flash</code> | 2.09s | 100.00 | 0.00% | 0.00% | 2.09s | $0.0028 |
| 14 | <code>grok/grok-4.5</code> | 2.22s | 100.00 | 0.00% | 0.00% | 2.22s | $0.0032 |
| 15 | <code>deepinfra/google/gemma-4-31B-it</code> | 2.25s | 100.00 | 0.00% | 0.00% | 2.25s | $0.0001 |
| 16 | <code>anthropic/claude-fable-5-1</code> | 2.73s | 100.00 | 0.00% | 0.00% | 2.73s | $0.0189 |
| 17 | <code>kimi/kimi-k2.6</code> | 2.81s | 100.00 | 0.00% | 0.00% | 2.81s | $0.0014 |
| 18 | <code>grok/grok-4.6</code> | 3.30s | 100.00 | 0.00% | 0.00% | 3.30s | $0.0035 |
| 19 | <code>glm/glm-5.3-flash</code> | 3.35s | 100.00 | 0.00% | 0.00% | 3.35s | $0.0002 |
| 20 | <code>anthropic/claude-fable-5</code> | 3.77s | 100.00 | 0.00% | 0.00% | 3.77s | $0.0189 |
| 21 | <code>kimi/kimi-k3</code> | 13.05s | 100.00 | 0.00% | 0.00% | 13.05s | $0.0082 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.77s | $0.0189 |
| 2 | <code>anthropic/claude-fable-5-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.73s | $0.0189 |
| 3 | <code>anthropic/claude-opus-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.98s | $0.0095 |
| 4 | <code>anthropic/claude-sonnet-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.79s | $0.0038 |
| 5 | <code>deepinfra/google/gemma-4-31B-it</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.25s | $0.0001 |
| 6 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.28s | $0.0022 |
| 7 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.91s | $0.0005 |
| 8 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.14s | $0.0023 |
| 9 | <code>gemini/gemini-3.7-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.80s | $0.0032 |
| 10 | <code>gemini/gemini-3.8-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.09s | $0.0028 |
| 11 | <code>glm/glm-5.3-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.35s | $0.0002 |
| 12 | <code>grok/grok-4.5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.22s | $0.0032 |
| 13 | <code>grok/grok-4.6</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.30s | $0.0035 |
| 14 | <code>kimi/kimi-k2.6</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.81s | $0.0014 |
| 15 | <code>kimi/kimi-k3</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 13.05s | $0.0082 |
| 16 | <code>mistral/mistral-ocr-4-0</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.60s | $0.0040 |
| 17 | <code>mistral/mistral-ocr-4-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.58s | $0.0040 |
| 18 | <code>openai/gpt-5.6-luna</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.03s | $0.0003 |
| 19 | <code>openai/gpt-5.6-sol</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.43s | $0.0070 |
| 20 | <code>openai/gpt-5.6-terra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.07s | $0.0028 |
| 21 | <code>openai/gpt-6-astra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.94s | $0.0137 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.77s | $0.0189 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.73s | $0.0189 |
| <code>anthropic/claude-opus-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.98s | $0.0095 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.79s | $0.0038 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.25s | $0.0001 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.28s | $0.0022 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 0.91s | $0.0005 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.14s | $0.0023 |
| <code>gemini/gemini-3.7-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.80s | $0.0032 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.09s | $0.0028 |
| <code>glm/glm-5.3-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.35s | $0.0002 |
| <code>grok/grok-4.5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.22s | $0.0032 |
| <code>grok/grok-4.6</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.30s | $0.0035 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.81s | $0.0014 |
| <code>kimi/kimi-k3</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 13.05s | $0.0082 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 0.60s | $0.0040 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 0.58s | $0.0040 |
| <code>openai/gpt-5.6-luna</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.03s | $0.0003 |
| <code>openai/gpt-5.6-sol</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.43s | $0.0070 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.07s | $0.0028 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.94s | $0.0137 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 0 | 20 |
| <code>anthropic/claude-fable-5-1</code> | 0 | 0 | 0 | 20 |
| <code>anthropic/claude-opus-5</code> | 0 | 0 | 0 | 20 |
| <code>anthropic/claude-sonnet-5</code> | 0 | 0 | 0 | 20 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 0 | 0 | 0 | 20 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 20 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 20 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 20 |
| <code>gemini/gemini-3.7-flash</code> | 0 | 0 | 0 | 20 |
| <code>gemini/gemini-3.8-flash</code> | 0 | 0 | 0 | 20 |
| <code>glm/glm-5.3-flash</code> | 0 | 0 | 0 | 20 |
| <code>grok/grok-4.5</code> | 0 | 0 | 0 | 20 |
| <code>grok/grok-4.6</code> | 0 | 0 | 0 | 20 |
| <code>kimi/kimi-k2.6</code> | 0 | 0 | 0 | 20 |
| <code>kimi/kimi-k3</code> | 0 | 0 | 0 | 20 |
| <code>mistral/mistral-ocr-4-0</code> | 0 | 0 | 0 | 20 |
| <code>mistral/mistral-ocr-4-1</code> | 0 | 0 | 0 | 20 |
| <code>openai/gpt-5.6-luna</code> | 0 | 0 | 0 | 20 |
| <code>openai/gpt-5.6-sol</code> | 0 | 0 | 0 | 20 |
| <code>openai/gpt-5.6-terra</code> | 0 | 0 | 0 | 20 |
| <code>openai/gpt-6-astra</code> | 0 | 0 | 0 | 20 |

## Notes

- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0055¢ ($0.0001).
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 0.58s.
