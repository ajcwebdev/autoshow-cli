# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/ocr/1-page-newspaper`
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

| Rank | Provider | Value | Score / 100 | WER  | CER  | Processing Time | Actual Cost                 |
| ---: | -------- | ----: | ----------: | ---: | ---: | --------------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a         | n/a  | n/a  | n/a             | No providers in this group. |

#### Speed

| Rank | Provider | Value | Score / 100 | WER  | CER  | Processing Time | Actual Cost                 |
| ---: | -------- | ----: | ----------: | ---: | ---: | --------------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a         | n/a  | n/a  | n/a             | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER  | CER  | Processing Time | Actual Cost                 |
| ---: | -------- | ----: | ----------: | ---: | ---: | --------------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a         | n/a  | n/a  | n/a             | No providers in this group. |

### Third-Party Service

#### Price

| Rank | Provider                                  | Value   | Score / 100 | WER     | CER    | Processing Time | Actual Cost |
| ---: | ----------------------------------------- | ------: | ----------: | ------: | -----: | --------------: | ----------: |
| 1    | <code>gemini/gemini-3.5-flash-lite</code> | $0.0012 | 2.16        | 97.84%  | 98.68% | 2.34s           | $0.0012     |
| 2    | <code>anthropic/claude-haiku-5-5</code>   | $0.0026 | 61.67       | 38.33%  | 63.59% | 55.68s          | $0.0026     |
| 3    | <code>openai/gpt-6-luna</code>            | $0.0026 | 73.06       | 26.94%  | 26.13% | 24.92s          | $0.0026     |
| 4    | <code>mistral/mistral-ocr-4-0</code>      | $0.0040 | 73.49       | 26.51%  | 15.16% | 10.86s          | $0.0040     |
| 5    | <code>mistral/mistral-ocr-4-1</code>      | $0.0040 | 72.55       | 27.45%  | 18.35% | 12.54s          | $0.0040     |
| 6    | <code>openai/gpt-5.6-luna</code>          | $0.0048 | 67.26       | 32.74%  | 38.87% | 14.67s          | $0.0048     |
| 7    | <code>glm/glm-5.3-flash</code>            | $0.0089 | 98.60       | 1.40%   | 0.70%  | 297.03s         | $0.0089     |
| 8    | <code>deepinfra/Qwen/Qwen3.8-27B</code>   | $0.0111 | 92.42       | 7.58%   | 1.71%  | 88.38s          | $0.0111     |
| 9    | <code>kimi/kimi-k2.6</code>               | $0.0171 | 93.94       | 6.06%   | 1.49%  | 100.68s         | $0.0171     |
| 10   | <code>gemini/gemini-3.6-flash</code>      | $0.0231 | 79.37       | 20.63%  | 18.39% | 17.60s          | $0.0231     |
| 11   | <code>gemini/gemini-3.8-flash</code>      | $0.0246 | 92.38       | 7.62%   | 5.67%  | 16.27s          | $0.0246     |
| 12   | <code>grok/grok-4.5</code>                | $0.0251 | 94.96       | 5.04%   | 0.94%  | 82.77s          | $0.0251     |
| 13   | <code>grok/grok-4.6</code>                | $0.0255 | 95.00       | 5.00%   | 0.87%  | 65.37s          | $0.0255     |
| 14   | <code>gemini/gemini-3.7-flash</code>      | $0.0277 | 90.85       | 9.15%   | 3.91%  | 12.41s          | $0.0277     |
| 15   | <code>openai/gpt-6.1-sol</code>           | $0.0414 | 98.86       | 1.14%   | 0.43%  | 25.79s          | $0.0414     |
| 16   | <code>openai/gpt-5.6-terra</code>         | $0.0477 | 91.66       | 8.34%   | 5.83%  | 25.72s          | $0.0477     |
| 17   | <code>anthropic/claude-sonnet-5-5</code>  | $0.0526 | 97.08       | 2.92%   | 1.70%  | 68.98s          | $0.0526     |
| 18   | <code>gemini/gemini-3.5-flash</code>      | $0.0537 | 0.00        | 186.07% | 94.35% | 29.57s          | $0.0537     |
| 19   | <code>anthropic/claude-sonnet-5</code>    | $0.0580 | 92.38       | 7.62%   | 3.93%  | 71.49s          | $0.0580     |
| 20   | <code>gemini/gemini-4-argon</code>        | $0.0814 | 89.20       | 10.80%  | 6.40%  | 44.32s          | $0.0814     |
| 21   | <code>anthropic/claude-opus-5-5</code>    | $0.1056 | 98.69       | 1.31%   | 0.58%  | 37.34s          | $0.1056     |
| 22   | <code>kimi/kimi-k3</code>                 | $0.1281 | 98.64       | 1.36%   | 0.62%  | 161.63s         | $0.1281     |
| 23   | <code>anthropic/claude-opus-5</code>      | $0.1330 | 97.37       | 2.63%   | 1.37%  | 79.18s          | $0.1330     |
| 24   | <code>openai/gpt-6-astra</code>           | $0.2082 | 98.77       | 1.23%   | 0.54%  | 33.11s          | $0.2082     |
| 25   | <code>openai/gpt-5.6-sol</code>           | $0.2569 | 97.33       | 2.67%   | 1.61%  | 71.66s          | $0.2569     |
| 26   | <code>anthropic/claude-fable-5</code>     | $0.3038 | 98.26       | 1.74%   | 1.05%  | 75.57s          | $0.3038     |
| 27   | <code>anthropic/claude-fable-5-1</code>   | $0.4894 | 98.14       | 1.86%   | 1.05%  | 110.38s         | $0.4894     |

