# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/auto/autoshow-cli/docs/benchmarks/ocr/1-page-newspaper`
- Total providers: 20 (0 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- Page-level metrics used by the combined report are retained in `page-metrics.json`.

## Method

- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 |  WER |  CER | Processing Time |                 Actual Cost |
| ---: | -------- | ----: | ----------: | ---: | ---: | --------------: | --------------------------: |
|  n/a | n/a      |   n/a |         n/a |  n/a |  n/a |             n/a | No providers in this group. |

#### Speed

| Rank | Provider | Value | Score / 100 |  WER |  CER | Processing Time |                 Actual Cost |
| ---: | -------- | ----: | ----------: | ---: | ---: | --------------: | --------------------------: |
|  n/a | n/a      |   n/a |         n/a |  n/a |  n/a |             n/a | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Score / 100 |  WER |  CER | Processing Time |                 Actual Cost |
| ---: | -------- | ----: | ----------: | ---: | ---: | --------------: | --------------------------: |
|  n/a | n/a      |   n/a |         n/a |  n/a |  n/a |             n/a | No providers in this group. |

### Third-Party Service

#### Price

| Rank | Provider                                  |   Value | Score / 100 |     WER |    CER | Processing Time | Actual Cost |
| ---: | ----------------------------------------- | ------: | ----------: | ------: | -----: | --------------: | ----------: |
|    1 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0012 |        2.16 |  97.84% | 98.68% |           2.34s |     $0.0012 |
|    2 | <code>mistral/mistral-ocr-4-0</code>      | $0.0040 |       73.49 |  26.51% | 15.16% |          10.86s |     $0.0040 |
|    3 | <code>mistral/mistral-ocr-4-1</code>      | $0.0040 |       72.55 |  27.45% | 18.35% |          12.54s |     $0.0040 |
|    4 | <code>openai/gpt-5.6-luna</code>          | $0.0048 |       67.26 |  32.74% | 38.87% |          14.67s |     $0.0048 |
|    5 | <code>glm/glm-5.3-flash</code>            | $0.0089 |       98.60 |   1.40% |  0.70% |         297.03s |     $0.0089 |
|    6 | <code>kimi/kimi-k2.6</code>               | $0.0171 |       93.94 |   6.06% |  1.49% |         100.68s |     $0.0171 |
|    7 | <code>gemini/gemini-3.6-flash</code>      | $0.0231 |       79.37 |  20.63% | 18.39% |          17.60s |     $0.0231 |
|    8 | <code>gemini/gemini-3.8-flash</code>      | $0.0246 |       92.38 |   7.62% |  5.67% |          16.27s |     $0.0246 |
|    9 | <code>grok/grok-4.5</code>                | $0.0251 |       94.96 |   5.04% |  0.94% |          82.77s |     $0.0251 |
|   10 | <code>grok/grok-4.6</code>                | $0.0255 |       95.00 |   5.00% |  0.87% |          65.37s |     $0.0255 |
|   11 | <code>gemini/gemini-3.7-flash</code>      | $0.0277 |       90.85 |   9.15% |  3.91% |          12.41s |     $0.0277 |
|   12 | <code>openai/gpt-5.6-terra</code>         | $0.0477 |       91.66 |   8.34% |  5.83% |          25.72s |     $0.0477 |
|   13 | <code>gemini/gemini-3.5-flash</code>      | $0.0537 |        0.00 | 186.07% | 94.35% |          29.57s |     $0.0537 |
|   14 | <code>anthropic/claude-sonnet-5</code>    | $0.0580 |       92.38 |   7.62% |  3.93% |          71.49s |     $0.0580 |
|   15 | <code>kimi/kimi-k3</code>                 | $0.1281 |       98.64 |   1.36% |  0.62% |         161.63s |     $0.1281 |
|   16 | <code>anthropic/claude-opus-5</code>      | $0.1330 |       97.37 |   2.63% |  1.37% |          79.18s |     $0.1330 |
|   17 | <code>openai/gpt-6-astra</code>           | $0.2082 |       98.77 |   1.23% |  0.54% |          33.11s |     $0.2082 |
|   18 | <code>openai/gpt-5.6-sol</code>           | $0.2569 |       97.33 |   2.67% |  1.61% |          71.66s |     $0.2569 |
|   19 | <code>anthropic/claude-fable-5</code>     | $0.3038 |       98.26 |   1.74% |  1.05% |          75.57s |     $0.3038 |
|   20 | <code>anthropic/claude-fable-5-1</code>   | $0.4894 |       98.14 |   1.86% |  1.05% |         110.38s |     $0.4894 |

#### Speed

| Rank | Provider                                  |   Value | Score / 100 |     WER |    CER | Processing Time | Actual Cost |
| ---: | ----------------------------------------- | ------: | ----------: | ------: | -----: | --------------: | ----------: |
|    1 | <code>gemini/gemini-3.5-flash-lite</code> |   2.34s |        2.16 |  97.84% | 98.68% |           2.34s |     $0.0012 |
|    2 | <code>mistral/mistral-ocr-4-0</code>      |  10.86s |       73.49 |  26.51% | 15.16% |          10.86s |     $0.0040 |
|    3 | <code>gemini/gemini-3.7-flash</code>      |  12.41s |       90.85 |   9.15% |  3.91% |          12.41s |     $0.0277 |
|    4 | <code>mistral/mistral-ocr-4-1</code>      |  12.54s |       72.55 |  27.45% | 18.35% |          12.54s |     $0.0040 |
|    5 | <code>openai/gpt-5.6-luna</code>          |  14.67s |       67.26 |  32.74% | 38.87% |          14.67s |     $0.0048 |
|    6 | <code>gemini/gemini-3.8-flash</code>      |  16.27s |       92.38 |   7.62% |  5.67% |          16.27s |     $0.0246 |
|    7 | <code>gemini/gemini-3.6-flash</code>      |  17.60s |       79.37 |  20.63% | 18.39% |          17.60s |     $0.0231 |
|    8 | <code>openai/gpt-5.6-terra</code>         |  25.72s |       91.66 |   8.34% |  5.83% |          25.72s |     $0.0477 |
|    9 | <code>gemini/gemini-3.5-flash</code>      |  29.57s |        0.00 | 186.07% | 94.35% |          29.57s |     $0.0537 |
|   10 | <code>openai/gpt-6-astra</code>           |  33.11s |       98.77 |   1.23% |  0.54% |          33.11s |     $0.2082 |
|   11 | <code>grok/grok-4.6</code>                |  65.37s |       95.00 |   5.00% |  0.87% |          65.37s |     $0.0255 |
|   12 | <code>anthropic/claude-sonnet-5</code>    |  71.49s |       92.38 |   7.62% |  3.93% |          71.49s |     $0.0580 |
|   13 | <code>openai/gpt-5.6-sol</code>           |  71.66s |       97.33 |   2.67% |  1.61% |          71.66s |     $0.2569 |
|   14 | <code>anthropic/claude-fable-5</code>     |  75.57s |       98.26 |   1.74% |  1.05% |          75.57s |     $0.3038 |
|   15 | <code>anthropic/claude-opus-5</code>      |  79.18s |       97.37 |   2.63% |  1.37% |          79.18s |     $0.1330 |
|   16 | <code>grok/grok-4.5</code>                |  82.77s |       94.96 |   5.04% |  0.94% |          82.77s |     $0.0251 |
|   17 | <code>kimi/kimi-k2.6</code>               | 100.68s |       93.94 |   6.06% |  1.49% |         100.68s |     $0.0171 |
|   18 | <code>anthropic/claude-fable-5-1</code>   | 110.38s |       98.14 |   1.86% |  1.05% |         110.38s |     $0.4894 |
|   19 | <code>kimi/kimi-k3</code>                 | 161.63s |       98.64 |   1.36% |  0.62% |         161.63s |     $0.1281 |
|   20 | <code>glm/glm-5.3-flash</code>            | 297.03s |       98.60 |   1.40% |  0.70% |         297.03s |     $0.0089 |

#### Quality Score

| Rank | Provider                                  |                   Value | Score / 100 |     WER |    CER | Processing Time | Actual Cost |
| ---: | ----------------------------------------- | ----------------------: | ----------: | ------: | -----: | --------------: | ----------: |
|    1 | <code>openai/gpt-6-astra</code>           | 98.77/100 quality score |       98.77 |   1.23% |  0.54% |          33.11s |     $0.2082 |
|    2 | <code>kimi/kimi-k3</code>                 | 98.64/100 quality score |       98.64 |   1.36% |  0.62% |         161.63s |     $0.1281 |
|    3 | <code>glm/glm-5.3-flash</code>            | 98.60/100 quality score |       98.60 |   1.40% |  0.70% |         297.03s |     $0.0089 |
|    4 | <code>anthropic/claude-fable-5</code>     | 98.26/100 quality score |       98.26 |   1.74% |  1.05% |          75.57s |     $0.3038 |
|    5 | <code>anthropic/claude-fable-5-1</code>   | 98.14/100 quality score |       98.14 |   1.86% |  1.05% |         110.38s |     $0.4894 |
|    6 | <code>anthropic/claude-opus-5</code>      | 97.37/100 quality score |       97.37 |   2.63% |  1.37% |          79.18s |     $0.1330 |
|    7 | <code>openai/gpt-5.6-sol</code>           | 97.33/100 quality score |       97.33 |   2.67% |  1.61% |          71.66s |     $0.2569 |
|    8 | <code>grok/grok-4.6</code>                | 95.00/100 quality score |       95.00 |   5.00% |  0.87% |          65.37s |     $0.0255 |
|    9 | <code>grok/grok-4.5</code>                | 94.96/100 quality score |       94.96 |   5.04% |  0.94% |          82.77s |     $0.0251 |
|   10 | <code>kimi/kimi-k2.6</code>               | 93.94/100 quality score |       93.94 |   6.06% |  1.49% |         100.68s |     $0.0171 |
|   11 | <code>anthropic/claude-sonnet-5</code>    | 92.38/100 quality score |       92.38 |   7.62% |  3.93% |          71.49s |     $0.0580 |
|   12 | <code>gemini/gemini-3.8-flash</code>      | 92.38/100 quality score |       92.38 |   7.62% |  5.67% |          16.27s |     $0.0246 |
|   13 | <code>openai/gpt-5.6-terra</code>         | 91.66/100 quality score |       91.66 |   8.34% |  5.83% |          25.72s |     $0.0477 |
|   14 | <code>gemini/gemini-3.7-flash</code>      | 90.85/100 quality score |       90.85 |   9.15% |  3.91% |          12.41s |     $0.0277 |
|   15 | <code>gemini/gemini-3.6-flash</code>      | 79.37/100 quality score |       79.37 |  20.63% | 18.39% |          17.60s |     $0.0231 |
|   16 | <code>mistral/mistral-ocr-4-0</code>      | 73.49/100 quality score |       73.49 |  26.51% | 15.16% |          10.86s |     $0.0040 |
|   17 | <code>mistral/mistral-ocr-4-1</code>      | 72.55/100 quality score |       72.55 |  27.45% | 18.35% |          12.54s |     $0.0040 |
|   18 | <code>openai/gpt-5.6-luna</code>          | 67.26/100 quality score |       67.26 |  32.74% | 38.87% |          14.67s |     $0.0048 |
|   19 | <code>gemini/gemini-3.5-flash-lite</code> |  2.16/100 quality score |        2.16 |  97.84% | 98.68% |           2.34s |     $0.0012 |
|   20 | <code>gemini/gemini-3.5-flash</code>      |  0.00/100 quality score |        0.00 | 186.07% | 94.35% |          29.57s |     $0.0537 |


## Provider Detail

| Provider                                  | Group               | Score / 100 |     WER |    CER | Processing Time | Actual Cost |
| ----------------------------------------- | ------------------- | ----------: | ------: | -----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>     | Third-Party Service |       98.26 |   1.74% |  1.05% |          75.57s |     $0.3038 |
| <code>anthropic/claude-fable-5-1</code>   | Third-Party Service |       98.14 |   1.86% |  1.05% |         110.38s |     $0.4894 |
| <code>anthropic/claude-opus-5</code>      | Third-Party Service |       97.37 |   2.63% |  1.37% |          79.18s |     $0.1330 |
| <code>anthropic/claude-sonnet-5</code>    | Third-Party Service |       92.38 |   7.62% |  3.93% |          71.49s |     $0.0580 |
| <code>gemini/gemini-3.5-flash</code>      | Third-Party Service |        0.00 | 186.07% | 94.35% |          29.57s |     $0.0537 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service |        2.16 |  97.84% | 98.68% |           2.34s |     $0.0012 |
| <code>gemini/gemini-3.6-flash</code>      | Third-Party Service |       79.37 |  20.63% | 18.39% |          17.60s |     $0.0231 |
| <code>gemini/gemini-3.7-flash</code>      | Third-Party Service |       90.85 |   9.15% |  3.91% |          12.41s |     $0.0277 |
| <code>gemini/gemini-3.8-flash</code>      | Third-Party Service |       92.38 |   7.62% |  5.67% |          16.27s |     $0.0246 |
| <code>glm/glm-5.3-flash</code>            | Third-Party Service |       98.60 |   1.40% |  0.70% |         297.03s |     $0.0089 |
| <code>grok/grok-4.5</code>                | Third-Party Service |       94.96 |   5.04% |  0.94% |          82.77s |     $0.0251 |
| <code>grok/grok-4.6</code>                | Third-Party Service |       95.00 |   5.00% |  0.87% |          65.37s |     $0.0255 |
| <code>kimi/kimi-k2.6</code>               | Third-Party Service |       93.94 |   6.06% |  1.49% |         100.68s |     $0.0171 |
| <code>kimi/kimi-k3</code>                 | Third-Party Service |       98.64 |   1.36% |  0.62% |         161.63s |     $0.1281 |
| <code>mistral/mistral-ocr-4-0</code>      | Third-Party Service |       73.49 |  26.51% | 15.16% |          10.86s |     $0.0040 |
| <code>mistral/mistral-ocr-4-1</code>      | Third-Party Service |       72.55 |  27.45% | 18.35% |          12.54s |     $0.0040 |
| <code>openai/gpt-5.6-luna</code>          | Third-Party Service |       67.26 |  32.74% | 38.87% |          14.67s |     $0.0048 |
| <code>openai/gpt-5.6-sol</code>           | Third-Party Service |       97.33 |   2.67% |  1.61% |          71.66s |     $0.2569 |
| <code>openai/gpt-5.6-terra</code>         | Third-Party Service |       91.66 |   8.34% |  5.83% |          25.72s |     $0.0477 |
| <code>openai/gpt-6-astra</code>           | Third-Party Service |       98.77 |   1.23% |  0.54% |          33.11s |     $0.2082 |

## Error Breakdown (WER)

| Provider                                  | Substitutions | Deletions | Insertions | Ref. Words |
| ----------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>     |            27 |         5 |          9 |       2361 |
| <code>anthropic/claude-fable-5-1</code>   |            35 |         7 |          2 |       2361 |
| <code>anthropic/claude-opus-5</code>      |            47 |         7 |          8 |       2361 |
| <code>anthropic/claude-sonnet-5</code>    |           109 |        43 |         28 |       2361 |
| <code>gemini/gemini-3.5-flash</code>      |          1962 |         4 |       2427 |       2361 |
| <code>gemini/gemini-3.5-flash-lite</code> |           197 |      2113 |          0 |       2361 |
| <code>gemini/gemini-3.6-flash</code>      |           330 |       104 |         53 |       2361 |
| <code>gemini/gemini-3.7-flash</code>      |           152 |         9 |         55 |       2361 |
| <code>gemini/gemini-3.8-flash</code>      |           147 |        22 |         11 |       2361 |
| <code>glm/glm-5.3-flash</code>            |            24 |         8 |          1 |       2361 |
| <code>grok/grok-4.5</code>                |            67 |         4 |         48 |       2361 |
| <code>grok/grok-4.6</code>                |            68 |         3 |         47 |       2361 |
| <code>kimi/kimi-k2.6</code>               |            83 |         7 |         53 |       2361 |
| <code>kimi/kimi-k3</code>                 |            18 |        13 |          1 |       2361 |
| <code>mistral/mistral-ocr-4-0</code>      |           502 |        27 |         97 |       2361 |
| <code>mistral/mistral-ocr-4-1</code>      |           471 |       124 |         53 |       2361 |
| <code>openai/gpt-5.6-luna</code>          |           332 |       418 |         23 |       2361 |
| <code>openai/gpt-5.6-sol</code>           |            41 |        18 |          4 |       2361 |
| <code>openai/gpt-5.6-terra</code>         |           109 |        21 |         67 |       2361 |
| <code>openai/gpt-6-astra</code>           |            26 |         1 |          2 |       2361 |

## Notes

- Best cloud service: `openai/gpt-6-astra` scored 98.77/100.
- The cheapest cloud provider was `gemini/gemini-3.5-flash-lite` at 0.1223¢ ($0.0012).
- Fastest cloud service: `gemini/gemini-3.5-flash-lite` at 2.34s.
