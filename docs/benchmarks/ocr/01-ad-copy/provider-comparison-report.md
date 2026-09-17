# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/auto/autoshow-cli/docs/benchmarks/ocr/01-ad-copy`
- Total providers: 23 (0 local, 23 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

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
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0001 | 96.83 | 3.17% | 2.56% | 6.19s | $0.0001 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0002 | 93.65 | 6.35% | 6.67% | 5.47s | $0.0002 |
| 3 | <code>glm/glm-5.3-flash</code> | $0.0004 | 95.24 | 4.76% | 4.62% | 13.00s | $0.0004 |
| 4 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0005 | 92.06 | 7.94% | 4.87% | 4.21s | $0.0005 |
| 5 | <code>openai/gpt-5.6-luna</code> | $0.0006 | 92.06 | 7.94% | 6.67% | 2.94s | $0.0006 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0008 | 85.71 | 14.29% | 11.03% | 1.34s | $0.0008 |
| 7 | <code>kimi/kimi-k2.6</code> | $0.0013 | 85.71 | 14.29% | 13.59% | 4.19s | $0.0013 |
| 8 | <code>gemini/gemini-3.6-flash</code> | $0.0029 | 95.24 | 4.76% | 2.82% | 1.96s | $0.0029 |
| 9 | <code>grok/grok-4.5</code> | $0.0029 | 98.41 | 1.59% | 2.05% | 4.76s | $0.0029 |
| 10 | <code>gemini/gemini-3.8-flash</code> | $0.0030 | 98.41 | 1.59% | 0.26% | 2.23s | $0.0030 |
| 11 | <code>gemini/gemini-3.7-flash</code> | $0.0031 | 98.41 | 1.59% | 0.26% | 2.35s | $0.0031 |
| 12 | <code>grok/grok-4.6</code> | $0.0032 | 100.00 | 0.00% | 0.00% | 2.19s | $0.0032 |
| 13 | <code>gemini/gemini-3.5-flash</code> | $0.0034 | 98.41 | 1.59% | 0.26% | 1.62s | $0.0034 |
| 14 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 80.95 | 19.05% | 15.38% | 1.44s | $0.0040 |
| 15 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 82.54 | 17.46% | 14.36% | 1.16s | $0.0040 |
| 16 | <code>openai/gpt-5.6-terra</code> | $0.0042 | 92.06 | 7.94% | 6.67% | 2.97s | $0.0042 |
| 17 | <code>anthropic/claude-sonnet-5</code> | $0.0046 | 100.00 | 0.00% | 0.00% | 5.36s | $0.0046 |
| 18 | <code>openai/gpt-5.6-sol</code> | $0.0113 | 92.06 | 7.94% | 6.67% | 5.35s | $0.0113 |
| 19 | <code>anthropic/claude-opus-5</code> | $0.0114 | 100.00 | 0.00% | 0.00% | 4.88s | $0.0114 |
| 20 | <code>openai/gpt-6-astra</code> | $0.0163 | 98.41 | 1.59% | 0.26% | 4.43s | $0.0163 |
| 21 | <code>anthropic/claude-fable-5-1</code> | $0.0225 | 98.41 | 1.59% | 0.26% | 5.64s | $0.0225 |
| 22 | <code>anthropic/claude-fable-5</code> | $0.0226 | 95.24 | 4.76% | 4.62% | 7.16s | $0.0226 |
| 23 | <code>kimi/kimi-k3</code> | $0.0314 | 98.41 | 1.59% | 0.26% | 64.22s | $0.0314 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-1</code> | 1.16s | 82.54 | 17.46% | 14.36% | 1.16s | $0.0040 |
| 2 | <code>gemini/gemini-3.5-flash-lite</code> | 1.34s | 85.71 | 14.29% | 11.03% | 1.34s | $0.0008 |
| 3 | <code>mistral/mistral-ocr-4-0</code> | 1.44s | 80.95 | 19.05% | 15.38% | 1.44s | $0.0040 |
| 4 | <code>gemini/gemini-3.5-flash</code> | 1.62s | 98.41 | 1.59% | 0.26% | 1.62s | $0.0034 |
| 5 | <code>gemini/gemini-3.6-flash</code> | 1.96s | 95.24 | 4.76% | 2.82% | 1.96s | $0.0029 |
| 6 | <code>grok/grok-4.6</code> | 2.19s | 100.00 | 0.00% | 0.00% | 2.19s | $0.0032 |
| 7 | <code>gemini/gemini-3.8-flash</code> | 2.23s | 98.41 | 1.59% | 0.26% | 2.23s | $0.0030 |
| 8 | <code>gemini/gemini-3.7-flash</code> | 2.35s | 98.41 | 1.59% | 0.26% | 2.35s | $0.0031 |
| 9 | <code>openai/gpt-5.6-luna</code> | 2.94s | 92.06 | 7.94% | 6.67% | 2.94s | $0.0006 |
| 10 | <code>openai/gpt-5.6-terra</code> | 2.97s | 92.06 | 7.94% | 6.67% | 2.97s | $0.0042 |
| 11 | <code>kimi/kimi-k2.6</code> | 4.19s | 85.71 | 14.29% | 13.59% | 4.19s | $0.0013 |
| 12 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 4.21s | 92.06 | 7.94% | 4.87% | 4.21s | $0.0005 |
| 13 | <code>openai/gpt-6-astra</code> | 4.43s | 98.41 | 1.59% | 0.26% | 4.43s | $0.0163 |
| 14 | <code>grok/grok-4.5</code> | 4.76s | 98.41 | 1.59% | 2.05% | 4.76s | $0.0029 |
| 15 | <code>anthropic/claude-opus-5</code> | 4.88s | 100.00 | 0.00% | 0.00% | 4.88s | $0.0114 |
| 16 | <code>openai/gpt-5.6-sol</code> | 5.35s | 92.06 | 7.94% | 6.67% | 5.35s | $0.0113 |
| 17 | <code>anthropic/claude-sonnet-5</code> | 5.36s | 100.00 | 0.00% | 0.00% | 5.36s | $0.0046 |
| 18 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 5.47s | 93.65 | 6.35% | 6.67% | 5.47s | $0.0002 |
| 19 | <code>anthropic/claude-fable-5-1</code> | 5.64s | 98.41 | 1.59% | 0.26% | 5.64s | $0.0225 |
| 20 | <code>deepinfra/google/gemma-4-31B-it</code> | 6.19s | 96.83 | 3.17% | 2.56% | 6.19s | $0.0001 |
| 21 | <code>anthropic/claude-fable-5</code> | 7.16s | 95.24 | 4.76% | 4.62% | 7.16s | $0.0226 |
| 22 | <code>glm/glm-5.3-flash</code> | 13.00s | 95.24 | 4.76% | 4.62% | 13.00s | $0.0004 |
| 23 | <code>kimi/kimi-k3</code> | 64.22s | 98.41 | 1.59% | 0.26% | 64.22s | $0.0314 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-opus-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.88s | $0.0114 |
| 2 | <code>anthropic/claude-sonnet-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.36s | $0.0046 |
| 3 | <code>grok/grok-4.6</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.19s | $0.0032 |
| 4 | <code>anthropic/claude-fable-5-1</code> | 98.41/100 quality score | 98.41 | 1.59% | 0.26% | 5.64s | $0.0225 |
| 5 | <code>gemini/gemini-3.5-flash</code> | 98.41/100 quality score | 98.41 | 1.59% | 0.26% | 1.62s | $0.0034 |
| 6 | <code>gemini/gemini-3.7-flash</code> | 98.41/100 quality score | 98.41 | 1.59% | 0.26% | 2.35s | $0.0031 |
| 7 | <code>gemini/gemini-3.8-flash</code> | 98.41/100 quality score | 98.41 | 1.59% | 0.26% | 2.23s | $0.0030 |
| 8 | <code>kimi/kimi-k3</code> | 98.41/100 quality score | 98.41 | 1.59% | 0.26% | 64.22s | $0.0314 |
| 9 | <code>openai/gpt-6-astra</code> | 98.41/100 quality score | 98.41 | 1.59% | 0.26% | 4.43s | $0.0163 |
| 10 | <code>grok/grok-4.5</code> | 98.41/100 quality score | 98.41 | 1.59% | 2.05% | 4.76s | $0.0029 |
| 11 | <code>deepinfra/google/gemma-4-31B-it</code> | 96.83/100 quality score | 96.83 | 3.17% | 2.56% | 6.19s | $0.0001 |
| 12 | <code>gemini/gemini-3.6-flash</code> | 95.24/100 quality score | 95.24 | 4.76% | 2.82% | 1.96s | $0.0029 |
| 13 | <code>anthropic/claude-fable-5</code> | 95.24/100 quality score | 95.24 | 4.76% | 4.62% | 7.16s | $0.0226 |
| 14 | <code>glm/glm-5.3-flash</code> | 95.24/100 quality score | 95.24 | 4.76% | 4.62% | 13.00s | $0.0004 |
| 15 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 93.65/100 quality score | 93.65 | 6.35% | 6.67% | 5.47s | $0.0002 |
| 16 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 92.06/100 quality score | 92.06 | 7.94% | 4.87% | 4.21s | $0.0005 |
| 17 | <code>openai/gpt-5.6-luna</code> | 92.06/100 quality score | 92.06 | 7.94% | 6.67% | 2.94s | $0.0006 |
| 18 | <code>openai/gpt-5.6-sol</code> | 92.06/100 quality score | 92.06 | 7.94% | 6.67% | 5.35s | $0.0113 |
| 19 | <code>openai/gpt-5.6-terra</code> | 92.06/100 quality score | 92.06 | 7.94% | 6.67% | 2.97s | $0.0042 |
| 20 | <code>gemini/gemini-3.5-flash-lite</code> | 85.71/100 quality score | 85.71 | 14.29% | 11.03% | 1.34s | $0.0008 |
| 21 | <code>kimi/kimi-k2.6</code> | 85.71/100 quality score | 85.71 | 14.29% | 13.59% | 4.19s | $0.0013 |
| 22 | <code>mistral/mistral-ocr-4-1</code> | 82.54/100 quality score | 82.54 | 17.46% | 14.36% | 1.16s | $0.0040 |
| 23 | <code>mistral/mistral-ocr-4-0</code> | 80.95/100 quality score | 80.95 | 19.05% | 15.38% | 1.44s | $0.0040 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 95.24 | 4.76% | 4.62% | 7.16s | $0.0226 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 98.41 | 1.59% | 0.26% | 5.64s | $0.0225 |
| <code>anthropic/claude-opus-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.88s | $0.0114 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.36s | $0.0046 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 93.65 | 6.35% | 6.67% | 5.47s | $0.0002 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 96.83 | 3.17% | 2.56% | 6.19s | $0.0001 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 92.06 | 7.94% | 4.87% | 4.21s | $0.0005 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 98.41 | 1.59% | 0.26% | 1.62s | $0.0034 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 85.71 | 14.29% | 11.03% | 1.34s | $0.0008 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 95.24 | 4.76% | 2.82% | 1.96s | $0.0029 |
| <code>gemini/gemini-3.7-flash</code> | Third-Party Service | 98.41 | 1.59% | 0.26% | 2.35s | $0.0031 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 98.41 | 1.59% | 0.26% | 2.23s | $0.0030 |
| <code>glm/glm-5.3-flash</code> | Third-Party Service | 95.24 | 4.76% | 4.62% | 13.00s | $0.0004 |
| <code>grok/grok-4.5</code> | Third-Party Service | 98.41 | 1.59% | 2.05% | 4.76s | $0.0029 |
| <code>grok/grok-4.6</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.19s | $0.0032 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 85.71 | 14.29% | 13.59% | 4.19s | $0.0013 |
| <code>kimi/kimi-k3</code> | Third-Party Service | 98.41 | 1.59% | 0.26% | 64.22s | $0.0314 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 80.95 | 19.05% | 15.38% | 1.44s | $0.0040 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 82.54 | 17.46% | 14.36% | 1.16s | $0.0040 |
| <code>openai/gpt-5.6-luna</code> | Third-Party Service | 92.06 | 7.94% | 6.67% | 2.94s | $0.0006 |
| <code>openai/gpt-5.6-sol</code> | Third-Party Service | 92.06 | 7.94% | 6.67% | 5.35s | $0.0113 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 92.06 | 7.94% | 6.67% | 2.97s | $0.0042 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 98.41 | 1.59% | 0.26% | 4.43s | $0.0163 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | 0 | 2 | 1 | 63 |
| <code>anthropic/claude-fable-5-1</code> | 1 | 0 | 0 | 63 |
| <code>anthropic/claude-opus-5</code> | 0 | 0 | 0 | 63 |
| <code>anthropic/claude-sonnet-5</code> | 0 | 0 | 0 | 63 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 1 | 1 | 2 | 63 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 0 | 1 | 1 | 63 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 1 | 2 | 2 | 63 |
| <code>gemini/gemini-3.5-flash</code> | 1 | 0 | 0 | 63 |
| <code>gemini/gemini-3.5-flash-lite</code> | 1 | 4 | 4 | 63 |
| <code>gemini/gemini-3.6-flash</code> | 1 | 1 | 1 | 63 |
| <code>gemini/gemini-3.7-flash</code> | 1 | 0 | 0 | 63 |
| <code>gemini/gemini-3.8-flash</code> | 1 | 0 | 0 | 63 |
| <code>glm/glm-5.3-flash</code> | 0 | 2 | 1 | 63 |
| <code>grok/grok-4.5</code> | 0 | 1 | 0 | 63 |
| <code>grok/grok-4.6</code> | 0 | 0 | 0 | 63 |
| <code>kimi/kimi-k2.6</code> | 1 | 4 | 4 | 63 |
| <code>kimi/kimi-k3</code> | 1 | 0 | 0 | 63 |
| <code>mistral/mistral-ocr-4-0</code> | 8 | 2 | 2 | 63 |
| <code>mistral/mistral-ocr-4-1</code> | 6 | 4 | 1 | 63 |
| <code>openai/gpt-5.6-luna</code> | 0 | 3 | 2 | 63 |
| <code>openai/gpt-5.6-sol</code> | 0 | 3 | 2 | 63 |
| <code>openai/gpt-5.6-terra</code> | 0 | 3 | 2 | 63 |
| <code>openai/gpt-6-astra</code> | 1 | 0 | 0 | 63 |

## Notes

- Best cloud service: `anthropic/claude-opus-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0088¢ ($0.0001).
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.16s.
