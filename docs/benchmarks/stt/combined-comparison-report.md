# Combined STT Provider Comparison Report

## Summary

- Root directory: `/Users/ajc/c/autoshow-cli/docs/benchmarks/stt`
- Runs aggregated: 5
  - `2026-06-15_14-29-11-559_1-audio` (25 providers)
  - `2026-06-15_14-34-10-342_2023-04-05-jsjam-react-miami-2023-10-minutes` (25 providers)
  - `2026-06-15_14-43-25-724_2022-09-30-widgets-fsjam-40-minutes` (25 providers)
  - `2026-07-16_01-20-11-985_2024-04-10-autogen-shownotes-jenn-junod` (24 providers)
  - `2026-07-16_01-27-21-117_barnum-with-robert-balicki` (26 providers)
- Distinct providers: 26 (0 local, 10 third-party non-diarization, 16 third-party diarization)
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

| Weight set       | Quality | Speed | Cost |
| ---------------- | ------: | ----: | ---: |
| Strong quality   |     0.8 |   0.1 |  0.1 |
| Moderate quality |     0.6 |   0.2 |  0.2 |
| Strong speed     |     0.1 |   0.8 |  0.1 |
| Moderate speed   |     0.2 |   0.6 |  0.2 |
| Strong cost      |     0.1 |   0.1 |  0.8 |
| Moderate cost    |     0.2 |   0.2 |  0.6 |
| Quality + cost   |    0.45 |   0.1 | 0.45 |
| Cost + speed     |     0.1 |  0.45 | 0.45 |

**Model tiers** are computed per group with `quality-cost-terciles-v1` from the group's `qualityCost` weighted ranking only; groups are never compared against each other. That ranking orders composite descending, then quality subscore descending, then provider key. Its models are divided into three contiguous tiers of `floor(n / 3)` models, with remainder models assigned to Tier 1 and then Tier 2. Every model appears exactly once.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput |                   Mean Cost |
| ---: | -------- | ----: | ---: | ---------------: | ---------------------: | -----------------: | ----------- | ---------: | ---------: | --------------------------: |
|  n/a | n/a      |   n/a |  n/a |              n/a |                    n/a |                n/a | n/a         |        n/a |        n/a | No providers in this group. |

#### Speed

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput |                   Mean Cost |
| ---: | -------- | ----: | ---: | ---------------: | ---------------------: | -----------------: | ----------- | ---------: | ---------: | --------------------------: |
|  n/a | n/a      |   n/a |  n/a |              n/a |                    n/a |                n/a | n/a         |        n/a |        n/a | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput |                   Mean Cost |
| ---: | -------- | ----: | ---: | ---------------: | ---------------------: | -----------------: | ----------- | ---------: | ---------: | --------------------------: |
|  n/a | n/a      |   n/a |  n/a |              n/a |                    n/a |                n/a | n/a         |        n/a |        n/a | No providers in this group. |

#### Weighted Rankings

Q, S, and C are each provider's per-run normalized quality, speed, and cost subscores averaged across covered runs.

##### Strong quality (0.8 quality / 0.1 speed / 0.1 cost)

| Rank | Provider | Coverage | Composite |   Q |   S |                           C |
| ---: | -------- | -------: | --------: | --: | --: | --------------------------: |
|  n/a | n/a      |      n/a |       n/a | n/a | n/a | No providers in this group. |

##### Moderate quality (0.6 quality / 0.2 speed / 0.2 cost)

| Rank | Provider | Coverage | Composite |   Q |   S |                           C |
| ---: | -------- | -------: | --------: | --: | --: | --------------------------: |
|  n/a | n/a      |      n/a |       n/a | n/a | n/a | No providers in this group. |

##### Strong speed (0.1 quality / 0.8 speed / 0.1 cost)

| Rank | Provider | Coverage | Composite |   Q |   S |                           C |
| ---: | -------- | -------: | --------: | --: | --: | --------------------------: |
|  n/a | n/a      |      n/a |       n/a | n/a | n/a | No providers in this group. |

##### Moderate speed (0.2 quality / 0.6 speed / 0.2 cost)

| Rank | Provider | Coverage | Composite |   Q |   S |                           C |
| ---: | -------- | -------: | --------: | --: | --: | --------------------------: |
|  n/a | n/a      |      n/a |       n/a | n/a | n/a | No providers in this group. |

##### Strong cost (0.1 quality / 0.1 speed / 0.8 cost)

| Rank | Provider | Coverage | Composite |   Q |   S |                           C |
| ---: | -------- | -------: | --------: | --: | --: | --------------------------: |
|  n/a | n/a      |      n/a |       n/a | n/a | n/a | No providers in this group. |

##### Moderate cost (0.2 quality / 0.2 speed / 0.6 cost)

| Rank | Provider | Coverage | Composite |   Q |   S |                           C |
| ---: | -------- | -------: | --------: | --: | --: | --------------------------: |
|  n/a | n/a      |      n/a |       n/a | n/a | n/a | No providers in this group. |

##### Quality + cost (0.45 quality / 0.10 speed / 0.45 cost)

| Rank | Provider | Coverage | Composite |   Q |   S |                           C |
| ---: | -------- | -------: | --------: | --: | --: | --------------------------: |
|  n/a | n/a      |      n/a |       n/a | n/a | n/a | No providers in this group. |

##### Cost + speed (0.10 quality / 0.45 speed / 0.45 cost)

| Rank | Provider | Coverage | Composite |   Q |   S |                           C |
| ---: | -------- | -------: | --------: | --: | --: | --------------------------: |
|  n/a | n/a      |      n/a |       n/a | n/a | n/a | No providers in this group. |

### Third-Party Service Non-Diarization

#### Price

| Rank | Provider                                             |   Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization   | Mean Speed | Throughput | Mean Cost |
| ---: | ---------------------------------------------------- | ------: | ---: | ---------------: | ---------------------: | -----------------: | ------------- | ---------: | ---------: | --------: |
|    1 | <code>scrapecreators-youtube-transcript</code>       | $0.0019 |    1 |            93.39 |                  6.61% |              5.51% | not-supported |      3.06s |   2942.14× |   $0.0019 |
|    2 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | $0.0108 |    5 |            89.07 |                 10.93% |              9.77% | not-supported |     34.53s |     93.64× |   $0.0108 |
|    3 | <code>supadata-auto</code>                           | $0.0175 |    4 |            87.24 |                 12.76% |             11.71% | not-supported |     24.46s |    123.47× |   $0.0175 |
|    4 | <code>deepinfra-openai_whisper-large-v3</code>       | $0.0242 |    5 |            94.09 |                  5.91% |              4.56% | not-supported |     58.95s |     54.85× |   $0.0242 |
|    5 | <code>groq-whisper-large-v3-turbo</code>             | $0.0359 |    5 |            93.44 |                  6.56% |              5.26% | not-supported |     41.92s |     77.13× |   $0.0359 |
|    6 | <code>together-openai_whisper-large-v3</code>        | $0.0808 |    5 |            93.64 |                  6.36% |              5.04% | not-supported |     15.41s |    209.77× |   $0.0808 |
|    7 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    | $0.0808 |    5 |            92.73 |                  7.27% |              6.01% | not-supported |      3.63s |    889.55× |   $0.0808 |
|    8 | <code>groq-whisper-large-v3</code>                   | $0.0997 |    5 |            93.33 |                  6.67% |              5.35% | not-supported |     34.91s |     92.62× |   $0.0997 |
|    9 | <code>gemini-stt-gemini-3-flash-preview</code>       | $0.2759 |    5 |            86.77 |                 13.23% |             12.14% | not-supported |    261.78s |     12.35× |   $0.2759 |
|   10 | <code>gemini-stt-gemini-3.6-flash</code>             | $0.5301 |    5 |            84.59 |                 15.41% |             14.38% | not-supported |    249.08s |     12.98× |   $0.5301 |

#### Speed

