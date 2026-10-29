# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/ocr/01-ad-copy`
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
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0002 | 92.06       | 7.94%  | 4.87%  | 4.49s           | $0.0002     |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0003 | 92.06       | 7.94%  | 6.67%  | 3.32s           | $0.0003     |
| 3    | <code>openai/gpt-6.1-sol</code>          | $0.0027 | 92.06       | 7.94%  | 6.67%  | 3.10s           | $0.0027     |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0030 | 98.41       | 1.59%  | 0.26%  | 2.23s           | $0.0030     |
| 5    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 82.54       | 17.46% | 14.36% | 1.16s           | $0.0040     |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0051 | 98.41       | 1.59%  | 0.26%  | 6.56s           | $0.0051     |
| 7    | <code>grok/grok-4.7</code>               | $0.0070 | 100.00      | 0.00%  | 0.00%  | 5.95s           | $0.0070     |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0101 | 98.41       | 1.59%  | 0.26%  | 3.87s           | $0.0101     |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0226 | 95.24       | 4.76%  | 4.62%  | 7.16s           | $0.0226     |

#### Speed

| Rank | Provider                                 | Value | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---: | ---------------------------------------- | ----: | ----------: | -----: | -----: | --------------: | ----------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 1.16s | 82.54       | 17.46% | 14.36% | 1.16s           | $0.0040     |
| 2    | <code>gemini/gemini-3.8-flash</code>     | 2.23s | 98.41       | 1.59%  | 0.26%  | 2.23s           | $0.0030     |
| 3    | <code>openai/gpt-6.1-sol</code>          | 3.10s | 92.06       | 7.94%  | 6.67%  | 3.10s           | $0.0027     |
| 4    | <code>openai/gpt-6-luna</code>           | 3.32s | 92.06       | 7.94%  | 6.67%  | 3.32s           | $0.0003     |
| 5    | <code>anthropic/claude-opus-5-5</code>   | 3.87s | 98.41       | 1.59%  | 0.26%  | 3.87s           | $0.0101     |
| 6    | <code>anthropic/claude-haiku-5-5</code>  | 4.49s | 92.06       | 7.94%  | 4.87%  | 4.49s           | $0.0002     |
| 7    | <code>grok/grok-4.7</code>               | 5.95s | 100.00      | 0.00%  | 0.00%  | 5.95s           | $0.0070     |
| 8    | <code>anthropic/claude-sonnet-5-5</code> | 6.56s | 98.41       | 1.59%  | 0.26%  | 6.56s           | $0.0051     |
| 9    | <code>anthropic/claude-fable-5</code>    | 7.16s | 95.24       | 4.76%  | 4.62%  | 7.16s           | $0.0226     |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | -----: | -----: | --------------: | ----------: |
| 1    | <code>grok/grok-4.7</code>               | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 5.95s           | $0.0070     |
| 2    | <code>anthropic/claude-opus-5-5</code>   | 98.41/100 quality score  | 98.41       | 1.59%  | 0.26%  | 3.87s           | $0.0101     |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 98.41/100 quality score  | 98.41       | 1.59%  | 0.26%  | 6.56s           | $0.0051     |
| 4    | <code>gemini/gemini-3.8-flash</code>     | 98.41/100 quality score  | 98.41       | 1.59%  | 0.26%  | 2.23s           | $0.0030     |
| 5    | <code>anthropic/claude-fable-5</code>    | 95.24/100 quality score  | 95.24       | 4.76%  | 4.62%  | 7.16s           | $0.0226     |
| 6    | <code>anthropic/claude-haiku-5-5</code>  | 92.06/100 quality score  | 92.06       | 7.94%  | 4.87%  | 4.49s           | $0.0002     |
| 7    | <code>openai/gpt-6-luna</code>           | 92.06/100 quality score  | 92.06       | 7.94%  | 6.67%  | 3.32s           | $0.0003     |
| 8    | <code>openai/gpt-6.1-sol</code>          | 92.06/100 quality score  | 92.06       | 7.94%  | 6.67%  | 3.10s           | $0.0027     |
| 9    | <code>mistral/mistral-ocr-4-1</code>     | 82.54/100 quality score  | 82.54       | 17.46% | 14.36% | 1.16s           | $0.0040     |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER    | Processing Time | Actual Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | -----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 95.24       | 4.76%  | 4.62%  | 7.16s           | $0.0226     |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 92.06       | 7.94%  | 4.87%  | 4.49s           | $0.0002     |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 98.41       | 1.59%  | 0.26%  | 3.87s           | $0.0101     |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 98.41       | 1.59%  | 0.26%  | 6.56s           | $0.0051     |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 98.41       | 1.59%  | 0.26%  | 2.23s           | $0.0030     |
| <code>grok/grok-4.7</code>               | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 5.95s           | $0.0070     |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 82.54       | 17.46% | 14.36% | 1.16s           | $0.0040     |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 92.06       | 7.94%  | 6.67%  | 3.32s           | $0.0003     |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 92.06       | 7.94%  | 6.67%  | 3.10s           | $0.0027     |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>    | 0             | 2         | 1          | 63         |
| <code>anthropic/claude-haiku-5-5</code>  | 1             | 2         | 2          | 63         |
| <code>anthropic/claude-opus-5-5</code>   | 1             | 0         | 0          | 63         |
| <code>anthropic/claude-sonnet-5-5</code> | 1             | 0         | 0          | 63         |
| <code>gemini/gemini-3.8-flash</code>     | 1             | 0         | 0          | 63         |
| <code>grok/grok-4.7</code>               | 0             | 0         | 0          | 63         |
| <code>mistral/mistral-ocr-4-1</code>     | 6             | 4         | 1          | 63         |
| <code>openai/gpt-6-luna</code>           | 0             | 3         | 2          | 63         |
| <code>openai/gpt-6.1-sol</code>          | 0             | 3         | 2          | 63         |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best cloud service: `grok/grok-4.7` scored 100.00/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.0248¢ ($0.0002).
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.16s.
