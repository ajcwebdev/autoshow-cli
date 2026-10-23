# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-newspaper-expansion/benchmark-runs/newspapers-expansion-bln-era-burglars`
- Publisher canonical reference: `normalized-reference.txt`.
- Ranking metric: word error rate (WER) against the independent publisher canonical reference.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- The independently supplied publisher text is the immutable gold reference; provider agreement did not determine this text.
- Reference SHA-256: `87a9802ff3ef8c81c2001f71d27f67c1101369279b02c82da0c87eeda296710f`.
- Publisher source: https://ndownloader.figshare.com/files/49365928#Ground%20Truth%2F3202448316.txt (revision `10.15131/shef.data.25439023.v2`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 94.51       | 5.49% | 1.05% | 0.67s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.67s | 94.51       | 5.49% | 1.05% | 0.67s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 94.51/100 quality score | 94.51       | 5.49% | 1.05% | 0.67s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>openai/gpt-6-luna</code>           | $0.0007 | 99.42       | 0.58% | 0.05% | 14.30s          | $0.0007        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | $0.0009 | 99.42       | 0.58% | 0.05% | 5.72s           | $0.0009        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 99.42       | 0.58% | 0.05% | 1.34s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0055 | 99.42       | 0.58% | 0.05% | 5.39s           | $0.0055        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0068 | 99.42       | 0.58% | 0.05% | 7.90s           | $0.0068        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0100 | 99.42       | 0.58% | 0.05% | 6.38s           | $0.0100        |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.0198 | 99.42       | 0.58% | 0.05% | 6.18s           | $0.0198        |
| 8    | <code>grok/grok-4.7</code>               | $0.0220 | 99.42       | 0.58% | 0.05% | 22.41s          | $0.0220        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0534 | 99.42       | 0.58% | 0.05% | 11.83s          | $0.0534        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 1.34s  | 99.42       | 0.58% | 0.05% | 1.34s           | $0.0040        |
| 2    | <code>gemini/gemini-3.8-flash</code>     | 5.39s  | 99.42       | 0.58% | 0.05% | 5.39s           | $0.0055        |
| 3    | <code>anthropic/claude-haiku-5-5</code>  | 5.72s  | 99.42       | 0.58% | 0.05% | 5.72s           | $0.0009        |
| 4    | <code>anthropic/claude-opus-5-5</code>   | 6.18s  | 99.42       | 0.58% | 0.05% | 6.18s           | $0.0198        |
| 5    | <code>anthropic/claude-sonnet-5-5</code> | 6.38s  | 99.42       | 0.58% | 0.05% | 6.38s           | $0.0100        |
| 6    | <code>openai/gpt-6.1-sol</code>          | 7.90s  | 99.42       | 0.58% | 0.05% | 7.90s           | $0.0068        |
| 7    | <code>anthropic/claude-fable-5</code>    | 11.83s | 99.42       | 0.58% | 0.05% | 11.83s          | $0.0534        |
| 8    | <code>openai/gpt-6-luna</code>           | 14.30s | 99.42       | 0.58% | 0.05% | 14.30s          | $0.0007        |
| 9    | <code>grok/grok-4.7</code>               | 22.41s | 99.42       | 0.58% | 0.05% | 22.41s          | $0.0220        |

#### Quality Score

| Rank | Provider                                 | Value                   | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-fable-5</code>    | 99.42/100 quality score | 99.42       | 0.58% | 0.05% | 11.83s          | $0.0534        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 99.42/100 quality score | 99.42       | 0.58% | 0.05% | 5.72s           | $0.0009        |
| 3    | <code>anthropic/claude-opus-5-5</code>   | 99.42/100 quality score | 99.42       | 0.58% | 0.05% | 6.18s           | $0.0198        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | 99.42/100 quality score | 99.42       | 0.58% | 0.05% | 6.38s           | $0.0100        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 99.42/100 quality score | 99.42       | 0.58% | 0.05% | 5.39s           | $0.0055        |
| 6    | <code>grok/grok-4.7</code>               | 99.42/100 quality score | 99.42       | 0.58% | 0.05% | 22.41s          | $0.0220        |
| 7    | <code>mistral/mistral-ocr-4-1</code>     | 99.42/100 quality score | 99.42       | 0.58% | 0.05% | 1.34s           | $0.0040        |
| 8    | <code>openai/gpt-6-luna</code>           | 99.42/100 quality score | 99.42       | 0.58% | 0.05% | 14.30s          | $0.0007        |
| 9    | <code>openai/gpt-6.1-sol</code>          | 99.42/100 quality score | 99.42       | 0.58% | 0.05% | 7.90s           | $0.0068        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | ----: | ----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 94.51       | 5.49% | 1.05% | 0.67s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 99.42       | 0.58% | 0.05% | 11.83s          | $0.0534        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 99.42       | 0.58% | 0.05% | 5.72s           | $0.0009        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 99.42       | 0.58% | 0.05% | 6.18s           | $0.0198        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 99.42       | 0.58% | 0.05% | 6.38s           | $0.0100        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 99.42       | 0.58% | 0.05% | 5.39s           | $0.0055        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 99.42       | 0.58% | 0.05% | 22.41s          | $0.0220        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 99.42       | 0.58% | 0.05% | 1.34s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 99.42       | 0.58% | 0.05% | 14.30s          | $0.0007        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 99.42       | 0.58% | 0.05% | 7.90s           | $0.0068        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 18            | 0         | 1          | 346        |
| <code>anthropic/claude-fable-5</code>    | 1             | 0         | 1          | 346        |
| <code>anthropic/claude-haiku-5-5</code>  | 1             | 0         | 1          | 346        |
| <code>anthropic/claude-opus-5-5</code>   | 1             | 0         | 1          | 346        |
| <code>anthropic/claude-sonnet-5-5</code> | 1             | 0         | 1          | 346        |
| <code>gemini/gemini-3.8-flash</code>     | 1             | 0         | 1          | 346        |
| <code>grok/grok-4.7</code>               | 1             | 0         | 1          | 346        |
| <code>mistral/mistral-ocr-4-1</code>     | 1             | 0         | 1          | 346        |
| <code>openai/gpt-6-luna</code>           | 1             | 0         | 1          | 346        |
| <code>openai/gpt-6.1-sol</code>          | 1             | 0         | 1          | 346        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 94.51/100.
- Best cloud service: `anthropic/claude-fable-5` scored 99.42/100.
- The cheapest cloud provider was `openai/gpt-6-luna` at 0.0730¢ ($0.0007).
- Fastest local model: `tesseract/tesseract` at 0.67s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.34s.

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