| Rank | Provider                                             |   Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization   | Mean Speed | Throughput | Mean Cost |
| ---: | ---------------------------------------------------- | ------: | ---: | ---------------: | ---------------------: | -----------------: | ------------- | ---------: | ---------: | --------: |
|    1 | <code>scrapecreators-youtube-transcript</code>       |   3.06s |    1 |            93.39 |                  6.61% |              5.51% | not-supported |      3.06s |   2942.14× |   $0.0019 |
|    2 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    |   3.63s |    5 |            92.73 |                  7.27% |              6.01% | not-supported |      3.63s |    889.55× |   $0.0808 |
|    3 | <code>together-openai_whisper-large-v3</code>        |  15.41s |    5 |            93.64 |                  6.36% |              5.04% | not-supported |     15.41s |    209.77× |   $0.0808 |
|    4 | <code>supadata-auto</code>                           |  24.46s |    4 |            87.24 |                 12.76% |             11.71% | not-supported |     24.46s |    123.47× |   $0.0175 |
|    5 | <code>deepinfra-openai_whisper-large-v3-turbo</code> |  34.53s |    5 |            89.07 |                 10.93% |              9.77% | not-supported |     34.53s |     93.64× |   $0.0108 |
|    6 | <code>groq-whisper-large-v3</code>                   |  34.91s |    5 |            93.33 |                  6.67% |              5.35% | not-supported |     34.91s |     92.62× |   $0.0997 |
|    7 | <code>groq-whisper-large-v3-turbo</code>             |  41.92s |    5 |            93.44 |                  6.56% |              5.26% | not-supported |     41.92s |     77.13× |   $0.0359 |
|    8 | <code>deepinfra-openai_whisper-large-v3</code>       |  58.95s |    5 |            94.09 |                  5.91% |              4.56% | not-supported |     58.95s |     54.85× |   $0.0242 |
|    9 | <code>gemini-stt-gemini-3.6-flash</code>             | 249.08s |    5 |            84.59 |                 15.41% |             14.38% | not-supported |    249.08s |     12.98× |   $0.5301 |
|   10 | <code>gemini-stt-gemini-3-flash-preview</code>       | 261.78s |    5 |            86.77 |                 13.23% |             12.14% | not-supported |    261.78s |     12.35× |   $0.2759 |

#### Quality Score

| Rank | Provider                                             |                   Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization   | Mean Speed | Throughput | Mean Cost |
| ---: | ---------------------------------------------------- | ----------------------: | ---: | ---------------: | ---------------------: | -----------------: | ------------- | ---------: | ---------: | --------: |
|    1 | <code>deepinfra-openai_whisper-large-v3</code>       | 94.09/100 quality score |    5 |            94.09 |                  5.91% |              4.56% | not-supported |     58.95s |     54.85× |   $0.0242 |
|    2 | <code>together-openai_whisper-large-v3</code>        | 93.64/100 quality score |    5 |            93.64 |                  6.36% |              5.04% | not-supported |     15.41s |    209.77× |   $0.0808 |
|    3 | <code>groq-whisper-large-v3-turbo</code>             | 93.44/100 quality score |    5 |            93.44 |                  6.56% |              5.26% | not-supported |     41.92s |     77.13× |   $0.0359 |
|    4 | <code>scrapecreators-youtube-transcript</code>       | 93.39/100 quality score |    1 |            93.39 |                  6.61% |              5.51% | not-supported |      3.06s |   2942.14× |   $0.0019 |
|    5 | <code>groq-whisper-large-v3</code>                   | 93.33/100 quality score |    5 |            93.33 |                  6.67% |              5.35% | not-supported |     34.91s |     92.62× |   $0.0997 |
|    6 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    | 92.73/100 quality score |    5 |            92.73 |                  7.27% |              6.01% | not-supported |      3.63s |    889.55× |   $0.0808 |
|    7 | <code>deepinfra-openai_whisper-large-v3-turbo</code> | 89.07/100 quality score |    5 |            89.07 |                 10.93% |              9.77% | not-supported |     34.53s |     93.64× |   $0.0108 |
|    8 | <code>supadata-auto</code>                           | 87.24/100 quality score |    4 |            87.24 |                 12.76% |             11.71% | not-supported |     24.46s |    123.47× |   $0.0175 |
|    9 | <code>gemini-stt-gemini-3-flash-preview</code>       | 86.77/100 quality score |    5 |            86.77 |                 13.23% |             12.14% | not-supported |    261.78s |     12.35× |   $0.2759 |
|   10 | <code>gemini-stt-gemini-3.6-flash</code>             | 84.59/100 quality score |    5 |            84.59 |                 15.41% |             14.38% | not-supported |    249.08s |     12.98× |   $0.5301 |

#### Weighted Rankings

Q, S, and C are each provider's per-run normalized quality, speed, and cost subscores averaged across covered runs.

##### Strong quality (0.8 quality / 0.1 speed / 0.1 cost)

| Rank | Provider                                             | Coverage | Composite |      Q |      S |      C |
| ---: | ---------------------------------------------------- | -------: | --------: | -----: | -----: | -----: |
|    1 | <code>scrapecreators-youtube-transcript</code>       |      1/5 |    100.00 | 100.00 | 100.00 | 100.00 |
|    2 | <code>deepinfra-openai_whisper-large-v3</code>       |      5/5 |     96.24 |  98.31 |  78.91 |  97.02 |
|    3 | <code>together-openai_whisper-large-v3</code>        |      5/5 |     95.29 |  96.03 |  96.90 |  87.72 |
|    4 | <code>groq-whisper-large-v3-turbo</code>             |      5/5 |     91.21 |  91.41 |  85.76 |  95.10 |
|    5 | <code>groq-whisper-large-v3</code>                   |      5/5 |     89.69 |  90.55 |  87.88 |  84.61 |
|    6 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    |      5/5 |     86.25 |  84.37 |  99.84 |  87.72 |
|    7 | <code>gemini-stt-gemini-3-flash-preview</code>       |      5/5 |     64.74 |  72.75 |  12.65 |  52.81 |
|    8 | <code>deepinfra-openai_whisper-large-v3-turbo</code> |      5/5 |     64.69 |  58.04 |  83.34 |  99.24 |
|    9 | <code>gemini-stt-gemini-3.6-flash</code>             |      5/5 |     51.84 |  63.72 |   4.39 |   4.24 |
|   10 | <code>supadata-auto</code>                           |      4/5 |     47.18 |  40.28 |  83.06 |  66.50 |

##### Moderate quality (0.6 quality / 0.2 speed / 0.2 cost)

| Rank | Provider                                             | Coverage | Composite |      Q |      S |      C |
| ---: | ---------------------------------------------------- | -------: | --------: | -----: | -----: | -----: |
|    1 | <code>scrapecreators-youtube-transcript</code>       |      1/5 |    100.00 | 100.00 | 100.00 | 100.00 |
|    2 | <code>together-openai_whisper-large-v3</code>        |      5/5 |     94.54 |  96.03 |  96.90 |  87.72 |
|    3 | <code>deepinfra-openai_whisper-large-v3</code>       |      5/5 |     94.17 |  98.31 |  78.91 |  97.02 |
|    4 | <code>groq-whisper-large-v3-turbo</code>             |      5/5 |     91.02 |  91.41 |  85.76 |  95.10 |
|    5 | <code>groq-whisper-large-v3</code>                   |      5/5 |     88.83 |  90.55 |  87.88 |  84.61 |
|    6 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    |      5/5 |     88.13 |  84.37 |  99.84 |  87.72 |
|    7 | <code>deepinfra-openai_whisper-large-v3-turbo</code> |      5/5 |     71.34 |  58.04 |  83.34 |  99.24 |
|    8 | <code>gemini-stt-gemini-3-flash-preview</code>       |      5/5 |     56.74 |  72.75 |  12.65 |  52.81 |
|    9 | <code>supadata-auto</code>                           |      4/5 |     54.08 |  40.28 |  83.06 |  66.50 |
|   10 | <code>gemini-stt-gemini-3.6-flash</code>             |      5/5 |     39.96 |  63.72 |   4.39 |   4.24 |

##### Strong speed (0.1 quality / 0.8 speed / 0.1 cost)

