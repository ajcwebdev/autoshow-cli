# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/newspapers-monthly-repository`
- Publisher canonical reference: `newspapers-monthly-repository.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `538b051856a629c3dcd36d35a97a6b920c616659e09f237ed39d25049b9a7823`.
- Publisher source: https://ndownloader.figshare.com/files/52256378 (revision `10.5522/04/28381610.v1`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 88.67       | 11.33% | 3.74% | 0.99s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.99s | 88.67       | 11.33% | 3.74% | 0.99s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 88.67/100 quality score | 88.67       | 11.33% | 3.74% | 0.99s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0006 | 92.77       | 7.23% | 0.72% | 4.36s           | $0.0006        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0011 | 99.52       | 0.48% | 0.18% | 13.71s          | $0.0011        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 93.01       | 6.99% | 0.68% | 1.76s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0062 | 99.52       | 0.48% | 0.09% | 5.93s           | $0.0062        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0094 | 99.76       | 0.24% | 0.05% | 9.81s           | $0.0094        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0132 | 99.52       | 0.48% | 0.09% | 6.71s           | $0.0132        |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.0227 | 92.77       | 7.23% | 0.72% | 9.63s           | $0.0227        |
| 8    | <code>grok/grok-4.7</code>               | $0.0479 | 93.01       | 6.99% | 0.68% | 74.21s          | $0.0479        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0567 | 92.77       | 7.23% | 0.72% | 12.29s          | $0.0567        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 1.76s  | 93.01       | 6.99% | 0.68% | 1.76s           | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 4.36s  | 92.77       | 7.23% | 0.72% | 4.36s           | $0.0006        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | 5.93s  | 99.52       | 0.48% | 0.09% | 5.93s           | $0.0062        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 6.71s  | 99.52       | 0.48% | 0.09% | 6.71s           | $0.0132        |
| 5    | <code>anthropic/claude-opus-5-5</code>   | 9.63s  | 92.77       | 7.23% | 0.72% | 9.63s           | $0.0227        |
| 6    | <code>openai/gpt-6.1-sol</code>          | 9.81s  | 99.76       | 0.24% | 0.05% | 9.81s           | $0.0094        |
| 7    | <code>anthropic/claude-fable-5</code>    | 12.29s | 92.77       | 7.23% | 0.72% | 12.29s          | $0.0567        |
| 8    | <code>openai/gpt-6-luna</code>           | 13.71s | 99.52       | 0.48% | 0.18% | 13.71s          | $0.0011        |
| 9    | <code>grok/grok-4.7</code>               | 74.21s | 93.01       | 6.99% | 0.68% | 74.21s          | $0.0479        |

#### Quality Score

| Rank | Provider                                 | Value                   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>openai/gpt-6.1-sol</code>          | 99.76/100 quality score | 99.76       | 0.24% | 0.05% | 9.81s           | $0.0094        |
| 2    | <code>anthropic/claude-sonnet-5-5</code> | 99.52/100 quality score | 99.52       | 0.48% | 0.09% | 6.71s           | $0.0132        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | 99.52/100 quality score | 99.52       | 0.48% | 0.09% | 5.93s           | $0.0062        |
| 4    | <code>openai/gpt-6-luna</code>           | 99.52/100 quality score | 99.52       | 0.48% | 0.18% | 13.71s          | $0.0011        |
| 5    | <code>grok/grok-4.7</code>               | 93.01/100 quality score | 93.01       | 6.99% | 0.68% | 74.21s          | $0.0479        |
| 6    | <code>mistral/mistral-ocr-4-1</code>     | 93.01/100 quality score | 93.01       | 6.99% | 0.68% | 1.76s           | $0.0040        |
| 7    | <code>anthropic/claude-fable-5</code>    | 92.77/100 quality score | 92.77       | 7.23% | 0.72% | 12.29s          | $0.0567        |
| 8    | <code>anthropic/claude-haiku-5-5</code>  | 92.77/100 quality score | 92.77       | 7.23% | 0.72% | 4.36s           | $0.0006        |
| 9    | <code>anthropic/claude-opus-5-5</code>   | 92.77/100 quality score | 92.77       | 7.23% | 0.72% | 9.63s           | $0.0227        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | ----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 88.67       | 11.33% | 3.74% | 0.99s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 92.77       | 7.23%  | 0.72% | 12.29s          | $0.0567        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 92.77       | 7.23%  | 0.72% | 4.36s           | $0.0006        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 92.77       | 7.23%  | 0.72% | 9.63s           | $0.0227        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 99.52       | 0.48%  | 0.09% | 6.71s           | $0.0132        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 99.52       | 0.48%  | 0.09% | 5.93s           | $0.0062        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 93.01       | 6.99%  | 0.68% | 74.21s          | $0.0479        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 93.01       | 6.99%  | 0.68% | 1.76s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 99.52       | 0.48%  | 0.18% | 13.71s          | $0.0011        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 99.76       | 0.24%  | 0.05% | 9.81s           | $0.0094        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 40            | 6         | 1          | 415        |
| <code>anthropic/claude-fable-5</code>    | 16            | 14        | 0          | 415        |
| <code>anthropic/claude-haiku-5-5</code>  | 16            | 14        | 0          | 415        |
| <code>anthropic/claude-opus-5-5</code>   | 16            | 14        | 0          | 415        |
| <code>anthropic/claude-sonnet-5-5</code> | 2             | 0         | 0          | 415        |
| <code>gemini/gemini-3.8-flash</code>     | 2             | 0         | 0          | 415        |
| <code>grok/grok-4.7</code>               | 15            | 14        | 0          | 415        |
| <code>mistral/mistral-ocr-4-1</code>     | 15            | 14        | 0          | 415        |
| <code>openai/gpt-6-luna</code>           | 2             | 0         | 0          | 415        |
| <code>openai/gpt-6.1-sol</code>          | 1             | 0         | 0          | 415        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 88.67/100.
- Best cloud service: `openai/gpt-6.1-sol` scored 99.76/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.0565¢ ($0.0006).
- Fastest local model: `tesseract/tesseract` at 0.99s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.76s.

## Lexical evaluation scope

Reference scope: region-crop. Exhaustive lexical target for the declared input page/crop; drawing syntax is excluded where the publisher serialization declares it.

Headline WER/CER use the existing case-insensitive lexical normalization and declared reference order. Reading-order or serialization differences can increase edit distance; these scores do not measure layout or exact glyph/punctuation fidelity.

Text-only OCR does not establish column/region localization or page layout. An article crop does not establish whole-page reading order.

Literal numeric, punctuation and whitespace comparisons are representation-fidelity diagnostics. TSV tabs, span-continuation blanks, Markdown wrappers and source case conventions can differ without establishing a recognition error.

[Literal numeric, punctuation and alternate-reading diagnostics](evaluation-diagnostics.json) retain all source and provider text privately.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- Each provider received the same pinned original PNG/JPEG or the declared rendered-PNG baseline variant. Reference text, table cells, manuscript deletions and graph/layout annotations were never sent to providers. Text recognition is scored separately from unavailable cell, branch and page-geometry accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
