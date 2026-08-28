# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/stt-without-speakers/2023-04-05-jsjam-react-miami-2023-10-minutes`
- Total providers: 7 (0 local, 7 third-party service)
- Local, third-party non-diarization, and third-party diarization providers are ranked separately for price, speed, and quality score.
- Quality score uses speaker-aware WER-derived transcript accuracy, with text-only WER retained as supporting evidence.

## Method

- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing speaker-aware WER-derived provider score from highest to lowest.
- Third-party service rankings are split by whether the normalized provider result supports diarization.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

### Third-Party Service Non-Diarization

#### Price

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | $0.0020 | 89.68 | 10.32% | 9.71% | not-supported | 4.27s | 140.52× realtime | $0.0020 |
| 2 | <code>deepinfra-openai_whisper-large-v3</code> | $0.0045 | 92.39 | 7.61% | 6.79% | not-supported | 6.52s | 92.04× realtime | $0.0045 |
| 3 | <code>groq-whisper-large-v3-turbo</code> | $0.0067 | 92.80 | 7.20% | 6.38% | not-supported | 3.77s | 158.94× realtime | $0.0067 |
| 4 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | $0.0150 | 94.75 | 5.25% | 4.35% | not-supported | 1.29s | 464.04× realtime | $0.0150 |
| 5 | <code>together-openai_whisper-large-v3</code> | $0.0150 | 93.33 | 6.67% | 5.72% | not-supported | 3.46s | 173.36× realtime | $0.0150 |
| 6 | <code>groq-whisper-large-v3</code> | $0.0185 | 89.38 | 10.62% | 9.71% | not-supported | 7.70s | 77.97× realtime | $0.0185 |
| 7 | <code>gemini-stt-gemini-3.6-flash</code> | $0.0815 | 94.40 | 5.60% | 4.89% | not-supported | 33.40s | 17.96× realtime | $0.0815 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 1.29s | 94.75 | 5.25% | 4.35% | not-supported | 1.29s | 464.04× realtime | $0.0150 |
| 2 | <code>together-openai_whisper-large-v3</code> | 3.46s | 93.33 | 6.67% | 5.72% | not-supported | 3.46s | 173.36× realtime | $0.0150 |
| 3 | <code>groq-whisper-large-v3-turbo</code> | 3.77s | 92.80 | 7.20% | 6.38% | not-supported | 3.77s | 158.94× realtime | $0.0067 |
| 4 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 4.27s | 89.68 | 10.32% | 9.71% | not-supported | 4.27s | 140.52× realtime | $0.0020 |
| 5 | <code>deepinfra-openai_whisper-large-v3</code> | 6.52s | 92.39 | 7.61% | 6.79% | not-supported | 6.52s | 92.04× realtime | $0.0045 |
| 6 | <code>groq-whisper-large-v3</code> | 7.70s | 89.38 | 10.62% | 9.71% | not-supported | 7.70s | 77.97× realtime | $0.0185 |
| 7 | <code>gemini-stt-gemini-3.6-flash</code> | 33.40s | 94.40 | 5.60% | 4.89% | not-supported | 33.40s | 17.96× realtime | $0.0815 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 94.75/100 quality score | 94.75 | 5.25% | 4.35% | not-supported | 1.29s | 464.04× realtime | $0.0150 |
| 2 | <code>gemini-stt-gemini-3.6-flash</code> | 94.40/100 quality score | 94.40 | 5.60% | 4.89% | not-supported | 33.40s | 17.96× realtime | $0.0815 |
| 3 | <code>together-openai_whisper-large-v3</code> | 93.33/100 quality score | 93.33 | 6.67% | 5.72% | not-supported | 3.46s | 173.36× realtime | $0.0150 |
| 4 | <code>groq-whisper-large-v3-turbo</code> | 92.80/100 quality score | 92.80 | 7.20% | 6.38% | not-supported | 3.77s | 158.94× realtime | $0.0067 |
| 5 | <code>deepinfra-openai_whisper-large-v3</code> | 92.39/100 quality score | 92.39 | 7.61% | 6.79% | not-supported | 6.52s | 92.04× realtime | $0.0045 |
| 6 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 89.68/100 quality score | 89.68 | 10.32% | 9.71% | not-supported | 4.27s | 140.52× realtime | $0.0020 |
| 7 | <code>groq-whisper-large-v3</code> | 89.38/100 quality score | 89.38 | 10.62% | 9.71% | not-supported | 7.70s | 77.97× realtime | $0.0185 |

### Third-Party Service Diarization

#### Price

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |


## Provider Detail

| Provider | Group | Diarization | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Throughput | Actual Cost |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| <code>deepinfra-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 92.39 | 7.61% | 6.79% | 6.52s | 92.04× realtime | $0.0045 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 89.68 | 10.32% | 9.71% | 4.27s | 140.52× realtime | $0.0020 |
| <code>gemini-stt-gemini-3.6-flash</code> | Third-Party Service Non-Diarization | not-supported | 94.40 | 5.60% | 4.89% | 33.40s | 17.96× realtime | $0.0815 |
| <code>groq-whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 89.38 | 10.62% | 9.71% | 7.70s | 77.97× realtime | $0.0185 |
| <code>groq-whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 92.80 | 7.20% | 6.38% | 3.77s | 158.94× realtime | $0.0067 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | Third-Party Service Non-Diarization | not-supported | 94.75 | 5.25% | 4.35% | 1.29s | 464.04× realtime | $0.0150 |
| <code>together-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 93.33 | 6.67% | 5.72% | 3.46s | 173.36× realtime | $0.0150 |

## Error Breakdown (Speaker-aware)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>deepinfra-openai_whisper-large-v3</code> | 37 | 72 | 20 | 1695 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 43 | 112 | 20 | 1695 |
| <code>gemini-stt-gemini-3.6-flash</code> | 30 | 23 | 42 | 1695 |
| <code>groq-whisper-large-v3</code> | 27 | 139 | 14 | 1695 |
| <code>groq-whisper-large-v3-turbo</code> | 36 | 69 | 17 | 1695 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 33 | 28 | 28 | 1695 |
| <code>together-openai_whisper-large-v3</code> | 33 | 68 | 12 | 1695 |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>deepinfra-openai_whisper-large-v3</code> | 32 | 59 | 23 | 1678 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 35 | 102 | 26 | 1678 |
| <code>gemini-stt-gemini-3.6-flash</code> | 25 | 11 | 46 | 1678 |
| <code>groq-whisper-large-v3</code> | 24 | 124 | 15 | 1678 |
| <code>groq-whisper-large-v3-turbo</code> | 31 | 56 | 20 | 1678 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 29 | 14 | 30 | 1678 |
| <code>together-openai_whisper-large-v3</code> | 30 | 53 | 13 | 1678 |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `together-nvidia_parakeet-tdt-0.6b-v3` was the most accurate provider on strict speaker-aware WER, scoring 94.75/100.
- `together-nvidia_parakeet-tdt-0.6b-v3` was the fastest provider in this set at 1.29s.
- `together-openai_whisper-large-v3` lost the most ground once speaker changes were counted, with 0.95 percentage-point gap between text-only and speaker-aware WER.
