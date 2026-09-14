# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/auto/autoshow-cli/docs/benchmarks/ocr/01-financial-data`
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

| Rank | Provider                                     |   Value | Score / 100 |    WER |    CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------- | ------: | ----------: | -----: | -----: | --------------: | ----------: |
|    1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0004 |       98.55 |  1.45% |  0.50% |          28.10s |     $0.0004 |
|    2 | <code>glm/glm-5.3-flash</code>               | $0.0010 |       90.70 |  9.30% |  8.42% |          31.88s |     $0.0010 |
|    3 | <code>openai/gpt-5.6-luna</code>             | $0.0023 |       90.99 |  9.01% |  7.67% |           8.88s |     $0.0023 |
|    4 | <code>gemini/gemini-3.5-flash-lite</code>    | $0.0026 |       15.41 | 84.59% | 56.00% |           2.66s |     $0.0026 |
|    5 | <code>kimi/kimi-k2.6</code>                  | $0.0038 |       23.26 | 76.74% | 50.42% |          17.20s |     $0.0038 |
|    6 | <code>mistral/mistral-ocr-4-0</code>         | $0.0040 |       92.15 |  7.85% |  6.92% |           1.48s |     $0.0040 |
|    7 | <code>mistral/mistral-ocr-4-1</code>         | $0.0040 |       92.15 |  7.85% |  6.75% |           1.91s |     $0.0040 |
|    8 | <code>grok/grok-4.5</code>                   | $0.0065 |       31.10 | 68.90% | 46.92% |          33.64s |     $0.0065 |
|    9 | <code>grok/grok-4.6</code>                   | $0.0069 |       30.52 | 69.48% | 46.58% |          49.56s |     $0.0069 |
|   10 | <code>gemini/gemini-3.6-flash</code>         | $0.0085 |       99.71 |  0.29% |  0.08% |           4.61s |     $0.0085 |
|   11 | <code>gemini/gemini-3.7-flash</code>         | $0.0089 |       96.51 |  3.49% |  1.92% |           2.67s |     $0.0089 |
|   12 | <code>gemini/gemini-3.8-flash</code>         | $0.0095 |       99.71 |  0.29% |  0.08% |           3.10s |     $0.0095 |
|   13 | <code>gemini/gemini-3.5-flash</code>         | $0.0102 |       98.55 |  1.45% |  1.67% |           3.69s |     $0.0102 |
|   14 | <code>anthropic/claude-sonnet-5</code>       | $0.0110 |       97.97 |  2.03% |  1.92% |          13.11s |     $0.0110 |
|   15 | <code>kimi/kimi-k3</code>                    | $0.0240 |       31.10 | 68.90% | 47.42% |          95.03s |     $0.0240 |
|   16 | <code>openai/gpt-5.6-terra</code>            | $0.0407 |       93.31 |  6.69% |  2.67% |          23.42s |     $0.0407 |
|   17 | <code>openai/gpt-6-astra</code>              | $0.0438 |       99.13 |  0.87% |  0.25% |           9.18s |     $0.0438 |
|   18 | <code>anthropic/claude-opus-5</code>         | $0.0520 |       97.09 |  2.91% |  3.42% |          22.70s |     $0.0520 |
|   19 | <code>anthropic/claude-fable-5-1</code>      | $0.0526 |      100.00 |  0.00% |  0.00% |          11.94s |     $0.0526 |
|   20 | <code>anthropic/claude-fable-5</code>        | $0.0538 |      100.00 |  0.00% |  0.00% |          14.96s |     $0.0538 |
|   21 | <code>openai/gpt-5.6-sol</code>              | $0.0990 |       97.97 |  2.03% |  0.50% |          33.11s |     $0.0990 |

#### Speed