#### Speed

| Rank | Provider                                  | Value   | Score / 100 | WER     | CER    | Processing Time | Actual Cost |
| ---: | ----------------------------------------- | ------: | ----------: | ------: | -----: | --------------: | ----------: |
| 1    | <code>gemini/gemini-3.5-flash-lite</code> | 2.34s   | 2.16        | 97.84%  | 98.68% | 2.34s           | $0.0012     |
| 2    | <code>mistral/mistral-ocr-4-0</code>      | 10.86s  | 73.49       | 26.51%  | 15.16% | 10.86s          | $0.0040     |
| 3    | <code>gemini/gemini-3.7-flash</code>      | 12.41s  | 90.85       | 9.15%   | 3.91%  | 12.41s          | $0.0277     |
| 4    | <code>mistral/mistral-ocr-4-1</code>      | 12.54s  | 72.55       | 27.45%  | 18.35% | 12.54s          | $0.0040     |
| 5    | <code>openai/gpt-5.6-luna</code>          | 14.67s  | 67.26       | 32.74%  | 38.87% | 14.67s          | $0.0048     |
| 6    | <code>gemini/gemini-3.8-flash</code>      | 16.27s  | 92.38       | 7.62%   | 5.67%  | 16.27s          | $0.0246     |
| 7    | <code>gemini/gemini-3.6-flash</code>      | 17.60s  | 79.37       | 20.63%  | 18.39% | 17.60s          | $0.0231     |
| 8    | <code>openai/gpt-6-luna</code>            | 24.92s  | 73.06       | 26.94%  | 26.13% | 24.92s          | $0.0026     |
| 9    | <code>openai/gpt-5.6-terra</code>         | 25.72s  | 91.66       | 8.34%   | 5.83%  | 25.72s          | $0.0477     |
| 10   | <code>openai/gpt-6.1-sol</code>           | 25.79s  | 98.86       | 1.14%   | 0.43%  | 25.79s          | $0.0414     |
| 11   | <code>gemini/gemini-3.5-flash</code>      | 29.57s  | 0.00        | 186.07% | 94.35% | 29.57s          | $0.0537     |
| 12   | <code>openai/gpt-6-astra</code>           | 33.11s  | 98.77       | 1.23%   | 0.54%  | 33.11s          | $0.2082     |
| 13   | <code>anthropic/claude-opus-5-5</code>    | 37.34s  | 98.69       | 1.31%   | 0.58%  | 37.34s          | $0.1056     |
| 14   | <code>gemini/gemini-4-argon</code>        | 44.32s  | 89.20       | 10.80%  | 6.40%  | 44.32s          | $0.0814     |
| 15   | <code>anthropic/claude-haiku-5-5</code>   | 55.68s  | 61.67       | 38.33%  | 63.59% | 55.68s          | $0.0026     |
| 16   | <code>grok/grok-4.6</code>                | 65.37s  | 95.00       | 5.00%   | 0.87%  | 65.37s          | $0.0255     |
| 17   | <code>anthropic/claude-sonnet-5-5</code>  | 68.98s  | 97.08       | 2.92%   | 1.70%  | 68.98s          | $0.0526     |
| 18   | <code>anthropic/claude-sonnet-5</code>    | 71.49s  | 92.38       | 7.62%   | 3.93%  | 71.49s          | $0.0580     |
| 19   | <code>openai/gpt-5.6-sol</code>           | 71.66s  | 97.33       | 2.67%   | 1.61%  | 71.66s          | $0.2569     |
| 20   | <code>anthropic/claude-fable-5</code>     | 75.57s  | 98.26       | 1.74%   | 1.05%  | 75.57s          | $0.3038     |
| 21   | <code>anthropic/claude-opus-5</code>      | 79.18s  | 97.37       | 2.63%   | 1.37%  | 79.18s          | $0.1330     |
| 22   | <code>grok/grok-4.5</code>                | 82.77s  | 94.96       | 5.04%   | 0.94%  | 82.77s          | $0.0251     |
| 23   | <code>deepinfra/Qwen/Qwen3.8-27B</code>   | 88.38s  | 92.42       | 7.58%   | 1.71%  | 88.38s          | $0.0111     |
| 24   | <code>kimi/kimi-k2.6</code>               | 100.68s | 93.94       | 6.06%   | 1.49%  | 100.68s         | $0.0171     |
| 25   | <code>anthropic/claude-fable-5-1</code>   | 110.38s | 98.14       | 1.86%   | 1.05%  | 110.38s         | $0.4894     |
| 26   | <code>kimi/kimi-k3</code>                 | 161.63s | 98.64       | 1.36%   | 0.62%  | 161.63s         | $0.1281     |
| 27   | <code>glm/glm-5.3-flash</code>            | 297.03s | 98.60       | 1.40%   | 0.70%  | 297.03s         | $0.0089     |

