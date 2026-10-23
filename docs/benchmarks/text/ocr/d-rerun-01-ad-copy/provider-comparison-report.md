# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-category-d-run/benchmark-runs/d-rerun-01-ad-copy`
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
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 25.40       | 74.60% | 68.21% | 0.15s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.15s | 25.40       | 74.60% | 68.21% | 0.15s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 25.40/100 quality score | 25.40       | 74.60% | 68.21% | 0.15s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0002 | 92.06       | 7.94%  | 4.87%  | 1.78s           | $0.0002        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0003 | 92.06       | 7.94%  | 6.67%  | 4.38s           | $0.0003        |
| 3    | <code>openai/gpt-6.1-sol</code>          | $0.0027 | 92.06       | 7.94%  | 5.13%  | 4.02s           | $0.0027        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | $0.0030 | 95.24       | 4.76%  | 2.82%  | 4.43s           | $0.0030        |
| 5    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | 82.54       | 17.46% | 14.36% | 1.70s           | $0.0040        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0051 | 98.41       | 1.59%  | 0.26%  | 2.76s           | $0.0051        |
| 7    | <code>grok/grok-4.7</code>               | $0.0071 | 100.00      | 0.00%  | 0.00%  | 5.94s           | $0.0071        |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0101 | 98.41       | 1.59%  | 0.26%  | 3.30s           | $0.0101        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0260 | 88.89       | 11.11% | 7.44%  | 4.48s           | $0.0260        |

#### Speed

| Rank | Provider                                 | Value | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ----: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 1.70s | 82.54       | 17.46% | 14.36% | 1.70s           | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 1.78s | 92.06       | 7.94%  | 4.87%  | 1.78s           | $0.0002        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 2.76s | 98.41       | 1.59%  | 0.26%  | 2.76s           | $0.0051        |
| 4    | <code>anthropic/claude-opus-5-5</code>   | 3.30s | 98.41       | 1.59%  | 0.26%  | 3.30s           | $0.0101        |
| 5    | <code>openai/gpt-6.1-sol</code>          | 4.02s | 92.06       | 7.94%  | 5.13%  | 4.02s           | $0.0027        |
| 6    | <code>openai/gpt-6-luna</code>           | 4.38s | 92.06       | 7.94%  | 6.67%  | 4.38s           | $0.0003        |
| 7    | <code>gemini/gemini-3.8-flash</code>     | 4.43s | 95.24       | 4.76%  | 2.82%  | 4.43s           | $0.0030        |
| 8    | <code>anthropic/claude-fable-5</code>    | 4.48s | 88.89       | 11.11% | 7.44%  | 4.48s           | $0.0260        |
| 9    | <code>grok/grok-4.7</code>               | 5.94s | 100.00      | 0.00%  | 0.00%  | 5.94s           | $0.0071        |

#### Quality Score

| Rank | Provider                                 | Value                    | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | -----------------------: | ----------: | -----: | -----: | --------------: | -------------: |
| 1    | <code>grok/grok-4.7</code>               | 100.00/100 quality score | 100.00      | 0.00%  | 0.00%  | 5.94s           | $0.0071        |
| 2    | <code>anthropic/claude-opus-5-5</code>   | 98.41/100 quality score  | 98.41       | 1.59%  | 0.26%  | 3.30s           | $0.0101        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 98.41/100 quality score  | 98.41       | 1.59%  | 0.26%  | 2.76s           | $0.0051        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | 95.24/100 quality score  | 95.24       | 4.76%  | 2.82%  | 4.43s           | $0.0030        |
| 5    | <code>anthropic/claude-haiku-5-5</code>  | 92.06/100 quality score  | 92.06       | 7.94%  | 4.87%  | 1.78s           | $0.0002        |
| 6    | <code>openai/gpt-6.1-sol</code>          | 92.06/100 quality score  | 92.06       | 7.94%  | 5.13%  | 4.02s           | $0.0027        |
| 7    | <code>openai/gpt-6-luna</code>           | 92.06/100 quality score  | 92.06       | 7.94%  | 6.67%  | 4.38s           | $0.0003        |
| 8    | <code>anthropic/claude-fable-5</code>    | 88.89/100 quality score  | 88.89       | 11.11% | 7.44%  | 4.48s           | $0.0260        |
| 9    | <code>mistral/mistral-ocr-4-1</code>     | 82.54/100 quality score  | 82.54       | 17.46% | 14.36% | 1.70s           | $0.0040        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER    | CER    | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | -----: | -----: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | 25.40       | 74.60% | 68.21% | 0.15s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | 88.89       | 11.11% | 7.44%  | 4.48s           | $0.0260        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | 92.06       | 7.94%  | 4.87%  | 1.78s           | $0.0002        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | 98.41       | 1.59%  | 0.26%  | 3.30s           | $0.0101        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | 98.41       | 1.59%  | 0.26%  | 2.76s           | $0.0051        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | 95.24       | 4.76%  | 2.82%  | 4.43s           | $0.0030        |
| <code>grok/grok-4.7</code>               | Third-Party Service | 100.00      | 0.00%  | 0.00%  | 5.94s           | $0.0071        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | 82.54       | 17.46% | 14.36% | 1.70s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | 92.06       | 7.94%  | 6.67%  | 4.38s           | $0.0003        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | 92.06       | 7.94%  | 5.13%  | 4.02s           | $0.0027        |

## Error Breakdown (WER)

| Provider                                 | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code>                   | 12            | 35        | 0          | 63         |
| <code>anthropic/claude-fable-5</code>    | 1             | 3         | 3          | 63         |
| <code>anthropic/claude-haiku-5-5</code>  | 1             | 2         | 2          | 63         |
| <code>anthropic/claude-opus-5-5</code>   | 1             | 0         | 0          | 63         |
| <code>anthropic/claude-sonnet-5-5</code> | 1             | 0         | 0          | 63         |
| <code>gemini/gemini-3.8-flash</code>     | 1             | 1         | 1          | 63         |
| <code>grok/grok-4.7</code>               | 0             | 0         | 0          | 63         |
| <code>mistral/mistral-ocr-4-1</code>     | 6             | 4         | 1          | 63         |
| <code>openai/gpt-6-luna</code>           | 0             | 3         | 2          | 63         |
| <code>openai/gpt-6.1-sol</code>          | 1             | 2         | 2          | 63         |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 25.40/100.
- Best cloud service: `grok/grok-4.7` scored 100.00/100.
- The cheapest cloud provider was `anthropic/claude-haiku-5-5` at 0.0248¢ ($0.0002).
- Fastest local model: `tesseract/tesseract` at 0.15s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.70s.

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: the existing archived multi-provider consensus is reused byte for byte; it is not independent publisher gold.
- Every provider received the same full original JPEG. No gold words or annotation coordinates were sent to providers. Text-only outputs do not establish word-region localization or full-image exhaustive accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Supplemental evaluation-diagnostics.json retains punctuation/case/formatting diagnostics separately from lexical-normalized headline WER.
