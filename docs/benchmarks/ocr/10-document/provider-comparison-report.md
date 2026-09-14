# OCR Provider Comparison Report

## Summary

- Run directory: `/Users/ajc/c/auto/autoshow-cli/docs/benchmarks/ocr/10-document`
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

| Rank | Provider                                     |   Value | Score / 100 |   WER |   CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | ----------: |
|    1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0020 |       99.71 | 0.29% | 0.05% |          32.73s |     $0.0020 |
|    2 | <code>openai/gpt-5.6-luna</code>             | $0.0052 |      100.00 | 0.00% | 0.00% |          14.66s |     $0.0052 |
|    3 | <code>gemini/gemini-3.5-flash-lite</code>    | $0.0129 |      100.00 | 0.00% | 0.00% |          11.47s |     $0.0129 |
|    4 | <code>glm/glm-5.3-flash</code>               | $0.0159 |       99.54 | 0.46% | 0.50% |          24.46s |     $0.0159 |
|    5 | <code>mistral/mistral-ocr-4-0</code>         | $0.0400 |       99.71 | 0.29% | 0.27% |           1.67s |     $0.0400 |
|    6 | <code>mistral/mistral-ocr-4-1</code>         | $0.0400 |       99.77 | 0.23% | 0.17% |           2.01s |     $0.0400 |
|    7 | <code>gemini/gemini-3.6-flash</code>         | $0.0408 |      100.00 | 0.00% | 0.00% |          17.73s |     $0.0408 |
|    8 | <code>gemini/gemini-3.7-flash</code>         | $0.0417 |      100.00 | 0.00% | 0.00% |           7.37s |     $0.0417 |
|    9 | <code>gemini/gemini-3.8-flash</code>         | $0.0433 |      100.00 | 0.00% | 0.00% |          10.89s |     $0.0433 |
|   10 | <code>gemini/gemini-3.5-flash</code>         | $0.0487 |      100.00 | 0.00% | 0.00% |          15.83s |     $0.0487 |
|   11 | <code>kimi/kimi-k2.6</code>                  | $0.0535 |      100.00 | 0.00% | 0.00% |          38.30s |     $0.0535 |
|   12 | <code>openai/gpt-5.6-terra</code>            | $0.0537 |      100.00 | 0.00% | 0.00% |          14.42s |     $0.0537 |
|   13 | <code>grok/grok-4.5</code>                   | $0.0802 |       98.74 | 1.26% | 1.36% |          20.51s |     $0.0802 |
|   14 | <code>grok/grok-4.6</code>                   | $0.0841 |       99.66 | 0.34% | 0.36% |          35.25s |     $0.0841 |
|   15 | <code>anthropic/claude-sonnet-5</code>       | $0.1058 |      100.00 | 0.00% | 0.00% |          48.83s |     $0.1058 |
|   16 | <code>openai/gpt-5.6-sol</code>              | $0.1302 |      100.00 | 0.00% | 0.00% |          24.22s |     $0.1302 |
|   17 | <code>openai/gpt-6-astra</code>              | $0.2225 |      100.00 | 0.00% | 0.00% |          30.50s |     $0.2225 |
|   18 | <code>anthropic/claude-opus-5</code>         | $0.2720 |      100.00 | 0.00% | 0.00% |          62.20s |     $0.2720 |
|   19 | <code>kimi/kimi-k3</code>                    | $0.4535 |       99.94 | 0.06% | 0.01% |          75.16s |     $0.4535 |
|   20 | <code>anthropic/claude-fable-5</code>        | $0.5401 |      100.00 | 0.00% | 0.00% |          60.51s |     $0.5401 |
|   21 | <code>anthropic/claude-fable-5-1</code>      | $0.5456 |      100.00 | 0.00% | 0.00% |          66.93s |     $0.5456 |

#### Speed

