# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/auto/autoshow-cli/docs/benchmarks/stt-without-speakers/1-audio`
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
| 1 | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | $0.0002 | 93.64 | 6.36% | 4.63% | not-supported | 13.60s | 4.38× realtime | $0.0002 |
| 2 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | $0.0002 | 86.36 | 13.64% | 12.04% | not-supported | 1.50s | 39.86× realtime | $0.0002 |
| 3 | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | $0.0002 | 95.91 | 4.09% | 2.31% | not-supported | 1.81s | 32.88× realtime | $0.0002 |
| 4 | <code>deepinfra-openai_whisper-large-v3</code> | $0.0004 | 87.27 | 12.73% | 11.11% | not-supported | 1.43s | 41.55× realtime | $0.0004 |
| 5 | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | $0.0004 | 94.55 | 5.45% | 3.70% | not-supported | 1.19s | 50.03× realtime | $0.0004 |
| 6 | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | $0.0010 | 95.00 | 5.00% | 3.24% | not-supported | 2.50s | 23.82× realtime | $0.0010 |
| 7 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | $0.0015 | 93.18 | 6.82% | 5.09% | not-supported | 0.72s | 83.10× realtime | $0.0015 |
| 8 | <code>together-openai_whisper-large-v3</code> | $0.0015 | 95.00 | 5.00% | 3.24% | not-supported | 1.90s | 31.31× realtime | $0.0015 |
| 9 | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | $0.0030 | 95.00 | 5.00% | 3.24% | not-supported | 5.77s | 10.32× realtime | $0.0030 |
| 10 | <code>openai-stt-gpt-transcribe</code> | $0.0045 | 94.55 | 5.45% | 3.70% | not-supported | 3.63s | 16.41× realtime | $0.0045 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 0.72s | 93.18 | 6.82% | 5.09% | not-supported | 0.72s | 83.10× realtime | $0.0015 |
| 2 | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | 1.19s | 94.55 | 5.45% | 3.70% | not-supported | 1.19s | 50.03× realtime | $0.0004 |
| 3 | <code>deepinfra-openai_whisper-large-v3</code> | 1.43s | 87.27 | 12.73% | 11.11% | not-supported | 1.43s | 41.55× realtime | $0.0004 |
| 4 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 1.50s | 86.36 | 13.64% | 12.04% | not-supported | 1.50s | 39.86× realtime | $0.0002 |
| 5 | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | 1.81s | 95.91 | 4.09% | 2.31% | not-supported | 1.81s | 32.88× realtime | $0.0002 |
| 6 | <code>together-openai_whisper-large-v3</code> | 1.90s | 95.00 | 5.00% | 3.24% | not-supported | 1.90s | 31.31× realtime | $0.0015 |
| 7 | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | 2.50s | 95.00 | 5.00% | 3.24% | not-supported | 2.50s | 23.82× realtime | $0.0010 |
| 8 | <code>openai-stt-gpt-transcribe</code> | 3.63s | 94.55 | 5.45% | 3.70% | not-supported | 3.63s | 16.41× realtime | $0.0045 |
| 9 | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | 5.77s | 95.00 | 5.00% | 3.24% | not-supported | 5.77s | 10.32× realtime | $0.0030 |
| 10 | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 13.60s | 93.64 | 6.36% | 4.63% | not-supported | 13.60s | 4.38× realtime | $0.0002 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | 95.91/100 quality score | 95.91 | 4.09% | 2.31% | not-supported | 1.81s | 32.88× realtime | $0.0002 |
| 2 | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | 95.00/100 quality score | 95.00 | 5.00% | 3.24% | not-supported | 2.50s | 23.82× realtime | $0.0010 |
| 3 | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | 95.00/100 quality score | 95.00 | 5.00% | 3.24% | not-supported | 5.77s | 10.32× realtime | $0.0030 |
| 4 | <code>together-openai_whisper-large-v3</code> | 95.00/100 quality score | 95.00 | 5.00% | 3.24% | not-supported | 1.90s | 31.31× realtime | $0.0015 |
| 5 | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | 94.55/100 quality score | 94.55 | 5.45% | 3.70% | not-supported | 1.19s | 50.03× realtime | $0.0004 |
| 6 | <code>openai-stt-gpt-transcribe</code> | 94.55/100 quality score | 94.55 | 5.45% | 3.70% | not-supported | 3.63s | 16.41× realtime | $0.0045 |
| 7 | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 93.64/100 quality score | 93.64 | 6.36% | 4.63% | not-supported | 13.60s | 4.38× realtime | $0.0002 |
| 8 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 93.18/100 quality score | 93.18 | 6.82% | 5.09% | not-supported | 0.72s | 83.10× realtime | $0.0015 |
| 9 | <code>deepinfra-openai_whisper-large-v3</code> | 87.27/100 quality score | 87.27 | 12.73% | 11.11% | not-supported | 1.43s | 41.55× realtime | $0.0004 |
| 10 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 86.36/100 quality score | 86.36 | 13.64% | 12.04% | not-supported | 1.50s | 39.86× realtime | $0.0002 |

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
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | Third-Party Service Non-Diarization | not-supported | 95.00 | 5.00% | 3.24% | 2.50s | 23.82× realtime | $0.0010 |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | Third-Party Service Non-Diarization | not-supported | 95.00 | 5.00% | 3.24% | 5.77s | 10.32× realtime | $0.0030 |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | Third-Party Service Non-Diarization | not-supported | 93.64 | 6.36% | 4.63% | 13.60s | 4.38× realtime | $0.0002 |
| <code>deepinfra-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 87.27 | 12.73% | 11.11% | 1.43s | 41.55× realtime | $0.0004 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | Third-Party Service Non-Diarization | not-supported | 86.36 | 13.64% | 12.04% | 1.50s | 39.86× realtime | $0.0002 |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | Third-Party Service Non-Diarization | not-supported | 95.91 | 4.09% | 2.31% | 1.81s | 32.88× realtime | $0.0002 |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | Third-Party Service Non-Diarization | not-supported | 94.55 | 5.45% | 3.70% | 1.19s | 50.03× realtime | $0.0004 |
| <code>openai-stt-gpt-transcribe</code> | Third-Party Service Non-Diarization | not-supported | 94.55 | 5.45% | 3.70% | 3.63s | 16.41× realtime | $0.0045 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | Third-Party Service Non-Diarization | not-supported | 93.18 | 6.82% | 5.09% | 0.72s | 83.10× realtime | $0.0015 |
| <code>together-openai_whisper-large-v3</code> | Third-Party Service Non-Diarization | not-supported | 95.00 | 5.00% | 3.24% | 1.90s | 31.31× realtime | $0.0015 |

