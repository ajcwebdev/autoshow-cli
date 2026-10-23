# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-newspaper-expansion/benchmark-runs/newspapers-expansion-bln-morning-chronicle-inquest`
- Publisher canonical reference: `normalized-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `a40c232bb07cdc9b83fc1d337a15eeda7c051704d804af986fb8aacda6c42725`.
- Publisher source: https://ndownloader.figshare.com/files/49365928#Ground%20Truth%2F3207167129.txt (revision `10.15131/shef.data.25439023.v2`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 88.36       | 11.64% | 2.58% | 0.86s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.86s | 88.36       | 11.64% | 2.58% | 0.86s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 88.36/100 quality score | 88.36       | 11.64% | 2.58% | 0.86s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0007 | 99.57       | 0.43% | 0.04% | 3.86s           | $0.0007        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0014 | 100.00      | 0.00% | 0.00% | 17.15s          | $0.0014        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 99.57       | 0.43% | 0.04% | 2.46s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0070 | 97.84       | 2.16% | 0.19% | 6.06s           | $0.0070        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0105 | 97.63       | 2.37% | 0.22% | 10.55s          | $0.0105        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0144 | 100.00      | 0.00% | 0.00% | 7.10s           | $0.0144        |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.0292 | 99.57       | 0.43% | 0.04% | 9.98s           | $0.0292        |
| 8    | <code>grok/grok-4.7</code>               | $0.0512 | 99.57       | 0.43% | 0.04% | 75.04s          | $0.0512        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0735 | 97.84       | 2.16% | 0.19% | 14.49s          | $0.0735        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 2.46s  | 99.57       | 0.43% | 0.04% | 2.46s           | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 3.86s  | 99.57       | 0.43% | 0.04% | 3.86s           | $0.0007        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | 6.06s  | 97.84       | 2.16% | 0.19% | 6.06s           | $0.0070        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 7.10s  | 100.00      | 0.00% | 0.00% | 7.10s           | $0.0144        |
| 5    | <code>anthropic/claude-opus-5-5</code>   | 9.98s  | 99.57       | 0.43% | 0.04% | 9.98s           | $0.0292        |
| 6    | <code>openai/gpt-6.1-sol</code>          | 10.55s | 97.63       | 2.37% | 0.22% | 10.55s          | $0.0105        |
| 7    | <code>anthropic/claude-fable-5</code>    | 14.49s | 97.84       | 2.16% | 0.19% | 14.49s          | $0.0735        |
| 8    | <code>openai/gpt-6-luna</code>           | 17.15s | 100.00      | 0.00% | 0.00% | 17.15s          | $0.0014        |
| 9    | <code>grok/grok-4.7</code>               | 75.04s | 99.57       | 0.43% | 0.04% | 75.04s          | $0.0512        |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 7.10s           | $0.0144        |
| 2    | <code>openai/gpt-6-luna</code>           | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 17.15s          | $0.0014        |
| 3    | <code>anthropic/claude-haiku-5-5</code>  | 99.57/100 quality score  | 99.57       | 0.43% | 0.04% | 3.86s           | $0.0007        |
| 4    | <code>anthropic/claude-opus-5-5</code>   | 99.57/100 quality score  | 99.57       | 0.43% | 0.04% | 9.98s           | $0.0292        |
| 5    | <code>grok/grok-4.7</code>               | 99.57/100 quality score  | 99.57       | 0.43% | 0.04% | 75.04s          | $0.0512        |
| 6    | <code>mistral/mistral-ocr-4-1</code>     | 99.57/100 quality score  | 99.57       | 0.43% | 0.04% | 2.46s           | $0.0040        |
| 7    | <code>anthropic/claude-fable-5</code>    | 97.84/100 quality score  | 97.84       | 2.16% | 0.19% | 14.49s          | $0.0735        |
| 8    | <code>gemini/gemini-3.8-flash</code>     | 97.84/100 quality score  | 97.84       | 2.16% | 0.19% | 6.06s           | $0.0070        |
| 9    | <code>openai/gpt-6.1-sol</code>          | 97.63/100 quality score  | 97.63       | 2.37% | 0.22% | 10.55s          | $0.0105        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | ----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 88.36       | 11.64% | 2.58% | 0.86s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 97.84       | 2.16%  | 0.19% | 14.49s          | $0.0735        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 99.57       | 0.43%  | 0.04% | 3.86s           | $0.0007        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 99.57       | 0.43%  | 0.04% | 9.98s           | $0.0292        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00      | 0.00%  | 0.00% | 7.10s           | $0.0144        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 97.84       | 2.16%  | 0.19% | 6.06s           | $0.0070        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 99.57       | 0.43%  | 0.04% | 75.04s          | $0.0512        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 99.57       | 0.43%  | 0.04% | 2.46s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 100.00      | 0.00%  | 0.00% | 17.15s          | $0.0014        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 97.63       | 2.37%  | 0.22% | 10.55s          | $0.0105        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 42            | 6         | 6          | 464        |
| <code>anthropic/claude-fable-5</code>    | 5             | 0         | 5          | 464        |
| <code>anthropic/claude-haiku-5-5</code>  | 1             | 1         | 0          | 464        |
| <code>anthropic/claude-opus-5-5</code>   | 1             | 1         | 0          | 464        |
| <code>anthropic/claude-sonnet-5-5</code> | 0             | 0         | 0          | 464        |
| <code>gemini/gemini-3.8-flash</code>     | 5             | 0         | 5          | 464        |
| <code>grok/grok-4.7</code>               | 1             | 1         | 0          | 464        |
| <code>mistral/mistral-ocr-4-1</code>     | 1             | 1         | 0          | 464        |
| <code>openai/gpt-6-luna</code>           | 0             | 0         | 0          | 464        |
| <code>openai/gpt-6.1-sol</code>          | 6             | 0         | 5          | 464        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 88.36/100.
- Best cloud service: `anthropic/claude-sonnet-5-5` scored 100.00/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.0729¢ ($0.0007).
- Fastest local model: `tesseract/tesseract` at 0.86s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 2.46s.

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
