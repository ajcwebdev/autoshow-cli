# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-category-d-run/benchmark-runs/advertisement-newtown-cruise`
- Publisher canonical reference: `canonical-reference.txt`.
- Primary region accuracy: unavailable. Primary word-region recognition/localization accuracy is unavailable: outputs contain text without coordinates, and the publisher annotations are not an exhaustive full-image transcription. Text presence can match incidental duplicates outside annotated regions.
- Total providers: 10 (1 local, 9 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Annotated-token coverage and ordered-reference WER/CER are secondary diagnostics; they are not primary accuracy scores.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- Publisher word-region text is independently supplied. Its reviewed order is a derived convention, and it is not exhaustive full-image gold.
- Reference SHA-256: `f447190860b6b502b6d54d1087f6a1f8e95386c921b970b7fe883aaf7b28b3be`.
- Publisher source: https://dl.fbaipublicfiles.com/textvqa/data/textocr/TextOCR_0.1_train.json (revision `v0.1; annotation S3 version nOSHBYLvXX4J7TUWv5Esml0IYeU3I3az`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Primary Quality Score values are unavailable for this partial-reference/text-only protocol; price and speed remain measurable.

## Metric Rankings

### Local

#### Price

| Rank | Provider               | Value                     | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | ---------------------- | ------------------------: | ----------: | --: | --: | --------------: | -------------: |
| 1    | <code>tesseract</code> | $0.00 local monetary cost | n/a         | n/a | n/a | 0.22s           | $0.00          |

#### Speed

| Rank | Provider               | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | --: | --: | --------------: | -------------: |
| 1    | <code>tesseract</code> | 0.22s | n/a         | n/a | n/a | 0.22s           | $0.00          |

#### Quality Score

| Rank | Provider               | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | ---------------------- | ----: | ----------: | --: | --: | --------------: | -------------: |
| 1    | <code>tesseract</code> | n/a   | n/a         | n/a | n/a | 0.22s           | $0.00          |

### Third-Party Service

#### Price

| Rank | Provider                                 | Value   | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ------: | ----------: | --: | --: | --------------: | -------------: |
| 1    | <code>anthropic/claude-haiku-5-5</code>  | $0.0003 | n/a         | n/a | n/a | 2.58s           | $0.0003        |
| 2    | <code>openai/gpt-6-luna</code>           | $0.0003 | n/a         | n/a | n/a | 5.92s           | $0.0003        |
| 3    | <code>gemini/gemini-3.8-flash</code>     | $0.0030 | n/a         | n/a | n/a | 3.03s           | $0.0030        |
| 4    | <code>mistral/mistral-ocr-4-1</code>     | $0.0040 | n/a         | n/a | n/a | 2.48s           | $0.0040        |
| 5    | <code>openai/gpt-6.1-sol</code>          | $0.0041 | n/a         | n/a | n/a | 5.58s           | $0.0041        |
| 6    | <code>anthropic/claude-sonnet-5-5</code> | $0.0059 | n/a         | n/a | n/a | 2.99s           | $0.0059        |
| 7    | <code>grok/grok-4.7</code>               | $0.0078 | n/a         | n/a | n/a | 6.00s           | $0.0078        |
| 8    | <code>anthropic/claude-opus-5-5</code>   | $0.0120 | n/a         | n/a | n/a | 3.31s           | $0.0120        |
| 9    | <code>anthropic/claude-fable-5</code>    | $0.0292 | n/a         | n/a | n/a | 5.14s           | $0.0292        |

#### Speed

| Rank | Provider                                 | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ----: | ----------: | --: | --: | --------------: | -------------: |
| 1    | <code>mistral/mistral-ocr-4-1</code>     | 2.48s | n/a         | n/a | n/a | 2.48s           | $0.0040        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | 2.58s | n/a         | n/a | n/a | 2.58s           | $0.0003        |
| 3    | <code>anthropic/claude-sonnet-5-5</code> | 2.99s | n/a         | n/a | n/a | 2.99s           | $0.0059        |
| 4    | <code>gemini/gemini-3.8-flash</code>     | 3.03s | n/a         | n/a | n/a | 3.03s           | $0.0030        |
| 5    | <code>anthropic/claude-opus-5-5</code>   | 3.31s | n/a         | n/a | n/a | 3.31s           | $0.0120        |
| 6    | <code>anthropic/claude-fable-5</code>    | 5.14s | n/a         | n/a | n/a | 5.14s           | $0.0292        |
| 7    | <code>openai/gpt-6.1-sol</code>          | 5.58s | n/a         | n/a | n/a | 5.58s           | $0.0041        |
| 8    | <code>openai/gpt-6-luna</code>           | 5.92s | n/a         | n/a | n/a | 5.92s           | $0.0003        |
| 9    | <code>grok/grok-4.7</code>               | 6.00s | n/a         | n/a | n/a | 6.00s           | $0.0078        |

#### Quality Score

| Rank | Provider                                 | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | ---------------------------------------- | ----: | ----------: | --: | --: | --------------: | -------------: |
| 1    | <code>anthropic/claude-fable-5</code>    | n/a   | n/a         | n/a | n/a | 5.14s           | $0.0292        |
| 2    | <code>anthropic/claude-haiku-5-5</code>  | n/a   | n/a         | n/a | n/a | 2.58s           | $0.0003        |
| 3    | <code>anthropic/claude-opus-5-5</code>   | n/a   | n/a         | n/a | n/a | 3.31s           | $0.0120        |
| 4    | <code>anthropic/claude-sonnet-5-5</code> | n/a   | n/a         | n/a | n/a | 2.99s           | $0.0059        |
| 5    | <code>gemini/gemini-3.8-flash</code>     | n/a   | n/a         | n/a | n/a | 3.03s           | $0.0030        |
| 6    | <code>grok/grok-4.7</code>               | n/a   | n/a         | n/a | n/a | 6.00s           | $0.0078        |
| 7    | <code>mistral/mistral-ocr-4-1</code>     | n/a   | n/a         | n/a | n/a | 2.48s           | $0.0040        |
| 8    | <code>openai/gpt-6-luna</code>           | n/a   | n/a         | n/a | n/a | 5.92s           | $0.0003        |
| 9    | <code>openai/gpt-6.1-sol</code>          | n/a   | n/a         | n/a | n/a | 5.58s           | $0.0041        |


## Provider Detail

| Provider                                 | Group               | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---------------------------------------- | ------------------- | ----------: | --: | --: | --------------: | -------------: |
| <code>tesseract</code>                   | Local               | n/a         | n/a | n/a | 0.22s           | $0.00          |
| <code>anthropic/claude-fable-5</code>    | Third-Party Service | n/a         | n/a | n/a | 5.14s           | $0.0292        |
| <code>anthropic/claude-haiku-5-5</code>  | Third-Party Service | n/a         | n/a | n/a | 2.58s           | $0.0003        |
| <code>anthropic/claude-opus-5-5</code>   | Third-Party Service | n/a         | n/a | n/a | 3.31s           | $0.0120        |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | n/a         | n/a | n/a | 2.99s           | $0.0059        |
| <code>gemini/gemini-3.8-flash</code>     | Third-Party Service | n/a         | n/a | n/a | 3.03s           | $0.0030        |
| <code>grok/grok-4.7</code>               | Third-Party Service | n/a         | n/a | n/a | 6.00s           | $0.0078        |
| <code>mistral/mistral-ocr-4-1</code>     | Third-Party Service | n/a         | n/a | n/a | 2.48s           | $0.0040        |
| <code>openai/gpt-6-luna</code>           | Third-Party Service | n/a         | n/a | n/a | 5.92s           | $0.0003        |
| <code>openai/gpt-6.1-sol</code>          | Third-Party Service | n/a         | n/a | n/a | 5.58s           | $0.0041        |

## Primary region accuracy unavailable

Primary word-region recognition/localization accuracy is unavailable: outputs contain text without coordinates, and the publisher annotations are not an exhaustive full-image transcription. Text presence can match incidental duplicates outside annotated regions.


## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.

## Annotated-token coverage diagnostic

Primary word-region recognition/localization accuracy is unavailable: outputs contain text without coordinates, and the publisher annotations are not an exhaustive full-image transcription. Text presence can match incidental duplicates outside annotated regions.

Unmatched output can be valid unannotated image text; the counts below are not false-positive counts. Duplicate targets count separately under the declared lexical normalization. These unranked text-presence diagnostics do not establish where a word was read.

| Provider                      | Annotated-token coverage | Matched / reference | Missing tokens | Unmatched output tokens |
| ----------------------------- | ------------------------ | ------------------- | -------------- | ----------------------- |
| `tesseract/tesseract`         | 77.78%                   | 56 / 72             | 16             | 6                       |
| `mistral/mistral-ocr-4-1`     | 100.00%                  | 72 / 72             | 0              | 0                       |
| `openai/gpt-6.1-sol`          | 100.00%                  | 72 / 72             | 0              | 0                       |
| `openai/gpt-6-luna`           | 100.00%                  | 72 / 72             | 0              | 0                       |
| `grok/grok-4.7`               | 100.00%                  | 72 / 72             | 0              | 0                       |
| `anthropic/claude-opus-5-5`   | 100.00%                  | 72 / 72             | 0              | 0                       |
| `anthropic/claude-sonnet-5-5` | 100.00%                  | 72 / 72             | 0              | 0                       |
| `anthropic/claude-haiku-5-5`  | 100.00%                  | 72 / 72             | 0              | 0                       |
| `anthropic/claude-fable-5`    | 100.00%                  | 72 / 72             | 0              | 0                       |
| `gemini/gemini-3.8-flash`     | 100.00%                  | 72 / 72             | 0              | 0                       |

[Evaluation policy and secondary ordered-text diagnostics](evaluation-diagnostics.json).

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- Every provider received the same full original JPEG. No gold words or annotation coordinates were sent to providers. Text-only outputs do not establish word-region localization or full-image exhaustive accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Primary word-region recognition/localization accuracy is unavailable: outputs contain text without coordinates, and the publisher annotations are not an exhaustive full-image transcription. Text presence can match incidental duplicates outside annotated regions.
