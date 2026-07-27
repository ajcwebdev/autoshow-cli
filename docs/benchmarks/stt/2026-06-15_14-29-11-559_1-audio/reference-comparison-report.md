# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/stt/2026-06-15_14-29-11-559_1-audio`
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
| 1 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | $0.0002 | 87.38 | 12.62% | 10.95% | not-supported | 5.31s | $0.0002 |
| 2 | <code>deepinfra-openai_whisper-large-v3</code> | $0.0004 | 95.79 | 4.21% | 2.38% | not-supported | 3.29s | $0.0004 |
| 3 | <code>groq-whisper-large-v3-turbo</code> | $0.0007 | 93.46 | 6.54% | 4.76% | not-supported | 1.16s | $0.0007 |
| 4 | <code>together-openai_whisper-large-v3</code> | $0.0015 | 95.33 | 4.67% | 2.86% | not-supported | 1.44s | $0.0015 |
| 5 | <code>groq-whisper-large-v3</code> | $0.0018 | 92.99 | 7.01% | 5.24% | not-supported | 1.88s | $0.0018 |
| 6 | <code>gemini-stt-gemini-3-flash-preview</code> | $0.0100 | 93.46 | 6.54% | 4.76% | not-supported | 13.24s | $0.0100 |
| 7 | <code>supadata-auto</code> | $0.0200 | 92.52 | 7.48% | 5.71% | not-supported | 4.36s | $0.0200 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>groq-whisper-large-v3-turbo</code> | 1.16s | 93.46 | 6.54% | 4.76% | not-supported | 1.16s | $0.0007 |
| 2 | <code>together-openai_whisper-large-v3</code> | 1.44s | 95.33 | 4.67% | 2.86% | not-supported | 1.44s | $0.0015 |
| 3 | <code>groq-whisper-large-v3</code> | 1.88s | 92.99 | 7.01% | 5.24% | not-supported | 1.88s | $0.0018 |
| 4 | <code>deepinfra-openai_whisper-large-v3</code> | 3.29s | 95.79 | 4.21% | 2.38% | not-supported | 3.29s | $0.0004 |
| 5 | <code>supadata-auto</code> | 4.36s | 92.52 | 7.48% | 5.71% | not-supported | 4.36s | $0.0200 |
| 6 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 5.31s | 87.38 | 12.62% | 10.95% | not-supported | 5.31s | $0.0002 |
| 7 | <code>gemini-stt-gemini-3-flash-preview</code> | 13.24s | 93.46 | 6.54% | 4.76% | not-supported | 13.24s | $0.0100 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>deepinfra-openai_whisper-large-v3</code> | 95.79/100 quality score | 95.79 | 4.21% | 2.38% | not-supported | 3.29s | $0.0004 |
| 2 | <code>together-openai_whisper-large-v3</code> | 95.33/100 quality score | 95.33 | 4.67% | 2.86% | not-supported | 1.44s | $0.0015 |
| 3 | <code>gemini-stt-gemini-3-flash-preview</code> | 93.46/100 quality score | 93.46 | 6.54% | 4.76% | not-supported | 13.24s | $0.0100 |
| 4 | <code>groq-whisper-large-v3-turbo</code> | 93.46/100 quality score | 93.46 | 6.54% | 4.76% | not-supported | 1.16s | $0.0007 |
| 5 | <code>groq-whisper-large-v3</code> | 92.99/100 quality score | 92.99 | 7.01% | 5.24% | not-supported | 1.88s | $0.0018 |
| 6 | <code>supadata-auto</code> | 92.52/100 quality score | 92.52 | 7.48% | 5.71% | not-supported | 4.36s | $0.0200 |
| 7 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 87.38/100 quality score | 87.38 | 12.62% | 10.95% | not-supported | 5.31s | $0.0002 |

### Third-Party Service Diarization

