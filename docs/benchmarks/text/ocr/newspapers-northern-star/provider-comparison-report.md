# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/newspapers-northern-star`
- Publisher canonical reference: `newspapers-northern-star.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `09097e3430eb43b01572815b132575b1d728ae66c4976e441d4f6d5a41d80257`.
- Publisher source: https://ndownloader.figshare.com/files/52256378 (revision `10.5522/04/28381610.v1`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 90.27       | 9.73% | 2.32% | 1.47s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 1.47s | 90.27       | 9.73% | 2.32% | 1.47s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 90.27/100 quality score | 90.27       | 9.73% | 2.32% | 1.47s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0009 | 98.12       | 1.88% | 0.17% | 4.54s           | $0.0009        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0017 | 97.96       | 2.04% | 0.26% | 22.58s          | $0.0017        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 97.80       | 2.20% | 0.31% | 2.08s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0085 | 100.00      | 0.00% | 0.00% | 9.41s           | $0.0085        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0151 | 99.84       | 0.16% | 0.03% | 19.28s          | $0.0151        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0190 | 100.00      | 0.00% | 0.00% | 11.68s          | $0.0190        |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.0339 | 98.12       | 1.88% | 0.17% | 12.74s          | $0.0339        |
| 8    | <code>grok/grok-4.7</code>               | $0.0701 | 99.84       | 0.16% | 0.03% | 94.25s          | $0.0701        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0867 | 98.12       | 1.88% | 0.17% | 18.75s          | $0.0867        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 2.08s  | 97.80       | 2.20% | 0.31% | 2.08s           | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 4.54s  | 98.12       | 1.88% | 0.17% | 4.54s           | $0.0009        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | 9.41s  | 100.00      | 0.00% | 0.00% | 9.41s           | $0.0085        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 11.68s | 100.00      | 0.00% | 0.00% | 11.68s          | $0.0190        |
| 5    | <code>anthropic/claude-opus-5-5</code>   | 12.74s | 98.12       | 1.88% | 0.17% | 12.74s          | $0.0339        |
| 6    | <code>anthropic/claude-fable-5</code>    | 18.75s | 98.12       | 1.88% | 0.17% | 18.75s          | $0.0867        |
| 7    | <code>openai/gpt-6.1-sol</code>          | 19.28s | 99.84       | 0.16% | 0.03% | 19.28s          | $0.0151        |
| 8    | <code>openai/gpt-6-luna</code>           | 22.58s | 97.96       | 2.04% | 0.26% | 22.58s          | $0.0017        |
| 9    | <code>grok/grok-4.7</code>               | 94.25s | 99.84       | 0.16% | 0.03% | 94.25s          | $0.0701        |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 11.68s          | $0.0190        |
| 2    | <code>gemini/gemini-3.8-flash</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 9.41s           | $0.0085        |
| 3    | <code>grok/grok-4.7</code>               | 99.84/100 quality score  | 99.84       | 0.16% | 0.03% | 94.25s          | $0.0701        |
| 4    | <code>openai/gpt-6.1-sol</code>          | 99.84/100 quality score  | 99.84       | 0.16% | 0.03% | 19.28s          | $0.0151        |
| 5    | <code>anthropic/claude-fable-5</code>    | 98.12/100 quality score  | 98.12       | 1.88% | 0.17% | 18.75s          | $0.0867        |
| 6    | <code>anthropic/claude-haiku-5-5</code>  | 98.12/100 quality score  | 98.12       | 1.88% | 0.17% | 4.54s           | $0.0009        |
| 7    | <code>anthropic/claude-opus-5-5</code>   | 98.12/100 quality score  | 98.12       | 1.88% | 0.17% | 12.74s          | $0.0339        |
| 8    | <code>openai/gpt-6-luna</code>           | 97.96/100 quality score  | 97.96       | 2.04% | 0.26% | 22.58s          | $0.0017        |
| 9    | <code>mistral/mistral-ocr-4-1</code>     | 97.80/100 quality score  | 97.80       | 2.20% | 0.31% | 2.08s           | $0.0040        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | ----: | ----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 90.27       | 9.73% | 2.32% | 1.47s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 98.12       | 1.88% | 0.17% | 18.75s          | $0.0867        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 98.12       | 1.88% | 0.17% | 4.54s           | $0.0009        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 98.12       | 1.88% | 0.17% | 12.74s          | $0.0339        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00      | 0.00% | 0.00% | 11.68s          | $0.0190        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 100.00      | 0.00% | 0.00% | 9.41s           | $0.0085        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 99.84       | 0.16% | 0.03% | 94.25s          | $0.0701        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 97.80       | 2.20% | 0.31% | 2.08s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 97.96       | 2.04% | 0.26% | 22.58s          | $0.0017        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 99.84       | 0.16% | 0.03% | 19.28s          | $0.0151        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 52            | 7         | 3          | 637        |
| <code>anthropic/claude-fable-5</code>    | 6             | 6         | 0          | 637        |
| <code>anthropic/claude-haiku-5-5</code>  | 6             | 6         | 0          | 637        |
| <code>anthropic/claude-opus-5-5</code>   | 6             | 6         | 0          | 637        |
| <code>anthropic/claude-sonnet-5-5</code> | 0             | 0         | 0          | 637        |
| <code>gemini/gemini-3.8-flash</code>     | 0             | 0         | 0          | 637        |
| <code>grok/grok-4.7</code>               | 1             | 0         | 0          | 637        |
| <code>mistral/mistral-ocr-4-1</code>     | 8             | 6         | 0          | 637        |
| <code>openai/gpt-6-luna</code>           | 7             | 6         | 0          | 637        |
| <code>openai/gpt-6.1-sol</code>          | 1             | 0         | 0          | 637        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 90.27/100.
- Best cloud service: `anthropic/claude-sonnet-5-5` scored 100.00/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.0851¢ ($0.0009).
- Fastest local model: `tesseract/tesseract` at 1.47s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 2.08s.

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
