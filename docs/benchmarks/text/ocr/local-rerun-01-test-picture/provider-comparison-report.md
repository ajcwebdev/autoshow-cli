# OCR Provider Comparison Report

## Summary

- Run directory: `docs/benchmarks/text/ocr/local-rerun-01-test-picture`
- Total providers: 1 (1 local, 0 third-party service)
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

| Rank | Provider               | Value                     | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | 100.00      | 0.00% | 0.00% | 0.30s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.30s | 100.00      | 0.00% | 0.00% | 0.30s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value                    | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---: | ---------------------- | -----------------------: | ----------: | ----: | ----: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 100.00/100 quality score | 100.00      | 0.00% | 0.00% | 0.30s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost              |
| ---: | -------- | ----: | ----------: | --: | --: | --------------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a         | n/a | n/a | n/a             | No providers in this group. |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost              |
| ---: | -------- | ----: | ----------: | --: | --: | --------------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a         | n/a | n/a | n/a             | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost              |
| ---: | -------- | ----: | ----------: | --: | --: | --------------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a         | n/a | n/a | n/a             | No providers in this group. |


## Provider Detail

| Provider               | Group | Score / 100 | WER   | CER   | Processing Time | Accounted Cost |
| ---------------------- | ----- | ----------: | ----: | ----: | --------------: | -------------: |
| <code>tesseract</code> | Local | 100.00      | 0.00% | 0.00% | 0.30s           | $0.00          |

## Error Breakdown (WER)

| Provider               | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------- | ------------: | --------: | ---------: | ---------: |
| <code>tesseract</code> | 0             | 0         | 0          | 20         |

## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- Best local model: `tesseract/tesseract` scored 100.00/100.
- Fastest local model: `tesseract/tesseract` at 0.30s.

Reference: existing archived multi-provider consensus reused byte for byte; not independent publisher gold. This local rerun adds no new physical source input.