#### Price

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>grok-speech-to-text</code> | $0.0017 | 83.64 | 16.36% | 16.67% | supported | 1.78s | $0.0017 |
| 2 | <code>soniox-stt-async-v4</code> | $0.0017 | 97.20 | 2.80% | 2.86% | supported | 7.75s | $0.0017 |
| 3 | <code>rev-low_cost</code> | $0.0017 | 90.65 | 9.35% | 8.57% | supported | 45.34s | $0.0017 |
| 4 | <code>mistral-voxtral-mini-2602</code> | $0.0020 | 97.66 | 2.34% | 2.38% | supported | 4.49s | $0.0020 |
| 5 | <code>rev-machine</code> | $0.0033 | 91.59 | 8.41% | 7.62% | supported | 35.32s | $0.0033 |
| 6 | <code>assemblyai-universal-3-pro</code> | $0.0035 | 95.79 | 4.21% | 4.29% | supported | 8.34s | $0.0035 |
| 7 | <code>deepgram-nova-3</code> | $0.0096 | 92.99 | 7.01% | 5.24% | supported | 3.26s | $0.0096 |
| 8 | <code>happyscribe-auto</code> | $0.0099 | 95.33 | 4.67% | 4.76% | supported | 50.29s | $0.0099 |
| 9 | <code>gladia-default</code> | $0.0101 | 93.93 | 6.07% | 5.24% | supported | 10.57s | $0.0101 |
| 10 | <code>speechmatics-enhanced</code> | $0.0124 | 96.26 | 3.74% | 3.81% | supported | 27.40s | $0.0124 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>grok-speech-to-text</code> | 1.78s | 83.64 | 16.36% | 16.67% | supported | 1.78s | $0.0017 |
| 2 | <code>deepgram-nova-3</code> | 3.26s | 92.99 | 7.01% | 5.24% | supported | 3.26s | $0.0096 |
| 3 | <code>mistral-voxtral-mini-2602</code> | 4.49s | 97.66 | 2.34% | 2.38% | supported | 4.49s | $0.0020 |
| 4 | <code>soniox-stt-async-v4</code> | 7.75s | 97.20 | 2.80% | 2.86% | supported | 7.75s | $0.0017 |
| 5 | <code>assemblyai-universal-3-pro</code> | 8.34s | 95.79 | 4.21% | 4.29% | supported | 8.34s | $0.0035 |
| 6 | <code>gladia-default</code> | 10.57s | 93.93 | 6.07% | 5.24% | supported | 10.57s | $0.0101 |
| 7 | <code>speechmatics-enhanced</code> | 27.40s | 96.26 | 3.74% | 3.81% | supported | 27.40s | $0.0124 |
| 8 | <code>rev-machine</code> | 35.32s | 91.59 | 8.41% | 7.62% | supported | 35.32s | $0.0033 |
| 9 | <code>rev-low_cost</code> | 45.34s | 90.65 | 9.35% | 8.57% | supported | 45.34s | $0.0017 |
| 10 | <code>happyscribe-auto</code> | 50.29s | 95.33 | 4.67% | 4.76% | supported | 50.29s | $0.0099 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>mistral-voxtral-mini-2602</code> | 97.66/100 quality score | 97.66 | 2.34% | 2.38% | supported | 4.49s | $0.0020 |
| 2 | <code>soniox-stt-async-v4</code> | 97.20/100 quality score | 97.20 | 2.80% | 2.86% | supported | 7.75s | $0.0017 |
| 3 | <code>speechmatics-enhanced</code> | 96.26/100 quality score | 96.26 | 3.74% | 3.81% | supported | 27.40s | $0.0124 |
| 4 | <code>assemblyai-universal-3-pro</code> | 95.79/100 quality score | 95.79 | 4.21% | 4.29% | supported | 8.34s | $0.0035 |
| 5 | <code>happyscribe-auto</code> | 95.33/100 quality score | 95.33 | 4.67% | 4.76% | supported | 50.29s | $0.0099 |
| 6 | <code>gladia-default</code> | 93.93/100 quality score | 93.93 | 6.07% | 5.24% | supported | 10.57s | $0.0101 |
| 7 | <code>deepgram-nova-3</code> | 92.99/100 quality score | 92.99 | 7.01% | 5.24% | supported | 3.26s | $0.0096 |
| 8 | <code>rev-machine</code> | 91.59/100 quality score | 91.59 | 8.41% | 7.62% | supported | 35.32s | $0.0033 |
| 9 | <code>rev-low_cost</code> | 90.65/100 quality score | 90.65 | 9.35% | 8.57% | supported | 45.34s | $0.0017 |
| 10 | <code>grok-speech-to-text</code> | 83.64/100 quality score | 83.64 | 16.36% | 16.67% | supported | 1.78s | $0.0017 |


## Provider Detail

