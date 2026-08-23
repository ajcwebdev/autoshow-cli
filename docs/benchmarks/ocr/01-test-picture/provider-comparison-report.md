# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/01-test-picture`
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
| 1 | <code>glm/glm-ocr</code> | $0.0000 | 100.00 | 0.00% | 0.00% | 0.97s | $0.0000 |
| 2 | <code>deepinfra/google/gemma-3-27b-it</code> | $0.0000 | 100.00 | 0.00% | 0.00% | 1.58s | $0.0000 |
| 3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0001 | 100.00 | 0.00% | 0.00% | 1.02s | $0.0001 |
| 4 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0002 | 80.00 | 20.00% | 20.22% | 1.17s | $0.0002 |
| 5 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | $0.0002 | 100.00 | 0.00% | 0.00% | 1.30s | $0.0002 |
| 6 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0002 | 100.00 | 0.00% | 0.00% | 1.42s | $0.0002 |
| 7 | <code>openai/gpt-5.4-nano</code> | $0.0003 | 100.00 | 0.00% | 0.00% | 0.90s | $0.0003 |
| 8 | <code>openai/gpt-5.6-luna</code> | $0.0003 | 100.00 | 0.00% | 0.00% | 1.03s | $0.0003 |
| 9 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0005 | 100.00 | 0.00% | 0.00% | 0.91s | $0.0005 |
| 10 | <code>openai/gpt-5.4-mini</code> | $0.0010 | 100.00 | 0.00% | 0.00% | 0.82s | $0.0010 |
| 11 | <code>kimi/kimi-k2.6</code> | $0.0014 | 100.00 | 0.00% | 0.00% | 2.81s | $0.0014 |
| 12 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0016 | 100.00 | 0.00% | 0.00% | 0.68s | $0.0016 |
| 13 | <code>grok/grok-4.3</code> | $0.0016 | 100.00 | 0.00% | 0.00% | 3.64s | $0.0016 |
| 14 | <code>anthropic/claude-haiku-4-5</code> | $0.0018 | 100.00 | 0.00% | 0.00% | 1.06s | $0.0018 |
| 15 | <code>mistral/mistral-ocr-2512</code> | $0.0020 | 100.00 | 0.00% | 0.00% | 0.70s | $0.0020 |
| 16 | <code>gemini/gemini-3.5-flash</code> | $0.0022 | 100.00 | 0.00% | 0.00% | 1.28s | $0.0022 |
| 17 | <code>gemini/gemini-3.6-flash</code> | $0.0023 | 100.00 | 0.00% | 0.00% | 1.14s | $0.0023 |
| 18 | <code>openai/gpt-5.6-terra</code> | $0.0028 | 100.00 | 0.00% | 0.00% | 1.07s | $0.0028 |
| 19 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0029 | 100.00 | 0.00% | 0.00% | 2.44s | $0.0029 |
| 20 | <code>grok/grok-4.5</code> | $0.0032 | 100.00 | 0.00% | 0.00% | 2.22s | $0.0032 |
| 21 | <code>anthropic/claude-sonnet-5</code> | $0.0038 | 100.00 | 0.00% | 0.00% | 1.79s | $0.0038 |
| 22 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 100.00 | 0.00% | 0.00% | 0.60s | $0.0040 |
| 23 | <code>openai/gpt-5.5</code> | $0.0070 | 100.00 | 0.00% | 0.00% | 1.28s | $0.0070 |
| 24 | <code>openai/gpt-5.6-sol</code> | $0.0070 | 100.00 | 0.00% | 0.00% | 1.43s | $0.0070 |
| 25 | <code>kimi/kimi-k3</code> | $0.0082 | 100.00 | 0.00% | 0.00% | 13.05s | $0.0082 |
| 26 | <code>anthropic/claude-opus-4-8</code> | $0.0095 | 100.00 | 0.00% | 0.00% | 2.76s | $0.0095 |
| 27 | <code>anthropic/claude-opus-5</code> | $0.0095 | 100.00 | 0.00% | 0.00% | 1.98s | $0.0095 |
| 28 | <code>anthropic/claude-fable-5</code> | $0.0189 | 100.00 | 0.00% | 0.00% | 3.77s | $0.0189 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-0</code> | 0.60s | 100.00 | 0.00% | 0.00% | 0.60s | $0.0040 |
| 2 | <code>grok/grok-4.20-0309-non-reasoning</code> | 0.68s | 100.00 | 0.00% | 0.00% | 0.68s | $0.0016 |
| 3 | <code>mistral/mistral-ocr-2512</code> | 0.70s | 100.00 | 0.00% | 0.00% | 0.70s | $0.0020 |
| 4 | <code>openai/gpt-5.4-mini</code> | 0.82s | 100.00 | 0.00% | 0.00% | 0.82s | $0.0010 |
| 5 | <code>openai/gpt-5.4-nano</code> | 0.90s | 100.00 | 0.00% | 0.00% | 0.90s | $0.0003 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | 0.91s | 100.00 | 0.00% | 0.00% | 0.91s | $0.0005 |
| 7 | <code>glm/glm-ocr</code> | 0.97s | 100.00 | 0.00% | 0.00% | 0.97s | $0.0000 |
| 8 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 1.02s | 100.00 | 0.00% | 0.00% | 1.02s | $0.0001 |
| 9 | <code>openai/gpt-5.6-luna</code> | 1.03s | 100.00 | 0.00% | 0.00% | 1.03s | $0.0003 |
| 10 | <code>anthropic/claude-haiku-4-5</code> | 1.06s | 100.00 | 0.00% | 0.00% | 1.06s | $0.0018 |
| 11 | <code>openai/gpt-5.6-terra</code> | 1.07s | 100.00 | 0.00% | 0.00% | 1.07s | $0.0028 |
| 12 | <code>gemini/gemini-3.6-flash</code> | 1.14s | 100.00 | 0.00% | 0.00% | 1.14s | $0.0023 |
| 13 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 1.17s | 80.00 | 20.00% | 20.22% | 1.17s | $0.0002 |
| 14 | <code>gemini/gemini-3.5-flash</code> | 1.28s | 100.00 | 0.00% | 0.00% | 1.28s | $0.0022 |
| 15 | <code>openai/gpt-5.5</code> | 1.28s | 100.00 | 0.00% | 0.00% | 1.28s | $0.0070 |
| 16 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 1.30s | 100.00 | 0.00% | 0.00% | 1.30s | $0.0002 |
| 17 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 1.42s | 100.00 | 0.00% | 0.00% | 1.42s | $0.0002 |
| 18 | <code>openai/gpt-5.6-sol</code> | 1.43s | 100.00 | 0.00% | 0.00% | 1.43s | $0.0070 |
| 19 | <code>deepinfra/google/gemma-3-27b-it</code> | 1.58s | 100.00 | 0.00% | 0.00% | 1.58s | $0.0000 |
| 20 | <code>anthropic/claude-sonnet-5</code> | 1.79s | 100.00 | 0.00% | 0.00% | 1.79s | $0.0038 |
| 21 | <code>anthropic/claude-opus-5</code> | 1.98s | 100.00 | 0.00% | 0.00% | 1.98s | $0.0095 |
| 22 | <code>grok/grok-4.5</code> | 2.22s | 100.00 | 0.00% | 0.00% | 2.22s | $0.0032 |
| 23 | <code>gemini/gemini-3.1-pro-preview</code> | 2.44s | 100.00 | 0.00% | 0.00% | 2.44s | $0.0029 |
| 24 | <code>anthropic/claude-opus-4-8</code> | 2.76s | 100.00 | 0.00% | 0.00% | 2.76s | $0.0095 |
| 25 | <code>kimi/kimi-k2.6</code> | 2.81s | 100.00 | 0.00% | 0.00% | 2.81s | $0.0014 |
| 26 | <code>grok/grok-4.3</code> | 3.64s | 100.00 | 0.00% | 0.00% | 3.64s | $0.0016 |
| 27 | <code>anthropic/claude-fable-5</code> | 3.77s | 100.00 | 0.00% | 0.00% | 3.77s | $0.0189 |
| 28 | <code>kimi/kimi-k3</code> | 13.05s | 100.00 | 0.00% | 0.00% | 13.05s | $0.0082 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.77s | $0.0189 |
| 2 | <code>anthropic/claude-haiku-4-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.06s | $0.0018 |
| 3 | <code>anthropic/claude-opus-4-8</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.76s | $0.0095 |
| 4 | <code>anthropic/claude-opus-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.98s | $0.0095 |
| 5 | <code>anthropic/claude-sonnet-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.79s | $0.0038 |
| 6 | <code>deepinfra/google/gemma-3-27b-it</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.58s | $0.0000 |
| 7 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.30s | $0.0002 |
| 8 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.02s | $0.0001 |
| 9 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.42s | $0.0002 |
| 10 | <code>gemini/gemini-3.1-pro-preview</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.44s | $0.0029 |
| 11 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.28s | $0.0022 |
| 12 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.91s | $0.0005 |
| 13 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.14s | $0.0023 |
| 14 | <code>glm/glm-ocr</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.97s | $0.0000 |
| 15 | <code>grok/grok-4.20-0309-non-reasoning</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.68s | $0.0016 |
| 16 | <code>grok/grok-4.3</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 3.64s | $0.0016 |
| 17 | <code>grok/grok-4.5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.22s | $0.0032 |
| 18 | <code>kimi/kimi-k2.6</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 2.81s | $0.0014 |
| 19 | <code>kimi/kimi-k3</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 13.05s | $0.0082 |
| 20 | <code>mistral/mistral-ocr-2512</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.70s | $0.0020 |
| 21 | <code>mistral/mistral-ocr-4-0</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.60s | $0.0040 |
| 22 | <code>openai/gpt-5.4-mini</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.82s | $0.0010 |
| 23 | <code>openai/gpt-5.4-nano</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 0.90s | $0.0003 |
| 24 | <code>openai/gpt-5.5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.28s | $0.0070 |
| 25 | <code>openai/gpt-5.6-luna</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.03s | $0.0003 |
| 26 | <code>openai/gpt-5.6-sol</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.43s | $0.0070 |
| 27 | <code>openai/gpt-5.6-terra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 1.07s | $0.0028 |
| 28 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 80.00/100 quality score | 80.00 | 20.00% | 20.22% | 1.17s | $0.0002 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.77s | $0.0189 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.06s | $0.0018 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.76s | $0.0095 |
| <code>anthropic/claude-opus-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.98s | $0.0095 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.79s | $0.0038 |
| <code>deepinfra/google/gemma-3-27b-it</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.58s | $0.0000 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.30s | $0.0002 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.02s | $0.0001 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.42s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 80.00 | 20.00% | 20.22% | 1.17s | $0.0002 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.44s | $0.0029 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.28s | $0.0022 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 0.91s | $0.0005 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.14s | $0.0023 |
| <code>glm/glm-ocr</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 0.97s | $0.0000 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 0.68s | $0.0016 |
| <code>grok/grok-4.3</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 3.64s | $0.0016 |
| <code>grok/grok-4.5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.22s | $0.0032 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 2.81s | $0.0014 |
| <code>kimi/kimi-k3</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 13.05s | $0.0082 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 0.70s | $0.0020 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 0.60s | $0.0040 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 0.82s | $0.0010 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 0.90s | $0.0003 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.28s | $0.0070 |
| <code>openai/gpt-5.6-luna</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.03s | $0.0003 |
| <code>openai/gpt-5.6-sol</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.43s | $0.0070 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 1.07s | $0.0028 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 0 | 20 |
| <code>anthropic/claude-haiku-4-5</code> | 0 | 0 | 0 | 20 |
| <code>anthropic/claude-opus-4-8</code> | 0 | 0 | 0 | 20 |
| <code>anthropic/claude-opus-5</code> | 0 | 0 | 0 | 20 |
| <code>anthropic/claude-sonnet-5</code> | 0 | 0 | 0 | 20 |
| <code>deepinfra/google/gemma-3-27b-it</code> | 0 | 0 | 0 | 20 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 0 | 0 | 0 | 20 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 0 | 0 | 0 | 20 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 0 | 0 | 0 | 20 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 0 | 4 | 0 | 20 |
| <code>gemini/gemini-3.1-pro-preview</code> | 0 | 0 | 0 | 20 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 20 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 20 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 20 |
| <code>glm/glm-ocr</code> | 0 | 0 | 0 | 20 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 0 | 0 | 0 | 20 |
| <code>grok/grok-4.3</code> | 0 | 0 | 0 | 20 |
| <code>grok/grok-4.5</code> | 0 | 0 | 0 | 20 |
| <code>kimi/kimi-k2.6</code> | 0 | 0 | 0 | 20 |
| <code>kimi/kimi-k3</code> | 0 | 0 | 0 | 20 |
| <code>mistral/mistral-ocr-2512</code> | 0 | 0 | 0 | 20 |
| <code>mistral/mistral-ocr-4-0</code> | 0 | 0 | 0 | 20 |
| <code>openai/gpt-5.4-mini</code> | 0 | 0 | 0 | 20 |
| <code>openai/gpt-5.4-nano</code> | 0 | 0 | 0 | 20 |
| <code>openai/gpt-5.5</code> | 0 | 0 | 0 | 20 |
| <code>openai/gpt-5.6-luna</code> | 0 | 0 | 0 | 20 |
| <code>openai/gpt-5.6-sol</code> | 0 | 0 | 0 | 20 |
| <code>openai/gpt-5.6-terra</code> | 0 | 0 | 0 | 20 |

## Notes

- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0010¢ ($0.0000).
- Fastest cloud service: `mistral/mistral-ocr-4-0` at 0.60s.
