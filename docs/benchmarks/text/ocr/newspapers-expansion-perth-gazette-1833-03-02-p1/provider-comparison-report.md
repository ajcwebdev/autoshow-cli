# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-newspaper-expansion/benchmark-runs/newspapers-expansion-perth-gazette-1833-03-02-p1`
- Publisher canonical reference: `normalized-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `3b15e1b242b2f28876754e968b28bfef63f6390788fea83bc6f5ec1837d38deb`.
- Publisher source: https://en.wikisource.org/w/index.php?title=Page%3AThe%20Perth%20Gazette%20and%20Western%20Australian%20Journal%201(9).djvu%2F1&oldid=7397214&action=raw (revision `7397214`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 55.27       | 44.73% | 23.15% | 2.12s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 2.12s | 55.27       | 44.73% | 23.15% | 2.12s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 55.27/100 quality score | 55.27       | 44.73% | 23.15% | 2.12s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0021 | 95.35       | 4.65%  | 3.66% | 14.35s          | $0.0021        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0028 | 93.10       | 6.90%  | 5.01% | 44.08s          | $0.0028        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 92.88       | 7.12%  | 4.59% | 9.45s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0195 | 92.88       | 7.12%  | 3.73% | 17.33s          | $0.0195        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0250 | 94.48       | 5.52%  | 4.24% | 50.77s          | $0.0250        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0374 | 96.22       | 3.78%  | 2.95% | 18.23s          | $0.0374        |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.0744 | 95.79       | 4.21%  | 3.49% | 24.00s          | $0.0744        |
| 8    | <code>grok/grok-4.7</code>               | $0.1042 | 98.47       | 1.53%  | 0.75% | 168.13s         | $0.1042        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.1905 | 89.62       | 10.38% | 9.01% | 43.11s          | $0.1905        |

#### Speed

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 9.45s   | 92.88       | 7.12%  | 4.59% | 9.45s           | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 14.35s  | 95.35       | 4.65%  | 3.66% | 14.35s          | $0.0021        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | 17.33s  | 92.88       | 7.12%  | 3.73% | 17.33s          | $0.0195        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 18.23s  | 96.22       | 3.78%  | 2.95% | 18.23s          | $0.0374        |
| 5    | <code>anthropic/claude-opus-5-5</code>   | 24.00s  | 95.79       | 4.21%  | 3.49% | 24.00s          | $0.0744        |
| 6    | <code>anthropic/claude-fable-5</code>    | 43.11s  | 89.62       | 10.38% | 9.01% | 43.11s          | $0.1905        |
| 7    | <code>openai/gpt-6-luna</code>           | 44.08s  | 93.10       | 6.90%  | 5.01% | 44.08s          | $0.0028        |
| 8    | <code>openai/gpt-6.1-sol</code>          | 50.77s  | 94.48       | 5.52%  | 4.24% | 50.77s          | $0.0250        |
| 9    | <code>grok/grok-4.7</code>               | 168.13s | 98.47       | 1.53%  | 0.75% | 168.13s         | $0.1042        |

#### Quality Score

| Rank | Provider                                 | Value                   | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ----------------------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>grok/grok-4.7</code>               | 98.47/100 quality score | 98.47       | 1.53%  | 0.75% | 168.13s         | $0.1042        |
| 2    | <code>anthropic/claude-sonnet-5-5</code> | 96.22/100 quality score | 96.22       | 3.78%  | 2.95% | 18.23s          | $0.0374        |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 95.79/100 quality score | 95.79       | 4.21%  | 3.49% | 24.00s          | $0.0744        |
| 4    | <code>anthropic/claude-haiku-5-5</code>  | 95.35/100 quality score | 95.35       | 4.65%  | 3.66% | 14.35s          | $0.0021        |
| 5    | <code>openai/gpt-6.1-sol</code>          | 94.48/100 quality score | 94.48       | 5.52%  | 4.24% | 50.77s          | $0.0250        |
| 6    | <code>openai/gpt-6-luna</code>           | 93.10/100 quality score | 93.10       | 6.90%  | 5.01% | 44.08s          | $0.0028        |
| 7    | <code>gemini/gemini-3.8-flash</code>     | 92.88/100 quality score | 92.88       | 7.12%  | 3.73% | 17.33s          | $0.0195        |
| 8    | <code>mistral/mistral-ocr-4-1</code>     | 92.88/100 quality score | 92.88       | 7.12%  | 4.59% | 9.45s           | $0.0040        |
| 9    | <code>anthropic/claude-fable-5</code>    | 89.62/100 quality score | 89.62       | 10.38% | 9.01% | 43.11s          | $0.1905        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | -----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 55.27       | 44.73% | 23.15% | 2.12s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 89.62       | 10.38% | 9.01%  | 43.11s          | $0.1905        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 95.35       | 4.65%  | 3.66%  | 14.35s          | $0.0021        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 95.79       | 4.21%  | 3.49%  | 24.00s          | $0.0744        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 96.22       | 3.78%  | 2.95%  | 18.23s          | $0.0374        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 92.88       | 7.12%  | 3.73%  | 17.33s          | $0.0195        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 98.47       | 1.53%  | 0.75%  | 168.13s         | $0.1042        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 92.88       | 7.12%  | 4.59%  | 9.45s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 93.10       | 6.90%  | 5.01%  | 44.08s          | $0.0028        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 94.48       | 5.52%  | 4.24%  | 50.77s          | $0.0250        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 476           | 97        | 43         | 1377       |
| <code>anthropic/claude-fable-5</code>    | 6             | 67        | 70         | 1377       |
| <code>anthropic/claude-haiku-5-5</code>  | 12            | 25        | 27         | 1377       |
| <code>anthropic/claude-opus-5-5</code>   | 6             | 25        | 27         | 1377       |
| <code>anthropic/claude-sonnet-5-5</code> | 22            | 14        | 16         | 1377       |
| <code>gemini/gemini-3.8-flash</code>     | 26            | 24        | 48         | 1377       |
| <code>grok/grok-4.7</code>               | 8             | 6         | 7          | 1377       |
| <code>mistral/mistral-ocr-4-1</code>     | 48            | 25        | 25         | 1377       |
| <code>openai/gpt-6-luna</code>           | 28            | 38        | 29         | 1377       |
| <code>openai/gpt-6.1-sol</code>          | 22            | 26        | 28         | 1377       |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 55.27/100.
- Best cloud service: `grok/grok-4.7` scored 98.47/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.2071¢ ($0.0021).
- Fastest local model: `tesseract/tesseract` at 2.12s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 9.45s.

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
