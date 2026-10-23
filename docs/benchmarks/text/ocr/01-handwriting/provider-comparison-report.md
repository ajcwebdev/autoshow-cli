# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/ocr/01-handwriting`
- Total providers: 9 (0 local, 9 third-party service)
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

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost                 |
| ---: | -------- | ----: | ----------: | --: | --: | --------------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a         | n/a | n/a | n/a             | No providers in this group. |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost                 |
| ---: | -------- | ----: | ----------: | --: | --: | --------------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a         | n/a | n/a | n/a             | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost                 |
| ---: | -------- | ----: | ----------: | --: | --: | --------------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a         | n/a | n/a | n/a             | No providers in this group. |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | -----: | --------------: | ----------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0006 | 71.43       | 28.57% | 10.23% | 9.15s           | $0.0006     |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0012 | 74.88       | 25.12% | 10.40% | 35.02s          | $0.0012     |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 89.66       | 10.34% | 3.47%  | 1.40s           | $0.0040     |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0078 | 82.27       | 17.73% | 4.16%  | 2.84s           | $0.0078     |
| 5    | <code>anthropic/claude-sonnet-5-5</code> | $0.0094 | 81.77       | 18.23% | 4.51%  | 10.73s          | $0.0094     |
| 6    | <code>anthropic/claude-opus-5-5</code>   | $0.0157 | 88.18       | 11.82% | 3.99%  | 5.96s           | $0.0157     |
| 7    | <code>grok/grok-4.7</code>               | $0.0230 | 86.21       | 13.79% | 5.72%  | 29.81s          | $0.0230     |
| 8    | <code>openai/gpt-6.1-sol</code>          | $0.0243 | 80.30       | 19.70% | 6.93%  | 27.26s          | $0.0243     |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0422 | 90.15       | 9.85%  | 2.25%  | 9.87s           | $0.0422     |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---: | ---------------------------------------- | -----: | ----------: | -----: | -----: | --------------: | ----------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 1.40s  | 89.66       | 10.34% | 3.47%  | 1.40s           | $0.0040     |
| 2    | <code>gemini/gemini-3.8-flash</code>     | 2.84s  | 82.27       | 17.73% | 4.16%  | 2.84s           | $0.0078     |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 5.96s  | 88.18       | 11.82% | 3.99%  | 5.96s           | $0.0157     |
| 4    | <code>anthropic/claude-haiku-5-5</code>  | 9.15s  | 71.43       | 28.57% | 10.23% | 9.15s           | $0.0006     |
| 5    | <code>anthropic/claude-fable-5</code>    | 9.87s  | 90.15       | 9.85%  | 2.25%  | 9.87s           | $0.0422     |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | 10.73s | 81.77       | 18.23% | 4.51%  | 10.73s          | $0.0094     |
| 7    | <code>openai/gpt-6.1-sol</code>          | 27.26s | 80.30       | 19.70% | 6.93%  | 27.26s          | $0.0243     |
| 8    | <code>grok/grok-4.7</code>               | 29.81s | 86.21       | 13.79% | 5.72%  | 29.81s          | $0.0230     |
| 9    | <code>openai/gpt-6-luna</code>           | 35.02s | 74.88       | 25.12% | 10.40% | 35.02s          | $0.0012     |

#### Quality Score

| Rank | Provider                                 | Value                   | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---: | ---------------------------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | ----------: |
| 1    | <code>anthropic/claude-fable-5</code>    | 90.15/100 quality score | 90.15       | 9.85%  | 2.25%  | 9.87s           | $0.0422     |
| 2    | <code>mistral/mistral-ocr-4-1</code>     | 89.66/100 quality score | 89.66       | 10.34% | 3.47%  | 1.40s           | $0.0040     |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 88.18/100 quality score | 88.18       | 11.82% | 3.99%  | 5.96s           | $0.0157     |
| 4    | <code>grok/grok-4.7</code>               | 86.21/100 quality score | 86.21       | 13.79% | 5.72%  | 29.81s          | $0.0230     |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 82.27/100 quality score | 82.27       | 17.73% | 4.16%  | 2.84s           | $0.0078     |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | 81.77/100 quality score | 81.77       | 18.23% | 4.51%  | 10.73s          | $0.0094     |
| 7    | <code>openai/gpt-6.1-sol</code>          | 80.30/100 quality score | 80.30       | 19.70% | 6.93%  | 27.26s          | $0.0243     |
| 8    | <code>openai/gpt-6-luna</code>           | 74.88/100 quality score | 74.88       | 25.12% | 10.40% | 35.02s          | $0.0012     |
| 9    | <code>anthropic/claude-haiku-5-5</code>  | 71.43/100 quality score | 71.43       | 28.57% | 10.23% | 9.15s           | $0.0006     |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | -----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 90.15       | 9.85%  | 2.25%  | 9.87s           | $0.0422     |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 71.43       | 28.57% | 10.23% | 9.15s           | $0.0006     |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 88.18       | 11.82% | 3.99%  | 5.96s           | $0.0157     |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 81.77       | 18.23% | 4.51%  | 10.73s          | $0.0094     |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 82.27       | 17.73% | 4.16%  | 2.84s           | $0.0078     |
| <code>grok/grok-4.7</code>               | Third-Party Service | 86.21       | 13.79% | 5.72%  | 29.81s          | $0.0230     |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 89.66       | 10.34% | 3.47%  | 1.40s           | $0.0040     |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 74.88       | 25.12% | 10.40% | 35.02s          | $0.0012     |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 80.30       | 19.70% | 6.93%  | 27.26s          | $0.0243     |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>    | 12            | 6         | 2          | 203        |
| <code>anthropic/claude-haiku-5-5</code>  | 35            | 2         | 21         | 203        |
| <code>anthropic/claude-opus-5-5</code>   | 15            | 8         | 1          | 203        |
| <code>anthropic/claude-sonnet-5-5</code> | 26            | 1         | 10         | 203        |
| <code>gemini/gemini-3.8-flash</code>     | 22            | 0         | 14         | 203        |
| <code>grok/grok-4.7</code>               | 24            | 3         | 1          | 203        |
| <code>mistral/mistral-ocr-4-1</code>     | 19            | 1         | 1          | 203        |
| <code>openai/gpt-6-luna</code>           | 37            | 7         | 7          | 203        |
| <code>openai/gpt-6.1-sol</code>          | 31            | 0         | 9          | 203        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best cloud service: `anthropic/claude-fable-5` scored 90.15/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.0587¢ ($0.0006).
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.40s.
