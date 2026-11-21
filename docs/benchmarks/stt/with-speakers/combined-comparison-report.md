# Combined STT Provider Comparison Report

## Summary

- Root directory: `docs/benchmarks/stt/with-speakers`
- Runs aggregated: 4
  - `1-audio` (12 providers)
  - `2022-09-30-widgets-fsjam-40-minutes` (12 providers)
  - `2023-03-15-jsjam-qwik-misko-hevery` (12 providers)
  - `2023-04-05-jsjam-react-miami-2023-10-minutes` (12 providers)
- Distinct providers: 12 (0 local, 0 third-party non-diarization, 12 third-party diarization)
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

| Rank | Provider                                      | Value   | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Mean Legacy Score / 100 | Mean Legacy Speaker-aware WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --------------------------------------------- | ------: | ---: | ---------------: | ---------------------: | -----------------: | ----------------------: | ----------------------------: | ----------- | ---------: | ---------: | --------: |
| 1    | <code>soniox-stt-async-v5</code>              | $0.0684 | 4    | 97.92            | 2.08%                  | 1.93%              | 95.90                   | 4.10%                         | supported   | 67.32s     | 36.60×     | $0.0684   |
| 2    | <code>grok-grok-voice-transcribe-2.0</code>   | $0.0684 | 4    | 97.88            | 2.12%                  | 2.02%              | 97.31                   | 2.69%                         | supported   | 69.08s     | 35.66×     | $0.0684   |
| 3    | <code>grok-speech-to-text</code>              | $0.0684 | 4    | 93.54            | 6.46%                  | 6.20%              | 91.14                   | 8.86%                         | supported   | 26.94s     | 91.44×     | $0.0684   |
| 4    | <code>speechmatics-melia-1</code>             | $0.0883 | 4    | 97.27            | 2.73%                  | 2.59%              | 95.55                   | 4.45%                         | supported   | 19.70s     | 125.04×    | $0.0883   |
| 5    | <code>mistral-voxtral-mini-2602</code>        | $0.1232 | 4    | 97.63            | 2.37%                  | 2.20%              | 95.00                   | 5.00%                         | supported   | 30.29s     | 81.33×     | $0.1232   |
| 6    | <code>assemblyai-assemblyai-stt-3-7</code>    | $0.1574 | 4    | 98.49            | 1.51%                  | 1.43%              | 96.01                   | 3.99%                         | supported   | 15.20s     | 162.04×    | $0.1574   |
| 7    | <code>assemblyai-universal-3-5-pro</code>     | $0.1574 | 4    | 98.34            | 1.66%                  | 1.43%              | 96.43                   | 3.57%                         | supported   | 36.43s     | 67.63×     | $0.1574   |
| 8    | <code>deepgram-nova-3</code>                  | $0.1766 | 4    | 96.04            | 3.96%                  | 2.99%              | 93.42                   | 6.58%                         | supported   | 7.78s      | 316.56×    | $0.1766   |
| 9    | <code>gemini-stt-gemini-3.5-transcribe</code> | $0.2053 | 4    | 95.58            | 4.42%                  | 4.23%              | 94.55                   | 5.45%                         | supported   | 98.88s     | 24.92×     | $0.2053   |
| 10   | <code>cloudflare-@cf_deepgram_nova-3</code>   | $0.2135 | 4    | 96.97            | 3.03%                  | 2.91%              | 94.29                   | 5.71%                         | supported   | 51.53s     | 47.81×     | $0.2135   |
| 11   | <code>happyscribe-auto</code>                 | $0.4106 | 4    | 98.27            | 1.73%                  | 1.45%              | 96.34                   | 3.66%                         | supported   | 93.53s     | 26.34×     | $0.4106   |
| 12   | <code>gladia-solaria-3</code>                 | $0.4175 | 4    | 97.92            | 2.08%                  | 1.93%              | 96.96                   | 3.04%                         | supported   | 33.78s     | 72.94×     | $0.4175   |

#### Speed