## Error Breakdown (Speaker-aware)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | 2 | 9 | 0 | 220 |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | 2 | 9 | 0 | 220 |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 6 | 8 | 0 | 220 |
| <code>deepinfra-openai_whisper-large-v3</code> | 1 | 27 | 0 | 220 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 1 | 27 | 2 | 220 |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | 2 | 5 | 2 | 220 |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | 4 | 5 | 3 | 220 |
| <code>openai-stt-gpt-transcribe</code> | 1 | 11 | 0 | 220 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 7 | 5 | 3 | 220 |
| <code>together-openai_whisper-large-v3</code> | 2 | 9 | 0 | 220 |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | 1 | 6 | 0 | 216 |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | 1 | 6 | 0 | 216 |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 5 | 5 | 0 | 216 |
| <code>deepinfra-openai_whisper-large-v3</code> | 0 | 24 | 0 | 216 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 0 | 24 | 2 | 216 |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code> | 1 | 2 | 2 | 216 |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code> | 3 | 2 | 3 | 216 |
| <code>openai-stt-gpt-transcribe</code> | 0 | 8 | 0 | 216 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code> | 6 | 2 | 3 | 216 |
| <code>together-openai_whisper-large-v3</code> | 1 | 6 | 0 | 216 |

## Quality Flags

| Provider | Quality Flags |
| --- | --- |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code> | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |
| <code>openai-stt-gpt-transcribe</code> | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |

## Duplicate Groups

| Group | Providers |
| --- | --- |
| duplicate-1 | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>, <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> |

## Notes

- `deepinfra-Qwen_Qwen3-ASR-0.6B` was the most accurate provider on strict speaker-aware WER, scoring 95.91/100.
- `together-nvidia_parakeet-tdt-0.6b-v3` was the fastest provider in this set at 0.72s.
- `deepinfra-Qwen_Qwen3-ASR-0.6B` lost the most ground once speaker changes were counted, with 1.78 percentage-point gap between text-only and speaker-aware WER.
