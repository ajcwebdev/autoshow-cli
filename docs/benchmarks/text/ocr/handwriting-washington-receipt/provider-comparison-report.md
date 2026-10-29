# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/handwriting-washington-receipt`
- Publisher canonical reference: `reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `be10f813301d5c7aa64fbde1cdb314be58075e2cbfc695337ac946363dddb114`.
- Publisher source: https://tile.loc.gov/storage-services/master/gdc/gdcdatasets/2020446971/2020446971.zip (revision `LOC dataset 2020446971, 2023-07-18`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER     | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | ------: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 0.00        | 115.00% | 76.20% | 0.52s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER     | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | ------: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.52s | 0.00        | 115.00% | 76.20% | 0.52s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                  | Score / 100 | WER     | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ---------------------: | ----------: | ------: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.00/100 quality score | 0.00        | 115.00% | 76.20% | 0.52s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0004 | 56.25       | 43.75% | 22.66% | 2.81s           | $0.0004        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0011 | 51.25       | 48.75% | 34.28% | 18.85s          | $0.0011        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | $0.0030 | 82.50       | 17.50% | 10.48% | 3.80s           | $0.0030        |
| 4    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 61.25       | 38.75% | 22.95% | 2.82s           | $0.0040        |
| 5    | <code>anthropic/claude-sonnet-5-5</code> | $0.0086 | 82.50       | 17.50% | 9.63%  | 3.57s           | $0.0086        |
| 6    | <code>openai/gpt-6.1-sol</code>          | $0.0123 | 86.25       | 13.75% | 10.48% | 18.57s          | $0.0123        |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.0173 | 80.00       | 20.00% | 11.61% | 7.93s           | $0.0173        |
| 8    | <code>anthropic/claude-fable-5</code>    | $0.0446 | 88.75       | 11.25% | 8.50%  | 6.70s           | $0.0446        |
| 9    | <code>grok/grok-4.7</code>               | $0.0788 | 57.50       | 42.50% | 24.08% | 138.57s         | $0.0788        |

#### Speed

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | 2.81s   | 56.25       | 43.75% | 22.66% | 2.81s           | $0.0004        |
| 2    | <code>mistral/mistral-ocr-4-1</code>     | 2.82s   | 61.25       | 38.75% | 22.95% | 2.82s           | $0.0040        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 3.57s   | 82.50       | 17.50% | 9.63%  | 3.57s           | $0.0086        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | 3.80s   | 82.50       | 17.50% | 10.48% | 3.80s           | $0.0030        |
| 5    | <code>anthropic/claude-fable-5</code>    | 6.70s   | 88.75       | 11.25% | 8.50%  | 6.70s           | $0.0446        |
| 6    | <code>anthropic/claude-opus-5-5</code>   | 7.93s   | 80.00       | 20.00% | 11.61% | 7.93s           | $0.0173        |
| 7    | <code>openai/gpt-6.1-sol</code>          | 18.57s  | 86.25       | 13.75% | 10.48% | 18.57s          | $0.0123        |
| 8    | <code>openai/gpt-6-luna</code>           | 18.85s  | 51.25       | 48.75% | 34.28% | 18.85s          | $0.0011        |
| 9    | <code>grok/grok-4.7</code>               | 138.57s | 57.50       | 42.50% | 24.08% | 138.57s         | $0.0788        |

#### Quality Score

| Rank | Provider                                 | Value                   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-fable-5</code>    | 88.75/100 quality score | 88.75       | 11.25% | 8.50%  | 6.70s           | $0.0446        |
| 2    | <code>openai/gpt-6.1-sol</code>          | 86.25/100 quality score | 86.25       | 13.75% | 10.48% | 18.57s          | $0.0123        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 82.50/100 quality score | 82.50       | 17.50% | 9.63%  | 3.57s           | $0.0086        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | 82.50/100 quality score | 82.50       | 17.50% | 10.48% | 3.80s           | $0.0030        |
| 5    | <code>anthropic/claude-opus-5-5</code>   | 80.00/100 quality score | 80.00       | 20.00% | 11.61% | 7.93s           | $0.0173        |
| 6    | <code>mistral/mistral-ocr-4-1</code>     | 61.25/100 quality score | 61.25       | 38.75% | 22.95% | 2.82s           | $0.0040        |
| 7    | <code>grok/grok-4.7</code>               | 57.50/100 quality score | 57.50       | 42.50% | 24.08% | 138.57s         | $0.0788        |
| 8    | <code>anthropic/claude-haiku-5-5</code>  | 56.25/100 quality score | 56.25       | 43.75% | 22.66% | 2.81s           | $0.0004        |
| 9    | <code>openai/gpt-6-luna</code>           | 51.25/100 quality score | 51.25       | 48.75% | 34.28% | 18.85s          | $0.0011        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER     | CER    | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | ------: | -----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 0.00        | 115.00% | 76.20% | 0.52s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 88.75       | 11.25%  | 8.50%  | 6.70s           | $0.0446        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 56.25       | 43.75%  | 22.66% | 2.81s           | $0.0004        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 80.00       | 20.00%  | 11.61% | 7.93s           | $0.0173        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 82.50       | 17.50%  | 9.63%  | 3.57s           | $0.0086        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 82.50       | 17.50%  | 10.48% | 3.80s           | $0.0030        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 57.50       | 42.50%  | 24.08% | 138.57s         | $0.0788        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 61.25       | 38.75%  | 22.95% | 2.82s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 51.25       | 48.75%  | 34.28% | 18.85s          | $0.0011        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 86.25       | 13.75%  | 10.48% | 18.57s          | $0.0123        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 77            | 0         | 15         | 80         |
| <code>anthropic/claude-fable-5</code>    | 2             | 3         | 4          | 80         |
| <code>anthropic/claude-haiku-5-5</code>  | 23            | 6         | 6          | 80         |
| <code>anthropic/claude-opus-5-5</code>   | 6             | 6         | 4          | 80         |
| <code>anthropic/claude-sonnet-5-5</code> | 12            | 1         | 1          | 80         |
| <code>gemini/gemini-3.8-flash</code>     | 12            | 1         | 1          | 80         |
| <code>grok/grok-4.7</code>               | 24            | 4         | 6          | 80         |
| <code>mistral/mistral-ocr-4-1</code>     | 23            | 6         | 2          | 80         |
| <code>openai/gpt-6-luna</code>           | 28            | 8         | 3          | 80         |
| <code>openai/gpt-6.1-sol</code>          | 10            | 0         | 1          | 80         |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 0.00/100.
- Best cloud service: `anthropic/claude-fable-5` scored 88.75/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.0432¢ ($0.0004).
- Fastest local model: `tesseract/tesseract` at 0.52s.
- Fastest cloud service: `anthropic/claude-haiku-5-5` at 2.81s.

## Lexical evaluation scope

Reference scope: region-crop. Exhaustive lexical target for the declared input page/crop; drawing syntax is excluded where the publisher serialization declares it.

Headline WER/CER use the existing case-insensitive lexical normalization and declared reference order. Reading-order or serialization differences can increase edit distance; these scores do not measure layout or exact glyph/punctuation fidelity.

Text-only OCR does not establish handwriting placement, drawing geometry or spatial association.

Literal numeric, punctuation and whitespace comparisons are representation-fidelity diagnostics. TSV tabs, span-continuation blanks, Markdown wrappers and source case conventions can differ without establishing a recognition error.

[Literal numeric, punctuation and alternate-reading diagnostics](evaluation-diagnostics.json) retain all source and provider text privately.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- Each provider received the same pinned original PNG/JPEG or the declared rendered-PNG baseline variant. Reference text, table cells, manuscript deletions and graph/layout annotations were never sent to providers. Text recognition is scored separately from unavailable cell, branch and page-geometry accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
