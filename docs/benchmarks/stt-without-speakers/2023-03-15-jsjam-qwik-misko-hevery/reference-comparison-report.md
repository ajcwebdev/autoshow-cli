# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/auto/autoshow-cli/docs/benchmarks/stt-without-speakers/2023-03-15-jsjam-qwik-misko-hevery`
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
| 1 | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | $0.0226 | 90.82 | 9.18% | 8.72% | not-supported | 453.52s | 14.93× realtime | $0.0226 |
| 2 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | $0.0226 | 90.29 | 9.71% | 9.32% | not-supported | 35.84s | 188.92× realtime | $0.0226 |
| 3 | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | $0.0226 | 91.39 | 8.61% | 8.17% | not-supported | 190.74s | 35.50× realtime | $0.0226 |
| 4 | <code>deepinfra-openai_whisper-large-v3</code> | $0.0508 | 89.99 | 10.01% | 9.63% | not-supported | 72.69s | 93.17× realtime | $0.0508 |
| 5 | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | $0.0508 | 91.32 | 8.68% | 8.25% | not-supported | 179.44s | 37.74× realtime | $0.0508 |
| 6 | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | $0.1129 | 93.93 | 6.07% | 5.61% | not-supported | 234.09s | 28.93× realtime | $0.1129 |
| 7 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | $0.1693 | 89.44 | 10.56% | 10.15% | not-supported | 51.46s | 131.61× realtime | $0.1693 |
| 8 | <code>together-openai_whisper-large-v3</code> | $0.1693 | 92.99 | 7.01% | 6.54% | not-supported | 27.59s | 245.47× realtime | $0.1693 |
| 9 | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | $0.3386 | 60.36 | 39.64% | 39.35% | not-supported | 794.34s | 8.53× realtime | $0.3386 |
| 10 | <code>openai-stt-gpt-transcribe</code> | $0.5079 | 93.85 | 6.15% | 5.70% | not-supported | 146.93s | 46.09× realtime | $0.5079 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>together-openai_whisper-large-v3</code> | 27.59s | 92.99 | 7.01% | 6.54% | not-supported | 27.59s | 245.47× realtime | $0.1693 |
| 2 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 35.84s | 90.29 | 9.71% | 9.32% | not-supported | 35.84s | 188.92× realtime | $0.0226 |
| 3 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 51.46s | 89.44 | 10.56% | 10.15% | not-supported | 51.46s | 131.61× realtime | $0.1693 |
| 4 | <code>deepinfra-openai_whisper-large-v3</code> | 72.69s | 89.99 | 10.01% | 9.63% | not-supported | 72.69s | 93.17× realtime | $0.0508 |
| 5 | <code>openai-stt-gpt-transcribe</code> | 146.93s | 93.85 | 6.15% | 5.70% | not-supported | 146.93s | 46.09× realtime | $0.5079 |
| 6 | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | 179.44s | 91.32 | 8.68% | 8.25% | not-supported | 179.44s | 37.74× realtime | $0.0508 |
| 7 | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | 190.74s | 91.39 | 8.61% | 8.17% | not-supported | 190.74s | 35.50× realtime | $0.0226 |
| 8 | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | 234.09s | 93.93 | 6.07% | 5.61% | not-supported | 234.09s | 28.93× realtime | $0.1129 |
| 9 | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 453.52s | 90.82 | 9.18% | 8.72% | not-supported | 453.52s | 14.93× realtime | $0.0226 |
| 10 | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | 794.34s | 60.36 | 39.64% | 39.35% | not-supported | 794.34s | 8.53× realtime | $0.3386 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | 93.93/100 quality score | 93.93 | 6.07% | 5.61% | not-supported | 234.09s | 28.93× realtime | $0.1129 |
| 2 | <code>openai-stt-gpt-transcribe</code> | 93.85/100 quality score | 93.85 | 6.15% | 5.70% | not-supported | 146.93s | 46.09× realtime | $0.5079 |
| 3 | <code>together-openai_whisper-large-v3</code> | 92.99/100 quality score | 92.99 | 7.01% | 6.54% | not-supported | 27.59s | 245.47× realtime | $0.1693 |
| 4 | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | 91.39/100 quality score | 91.39 | 8.61% | 8.17% | not-supported | 190.74s | 35.50× realtime | $0.0226 |
| 5 | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | 91.32/100 quality score | 91.32 | 8.68% | 8.25% | not-supported | 179.44s | 37.74× realtime | $0.0508 |
| 6 | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 90.82/100 quality score | 90.82 | 9.18% | 8.72% | not-supported | 453.52s | 14.93× realtime | $0.0226 |
| 7 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 90.29/100 quality score | 90.29 | 9.71% | 9.32% | not-supported | 35.84s | 188.92× realtime | $0.0226 |
| 8 | <code>deepinfra-openai_whisper-large-v3</code> | 89.99/100 quality score | 89.99 | 10.01% | 9.63% | not-supported | 72.69s | 93.17× realtime | $0.0508 |
| 9 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 89.44/100 quality score | 89.44 | 10.56% | 10.15% | not-supported | 51.46s | 131.61× realtime | $0.1693 |
| 10 | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | 60.36/100 quality score | 60.36 | 39.64% | 39.35% | not-supported | 794.34s | 8.53× realtime | $0.3386 |

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
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | Third-Party Service Non-Diarization | not-supported | 93.93 | 6.07% | 5.61% | 234.09s | 28.93× realtime | $0.1129 |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | Third-Party Service Non-Diarization | not-supported | 60.36 | 39.64% | 39.35% | 794.34s | 8.53× realtime | $0.3386 |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | Third-Party Service Non-Diarization | not-supported | 90.82 | 9.18% | 8.72% | 453.52s | 14.93× realtime | $0.0226 |
| <code>deepinfra-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 89.99 | 10.01% | 9.63% | 72.69s | 93.17× realtime | $0.0508 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 90.29 | 9.71% | 9.32% | 35.84s | 188.92× realtime | $0.0226 |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | Third-Party Service Non-Diarization | not-supported | 91.39 | 8.61% | 8.17% | 190.74s | 35.50× realtime | $0.0226 |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | Third-Party Service Non-Diarization | not-supported | 91.32 | 8.68% | 8.25% | 179.44s | 37.74× realtime | $0.0508 |
| <code>openai-stt-gpt-transcribe</code> | Third-Party Service Non-Diarization | not-supported | 93.85 | 6.15% | 5.70% | 146.93s | 46.09× realtime | $0.5079 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | Third-Party Service Non-Diarization | not-supported | 89.44 | 10.56% | 10.15% | 51.46s | 131.61× realtime | $0.1693 |
| <code>together-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 92.99 | 7.01% | 6.54% | 27.59s | 245.47× realtime | $0.1693 |

