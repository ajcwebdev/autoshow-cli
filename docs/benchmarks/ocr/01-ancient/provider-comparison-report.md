# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/ocr/01-ancient`
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
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0001 | 95.90 | 4.10% | 0.74% | 13.36s | $0.0001 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0004 | 72.13 | 27.87% | 3.46% | 26.53s | $0.0004 |
| 3 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0012 | 72.13 | 27.87% | 3.09% | 1.73s | $0.0012 |
| 4 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0017 | 76.23 | 23.77% | 4.08% | 7.26s | $0.0017 |
| 5 | <code>glm/glm-5.3-flash</code> | $0.0018 | 68.85 | 31.15% | 3.21% | 31.74s | $0.0018 |
| 6 | <code>openai/gpt-5.6-luna</code> | $0.0028 | 92.62 | 7.38% | 1.36% | 10.28s | $0.0028 |
| 7 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 83.61 | 16.39% | 5.93% | 1.03s | $0.0040 |
| 8 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | 64.75 | 35.25% | 8.53% | 1.34s | $0.0040 |
| 9 | <code>gemini/gemini-3.6-flash</code> | $0.0042 | 69.67 | 30.33% | 3.21% | 2.65s | $0.0042 |
| 10 | <code>gemini/gemini-3.7-flash</code> | $0.0043 | 73.77 | 26.23% | 2.72% | 2.24s | $0.0043 |
| 11 | <code>gemini/gemini-3.8-flash</code> | $0.0043 | 73.77 | 26.23% | 2.84% | 2.21s | $0.0043 |
| 12 | <code>gemini/gemini-3.5-flash</code> | $0.0046 | 98.36 | 1.64% | 0.25% | 2.57s | $0.0046 |
| 13 | <code>kimi/kimi-k2.6</code> | $0.0054 | 71.31 | 28.69% | 3.09% | 11.40s | $0.0054 |
| 14 | <code>grok/grok-4.5</code> | $0.0074 | 99.18 | 0.82% | 0.12% | 15.64s | $0.0074 |
| 15 | <code>grok/grok-4.6</code> | $0.0077 | 100.00 | 0.00% | 0.00% | 37.30s | $0.0077 |
| 16 | <code>anthropic/claude-sonnet-5</code> | $0.0147 | 98.36 | 1.64% | 0.25% | 9.13s | $0.0147 |
| 17 | <code>openai/gpt-5.6-terra</code> | $0.0218 | 73.77 | 26.23% | 3.21% | 12.69s | $0.0218 |
| 18 | <code>anthropic/claude-opus-5</code> | $0.0372 | 72.95 | 27.05% | 2.97% | 11.86s | $0.0372 |
| 19 | <code>kimi/kimi-k3</code> | $0.0444 | 83.61 | 16.39% | 1.36% | 141.00s | $0.0444 |
| 20 | <code>openai/gpt-6-astra</code> | $0.0521 | 72.95 | 27.05% | 2.84% | 7.85s | $0.0521 |
| 21 | <code>openai/gpt-5.6-sol</code> | $0.0623 | 92.62 | 7.38% | 1.98% | 18.26s | $0.0623 |
| 22 | <code>anthropic/claude-fable-5-1</code> | $0.0731 | 100.00 | 0.00% | 0.00% | 13.37s | $0.0731 |
| 23 | <code>anthropic/claude-fable-5</code> | $0.0735 | 84.43 | 15.57% | 2.84% | 17.39s | $0.0735 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-0</code> | 1.03s | 83.61 | 16.39% | 5.93% | 1.03s | $0.0040 |
| 2 | <code>mistral/mistral-ocr-4-1</code> | 1.34s | 64.75 | 35.25% | 8.53% | 1.34s | $0.0040 |
| 3 | <code>gemini/gemini-3.5-flash-lite</code> | 1.73s | 72.13 | 27.87% | 3.09% | 1.73s | $0.0012 |
| 4 | <code>gemini/gemini-3.8-flash</code> | 2.21s | 73.77 | 26.23% | 2.84% | 2.21s | $0.0043 |
| 5 | <code>gemini/gemini-3.7-flash</code> | 2.24s | 73.77 | 26.23% | 2.72% | 2.24s | $0.0043 |
| 6 | <code>gemini/gemini-3.5-flash</code> | 2.57s | 98.36 | 1.64% | 0.25% | 2.57s | $0.0046 |
| 7 | <code>gemini/gemini-3.6-flash</code> | 2.65s | 69.67 | 30.33% | 3.21% | 2.65s | $0.0042 |
| 8 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 7.26s | 76.23 | 23.77% | 4.08% | 7.26s | $0.0017 |
| 9 | <code>openai/gpt-6-astra</code> | 7.85s | 72.95 | 27.05% | 2.84% | 7.85s | $0.0521 |
| 10 | <code>anthropic/claude-sonnet-5</code> | 9.13s | 98.36 | 1.64% | 0.25% | 9.13s | $0.0147 |
| 11 | <code>openai/gpt-5.6-luna</code> | 10.28s | 92.62 | 7.38% | 1.36% | 10.28s | $0.0028 |
| 12 | <code>kimi/kimi-k2.6</code> | 11.40s | 71.31 | 28.69% | 3.09% | 11.40s | $0.0054 |
| 13 | <code>anthropic/claude-opus-5</code> | 11.86s | 72.95 | 27.05% | 2.97% | 11.86s | $0.0372 |
| 14 | <code>openai/gpt-5.6-terra</code> | 12.69s | 73.77 | 26.23% | 3.21% | 12.69s | $0.0218 |
| 15 | <code>deepinfra/google/gemma-4-31B-it</code> | 13.36s | 95.90 | 4.10% | 0.74% | 13.36s | $0.0001 |
| 16 | <code>anthropic/claude-fable-5-1</code> | 13.37s | 100.00 | 0.00% | 0.00% | 13.37s | $0.0731 |
| 17 | <code>grok/grok-4.5</code> | 15.64s | 99.18 | 0.82% | 0.12% | 15.64s | $0.0074 |
| 18 | <code>anthropic/claude-fable-5</code> | 17.39s | 84.43 | 15.57% | 2.84% | 17.39s | $0.0735 |
| 19 | <code>openai/gpt-5.6-sol</code> | 18.26s | 92.62 | 7.38% | 1.98% | 18.26s | $0.0623 |
| 20 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 26.53s | 72.13 | 27.87% | 3.46% | 26.53s | $0.0004 |
| 21 | <code>glm/glm-5.3-flash</code> | 31.74s | 68.85 | 31.15% | 3.21% | 31.74s | $0.0018 |
| 22 | <code>grok/grok-4.6</code> | 37.30s | 100.00 | 0.00% | 0.00% | 37.30s | $0.0077 |
| 23 | <code>kimi/kimi-k3</code> | 141.00s | 83.61 | 16.39% | 1.36% | 141.00s | $0.0444 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5-1</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 13.37s | $0.0731 |
| 2 | <code>grok/grok-4.6</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 37.30s | $0.0077 |
| 3 | <code>grok/grok-4.5</code> | 99.18/100 quality score | 99.18 | 0.82% | 0.12% | 15.64s | $0.0074 |
| 4 | <code>anthropic/claude-sonnet-5</code> | 98.36/100 quality score | 98.36 | 1.64% | 0.25% | 9.13s | $0.0147 |
| 5 | <code>gemini/gemini-3.5-flash</code> | 98.36/100 quality score | 98.36 | 1.64% | 0.25% | 2.57s | $0.0046 |
| 6 | <code>deepinfra/google/gemma-4-31B-it</code> | 95.90/100 quality score | 95.90 | 4.10% | 0.74% | 13.36s | $0.0001 |
| 7 | <code>openai/gpt-5.6-luna</code> | 92.62/100 quality score | 92.62 | 7.38% | 1.36% | 10.28s | $0.0028 |
| 8 | <code>openai/gpt-5.6-sol</code> | 92.62/100 quality score | 92.62 | 7.38% | 1.98% | 18.26s | $0.0623 |
| 9 | <code>anthropic/claude-fable-5</code> | 84.43/100 quality score | 84.43 | 15.57% | 2.84% | 17.39s | $0.0735 |
| 10 | <code>kimi/kimi-k3</code> | 83.61/100 quality score | 83.61 | 16.39% | 1.36% | 141.00s | $0.0444 |
| 11 | <code>mistral/mistral-ocr-4-0</code> | 83.61/100 quality score | 83.61 | 16.39% | 5.93% | 1.03s | $0.0040 |
| 12 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 76.23/100 quality score | 76.23 | 23.77% | 4.08% | 7.26s | $0.0017 |
| 13 | <code>gemini/gemini-3.7-flash</code> | 73.77/100 quality score | 73.77 | 26.23% | 2.72% | 2.24s | $0.0043 |
| 14 | <code>gemini/gemini-3.8-flash</code> | 73.77/100 quality score | 73.77 | 26.23% | 2.84% | 2.21s | $0.0043 |
| 15 | <code>openai/gpt-5.6-terra</code> | 73.77/100 quality score | 73.77 | 26.23% | 3.21% | 12.69s | $0.0218 |
| 16 | <code>openai/gpt-6-astra</code> | 72.95/100 quality score | 72.95 | 27.05% | 2.84% | 7.85s | $0.0521 |
| 17 | <code>anthropic/claude-opus-5</code> | 72.95/100 quality score | 72.95 | 27.05% | 2.97% | 11.86s | $0.0372 |
| 18 | <code>gemini/gemini-3.5-flash-lite</code> | 72.13/100 quality score | 72.13 | 27.87% | 3.09% | 1.73s | $0.0012 |
| 19 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 72.13/100 quality score | 72.13 | 27.87% | 3.46% | 26.53s | $0.0004 |
| 20 | <code>kimi/kimi-k2.6</code> | 71.31/100 quality score | 71.31 | 28.69% | 3.09% | 11.40s | $0.0054 |
| 21 | <code>gemini/gemini-3.6-flash</code> | 69.67/100 quality score | 69.67 | 30.33% | 3.21% | 2.65s | $0.0042 |
| 22 | <code>glm/glm-5.3-flash</code> | 68.85/100 quality score | 68.85 | 31.15% | 3.21% | 31.74s | $0.0018 |
| 23 | <code>mistral/mistral-ocr-4-1</code> | 64.75/100 quality score | 64.75 | 35.25% | 8.53% | 1.34s | $0.0040 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 84.43 | 15.57% | 2.84% | 17.39s | $0.0735 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 13.37s | $0.0731 |
| <code>anthropic/claude-opus-5</code> | Third-Party Service | 72.95 | 27.05% | 2.97% | 11.86s | $0.0372 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 98.36 | 1.64% | 0.25% | 9.13s | $0.0147 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | 72.13 | 27.87% | 3.46% | 26.53s | $0.0004 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | 95.90 | 4.10% | 0.74% | 13.36s | $0.0001 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | 76.23 | 23.77% | 4.08% | 7.26s | $0.0017 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 98.36 | 1.64% | 0.25% | 2.57s | $0.0046 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 72.13 | 27.87% | 3.09% | 1.73s | $0.0012 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 69.67 | 30.33% | 3.21% | 2.65s | $0.0042 |
| <code>gemini/gemini-3.7-flash</code> | Third-Party Service | 73.77 | 26.23% | 2.72% | 2.24s | $0.0043 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | 73.77 | 26.23% | 2.84% | 2.21s | $0.0043 |
| <code>glm/glm-5.3-flash</code> | Third-Party Service | 68.85 | 31.15% | 3.21% | 31.74s | $0.0018 |
| <code>grok/grok-4.5</code> | Third-Party Service | 99.18 | 0.82% | 0.12% | 15.64s | $0.0074 |
| <code>grok/grok-4.6</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 37.30s | $0.0077 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 71.31 | 28.69% | 3.09% | 11.40s | $0.0054 |
| <code>kimi/kimi-k3</code> | Third-Party Service | 83.61 | 16.39% | 1.36% | 141.00s | $0.0444 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 83.61 | 16.39% | 5.93% | 1.03s | $0.0040 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | 64.75 | 35.25% | 8.53% | 1.34s | $0.0040 |
| <code>openai/gpt-5.6-luna</code> | Third-Party Service | 92.62 | 7.38% | 1.36% | 10.28s | $0.0028 |
| <code>openai/gpt-5.6-sol</code> | Third-Party Service | 92.62 | 7.38% | 1.98% | 18.26s | $0.0623 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 73.77 | 26.23% | 3.21% | 12.69s | $0.0218 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | 72.95 | 27.05% | 2.84% | 7.85s | $0.0521 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | 19 | 0 | 0 | 122 |
| <code>anthropic/claude-fable-5-1</code> | 0 | 0 | 0 | 122 |
| <code>anthropic/claude-opus-5</code> | 20 | 0 | 13 | 122 |
| <code>anthropic/claude-sonnet-5</code> | 2 | 0 | 0 | 122 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 23 | 0 | 11 | 122 |
| <code>deepinfra/google/gemma-4-31B-it</code> | 4 | 1 | 0 | 122 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | 25 | 0 | 4 | 122 |
| <code>gemini/gemini-3.5-flash</code> | 2 | 0 | 0 | 122 |
| <code>gemini/gemini-3.5-flash-lite</code> | 21 | 1 | 12 | 122 |
| <code>gemini/gemini-3.6-flash</code> | 21 | 0 | 16 | 122 |
| <code>gemini/gemini-3.7-flash</code> | 19 | 0 | 13 | 122 |
| <code>gemini/gemini-3.8-flash</code> | 19 | 0 | 13 | 122 |
| <code>glm/glm-5.3-flash</code> | 25 | 0 | 13 | 122 |
| <code>grok/grok-4.5</code> | 1 | 0 | 0 | 122 |
| <code>grok/grok-4.6</code> | 0 | 0 | 0 | 122 |
| <code>kimi/kimi-k2.6</code> | 21 | 0 | 14 | 122 |
| <code>kimi/kimi-k3</code> | 10 | 9 | 1 | 122 |
| <code>mistral/mistral-ocr-4-0</code> | 5 | 1 | 14 | 122 |
| <code>mistral/mistral-ocr-4-1</code> | 25 | 7 | 11 | 122 |
| <code>openai/gpt-5.6-luna</code> | 9 | 0 | 0 | 122 |
| <code>openai/gpt-5.6-sol</code> | 8 | 0 | 1 | 122 |
| <code>openai/gpt-5.6-terra</code> | 20 | 0 | 12 | 122 |
| <code>openai/gpt-6-astra</code> | 19 | 1 | 13 | 122 |

## Notes

- Best cloud service: `anthropic/claude-fable-5-1` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0149¢ ($0.0001).
- Fastest cloud service: `mistral/mistral-ocr-4-0` at 1.03s.
