# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/01-medieval`
- Total providers: 28 (0 local, 28 third-party service)
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
| 1 | <code>glm/glm-ocr</code> | $0.0000 | 85.32 | 14.68% | 3.62% | 2.22s | $0.0000 |
| 2 | <code>deepinfra/google/gemma-3-27b-it</code> | $0.0001 | 94.50 | 5.50% | 0.67% | 10.84s | $0.0001 |
| 3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0002 | 96.33 | 3.67% | 1.43% | 3.98s | $0.0002 |
| 4 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | $0.0003 | 96.33 | 3.67% | 1.01% | 5.49s | $0.0003 |
| 5 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0004 | 94.50 | 5.50% | 0.76% | 12.04s | $0.0004 |
| 6 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0005 | 94.95 | 5.05% | 0.59% | 18.46s | $0.0005 |
| 7 | <code>openai/gpt-5.4-nano</code> | $0.0007 | 80.28 | 19.72% | 8.33% | 2.69s | $0.0007 |
| 8 | <code>openai/gpt-5.6-luna</code> | $0.0013 | 94.50 | 5.50% | 1.09% | 4.98s | $0.0013 |
| 9 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0014 | 96.33 | 3.67% | 0.34% | 2.08s | $0.0014 |
| 10 | <code>mistral/mistral-ocr-2512</code> | $0.0020 | 97.71 | 2.29% | 0.42% | 2.05s | $0.0020 |
| 11 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0022 | 99.54 | 0.46% | 0.08% | 4.46s | $0.0022 |
| 12 | <code>grok/grok-4.3</code> | $0.0022 | 100.00 | 0.00% | 0.00% | 8.92s | $0.0022 |
| 13 | <code>openai/gpt-5.4-mini</code> | $0.0024 | 93.58 | 6.42% | 1.51% | 1.93s | $0.0024 |
| 14 | <code>kimi/kimi-k2.6</code> | $0.0029 | 95.41 | 4.59% | 0.42% | 11.49s | $0.0029 |
| 15 | <code>anthropic/claude-haiku-4-5</code> | $0.0038 | 92.20 | 7.80% | 2.44% | 23.22s | $0.0038 |
| 16 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 98.17 | 1.83% | 0.34% | 1.44s | $0.0040 |
| 17 | <code>gemini/gemini-3.6-flash</code> | $0.0045 | 100.00 | 0.00% | 0.00% | 2.40s | $0.0045 |
| 18 | <code>grok/grok-4.5</code> | $0.0049 | 95.87 | 4.13% | 0.42% | 15.98s | $0.0049 |
| 19 | <code>gemini/gemini-3.5-flash</code> | $0.0054 | 96.33 | 3.67% | 0.34% | 2.83s | $0.0054 |
| 20 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0072 | 96.33 | 3.67% | 0.34% | 4.78s | $0.0072 |
| 21 | <code>anthropic/claude-sonnet-5</code> | $0.0096 | 96.33 | 3.67% | 0.34% | 11.74s | $0.0096 |
| 22 | <code>openai/gpt-5.6-terra</code> | $0.0184 | 93.12 | 6.88% | 1.77% | 11.82s | $0.0184 |
| 23 | <code>anthropic/claude-opus-5</code> | $0.0225 | 99.54 | 0.46% | 0.08% | 12.39s | $0.0225 |
| 24 | <code>anthropic/claude-opus-4-8</code> | $0.0238 | 95.41 | 4.59% | 0.42% | 13.48s | $0.0238 |
| 25 | <code>openai/gpt-5.5</code> | $0.0299 | 96.33 | 3.67% | 0.34% | 8.38s | $0.0299 |
| 26 | <code>openai/gpt-5.6-sol</code> | $0.0470 | 96.33 | 3.67% | 0.34% | 14.48s | $0.0470 |
| 27 | <code>anthropic/claude-fable-5</code> | $0.0485 | 96.33 | 3.67% | 0.34% | 12.47s | $0.0485 |
| 28 | <code>kimi/kimi-k3</code> | $0.0518 | 95.87 | 4.13% | 0.42% | 92.00s | $0.0518 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-0</code> | 1.44s | 98.17 | 1.83% | 0.34% | 1.44s | $0.0040 |
| 2 | <code>openai/gpt-5.4-mini</code> | 1.93s | 93.58 | 6.42% | 1.51% | 1.93s | $0.0024 |
| 3 | <code>mistral/mistral-ocr-2512</code> | 2.05s | 97.71 | 2.29% | 0.42% | 2.05s | $0.0020 |
| 4 | <code>gemini/gemini-3.5-flash-lite</code> | 2.08s | 96.33 | 3.67% | 0.34% | 2.08s | $0.0014 |
| 5 | <code>glm/glm-ocr</code> | 2.22s | 85.32 | 14.68% | 3.62% | 2.22s | $0.0000 |
| 6 | <code>gemini/gemini-3.6-flash</code> | 2.40s | 100.00 | 0.00% | 0.00% | 2.40s | $0.0045 |
| 7 | <code>openai/gpt-5.4-nano</code> | 2.69s | 80.28 | 19.72% | 8.33% | 2.69s | $0.0007 |
| 8 | <code>gemini/gemini-3.5-flash</code> | 2.83s | 96.33 | 3.67% | 0.34% | 2.83s | $0.0054 |
| 9 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 3.98s | 96.33 | 3.67% | 1.43% | 3.98s | $0.0002 |
| 10 | <code>grok/grok-4.20-0309-non-reasoning</code> | 4.46s | 99.54 | 0.46% | 0.08% | 4.46s | $0.0022 |
| 11 | <code>gemini/gemini-3.1-pro-preview</code> | 4.78s | 96.33 | 3.67% | 0.34% | 4.78s | $0.0072 |
| 12 | <code>openai/gpt-5.6-luna</code> | 4.98s | 94.50 | 5.50% | 1.09% | 4.98s | $0.0013 |
| 13 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 5.49s | 96.33 | 3.67% | 1.01% | 5.49s | $0.0003 |
| 14 | <code>openai/gpt-5.5</code> | 8.38s | 96.33 | 3.67% | 0.34% | 8.38s | $0.0299 |
| 15 | <code>grok/grok-4.3</code> | 8.92s | 100.00 | 0.00% | 0.00% | 8.92s | $0.0022 |
| 16 | <code>deepinfra/google/gemma-3-27b-it</code> | 10.84s | 94.50 | 5.50% | 0.67% | 10.84s | $0.0001 |
| 17 | <code>kimi/kimi-k2.6</code> | 11.49s | 95.41 | 4.59% | 0.42% | 11.49s | $0.0029 |
| 18 | <code>anthropic/claude-sonnet-5</code> | 11.74s | 96.33 | 3.67% | 0.34% | 11.74s | $0.0096 |
| 19 | <code>openai/gpt-5.6-terra</code> | 11.82s | 93.12 | 6.88% | 1.77% | 11.82s | $0.0184 |
| 20 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 12.04s | 94.50 | 5.50% | 0.76% | 12.04s | $0.0004 |
| 21 | <code>anthropic/claude-opus-5</code> | 12.39s | 99.54 | 0.46% | 0.08% | 12.39s | $0.0225 |
| 22 | <code>anthropic/claude-fable-5</code> | 12.47s | 96.33 | 3.67% | 0.34% | 12.47s | $0.0485 |
| 23 | <code>anthropic/claude-opus-4-8</code> | 13.48s | 95.41 | 4.59% | 0.42% | 13.48s | $0.0238 |
| 24 | <code>openai/gpt-5.6-sol</code> | 14.48s | 96.33 | 3.67% | 0.34% | 14.48s | $0.0470 |
| 25 | <code>grok/grok-4.5</code> | 15.98s | 95.87 | 4.13% | 0.42% | 15.98s | $0.0049 |
| 26 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 18.46s | 94.95 | 5.05% | 0.59% | 18.46s | $0.0005 |
| 27 | <code>anthropic/claude-haiku-4-5</code> | 23.22s | 92.20 | 7.80% | 2.44% | 23.22s | $0.0038 |
| 28 | <code>kimi/kimi-k3</code> | 92.00s | 95.87 | 4.13% | 0.42% | 92.00s | $0.0518 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.40s | $0.0045 |
| 2 | <code>grok/grok-4.3</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 8.92s | $0.0022 |
| 3 | <code>anthropic/claude-opus-5</code> | 99.54/100 quality score | 99.54 | 0.46% | 0.08% | 12.39s | $0.0225 |
| 4 | <code>grok/grok-4.20-0309-non-reasoning</code> | 99.54/100 quality score | 99.54 | 0.46% | 0.08% | 4.46s | $0.0022 |
| 5 | <code>mistral/mistral-ocr-4-0</code> | 98.17/100 quality score | 98.17 | 1.83% | 0.34% | 1.44s | $0.0040 |
| 6 | <code>mistral/mistral-ocr-2512</code> | 97.71/100 quality score | 97.71 | 2.29% | 0.42% | 2.05s | $0.0020 |
| 7 | <code>anthropic/claude-fable-5</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 12.47s | $0.0485 |
| 8 | <code>anthropic/claude-sonnet-5</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 11.74s | $0.0096 |
| 9 | <code>gemini/gemini-3.1-pro-preview</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 4.78s | $0.0072 |
| 10 | <code>gemini/gemini-3.5-flash</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 2.83s | $0.0054 |
| 11 | <code>gemini/gemini-3.5-flash-lite</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 2.08s | $0.0014 |
| 12 | <code>openai/gpt-5.5</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 8.38s | $0.0299 |
| 13 | <code>openai/gpt-5.6-sol</code> | 96.33/100 quality score | 96.33 | 3.67% | 0.34% | 14.48s | $0.0470 |
| 14 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 96.33/100 quality score | 96.33 | 3.67% | 1.01% | 5.49s | $0.0003 |
| 15 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 96.33/100 quality score | 96.33 | 3.67% | 1.43% | 3.98s | $0.0002 |
| 16 | <code>grok/grok-4.5</code> | 95.87/100 quality score | 95.87 | 4.13% | 0.42% | 15.98s | $0.0049 |
| 17 | <code>kimi/kimi-k3</code> | 95.87/100 quality score | 95.87 | 4.13% | 0.42% | 92.00s | $0.0518 |
| 18 | <code>anthropic/claude-opus-4-8</code> | 95.41/100 quality score | 95.41 | 4.59% | 0.42% | 13.48s | $0.0238 |
| 19 | <code>kimi/kimi-k2.6</code> | 95.41/100 quality score | 95.41 | 4.59% | 0.42% | 11.49s | $0.0029 |
| 20 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 94.95/100 quality score | 94.95 | 5.05% | 0.59% | 18.46s | $0.0005 |
| 21 | <code>deepinfra/google/gemma-3-27b-it</code> | 94.50/100 quality score | 94.50 | 5.50% | 0.67% | 10.84s | $0.0001 |
| 22 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 94.50/100 quality score | 94.50 | 5.50% | 0.76% | 12.04s | $0.0004 |
| 23 | <code>openai/gpt-5.6-luna</code> | 94.50/100 quality score | 94.50 | 5.50% | 1.09% | 4.98s | $0.0013 |
| 24 | <code>openai/gpt-5.4-mini</code> | 93.58/100 quality score | 93.58 | 6.42% | 1.51% | 1.93s | $0.0024 |
| 25 | <code>openai/gpt-5.6-terra</code> | 93.12/100 quality score | 93.12 | 6.88% | 1.77% | 11.82s | $0.0184 |
| 26 | <code>anthropic/claude-haiku-4-5</code> | 92.20/100 quality score | 92.20 | 7.80% | 2.44% | 23.22s | $0.0038 |
| 27 | <code>glm/glm-ocr</code> | 85.32/100 quality score | 85.32 | 14.68% | 3.62% | 2.22s | $0.0000 |
| 28 | <code>openai/gpt-5.4-nano</code> | 80.28/100 quality score | 80.28 | 19.72% | 8.33% | 2.69s | $0.0007 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 12.47s | $0.0485 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 92.20 | 7.80% | 2.44% | 23.22s | $0.0038 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 95.41 | 4.59% | 0.42% | 13.48s | $0.0238 |
| <code>anthropic/claude-opus-5</code> | Third-Party Service | 99.54 | 0.46% | 0.08% | 12.39s | $0.0225 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 11.74s | $0.0096 |
| <code>deepinfra/google/gemma-3-27b-it</code> | Third-Party Service | 94.50 | 5.50% | 0.67% | 10.84s | $0.0001 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | Third-Party Service | 96.33 | 3.67% | 1.01% | 5.49s | $0.0003 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service | 96.33 | 3.67% | 1.43% | 3.98s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 94.95 | 5.05% | 0.59% | 18.46s | $0.0005 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 94.50 | 5.50% | 0.76% | 12.04s | $0.0004 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 4.78s | $0.0072 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 2.83s | $0.0054 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 2.08s | $0.0014 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.40s | $0.0045 |
| <code>glm/glm-ocr</code> | Third-Party Service | 85.32 | 14.68% | 3.62% | 2.22s | $0.0000 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 99.54 | 0.46% | 0.08% | 4.46s | $0.0022 |
| <code>grok/grok-4.3</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 8.92s | $0.0022 |
| <code>grok/grok-4.5</code> | Third-Party Service | 95.87 | 4.13% | 0.42% | 15.98s | $0.0049 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 95.41 | 4.59% | 0.42% | 11.49s | $0.0029 |
| <code>kimi/kimi-k3</code> | Third-Party Service | 95.87 | 4.13% | 0.42% | 92.00s | $0.0518 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 97.71 | 2.29% | 0.42% | 2.05s | $0.0020 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 98.17 | 1.83% | 0.34% | 1.44s | $0.0040 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 93.58 | 6.42% | 1.51% | 1.93s | $0.0024 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 80.28 | 19.72% | 8.33% | 2.69s | $0.0007 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 8.38s | $0.0299 |
| <code>openai/gpt-5.6-luna</code> | Third-Party Service | 94.50 | 5.50% | 1.09% | 4.98s | $0.0013 |
| <code>openai/gpt-5.6-sol</code> | Third-Party Service | 96.33 | 3.67% | 0.34% | 14.48s | $0.0470 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 93.12 | 6.88% | 1.77% | 11.82s | $0.0184 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | 4 | 0 | 4 | 218 |
| <code>anthropic/claude-haiku-4-5</code> | 15 | 0 | 2 | 218 |
| <code>anthropic/claude-opus-4-8</code> | 5 | 1 | 4 | 218 |
| <code>anthropic/claude-opus-5</code> | 1 | 0 | 0 | 218 |
| <code>anthropic/claude-sonnet-5</code> | 4 | 0 | 4 | 218 |
| <code>deepinfra/google/gemma-3-27b-it</code> | 7 | 1 | 4 | 218 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 7 | 1 | 0 | 218 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 7 | 0 | 1 | 218 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 7 | 0 | 4 | 218 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 8 | 0 | 4 | 218 |
| <code>gemini/gemini-3.1-pro-preview</code> | 4 | 0 | 4 | 218 |
| <code>gemini/gemini-3.5-flash</code> | 4 | 0 | 4 | 218 |
| <code>gemini/gemini-3.5-flash-lite</code> | 4 | 0 | 4 | 218 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 218 |
| <code>glm/glm-ocr</code> | 30 | 1 | 1 | 218 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 1 | 0 | 0 | 218 |
| <code>grok/grok-4.3</code> | 0 | 0 | 0 | 218 |
| <code>grok/grok-4.5</code> | 5 | 0 | 4 | 218 |
| <code>kimi/kimi-k2.6</code> | 5 | 1 | 4 | 218 |
| <code>kimi/kimi-k3</code> | 5 | 0 | 4 | 218 |
| <code>mistral/mistral-ocr-2512</code> | 4 | 0 | 1 | 218 |
| <code>mistral/mistral-ocr-4-0</code> | 4 | 0 | 0 | 218 |
| <code>openai/gpt-5.4-mini</code> | 9 | 0 | 5 | 218 |
| <code>openai/gpt-5.4-nano</code> | 34 | 1 | 8 | 218 |
| <code>openai/gpt-5.5</code> | 4 | 0 | 4 | 218 |
| <code>openai/gpt-5.6-luna</code> | 7 | 0 | 5 | 218 |
| <code>openai/gpt-5.6-sol</code> | 4 | 0 | 4 | 218 |
| <code>openai/gpt-5.6-terra</code> | 9 | 2 | 4 | 218 |

## Notes

- Best cloud service: `gemini/gemini-3.6-flash` scored 100.00/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0030¢ ($0.0000).
- Fastest cloud service: `mistral/mistral-ocr-4-0` at 1.44s.
