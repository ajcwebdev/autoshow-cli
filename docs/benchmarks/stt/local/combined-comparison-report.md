# Combined STT Provider Comparison Report

## Summary

- Root directory: `docs/benchmarks/stt/local`
- Runs aggregated: 3
  - `1-audio` (8 providers)
  - `2022-09-30-widgets-fsjam-40-minutes` (8 providers)
  - `2023-04-05-jsjam-react-miami-2023-10-minutes` (8 providers)
- Distinct providers: 8 (8 local, 0 third-party non-diarization, 0 third-party diarization)
- Quality score aggregates the per-run speaker-aware WER-derived score as a mean across runs; price and speed aggregate per-run cost and processing time as means.

## Method

- Providers are matched by `providerKey` and aggregated across the runs they appear in.
- Means are taken over present values only; a provider missing a value in some runs is averaged over the runs where it is present.
- Price rankings use mean per-run monetary cost ascending, local providers at zero, missing cost last.
- Speed rankings use mean processing time ascending, missing timing last.
- Quality Score rankings use the mean neutral speaker-aware WER-derived score descending (scoring version 2); legacy (scoring version 1) means are retained as columns.
- Tied ranking values break deterministically: price ties by quality descending then provider key; speed and quality ties by provider key.

## Metric Rankings

### Local

#### Price

| Rank | Provider                           | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Mean Legacy Score / 100 | Mean Legacy Speaker-aware WER | Diarization   | Mean Speed | Throughput | Mean Cost |
| ---: | ---------------------------------- | ----: | ---: | ---------------: | ---------------------: | -----------------: | ----------------------: | ----------------------------: | ------------- | ---------: | ---------: | --------: |
| 1    | <code>whisperfile-large-v2</code>  | $0.00 | 3    | 96.28            | 3.72%                  | 2.53%              | 93.97                   | 6.03%                         | not-supported | 398.42s    | 2.58×      | $0.00     |
| 2    | <code>whisperfile-small.en</code>  | $0.00 | 3    | 95.96            | 4.04%                  | 2.84%              | 94.25                   | 5.75%                         | not-supported | 70.86s     | 14.50×     | $0.00     |
| 3    | <code>whisperfile-medium</code>    | $0.00 | 3    | 95.77            | 4.23%                  | 3.05%              | 94.11                   | 5.89%                         | not-supported | 208.04s    | 4.94×      | $0.00     |
| 4    | <code>whisperfile-medium.en</code> | $0.00 | 3    | 95.39            | 4.61%                  | 3.42%              | 94.08                   | 5.92%                         | not-supported | 204.40s    | 5.03×      | $0.00     |
| 5    | <code>whisperfile-tiny.en</code>   | $0.00 | 3    | 93.78            | 6.22%                  | 5.11%              | 91.56                   | 8.44%                         | not-supported | 17.33s     | 59.29×     | $0.00     |
| 6    | <code>whisperfile-small</code>     | $0.00 | 3    | 91.77            | 8.23%                  | 7.12%              | 90.32                   | 9.68%                         | not-supported | 80.33s     | 12.79×     | $0.00     |
| 7    | <code>whisperfile-tiny</code>      | $0.00 | 3    | 90.65            | 9.35%                  | 8.26%              | 88.90                   | 11.10%                        | not-supported | 16.43s     | 62.53×     | $0.00     |
| 8    | <code>whisperfile-large-v3</code>  | $0.00 | 3    | 63.96            | 60.26%                 | 59.82%             | 62.77                   | 61.40%                        | not-supported | 412.68s    | 2.49×      | $0.00     |

#### Speed

| Rank | Provider                           | Value   | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Mean Legacy Score / 100 | Mean Legacy Speaker-aware WER | Diarization   | Mean Speed | Throughput | Mean Cost |
| ---: | ---------------------------------- | ------: | ---: | ---------------: | ---------------------: | -----------------: | ----------------------: | ----------------------------: | ------------- | ---------: | ---------: | --------: |
| 1    | <code>whisperfile-tiny</code>      | 16.43s  | 3    | 90.65            | 9.35%                  | 8.26%              | 88.90                   | 11.10%                        | not-supported | 16.43s     | 62.53×     | $0.00     |
| 2    | <code>whisperfile-tiny.en</code>   | 17.33s  | 3    | 93.78            | 6.22%                  | 5.11%              | 91.56                   | 8.44%                         | not-supported | 17.33s     | 59.29×     | $0.00     |
| 3    | <code>whisperfile-small.en</code>  | 70.86s  | 3    | 95.96            | 4.04%                  | 2.84%              | 94.25                   | 5.75%                         | not-supported | 70.86s     | 14.50×     | $0.00     |
| 4    | <code>whisperfile-small</code>     | 80.33s  | 3    | 91.77            | 8.23%                  | 7.12%              | 90.32                   | 9.68%                         | not-supported | 80.33s     | 12.79×     | $0.00     |
| 5    | <code>whisperfile-medium.en</code> | 204.40s | 3    | 95.39            | 4.61%                  | 3.42%              | 94.08                   | 5.92%                         | not-supported | 204.40s    | 5.03×      | $0.00     |
| 6    | <code>whisperfile-medium</code>    | 208.04s | 3    | 95.77            | 4.23%                  | 3.05%              | 94.11                   | 5.89%                         | not-supported | 208.04s    | 4.94×      | $0.00     |
| 7    | <code>whisperfile-large-v2</code>  | 398.42s | 3    | 96.28            | 3.72%                  | 2.53%              | 93.97                   | 6.03%                         | not-supported | 398.42s    | 2.58×      | $0.00     |
| 8    | <code>whisperfile-large-v3</code>  | 412.68s | 3    | 63.96            | 60.26%                 | 59.82%             | 62.77                   | 61.40%                        | not-supported | 412.68s    | 2.49×      | $0.00     |

