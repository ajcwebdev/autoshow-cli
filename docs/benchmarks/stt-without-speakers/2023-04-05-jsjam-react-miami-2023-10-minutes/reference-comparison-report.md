# Consensus Transcript Comparison Report

## Summary

- Run directory: `docs/benchmarks/stt-without-speakers/2023-04-05-jsjam-react-miami-2023-10-minutes`
- Total providers: 10 (0 local, 10 third-party service)
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
| 1 | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | $0.0020 | 91.27 | 8.73% | 7.81% | not-supported | 21.62s | 27.75× realtime | $0.0020 |
| 2 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | $0.0020 | 89.68 | 10.32% | 9.71% | not-supported | 4.27s | 140.52× realtime | $0.0020 |
| 3 | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | $0.0020 | 94.34 | 5.66% | 4.71% | not-supported | 8.67s | 69.22× realtime | $0.0020 |
| 4 | <code>deepinfra-openai_whisper-large-v3</code> | $0.0045 | 92.39 | 7.61% | 6.79% | not-supported | 6.52s | 92.04× realtime | $0.0045 |
| 5 | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | $0.0045 | 94.87 | 5.13% | 4.23% | not-supported | 5.21s | 115.16× realtime | $0.0045 |
| 6 | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | $0.0100 | 94.16 | 5.84% | 4.89% | not-supported | 12.42s | 48.31× realtime | $0.0100 |
| 7 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | $0.0150 | 94.75 | 5.25% | 4.35% | not-supported | 1.29s | 464.04× realtime | $0.0150 |
| 8 | <code>together-openai_whisper-large-v3</code> | $0.0150 | 93.33 | 6.67% | 5.72% | not-supported | 3.46s | 173.36× realtime | $0.0150 |
| 9 | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | $0.0300 | 94.75 | 5.25% | 4.29% | not-supported | 40.16s | 14.94× realtime | $0.0300 |
| 10 | <code>openai-stt-gpt-transcribe</code> | $0.0450 | 94.45 | 5.55% | 4.65% | not-supported | 12.44s | 48.23× realtime | $0.0450 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 1.29s | 94.75 | 5.25% | 4.35% | not-supported | 1.29s | 464.04× realtime | $0.0150 |
| 2 | <code>together-openai_whisper-large-v3</code> | 3.46s | 93.33 | 6.67% | 5.72% | not-supported | 3.46s | 173.36× realtime | $0.0150 |
| 3 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 4.27s | 89.68 | 10.32% | 9.71% | not-supported | 4.27s | 140.52× realtime | $0.0020 |
| 4 | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | 5.21s | 94.87 | 5.13% | 4.23% | not-supported | 5.21s | 115.16× realtime | $0.0045 |
| 5 | <code>deepinfra-openai_whisper-large-v3</code> | 6.52s | 92.39 | 7.61% | 6.79% | not-supported | 6.52s | 92.04× realtime | $0.0045 |
| 6 | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | 8.67s | 94.34 | 5.66% | 4.71% | not-supported | 8.67s | 69.22× realtime | $0.0020 |
| 7 | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | 12.42s | 94.16 | 5.84% | 4.89% | not-supported | 12.42s | 48.31× realtime | $0.0100 |
| 8 | <code>openai-stt-gpt-transcribe</code> | 12.44s | 94.45 | 5.55% | 4.65% | not-supported | 12.44s | 48.23× realtime | $0.0450 |
| 9 | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 21.62s | 91.27 | 8.73% | 7.81% | not-supported | 21.62s | 27.75× realtime | $0.0020 |
| 10 | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | 40.16s | 94.75 | 5.25% | 4.29% | not-supported | 40.16s | 14.94× realtime | $0.0300 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | 94.87/100 quality score | 94.87 | 5.13% | 4.23% | not-supported | 5.21s | 115.16× realtime | $0.0045 |
| 2 | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | 94.75/100 quality score | 94.75 | 5.25% | 4.29% | not-supported | 40.16s | 14.94× realtime | $0.0300 |
| 3 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 94.75/100 quality score | 94.75 | 5.25% | 4.35% | not-supported | 1.29s | 464.04× realtime | $0.0150 |
| 4 | <code>openai-stt-gpt-transcribe</code> | 94.45/100 quality score | 94.45 | 5.55% | 4.65% | not-supported | 12.44s | 48.23× realtime | $0.0450 |
| 5 | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | 94.34/100 quality score | 94.34 | 5.66% | 4.71% | not-supported | 8.67s | 69.22× realtime | $0.0020 |
| 6 | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | 94.16/100 quality score | 94.16 | 5.84% | 4.89% | not-supported | 12.42s | 48.31× realtime | $0.0100 |
| 7 | <code>together-openai_whisper-large-v3</code> | 93.33/100 quality score | 93.33 | 6.67% | 5.72% | not-supported | 3.46s | 173.36× realtime | $0.0150 |
| 8 | <code>deepinfra-openai_whisper-large-v3</code> | 92.39/100 quality score | 92.39 | 7.61% | 6.79% | not-supported | 6.52s | 92.04× realtime | $0.0045 |
| 9 | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 91.27/100 quality score | 91.27 | 8.73% | 7.81% | not-supported | 21.62s | 27.75× realtime | $0.0020 |
| 10 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 89.68/100 quality score | 89.68 | 10.32% | 9.71% | not-supported | 4.27s | 140.52× realtime | $0.0020 |

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
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | Third-Party Service Non-Diarization | not-supported | 94.16 | 5.84% | 4.89% | 12.42s | 48.31× realtime | $0.0100 |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | Third-Party Service Non-Diarization | not-supported | 94.75 | 5.25% | 4.29% | 40.16s | 14.94× realtime | $0.0300 |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | Third-Party Service Non-Diarization | not-supported | 91.27 | 8.73% | 7.81% | 21.62s | 27.75× realtime | $0.0020 |
| <code>deepinfra-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 92.39 | 7.61% | 6.79% | 6.52s | 92.04× realtime | $0.0045 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 89.68 | 10.32% | 9.71% | 4.27s | 140.52× realtime | $0.0020 |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | Third-Party Service Non-Diarization | not-supported | 94.34 | 5.66% | 4.71% | 8.67s | 69.22× realtime | $0.0020 |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | Third-Party Service Non-Diarization | not-supported | 94.87 | 5.13% | 4.23% | 5.21s | 115.16× realtime | $0.0045 |
| <code>openai-stt-gpt-transcribe</code> | Third-Party Service Non-Diarization | not-supported | 94.45 | 5.55% | 4.65% | 12.44s | 48.23× realtime | $0.0450 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | Third-Party Service Non-Diarization | not-supported | 94.75 | 5.25% | 4.35% | 1.29s | 464.04× realtime | $0.0150 |
| <code>together-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 93.33 | 6.67% | 5.72% | 3.46s | 173.36× realtime | $0.0150 |

