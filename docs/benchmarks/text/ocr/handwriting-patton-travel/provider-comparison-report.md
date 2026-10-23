# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/handwriting-patton-travel`
- Publisher canonical reference: `reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `1d968d2ba075a7b7f7661d55dfe8241328ec3f0040e720eb00d80586daf62011`.
- Publisher source: https://tile.loc.gov/storage-services/master/gdc/gdcdatasets/2021386762/2021386762.zip (revision `LOC dataset 2021386762, 2023-04-26`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER     | CER     | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | ------: | ------: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 0.00        | 100.00% | 100.00% | 0.16s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER     | CER     | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | ------: | ------: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.16s | 0.00        | 100.00% | 100.00% | 0.16s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                  | Score / 100 | WER     | CER     | Processing Time | Accounted Cost |
| ---: | ---------------------- | ---------------------: | ----------: | ------: | ------: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.00/100 quality score | 0.00        | 100.00% | 100.00% | 0.16s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0005 | 92.50       | 7.50%  | 4.37%  | 4.25s           | $0.0005        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0012 | 75.00       | 25.00% | 19.17% | 19.73s          | $0.0012        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | $0.0029 | 96.25       | 3.75%  | 1.21%  | 4.18s           | $0.0029        |
| 4    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 91.25       | 8.75%  | 4.13%  | 2.41s           | $0.0040        |
| 5    | <code>anthropic/claude-sonnet-5-5</code> | $0.0061 | 97.50       | 2.50%  | 1.21%  | 3.04s           | $0.0061        |
| 6    | <code>openai/gpt-6.1-sol</code>          | $0.0076 | 97.50       | 2.50%  | 2.67%  | 12.66s          | $0.0076        |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.0119 | 98.75       | 1.25%  | 0.73%  | 3.29s           | $0.0119        |
| 8    | <code>grok/grok-4.7</code>               | $0.0304 | 96.25       | 3.75%  | 3.40%  | 56.10s          | $0.0304        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0385 | 97.50       | 2.50%  | 1.21%  | 6.95s           | $0.0385        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 2.41s  | 91.25       | 8.75%  | 4.13%  | 2.41s           | $0.0040        |
| 2    | <code>anthropic/claude-sonnet-5-5</code> | 3.04s  | 97.50       | 2.50%  | 1.21%  | 3.04s           | $0.0061        |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 3.29s  | 98.75       | 1.25%  | 0.73%  | 3.29s           | $0.0119        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | 4.18s  | 96.25       | 3.75%  | 1.21%  | 4.18s           | $0.0029        |
| 5    | <code>anthropic/claude-haiku-5-5</code>  | 4.25s  | 92.50       | 7.50%  | 4.37%  | 4.25s           | $0.0005        |
| 6    | <code>anthropic/claude-fable-5</code>    | 6.95s  | 97.50       | 2.50%  | 1.21%  | 6.95s           | $0.0385        |
| 7    | <code>openai/gpt-6.1-sol</code>          | 12.66s | 97.50       | 2.50%  | 2.67%  | 12.66s          | $0.0076        |
| 8    | <code>openai/gpt-6-luna</code>           | 19.73s | 75.00       | 25.00% | 19.17% | 19.73s          | $0.0012        |
| 9    | <code>grok/grok-4.7</code>               | 56.10s | 96.25       | 3.75%  | 3.40%  | 56.10s          | $0.0304        |

#### Quality Score

| Rank | Provider                                 | Value                   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-opus-5-5</code>   | 98.75/100 quality score | 98.75       | 1.25%  | 0.73%  | 3.29s           | $0.0119        |
| 2    | <code>anthropic/claude-fable-5</code>    | 97.50/100 quality score | 97.50       | 2.50%  | 1.21%  | 6.95s           | $0.0385        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 97.50/100 quality score | 97.50       | 2.50%  | 1.21%  | 3.04s           | $0.0061        |
| 4    | <code>openai/gpt-6.1-sol</code>          | 97.50/100 quality score | 97.50       | 2.50%  | 2.67%  | 12.66s          | $0.0076        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 96.25/100 quality score | 96.25       | 3.75%  | 1.21%  | 4.18s           | $0.0029        |
| 6    | <code>grok/grok-4.7</code>               | 96.25/100 quality score | 96.25       | 3.75%  | 3.40%  | 56.10s          | $0.0304        |
| 7    | <code>anthropic/claude-haiku-5-5</code>  | 92.50/100 quality score | 92.50       | 7.50%  | 4.37%  | 4.25s           | $0.0005        |
| 8    | <code>mistral/mistral-ocr-4-1</code>     | 91.25/100 quality score | 91.25       | 8.75%  | 4.13%  | 2.41s           | $0.0040        |
| 9    | <code>openai/gpt-6-luna</code>           | 75.00/100 quality score | 75.00       | 25.00% | 19.17% | 19.73s          | $0.0012        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER     | CER     | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | ------: | ------: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 0.00        | 100.00% | 100.00% | 0.16s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 97.50       | 2.50%   | 1.21%   | 6.95s           | $0.0385        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 92.50       | 7.50%   | 4.37%   | 4.25s           | $0.0005        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 98.75       | 1.25%   | 0.73%   | 3.29s           | $0.0119        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 97.50       | 2.50%   | 1.21%   | 3.04s           | $0.0061        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 96.25       | 3.75%   | 1.21%   | 4.18s           | $0.0029        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 96.25       | 3.75%   | 3.40%   | 56.10s          | $0.0304        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 91.25       | 8.75%   | 4.13%   | 2.41s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 75.00       | 25.00%  | 19.17%  | 19.73s          | $0.0012        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 97.50       | 2.50%   | 2.67%   | 12.66s          | $0.0076        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 0             | 80        | 0          | 80         |
| <code>anthropic/claude-fable-5</code>    | 2             | 0         | 0          | 80         |
| <code>anthropic/claude-haiku-5-5</code>  | 3             | 2         | 1          | 80         |
| <code>anthropic/claude-opus-5-5</code>   | 1             | 0         | 0          | 80         |
| <code>anthropic/claude-sonnet-5-5</code> | 2             | 0         | 0          | 80         |
| <code>gemini/gemini-3.8-flash</code>     | 2             | 0         | 1          | 80         |
| <code>grok/grok-4.7</code>               | 2             | 1         | 0          | 80         |
| <code>mistral/mistral-ocr-4-1</code>     | 7             | 0         | 0          | 80         |
| <code>openai/gpt-6-luna</code>           | 15            | 3         | 2          | 80         |
| <code>openai/gpt-6.1-sol</code>          | 0             | 2         | 0          | 80         |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 0.00/100.
- Best cloud service: `anthropic/claude-opus-5-5` scored 98.75/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.0503¢ ($0.0005).
- Fastest local model: `tesseract/tesseract` at 0.16s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 2.41s.

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
