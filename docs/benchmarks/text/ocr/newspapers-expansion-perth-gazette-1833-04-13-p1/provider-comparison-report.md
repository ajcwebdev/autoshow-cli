# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-newspaper-expansion/benchmark-runs/newspapers-expansion-perth-gazette-1833-04-13-p1`
- Publisher canonical reference: `normalized-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `293ebc14b4d0615902d57e1a405b8a2f8fd8262b0dc6062055846c21fa16b048`.
- Publisher source: https://en.wikisource.org/w/index.php?title=Page%3AThe%20Perth%20Gazette%20and%20Western%20Australian%20Journal%201(15).djvu%2F1&oldid=14895746&action=raw (revision `14895746`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 74.24       | 25.76% | 11.11% | 1.93s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 1.93s | 74.24       | 25.76% | 11.11% | 1.93s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 74.24/100 quality score | 74.24       | 25.76% | 11.11% | 1.93s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0017 | 95.15       | 4.85%  | 4.05% | 10.61s          | $0.0017        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0024 | 95.69       | 4.31%  | 3.53% | 34.24s          | $0.0024        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 94.70       | 5.30%  | 4.05% | 8.10s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0149 | 95.51       | 4.49%  | 3.88% | 13.43s          | $0.0149        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0226 | 89.86       | 10.14% | 4.94% | 39.92s          | $0.0226        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0337 | 95.24       | 4.76%  | 3.97% | 15.32s          | $0.0337        |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.0678 | 95.42       | 4.58%  | 3.90% | 21.57s          | $0.0678        |
| 8    | <code>grok/grok-4.7</code>               | $0.0732 | 95.33       | 4.67%  | 0.60% | 111.13s         | $0.0732        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.1707 | 95.42       | 4.58%  | 3.88% | 34.25s          | $0.1707        |

#### Speed

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 8.10s   | 94.70       | 5.30%  | 4.05% | 8.10s           | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 10.61s  | 95.15       | 4.85%  | 4.05% | 10.61s          | $0.0017        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | 13.43s  | 95.51       | 4.49%  | 3.88% | 13.43s          | $0.0149        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 15.32s  | 95.24       | 4.76%  | 3.97% | 15.32s          | $0.0337        |
| 5    | <code>anthropic/claude-opus-5-5</code>   | 21.57s  | 95.42       | 4.58%  | 3.90% | 21.57s          | $0.0678        |
| 6    | <code>openai/gpt-6-luna</code>           | 34.24s  | 95.69       | 4.31%  | 3.53% | 34.24s          | $0.0024        |
| 7    | <code>anthropic/claude-fable-5</code>    | 34.25s  | 95.42       | 4.58%  | 3.88% | 34.25s          | $0.1707        |
| 8    | <code>openai/gpt-6.1-sol</code>          | 39.92s  | 89.86       | 10.14% | 4.94% | 39.92s          | $0.0226        |
| 9    | <code>grok/grok-4.7</code>               | 111.13s | 95.33       | 4.67%  | 0.60% | 111.13s         | $0.0732        |

#### Quality Score

| Rank | Provider                                 | Value                   | Score / 100 | WER    | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ----------------------: | ----------: | -----: | ----: | --------------: | -------------: |
| 1    | <code>openai/gpt-6-luna</code>           | 95.69/100 quality score | 95.69       | 4.31%  | 3.53% | 34.24s          | $0.0024        |
| 2    | <code>gemini/gemini-3.8-flash</code>     | 95.51/100 quality score | 95.51       | 4.49%  | 3.88% | 13.43s          | $0.0149        |
| 3    | <code>anthropic/claude-fable-5</code>    | 95.42/100 quality score | 95.42       | 4.58%  | 3.88% | 34.25s          | $0.1707        |
| 4    | <code>anthropic/claude-opus-5-5</code>   | 95.42/100 quality score | 95.42       | 4.58%  | 3.90% | 21.57s          | $0.0678        |
| 5    | <code>grok/grok-4.7</code>               | 95.33/100 quality score | 95.33       | 4.67%  | 0.60% | 111.13s         | $0.0732        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | 95.24/100 quality score | 95.24       | 4.76%  | 3.97% | 15.32s          | $0.0337        |
| 7    | <code>anthropic/claude-haiku-5-5</code>  | 95.15/100 quality score | 95.15       | 4.85%  | 4.05% | 10.61s          | $0.0017        |
| 8    | <code>mistral/mistral-ocr-4-1</code>     | 94.70/100 quality score | 94.70       | 5.30%  | 4.05% | 8.10s           | $0.0040        |
| 9    | <code>openai/gpt-6.1-sol</code>          | 89.86/100 quality score | 89.86       | 10.14% | 4.94% | 39.92s          | $0.0226        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | -----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 74.24       | 25.76% | 11.11% | 1.93s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 95.42       | 4.58%  | 3.88%  | 34.25s          | $0.1707        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 95.15       | 4.85%  | 4.05%  | 10.61s          | $0.0017        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 95.42       | 4.58%  | 3.90%  | 21.57s          | $0.0678        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 95.24       | 4.76%  | 3.97%  | 15.32s          | $0.0337        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 95.51       | 4.49%  | 3.88%  | 13.43s          | $0.0149        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 95.33       | 4.67%  | 0.60%  | 111.13s         | $0.0732        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 94.70       | 5.30%  | 4.05%  | 8.10s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 95.69       | 4.31%  | 3.53%  | 34.24s          | $0.0024        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 89.86       | 10.14% | 4.94%  | 39.92s          | $0.0226        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 230           | 26        | 31         | 1114       |
| <code>anthropic/claude-fable-5</code>    | 3             | 24        | 24         | 1114       |
| <code>anthropic/claude-haiku-5-5</code>  | 5             | 25        | 24         | 1114       |
| <code>anthropic/claude-opus-5-5</code>   | 3             | 24        | 24         | 1114       |
| <code>anthropic/claude-sonnet-5-5</code> | 4             | 25        | 24         | 1114       |
| <code>gemini/gemini-3.8-flash</code>     | 2             | 24        | 24         | 1114       |
| <code>grok/grok-4.7</code>               | 26            | 2         | 24         | 1114       |
| <code>mistral/mistral-ocr-4-1</code>     | 10            | 25        | 24         | 1114       |
| <code>openai/gpt-6-luna</code>           | 31            | 13        | 4          | 1114       |
| <code>openai/gpt-6.1-sol</code>          | 37            | 27        | 49         | 1114       |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 74.24/100.
- Best cloud service: `openai/gpt-6-luna` scored 95.69/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.1745¢ ($0.0017).
- Fastest local model: `tesseract/tesseract` at 1.93s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 8.10s.

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
