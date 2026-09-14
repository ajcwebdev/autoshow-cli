# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/auto/autoshow-cli/docs/benchmarks/ocr/05-pages-the-odyssey`
- Total providers: 21 (0 local, 21 third-party service)
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

| Rank | Provider                                     |   Value | Score / 100 |    WER |   CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------- | ------: | ----------: | -----: | ----: | --------------: | ----------: |
|    1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0009 |       95.25 |  4.75% | 1.41% |          15.73s |     $0.0009 |
|    2 | <code>gemini/gemini-3.5-flash-lite</code>    | $0.0056 |       97.54 |  2.46% | 0.72% |           7.68s |     $0.0056 |
|    3 | <code>openai/gpt-5.6-luna</code>             | $0.0077 |       92.17 |  7.83% | 3.09% |          17.88s |     $0.0077 |
|    4 | <code>glm/glm-5.3-flash</code>               | $0.0101 |       73.86 | 26.14% | 3.81% |          72.58s |     $0.0101 |
|    5 | <code>gemini/gemini-3.6-flash</code>         | $0.0184 |       96.30 |  3.70% | 0.76% |          11.15s |     $0.0184 |
|    6 | <code>mistral/mistral-ocr-4-0</code>         | $0.0200 |       89.79 | 10.21% | 2.50% |           5.93s |     $0.0200 |
|    7 | <code>mistral/mistral-ocr-4-1</code>         | $0.0200 |       92.25 |  7.75% | 1.93% |           5.82s |     $0.0200 |
|    8 | <code>gemini/gemini-3.7-flash</code>         | $0.0208 |       73.59 | 26.41% | 3.86% |           7.48s |     $0.0208 |
|    9 | <code>gemini/gemini-3.5-flash</code>         | $0.0224 |       98.59 |  1.41% | 0.31% |          11.31s |     $0.0224 |
|   10 | <code>gemini/gemini-3.8-flash</code>         | $0.0243 |       80.81 | 19.19% | 3.90% |          15.01s |     $0.0243 |
|   11 | <code>kimi/kimi-k2.6</code>                  | $0.0270 |       92.17 |  7.83% | 1.62% |          17.63s |     $0.0270 |
|   12 | <code>grok/grok-4.5</code>                   | $0.0404 |       79.05 | 20.95% | 4.12% |          32.85s |     $0.0404 |
|   13 | <code>grok/grok-4.6</code>                   | $0.0418 |       87.15 | 12.85% | 2.41% |          42.91s |     $0.0418 |
|   14 | <code>anthropic/claude-sonnet-5</code>       | $0.0461 |       81.34 | 18.66% | 3.79% |          43.71s |     $0.0461 |
|   15 | <code>openai/gpt-5.6-terra</code>            | $0.0574 |       96.48 |  3.52% | 0.69% |          14.80s |     $0.0574 |
|   16 | <code>anthropic/claude-opus-5</code>         | $0.1150 |       81.07 | 18.93% | 3.86% |          54.38s |     $0.1150 |
|   17 | <code>openai/gpt-5.6-sol</code>              | $0.1512 |       96.74 |  3.26% | 0.64% |          21.92s |     $0.1512 |
|   18 | <code>kimi/kimi-k3</code>                    | $0.2039 |       96.74 |  3.26% | 0.59% |          84.51s |     $0.2039 |
|   19 | <code>anthropic/claude-fable-5-1</code>      | $0.2253 |       80.81 | 19.19% | 3.88% |          47.46s |     $0.2253 |
|   20 | <code>anthropic/claude-fable-5</code>        | $0.2297 |       80.81 | 19.19% | 3.91% |          48.41s |     $0.2297 |
|   21 | <code>openai/gpt-6-astra</code>              | $0.2688 |       96.48 |  3.52% | 0.62% |          22.48s |     $0.2688 |

#### Speed

