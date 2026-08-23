# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/01-ad-copy`
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
| 1 | <code>glm/glm-ocr</code> | $0.0000 | 49.21 | 50.79% | 55.64% | 1.15s | $0.0000 |
| 2 | <code>deepinfra/google/gemma-3-27b-it</code> | $0.0000 | 82.54 | 17.46% | 14.62% | 5.21s | $0.0000 |
| 3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0001 | 92.06 | 7.94% | 5.90% | 2.34s | $0.0001 |
| 4 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | $0.0001 | 96.83 | 3.17% | 3.33% | 2.13s | $0.0001 |
| 5 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0002 | 90.48 | 9.52% | 7.18% | 5.22s | $0.0002 |
| 6 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0002 | 96.83 | 3.17% | 2.56% | 8.07s | $0.0002 |
| 7 | <code>openai/gpt-5.4-nano</code> | $0.0003 | 80.95 | 19.05% | 9.49% | 1.75s | $0.0003 |
| 8 | <code>openai/gpt-5.6-luna</code> | $0.0006 | 92.06 | 7.94% | 6.67% | 2.94s | $0.0006 |
| 9 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0008 | 85.71 | 14.29% | 11.03% | 1.34s | $0.0008 |
| 10 | <code>openai/gpt-5.4-mini</code> | $0.0011 | 87.30 | 12.70% | 8.21% | 1.21s | $0.0011 |
| 11 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0013 | 93.65 | 6.35% | 5.90% | 1.37s | $0.0013 |
| 12 | <code>kimi/kimi-k2.6</code> | $0.0013 | 85.71 | 14.29% | 13.59% | 4.19s | $0.0013 |
| 13 | <code>grok/grok-4.3</code> | $0.0013 | 90.48 | 9.52% | 7.95% | 4.43s | $0.0013 |
| 14 | <code>anthropic/claude-haiku-4-5</code> | $0.0019 | 88.89 | 11.11% | 9.23% | 9.43s | $0.0019 |
| 15 | <code>mistral/mistral-ocr-2512</code> | $0.0020 | 79.37 | 20.63% | 16.41% | 1.16s | $0.0020 |
| 16 | <code>gemini/gemini-3.6-flash</code> | $0.0029 | 95.24 | 4.76% | 2.82% | 1.96s | $0.0029 |
| 17 | <code>grok/grok-4.5</code> | $0.0029 | 98.41 | 1.59% | 2.05% | 4.76s | $0.0029 |
| 18 | <code>gemini/gemini-3.5-flash</code> | $0.0034 | 98.41 | 1.59% | 0.26% | 1.62s | $0.0034 |
| 19 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 80.95 | 19.05% | 15.38% | 1.44s | $0.0040 |
| 20 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0041 | 96.83 | 3.17% | 6.15% | 3.61s | $0.0041 |
| 21 | <code>openai/gpt-5.6-terra</code> | $0.0042 | 92.06 | 7.94% | 6.67% | 2.97s | $0.0042 |
| 22 | <code>anthropic/claude-sonnet-5</code> | $0.0046 | 100.00 | 0.00% | 0.00% | 5.36s | $0.0046 |
| 23 | <code>openai/gpt-5.6-sol</code> | $0.0113 | 92.06 | 7.94% | 6.67% | 5.35s | $0.0113 |
| 24 | <code>anthropic/claude-opus-5</code> | $0.0114 | 100.00 | 0.00% | 0.00% | 4.88s | $0.0114 |
| 25 | <code>anthropic/claude-opus-4-8</code> | $0.0116 | 96.83 | 3.17% | 2.56% | 4.50s | $0.0116 |
| 26 | <code>openai/gpt-5.5</code> | $0.0148 | 92.06 | 7.94% | 6.67% | 4.85s | $0.0148 |
| 27 | <code>anthropic/claude-fable-5</code> | $0.0226 | 95.24 | 4.76% | 4.62% | 7.16s | $0.0226 |
| 28 | <code>kimi/kimi-k3</code> | $0.0314 | 98.41 | 1.59% | 0.26% | 64.22s | $0.0314 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>glm/glm-ocr</code> | 1.15s | 49.21 | 50.79% | 55.64% | 1.15s | $0.0000 |
| 2 | <code>mistral/mistral-ocr-2512</code> | 1.16s | 79.37 | 20.63% | 16.41% | 1.16s | $0.0020 |
| 3 | <code>openai/gpt-5.4-mini</code> | 1.21s | 87.30 | 12.70% | 8.21% | 1.21s | $0.0011 |
| 4 | <code>gemini/gemini-3.5-flash-lite</code> | 1.34s | 85.71 | 14.29% | 11.03% | 1.34s | $0.0008 |
| 5 | <code>grok/grok-4.20-0309-non-reasoning</code> | 1.37s | 93.65 | 6.35% | 5.90% | 1.37s | $0.0013 |
| 6 | <code>mistral/mistral-ocr-4-0</code> | 1.44s | 80.95 | 19.05% | 15.38% | 1.44s | $0.0040 |
| 7 | <code>gemini/gemini-3.5-flash</code> | 1.62s | 98.41 | 1.59% | 0.26% | 1.62s | $0.0034 |
| 8 | <code>openai/gpt-5.4-nano</code> | 1.75s | 80.95 | 19.05% | 9.49% | 1.75s | $0.0003 |
| 9 | <code>gemini/gemini-3.6-flash</code> | 1.96s | 95.24 | 4.76% | 2.82% | 1.96s | $0.0029 |
| 10 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 2.13s | 96.83 | 3.17% | 3.33% | 2.13s | $0.0001 |
| 11 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 2.34s | 92.06 | 7.94% | 5.90% | 2.34s | $0.0001 |
| 12 | <code>openai/gpt-5.6-luna</code> | 2.94s | 92.06 | 7.94% | 6.67% | 2.94s | $0.0006 |
| 13 | <code>openai/gpt-5.6-terra</code> | 2.97s | 92.06 | 7.94% | 6.67% | 2.97s | $0.0042 |
| 14 | <code>gemini/gemini-3.1-pro-preview</code> | 3.61s | 96.83 | 3.17% | 6.15% | 3.61s | $0.0041 |
| 15 | <code>kimi/kimi-k2.6</code> | 4.19s | 85.71 | 14.29% | 13.59% | 4.19s | $0.0013 |
| 16 | <code>grok/grok-4.3</code> | 4.43s | 90.48 | 9.52% | 7.95% | 4.43s | $0.0013 |
| 17 | <code>anthropic/claude-opus-4-8</code> | 4.50s | 96.83 | 3.17% | 2.56% | 4.50s | $0.0116 |
| 18 | <code>grok/grok-4.5</code> | 4.76s | 98.41 | 1.59% | 2.05% | 4.76s | $0.0029 |
| 19 | <code>openai/gpt-5.5</code> | 4.85s | 92.06 | 7.94% | 6.67% | 4.85s | $0.0148 |
| 20 | <code>anthropic/claude-opus-5</code> | 4.88s | 100.00 | 0.00% | 0.00% | 4.88s | $0.0114 |
| 21 | <code>deepinfra/google/gemma-3-27b-it</code> | 5.21s | 82.54 | 17.46% | 14.62% | 5.21s | $0.0000 |
| 22 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 5.22s | 90.48 | 9.52% | 7.18% | 5.22s | $0.0002 |
| 23 | <code>openai/gpt-5.6-sol</code> | 5.35s | 92.06 | 7.94% | 6.67% | 5.35s | $0.0113 |
| 24 | <code>anthropic/claude-sonnet-5</code> | 5.36s | 100.00 | 0.00% | 0.00% | 5.36s | $0.0046 |
| 25 | <code>anthropic/claude-fable-5</code> | 7.16s | 95.24 | 4.76% | 4.62% | 7.16s | $0.0226 |
| 26 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 8.07s | 96.83 | 3.17% | 2.56% | 8.07s | $0.0002 |
| 27 | <code>anthropic/claude-haiku-4-5</code> | 9.43s | 88.89 | 11.11% | 9.23% | 9.43s | $0.0019 |
| 28 | <code>kimi/kimi-k3</code> | 64.22s | 98.41 | 1.59% | 0.26% | 64.22s | $0.0314 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-opus-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 4.88s | $0.0114 |
| 2 | <code>anthropic/claude-sonnet-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 5.36s | $0.0046 |
| 3 | <code>gemini/gemini-3.5-flash</code> | 98.41/100 quality score | 98.41 | 1.59% | 0.26% | 1.62s | $0.0034 |
| 4 | <code>kimi/kimi-k3</code> | 98.41/100 quality score | 98.41 | 1.59% | 0.26% | 64.22s | $0.0314 |
| 5 | <code>grok/grok-4.5</code> | 98.41/100 quality score | 98.41 | 1.59% | 2.05% | 4.76s | $0.0029 |
| 6 | <code>anthropic/claude-opus-4-8</code> | 96.83/100 quality score | 96.83 | 3.17% | 2.56% | 4.50s | $0.0116 |
| 7 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 96.83/100 quality score | 96.83 | 3.17% | 2.56% | 8.07s | $0.0002 |
| 8 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 96.83/100 quality score | 96.83 | 3.17% | 3.33% | 2.13s | $0.0001 |
| 9 | <code>gemini/gemini-3.1-pro-preview</code> | 96.83/100 quality score | 96.83 | 3.17% | 6.15% | 3.61s | $0.0041 |
| 10 | <code>gemini/gemini-3.6-flash</code> | 95.24/100 quality score | 95.24 | 4.76% | 2.82% | 1.96s | $0.0029 |
| 11 | <code>anthropic/claude-fable-5</code> | 95.24/100 quality score | 95.24 | 4.76% | 4.62% | 7.16s | $0.0226 |
| 12 | <code>grok/grok-4.20-0309-non-reasoning</code> | 93.65/100 quality score | 93.65 | 6.35% | 5.90% | 1.37s | $0.0013 |
| 13 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 92.06/100 quality score | 92.06 | 7.94% | 5.90% | 2.34s | $0.0001 |
| 14 | <code>openai/gpt-5.5</code> | 92.06/100 quality score | 92.06 | 7.94% | 6.67% | 4.85s | $0.0148 |
| 15 | <code>openai/gpt-5.6-luna</code> | 92.06/100 quality score | 92.06 | 7.94% | 6.67% | 2.94s | $0.0006 |
| 16 | <code>openai/gpt-5.6-sol</code> | 92.06/100 quality score | 92.06 | 7.94% | 6.67% | 5.35s | $0.0113 |
| 17 | <code>openai/gpt-5.6-terra</code> | 92.06/100 quality score | 92.06 | 7.94% | 6.67% | 2.97s | $0.0042 |
| 18 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 90.48/100 quality score | 90.48 | 9.52% | 7.18% | 5.22s | $0.0002 |
| 19 | <code>grok/grok-4.3</code> | 90.48/100 quality score | 90.48 | 9.52% | 7.95% | 4.43s | $0.0013 |
| 20 | <code>anthropic/claude-haiku-4-5</code> | 88.89/100 quality score | 88.89 | 11.11% | 9.23% | 9.43s | $0.0019 |
| 21 | <code>openai/gpt-5.4-mini</code> | 87.30/100 quality score | 87.30 | 12.70% | 8.21% | 1.21s | $0.0011 |
| 22 | <code>gemini/gemini-3.5-flash-lite</code> | 85.71/100 quality score | 85.71 | 14.29% | 11.03% | 1.34s | $0.0008 |
| 23 | <code>kimi/kimi-k2.6</code> | 85.71/100 quality score | 85.71 | 14.29% | 13.59% | 4.19s | $0.0013 |
| 24 | <code>deepinfra/google/gemma-3-27b-it</code> | 82.54/100 quality score | 82.54 | 17.46% | 14.62% | 5.21s | $0.0000 |
| 25 | <code>openai/gpt-5.4-nano</code> | 80.95/100 quality score | 80.95 | 19.05% | 9.49% | 1.75s | $0.0003 |
| 26 | <code>mistral/mistral-ocr-4-0</code> | 80.95/100 quality score | 80.95 | 19.05% | 15.38% | 1.44s | $0.0040 |
| 27 | <code>mistral/mistral-ocr-2512</code> | 79.37/100 quality score | 79.37 | 20.63% | 16.41% | 1.16s | $0.0020 |
| 28 | <code>glm/glm-ocr</code> | 49.21/100 quality score | 49.21 | 50.79% | 55.64% | 1.15s | $0.0000 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 95.24 | 4.76% | 4.62% | 7.16s | $0.0226 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 88.89 | 11.11% | 9.23% | 9.43s | $0.0019 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 96.83 | 3.17% | 2.56% | 4.50s | $0.0116 |
| <code>anthropic/claude-opus-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 4.88s | $0.0114 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 5.36s | $0.0046 |
| <code>deepinfra/google/gemma-3-27b-it</code> | Third-Party Service | 82.54 | 17.46% | 14.62% | 5.21s | $0.0000 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | Third-Party Service | 96.83 | 3.17% | 3.33% | 2.13s | $0.0001 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service | 92.06 | 7.94% | 5.90% | 2.34s | $0.0001 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 96.83 | 3.17% | 2.56% | 8.07s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 90.48 | 9.52% | 7.18% | 5.22s | $0.0002 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 96.83 | 3.17% | 6.15% | 3.61s | $0.0041 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 98.41 | 1.59% | 0.26% | 1.62s | $0.0034 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 85.71 | 14.29% | 11.03% | 1.34s | $0.0008 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 95.24 | 4.76% | 2.82% | 1.96s | $0.0029 |
| <code>glm/glm-ocr</code> | Third-Party Service | 49.21 | 50.79% | 55.64% | 1.15s | $0.0000 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 93.65 | 6.35% | 5.90% | 1.37s | $0.0013 |
| <code>grok/grok-4.3</code> | Third-Party Service | 90.48 | 9.52% | 7.95% | 4.43s | $0.0013 |
| <code>grok/grok-4.5</code> | Third-Party Service | 98.41 | 1.59% | 2.05% | 4.76s | $0.0029 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 85.71 | 14.29% | 13.59% | 4.19s | $0.0013 |
| <code>kimi/kimi-k3</code> | Third-Party Service | 98.41 | 1.59% | 0.26% | 64.22s | $0.0314 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 79.37 | 20.63% | 16.41% | 1.16s | $0.0020 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 80.95 | 19.05% | 15.38% | 1.44s | $0.0040 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 87.30 | 12.70% | 8.21% | 1.21s | $0.0011 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 80.95 | 19.05% | 9.49% | 1.75s | $0.0003 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 92.06 | 7.94% | 6.67% | 4.85s | $0.0148 |
| <code>openai/gpt-5.6-luna</code> | Third-Party Service | 92.06 | 7.94% | 6.67% | 2.94s | $0.0006 |
| <code>openai/gpt-5.6-sol</code> | Third-Party Service | 92.06 | 7.94% | 6.67% | 5.35s | $0.0113 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 92.06 | 7.94% | 6.67% | 2.97s | $0.0042 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | 0 | 2 | 1 | 63 |
| <code>anthropic/claude-haiku-4-5</code> | 0 | 4 | 3 | 63 |
| <code>anthropic/claude-opus-4-8</code> | 0 | 1 | 1 | 63 |
| <code>anthropic/claude-opus-5</code> | 0 | 0 | 0 | 63 |
| <code>anthropic/claude-sonnet-5</code> | 0 | 0 | 0 | 63 |
| <code>deepinfra/google/gemma-3-27b-it</code> | 1 | 8 | 2 | 63 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 0 | 2 | 0 | 63 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 0 | 2 | 3 | 63 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 0 | 1 | 1 | 63 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 0 | 3 | 3 | 63 |
| <code>gemini/gemini-3.1-pro-preview</code> | 0 | 1 | 1 | 63 |
| <code>gemini/gemini-3.5-flash</code> | 1 | 0 | 0 | 63 |
| <code>gemini/gemini-3.5-flash-lite</code> | 1 | 4 | 4 | 63 |
| <code>gemini/gemini-3.6-flash</code> | 1 | 1 | 1 | 63 |
| <code>glm/glm-ocr</code> | 0 | 32 | 0 | 63 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 0 | 4 | 0 | 63 |
| <code>grok/grok-4.3</code> | 0 | 3 | 3 | 63 |
| <code>grok/grok-4.5</code> | 0 | 1 | 0 | 63 |
| <code>kimi/kimi-k2.6</code> | 1 | 4 | 4 | 63 |
| <code>kimi/kimi-k3</code> | 1 | 0 | 0 | 63 |
| <code>mistral/mistral-ocr-2512</code> | 6 | 4 | 3 | 63 |
| <code>mistral/mistral-ocr-4-0</code> | 8 | 2 | 2 | 63 |
| <code>openai/gpt-5.4-mini</code> | 3 | 3 | 2 | 63 |
| <code>openai/gpt-5.4-nano</code> | 8 | 0 | 4 | 63 |
| <code>openai/gpt-5.5</code> | 0 | 3 | 2 | 63 |
| <code>openai/gpt-5.6-luna</code> | 0 | 3 | 2 | 63 |
| <code>openai/gpt-5.6-sol</code> | 0 | 3 | 2 | 63 |
| <code>openai/gpt-5.6-terra</code> | 0 | 3 | 2 | 63 |

## Notes

- Best cloud service: `anthropic/claude-opus-5` scored 100.00/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0008¢ ($0.0000).
- Fastest cloud service: `glm/glm-ocr` at 1.15s.
