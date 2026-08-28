# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/stt-without-speakers/1-audio`
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
| 1 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | $0.0002 | 86.36 | 13.64% | 12.04% | not-supported | 1.50s | 39.86× realtime | $0.0002 |
| 2 | <code>deepinfra-openai_whisper-large-v3</code> | $0.0004 | 87.27 | 12.73% | 11.11% | not-supported | 1.43s | 41.55× realtime | $0.0004 |
| 3 | <code>groq-whisper-large-v3-turbo</code> | $0.0007 | 95.00 | 5.00% | 3.24% | not-supported | 1.11s | 53.87× realtime | $0.0007 |
| 4 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | $0.0015 | 93.18 | 6.82% | 5.09% | not-supported | 0.72s | 83.10× realtime | $0.0015 |
| 5 | <code>together-openai_whisper-large-v3</code> | $0.0015 | 95.00 | 5.00% | 3.24% | not-supported | 1.90s | 31.31× realtime | $0.0015 |
| 6 | <code>groq-whisper-large-v3</code> | $0.0018 | 94.55 | 5.45% | 3.70% | not-supported | 1.21s | 49.33× realtime | $0.0018 |
| 7 | <code>gemini-stt-gemini-3.6-flash</code> | $0.0244 | 94.09 | 5.91% | 4.17% | not-supported | 14.30s | 4.17× realtime | $0.0244 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 0.72s | 93.18 | 6.82% | 5.09% | not-supported | 0.72s | 83.10× realtime | $0.0015 |
| 2 | <code>groq-whisper-large-v3-turbo</code> | 1.11s | 95.00 | 5.00% | 3.24% | not-supported | 1.11s | 53.87× realtime | $0.0007 |
| 3 | <code>groq-whisper-large-v3</code> | 1.21s | 94.55 | 5.45% | 3.70% | not-supported | 1.21s | 49.33× realtime | $0.0018 |
| 4 | <code>deepinfra-openai_whisper-large-v3</code> | 1.43s | 87.27 | 12.73% | 11.11% | not-supported | 1.43s | 41.55× realtime | $0.0004 |
| 5 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 1.50s | 86.36 | 13.64% | 12.04% | not-supported | 1.50s | 39.86× realtime | $0.0002 |
| 6 | <code>together-openai_whisper-large-v3</code> | 1.90s | 95.00 | 5.00% | 3.24% | not-supported | 1.90s | 31.31× realtime | $0.0015 |
| 7 | <code>gemini-stt-gemini-3.6-flash</code> | 14.30s | 94.09 | 5.91% | 4.17% | not-supported | 14.30s | 4.17× realtime | $0.0244 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>groq-whisper-large-v3-turbo</code> | 95.00/100 quality score | 95.00 | 5.00% | 3.24% | not-supported | 1.11s | 53.87× realtime | $0.0007 |
| 2 | <code>together-openai_whisper-large-v3</code> | 95.00/100 quality score | 95.00 | 5.00% | 3.24% | not-supported | 1.90s | 31.31× realtime | $0.0015 |
| 3 | <code>groq-whisper-large-v3</code> | 94.55/100 quality score | 94.55 | 5.45% | 3.70% | not-supported | 1.21s | 49.33× realtime | $0.0018 |
| 4 | <code>gemini-stt-gemini-3.6-flash</code> | 94.09/100 quality score | 94.09 | 5.91% | 4.17% | not-supported | 14.30s | 4.17× realtime | $0.0244 |
| 5 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 93.18/100 quality score | 93.18 | 6.82% | 5.09% | not-supported | 0.72s | 83.10× realtime | $0.0015 |
| 6 | <code>deepinfra-openai_whisper-large-v3</code> | 87.27/100 quality score | 87.27 | 12.73% | 11.11% | not-supported | 1.43s | 41.55× realtime | $0.0004 |
| 7 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 86.36/100 quality score | 86.36 | 13.64% | 12.04% | not-supported | 1.50s | 39.86× realtime | $0.0002 |

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
| <code>deepinfra-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 87.27 | 12.73% | 11.11% | 1.43s | 41.55× realtime | $0.0004 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 86.36 | 13.64% | 12.04% | 1.50s | 39.86× realtime | $0.0002 |
| <code>gemini-stt-gemini-3.6-flash</code> | Third-Party Service Non-Diarization | not-supported | 94.09 | 5.91% | 4.17% | 14.30s | 4.17× realtime | $0.0244 |
| <code>groq-whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 94.55 | 5.45% | 3.70% | 1.21s | 49.33× realtime | $0.0018 |
| <code>groq-whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 95.00 | 5.00% | 3.24% | 1.11s | 53.87× realtime | $0.0007 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | Third-Party Service Non-Diarization | not-supported | 93.18 | 6.82% | 5.09% | 0.72s | 83.10× realtime | $0.0015 |
| <code>together-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 95.00 | 5.00% | 3.24% | 1.90s | 31.31× realtime | $0.0015 |

## Error Breakdown (Speaker-aware)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>deepinfra-openai_whisper-large-v3</code> | 1 | 27 | 0 | 220 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 1 | 27 | 2 | 220 |
| <code>gemini-stt-gemini-3.6-flash</code> | 4 | 7 | 2 | 220 |
| <code>groq-whisper-large-v3</code> | 3 | 7 | 2 | 220 |
| <code>groq-whisper-large-v3-turbo</code> | 2 | 7 | 2 | 220 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 7 | 5 | 3 | 220 |
| <code>together-openai_whisper-large-v3</code> | 2 | 9 | 0 | 220 |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>deepinfra-openai_whisper-large-v3</code> | 0 | 24 | 0 | 216 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 0 | 24 | 2 | 216 |
| <code>gemini-stt-gemini-3.6-flash</code> | 3 | 4 | 2 | 216 |
| <code>groq-whisper-large-v3</code> | 2 | 4 | 2 | 216 |
| <code>groq-whisper-large-v3-turbo</code> | 1 | 4 | 2 | 216 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 6 | 2 | 3 | 216 |
| <code>together-openai_whisper-large-v3</code> | 1 | 6 | 0 | 216 |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `groq-whisper-large-v3-turbo` was the most accurate provider on strict speaker-aware WER, scoring 95.00/100.
- `together-nvidia_parakeet-tdt-0.6b-v3` was the fastest provider in this set at 0.72s.
- `groq-whisper-large-v3-turbo` lost the most ground once speaker changes were counted, with 1.76 percentage-point gap between text-only and speaker-aware WER.
