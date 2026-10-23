# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/ocr/1-page-declaration`
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
| 1    | <code>openai/gpt-6-luna</code>           | $0.0016 | 97.54       | 2.46%  | 1.74% | 33.69s          | $0.0016     |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | $0.0022 | 97.75       | 2.25%  | 1.57% | 27.83s          | $0.0022     |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 86.82       | 13.18% | 9.67% | 4.59s           | $0.0040     |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0166 | 100.00      | 0.00%  | 0.00% | 8.01s           | $0.0166     |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0303 | 99.80       | 0.20%  | 0.03% | 29.05s          | $0.0303     |
| 6    | <code>grok/grok-4.7</code>               | $0.0339 | 99.45       | 0.55%  | 0.40% | 43.33s          | $0.0339     |
| 7    | <code>anthropic/claude-sonnet-5-5</code> | $0.0417 | 99.11       | 0.89%  | 0.15% | 38.98s          | $0.0417     |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0843 | 99.73       | 0.27%  | 0.06% | 22.70s          | $0.0843     |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.2177 | 97.20       | 2.80%  | 1.92% | 43.72s          | $0.2177     |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER    | CER   | Processing Time | Actual Cost |
| ---: | ---------------------------------------- | -----: | ----------: | -----: | ----: | --------------: | ----------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 4.59s  | 86.82       | 13.18% | 9.67% | 4.59s           | $0.0040     |
| 2    | <code>gemini/gemini-3.8-flash</code>     | 8.01s  | 100.00      | 0.00%  | 0.00% | 8.01s           | $0.0166     |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 22.70s | 99.73       | 0.27%  | 0.06% | 22.70s          | $0.0843     |
| 4    | <code>anthropic/claude-haiku-5-5</code>  | 27.83s | 97.75       | 2.25%  | 1.57% | 27.83s          | $0.0022     |
| 5    | <code>openai/gpt-6.1-sol</code>          | 29.05s | 99.80       | 0.20%  | 0.03% | 29.05s          | $0.0303     |
| 6    | <code>openai/gpt-6-luna</code>           | 33.69s | 97.54       | 2.46%  | 1.74% | 33.69s          | $0.0016     |
| 7    | <code>anthropic/claude-sonnet-5-5</code> | 38.98s | 99.11       | 0.89%  | 0.15% | 38.98s          | $0.0417     |
| 8    | <code>grok/grok-4.7</code>               | 43.33s | 99.45       | 0.55%  | 0.40% | 43.33s          | $0.0339     |
| 9    | <code>anthropic/claude-fable-5</code>    | 43.72s | 97.20       | 2.80%  | 1.92% | 43.72s          | $0.2177     |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER    | CER   | Processing Time | Actual Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | -----: | ----: | --------------: | ----------: |
| 1    | <code>gemini/gemini-3.8-flash</code>     | 100.00/100 quality score | 100.00      | 0.00%  | 0.00% | 8.01s           | $0.0166     |
| 2    | <code>openai/gpt-6.1-sol</code>          | 99.80/100 quality score  | 99.80       | 0.20%  | 0.03% | 29.05s          | $0.0303     |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 99.73/100 quality score  | 99.73       | 0.27%  | 0.06% | 22.70s          | $0.0843     |
| 4    | <code>grok/grok-4.7</code>               | 99.45/100 quality score  | 99.45       | 0.55%  | 0.40% | 43.33s          | $0.0339     |
| 5    | <code>anthropic/claude-sonnet-5-5</code> | 99.11/100 quality score  | 99.11       | 0.89%  | 0.15% | 38.98s          | $0.0417     |
| 6    | <code>anthropic/claude-haiku-5-5</code>  | 97.75/100 quality score  | 97.75       | 2.25%  | 1.57% | 27.83s          | $0.0022     |
| 7    | <code>openai/gpt-6-luna</code>           | 97.54/100 quality score  | 97.54       | 2.46%  | 1.74% | 33.69s          | $0.0016     |
| 8    | <code>anthropic/claude-fable-5</code>    | 97.20/100 quality score  | 97.20       | 2.80%  | 1.92% | 43.72s          | $0.2177     |
| 9    | <code>mistral/mistral-ocr-4-1</code>     | 86.82/100 quality score  | 86.82       | 13.18% | 9.67% | 4.59s           | $0.0040     |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER   | Processing Time | Actual Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | ----: | --------------: | ----------: |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 97.20       | 2.80%  | 1.92% | 43.72s          | $0.2177     |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 97.75       | 2.25%  | 1.57% | 27.83s          | $0.0022     |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 99.73       | 0.27%  | 0.06% | 22.70s          | $0.0843     |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 99.11       | 0.89%  | 0.15% | 38.98s          | $0.0417     |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 100.00      | 0.00%  | 0.00% | 8.01s           | $0.0166     |
| <code>grok/grok-4.7</code>               | Third-Party Service | 99.45       | 0.55%  | 0.40% | 43.33s          | $0.0339     |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 86.82       | 13.18% | 9.67% | 4.59s           | $0.0040     |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 97.54       | 2.46%  | 1.74% | 33.69s          | $0.0016     |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 99.80       | 0.20%  | 0.03% | 29.05s          | $0.0303     |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>anthropic/claude-fable-5</code>    | 6             | 15        | 20         | 1464       |
| <code>anthropic/claude-haiku-5-5</code>  | 26            | 5         | 2          | 1464       |
| <code>anthropic/claude-opus-5-5</code>   | 4             | 0         | 0          | 1464       |
| <code>anthropic/claude-sonnet-5-5</code> | 12            | 0         | 1          | 1464       |
| <code>gemini/gemini-3.8-flash</code>     | 0             | 0         | 0          | 1464       |
| <code>grok/grok-4.7</code>               | 2             | 6         | 0          | 1464       |
| <code>mistral/mistral-ocr-4-1</code>     | 153           | 35        | 5          | 1464       |
| <code>openai/gpt-6-luna</code>           | 14            | 14        | 8          | 1464       |
| <code>openai/gpt-6.1-sol</code>          | 3             | 0         | 0          | 1464       |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best cloud service: `gemini/gemini-3.8-flash` scored 100.00/100.
- The cheapest cloud provider was `openai/gpt-6-luna` at 0.1628¢ ($0.0016).
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 4.59s.
