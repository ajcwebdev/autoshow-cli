# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-newspaper-expansion/benchmark-runs/newspapers-expansion-bln-police-news-putney`
- Publisher canonical reference: `normalized-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `f5d0e6164a3d32a9c3e6bc63aae9bb522f5331aa8ec13be8ae1c9e5388638d31`.
- Publisher source: https://ndownloader.figshare.com/files/49365928#Ground%20Truth%2F3200810876.txt (revision `10.15131/shef.data.25439023.v2`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 83.54       | 16.46% | 3.66% | 0.68s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.68s | 83.54       | 16.46% | 3.66% | 0.68s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 83.54/100 quality score | 83.54       | 16.46% | 3.66% | 0.68s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0005 | 100.00      | 0.00% | 0.00% | 3.04s           | $0.0005        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0011 | 99.37       | 0.63% | 0.06% | 16.89s          | $0.0011        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 99.68       | 0.32% | 0.06% | 1.59s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0048 | 100.00      | 0.00% | 0.00% | 4.34s           | $0.0048        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0092 | 99.37       | 0.63% | 0.06% | 11.49s          | $0.0092        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0104 | 100.00      | 0.00% | 0.00% | 4.75s           | $0.0104        |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.0208 | 100.00      | 0.00% | 0.00% | 8.43s           | $0.0208        |
| 8    | <code>grok/grok-4.7</code>               | $0.0312 | 99.37       | 0.63% | 0.06% | 37.35s          | $0.0312        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0521 | 100.00      | 0.00% | 0.00% | 10.29s          | $0.0521        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 1.59s  | 99.68       | 0.32% | 0.06% | 1.59s           | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 3.04s  | 100.00      | 0.00% | 0.00% | 3.04s           | $0.0005        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | 4.34s  | 100.00      | 0.00% | 0.00% | 4.34s           | $0.0048        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 4.75s  | 100.00      | 0.00% | 0.00% | 4.75s           | $0.0104        |
| 5    | <code>anthropic/claude-opus-5-5</code>   | 8.43s  | 100.00      | 0.00% | 0.00% | 8.43s           | $0.0208        |
| 6    | <code>anthropic/claude-fable-5</code>    | 10.29s | 100.00      | 0.00% | 0.00% | 10.29s          | $0.0521        |
| 7    | <code>openai/gpt-6.1-sol</code>          | 11.49s | 99.37       | 0.63% | 0.06% | 11.49s          | $0.0092        |
| 8    | <code>openai/gpt-6-luna</code>           | 16.89s | 99.37       | 0.63% | 0.06% | 16.89s          | $0.0011        |
| 9    | <code>grok/grok-4.7</code>               | 37.35s | 99.37       | 0.63% | 0.06% | 37.35s          | $0.0312        |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-fable-5</code>    | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 10.29s          | $0.0521        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 3.04s           | $0.0005        |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 8.43s           | $0.0208        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 4.75s           | $0.0104        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 4.34s           | $0.0048        |
| 6    | <code>mistral/mistral-ocr-4-1</code>     | 99.68/100 quality score  | 99.68       | 0.32% | 0.06% | 1.59s           | $0.0040        |
| 7    | <code>grok/grok-4.7</code>               | 99.37/100 quality score  | 99.37       | 0.63% | 0.06% | 37.35s          | $0.0312        |
| 8    | <code>openai/gpt-6-luna</code>           | 99.37/100 quality score  | 99.37       | 0.63% | 0.06% | 16.89s          | $0.0011        |
| 9    | <code>openai/gpt-6.1-sol</code>          | 99.37/100 quality score  | 99.37       | 0.63% | 0.06% | 11.49s          | $0.0092        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | ----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 83.54       | 16.46% | 3.66% | 0.68s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 100.00      | 0.00%  | 0.00% | 10.29s          | $0.0521        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 100.00      | 0.00%  | 0.00% | 3.04s           | $0.0005        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 100.00      | 0.00%  | 0.00% | 8.43s           | $0.0208        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00      | 0.00%  | 0.00% | 4.75s           | $0.0104        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 100.00      | 0.00%  | 0.00% | 4.34s           | $0.0048        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 99.37       | 0.63%  | 0.06% | 37.35s          | $0.0312        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 99.68       | 0.32%  | 0.06% | 1.59s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 99.37       | 0.63%  | 0.06% | 16.89s          | $0.0011        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 99.37       | 0.63%  | 0.06% | 11.49s          | $0.0092        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 45            | 4         | 3          | 316        |
| <code>anthropic/claude-fable-5</code>    | 0             | 0         | 0          | 316        |
| <code>anthropic/claude-haiku-5-5</code>  | 0             | 0         | 0          | 316        |
| <code>anthropic/claude-opus-5-5</code>   | 0             | 0         | 0          | 316        |
| <code>anthropic/claude-sonnet-5-5</code> | 0             | 0         | 0          | 316        |
| <code>gemini/gemini-3.8-flash</code>     | 0             | 0         | 0          | 316        |
| <code>grok/grok-4.7</code>               | 1             | 0         | 1          | 316        |
| <code>mistral/mistral-ocr-4-1</code>     | 1             | 0         | 0          | 316        |
| <code>openai/gpt-6-luna</code>           | 1             | 0         | 1          | 316        |
| <code>openai/gpt-6.1-sol</code>          | 1             | 0         | 1          | 316        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 83.54/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.0521¢ ($0.0005).
- Fastest local model: `tesseract/tesseract` at 0.68s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.59s.

## Lexical evaluation scope

Reference scope: region-crop. Exhaustive lexical target for the declared input page/crop; drawing syntax is excluded where the publisher serialization declares it.

Headline WER/CER use the existing case-insensitive lexical normalization and declared reference order. Reading-order or serialization differences can increase edit distance; these scores do not measure layout or exact glyph/punctuation fidelity.

Text-only OCR does not establish column/region localization or page layout. An article crop does not establish whole-page reading order.

Literal numeric, punctuation and whitespace comparisons are representation-fidelity diagnostics. TSV tabs, span-continuation blanks, Markdown wrappers and source case conventions can differ without establishing a recognition error.

[Literal numeric, punctuation and alternate-reading diagnostics](evaluation-diagnostics.json) retain all source and provider text privately.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- Every selected model received the same pinned PNG for each admitted input. Independent reference text and reading-order annotations were never sent to providers. Lexical analysis applies the declared NFKC, quote/dash and whitespace conversion to both reference and candidate in private derivatives; raw saved outputs and diplomatic references remain unchanged. Whole-page layout, region recognition and long-page capacity are reported separately.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
