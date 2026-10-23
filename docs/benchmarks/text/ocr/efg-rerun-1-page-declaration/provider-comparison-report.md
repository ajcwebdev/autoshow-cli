# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/efg-rerun-1-page-declaration`
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 14.55       | 85.45% | 45.95% | 8.55s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 8.55s | 14.55       | 85.45% | 45.95% | 8.55s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 14.55/100 quality score | 14.55       | 85.45% | 45.95% | 8.55s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>openai/gpt-6-luna</code>           | $0.0019 | 94.33       | 5.67%  | 4.85%  | 37.06s          | $0.0019        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | $0.0034 | 95.15       | 4.85%  | 3.87%  | 20.55s          | $0.0034        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 75.00       | 25.00% | 22.75% | 11.02s          | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0165 | 99.93       | 0.07%  | 0.06%  | 28.03s          | $0.0165        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0275 | 99.86       | 0.14%  | 0.02%  | 47.13s          | $0.0275        |
| 6    | <code>grok/grok-4.7</code>               | $0.0350 | 99.73       | 0.27%  | 0.30%  | 45.87s          | $0.0350        |
| 7    | <code>anthropic/claude-sonnet-5-5</code> | $0.0420 | 98.63       | 1.37%  | 0.43%  | 20.67s          | $0.0420        |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0842 | 99.25       | 0.75%  | 0.40%  | 24.19s          | $0.0842        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.2124 | 99.86       | 0.14%  | 0.02%  | 42.72s          | $0.2124        |

#### Speed

| Rank | Provider                                 | Value  | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 11.02s | 75.00       | 25.00% | 22.75% | 11.02s          | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 20.55s | 95.15       | 4.85%  | 3.87%  | 20.55s          | $0.0034        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 20.67s | 98.63       | 1.37%  | 0.43%  | 20.67s          | $0.0420        |
| 4    | <code>anthropic/claude-opus-5-5</code>   | 24.19s | 99.25       | 0.75%  | 0.40%  | 24.19s          | $0.0842        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 28.03s | 99.93       | 0.07%  | 0.06%  | 28.03s          | $0.0165        |
| 6    | <code>openai/gpt-6-luna</code>           | 37.06s | 94.33       | 5.67%  | 4.85%  | 37.06s          | $0.0019        |
| 7    | <code>anthropic/claude-fable-5</code>    | 42.72s | 99.86       | 0.14%  | 0.02%  | 42.72s          | $0.2124        |
| 8    | <code>grok/grok-4.7</code>               | 45.87s | 99.73       | 0.27%  | 0.30%  | 45.87s          | $0.0350        |
| 9    | <code>openai/gpt-6.1-sol</code>          | 47.13s | 99.86       | 0.14%  | 0.02%  | 47.13s          | $0.0275        |

#### Quality Score

| Rank | Provider                                 | Value                   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>gemini/gemini-3.8-flash</code>     | 99.93/100 quality score | 99.93       | 0.07%  | 0.06%  | 28.03s          | $0.0165        |
| 2    | <code>anthropic/claude-fable-5</code>    | 99.86/100 quality score | 99.86       | 0.14%  | 0.02%  | 42.72s          | $0.2124        |
| 3    | <code>openai/gpt-6.1-sol</code>          | 99.86/100 quality score | 99.86       | 0.14%  | 0.02%  | 47.13s          | $0.0275        |
| 4    | <code>grok/grok-4.7</code>               | 99.73/100 quality score | 99.73       | 0.27%  | 0.30%  | 45.87s          | $0.0350        |
| 5    | <code>anthropic/claude-opus-5-5</code>   | 99.25/100 quality score | 99.25       | 0.75%  | 0.40%  | 24.19s          | $0.0842        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | 98.63/100 quality score | 98.63       | 1.37%  | 0.43%  | 20.67s          | $0.0420        |
| 7    | <code>anthropic/claude-haiku-5-5</code>  | 95.15/100 quality score | 95.15       | 4.85%  | 3.87%  | 20.55s          | $0.0034        |
| 8    | <code>openai/gpt-6-luna</code>           | 94.33/100 quality score | 94.33       | 5.67%  | 4.85%  | 37.06s          | $0.0019        |
| 9    | <code>mistral/mistral-ocr-4-1</code>     | 75.00/100 quality score | 75.00       | 25.00% | 22.75% | 11.02s          | $0.0040        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | -----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 14.55       | 85.45% | 45.95% | 8.55s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 99.86       | 0.14%  | 0.02%  | 42.72s          | $0.2124        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 95.15       | 4.85%  | 3.87%  | 20.55s          | $0.0034        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 99.25       | 0.75%  | 0.40%  | 24.19s          | $0.0842        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 98.63       | 1.37%  | 0.43%  | 20.67s          | $0.0420        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 99.93       | 0.07%  | 0.06%  | 28.03s          | $0.0165        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 99.73       | 0.27%  | 0.30%  | 45.87s          | $0.0350        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 75.00       | 25.00% | 22.75% | 11.02s          | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 94.33       | 5.67%  | 4.85%  | 37.06s          | $0.0019        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 99.86       | 0.14%  | 0.02%  | 47.13s          | $0.0275        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 1035          | 196       | 20         | 1464       |
| <code>anthropic/claude-fable-5</code>    | 2             | 0         | 0          | 1464       |
| <code>anthropic/claude-haiku-5-5</code>  | 70            | 1         | 0          | 1464       |
| <code>anthropic/claude-opus-5-5</code>   | 6             | 2         | 3          | 1464       |
| <code>anthropic/claude-sonnet-5-5</code> | 11            | 2         | 7          | 1464       |
| <code>gemini/gemini-3.8-flash</code>     | 0             | 1         | 0          | 1464       |
| <code>grok/grok-4.7</code>               | 0             | 2         | 2          | 1464       |
| <code>mistral/mistral-ocr-4-1</code>     | 77            | 285       | 4          | 1464       |
| <code>openai/gpt-6-luna</code>           | 44            | 19        | 20         | 1464       |
| <code>openai/gpt-6.1-sol</code>          | 2             | 0         | 0          | 1464       |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 14.55/100.
- Best cloud service: `gemini/gemini-3.8-flash` scored 99.93/100.
- The cheapest cloud provider was `openai/gpt-6-luna` at 0.1947¢ ($0.0019).
- Fastest local model: `tesseract/tesseract` at 8.55s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 11.02s.

## Lexical evaluation scope

Reference scope: full-page. Existing archived multi-provider consensus; not independent publisher gold.

Headline WER/CER use the existing case-insensitive lexical normalization and declared reference order. Reading-order or serialization differences can increase edit distance; these scores do not measure layout or exact glyph/punctuation fidelity.

Text-only OCR does not establish handwriting placement, drawing geometry or spatial association.

Literal numeric, punctuation and whitespace comparisons are representation-fidelity diagnostics. TSV tabs, span-continuation blanks, Markdown wrappers and source case conventions can differ without establishing a recognition error.

[Literal numeric, punctuation and alternate-reading diagnostics](evaluation-diagnostics.json) retain all source and provider text privately.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: the existing archived multi-provider consensus is reused byte for byte; it is not independent publisher gold.
- Each provider received the same pinned original PNG/JPEG or the declared rendered-PNG baseline variant. Reference text, table cells, manuscript deletions and graph/layout annotations were never sent to providers. Text recognition is scored separately from unavailable cell, branch and page-geometry accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
