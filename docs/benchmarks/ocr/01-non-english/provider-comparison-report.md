# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/01-non-english`
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
| 1 | <code>deepinfra/google/gemma-3-27b-it</code> | $0.0001 | 38.46 | 61.54% | 85.98% | 23.15s | $0.0001 |
| 2 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0003 | 0.00 | 100.00% | 89.62% | 9.67s | $0.0003 |
| 3 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | $0.0005 | 0.00 | 669.23% | 139.77% | 23.36s | $0.0005 |
| 4 | <code>glm/glm-ocr</code> | $0.0005 | 57.69 | 42.31% | 39.77% | 21.02s | $0.0005 |
| 5 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0006 | 38.46 | 61.54% | 20.45% | 20.47s | $0.0006 |
| 6 | <code>openai/gpt-5.4-nano</code> | $0.0008 | 19.23 | 80.77% | 89.02% | 2.81s | $0.0008 |
| 7 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0009 | 46.15 | 53.85% | 12.95% | 36.38s | $0.0009 |
| 8 | <code>mistral/mistral-ocr-2512</code> | $0.0020 | 100.00 | 0.00% | 0.45% | 3.51s | $0.0020 |
| 9 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0022 | 100.00 | 0.00% | 0.45% | 2.69s | $0.0022 |
| 10 | <code>grok/grok-4.3</code> | $0.0032 | 61.54 | 38.46% | 44.17% | 12.98s | $0.0032 |
| 11 | <code>openai/gpt-5.4-mini</code> | $0.0039 | 53.85 | 46.15% | 53.18% | 3.43s | $0.0039 |
| 12 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 76.92 | 23.08% | 2.20% | 1.54s | $0.0040 |
| 13 | <code>openai/gpt-5.6-luna</code> | $0.0047 | 65.38 | 34.62% | 32.65% | 16.41s | $0.0047 |
| 14 | <code>anthropic/claude-haiku-4-5</code> | $0.0048 | 26.92 | 73.08% | 85.76% | 5.86s | $0.0048 |
| 15 | <code>kimi/kimi-k2.6</code> | $0.0050 | 92.31 | 7.69% | 5.91% | 20.13s | $0.0050 |
| 16 | <code>grok/grok-4.5</code> | $0.0070 | 73.08 | 26.92% | 11.36% | 26.20s | $0.0070 |
| 17 | <code>gemini/gemini-3.6-flash</code> | $0.0075 | 100.00 | 0.00% | 0.98% | 4.30s | $0.0075 |
| 18 | <code>gemini/gemini-3.5-flash</code> | $0.0088 | 100.00 | 0.00% | 1.14% | 3.78s | $0.0088 |
| 19 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0117 | 0.00 | 723.08% | 465.61% | 24.51s | $0.0117 |
| 20 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0120 | 100.00 | 0.00% | 1.14% | 6.92s | $0.0120 |
| 21 | <code>anthropic/claude-sonnet-5</code> | $0.0163 | 61.54 | 38.46% | 33.33% | 22.15s | $0.0163 |
| 22 | <code>openai/gpt-5.6-terra</code> | $0.0258 | 69.23 | 30.77% | 25.76% | 12.58s | $0.0258 |
| 23 | <code>anthropic/claude-opus-5</code> | $0.0354 | 76.92 | 23.08% | 42.80% | 22.25s | $0.0354 |
| 24 | <code>anthropic/claude-opus-4-8</code> | $0.0382 | 76.92 | 23.08% | 2.58% | 26.45s | $0.0382 |
| 25 | <code>kimi/kimi-k3</code> | $0.0399 | 100.00 | 0.00% | 0.08% | 170.14s | $0.0399 |
| 26 | <code>openai/gpt-5.5</code> | $0.1160 | 73.08 | 26.92% | 12.95% | 27.32s | $0.1160 |
| 27 | <code>openai/gpt-5.6-sol</code> | $0.1351 | 96.15 | 3.85% | 7.95% | 38.57s | $0.1351 |
| 28 | <code>anthropic/claude-fable-5</code> | $0.1391 | 100.00 | 0.00% | 0.00% | 31.52s | $0.1391 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-0</code> | 1.54s | 76.92 | 23.08% | 2.20% | 1.54s | $0.0040 |
| 2 | <code>gemini/gemini-3.5-flash-lite</code> | 2.69s | 100.00 | 0.00% | 0.45% | 2.69s | $0.0022 |
| 3 | <code>openai/gpt-5.4-nano</code> | 2.81s | 19.23 | 80.77% | 89.02% | 2.81s | $0.0008 |
| 4 | <code>openai/gpt-5.4-mini</code> | 3.43s | 53.85 | 46.15% | 53.18% | 3.43s | $0.0039 |
| 5 | <code>mistral/mistral-ocr-2512</code> | 3.51s | 100.00 | 0.00% | 0.45% | 3.51s | $0.0020 |
| 6 | <code>gemini/gemini-3.5-flash</code> | 3.78s | 100.00 | 0.00% | 1.14% | 3.78s | $0.0088 |
| 7 | <code>gemini/gemini-3.6-flash</code> | 4.30s | 100.00 | 0.00% | 0.98% | 4.30s | $0.0075 |
| 8 | <code>anthropic/claude-haiku-4-5</code> | 5.86s | 26.92 | 73.08% | 85.76% | 5.86s | $0.0048 |
| 9 | <code>gemini/gemini-3.1-pro-preview</code> | 6.92s | 100.00 | 0.00% | 1.14% | 6.92s | $0.0120 |
| 10 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 9.67s | 0.00 | 100.00% | 89.62% | 9.67s | $0.0003 |
| 11 | <code>openai/gpt-5.6-terra</code> | 12.58s | 69.23 | 30.77% | 25.76% | 12.58s | $0.0258 |
| 12 | <code>grok/grok-4.3</code> | 12.98s | 61.54 | 38.46% | 44.17% | 12.98s | $0.0032 |
| 13 | <code>openai/gpt-5.6-luna</code> | 16.41s | 65.38 | 34.62% | 32.65% | 16.41s | $0.0047 |
| 14 | <code>kimi/kimi-k2.6</code> | 20.13s | 92.31 | 7.69% | 5.91% | 20.13s | $0.0050 |
| 15 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 20.47s | 38.46 | 61.54% | 20.45% | 20.47s | $0.0006 |
| 16 | <code>glm/glm-ocr</code> | 21.02s | 57.69 | 42.31% | 39.77% | 21.02s | $0.0005 |
| 17 | <code>anthropic/claude-sonnet-5</code> | 22.15s | 61.54 | 38.46% | 33.33% | 22.15s | $0.0163 |
| 18 | <code>anthropic/claude-opus-5</code> | 22.25s | 76.92 | 23.08% | 42.80% | 22.25s | $0.0354 |
| 19 | <code>deepinfra/google/gemma-3-27b-it</code> | 23.15s | 38.46 | 61.54% | 85.98% | 23.15s | $0.0001 |
| 20 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 23.36s | 0.00 | 669.23% | 139.77% | 23.36s | $0.0005 |
| 21 | <code>grok/grok-4.20-0309-non-reasoning</code> | 24.51s | 0.00 | 723.08% | 465.61% | 24.51s | $0.0117 |
| 22 | <code>grok/grok-4.5</code> | 26.20s | 73.08 | 26.92% | 11.36% | 26.20s | $0.0070 |
| 23 | <code>anthropic/claude-opus-4-8</code> | 26.45s | 76.92 | 23.08% | 2.58% | 26.45s | $0.0382 |
| 24 | <code>openai/gpt-5.5</code> | 27.32s | 73.08 | 26.92% | 12.95% | 27.32s | $0.1160 |
| 25 | <code>anthropic/claude-fable-5</code> | 31.52s | 100.00 | 0.00% | 0.00% | 31.52s | $0.1391 |
| 26 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 36.38s | 46.15 | 53.85% | 12.95% | 36.38s | $0.0009 |
| 27 | <code>openai/gpt-5.6-sol</code> | 38.57s | 96.15 | 3.85% | 7.95% | 38.57s | $0.1351 |
| 28 | <code>kimi/kimi-k3</code> | 170.14s | 100.00 | 0.00% | 0.08% | 170.14s | $0.0399 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 31.52s | $0.1391 |
| 2 | <code>kimi/kimi-k3</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.08% | 170.14s | $0.0399 |
| 3 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.45% | 2.69s | $0.0022 |
| 4 | <code>mistral/mistral-ocr-2512</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.45% | 3.51s | $0.0020 |
| 5 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.98% | 4.30s | $0.0075 |
| 6 | <code>gemini/gemini-3.1-pro-preview</code> | 100.00/100 quality score | 100.00 | 0.00% | 1.14% | 6.92s | $0.0120 |
| 7 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 1.14% | 3.78s | $0.0088 |
| 8 | <code>openai/gpt-5.6-sol</code> | 96.15/100 quality score | 96.15 | 3.85% | 7.95% | 38.57s | $0.1351 |
| 9 | <code>kimi/kimi-k2.6</code> | 92.31/100 quality score | 92.31 | 7.69% | 5.91% | 20.13s | $0.0050 |
| 10 | <code>mistral/mistral-ocr-4-0</code> | 76.92/100 quality score | 76.92 | 23.08% | 2.20% | 1.54s | $0.0040 |
| 11 | <code>anthropic/claude-opus-4-8</code> | 76.92/100 quality score | 76.92 | 23.08% | 2.58% | 26.45s | $0.0382 |
| 12 | <code>anthropic/claude-opus-5</code> | 76.92/100 quality score | 76.92 | 23.08% | 42.80% | 22.25s | $0.0354 |
| 13 | <code>grok/grok-4.5</code> | 73.08/100 quality score | 73.08 | 26.92% | 11.36% | 26.20s | $0.0070 |
| 14 | <code>openai/gpt-5.5</code> | 73.08/100 quality score | 73.08 | 26.92% | 12.95% | 27.32s | $0.1160 |
| 15 | <code>openai/gpt-5.6-terra</code> | 69.23/100 quality score | 69.23 | 30.77% | 25.76% | 12.58s | $0.0258 |
| 16 | <code>openai/gpt-5.6-luna</code> | 65.38/100 quality score | 65.38 | 34.62% | 32.65% | 16.41s | $0.0047 |
| 17 | <code>anthropic/claude-sonnet-5</code> | 61.54/100 quality score | 61.54 | 38.46% | 33.33% | 22.15s | $0.0163 |
| 18 | <code>grok/grok-4.3</code> | 61.54/100 quality score | 61.54 | 38.46% | 44.17% | 12.98s | $0.0032 |
| 19 | <code>glm/glm-ocr</code> | 57.69/100 quality score | 57.69 | 42.31% | 39.77% | 21.02s | $0.0005 |
| 20 | <code>openai/gpt-5.4-mini</code> | 53.85/100 quality score | 53.85 | 46.15% | 53.18% | 3.43s | $0.0039 |
| 21 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 46.15/100 quality score | 46.15 | 53.85% | 12.95% | 36.38s | $0.0009 |
| 22 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 38.46/100 quality score | 38.46 | 61.54% | 20.45% | 20.47s | $0.0006 |
| 23 | <code>deepinfra/google/gemma-3-27b-it</code> | 38.46/100 quality score | 38.46 | 61.54% | 85.98% | 23.15s | $0.0001 |
| 24 | <code>anthropic/claude-haiku-4-5</code> | 26.92/100 quality score | 26.92 | 73.08% | 85.76% | 5.86s | $0.0048 |
| 25 | <code>openai/gpt-5.4-nano</code> | 19.23/100 quality score | 19.23 | 80.77% | 89.02% | 2.81s | $0.0008 |
| 26 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 0.00/100 quality score | 0.00 | 100.00% | 89.62% | 9.67s | $0.0003 |
| 27 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 0.00/100 quality score | 0.00 | 669.23% | 139.77% | 23.36s | $0.0005 |
| 28 | <code>grok/grok-4.20-0309-non-reasoning</code> | 0.00/100 quality score | 0.00 | 723.08% | 465.61% | 24.51s | $0.0117 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 31.52s | $0.1391 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 26.92 | 73.08% | 85.76% | 5.86s | $0.0048 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 76.92 | 23.08% | 2.58% | 26.45s | $0.0382 |
| <code>anthropic/claude-opus-5</code> | Third-Party Service | 76.92 | 23.08% | 42.80% | 22.25s | $0.0354 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 61.54 | 38.46% | 33.33% | 22.15s | $0.0163 |
| <code>deepinfra/google/gemma-3-27b-it</code> | Third-Party Service | 38.46 | 61.54% | 85.98% | 23.15s | $0.0001 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | Third-Party Service | 0.00 | 669.23% | 139.77% | 23.36s | $0.0005 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service | 0.00 | 100.00% | 89.62% | 9.67s | $0.0003 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 46.15 | 53.85% | 12.95% | 36.38s | $0.0009 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 38.46 | 61.54% | 20.45% | 20.47s | $0.0006 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 100.00 | 0.00% | 1.14% | 6.92s | $0.0120 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 1.14% | 3.78s | $0.0088 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.45% | 2.69s | $0.0022 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.98% | 4.30s | $0.0075 |
| <code>glm/glm-ocr</code> | Third-Party Service | 57.69 | 42.31% | 39.77% | 21.02s | $0.0005 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 0.00 | 723.08% | 465.61% | 24.51s | $0.0117 |
| <code>grok/grok-4.3</code> | Third-Party Service | 61.54 | 38.46% | 44.17% | 12.98s | $0.0032 |
| <code>grok/grok-4.5</code> | Third-Party Service | 73.08 | 26.92% | 11.36% | 26.20s | $0.0070 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 92.31 | 7.69% | 5.91% | 20.13s | $0.0050 |
| <code>kimi/kimi-k3</code> | Third-Party Service | 100.00 | 0.00% | 0.08% | 170.14s | $0.0399 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 100.00 | 0.00% | 0.45% | 3.51s | $0.0020 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 76.92 | 23.08% | 2.20% | 1.54s | $0.0040 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 53.85 | 46.15% | 53.18% | 3.43s | $0.0039 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 19.23 | 80.77% | 89.02% | 2.81s | $0.0008 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 73.08 | 26.92% | 12.95% | 27.32s | $0.1160 |
| <code>openai/gpt-5.6-luna</code> | Third-Party Service | 65.38 | 34.62% | 32.65% | 16.41s | $0.0047 |
| <code>openai/gpt-5.6-sol</code> | Third-Party Service | 96.15 | 3.85% | 7.95% | 38.57s | $0.1351 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 69.23 | 30.77% | 25.76% | 12.58s | $0.0258 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 0 | 26 |
| <code>anthropic/claude-haiku-4-5</code> | 3 | 16 | 0 | 26 |
| <code>anthropic/claude-opus-4-8</code> | 6 | 0 | 0 | 26 |
| <code>anthropic/claude-opus-5</code> | 6 | 0 | 0 | 26 |
| <code>anthropic/claude-sonnet-5</code> | 0 | 4 | 6 | 26 |
| <code>deepinfra/google/gemma-3-27b-it</code> | 9 | 7 | 0 | 26 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 15 | 0 | 159 | 26 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 5 | 21 | 0 | 26 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 12 | 2 | 0 | 26 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 11 | 5 | 0 | 26 |
| <code>gemini/gemini-3.1-pro-preview</code> | 0 | 0 | 0 | 26 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 26 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 26 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 26 |
| <code>glm/glm-ocr</code> | 4 | 6 | 1 | 26 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 10 | 0 | 178 | 26 |
| <code>grok/grok-4.3</code> | 5 | 5 | 0 | 26 |
| <code>grok/grok-4.5</code> | 3 | 4 | 0 | 26 |
| <code>kimi/kimi-k2.6</code> | 2 | 0 | 0 | 26 |
| <code>kimi/kimi-k3</code> | 0 | 0 | 0 | 26 |
| <code>mistral/mistral-ocr-2512</code> | 0 | 0 | 0 | 26 |
| <code>mistral/mistral-ocr-4-0</code> | 2 | 4 | 0 | 26 |
| <code>openai/gpt-5.4-mini</code> | 4 | 8 | 0 | 26 |
| <code>openai/gpt-5.4-nano</code> | 0 | 20 | 1 | 26 |
| <code>openai/gpt-5.5</code> | 2 | 5 | 0 | 26 |
| <code>openai/gpt-5.6-luna</code> | 3 | 6 | 0 | 26 |
| <code>openai/gpt-5.6-sol</code> | 0 | 1 | 0 | 26 |
| <code>openai/gpt-5.6-terra</code> | 6 | 2 | 0 | 26 |

## Notes

- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-3-27b-it` at 0.0105¢ ($0.0001).
- Fastest cloud service: `mistral/mistral-ocr-4-0` at 1.54s.
