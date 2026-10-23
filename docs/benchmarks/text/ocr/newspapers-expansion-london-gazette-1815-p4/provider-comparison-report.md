# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-newspaper-expansion/benchmark-runs/newspapers-expansion-london-gazette-1815-p4`
- Publisher canonical reference: `normalized-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `999928600801e58f9c337c97d5e71ea03490074bef35b81b6cdbec6b41ed56f5`.
- Publisher source: https://en.wikisource.org/w/index.php?title=Page%3AThe%20London%20Gazette%2017028.pdf%2F4&oldid=16226633&action=raw (revision `16226633`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 68.96       | 31.04% | 11.18% | 1.33s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 1.33s | 68.96       | 31.04% | 11.18% | 1.33s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 68.96/100 quality score | 68.96       | 31.04% | 11.18% | 1.33s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0014 | 97.18       | 2.82% | 0.93% | 7.50s           | $0.0014        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0020 | 95.06       | 4.94% | 1.35% | 31.39s          | $0.0020        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 97.18       | 2.82% | 0.91% | 7.02s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0108 | 97.88       | 2.12% | 0.57% | 10.66s          | $0.0108        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0168 | 95.06       | 4.94% | 1.04% | 22.33s          | $0.0168        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0274 | 97.71       | 2.29% | 0.96% | 13.22s          | $0.0274        |
| 7    | <code>grok/grok-4.7</code>               | $0.0476 | 97.71       | 2.29% | 1.11% | 63.11s          | $0.0476        |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0549 | 98.41       | 1.59% | 0.44% | 15.89s          | $0.0549        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.1387 | 97.88       | 2.12% | 0.85% | 23.61s          | $0.1387        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 7.02s  | 97.18       | 2.82% | 0.91% | 7.02s           | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 7.50s  | 97.18       | 2.82% | 0.93% | 7.50s           | $0.0014        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | 10.66s | 97.88       | 2.12% | 0.57% | 10.66s          | $0.0108        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 13.22s | 97.71       | 2.29% | 0.96% | 13.22s          | $0.0274        |
| 5    | <code>anthropic/claude-opus-5-5</code>   | 15.89s | 98.41       | 1.59% | 0.44% | 15.89s          | $0.0549        |
| 6    | <code>openai/gpt-6.1-sol</code>          | 22.33s | 95.06       | 4.94% | 1.04% | 22.33s          | $0.0168        |
| 7    | <code>anthropic/claude-fable-5</code>    | 23.61s | 97.88       | 2.12% | 0.85% | 23.61s          | $0.1387        |
| 8    | <code>openai/gpt-6-luna</code>           | 31.39s | 95.06       | 4.94% | 1.35% | 31.39s          | $0.0020        |
| 9    | <code>grok/grok-4.7</code>               | 63.11s | 97.71       | 2.29% | 1.11% | 63.11s          | $0.0476        |

#### Quality Score

| Rank | Provider                                 | Value                   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-opus-5-5</code>   | 98.41/100 quality score | 98.41       | 1.59% | 0.44% | 15.89s          | $0.0549        |
| 2    | <code>gemini/gemini-3.8-flash</code>     | 97.88/100 quality score | 97.88       | 2.12% | 0.57% | 10.66s          | $0.0108        |
| 3    | <code>anthropic/claude-fable-5</code>    | 97.88/100 quality score | 97.88       | 2.12% | 0.85% | 23.61s          | $0.1387        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 97.71/100 quality score | 97.71       | 2.29% | 0.96% | 13.22s          | $0.0274        |
| 5    | <code>grok/grok-4.7</code>               | 97.71/100 quality score | 97.71       | 2.29% | 1.11% | 63.11s          | $0.0476        |
| 6    | <code>mistral/mistral-ocr-4-1</code>     | 97.18/100 quality score | 97.18       | 2.82% | 0.91% | 7.02s           | $0.0040        |
| 7    | <code>anthropic/claude-haiku-5-5</code>  | 97.18/100 quality score | 97.18       | 2.82% | 0.93% | 7.50s           | $0.0014        |
| 8    | <code>openai/gpt-6.1-sol</code>          | 95.06/100 quality score | 95.06       | 4.94% | 1.04% | 22.33s          | $0.0168        |
| 9    | <code>openai/gpt-6-luna</code>           | 95.06/100 quality score | 95.06       | 4.94% | 1.35% | 31.39s          | $0.0020        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | -----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 68.96       | 31.04% | 11.18% | 1.33s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 97.88       | 2.12%  | 0.85%  | 23.61s          | $0.1387        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 97.18       | 2.82%  | 0.93%  | 7.50s           | $0.0014        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 98.41       | 1.59%  | 0.44%  | 15.89s          | $0.0549        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 97.71       | 2.29%  | 0.96%  | 13.22s          | $0.0274        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 97.88       | 2.12%  | 0.57%  | 10.66s          | $0.0108        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 97.71       | 2.29%  | 1.11%  | 63.11s          | $0.0476        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 97.18       | 2.82%  | 0.91%  | 7.02s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 95.06       | 4.94%  | 1.35%  | 31.39s          | $0.0020        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 95.06       | 4.94%  | 1.04%  | 22.33s          | $0.0168        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 123           | 14        | 39         | 567        |
| <code>anthropic/claude-fable-5</code>    | 7             | 4         | 1          | 567        |
| <code>anthropic/claude-haiku-5-5</code>  | 10            | 4         | 2          | 567        |
| <code>anthropic/claude-opus-5-5</code>   | 6             | 2         | 1          | 567        |
| <code>anthropic/claude-sonnet-5-5</code> | 8             | 4         | 1          | 567        |
| <code>gemini/gemini-3.8-flash</code>     | 9             | 2         | 1          | 567        |
| <code>grok/grok-4.7</code>               | 7             | 5         | 1          | 567        |
| <code>mistral/mistral-ocr-4-1</code>     | 13            | 2         | 1          | 567        |
| <code>openai/gpt-6-luna</code>           | 19            | 4         | 5          | 567        |
| <code>openai/gpt-6.1-sol</code>          | 18            | 2         | 8          | 567        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 68.96/100.
- Best cloud service: `anthropic/claude-opus-5-5` scored 98.41/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.1365¢ ($0.0014).
- Fastest local model: `tesseract/tesseract` at 1.33s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 7.02s.

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
