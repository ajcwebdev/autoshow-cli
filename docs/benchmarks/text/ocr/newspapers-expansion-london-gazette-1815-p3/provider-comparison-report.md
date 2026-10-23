# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-newspaper-expansion/benchmark-runs/newspapers-expansion-london-gazette-1815-p3`
- Publisher canonical reference: `normalized-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `af575edd3cff5c91d09181bb778ce33852777ebdc8e0eede9fc913cc961b2bd8`.
- Publisher source: https://en.wikisource.org/w/index.php?title=Page%3AThe%20London%20Gazette%2017028.pdf%2F3&oldid=16226637&action=raw (revision `16226637`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 66.20       | 33.80% | 12.71% | 1.48s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 1.48s | 66.20       | 33.80% | 12.71% | 1.48s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 66.20/100 quality score | 66.20       | 33.80% | 12.71% | 1.48s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0014 | 96.89       | 3.11% | 1.95% | 8.01s           | $0.0014        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0021 | 96.89       | 3.11% | 1.69% | 39.94s          | $0.0021        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 97.85       | 2.15% | 1.13% | 4.50s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0135 | 96.03       | 3.97% | 1.15% | 11.84s          | $0.0135        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0186 | 95.71       | 4.29% | 1.32% | 28.30s          | $0.0186        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0274 | 98.39       | 1.61% | 0.95% | 13.88s          | $0.0274        |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.0547 | 98.61       | 1.39% | 0.91% | 18.21s          | $0.0547        |
| 8    | <code>grok/grok-4.7</code>               | $0.1242 | 98.18       | 1.82% | 0.98% | 195.77s         | $0.1242        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.1392 | 98.61       | 1.39% | 0.93% | 30.49s          | $0.1392        |

#### Speed

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 4.50s   | 97.85       | 2.15% | 1.13% | 4.50s           | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 8.01s   | 96.89       | 3.11% | 1.95% | 8.01s           | $0.0014        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | 11.84s  | 96.03       | 3.97% | 1.15% | 11.84s          | $0.0135        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 13.88s  | 98.39       | 1.61% | 0.95% | 13.88s          | $0.0274        |
| 5    | <code>anthropic/claude-opus-5-5</code>   | 18.21s  | 98.61       | 1.39% | 0.91% | 18.21s          | $0.0547        |
| 6    | <code>openai/gpt-6.1-sol</code>          | 28.30s  | 95.71       | 4.29% | 1.32% | 28.30s          | $0.0186        |
| 7    | <code>anthropic/claude-fable-5</code>    | 30.49s  | 98.61       | 1.39% | 0.93% | 30.49s          | $0.1392        |
| 8    | <code>openai/gpt-6-luna</code>           | 39.94s  | 96.89       | 3.11% | 1.69% | 39.94s          | $0.0021        |
| 9    | <code>grok/grok-4.7</code>               | 195.77s | 98.18       | 1.82% | 0.98% | 195.77s         | $0.1242        |

#### Quality Score

| Rank | Provider                                 | Value                   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-opus-5-5</code>   | 98.61/100 quality score | 98.61       | 1.39% | 0.91% | 18.21s          | $0.0547        |
| 2    | <code>anthropic/claude-fable-5</code>    | 98.61/100 quality score | 98.61       | 1.39% | 0.93% | 30.49s          | $0.1392        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 98.39/100 quality score | 98.39       | 1.61% | 0.95% | 13.88s          | $0.0274        |
| 4    | <code>grok/grok-4.7</code>               | 98.18/100 quality score | 98.18       | 1.82% | 0.98% | 195.77s         | $0.1242        |
| 5    | <code>mistral/mistral-ocr-4-1</code>     | 97.85/100 quality score | 97.85       | 2.15% | 1.13% | 4.50s           | $0.0040        |
| 6    | <code>openai/gpt-6-luna</code>           | 96.89/100 quality score | 96.89       | 3.11% | 1.69% | 39.94s          | $0.0021        |
| 7    | <code>anthropic/claude-haiku-5-5</code>  | 96.89/100 quality score | 96.89       | 3.11% | 1.95% | 8.01s           | $0.0014        |
| 8    | <code>gemini/gemini-3.8-flash</code>     | 96.03/100 quality score | 96.03       | 3.97% | 1.15% | 11.84s          | $0.0135        |
| 9    | <code>openai/gpt-6.1-sol</code>          | 95.71/100 quality score | 95.71       | 4.29% | 1.32% | 28.30s          | $0.0186        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | -----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 66.20       | 33.80% | 12.71% | 1.48s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 98.61       | 1.39%  | 0.93%  | 30.49s          | $0.1392        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 96.89       | 3.11%  | 1.95%  | 8.01s           | $0.0014        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 98.61       | 1.39%  | 0.91%  | 18.21s          | $0.0547        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 98.39       | 1.61%  | 0.95%  | 13.88s          | $0.0274        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 96.03       | 3.97%  | 1.15%  | 11.84s          | $0.0135        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 98.18       | 1.82%  | 0.98%  | 195.77s         | $0.1242        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 97.85       | 2.15%  | 1.13%  | 4.50s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 96.89       | 3.11%  | 1.69%  | 39.94s          | $0.0021        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 95.71       | 4.29%  | 1.32%  | 28.30s          | $0.0186        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 234           | 58        | 23         | 932        |
| <code>anthropic/claude-fable-5</code>    | 4             | 8         | 1          | 932        |
| <code>anthropic/claude-haiku-5-5</code>  | 14            | 8         | 7          | 932        |
| <code>anthropic/claude-opus-5-5</code>   | 4             | 8         | 1          | 932        |
| <code>anthropic/claude-sonnet-5-5</code> | 6             | 8         | 1          | 932        |
| <code>gemini/gemini-3.8-flash</code>     | 19            | 7         | 11         | 932        |
| <code>grok/grok-4.7</code>               | 8             | 8         | 1          | 932        |
| <code>mistral/mistral-ocr-4-1</code>     | 11            | 8         | 1          | 932        |
| <code>openai/gpt-6-luna</code>           | 19            | 9         | 1          | 932        |
| <code>openai/gpt-6.1-sol</code>          | 21            | 8         | 11         | 932        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 66.20/100.
- Best cloud service: `anthropic/claude-opus-5-5` scored 98.61/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.1377¢ ($0.0014).
- Fastest local model: `tesseract/tesseract` at 1.48s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 4.50s.

## Lexical evaluation scope

Reference scope: full-page. Exhaustive lexical target for the declared input page/crop; drawing syntax is excluded where the publisher serialization declares it.

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
