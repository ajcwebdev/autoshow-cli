# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/01-handwriting`
- Total providers: 27 (0 local, 27 third-party service)
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
| 1 | <code>glm/glm-ocr</code> | $0.0001 | 0.00 | 215.76% | 216.64% | 3.10s | $0.0001 |
| 2 | <code>deepinfra/google/gemma-3-27b-it</code> | $0.0001 | 53.69 | 46.31% | 27.90% | 18.38s | $0.0001 |
| 3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0002 | 71.92 | 28.08% | 11.27% | 15.02s | $0.0002 |
| 4 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | $0.0003 | 71.43 | 28.57% | 14.38% | 13.17s | $0.0003 |
| 5 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0004 | 83.74 | 16.26% | 6.24% | 35.70s | $0.0004 |
| 6 | <code>openai/gpt-5.4-nano</code> | $0.0006 | 37.93 | 62.07% | 31.02% | 2.57s | $0.0006 |
| 7 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0006 | 80.30 | 19.70% | 7.28% | 18.86s | $0.0006 |
| 8 | <code>mistral/mistral-ocr-2512</code> | $0.0020 | 85.22 | 14.78% | 4.68% | 2.09s | $0.0020 |
| 9 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0022 | 92.12 | 7.88% | 2.43% | 2.20s | $0.0022 |
| 10 | <code>grok/grok-4.3</code> | $0.0023 | 80.30 | 19.70% | 7.45% | 6.19s | $0.0023 |
| 11 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0024 | 34.98 | 65.02% | 17.68% | 5.64s | $0.0024 |
| 12 | <code>kimi/kimi-k2.6</code> | $0.0024 | 83.74 | 16.26% | 5.55% | 9.62s | $0.0024 |
| 13 | <code>openai/gpt-5.4-mini</code> | $0.0024 | 79.31 | 20.69% | 7.97% | 2.14s | $0.0024 |
| 14 | <code>openai/gpt-5.6-luna</code> | $0.0026 | 71.92 | 28.08% | 13.17% | 9.28s | $0.0026 |
| 15 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 92.12 | 7.88% | 4.16% | 1.66s | $0.0040 |
| 16 | <code>anthropic/claude-haiku-4-5</code> | $0.0040 | 48.77 | 51.23% | 21.84% | 7.00s | $0.0040 |
| 17 | <code>grok/grok-4.5</code> | $0.0052 | 86.70 | 13.30% | 5.72% | 18.00s | $0.0052 |
| 18 | <code>gemini/gemini-3.6-flash</code> | $0.0069 | 88.67 | 11.33% | 3.12% | 3.72s | $0.0069 |
| 19 | <code>anthropic/claude-sonnet-5</code> | $0.0085 | 83.25 | 16.75% | 6.07% | 7.84s | $0.0085 |
| 20 | <code>gemini/gemini-3.5-flash</code> | $0.0089 | 88.18 | 11.82% | 3.47% | 3.10s | $0.0089 |
| 21 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0106 | 91.13 | 8.87% | 2.77% | 6.11s | $0.0106 |
| 22 | <code>openai/gpt-5.6-terra</code> | $0.0135 | 78.33 | 21.67% | 9.36% | 7.11s | $0.0135 |
| 23 | <code>anthropic/claude-opus-4-8</code> | $0.0195 | 81.28 | 18.72% | 5.89% | 11.02s | $0.0195 |
| 24 | <code>anthropic/claude-opus-5</code> | $0.0214 | 85.22 | 14.78% | 6.41% | 10.81s | $0.0214 |
| 25 | <code>anthropic/claude-fable-5</code> | $0.0422 | 89.66 | 10.34% | 2.43% | 9.87s | $0.0422 |
| 26 | <code>openai/gpt-5.5</code> | $0.0470 | 75.37 | 24.63% | 9.36% | 11.23s | $0.0470 |
| 27 | <code>openai/gpt-5.6-sol</code> | $0.1085 | 67.98 | 32.02% | 10.75% | 30.01s | $0.1085 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-0</code> | 1.66s | 92.12 | 7.88% | 4.16% | 1.66s | $0.0040 |
| 2 | <code>mistral/mistral-ocr-2512</code> | 2.09s | 85.22 | 14.78% | 4.68% | 2.09s | $0.0020 |
| 3 | <code>openai/gpt-5.4-mini</code> | 2.14s | 79.31 | 20.69% | 7.97% | 2.14s | $0.0024 |
| 4 | <code>gemini/gemini-3.5-flash-lite</code> | 2.20s | 92.12 | 7.88% | 2.43% | 2.20s | $0.0022 |
| 5 | <code>openai/gpt-5.4-nano</code> | 2.57s | 37.93 | 62.07% | 31.02% | 2.57s | $0.0006 |
| 6 | <code>gemini/gemini-3.5-flash</code> | 3.10s | 88.18 | 11.82% | 3.47% | 3.10s | $0.0089 |
| 7 | <code>glm/glm-ocr</code> | 3.10s | 0.00 | 215.76% | 216.64% | 3.10s | $0.0001 |
| 8 | <code>gemini/gemini-3.6-flash</code> | 3.72s | 88.67 | 11.33% | 3.12% | 3.72s | $0.0069 |
| 9 | <code>grok/grok-4.20-0309-non-reasoning</code> | 5.64s | 34.98 | 65.02% | 17.68% | 5.64s | $0.0024 |
| 10 | <code>gemini/gemini-3.1-pro-preview</code> | 6.11s | 91.13 | 8.87% | 2.77% | 6.11s | $0.0106 |
| 11 | <code>grok/grok-4.3</code> | 6.19s | 80.30 | 19.70% | 7.45% | 6.19s | $0.0023 |
| 12 | <code>anthropic/claude-haiku-4-5</code> | 7.00s | 48.77 | 51.23% | 21.84% | 7.00s | $0.0040 |
| 13 | <code>openai/gpt-5.6-terra</code> | 7.11s | 78.33 | 21.67% | 9.36% | 7.11s | $0.0135 |
| 14 | <code>anthropic/claude-sonnet-5</code> | 7.84s | 83.25 | 16.75% | 6.07% | 7.84s | $0.0085 |
| 15 | <code>openai/gpt-5.6-luna</code> | 9.28s | 71.92 | 28.08% | 13.17% | 9.28s | $0.0026 |
| 16 | <code>kimi/kimi-k2.6</code> | 9.62s | 83.74 | 16.26% | 5.55% | 9.62s | $0.0024 |
| 17 | <code>anthropic/claude-fable-5</code> | 9.87s | 89.66 | 10.34% | 2.43% | 9.87s | $0.0422 |
| 18 | <code>anthropic/claude-opus-5</code> | 10.81s | 85.22 | 14.78% | 6.41% | 10.81s | $0.0214 |
| 19 | <code>anthropic/claude-opus-4-8</code> | 11.02s | 81.28 | 18.72% | 5.89% | 11.02s | $0.0195 |
| 20 | <code>openai/gpt-5.5</code> | 11.23s | 75.37 | 24.63% | 9.36% | 11.23s | $0.0470 |
| 21 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 13.17s | 71.43 | 28.57% | 14.38% | 13.17s | $0.0003 |
| 22 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 15.02s | 71.92 | 28.08% | 11.27% | 15.02s | $0.0002 |
| 23 | <code>grok/grok-4.5</code> | 18.00s | 86.70 | 13.30% | 5.72% | 18.00s | $0.0052 |
| 24 | <code>deepinfra/google/gemma-3-27b-it</code> | 18.38s | 53.69 | 46.31% | 27.90% | 18.38s | $0.0001 |
| 25 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 18.86s | 80.30 | 19.70% | 7.28% | 18.86s | $0.0006 |
| 26 | <code>openai/gpt-5.6-sol</code> | 30.01s | 67.98 | 32.02% | 10.75% | 30.01s | $0.1085 |
| 27 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 35.70s | 83.74 | 16.26% | 6.24% | 35.70s | $0.0004 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>gemini/gemini-3.5-flash-lite</code> | 92.12/100 quality score | 92.12 | 7.88% | 2.43% | 2.20s | $0.0022 |
| 2 | <code>mistral/mistral-ocr-4-0</code> | 92.12/100 quality score | 92.12 | 7.88% | 4.16% | 1.66s | $0.0040 |
| 3 | <code>gemini/gemini-3.1-pro-preview</code> | 91.13/100 quality score | 91.13 | 8.87% | 2.77% | 6.11s | $0.0106 |
| 4 | <code>anthropic/claude-fable-5</code> | 89.66/100 quality score | 89.66 | 10.34% | 2.43% | 9.87s | $0.0422 |
| 5 | <code>gemini/gemini-3.6-flash</code> | 88.67/100 quality score | 88.67 | 11.33% | 3.12% | 3.72s | $0.0069 |
| 6 | <code>gemini/gemini-3.5-flash</code> | 88.18/100 quality score | 88.18 | 11.82% | 3.47% | 3.10s | $0.0089 |
| 7 | <code>grok/grok-4.5</code> | 86.70/100 quality score | 86.70 | 13.30% | 5.72% | 18.00s | $0.0052 |
| 8 | <code>mistral/mistral-ocr-2512</code> | 85.22/100 quality score | 85.22 | 14.78% | 4.68% | 2.09s | $0.0020 |
| 9 | <code>anthropic/claude-opus-5</code> | 85.22/100 quality score | 85.22 | 14.78% | 6.41% | 10.81s | $0.0214 |
| 10 | <code>kimi/kimi-k2.6</code> | 83.74/100 quality score | 83.74 | 16.26% | 5.55% | 9.62s | $0.0024 |
| 11 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 83.74/100 quality score | 83.74 | 16.26% | 6.24% | 35.70s | $0.0004 |
| 12 | <code>anthropic/claude-sonnet-5</code> | 83.25/100 quality score | 83.25 | 16.75% | 6.07% | 7.84s | $0.0085 |
| 13 | <code>anthropic/claude-opus-4-8</code> | 81.28/100 quality score | 81.28 | 18.72% | 5.89% | 11.02s | $0.0195 |
| 14 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 80.30/100 quality score | 80.30 | 19.70% | 7.28% | 18.86s | $0.0006 |
| 15 | <code>grok/grok-4.3</code> | 80.30/100 quality score | 80.30 | 19.70% | 7.45% | 6.19s | $0.0023 |
| 16 | <code>openai/gpt-5.4-mini</code> | 79.31/100 quality score | 79.31 | 20.69% | 7.97% | 2.14s | $0.0024 |
| 17 | <code>openai/gpt-5.6-terra</code> | 78.33/100 quality score | 78.33 | 21.67% | 9.36% | 7.11s | $0.0135 |
| 18 | <code>openai/gpt-5.5</code> | 75.37/100 quality score | 75.37 | 24.63% | 9.36% | 11.23s | $0.0470 |
| 19 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 71.92/100 quality score | 71.92 | 28.08% | 11.27% | 15.02s | $0.0002 |
| 20 | <code>openai/gpt-5.6-luna</code> | 71.92/100 quality score | 71.92 | 28.08% | 13.17% | 9.28s | $0.0026 |
| 21 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 71.43/100 quality score | 71.43 | 28.57% | 14.38% | 13.17s | $0.0003 |
| 22 | <code>openai/gpt-5.6-sol</code> | 67.98/100 quality score | 67.98 | 32.02% | 10.75% | 30.01s | $0.1085 |
| 23 | <code>deepinfra/google/gemma-3-27b-it</code> | 53.69/100 quality score | 53.69 | 46.31% | 27.90% | 18.38s | $0.0001 |
| 24 | <code>anthropic/claude-haiku-4-5</code> | 48.77/100 quality score | 48.77 | 51.23% | 21.84% | 7.00s | $0.0040 |
| 25 | <code>openai/gpt-5.4-nano</code> | 37.93/100 quality score | 37.93 | 62.07% | 31.02% | 2.57s | $0.0006 |
| 26 | <code>grok/grok-4.20-0309-non-reasoning</code> | 34.98/100 quality score | 34.98 | 65.02% | 17.68% | 5.64s | $0.0024 |
| 27 | <code>glm/glm-ocr</code> | 0.00/100 quality score | 0.00 | 215.76% | 216.64% | 3.10s | $0.0001 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 89.66 | 10.34% | 2.43% | 9.87s | $0.0422 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 48.77 | 51.23% | 21.84% | 7.00s | $0.0040 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 81.28 | 18.72% | 5.89% | 11.02s | $0.0195 |
| <code>anthropic/claude-opus-5</code> | Third-Party Service | 85.22 | 14.78% | 6.41% | 10.81s | $0.0214 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 83.25 | 16.75% | 6.07% | 7.84s | $0.0085 |
| <code>deepinfra/google/gemma-3-27b-it</code> | Third-Party Service | 53.69 | 46.31% | 27.90% | 18.38s | $0.0001 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | Third-Party Service | 71.43 | 28.57% | 14.38% | 13.17s | $0.0003 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service | 71.92 | 28.08% | 11.27% | 15.02s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 80.30 | 19.70% | 7.28% | 18.86s | $0.0006 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 83.74 | 16.26% | 6.24% | 35.70s | $0.0004 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 91.13 | 8.87% | 2.77% | 6.11s | $0.0106 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 88.18 | 11.82% | 3.47% | 3.10s | $0.0089 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 92.12 | 7.88% | 2.43% | 2.20s | $0.0022 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 88.67 | 11.33% | 3.12% | 3.72s | $0.0069 |
| <code>glm/glm-ocr</code> | Third-Party Service | 0.00 | 215.76% | 216.64% | 3.10s | $0.0001 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 34.98 | 65.02% | 17.68% | 5.64s | $0.0024 |
| <code>grok/grok-4.3</code> | Third-Party Service | 80.30 | 19.70% | 7.45% | 6.19s | $0.0023 |
| <code>grok/grok-4.5</code> | Third-Party Service | 86.70 | 13.30% | 5.72% | 18.00s | $0.0052 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 83.74 | 16.26% | 5.55% | 9.62s | $0.0024 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 85.22 | 14.78% | 4.68% | 2.09s | $0.0020 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 92.12 | 7.88% | 4.16% | 1.66s | $0.0040 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 79.31 | 20.69% | 7.97% | 2.14s | $0.0024 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 37.93 | 62.07% | 31.02% | 2.57s | $0.0006 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 75.37 | 24.63% | 9.36% | 11.23s | $0.0470 |
| <code>openai/gpt-5.6-luna</code> | Third-Party Service | 71.92 | 28.08% | 13.17% | 9.28s | $0.0026 |
| <code>openai/gpt-5.6-sol</code> | Third-Party Service | 67.98 | 32.02% | 10.75% | 30.01s | $0.1085 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 78.33 | 21.67% | 9.36% | 7.11s | $0.0135 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | 13 | 6 | 2 | 203 |
| <code>anthropic/claude-haiku-4-5</code> | 77 | 27 | 0 | 203 |
| <code>anthropic/claude-opus-4-8</code> | 26 | 7 | 5 | 203 |
| <code>anthropic/claude-opus-5</code> | 19 | 7 | 4 | 203 |
| <code>anthropic/claude-sonnet-5</code> | 24 | 8 | 2 | 203 |
| <code>deepinfra/google/gemma-3-27b-it</code> | 57 | 35 | 2 | 203 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 40 | 12 | 6 | 203 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 47 | 0 | 10 | 203 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 32 | 7 | 1 | 203 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 28 | 4 | 1 | 203 |
| <code>gemini/gemini-3.1-pro-preview</code> | 13 | 5 | 0 | 203 |
| <code>gemini/gemini-3.5-flash</code> | 16 | 0 | 8 | 203 |
| <code>gemini/gemini-3.5-flash-lite</code> | 12 | 0 | 4 | 203 |
| <code>gemini/gemini-3.6-flash</code> | 16 | 1 | 6 | 203 |
| <code>glm/glm-ocr</code> | 45 | 0 | 393 | 203 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 70 | 0 | 62 | 203 |
| <code>grok/grok-4.3</code> | 32 | 5 | 3 | 203 |
| <code>grok/grok-4.5</code> | 24 | 2 | 1 | 203 |
| <code>kimi/kimi-k2.6</code> | 23 | 9 | 1 | 203 |
| <code>mistral/mistral-ocr-2512</code> | 23 | 0 | 7 | 203 |
| <code>mistral/mistral-ocr-4-0</code> | 11 | 1 | 4 | 203 |
| <code>openai/gpt-5.4-mini</code> | 39 | 2 | 1 | 203 |
| <code>openai/gpt-5.4-nano</code> | 85 | 40 | 1 | 203 |
| <code>openai/gpt-5.5</code> | 42 | 6 | 2 | 203 |
| <code>openai/gpt-5.6-luna</code> | 45 | 10 | 2 | 203 |
| <code>openai/gpt-5.6-sol</code> | 49 | 0 | 16 | 203 |
| <code>openai/gpt-5.6-terra</code> | 31 | 7 | 6 | 203 |

## Notes

- Best cloud service: `gemini/gemini-3.5-flash-lite` scored 92.12/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0064¢ ($0.0001).
- Fastest cloud service: `mistral/mistral-ocr-4-0` at 1.66s.
