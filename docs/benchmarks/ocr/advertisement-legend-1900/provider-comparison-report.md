# OCR Provider Comparison Report

## Summary

- Run directory: `input/examples/document/ocr-category-d-run/benchmark-runs/advertisement-legend-1900`
- Publisher canonical reference: `canonical-reference.txt`.
- Primary region accuracy: unavailable. Primary word-region recognition/localization accuracy is unavailable: outputs contain text without coordinates, and the publisher annotations are not an exhaustive full-image transcription. Text presence can match incidental duplicates outside annotated regions.
- Total providers: 21 (1 local, 20 third-party service)
- Local and third-party service providers are ranked separately for price, speed, and quality score.
- Annotated-token coverage and ordered-reference WER/CER are secondary diagnostics; they are not primary accuracy scores.
- OCR consensus skill artifacts are emitted beside this report: `page-metrics.json`, `outliers.json`, `selective-adjudication-pages.json`, `variant-comparison-summary.json`, and `ocr-benchmark-summary.md`.

## Method

- Publisher word-region text is independently supplied. Its reviewed order is a derived convention, and it is not exhaustive full-image gold.
- Reference SHA-256: `63750d012d6f74e0d56297c8baf317d366d52d569835d8ed427d37e0e42be311`.
- Publisher source: https://dl.fbaipublicfiles.com/textvqa/data/textocr/TextOCR_0.1_train.json (revision `v0.1; annotation S3 version nOSHBYLvXX4J7TUWv5Esml0IYeU3I3az`).
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Primary Quality Score values are unavailable for this partial-reference/text-only protocol; price and speed remain measurable.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | $0.00 local monetary cost | n/a | n/a | n/a | 0.17s | $0.00 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | 0.17s | n/a | n/a | n/a | 0.17s | $0.00 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>tesseract</code> | n/a | n/a | n/a | n/a | 0.17s | $0.00 |

### Third-Party Service

#### Price

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>deepinfra/google/gemma-4-31B-it</code> | $0.0001 | n/a | n/a | n/a | 2.16s | $0.0001 |
| 2 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | $0.0002 | n/a | n/a | n/a | 1.91s | $0.0002 |
| 3 | <code>openai/gpt-6-luna</code> | $0.0002 | n/a | n/a | n/a | 2.74s | $0.0002 |
| 4 | <code>anthropic/claude-haiku-5-5</code> | $0.0002 | n/a | n/a | n/a | 2.97s | $0.0002 |
| 5 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | $0.0004 | n/a | n/a | n/a | 3.25s | $0.0004 |
| 6 | <code>gemini/gemini-3.5-flash-lite</code> | $0.0006 | n/a | n/a | n/a | 1.41s | $0.0006 |
| 7 | <code>gemini/gemini-3.6-flash</code> | $0.0025 | n/a | n/a | n/a | 1.69s | $0.0025 |
| 8 | <code>gemini/gemini-3.8-flash</code> | $0.0025 | n/a | n/a | n/a | 3.64s | $0.0025 |
| 9 | <code>gemini/gemini-3.5-flash</code> | $0.0027 | n/a | n/a | n/a | 1.58s | $0.0027 |
| 10 | <code>openai/gpt-5.6-terra</code> | $0.0040 | n/a | n/a | n/a | 2.62s | $0.0040 |
| 11 | <code>mistral/mistral-ocr-4-1</code> | $0.0040 | n/a | n/a | n/a | 1.31s | $0.0040 |
| 12 | <code>grok/grok-4.5</code> | $0.0042 | n/a | n/a | n/a | 3.06s | $0.0042 |
| 13 | <code>openai/gpt-6.1-sol</code> | $0.0042 | n/a | n/a | n/a | 7.23s | $0.0042 |
| 14 | <code>anthropic/claude-sonnet-5-5</code> | $0.0049 | n/a | n/a | n/a | 2.83s | $0.0049 |
| 15 | <code>grok/grok-4.7</code> | $0.0054 | n/a | n/a | n/a | 2.27s | $0.0054 |
| 16 | <code>gemini/gemini-4-argon</code> | $0.0079 | n/a | n/a | n/a | 4.24s | $0.0079 |
| 17 | <code>anthropic/claude-opus-5-5</code> | $0.0096 | n/a | n/a | n/a | 2.76s | $0.0096 |
| 18 | <code>openai/gpt-6-astra</code> | $0.0139 | n/a | n/a | n/a | 3.54s | $0.0139 |
| 19 | <code>anthropic/claude-fable-5</code> | $0.0240 | n/a | n/a | n/a | 4.39s | $0.0240 |
| 20 | <code>anthropic/claude-fable-5-1</code> | $0.0245 | n/a | n/a | n/a | 3.98s | $0.0245 |