| Rank | Provider                                             | Coverage | Composite |      Q |      S |      C |
| ---: | ---------------------------------------------------- | -------: | --------: | -----: | -----: | -----: |
|    1 | <code>scrapecreators-youtube-transcript</code>       |      1/5 |    100.00 | 100.00 | 100.00 | 100.00 |
|    2 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    |      5/5 |     97.08 |  84.37 |  99.84 |  87.72 |
|    3 | <code>together-openai_whisper-large-v3</code>        |      5/5 |     95.89 |  96.03 |  96.90 |  87.72 |
|    4 | <code>groq-whisper-large-v3</code>                   |      5/5 |     87.82 |  90.55 |  87.88 |  84.61 |
|    5 | <code>groq-whisper-large-v3-turbo</code>             |      5/5 |     87.26 |  91.41 |  85.76 |  95.10 |
|    6 | <code>deepinfra-openai_whisper-large-v3</code>       |      5/5 |     82.66 |  98.31 |  78.91 |  97.02 |
|    7 | <code>deepinfra-openai_whisper-large-v3-turbo</code> |      5/5 |     82.40 |  58.04 |  83.34 |  99.24 |
|    8 | <code>supadata-auto</code>                           |      4/5 |     77.13 |  40.28 |  83.06 |  66.50 |
|    9 | <code>gemini-stt-gemini-3-flash-preview</code>       |      5/5 |     22.68 |  72.75 |  12.65 |  52.81 |
|   10 | <code>gemini-stt-gemini-3.6-flash</code>             |      5/5 |     10.31 |  63.72 |   4.39 |   4.24 |

##### Moderate speed (0.2 quality / 0.6 speed / 0.2 cost)

| Rank | Provider                                             | Coverage | Composite |      Q |      S |      C |
| ---: | ---------------------------------------------------- | -------: | --------: | -----: | -----: | -----: |
|    1 | <code>scrapecreators-youtube-transcript</code>       |      1/5 |    100.00 | 100.00 | 100.00 | 100.00 |
|    2 | <code>together-openai_whisper-large-v3</code>        |      5/5 |     94.89 |  96.03 |  96.90 |  87.72 |
|    3 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    |      5/5 |     94.32 |  84.37 |  99.84 |  87.72 |
|    4 | <code>groq-whisper-large-v3-turbo</code>             |      5/5 |     88.76 |  91.41 |  85.76 |  95.10 |
|    5 | <code>groq-whisper-large-v3</code>                   |      5/5 |     87.76 |  90.55 |  87.88 |  84.61 |
|    6 | <code>deepinfra-openai_whisper-large-v3</code>       |      5/5 |     86.41 |  98.31 |  78.91 |  97.02 |
|    7 | <code>deepinfra-openai_whisper-large-v3-turbo</code> |      5/5 |     81.46 |  58.04 |  83.34 |  99.24 |
|    8 | <code>supadata-auto</code>                           |      4/5 |     71.19 |  40.28 |  83.06 |  66.50 |
|    9 | <code>gemini-stt-gemini-3-flash-preview</code>       |      5/5 |     32.70 |  72.75 |  12.65 |  52.81 |
|   10 | <code>gemini-stt-gemini-3.6-flash</code>             |      5/5 |     16.23 |  63.72 |   4.39 |   4.24 |

##### Strong cost (0.1 quality / 0.1 speed / 0.8 cost)

| Rank | Provider                                             | Coverage | Composite |      Q |      S |      C |
| ---: | ---------------------------------------------------- | -------: | --------: | -----: | -----: | -----: |
|    1 | <code>scrapecreators-youtube-transcript</code>       |      1/5 |    100.00 | 100.00 | 100.00 | 100.00 |
|    2 | <code>deepinfra-openai_whisper-large-v3</code>       |      5/5 |     95.34 |  98.31 |  78.91 |  97.02 |
|    3 | <code>groq-whisper-large-v3-turbo</code>             |      5/5 |     93.80 |  91.41 |  85.76 |  95.10 |
|    4 | <code>deepinfra-openai_whisper-large-v3-turbo</code> |      5/5 |     93.53 |  58.04 |  83.34 |  99.24 |
|    5 | <code>together-openai_whisper-large-v3</code>        |      5/5 |     89.47 |  96.03 |  96.90 |  87.72 |
|    6 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    |      5/5 |     88.59 |  84.37 |  99.84 |  87.72 |
|    7 | <code>groq-whisper-large-v3</code>                   |      5/5 |     85.53 |  90.55 |  87.88 |  84.61 |
|    8 | <code>supadata-auto</code>                           |      4/5 |     65.54 |  40.28 |  83.06 |  66.50 |
|    9 | <code>gemini-stt-gemini-3-flash-preview</code>       |      5/5 |     50.79 |  72.75 |  12.65 |  52.81 |
|   10 | <code>gemini-stt-gemini-3.6-flash</code>             |      5/5 |     10.20 |  63.72 |   4.39 |   4.24 |

##### Moderate cost (0.2 quality / 0.2 speed / 0.6 cost)

| Rank | Provider                                             | Coverage | Composite |      Q |      S |      C |
| ---: | ---------------------------------------------------- | -------: | --------: | -----: | -----: | -----: |
|    1 | <code>scrapecreators-youtube-transcript</code>       |      1/5 |    100.00 | 100.00 | 100.00 | 100.00 |
|    2 | <code>deepinfra-openai_whisper-large-v3</code>       |      5/5 |     93.66 |  98.31 |  78.91 |  97.02 |
|    3 | <code>groq-whisper-large-v3-turbo</code>             |      5/5 |     92.50 |  91.41 |  85.76 |  95.10 |
|    4 | <code>together-openai_whisper-large-v3</code>        |      5/5 |     91.21 |  96.03 |  96.90 |  87.72 |
|    5 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    |      5/5 |     89.47 |  84.37 |  99.84 |  87.72 |
|    6 | <code>deepinfra-openai_whisper-large-v3-turbo</code> |      5/5 |     87.82 |  58.04 |  83.34 |  99.24 |
|    7 | <code>groq-whisper-large-v3</code>                   |      5/5 |     86.45 |  90.55 |  87.88 |  84.61 |
|    8 | <code>supadata-auto</code>                           |      4/5 |     64.57 |  40.28 |  83.06 |  66.50 |
|    9 | <code>gemini-stt-gemini-3-flash-preview</code>       |      5/5 |     48.76 |  72.75 |  12.65 |  52.81 |
|   10 | <code>gemini-stt-gemini-3.6-flash</code>             |      5/5 |     16.17 |  63.72 |   4.39 |   4.24 |

##### Quality + cost (0.45 quality / 0.10 speed / 0.45 cost)

| Rank | Provider                                             | Coverage | Composite |      Q |      S |      C |
| ---: | ---------------------------------------------------- | -------: | --------: | -----: | -----: | -----: |
|    1 | <code>scrapecreators-youtube-transcript</code>       |      1/5 |    100.00 | 100.00 | 100.00 | 100.00 |
|    2 | <code>deepinfra-openai_whisper-large-v3</code>       |      5/5 |     95.79 |  98.31 |  78.91 |  97.02 |
|    3 | <code>groq-whisper-large-v3-turbo</code>             |      5/5 |     92.51 |  91.41 |  85.76 |  95.10 |
|    4 | <code>together-openai_whisper-large-v3</code>        |      5/5 |     92.38 |  96.03 |  96.90 |  87.72 |
|    5 | <code>groq-whisper-large-v3</code>                   |      5/5 |     87.61 |  90.55 |  87.88 |  84.61 |
|    6 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    |      5/5 |     87.42 |  84.37 |  99.84 |  87.72 |
|    7 | <code>deepinfra-openai_whisper-large-v3-turbo</code> |      5/5 |     79.11 |  58.04 |  83.34 |  99.24 |
|    8 | <code>gemini-stt-gemini-3-flash-preview</code>       |      5/5 |     57.76 |  72.75 |  12.65 |  52.81 |
|    9 | <code>supadata-auto</code>                           |      4/5 |     56.36 |  40.28 |  83.06 |  66.50 |
|   10 | <code>gemini-stt-gemini-3.6-flash</code>             |      5/5 |     31.02 |  63.72 |   4.39 |   4.24 |

