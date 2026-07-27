# Combined STT Provider Comparison Report

## Summary

- Root directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/stt`
- Runs aggregated: 5
  - `2026-06-15_14-29-11-559_1-audio` (17 providers)
  - `2026-06-15_14-34-10-342_2023-04-05-jsjam-react-miami-2023-10-minutes` (17 providers)
  - `2026-06-15_14-43-25-724_2022-09-30-widgets-fsjam-40-minutes` (17 providers)
  - `2026-07-16_01-20-11-985_2024-04-10-autogen-shownotes-jenn-junod` (16 providers)
  - `2026-07-16_01-27-21-117_barnum-with-robert-balicki` (18 providers)
- Distinct providers: 18 (0 local, 8 third-party non-diarization, 10 third-party diarization)
- Quality score aggregates the per-run speaker-aware WER-derived score as a mean across runs; price and speed aggregate per-run cost and processing time as means.

## Method

- Providers are matched by `providerKey` and aggregated across the runs they appear in.
- Means are taken over present values only; a provider missing a value in some runs is averaged over the runs where it is present.
- Price rankings use mean per-run monetary cost ascending, local providers at zero, missing cost last.
- Speed rankings use mean processing time ascending, missing timing last.
- Quality Score rankings use the mean speaker-aware WER-derived score descending.
- Tied ranking values break deterministically: price ties by quality descending then provider key; speed and quality ties by provider key.

**Weighted composites** are built separately for each provider group in three steps:

1. Within each run and provider group, every provider gets three 0-100 subscores. **Q** = `100 * (value - min) / (max - min)` over quality score (higher is better). **S** and **C** = `100 * (1 - (value - min) / (max - min))` over processing time and cost (lower is better). If a dimension has identical min/max values, every pooled provider receives 100 for that dimension.
2. Each provider's Q, S, and C are averaged across the runs it participated in. A provider missing a value in a run is excluded from that run's normalization pool for that dimension; a dimension missing in every covered run scores 0 and is flagged under the affected tables.
3. Composite = `w_q*Q + w_s*S + w_c*C` for each weight set below.

| Weight set | Quality | Speed | Cost |
| --- | ---: | ---: | ---: |
| Strong quality | 0.8 | 0.1 | 0.1 |
| Moderate quality | 0.6 | 0.2 | 0.2 |
| Strong speed | 0.1 | 0.8 | 0.1 |
| Moderate speed | 0.2 | 0.6 | 0.2 |
| Strong cost | 0.1 | 0.1 | 0.8 |
| Moderate cost | 0.2 | 0.2 | 0.6 |
| Quality + cost | 0.45 | 0.1 | 0.45 |
| Cost + speed | 0.1 | 0.45 | 0.45 |

**Model tiers** are computed per group with `quality-cost-terciles-v1` from the group's `qualityCost` weighted ranking only; groups are never compared against each other. That ranking orders composite descending, then quality subscore descending, then provider key. Its models are divided into three contiguous tiers of `floor(n / 3)` models, with remainder models assigned to Tier 1 and then Tier 2. Every model appears exactly once.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Speed

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

#### Weighted Rankings

Q, S, and C are each provider's per-run normalized quality, speed, and cost subscores averaged across covered runs.

##### Strong quality (0.8 quality / 0.1 speed / 0.1 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

##### Moderate quality (0.6 quality / 0.2 speed / 0.2 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

##### Strong speed (0.1 quality / 0.8 speed / 0.1 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

##### Moderate speed (0.2 quality / 0.6 speed / 0.2 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

##### Strong cost (0.1 quality / 0.1 speed / 0.8 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

##### Moderate cost (0.2 quality / 0.2 speed / 0.6 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

##### Quality + cost (0.45 quality / 0.10 speed / 0.45 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

##### Cost + speed (0.10 quality / 0.45 speed / 0.45 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |

### Third-Party Service Non-Diarization

#### Price

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>scrapecreators-youtube-transcript</code> | $0.0019 | 1 | 93.39 | 6.61% | 5.51% | not-supported | 3.06s | $0.0019 |
| 2 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | $0.0108 | 5 | 89.07 | 10.93% | 9.77% | not-supported | 34.53s | $0.0108 |
| 3 | <code>supadata-auto</code> | $0.0175 | 4 | 87.24 | 12.76% | 11.71% | not-supported | 24.46s | $0.0175 |
| 4 | <code>deepinfra-openai_whisper-large-v3</code> | $0.0242 | 5 | 94.09 | 5.91% | 4.56% | not-supported | 58.95s | $0.0242 |
| 5 | <code>groq-whisper-large-v3-turbo</code> | $0.0359 | 5 | 93.44 | 6.56% | 5.26% | not-supported | 41.92s | $0.0359 |
| 6 | <code>together-openai_whisper-large-v3</code> | $0.0808 | 5 | 93.64 | 6.36% | 5.04% | not-supported | 15.41s | $0.0808 |
| 7 | <code>groq-whisper-large-v3</code> | $0.0997 | 5 | 93.33 | 6.67% | 5.35% | not-supported | 34.91s | $0.0997 |
| 8 | <code>gemini-stt-gemini-3-flash-preview</code> | $0.2759 | 5 | 86.77 | 13.23% | 12.14% | not-supported | 261.78s | $0.2759 |

#### Speed

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>scrapecreators-youtube-transcript</code> | 3.06s | 1 | 93.39 | 6.61% | 5.51% | not-supported | 3.06s | $0.0019 |
| 2 | <code>together-openai_whisper-large-v3</code> | 15.41s | 5 | 93.64 | 6.36% | 5.04% | not-supported | 15.41s | $0.0808 |
| 3 | <code>supadata-auto</code> | 24.46s | 4 | 87.24 | 12.76% | 11.71% | not-supported | 24.46s | $0.0175 |
| 4 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 34.53s | 5 | 89.07 | 10.93% | 9.77% | not-supported | 34.53s | $0.0108 |
| 5 | <code>groq-whisper-large-v3</code> | 34.91s | 5 | 93.33 | 6.67% | 5.35% | not-supported | 34.91s | $0.0997 |
| 6 | <code>groq-whisper-large-v3-turbo</code> | 41.92s | 5 | 93.44 | 6.56% | 5.26% | not-supported | 41.92s | $0.0359 |
| 7 | <code>deepinfra-openai_whisper-large-v3</code> | 58.95s | 5 | 94.09 | 5.91% | 4.56% | not-supported | 58.95s | $0.0242 |
| 8 | <code>gemini-stt-gemini-3-flash-preview</code> | 261.78s | 5 | 86.77 | 13.23% | 12.14% | not-supported | 261.78s | $0.2759 |

#### Quality Score

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>deepinfra-openai_whisper-large-v3</code> | 94.09/100 quality score | 5 | 94.09 | 5.91% | 4.56% | not-supported | 58.95s | $0.0242 |
| 2 | <code>together-openai_whisper-large-v3</code> | 93.64/100 quality score | 5 | 93.64 | 6.36% | 5.04% | not-supported | 15.41s | $0.0808 |
| 3 | <code>groq-whisper-large-v3-turbo</code> | 93.44/100 quality score | 5 | 93.44 | 6.56% | 5.26% | not-supported | 41.92s | $0.0359 |
| 4 | <code>scrapecreators-youtube-transcript</code> | 93.39/100 quality score | 1 | 93.39 | 6.61% | 5.51% | not-supported | 3.06s | $0.0019 |
| 5 | <code>groq-whisper-large-v3</code> | 93.33/100 quality score | 5 | 93.33 | 6.67% | 5.35% | not-supported | 34.91s | $0.0997 |
| 6 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 89.07/100 quality score | 5 | 89.07 | 10.93% | 9.77% | not-supported | 34.53s | $0.0108 |
| 7 | <code>supadata-auto</code> | 87.24/100 quality score | 4 | 87.24 | 12.76% | 11.71% | not-supported | 24.46s | $0.0175 |
| 8 | <code>gemini-stt-gemini-3-flash-preview</code> | 86.77/100 quality score | 5 | 86.77 | 13.23% | 12.14% | not-supported | 261.78s | $0.2759 |

#### Weighted Rankings

Q, S, and C are each provider's per-run normalized quality, speed, and cost subscores averaged across covered runs.

##### Strong quality (0.8 quality / 0.1 speed / 0.1 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>scrapecreators-youtube-transcript</code> | 1/5 | 100.00 | 100.00 | 100.00 | 100.00 |
| 2 | <code>deepinfra-openai_whisper-large-v3</code> | 5/5 | 95.97 | 98.72 | 75.89 | 94.06 |
| 3 | <code>groq-whisper-large-v3-turbo</code> | 5/5 | 90.15 | 90.74 | 85.48 | 90.09 |
| 4 | <code>groq-whisper-large-v3</code> | 5/5 | 86.56 | 88.85 | 86.39 | 68.40 |
| 5 | <code>together-openai_whisper-large-v3</code> | 5/5 | 85.88 | 85.74 | 98.08 | 74.82 |
| 6 | <code>gemini-stt-gemini-3-flash-preview</code> | 5/5 | 51.35 | 62.76 | 0.00 | 11.48 |
| 7 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 5/5 | 49.82 | 39.85 | 80.78 | 98.65 |
| 8 | <code>supadata-auto</code> | 4/5 | 45.15 | 40.28 | 79.57 | 49.75 |

##### Moderate quality (0.6 quality / 0.2 speed / 0.2 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>scrapecreators-youtube-transcript</code> | 1/5 | 100.00 | 100.00 | 100.00 | 100.00 |
| 2 | <code>deepinfra-openai_whisper-large-v3</code> | 5/5 | 93.22 | 98.72 | 75.89 | 94.06 |
| 3 | <code>groq-whisper-large-v3-turbo</code> | 5/5 | 89.56 | 90.74 | 85.48 | 90.09 |
| 4 | <code>together-openai_whisper-large-v3</code> | 5/5 | 86.02 | 85.74 | 98.08 | 74.82 |
| 5 | <code>groq-whisper-large-v3</code> | 5/5 | 84.27 | 88.85 | 86.39 | 68.40 |
| 6 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 5/5 | 59.79 | 39.85 | 80.78 | 98.65 |
| 7 | <code>supadata-auto</code> | 4/5 | 50.03 | 40.28 | 79.57 | 49.75 |
| 8 | <code>gemini-stt-gemini-3-flash-preview</code> | 5/5 | 39.95 | 62.76 | 0.00 | 11.48 |

##### Strong speed (0.1 quality / 0.8 speed / 0.1 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>scrapecreators-youtube-transcript</code> | 1/5 | 100.00 | 100.00 | 100.00 | 100.00 |
| 2 | <code>together-openai_whisper-large-v3</code> | 5/5 | 94.52 | 85.74 | 98.08 | 74.82 |
| 3 | <code>groq-whisper-large-v3-turbo</code> | 5/5 | 86.46 | 90.74 | 85.48 | 90.09 |
| 4 | <code>groq-whisper-large-v3</code> | 5/5 | 84.84 | 88.85 | 86.39 | 68.40 |
| 5 | <code>deepinfra-openai_whisper-large-v3</code> | 5/5 | 79.99 | 98.72 | 75.89 | 94.06 |
| 6 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 5/5 | 78.47 | 39.85 | 80.78 | 98.65 |
| 7 | <code>supadata-auto</code> | 4/5 | 72.66 | 40.28 | 79.57 | 49.75 |
| 8 | <code>gemini-stt-gemini-3-flash-preview</code> | 5/5 | 7.42 | 62.76 | 0.00 | 11.48 |

##### Moderate speed (0.2 quality / 0.6 speed / 0.2 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>scrapecreators-youtube-transcript</code> | 1/5 | 100.00 | 100.00 | 100.00 | 100.00 |
| 2 | <code>together-openai_whisper-large-v3</code> | 5/5 | 90.96 | 85.74 | 98.08 | 74.82 |
| 3 | <code>groq-whisper-large-v3-turbo</code> | 5/5 | 87.45 | 90.74 | 85.48 | 90.09 |
| 4 | <code>deepinfra-openai_whisper-large-v3</code> | 5/5 | 84.09 | 98.72 | 75.89 | 94.06 |
| 5 | <code>groq-whisper-large-v3</code> | 5/5 | 83.28 | 88.85 | 86.39 | 68.40 |
| 6 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 5/5 | 76.17 | 39.85 | 80.78 | 98.65 |
| 7 | <code>supadata-auto</code> | 4/5 | 65.75 | 40.28 | 79.57 | 49.75 |
| 8 | <code>gemini-stt-gemini-3-flash-preview</code> | 5/5 | 14.85 | 62.76 | 0.00 | 11.48 |

##### Strong cost (0.1 quality / 0.1 speed / 0.8 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>scrapecreators-youtube-transcript</code> | 1/5 | 100.00 | 100.00 | 100.00 | 100.00 |
| 2 | <code>deepinfra-openai_whisper-large-v3</code> | 5/5 | 92.71 | 98.72 | 75.89 | 94.06 |
| 3 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 5/5 | 90.98 | 39.85 | 80.78 | 98.65 |
| 4 | <code>groq-whisper-large-v3-turbo</code> | 5/5 | 89.69 | 90.74 | 85.48 | 90.09 |
| 5 | <code>together-openai_whisper-large-v3</code> | 5/5 | 78.23 | 85.74 | 98.08 | 74.82 |
| 6 | <code>groq-whisper-large-v3</code> | 5/5 | 72.24 | 88.85 | 86.39 | 68.40 |
| 7 | <code>supadata-auto</code> | 4/5 | 51.78 | 40.28 | 79.57 | 49.75 |
| 8 | <code>gemini-stt-gemini-3-flash-preview</code> | 5/5 | 15.46 | 62.76 | 0.00 | 11.48 |

##### Moderate cost (0.2 quality / 0.2 speed / 0.6 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>scrapecreators-youtube-transcript</code> | 1/5 | 100.00 | 100.00 | 100.00 | 100.00 |
| 2 | <code>deepinfra-openai_whisper-large-v3</code> | 5/5 | 91.36 | 98.72 | 75.89 | 94.06 |
| 3 | <code>groq-whisper-large-v3-turbo</code> | 5/5 | 89.30 | 90.74 | 85.48 | 90.09 |
| 4 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 5/5 | 83.31 | 39.85 | 80.78 | 98.65 |
| 5 | <code>together-openai_whisper-large-v3</code> | 5/5 | 81.65 | 85.74 | 98.08 | 74.82 |
| 6 | <code>groq-whisper-large-v3</code> | 5/5 | 76.09 | 88.85 | 86.39 | 68.40 |
| 7 | <code>supadata-auto</code> | 4/5 | 53.82 | 40.28 | 79.57 | 49.75 |
| 8 | <code>gemini-stt-gemini-3-flash-preview</code> | 5/5 | 19.44 | 62.76 | 0.00 | 11.48 |

##### Quality + cost (0.45 quality / 0.10 speed / 0.45 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>scrapecreators-youtube-transcript</code> | 1/5 | 100.00 | 100.00 | 100.00 | 100.00 |
| 2 | <code>deepinfra-openai_whisper-large-v3</code> | 5/5 | 94.34 | 98.72 | 75.89 | 94.06 |
| 3 | <code>groq-whisper-large-v3-turbo</code> | 5/5 | 89.92 | 90.74 | 85.48 | 90.09 |
| 4 | <code>together-openai_whisper-large-v3</code> | 5/5 | 82.06 | 85.74 | 98.08 | 74.82 |
| 5 | <code>groq-whisper-large-v3</code> | 5/5 | 79.40 | 88.85 | 86.39 | 68.40 |
| 6 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 5/5 | 70.40 | 39.85 | 80.78 | 98.65 |
| 7 | <code>supadata-auto</code> | 4/5 | 48.47 | 40.28 | 79.57 | 49.75 |
| 8 | <code>gemini-stt-gemini-3-flash-preview</code> | 5/5 | 33.41 | 62.76 | 0.00 | 11.48 |

##### Cost + speed (0.10 quality / 0.45 speed / 0.45 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>scrapecreators-youtube-transcript</code> | 1/5 | 100.00 | 100.00 | 100.00 | 100.00 |
| 2 | <code>groq-whisper-large-v3-turbo</code> | 5/5 | 88.08 | 90.74 | 85.48 | 90.09 |
| 3 | <code>together-openai_whisper-large-v3</code> | 5/5 | 86.38 | 85.74 | 98.08 | 74.82 |
| 4 | <code>deepinfra-openai_whisper-large-v3</code> | 5/5 | 86.35 | 98.72 | 75.89 | 94.06 |
| 5 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 5/5 | 84.73 | 39.85 | 80.78 | 98.65 |
| 6 | <code>groq-whisper-large-v3</code> | 5/5 | 78.54 | 88.85 | 86.39 | 68.40 |
| 7 | <code>supadata-auto</code> | 4/5 | 62.22 | 40.28 | 79.57 | 49.75 |
| 8 | <code>gemini-stt-gemini-3-flash-preview</code> | 5/5 | 11.44 | 62.76 | 0.00 | 11.48 |

### Third-Party Service Diarization

#### Price

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>grok-speech-to-text</code> | $0.0498 | 5 | 89.71 | 10.29% | 9.79% | supported | 55.47s | $0.0498 |
| 2 | <code>soniox-stt-async-v4</code> | $0.0898 | 5 | 95.30 | 4.70% | 4.24% | supported | 141.71s | $0.0898 |
| 3 | <code>rev-low_cost</code> | $0.0898 | 5 | 92.07 | 7.93% | 7.31% | supported | 179.74s | $0.0898 |
| 4 | <code>happyscribe-auto</code> | $0.1028 | 5 | 96.25 | 3.75% | 3.43% | supported | 93.79s | $0.1028 |
| 5 | <code>mistral-voxtral-mini-2602</code> | $0.1078 | 5 | 95.16 | 4.84% | 4.49% | supported | 34.80s | $0.1078 |
| 6 | <code>rev-machine</code> | $0.1796 | 5 | 92.71 | 7.29% | 6.66% | supported | 101.59s | $0.1796 |
| 7 | <code>assemblyai-universal-3-pro</code> | $0.1886 | 5 | 96.59 | 3.41% | 3.10% | supported | 40.77s | $0.1886 |
| 8 | <code>deepgram-nova-3</code> | $0.5227 | 5 | 92.71 | 7.29% | 6.18% | supported | 15.58s | $0.5227 |
| 9 | <code>gladia-default</code> | $0.5479 | 5 | 79.51 | 20.49% | 19.94% | supported | 27.25s | $0.5479 |
| 10 | <code>speechmatics-enhanced</code> | $0.6736 | 5 | 94.53 | 5.47% | 5.02% | supported | 148.16s | $0.6736 |

#### Speed

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>deepgram-nova-3</code> | 15.58s | 5 | 92.71 | 7.29% | 6.18% | supported | 15.58s | $0.5227 |
| 2 | <code>gladia-default</code> | 27.25s | 5 | 79.51 | 20.49% | 19.94% | supported | 27.25s | $0.5479 |
| 3 | <code>mistral-voxtral-mini-2602</code> | 34.80s | 5 | 95.16 | 4.84% | 4.49% | supported | 34.80s | $0.1078 |
| 4 | <code>assemblyai-universal-3-pro</code> | 40.77s | 5 | 96.59 | 3.41% | 3.10% | supported | 40.77s | $0.1886 |
| 5 | <code>grok-speech-to-text</code> | 55.47s | 5 | 89.71 | 10.29% | 9.79% | supported | 55.47s | $0.0498 |
| 6 | <code>happyscribe-auto</code> | 93.79s | 5 | 96.25 | 3.75% | 3.43% | supported | 93.79s | $0.1028 |
| 7 | <code>rev-machine</code> | 101.59s | 5 | 92.71 | 7.29% | 6.66% | supported | 101.59s | $0.1796 |
| 8 | <code>soniox-stt-async-v4</code> | 141.71s | 5 | 95.30 | 4.70% | 4.24% | supported | 141.71s | $0.0898 |
| 9 | <code>speechmatics-enhanced</code> | 148.16s | 5 | 94.53 | 5.47% | 5.02% | supported | 148.16s | $0.6736 |
| 10 | <code>rev-low_cost</code> | 179.74s | 5 | 92.07 | 7.93% | 7.31% | supported | 179.74s | $0.0898 |

#### Quality Score

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Mean Cost |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | <code>assemblyai-universal-3-pro</code> | 96.59/100 quality score | 5 | 96.59 | 3.41% | 3.10% | supported | 40.77s | $0.1886 |
| 2 | <code>happyscribe-auto</code> | 96.25/100 quality score | 5 | 96.25 | 3.75% | 3.43% | supported | 93.79s | $0.1028 |
| 3 | <code>soniox-stt-async-v4</code> | 95.30/100 quality score | 5 | 95.30 | 4.70% | 4.24% | supported | 141.71s | $0.0898 |
| 4 | <code>mistral-voxtral-mini-2602</code> | 95.16/100 quality score | 5 | 95.16 | 4.84% | 4.49% | supported | 34.80s | $0.1078 |
| 5 | <code>speechmatics-enhanced</code> | 94.53/100 quality score | 5 | 94.53 | 5.47% | 5.02% | supported | 148.16s | $0.6736 |
| 6 | <code>rev-machine</code> | 92.71/100 quality score | 5 | 92.71 | 7.29% | 6.66% | supported | 101.59s | $0.1796 |
| 7 | <code>deepgram-nova-3</code> | 92.71/100 quality score | 5 | 92.71 | 7.29% | 6.18% | supported | 15.58s | $0.5227 |
| 8 | <code>rev-low_cost</code> | 92.07/100 quality score | 5 | 92.07 | 7.93% | 7.31% | supported | 179.74s | $0.0898 |
| 9 | <code>grok-speech-to-text</code> | 89.71/100 quality score | 5 | 89.71 | 10.29% | 9.79% | supported | 55.47s | $0.0498 |
| 10 | <code>gladia-default</code> | 79.51/100 quality score | 5 | 79.51 | 20.49% | 19.94% | supported | 27.25s | $0.5479 |

#### Weighted Rankings

Q, S, and C are each provider's per-run normalized quality, speed, and cost subscores averaged across covered runs.

##### Strong quality (0.8 quality / 0.1 speed / 0.1 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>assemblyai-universal-3-pro</code> | 5/5 | 92.19 | 94.74 | 85.39 | 78.65 |
| 2 | <code>happyscribe-auto</code> | 5/5 | 84.37 | 93.15 | 44.64 | 53.85 |
| 3 | <code>mistral-voxtral-mini-2602</code> | 5/5 | 76.44 | 72.89 | 89.54 | 91.75 |
| 4 | <code>soniox-stt-async-v4</code> | 5/5 | 74.64 | 75.16 | 50.47 | 94.67 |
| 5 | <code>speechmatics-enhanced</code> | 5/5 | 58.40 | 68.41 | 36.73 | 0.00 |
| 6 | <code>rev-machine</code> | 5/5 | 55.42 | 54.07 | 41.60 | 80.06 |
| 7 | <code>deepgram-nova-3</code> | 5/5 | 53.59 | 51.71 | 97.81 | 24.47 |
| 8 | <code>rev-low_cost</code> | 5/5 | 47.82 | 46.79 | 9.25 | 94.64 |
| 9 | <code>gladia-default</code> | 5/5 | 39.82 | 36.56 | 85.29 | 20.39 |
| 10 | <code>grok-speech-to-text</code> | 5/5 | 34.23 | 20.17 | 84.29 | 96.67 |

##### Moderate quality (0.6 quality / 0.2 speed / 0.2 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>assemblyai-universal-3-pro</code> | 5/5 | 89.65 | 94.74 | 85.39 | 78.65 |
| 2 | <code>mistral-voxtral-mini-2602</code> | 5/5 | 79.99 | 72.89 | 89.54 | 91.75 |
| 3 | <code>happyscribe-auto</code> | 5/5 | 75.59 | 93.15 | 44.64 | 53.85 |
| 4 | <code>soniox-stt-async-v4</code> | 5/5 | 74.12 | 75.16 | 50.47 | 94.67 |
| 5 | <code>rev-machine</code> | 5/5 | 56.77 | 54.07 | 41.60 | 80.06 |
| 6 | <code>deepgram-nova-3</code> | 5/5 | 55.48 | 51.71 | 97.81 | 24.47 |
| 7 | <code>rev-low_cost</code> | 5/5 | 48.85 | 46.79 | 9.25 | 94.64 |
| 8 | <code>speechmatics-enhanced</code> | 5/5 | 48.39 | 68.41 | 36.73 | 0.00 |
| 9 | <code>grok-speech-to-text</code> | 5/5 | 48.29 | 20.17 | 84.29 | 96.67 |
| 10 | <code>gladia-default</code> | 5/5 | 43.07 | 36.56 | 85.29 | 20.39 |

##### Strong speed (0.1 quality / 0.8 speed / 0.1 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral-voxtral-mini-2602</code> | 5/5 | 88.09 | 72.89 | 89.54 | 91.75 |
| 2 | <code>deepgram-nova-3</code> | 5/5 | 85.86 | 51.71 | 97.81 | 24.47 |
| 3 | <code>assemblyai-universal-3-pro</code> | 5/5 | 85.65 | 94.74 | 85.39 | 78.65 |
| 4 | <code>grok-speech-to-text</code> | 5/5 | 79.11 | 20.17 | 84.29 | 96.67 |
| 5 | <code>gladia-default</code> | 5/5 | 73.93 | 36.56 | 85.29 | 20.39 |
| 6 | <code>soniox-stt-async-v4</code> | 5/5 | 57.36 | 75.16 | 50.47 | 94.67 |
| 7 | <code>happyscribe-auto</code> | 5/5 | 50.41 | 93.15 | 44.64 | 53.85 |
| 8 | <code>rev-machine</code> | 5/5 | 46.69 | 54.07 | 41.60 | 80.06 |
| 9 | <code>speechmatics-enhanced</code> | 5/5 | 36.22 | 68.41 | 36.73 | 0.00 |
| 10 | <code>rev-low_cost</code> | 5/5 | 21.54 | 46.79 | 9.25 | 94.64 |

##### Moderate speed (0.2 quality / 0.6 speed / 0.2 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral-voxtral-mini-2602</code> | 5/5 | 86.65 | 72.89 | 89.54 | 91.75 |
| 2 | <code>assemblyai-universal-3-pro</code> | 5/5 | 85.91 | 94.74 | 85.39 | 78.65 |
| 3 | <code>grok-speech-to-text</code> | 5/5 | 73.94 | 20.17 | 84.29 | 96.67 |
| 4 | <code>deepgram-nova-3</code> | 5/5 | 73.92 | 51.71 | 97.81 | 24.47 |
| 5 | <code>soniox-stt-async-v4</code> | 5/5 | 64.25 | 75.16 | 50.47 | 94.67 |
| 6 | <code>gladia-default</code> | 5/5 | 62.57 | 36.56 | 85.29 | 20.39 |
| 7 | <code>happyscribe-auto</code> | 5/5 | 56.18 | 93.15 | 44.64 | 53.85 |
| 8 | <code>rev-machine</code> | 5/5 | 51.79 | 54.07 | 41.60 | 80.06 |
| 9 | <code>speechmatics-enhanced</code> | 5/5 | 35.72 | 68.41 | 36.73 | 0.00 |
| 10 | <code>rev-low_cost</code> | 5/5 | 33.83 | 46.79 | 9.25 | 94.64 |

##### Strong cost (0.1 quality / 0.1 speed / 0.8 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral-voxtral-mini-2602</code> | 5/5 | 89.65 | 72.89 | 89.54 | 91.75 |
| 2 | <code>soniox-stt-async-v4</code> | 5/5 | 88.30 | 75.16 | 50.47 | 94.67 |
| 3 | <code>grok-speech-to-text</code> | 5/5 | 87.78 | 20.17 | 84.29 | 96.67 |
| 4 | <code>rev-low_cost</code> | 5/5 | 81.32 | 46.79 | 9.25 | 94.64 |
| 5 | <code>assemblyai-universal-3-pro</code> | 5/5 | 80.93 | 94.74 | 85.39 | 78.65 |
| 6 | <code>rev-machine</code> | 5/5 | 73.61 | 54.07 | 41.60 | 80.06 |
| 7 | <code>happyscribe-auto</code> | 5/5 | 56.86 | 93.15 | 44.64 | 53.85 |
| 8 | <code>deepgram-nova-3</code> | 5/5 | 34.53 | 51.71 | 97.81 | 24.47 |
| 9 | <code>gladia-default</code> | 5/5 | 28.50 | 36.56 | 85.29 | 20.39 |
| 10 | <code>speechmatics-enhanced</code> | 5/5 | 10.51 | 68.41 | 36.73 | 0.00 |

##### Moderate cost (0.2 quality / 0.2 speed / 0.6 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral-voxtral-mini-2602</code> | 5/5 | 87.54 | 72.89 | 89.54 | 91.75 |
| 2 | <code>assemblyai-universal-3-pro</code> | 5/5 | 83.21 | 94.74 | 85.39 | 78.65 |
| 3 | <code>soniox-stt-async-v4</code> | 5/5 | 81.93 | 75.16 | 50.47 | 94.67 |
| 4 | <code>grok-speech-to-text</code> | 5/5 | 78.89 | 20.17 | 84.29 | 96.67 |
| 5 | <code>rev-low_cost</code> | 5/5 | 67.99 | 46.79 | 9.25 | 94.64 |
| 6 | <code>rev-machine</code> | 5/5 | 67.17 | 54.07 | 41.60 | 80.06 |
| 7 | <code>happyscribe-auto</code> | 5/5 | 59.86 | 93.15 | 44.64 | 53.85 |
| 8 | <code>deepgram-nova-3</code> | 5/5 | 44.58 | 51.71 | 97.81 | 24.47 |
| 9 | <code>gladia-default</code> | 5/5 | 36.61 | 36.56 | 85.29 | 20.39 |
| 10 | <code>speechmatics-enhanced</code> | 5/5 | 21.03 | 68.41 | 36.73 | 0.00 |

##### Quality + cost (0.45 quality / 0.10 speed / 0.45 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>assemblyai-universal-3-pro</code> | 5/5 | 86.56 | 94.74 | 85.39 | 78.65 |
| 2 | <code>mistral-voxtral-mini-2602</code> | 5/5 | 83.04 | 72.89 | 89.54 | 91.75 |
| 3 | <code>soniox-stt-async-v4</code> | 5/5 | 81.47 | 75.16 | 50.47 | 94.67 |
| 4 | <code>happyscribe-auto</code> | 5/5 | 70.61 | 93.15 | 44.64 | 53.85 |
| 5 | <code>rev-low_cost</code> | 5/5 | 64.57 | 46.79 | 9.25 | 94.64 |
| 6 | <code>rev-machine</code> | 5/5 | 64.52 | 54.07 | 41.60 | 80.06 |
| 7 | <code>grok-speech-to-text</code> | 5/5 | 61.01 | 20.17 | 84.29 | 96.67 |
| 8 | <code>deepgram-nova-3</code> | 5/5 | 44.06 | 51.71 | 97.81 | 24.47 |
| 9 | <code>speechmatics-enhanced</code> | 5/5 | 34.46 | 68.41 | 36.73 | 0.00 |
| 10 | <code>gladia-default</code> | 5/5 | 34.16 | 36.56 | 85.29 | 20.39 |

##### Cost + speed (0.10 quality / 0.45 speed / 0.45 cost)

| Rank | Provider | Coverage | Composite | Q | S | C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | <code>mistral-voxtral-mini-2602</code> | 5/5 | 88.87 | 72.89 | 89.54 | 91.75 |
| 2 | <code>grok-speech-to-text</code> | 5/5 | 83.45 | 20.17 | 84.29 | 96.67 |
| 3 | <code>assemblyai-universal-3-pro</code> | 5/5 | 83.29 | 94.74 | 85.39 | 78.65 |
| 4 | <code>soniox-stt-async-v4</code> | 5/5 | 72.83 | 75.16 | 50.47 | 94.67 |
| 5 | <code>deepgram-nova-3</code> | 5/5 | 60.19 | 51.71 | 97.81 | 24.47 |
| 6 | <code>rev-machine</code> | 5/5 | 60.15 | 54.07 | 41.60 | 80.06 |
| 7 | <code>happyscribe-auto</code> | 5/5 | 53.63 | 93.15 | 44.64 | 53.85 |
| 8 | <code>rev-low_cost</code> | 5/5 | 51.43 | 46.79 | 9.25 | 94.64 |
| 9 | <code>gladia-default</code> | 5/5 | 51.21 | 36.56 | 85.29 | 20.39 |
| 10 | <code>speechmatics-enhanced</code> | 5/5 | 23.37 | 68.41 | 36.73 | 0.00 |

## Per-Run Quality Score

Speaker-aware WER-derived quality score per provider in each run, sorted by mean.

### Third-Party Service Non-Diarization

| Provider | Mean | 2026-06-15_14-29-11-559_1-audio | 2026-06-15_14-34-10-342_2023-04-05-jsjam-react-miami-2023-10-minutes | 2026-06-15_14-43-25-724_2022-09-30-widgets-fsjam-40-minutes | 2026-07-16_01-20-11-985_2024-04-10-autogen-shownotes-jenn-junod | 2026-07-16_01-27-21-117_barnum-with-robert-balicki |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| <code>deepinfra-openai_whisper-large-v3</code> | 94.09 | 95.79 | 93.75 | 96.44 | 91.28 | 93.18 |
| <code>together-openai_whisper-large-v3</code> | 93.64 | 95.33 | 93.92 | 96.23 | 89.96 | 92.74 |
| <code>groq-whisper-large-v3-turbo</code> | 93.44 | 93.46 | 92.86 | 96.39 | 91.15 | 93.35 |
| <code>scrapecreators-youtube-transcript</code> | 93.39 | — | — | — | — | 93.39 |
| <code>groq-whisper-large-v3</code> | 93.33 | 92.99 | 93.51 | 96.06 | 91.02 | 93.07 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 89.07 | 87.38 | 89.79 | 87.78 | 89.01 | 91.39 |
| <code>supadata-auto</code> | 87.24 | 92.52 | 81.18 | 81.87 | — | 93.39 |
| <code>gemini-stt-gemini-3-flash-preview</code> | 86.77 | 93.46 | 94.51 | 96.15 | 90.00 | 59.74 |

### Third-Party Service Diarization

| Provider | Mean | 2026-06-15_14-29-11-559_1-audio | 2026-06-15_14-34-10-342_2023-04-05-jsjam-react-miami-2023-10-minutes | 2026-06-15_14-43-25-724_2022-09-30-widgets-fsjam-40-minutes | 2026-07-16_01-20-11-985_2024-04-10-autogen-shownotes-jenn-junod | 2026-07-16_01-27-21-117_barnum-with-robert-balicki |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| <code>assemblyai-universal-3-pro</code> | 96.59 | 95.79 | 96.05 | 99.62 | 97.20 | 94.30 |
| <code>happyscribe-auto</code> | 96.25 | 95.33 | 96.52 | 99.21 | 96.21 | 94.01 |
| <code>soniox-stt-async-v4</code> | 95.30 | 97.20 | 95.52 | 96.40 | 92.45 | 94.92 |
| <code>mistral-voxtral-mini-2602</code> | 95.16 | 97.66 | 94.75 | 97.31 | 91.85 | 94.22 |
| <code>speechmatics-enhanced</code> | 94.53 | 96.26 | 95.10 | 96.57 | 90.84 | 93.87 |
| <code>rev-machine</code> | 92.71 | 91.59 | 95.58 | 94.29 | 89.16 | 92.95 |
| <code>deepgram-nova-3</code> | 92.71 | 92.99 | 94.69 | 95.37 | 87.93 | 92.58 |
| <code>rev-low_cost</code> | 92.07 | 90.65 | 95.04 | 93.59 | 88.61 | 92.44 |
| <code>grok-speech-to-text</code> | 89.71 | 83.64 | 92.63 | 92.28 | 88.44 | 91.55 |
| <code>gladia-default</code> | 79.51 | 93.93 | 93.04 | 96.81 | 91.37 | 22.41 |

## Model Tiers

Tiers are `quality-cost-terciles-v1`: contiguous, near-equal slices of each group's `qualityCost` weighted ranking, with remainder models assigned to higher tiers first. Groups are never compared against each other.

### Local

| Tier | Models (quality-cost rank · composite) | Basis |
| --- | --- | --- |
| Tier 1 | none | Highest quality-cost tercile; no models fall in this tier for this group size. |
| Tier 2 | none | Middle quality-cost tercile; no models fall in this tier for this group size. |
| Tier 3 | none | Lower quality-cost tercile; no models fall in this tier for this group size. |

### Third-Party Service Non-Diarization

| Tier | Models (quality-cost rank · composite) | Basis |
| --- | --- | --- |
| Tier 1 | <code>scrapecreators-youtube-transcript</code> (#1 · 100.00), <code>deepinfra-openai_whisper-large-v3</code> (#2 · 94.34), <code>groq-whisper-large-v3-turbo</code> (#3 · 89.92) | Highest quality-cost tercile (ranks 1-3). |
| Tier 2 | <code>together-openai_whisper-large-v3</code> (#4 · 82.06), <code>groq-whisper-large-v3</code> (#5 · 79.40), <code>deepinfra-openai_whisper-large-v3-turbo</code> (#6 · 70.40) | Middle quality-cost tercile (ranks 4-6). |
| Tier 3 | <code>supadata-auto</code> (#7 · 48.47), <code>gemini-stt-gemini-3-flash-preview</code> (#8 · 33.41) | Lower quality-cost tercile (ranks 7-8). |

### Third-Party Service Diarization

| Tier | Models (quality-cost rank · composite) | Basis |
| --- | --- | --- |
| Tier 1 | <code>assemblyai-universal-3-pro</code> (#1 · 86.56), <code>mistral-voxtral-mini-2602</code> (#2 · 83.04), <code>soniox-stt-async-v4</code> (#3 · 81.47), <code>happyscribe-auto</code> (#4 · 70.61) | Highest quality-cost tercile (ranks 1-4). |
| Tier 2 | <code>rev-low_cost</code> (#5 · 64.57), <code>rev-machine</code> (#6 · 64.52), <code>grok-speech-to-text</code> (#7 · 61.01) | Middle quality-cost tercile (ranks 5-7). |
| Tier 3 | <code>deepgram-nova-3</code> (#8 · 44.06), <code>speechmatics-enhanced</code> (#9 · 34.46), <code>gladia-default</code> (#10 · 34.16) | Lower quality-cost tercile (ranks 8-10). |

## Notes

- Each provider is aggregated by providerKey across the runs it appears in; the mean is taken over present values only.
- Groups follow the single-run STT contract: local, thirdPartyServiceNonDiarization, thirdPartyServiceDiarization.
- Weighted composite rankings and quality-cost tercile model tiers are emitted per group; no cross-group overall or rankingSurfaces leaderboard is emitted, and single-run reports remain tier-free.
