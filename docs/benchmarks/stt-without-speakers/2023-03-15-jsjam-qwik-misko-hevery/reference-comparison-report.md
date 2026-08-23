# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/stt-without-speakers/2023-03-15-jsjam-qwik-misko-hevery`
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
| 1 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | $0.0226 | 90.29 | 9.71% | 9.32% | not-supported | 35.84s | 188.92× realtime | $0.0226 |
| 2 | <code>deepinfra-openai_whisper-large-v3</code> | $0.0508 | 89.99 | 10.01% | 9.63% | not-supported | 72.69s | 93.17× realtime | $0.0508 |
| 3 | <code>groq-whisper-large-v3-turbo</code> | $0.0752 | 94.06 | 5.94% | 5.47% | not-supported | 64.02s | 105.78× realtime | $0.0752 |
| 4 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | $0.1693 | 89.44 | 10.56% | 10.15% | not-supported | 51.46s | 131.61× realtime | $0.1693 |
| 5 | <code>together-openai_whisper-large-v3</code> | $0.1693 | 92.99 | 7.01% | 6.54% | not-supported | 27.59s | 245.47× realtime | $0.1693 |
| 6 | <code>groq-whisper-large-v3</code> | $0.2088 | 97.98 | 2.02% | 1.50% | not-supported | 65.16s | 103.93× realtime | $0.2088 |
| 7 | <code>gemini-stt-gemini-3.6-flash</code> | $1.1087 | 91.80 | 8.20% | 7.78% | not-supported | 473.40s | 14.31× realtime | $1.1087 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>together-openai_whisper-large-v3</code> | 27.59s | 92.99 | 7.01% | 6.54% | not-supported | 27.59s | 245.47× realtime | $0.1693 |
| 2 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 35.84s | 90.29 | 9.71% | 9.32% | not-supported | 35.84s | 188.92× realtime | $0.0226 |
| 3 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 51.46s | 89.44 | 10.56% | 10.15% | not-supported | 51.46s | 131.61× realtime | $0.1693 |
| 4 | <code>groq-whisper-large-v3-turbo</code> | 64.02s | 94.06 | 5.94% | 5.47% | not-supported | 64.02s | 105.78× realtime | $0.0752 |
| 5 | <code>groq-whisper-large-v3</code> | 65.16s | 97.98 | 2.02% | 1.50% | not-supported | 65.16s | 103.93× realtime | $0.2088 |
| 6 | <code>deepinfra-openai_whisper-large-v3</code> | 72.69s | 89.99 | 10.01% | 9.63% | not-supported | 72.69s | 93.17× realtime | $0.0508 |
| 7 | <code>gemini-stt-gemini-3.6-flash</code> | 473.40s | 91.80 | 8.20% | 7.78% | not-supported | 473.40s | 14.31× realtime | $1.1087 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>groq-whisper-large-v3</code> | 97.98/100 quality score | 97.98 | 2.02% | 1.50% | not-supported | 65.16s | 103.93× realtime | $0.2088 |
| 2 | <code>groq-whisper-large-v3-turbo</code> | 94.06/100 quality score | 94.06 | 5.94% | 5.47% | not-supported | 64.02s | 105.78× realtime | $0.0752 |
| 3 | <code>together-openai_whisper-large-v3</code> | 92.99/100 quality score | 92.99 | 7.01% | 6.54% | not-supported | 27.59s | 245.47× realtime | $0.1693 |
| 4 | <code>gemini-stt-gemini-3.6-flash</code> | 91.80/100 quality score | 91.80 | 8.20% | 7.78% | not-supported | 473.40s | 14.31× realtime | $1.1087 |
| 5 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 90.29/100 quality score | 90.29 | 9.71% | 9.32% | not-supported | 35.84s | 188.92× realtime | $0.0226 |
| 6 | <code>deepinfra-openai_whisper-large-v3</code> | 89.99/100 quality score | 89.99 | 10.01% | 9.63% | not-supported | 72.69s | 93.17× realtime | $0.0508 |
| 7 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 89.44/100 quality score | 89.44 | 10.56% | 10.15% | not-supported | 51.46s | 131.61× realtime | $0.1693 |

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
| <code>deepinfra-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 89.99 | 10.01% | 9.63% | 72.69s | 93.17× realtime | $0.0508 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 90.29 | 9.71% | 9.32% | 35.84s | 188.92× realtime | $0.0226 |
| <code>gemini-stt-gemini-3.6-flash</code> | Third-Party Service Non-Diarization | not-supported | 91.80 | 8.20% | 7.78% | 473.40s | 14.31× realtime | $1.1087 |
| <code>groq-whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 97.98 | 2.02% | 1.50% | 65.16s | 103.93× realtime | $0.2088 |
| <code>groq-whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 94.06 | 5.94% | 5.47% | 64.02s | 105.78× realtime | $0.0752 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | Third-Party Service Non-Diarization | not-supported | 89.44 | 10.56% | 10.15% | 51.46s | 131.61× realtime | $0.1693 |
| <code>together-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 92.99 | 7.01% | 6.54% | 27.59s | 245.47× realtime | $0.1693 |

## Error Breakdown (Speaker-aware)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>deepinfra-openai_whisper-large-v3</code> | -1 | -1 | -1 | 19853 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | -1 | -1 | -1 | 19853 |
| <code>gemini-stt-gemini-3.6-flash</code> | -1 | -1 | -1 | 19853 |
| <code>groq-whisper-large-v3</code> | -1 | -1 | -1 | 19853 |
| <code>groq-whisper-large-v3-turbo</code> | -1 | -1 | -1 | 19853 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | -1 | -1 | -1 | 19853 |
| <code>together-openai_whisper-large-v3</code> | -1 | -1 | -1 | 19853 |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>deepinfra-openai_whisper-large-v3</code> | -1 | -1 | -1 | 19748 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | -1 | -1 | -1 | 19748 |
| <code>gemini-stt-gemini-3.6-flash</code> | -1 | -1 | -1 | 19748 |
| <code>groq-whisper-large-v3</code> | -1 | -1 | -1 | 19748 |
| <code>groq-whisper-large-v3-turbo</code> | -1 | -1 | -1 | 19748 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | -1 | -1 | -1 | 19748 |
| <code>together-openai_whisper-large-v3</code> | -1 | -1 | -1 | 19748 |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `groq-whisper-large-v3` was the most accurate provider on strict speaker-aware WER, scoring 97.98/100.
- `together-openai_whisper-large-v3` was the fastest provider in this set at 27.59s.
- `groq-whisper-large-v3` lost the most ground once speaker changes were counted, with 0.52 percentage-point gap between text-only and speaker-aware WER.