| Rank | Provider                                     |  Value | Score / 100 |    WER |    CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------- | -----: | ----------: | -----: | -----: | --------------: | ----------: |
|    1 | <code>mistral/mistral-ocr-4-0</code>         |  1.48s |       92.15 |  7.85% |  6.92% |           1.48s |     $0.0040 |
|    2 | <code>mistral/mistral-ocr-4-1</code>         |  1.91s |       92.15 |  7.85% |  6.75% |           1.91s |     $0.0040 |
|    3 | <code>gemini/gemini-3.5-flash-lite</code>    |  2.66s |       15.41 | 84.59% | 56.00% |           2.66s |     $0.0026 |
|    4 | <code>gemini/gemini-3.7-flash</code>         |  2.67s |       96.51 |  3.49% |  1.92% |           2.67s |     $0.0089 |
|    5 | <code>gemini/gemini-3.8-flash</code>         |  3.10s |       99.71 |  0.29% |  0.08% |           3.10s |     $0.0095 |
|    6 | <code>gemini/gemini-3.5-flash</code>         |  3.69s |       98.55 |  1.45% |  1.67% |           3.69s |     $0.0102 |
|    7 | <code>gemini/gemini-3.6-flash</code>         |  4.61s |       99.71 |  0.29% |  0.08% |           4.61s |     $0.0085 |
|    8 | <code>openai/gpt-5.6-luna</code>             |  8.88s |       90.99 |  9.01% |  7.67% |           8.88s |     $0.0023 |
|    9 | <code>openai/gpt-6-astra</code>              |  9.18s |       99.13 |  0.87% |  0.25% |           9.18s |     $0.0438 |
|   10 | <code>anthropic/claude-fable-5-1</code>      | 11.94s |      100.00 |  0.00% |  0.00% |          11.94s |     $0.0526 |
|   11 | <code>anthropic/claude-sonnet-5</code>       | 13.11s |       97.97 |  2.03% |  1.92% |          13.11s |     $0.0110 |
|   12 | <code>anthropic/claude-fable-5</code>        | 14.96s |      100.00 |  0.00% |  0.00% |          14.96s |     $0.0538 |
|   13 | <code>kimi/kimi-k2.6</code>                  | 17.20s |       23.26 | 76.74% | 50.42% |          17.20s |     $0.0038 |
|   14 | <code>anthropic/claude-opus-5</code>         | 22.70s |       97.09 |  2.91% |  3.42% |          22.70s |     $0.0520 |
|   15 | <code>openai/gpt-5.6-terra</code>            | 23.42s |       93.31 |  6.69% |  2.67% |          23.42s |     $0.0407 |
|   16 | <code>deepinfra/google/gemma-4-31B-it</code> | 28.10s |       98.55 |  1.45% |  0.50% |          28.10s |     $0.0004 |
|   17 | <code>glm/glm-5.3-flash</code>               | 31.88s |       90.70 |  9.30% |  8.42% |          31.88s |     $0.0010 |
|   18 | <code>openai/gpt-5.6-sol</code>              | 33.11s |       97.97 |  2.03% |  0.50% |          33.11s |     $0.0990 |
|   19 | <code>grok/grok-4.5</code>                   | 33.64s |       31.10 | 68.90% | 46.92% |          33.64s |     $0.0065 |
|   20 | <code>grok/grok-4.6</code>                   | 49.56s |       30.52 | 69.48% | 46.58% |          49.56s |     $0.0069 |
|   21 | <code>kimi/kimi-k3</code>                    | 95.03s |       31.10 | 68.90% | 47.42% |          95.03s |     $0.0240 |

#### Quality Score