## Error Breakdown (Speaker-aware)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | 28 | 61 | 10 | 1695 |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | 26 | 52 | 11 | 1695 |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 62 | 72 | 14 | 1695 |
| <code>deepinfra-openai_whisper-large-v3</code> | 37 | 72 | 20 | 1695 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 43 | 112 | 20 | 1695 |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | 32 | 37 | 27 | 1695 |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | 28 | 29 | 30 | 1695 |
| <code>openai-stt-gpt-transcribe</code> | 27 | 53 | 14 | 1695 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 33 | 28 | 28 | 1695 |
| <code>together-openai_whisper-large-v3</code> | 33 | 68 | 12 | 1695 |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | 25 | 46 | 11 | 1678 |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | 23 | 37 | 12 | 1678 |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 59 | 57 | 15 | 1678 |
| <code>deepinfra-openai_whisper-large-v3</code> | 32 | 59 | 23 | 1678 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 35 | 102 | 26 | 1678 |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | 31 | 21 | 27 | 1678 |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | 24 | 15 | 32 | 1678 |
| <code>openai-stt-gpt-transcribe</code> | 23 | 39 | 16 | 1678 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 29 | 14 | 30 | 1678 |
| <code>together-openai_whisper-large-v3</code> | 30 | 53 | 13 | 1678 |

## Quality Flags

| Provider | Quality Flags |
| --- | --- |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |
| <code>openai-stt-gpt-transcribe</code> | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `deepinfra-Qwen_Qwen3-ASR-1.7B` was the most accurate provider on strict speaker-aware WER, scoring 94.87/100.
- `together-nvidia_parakeet-tdt-0.6b-v3` was the fastest provider in this set at 1.29s.
- `deepinfra-mistralai_Voxtral-Small-24B-2507` lost the most ground once speaker changes were counted, with 0.96 percentage-point gap between text-only and speaker-aware WER.
