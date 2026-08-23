# Consensus Transcript Comparison Report

## Summary

- Run directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/stt-with-speakers/2022-09-30-widgets-fsjam-40-minutes`
- Total providers: 8 (0 local, 8 third-party service)
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
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

### Third-Party Service Diarization

#### Price

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>grok-speech-to-text</code> | $0.0673 | 92.04 | 7.96% | 7.51% | supported | 29.32s | 82.64× realtime | $0.0673 |
| 2 | <code>soniox-stt-async-v5</code> | $0.0673 | 96.77 | 3.23% | 3.00% | supported | 83.25s | 29.10× realtime | $0.0673 |
| 3 | <code>mistral-voxtral-mini-2602</code> | $0.0808 | 97.23 | 2.77% | 2.57% | supported | 33.26s | 72.84× realtime | $0.0808 |
| 4 | <code>speechmatics-melia-1</code> | $0.0868 | 96.45 | 3.55% | 3.37% | supported | 22.74s | 106.54× realtime | $0.0868 |
| 5 | <code>assemblyai-universal-3-5-pro</code> | $0.1548 | 98.09 | 1.91% | 1.70% | supported | 45.53s | 53.21× realtime | $0.1548 |
| 6 | <code>deepgram-nova-3</code> | $0.3917 | 95.20 | 4.80% | 3.81% | supported | 8.93s | 271.37× realtime | $0.3917 |
| 7 | <code>happyscribe-auto</code> | $0.4038 | 97.95 | 2.05% | 1.85% | supported | 124.01s | 19.54× realtime | $0.4038 |
| 8 | <code>gladia-solaria-3</code> | $0.4106 | 96.80 | 3.20% | 2.99% | supported | 39.28s | 61.69× realtime | $0.4106 |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>deepgram-nova-3</code> | 8.93s | 95.20 | 4.80% | 3.81% | supported | 8.93s | 271.37× realtime | $0.3917 |
| 2 | <code>speechmatics-melia-1</code> | 22.74s | 96.45 | 3.55% | 3.37% | supported | 22.74s | 106.54× realtime | $0.0868 |
| 3 | <code>grok-speech-to-text</code> | 29.32s | 92.04 | 7.96% | 7.51% | supported | 29.32s | 82.64× realtime | $0.0673 |
| 4 | <code>mistral-voxtral-mini-2602</code> | 33.26s | 97.23 | 2.77% | 2.57% | supported | 33.26s | 72.84× realtime | $0.0808 |
| 5 | <code>gladia-solaria-3</code> | 39.28s | 96.80 | 3.20% | 2.99% | supported | 39.28s | 61.69× realtime | $0.4106 |
| 6 | <code>assemblyai-universal-3-5-pro</code> | 45.53s | 98.09 | 1.91% | 1.70% | supported | 45.53s | 53.21× realtime | $0.1548 |
| 7 | <code>soniox-stt-async-v5</code> | 83.25s | 96.77 | 3.23% | 3.00% | supported | 83.25s | 29.10× realtime | $0.0673 |
| 8 | <code>happyscribe-auto</code> | 124.01s | 97.95 | 2.05% | 1.85% | supported | 124.01s | 19.54× realtime | $0.4038 |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost |
| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | <code>assemblyai-universal-3-5-pro</code> | 98.09/100 quality score | 98.09 | 1.91% | 1.70% | supported | 45.53s | 53.21× realtime | $0.1548 |
| 2 | <code>happyscribe-auto</code> | 97.95/100 quality score | 97.95 | 2.05% | 1.85% | supported | 124.01s | 19.54× realtime | $0.4038 |
| 3 | <code>mistral-voxtral-mini-2602</code> | 97.23/100 quality score | 97.23 | 2.77% | 2.57% | supported | 33.26s | 72.84× realtime | $0.0808 |
| 4 | <code>gladia-solaria-3</code> | 96.80/100 quality score | 96.80 | 3.20% | 2.99% | supported | 39.28s | 61.69× realtime | $0.4106 |
| 5 | <code>soniox-stt-async-v5</code> | 96.77/100 quality score | 96.77 | 3.23% | 3.00% | supported | 83.25s | 29.10× realtime | $0.0673 |
| 6 | <code>speechmatics-melia-1</code> | 96.45/100 quality score | 96.45 | 3.55% | 3.37% | supported | 22.74s | 106.54× realtime | $0.0868 |
| 7 | <code>deepgram-nova-3</code> | 95.20/100 quality score | 95.20 | 4.80% | 3.81% | supported | 8.93s | 271.37× realtime | $0.3917 |
| 8 | <code>grok-speech-to-text</code> | 92.04/100 quality score | 92.04 | 7.96% | 7.51% | supported | 29.32s | 82.64× realtime | $0.0673 |


## Provider Detail

| Provider | Group | Diarization | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Throughput | Actual Cost |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| <code>assemblyai-universal-3-5-pro</code> | Third-Party Service Diarization | supported | 98.09 | 1.91% | 1.70% | 45.53s | 53.21× realtime | $0.1548 |
| <code>deepgram-nova-3</code> | Third-Party Service Diarization | supported | 95.20 | 4.80% | 3.81% | 8.93s | 271.37× realtime | $0.3917 |
| <code>gladia-solaria-3</code> | Third-Party Service Diarization | supported | 96.80 | 3.20% | 2.99% | 39.28s | 61.69× realtime | $0.4106 |
| <code>grok-speech-to-text</code> | Third-Party Service Diarization | supported | 92.04 | 7.96% | 7.51% | 29.32s | 82.64× realtime | $0.0673 |
| <code>happyscribe-auto</code> | Third-Party Service Diarization | supported | 97.95 | 2.05% | 1.85% | 124.01s | 19.54× realtime | $0.4038 |
| <code>mistral-voxtral-mini-2602</code> | Third-Party Service Diarization | supported | 97.23 | 2.77% | 2.57% | 33.26s | 72.84× realtime | $0.0808 |
| <code>soniox-stt-async-v5</code> | Third-Party Service Diarization | supported | 96.77 | 3.23% | 3.00% | 83.25s | 29.10× realtime | $0.0673 |
| <code>speechmatics-melia-1</code> | Third-Party Service Diarization | supported | 96.45 | 3.55% | 3.37% | 22.74s | 106.54× realtime | $0.0868 |

## Error Breakdown (Speaker-aware)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>assemblyai-universal-3-5-pro</code> | 79 | 39 | 39 | 8229 |
| <code>deepgram-nova-3</code> | 174 | 152 | 69 | 8229 |
| <code>gladia-solaria-3</code> | 146 | 65 | 52 | 8229 |
| <code>grok-speech-to-text</code> | 225 | 353 | 77 | 8229 |
| <code>happyscribe-auto</code> | 88 | 41 | 40 | 8229 |
| <code>mistral-voxtral-mini-2602</code> | 114 | 50 | 64 | 8229 |
| <code>soniox-stt-async-v5</code> | 144 | 45 | 77 | 8229 |
| <code>speechmatics-melia-1</code> | 148 | 63 | 81 | 8229 |

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
| <code>assemblyai-universal-3-5-pro</code> | 67 | 37 | 35 | 8163 |
| <code>deepgram-nova-3</code> | 161 | 102 | 48 | 8163 |
| <code>gladia-solaria-3</code> | 135 | 62 | 47 | 8163 |
| <code>grok-speech-to-text</code> | 213 | 330 | 70 | 8163 |
| <code>happyscribe-auto</code> | 75 | 40 | 36 | 8163 |
| <code>mistral-voxtral-mini-2602</code> | 104 | 48 | 58 | 8163 |
| <code>soniox-stt-async-v5</code> | 132 | 45 | 68 | 8163 |
| <code>speechmatics-melia-1</code> | 134 | 63 | 78 | 8163 |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `assemblyai-universal-3-5-pro` was the most accurate provider on strict speaker-aware WER, scoring 98.09/100.
- `deepgram-nova-3` was the fastest provider in this set at 8.93s.
- `deepgram-nova-3` lost the most ground once speaker changes were counted, with 0.99 percentage-point gap between text-only and speaker-aware WER.