#### Quality Score

| Rank | Provider                           | Value                   | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Mean Legacy Score / 100 | Mean Legacy Speaker-aware WER | Diarization   | Mean Speed | Throughput | Mean Cost |
| ---: | ---------------------------------- | ----------------------: | ---: | ---------------: | ---------------------: | -----------------: | ----------------------: | ----------------------------: | ------------- | ---------: | ---------: | --------: |
| 1    | <code>whisperfile-large-v2</code>  | 96.28/100 quality score | 3    | 96.28            | 3.72%                  | 2.53%              | 93.97                   | 6.03%                         | not-supported | 398.42s    | 2.58×      | $0.00     |
| 2    | <code>whisperfile-small.en</code>  | 95.96/100 quality score | 3    | 95.96            | 4.04%                  | 2.84%              | 94.25                   | 5.75%                         | not-supported | 70.86s     | 14.50×     | $0.00     |
| 3    | <code>whisperfile-medium</code>    | 95.77/100 quality score | 3    | 95.77            | 4.23%                  | 3.05%              | 94.11                   | 5.89%                         | not-supported | 208.04s    | 4.94×      | $0.00     |
| 4    | <code>whisperfile-medium.en</code> | 95.39/100 quality score | 3    | 95.39            | 4.61%                  | 3.42%              | 94.08                   | 5.92%                         | not-supported | 204.40s    | 5.03×      | $0.00     |
| 5    | <code>whisperfile-tiny.en</code>   | 93.78/100 quality score | 3    | 93.78            | 6.22%                  | 5.11%              | 91.56                   | 8.44%                         | not-supported | 17.33s     | 59.29×     | $0.00     |
| 6    | <code>whisperfile-small</code>     | 91.77/100 quality score | 3    | 91.77            | 8.23%                  | 7.12%              | 90.32                   | 9.68%                         | not-supported | 80.33s     | 12.79×     | $0.00     |
| 7    | <code>whisperfile-tiny</code>      | 90.65/100 quality score | 3    | 90.65            | 9.35%                  | 8.26%              | 88.90                   | 11.10%                        | not-supported | 16.43s     | 62.53×     | $0.00     |
| 8    | <code>whisperfile-large-v3</code>  | 63.96/100 quality score | 3    | 63.96            | 60.26%                 | 59.82%             | 62.77                   | 61.40%                        | not-supported | 412.68s    | 2.49×      | $0.00     |

### Third-Party Service Non-Diarization

#### Price

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Mean Legacy Score / 100 | Mean Legacy Speaker-aware WER | Diarization | Mean Speed | Throughput | Mean Cost                   |
| ---: | -------- | ----: | ---: | ---------------: | ---------------------: | -----------------: | ----------------------: | ----------------------------: | ----------- | ---------: | ---------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a  | n/a              | n/a                    | n/a                | n/a                     | n/a                           | n/a         | n/a        | n/a        | No providers in this group. |

#### Speed

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Mean Legacy Score / 100 | Mean Legacy Speaker-aware WER | Diarization | Mean Speed | Throughput | Mean Cost                   |
| ---: | -------- | ----: | ---: | ---------------: | ---------------------: | -----------------: | ----------------------: | ----------------------------: | ----------- | ---------: | ---------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a  | n/a              | n/a                    | n/a                | n/a                     | n/a                           | n/a         | n/a        | n/a        | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Mean Legacy Score / 100 | Mean Legacy Speaker-aware WER | Diarization | Mean Speed | Throughput | Mean Cost                   |
| ---: | -------- | ----: | ---: | ---------------: | ---------------------: | -----------------: | ----------------------: | ----------------------------: | ----------- | ---------: | ---------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a  | n/a              | n/a                    | n/a                | n/a                     | n/a                           | n/a         | n/a        | n/a        | No providers in this group. |

### Third-Party Service Diarization

#### Price

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Mean Legacy Score / 100 | Mean Legacy Speaker-aware WER | Diarization | Mean Speed | Throughput | Mean Cost                   |
| ---: | -------- | ----: | ---: | ---------------: | ---------------------: | -----------------: | ----------------------: | ----------------------------: | ----------- | ---------: | ---------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a  | n/a              | n/a                    | n/a                | n/a                     | n/a                           | n/a         | n/a        | n/a        | No providers in this group. |

