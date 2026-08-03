# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/stt/2026-07-16_01-20-11-985_2024-04-10-autogen-shownotes-jenn-junod`
- Total providers: 23 (0 local, 23 third-party service)
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
| 1 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | $0.0136 | 89.01 | 10.99% | 9.23% | not-supported | 66.18s | 61.71× realtime | $0.0136 |
| 2 | <code>deepinfra-openai_whisper-large-v3</code> | $0.0306 | 91.28 | 8.72% | 6.66% | not-supported | 76.25s | 53.56× realtime | $0.0306 |
| 3 | <code>groq-whisper-large-v3-turbo</code> | $0.0454 | 91.15 | 8.85% | 6.85% | not-supported | 24.11s | 169.39× realtime | $0.0454 |
| 4 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | $0.1021 | 90.39 | 9.61% | 7.72% | not-supported | 4.50s | 907.56× realtime | $0.1021 |
| 5 | <code>together-openai_whisper-large-v3</code> | $0.1021 | 89.96 | 10.04% | 8.09% | not-supported | 11.64s | 350.74× realtime | $0.1021 |
| 6 | <code>groq-whisper-large-v3</code> | $0.1259 | 91.02 | 8.98% | 6.95% | not-supported | 41.43s | 98.57× realtime | $0.1259 |
| 7 | <code>gemini-stt-gemini-3-flash-preview</code> | $0.2827 | 90.00 | 10.00% | 8.31% | not-supported | 255.74s | 15.97× realtime | $0.2827 |
| 8 | <code>gemini-stt-gemini-3.6-flash</code> | $0.6403 | 61.54 | 38.46% | 37.44% | not-supported | 269.11s | 15.18× realtime | $0.6403 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 4.50s | 90.39 | 9.61% | 7.72% | not-supported | 4.50s | 907.56× realtime | $0.1021 |
| 2 | <code>together-openai_whisper-large-v3</code> | 11.64s | 89.96 | 10.04% | 8.09% | not-supported | 11.64s | 350.74× realtime | $0.1021 |
| 3 | <code>groq-whisper-large-v3-turbo</code> | 24.11s | 91.15 | 8.85% | 6.85% | not-supported | 24.11s | 169.39× realtime | $0.0454 |
| 4 | <code>groq-whisper-large-v3</code> | 41.43s | 91.02 | 8.98% | 6.95% | not-supported | 41.43s | 98.57× realtime | $0.1259 |
| 5 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 66.18s | 89.01 | 10.99% | 9.23% | not-supported | 66.18s | 61.71× realtime | $0.0136 |
| 6 | <code>deepinfra-openai_whisper-large-v3</code> | 76.25s | 91.28 | 8.72% | 6.66% | not-supported | 76.25s | 53.56× realtime | $0.0306 |
| 7 | <code>gemini-stt-gemini-3-flash-preview</code> | 255.74s | 90.00 | 10.00% | 8.31% | not-supported | 255.74s | 15.97× realtime | $0.2827 |
| 8 | <code>gemini-stt-gemini-3.6-flash</code> | 269.11s | 61.54 | 38.46% | 37.44% | not-supported | 269.11s | 15.18× realtime | $0.6403 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>deepinfra-openai_whisper-large-v3</code> | 91.28/100 quality score | 91.28 | 8.72% | 6.66% | not-supported | 76.25s | 53.56× realtime | $0.0306 |
| 2 | <code>groq-whisper-large-v3-turbo</code> | 91.15/100 quality score | 91.15 | 8.85% | 6.85% | not-supported | 24.11s | 169.39× realtime | $0.0454 |
| 3 | <code>groq-whisper-large-v3</code> | 91.02/100 quality score | 91.02 | 8.98% | 6.95% | not-supported | 41.43s | 98.57× realtime | $0.1259 |
| 4 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 90.39/100 quality score | 90.39 | 9.61% | 7.72% | not-supported | 4.50s | 907.56× realtime | $0.1021 |
| 5 | <code>gemini-stt-gemini-3-flash-preview</code> | 90.00/100 quality score | 90.00 | 10.00% | 8.31% | not-supported | 255.74s | 15.97× realtime | $0.2827 |
| 6 | <code>together-openai_whisper-large-v3</code> | 89.96/100 quality score | 89.96 | 10.04% | 8.09% | not-supported | 11.64s | 350.74× realtime | $0.1021 |
| 7 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 89.01/100 quality score | 89.01 | 10.99% | 9.23% | not-supported | 66.18s | 61.71× realtime | $0.0136 |
| 8 | <code>gemini-stt-gemini-3.6-flash</code> | 61.54/100 quality score | 61.54 | 38.46% | 37.44% | not-supported | 269.11s | 15.18× realtime | $0.6403 |