##### Cost + speed (0.10 quality / 0.45 speed / 0.45 cost)

| Rank | Provider                                             | Coverage | Composite |      Q |      S |      C |
| ---: | ---------------------------------------------------- | -------: | --------: | -----: | -----: | -----: |
|    1 | <code>scrapecreators-youtube-transcript</code>       |      1/5 |    100.00 | 100.00 | 100.00 | 100.00 |
|    2 | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    |      5/5 |     92.84 |  84.37 |  99.84 |  87.72 |
|    3 | <code>together-openai_whisper-large-v3</code>        |      5/5 |     92.68 |  96.03 |  96.90 |  87.72 |
|    4 | <code>groq-whisper-large-v3-turbo</code>             |      5/5 |     90.53 |  91.41 |  85.76 |  95.10 |
|    5 | <code>deepinfra-openai_whisper-large-v3</code>       |      5/5 |     89.00 |  98.31 |  78.91 |  97.02 |
|    6 | <code>deepinfra-openai_whisper-large-v3-turbo</code> |      5/5 |     87.96 |  58.04 |  83.34 |  99.24 |
|    7 | <code>groq-whisper-large-v3</code>                   |      5/5 |     86.68 |  90.55 |  87.88 |  84.61 |
|    8 | <code>supadata-auto</code>                           |      4/5 |     71.33 |  40.28 |  83.06 |  66.50 |
|    9 | <code>gemini-stt-gemini-3-flash-preview</code>       |      5/5 |     36.73 |  72.75 |  12.65 |  52.81 |
|   10 | <code>gemini-stt-gemini-3.6-flash</code>             |      5/5 |     10.25 |  63.72 |   4.39 |   4.24 |

### Third-Party Service Diarization

#### Price

| Rank | Provider                                  |   Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | ----------------------------------------- | ------: | ---: | ---------------: | ---------------------: | -----------------: | ----------- | ---------: | ---------: | --------: |
|    1 | <code>grok-speech-to-text</code>          | $0.0498 |    5 |            89.71 |                 10.29% |              9.79% | supported   |     55.47s |     58.29× |   $0.0498 |
|    2 | <code>soniox-stt-async-v5</code>          | $0.0898 |    5 |            95.46 |                  4.54% |              4.17% | supported   |    208.90s |     15.48× |   $0.0898 |
|    3 | <code>soniox-stt-async-v4</code>          | $0.0898 |    5 |            95.30 |                  4.70% |              4.24% | supported   |    141.71s |     22.82× |   $0.0898 |
|    4 | <code>rev-low_cost</code>                 | $0.0898 |    5 |            92.07 |                  7.93% |              7.31% | supported   |    179.74s |     17.99× |   $0.0898 |
|    5 | <code>happyscribe-auto</code>             | $0.1028 |    5 |            96.25 |                  3.75% |              3.43% | supported   |     93.79s |     34.47× |   $0.1028 |
|    6 | <code>mistral-voxtral-mini-2602</code>    | $0.1078 |    5 |            95.16 |                  4.84% |              4.49% | supported   |     34.80s |     92.92× |   $0.1078 |
|    7 | <code>speechmatics-melia-1</code>         | $0.1159 |    5 |            94.21 |                  5.79% |              5.41% | supported   |     21.26s |    152.09× |   $0.1159 |
|    8 | <code>assemblyai-universal-2</code>       | $0.1527 |    5 |            94.24 |                  5.76% |              5.24% | supported   |     31.04s |    104.18× |   $0.1527 |
|    9 | <code>rev-machine</code>                  | $0.1796 |    5 |            92.71 |                  7.29% |              6.66% | supported   |    101.59s |     31.83× |   $0.1796 |
|   10 | <code>assemblyai-universal-3-pro</code>   | $0.1886 |    5 |            96.59 |                  3.41% |              3.10% | supported   |     40.77s |     79.30× |   $0.1886 |
|   11 | <code>assemblyai-universal-3-5-pro</code> | $0.2066 |    5 |            95.80 |                  4.20% |              3.75% | supported   |     33.87s |     95.47× |   $0.2066 |
|   12 | <code>deepgram-nova-3</code>              | $0.5227 |    5 |            92.71 |                  7.29% |              6.18% | supported   |     15.58s |    207.58× |   $0.5227 |
|   13 | <code>gladia-solaria-3</code>             | $0.5479 |    5 |            94.52 |                  5.48% |              4.96% | supported   |     44.09s |     73.33× |   $0.5479 |
|   14 | <code>gladia-solaria-1</code>             | $0.5479 |    5 |            93.44 |                  6.56% |              5.79% | supported   |     44.16s |     73.21× |   $0.5479 |
|   15 | <code>gladia-default</code>               | $0.5479 |    5 |            79.51 |                 20.49% |             19.94% | supported   |     27.25s |    118.64× |   $0.5479 |
|   16 | <code>speechmatics-enhanced</code>        | $0.6736 |    5 |            94.53 |                  5.47% |              5.02% | supported   |    148.16s |     21.82× |   $0.6736 |

#### Speed

| Rank | Provider                                  |   Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | ----------------------------------------- | ------: | ---: | ---------------: | ---------------------: | -----------------: | ----------- | ---------: | ---------: | --------: |
|    1 | <code>deepgram-nova-3</code>              |  15.58s |    5 |            92.71 |                  7.29% |              6.18% | supported   |     15.58s |    207.58× |   $0.5227 |
|    2 | <code>speechmatics-melia-1</code>         |  21.26s |    5 |            94.21 |                  5.79% |              5.41% | supported   |     21.26s |    152.09× |   $0.1159 |
|    3 | <code>gladia-default</code>               |  27.25s |    5 |            79.51 |                 20.49% |             19.94% | supported   |     27.25s |    118.64× |   $0.5479 |
|    4 | <code>assemblyai-universal-2</code>       |  31.04s |    5 |            94.24 |                  5.76% |              5.24% | supported   |     31.04s |    104.18× |   $0.1527 |
|    5 | <code>assemblyai-universal-3-5-pro</code> |  33.87s |    5 |            95.80 |                  4.20% |              3.75% | supported   |     33.87s |     95.47× |   $0.2066 |
|    6 | <code>mistral-voxtral-mini-2602</code>    |  34.80s |    5 |            95.16 |                  4.84% |              4.49% | supported   |     34.80s |     92.92× |   $0.1078 |
|    7 | <code>assemblyai-universal-3-pro</code>   |  40.77s |    5 |            96.59 |                  3.41% |              3.10% | supported   |     40.77s |     79.30× |   $0.1886 |
|    8 | <code>gladia-solaria-3</code>             |  44.09s |    5 |            94.52 |                  5.48% |              4.96% | supported   |     44.09s |     73.33× |   $0.5479 |
|    9 | <code>gladia-solaria-1</code>             |  44.16s |    5 |            93.44 |                  6.56% |              5.79% | supported   |     44.16s |     73.21× |   $0.5479 |
|   10 | <code>grok-speech-to-text</code>          |  55.47s |    5 |            89.71 |                 10.29% |              9.79% | supported   |     55.47s |     58.29× |   $0.0498 |
|   11 | <code>happyscribe-auto</code>             |  93.79s |    5 |            96.25 |                  3.75% |              3.43% | supported   |     93.79s |     34.47× |   $0.1028 |
|   12 | <code>rev-machine</code>                  | 101.59s |    5 |            92.71 |                  7.29% |              6.66% | supported   |    101.59s |     31.83× |   $0.1796 |
|   13 | <code>soniox-stt-async-v4</code>          | 141.71s |    5 |            95.30 |                  4.70% |              4.24% | supported   |    141.71s |     22.82× |   $0.0898 |
|   14 | <code>speechmatics-enhanced</code>        | 148.16s |    5 |            94.53 |                  5.47% |              5.02% | supported   |    148.16s |     21.82× |   $0.6736 |
|   15 | <code>rev-low_cost</code>                 | 179.74s |    5 |            92.07 |                  7.93% |              7.31% | supported   |    179.74s |     17.99× |   $0.0898 |
|   16 | <code>soniox-stt-async-v5</code>          | 208.90s |    5 |            95.46 |                  4.54% |              4.17% | supported   |    208.90s |     15.48× |   $0.0898 |