| Rank | Provider                                     |  Value | Score / 100 |   WER |   CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------- | -----: | ----------: | ----: | ----: | --------------: | ----------: |
|    1 | <code>mistral/mistral-ocr-4-0</code>         |  1.67s |       99.71 | 0.29% | 0.27% |           1.67s |     $0.0400 |
|    2 | <code>mistral/mistral-ocr-4-1</code>         |  2.01s |       99.77 | 0.23% | 0.17% |           2.01s |     $0.0400 |
|    3 | <code>gemini/gemini-3.7-flash</code>         |  7.37s |      100.00 | 0.00% | 0.00% |           7.37s |     $0.0417 |
|    4 | <code>gemini/gemini-3.8-flash</code>         | 10.89s |      100.00 | 0.00% | 0.00% |          10.89s |     $0.0433 |
|    5 | <code>gemini/gemini-3.5-flash-lite</code>    | 11.47s |      100.00 | 0.00% | 0.00% |          11.47s |     $0.0129 |
|    6 | <code>openai/gpt-5.6-terra</code>            | 14.42s |      100.00 | 0.00% | 0.00% |          14.42s |     $0.0537 |
|    7 | <code>openai/gpt-5.6-luna</code>             | 14.66s |      100.00 | 0.00% | 0.00% |          14.66s |     $0.0052 |
|    8 | <code>gemini/gemini-3.5-flash</code>         | 15.83s |      100.00 | 0.00% | 0.00% |          15.83s |     $0.0487 |
|    9 | <code>gemini/gemini-3.6-flash</code>         | 17.73s |      100.00 | 0.00% | 0.00% |          17.73s |     $0.0408 |
|   10 | <code>grok/grok-4.5</code>                   | 20.51s |       98.74 | 1.26% | 1.36% |          20.51s |     $0.0802 |
|   11 | <code>openai/gpt-5.6-sol</code>              | 24.22s |      100.00 | 0.00% | 0.00% |          24.22s |     $0.1302 |
|   12 | <code>glm/glm-5.3-flash</code>               | 24.46s |       99.54 | 0.46% | 0.50% |          24.46s |     $0.0159 |
|   13 | <code>openai/gpt-6-astra</code>              | 30.50s |      100.00 | 0.00% | 0.00% |          30.50s |     $0.2225 |
|   14 | <code>deepinfra/google/gemma-4-31B-it</code> | 32.73s |       99.71 | 0.29% | 0.05% |          32.73s |     $0.0020 |
|   15 | <code>grok/grok-4.6</code>                   | 35.25s |       99.66 | 0.34% | 0.36% |          35.25s |     $0.0841 |
|   16 | <code>kimi/kimi-k2.6</code>                  | 38.30s |      100.00 | 0.00% | 0.00% |          38.30s |     $0.0535 |
|   17 | <code>anthropic/claude-sonnet-5</code>       | 48.83s |      100.00 | 0.00% | 0.00% |          48.83s |     $0.1058 |
|   18 | <code>anthropic/claude-fable-5</code>        | 60.51s |      100.00 | 0.00% | 0.00% |          60.51s |     $0.5401 |
|   19 | <code>anthropic/claude-opus-5</code>         | 62.20s |      100.00 | 0.00% | 0.00% |          62.20s |     $0.2720 |
|   20 | <code>anthropic/claude-fable-5-1</code>      | 66.93s |      100.00 | 0.00% | 0.00% |          66.93s |     $0.5456 |
|   21 | <code>kimi/kimi-k3</code>                    | 75.16s |       99.94 | 0.06% | 0.01% |          75.16s |     $0.4535 |

#### Quality Score

