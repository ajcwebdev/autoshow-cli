# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/stt/2026-06-15_14-34-10-342_2023-04-05-jsjam-react-miami-2023-10-minutes`
- Total providers: 17 (0 local, 17 third-party service)
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

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

### Third-Party Service Non-Diarization

#### Price

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | $0.0020 | 89.79 | 10.21% | 9.59% | not-supported | 10.20s | $0.0020 |
| 2 | <code>deepinfra-openai_whisper-large-v3</code> | $0.0045 | 93.75 | 6.25% | 5.30% | not-supported | 13.87s | $0.0045 |
| 3 | <code>groq-whisper-large-v3-turbo</code> | $0.0067 | 92.86 | 7.14% | 6.32% | not-supported | 7.24s | $0.0067 |
| 4 | <code>together-openai_whisper-large-v3</code> | $0.0150 | 93.92 | 6.08% | 5.13% | not-supported | 2.08s | $0.0150 |
| 5 | <code>groq-whisper-large-v3</code> | $0.0185 | 93.51 | 6.49% | 5.54% | not-supported | 10.68s | $0.0185 |
| 6 | <code>gemini-stt-gemini-3-flash-preview</code> | $0.0373 | 94.51 | 5.49% | 4.83% | not-supported | 33.49s | $0.0373 |
| 7 | <code>supadata-auto</code> | $0.0400 | 81.18 | 18.82% | 18.06% | not-supported | 11.30s | $0.0400 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>together-openai_whisper-large-v3</code> | 2.08s | 93.92 | 6.08% | 5.13% | not-supported | 2.08s | $0.0150 |
| 2 | <code>groq-whisper-large-v3-turbo</code> | 7.24s | 92.86 | 7.14% | 6.32% | not-supported | 7.24s | $0.0067 |
| 3 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 10.20s | 89.79 | 10.21% | 9.59% | not-supported | 10.20s | $0.0020 |
| 4 | <code>groq-whisper-large-v3</code> | 10.68s | 93.51 | 6.49% | 5.54% | not-supported | 10.68s | $0.0185 |
| 5 | <code>supadata-auto</code> | 11.30s | 81.18 | 18.82% | 18.06% | not-supported | 11.30s | $0.0400 |
| 6 | <code>deepinfra-openai_whisper-large-v3</code> | 13.87s | 93.75 | 6.25% | 5.30% | not-supported | 13.87s | $0.0045 |
| 7 | <code>gemini-stt-gemini-3-flash-preview</code> | 33.49s | 94.51 | 5.49% | 4.83% | not-supported | 33.49s | $0.0373 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>gemini-stt-gemini-3-flash-preview</code> | 94.51/100 quality score | 94.51 | 5.49% | 4.83% | not-supported | 33.49s | $0.0373 |
| 2 | <code>together-openai_whisper-large-v3</code> | 93.92/100 quality score | 93.92 | 6.08% | 5.13% | not-supported | 2.08s | $0.0150 |
| 3 | <code>deepinfra-openai_whisper-large-v3</code> | 93.75/100 quality score | 93.75 | 6.25% | 5.30% | not-supported | 13.87s | $0.0045 |
| 4 | <code>groq-whisper-large-v3</code> | 93.51/100 quality score | 93.51 | 6.49% | 5.54% | not-supported | 10.68s | $0.0185 |
| 5 | <code>groq-whisper-large-v3-turbo</code> | 92.86/100 quality score | 92.86 | 7.14% | 6.32% | not-supported | 7.24s | $0.0067 |
| 6 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 89.79/100 quality score | 89.79 | 10.21% | 9.59% | not-supported | 10.20s | $0.0020 |
| 7 | <code>supadata-auto</code> | 81.18/100 quality score | 81.18 | 18.82% | 18.06% | not-supported | 11.30s | $0.0400 |

### Third-Party Service Diarization