#### Speed

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral/mistral-ocr-4-1</code> | 1.31s | n/a | n/a | n/a | 1.31s | $0.0040 |
| 2 | <code>gemini/gemini-3.5-flash-lite</code> | 1.41s | n/a | n/a | n/a | 1.41s | $0.0006 |
| 3 | <code>gemini/gemini-3.5-flash</code> | 1.58s | n/a | n/a | n/a | 1.58s | $0.0027 |
| 4 | <code>gemini/gemini-3.6-flash</code> | 1.69s | n/a | n/a | n/a | 1.69s | $0.0025 |
| 5 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | 1.91s | n/a | n/a | n/a | 1.91s | $0.0002 |
| 6 | <code>deepinfra/google/gemma-4-31B-it</code> | 2.16s | n/a | n/a | n/a | 2.16s | $0.0001 |
| 7 | <code>grok/grok-4.7</code> | 2.27s | n/a | n/a | n/a | 2.27s | $0.0054 |
| 8 | <code>openai/gpt-5.6-terra</code> | 2.62s | n/a | n/a | n/a | 2.62s | $0.0040 |
| 9 | <code>openai/gpt-6-luna</code> | 2.74s | n/a | n/a | n/a | 2.74s | $0.0002 |
| 10 | <code>anthropic/claude-opus-5-5</code> | 2.76s | n/a | n/a | n/a | 2.76s | $0.0096 |
| 11 | <code>anthropic/claude-sonnet-5-5</code> | 2.83s | n/a | n/a | n/a | 2.83s | $0.0049 |
| 12 | <code>anthropic/claude-haiku-5-5</code> | 2.97s | n/a | n/a | n/a | 2.97s | $0.0002 |
| 13 | <code>grok/grok-4.5</code> | 3.06s | n/a | n/a | n/a | 3.06s | $0.0042 |
| 14 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | 3.25s | n/a | n/a | n/a | 3.25s | $0.0004 |
| 15 | <code>openai/gpt-6-astra</code> | 3.54s | n/a | n/a | n/a | 3.54s | $0.0139 |
| 16 | <code>gemini/gemini-3.8-flash</code> | 3.64s | n/a | n/a | n/a | 3.64s | $0.0025 |
| 17 | <code>anthropic/claude-fable-5-1</code> | 3.98s | n/a | n/a | n/a | 3.98s | $0.0245 |
| 18 | <code>gemini/gemini-4-argon</code> | 4.24s | n/a | n/a | n/a | 4.24s | $0.0079 |
| 19 | <code>anthropic/claude-fable-5</code> | 4.39s | n/a | n/a | n/a | 4.39s | $0.0240 |
| 20 | <code>openai/gpt-6.1-sol</code> | 7.23s | n/a | n/a | n/a | 7.23s | $0.0042 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>anthropic/claude-fable-5</code> | n/a | n/a | n/a | n/a | 4.39s | $0.0240 |
| 2 | <code>anthropic/claude-fable-5-1</code> | n/a | n/a | n/a | n/a | 3.98s | $0.0245 |
| 3 | <code>anthropic/claude-haiku-5-5</code> | n/a | n/a | n/a | n/a | 2.97s | $0.0002 |
| 4 | <code>anthropic/claude-opus-5-5</code> | n/a | n/a | n/a | n/a | 2.76s | $0.0096 |
| 5 | <code>anthropic/claude-sonnet-5-5</code> | n/a | n/a | n/a | n/a | 2.83s | $0.0049 |
| 6 | <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | n/a | n/a | n/a | n/a | 1.91s | $0.0002 |
| 7 | <code>deepinfra/google/gemma-4-31B-it</code> | n/a | n/a | n/a | n/a | 2.16s | $0.0001 |
| 8 | <code>deepinfra/Qwen/Qwen3.8-27B</code> | n/a | n/a | n/a | n/a | 3.25s | $0.0004 |
| 9 | <code>gemini/gemini-3.5-flash</code> | n/a | n/a | n/a | n/a | 1.58s | $0.0027 |
| 10 | <code>gemini/gemini-3.5-flash-lite</code> | n/a | n/a | n/a | n/a | 1.41s | $0.0006 |
| 11 | <code>gemini/gemini-3.6-flash</code> | n/a | n/a | n/a | n/a | 1.69s | $0.0025 |
| 12 | <code>gemini/gemini-3.8-flash</code> | n/a | n/a | n/a | n/a | 3.64s | $0.0025 |
| 13 | <code>gemini/gemini-4-argon</code> | n/a | n/a | n/a | n/a | 4.24s | $0.0079 |
| 14 | <code>grok/grok-4.5</code> | n/a | n/a | n/a | n/a | 3.06s | $0.0042 |
| 15 | <code>grok/grok-4.7</code> | n/a | n/a | n/a | n/a | 2.27s | $0.0054 |
| 16 | <code>mistral/mistral-ocr-4-1</code> | n/a | n/a | n/a | n/a | 1.31s | $0.0040 |
| 17 | <code>openai/gpt-5.6-terra</code> | n/a | n/a | n/a | n/a | 2.62s | $0.0040 |
| 18 | <code>openai/gpt-6-astra</code> | n/a | n/a | n/a | n/a | 3.54s | $0.0139 |
| 19 | <code>openai/gpt-6-luna</code> | n/a | n/a | n/a | n/a | 2.74s | $0.0002 |
| 20 | <code>openai/gpt-6.1-sol</code> | n/a | n/a | n/a | n/a | 7.23s | $0.0042 |


