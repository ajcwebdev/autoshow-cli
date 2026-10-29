# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/efg-rerun-01-financial-data`
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
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 49.13       | 50.87% | 35.58% | 0.45s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.45s | 49.13       | 50.87% | 35.58% | 0.45s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 49.13/100 quality score | 49.13       | 50.87% | 35.58% | 0.45s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0011 | 32.56       | 67.44% | 46.25% | 6.79s           | $0.0011        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0011 | 98.26       | 1.74%  | 0.58%  | 19.42s          | $0.0011        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 92.15       | 7.85%  | 6.75%  | 2.99s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0085 | 99.13       | 0.87%  | 0.17%  | 8.58s           | $0.0085        |
| 5    | <code>anthropic/claude-sonnet-5-5</code> | $0.0113 | 99.42       | 0.58%  | 0.17%  | 6.44s           | $0.0113        |
| 6    | <code>openai/gpt-6.1-sol</code>          | $0.0172 | 99.13       | 0.87%  | 0.25%  | 27.48s          | $0.0172        |
| 7    | <code>anthropic/claude-opus-5-5</code>   | $0.0225 | 100.00      | 0.00%  | 0.00%  | 7.20s           | $0.0225        |
| 8    | <code>anthropic/claude-fable-5</code>    | $0.0580 | 97.09       | 2.91%  | 2.83%  | 13.35s          | $0.0580        |
| 9    | <code>grok/grok-4.7</code>               | $0.0807 | 98.84       | 1.16%  | 0.58%  | 123.82s         | $0.0807        |

#### Speed

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 2.99s   | 92.15       | 7.85%  | 6.75%  | 2.99s           | $0.0040        |
| 2    | <code>anthropic/claude-sonnet-5-5</code> | 6.44s   | 99.42       | 0.58%  | 0.17%  | 6.44s           | $0.0113        |
| 3    | <code>anthropic/claude-haiku-5-5</code>  | 6.79s   | 32.56       | 67.44% | 46.25% | 6.79s           | $0.0011        |
| 4    | <code>anthropic/claude-opus-5-5</code>   | 7.20s   | 100.00      | 0.00%  | 0.00%  | 7.20s           | $0.0225        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 8.58s   | 99.13       | 0.87%  | 0.17%  | 8.58s           | $0.0085        |
| 6    | <code>anthropic/claude-fable-5</code>    | 13.35s  | 97.09       | 2.91%  | 2.83%  | 13.35s          | $0.0580        |
| 7    | <code>openai/gpt-6-luna</code>           | 19.42s  | 98.26       | 1.74%  | 0.58%  | 19.42s          | $0.0011        |
| 8    | <code>openai/gpt-6.1-sol</code>          | 27.48s  | 99.13       | 0.87%  | 0.25%  | 27.48s          | $0.0172        |
| 9    | <code>grok/grok-4.7</code>               | 123.82s | 98.84       | 1.16%  | 0.58%  | 123.82s         | $0.0807        |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-opus-5-5</code>   | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 7.20s           | $0.0225        |
| 2    | <code>anthropic/claude-sonnet-5-5</code> | 99.42/100 quality score  | 99.42       | 0.58%  | 0.17%  | 6.44s           | $0.0113        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | 99.13/100 quality score  | 99.13       | 0.87%  | 0.17%  | 8.58s           | $0.0085        |
| 4    | <code>openai/gpt-6.1-sol</code>          | 99.13/100 quality score  | 99.13       | 0.87%  | 0.25%  | 27.48s          | $0.0172        |
| 5    | <code>grok/grok-4.7</code>               | 98.84/100 quality score  | 98.84       | 1.16%  | 0.58%  | 123.82s         | $0.0807        |
| 6    | <code>openai/gpt-6-luna</code>           | 98.26/100 quality score  | 98.26       | 1.74%  | 0.58%  | 19.42s          | $0.0011        |
| 7    | <code>anthropic/claude-fable-5</code>    | 97.09/100 quality score  | 97.09       | 2.91%  | 2.83%  | 13.35s          | $0.0580        |
| 8    | <code>mistral/mistral-ocr-4-1</code>     | 92.15/100 quality score  | 92.15       | 7.85%  | 6.75%  | 2.99s           | $0.0040        |
| 9    | <code>anthropic/claude-haiku-5-5</code>  | 32.56/100 quality score  | 32.56       | 67.44% | 46.25% | 6.79s           | $0.0011        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | -----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 49.13       | 50.87% | 35.58% | 0.45s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 97.09       | 2.91%  | 2.83%  | 13.35s          | $0.0580        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 32.56       | 67.44% | 46.25% | 6.79s           | $0.0011        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 7.20s           | $0.0225        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 99.42       | 0.58%  | 0.17%  | 6.44s           | $0.0113        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 99.13       | 0.87%  | 0.17%  | 8.58s           | $0.0085        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 98.84       | 1.16%  | 0.58%  | 123.82s         | $0.0807        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 92.15       | 7.85%  | 6.75%  | 2.99s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 98.26       | 1.74%  | 0.58%  | 19.42s          | $0.0011        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 99.13       | 0.87%  | 0.25%  | 27.48s          | $0.0172        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 102           | 69        | 4          | 344        |
| <code>anthropic/claude-fable-5</code>    | 0             | 0         | 10         | 344        |
| <code>anthropic/claude-haiku-5-5</code>  | 128           | 52        | 52         | 344        |
| <code>anthropic/claude-opus-5-5</code>   | 0             | 0         | 0          | 344        |
| <code>anthropic/claude-sonnet-5-5</code> | 2             | 0         | 0          | 344        |
| <code>gemini/gemini-3.8-flash</code>     | 2             | 0         | 1          | 344        |
| <code>grok/grok-4.7</code>               | 3             | 0         | 1          | 344        |
| <code>mistral/mistral-ocr-4-1</code>     | 5             | 0         | 22         | 344        |
| <code>openai/gpt-6-luna</code>           | 6             | 0         | 0          | 344        |
| <code>openai/gpt-6.1-sol</code>          | 3             | 0         | 0          | 344        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 49.13/100.
- Best cloud service: `anthropic/claude-opus-5-5` scored 100.00/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.1061¢ ($0.0011).
- Fastest local model: `tesseract/tesseract` at 0.45s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 2.99s.

## Lexical evaluation scope

Reference scope: full-page. Existing archived multi-provider consensus; not independent publisher gold.

Headline WER/CER use the existing case-insensitive lexical normalization and declared reference order. Reading-order or serialization differences can increase edit distance; these scores do not measure layout or exact glyph/punctuation fidelity.

Text-only OCR does not establish cell assignment, row/column mapping, spans or blank-cell geometry. Numeric/text presence is not table-structure accuracy.

Literal numeric, punctuation and whitespace comparisons are representation-fidelity diagnostics. TSV tabs, span-continuation blanks, Markdown wrappers and source case conventions can differ without establishing a recognition error.

[Literal numeric, punctuation and alternate-reading diagnostics](evaluation-diagnostics.json) retain all source and provider text privately.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: the existing archived multi-provider consensus is reused byte for byte; it is not independent publisher gold.
- Each provider received the same pinned original PNG/JPEG or the declared rendered-PNG baseline variant. Reference text, table cells, manuscript deletions and graph/layout annotations were never sent to providers. Text recognition is scored separately from unavailable cell, branch and page-geometry accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