| Rank | Provider                                     |  Value | Score / 100 |    WER |   CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------- | -----: | ----------: | -----: | ----: | --------------: | ----------: |
|    1 | <code>mistral/mistral-ocr-4-1</code>         |  5.82s |       92.25 |  7.75% | 1.93% |           5.82s |     $0.0200 |
|    2 | <code>mistral/mistral-ocr-4-0</code>         |  5.93s |       89.79 | 10.21% | 2.50% |           5.93s |     $0.0200 |
|    3 | <code>gemini/gemini-3.7-flash</code>         |  7.48s |       73.59 | 26.41% | 3.86% |           7.48s |     $0.0208 |
|    4 | <code>gemini/gemini-3.5-flash-lite</code>    |  7.68s |       97.54 |  2.46% | 0.72% |           7.68s |     $0.0056 |
|    5 | <code>gemini/gemini-3.6-flash</code>         | 11.15s |       96.30 |  3.70% | 0.76% |          11.15s |     $0.0184 |
|    6 | <code>gemini/gemini-3.5-flash</code>         | 11.31s |       98.59 |  1.41% | 0.31% |          11.31s |     $0.0224 |
|    7 | <code>openai/gpt-5.6-terra</code>            | 14.80s |       96.48 |  3.52% | 0.69% |          14.80s |     $0.0574 |
|    8 | <code>gemini/gemini-3.8-flash</code>         | 15.01s |       80.81 | 19.19% | 3.90% |          15.01s |     $0.0243 |
|    9 | <code>deepinfra/google/gemma-4-31B-it</code> | 15.73s |       95.25 |  4.75% | 1.41% |          15.73s |     $0.0009 |
|   10 | <code>kimi/kimi-k2.6</code>                  | 17.63s |       92.17 |  7.83% | 1.62% |          17.63s |     $0.0270 |
|   11 | <code>openai/gpt-5.6-luna</code>             | 17.88s |       92.17 |  7.83% | 3.09% |          17.88s |     $0.0077 |
|   12 | <code>openai/gpt-5.6-sol</code>              | 21.92s |       96.74 |  3.26% | 0.64% |          21.92s |     $0.1512 |
|   13 | <code>openai/gpt-6-astra</code>              | 22.48s |       96.48 |  3.52% | 0.62% |          22.48s |     $0.2688 |
|   14 | <code>grok/grok-4.5</code>                   | 32.85s |       79.05 | 20.95% | 4.12% |          32.85s |     $0.0404 |
|   15 | <code>grok/grok-4.6</code>                   | 42.91s |       87.15 | 12.85% | 2.41% |          42.91s |     $0.0418 |
|   16 | <code>anthropic/claude-sonnet-5</code>       | 43.71s |       81.34 | 18.66% | 3.79% |          43.71s |     $0.0461 |
|   17 | <code>anthropic/claude-fable-5-1</code>      | 47.46s |       80.81 | 19.19% | 3.88% |          47.46s |     $0.2253 |
|   18 | <code>anthropic/claude-fable-5</code>        | 48.41s |       80.81 | 19.19% | 3.91% |          48.41s |     $0.2297 |
|   19 | <code>anthropic/claude-opus-5</code>         | 54.38s |       81.07 | 18.93% | 3.86% |          54.38s |     $0.1150 |
|   20 | <code>glm/glm-5.3-flash</code>               | 72.58s |       73.86 | 26.14% | 3.81% |          72.58s |     $0.0101 |
|   21 | <code>kimi/kimi-k3</code>                    | 84.51s |       96.74 |  3.26% | 0.59% |          84.51s |     $0.2039 |

#### Quality Score

