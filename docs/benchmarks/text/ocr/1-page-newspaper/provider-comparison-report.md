# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/ocr/1-page-newspaper`
- Total providers: 8 (0 local, 8 third-party service)
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
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0026 | 61.67       | 38.33% | 63.59% | 55.68s          | $0.0026     |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0026 | 73.06       | 26.94% | 26.13% | 24.92s          | $0.0026     |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 72.55       | 27.45% | 18.35% | 12.54s          | $0.0040     |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0246 | 92.38       | 7.62%  | 5.67%  | 16.27s          | $0.0246     |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0414 | 98.86       | 1.14%  | 0.43%  | 25.79s          | $0.0414     |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0526 | 97.08       | 2.92%  | 1.70%  | 68.98s          | $0.0526     |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.1056 | 98.69       | 1.31%  | 0.58%  | 37.34s          | $0.1056     |
| 8    | <code>anthropic/claude-fable-5</code>    | $0.3038 | 98.26       | 1.74%  | 1.05%  | 75.57s          | $0.3038     |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---: | ---------------------------------------- | -----: | ----------: | -----: | -----: | --------------: | ----------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 12.54s | 72.55       | 27.45% | 18.35% | 12.54s          | $0.0040     |
| 2    | <code>gemini/gemini-3.8-flash</code>     | 16.27s | 92.38       | 7.62%  | 5.67%  | 16.27s          | $0.0246     |
| 3    | <code>openai/gpt-6-luna</code>           | 24.92s | 73.06       | 26.94% | 26.13% | 24.92s          | $0.0026     |
| 4    | <code>openai/gpt-6.1-sol</code>          | 25.79s | 98.86       | 1.14%  | 0.43%  | 25.79s          | $0.0414     |
| 5    | <code>anthropic/claude-opus-5-5</code>   | 37.34s | 98.69       | 1.31%  | 0.58%  | 37.34s          | $0.1056     |
| 6    | <code>anthropic/claude-haiku-5-5</code>  | 55.68s | 61.67       | 38.33% | 63.59% | 55.68s          | $0.0026     |
| 7    | <code>anthropic/claude-sonnet-5-5</code> | 68.98s | 97.08       | 2.92%  | 1.70%  | 68.98s          | $0.0526     |
| 8    | <code>anthropic/claude-fable-5</code>    | 75.57s | 98.26       | 1.74%  | 1.05%  | 75.57s          | $0.3038     |

#### Quality Score

| Rank | Provider                                 | Value                   | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---: | ---------------------------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | ----------: |
| 1    | <code>openai/gpt-6.1-sol</code>          | 98.86/100 quality score | 98.86       | 1.14%  | 0.43%  | 25.79s          | $0.0414     |
| 2    | <code>anthropic/claude-opus-5-5</code>   | 98.69/100 quality score | 98.69       | 1.31%  | 0.58%  | 37.34s          | $0.1056     |
| 3    | <code>anthropic/claude-fable-5</code>    | 98.26/100 quality score | 98.26       | 1.74%  | 1.05%  | 75.57s          | $0.3038     |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 97.08/100 quality score | 97.08       | 2.92%  | 1.70%  | 68.98s          | $0.0526     |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 92.38/100 quality score | 92.38       | 7.62%  | 5.67%  | 16.27s          | $0.0246     |
| 6    | <code>openai/gpt-6-luna</code>           | 73.06/100 quality score | 73.06       | 26.94% | 26.13% | 24.92s          | $0.0026     |
| 7    | <code>mistral/mistral-ocr-4-1</code>     | 72.55/100 quality score | 72.55       | 27.45% | 18.35% | 12.54s          | $0.0040     |
| 8    | <code>anthropic/claude-haiku-5-5</code>  | 61.67/100 quality score | 61.67       | 38.33% | 63.59% | 55.68s          | $0.0026     |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | -----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 98.26       | 1.74%  | 1.05%  | 75.57s          | $0.3038     |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 61.67       | 38.33% | 63.59% | 55.68s          | $0.0026     |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 98.69       | 1.31%  | 0.58%  | 37.34s          | $0.1056     |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 97.08       | 2.92%  | 1.70%  | 68.98s          | $0.0526     |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 92.38       | 7.62%  | 5.67%  | 16.27s          | $0.0246     |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 72.55       | 27.45% | 18.35% | 12.54s          | $0.0040     |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 73.06       | 26.94% | 26.13% | 24.92s          | $0.0026     |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 98.86       | 1.14%  | 0.43%  | 25.79s          | $0.0414     |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>    | 27            | 5         | 9          | 2361       |
| <code>anthropic/claude-haiku-5-5</code>  | 485           | 386       | 34         | 2361       |
| <code>anthropic/claude-opus-5-5</code>   | 21            | 4         | 6          | 2361       |
| <code>anthropic/claude-sonnet-5-5</code> | 47            | 17        | 5          | 2361       |
| <code>gemini/gemini-3.8-flash</code>     | 147           | 22        | 11         | 2361       |
| <code>mistral/mistral-ocr-4-1</code>     | 471           | 124       | 53         | 2361       |
| <code>openai/gpt-6-luna</code>           | 53            | 567       | 16         | 2361       |
| <code>openai/gpt-6.1-sol</code>          | 22            | 4         | 1          | 2361       |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best cloud service: `openai/gpt-6.1-sol` scored 98.86/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.2582¢ ($0.0026).
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 12.54s.
