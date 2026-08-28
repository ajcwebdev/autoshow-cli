# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/stt-without-speakers/2022-09-30-widgets-fsjam-40-minutes`
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
| 1 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | $0.0081 | 87.27 | 12.73% | 12.06% | not-supported | 10.69s | 226.58× realtime | $0.0081 |
| 2 | <code>deepinfra-openai_whisper-large-v3</code> | $0.0182 | 87.94 | 12.06% | 11.37% | not-supported | 18.81s | 128.81× realtime | $0.0182 |
| 3 | <code>groq-whisper-large-v3-turbo</code> | $0.0269 | 96.43 | 3.57% | 2.82% | not-supported | 16.05s | 150.92× realtime | $0.0269 |
| 4 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | $0.0606 | 95.70 | 4.30% | 3.58% | not-supported | 3.39s | 714.55× realtime | $0.0606 |
| 5 | <code>together-openai_whisper-large-v3</code> | $0.0606 | 94.68 | 5.32% | 4.57% | not-supported | 10.43s | 232.40× realtime | $0.0606 |
| 6 | <code>groq-whisper-large-v3</code> | $0.0747 | 96.09 | 3.91% | 3.15% | not-supported | 24.23s | 100.01× realtime | $0.0747 |
| 7 | <code>gemini-stt-gemini-3.6-flash</code> | $0.3747 | 47.12 | 52.88% | 52.52% | not-supported | 155.68s | 15.56× realtime | $0.3747 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 3.39s | 95.70 | 4.30% | 3.58% | not-supported | 3.39s | 714.55× realtime | $0.0606 |
| 2 | <code>together-openai_whisper-large-v3</code> | 10.43s | 94.68 | 5.32% | 4.57% | not-supported | 10.43s | 232.40× realtime | $0.0606 |
| 3 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 10.69s | 87.27 | 12.73% | 12.06% | not-supported | 10.69s | 226.58× realtime | $0.0081 |
| 4 | <code>groq-whisper-large-v3-turbo</code> | 16.05s | 96.43 | 3.57% | 2.82% | not-supported | 16.05s | 150.92× realtime | $0.0269 |
| 5 | <code>deepinfra-openai_whisper-large-v3</code> | 18.81s | 87.94 | 12.06% | 11.37% | not-supported | 18.81s | 128.81× realtime | $0.0182 |
| 6 | <code>groq-whisper-large-v3</code> | 24.23s | 96.09 | 3.91% | 3.15% | not-supported | 24.23s | 100.01× realtime | $0.0747 |
| 7 | <code>gemini-stt-gemini-3.6-flash</code> | 155.68s | 47.12 | 52.88% | 52.52% | not-supported | 155.68s | 15.56× realtime | $0.3747 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>groq-whisper-large-v3-turbo</code> | 96.43/100 quality score | 96.43 | 3.57% | 2.82% | not-supported | 16.05s | 150.92× realtime | $0.0269 |
| 2 | <code>groq-whisper-large-v3</code> | 96.09/100 quality score | 96.09 | 3.91% | 3.15% | not-supported | 24.23s | 100.01× realtime | $0.0747 |
| 3 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 95.70/100 quality score | 95.70 | 4.30% | 3.58% | not-supported | 3.39s | 714.55× realtime | $0.0606 |
| 4 | <code>together-openai_whisper-large-v3</code> | 94.68/100 quality score | 94.68 | 5.32% | 4.57% | not-supported | 10.43s | 232.40× realtime | $0.0606 |
| 5 | <code>deepinfra-openai_whisper-large-v3</code> | 87.94/100 quality score | 87.94 | 12.06% | 11.37% | not-supported | 18.81s | 128.81× realtime | $0.0182 |
| 6 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 87.27/100 quality score | 87.27 | 12.73% | 12.06% | not-supported | 10.69s | 226.58× realtime | $0.0081 |
| 7 | <code>gemini-stt-gemini-3.6-flash</code> | 47.12/100 quality score | 47.12 | 52.88% | 52.52% | not-supported | 155.68s | 15.56× realtime | $0.3747 |

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
| <code>deepinfra-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 87.94 | 12.06% | 11.37% | 18.81s | 128.81× realtime | $0.0182 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 87.27 | 12.73% | 12.06% | 10.69s | 226.58× realtime | $0.0081 |
| <code>gemini-stt-gemini-3.6-flash</code> | Third-Party Service Non-Diarization | not-supported | 47.12 | 52.88% | 52.52% | 155.68s | 15.56× realtime | $0.3747 |
| <code>groq-whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 96.09 | 3.91% | 3.15% | 24.23s | 100.01× realtime | $0.0747 |
| <code>groq-whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 96.43 | 3.57% | 2.82% | 16.05s | 150.92× realtime | $0.0269 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | Third-Party Service Non-Diarization | not-supported | 95.70 | 4.30% | 3.58% | 3.39s | 714.55× realtime | $0.0606 |
| <code>together-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 94.68 | 5.32% | 4.57% | 10.43s | 232.40× realtime | $0.0606 |

## Error Breakdown (Speaker-aware)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>deepinfra-openai_whisper-large-v3</code> | 105 | 837 | 50 | 8226 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 128 | 864 | 55 | 8226 |
| <code>gemini-stt-gemini-3.6-flash</code> | 99 | 2147 | 2104 | 8226 |
| <code>groq-whisper-large-v3</code> | 137 | 131 | 54 | 8226 |
| <code>groq-whisper-large-v3-turbo</code> | 120 | 123 | 51 | 8226 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 175 | 107 | 72 | 8226 |
| <code>together-openai_whisper-large-v3</code> | 123 | 259 | 56 | 8226 |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>deepinfra-openai_whisper-large-v3</code> | 102 | 774 | 52 | 8160 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 122 | 803 | 59 | 8160 |
| <code>gemini-stt-gemini-3.6-flash</code> | 98 | 2083 | 2105 | 8160 |
| <code>groq-whisper-large-v3</code> | 129 | 70 | 58 | 8160 |
| <code>groq-whisper-large-v3-turbo</code> | 117 | 60 | 53 | 8160 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 168 | 47 | 77 | 8160 |
| <code>together-openai_whisper-large-v3</code> | 121 | 195 | 57 | 8160 |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `groq-whisper-large-v3-turbo` was the most accurate provider on strict speaker-aware WER, scoring 96.43/100.
- `together-nvidia_parakeet-tdt-0.6b-v3` was the fastest provider in this set at 3.39s.
- `groq-whisper-large-v3` lost the most ground once speaker changes were counted, with 0.76 percentage-point gap between text-only and speaker-aware WER.