| Rank | Provider                                      | Value  | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Mean Legacy Score / 100 | Mean Legacy Speaker-aware WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --------------------------------------------- | -----: | ---: | ---------------: | ---------------------: | -----------------: | ----------------------: | ----------------------------: | ----------- | ---------: | ---------: | --------: |
| 1    | <code>deepgram-nova-3</code>                  | 7.78s  | 4    | 96.04            | 3.96%                  | 2.99%              | 93.42                   | 6.58%                         | supported   | 7.78s      | 316.56×    | $0.1766   |
| 2    | <code>assemblyai-assemblyai-stt-3-7</code>    | 15.20s | 4    | 98.49            | 1.51%                  | 1.43%              | 96.01                   | 3.99%                         | supported   | 15.20s     | 162.04×    | $0.1574   |
| 3    | <code>speechmatics-melia-1</code>             | 19.70s | 4    | 97.27            | 2.73%                  | 2.59%              | 95.55                   | 4.45%                         | supported   | 19.70s     | 125.04×    | $0.0883   |
| 4    | <code>grok-speech-to-text</code>              | 26.94s | 4    | 93.54            | 6.46%                  | 6.20%              | 91.14                   | 8.86%                         | supported   | 26.94s     | 91.44×     | $0.0684   |
| 5    | <code>mistral-voxtral-mini-2602</code>        | 30.29s | 4    | 97.63            | 2.37%                  | 2.20%              | 95.00                   | 5.00%                         | supported   | 30.29s     | 81.33×     | $0.1232   |
| 6    | <code>gladia-solaria-3</code>                 | 33.78s | 4    | 97.92            | 2.08%                  | 1.93%              | 96.96                   | 3.04%                         | supported   | 33.78s     | 72.94×     | $0.4175   |
| 7    | <code>assemblyai-universal-3-5-pro</code>     | 36.43s | 4    | 98.34            | 1.66%                  | 1.43%              | 96.43                   | 3.57%                         | supported   | 36.43s     | 67.63×     | $0.1574   |
| 8    | <code>cloudflare-@cf_deepgram_nova-3</code>   | 51.53s | 4    | 96.97            | 3.03%                  | 2.91%              | 94.29                   | 5.71%                         | supported   | 51.53s     | 47.81×     | $0.2135   |
| 9    | <code>soniox-stt-async-v5</code>              | 67.32s | 4    | 97.92            | 2.08%                  | 1.93%              | 95.90                   | 4.10%                         | supported   | 67.32s     | 36.60×     | $0.0684   |
| 10   | <code>grok-grok-voice-transcribe-2.0</code>   | 69.08s | 4    | 97.88            | 2.12%                  | 2.02%              | 97.31                   | 2.69%                         | supported   | 69.08s     | 35.66×     | $0.0684   |
| 11   | <code>happyscribe-auto</code>                 | 93.53s | 4    | 98.27            | 1.73%                  | 1.45%              | 96.34                   | 3.66%                         | supported   | 93.53s     | 26.34×     | $0.4106   |
| 12   | <code>gemini-stt-gemini-3.5-transcribe</code> | 98.88s | 4    | 95.58            | 4.42%                  | 4.23%              | 94.55                   | 5.45%                         | supported   | 98.88s     | 24.92×     | $0.2053   |

#### Quality Score