| Provider | Group | Diarization | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Actual Cost |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| <code>assemblyai-universal-3-pro</code> | Third-Party Service Diarization | supported | 95.79 | 4.21% | 4.29% | 8.34s | $0.0035 |
| <code>deepgram-nova-3</code> | Third-Party Service Diarization | supported | 92.99 | 7.01% | 5.24% | 3.26s | $0.0096 |
| <code>deepinfra-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 95.79 | 4.21% | 2.38% | 3.29s | $0.0004 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 87.38 | 12.62% | 10.95% | 5.31s | $0.0002 |
| <code>gemini-stt-gemini-3-flash-preview</code> | Third-Party Service Non-Diarization | not-supported | 93.46 | 6.54% | 4.76% | 13.24s | $0.0100 |
| <code>gladia-default</code> | Third-Party Service Diarization | supported | 93.93 | 6.07% | 5.24% | 10.57s | $0.0101 |
| <code>grok-speech-to-text</code> | Third-Party Service Diarization | supported | 83.64 | 16.36% | 16.67% | 1.78s | $0.0017 |
| <code>groq-whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 92.99 | 7.01% | 5.24% | 1.88s | $0.0018 |
| <code>groq-whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 93.46 | 6.54% | 4.76% | 1.16s | $0.0007 |
| <code>happyscribe-auto</code> | Third-Party Service Diarization | supported | 95.33 | 4.67% | 4.76% | 50.29s | $0.0099 |
| <code>mistral-voxtral-mini-2602</code> | Third-Party Service Diarization | supported | 97.66 | 2.34% | 2.38% | 4.49s | $0.0020 |
| <code>rev-low_cost</code> | Third-Party Service Diarization | supported | 90.65 | 9.35% | 8.57% | 45.34s | $0.0017 |
| <code>rev-machine</code> | Third-Party Service Diarization | supported | 91.59 | 8.41% | 7.62% | 35.32s | $0.0033 |
| <code>soniox-stt-async-v4</code> | Third-Party Service Diarization | supported | 97.20 | 2.80% | 2.86% | 7.75s | $0.0017 |
| <code>speechmatics-enhanced</code> | Third-Party Service Diarization | supported | 96.26 | 3.74% | 3.81% | 27.40s | $0.0124 |
| <code>supadata-auto</code> | Third-Party Service Non-Diarization | not-supported | 92.52 | 7.48% | 5.71% | 4.36s | $0.0200 |
| <code>together-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 95.33 | 4.67% | 2.86% | 1.44s | $0.0015 |

## Error Breakdown (Speaker-aware)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>assemblyai-universal-3-pro</code> | 1 | 1 | 7 | 214 |
| <code>deepgram-nova-3</code> | 6 | 6 | 3 | 214 |
| <code>deepinfra-openai_whisper-large-v3</code> | 3 | 5 | 1 | 214 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 2 | 22 | 3 | 214 |
| <code>gemini-stt-gemini-3-flash-preview</code> | 4 | 4 | 6 | 214 |
| <code>gladia-default</code> | 2 | 3 | 8 | 214 |
| <code>grok-speech-to-text</code> | 7 | 18 | 10 | 214 |
| <code>groq-whisper-large-v3</code> | 4 | 5 | 6 | 214 |
| <code>groq-whisper-large-v3-turbo</code> | 3 | 5 | 6 | 214 |
| <code>happyscribe-auto</code> | 2 | 1 | 7 | 214 |
| <code>mistral-voxtral-mini-2602</code> | 2 | 2 | 1 | 214 |
| <code>rev-low_cost</code> | 9 | 2 | 9 | 214 |
| <code>rev-machine</code> | 8 | 1 | 9 | 214 |
| <code>soniox-stt-async-v4</code> | 2 | 2 | 2 | 214 |
| <code>speechmatics-enhanced</code> | 3 | 1 | 4 | 214 |
| <code>supadata-auto</code> | 4 | 4 | 8 | 214 |
| <code>together-openai_whisper-large-v3</code> | 3 | 6 | 1 | 214 |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>assemblyai-universal-3-pro</code> | 1 | 1 | 7 | 210 |
| <code>deepgram-nova-3</code> | 6 | 3 | 2 | 210 |
| <code>deepinfra-openai_whisper-large-v3</code> | 2 | 2 | 1 | 210 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 1 | 19 | 3 | 210 |
| <code>gemini-stt-gemini-3-flash-preview</code> | 3 | 1 | 6 | 210 |
| <code>gladia-default</code> | 2 | 2 | 7 | 210 |
| <code>grok-speech-to-text</code> | 7 | 18 | 10 | 210 |
| <code>groq-whisper-large-v3</code> | 3 | 2 | 6 | 210 |
| <code>groq-whisper-large-v3-turbo</code> | 2 | 2 | 6 | 210 |
| <code>happyscribe-auto</code> | 2 | 1 | 7 | 210 |
| <code>mistral-voxtral-mini-2602</code> | 2 | 2 | 1 | 210 |
| <code>rev-low_cost</code> | 7 | 2 | 9 | 210 |
| <code>rev-machine</code> | 6 | 1 | 9 | 210 |
| <code>soniox-stt-async-v4</code> | 2 | 2 | 2 | 210 |
| <code>speechmatics-enhanced</code> | 3 | 1 | 4 | 210 |
| <code>supadata-auto</code> | 3 | 1 | 8 | 210 |
| <code>together-openai_whisper-large-v3</code> | 2 | 3 | 1 | 210 |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `mistral-voxtral-mini-2602` was the most accurate provider on strict speaker-aware WER, scoring 97.66/100.
- `groq-whisper-large-v3-turbo` was the fastest provider in this set at 1.16s.
- `deepinfra-openai_whisper-large-v3` lost the most ground once speaker changes were counted, with 1.82 percentage-point gap between text-only and speaker-aware WER.