#### Quality Score

| Rank | Provider                                  |                   Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | ----------------------------------------- | ----------------------: | ---: | ---------------: | ---------------------: | -----------------: | ----------- | ---------: | ---------: | --------: |
|    1 | <code>assemblyai-universal-3-pro</code>   | 96.59/100 quality score |    5 |            96.59 |                  3.41% |              3.10% | supported   |     40.77s |     79.30× |   $0.1886 |
|    2 | <code>happyscribe-auto</code>             | 96.25/100 quality score |    5 |            96.25 |                  3.75% |              3.43% | supported   |     93.79s |     34.47× |   $0.1028 |
|    3 | <code>assemblyai-universal-3-5-pro</code> | 95.80/100 quality score |    5 |            95.80 |                  4.20% |              3.75% | supported   |     33.87s |     95.47× |   $0.2066 |
|    4 | <code>soniox-stt-async-v5</code>          | 95.46/100 quality score |    5 |            95.46 |                  4.54% |              4.17% | supported   |    208.90s |     15.48× |   $0.0898 |
|    5 | <code>soniox-stt-async-v4</code>          | 95.30/100 quality score |    5 |            95.30 |                  4.70% |              4.24% | supported   |    141.71s |     22.82× |   $0.0898 |
|    6 | <code>mistral-voxtral-mini-2602</code>    | 95.16/100 quality score |    5 |            95.16 |                  4.84% |              4.49% | supported   |     34.80s |     92.92× |   $0.1078 |
|    7 | <code>speechmatics-enhanced</code>        | 94.53/100 quality score |    5 |            94.53 |                  5.47% |              5.02% | supported   |    148.16s |     21.82× |   $0.6736 |
|    8 | <code>gladia-solaria-3</code>             | 94.52/100 quality score |    5 |            94.52 |                  5.48% |              4.96% | supported   |     44.09s |     73.33× |   $0.5479 |
|    9 | <code>assemblyai-universal-2</code>       | 94.24/100 quality score |    5 |            94.24 |                  5.76% |              5.24% | supported   |     31.04s |    104.18× |   $0.1527 |
|   10 | <code>speechmatics-melia-1</code>         | 94.21/100 quality score |    5 |            94.21 |                  5.79% |              5.41% | supported   |     21.26s |    152.09× |   $0.1159 |
|   11 | <code>gladia-solaria-1</code>             | 93.44/100 quality score |    5 |            93.44 |                  6.56% |              5.79% | supported   |     44.16s |     73.21× |   $0.5479 |
|   12 | <code>rev-machine</code>                  | 92.71/100 quality score |    5 |            92.71 |                  7.29% |              6.66% | supported   |    101.59s |     31.83× |   $0.1796 |
|   13 | <code>deepgram-nova-3</code>              | 92.71/100 quality score |    5 |            92.71 |                  7.29% |              6.18% | supported   |     15.58s |    207.58× |   $0.5227 |
|   14 | <code>rev-low_cost</code>                 | 92.07/100 quality score |    5 |            92.07 |                  7.93% |              7.31% | supported   |    179.74s |     17.99× |   $0.0898 |
|   15 | <code>grok-speech-to-text</code>          | 89.71/100 quality score |    5 |            89.71 |                 10.29% |              9.79% | supported   |     55.47s |     58.29× |   $0.0498 |
|   16 | <code>gladia-default</code>               | 79.51/100 quality score |    5 |            79.51 |                 20.49% |             19.94% | supported   |     27.25s |    118.64× |   $0.5479 |

#### Weighted Rankings

Q, S, and C are each provider's per-run normalized quality, speed, and cost subscores averaged across covered runs.

##### Strong quality (0.8 quality / 0.1 speed / 0.1 cost)

| Rank | Provider                                  | Coverage | Composite |     Q |     S |     C |
| ---: | ----------------------------------------- | -------: | --------: | ----: | ----: | ----: |
|    1 | <code>assemblyai-universal-3-pro</code>   |      5/5 |     90.95 | 93.01 | 86.77 | 78.65 |
|    2 | <code>assemblyai-universal-3-5-pro</code> |      5/5 |     85.55 | 86.33 | 89.07 | 75.73 |
|    3 | <code>happyscribe-auto</code>             |      5/5 |     83.15 | 91.31 | 47.23 | 53.85 |
|    4 | <code>mistral-voxtral-mini-2602</code>    |      5/5 |     75.42 | 71.46 | 90.73 | 91.75 |
|    5 | <code>soniox-stt-async-v4</code>          |      5/5 |     73.96 | 73.52 | 56.76 | 94.67 |
|    6 | <code>assemblyai-universal-2</code>       |      5/5 |     69.29 | 64.57 | 91.87 | 84.47 |
|    7 | <code>speechmatics-melia-1</code>         |      5/5 |     69.00 | 62.94 | 96.10 | 90.44 |
|    8 | <code>soniox-stt-async-v5</code>          |      5/5 |     68.50 | 69.87 | 31.31 | 94.67 |
|    9 | <code>gladia-solaria-3</code>             |      5/5 |     66.95 | 70.31 | 86.63 | 20.39 |
|   10 | <code>speechmatics-enhanced</code>        |      5/5 |     57.73 | 66.94 | 41.79 |  0.00 |
|   11 | <code>gladia-solaria-1</code>             |      5/5 |     55.69 | 56.29 | 86.17 | 20.39 |
|   12 | <code>rev-machine</code>                  |      5/5 |     54.57 | 52.67 | 44.27 | 80.06 |
|   13 | <code>deepgram-nova-3</code>              |      5/5 |     52.68 | 50.51 | 98.22 | 24.47 |
|   14 | <code>rev-low_cost</code>                 |      5/5 |     47.39 | 45.59 | 14.49 | 94.64 |
|   15 | <code>gladia-default</code>               |      5/5 |     39.36 | 35.97 | 85.43 | 20.39 |
|   16 | <code>grok-speech-to-text</code>          |      5/5 |     34.33 | 20.01 | 86.57 | 96.67 |

##### Moderate quality (0.6 quality / 0.2 speed / 0.2 cost)

| Rank | Provider                                  | Coverage | Composite |     Q |     S |     C |
| ---: | ----------------------------------------- | -------: | --------: | ----: | ----: | ----: |
|    1 | <code>assemblyai-universal-3-pro</code>   |      5/5 |     88.89 | 93.01 | 86.77 | 78.65 |
|    2 | <code>assemblyai-universal-3-5-pro</code> |      5/5 |     84.76 | 86.33 | 89.07 | 75.73 |
|    3 | <code>mistral-voxtral-mini-2602</code>    |      5/5 |     79.37 | 71.46 | 90.73 | 91.75 |
|    4 | <code>speechmatics-melia-1</code>         |      5/5 |     75.07 | 62.94 | 96.10 | 90.44 |
|    5 | <code>happyscribe-auto</code>             |      5/5 |     75.00 | 91.31 | 47.23 | 53.85 |
|    6 | <code>soniox-stt-async-v4</code>          |      5/5 |     74.40 | 73.52 | 56.76 | 94.67 |
|    7 | <code>assemblyai-universal-2</code>       |      5/5 |     74.01 | 64.57 | 91.87 | 84.47 |
|    8 | <code>soniox-stt-async-v5</code>          |      5/5 |     67.12 | 69.87 | 31.31 | 94.67 |
|    9 | <code>gladia-solaria-3</code>             |      5/5 |     63.59 | 70.31 | 86.63 | 20.39 |
|   10 | <code>rev-machine</code>                  |      5/5 |     56.47 | 52.67 | 44.27 | 80.06 |
|   11 | <code>gladia-solaria-1</code>             |      5/5 |     55.09 | 56.29 | 86.17 | 20.39 |
|   12 | <code>deepgram-nova-3</code>              |      5/5 |     54.84 | 50.51 | 98.22 | 24.47 |
|   13 | <code>rev-low_cost</code>                 |      5/5 |     49.18 | 45.59 | 14.49 | 94.64 |
|   14 | <code>grok-speech-to-text</code>          |      5/5 |     48.66 | 20.01 | 86.57 | 96.67 |
|   15 | <code>speechmatics-enhanced</code>        |      5/5 |     48.52 | 66.94 | 41.79 |  0.00 |
|   16 | <code>gladia-default</code>               |      5/5 |     42.75 | 35.97 | 85.43 | 20.39 |