## Error Breakdown (Speaker-aware)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | -1 | -1 | -1 | 19853 |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | -1 | -1 | -1 | 19853 |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | -1 | -1 | -1 | 19853 |
| <code>deepinfra-openai_whisper-large-v3</code> | -1 | -1 | -1 | 19853 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | -1 | -1 | -1 | 19853 |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | -1 | -1 | -1 | 19853 |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | -1 | -1 | -1 | 19853 |
| <code>openai-stt-gpt-transcribe</code> | -1 | -1 | -1 | 19853 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | -1 | -1 | -1 | 19853 |
| <code>together-openai_whisper-large-v3</code> | -1 | -1 | -1 | 19853 |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | -1 | -1 | -1 | 19748 |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | -1 | -1 | -1 | 19748 |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | -1 | -1 | -1 | 19748 |
| <code>deepinfra-openai_whisper-large-v3</code> | -1 | -1 | -1 | 19748 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | -1 | -1 | -1 | 19748 |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | -1 | -1 | -1 | 19748 |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | -1 | -1 | -1 | 19748 |
| <code>openai-stt-gpt-transcribe</code> | -1 | -1 | -1 | 19748 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | -1 | -1 | -1 | 19748 |
| <code>together-openai_whisper-large-v3</code> | -1 | -1 | -1 | 19748 |

## Quality Flags

| Provider | Quality Flags |
| --- | --- |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |
| <code>openai-stt-gpt-transcribe</code> | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `deepinfra-mistralai_Voxtral-Mini-3B-2507` was the most accurate provider on strict speaker-aware WER, scoring 93.93/100.
- `together-openai_whisper-large-v3` was the fastest provider in this set at 27.59s.
- `deepinfra-mistralai_Voxtral-Mini-3B-2507` lost the most ground once speaker changes were counted, with 0.47 percentage-point gap between text-only and speaker-aware WER.