#### Quality Score

| Rank | Provider                                  | Value                   | Score / 100 | WER     | CER    | Processing Time | Actual Cost |
| ---: | ----------------------------------------- | ----------------------: | ----------: | ------: | -----: | --------------: | ----------: |
| 1    | <code>openai/gpt-6.1-sol</code>           | 98.86/100 quality score | 98.86       | 1.14%   | 0.43%  | 25.79s          | $0.0414     |
| 2    | <code>openai/gpt-6-astra</code>           | 98.77/100 quality score | 98.77       | 1.23%   | 0.54%  | 33.11s          | $0.2082     |
| 3    | <code>anthropic/claude-opus-5-5</code>    | 98.69/100 quality score | 98.69       | 1.31%   | 0.58%  | 37.34s          | $0.1056     |
| 4    | <code>kimi/kimi-k3</code>                 | 98.64/100 quality score | 98.64       | 1.36%   | 0.62%  | 161.63s         | $0.1281     |
| 5    | <code>glm/glm-5.3-flash</code>            | 98.60/100 quality score | 98.60       | 1.40%   | 0.70%  | 297.03s         | $0.0089     |
| 6    | <code>anthropic/claude-fable-5</code>     | 98.26/100 quality score | 98.26       | 1.74%   | 1.05%  | 75.57s          | $0.3038     |
| 7    | <code>anthropic/claude-fable-5-1</code>   | 98.14/100 quality score | 98.14       | 1.86%   | 1.05%  | 110.38s         | $0.4894     |
| 8    | <code>anthropic/claude-opus-5</code>      | 97.37/100 quality score | 97.37       | 2.63%   | 1.37%  | 79.18s          | $0.1330     |
| 9    | <code>openai/gpt-5.6-sol</code>           | 97.33/100 quality score | 97.33       | 2.67%   | 1.61%  | 71.66s          | $0.2569     |
| 10   | <code>anthropic/claude-sonnet-5-5</code>  | 97.08/100 quality score | 97.08       | 2.92%   | 1.70%  | 68.98s          | $0.0526     |
| 11   | <code>grok/grok-4.6</code>                | 95.00/100 quality score | 95.00       | 5.00%   | 0.87%  | 65.37s          | $0.0255     |
| 12   | <code>grok/grok-4.5</code>                | 94.96/100 quality score | 94.96       | 5.04%   | 0.94%  | 82.77s          | $0.0251     |
| 13   | <code>kimi/kimi-k2.6</code>               | 93.94/100 quality score | 93.94       | 6.06%   | 1.49%  | 100.68s         | $0.0171     |
| 14   | <code>deepinfra/Qwen/Qwen3.8-27B</code>   | 92.42/100 quality score | 92.42       | 7.58%   | 1.71%  | 88.38s          | $0.0111     |
| 15   | <code>anthropic/claude-sonnet-5</code>    | 92.38/100 quality score | 92.38       | 7.62%   | 3.93%  | 71.49s          | $0.0580     |
| 16   | <code>gemini/gemini-3.8-flash</code>      | 92.38/100 quality score | 92.38       | 7.62%   | 5.67%  | 16.27s          | $0.0246     |
| 17   | <code>openai/gpt-5.6-terra</code>         | 91.66/100 quality score | 91.66       | 8.34%   | 5.83%  | 25.72s          | $0.0477     |
| 18   | <code>gemini/gemini-3.7-flash</code>      | 90.85/100 quality score | 90.85       | 9.15%   | 3.91%  | 12.41s          | $0.0277     |
| 19   | <code>gemini/gemini-4-argon</code>        | 89.20/100 quality score | 89.20       | 10.80%  | 6.40%  | 44.32s          | $0.0814     |
| 20   | <code>gemini/gemini-3.6-flash</code>      | 79.37/100 quality score | 79.37       | 20.63%  | 18.39% | 17.60s          | $0.0231     |
| 21   | <code>mistral/mistral-ocr-4-0</code>      | 73.49/100 quality score | 73.49       | 26.51%  | 15.16% | 10.86s          | $0.0040     |
| 22   | <code>openai/gpt-6-luna</code>            | 73.06/100 quality score | 73.06       | 26.94%  | 26.13% | 24.92s          | $0.0026     |
| 23   | <code>mistral/mistral-ocr-4-1</code>      | 72.55/100 quality score | 72.55       | 27.45%  | 18.35% | 12.54s          | $0.0040     |
| 24   | <code>openai/gpt-5.6-luna</code>          | 67.26/100 quality score | 67.26       | 32.74%  | 38.87% | 14.67s          | $0.0048     |
| 25   | <code>anthropic/claude-haiku-5-5</code>   | 61.67/100 quality score | 61.67       | 38.33%  | 63.59% | 55.68s          | $0.0026     |
| 26   | <code>gemini/gemini-3.5-flash-lite</code> | 2.16/100 quality score  | 2.16        | 97.84%  | 98.68% | 2.34s           | $0.0012     |
| 27   | <code>gemini/gemini-3.5-flash</code>      | 0.00/100 quality score  | 0.00        | 186.07% | 94.35% | 29.57s          | $0.0537     |