#### Speed

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Mean Legacy Score / 100 | Mean Legacy Speaker-aware WER | Diarization | Mean Speed | Throughput | Mean Cost                   |
| ---: | -------- | ----: | ---: | ---------------: | ---------------------: | -----------------: | ----------------------: | ----------------------------: | ----------- | ---------: | ---------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a  | n/a              | n/a                    | n/a                | n/a                     | n/a                           | n/a         | n/a        | n/a        | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Mean Legacy Score / 100 | Mean Legacy Speaker-aware WER | Diarization | Mean Speed | Throughput | Mean Cost                   |
| ---: | -------- | ----: | ---: | ---------------: | ---------------------: | -----------------: | ----------------------: | ----------------------------: | ----------- | ---------: | ---------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a  | n/a              | n/a                    | n/a                | n/a                     | n/a                           | n/a         | n/a        | n/a        | No providers in this group. |

## Per-Run Quality Score

Neutral speaker-aware WER-derived quality score per provider in each run, sorted by mean.

### Local

| Provider                           | Mean  | 1-audio | 2022-09-30-widgets-fsjam-40-minutes | 2023-04-05-jsjam-react-miami-2023-10-minutes |
| ---------------------------------- | ----: | ------: | ----------------------------------: | -------------------------------------------: |
| <code>whisperfile-large-v2</code>  | 96.28 | 96.26   | 96.12                               | 96.46                                        |
| <code>whisperfile-small.en</code>  | 95.96 | 97.20   | 95.85                               | 94.84                                        |
| <code>whisperfile-medium</code>    | 95.77 | 95.33   | 96.05                               | 95.92                                        |
| <code>whisperfile-medium.en</code> | 95.39 | 97.20   | 96.71                               | 92.26                                        |
| <code>whisperfile-tiny.en</code>   | 93.78 | 97.20   | 91.94                               | 92.21                                        |
| <code>whisperfile-small</code>     | 91.77 | 90.65   | 95.86                               | 88.79                                        |
| <code>whisperfile-tiny</code>      | 90.65 | 88.32   | 91.32                               | 92.33                                        |
| <code>whisperfile-large-v3</code>  | 63.96 | 97.20   | 94.70                               | 0.00                                         |

## Error Attribution

Speaker-aware edit counts summed over runs: strict (legacy) edits, edits removed as each neutral view is enabled in order, the remaining headline edits, and their aligned-token classification.

| Provider                           | Runs | Strict Edits | Disfluency | Orthographic | Number/Format | Neutral Edits | Speaker Attribution | Residual Number/Format | Other Lexical |
| ---------------------------------- | ---: | -----------: | ---------: | -----------: | ------------: | ------------: | ------------------: | ---------------------: | ------------: |
| <code>whisperfile-large-v2</code>  | 3    | 523          | 62         | 69           | 9             | 383           | 86                  | 3                      | 294           |
| <code>whisperfile-small.en</code>  | 3    | 527          | 22         | 71           | 3             | 431           | 86                  | 4                      | 341           |
| <code>whisperfile-medium</code>    | 3    | 506          | 31         | 66           | 9             | 400           | 86                  | 3                      | 311           |
| <code>whisperfile-medium.en</code> | 3    | 491          | 20         | 60           | 8             | 403           | 86                  | 1                      | 316           |
| <code>whisperfile-tiny.en</code>   | 3    | 902          | 39         | 61           | 8             | 794           | 86                  | 5                      | 703           |
| <code>whisperfile-small</code>     | 3    | 625          | 15         | 55           | 10            | 545           | 86                  | 4                      | 455           |
| <code>whisperfile-tiny</code>      | 3    | 992          | 36         | 87           | 8             | 861           | 86                  | 9                      | 766           |
| <code>whisperfile-large-v3</code>  | 3    | 3449         | 37         | 83           | 10            | 3319          | 86                  | 5                      | 3228          |

## Speaker Metrics

Mean word attribution accuracy (matched words whose mapped provider speaker equals the reference speaker) and mean absolute speaker-count error, for diarizing providers.

No speaker metrics are available.

## Notes

- Each provider is aggregated by providerKey across the runs it appears in; the mean is taken over present values only. Aggregate realtime throughput is total covered audio duration divided by total covered processing time.
- Groups follow the single-run STT contract: local, thirdPartyServiceNonDiarization, thirdPartyServiceDiarization.
- Each group ranks price, speed, and quality score independently. No weighted composite or model-tier ranking is emitted.
- Scoring version 2 headline: per-run quality is max(0, 100 * (1 - neutralSpeakerAwareWER)) after disfluency-, orthographic-, and number-neutral normalization applied identically to reference and provider; the scoring-version-1 score is retained as the mean legacy score and legacy speaker-aware WER.
- Providers run with non-default request settings are distinct rows keyed service/model[setting=value,...] and rank alongside default rows.