| Rank | Provider                                     |                   Value | Score / 100 |    WER |   CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------- | ----------------------: | ----------: | -----: | ----: | --------------: | ----------: |
|    1 | <code>gemini/gemini-3.5-flash</code>         | 98.59/100 quality score |       98.59 |  1.41% | 0.31% |          11.31s |     $0.0224 |
|    2 | <code>gemini/gemini-3.5-flash-lite</code>    | 97.54/100 quality score |       97.54 |  2.46% | 0.72% |           7.68s |     $0.0056 |
|    3 | <code>kimi/kimi-k3</code>                    | 96.74/100 quality score |       96.74 |  3.26% | 0.59% |          84.51s |     $0.2039 |
|    4 | <code>openai/gpt-5.6-sol</code>              | 96.74/100 quality score |       96.74 |  3.26% | 0.64% |          21.92s |     $0.1512 |
|    5 | <code>openai/gpt-6-astra</code>              | 96.48/100 quality score |       96.48 |  3.52% | 0.62% |          22.48s |     $0.2688 |
|    6 | <code>openai/gpt-5.6-terra</code>            | 96.48/100 quality score |       96.48 |  3.52% | 0.69% |          14.80s |     $0.0574 |
|    7 | <code>gemini/gemini-3.6-flash</code>         | 96.30/100 quality score |       96.30 |  3.70% | 0.76% |          11.15s |     $0.0184 |
|    8 | <code>deepinfra/google/gemma-4-31B-it</code> | 95.25/100 quality score |       95.25 |  4.75% | 1.41% |          15.73s |     $0.0009 |
|    9 | <code>mistral/mistral-ocr-4-1</code>         | 92.25/100 quality score |       92.25 |  7.75% | 1.93% |           5.82s |     $0.0200 |
|   10 | <code>kimi/kimi-k2.6</code>                  | 92.17/100 quality score |       92.17 |  7.83% | 1.62% |          17.63s |     $0.0270 |
|   11 | <code>openai/gpt-5.6-luna</code>             | 92.17/100 quality score |       92.17 |  7.83% | 3.09% |          17.88s |     $0.0077 |
|   12 | <code>mistral/mistral-ocr-4-0</code>         | 89.79/100 quality score |       89.79 | 10.21% | 2.50% |           5.93s |     $0.0200 |
|   13 | <code>grok/grok-4.6</code>                   | 87.15/100 quality score |       87.15 | 12.85% | 2.41% |          42.91s |     $0.0418 |
|   14 | <code>anthropic/claude-sonnet-5</code>       | 81.34/100 quality score |       81.34 | 18.66% | 3.79% |          43.71s |     $0.0461 |
|   15 | <code>anthropic/claude-opus-5</code>         | 81.07/100 quality score |       81.07 | 18.93% | 3.86% |          54.38s |     $0.1150 |
|   16 | <code>anthropic/claude-fable-5-1</code>      | 80.81/100 quality score |       80.81 | 19.19% | 3.88% |          47.46s |     $0.2253 |
|   17 | <code>gemini/gemini-3.8-flash</code>         | 80.81/100 quality score |       80.81 | 19.19% | 3.90% |          15.01s |     $0.0243 |
|   18 | <code>anthropic/claude-fable-5</code>        | 80.81/100 quality score |       80.81 | 19.19% | 3.91% |          48.41s |     $0.2297 |
|   19 | <code>grok/grok-4.5</code>                   | 79.05/100 quality score |       79.05 | 20.95% | 4.12% |          32.85s |     $0.0404 |
|   20 | <code>glm/glm-5.3-flash</code>               | 73.86/100 quality score |       73.86 | 26.14% | 3.81% |          72.58s |     $0.0101 |
|   21 | <code>gemini/gemini-3.7-flash</code>         | 73.59/100 quality score |       73.59 | 26.41% | 3.86% |           7.48s |     $0.0208 |


## Provider Detail