### Third-Party Service Diarization

#### Price

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>happyscribe-auto</code> | $0.00 | 96.21 | 3.79% | 3.55% | supported | 107.65s | 37.94× realtime | $0.00 |
| 2 | <code>grok-speech-to-text</code> | $0.1134 | 88.44 | 11.56% | 10.10% | supported | 68.10s | 59.97× realtime | $0.1134 |
| 3 | <code>rev-low_cost</code> | $0.1134 | 88.61 | 11.39% | 9.96% | supported | 243.36s | 16.78× realtime | $0.1134 |
| 4 | <code>soniox-stt-async-v4</code> | $0.1134 | 92.45 | 7.55% | 6.28% | supported | 193.76s | 21.08× realtime | $0.1134 |
| 5 | <code>soniox-stt-async-v5</code> | $0.1134 | 92.53 | 7.47% | 6.29% | supported | 259.00s | 15.77× realtime | $0.1134 |
| 6 | <code>mistral-voxtral-mini-2602</code> | $0.1361 | 91.85 | 8.15% | 7.07% | supported | 40.51s | 100.81× realtime | $0.1361 |
| 7 | <code>assemblyai-universal-2</code> | $0.1929 | 91.57 | 8.43% | 7.39% | supported | 31.75s | 128.63× realtime | $0.1929 |
| 8 | <code>rev-machine</code> | $0.2269 | 89.16 | 10.84% | 9.38% | supported | 122.27s | 33.40× realtime | $0.2269 |
| 9 | <code>assemblyai-universal-3-pro</code> | $0.2382 | 97.20 | 2.80% | 2.78% | supported | 43.13s | 94.69× realtime | $0.2382 |
| 10 | <code>assemblyai-universal-3-5-pro</code> | $0.2609 | 94.22 | 5.78% | 4.78% | supported | 30.40s | 134.36× realtime | $0.2609 |
| 11 | <code>deepgram-nova-3</code> | $0.6602 | 87.93 | 12.07% | 10.50% | supported | 21.96s | 185.94× realtime | $0.6602 |
| 12 | <code>gladia-default</code> | $0.6920 | 91.37 | 8.63% | 7.05% | supported | 45.53s | 89.70× realtime | $0.6920 |
| 13 | <code>gladia-solaria-1</code> | $0.6920 | 91.51 | 8.49% | 7.03% | supported | 42.31s | 96.53× realtime | $0.6920 |
| 14 | <code>gladia-solaria-3</code> | $0.6920 | 92.27 | 7.73% | 6.40% | supported | 50.14s | 81.46× realtime | $0.6920 |
| 15 | <code>speechmatics-enhanced</code> | $0.8508 | 90.84 | 9.16% | 7.64% | supported | 130.13s | 31.38× realtime | $0.8508 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>deepgram-nova-3</code> | 21.96s | 87.93 | 12.07% | 10.50% | supported | 21.96s | 185.94× realtime | $0.6602 |
| 2 | <code>assemblyai-universal-3-5-pro</code> | 30.40s | 94.22 | 5.78% | 4.78% | supported | 30.40s | 134.36× realtime | $0.2609 |
| 3 | <code>assemblyai-universal-2</code> | 31.75s | 91.57 | 8.43% | 7.39% | supported | 31.75s | 128.63× realtime | $0.1929 |
| 4 | <code>mistral-voxtral-mini-2602</code> | 40.51s | 91.85 | 8.15% | 7.07% | supported | 40.51s | 100.81× realtime | $0.1361 |
| 5 | <code>gladia-solaria-1</code> | 42.31s | 91.51 | 8.49% | 7.03% | supported | 42.31s | 96.53× realtime | $0.6920 |
| 6 | <code>assemblyai-universal-3-pro</code> | 43.13s | 97.20 | 2.80% | 2.78% | supported | 43.13s | 94.69× realtime | $0.2382 |
| 7 | <code>gladia-default</code> | 45.53s | 91.37 | 8.63% | 7.05% | supported | 45.53s | 89.70× realtime | $0.6920 |
| 8 | <code>gladia-solaria-3</code> | 50.14s | 92.27 | 7.73% | 6.40% | supported | 50.14s | 81.46× realtime | $0.6920 |
| 9 | <code>grok-speech-to-text</code> | 68.10s | 88.44 | 11.56% | 10.10% | supported | 68.10s | 59.97× realtime | $0.1134 |
| 10 | <code>happyscribe-auto</code> | 107.65s | 96.21 | 3.79% | 3.55% | supported | 107.65s | 37.94× realtime | $0.00 |
| 11 | <code>rev-machine</code> | 122.27s | 89.16 | 10.84% | 9.38% | supported | 122.27s | 33.40× realtime | $0.2269 |
| 12 | <code>speechmatics-enhanced</code> | 130.13s | 90.84 | 9.16% | 7.64% | supported | 130.13s | 31.38× realtime | $0.8508 |
| 13 | <code>soniox-stt-async-v4</code> | 193.76s | 92.45 | 7.55% | 6.28% | supported | 193.76s | 21.08× realtime | $0.1134 |
| 14 | <code>rev-low_cost</code> | 243.36s | 88.61 | 11.39% | 9.96% | supported | 243.36s | 16.78× realtime | $0.1134 |
| 15 | <code>soniox-stt-async-v5</code> | 259.00s | 92.53 | 7.47% | 6.29% | supported | 259.00s | 15.77× realtime | $0.1134 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>assemblyai-universal-3-pro</code> | 97.20/100 quality score | 97.20 | 2.80% | 2.78% | supported | 43.13s | 94.69× realtime | $0.2382 |
| 2 | <code>happyscribe-auto</code> | 96.21/100 quality score | 96.21 | 3.79% | 3.55% | supported | 107.65s | 37.94× realtime | $0.00 |
| 3 | <code>assemblyai-universal-3-5-pro</code> | 94.22/100 quality score | 94.22 | 5.78% | 4.78% | supported | 30.40s | 134.36× realtime | $0.2609 |
| 4 | <code>soniox-stt-async-v5</code> | 92.53/100 quality score | 92.53 | 7.47% | 6.29% | supported | 259.00s | 15.77× realtime | $0.1134 |
| 5 | <code>soniox-stt-async-v4</code> | 92.45/100 quality score | 92.45 | 7.55% | 6.28% | supported | 193.76s | 21.08× realtime | $0.1134 |
| 6 | <code>gladia-solaria-3</code> | 92.27/100 quality score | 92.27 | 7.73% | 6.40% | supported | 50.14s | 81.46× realtime | $0.6920 |
| 7 | <code>mistral-voxtral-mini-2602</code> | 91.85/100 quality score | 91.85 | 8.15% | 7.07% | supported | 40.51s | 100.81× realtime | $0.1361 |
| 8 | <code>assemblyai-universal-2</code> | 91.57/100 quality score | 91.57 | 8.43% | 7.39% | supported | 31.75s | 128.63× realtime | $0.1929 |
| 9 | <code>gladia-solaria-1</code> | 91.51/100 quality score | 91.51 | 8.49% | 7.03% | supported | 42.31s | 96.53× realtime | $0.6920 |
| 10 | <code>gladia-default</code> | 91.37/100 quality score | 91.37 | 8.63% | 7.05% | supported | 45.53s | 89.70× realtime | $0.6920 |
| 11 | <code>speechmatics-enhanced</code> | 90.84/100 quality score | 90.84 | 9.16% | 7.64% | supported | 130.13s | 31.38× realtime | $0.8508 |
| 12 | <code>rev-machine</code> | 89.16/100 quality score | 89.16 | 10.84% | 9.38% | supported | 122.27s | 33.40× realtime | $0.2269 |
| 13 | <code>rev-low_cost</code> | 88.61/100 quality score | 88.61 | 11.39% | 9.96% | supported | 243.36s | 16.78× realtime | $0.1134 |
| 14 | <code>grok-speech-to-text</code> | 88.44/100 quality score | 88.44 | 11.56% | 10.10% | supported | 68.10s | 59.97× realtime | $0.1134 |
| 15 | <code>deepgram-nova-3</code> | 87.93/100 quality score | 87.93 | 12.07% | 10.50% | supported | 21.96s | 185.94× realtime | $0.6602 |