#### Price

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>grok-speech-to-text</code> | $0.0167 | 92.63 | 7.37% | 7.15% | supported | 7.32s | $0.0167 |
| 2 | <code>rev-low_cost</code> | $0.0167 | 95.04 | 4.96% | 4.89% | supported | 86.36s | $0.0167 |
| 3 | <code>soniox-stt-async-v4</code> | $0.0167 | 95.52 | 4.48% | 3.99% | supported | 26.33s | $0.0167 |
| 4 | <code>mistral-voxtral-mini-2602</code> | $0.0200 | 94.75 | 5.25% | 5.01% | supported | 11.58s | $0.0200 |
| 5 | <code>rev-machine</code> | $0.0333 | 95.58 | 4.42% | 4.35% | supported | 96.24s | $0.0333 |
| 6 | <code>assemblyai-universal-3-pro</code> | $0.0350 | 96.05 | 3.95% | 3.16% | supported | 17.30s | $0.0350 |
| 7 | <code>deepgram-nova-3</code> | $0.0970 | 94.69 | 5.31% | 4.95% | supported | 3.06s | $0.0970 |
| 8 | <code>happyscribe-auto</code> | $0.1000 | 96.52 | 3.48% | 2.80% | supported | 61.78s | $0.1000 |
| 9 | <code>gladia-default</code> | $0.1017 | 93.04 | 6.96% | 6.62% | supported | 31.55s | $0.1017 |
| 10 | <code>speechmatics-enhanced</code> | $0.1250 | 95.10 | 4.90% | 4.59% | supported | 38.65s | $0.1250 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>deepgram-nova-3</code> | 3.06s | 94.69 | 5.31% | 4.95% | supported | 3.06s | $0.0970 |
| 2 | <code>grok-speech-to-text</code> | 7.32s | 92.63 | 7.37% | 7.15% | supported | 7.32s | $0.0167 |
| 3 | <code>mistral-voxtral-mini-2602</code> | 11.58s | 94.75 | 5.25% | 5.01% | supported | 11.58s | $0.0200 |
| 4 | <code>assemblyai-universal-3-pro</code> | 17.30s | 96.05 | 3.95% | 3.16% | supported | 17.30s | $0.0350 |
| 5 | <code>soniox-stt-async-v4</code> | 26.33s | 95.52 | 4.48% | 3.99% | supported | 26.33s | $0.0167 |
| 6 | <code>gladia-default</code> | 31.55s | 93.04 | 6.96% | 6.62% | supported | 31.55s | $0.1017 |
| 7 | <code>speechmatics-enhanced</code> | 38.65s | 95.10 | 4.90% | 4.59% | supported | 38.65s | $0.1250 |
| 8 | <code>happyscribe-auto</code> | 61.78s | 96.52 | 3.48% | 2.80% | supported | 61.78s | $0.1000 |
| 9 | <code>rev-low_cost</code> | 86.36s | 95.04 | 4.96% | 4.89% | supported | 86.36s | $0.0167 |
| 10 | <code>rev-machine</code> | 96.24s | 95.58 | 4.42% | 4.35% | supported | 96.24s | $0.0333 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>happyscribe-auto</code> | 96.52/100 quality score | 96.52 | 3.48% | 2.80% | supported | 61.78s | $0.1000 |
| 2 | <code>assemblyai-universal-3-pro</code> | 96.05/100 quality score | 96.05 | 3.95% | 3.16% | supported | 17.30s | $0.0350 |
| 3 | <code>rev-machine</code> | 95.58/100 quality score | 95.58 | 4.42% | 4.35% | supported | 96.24s | $0.0333 |
| 4 | <code>soniox-stt-async-v4</code> | 95.52/100 quality score | 95.52 | 4.48% | 3.99% | supported | 26.33s | $0.0167 |
| 5 | <code>speechmatics-enhanced</code> | 95.10/100 quality score | 95.10 | 4.90% | 4.59% | supported | 38.65s | $0.1250 |
| 6 | <code>rev-low_cost</code> | 95.04/100 quality score | 95.04 | 4.96% | 4.89% | supported | 86.36s | $0.0167 |
| 7 | <code>mistral-voxtral-mini-2602</code> | 94.75/100 quality score | 94.75 | 5.25% | 5.01% | supported | 11.58s | $0.0200 |
| 8 | <code>deepgram-nova-3</code> | 94.69/100 quality score | 94.69 | 5.31% | 4.95% | supported | 3.06s | $0.0970 |
| 9 | <code>gladia-default</code> | 93.04/100 quality score | 93.04 | 6.96% | 6.62% | supported | 31.55s | $0.1017 |
| 10 | <code>grok-speech-to-text</code> | 92.63/100 quality score | 92.63 | 7.37% | 7.15% | supported | 7.32s | $0.0167 |


## Provider Detail

