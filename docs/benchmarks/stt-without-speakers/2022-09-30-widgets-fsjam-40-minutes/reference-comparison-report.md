# Consensus Transcript Comparison Report

## Summary

- Run directory: `docs/benchmarks/stt-without-speakers/2022-09-30-widgets-fsjam-40-minutes`
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
| 1 | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | $0.0081 | 93.50 | 6.50% | 5.80% | not-supported | 107.45s | 22.55× realtime | $0.0081 |
| 2 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | $0.0081 | 87.27 | 12.73% | 12.06% | not-supported | 10.69s | 226.58× realtime | $0.0081 |
| 3 | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | $0.0081 | 95.16 | 4.84% | 4.08% | not-supported | 31.06s | 78.01× realtime | $0.0081 |
| 4 | <code>deepinfra-openai_whisper-large-v3</code> | $0.0182 | 87.94 | 12.06% | 11.37% | not-supported | 18.81s | 128.81× realtime | $0.0182 |
| 5 | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | $0.0182 | 95.96 | 4.04% | 3.28% | not-supported | 21.52s | 112.59× realtime | $0.0182 |
| 6 | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | $0.0404 | 96.60 | 3.40% | 2.63% | not-supported | 64.46s | 37.59× realtime | $0.0404 |
| 7 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | $0.0606 | 95.70 | 4.30% | 3.58% | not-supported | 3.39s | 714.55× realtime | $0.0606 |
| 8 | <code>together-openai_whisper-large-v3</code> | $0.0606 | 94.68 | 5.32% | 4.57% | not-supported | 10.43s | 232.40× realtime | $0.0606 |
| 9 | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | $0.1212 | 62.04 | 37.96% | 37.48% | not-supported | 295.39s | 8.20× realtime | $0.1212 |
| 10 | <code>openai-stt-gpt-transcribe</code> | $0.1818 | 96.75 | 3.25% | 2.46% | not-supported | 59.92s | 40.44× realtime | $0.1818 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 3.39s | 95.70 | 4.30% | 3.58% | not-supported | 3.39s | 714.55× realtime | $0.0606 |
| 2 | <code>together-openai_whisper-large-v3</code> | 10.43s | 94.68 | 5.32% | 4.57% | not-supported | 10.43s | 232.40× realtime | $0.0606 |
| 3 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 10.69s | 87.27 | 12.73% | 12.06% | not-supported | 10.69s | 226.58× realtime | $0.0081 |
| 4 | <code>deepinfra-openai_whisper-large-v3</code> | 18.81s | 87.94 | 12.06% | 11.37% | not-supported | 18.81s | 128.81× realtime | $0.0182 |
| 5 | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | 21.52s | 95.96 | 4.04% | 3.28% | not-supported | 21.52s | 112.59× realtime | $0.0182 |
| 6 | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | 31.06s | 95.16 | 4.84% | 4.08% | not-supported | 31.06s | 78.01× realtime | $0.0081 |
| 7 | <code>openai-stt-gpt-transcribe</code> | 59.92s | 96.75 | 3.25% | 2.46% | not-supported | 59.92s | 40.44× realtime | $0.1818 |
| 8 | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | 64.46s | 96.60 | 3.40% | 2.63% | not-supported | 64.46s | 37.59× realtime | $0.0404 |
| 9 | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 107.45s | 93.50 | 6.50% | 5.80% | not-supported | 107.45s | 22.55× realtime | $0.0081 |
| 10 | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | 295.39s | 62.04 | 37.96% | 37.48% | not-supported | 295.39s | 8.20× realtime | $0.1212 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>openai-stt-gpt-transcribe</code> | 96.75/100 quality score | 96.75 | 3.25% | 2.46% | not-supported | 59.92s | 40.44× realtime | $0.1818 |
| 2 | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | 96.60/100 quality score | 96.60 | 3.40% | 2.63% | not-supported | 64.46s | 37.59× realtime | $0.0404 |
| 3 | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | 95.96/100 quality score | 95.96 | 4.04% | 3.28% | not-supported | 21.52s | 112.59× realtime | $0.0182 |
| 4 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 95.70/100 quality score | 95.70 | 4.30% | 3.58% | not-supported | 3.39s | 714.55× realtime | $0.0606 |
| 5 | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | 95.16/100 quality score | 95.16 | 4.84% | 4.08% | not-supported | 31.06s | 78.01× realtime | $0.0081 |
| 6 | <code>together-openai_whisper-large-v3</code> | 94.68/100 quality score | 94.68 | 5.32% | 4.57% | not-supported | 10.43s | 232.40× realtime | $0.0606 |
| 7 | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 93.50/100 quality score | 93.50 | 6.50% | 5.80% | not-supported | 107.45s | 22.55× realtime | $0.0081 |
| 8 | <code>deepinfra-openai_whisper-large-v3</code> | 87.94/100 quality score | 87.94 | 12.06% | 11.37% | not-supported | 18.81s | 128.81× realtime | $0.0182 |
| 9 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 87.27/100 quality score | 87.27 | 12.73% | 12.06% | not-supported | 10.69s | 226.58× realtime | $0.0081 |
| 10 | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | 62.04/100 quality score | 62.04 | 37.96% | 37.48% | not-supported | 295.39s | 8.20× realtime | $0.1212 |

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
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | Third-Party Service Non-Diarization | not-supported | 96.60 | 3.40% | 2.63% | 64.46s | 37.59× realtime | $0.0404 |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | Third-Party Service Non-Diarization | not-supported | 62.04 | 37.96% | 37.48% | 295.39s | 8.20× realtime | $0.1212 |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | Third-Party Service Non-Diarization | not-supported | 93.50 | 6.50% | 5.80% | 107.45s | 22.55× realtime | $0.0081 |
| <code>deepinfra-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 87.94 | 12.06% | 11.37% | 18.81s | 128.81× realtime | $0.0182 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 87.27 | 12.73% | 12.06% | 10.69s | 226.58× realtime | $0.0081 |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | Third-Party Service Non-Diarization | not-supported | 95.16 | 4.84% | 4.08% | 31.06s | 78.01× realtime | $0.0081 |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | Third-Party Service Non-Diarization | not-supported | 95.96 | 4.04% | 3.28% | 21.52s | 112.59× realtime | $0.0182 |
| <code>openai-stt-gpt-transcribe</code> | Third-Party Service Non-Diarization | not-supported | 96.75 | 3.25% | 2.46% | 59.92s | 40.44× realtime | $0.1818 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | Third-Party Service Non-Diarization | not-supported | 95.70 | 4.30% | 3.58% | 3.39s | 714.55× realtime | $0.0606 |
| <code>together-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 94.68 | 5.32% | 4.57% | 10.43s | 232.40× realtime | $0.0606 |