## Provider Detail

| Provider | Group | Diarization | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Throughput | Actual Cost |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| <code>assemblyai-universal-2</code> | Third-Party Service Diarization | supported | 91.57 | 8.43% | 7.39% | 31.75s | 128.63× realtime | $0.1929 |
| <code>assemblyai-universal-3-5-pro</code> | Third-Party Service Diarization | supported | 94.22 | 5.78% | 4.78% | 30.40s | 134.36× realtime | $0.2609 |
| <code>assemblyai-universal-3-pro</code> | Third-Party Service Diarization | supported | 97.20 | 2.80% | 2.78% | 43.13s | 94.69× realtime | $0.2382 |
| <code>deepgram-nova-3</code> | Third-Party Service Diarization | supported | 87.93 | 12.07% | 10.50% | 21.96s | 185.94× realtime | $0.6602 |
| <code>deepinfra-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 91.28 | 8.72% | 6.66% | 76.25s | 53.56× realtime | $0.0306 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 89.01 | 10.99% | 9.23% | 66.18s | 61.71× realtime | $0.0136 |
| <code>gemini-stt-gemini-3-flash-preview</code> | Third-Party Service Non-Diarization | not-supported | 90.00 | 10.00% | 8.31% | 255.74s | 15.97× realtime | $0.2827 |
| <code>gemini-stt-gemini-3.6-flash</code> | Third-Party Service Non-Diarization | not-supported | 61.54 | 38.46% | 37.44% | 269.11s | 15.18× realtime | $0.6403 |
| <code>gladia-default</code> | Third-Party Service Diarization | supported | 91.37 | 8.63% | 7.05% | 45.53s | 89.70× realtime | $0.6920 |
| <code>gladia-solaria-1</code> | Third-Party Service Diarization | supported | 91.51 | 8.49% | 7.03% | 42.31s | 96.53× realtime | $0.6920 |
| <code>gladia-solaria-3</code> | Third-Party Service Diarization | supported | 92.27 | 7.73% | 6.40% | 50.14s | 81.46× realtime | $0.6920 |
| <code>grok-speech-to-text</code> | Third-Party Service Diarization | supported | 88.44 | 11.56% | 10.10% | 68.10s | 59.97× realtime | $0.1134 |
| <code>groq-whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 91.02 | 8.98% | 6.95% | 41.43s | 98.57× realtime | $0.1259 |
| <code>groq-whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 91.15 | 8.85% | 6.85% | 24.11s | 169.39× realtime | $0.0454 |
| <code>happyscribe-auto</code> | Third-Party Service Diarization | supported | 96.21 | 3.79% | 3.55% | 107.65s | 37.94× realtime | $0.00 |
| <code>mistral-voxtral-mini-2602</code> | Third-Party Service Diarization | supported | 91.85 | 8.15% | 7.07% | 40.51s | 100.81× realtime | $0.1361 |
| <code>rev-low_cost</code> | Third-Party Service Diarization | supported | 88.61 | 11.39% | 9.96% | 243.36s | 16.78× realtime | $0.1134 |
| <code>rev-machine</code> | Third-Party Service Diarization | supported | 89.16 | 10.84% | 9.38% | 122.27s | 33.40× realtime | $0.2269 |
| <code>soniox-stt-async-v4</code> | Third-Party Service Diarization | supported | 92.45 | 7.55% | 6.28% | 193.76s | 21.08× realtime | $0.1134 |
| <code>soniox-stt-async-v5</code> | Third-Party Service Diarization | supported | 92.53 | 7.47% | 6.29% | 259.00s | 15.77× realtime | $0.1134 |
| <code>speechmatics-enhanced</code> | Third-Party Service Diarization | supported | 90.84 | 9.16% | 7.64% | 130.13s | 31.38× realtime | $0.8508 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | Third-Party Service Non-Diarization | not-supported | 90.39 | 9.61% | 7.72% | 4.50s | 907.56× realtime | $0.1021 |
| <code>together-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 89.96 | 10.04% | 8.09% | 11.64s | 350.74× realtime | $0.1021 |

