# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/ocr/01-test-picture`
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
| 1    | <code>openai/gpt-6-luna</code>           | $0.0002 | 100.00      | 0.00% | 0.00% | 2.39s           | $0.0002     |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | $0.0002 | 100.00      | 0.00% | 0.00% | 3.99s           | $0.0002     |
| 3    | <code>openai/gpt-6.1-sol</code>          | $0.0027 | 100.00      | 0.00% | 0.00% | 1.99s           | $0.0027     |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0028 | 100.00      | 0.00% | 0.00% | 2.09s           | $0.0028     |
| 5    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 100.00      | 0.00% | 0.00% | 0.58s           | $0.0040     |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0044 | 100.00      | 0.00% | 0.00% | 2.04s           | $0.0044     |
| 7    | <code>grok/grok-4.7</code>               | $0.0050 | 100.00      | 0.00% | 0.00% | 1.66s           | $0.0050     |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0088 | 100.00      | 0.00% | 0.00% | 4.02s           | $0.0088     |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0189 | 100.00      | 0.00% | 0.00% | 3.77s           | $0.0189     |

#### Speed

| Rank | Provider                                 | Value | Score / 100 | WER   | CER   | Processing Time | Actual Cost |
| ---: | ---------------------------------------- | ----: | ----------: | ----: | ----: | --------------: | ----------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 0.58s | 100.00      | 0.00% | 0.00% | 0.58s           | $0.0040     |
| 2    | <code>grok/grok-4.7</code>               | 1.66s | 100.00      | 0.00% | 0.00% | 1.66s           | $0.0050     |
| 3    | <code>openai/gpt-6.1-sol</code>          | 1.99s | 100.00      | 0.00% | 0.00% | 1.99s           | $0.0027     |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 2.04s | 100.00      | 0.00% | 0.00% | 2.04s           | $0.0044     |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 2.09s | 100.00      | 0.00% | 0.00% | 2.09s           | $0.0028     |
| 6    | <code>openai/gpt-6-luna</code>           | 2.39s | 100.00      | 0.00% | 0.00% | 2.39s           | $0.0002     |
| 7    | <code>anthropic/claude-fable-5</code>    | 3.77s | 100.00      | 0.00% | 0.00% | 3.77s           | $0.0189     |
| 8    | <code>anthropic/claude-haiku-5-5</code>  | 3.99s | 100.00      | 0.00% | 0.00% | 3.99s           | $0.0002     |
| 9    | <code>anthropic/claude-opus-5-5</code>   | 4.02s | 100.00      | 0.00% | 0.00% | 4.02s           | $0.0088     |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER   | CER   | Processing Time | Actual Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | ----------: |
| 1    | <code>anthropic/claude-fable-5</code>    | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 3.77s           | $0.0189     |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 3.99s           | $0.0002     |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 4.02s           | $0.0088     |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.04s           | $0.0044     |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.09s           | $0.0028     |
| 6    | <code>grok/grok-4.7</code>               | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 1.66s           | $0.0050     |
| 7    | <code>mistral/mistral-ocr-4-1</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 0.58s           | $0.0040     |
| 8    | <code>openai/gpt-6-luna</code>           | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.39s           | $0.0002     |
| 9    | <code>openai/gpt-6.1-sol</code>          | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 1.99s           | $0.0027     |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER   | CER   | Processing Time | Actual Cost |
| ---------------------------------------- | ------------------- | ----------: | ----: | ----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 100.00      | 0.00% | 0.00% | 3.77s           | $0.0189     |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 100.00      | 0.00% | 0.00% | 3.99s           | $0.0002     |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 100.00      | 0.00% | 0.00% | 4.02s           | $0.0088     |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.04s           | $0.0044     |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.09s           | $0.0028     |
| <code>grok/grok-4.7</code>               | Third-Party Service | 100.00      | 0.00% | 0.00% | 1.66s           | $0.0050     |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 100.00      | 0.00% | 0.00% | 0.58s           | $0.0040     |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.39s           | $0.0002     |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 100.00      | 0.00% | 0.00% | 1.99s           | $0.0027     |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>    | 0             | 0         | 0          | 20         |
| <code>anthropic/claude-haiku-5-5</code>  | 0             | 0         | 0          | 20         |
| <code>anthropic/claude-opus-5-5</code>   | 0             | 0         | 0          | 20         |
| <code>anthropic/claude-sonnet-5-5</code> | 0             | 0         | 0          | 20         |
| <code>gemini/gemini-3.8-flash</code>     | 0             | 0         | 0          | 20         |
| <code>grok/grok-4.7</code>               | 0             | 0         | 0          | 20         |
| <code>mistral/mistral-ocr-4-1</code>     | 0             | 0         | 0          | 20         |
| <code>openai/gpt-6-luna</code>           | 0             | 0         | 0          | 20         |
| <code>openai/gpt-6.1-sol</code>          | 0             | 0         | 0          | 20         |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `openai/gpt-6-luna` at 0.0154¢ ($0.0002).
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 0.58s.