## Provider Detail

| Provider                                  | Group               | Score / 100 | WER     | CER    | Processing Time | Actual Cost |
| ----------------------------------------- | ------------------- | ----------: | ------: | -----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>     | Third-Party Service | 98.26       | 1.74%   | 1.05%  | 75.57s          | $0.3038     |
| <code>anthropic/claude-fable-5-1</code>   | Third-Party Service | 98.14       | 1.86%   | 1.05%  | 110.38s         | $0.4894     |
| <code>anthropic/claude-haiku-5-5</code>   | Third-Party Service | 61.67       | 38.33%  | 63.59% | 55.68s          | $0.0026     |
| <code>anthropic/claude-opus-5</code>      | Third-Party Service | 97.37       | 2.63%   | 1.37%  | 79.18s          | $0.1330     |
| <code>anthropic/claude-opus-5-5</code>    | Third-Party Service | 98.69       | 1.31%   | 0.58%  | 37.34s          | $0.1056     |
| <code>anthropic/claude-sonnet-5</code>    | Third-Party Service | 92.38       | 7.62%   | 3.93%  | 71.49s          | $0.0580     |
| <code>anthropic/claude-sonnet-5-5</code>  | Third-Party Service | 97.08       | 2.92%   | 1.70%  | 68.98s          | $0.0526     |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>   | Third-Party Service | 92.42       | 7.58%   | 1.71%  | 88.38s          | $0.0111     |
| <code>gemini/gemini-3.5-flash</code>      | Third-Party Service | 0.00        | 186.07% | 94.35% | 29.57s          | $0.0537     |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | 2.16        | 97.84%  | 98.68% | 2.34s           | $0.0012     |
| <code>gemini/gemini-3.6-flash</code>      | Third-Party Service | 79.37       | 20.63%  | 18.39% | 17.60s          | $0.0231     |
| <code>gemini/gemini-3.7-flash</code>      | Third-Party Service | 90.85       | 9.15%   | 3.91%  | 12.41s          | $0.0277     |
| <code>gemini/gemini-3.8-flash</code>      | Third-Party Service | 92.38       | 7.62%   | 5.67%  | 16.27s          | $0.0246     |
| <code>gemini/gemini-4-argon</code>        | Third-Party Service | 89.20       | 10.80%  | 6.40%  | 44.32s          | $0.0814     |
| <code>glm/glm-5.3-flash</code>            | Third-Party Service | 98.60       | 1.40%   | 0.70%  | 297.03s         | $0.0089     |
| <code>grok/grok-4.5</code>                | Third-Party Service | 94.96       | 5.04%   | 0.94%  | 82.77s          | $0.0251     |
| <code>grok/grok-4.6</code>                | Third-Party Service | 95.00       | 5.00%   | 0.87%  | 65.37s          | $0.0255     |
| <code>kimi/kimi-k2.6</code>               | Third-Party Service | 93.94       | 6.06%   | 1.49%  | 100.68s         | $0.0171     |
| <code>kimi/kimi-k3</code>                 | Third-Party Service | 98.64       | 1.36%   | 0.62%  | 161.63s         | $0.1281     |
| <code>mistral/mistral-ocr-4-0</code>      | Third-Party Service | 73.49       | 26.51%  | 15.16% | 10.86s          | $0.0040     |
| <code>mistral/mistral-ocr-4-1</code>      | Third-Party Service | 72.55       | 27.45%  | 18.35% | 12.54s          | $0.0040     |
| <code>openai/gpt-5.6-luna</code>          | Third-Party Service | 67.26       | 32.74%  | 38.87% | 14.67s          | $0.0048     |
| <code>openai/gpt-5.6-sol</code>           | Third-Party Service | 97.33       | 2.67%   | 1.61%  | 71.66s          | $0.2569     |
| <code>openai/gpt-5.6-terra</code>         | Third-Party Service | 91.66       | 8.34%   | 5.83%  | 25.72s          | $0.0477     |
| <code>openai/gpt-6-astra</code>           | Third-Party Service | 98.77       | 1.23%   | 0.54%  | 33.11s          | $0.2082     |
| <code>openai/gpt-6-luna</code>            | Third-Party Service | 73.06       | 26.94%  | 26.13% | 24.92s          | $0.0026     |
| <code>openai/gpt-6.1-sol</code>           | Third-Party Service | 98.86       | 1.14%   | 0.43%  | 25.79s          | $0.0414     |

