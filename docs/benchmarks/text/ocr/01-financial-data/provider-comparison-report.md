# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/ocr/01-financial-data`
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
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0010 | 97.38       | 2.62% | 2.50% | 12.09s          | $0.0010     |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0016 | 93.02       | 6.98% | 6.83% | 24.48s          | $0.0016     |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 92.15       | 7.85% | 6.75% | 1.91s           | $0.0040     |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0095 | 99.71       | 0.29% | 0.08% | 3.10s           | $0.0095     |
| 5    | <code>anthropic/claude-sonnet-5-5</code> | $0.0113 | 99.13       | 0.87% | 0.25% | 12.85s          | $0.0113     |
| 6    | <code>openai/gpt-6.1-sol</code>          | $0.0165 | 98.84       | 1.16% | 0.33% | 13.90s          | $0.0165     |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.0225 | 100.00      | 0.00% | 0.00% | 6.97s           | $0.0225     |
| 8    | <code>anthropic/claude-fable-5</code>    | $0.0538 | 100.00      | 0.00% | 0.00% | 14.96s          | $0.0538     |
| 9    | <code>grok/grok-4.7</code>               | $0.0654 | 94.77       | 5.23% | 6.33% | 131.88s         | $0.0654     |

#### Speed

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Actual Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | ----------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 1.91s   | 92.15       | 7.85% | 6.75% | 1.91s           | $0.0040     |
| 2    | <code>gemini/gemini-3.8-flash</code>     | 3.10s   | 99.71       | 0.29% | 0.08% | 3.10s           | $0.0095     |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 6.97s   | 100.00      | 0.00% | 0.00% | 6.97s           | $0.0225     |
| 4    | <code>anthropic/claude-haiku-5-5</code>  | 12.09s  | 97.38       | 2.62% | 2.50% | 12.09s          | $0.0010     |
| 5    | <code>anthropic/claude-sonnet-5-5</code> | 12.85s  | 99.13       | 0.87% | 0.25% | 12.85s          | $0.0113     |
| 6    | <code>openai/gpt-6.1-sol</code>          | 13.90s  | 98.84       | 1.16% | 0.33% | 13.90s          | $0.0165     |
| 7    | <code>anthropic/claude-fable-5</code>    | 14.96s  | 100.00      | 0.00% | 0.00% | 14.96s          | $0.0538     |
| 8    | <code>openai/gpt-6-luna</code>           | 24.48s  | 93.02       | 6.98% | 6.83% | 24.48s          | $0.0016     |
| 9    | <code>grok/grok-4.7</code>               | 131.88s | 94.77       | 5.23% | 6.33% | 131.88s         | $0.0654     |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER   | CER   | Processing Time | Actual Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | ----------: |
| 1    | <code>anthropic/claude-fable-5</code>    | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 14.96s          | $0.0538     |
| 2    | <code>anthropic/claude-opus-5-5</code>   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 6.97s           | $0.0225     |
| 3    | <code>gemini/gemini-3.8-flash</code>     | 99.71/100 quality score  | 99.71       | 0.29% | 0.08% | 3.10s           | $0.0095     |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 99.13/100 quality score  | 99.13       | 0.87% | 0.25% | 12.85s          | $0.0113     |
| 5    | <code>openai/gpt-6.1-sol</code>          | 98.84/100 quality score  | 98.84       | 1.16% | 0.33% | 13.90s          | $0.0165     |
| 6    | <code>anthropic/claude-haiku-5-5</code>  | 97.38/100 quality score  | 97.38       | 2.62% | 2.50% | 12.09s          | $0.0010     |
| 7    | <code>grok/grok-4.7</code>               | 94.77/100 quality score  | 94.77       | 5.23% | 6.33% | 131.88s         | $0.0654     |
| 8    | <code>openai/gpt-6-luna</code>           | 93.02/100 quality score  | 93.02       | 6.98% | 6.83% | 24.48s          | $0.0016     |
| 9    | <code>mistral/mistral-ocr-4-1</code>     | 92.15/100 quality score  | 92.15       | 7.85% | 6.75% | 1.91s           | $0.0040     |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER   | CER   | Processing Time | Actual Cost |
| ---------------------------------------- | ------------------- | ----------: | ----: | ----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 100.00      | 0.00% | 0.00% | 14.96s          | $0.0538     |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 97.38       | 2.62% | 2.50% | 12.09s          | $0.0010     |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 100.00      | 0.00% | 0.00% | 6.97s           | $0.0225     |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 99.13       | 0.87% | 0.25% | 12.85s          | $0.0113     |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 99.71       | 0.29% | 0.08% | 3.10s           | $0.0095     |
| <code>grok/grok-4.7</code>               | Third-Party Service | 94.77       | 5.23% | 6.33% | 131.88s         | $0.0654     |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 92.15       | 7.85% | 6.75% | 1.91s           | $0.0040     |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 93.02       | 6.98% | 6.83% | 24.48s          | $0.0016     |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 98.84       | 1.16% | 0.33% | 13.90s          | $0.0165     |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>    | 0             | 0         | 0          | 344        |
| <code>anthropic/claude-haiku-5-5</code>  | 1             | 0         | 8          | 344        |
| <code>anthropic/claude-opus-5-5</code>   | 0             | 0         | 0          | 344        |
| <code>anthropic/claude-sonnet-5-5</code> | 3             | 0         | 0          | 344        |
| <code>gemini/gemini-3.8-flash</code>     | 1             | 0         | 0          | 344        |
| <code>grok/grok-4.7</code>               | 4             | 7         | 7          | 344        |
| <code>mistral/mistral-ocr-4-1</code>     | 5             | 0         | 22         | 344        |
| <code>openai/gpt-6-luna</code>           | 7             | 9         | 8          | 344        |
| <code>openai/gpt-6.1-sol</code>          | 4             | 0         | 0          | 344        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.1030¢ ($0.0010).
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.91s.