##### Strong speed (0.1 quality / 0.8 speed / 0.1 cost)

| Rank | Provider                                  | Coverage | Composite |     Q |     S |     C |
| ---: | ----------------------------------------- | -------: | --------: | ----: | ----: | ----: |
|    1 | <code>speechmatics-melia-1</code>         |      5/5 |     92.21 | 62.94 | 96.10 | 90.44 |
|    2 | <code>mistral-voxtral-mini-2602</code>    |      5/5 |     88.90 | 71.46 | 90.73 | 91.75 |
|    3 | <code>assemblyai-universal-2</code>       |      5/5 |     88.40 | 64.57 | 91.87 | 84.47 |
|    4 | <code>assemblyai-universal-3-5-pro</code> |      5/5 |     87.46 | 86.33 | 89.07 | 75.73 |
|    5 | <code>assemblyai-universal-3-pro</code>   |      5/5 |     86.58 | 93.01 | 86.77 | 78.65 |
|    6 | <code>deepgram-nova-3</code>              |      5/5 |     86.08 | 50.51 | 98.22 | 24.47 |
|    7 | <code>grok-speech-to-text</code>          |      5/5 |     80.93 | 20.01 | 86.57 | 96.67 |
|    8 | <code>gladia-solaria-3</code>             |      5/5 |     78.37 | 70.31 | 86.63 | 20.39 |
|    9 | <code>gladia-solaria-1</code>             |      5/5 |     76.61 | 56.29 | 86.17 | 20.39 |
|   10 | <code>gladia-default</code>               |      5/5 |     73.98 | 35.97 | 85.43 | 20.39 |
|   11 | <code>soniox-stt-async-v4</code>          |      5/5 |     62.23 | 73.52 | 56.76 | 94.67 |
|   12 | <code>happyscribe-auto</code>             |      5/5 |     52.30 | 91.31 | 47.23 | 53.85 |
|   13 | <code>rev-machine</code>                  |      5/5 |     48.69 | 52.67 | 44.27 | 80.06 |
|   14 | <code>soniox-stt-async-v5</code>          |      5/5 |     41.50 | 69.87 | 31.31 | 94.67 |
|   15 | <code>speechmatics-enhanced</code>        |      5/5 |     40.13 | 66.94 | 41.79 |  0.00 |
|   16 | <code>rev-low_cost</code>                 |      5/5 |     25.62 | 45.59 | 14.49 | 94.64 |

##### Moderate speed (0.2 quality / 0.6 speed / 0.2 cost)

| Rank | Provider                                  | Coverage | Composite |     Q |     S |     C |
| ---: | ----------------------------------------- | -------: | --------: | ----: | ----: | ----: |
|    1 | <code>speechmatics-melia-1</code>         |      5/5 |     88.33 | 62.94 | 96.10 | 90.44 |
|    2 | <code>mistral-voxtral-mini-2602</code>    |      5/5 |     87.08 | 71.46 | 90.73 | 91.75 |
|    3 | <code>assemblyai-universal-3-pro</code>   |      5/5 |     86.39 | 93.01 | 86.77 | 78.65 |
|    4 | <code>assemblyai-universal-3-5-pro</code> |      5/5 |     85.86 | 86.33 | 89.07 | 75.73 |
|    5 | <code>assemblyai-universal-2</code>       |      5/5 |     84.93 | 64.57 | 91.87 | 84.47 |
|    6 | <code>grok-speech-to-text</code>          |      5/5 |     75.28 | 20.01 | 86.57 | 96.67 |
|    7 | <code>deepgram-nova-3</code>              |      5/5 |     73.93 | 50.51 | 98.22 | 24.47 |
|    8 | <code>gladia-solaria-3</code>             |      5/5 |     70.12 | 70.31 | 86.63 | 20.39 |
|    9 | <code>soniox-stt-async-v4</code>          |      5/5 |     67.69 | 73.52 | 56.76 | 94.67 |
|   10 | <code>gladia-solaria-1</code>             |      5/5 |     67.04 | 56.29 | 86.17 | 20.39 |
|   11 | <code>gladia-default</code>               |      5/5 |     62.53 | 35.97 | 85.43 | 20.39 |
|   12 | <code>happyscribe-auto</code>             |      5/5 |     57.37 | 91.31 | 47.23 | 53.85 |
|   13 | <code>rev-machine</code>                  |      5/5 |     53.11 | 52.67 | 44.27 | 80.06 |
|   14 | <code>soniox-stt-async-v5</code>          |      5/5 |     51.70 | 69.87 | 31.31 | 94.67 |
|   15 | <code>speechmatics-enhanced</code>        |      5/5 |     38.46 | 66.94 | 41.79 |  0.00 |
|   16 | <code>rev-low_cost</code>                 |      5/5 |     36.74 | 45.59 | 14.49 | 94.64 |

##### Strong cost (0.1 quality / 0.1 speed / 0.8 cost)

| Rank | Provider                                  | Coverage | Composite |     Q |     S |     C |
| ---: | ----------------------------------------- | -------: | --------: | ----: | ----: | ----: |
|    1 | <code>mistral-voxtral-mini-2602</code>    |      5/5 |     89.62 | 71.46 | 90.73 | 91.75 |
|    2 | <code>soniox-stt-async-v4</code>          |      5/5 |     88.76 | 73.52 | 56.76 | 94.67 |
|    3 | <code>speechmatics-melia-1</code>         |      5/5 |     88.26 | 62.94 | 96.10 | 90.44 |
|    4 | <code>grok-speech-to-text</code>          |      5/5 |     87.99 | 20.01 | 86.57 | 96.67 |
|    5 | <code>soniox-stt-async-v5</code>          |      5/5 |     85.85 | 69.87 | 31.31 | 94.67 |
|    6 | <code>assemblyai-universal-2</code>       |      5/5 |     83.22 | 64.57 | 91.87 | 84.47 |
|    7 | <code>rev-low_cost</code>                 |      5/5 |     81.72 | 45.59 | 14.49 | 94.64 |
|    8 | <code>assemblyai-universal-3-pro</code>   |      5/5 |     80.90 | 93.01 | 86.77 | 78.65 |
|    9 | <code>assemblyai-universal-3-5-pro</code> |      5/5 |     78.13 | 86.33 | 89.07 | 75.73 |
|   10 | <code>rev-machine</code>                  |      5/5 |     73.74 | 52.67 | 44.27 | 80.06 |
|   11 | <code>happyscribe-auto</code>             |      5/5 |     56.93 | 91.31 | 47.23 | 53.85 |
|   12 | <code>deepgram-nova-3</code>              |      5/5 |     34.45 | 50.51 | 98.22 | 24.47 |
|   13 | <code>gladia-solaria-3</code>             |      5/5 |     32.01 | 70.31 | 86.63 | 20.39 |
|   14 | <code>gladia-solaria-1</code>             |      5/5 |     30.56 | 56.29 | 86.17 | 20.39 |
|   15 | <code>gladia-default</code>               |      5/5 |     28.45 | 35.97 | 85.43 | 20.39 |
|   16 | <code>speechmatics-enhanced</code>        |      5/5 |     10.87 | 66.94 | 41.79 |  0.00 |

##### Moderate cost (0.2 quality / 0.2 speed / 0.6 cost)