## Error Breakdown (WER)

| Provider                                  | Substitutions | Deletions | Insertions | Ref. Words |
| ----------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>     | 27            | 5         | 9          | 2361       |
| <code>anthropic/claude-fable-5-1</code>   | 35            | 7         | 2          | 2361       |
| <code>anthropic/claude-haiku-5-5</code>   | 485           | 386       | 34         | 2361       |
| <code>anthropic/claude-opus-5</code>      | 47            | 7         | 8          | 2361       |
| <code>anthropic/claude-opus-5-5</code>    | 21            | 4         | 6          | 2361       |
| <code>anthropic/claude-sonnet-5</code>    | 109           | 43        | 28         | 2361       |
| <code>anthropic/claude-sonnet-5-5</code>  | 47            | 17        | 5          | 2361       |
| <code>deepinfra/Qwen/Qwen3.8-27B</code>   | 114           | 14        | 51         | 2361       |
| <code>gemini/gemini-3.5-flash</code>      | 1962          | 4         | 2427       | 2361       |
| <code>gemini/gemini-3.5-flash-lite</code> | 197           | 2113      | 0          | 2361       |
| <code>gemini/gemini-3.6-flash</code>      | 330           | 104       | 53         | 2361       |
| <code>gemini/gemini-3.7-flash</code>      | 152           | 9         | 55         | 2361       |
| <code>gemini/gemini-3.8-flash</code>      | 147           | 22        | 11         | 2361       |
| <code>gemini/gemini-4-argon</code>        | 184           | 10        | 61         | 2361       |
| <code>glm/glm-5.3-flash</code>            | 24            | 8         | 1          | 2361       |
| <code>grok/grok-4.5</code>                | 67            | 4         | 48         | 2361       |
| <code>grok/grok-4.6</code>                | 68            | 3         | 47         | 2361       |
| <code>kimi/kimi-k2.6</code>               | 83            | 7         | 53         | 2361       |
| <code>kimi/kimi-k3</code>                 | 18            | 13        | 1          | 2361       |
| <code>mistral/mistral-ocr-4-0</code>      | 502           | 27        | 97         | 2361       |
| <code>mistral/mistral-ocr-4-1</code>      | 471           | 124       | 53         | 2361       |
| <code>openai/gpt-5.6-luna</code>          | 332           | 418       | 23         | 2361       |
| <code>openai/gpt-5.6-sol</code>           | 41            | 18        | 4          | 2361       |
| <code>openai/gpt-5.6-terra</code>         | 109           | 21        | 67         | 2361       |
| <code>openai/gpt-6-astra</code>           | 26            | 1         | 2          | 2361       |
| <code>openai/gpt-6-luna</code>            | 53            | 567       | 16         | 2361       |
| <code>openai/gpt-6.1-sol</code>           | 22            | 4         | 1          | 2361       |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best cloud service: `openai/gpt-6.1-sol` scored 98.86/100.
- The cheapest cloud provider was `gemini/gemini-3.5-flash-lite` at 0.1223¢ ($0.0012).
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 2.34s.