## Error Breakdown (Speaker-aware)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | 124 | 103 | 53 | 8226 |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | -1 | -1 | -1 | 8226 |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 269 | 190 | 76 | 8226 |
| <code>deepinfra-openai_whisper-large-v3</code> | 105 | 837 | 50 | 8226 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 128 | 864 | 55 | 8226 |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | 204 | 138 | 56 | 8226 |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | 149 | 128 | 55 | 8226 |
| <code>openai-stt-gpt-transcribe</code> | 105 | 110 | 52 | 8226 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 175 | 107 | 72 | 8226 |
| <code>together-openai_whisper-large-v3</code> | 123 | 259 | 56 | 8226 |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | 116 | 42 | 57 | 8160 |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | -1 | -1 | -1 | 8160 |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 264 | 129 | 80 | 8160 |
| <code>deepinfra-openai_whisper-large-v3</code> | 102 | 774 | 52 | 8160 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 122 | 803 | 59 | 8160 |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | 202 | 74 | 57 | 8160 |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | 148 | 64 | 56 | 8160 |
| <code>openai-stt-gpt-transcribe</code> | 104 | 45 | 52 | 8160 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 168 | 47 | 77 | 8160 |
| <code>together-openai_whisper-large-v3</code> | 121 | 195 | 57 | 8160 |

## Quality Flags

| Provider | Quality Flags |
| --- | --- |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |
| <code>openai-stt-gpt-transcribe</code> | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `openai-stt-gpt-transcribe` was the most accurate provider on strict speaker-aware WER, scoring 96.75/100.
- `together-nvidia_parakeet-tdt-0.6b-v3` was the fastest provider in this set at 3.39s.
- `openai-stt-gpt-transcribe` lost the most ground once speaker changes were counted, with 0.78 percentage-point gap between text-only and speaker-aware WER.
