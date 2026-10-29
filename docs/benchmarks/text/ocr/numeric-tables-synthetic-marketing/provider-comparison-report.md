# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/numeric-tables-synthetic-marketing`
- Publisher canonical reference: `numeric-tables-synthetic-marketing.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `b32dbf5c5a3c2371b9a85c1c025c723784f19e73ca5feedf6b7b444b9651bdef`.
- Publisher source: https://ds4sd-public-artifacts.s3.eu-de.cloud-object-storage.appdomain.cloud/datasets/synthtabnet_public/samples.zip (revision `d4266dc3094e42e82f3b30060d22f3e4e394093c`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER     | CER     | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | ------: | ------: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 0.00        | 100.00% | 100.00% | 0.09s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER     | CER     | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | ------: | ------: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.09s | 0.00        | 100.00% | 100.00% | 0.09s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                  | Score / 100 | WER     | CER     | Processing Time | Accounted Cost |
| ---: | ---------------------- | ---------------------: | ----------: | ------: | ------: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.00/100 quality score | 0.00        | 100.00% | 100.00% | 0.09s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0012 | 89.52       | 10.48% | 5.02%  | 8.60s           | $0.0012        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0019 | 83.41       | 16.59% | 12.10% | 32.92s          | $0.0019        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 98.47       | 1.53%  | 0.39%  | 2.59s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0097 | 98.25       | 1.75%  | 2.15%  | 8.10s           | $0.0097        |
| 5    | <code>anthropic/claude-sonnet-5-5</code> | $0.0121 | 91.92       | 8.08%  | 5.36%  | 7.25s           | $0.0121        |
| 6    | <code>grok/grok-4.7</code>               | $0.0149 | 75.55       | 24.45% | 14.21% | 17.63s          | $0.0149        |
| 7    | <code>openai/gpt-6.1-sol</code>          | $0.0236 | 93.45       | 6.55%  | 3.69%  | 52.32s          | $0.0236        |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0241 | 94.54       | 5.46%  | 3.86%  | 10.71s          | $0.0241        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.1187 | 95.85       | 4.15%  | 1.80%  | 24.30s          | $0.1187        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 2.59s  | 98.47       | 1.53%  | 0.39%  | 2.59s           | $0.0040        |
| 2    | <code>anthropic/claude-sonnet-5-5</code> | 7.25s  | 91.92       | 8.08%  | 5.36%  | 7.25s           | $0.0121        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | 8.10s  | 98.25       | 1.75%  | 2.15%  | 8.10s           | $0.0097        |
| 4    | <code>anthropic/claude-haiku-5-5</code>  | 8.60s  | 89.52       | 10.48% | 5.02%  | 8.60s           | $0.0012        |
| 5    | <code>anthropic/claude-opus-5-5</code>   | 10.71s | 94.54       | 5.46%  | 3.86%  | 10.71s          | $0.0241        |
| 6    | <code>grok/grok-4.7</code>               | 17.63s | 75.55       | 24.45% | 14.21% | 17.63s          | $0.0149        |
| 7    | <code>anthropic/claude-fable-5</code>    | 24.30s | 95.85       | 4.15%  | 1.80%  | 24.30s          | $0.1187        |
| 8    | <code>openai/gpt-6-luna</code>           | 32.92s | 83.41       | 16.59% | 12.10% | 32.92s          | $0.0019        |
| 9    | <code>openai/gpt-6.1-sol</code>          | 52.32s | 93.45       | 6.55%  | 3.69%  | 52.32s          | $0.0236        |

#### Quality Score

| Rank | Provider                                 | Value                   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 98.47/100 quality score | 98.47       | 1.53%  | 0.39%  | 2.59s           | $0.0040        |
| 2    | <code>gemini/gemini-3.8-flash</code>     | 98.25/100 quality score | 98.25       | 1.75%  | 2.15%  | 8.10s           | $0.0097        |
| 3    | <code>anthropic/claude-fable-5</code>    | 95.85/100 quality score | 95.85       | 4.15%  | 1.80%  | 24.30s          | $0.1187        |
| 4    | <code>anthropic/claude-opus-5-5</code>   | 94.54/100 quality score | 94.54       | 5.46%  | 3.86%  | 10.71s          | $0.0241        |
| 5    | <code>openai/gpt-6.1-sol</code>          | 93.45/100 quality score | 93.45       | 6.55%  | 3.69%  | 52.32s          | $0.0236        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | 91.92/100 quality score | 91.92       | 8.08%  | 5.36%  | 7.25s           | $0.0121        |
| 7    | <code>anthropic/claude-haiku-5-5</code>  | 89.52/100 quality score | 89.52       | 10.48% | 5.02%  | 8.60s           | $0.0012        |
| 8    | <code>openai/gpt-6-luna</code>           | 83.41/100 quality score | 83.41       | 16.59% | 12.10% | 32.92s          | $0.0019        |
| 9    | <code>grok/grok-4.7</code>               | 75.55/100 quality score | 75.55       | 24.45% | 14.21% | 17.63s          | $0.0149        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER     | CER     | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | ------: | ------: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 0.00        | 100.00% | 100.00% | 0.09s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 95.85       | 4.15%   | 1.80%   | 24.30s          | $0.1187        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 89.52       | 10.48%  | 5.02%   | 8.60s           | $0.0012        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 94.54       | 5.46%   | 3.86%   | 10.71s          | $0.0241        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 91.92       | 8.08%   | 5.36%   | 7.25s           | $0.0121        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 98.25       | 1.75%   | 2.15%   | 8.10s           | $0.0097        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 75.55       | 24.45%  | 14.21%  | 17.63s          | $0.0149        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 98.47       | 1.53%   | 0.39%   | 2.59s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 83.41       | 16.59%  | 12.10%  | 32.92s          | $0.0019        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 93.45       | 6.55%   | 3.69%   | 52.32s          | $0.0236        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 0             | 458       | 0          | 458        |
| <code>anthropic/claude-fable-5</code>    | 13            | 3         | 3          | 458        |
| <code>anthropic/claude-haiku-5-5</code>  | 34            | 9         | 5          | 458        |
| <code>anthropic/claude-opus-5-5</code>   | 11            | 7         | 7          | 458        |
| <code>anthropic/claude-sonnet-5-5</code> | 17            | 10        | 10         | 458        |
| <code>gemini/gemini-3.8-flash</code>     | 0             | 4         | 4          | 458        |
| <code>grok/grok-4.7</code>               | 78            | 20        | 14         | 458        |
| <code>mistral/mistral-ocr-4-1</code>     | 7             | 0         | 0          | 458        |
| <code>openai/gpt-6-luna</code>           | 44            | 27        | 5          | 458        |
| <code>openai/gpt-6.1-sol</code>          | 20            | 3         | 7          | 458        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 0.00/100.
- Best cloud service: `mistral/mistral-ocr-4-1` scored 98.47/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.1228¢ ($0.0012).
- Fastest local model: `tesseract/tesseract` at 0.09s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 2.59s.

## Lexical evaluation scope

Reference scope: region-crop. Exhaustive lexical target for the declared input page/crop; drawing syntax is excluded where the publisher serialization declares it.

Headline WER/CER use the existing case-insensitive lexical normalization and declared reference order. Reading-order or serialization differences can increase edit distance; these scores do not measure layout or exact glyph/punctuation fidelity.

Text-only OCR does not establish cell assignment, row/column mapping, spans or blank-cell geometry. Numeric/text presence is not table-structure accuracy.

Literal numeric, punctuation and whitespace comparisons are representation-fidelity diagnostics. TSV tabs, span-continuation blanks, Markdown wrappers and source case conventions can differ without establishing a recognition error.

[Literal numeric, punctuation and alternate-reading diagnostics](evaluation-diagnostics.json) retain all source and provider text privately.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- Each provider received the same pinned original PNG/JPEG or the declared rendered-PNG baseline variant. Reference text, table cells, manuscript deletions and graph/layout annotations were never sent to providers. Text recognition is scored separately from unavailable cell, branch and page-geometry accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