| Rank | Provider                                  | Coverage | Composite |     Q |     S |     C |
| ---: | ----------------------------------------- | -------: | --------: | ----: | ----: | ----: |
|    1 | <code>mistral-voxtral-mini-2602</code>    |      5/5 |     87.49 | 71.46 | 90.73 | 91.75 |
|    2 | <code>speechmatics-melia-1</code>         |      5/5 |     86.07 | 62.94 | 96.10 | 90.44 |
|    3 | <code>assemblyai-universal-3-pro</code>   |      5/5 |     83.14 | 93.01 | 86.77 | 78.65 |
|    4 | <code>soniox-stt-async-v4</code>          |      5/5 |     82.86 | 73.52 | 56.76 | 94.67 |
|    5 | <code>assemblyai-universal-2</code>       |      5/5 |     81.97 | 64.57 | 91.87 | 84.47 |
|    6 | <code>assemblyai-universal-3-5-pro</code> |      5/5 |     80.52 | 86.33 | 89.07 | 75.73 |
|    7 | <code>grok-speech-to-text</code>          |      5/5 |     79.32 | 20.01 | 86.57 | 96.67 |
|    8 | <code>soniox-stt-async-v5</code>          |      5/5 |     77.04 | 69.87 | 31.31 | 94.67 |
|    9 | <code>rev-low_cost</code>                 |      5/5 |     68.80 | 45.59 | 14.49 | 94.64 |
|   10 | <code>rev-machine</code>                  |      5/5 |     67.42 | 52.67 | 44.27 | 80.06 |
|   11 | <code>happyscribe-auto</code>             |      5/5 |     60.01 | 91.31 | 47.23 | 53.85 |
|   12 | <code>deepgram-nova-3</code>              |      5/5 |     44.43 | 50.51 | 98.22 | 24.47 |
|   13 | <code>gladia-solaria-3</code>             |      5/5 |     43.62 | 70.31 | 86.63 | 20.39 |
|   14 | <code>gladia-solaria-1</code>             |      5/5 |     40.73 | 56.29 | 86.17 | 20.39 |
|   15 | <code>gladia-default</code>               |      5/5 |     36.51 | 35.97 | 85.43 | 20.39 |
|   16 | <code>speechmatics-enhanced</code>        |      5/5 |     21.75 | 66.94 | 41.79 |  0.00 |

##### Quality + cost (0.45 quality / 0.10 speed / 0.45 cost)

| Rank | Provider                                  | Coverage | Composite |     Q |     S |     C |
| ---: | ----------------------------------------- | -------: | --------: | ----: | ----: | ----: |
|    1 | <code>assemblyai-universal-3-pro</code>   |      5/5 |     85.92 | 93.01 | 86.77 | 78.65 |
|    2 | <code>mistral-voxtral-mini-2602</code>    |      5/5 |     82.52 | 71.46 | 90.73 | 91.75 |
|    3 | <code>assemblyai-universal-3-5-pro</code> |      5/5 |     81.84 | 86.33 | 89.07 | 75.73 |
|    4 | <code>soniox-stt-async-v4</code>          |      5/5 |     81.36 | 73.52 | 56.76 | 94.67 |
|    5 | <code>speechmatics-melia-1</code>         |      5/5 |     78.63 | 62.94 | 96.10 | 90.44 |
|    6 | <code>soniox-stt-async-v5</code>          |      5/5 |     77.17 | 69.87 | 31.31 | 94.67 |
|    7 | <code>assemblyai-universal-2</code>       |      5/5 |     76.26 | 64.57 | 91.87 | 84.47 |
|    8 | <code>happyscribe-auto</code>             |      5/5 |     70.04 | 91.31 | 47.23 | 53.85 |
|    9 | <code>rev-low_cost</code>                 |      5/5 |     64.56 | 45.59 | 14.49 | 94.64 |
|   10 | <code>rev-machine</code>                  |      5/5 |     64.16 | 52.67 | 44.27 | 80.06 |
|   11 | <code>grok-speech-to-text</code>          |      5/5 |     61.16 | 20.01 | 86.57 | 96.67 |
|   12 | <code>gladia-solaria-3</code>             |      5/5 |     49.48 | 70.31 | 86.63 | 20.39 |
|   13 | <code>deepgram-nova-3</code>              |      5/5 |     43.56 | 50.51 | 98.22 | 24.47 |
|   14 | <code>gladia-solaria-1</code>             |      5/5 |     43.12 | 56.29 | 86.17 | 20.39 |
|   15 | <code>speechmatics-enhanced</code>        |      5/5 |     34.30 | 66.94 | 41.79 |  0.00 |
|   16 | <code>gladia-default</code>               |      5/5 |     33.90 | 35.97 | 85.43 | 20.39 |

##### Cost + speed (0.10 quality / 0.45 speed / 0.45 cost)

| Rank | Provider                                  | Coverage | Composite |     Q |     S |     C |
| ---: | ----------------------------------------- | -------: | --------: | ----: | ----: | ----: |
|    1 | <code>speechmatics-melia-1</code>         |      5/5 |     90.24 | 62.94 | 96.10 | 90.44 |
|    2 | <code>mistral-voxtral-mini-2602</code>    |      5/5 |     89.26 | 71.46 | 90.73 | 91.75 |
|    3 | <code>assemblyai-universal-2</code>       |      5/5 |     85.81 | 64.57 | 91.87 | 84.47 |
|    4 | <code>grok-speech-to-text</code>          |      5/5 |     84.46 | 20.01 | 86.57 | 96.67 |
|    5 | <code>assemblyai-universal-3-pro</code>   |      5/5 |     83.74 | 93.01 | 86.77 | 78.65 |
|    6 | <code>assemblyai-universal-3-5-pro</code> |      5/5 |     82.79 | 86.33 | 89.07 | 75.73 |
|    7 | <code>soniox-stt-async-v4</code>          |      5/5 |     75.49 | 73.52 | 56.76 | 94.67 |
|    8 | <code>soniox-stt-async-v5</code>          |      5/5 |     63.68 | 69.87 | 31.31 | 94.67 |
|    9 | <code>rev-machine</code>                  |      5/5 |     61.22 | 52.67 | 44.27 | 80.06 |
|   10 | <code>deepgram-nova-3</code>              |      5/5 |     60.26 | 50.51 | 98.22 | 24.47 |
|   11 | <code>gladia-solaria-3</code>             |      5/5 |     55.19 | 70.31 | 86.63 | 20.39 |
|   12 | <code>happyscribe-auto</code>             |      5/5 |     54.61 | 91.31 | 47.23 | 53.85 |
|   13 | <code>rev-low_cost</code>                 |      5/5 |     53.67 | 45.59 | 14.49 | 94.64 |
|   14 | <code>gladia-solaria-1</code>             |      5/5 |     53.58 | 56.29 | 86.17 | 20.39 |
|   15 | <code>gladia-default</code>               |      5/5 |     51.22 | 35.97 | 85.43 | 20.39 |
|   16 | <code>speechmatics-enhanced</code>        |      5/5 |     25.50 | 66.94 | 41.79 |  0.00 |

## Per-Run Quality Score

Speaker-aware WER-derived quality score per provider in each run, sorted by mean.

### Third-Party Service Non-Diarization

| Provider                                             |  Mean | 2026-06-15_14-29-11-559_1-audio | 2026-06-15_14-34-10-342_2023-04-05-jsjam-react-miami-2023-10-minutes | 2026-06-15_14-43-25-724_2022-09-30-widgets-fsjam-40-minutes | 2026-07-16_01-20-11-985_2024-04-10-autogen-shownotes-jenn-junod | 2026-07-16_01-27-21-117_barnum-with-robert-balicki |
| ---------------------------------------------------- | ----: | ------------------------------: | -------------------------------------------------------------------: | ----------------------------------------------------------: | --------------------------------------------------------------: | -------------------------------------------------: |
| <code>deepinfra-openai_whisper-large-v3</code>       | 94.09 |                           95.79 |                                                                93.75 |                                                       96.44 |                                                           91.28 |                                              93.18 |
| <code>together-openai_whisper-large-v3</code>        | 93.64 |                           95.33 |                                                                93.92 |                                                       96.23 |                                                           89.96 |                                              92.74 |
| <code>groq-whisper-large-v3-turbo</code>             | 93.44 |                           93.46 |                                                                92.86 |                                                       96.39 |                                                           91.15 |                                              93.35 |
| <code>scrapecreators-youtube-transcript</code>       | 93.39 |                               — |                                                                    — |                                                           — |                                                               — |                                              93.39 |
| <code>groq-whisper-large-v3</code>                   | 93.33 |                           92.99 |                                                                93.51 |                                                       96.06 |                                                           91.02 |                                              93.07 |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>    | 92.73 |                           90.19 |                                                                94.81 |                                                       95.45 |                                                           90.39 |                                              92.81 |
| <code>deepinfra-openai_whisper-large-v3-turbo</code> | 89.07 |                           87.38 |                                                                89.79 |                                                       87.78 |                                                           89.01 |                                              91.39 |
| <code>supadata-auto</code>                           | 87.24 |                           92.52 |                                                                81.18 |                                                       81.87 |                                                               — |                                              93.39 |
| <code>gemini-stt-gemini-3-flash-preview</code>       | 86.77 |                           93.46 |                                                                94.51 |                                                       96.15 |                                                           90.00 |                                              59.74 |
| <code>gemini-stt-gemini-3.6-flash</code>             | 84.59 |                           93.46 |                                                                94.22 |                                                       96.06 |                                                           61.54 |                                              77.67 |

