# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/handwriting-marker-table`
- Publisher canonical reference: `reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `21b46f03911b866916042379dc49f3c1179e01c28ac84aac5e1eb531994c0fb3`.
- Publisher source: https://huggingface.co/datasets/danielrosehill/Whiteboards/resolve/4b31e86e15743ffea20204a8f6992b0173ecbdf9/data/metadata.jsonl (revision `4b31e86e15743ffea20204a8f6992b0173ecbdf9`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER     | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | ------: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 0.00        | 106.67% | 59.14% | 0.84s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER     | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | ------: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.84s | 0.00        | 106.67% | 59.14% | 0.84s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                  | Score / 100 | WER     | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ---------------------: | ----------: | ------: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.00/100 quality score | 0.00        | 106.67% | 59.14% | 0.84s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>openai/gpt-6-luna</code>           | $0.0004 | 100.00      | 0.00% | 0.00% | 13.80s          | $0.0004        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | $0.0006 | 100.00      | 0.00% | 0.00% | 8.65s           | $0.0006        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | $0.0024 | 100.00      | 0.00% | 0.00% | 5.60s           | $0.0024        |
| 4    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 93.33       | 6.67% | 2.15% | 5.20s           | $0.0040        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0082 | 100.00      | 0.00% | 0.00% | 10.18s          | $0.0082        |
| 6    | <code>grok/grok-4.7</code>               | $0.0086 | 100.00      | 0.00% | 0.00% | 4.93s           | $0.0086        |
| 7    | <code>anthropic/claude-sonnet-5-5</code> | $0.0116 | 100.00      | 0.00% | 0.00% | 14.05s          | $0.0116        |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0231 | 100.00      | 0.00% | 0.00% | 11.49s          | $0.0231        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0578 | 100.00      | 0.00% | 0.00% | 4.75s           | $0.0578        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-fable-5</code>    | 4.75s  | 100.00      | 0.00% | 0.00% | 4.75s           | $0.0578        |
| 2    | <code>grok/grok-4.7</code>               | 4.93s  | 100.00      | 0.00% | 0.00% | 4.93s           | $0.0086        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | 5.20s  | 93.33       | 6.67% | 2.15% | 5.20s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | 5.60s  | 100.00      | 0.00% | 0.00% | 5.60s           | $0.0024        |
| 5    | <code>anthropic/claude-haiku-5-5</code>  | 8.65s  | 100.00      | 0.00% | 0.00% | 8.65s           | $0.0006        |
| 6    | <code>openai/gpt-6.1-sol</code>          | 10.18s | 100.00      | 0.00% | 0.00% | 10.18s          | $0.0082        |
| 7    | <code>anthropic/claude-opus-5-5</code>   | 11.49s | 100.00      | 0.00% | 0.00% | 11.49s          | $0.0231        |
| 8    | <code>openai/gpt-6-luna</code>           | 13.80s | 100.00      | 0.00% | 0.00% | 13.80s          | $0.0004        |
| 9    | <code>anthropic/claude-sonnet-5-5</code> | 14.05s | 100.00      | 0.00% | 0.00% | 14.05s          | $0.0116        |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-fable-5</code>    | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 4.75s           | $0.0578        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 8.65s           | $0.0006        |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 11.49s          | $0.0231        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 14.05s          | $0.0116        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 5.60s           | $0.0024        |
| 6    | <code>grok/grok-4.7</code>               | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 4.93s           | $0.0086        |
| 7    | <code>openai/gpt-6-luna</code>           | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 13.80s          | $0.0004        |
| 8    | <code>openai/gpt-6.1-sol</code>          | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 10.18s          | $0.0082        |
| 9    | <code>mistral/mistral-ocr-4-1</code>     | 93.33/100 quality score  | 93.33       | 6.67% | 2.15% | 5.20s           | $0.0040        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER     | CER    | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | ------: | -----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 0.00        | 106.67% | 59.14% | 0.84s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 100.00      | 0.00%   | 0.00%  | 4.75s           | $0.0578        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 100.00      | 0.00%   | 0.00%  | 8.65s           | $0.0006        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 100.00      | 0.00%   | 0.00%  | 11.49s          | $0.0231        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 100.00      | 0.00%   | 0.00%  | 14.05s          | $0.0116        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 100.00      | 0.00%   | 0.00%  | 5.60s           | $0.0024        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 100.00      | 0.00%   | 0.00%  | 4.93s           | $0.0086        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 93.33       | 6.67%   | 2.15%  | 5.20s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 100.00      | 0.00%   | 0.00%  | 13.80s          | $0.0004        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 100.00      | 0.00%   | 0.00%  | 10.18s          | $0.0082        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 14            | 0         | 2          | 15         |
| <code>anthropic/claude-fable-5</code>    | 0             | 0         | 0          | 15         |
| <code>anthropic/claude-haiku-5-5</code>  | 0             | 0         | 0          | 15         |
| <code>anthropic/claude-opus-5-5</code>   | 0             | 0         | 0          | 15         |
| <code>anthropic/claude-sonnet-5-5</code> | 0             | 0         | 0          | 15         |
| <code>gemini/gemini-3.8-flash</code>     | 0             | 0         | 0          | 15         |
| <code>grok/grok-4.7</code>               | 0             | 0         | 0          | 15         |
| <code>mistral/mistral-ocr-4-1</code>     | 1             | 0         | 0          | 15         |
| <code>openai/gpt-6-luna</code>           | 0             | 0         | 0          | 15         |
| <code>openai/gpt-6.1-sol</code>          | 0             | 0         | 0          | 15         |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 0.00/100.
- Best cloud service: `anthropic/claude-fable-5` scored 100.00/100.
- The cheapest cloud provider was `openai/gpt-6-luna` at 0.0428¢ ($0.0004).
- Fastest local model: `tesseract/tesseract` at 0.84s.
- Fastest cloud service: `anthropic/claude-fable-5` at 4.75s.

## Lexical evaluation scope

Reference scope: full-page. Exhaustive lexical target for the declared input page/crop; drawing syntax is excluded where the publisher serialization declares it.

Headline WER/CER use the existing case-insensitive lexical normalization and declared reference order. Reading-order or serialization differences can increase edit distance; these scores do not measure layout or exact glyph/punctuation fidelity.

Text-only OCR does not establish cell assignment, row/column mapping, spans or blank-cell geometry. Numeric/text presence is not table-structure accuracy.

Literal numeric, punctuation and whitespace comparisons are representation-fidelity diagnostics. TSV tabs, span-continuation blanks, Markdown wrappers and source case conventions can differ without establishing a recognition error.

[Literal numeric, punctuation and alternate-reading diagnostics](evaluation-diagnostics.json) retain all source and provider text privately.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- Each provider received the same pinned original PNG/JPEG or the declared rendered-PNG baseline variant. Reference text, table cells, manuscript deletions and graph/layout annotations were never sent to providers. Text recognition is scored separately from unavailable cell, branch and page-geometry accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
