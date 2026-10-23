# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-newspaper-expansion/benchmark-runs/newspapers-expansion-bln-charter-aldermen`
- Publisher canonical reference: `normalized-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `19aa8edb678d15f72b93634fd5f84bcb9ee4d3bdf75d1c980e9784478dbbbccb`.
- Publisher source: https://ndownloader.figshare.com/files/49365928#Ground%20Truth%2F3205297646.txt (revision `10.15131/shef.data.25439023.v2`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 93.89       | 6.11% | 1.32% | 0.57s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.57s | 93.89       | 6.11% | 1.32% | 0.57s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 93.89/100 quality score | 93.89       | 6.11% | 1.32% | 0.57s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0004 | 100.00      | 0.00% | 0.00% | 3.05s           | $0.0004        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0007 | 97.38       | 2.62% | 0.23% | 10.82s          | $0.0007        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 100.00      | 0.00% | 0.00% | 2.73s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0040 | 97.38       | 2.62% | 0.23% | 4.54s           | $0.0040        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0059 | 97.38       | 2.62% | 0.23% | 6.62s           | $0.0059        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0082 | 100.00      | 0.00% | 0.00% | 4.86s           | $0.0082        |
| 7    | <code>grok/grok-4.7</code>               | $0.0128 | 97.38       | 2.62% | 0.23% | 12.07s          | $0.0128        |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0165 | 100.00      | 0.00% | 0.00% | 5.17s           | $0.0165        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0412 | 100.00      | 0.00% | 0.00% | 7.69s           | $0.0412        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 2.73s  | 100.00      | 0.00% | 0.00% | 2.73s           | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 3.05s  | 100.00      | 0.00% | 0.00% | 3.05s           | $0.0004        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | 4.54s  | 97.38       | 2.62% | 0.23% | 4.54s           | $0.0040        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 4.86s  | 100.00      | 0.00% | 0.00% | 4.86s           | $0.0082        |
| 5    | <code>anthropic/claude-opus-5-5</code>   | 5.17s  | 100.00      | 0.00% | 0.00% | 5.17s           | $0.0165        |
| 6    | <code>openai/gpt-6.1-sol</code>          | 6.62s  | 97.38       | 2.62% | 0.23% | 6.62s           | $0.0059        |
| 7    | <code>anthropic/claude-fable-5</code>    | 7.69s  | 100.00      | 0.00% | 0.00% | 7.69s           | $0.0412        |
| 8    | <code>openai/gpt-6-luna</code>           | 10.82s | 97.38       | 2.62% | 0.23% | 10.82s          | $0.0007        |
| 9    | <code>grok/grok-4.7</code>               | 12.07s | 97.38       | 2.62% | 0.23% | 12.07s          | $0.0128        |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-fable-5</code>    | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 7.69s           | $0.0412        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 3.05s           | $0.0004        |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 5.17s           | $0.0165        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 4.86s           | $0.0082        |
| 5    | <code>mistral/mistral-ocr-4-1</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 2.73s           | $0.0040        |
| 6    | <code>gemini/gemini-3.8-flash</code>     | 97.38/100 quality score  | 97.38       | 2.62% | 0.23% | 4.54s           | $0.0040        |
| 7    | <code>grok/grok-4.7</code>               | 97.38/100 quality score  | 97.38       | 2.62% | 0.23% | 12.07s          | $0.0128        |
| 8    | <code>openai/gpt-6-luna</code>           | 97.38/100 quality score  | 97.38       | 2.62% | 0.23% | 10.82s          | $0.0007        |
| 9    | <code>openai/gpt-6.1-sol</code>          | 97.38/100 quality score  | 97.38       | 2.62% | 0.23% | 6.62s           | $0.0059        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | ----: | ----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 93.89       | 6.11% | 1.32% | 0.57s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 100.00      | 0.00% | 0.00% | 7.69s           | $0.0412        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 100.00      | 0.00% | 0.00% | 3.05s           | $0.0004        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 100.00      | 0.00% | 0.00% | 5.17s           | $0.0165        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00      | 0.00% | 0.00% | 4.86s           | $0.0082        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 97.38       | 2.62% | 0.23% | 4.54s           | $0.0040        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 97.38       | 2.62% | 0.23% | 12.07s          | $0.0128        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 100.00      | 0.00% | 0.00% | 2.73s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 97.38       | 2.62% | 0.23% | 10.82s          | $0.0007        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 97.38       | 2.62% | 0.23% | 6.62s           | $0.0059        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 9             | 0         | 5          | 229        |
| <code>anthropic/claude-fable-5</code>    | 0             | 0         | 0          | 229        |
| <code>anthropic/claude-haiku-5-5</code>  | 0             | 0         | 0          | 229        |
| <code>anthropic/claude-opus-5-5</code>   | 0             | 0         | 0          | 229        |
| <code>anthropic/claude-sonnet-5-5</code> | 0             | 0         | 0          | 229        |
| <code>gemini/gemini-3.8-flash</code>     | 3             | 0         | 3          | 229        |
| <code>grok/grok-4.7</code>               | 3             | 0         | 3          | 229        |
| <code>mistral/mistral-ocr-4-1</code>     | 0             | 0         | 0          | 229        |
| <code>openai/gpt-6-luna</code>           | 3             | 0         | 3          | 229        |
| <code>openai/gpt-6.1-sol</code>          | 3             | 0         | 3          | 229        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 93.89/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.0412¢ ($0.0004).
- Fastest local model: `tesseract/tesseract` at 0.57s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 2.73s.

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
