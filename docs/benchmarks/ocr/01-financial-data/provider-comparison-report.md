# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/01-financial-data`
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
| 1 | <code>glm/glm-ocr</code> | $0.0001 | 0.00 | 176.74% | 140.00% | 4.08s | $0.0001 |
| 2 | <code>deepinfra/google/gemma-3-27b-it</code> | $0.0002 | 22.09 | 77.91% | 51.25% | 39.41s | $0.0002 |
| 3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0002 | 95.06 | 4.94% | 2.83% | 11.85s | $0.0002 |
| 4 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | $0.0003 | 84.30 | 15.70% | 11.67% | 15.58s | $0.0003 |
| 5 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | $0.0006 | 95.35 | 4.65% | 3.25% | 20.38s | $0.0006 |
| 6 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0008 | 97.38 | 2.62% | 1.92% | 40.64s | $0.0008 |
| 7 | <code>openai/gpt-5.4-nano</code> | $0.0009 | 87.21 | 12.79% | 6.00% | 3.98s | $0.0009 |
| 8 | <code>mistral/mistral-ocr-2512</code> | $0.0020 | 12.21 | 87.79% | 57.50% | 2.63s | $0.0020 |
| 9 | <code>openai/gpt-5.6-luna</code> | $0.0023 | 90.99 | 9.01% | 7.67% | 8.88s | $0.0023 |
| 10 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0026 | 15.41 | 84.59% | 56.00% | 2.66s | $0.0026 |
| 11 | <code>grok/grok-4.3</code> | $0.0027 | 28.49 | 71.51% | 50.33% | 13.96s | $0.0027 |
| 12 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0028 | 32.27 | 67.73% | 46.25% | 7.25s | $0.0028 |
| 13 | <code>openai/gpt-5.4-mini</code> | $0.0033 | 96.80 | 3.20% | 1.25% | 3.31s | $0.0033 |
| 14 | <code>kimi/kimi-k2.6</code> | $0.0038 | 23.26 | 76.74% | 50.42% | 17.20s | $0.0038 |
| 15 | <code>mistral/mistral-ocr-4-0</code> | $0.0040 | 92.15 | 7.85% | 6.92% | 1.48s | $0.0040 |
| 16 | <code>anthropic/claude-haiku-4-5</code> | $0.0046 | 15.99 | 84.01% | 53.58% | 10.34s | $0.0046 |
| 17 | <code>grok/grok-4.5</code> | $0.0065 | 31.10 | 68.90% | 46.92% | 33.64s | $0.0065 |
| 18 | <code>gemini/gemini-3.6-flash</code> | $0.0085 | 99.71 | 0.29% | 0.08% | 4.61s | $0.0085 |
| 19 | <code>gemini/gemini-3.5-flash</code> | $0.0102 | 98.55 | 1.45% | 1.67% | 3.69s | $0.0102 |
| 20 | <code>anthropic/claude-sonnet-5</code> | $0.0110 | 97.97 | 2.03% | 1.92% | 13.11s | $0.0110 |
| 21 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0139 | 12.50 | 87.50% | 57.42% | 7.98s | $0.0139 |
| 22 | <code>anthropic/claude-opus-4-8</code> | $0.0272 | 98.84 | 1.16% | 0.42% | 15.55s | $0.0272 |
| 23 | <code>openai/gpt-5.6-terra</code> | $0.0407 | 93.31 | 6.69% | 2.67% | 23.42s | $0.0407 |
| 24 | <code>anthropic/claude-opus-5</code> | $0.0520 | 97.09 | 2.91% | 3.42% | 22.70s | $0.0520 |
| 25 | <code>anthropic/claude-fable-5</code> | $0.0538 | 100.00 | 0.00% | 0.00% | 14.96s | $0.0538 |
| 26 | <code>openai/gpt-5.5</code> | $0.0571 | 98.55 | 1.45% | 0.42% | 13.96s | $0.0571 |
| 27 | <code>openai/gpt-5.6-sol</code> | $0.0990 | 97.97 | 2.03% | 0.50% | 33.11s | $0.0990 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-0</code> | 1.48s | 92.15 | 7.85% | 6.92% | 1.48s | $0.0040 |
| 2 | <code>mistral/mistral-ocr-2512</code> | 2.63s | 12.21 | 87.79% | 57.50% | 2.63s | $0.0020 |
| 3 | <code>gemini/gemini-3.5-flash-lite</code> | 2.66s | 15.41 | 84.59% | 56.00% | 2.66s | $0.0026 |
| 4 | <code>openai/gpt-5.4-mini</code> | 3.31s | 96.80 | 3.20% | 1.25% | 3.31s | $0.0033 |
| 5 | <code>gemini/gemini-3.5-flash</code> | 3.69s | 98.55 | 1.45% | 1.67% | 3.69s | $0.0102 |
| 6 | <code>openai/gpt-5.4-nano</code> | 3.98s | 87.21 | 12.79% | 6.00% | 3.98s | $0.0009 |
| 7 | <code>glm/glm-ocr</code> | 4.08s | 0.00 | 176.74% | 140.00% | 4.08s | $0.0001 |
| 8 | <code>gemini/gemini-3.6-flash</code> | 4.61s | 99.71 | 0.29% | 0.08% | 4.61s | $0.0085 |
| 9 | <code>grok/grok-4.20-0309-non-reasoning</code> | 7.25s | 32.27 | 67.73% | 46.25% | 7.25s | $0.0028 |
| 10 | <code>gemini/gemini-3.1-pro-preview</code> | 7.98s | 12.50 | 87.50% | 57.42% | 7.98s | $0.0139 |
| 11 | <code>openai/gpt-5.6-luna</code> | 8.88s | 90.99 | 9.01% | 7.67% | 8.88s | $0.0023 |
| 12 | <code>anthropic/claude-haiku-4-5</code> | 10.34s | 15.99 | 84.01% | 53.58% | 10.34s | $0.0046 |
| 13 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 11.85s | 95.06 | 4.94% | 2.83% | 11.85s | $0.0002 |
| 14 | <code>anthropic/claude-sonnet-5</code> | 13.11s | 97.97 | 2.03% | 1.92% | 13.11s | $0.0110 |
| 15 | <code>grok/grok-4.3</code> | 13.96s | 28.49 | 71.51% | 50.33% | 13.96s | $0.0027 |
| 16 | <code>openai/gpt-5.5</code> | 13.96s | 98.55 | 1.45% | 0.42% | 13.96s | $0.0571 |
| 17 | <code>anthropic/claude-fable-5</code> | 14.96s | 100.00 | 0.00% | 0.00% | 14.96s | $0.0538 |
| 18 | <code>anthropic/claude-opus-4-8</code> | 15.55s | 98.84 | 1.16% | 0.42% | 15.55s | $0.0272 |
| 19 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 15.58s | 84.30 | 15.70% | 11.67% | 15.58s | $0.0003 |
| 20 | <code>kimi/kimi-k2.6</code> | 17.20s | 23.26 | 76.74% | 50.42% | 17.20s | $0.0038 |
| 21 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 20.38s | 95.35 | 4.65% | 3.25% | 20.38s | $0.0006 |
| 22 | <code>anthropic/claude-opus-5</code> | 22.70s | 97.09 | 2.91% | 3.42% | 22.70s | $0.0520 |
| 23 | <code>openai/gpt-5.6-terra</code> | 23.42s | 93.31 | 6.69% | 2.67% | 23.42s | $0.0407 |
| 24 | <code>openai/gpt-5.6-sol</code> | 33.11s | 97.97 | 2.03% | 0.50% | 33.11s | $0.0990 |
| 25 | <code>grok/grok-4.5</code> | 33.64s | 31.10 | 68.90% | 46.92% | 33.64s | $0.0065 |
| 26 | <code>deepinfra/google/gemma-3-27b-it</code> | 39.41s | 22.09 | 77.91% | 51.25% | 39.41s | $0.0002 |
| 27 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 40.64s | 97.38 | 2.62% | 1.92% | 40.64s | $0.0008 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 14.96s | $0.0538 |
| 2 | <code>gemini/gemini-3.6-flash</code> | 99.71/100 quality score | 99.71 | 0.29% | 0.08% | 4.61s | $0.0085 |
| 3 | <code>anthropic/claude-opus-4-8</code> | 98.84/100 quality score | 98.84 | 1.16% | 0.42% | 15.55s | $0.0272 |
| 4 | <code>openai/gpt-5.5</code> | 98.55/100 quality score | 98.55 | 1.45% | 0.42% | 13.96s | $0.0571 |
| 5 | <code>gemini/gemini-3.5-flash</code> | 98.55/100 quality score | 98.55 | 1.45% | 1.67% | 3.69s | $0.0102 |
| 6 | <code>openai/gpt-5.6-sol</code> | 97.97/100 quality score | 97.97 | 2.03% | 0.50% | 33.11s | $0.0990 |
| 7 | <code>anthropic/claude-sonnet-5</code> | 97.97/100 quality score | 97.97 | 2.03% | 1.92% | 13.11s | $0.0110 |
| 8 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 97.38/100 quality score | 97.38 | 2.62% | 1.92% | 40.64s | $0.0008 |
| 9 | <code>anthropic/claude-opus-5</code> | 97.09/100 quality score | 97.09 | 2.91% | 3.42% | 22.70s | $0.0520 |
| 10 | <code>openai/gpt-5.4-mini</code> | 96.80/100 quality score | 96.80 | 3.20% | 1.25% | 3.31s | $0.0033 |
| 11 | <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 95.35/100 quality score | 95.35 | 4.65% | 3.25% | 20.38s | $0.0006 |
| 12 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 95.06/100 quality score | 95.06 | 4.94% | 2.83% | 11.85s | $0.0002 |
| 13 | <code>openai/gpt-5.6-terra</code> | 93.31/100 quality score | 93.31 | 6.69% | 2.67% | 23.42s | $0.0407 |
| 14 | <code>mistral/mistral-ocr-4-0</code> | 92.15/100 quality score | 92.15 | 7.85% | 6.92% | 1.48s | $0.0040 |
| 15 | <code>openai/gpt-5.6-luna</code> | 90.99/100 quality score | 90.99 | 9.01% | 7.67% | 8.88s | $0.0023 |
| 16 | <code>openai/gpt-5.4-nano</code> | 87.21/100 quality score | 87.21 | 12.79% | 6.00% | 3.98s | $0.0009 |
| 17 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 84.30/100 quality score | 84.30 | 15.70% | 11.67% | 15.58s | $0.0003 |
| 18 | <code>grok/grok-4.20-0309-non-reasoning</code> | 32.27/100 quality score | 32.27 | 67.73% | 46.25% | 7.25s | $0.0028 |
| 19 | <code>grok/grok-4.5</code> | 31.10/100 quality score | 31.10 | 68.90% | 46.92% | 33.64s | $0.0065 |
| 20 | <code>grok/grok-4.3</code> | 28.49/100 quality score | 28.49 | 71.51% | 50.33% | 13.96s | $0.0027 |
| 21 | <code>kimi/kimi-k2.6</code> | 23.26/100 quality score | 23.26 | 76.74% | 50.42% | 17.20s | $0.0038 |
| 22 | <code>deepinfra/google/gemma-3-27b-it</code> | 22.09/100 quality score | 22.09 | 77.91% | 51.25% | 39.41s | $0.0002 |
| 23 | <code>anthropic/claude-haiku-4-5</code> | 15.99/100 quality score | 15.99 | 84.01% | 53.58% | 10.34s | $0.0046 |
| 24 | <code>gemini/gemini-3.5-flash-lite</code> | 15.41/100 quality score | 15.41 | 84.59% | 56.00% | 2.66s | $0.0026 |
| 25 | <code>gemini/gemini-3.1-pro-preview</code> | 12.50/100 quality score | 12.50 | 87.50% | 57.42% | 7.98s | $0.0139 |
| 26 | <code>mistral/mistral-ocr-2512</code> | 12.21/100 quality score | 12.21 | 87.79% | 57.50% | 2.63s | $0.0020 |
| 27 | <code>glm/glm-ocr</code> | 0.00/100 quality score | 0.00 | 176.74% | 140.00% | 4.08s | $0.0001 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 14.96s | $0.0538 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 15.99 | 84.01% | 53.58% | 10.34s | $0.0046 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 98.84 | 1.16% | 0.42% | 15.55s | $0.0272 |
| <code>anthropic/claude-opus-5</code> | Third-Party Service | 97.09 | 2.91% | 3.42% | 22.70s | $0.0520 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 97.97 | 2.03% | 1.92% | 13.11s | $0.0110 |
| <code>deepinfra/google/gemma-3-27b-it</code> | Third-Party Service | 22.09 | 77.91% | 51.25% | 39.41s | $0.0002 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | Third-Party Service | 84.30 | 15.70% | 11.67% | 15.58s | $0.0003 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service | 95.06 | 4.94% | 2.83% | 11.85s | $0.0002 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 97.38 | 2.62% | 1.92% | 40.64s | $0.0008 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | Third-Party Service | 95.35 | 4.65% | 3.25% | 20.38s | $0.0006 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 12.50 | 87.50% | 57.42% | 7.98s | $0.0139 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 98.55 | 1.45% | 1.67% | 3.69s | $0.0102 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 15.41 | 84.59% | 56.00% | 2.66s | $0.0026 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 99.71 | 0.29% | 0.08% | 4.61s | $0.0085 |
| <code>glm/glm-ocr</code> | Third-Party Service | 0.00 | 176.74% | 140.00% | 4.08s | $0.0001 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 32.27 | 67.73% | 46.25% | 7.25s | $0.0028 |
| <code>grok/grok-4.3</code> | Third-Party Service | 28.49 | 71.51% | 50.33% | 13.96s | $0.0027 |
| <code>grok/grok-4.5</code> | Third-Party Service | 31.10 | 68.90% | 46.92% | 33.64s | $0.0065 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 23.26 | 76.74% | 50.42% | 17.20s | $0.0038 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 12.21 | 87.79% | 57.50% | 2.63s | $0.0020 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 92.15 | 7.85% | 6.92% | 1.48s | $0.0040 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 96.80 | 3.20% | 1.25% | 3.31s | $0.0033 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 87.21 | 12.79% | 6.00% | 3.98s | $0.0009 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 98.55 | 1.45% | 0.42% | 13.96s | $0.0571 |
| <code>openai/gpt-5.6-luna</code> | Third-Party Service | 90.99 | 9.01% | 7.67% | 8.88s | $0.0023 |
| <code>openai/gpt-5.6-sol</code> | Third-Party Service | 97.97 | 2.03% | 0.50% | 33.11s | $0.0990 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 93.31 | 6.69% | 2.67% | 23.42s | $0.0407 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 0 | 344 |
| <code>anthropic/claude-haiku-4-5</code> | 257 | 27 | 5 | 344 |
| <code>anthropic/claude-opus-4-8</code> | 4 | 0 | 0 | 344 |
| <code>anthropic/claude-opus-5</code> | 0 | 0 | 10 | 344 |
| <code>anthropic/claude-sonnet-5</code> | 1 | 0 | 6 | 344 |
| <code>deepinfra/google/gemma-3-27b-it</code> | 163 | 68 | 37 | 344 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 40 | 12 | 2 | 344 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 10 | 4 | 3 | 344 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 6 | 3 | 0 | 344 |
| <code>deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct</code> | 6 | 0 | 10 | 344 |
| <code>gemini/gemini-3.1-pro-preview</code> | 122 | 81 | 98 | 344 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 5 | 344 |
| <code>gemini/gemini-3.5-flash-lite</code> | 240 | 25 | 26 | 344 |
| <code>gemini/gemini-3.6-flash</code> | 1 | 0 | 0 | 344 |
| <code>glm/glm-ocr</code> | 197 | 3 | 408 | 344 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 115 | 62 | 56 | 344 |
| <code>grok/grok-4.3</code> | 129 | 55 | 62 | 344 |
| <code>grok/grok-4.5</code> | 133 | 52 | 52 | 344 |
| <code>kimi/kimi-k2.6</code> | 167 | 48 | 49 | 344 |
| <code>mistral/mistral-ocr-2512</code> | 125 | 77 | 100 | 344 |
| <code>mistral/mistral-ocr-4-0</code> | 5 | 0 | 22 | 344 |
| <code>openai/gpt-5.4-mini</code> | 8 | 0 | 3 | 344 |
| <code>openai/gpt-5.4-nano</code> | 32 | 10 | 2 | 344 |
| <code>openai/gpt-5.5</code> | 5 | 0 | 0 | 344 |
| <code>openai/gpt-5.6-luna</code> | 13 | 11 | 7 | 344 |
| <code>openai/gpt-5.6-sol</code> | 6 | 0 | 1 | 344 |
| <code>openai/gpt-5.6-terra</code> | 17 | 2 | 4 | 344 |

## Notes

- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `glm/glm-ocr` at 0.0063¢ ($0.0001).
- Fastest cloud service: `mistral/mistral-ocr-4-0` at 1.48s.
