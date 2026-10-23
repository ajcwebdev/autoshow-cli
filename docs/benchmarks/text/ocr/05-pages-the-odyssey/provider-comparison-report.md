# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/ocr/05-pages-the-odyssey`
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

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER   | Processing Time | Actual Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | ----: | --------------: | ----------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0026 | 98.42       | 1.58%  | 0.29% | 32.20s          | $0.0026     |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0038 | 94.10       | 5.90%  | 1.74% | 36.85s          | $0.0038     |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0200 | 92.43       | 7.57%  | 1.83% | 5.82s           | $0.0200     |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0243 | 81.16       | 18.84% | 3.76% | 15.01s          | $0.0243     |
| 5    | <code>anthropic/claude-sonnet-5-5</code> | $0.0443 | 97.10       | 2.90%  | 0.43% | 42.78s          | $0.0443     |
| 6    | <code>openai/gpt-6.1-sol</code>          | $0.0563 | 73.68       | 26.32% | 3.71% | 23.05s          | $0.0563     |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.0953 | 73.86       | 26.14% | 3.69% | 25.37s          | $0.0953     |
| 8    | <code>anthropic/claude-fable-5</code>    | $0.2297 | 80.99       | 19.01% | 3.81% | 48.41s          | $0.2297     |
| 9    | <code>grok/grok-4.7</code>               | $0.2847 | 92.17       | 7.83%  | 1.12% | 492.23s         | $0.2847     |

#### Speed

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER   | Processing Time | Actual Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | ----: | --------------: | ----------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 5.82s   | 92.43       | 7.57%  | 1.83% | 5.82s           | $0.0200     |
| 2    | <code>gemini/gemini-3.8-flash</code>     | 15.01s  | 81.16       | 18.84% | 3.76% | 15.01s          | $0.0243     |
| 3    | <code>openai/gpt-6.1-sol</code>          | 23.05s  | 73.68       | 26.32% | 3.71% | 23.05s          | $0.0563     |
| 4    | <code>anthropic/claude-opus-5-5</code>   | 25.37s  | 73.86       | 26.14% | 3.69% | 25.37s          | $0.0953     |
| 5    | <code>anthropic/claude-haiku-5-5</code>  | 32.20s  | 98.42       | 1.58%  | 0.29% | 32.20s          | $0.0026     |
| 6    | <code>openai/gpt-6-luna</code>           | 36.85s  | 94.10       | 5.90%  | 1.74% | 36.85s          | $0.0038     |
| 7    | <code>anthropic/claude-sonnet-5-5</code> | 42.78s  | 97.10       | 2.90%  | 0.43% | 42.78s          | $0.0443     |
| 8    | <code>anthropic/claude-fable-5</code>    | 48.41s  | 80.99       | 19.01% | 3.81% | 48.41s          | $0.2297     |
| 9    | <code>grok/grok-4.7</code>               | 492.23s | 92.17       | 7.83%  | 1.12% | 492.23s         | $0.2847     |

#### Quality Score

| Rank | Provider                                 | Value                   | Score / 100 | WER    | CER   | Processing Time | Actual Cost |
| ---: | ---------------------------------------- | ----------------------: | ----------: | -----: | ----: | --------------: | ----------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | 98.42/100 quality score | 98.42       | 1.58%  | 0.29% | 32.20s          | $0.0026     |
| 2    | <code>anthropic/claude-sonnet-5-5</code> | 97.10/100 quality score | 97.10       | 2.90%  | 0.43% | 42.78s          | $0.0443     |
| 3    | <code>openai/gpt-6-luna</code>           | 94.10/100 quality score | 94.10       | 5.90%  | 1.74% | 36.85s          | $0.0038     |
| 4    | <code>mistral/mistral-ocr-4-1</code>     | 92.43/100 quality score | 92.43       | 7.57%  | 1.83% | 5.82s           | $0.0200     |
| 5    | <code>grok/grok-4.7</code>               | 92.17/100 quality score | 92.17       | 7.83%  | 1.12% | 492.23s         | $0.2847     |
| 6    | <code>gemini/gemini-3.8-flash</code>     | 81.16/100 quality score | 81.16       | 18.84% | 3.76% | 15.01s          | $0.0243     |
| 7    | <code>anthropic/claude-fable-5</code>    | 80.99/100 quality score | 80.99       | 19.01% | 3.81% | 48.41s          | $0.2297     |
| 8    | <code>anthropic/claude-opus-5-5</code>   | 73.86/100 quality score | 73.86       | 26.14% | 3.69% | 25.37s          | $0.0953     |
| 9    | <code>openai/gpt-6.1-sol</code>          | 73.68/100 quality score | 73.68       | 26.32% | 3.71% | 23.05s          | $0.0563     |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER   | Processing Time | Actual Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | ----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 80.99       | 19.01% | 3.81% | 48.41s          | $0.2297     |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 98.42       | 1.58%  | 0.29% | 32.20s          | $0.0026     |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 73.86       | 26.14% | 3.69% | 25.37s          | $0.0953     |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 97.10       | 2.90%  | 0.43% | 42.78s          | $0.0443     |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 81.16       | 18.84% | 3.76% | 15.01s          | $0.0243     |
| <code>grok/grok-4.7</code>               | Third-Party Service | 92.17       | 7.83%  | 1.12% | 492.23s         | $0.2847     |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 92.43       | 7.57%  | 1.83% | 5.82s           | $0.0200     |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 94.10       | 5.90%  | 1.74% | 36.85s          | $0.0038     |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 73.68       | 26.32% | 3.71% | 23.05s          | $0.0563     |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>    | 189           | 3         | 24         | 1136       |
| <code>anthropic/claude-haiku-5-5</code>  | 14            | 3         | 1          | 1136       |
| <code>anthropic/claude-opus-5-5</code>   | 189           | 24        | 84         | 1136       |
| <code>anthropic/claude-sonnet-5-5</code> | 11            | 22        | 0          | 1136       |
| <code>gemini/gemini-3.8-flash</code>     | 187           | 3         | 24         | 1136       |
| <code>grok/grok-4.7</code>               | 51            | 18        | 20         | 1136       |
| <code>mistral/mistral-ocr-4-1</code>     | 55            | 29        | 2          | 1136       |
| <code>openai/gpt-6-luna</code>           | 17            | 50        | 0          | 1136       |
| <code>openai/gpt-6.1-sol</code>          | 191           | 23        | 85         | 1136       |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best cloud service: `anthropic/claude-haiku-5-5` scored 98.42/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.2616¢ ($0.0026).
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 5.82s.
