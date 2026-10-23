# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-clean-typography/benchmark-runs/clean-typography-language-teaching`
- Publisher canonical reference: `canonical-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `4b94de156fb05b1d77a7531a2d65481e6c6a15e37e4855cd774efb71e87563a6`.
- Publisher source: https://huggingface.co/datasets/opendatalab/OmniDocBench/resolve/aa1ee96d106dbe53d0ae59474d75c6e6d9b53fec/OmniDocBench.json (revision `aa1ee96d106dbe53d0ae59474d75c6e6d9b53fec`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 90.48       | 9.52% | 3.13% | 0.30s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.30s | 90.48       | 9.52% | 3.13% | 0.30s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 90.48/100 quality score | 90.48       | 9.52% | 3.13% | 0.30s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>openai/gpt-6-luna</code>           | $0.0004 | 100.00      | 0.00% | 0.00% | 2.15s           | $0.0004        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | $0.0005 | 100.00      | 0.00% | 0.00% | 1.19s           | $0.0005        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | $0.0021 | 100.00      | 0.00% | 0.00% | 69.63s          | $0.0021        |
| 4    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 100.00      | 0.00% | 0.00% | 1.12s           | $0.0040        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0079 | 100.00      | 0.00% | 0.00% | 2.42s           | $0.0079        |
| 6    | <code>grok/grok-4.7</code>               | $0.0083 | 100.00      | 0.00% | 0.00% | 2.33s           | $0.0083        |
| 7    | <code>anthropic/claude-sonnet-5-5</code> | $0.0098 | 100.00      | 0.00% | 0.00% | 5.45s           | $0.0098        |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0196 | 100.00      | 0.00% | 0.00% | 3.20s           | $0.0196        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0489 | 100.00      | 0.00% | 0.00% | 4.02s           | $0.0489        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 1.12s  | 100.00      | 0.00% | 0.00% | 1.12s           | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 1.19s  | 100.00      | 0.00% | 0.00% | 1.19s           | $0.0005        |
| 3    | <code>openai/gpt-6-luna</code>           | 2.15s  | 100.00      | 0.00% | 0.00% | 2.15s           | $0.0004        |
| 4    | <code>grok/grok-4.7</code>               | 2.33s  | 100.00      | 0.00% | 0.00% | 2.33s           | $0.0083        |
| 5    | <code>openai/gpt-6.1-sol</code>          | 2.42s  | 100.00      | 0.00% | 0.00% | 2.42s           | $0.0079        |
| 6    | <code>anthropic/claude-opus-5-5</code>   | 3.20s  | 100.00      | 0.00% | 0.00% | 3.20s           | $0.0196        |
| 7    | <code>anthropic/claude-fable-5</code>    | 4.02s  | 100.00      | 0.00% | 0.00% | 4.02s           | $0.0489        |
| 8    | <code>anthropic/claude-sonnet-5-5</code> | 5.45s  | 100.00      | 0.00% | 0.00% | 5.45s           | $0.0098        |
| 9    | <code>gemini/gemini-3.8-flash</code>     | 69.63s | 100.00      | 0.00% | 0.00% | 69.63s          | $0.0021        |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-fable-5</code>    | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 4.02s           | $0.0489        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 1.19s           | $0.0005        |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 3.20s           | $0.0196        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 5.45s           | $0.0098        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 69.63s          | $0.0021        |
| 6    | <code>grok/grok-4.7</code>               | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.33s           | $0.0083        |
| 7    | <code>mistral/mistral-ocr-4-1</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 1.12s           | $0.0040        |
| 8    | <code>openai/gpt-6-luna</code>           | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.15s           | $0.0004        |
| 9    | <code>openai/gpt-6.1-sol</code>          | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.42s           | $0.0079        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | ----: | ----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 90.48       | 9.52% | 3.13% | 0.30s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 100.00      | 0.00% | 0.00% | 4.02s           | $0.0489        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 100.00      | 0.00% | 0.00% | 1.19s           | $0.0005        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 100.00      | 0.00% | 0.00% | 3.20s           | $0.0196        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00      | 0.00% | 0.00% | 5.45s           | $0.0098        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 100.00      | 0.00% | 0.00% | 69.63s          | $0.0021        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.33s           | $0.0083        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 100.00      | 0.00% | 0.00% | 1.12s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.15s           | $0.0004        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.42s           | $0.0079        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 1             | 0         | 1          | 21         |
| <code>anthropic/claude-fable-5</code>    | 0             | 0         | 0          | 21         |
| <code>anthropic/claude-haiku-5-5</code>  | 0             | 0         | 0          | 21         |
| <code>anthropic/claude-opus-5-5</code>   | 0             | 0         | 0          | 21         |
| <code>anthropic/claude-sonnet-5-5</code> | 0             | 0         | 0          | 21         |
| <code>gemini/gemini-3.8-flash</code>     | 0             | 0         | 0          | 21         |
| <code>grok/grok-4.7</code>               | 0             | 0         | 0          | 21         |
| <code>mistral/mistral-ocr-4-1</code>     | 0             | 0         | 0          | 21         |
| <code>openai/gpt-6-luna</code>           | 0             | 0         | 0          | 21         |
| <code>openai/gpt-6.1-sol</code>          | 0             | 0         | 0          | 21         |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 90.48/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `openai/gpt-6-luna` at 0.0433¢ ($0.0004).
- Fastest local model: `tesseract/tesseract` at 0.30s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.12s.

## Cost accounting

- Reported usage is valued at reviewed rates; prices include settled retry costs and retained unresolved reservations once and are not invoice-reconciled charges.
- Any settled conservative amount or retained unresolved reservation makes the price a conservative upper bound; billing uncertainty remains visible in the separate breakdown.