| Rank | Provider                                      | Value                   | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Mean Legacy Score / 100 | Mean Legacy Speaker-aware WER | Diarization | Mean Speed | Throughput | Mean Cost |
| ---: | --------------------------------------------- | ----------------------: | ---: | ---------------: | ---------------------: | -----------------: | ----------------------: | ----------------------------: | ----------- | ---------: | ---------: | --------: |
| 1    | <code>assemblyai-assemblyai-stt-3-7</code>    | 98.49/100 quality score | 4    | 98.49            | 1.51%                  | 1.43%              | 96.01                   | 3.99%                         | supported   | 15.20s     | 162.04×    | $0.1574   |
| 2    | <code>assemblyai-universal-3-5-pro</code>     | 98.34/100 quality score | 4    | 98.34            | 1.66%                  | 1.43%              | 96.43                   | 3.57%                         | supported   | 36.43s     | 67.63×     | $0.1574   |
| 3    | <code>happyscribe-auto</code>                 | 98.27/100 quality score | 4    | 98.27            | 1.73%                  | 1.45%              | 96.34                   | 3.66%                         | supported   | 93.53s     | 26.34×     | $0.4106   |
| 4    | <code>gladia-solaria-3</code>                 | 97.92/100 quality score | 4    | 97.92            | 2.08%                  | 1.93%              | 96.96                   | 3.04%                         | supported   | 33.78s     | 72.94×     | $0.4175   |
| 5    | <code>soniox-stt-async-v5</code>              | 97.92/100 quality score | 4    | 97.92            | 2.08%                  | 1.93%              | 95.90                   | 4.10%                         | supported   | 67.32s     | 36.60×     | $0.0684   |
| 6    | <code>grok-grok-voice-transcribe-2.0</code>   | 97.88/100 quality score | 4    | 97.88            | 2.12%                  | 2.02%              | 97.31                   | 2.69%                         | supported   | 69.08s     | 35.66×     | $0.0684   |
| 7    | <code>mistral-voxtral-mini-2602</code>        | 97.63/100 quality score | 4    | 97.63            | 2.37%                  | 2.20%              | 95.00                   | 5.00%                         | supported   | 30.29s     | 81.33×     | $0.1232   |
| 8    | <code>speechmatics-melia-1</code>             | 97.27/100 quality score | 4    | 97.27            | 2.73%                  | 2.59%              | 95.55                   | 4.45%                         | supported   | 19.70s     | 125.04×    | $0.0883   |
| 9    | <code>cloudflare-@cf_deepgram_nova-3</code>   | 96.97/100 quality score | 4    | 96.97            | 3.03%                  | 2.91%              | 94.29                   | 5.71%                         | supported   | 51.53s     | 47.81×     | $0.2135   |
| 10   | <code>deepgram-nova-3</code>                  | 96.04/100 quality score | 4    | 96.04            | 3.96%                  | 2.99%              | 93.42                   | 6.58%                         | supported   | 7.78s      | 316.56×    | $0.1766   |
| 11   | <code>gemini-stt-gemini-3.5-transcribe</code> | 95.58/100 quality score | 4    | 95.58            | 4.42%                  | 4.23%              | 94.55                   | 5.45%                         | supported   | 98.88s     | 24.92×     | $0.2053   |
| 12   | <code>grok-speech-to-text</code>              | 93.54/100 quality score | 4    | 93.54            | 6.46%                  | 6.20%              | 91.14                   | 8.86%                         | supported   | 26.94s     | 91.44×     | $0.0684   |

## Per-Run Quality Score

Neutral speaker-aware WER-derived quality score per provider in each run, sorted by mean.

### Third-Party Service Diarization

| Provider                                      | Mean  | 1-audio | 2022-09-30-widgets-fsjam-40-minutes | 2023-03-15-jsjam-qwik-misko-hevery | 2023-04-05-jsjam-react-miami-2023-10-minutes |
| --------------------------------------------- | ----: | ------: | ----------------------------------: | ---------------------------------: | -------------------------------------------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | 98.49 | 99.52   | 98.81                               | 97.59                              | 98.03                                        |
| <code>assemblyai-universal-3-5-pro</code>     | 98.34 | 99.52   | 98.44                               | 97.39                              | 98.03                                        |
| <code>happyscribe-auto</code>                 | 98.27 | 99.52   | 98.53                               | 97.15                              | 97.85                                        |
| <code>gladia-solaria-3</code>                 | 97.92 | 99.05   | 98.00                               | 96.80                              | 97.85                                        |
| <code>soniox-stt-async-v5</code>              | 97.92 | 99.05   | 98.07                               | 96.89                              | 97.67                                        |
| <code>grok-grok-voice-transcribe-2.0</code>   | 97.88 | 98.57   | 98.09                               | 96.77                              | 98.09                                        |
| <code>mistral-voxtral-mini-2602</code>        | 97.63 | 99.05   | 98.37                               | 96.02                              | 97.08                                        |
| <code>speechmatics-melia-1</code>             | 97.27 | 100.00  | 97.38                               | 94.48                              | 97.20                                        |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | 96.97 | 97.14   | 97.43                               | 96.36                              | 96.96                                        |
| <code>deepgram-nova-3</code>                  | 96.04 | 95.24   | 96.32                               | 96.19                              | 96.42                                        |
| <code>gemini-stt-gemini-3.5-transcribe</code> | 95.58 | 99.05   | 94.90                               | 91.10                              | 97.26                                        |
| <code>grok-speech-to-text</code>              | 93.54 | 90.48   | 94.25                               | 94.25                              | 95.17                                        |

## Error Attribution

Speaker-aware edit counts summed over runs: strict (legacy) edits, edits removed as each neutral view is enabled in order, the remaining headline edits, and their aligned-token classification.

