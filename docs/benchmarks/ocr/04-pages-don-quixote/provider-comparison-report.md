# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/04-pages-don-quixote`
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
| 1 | <code>glm/glm-ocr</code> | $0.0003 | 98.43 | 1.57% | 1.46% | 14.26s | $0.0003 |
| 2 | <code>deepinfra/google/gemma-3-27b-it</code> | $0.0004 | 94.39 | 5.61% | 3.72% | 24.62s | $0.0004 |
| 3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0010 | 99.18 | 0.82% | 0.77% | 19.97s | $0.0010 |
| 4 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | $0.0014 | 98.95 | 1.05% | 1.02% | 20.75s | $0.0014 |
| 5 | <code>openai/gpt-5.4-nano</code> | $0.0034 | 38.82 | 61.18% | 60.48% | 881.78s | $0.0034 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0055 | 97.76 | 2.24% | 0.93% | 8.13s | $0.0055 |
| 7 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0058 | 97.61 | 2.39% | 1.06% | 37.89s | $0.0058 |
| 8 | <code>openai/gpt-5.6-luna</code> | $0.0079 | 99.63 | 0.37% | 0.25% | 20.06s | $0.0079 |
| 9 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0079 | 99.25 | 0.75% | 0.25% | 41.06s | $0.0079 |
| 10 | <code>mistral/mistral-ocr-2512</code> | $0.0080 | 99.93 | 0.07% | 0.04% | 7.55s | $0.0080 |
| 11 | <code>mistral/mistral-ocr-4-0</code> | $0.0160 | 99.70 | 0.30% | 0.21% | 6.15s | $0.0160 |
| 12 | <code>anthropic/claude-haiku-4-5</code> | $0.0161 | 97.76 | 2.24% | 0.89% | 34.44s | $0.0161 |
| 13 | <code>gemini/gemini-3.6-flash</code> | $0.0164 | 99.33 | 0.67% | 0.65% | 12.19s | $0.0164 |
| 14 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0172 | 98.73 | 1.27% | 1.09% | 7.09s | $0.0172 |
| 15 | <code>grok/grok-4.3</code> | $0.0174 | 99.03 | 0.97% | 0.41% | 14.83s | $0.0174 |
| 16 | <code>gemini/gemini-3.5-flash</code> | $0.0193 | 99.85 | 0.15% | 0.10% | 12.94s | $0.0193 |
| 17 | <code>kimi/kimi-k2.6</code> | $0.0231 | 99.33 | 0.67% | 0.24% | 21.42s | $0.0231 |
| 18 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0279 | 97.98 | 2.02% | 0.53% | 21.71s | $0.0279 |
| 19 | <code>grok/grok-4.5</code> | $0.0340 | 98.20 | 1.80% | 0.53% | 22.70s | $0.0340 |
| 20 | <code>anthropic/claude-sonnet-5</code> | $0.0374 | 99.78 | 0.22% | 0.19% | 34.76s | $0.0374 |
| 21 | <code>openai/gpt-5.6-terra</code> | $0.0625 | 98.28 | 1.72% | 0.34% | 12.03s | $0.0625 |
| 22 | <code>anthropic/claude-opus-5</code> | $0.0935 | 99.78 | 0.22% | 0.19% | 41.74s | $0.0935 |
| 23 | <code>anthropic/claude-opus-4-8</code> | $0.0943 | 99.78 | 0.22% | 0.19% | 44.75s | $0.0943 |
| 24 | <code>openai/gpt-5.6-sol</code> | $0.1555 | 99.70 | 0.30% | 0.38% | 18.83s | $0.1555 |
| 25 | <code>openai/gpt-5.5</code> | $0.1795 | 98.35 | 1.65% | 0.34% | 31.72s | $0.1795 |
| 26 | <code>anthropic/claude-fable-5</code> | $0.1871 | 99.78 | 0.22% | 0.19% | 37.14s | $0.1871 |
| 27 | <code>kimi/kimi-k3</code> | $0.4044 | 99.33 | 0.67% | 0.25% | 484.71s | $0.4044 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-0</code> | 6.15s | 99.70 | 0.30% | 0.21% | 6.15s | $0.0160 |
| 2 | <code>grok/grok-4.20-0309-non-reasoning</code> | 7.09s | 98.73 | 1.27% | 1.09% | 7.09s | $0.0172 |
| 3 | <code>mistral/mistral-ocr-2512</code> | 7.55s | 99.93 | 0.07% | 0.04% | 7.55s | $0.0080 |
| 4 | <code>gemini/gemini-3.5-flash-lite</code> | 8.13s | 97.76 | 2.24% | 0.93% | 8.13s | $0.0055 |
| 5 | <code>openai/gpt-5.6-terra</code> | 12.03s | 98.28 | 1.72% | 0.34% | 12.03s | $0.0625 |
| 6 | <code>gemini/gemini-3.6-flash</code> | 12.19s | 99.33 | 0.67% | 0.65% | 12.19s | $0.0164 |
| 7 | <code>gemini/gemini-3.5-flash</code> | 12.94s | 99.85 | 0.15% | 0.10% | 12.94s | $0.0193 |
| 8 | <code>glm/glm-ocr</code> | 14.26s | 98.43 | 1.57% | 1.46% | 14.26s | $0.0003 |
| 9 | <code>grok/grok-4.3</code> | 14.83s | 99.03 | 0.97% | 0.41% | 14.83s | $0.0174 |
| 10 | <code>openai/gpt-5.6-sol</code> | 18.83s | 99.70 | 0.30% | 0.38% | 18.83s | $0.1555 |
| 11 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 19.97s | 99.18 | 0.82% | 0.77% | 19.97s | $0.0010 |
| 12 | <code>openai/gpt-5.6-luna</code> | 20.06s | 99.63 | 0.37% | 0.25% | 20.06s | $0.0079 |
| 13 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 20.75s | 98.95 | 1.05% | 1.02% | 20.75s | $0.0014 |
| 14 | <code>kimi/kimi-k2.6</code> | 21.42s | 99.33 | 0.67% | 0.24% | 21.42s | $0.0231 |
| 15 | <code>gemini/gemini-3.1-pro-preview</code> | 21.71s | 97.98 | 2.02% | 0.53% | 21.71s | $0.0279 |
| 16 | <code>grok/grok-4.5</code> | 22.70s | 98.20 | 1.80% | 0.53% | 22.70s | $0.0340 |
| 17 | <code>deepinfra/google/gemma-3-27b-it</code> | 24.62s | 94.39 | 5.61% | 3.72% | 24.62s | $0.0004 |
| 18 | <code>openai/gpt-5.5</code> | 31.72s | 98.35 | 1.65% | 0.34% | 31.72s | $0.1795 |
| 19 | <code>anthropic/claude-haiku-4-5</code> | 34.44s | 97.76 | 2.24% | 0.89% | 34.44s | $0.0161 |
| 20 | <code>anthropic/claude-sonnet-5</code> | 34.76s | 99.78 | 0.22% | 0.19% | 34.76s | $0.0374 |
| 21 | <code>anthropic/claude-fable-5</code> | 37.14s | 99.78 | 0.22% | 0.19% | 37.14s | $0.1871 |
| 22 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 37.89s | 97.61 | 2.39% | 1.06% | 37.89s | $0.0058 |
| 23 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 41.06s | 99.25 | 0.75% | 0.25% | 41.06s | $0.0079 |
| 24 | <code>anthropic/claude-opus-5</code> | 41.74s | 99.78 | 0.22% | 0.19% | 41.74s | $0.0935 |
| 25 | <code>anthropic/claude-opus-4-8</code> | 44.75s | 99.78 | 0.22% | 0.19% | 44.75s | $0.0943 |
| 26 | <code>kimi/kimi-k3</code> | 484.71s | 99.33 | 0.67% | 0.25% | 484.71s | $0.4044 |
| 27 | <code>openai/gpt-5.4-nano</code> | 881.78s | 38.82 | 61.18% | 60.48% | 881.78s | $0.0034 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-2512</code> | 99.93/100 quality score | 99.93 | 0.07% | 0.04% | 7.55s | $0.0080 |
| 2 | <code>gemini/gemini-3.5-flash</code> | 99.85/100 quality score | 99.85 | 0.15% | 0.10% | 12.94s | $0.0193 |
| 3 | <code>anthropic/claude-fable-5</code> | 99.78/100 quality score | 99.78 | 0.22% | 0.19% | 37.14s | $0.1871 |
| 4 | <code>anthropic/claude-opus-4-8</code> | 99.78/100 quality score | 99.78 | 0.22% | 0.19% | 44.75s | $0.0943 |
| 5 | <code>anthropic/claude-opus-5</code> | 99.78/100 quality score | 99.78 | 0.22% | 0.19% | 41.74s | $0.0935 |
| 6 | <code>anthropic/claude-sonnet-5</code> | 99.78/100 quality score | 99.78 | 0.22% | 0.19% | 34.76s | $0.0374 |
| 7 | <code>mistral/mistral-ocr-4-0</code> | 99.70/100 quality score | 99.70 | 0.30% | 0.21% | 6.15s | $0.0160 |
| 8 | <code>openai/gpt-5.6-sol</code> | 99.70/100 quality score | 99.70 | 0.30% | 0.38% | 18.83s | $0.1555 |
| 9 | <code>openai/gpt-5.6-luna</code> | 99.63/100 quality score | 99.63 | 0.37% | 0.25% | 20.06s | $0.0079 |
| 10 | <code>kimi/kimi-k2.6</code> | 99.33/100 quality score | 99.33 | 0.67% | 0.24% | 21.42s | $0.0231 |
| 11 | <code>kimi/kimi-k3</code> | 99.33/100 quality score | 99.33 | 0.67% | 0.25% | 484.71s | $0.4044 |
| 12 | <code>gemini/gemini-3.6-flash</code> | 99.33/100 quality score | 99.33 | 0.67% | 0.65% | 12.19s | $0.0164 |
| 13 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 99.25/100 quality score | 99.25 | 0.75% | 0.25% | 41.06s | $0.0079 |
| 14 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 99.18/100 quality score | 99.18 | 0.82% | 0.77% | 19.97s | $0.0010 |
| 15 | <code>grok/grok-4.3</code> | 99.03/100 quality score | 99.03 | 0.97% | 0.41% | 14.83s | $0.0174 |
| 16 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 98.95/100 quality score | 98.95 | 1.05% | 1.02% | 20.75s | $0.0014 |
| 17 | <code>grok/grok-4.20-0309-non-reasoning</code> | 98.73/100 quality score | 98.73 | 1.27% | 1.09% | 7.09s | $0.0172 |
| 18 | <code>glm/glm-ocr</code> | 98.43/100 quality score | 98.43 | 1.57% | 1.46% | 14.26s | $0.0003 |
| 19 | <code>openai/gpt-5.5</code> | 98.35/100 quality score | 98.35 | 1.65% | 0.34% | 31.72s | $0.1795 |
| 20 | <code>openai/gpt-5.6-terra</code> | 98.28/100 quality score | 98.28 | 1.72% | 0.34% | 12.03s | $0.0625 |
| 21 | <code>grok/grok-4.5</code> | 98.20/100 quality score | 98.20 | 1.80% | 0.53% | 22.70s | $0.0340 |
| 22 | <code>gemini/gemini-3.1-pro-preview</code> | 97.98/100 quality score | 97.98 | 2.02% | 0.53% | 21.71s | $0.0279 |
| 23 | <code>anthropic/claude-haiku-4-5</code> | 97.76/100 quality score | 97.76 | 2.24% | 0.89% | 34.44s | $0.0161 |
| 24 | <code>gemini/gemini-3.5-flash-lite</code> | 97.76/100 quality score | 97.76 | 2.24% | 0.93% | 8.13s | $0.0055 |
| 25 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 97.61/100 quality score | 97.61 | 2.39% | 1.06% | 37.89s | $0.0058 |
| 26 | <code>deepinfra/google/gemma-3-27b-it</code> | 94.39/100 quality score | 94.39 | 5.61% | 3.72% | 24.62s | $0.0004 |
| 27 | <code>openai/gpt-5.4-nano</code> | 38.82/100 quality score | 38.82 | 61.18% | 60.48% | 881.78s | $0.0034 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 99.78 | 0.22% | 0.19% | 37.14s | $0.1871 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 97.76 | 2.24% | 0.89% | 34.44s | $0.0161 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 99.78 | 0.22% | 0.19% | 44.75s | $0.0943 |
| <code>anthropic/claude-opus-5</code> | Third-Party Service | 99.78 | 0.22% | 0.19% | 41.74s | $0.0935 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 99.78 | 0.22% | 0.19% | 34.76s | $0.0374 |
| <code>deepinfra/google/gemma-3-27b-it</code> | Third-Party Service | 94.39 | 5.61% | 3.72% | 24.62s | $0.0004 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | Third-Party Service | 98.95 | 1.05% | 1.02% | 20.75s | $0.0014 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service | 99.18 | 0.82% | 0.77% | 19.97s | $0.0010 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 99.25 | 0.75% | 0.25% | 41.06s | $0.0079 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 97.61 | 2.39% | 1.06% | 37.89s | $0.0058 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 97.98 | 2.02% | 0.53% | 21.71s | $0.0279 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 99.85 | 0.15% | 0.10% | 12.94s | $0.0193 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 97.76 | 2.24% | 0.93% | 8.13s | $0.0055 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 99.33 | 0.67% | 0.65% | 12.19s | $0.0164 |
| <code>glm/glm-ocr</code> | Third-Party Service | 98.43 | 1.57% | 1.46% | 14.26s | $0.0003 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 98.73 | 1.27% | 1.09% | 7.09s | $0.0172 |
| <code>grok/grok-4.3</code> | Third-Party Service | 99.03 | 0.97% | 0.41% | 14.83s | $0.0174 |
| <code>grok/grok-4.5</code> | Third-Party Service | 98.20 | 1.80% | 0.53% | 22.70s | $0.0340 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 99.33 | 0.67% | 0.24% | 21.42s | $0.0231 |
| <code>kimi/kimi-k3</code> | Third-Party Service | 99.33 | 0.67% | 0.25% | 484.71s | $0.4044 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 99.93 | 0.07% | 0.04% | 7.55s | $0.0080 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 99.70 | 0.30% | 0.21% | 6.15s | $0.0160 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 38.82 | 61.18% | 60.48% | 881.78s | $0.0034 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 98.35 | 1.65% | 0.34% | 31.72s | $0.1795 |
| <code>openai/gpt-5.6-luna</code> | Third-Party Service | 99.63 | 0.37% | 0.25% | 20.06s | $0.0079 |
| <code>openai/gpt-5.6-sol</code> | Third-Party Service | 99.70 | 0.30% | 0.38% | 18.83s | $0.1555 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 98.28 | 1.72% | 0.34% | 12.03s | $0.0625 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | 2 | 1 | 0 | 1337 |
| <code>anthropic/claude-haiku-4-5</code> | 10 | 10 | 10 | 1337 |
| <code>anthropic/claude-opus-4-8</code> | 2 | 1 | 0 | 1337 |
| <code>anthropic/claude-opus-5</code> | 2 | 1 | 0 | 1337 |
| <code>anthropic/claude-sonnet-5</code> | 2 | 1 | 0 | 1337 |
| <code>deepinfra/google/gemma-3-27b-it</code> | 30 | 33 | 12 | 1337 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 0 | 14 | 0 | 1337 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 0 | 11 | 0 | 1337 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 4 | 2 | 4 | 1337 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 10 | 12 | 10 | 1337 |
| <code>gemini/gemini-3.1-pro-preview</code> | 12 | 5 | 10 | 1337 |
| <code>gemini/gemini-3.5-flash</code> | 2 | 0 | 0 | 1337 |
| <code>gemini/gemini-3.5-flash-lite</code> | 10 | 11 | 9 | 1337 |
| <code>gemini/gemini-3.6-flash</code> | 1 | 8 | 0 | 1337 |
| <code>glm/glm-ocr</code> | 3 | 17 | 1 | 1337 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 1 | 15 | 1 | 1337 |
| <code>grok/grok-4.3</code> | 4 | 5 | 4 | 1337 |
| <code>grok/grok-4.5</code> | 10 | 4 | 10 | 1337 |
| <code>kimi/kimi-k2.6</code> | 5 | 1 | 3 | 1337 |
| <code>kimi/kimi-k3</code> | 4 | 2 | 3 | 1337 |
| <code>mistral/mistral-ocr-2512</code> | 1 | 0 | 0 | 1337 |
| <code>mistral/mistral-ocr-4-0</code> | 1 | 2 | 1 | 1337 |
| <code>openai/gpt-5.4-nano</code> | 6 | 811 | 1 | 1337 |
| <code>openai/gpt-5.5</code> | 10 | 2 | 10 | 1337 |
| <code>openai/gpt-5.6-luna</code> | 1 | 3 | 1 | 1337 |
| <code>openai/gpt-5.6-sol</code> | 0 | 4 | 0 | 1337 |
| <code>openai/gpt-5.6-terra</code> | 11 | 2 | 10 | 1337 |

## Notes

- Best cloud service: `mistral/mistral-ocr-2512` scored 99.93/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0340¢ ($0.0003).
- Fastest cloud service: `mistral/mistral-ocr-4-0` at 6.15s.
