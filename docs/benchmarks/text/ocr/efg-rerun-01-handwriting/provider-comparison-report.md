# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-categories-efg-run/benchmark-runs/efg-rerun-01-handwriting`
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
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 8.37        | 91.63% | 88.91% | 0.21s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.21s | 8.37        | 91.63% | 88.91% | 0.21s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                  | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ---------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 8.37/100 quality score | 8.37        | 91.63% | 88.91% | 0.21s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0008 | 87.19       | 12.81% | 4.85%  | 5.31s           | $0.0008        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0008 | 68.47       | 31.53% | 14.56% | 14.25s          | $0.0008        |
| 3    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 85.71       | 14.29% | 5.72%  | 2.49s           | $0.0040        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0069 | 81.28       | 18.72% | 4.33%  | 6.12s           | $0.0069        |
| 5    | <code>anthropic/claude-sonnet-5-5</code> | $0.0084 | 79.80       | 20.20% | 5.37%  | 4.40s           | $0.0084        |
| 6    | <code>anthropic/claude-opus-5-5</code>   | $0.0145 | 87.68       | 12.32% | 3.99%  | 4.22s           | $0.0145        |
| 7    | <code>openai/gpt-6.1-sol</code>          | $0.0150 | 82.27       | 17.73% | 6.24%  | 24.85s          | $0.0150        |
| 8    | <code>anthropic/claude-fable-5</code>    | $0.0451 | 88.67       | 11.33% | 2.77%  | 9.33s           | $0.0451        |
| 9    | <code>grok/grok-4.7</code>               | $0.0633 | 85.71       | 14.29% | 6.41%  | 101.47s         | $0.0633        |

#### Speed

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 2.49s   | 85.71       | 14.29% | 5.72%  | 2.49s           | $0.0040        |
| 2    | <code>anthropic/claude-opus-5-5</code>   | 4.22s   | 87.68       | 12.32% | 3.99%  | 4.22s           | $0.0145        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 4.40s   | 79.80       | 20.20% | 5.37%  | 4.40s           | $0.0084        |
| 4    | <code>anthropic/claude-haiku-5-5</code>  | 5.31s   | 87.19       | 12.81% | 4.85%  | 5.31s           | $0.0008        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | 6.12s   | 81.28       | 18.72% | 4.33%  | 6.12s           | $0.0069        |
| 6    | <code>anthropic/claude-fable-5</code>    | 9.33s   | 88.67       | 11.33% | 2.77%  | 9.33s           | $0.0451        |
| 7    | <code>openai/gpt-6-luna</code>           | 14.25s  | 68.47       | 31.53% | 14.56% | 14.25s          | $0.0008        |
| 8    | <code>openai/gpt-6.1-sol</code>          | 24.85s  | 82.27       | 17.73% | 6.24%  | 24.85s          | $0.0150        |
| 9    | <code>grok/grok-4.7</code>               | 101.47s | 85.71       | 14.29% | 6.41%  | 101.47s         | $0.0633        |

#### Quality Score

| Rank | Provider                                 | Value                   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-fable-5</code>    | 88.67/100 quality score | 88.67       | 11.33% | 2.77%  | 9.33s           | $0.0451        |
| 2    | <code>anthropic/claude-opus-5-5</code>   | 87.68/100 quality score | 87.68       | 12.32% | 3.99%  | 4.22s           | $0.0145        |
| 3    | <code>anthropic/claude-haiku-5-5</code>  | 87.19/100 quality score | 87.19       | 12.81% | 4.85%  | 5.31s           | $0.0008        |
| 4    | <code>mistral/mistral-ocr-4-1</code>     | 85.71/100 quality score | 85.71       | 14.29% | 5.72%  | 2.49s           | $0.0040        |
| 5    | <code>grok/grok-4.7</code>               | 85.71/100 quality score | 85.71       | 14.29% | 6.41%  | 101.47s         | $0.0633        |
| 6    | <code>openai/gpt-6.1-sol</code>          | 82.27/100 quality score | 82.27       | 17.73% | 6.24%  | 24.85s          | $0.0150        |
| 7    | <code>gemini/gemini-3.8-flash</code>     | 81.28/100 quality score | 81.28       | 18.72% | 4.33%  | 6.12s           | $0.0069        |
| 8    | <code>anthropic/claude-sonnet-5-5</code> | 79.80/100 quality score | 79.80       | 20.20% | 5.37%  | 4.40s           | $0.0084        |
| 9    | <code>openai/gpt-6-luna</code>           | 68.47/100 quality score | 68.47       | 31.53% | 14.56% | 14.25s          | $0.0008        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | -----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 8.37        | 91.63% | 88.91% | 0.21s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 88.67       | 11.33% | 2.77%  | 9.33s           | $0.0451        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 87.19       | 12.81% | 4.85%  | 5.31s           | $0.0008        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 87.68       | 12.32% | 3.99%  | 4.22s           | $0.0145        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 79.80       | 20.20% | 5.37%  | 4.40s           | $0.0084        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 81.28       | 18.72% | 4.33%  | 6.12s           | $0.0069        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 85.71       | 14.29% | 6.41%  | 101.47s         | $0.0633        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 85.71       | 14.29% | 5.72%  | 2.49s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 68.47       | 31.53% | 14.56% | 14.25s          | $0.0008        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 82.27       | 17.73% | 6.24%  | 24.85s          | $0.0150        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 15            | 171       | 0          | 203        |
| <code>anthropic/claude-fable-5</code>    | 15            | 6         | 2          | 203        |
| <code>anthropic/claude-haiku-5-5</code>  | 20            | 3         | 3          | 203        |
| <code>anthropic/claude-opus-5-5</code>   | 17            | 6         | 2          | 203        |
| <code>anthropic/claude-sonnet-5-5</code> | 24            | 4         | 13         | 203        |
| <code>gemini/gemini-3.8-flash</code>     | 23            | 0         | 15         | 203        |
| <code>grok/grok-4.7</code>               | 23            | 5         | 1          | 203        |
| <code>mistral/mistral-ocr-4-1</code>     | 22            | 1         | 6          | 203        |
| <code>openai/gpt-6-luna</code>           | 37            | 16        | 11         | 203        |
| <code>openai/gpt-6.1-sol</code>          | 29            | 3         | 4          | 203        |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 8.37/100.
- Best cloud service: `anthropic/claude-fable-5` scored 88.67/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.0772¢ ($0.0008).
- Fastest local model: `tesseract/tesseract` at 0.21s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 2.49s.

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