## Provider Detail

| Provider | Group | Score / 100 | WER | CER | Processing Time | Accounted Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>tesseract</code> | Local | n/a | n/a | n/a | 0.17s | $0.00 |
| <code>anthropic/claude-fable-5</code> | Third-Party Service | n/a | n/a | n/a | 4.39s | $0.0240 |
| <code>anthropic/claude-fable-5-1</code> | Third-Party Service | n/a | n/a | n/a | 3.98s | $0.0245 |
| <code>anthropic/claude-haiku-5-5</code> | Third-Party Service | n/a | n/a | n/a | 2.97s | $0.0002 |
| <code>anthropic/claude-opus-5-5</code> | Third-Party Service | n/a | n/a | n/a | 2.76s | $0.0096 |
| <code>anthropic/claude-sonnet-5-5</code> | Third-Party Service | n/a | n/a | n/a | 2.83s | $0.0049 |
| <code>deepinfra/deepseek-ai/DeepSeek-V4.1-Flash</code> | Third-Party Service | n/a | n/a | n/a | 1.91s | $0.0002 |
| <code>deepinfra/google/gemma-4-31B-it</code> | Third-Party Service | n/a | n/a | n/a | 2.16s | $0.0001 |
| <code>deepinfra/Qwen/Qwen3.8-27B</code> | Third-Party Service | n/a | n/a | n/a | 3.25s | $0.0004 |
| <code>gemini/gemini-3.5-flash</code> | Third-Party Service | n/a | n/a | n/a | 1.58s | $0.0027 |
| <code>gemini/gemini-3.5-flash-lite</code> | Third-Party Service | n/a | n/a | n/a | 1.41s | $0.0006 |
| <code>gemini/gemini-3.6-flash</code> | Third-Party Service | n/a | n/a | n/a | 1.69s | $0.0025 |
| <code>gemini/gemini-3.8-flash</code> | Third-Party Service | n/a | n/a | n/a | 3.64s | $0.0025 |
| <code>gemini/gemini-4-argon</code> | Third-Party Service | n/a | n/a | n/a | 4.24s | $0.0079 |
| <code>grok/grok-4.5</code> | Third-Party Service | n/a | n/a | n/a | 3.06s | $0.0042 |
| <code>grok/grok-4.7</code> | Third-Party Service | n/a | n/a | n/a | 2.27s | $0.0054 |
| <code>mistral/mistral-ocr-4-1</code> | Third-Party Service | n/a | n/a | n/a | 1.31s | $0.0040 |
| <code>openai/gpt-5.6-terra</code> | Third-Party Service | n/a | n/a | n/a | 2.62s | $0.0040 |
| <code>openai/gpt-6-astra</code> | Third-Party Service | n/a | n/a | n/a | 3.54s | $0.0139 |
| <code>openai/gpt-6-luna</code> | Third-Party Service | n/a | n/a | n/a | 2.74s | $0.0002 |
| <code>openai/gpt-6.1-sol</code> | Third-Party Service | n/a | n/a | n/a | 7.23s | $0.0042 |

## Primary region accuracy unavailable

Primary word-region recognition/localization accuracy is unavailable: outputs contain text without coordinates, and the publisher annotations are not an exhaustive full-image transcription. Text presence can match incidental duplicates outside annotated regions.


