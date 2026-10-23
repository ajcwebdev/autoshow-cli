# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-newspaper-expansion/benchmark-runs/newspapers-expansion-independent-hindustan-1920-p3`
- Publisher canonical reference: `normalized-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `c6f855a100e9846edbcc32da8bb84349bef1f3f0b08b8c316543638cec31a42b`.
- Publisher source: https://en.wikisource.org/w/index.php?title=Page%3AThe%20Independent%20Hindustan%20Volume%20I%20Number%204.djvu%2F3&oldid=8368077&action=raw (revision `8368077`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 88.94       | 11.06% | 2.31% | 1.83s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 1.83s | 88.94       | 11.06% | 2.31% | 1.83s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 88.94/100 quality score | 88.94       | 11.06% | 2.31% | 1.83s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0010 | 99.28       | 0.72% | 0.18% | 6.54s           | $0.0010        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0016 | 98.71       | 1.29% | 0.44% | 25.01s          | $0.0016        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 98.99       | 1.01% | 0.18% | 3.84s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0085 | 99.57       | 0.43% | 0.18% | 8.46s           | $0.0085        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0129 | 98.99       | 1.01% | 0.21% | 16.91s          | $0.0129        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0180 | 98.99       | 1.01% | 0.18% | 7.89s           | $0.0180        |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.0364 | 99.43       | 0.57% | 0.14% | 10.58s          | $0.0364        |
| 8    | <code>grok/grok-4.7</code>               | $0.0528 | 99.57       | 0.43% | 0.18% | 87.69s          | $0.0528        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.1069 | 93.10       | 6.90% | 0.69% | 22.23s          | $0.1069        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 3.84s  | 98.99       | 1.01% | 0.18% | 3.84s           | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 6.54s  | 99.28       | 0.72% | 0.18% | 6.54s           | $0.0010        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 7.89s  | 98.99       | 1.01% | 0.18% | 7.89s           | $0.0180        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | 8.46s  | 99.57       | 0.43% | 0.18% | 8.46s           | $0.0085        |
| 5    | <code>anthropic/claude-opus-5-5</code>   | 10.58s | 99.43       | 0.57% | 0.14% | 10.58s          | $0.0364        |
| 6    | <code>openai/gpt-6.1-sol</code>          | 16.91s | 98.99       | 1.01% | 0.21% | 16.91s          | $0.0129        |
| 7    | <code>anthropic/claude-fable-5</code>    | 22.23s | 93.10       | 6.90% | 0.69% | 22.23s          | $0.1069        |
| 8    | <code>openai/gpt-6-luna</code>           | 25.01s | 98.71       | 1.29% | 0.44% | 25.01s          | $0.0016        |
| 9    | <code>grok/grok-4.7</code>               | 87.69s | 99.57       | 0.43% | 0.18% | 87.69s          | $0.0528        |

#### Quality Score

| Rank | Provider                                 | Value                   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>gemini/gemini-3.8-flash</code>     | 99.57/100 quality score | 99.57       | 0.43% | 0.18% | 8.46s           | $0.0085        |
| 2    | <code>grok/grok-4.7</code>               | 99.57/100 quality score | 99.57       | 0.43% | 0.18% | 87.69s          | $0.0528        |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 99.43/100 quality score | 99.43       | 0.57% | 0.14% | 10.58s          | $0.0364        |
| 4    | <code>anthropic/claude-haiku-5-5</code>  | 99.28/100 quality score | 99.28       | 0.72% | 0.18% | 6.54s           | $0.0010        |
| 5    | <code>anthropic/claude-sonnet-5-5</code> | 98.99/100 quality score | 98.99       | 1.01% | 0.18% | 7.89s           | $0.0180        |
| 6    | <code>mistral/mistral-ocr-4-1</code>     | 98.99/100 quality score | 98.99       | 1.01% | 0.18% | 3.84s           | $0.0040        |
| 7    | <code>openai/gpt-6.1-sol</code>          | 98.99/100 quality score | 98.99       | 1.01% | 0.21% | 16.91s          | $0.0129        |
| 8    | <code>openai/gpt-6-luna</code>           | 98.71/100 quality score | 98.71       | 1.29% | 0.44% | 25.01s          | $0.0016        |
| 9    | <code>anthropic/claude-fable-5</code>    | 93.10/100 quality score | 93.10       | 6.90% | 0.69% | 22.23s          | $0.1069        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | ----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 88.94       | 11.06% | 2.31% | 1.83s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 93.10       | 6.90%  | 0.69% | 22.23s          | $0.1069        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 99.28       | 0.72%  | 0.18% | 6.54s           | $0.0010        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 99.43       | 0.57%  | 0.14% | 10.58s          | $0.0364        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 98.99       | 1.01%  | 0.18% | 7.89s           | $0.0180        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 99.57       | 0.43%  | 0.18% | 8.46s           | $0.0085        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 99.57       | 0.43%  | 0.18% | 87.69s          | $0.0528        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 98.99       | 1.01%  | 0.18% | 3.84s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 98.71       | 1.29%  | 0.44% | 25.01s          | $0.0016        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 98.99       | 1.01%  | 0.21% | 16.91s          | $0.0129        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 44            | 9         | 24         | 696        |
| <code>anthropic/claude-fable-5</code>    | 25            | 0         | 23         | 696        |
| <code>anthropic/claude-haiku-5-5</code>  | 4             | 0         | 1          | 696        |
| <code>anthropic/claude-opus-5-5</code>   | 3             | 0         | 1          | 696        |
| <code>anthropic/claude-sonnet-5-5</code> | 4             | 2         | 1          | 696        |
| <code>gemini/gemini-3.8-flash</code>     | 2             | 0         | 1          | 696        |
| <code>grok/grok-4.7</code>               | 2             | 0         | 1          | 696        |
| <code>mistral/mistral-ocr-4-1</code>     | 4             | 2         | 1          | 696        |
| <code>openai/gpt-6-luna</code>           | 6             | 2         | 1          | 696        |
| <code>openai/gpt-6.1-sol</code>          | 5             | 1         | 1          | 696        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 88.94/100.
- Best cloud service: `gemini/gemini-3.8-flash` scored 99.57/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.0994¢ ($0.0010).
- Fastest local model: `tesseract/tesseract` at 1.83s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 3.84s.

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