| Provider | Group | Diarization | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Actual Cost |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>assemblyai-universal-3-pro</code> | Third-Party Service Diarization | supported | 96.05 | 3.95% | 3.16% | 17.30s | $0.0350 |
| <code>deepgram-nova-3</code> | Third-Party Service Diarization | supported | 94.69 | 5.31% | 4.95% | 3.06s | $0.0970 |
| <code>deepinfra-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 93.75 | 6.25% | 5.30% | 13.87s | $0.0045 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 89.79 | 10.21% | 9.59% | 10.20s | $0.0020 |
| <code>gemini-stt-gemini-3-flash-preview</code> | Third-Party Service Non-Diarization | not-supported | 94.51 | 5.49% | 4.83% | 33.49s | $0.0373 |
| <code>gladia-default</code> | Third-Party Service Diarization | supported | 93.04 | 6.96% | 6.62% | 31.55s | $0.1017 |
| <code>grok-speech-to-text</code> | Third-Party Service Diarization | supported | 92.63 | 7.37% | 7.15% | 7.32s | $0.0167 |
| <code>groq-whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 93.51 | 6.49% | 5.54% | 10.68s | $0.0185 |
| <code>groq-whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 92.86 | 7.14% | 6.32% | 7.24s | $0.0067 |
| <code>happyscribe-auto</code> | Third-Party Service Diarization | supported | 96.52 | 3.48% | 2.80% | 61.78s | $0.1000 |
| <code>mistral-voxtral-mini-2602</code> | Third-Party Service Diarization | supported | 94.75 | 5.25% | 5.01% | 11.58s | $0.0200 |
| <code>rev-low_cost</code> | Third-Party Service Diarization | supported | 95.04 | 4.96% | 4.89% | 86.36s | $0.0167 |
| <code>rev-machine</code> | Third-Party Service Diarization | supported | 95.58 | 4.42% | 4.35% | 96.24s | $0.0333 |
| <code>soniox-stt-async-v4</code> | Third-Party Service Diarization | supported | 95.52 | 4.48% | 3.99% | 26.33s | $0.0167 |
| <code>speechmatics-enhanced</code> | Third-Party Service Diarization | supported | 95.10 | 4.90% | 4.59% | 38.65s | $0.1250 |
| <code>supadata-auto</code> | Third-Party Service Non-Diarization | not-supported | 81.18 | 18.82% | 18.06% | 11.30s | $0.0400 |
| <code>together-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 93.92 | 6.08% | 5.13% | 2.08s | $0.0150 |

## Error Breakdown (Speaker-aware)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>assemblyai-universal-3-pro</code> | 20 | 31 | 16 | 1695 |
| <code>deepgram-nova-3</code> | 30 | 25 | 35 | 1695 |
| <code>deepinfra-openai_whisper-large-v3</code> | 32 | 61 | 13 | 1695 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 42 | 111 | 20 | 1695 |
| <code>gemini-stt-gemini-3-flash-preview</code> | 33 | 26 | 34 | 1695 |
| <code>gladia-default</code> | 38 | 52 | 28 | 1695 |
| <code>grok-speech-to-text</code> | 35 | 63 | 27 | 1695 |
| <code>groq-whisper-large-v3</code> | 38 | 59 | 13 | 1695 |
| <code>groq-whisper-large-v3-turbo</code> | 35 | 69 | 17 | 1695 |
| <code>happyscribe-auto</code> | 12 | 31 | 16 | 1695 |
| <code>mistral-voxtral-mini-2602</code> | 26 | 44 | 19 | 1695 |
| <code>rev-low_cost</code> | 39 | 20 | 25 | 1695 |
| <code>rev-machine</code> | 35 | 13 | 27 | 1695 |
| <code>soniox-stt-async-v4</code> | 28 | 4 | 44 | 1695 |
| <code>speechmatics-enhanced</code> | 35 | 13 | 35 | 1695 |
| <code>supadata-auto</code> | 40 | 64 | 215 | 1695 |
| <code>together-openai_whisper-large-v3</code> | 30 | 57 | 16 | 1695 |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>assemblyai-universal-3-pro</code> | 17 | 27 | 9 | 1678 |
| <code>deepgram-nova-3</code> | 29 | 23 | 31 | 1678 |
| <code>deepinfra-openai_whisper-large-v3</code> | 29 | 46 | 14 | 1678 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 34 | 101 | 26 | 1678 |
| <code>gemini-stt-gemini-3-flash-preview</code> | 27 | 15 | 39 | 1678 |
| <code>gladia-default</code> | 35 | 51 | 25 | 1678 |
| <code>grok-speech-to-text</code> | 30 | 63 | 27 | 1678 |
| <code>groq-whisper-large-v3</code> | 35 | 44 | 14 | 1678 |
| <code>groq-whisper-large-v3-turbo</code> | 30 | 56 | 20 | 1678 |
| <code>happyscribe-auto</code> | 11 | 27 | 9 | 1678 |
| <code>mistral-voxtral-mini-2602</code> | 25 | 42 | 17 | 1678 |
| <code>rev-low_cost</code> | 37 | 20 | 25 | 1678 |
| <code>rev-machine</code> | 33 | 13 | 27 | 1678 |
| <code>soniox-stt-async-v4</code> | 27 | 4 | 36 | 1678 |
| <code>speechmatics-enhanced</code> | 33 | 13 | 31 | 1678 |
| <code>supadata-auto</code> | 36 | 50 | 217 | 1678 |
| <code>together-openai_whisper-large-v3</code> | 29 | 41 | 16 | 1678 |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `happyscribe-auto` was the most accurate provider on strict speaker-aware WER, scoring 96.52/100.
- `together-openai_whisper-large-v3` was the fastest provider in this set at 2.08s.
- `together-openai_whisper-large-v3` lost the most ground once speaker changes were counted, with 0.95 percentage-point gap between text-only and speaker-aware WER.
