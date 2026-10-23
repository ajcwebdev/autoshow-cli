# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/ocr/10-document`
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

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Actual Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | ----------: |
| 1    | <code>openai/gpt-6-luna</code>           | $0.0048 | 100.00      | 0.00% | 0.00% | 26.86s          | $0.0048     |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | $0.0055 | 100.00      | 0.00% | 0.00% | 64.41s          | $0.0055     |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0400 | 99.77       | 0.23% | 0.17% | 2.01s           | $0.0400     |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0433 | 100.00      | 0.00% | 0.00% | 10.89s          | $0.0433     |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0929 | 100.00      | 0.00% | 0.00% | 26.82s          | $0.0929     |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.1081 | 100.00      | 0.00% | 0.00% | 31.86s          | $0.1081     |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.2177 | 100.00      | 0.00% | 0.00% | 75.60s          | $0.2177     |
| 8    | <code>grok/grok-4.7</code>               | $0.2485 | 100.00      | 0.00% | 0.00% | 342.05s         | $0.2485     |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.5401 | 100.00      | 0.00% | 0.00% | 60.51s          | $0.5401     |

#### Speed

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Actual Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | ----------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 2.01s   | 99.77       | 0.23% | 0.17% | 2.01s           | $0.0400     |
| 2    | <code>gemini/gemini-3.8-flash</code>     | 10.89s  | 100.00      | 0.00% | 0.00% | 10.89s          | $0.0433     |
| 3    | <code>openai/gpt-6.1-sol</code>          | 26.82s  | 100.00      | 0.00% | 0.00% | 26.82s          | $0.0929     |
| 4    | <code>openai/gpt-6-luna</code>           | 26.86s  | 100.00      | 0.00% | 0.00% | 26.86s          | $0.0048     |
| 5    | <code>anthropic/claude-sonnet-5-5</code> | 31.86s  | 100.00      | 0.00% | 0.00% | 31.86s          | $0.1081     |
| 6    | <code>anthropic/claude-fable-5</code>    | 60.51s  | 100.00      | 0.00% | 0.00% | 60.51s          | $0.5401     |
| 7    | <code>anthropic/claude-haiku-5-5</code>  | 64.41s  | 100.00      | 0.00% | 0.00% | 64.41s          | $0.0055     |
| 8    | <code>anthropic/claude-opus-5-5</code>   | 75.60s  | 100.00      | 0.00% | 0.00% | 75.60s          | $0.2177     |
| 9    | <code>grok/grok-4.7</code>               | 342.05s | 100.00      | 0.00% | 0.00% | 342.05s         | $0.2485     |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER   | CER   | Processing Time | Actual Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | ----------: |
| 1    | <code>anthropic/claude-fable-5</code>    | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 60.51s          | $0.5401     |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 64.41s          | $0.0055     |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 75.60s          | $0.2177     |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 31.86s          | $0.1081     |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 10.89s          | $0.0433     |
| 6    | <code>grok/grok-4.7</code>               | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 342.05s         | $0.2485     |
| 7    | <code>openai/gpt-6-luna</code>           | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 26.86s          | $0.0048     |
| 8    | <code>openai/gpt-6.1-sol</code>          | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 26.82s          | $0.0929     |
| 9    | <code>mistral/mistral-ocr-4-1</code>     | 99.77/100 quality score  | 99.77       | 0.23% | 0.17% | 2.01s           | $0.0400     |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER   | CER   | Processing Time | Actual Cost |
| ---------------------------------------- | ------------------- | ----------: | ----: | ----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 100.00      | 0.00% | 0.00% | 60.51s          | $0.5401     |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 100.00      | 0.00% | 0.00% | 64.41s          | $0.0055     |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 100.00      | 0.00% | 0.00% | 75.60s          | $0.2177     |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00      | 0.00% | 0.00% | 31.86s          | $0.1081     |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 100.00      | 0.00% | 0.00% | 10.89s          | $0.0433     |
| <code>grok/grok-4.7</code>               | Third-Party Service | 100.00      | 0.00% | 0.00% | 342.05s         | $0.2485     |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 99.77       | 0.23% | 0.17% | 2.01s           | $0.0400     |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 100.00      | 0.00% | 0.00% | 26.86s          | $0.0048     |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 100.00      | 0.00% | 0.00% | 26.82s          | $0.0929     |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>    | 0             | 0         | 0          | 1744       |
| <code>anthropic/claude-haiku-5-5</code>  | 0             | 0         | 0          | 1744       |
| <code>anthropic/claude-opus-5-5</code>   | 0             | 0         | 0          | 1744       |
| <code>anthropic/claude-sonnet-5-5</code> | 0             | 0         | 0          | 1744       |
| <code>gemini/gemini-3.8-flash</code>     | 0             | 0         | 0          | 1744       |
| <code>grok/grok-4.7</code>               | 0             | 0         | 0          | 1744       |
| <code>mistral/mistral-ocr-4-1</code>     | 1             | 0         | 3          | 1744       |
| <code>openai/gpt-6-luna</code>           | 0             | 0         | 0          | 1744       |
| <code>openai/gpt-6.1-sol</code>          | 0             | 0         | 0          | 1744       |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `openai/gpt-6-luna` at 0.4815¢ ($0.0048).
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 2.01s.
