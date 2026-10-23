# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/efg-rerun-1-page-newspaper`
- Total providers: 10 (1 local, 9 third-party service)
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

| Rank | Provider               | Value                     | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 6.99        | 93.01% | 91.91% | 5.30s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 5.30s | 6.99        | 93.01% | 91.91% | 5.30s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                  | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ---------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 6.99/100 quality score | 6.99        | 93.01% | 91.91% | 5.30s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0025 | 73.99       | 26.01% | 25.91% | 19.09s          | $0.0025        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0035 | 58.24       | 41.76% | 47.75% | 58.22s          | $0.0035        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 79.71       | 20.29% | 10.91% | 23.08s          | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0292 | 94.92       | 5.08%  | 0.86%  | 29.22s          | $0.0292        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0407 | 94.20       | 5.80%  | 1.20%  | 80.25s          | $0.0407        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0562 | 99.24       | 0.76%  | 0.18%  | 29.12s          | $0.0562        |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.1123 | 99.20       | 0.80%  | 0.16%  | 36.95s          | $0.1123        |
| 8    | <code>anthropic/claude-fable-5</code>    | $0.2841 | 99.20       | 0.80%  | 0.21%  | 65.05s          | $0.2841        |
| 9    | <code>grok/grok-4.7</code>               | $1.0476 | 98.69       | 1.31%  | 0.44%  | 365.86s         | $1.0476        |

#### Speed

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | 19.09s  | 73.99       | 26.01% | 25.91% | 19.09s          | $0.0025        |
| 2    | <code>mistral/mistral-ocr-4-1</code>     | 23.08s  | 79.71       | 20.29% | 10.91% | 23.08s          | $0.0040        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 29.12s  | 99.24       | 0.76%  | 0.18%  | 29.12s          | $0.0562        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | 29.22s  | 94.92       | 5.08%  | 0.86%  | 29.22s          | $0.0292        |
| 5    | <code>anthropic/claude-opus-5-5</code>   | 36.95s  | 99.20       | 0.80%  | 0.16%  | 36.95s          | $0.1123        |
| 6    | <code>openai/gpt-6-luna</code>           | 58.22s  | 58.24       | 41.76% | 47.75% | 58.22s          | $0.0035        |
| 7    | <code>anthropic/claude-fable-5</code>    | 65.05s  | 99.20       | 0.80%  | 0.21%  | 65.05s          | $0.2841        |
| 8    | <code>openai/gpt-6.1-sol</code>          | 80.25s  | 94.20       | 5.80%  | 1.20%  | 80.25s          | $0.0407        |
| 9    | <code>grok/grok-4.7</code>               | 365.86s | 98.69       | 1.31%  | 0.44%  | 365.86s         | $1.0476        |

#### Quality Score

| Rank | Provider                                 | Value                   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-sonnet-5-5</code> | 99.24/100 quality score | 99.24       | 0.76%  | 0.18%  | 29.12s          | $0.0562        |
| 2    | <code>anthropic/claude-opus-5-5</code>   | 99.20/100 quality score | 99.20       | 0.80%  | 0.16%  | 36.95s          | $0.1123        |
| 3    | <code>anthropic/claude-fable-5</code>    | 99.20/100 quality score | 99.20       | 0.80%  | 0.21%  | 65.05s          | $0.2841        |
| 4    | <code>grok/grok-4.7</code>               | 98.69/100 quality score | 98.69       | 1.31%  | 0.44%  | 365.86s         | $1.0476        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 94.92/100 quality score | 94.92       | 5.08%  | 0.86%  | 29.22s          | $0.0292        |
| 6    | <code>openai/gpt-6.1-sol</code>          | 94.20/100 quality score | 94.20       | 5.80%  | 1.20%  | 80.25s          | $0.0407        |
| 7    | <code>mistral/mistral-ocr-4-1</code>     | 79.71/100 quality score | 79.71       | 20.29% | 10.91% | 23.08s          | $0.0040        |
| 8    | <code>anthropic/claude-haiku-5-5</code>  | 73.99/100 quality score | 73.99       | 26.01% | 25.91% | 19.09s          | $0.0025        |
| 9    | <code>openai/gpt-6-luna</code>           | 58.24/100 quality score | 58.24       | 41.76% | 47.75% | 58.22s          | $0.0035        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | -----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 6.99        | 93.01% | 91.91% | 5.30s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 99.20       | 0.80%  | 0.21%  | 65.05s          | $0.2841        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 73.99       | 26.01% | 25.91% | 19.09s          | $0.0025        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 99.20       | 0.80%  | 0.16%  | 36.95s          | $0.1123        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 99.24       | 0.76%  | 0.18%  | 29.12s          | $0.0562        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 94.92       | 5.08%  | 0.86%  | 29.22s          | $0.0292        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 98.69       | 1.31%  | 0.44%  | 365.86s         | $1.0476        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 79.71       | 20.29% | 10.91% | 23.08s          | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 58.24       | 41.76% | 47.75% | 58.22s          | $0.0035        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 94.20       | 5.80%  | 1.20%  | 80.25s          | $0.0407        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 1784          | 411       | 1          | 2361       |
| <code>anthropic/claude-fable-5</code>    | 16            | 2         | 1          | 2361       |
| <code>anthropic/claude-haiku-5-5</code>  | 23            | 589       | 2          | 2361       |
| <code>anthropic/claude-opus-5-5</code>   | 14            | 3         | 2          | 2361       |
| <code>anthropic/claude-sonnet-5-5</code> | 12            | 4         | 2          | 2361       |
| <code>gemini/gemini-3.8-flash</code>     | 70            | 3         | 47         | 2361       |
| <code>grok/grok-4.7</code>               | 25            | 5         | 1          | 2361       |
| <code>mistral/mistral-ocr-4-1</code>     | 381           | 25        | 73         | 2361       |
| <code>openai/gpt-6-luna</code>           | 66            | 890       | 30         | 2361       |
| <code>openai/gpt-6.1-sol</code>          | 85            | 3         | 49         | 2361       |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 6.99/100.
- Best cloud service: `anthropic/claude-sonnet-5-5` scored 99.24/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.2548¢ ($0.0025).
- Fastest local model: `tesseract/tesseract` at 5.30s.
- Fastest cloud service: `anthropic/claude-haiku-5-5` at 19.09s.

## Lexical evaluation scope

Reference scope: full-page. Existing archived multi-provider consensus; not independent publisher gold.

Headline WER/CER use the existing case-insensitive lexical normalization and declared reference order. Reading-order or serialization differences can increase edit distance; these scores do not measure layout or exact glyph/punctuation fidelity.

Text-only OCR does not establish column/region localization or page layout. An article crop does not establish whole-page reading order.

Literal numeric, punctuation and whitespace comparisons are representation-fidelity diagnostics. TSV tabs, span-continuation blanks, Markdown wrappers and source case conventions can differ without establishing a recognition error.

[Literal numeric, punctuation and alternate-reading diagnostics](evaluation-diagnostics.json) retain all source and provider text privately.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: the existing archived multi-provider consensus is reused byte for byte; it is not independent publisher gold.
- Each provider received the same pinned original PNG/JPEG or the declared rendered-PNG baseline variant. Reference text, table cells, manuscript deletions and graph/layout annotations were never sent to providers. Text recognition is scored separately from unavailable cell, branch and page-geometry accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