| Rank | Provider                                     |                    Value | Score / 100 |    WER |    CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------- | -----------------------: | ----------: | -----: | -----: | --------------: | ----------: |
|    1 | <code>anthropic/claude-fable-5</code>        | 100.00/100 quality score |      100.00 |  0.00% |  0.00% |          14.96s |     $0.0538 |
|    2 | <code>anthropic/claude-fable-5-1</code>      | 100.00/100 quality score |      100.00 |  0.00% |  0.00% |          11.94s |     $0.0526 |
|    3 | <code>gemini/gemini-3.6-flash</code>         |  99.71/100 quality score |       99.71 |  0.29% |  0.08% |           4.61s |     $0.0085 |
|    4 | <code>gemini/gemini-3.8-flash</code>         |  99.71/100 quality score |       99.71 |  0.29% |  0.08% |           3.10s |     $0.0095 |
|    5 | <code>openai/gpt-6-astra</code>              |  99.13/100 quality score |       99.13 |  0.87% |  0.25% |           9.18s |     $0.0438 |
|    6 | <code>deepinfra/google/gemma-4-31B-it</code> |  98.55/100 quality score |       98.55 |  1.45% |  0.50% |          28.10s |     $0.0004 |
|    7 | <code>gemini/gemini-3.5-flash</code>         |  98.55/100 quality score |       98.55 |  1.45% |  1.67% |           3.69s |     $0.0102 |
|    8 | <code>openai/gpt-5.6-sol</code>              |  97.97/100 quality score |       97.97 |  2.03% |  0.50% |          33.11s |     $0.0990 |
|    9 | <code>anthropic/claude-sonnet-5</code>       |  97.97/100 quality score |       97.97 |  2.03% |  1.92% |          13.11s |     $0.0110 |
|   10 | <code>anthropic/claude-opus-5</code>         |  97.09/100 quality score |       97.09 |  2.91% |  3.42% |          22.70s |     $0.0520 |
|   11 | <code>gemini/gemini-3.7-flash</code>         |  96.51/100 quality score |       96.51 |  3.49% |  1.92% |           2.67s |     $0.0089 |
|   12 | <code>openai/gpt-5.6-terra</code>            |  93.31/100 quality score |       93.31 |  6.69% |  2.67% |          23.42s |     $0.0407 |
|   13 | <code>mistral/mistral-ocr-4-1</code>         |  92.15/100 quality score |       92.15 |  7.85% |  6.75% |           1.91s |     $0.0040 |
|   14 | <code>mistral/mistral-ocr-4-0</code>         |  92.15/100 quality score |       92.15 |  7.85% |  6.92% |           1.48s |     $0.0040 |
|   15 | <code>openai/gpt-5.6-luna</code>             |  90.99/100 quality score |       90.99 |  9.01% |  7.67% |           8.88s |     $0.0023 |
|   16 | <code>glm/glm-5.3-flash</code>               |  90.70/100 quality score |       90.70 |  9.30% |  8.42% |          31.88s |     $0.0010 |
|   17 | <code>grok/grok-4.5</code>                   |  31.10/100 quality score |       31.10 | 68.90% | 46.92% |          33.64s |     $0.0065 |
|   18 | <code>kimi/kimi-k3</code>                    |  31.10/100 quality score |       31.10 | 68.90% | 47.42% |          95.03s |     $0.0240 |
|   19 | <code>grok/grok-4.6</code>                   |  30.52/100 quality score |       30.52 | 69.48% | 46.58% |          49.56s |     $0.0069 |
|   20 | <code>kimi/kimi-k2.6</code>                  |  23.26/100 quality score |       23.26 | 76.74% | 50.42% |          17.20s |     $0.0038 |
|   21 | <code>gemini/gemini-3.5-flash-lite</code>    |  15.41/100 quality score |       15.41 | 84.59% | 56.00% |           2.66s |     $0.0026 |


## Provider Detail