## Error Breakdown (Speaker-aware)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>assemblyai-universal-2</code> | -1 | -1 | -1 | 11597 |
| <code>assemblyai-universal-3-5-pro</code> | -1 | -1 | -1 | 11597 |
| <code>assemblyai-universal-3-pro</code> | -1 | -1 | -1 | 11597 |
| <code>deepgram-nova-3</code> | -1 | -1 | -1 | 11597 |
| <code>deepinfra-openai_whisper-large-v3</code> | -1 | -1 | -1 | 11597 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | -1 | -1 | -1 | 11597 |
| <code>gemini-stt-gemini-3-flash-preview</code> | -1 | -1 | -1 | 11597 |
| <code>gemini-stt-gemini-3.6-flash</code> | -1 | -1 | -1 | 11597 |
| <code>gladia-default</code> | -1 | -1 | -1 | 11597 |
| <code>gladia-solaria-1</code> | -1 | -1 | -1 | 11597 |
| <code>gladia-solaria-3</code> | -1 | -1 | -1 | 11597 |
| <code>grok-speech-to-text</code> | -1 | -1 | -1 | 11597 |
| <code>groq-whisper-large-v3</code> | -1 | -1 | -1 | 11597 |
| <code>groq-whisper-large-v3-turbo</code> | -1 | -1 | -1 | 11597 |
| <code>happyscribe-auto</code> | -1 | -1 | -1 | 11597 |
| <code>mistral-voxtral-mini-2602</code> | -1 | -1 | -1 | 11597 |
| <code>rev-low_cost</code> | -1 | -1 | -1 | 11597 |
| <code>rev-machine</code> | -1 | -1 | -1 | 11597 |
| <code>soniox-stt-async-v4</code> | -1 | -1 | -1 | 11597 |
| <code>soniox-stt-async-v5</code> | -1 | -1 | -1 | 11597 |
| <code>speechmatics-enhanced</code> | -1 | -1 | -1 | 11597 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | -1 | -1 | -1 | 11597 |
| <code>together-openai_whisper-large-v3</code> | -1 | -1 | -1 | 11597 |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>assemblyai-universal-2</code> | -1 | -1 | -1 | 11329 |
| <code>assemblyai-universal-3-5-pro</code> | -1 | -1 | -1 | 11329 |
| <code>assemblyai-universal-3-pro</code> | -1 | -1 | -1 | 11329 |
| <code>deepgram-nova-3</code> | -1 | -1 | -1 | 11329 |
| <code>deepinfra-openai_whisper-large-v3</code> | -1 | -1 | -1 | 11329 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | -1 | -1 | -1 | 11329 |
| <code>gemini-stt-gemini-3-flash-preview</code> | -1 | -1 | -1 | 11329 |
| <code>gemini-stt-gemini-3.6-flash</code> | -1 | -1 | -1 | 11329 |
| <code>gladia-default</code> | -1 | -1 | -1 | 11329 |
| <code>gladia-solaria-1</code> | -1 | -1 | -1 | 11329 |
| <code>gladia-solaria-3</code> | -1 | -1 | -1 | 11329 |
| <code>grok-speech-to-text</code> | -1 | -1 | -1 | 11329 |
| <code>groq-whisper-large-v3</code> | -1 | -1 | -1 | 11329 |
| <code>groq-whisper-large-v3-turbo</code> | -1 | -1 | -1 | 11329 |
| <code>happyscribe-auto</code> | -1 | -1 | -1 | 11329 |
| <code>mistral-voxtral-mini-2602</code> | -1 | -1 | -1 | 11329 |
| <code>rev-low_cost</code> | -1 | -1 | -1 | 11329 |
| <code>rev-machine</code> | -1 | -1 | -1 | 11329 |
| <code>soniox-stt-async-v4</code> | -1 | -1 | -1 | 11329 |
| <code>soniox-stt-async-v5</code> | -1 | -1 | -1 | 11329 |
| <code>speechmatics-enhanced</code> | -1 | -1 | -1 | 11329 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | -1 | -1 | -1 | 11329 |
| <code>together-openai_whisper-large-v3</code> | -1 | -1 | -1 | 11329 |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `assemblyai-universal-3-pro` was the most accurate provider on strict speaker-aware WER, scoring 97.20/100.
- `together-nvidia_parakeet-tdt-0.6b-v3` was the fastest provider in this set at 4.50s.
- `deepinfra-openai_whisper-large-v3` lost the most ground once speaker changes were counted, with 2.06 percentage-point gap between text-only and speaker-aware WER.