| Rank | Provider                                     |                    Value | Score / 100 |   WER |   CER | Processing Time | Actual Cost |
| ---: | -------------------------------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | ----------: |
|    1 | <code>anthropic/claude-fable-5</code>        | 100.00/100 quality score |      100.00 | 0.00% | 0.00% |          60.51s |     $0.5401 |
|    2 | <code>anthropic/claude-fable-5-1</code>      | 100.00/100 quality score |      100.00 | 0.00% | 0.00% |          66.93s |     $0.5456 |
|    3 | <code>anthropic/claude-opus-5</code>         | 100.00/100 quality score |      100.00 | 0.00% | 0.00% |          62.20s |     $0.2720 |
|    4 | <code>anthropic/claude-sonnet-5</code>       | 100.00/100 quality score |      100.00 | 0.00% | 0.00% |          48.83s |     $0.1058 |
|    5 | <code>gemini/gemini-3.5-flash</code>         | 100.00/100 quality score |      100.00 | 0.00% | 0.00% |          15.83s |     $0.0487 |
|    6 | <code>gemini/gemini-3.5-flash-lite</code>    | 100.00/100 quality score |      100.00 | 0.00% | 0.00% |          11.47s |     $0.0129 |
|    7 | <code>gemini/gemini-3.6-flash</code>         | 100.00/100 quality score |      100.00 | 0.00% | 0.00% |          17.73s |     $0.0408 |
|    8 | <code>gemini/gemini-3.7-flash</code>         | 100.00/100 quality score |      100.00 | 0.00% | 0.00% |           7.37s |     $0.0417 |
|    9 | <code>gemini/gemini-3.8-flash</code>         | 100.00/100 quality score |      100.00 | 0.00% | 0.00% |          10.89s |     $0.0433 |
|   10 | <code>kimi/kimi-k2.6</code>                  | 100.00/100 quality score |      100.00 | 0.00% | 0.00% |          38.30s |     $0.0535 |
|   11 | <code>openai/gpt-5.6-luna</code>             | 100.00/100 quality score |      100.00 | 0.00% | 0.00% |          14.66s |     $0.0052 |
|   12 | <code>openai/gpt-5.6-sol</code>              | 100.00/100 quality score |      100.00 | 0.00% | 0.00% |          24.22s |     $0.1302 |
|   13 | <code>openai/gpt-5.6-terra</code>            | 100.00/100 quality score |      100.00 | 0.00% | 0.00% |          14.42s |     $0.0537 |
|   14 | <code>openai/gpt-6-astra</code>              | 100.00/100 quality score |      100.00 | 0.00% | 0.00% |          30.50s |     $0.2225 |
|   15 | <code>kimi/kimi-k3</code>                    |  99.94/100 quality score |       99.94 | 0.06% | 0.01% |          75.16s |     $0.4535 |
|   16 | <code>mistral/mistral-ocr-4-1</code>         |  99.77/100 quality score |       99.77 | 0.23% | 0.17% |           2.01s |     $0.0400 |
|   17 | <code>deepinfra/google/gemma-4-31B-it</code> |  99.71/100 quality score |       99.71 | 0.29% | 0.05% |          32.73s |     $0.0020 |
|   18 | <code>mistral/mistral-ocr-4-0</code>         |  99.71/100 quality score |       99.71 | 0.29% | 0.27% |           1.67s |     $0.0400 |
|   19 | <code>grok/grok-4.6</code>                   |  99.66/100 quality score |       99.66 | 0.34% | 0.36% |          35.25s |     $0.0841 |
|   20 | <code>glm/glm-5.3-flash</code>               |  99.54/100 quality score |       99.54 | 0.46% | 0.50% |          24.46s |     $0.0159 |
|   21 | <code>grok/grok-4.5</code>                   |  98.74/100 quality score |       98.74 | 1.26% | 1.36% |          20.51s |     $0.0802 |


## Provider Detail