### Third-Party Service Diarization

| Provider                                  |  Mean | 2026-06-15_14-29-11-559_1-audio | 2026-06-15_14-34-10-342_2023-04-05-jsjam-react-miami-2023-10-minutes | 2026-06-15_14-43-25-724_2022-09-30-widgets-fsjam-40-minutes | 2026-07-16_01-20-11-985_2024-04-10-autogen-shownotes-jenn-junod | 2026-07-16_01-27-21-117_barnum-with-robert-balicki |
| ----------------------------------------- | ----: | ------------------------------: | -------------------------------------------------------------------: | ----------------------------------------------------------: | --------------------------------------------------------------: | -------------------------------------------------: |
| <code>assemblyai-universal-3-pro</code>   | 96.59 |                           95.79 |                                                                96.05 |                                                       99.62 |                                                           97.20 |                                              94.30 |
| <code>happyscribe-auto</code>             | 96.25 |                           95.33 |                                                                96.52 |                                                       99.21 |                                                           96.21 |                                              94.01 |
| <code>assemblyai-universal-3-5-pro</code> | 95.80 |                           95.33 |                                                                96.76 |                                                       98.52 |                                                           94.22 |                                              94.19 |
| <code>soniox-stt-async-v5</code>          | 95.46 |                           98.13 |                                                                94.04 |                                                       97.08 |                                                           92.53 |                                              95.52 |
| <code>soniox-stt-async-v4</code>          | 95.30 |                           97.20 |                                                                95.52 |                                                       96.40 |                                                           92.45 |                                              94.92 |
| <code>mistral-voxtral-mini-2602</code>    | 95.16 |                           97.66 |                                                                94.75 |                                                       97.31 |                                                           91.85 |                                              94.22 |
| <code>speechmatics-enhanced</code>        | 94.53 |                           96.26 |                                                                95.10 |                                                       96.57 |                                                           90.84 |                                              93.87 |
| <code>gladia-solaria-3</code>             | 94.52 |                           93.93 |                                                                95.63 |                                                       96.91 |                                                           92.27 |                                              93.88 |
| <code>assemblyai-universal-2</code>       | 94.24 |                           95.79 |                                                                94.40 |                                                       96.74 |                                                           91.57 |                                              92.69 |
| <code>speechmatics-melia-1</code>         | 94.21 |                           97.20 |                                                                94.28 |                                                       96.19 |                                                           90.89 |                                              92.47 |
| <code>gladia-solaria-1</code>             | 93.44 |                           93.93 |                                                                93.22 |                                                       96.90 |                                                           91.51 |                                              91.63 |
| <code>rev-machine</code>                  | 92.71 |                           91.59 |                                                                95.58 |                                                       94.29 |                                                           89.16 |                                              92.95 |
| <code>deepgram-nova-3</code>              | 92.71 |                           92.99 |                                                                94.69 |                                                       95.37 |                                                           87.93 |                                              92.58 |
| <code>rev-low_cost</code>                 | 92.07 |                           90.65 |                                                                95.04 |                                                       93.59 |                                                           88.61 |                                              92.44 |
| <code>grok-speech-to-text</code>          | 89.71 |                           83.64 |                                                                92.63 |                                                       92.28 |                                                           88.44 |                                              91.55 |
| <code>gladia-default</code>               | 79.51 |                           93.93 |                                                                93.04 |                                                       96.81 |                                                           91.37 |                                              22.41 |

## Model Tiers

Tiers are `quality-cost-terciles-v1`: contiguous, near-equal slices of each group's `qualityCost` weighted ranking, with remainder models assigned to higher tiers first. Groups are never compared against each other.

### Local

| Tier   | Models (quality-cost rank · composite) | Basis                                                                          |
| ------ | -------------------------------------- | ------------------------------------------------------------------------------ |
| Tier 1 | none                                   | Highest quality-cost tercile; no models fall in this tier for this group size. |
| Tier 2 | none                                   | Middle quality-cost tercile; no models fall in this tier for this group size.  |
| Tier 3 | none                                   | Lower quality-cost tercile; no models fall in this tier for this group size.   |

### Third-Party Service Non-Diarization

| Tier   | Models (quality-cost rank · composite)                                                                                                                                                                                                       | Basis                                     |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Tier 1 | <code>scrapecreators-youtube-transcript</code> (#1 · 100.00), <code>deepinfra-openai_whisper-large-v3</code> (#2 · 95.79), <code>groq-whisper-large-v3-turbo</code> (#3 · 92.51), <code>together-openai_whisper-large-v3</code> (#4 · 92.38) | Highest quality-cost tercile (ranks 1-4). |
| Tier 2 | <code>groq-whisper-large-v3</code> (#5 · 87.61), <code>together-nvidia_parakeet-tdt-0.6b-v3</code> (#6 · 87.42), <code>deepinfra-openai_whisper-large-v3-turbo</code> (#7 · 79.11)                                                           | Middle quality-cost tercile (ranks 5-7).  |
| Tier 3 | <code>gemini-stt-gemini-3-flash-preview</code> (#8 · 57.76), <code>supadata-auto</code> (#9 · 56.36), <code>gemini-stt-gemini-3.6-flash</code> (#10 · 31.02)                                                                                 | Lower quality-cost tercile (ranks 8-10).  |

### Third-Party Service Diarization

| Tier   | Models (quality-cost rank · composite)                                                                                                                                                                                                                                                                          | Basis                                     |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Tier 1 | <code>assemblyai-universal-3-pro</code> (#1 · 85.92), <code>mistral-voxtral-mini-2602</code> (#2 · 82.52), <code>assemblyai-universal-3-5-pro</code> (#3 · 81.84), <code>soniox-stt-async-v4</code> (#4 · 81.36), <code>speechmatics-melia-1</code> (#5 · 78.63), <code>soniox-stt-async-v5</code> (#6 · 77.17) | Highest quality-cost tercile (ranks 1-6). |
| Tier 2 | <code>assemblyai-universal-2</code> (#7 · 76.26), <code>happyscribe-auto</code> (#8 · 70.04), <code>rev-low_cost</code> (#9 · 64.56), <code>rev-machine</code> (#10 · 64.16), <code>grok-speech-to-text</code> (#11 · 61.16)                                                                                    | Middle quality-cost tercile (ranks 7-11). |
| Tier 3 | <code>gladia-solaria-3</code> (#12 · 49.48), <code>deepgram-nova-3</code> (#13 · 43.56), <code>gladia-solaria-1</code> (#14 · 43.12), <code>speechmatics-enhanced</code> (#15 · 34.30), <code>gladia-default</code> (#16 · 33.90)                                                                               | Lower quality-cost tercile (ranks 12-16). |

## Notes

- Each provider is aggregated by providerKey across the runs it appears in; the mean is taken over present values only. Aggregate realtime throughput is total covered audio duration divided by total covered processing time.
- Groups follow the single-run STT contract: local, thirdPartyServiceNonDiarization, thirdPartyServiceDiarization.
- Weighted composite rankings and quality-cost tercile model tiers are emitted per group; no cross-group overall or rankingSurfaces leaderboard is emitted, and single-run reports remain tier-free.