| Provider                                     | Group               | Score / 100 |    WER |   CER | Processing Time | Actual Cost |
| -------------------------------------------- | ------------------- | ----------: | -----: | ----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>        | Third-Party Service |       80.81 | 19.19% | 3.91% |          48.41s |     $0.2297 |
| <code>anthropic/claude-fable-5-1</code>      | Third-Party Service |       80.81 | 19.19% | 3.88% |          47.46s |     $0.2253 |
| <code>anthropic/claude-opus-5</code>         | Third-Party Service |       81.07 | 18.93% | 3.86% |          54.38s |     $0.1150 |
| <code>anthropic/claude-sonnet-5</code>       | Third-Party Service |       81.34 | 18.66% | 3.79% |          43.71s |     $0.0461 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service |       95.25 |  4.75% | 1.41% |          15.73s |     $0.0009 |
| <code>gemini/gemini-3.5-flash</code>         | Third-Party Service |       98.59 |  1.41% | 0.31% |          11.31s |     $0.0224 |
| <code>gemini/gemini-3.5-flash-lite</code>    | Third-Party Service |       97.54 |  2.46% | 0.72% |           7.68s |     $0.0056 |
| <code>gemini/gemini-3.6-flash</code>         | Third-Party Service |       96.30 |  3.70% | 0.76% |          11.15s |     $0.0184 |
| <code>gemini/gemini-3.7-flash</code>         | Third-Party Service |       73.59 | 26.41% | 3.86% |           7.48s |     $0.0208 |
| <code>gemini/gemini-3.8-flash</code>         | Third-Party Service |       80.81 | 19.19% | 3.90% |          15.01s |     $0.0243 |
| <code>glm/glm-5.3-flash</code>               | Third-Party Service |       73.86 | 26.14% | 3.81% |          72.58s |     $0.0101 |
| <code>grok/grok-4.5</code>                   | Third-Party Service |       79.05 | 20.95% | 4.12% |          32.85s |     $0.0404 |
| <code>grok/grok-4.6</code>                   | Third-Party Service |       87.15 | 12.85% | 2.41% |          42.91s |     $0.0418 |
| <code>kimi/kimi-k2.6</code>                  | Third-Party Service |       92.17 |  7.83% | 1.62% |          17.63s |     $0.0270 |
| <code>kimi/kimi-k3</code>                    | Third-Party Service |       96.74 |  3.26% | 0.59% |          84.51s |     $0.2039 |
| <code>mistral/mistral-ocr-4-0</code>         | Third-Party Service |       89.79 | 10.21% | 2.50% |           5.93s |     $0.0200 |
| <code>mistral/mistral-ocr-4-1</code>         | Third-Party Service |       92.25 |  7.75% | 1.93% |           5.82s |     $0.0200 |
| <code>openai/gpt-5.6-luna</code>             | Third-Party Service |       92.17 |  7.83% | 3.09% |          17.88s |     $0.0077 |
| <code>openai/gpt-5.6-sol</code>              | Third-Party Service |       96.74 |  3.26% | 0.64% |          21.92s |     $0.1512 |
| <code>openai/gpt-5.6-terra</code>            | Third-Party Service |       96.48 |  3.52% | 0.69% |          14.80s |     $0.0574 |
| <code>openai/gpt-6-astra</code>              | Third-Party Service |       96.48 |  3.52% | 0.62% |          22.48s |     $0.2688 |

## Error Breakdown (WER)

| Provider                                     | Substitutions | Deletions | Insertions | Ref. Words |
| -------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>        |           189 |         4 |         25 |       1136 |
| <code>anthropic/claude-fable-5-1</code>      |           190 |        26 |          2 |       1136 |
| <code>anthropic/claude-opus-5</code>         |           188 |         2 |         25 |       1136 |
| <code>anthropic/claude-sonnet-5</code>       |           187 |        24 |          1 |       1136 |
| <code>deepinfra/google/gemma-4-31B-it</code> |            36 |         7 |         11 |       1136 |
| <code>gemini/gemini-3.5-flash</code>         |            10 |         4 |          2 |       1136 |
| <code>gemini/gemini-3.5-flash-lite</code>    |            20 |         6 |          2 |       1136 |
| <code>gemini/gemini-3.6-flash</code>         |            17 |        24 |          1 |       1136 |
| <code>gemini/gemini-3.7-flash</code>         |           187 |         2 |        111 |       1136 |
| <code>gemini/gemini-3.8-flash</code>         |           189 |         4 |         25 |       1136 |
| <code>glm/glm-5.3-flash</code>               |           188 |        22 |         87 |       1136 |
| <code>grok/grok-4.5</code>                   |           146 |        42 |         50 |       1136 |
| <code>grok/grok-4.6</code>                   |           115 |        18 |         13 |       1136 |
| <code>kimi/kimi-k2.6</code>                  |            61 |        27 |          1 |       1136 |
| <code>kimi/kimi-k3</code>                    |            14 |        22 |          1 |       1136 |
| <code>mistral/mistral-ocr-4-0</code>         |            97 |        15 |          4 |       1136 |
| <code>mistral/mistral-ocr-4-1</code>         |            55 |        30 |          3 |       1136 |
| <code>openai/gpt-5.6-luna</code>             |            22 |        61 |          6 |       1136 |
| <code>openai/gpt-5.6-sol</code>              |            11 |         1 |         25 |       1136 |
| <code>openai/gpt-5.6-terra</code>            |            15 |        23 |          2 |       1136 |
| <code>openai/gpt-6-astra</code>              |            13 |        26 |          1 |       1136 |

## Notes

- Best cloud service: `gemini/gemini-3.5-flash` scored 98.59/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0891¢ ($0.0009).
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 5.82s.