| Provider                                      | Runs | Strict Edits | Disfluency | Orthographic | Number/Format | Neutral Edits | Speaker Attribution | Residual Number/Format | Other Lexical |
| --------------------------------------------- | ---: | -----------: | ---------: | -----------: | ------------: | ------------: | ------------------: | ---------------------: | ------------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | 4    | 1206         | 425        | 124          | 43            | 614           | 54                  | 3                      | 557           |
| <code>assemblyai-universal-3-5-pro</code>     | 4    | 1247         | 395        | 119          | 48            | 685           | 121                 | 2                      | 562           |
| <code>happyscribe-auto</code>                 | 4    | 1270         | 394        | 127          | 22            | 727           | 146                 | 2                      | 579           |
| <code>gladia-solaria-3</code>                 | 4    | 1112         | 89         | 119          | 61            | 843           | 78                  | 11                     | 754           |
| <code>soniox-stt-async-v5</code>              | 4    | 1095         | 154        | 119          | 0             | 822           | 101                 | 8                      | 713           |
| <code>grok-grok-voice-transcribe-2.0</code>   | 4    | 1013         | 42         | 117          | 16            | 838           | 86                  | 3                      | 749           |
| <code>mistral-voxtral-mini-2602</code>        | 4    | 1613         | 511        | 114          | 8             | 980           | 54                  | 5                      | 921           |
| <code>speechmatics-melia-1</code>             | 4    | 1817         | 298        | 139          | 14            | 1366          | 66                  | 6                      | 1294          |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | 4    | 1653         | 60         | 585          | 13            | 995           | 70                  | 20                     | 905           |
| <code>deepgram-nova-3</code>                  | 4    | 1797         | 61         | 588          | 15            | 1133          | 202                 | 20                     | 911           |
| <code>gemini-stt-gemini-3.5-transcribe</code> | 4    | 2510         | 92         | 161          | 9             | 2248          | 113                 | 5                      | 2130          |
| <code>grok-speech-to-text</code>              | 4    | 2358         | 103        | 476          | 57            | 1722          | 140                 | 10                     | 1572          |

## Speaker Metrics

Mean word attribution accuracy (matched words whose mapped provider speaker equals the reference speaker) and mean absolute speaker-count error, for diarizing providers.

| Provider                                      | Mean Word Attribution Accuracy | Mean Speaker Count Error |
| --------------------------------------------- | -----------------------------: | -----------------------: |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | 99.82%                         | 0.00                     |
| <code>grok-grok-voice-transcribe-2.0</code>   | 99.82%                         | 0.50                     |
| <code>assemblyai-assemblyai-stt-3-7</code>    | 99.56%                         | 0.00                     |
| <code>gemini-stt-gemini-3.5-transcribe</code> | 93.61%                         | 4.00                     |
| <code>speechmatics-melia-1</code>             | 93.23%                         | 1.75                     |
| <code>gladia-solaria-3</code>                 | 93.06%                         | 0.25                     |
| <code>grok-speech-to-text</code>              | 92.99%                         | 0.25                     |
| <code>mistral-voxtral-mini-2602</code>        | 92.95%                         | 1.75                     |
| <code>assemblyai-universal-3-5-pro</code>     | 92.45%                         | 0.50                     |
| <code>happyscribe-auto</code>                 | 92.32%                         | 0.50                     |
| <code>soniox-stt-async-v5</code>              | 90.51%                         | 1.25                     |
| <code>deepgram-nova-3</code>                  | 84.98%                         | 0.00                     |

## Notes

- Each provider is aggregated by providerKey across the runs it appears in; the mean is taken over present values only. Aggregate realtime throughput is total covered audio duration divided by total covered processing time.
- Groups follow the single-run STT contract: local, thirdPartyServiceNonDiarization, thirdPartyServiceDiarization.
- Each group ranks price, speed, and quality score independently. No weighted composite or model-tier ranking is emitted.
- Scoring version 2 headline: per-run quality is max(0, 100 * (1 - neutralSpeakerAwareWER)) after disfluency-, orthographic-, and number-neutral normalization applied identically to reference and provider; the scoring-version-1 score is retained as the mean legacy score and legacy speaker-aware WER.
- Providers run with non-default request settings are distinct rows keyed service/model[setting=value,...] and rank alongside default rows.
