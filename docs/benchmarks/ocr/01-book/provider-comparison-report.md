# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/01-book`
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
| 1 | <code>glm/glm-ocr</code> | $0.0000 | 80.75 | 19.25% | 11.91% | 1.37s | $0.0000 |
| 2 | <code>deepinfra/google/gemma-3-27b-it</code> | $0.0001 | 95.77 | 4.23% | 1.45% | 21.73s | $0.0001 |
| 3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0002 | 93.90 | 6.10% | 0.82% | 4.03s | $0.0002 |
| 4 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | $0.0003 | 95.77 | 4.23% | 0.82% | 8.22s | $0.0003 |
| 5 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0004 | 93.43 | 6.57% | 0.91% | 8.43s | $0.0004 |
| 6 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0006 | 99.53 | 0.47% | 0.09% | 18.37s | $0.0006 |
| 7 | <code>openai/gpt-5.4-nano</code> | $0.0008 | 92.02 | 7.98% | 1.82% | 2.67s | $0.0008 |
| 8 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0014 | 99.06 | 0.94% | 0.18% | 1.96s | $0.0014 |
| 9 | <code>openai/gpt-5.6-luna</code> | $0.0017 | 97.18 | 2.82% | 0.55% | 5.73s | $0.0017 |
| 10 | <code>mistral/mistral-ocr-2512</code> | $0.0020 | 92.96 | 7.04% | 0.91% | 2.22s | $0.0020 |
| 11 | <code>openai/gpt-5.4-mini</code> | $0.0029 | 99.06 | 0.94% | 0.27% | 1.98s | $0.0029 |
| 12 | <code>grok/grok-4.3</code> | $0.0030 | 99.53 | 0.47% | 0.09% | 6.07s | $0.0030 |
| 13 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0030 | 99.53 | 0.47% | 0.18% | 3.05s | $0.0030 |
| 14 | <code>kimi/kimi-k2.6</code> | $0.0035 | 100.00 | 0.00% | 0.00% | 9.88s | $0.0035 |
| 15 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 93.43 | 6.57% | 0.82% | 0.84s | $0.0040 |
| 16 | <code>anthropic/claude-haiku-4-5</code> | $0.0041 | 99.06 | 0.94% | 0.09% | 7.41s | $0.0041 |
| 17 | <code>gemini/gemini-3.6-flash</code> | $0.0046 | 100.00 | 0.00% | 0.00% | 2.63s | $0.0046 |
| 18 | <code>gemini/gemini-3.5-flash</code> | $0.0054 | 99.53 | 0.47% | 0.09% | 2.13s | $0.0054 |
| 19 | <code>grok/grok-4.5</code> | $0.0061 | 99.53 | 0.47% | 0.09% | 14.68s | $0.0061 |
| 20 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0072 | 99.06 | 0.94% | 0.27% | 4.91s | $0.0072 |
| 21 | <code>anthropic/claude-sonnet-5</code> | $0.0104 | 100.00 | 0.00% | 0.00% | 9.46s | $0.0104 |
| 22 | <code>openai/gpt-5.6-terra</code> | $0.0112 | 99.06 | 0.94% | 0.18% | 5.11s | $0.0112 |
| 23 | <code>anthropic/claude-opus-5</code> | $0.0259 | 96.24 | 3.76% | 0.73% | 12.76s | $0.0259 |
| 24 | <code>anthropic/claude-opus-4-8</code> | $0.0261 | 96.24 | 3.76% | 0.64% | 13.71s | $0.0261 |
| 25 | <code>openai/gpt-5.6-sol</code> | $0.0320 | 99.06 | 0.94% | 0.27% | 7.54s | $0.0320 |
| 26 | <code>openai/gpt-5.5</code> | $0.0348 | 99.53 | 0.47% | 0.09% | 8.27s | $0.0348 |
| 27 | <code>anthropic/claude-fable-5</code> | $0.0521 | 100.00 | 0.00% | 0.00% | 11.67s | $0.0521 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-0</code> | 0.84s | 93.43 | 6.57% | 0.82% | 0.84s | $0.0040 |
| 2 | <code>glm/glm-ocr</code> | 1.37s | 80.75 | 19.25% | 11.91% | 1.37s | $0.0000 |
| 3 | <code>gemini/gemini-3.5-flash-lite</code> | 1.96s | 99.06 | 0.94% | 0.18% | 1.96s | $0.0014 |
| 4 | <code>openai/gpt-5.4-mini</code> | 1.98s | 99.06 | 0.94% | 0.27% | 1.98s | $0.0029 |
| 5 | <code>gemini/gemini-3.5-flash</code> | 2.13s | 99.53 | 0.47% | 0.09% | 2.13s | $0.0054 |
| 6 | <code>mistral/mistral-ocr-2512</code> | 2.22s | 92.96 | 7.04% | 0.91% | 2.22s | $0.0020 |
| 7 | <code>gemini/gemini-3.6-flash</code> | 2.63s | 100.00 | 0.00% | 0.00% | 2.63s | $0.0046 |
| 8 | <code>openai/gpt-5.4-nano</code> | 2.67s | 92.02 | 7.98% | 1.82% | 2.67s | $0.0008 |
| 9 | <code>grok/grok-4.20-0309-non-reasoning</code> | 3.05s | 99.53 | 0.47% | 0.18% | 3.05s | $0.0030 |
| 10 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 4.03s | 93.90 | 6.10% | 0.82% | 4.03s | $0.0002 |
| 11 | <code>gemini/gemini-3.1-pro-preview</code> | 4.91s | 99.06 | 0.94% | 0.27% | 4.91s | $0.0072 |
| 12 | <code>openai/gpt-5.6-terra</code> | 5.11s | 99.06 | 0.94% | 0.18% | 5.11s | $0.0112 |
| 13 | <code>openai/gpt-5.6-luna</code> | 5.73s | 97.18 | 2.82% | 0.55% | 5.73s | $0.0017 |
| 14 | <code>grok/grok-4.3</code> | 6.07s | 99.53 | 0.47% | 0.09% | 6.07s | $0.0030 |
| 15 | <code>anthropic/claude-haiku-4-5</code> | 7.41s | 99.06 | 0.94% | 0.09% | 7.41s | $0.0041 |
| 16 | <code>openai/gpt-5.6-sol</code> | 7.54s | 99.06 | 0.94% | 0.27% | 7.54s | $0.0320 |
| 17 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 8.22s | 95.77 | 4.23% | 0.82% | 8.22s | $0.0003 |
| 18 | <code>openai/gpt-5.5</code> | 8.27s | 99.53 | 0.47% | 0.09% | 8.27s | $0.0348 |
| 19 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 8.43s | 93.43 | 6.57% | 0.91% | 8.43s | $0.0004 |
| 20 | <code>anthropic/claude-sonnet-5</code> | 9.46s | 100.00 | 0.00% | 0.00% | 9.46s | $0.0104 |
| 21 | <code>kimi/kimi-k2.6</code> | 9.88s | 100.00 | 0.00% | 0.00% | 9.88s | $0.0035 |
| 22 | <code>anthropic/claude-fable-5</code> | 11.67s | 100.00 | 0.00% | 0.00% | 11.67s | $0.0521 |
| 23 | <code>anthropic/claude-opus-5</code> | 12.76s | 96.24 | 3.76% | 0.73% | 12.76s | $0.0259 |
| 24 | <code>anthropic/claude-opus-4-8</code> | 13.71s | 96.24 | 3.76% | 0.64% | 13.71s | $0.0261 |
| 25 | <code>grok/grok-4.5</code> | 14.68s | 99.53 | 0.47% | 0.09% | 14.68s | $0.0061 |
| 26 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 18.37s | 99.53 | 0.47% | 0.09% | 18.37s | $0.0006 |
| 27 | <code>deepinfra/google/gemma-3-27b-it</code> | 21.73s | 95.77 | 4.23% | 1.45% | 21.73s | $0.0001 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 11.67s | $0.0521 |
| 2 | <code>anthropic/claude-sonnet-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 9.46s | $0.0104 |
| 3 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.63s | $0.0046 |
| 4 | <code>kimi/kimi-k2.6</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 9.88s | $0.0035 |
| 5 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 99.53/100 quality score | 99.53 | 0.47% | 0.09% | 18.37s | $0.0006 |
| 6 | <code>gemini/gemini-3.5-flash</code> | 99.53/100 quality score | 99.53 | 0.47% | 0.09% | 2.13s | $0.0054 |
| 7 | <code>grok/grok-4.3</code> | 99.53/100 quality score | 99.53 | 0.47% | 0.09% | 6.07s | $0.0030 |
| 8 | <code>grok/grok-4.5</code> | 99.53/100 quality score | 99.53 | 0.47% | 0.09% | 14.68s | $0.0061 |
| 9 | <code>openai/gpt-5.5</code> | 99.53/100 quality score | 99.53 | 0.47% | 0.09% | 8.27s | $0.0348 |
| 10 | <code>grok/grok-4.20-0309-non-reasoning</code> | 99.53/100 quality score | 99.53 | 0.47% | 0.18% | 3.05s | $0.0030 |
| 11 | <code>anthropic/claude-haiku-4-5</code> | 99.06/100 quality score | 99.06 | 0.94% | 0.09% | 7.41s | $0.0041 |
| 12 | <code>gemini/gemini-3.5-flash-lite</code> | 99.06/100 quality score | 99.06 | 0.94% | 0.18% | 1.96s | $0.0014 |
| 13 | <code>openai/gpt-5.6-terra</code> | 99.06/100 quality score | 99.06 | 0.94% | 0.18% | 5.11s | $0.0112 |
| 14 | <code>gemini/gemini-3.1-pro-preview</code> | 99.06/100 quality score | 99.06 | 0.94% | 0.27% | 4.91s | $0.0072 |
| 15 | <code>openai/gpt-5.4-mini</code> | 99.06/100 quality score | 99.06 | 0.94% | 0.27% | 1.98s | $0.0029 |
| 16 | <code>openai/gpt-5.6-sol</code> | 99.06/100 quality score | 99.06 | 0.94% | 0.27% | 7.54s | $0.0320 |
| 17 | <code>openai/gpt-5.6-luna</code> | 97.18/100 quality score | 97.18 | 2.82% | 0.55% | 5.73s | $0.0017 |
| 18 | <code>anthropic/claude-opus-4-8</code> | 96.24/100 quality score | 96.24 | 3.76% | 0.64% | 13.71s | $0.0261 |
| 19 | <code>anthropic/claude-opus-5</code> | 96.24/100 quality score | 96.24 | 3.76% | 0.73% | 12.76s | $0.0259 |
| 20 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 95.77/100 quality score | 95.77 | 4.23% | 0.82% | 8.22s | $0.0003 |
| 21 | <code>deepinfra/google/gemma-3-27b-it</code> | 95.77/100 quality score | 95.77 | 4.23% | 1.45% | 21.73s | $0.0001 |
| 22 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 93.90/100 quality score | 93.90 | 6.10% | 0.82% | 4.03s | $0.0002 |
| 23 | <code>mistral/mistral-ocr-4-0</code> | 93.43/100 quality score | 93.43 | 6.57% | 0.82% | 0.84s | $0.0040 |
| 24 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 93.43/100 quality score | 93.43 | 6.57% | 0.91% | 8.43s | $0.0004 |
| 25 | <code>mistral/mistral-ocr-2512</code> | 92.96/100 quality score | 92.96 | 7.04% | 0.91% | 2.22s | $0.0020 |
| 26 | <code>openai/gpt-5.4-nano</code> | 92.02/100 quality score | 92.02 | 7.98% | 1.82% | 2.67s | $0.0008 |
| 27 | <code>glm/glm-ocr</code> | 80.75/100 quality score | 80.75 | 19.25% | 11.91% | 1.37s | $0.0000 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 11.67s | $0.0521 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 99.06 | 0.94% | 0.09% | 7.41s | $0.0041 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 96.24 | 3.76% | 0.64% | 13.71s | $0.0261 |
| <code>anthropic/claude-opus-5</code> | Third-Party Service | 96.24 | 3.76% | 0.73% | 12.76s | $0.0259 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 9.46s | $0.0104 |
| <code>deepinfra/google/gemma-3-27b-it</code> | Third-Party Service | 95.77 | 4.23% | 1.45% | 21.73s | $0.0001 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | Third-Party Service | 95.77 | 4.23% | 0.82% | 8.22s | $0.0003 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service | 93.90 | 6.10% | 0.82% | 4.03s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 99.53 | 0.47% | 0.09% | 18.37s | $0.0006 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 93.43 | 6.57% | 0.91% | 8.43s | $0.0004 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 99.06 | 0.94% | 0.27% | 4.91s | $0.0072 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 99.53 | 0.47% | 0.09% | 2.13s | $0.0054 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 99.06 | 0.94% | 0.18% | 1.96s | $0.0014 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.63s | $0.0046 |
| <code>glm/glm-ocr</code> | Third-Party Service | 80.75 | 19.25% | 11.91% | 1.37s | $0.0000 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 99.53 | 0.47% | 0.18% | 3.05s | $0.0030 |
| <code>grok/grok-4.3</code> | Third-Party Service | 99.53 | 0.47% | 0.09% | 6.07s | $0.0030 |
| <code>grok/grok-4.5</code> | Third-Party Service | 99.53 | 0.47% | 0.09% | 14.68s | $0.0061 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 9.88s | $0.0035 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 92.96 | 7.04% | 0.91% | 2.22s | $0.0020 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 93.43 | 6.57% | 0.82% | 0.84s | $0.0040 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 99.06 | 0.94% | 0.27% | 1.98s | $0.0029 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 92.02 | 7.98% | 1.82% | 2.67s | $0.0008 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 99.53 | 0.47% | 0.09% | 8.27s | $0.0348 |
| <code>openai/gpt-5.6-luna</code> | Third-Party Service | 97.18 | 2.82% | 0.55% | 5.73s | $0.0017 |
| <code>openai/gpt-5.6-sol</code> | Third-Party Service | 99.06 | 0.94% | 0.27% | 7.54s | $0.0320 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 99.06 | 0.94% | 0.18% | 5.11s | $0.0112 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 0 | 213 |
| <code>anthropic/claude-haiku-4-5</code> | 1 | 1 | 0 | 213 |
| <code>anthropic/claude-opus-4-8</code> | 1 | 0 | 7 | 213 |
| <code>anthropic/claude-opus-5</code> | 1 | 0 | 7 | 213 |
| <code>anthropic/claude-sonnet-5</code> | 0 | 0 | 0 | 213 |
| <code>deepinfra/google/gemma-3-27b-it</code> | 8 | 0 | 1 | 213 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 6 | 3 | 0 | 213 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 7 | 6 | 0 | 213 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 1 | 0 | 0 | 213 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 8 | 6 | 0 | 213 |
| <code>gemini/gemini-3.1-pro-preview</code> | 2 | 0 | 0 | 213 |
| <code>gemini/gemini-3.5-flash</code> | 1 | 0 | 0 | 213 |
| <code>gemini/gemini-3.5-flash-lite</code> | 2 | 0 | 0 | 213 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 213 |
| <code>glm/glm-ocr</code> | 7 | 34 | 0 | 213 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 1 | 0 | 0 | 213 |
| <code>grok/grok-4.3</code> | 1 | 0 | 0 | 213 |
| <code>grok/grok-4.5</code> | 1 | 0 | 0 | 213 |
| <code>kimi/kimi-k2.6</code> | 0 | 0 | 0 | 213 |
| <code>mistral/mistral-ocr-2512</code> | 9 | 6 | 0 | 213 |
| <code>mistral/mistral-ocr-4-0</code> | 8 | 6 | 0 | 213 |
| <code>openai/gpt-5.4-mini</code> | 2 | 0 | 0 | 213 |
| <code>openai/gpt-5.4-nano</code> | 12 | 1 | 4 | 213 |
| <code>openai/gpt-5.5</code> | 1 | 0 | 0 | 213 |
| <code>openai/gpt-5.6-luna</code> | 5 | 1 | 0 | 213 |
| <code>openai/gpt-5.6-sol</code> | 2 | 0 | 0 | 213 |
| <code>openai/gpt-5.6-terra</code> | 2 | 0 | 0 | 213 |

## Notes

- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0047¢ ($0.0000).
- Fastest cloud service: `mistral/mistral-ocr-4-0` at 0.84s.