| Provider                                     | Group               | Score / 100 |    WER |    CER | Processing Time | Actual Cost |
| -------------------------------------------- | ------------------- | ----------: | -----: | -----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>        | Third-Party Service |      100.00 |  0.00% |  0.00% |          14.96s |     $0.0538 |
| <code>anthropic/claude-fable-5-1</code>      | Third-Party Service |      100.00 |  0.00% |  0.00% |          11.94s |     $0.0526 |
| <code>anthropic/claude-opus-5</code>         | Third-Party Service |       97.09 |  2.91% |  3.42% |          22.70s |     $0.0520 |
| <code>anthropic/claude-sonnet-5</code>       | Third-Party Service |       97.97 |  2.03% |  1.92% |          13.11s |     $0.0110 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service |       98.55 |  1.45% |  0.50% |          28.10s |     $0.0004 |
| <code>gemini/gemini-3.5-flash</code>         | Third-Party Service |       98.55 |  1.45% |  1.67% |           3.69s |     $0.0102 |
| <code>gemini/gemini-3.5-flash-lite</code>    | Third-Party Service |       15.41 | 84.59% | 56.00% |           2.66s |     $0.0026 |
| <code>gemini/gemini-3.6-flash</code>         | Third-Party Service |       99.71 |  0.29% |  0.08% |           4.61s |     $0.0085 |
| <code>gemini/gemini-3.7-flash</code>         | Third-Party Service |       96.51 |  3.49% |  1.92% |           2.67s |     $0.0089 |
| <code>gemini/gemini-3.8-flash</code>         | Third-Party Service |       99.71 |  0.29% |  0.08% |           3.10s |     $0.0095 |
| <code>glm/glm-5.3-flash</code>               | Third-Party Service |       90.70 |  9.30% |  8.42% |          31.88s |     $0.0010 |
| <code>grok/grok-4.5</code>                   | Third-Party Service |       31.10 | 68.90% | 46.92% |          33.64s |     $0.0065 |
| <code>grok/grok-4.6</code>                   | Third-Party Service |       30.52 | 69.48% | 46.58% |          49.56s |     $0.0069 |
| <code>kimi/kimi-k2.6</code>                  | Third-Party Service |       23.26 | 76.74% | 50.42% |          17.20s |     $0.0038 |
| <code>kimi/kimi-k3</code>                    | Third-Party Service |       31.10 | 68.90% | 47.42% |          95.03s |     $0.0240 |
| <code>mistral/mistral-ocr-4-0</code>         | Third-Party Service |       92.15 |  7.85% |  6.92% |           1.48s |     $0.0040 |
| <code>mistral/mistral-ocr-4-1</code>         | Third-Party Service |       92.15 |  7.85% |  6.75% |           1.91s |     $0.0040 |
| <code>openai/gpt-5.6-luna</code>             | Third-Party Service |       90.99 |  9.01% |  7.67% |           8.88s |     $0.0023 |
| <code>openai/gpt-5.6-sol</code>              | Third-Party Service |       97.97 |  2.03% |  0.50% |          33.11s |     $0.0990 |
| <code>openai/gpt-5.6-terra</code>            | Third-Party Service |       93.31 |  6.69% |  2.67% |          23.42s |     $0.0407 |
| <code>openai/gpt-6-astra</code>              | Third-Party Service |       99.13 |  0.87% |  0.25% |           9.18s |     $0.0438 |

## Error Breakdown (WER)

| Provider                                     | Substitutions | Deletions | Insertions | Ref. Words |
| -------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>        |             0 |         0 |          0 |        344 |
| <code>anthropic/claude-fable-5-1</code>      |             0 |         0 |          0 |        344 |
| <code>anthropic/claude-opus-5</code>         |             0 |         0 |         10 |        344 |
| <code>anthropic/claude-sonnet-5</code>       |             1 |         0 |          6 |        344 |
| <code>deepinfra/google/gemma-4-31B-it</code> |             5 |         0 |          0 |        344 |
| <code>gemini/gemini-3.5-flash</code>         |             0 |         0 |          5 |        344 |
| <code>gemini/gemini-3.5-flash-lite</code>    |           240 |        25 |         26 |        344 |
| <code>gemini/gemini-3.6-flash</code>         |             1 |         0 |          0 |        344 |
| <code>gemini/gemini-3.7-flash</code>         |             2 |         0 |         10 |        344 |
| <code>gemini/gemini-3.8-flash</code>         |             1 |         0 |          0 |        344 |
| <code>glm/glm-5.3-flash</code>               |             9 |         0 |         23 |        344 |
| <code>grok/grok-4.5</code>                   |           133 |        52 |         52 |        344 |
| <code>grok/grok-4.6</code>                   |           135 |        52 |         52 |        344 |
| <code>kimi/kimi-k2.6</code>                  |           167 |        48 |         49 |        344 |
| <code>kimi/kimi-k3</code>                    |           130 |        55 |         52 |        344 |
| <code>mistral/mistral-ocr-4-0</code>         |             5 |         0 |         22 |        344 |
| <code>mistral/mistral-ocr-4-1</code>         |             5 |         0 |         22 |        344 |
| <code>openai/gpt-5.6-luna</code>             |            13 |        11 |          7 |        344 |
| <code>openai/gpt-5.6-sol</code>              |             6 |         0 |          1 |        344 |
| <code>openai/gpt-5.6-terra</code>            |            17 |         2 |          4 |        344 |
| <code>openai/gpt-6-astra</code>              |             3 |         0 |          0 |        344 |

## Notes

- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0365¢ ($0.0004).
- Fastest cloud service: `mistral/mistral-ocr-4-0` at 1.48s.
