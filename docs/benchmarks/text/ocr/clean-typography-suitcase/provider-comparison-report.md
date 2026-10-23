# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-clean-typography/benchmark-runs/clean-typography-suitcase`
- Publisher canonical reference: `canonical-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `8187ac89ddb13f303d8a4793a12ca27fba4a1e5672c0aa66a2c01602c3099df1`.
- Publisher source: https://huggingface.co/datasets/opendatalab/OmniDocBench/resolve/aa1ee96d106dbe53d0ae59474d75c6e6d9b53fec/OmniDocBench.json (revision `aa1ee96d106dbe53d0ae59474d75c6e6d9b53fec`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 98.04       | 1.96% | 0.80% | 0.28s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.28s | 98.04       | 1.96% | 0.80% | 0.28s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 98.04/100 quality score | 98.04       | 1.96% | 0.80% | 0.28s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>openai/gpt-6-luna</code>           | $0.0004 | 100.00      | 0.00% | 0.00% | 2.73s           | $0.0004        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | $0.0005 | 100.00      | 0.00% | 0.00% | 1.65s           | $0.0005        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | $0.0023 | 100.00      | 0.00% | 0.00% | 45.97s          | $0.0023        |
| 4    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 100.00      | 0.00% | 0.00% | 0.85s           | $0.0040        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0083 | 100.00      | 0.00% | 0.00% | 3.10s           | $0.0083        |
| 6    | <code>grok/grok-4.7</code>               | $0.0093 | 100.00      | 0.00% | 0.00% | 3.66s           | $0.0093        |
| 7    | <code>anthropic/claude-sonnet-5-5</code> | $0.0101 | 100.00      | 0.00% | 0.00% | 3.28s           | $0.0101        |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0204 | 100.00      | 0.00% | 0.00% | 2.85s           | $0.0204        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0501 | 100.00      | 0.00% | 0.00% | 4.43s           | $0.0501        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 0.85s  | 100.00      | 0.00% | 0.00% | 0.85s           | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 1.65s  | 100.00      | 0.00% | 0.00% | 1.65s           | $0.0005        |
| 3    | <code>openai/gpt-6-luna</code>           | 2.73s  | 100.00      | 0.00% | 0.00% | 2.73s           | $0.0004        |
| 4    | <code>anthropic/claude-opus-5-5</code>   | 2.85s  | 100.00      | 0.00% | 0.00% | 2.85s           | $0.0204        |
| 5    | <code>openai/gpt-6.1-sol</code>          | 3.10s  | 100.00      | 0.00% | 0.00% | 3.10s           | $0.0083        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | 3.28s  | 100.00      | 0.00% | 0.00% | 3.28s           | $0.0101        |
| 7    | <code>grok/grok-4.7</code>               | 3.66s  | 100.00      | 0.00% | 0.00% | 3.66s           | $0.0093        |
| 8    | <code>anthropic/claude-fable-5</code>    | 4.43s  | 100.00      | 0.00% | 0.00% | 4.43s           | $0.0501        |
| 9    | <code>gemini/gemini-3.8-flash</code>     | 45.97s | 100.00      | 0.00% | 0.00% | 45.97s          | $0.0023        |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-fable-5</code>    | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 4.43s           | $0.0501        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 1.65s           | $0.0005        |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.85s           | $0.0204        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 3.28s           | $0.0101        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 45.97s          | $0.0023        |
| 6    | <code>grok/grok-4.7</code>               | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 3.66s           | $0.0093        |
| 7    | <code>mistral/mistral-ocr-4-1</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 0.85s           | $0.0040        |
| 8    | <code>openai/gpt-6-luna</code>           | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.73s           | $0.0004        |
| 9    | <code>openai/gpt-6.1-sol</code>          | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 3.10s           | $0.0083        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | ----: | ----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 98.04       | 1.96% | 0.80% | 0.28s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 100.00      | 0.00% | 0.00% | 4.43s           | $0.0501        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 100.00      | 0.00% | 0.00% | 1.65s           | $0.0005        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.85s           | $0.0204        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00      | 0.00% | 0.00% | 3.28s           | $0.0101        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 100.00      | 0.00% | 0.00% | 45.97s          | $0.0023        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 100.00      | 0.00% | 0.00% | 3.66s           | $0.0093        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 100.00      | 0.00% | 0.00% | 0.85s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.73s           | $0.0004        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 100.00      | 0.00% | 0.00% | 3.10s           | $0.0083        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 0             | 1         | 0          | 51         |
| <code>anthropic/claude-fable-5</code>    | 0             | 0         | 0          | 51         |
| <code>anthropic/claude-haiku-5-5</code>  | 0             | 0         | 0          | 51         |
| <code>anthropic/claude-opus-5-5</code>   | 0             | 0         | 0          | 51         |
| <code>anthropic/claude-sonnet-5-5</code> | 0             | 0         | 0          | 51         |
| <code>gemini/gemini-3.8-flash</code>     | 0             | 0         | 0          | 51         |
| <code>grok/grok-4.7</code>               | 0             | 0         | 0          | 51         |
| <code>mistral/mistral-ocr-4-1</code>     | 0             | 0         | 0          | 51         |
| <code>openai/gpt-6-luna</code>           | 0             | 0         | 0          | 51         |
| <code>openai/gpt-6.1-sol</code>          | 0             | 0         | 0          | 51         |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 98.04/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `openai/gpt-6-luna` at 0.0413¢ ($0.0004).
- Fastest local model: `tesseract/tesseract` at 0.28s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 0.85s.

## Cost accounting

- Reported usage is valued at reviewed rates; prices include settled retry costs and retained unresolved reservations once and are not invoice-reconciled charges.
- Any settled conservative amount or retained unresolved reservation makes the price a conservative upper bound; billing uncertainty remains visible in the separate breakdown.
