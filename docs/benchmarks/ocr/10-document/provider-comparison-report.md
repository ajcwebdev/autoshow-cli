# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/ocr/10-document`
- Total providers: 30 (0 local, 30 third-party service)
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
| 1 | <code>deepinfra/google/gemma-3-27b-it</code> | $0.0009 | 94.38 | 5.62% | 5.14% | 809.54s | $0.0009 |
| 2 | <code>glm/glm-ocr</code> | $0.0012 | 95.13 | 4.87% | 4.90% | 10.19s | $0.0012 |
| 3 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | $0.0026 | 93.64 | 6.36% | 5.53% | 813.35s | $0.0026 |
| 4 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | $0.0033 | 85.78 | 14.22% | 19.48% | 794.37s | $0.0033 |
| 5 | <code>openai/gpt-5.6-luna</code> | $0.0052 | 100.00 | 0.00% | 0.00% | 14.66s | $0.0052 |
| 6 | <code>openai/gpt-5.4-nano</code> | $0.0055 | 99.77 | 0.23% | 0.27% | 22.88s | $0.0055 |
| 7 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0129 | 100.00 | 0.00% | 0.00% | 11.47s | $0.0129 |
| 8 | <code>openai/gpt-5.4-mini</code> | $0.0197 | 100.00 | 0.00% | 0.00% | 12.67s | $0.0197 |
| 9 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | $0.0197 | 97.31 | 2.69% | 2.89% | 804.59s | $0.0197 |
| 10 | <code>mistral/mistral-ocr-2512</code> | $0.0200 | 96.67 | 3.33% | 3.41% | 2.38s | $0.0200 |
| 11 | <code>mistral/mistral-ocr-4-0</code> | $0.0400 | 99.71 | 0.29% | 0.27% | 1.67s | $0.0400 |
| 12 | <code>grok/grok-4.20-0309-non-reasoning</code> | $0.0403 | 91.57 | 8.43% | 9.62% | 6.17s | $0.0403 |
| 13 | <code>gemini/gemini-3.6-flash</code> | $0.0408 | 100.00 | 0.00% | 0.00% | 17.73s | $0.0408 |
| 14 | <code>grok/grok-4.3</code> | $0.0414 | 97.94 | 2.06% | 2.22% | 9.60s | $0.0414 |
| 15 | <code>gemini/gemini-3.7-flash</code> | $0.0417 | 100.00 | 0.00% | 0.00% | 7.37s | $0.0417 |
| 16 | <code>anthropic/claude-haiku-4-5</code> | $0.0431 | 80.68 | 19.32% | 54.41% | 40.07s | $0.0431 |
| 17 | <code>gemini/gemini-3.5-flash</code> | $0.0487 | 100.00 | 0.00% | 0.00% | 15.83s | $0.0487 |
| 18 | <code>kimi/kimi-k2.6</code> | $0.0535 | 100.00 | 0.00% | 0.00% | 38.30s | $0.0535 |
| 19 | <code>openai/gpt-5.6-terra</code> | $0.0537 | 100.00 | 0.00% | 0.00% | 14.42s | $0.0537 |
| 20 | <code>gemini/gemini-3.1-pro-preview</code> | $0.0670 | 100.00 | 0.00% | 0.00% | 29.38s | $0.0670 |
| 21 | <code>grok/grok-4.5</code> | $0.0802 | 98.74 | 1.26% | 1.36% | 20.51s | $0.0802 |
| 22 | <code>grok/grok-4.6</code> | $0.0841 | 99.66 | 0.34% | 0.36% | 35.25s | $0.0841 |
| 23 | <code>anthropic/claude-sonnet-5</code> | $0.1058 | 100.00 | 0.00% | 0.00% | 48.83s | $0.1058 |
| 24 | <code>openai/gpt-5.6-sol</code> | $0.1302 | 100.00 | 0.00% | 0.00% | 24.22s | $0.1302 |
| 25 | <code>openai/gpt-5.5</code> | $0.1332 | 100.00 | 0.00% | 0.00% | 17.17s | $0.1332 |
| 26 | <code>anthropic/claude-sonnet-4-6</code> | $0.1352 | 100.00 | 0.00% | 0.00% | 85.78s | $0.1352 |
| 27 | <code>anthropic/claude-opus-4-8</code> | $0.2673 | 100.00 | 0.00% | 0.00% | 65.11s | $0.2673 |
| 28 | <code>anthropic/claude-opus-5</code> | $0.2720 | 100.00 | 0.00% | 0.00% | 62.20s | $0.2720 |
| 29 | <code>kimi/kimi-k3</code> | $0.4535 | 99.94 | 0.06% | 0.01% | 75.16s | $0.4535 |
| 30 | <code>anthropic/claude-fable-5</code> | $0.5401 | 100.00 | 0.00% | 0.00% | 60.51s | $0.5401 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-0</code> | 1.67s | 99.71 | 0.29% | 0.27% | 1.67s | $0.0400 |
| 2 | <code>mistral/mistral-ocr-2512</code> | 2.38s | 96.67 | 3.33% | 3.41% | 2.38s | $0.0200 |
| 3 | <code>grok/grok-4.20-0309-non-reasoning</code> | 6.17s | 91.57 | 8.43% | 9.62% | 6.17s | $0.0403 |
| 4 | <code>gemini/gemini-3.7-flash</code> | 7.37s | 100.00 | 0.00% | 0.00% | 7.37s | $0.0417 |
| 5 | <code>grok/grok-4.3</code> | 9.60s | 97.94 | 2.06% | 2.22% | 9.60s | $0.0414 |
| 6 | <code>glm/glm-ocr</code> | 10.19s | 95.13 | 4.87% | 4.90% | 10.19s | $0.0012 |
| 7 | <code>gemini/gemini-3.5-flash-lite</code> | 11.47s | 100.00 | 0.00% | 0.00% | 11.47s | $0.0129 |
| 8 | <code>openai/gpt-5.4-mini</code> | 12.67s | 100.00 | 0.00% | 0.00% | 12.67s | $0.0197 |
| 9 | <code>openai/gpt-5.6-terra</code> | 14.42s | 100.00 | 0.00% | 0.00% | 14.42s | $0.0537 |
| 10 | <code>openai/gpt-5.6-luna</code> | 14.66s | 100.00 | 0.00% | 0.00% | 14.66s | $0.0052 |
| 11 | <code>gemini/gemini-3.5-flash</code> | 15.83s | 100.00 | 0.00% | 0.00% | 15.83s | $0.0487 |
| 12 | <code>openai/gpt-5.5</code> | 17.17s | 100.00 | 0.00% | 0.00% | 17.17s | $0.1332 |
| 13 | <code>gemini/gemini-3.6-flash</code> | 17.73s | 100.00 | 0.00% | 0.00% | 17.73s | $0.0408 |
| 14 | <code>grok/grok-4.5</code> | 20.51s | 98.74 | 1.26% | 1.36% | 20.51s | $0.0802 |
| 15 | <code>openai/gpt-5.4-nano</code> | 22.88s | 99.77 | 0.23% | 0.27% | 22.88s | $0.0055 |
| 16 | <code>openai/gpt-5.6-sol</code> | 24.22s | 100.00 | 0.00% | 0.00% | 24.22s | $0.1302 |
| 17 | <code>gemini/gemini-3.1-pro-preview</code> | 29.38s | 100.00 | 0.00% | 0.00% | 29.38s | $0.0670 |
| 18 | <code>grok/grok-4.6</code> | 35.25s | 99.66 | 0.34% | 0.36% | 35.25s | $0.0841 |
| 19 | <code>kimi/kimi-k2.6</code> | 38.30s | 100.00 | 0.00% | 0.00% | 38.30s | $0.0535 |
| 20 | <code>anthropic/claude-haiku-4-5</code> | 40.07s | 80.68 | 19.32% | 54.41% | 40.07s | $0.0431 |
| 21 | <code>anthropic/claude-sonnet-5</code> | 48.83s | 100.00 | 0.00% | 0.00% | 48.83s | $0.1058 |
| 22 | <code>anthropic/claude-fable-5</code> | 60.51s | 100.00 | 0.00% | 0.00% | 60.51s | $0.5401 |
| 23 | <code>anthropic/claude-opus-5</code> | 62.20s | 100.00 | 0.00% | 0.00% | 62.20s | $0.2720 |
| 24 | <code>anthropic/claude-opus-4-8</code> | 65.11s | 100.00 | 0.00% | 0.00% | 65.11s | $0.2673 |
| 25 | <code>kimi/kimi-k3</code> | 75.16s | 99.94 | 0.06% | 0.01% | 75.16s | $0.4535 |
| 26 | <code>anthropic/claude-sonnet-4-6</code> | 85.78s | 100.00 | 0.00% | 0.00% | 85.78s | $0.1352 |
| 27 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 794.37s | 85.78 | 14.22% | 19.48% | 794.37s | $0.0033 |
| 28 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 804.59s | 97.31 | 2.69% | 2.89% | 804.59s | $0.0197 |
| 29 | <code>deepinfra/google/gemma-3-27b-it</code> | 809.54s | 94.38 | 5.62% | 5.14% | 809.54s | $0.0009 |
| 30 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 813.35s | 93.64 | 6.36% | 5.53% | 813.35s | $0.0026 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 60.51s | $0.5401 |
| 2 | <code>anthropic/claude-opus-4-8</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 65.11s | $0.2673 |
| 3 | <code>anthropic/claude-opus-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 62.20s | $0.2720 |
| 4 | <code>anthropic/claude-sonnet-4-6</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 85.78s | $0.1352 |
| 5 | <code>anthropic/claude-sonnet-5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 48.83s | $0.1058 |
| 6 | <code>gemini/gemini-3.1-pro-preview</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 29.38s | $0.0670 |
| 7 | <code>gemini/gemini-3.5-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 15.83s | $0.0487 |
| 8 | <code>gemini/gemini-3.5-flash-lite</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 11.47s | $0.0129 |
| 9 | <code>gemini/gemini-3.6-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 17.73s | $0.0408 |
| 10 | <code>gemini/gemini-3.7-flash</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 7.37s | $0.0417 |
| 11 | <code>kimi/kimi-k2.6</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 38.30s | $0.0535 |
| 12 | <code>openai/gpt-5.4-mini</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 12.67s | $0.0197 |
| 13 | <code>openai/gpt-5.5</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 17.17s | $0.1332 |
| 14 | <code>openai/gpt-5.6-luna</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 14.66s | $0.0052 |
| 15 | <code>openai/gpt-5.6-sol</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 24.22s | $0.1302 |
| 16 | <code>openai/gpt-5.6-terra</code> | 100.00/100 quality score | 100.00 | 0.00% | 0.00% | 14.42s | $0.0537 |
| 17 | <code>kimi/kimi-k3</code> | 99.94/100 quality score | 99.94 | 0.06% | 0.01% | 75.16s | $0.4535 |
| 18 | <code>openai/gpt-5.4-nano</code> | 99.77/100 quality score | 99.77 | 0.23% | 0.27% | 22.88s | $0.0055 |
| 19 | <code>mistral/mistral-ocr-4-0</code> | 99.71/100 quality score | 99.71 | 0.29% | 0.27% | 1.67s | $0.0400 |
| 20 | <code>grok/grok-4.6</code> | 99.66/100 quality score | 99.66 | 0.34% | 0.36% | 35.25s | $0.0841 |
| 21 | <code>grok/grok-4.5</code> | 98.74/100 quality score | 98.74 | 1.26% | 1.36% | 20.51s | $0.0802 |
| 22 | <code>grok/grok-4.3</code> | 97.94/100 quality score | 97.94 | 2.06% | 2.22% | 9.60s | $0.0414 |
| 23 | <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 97.31/100 quality score | 97.31 | 2.69% | 2.89% | 804.59s | $0.0197 |
| 24 | <code>mistral/mistral-ocr-2512</code> | 96.67/100 quality score | 96.67 | 3.33% | 3.41% | 2.38s | $0.0200 |
| 25 | <code>glm/glm-ocr</code> | 95.13/100 quality score | 95.13 | 4.87% | 4.90% | 10.19s | $0.0012 |
| 26 | <code>deepinfra/google/gemma-3-27b-it</code> | 94.38/100 quality score | 94.38 | 5.62% | 5.14% | 809.54s | $0.0009 |
| 27 | <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 93.64/100 quality score | 93.64 | 6.36% | 5.53% | 813.35s | $0.0026 |
| 28 | <code>grok/grok-4.20-0309-non-reasoning</code> | 91.57/100 quality score | 91.57 | 8.43% | 9.62% | 6.17s | $0.0403 |
| 29 | <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 85.78/100 quality score | 85.78 | 14.22% | 19.48% | 794.37s | $0.0033 |
| 30 | <code>anthropic/claude-haiku-4-5</code> | 80.68/100 quality score | 80.68 | 19.32% | 54.41% | 40.07s | $0.0431 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 60.51s | $0.5401 |
| <code>anthropic/claude-haiku-4-5</code> | Third-Party Service | 80.68 | 19.32% | 54.41% | 40.07s | $0.0431 |
| <code>anthropic/claude-opus-4-8</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 65.11s | $0.2673 |
| <code>anthropic/claude-opus-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 62.20s | $0.2720 |
| <code>anthropic/claude-sonnet-4-6</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 85.78s | $0.1352 |
| <code>anthropic/claude-sonnet-5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 48.83s | $0.1058 |
| <code>deepinfra/google/gemma-3-27b-it</code> | Third-Party Service | 94.38 | 5.62% | 5.14% | 809.54s | $0.0009 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | Third-Party Service | 85.78 | 14.22% | 19.48% | 794.37s | $0.0033 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | Third-Party Service | 93.64 | 6.36% | 5.53% | 813.35s | $0.0026 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | Third-Party Service | 97.31 | 2.69% | 2.89% | 804.59s | $0.0197 |
| <code>gemini/gemini-3.1-pro-preview</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 29.38s | $0.0670 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 15.83s | $0.0487 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 11.47s | $0.0129 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 17.73s | $0.0408 |
| <code>gemini/gemini-3.7-flash</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 7.37s | $0.0417 |
| <code>glm/glm-ocr</code> | Third-Party Service | 95.13 | 4.87% | 4.90% | 10.19s | $0.0012 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | Third-Party Service | 91.57 | 8.43% | 9.62% | 6.17s | $0.0403 |
| <code>grok/grok-4.3</code> | Third-Party Service | 97.94 | 2.06% | 2.22% | 9.60s | $0.0414 |
| <code>grok/grok-4.5</code> | Third-Party Service | 98.74 | 1.26% | 1.36% | 20.51s | $0.0802 |
| <code>grok/grok-4.6</code> | Third-Party Service | 99.66 | 0.34% | 0.36% | 35.25s | $0.0841 |
| <code>kimi/kimi-k2.6</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 38.30s | $0.0535 |
| <code>kimi/kimi-k3</code> | Third-Party Service | 99.94 | 0.06% | 0.01% | 75.16s | $0.4535 |
| <code>mistral/mistral-ocr-2512</code> | Third-Party Service | 96.67 | 3.33% | 3.41% | 2.38s | $0.0200 |
| <code>mistral/mistral-ocr-4-0</code> | Third-Party Service | 99.71 | 0.29% | 0.27% | 1.67s | $0.0400 |
| <code>openai/gpt-5.4-mini</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 12.67s | $0.0197 |
| <code>openai/gpt-5.4-nano</code> | Third-Party Service | 99.77 | 0.23% | 0.27% | 22.88s | $0.0055 |
| <code>openai/gpt-5.5</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 17.17s | $0.1332 |
| <code>openai/gpt-5.6-luna</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 14.66s | $0.0052 |
| <code>openai/gpt-5.6-sol</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 24.22s | $0.1302 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | 100.00 | 0.00% | 0.00% | 14.42s | $0.0537 |

## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>anthropic/claude-fable-5</code> | 0 | 0 | 0 | 1744 |
| <code>anthropic/claude-haiku-4-5</code> | 0 | 157 | 180 | 1744 |
| <code>anthropic/claude-opus-4-8</code> | 0 | 0 | 0 | 1744 |
| <code>anthropic/claude-opus-5</code> | 0 | 0 | 0 | 1744 |
| <code>anthropic/claude-sonnet-4-6</code> | 0 | 0 | 0 | 1744 |
| <code>anthropic/claude-sonnet-5</code> | 0 | 0 | 0 | 1744 |
| <code>deepinfra/google/gemma-3-27b-it</code> | 22 | 68 | 8 | 1744 |
| <code>deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct</code> | 1 | 247 | 0 | 1744 |
| <code>deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506</code> | 21 | 46 | 44 | 1744 |
| <code>deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct</code> | 1 | 46 | 0 | 1744 |
| <code>gemini/gemini-3.1-pro-preview</code> | 0 | 0 | 0 | 1744 |
| <code>gemini/gemini-3.5-flash</code> | 0 | 0 | 0 | 1744 |
| <code>gemini/gemini-3.5-flash-lite</code> | 0 | 0 | 0 | 1744 |
| <code>gemini/gemini-3.6-flash</code> | 0 | 0 | 0 | 1744 |
| <code>gemini/gemini-3.7-flash</code> | 0 | 0 | 0 | 1744 |
| <code>glm/glm-ocr</code> | 9 | 69 | 7 | 1744 |
| <code>grok/grok-4.20-0309-non-reasoning</code> | 4 | 140 | 3 | 1744 |
| <code>grok/grok-4.3</code> | 0 | 36 | 0 | 1744 |
| <code>grok/grok-4.5</code> | 0 | 22 | 0 | 1744 |
| <code>grok/grok-4.6</code> | 0 | 6 | 0 | 1744 |
| <code>kimi/kimi-k2.6</code> | 0 | 0 | 0 | 1744 |
| <code>kimi/kimi-k3</code> | 1 | 0 | 0 | 1744 |
| <code>mistral/mistral-ocr-2512</code> | 3 | 5 | 50 | 1744 |
| <code>mistral/mistral-ocr-4-0</code> | 0 | 0 | 5 | 1744 |
| <code>openai/gpt-5.4-mini</code> | 0 | 0 | 0 | 1744 |
| <code>openai/gpt-5.4-nano</code> | 0 | 4 | 0 | 1744 |
| <code>openai/gpt-5.5</code> | 0 | 0 | 0 | 1744 |
| <code>openai/gpt-5.6-luna</code> | 0 | 0 | 0 | 1744 |
| <code>openai/gpt-5.6-sol</code> | 0 | 0 | 0 | 1744 |
| <code>openai/gpt-5.6-terra</code> | 0 | 0 | 0 | 1744 |

## Notes

- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-3-27b-it` at 0.0880¢ ($0.0009).
- Fastest cloud service: `mistral/mistral-ocr-4-0` at 1.67s.
