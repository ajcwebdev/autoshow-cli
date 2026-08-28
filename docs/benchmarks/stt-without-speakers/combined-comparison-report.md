# Combined STT Provider Comparison Report

## Summary

- Root directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/stt-without-speakers`
- Runs aggregated: 4
  - `1-audio` (7 providers)
  - `2022-09-30-widgets-fsjam-40-minutes` (7 providers)
  - `2023-03-15-jsjam-qwik-misko-hevery` (7 providers)
  - `2023-04-05-jsjam-react-miami-2023-10-minutes` (7 providers)
- Distinct providers: 7 (0 local, 7 third-party non-diarization, 0 third-party diarization)
- Quality score aggregates the per-run speaker-aware WER-derived score as a mean across runs; price and speed aggregate per-run cost and processing time as means.

## Method

- Providers are matched by `providerKey` and aggregated across the runs they appear in.
- Means are taken over present values only; a provider missing a value in some runs is averaged over the runs where it is present.
- Price rankings use mean per-run monetary cost ascending, local providers at zero, missing cost last.
- Speed rankings use mean processing time ascending, missing timing last.
- Quality Score rankings use the mean speaker-aware WER-derived score descending.
- Tied ranking values break deterministically: price ties by quality descending then provider key; speed and quality ties by provider key.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Speed

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

### Third-Party Service Non-Diarization

#### Price

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | $0.0082 | 4 | 88.40 | 11.60% | 10.78% | not-supported | 13.08s | 188.41× | $0.0082 |
| 2 | <code>deepinfra-openai_whisper-large-v3</code> | $0.0185 | 4 | 89.40 | 10.60% | 9.73% | not-supported | 24.86s | 99.09× | $0.0185 |
| 3 | <code>groq-whisper-large-v3-turbo</code> | $0.0274 | 4 | 94.57 | 5.43% | 4.48% | not-supported | 21.24s | 116.00× | $0.0274 |
| 4 | <code>together-openai_whisper-large-v3</code> | $0.0616 | 4 | 94.00 | 6.00% | 5.02% | not-supported | 10.84s | 227.18× | $0.0616 |
| 5 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | $0.0616 | 4 | 93.27 | 6.73% | 5.79% | not-supported | 14.21s | 173.32× | $0.0616 |
| 6 | <code>groq-whisper-large-v3</code> | $0.0760 | 4 | 94.50 | 5.50% | 4.52% | not-supported | 24.57s | 100.26× | $0.0760 |
| 7 | <code>gemini-stt-gemini-3.6-flash</code> | $0.3973 | 4 | 81.85 | 18.15% | 17.34% | not-supported | 169.19s | 14.56× | $0.3973 |

#### Speed

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>together-openai_whisper-large-v3</code> | 10.84s | 4 | 94.00 | 6.00% | 5.02% | not-supported | 10.84s | 227.18× | $0.0616 |
| 2 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 13.08s | 4 | 88.40 | 11.60% | 10.78% | not-supported | 13.08s | 188.41× | $0.0082 |
| 3 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 14.21s | 4 | 93.27 | 6.73% | 5.79% | not-supported | 14.21s | 173.32× | $0.0616 |
| 4 | <code>groq-whisper-large-v3-turbo</code> | 21.24s | 4 | 94.57 | 5.43% | 4.48% | not-supported | 21.24s | 116.00× | $0.0274 |
| 5 | <code>groq-whisper-large-v3</code> | 24.57s | 4 | 94.50 | 5.50% | 4.52% | not-supported | 24.57s | 100.26× | $0.0760 |
| 6 | <code>deepinfra-openai_whisper-large-v3</code> | 24.86s | 4 | 89.40 | 10.60% | 9.73% | not-supported | 24.86s | 99.09× | $0.0185 |
| 7 | <code>gemini-stt-gemini-3.6-flash</code> | 169.19s | 4 | 81.85 | 18.15% | 17.34% | not-supported | 169.19s | 14.56× | $0.3973 |

#### Quality Score

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>groq-whisper-large-v3-turbo</code> | 94.57/100 quality score | 4 | 94.57 | 5.43% | 4.48% | not-supported | 21.24s | 116.00× | $0.0274 |
| 2 | <code>groq-whisper-large-v3</code> | 94.50/100 quality score | 4 | 94.50 | 5.50% | 4.52% | not-supported | 24.57s | 100.26× | $0.0760 |
| 3 | <code>together-openai_whisper-large-v3</code> | 94.00/100 quality score | 4 | 94.00 | 6.00% | 5.02% | not-supported | 10.84s | 227.18× | $0.0616 |
| 4 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 93.27/100 quality score | 4 | 93.27 | 6.73% | 5.79% | not-supported | 14.21s | 173.32× | $0.0616 |
| 5 | <code>deepinfra-openai_whisper-large-v3</code> | 89.40/100 quality score | 4 | 89.40 | 10.60% | 9.73% | not-supported | 24.86s | 99.09× | $0.0185 |
| 6 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 88.40/100 quality score | 4 | 88.40 | 11.60% | 10.78% | not-supported | 13.08s | 188.41× | $0.0082 |
| 7 | <code>gemini-stt-gemini-3.6-flash</code> | 81.85/100 quality score | 4 | 81.85 | 18.15% | 17.34% | not-supported | 169.19s | 14.56× | $0.3973 |

### Third-Party Service Diarization

#### Price

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Speed

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

## Per-Run Quality Score

Speaker-aware WER-derived quality score per provider in each run, sorted by mean.

### Third-Party Service Non-Diarization

| Provider | Mean | 1-audio | 2022-09-30-widgets-fsjam-40-minutes | 2023-03-15-jsjam-qwik-misko-hevery | 2023-04-05-jsjam-react-miami-2023-10-minutes |
| --- | ---: | ---: | ---: | ---: | ---: |
| <code>groq-whisper-large-v3-turbo</code> | 94.57 | 95.00 | 96.43 | 94.06 | 92.80 |
| <code>groq-whisper-large-v3</code> | 94.50 | 94.55 | 96.09 | 97.98 | 89.38 |
| <code>together-openai_whisper-large-v3</code> | 94.00 | 95.00 | 94.68 | 92.99 | 93.33 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 93.27 | 93.18 | 95.70 | 89.44 | 94.75 |
| <code>deepinfra-openai_whisper-large-v3</code> | 89.40 | 87.27 | 87.94 | 89.99 | 92.39 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 88.40 | 86.36 | 87.27 | 90.29 | 89.68 |
| <code>gemini-stt-gemini-3.6-flash</code> | 81.85 | 94.09 | 47.12 | 91.80 | 94.40 |

## Notes

- Each provider is aggregated by providerKey across the runs it appears in; the mean is taken over present values only. Aggregate realtime throughput is total covered audio duration divided by total covered processing time.
- Groups follow the single-run STT contract: local, thirdPartyServiceNonDiarization, thirdPartyServiceDiarization.
- Each group ranks price, speed, and quality score independently. No weighted composite or model-tier ranking is emitted.