## Notes

- WER tokenizes normalized text as ASCII [a-z0-9] runs and excludes non-ASCII glyphs, including Japanese. The WER-derived headline quality score does not measure complete Japanese or other non-Latin OCR accuracy.
- CER retains normalized Unicode letters and numbers as supporting evidence. Review CER and the source images when assessing non-Latin extraction quality.
- The cheapest cloud provider was `deepinfra/google/gemma-4-31B-it` at 0.0098¢ ($0.0001).
- Fastest local model: `tesseract/tesseract` at 0.17s.
- Fastest cloud service: `mistral/mistral-ocr-4-1` at 1.31s.

## Annotated-token coverage diagnostic

Primary word-region recognition/localization accuracy is unavailable: outputs contain text without coordinates, and the publisher annotations are not an exhaustive full-image transcription. Text presence can match incidental duplicates outside annotated regions.

Unmatched output can be valid unannotated image text; the counts below are not false-positive counts. Duplicate targets count separately under the declared lexical normalization. These unranked text-presence diagnostics do not establish where a word was read.

| Provider                                    | Annotated-token coverage | Matched / reference | Missing tokens | Unmatched output tokens |
| ------------------------------------------- | ------------------------ | ------------------- | -------------- | ----------------------- |
| `tesseract/tesseract`                       | 16.67%                   | 6 / 36              | 30             | 10                      |
| `mistral/mistral-ocr-4-1`                   | 94.44%                   | 34 / 36             | 2              | 8                       |
| `openai/gpt-6.1-sol`                        | 100.00%                  | 36 / 36             | 0              | 0                       |
| `openai/gpt-6-luna`                         | 100.00%                  | 36 / 36             | 0              | 0                       |
| `openai/gpt-6-astra`                        | 100.00%                  | 36 / 36             | 0              | 0                       |
| `openai/gpt-5.6-terra`                      | 100.00%                  | 36 / 36             | 0              | 0                       |
| `grok/grok-4.7`                             | 100.00%                  | 36 / 36             | 0              | 0                       |
| `grok/grok-4.5`                             | 100.00%                  | 36 / 36             | 0              | 0                       |
| `anthropic/claude-opus-5-5`                 | 100.00%                  | 36 / 36             | 0              | 0                       |
| `anthropic/claude-sonnet-5-5`               | 100.00%                  | 36 / 36             | 0              | 0                       |
| `anthropic/claude-haiku-5-5`                | 100.00%                  | 36 / 36             | 0              | 0                       |
| `anthropic/claude-fable-5-1`                | 100.00%                  | 36 / 36             | 0              | 0                       |
| `anthropic/claude-fable-5`                  | 100.00%                  | 36 / 36             | 0              | 0                       |
| `gemini/gemini-4-argon`                     | 100.00%                  | 36 / 36             | 0              | 0                       |
| `gemini/gemini-3.8-flash`                   | 100.00%                  | 36 / 36             | 0              | 0                       |
| `gemini/gemini-3.5-flash`                   | 100.00%                  | 36 / 36             | 0              | 0                       |
| `gemini/gemini-3.6-flash`                   | 100.00%                  | 36 / 36             | 0              | 0                       |
| `gemini/gemini-3.5-flash-lite`              | 100.00%                  | 36 / 36             | 0              | 0                       |
| `deepinfra/google/gemma-4-31B-it`           | 100.00%                  | 36 / 36             | 0              | 0                       |
| `deepinfra/Qwen/Qwen3.8-27B`                | 100.00%                  | 36 / 36             | 0              | 0                       |
| `deepinfra/deepseek-ai/DeepSeek-V4.1-Flash` | 100.00%                  | 36 / 36             | 0              | 0                       |

[Evaluation policy and secondary ordered-text diagnostics](evaluation-diagnostics.json).

## Coverage and fidelity

- Each declared page must succeed before a provider receives a full-document score. Partial outputs remain private and unscored in full-document rankings.
- Reference provenance: immutable publisher canonical text supplied independently of provider outputs.
- Every provider received the same full original JPEG. No gold words or annotation coordinates were sent to providers. Text-only outputs do not establish word-region localization or full-image exhaustive accuracy.
- Accounted prices include settled retry usage and retained uncertain reservations; they are not invoice-reconciled charges. Any held or conservative component makes the price a conservative upper bound.
- Primary word-region recognition/localization accuracy is unavailable: outputs contain text without coordinates, and the publisher annotations are not an exhaustive full-image transcription. Text presence can match incidental duplicates outside annotated regions.