| Provider                                     | Group               | Score / 100 |   WER |   CER | Processing Time | Actual Cost |
| -------------------------------------------- | ------------------- | ----------: | ----: | ----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>        | Third-Party Service |      100.00 | 0.00% | 0.00% |          60.51s |     $0.5401 |
| <code>anthropic/claude-fable-5-1</code>      | Third-Party Service |      100.00 | 0.00% | 0.00% |          66.93s |     $0.5456 |
| <code>anthropic/claude-opus-5</code>         | Third-Party Service |      100.00 | 0.00% | 0.00% |          62.20s |     $0.2720 |
| <code>anthropic/claude-sonnet-5</code>       | Third-Party Service |      100.00 | 0.00% | 0.00% |          48.83s |     $0.1058 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service |       99.71 | 0.29% | 0.05% |          32.73s |     $0.0020 |
| <code>gemini/gemini-3.5-flash</code>         | Third-Party Service |      100.00 | 0.00% | 0.00% |          15.83s |     $0.0487 |
| <code>gemini/gemini-3.5-flash-lite</code>    | Third-Party Service |      100.00 | 0.00% | 0.00% |          11.47s |     $0.0129 |
| <code>gemini/gemini-3.6-flash</code>         | Third-Party Service |      100.00 | 0.00% | 0.00% |          17.73s |     $0.0408 |
| <code>gemini/gemini-3.7-flash</code>         | Third-Party Service |      100.00 | 0.00% | 0.00% |           7.37s |     $0.0417 |
| <code>gemini/gemini-3.8-flash</code>         | Third-Party Service |      100.00 | 0.00% | 0.00% |          10.89s |     $0.0433 |
| <code>glm/glm-5.3-flash</code>               | Third-Party Service |       99.54 | 0.46% | 0.50% |          24.46s |     $0.0159 |
| <code>grok/grok-4.5</code>                   | Third-Party Service |       98.74 | 1.26% | 1.36% |          20.51s |     $0.0802 |
| <code>grok/grok-4.6</code>                   | Third-Party Service |       99.66 | 0.34% | 0.36% |          35.25s |     $0.0841 |
| <code>kimi/kimi-k2.6</code>                  | Third-Party Service |      100.00 | 0.00% | 0.00% |          38.30s |     $0.0535 |
| <code>kimi/kimi-k3</code>                    | Third-Party Service |       99.94 | 0.06% | 0.01% |          75.16s |     $0.4535 |
| <code>mistral/mistral-ocr-4-0</code>         | Third-Party Service |       99.71 | 0.29% | 0.27% |           1.67s |     $0.0400 |
| <code>mistral/mistral-ocr-4-1</code>         | Third-Party Service |       99.77 | 0.23% | 0.17% |           2.01s |     $0.0400 |
| <code>openai/gpt-5.6-luna</code>             | Third-Party Service |      100.00 | 0.00% | 0.00% |          14.66s |     $0.0052 |
| <code>openai/gpt-5.6-sol</code>              | Third-Party Service |      100.00 | 0.00% | 0.00% |          24.22s |     $0.1302 |
| <code>openai/gpt-5.6-terra</code>            | Third-Party Service |      100.00 | 0.00% | 0.00% |          14.42s |     $0.0537 |
| <code>openai/gpt-6-astra</code>              | Third-Party Service |      100.00 | 0.00% | 0.00% |          30.50s |     $0.2225 |

## Error Breakdown (WER)

| Provider                                     | Substitutions | Deletions | Insertions | Ref. Words |
| -------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>        |             0 |         0 |          0 |       1744 |
| <code>anthropic/claude-fable-5-1</code>      |             0 |         0 |          0 |       1744 |
| <code>anthropic/claude-opus-5</code>         |             0 |         0 |          0 |       1744 |
| <code>anthropic/claude-sonnet-5</code>       |             0 |         0 |          0 |       1744 |
| <code>deepinfra/google/gemma-4-31B-it</code> |             4 |         0 |          1 |       1744 |
| <code>gemini/gemini-3.5-flash</code>         |             0 |         0 |          0 |       1744 |
| <code>gemini/gemini-3.5-flash-lite</code>    |             0 |         0 |          0 |       1744 |
| <code>gemini/gemini-3.6-flash</code>         |             0 |         0 |          0 |       1744 |
| <code>gemini/gemini-3.7-flash</code>         |             0 |         0 |          0 |       1744 |
| <code>gemini/gemini-3.8-flash</code>         |             0 |         0 |          0 |       1744 |
| <code>glm/glm-5.3-flash</code>               |             0 |         8 |          0 |       1744 |
| <code>grok/grok-4.5</code>                   |             0 |        22 |          0 |       1744 |
| <code>grok/grok-4.6</code>                   |             0 |         6 |          0 |       1744 |
| <code>kimi/kimi-k2.6</code>                  |             0 |         0 |          0 |       1744 |
| <code>kimi/kimi-k3</code>                    |             1 |         0 |          0 |       1744 |
| <code>mistral/mistral-ocr-4-0</code>         |             0 |         0 |          5 |       1744 |
| <code>mistral/mistral-ocr-4-1</code>         |             1 |         0 |          3 |       1744 |
| <code>openai/gpt-5.6-luna</code>             |             0 |         0 |          0 |       1744 |
| <code>openai/gpt-5.6-sol</code>              |             0 |         0 |          0 |       1744 |
| <code>openai/gpt-5.6-terra</code>            |             0 |         0 |          0 |       1744 |
| <code>openai/gpt-6-astra</code>              |             0 |         0 |          0 |       1744 |

## Notes

- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.2001¢ ($0.0020).
- Fastest cloud service: `mistral/mistral-ocr-4-0` at 1.67s.
