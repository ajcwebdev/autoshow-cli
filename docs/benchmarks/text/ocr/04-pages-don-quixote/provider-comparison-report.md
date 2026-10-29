# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/ocr/04-pages-don-quixote`
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
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0026 | 33.58       | 66.42% | 65.83% | 32.68s          | $0.0026     |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0032 | 99.40       | 0.60%  | 0.64%  | 16.38s          | $0.0032     |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0160 | 99.85       | 0.15%  | 0.19%  | 6.67s           | $0.0160     |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0167 | 99.85       | 0.15%  | 0.19%  | 10.99s          | $0.0167     |
| 5    | <code>anthropic/claude-sonnet-5-5</code> | $0.0407 | 98.28       | 1.72%  | 0.34%  | 16.70s          | $0.0407     |
| 6    | <code>openai/gpt-6.1-sol</code>          | $0.0593 | 98.35       | 1.65%  | 0.34%  | 19.37s          | $0.0593     |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.0755 | 99.78       | 0.22%  | 0.19%  | 35.67s          | $0.0755     |
| 8    | <code>grok/grok-4.7</code>               | $0.0781 | 99.70       | 0.30%  | 0.38%  | 95.50s          | $0.0781     |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.1871 | 99.78       | 0.22%  | 0.19%  | 37.14s          | $0.1871     |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---: | ---------------------------------------- | -----: | ----------: | -----: | -----: | --------------: | ----------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 6.67s  | 99.85       | 0.15%  | 0.19%  | 6.67s           | $0.0160     |
| 2    | <code>gemini/gemini-3.8-flash</code>     | 10.99s | 99.85       | 0.15%  | 0.19%  | 10.99s          | $0.0167     |
| 3    | <code>openai/gpt-6-luna</code>           | 16.38s | 99.40       | 0.60%  | 0.64%  | 16.38s          | $0.0032     |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 16.70s | 98.28       | 1.72%  | 0.34%  | 16.70s          | $0.0407     |
| 5    | <code>openai/gpt-6.1-sol</code>          | 19.37s | 98.35       | 1.65%  | 0.34%  | 19.37s          | $0.0593     |
| 6    | <code>anthropic/claude-haiku-5-5</code>  | 32.68s | 33.58       | 66.42% | 65.83% | 32.68s          | $0.0026     |
| 7    | <code>anthropic/claude-opus-5-5</code>   | 35.67s | 99.78       | 0.22%  | 0.19%  | 35.67s          | $0.0755     |
| 8    | <code>anthropic/claude-fable-5</code>    | 37.14s | 99.78       | 0.22%  | 0.19%  | 37.14s          | $0.1871     |
| 9    | <code>grok/grok-4.7</code>               | 95.50s | 99.70       | 0.30%  | 0.38%  | 95.50s          | $0.0781     |

#### Quality Score

| Rank | Provider                                 | Value                   | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---: | ---------------------------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | ----------: |
| 1    | <code>gemini/gemini-3.8-flash</code>     | 99.85/100 quality score | 99.85       | 0.15%  | 0.19%  | 10.99s          | $0.0167     |
| 2    | <code>mistral/mistral-ocr-4-1</code>     | 99.85/100 quality score | 99.85       | 0.15%  | 0.19%  | 6.67s           | $0.0160     |
| 3    | <code>anthropic/claude-fable-5</code>    | 99.78/100 quality score | 99.78       | 0.22%  | 0.19%  | 37.14s          | $0.1871     |
| 4    | <code>anthropic/claude-opus-5-5</code>   | 99.78/100 quality score | 99.78       | 0.22%  | 0.19%  | 35.67s          | $0.0755     |
| 5    | <code>grok/grok-4.7</code>               | 99.70/100 quality score | 99.70       | 0.30%  | 0.38%  | 95.50s          | $0.0781     |
| 6    | <code>openai/gpt-6-luna</code>           | 99.40/100 quality score | 99.40       | 0.60%  | 0.64%  | 16.38s          | $0.0032     |
| 7    | <code>openai/gpt-6.1-sol</code>          | 98.35/100 quality score | 98.35       | 1.65%  | 0.34%  | 19.37s          | $0.0593     |
| 8    | <code>anthropic/claude-sonnet-5-5</code> | 98.28/100 quality score | 98.28       | 1.72%  | 0.34%  | 16.70s          | $0.0407     |
| 9    | <code>anthropic/claude-haiku-5-5</code>  | 33.58/100 quality score | 33.58       | 66.42% | 65.83% | 32.68s          | $0.0026     |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | -----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 99.78       | 0.22%  | 0.19%  | 37.14s          | $0.1871     |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 33.58       | 66.42% | 65.83% | 32.68s          | $0.0026     |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 99.78       | 0.22%  | 0.19%  | 35.67s          | $0.0755     |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 98.28       | 1.72%  | 0.34%  | 16.70s          | $0.0407     |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 99.85       | 0.15%  | 0.19%  | 10.99s          | $0.0167     |
| <code>grok/grok-4.7</code>               | Third-Party Service | 99.70       | 0.30%  | 0.38%  | 95.50s          | $0.0781     |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 99.85       | 0.15%  | 0.19%  | 6.67s           | $0.0160     |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 99.40       | 0.60%  | 0.64%  | 16.38s          | $0.0032     |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 98.35       | 1.65%  | 0.34%  | 19.37s          | $0.0593     |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>    | 2             | 1         | 0          | 1337       |
| <code>anthropic/claude-haiku-5-5</code>  | 4             | 5         | 879        | 1337       |
| <code>anthropic/claude-opus-5-5</code>   | 2             | 1         | 0          | 1337       |
| <code>anthropic/claude-sonnet-5-5</code> | 12            | 1         | 10         | 1337       |
| <code>gemini/gemini-3.8-flash</code>     | 0             | 2         | 0          | 1337       |
| <code>grok/grok-4.7</code>               | 0             | 4         | 0          | 1337       |
| <code>mistral/mistral-ocr-4-1</code>     | 0             | 2         | 0          | 1337       |
| <code>openai/gpt-6-luna</code>           | 0             | 8         | 0          | 1337       |
| <code>openai/gpt-6.1-sol</code>          | 10            | 2         | 10         | 1337       |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best cloud service: `gemini/gemini-3.8-flash` scored 99.85/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.2613¢ ($0.0026).
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 6.67s.
