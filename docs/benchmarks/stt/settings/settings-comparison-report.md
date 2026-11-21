# STT Settings Comparison Report

## Summary

- Settings root: `docs/benchmarks/stt/settings`
- Baseline root: `docs/benchmarks/stt/with-speakers`
- Scoring version: 2.1
- Recordings: `1-audio`, `2022-09-30-widgets-fsjam-40-minutes`, `2023-03-15-jsjam-qwik-misko-hevery`, `2023-04-05-jsjam-react-miami-2023-10-minutes`
- Variants: 14; paired runs: 37; unpaired variant × recording slots: 19
- Headline means use the common recording set: `1-audio`, `2022-09-30-widgets-fsjam-40-minutes`, `2023-04-05-jsjam-react-miami-2023-10-minutes`.

## Method

- Each `<variant-id>__<recording-id>/` run is paired with the same service/model at default settings in `<baseline-root>/<recording-id>/providers/<service-model>/result.json`.
- Both rows are scored by this command with the current scoring code against the variant's `reference-source.json` reference (path and SHA-256 verified), so deltas never mix scoring versions or references.
- Δ is variant minus baseline. Score and legacy score are /100; WER and word attribution are percentage points; edit counts are speaker-aware edits per recording; cost (¢) and time come from each run's manifest.
- Edit columns: strict and neutral edits, edits forgiven by the disfluency, orthographic, and number views, and the remaining edits attributed to speakers, number format, and other lexical errors.
- Variants missing a recording are never averaged over fewer recordings silently: the headline uses the common recording set, and the Coverage table names each unpaired slot and its reason.

## Variant Summary

Mean Δ per recording over the common recording set: `1-audio`, `2022-09-30-widgets-fsjam-40-minutes`, `2023-04-05-jsjam-react-miami-2023-10-minutes`. "Score (all)" averages every recording the variant pairs.

| Group                                 | Variant                             | Label                        | Baseline                         | Recordings                 | Δ Score | Δ Score (all) | Δ Legacy | Δ SA-WER | Δ Text WER | Δ Disfluency Edits | Δ Speaker-count Error | Δ Word Attribution | Δ Cost  | Δ Time  |
| ------------------------------------- | ----------------------------------- | ---------------------------- | -------------------------------- | -------------------------- | ------: | ------------: | -------: | -------: | ---------: | -----------------: | --------------------: | -----------------: | ------: | ------: |
| Transcript formatting                 | assemblyai-3-7-filler-words         | stt-filler-words=true        | assemblyai/assemblyai-stt-3-7    | 4/4                        | +0.35   | +0.38         | +1.86    | -0.35 pp | -0.40 pp   | -11.7              | 0.00                  | -0.04 pp           | -0.001¢ | +0.96s  |
| Transcript formatting                 | assemblyai-3-7-spoken-numbers       | stt-number-format=spoken     | assemblyai/assemblyai-stt-3-7    | 4/4                        | -0.08   | -0.05         | +0.81    | +0.08 pp | +0.12 pp   | -6.7               | 0.00                  | +0.04 pp           | -0.001¢ | -0.21s  |
| Transcript formatting                 | grok-voice-2-0-verbatim             | stt-verbatim=true            | grok/grok-voice-transcribe-2.0   | 4/4                        | +0.03   | -0.01         | -0.10    | -0.03 pp | -0.02 pp   | +0.7               | 0.00                  | 0.00 pp            | -0.001¢ | -13.68s |
| Speaker count                         | assemblyai-3-7-speaker-count        | speaker-count=2\|13\|6       | assemblyai/assemblyai-stt-3-7    | 4/4                        | +0.04   | 0.00          | +0.12    | -0.04 pp | -0.04 pp   | 0.0                | 0.00                  | 0.00 pp            | -0.001¢ | +1.28s  |
| Speaker count                         | gladia-solaria-3-speaker-count      | --speaker-count <reference>  | gladia/solaria-3                 | 0/4 (4 not run)            | n/a     | n/a           | n/a      | n/a      | n/a        | n/a                | n/a                   | n/a                | n/a     | n/a     |
| Audio profile                         | lossless-assemblyai-3-7             | stt-audio-profile=lossless   | assemblyai/assemblyai-stt-3-7    | 4/4                        | +0.01   | +0.01         | +0.01    | -0.01 pp | -0.01 pp   | +0.7               | 0.00                  | 0.00 pp            | 0.000¢  | +4.37s  |
| Audio profile                         | lossless-deepgram-nova-3            | --stt-audio-profile lossless | deepgram/nova-3                  | 0/4 (4 not run)            | n/a     | n/a           | n/a      | n/a      | n/a        | n/a                | n/a                   | n/a                | n/a     | n/a     |
| Audio profile                         | lossless-gemini-3-5-transcribe      | stt-audio-profile=lossless   | gemini-stt/gemini-3.5-transcribe | 4/4                        | -0.14   | +1.14         | -0.09    | +0.14 pp | +0.20 pp   | 0.0                | +0.33                 | +1.43 pp           | 0.000¢  | +8.73s  |
| Audio profile                         | lossless-gladia-solaria-3           | --stt-audio-profile lossless | gladia/solaria-3                 | 0/4 (3 not run, 1 skipped) | n/a     | n/a           | n/a      | n/a      | n/a        | n/a                | n/a                   | n/a                | n/a     | n/a     |
| Audio profile                         | lossless-grok-voice-2-0             | stt-audio-profile=lossless   | grok/grok-voice-transcribe-2.0   | 3/4 (1 skipped)            | -0.10   | -0.10         | -0.05    | +0.10 pp | +0.06 pp   | -0.3               | 0.00                  | -0.04 pp           | 0.000¢  | -7.73s  |
| Audio profile                         | lossless-mistral-voxtral-mini-2602  | stt-audio-profile=lossless   | mistral/voxtral-mini-2602        | 3/4 (1 skipped)            | +0.06   | +0.06         | +0.05    | -0.06 pp | 0.00 pp    | +0.3               | +0.33                 | +8.88 pp           | 0.000¢  | -2.19s  |
| Audio profile                         | lossless-soniox-stt-async-v5        | stt-audio-profile=lossless   | soniox/stt-async-v5              | 3/4 (1 skipped)            | +0.12   | +0.12         | +0.12    | -0.12 pp | -0.05 pp   | -0.7               | -0.33                 | +8.90 pp           | 0.000¢  | -15.75s |
| Audio profile                         | lossless-speechmatics-melia-1       | --stt-audio-profile lossless | speechmatics/melia-1             | 0/4 (3 not run, 1 skipped) | n/a     | n/a           | n/a      | n/a      | n/a        | n/a                | n/a                   | n/a                | n/a     | n/a     |
| Run-to-run control (default settings) | assemblyai-3-5-pro-rerun-2026-11-20 | rerun=2026-11-20             | assemblyai/universal-3-5-pro     | 4/4                        | +0.29   | +0.27         | +0.26    | -0.29 pp | -0.17 pp   | -1.0               | -0.33                 | +9.72 pp           | -0.001¢ | -11.79s |

## Error Attribution Deltas

Mean Δ speaker-aware edit counts per recording over the common recording set: `1-audio`, `2022-09-30-widgets-fsjam-40-minutes`, `2023-04-05-jsjam-react-miami-2023-10-minutes`.

| Variant                             | Δ Strict | Δ Disfluency | Δ Orthographic | Δ Number | Δ Neutral | Δ Speaker Attribution | Δ Residual Number | Δ Other Lexical |
| ----------------------------------- | -------: | -----------: | -------------: | -------: | --------: | --------------------: | ----------------: | --------------: |
| assemblyai-3-7-filler-words         | -17.7    | -11.7        | +6.3           | -1.7     | -10.7     | +0.7                  | -0.7              | -10.7           |
| assemblyai-3-7-spoken-numbers       | +19.7    | -6.7         | -2.3           | +3.7     | +25.0     | -0.7                  | +1.0              | +24.7           |
| grok-voice-2-0-verbatim             | +1.7     | +0.7         | +3.3           | 0.0      | -2.3      | -0.7                  | 0.0               | -1.7            |
| assemblyai-3-7-speaker-count        | -2.3     | 0.0          | -1.7           | 0.0      | -0.7      | 0.0                   | 0.0               | -0.7            |
| gladia-solaria-3-speaker-count      | n/a      | n/a          | n/a            | n/a      | n/a       | n/a                   | n/a               | n/a             |
| lossless-assemblyai-3-7             | +3.0     | +0.7         | +1.0           | +0.7     | +0.7      | 0.0                   | 0.0               | +0.7            |
| lossless-deepgram-nova-3            | n/a      | n/a          | n/a            | n/a      | n/a       | n/a                   | n/a               | n/a             |
| lossless-gemini-3-5-transcribe      | +2.7     | 0.0          | -1.0           | -0.3     | +4.0      | -13.7                 | +0.3              | +17.3           |
| lossless-gladia-solaria-3           | n/a      | n/a          | n/a            | n/a      | n/a       | n/a                   | n/a               | n/a             |
| lossless-grok-voice-2-0             | -0.7     | -0.3         | -1.7           | -0.3     | +1.7      | +0.7                  | 0.0               | +1.0            |
| lossless-mistral-voxtral-mini-2602  | -4.0     | +0.3         | +0.7           | 0.0      | -5.0      | -4.0                  | 0.0               | -1.0            |
| lossless-soniox-stt-async-v5        | -14.0    | -0.7         | +0.3           | 0.0      | -13.7     | -6.0                  | 0.0               | -7.7            |
| lossless-speechmatics-melia-1       | n/a      | n/a          | n/a            | n/a      | n/a       | n/a                   | n/a               | n/a             |
| assemblyai-3-5-pro-rerun-2026-11-20 | -7.7     | -1.0         | +3.0           | -0.3     | -9.3      | -5.7                  | 0.0               | -3.7            |

## Coverage

| Variant                             | 1-audio | 2022-09-30-widgets-fsjam-40-minutes | 2023-03-15-jsjam-qwik-misko-hevery | 2023-04-05-jsjam-react-miami-2023-10-minutes |
| ----------------------------------- | ------- | ----------------------------------- | ---------------------------------- | -------------------------------------------- |
| assemblyai-3-7-filler-words         | paired  | paired                              | paired                             | paired                                       |
| assemblyai-3-7-spoken-numbers       | paired  | paired                              | paired                             | paired                                       |
| grok-voice-2-0-verbatim             | paired  | paired                              | paired                             | paired                                       |
| assemblyai-3-7-speaker-count        | paired  | paired                              | paired                             | paired                                       |
| gladia-solaria-3-speaker-count      | not run | not run                             | not run                            | not run                                      |
| lossless-assemblyai-3-7             | paired  | paired                              | paired                             | paired                                       |
| lossless-deepgram-nova-3            | not run | not run                             | not run                            | not run                                      |
| lossless-gemini-3-5-transcribe      | paired  | paired                              | paired                             | paired                                       |
| lossless-gladia-solaria-3           | not run | not run                             | skipped                            | not run                                      |
| lossless-grok-voice-2-0             | paired  | paired                              | skipped                            | paired                                       |
| lossless-mistral-voxtral-mini-2602  | paired  | paired                              | skipped                            | paired                                       |
| lossless-soniox-stt-async-v5        | paired  | paired                              | skipped                            | paired                                       |
| lossless-speechmatics-melia-1       | not run | not run                             | skipped                            | not run                                      |
| assemblyai-3-5-pro-rerun-2026-11-20 | paired  | paired                              | paired                             | paired                                       |

| Variant                            | Recording                                    | Status  | Reason                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | -------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| gladia-solaria-3-speaker-count     | 1-audio                                      | not run | Planned; no run directory (not yet run or blocked).                                                                                                                                                                                                                                                                        |
| gladia-solaria-3-speaker-count     | 2022-09-30-widgets-fsjam-40-minutes          | not run | Planned; no run directory (not yet run or blocked).                                                                                                                                                                                                                                                                        |
| gladia-solaria-3-speaker-count     | 2023-03-15-jsjam-qwik-misko-hevery           | not run | Planned; no run directory (not yet run or blocked).                                                                                                                                                                                                                                                                        |
| gladia-solaria-3-speaker-count     | 2023-04-05-jsjam-react-miami-2023-10-minutes | not run | Planned; no run directory (not yet run or blocked).                                                                                                                                                                                                                                                                        |
| lossless-deepgram-nova-3           | 1-audio                                      | not run | Planned; no run directory (not yet run or blocked).                                                                                                                                                                                                                                                                        |
| lossless-deepgram-nova-3           | 2022-09-30-widgets-fsjam-40-minutes          | not run | Planned; no run directory (not yet run or blocked).                                                                                                                                                                                                                                                                        |
| lossless-deepgram-nova-3           | 2023-03-15-jsjam-qwik-misko-hevery           | not run | Planned; no run directory (not yet run or blocked).                                                                                                                                                                                                                                                                        |
| lossless-deepgram-nova-3           | 2023-04-05-jsjam-react-miami-2023-10-minutes | not run | Planned; no run directory (not yet run or blocked).                                                                                                                                                                                                                                                                        |
| lossless-gladia-solaria-3          | 1-audio                                      | not run | Planned; no run directory (not yet run or blocked).                                                                                                                                                                                                                                                                        |
| lossless-gladia-solaria-3          | 2022-09-30-widgets-fsjam-40-minutes          | not run | Planned; no run directory (not yet run or blocked).                                                                                                                                                                                                                                                                        |
| lossless-gladia-solaria-3          | 2023-03-15-jsjam-qwik-misko-hevery           | skipped | Lossless float32 WAV (48000 Hz, 1 ch, ~1.30 GB): 1,300,228,096 B exceeds the 1,048,576,000 B upload cap for gladia/solaria-3. The CLI would auto-split it into FLAC segments with chunk-scoped speaker labels, unlike the unsplit default-profile baseline, so the result would not isolate the audio profile.             |
| lossless-gladia-solaria-3          | 2023-04-05-jsjam-react-miami-2023-10-minutes | not run | Planned; no run directory (not yet run or blocked).                                                                                                                                                                                                                                                                        |
| lossless-grok-voice-2-0            | 2023-03-15-jsjam-qwik-misko-hevery           | skipped | Lossless float32 WAV (48000 Hz, 1 ch, ~1.30 GB): 1,300,228,096 B exceeds the 524,288,000 B upload cap for grok/grok-voice-transcribe-2.0. The CLI would auto-split it into FLAC segments with chunk-scoped speaker labels, unlike the unsplit default-profile baseline, so the result would not isolate the audio profile. |
| lossless-mistral-voxtral-mini-2602 | 2023-03-15-jsjam-qwik-misko-hevery           | skipped | Lossless float32 WAV (48000 Hz, 1 ch, ~1.30 GB): 1,300,228,096 B exceeds the 524,288,000 B upload cap for mistral/voxtral-mini-2602. The CLI would auto-split it into FLAC segments with chunk-scoped speaker labels, unlike the unsplit default-profile baseline, so the result would not isolate the audio profile.      |
| lossless-soniox-stt-async-v5       | 2023-03-15-jsjam-qwik-misko-hevery           | skipped | Lossless float32 WAV (48000 Hz, 1 ch, ~1.30 GB): 1,300,228,096 B exceeds the 524,288,000 B upload cap for soniox/stt-async-v5. The CLI would auto-split it into FLAC segments with chunk-scoped speaker labels, unlike the unsplit default-profile baseline, so the result would not isolate the audio profile.            |
| lossless-speechmatics-melia-1      | 1-audio                                      | not run | Planned; no run directory (not yet run or blocked).                                                                                                                                                                                                                                                                        |
| lossless-speechmatics-melia-1      | 2022-09-30-widgets-fsjam-40-minutes          | not run | Planned; no run directory (not yet run or blocked).                                                                                                                                                                                                                                                                        |
| lossless-speechmatics-melia-1      | 2023-03-15-jsjam-qwik-misko-hevery           | skipped | Lossless float32 WAV (48000 Hz, 1 ch, ~1.30 GB): 1,300,228,096 B exceeds the 1,073,741,824 B upload cap for speechmatics/melia-1. The CLI would auto-split it into FLAC segments with chunk-scoped speaker labels, unlike the unsplit default-profile baseline, so the result would not isolate the audio profile.         |
| lossless-speechmatics-melia-1      | 2023-04-05-jsjam-react-miami-2023-10-minutes | not run | Planned; no run directory (not yet run or blocked).                                                                                                                                                                                                                                                                        |

## Per-Recording Detail

### assemblyai-3-7-filler-words

| Recording                                    | Variant Key                                          | Baseline Score | Variant Score | Δ Score | Δ Legacy | Δ SA-WER | Δ Text WER | Δ Disfluency | Δ Neutral Edits | Speakers (base → variant / ref) | Δ Word Attribution | Δ Cost  | Δ Time |
| -------------------------------------------- | ---------------------------------------------------- | -------------: | ------------: | ------: | -------: | -------: | ---------: | -----------: | --------------: | ------------------------------: | -----------------: | ------: | -----: |
| 1-audio                                      | assemblyai/assemblyai-stt-3-7[stt-filler-words=true] | 99.52          | 99.52         | 0.00    | +3.15    | 0.00 pp  | 0.00 pp    | -7           | 0               | 2 → 2 / 2                       | 0.00 pp            | -0.004¢ | +3.82s |
| 2022-09-30-widgets-fsjam-40-minutes          | assemblyai/assemblyai-stt-3-7[stt-filler-words=true] | 98.81          | 99.03         | +0.22   | +0.06    | -0.22 pp | -0.22 pp   | -1           | -18             | 2 → 2 / 2                       | 0.00 pp            | 0.000¢  | -0.43s |
| 2023-03-15-jsjam-qwik-misko-hevery           | assemblyai/assemblyai-stt-3-7[stt-filler-words=true] | 97.59          | 98.07         | +0.48   | +1.94    | -0.48 pp | -0.48 pp   | -302         | -96             | 12 → 12 / 12                    | -1.32 pp           | 0.000¢  | +9.23s |
| 2023-04-05-jsjam-react-miami-2023-10-minutes | assemblyai/assemblyai-stt-3-7[stt-filler-words=true] | 98.03          | 98.87         | +0.83   | +2.38    | -0.83 pp | -0.97 pp   | -27          | -14             | 6 → 6 / 6                       | -0.12 pp           | 0.000¢  | -0.51s |

### assemblyai-3-7-spoken-numbers

| Recording                                    | Variant Key                                             | Baseline Score | Variant Score | Δ Score | Δ Legacy | Δ SA-WER | Δ Text WER | Δ Disfluency | Δ Neutral Edits | Speakers (base → variant / ref) | Δ Word Attribution | Δ Cost  | Δ Time |
| -------------------------------------------- | ------------------------------------------------------- | -------------: | ------------: | ------: | -------: | -------: | ---------: | -----------: | --------------: | ------------------------------: | -----------------: | ------: | -----: |
| 1-audio                                      | assemblyai/assemblyai-stt-3-7[stt-number-format=spoken] | 99.52          | 99.52         | 0.00    | +1.80    | 0.00 pp  | 0.00 pp    | -6           | 0               | 2 → 2 / 2                       | 0.00 pp            | -0.004¢ | -0.36s |
| 2022-09-30-widgets-fsjam-40-minutes          | assemblyai/assemblyai-stt-3-7[stt-number-format=spoken] | 98.81          | 97.73         | -1.09   | -1.13    | +1.09 pp | +1.10 pp   | -3           | +89             | 2 → 2 / 2                       | 0.00 pp            | 0.000¢  | -0.09s |
| 2023-03-15-jsjam-qwik-misko-hevery           | assemblyai/assemblyai-stt-3-7[stt-number-format=spoken] | 97.59          | 97.65         | +0.06   | +0.21    | -0.06 pp | -0.01 pp   | -23          | -12             | 12 → 12 / 12                    | +0.48 pp           | 0.000¢  | +9.92s |
| 2023-04-05-jsjam-react-miami-2023-10-minutes | assemblyai/assemblyai-stt-3-7[stt-number-format=spoken] | 98.03          | 98.87         | +0.83   | +1.74    | -0.83 pp | -0.72 pp   | -11          | -14             | 6 → 6 / 6                       | +0.12 pp           | 0.000¢  | -0.16s |

### grok-voice-2-0-verbatim

| Recording                                    | Variant Key                                       | Baseline Score | Variant Score | Δ Score | Δ Legacy | Δ SA-WER | Δ Text WER | Δ Disfluency | Δ Neutral Edits | Speakers (base → variant / ref) | Δ Word Attribution | Δ Cost  | Δ Time   |
| -------------------------------------------- | ------------------------------------------------- | -------------: | ------------: | ------: | -------: | -------: | ---------: | -----------: | --------------: | ------------------------------: | -----------------: | ------: | -------: |
| 1-audio                                      | grok/grok-voice-transcribe-2.0[stt-verbatim=true] | 98.57          | 98.57         | 0.00    | 0.00     | 0.00 pp  | 0.00 pp    | 0            | 0               | 2 → 2 / 2                       | 0.00 pp            | -0.002¢ | +0.10s   |
| 2022-09-30-widgets-fsjam-40-minutes          | grok/grok-voice-transcribe-2.0[stt-verbatim=true] | 98.09          | 98.18         | +0.09   | 0.00     | -0.09 pp | -0.06 pp   | +1           | -7              | 3 → 3 / 2                       | +0.01 pp           | 0.000¢  | -39.80s  |
| 2023-03-15-jsjam-qwik-misko-hevery           | grok/grok-voice-transcribe-2.0[stt-verbatim=true] | 96.77          | 96.62         | -0.14   | -0.08    | +0.14 pp | +0.07 pp   | -6           | +29             | 13 → 8 / 12                     | -6.14 pp           | 0.000¢  | -182.03s |
| 2023-04-05-jsjam-react-miami-2023-10-minutes | grok/grok-voice-transcribe-2.0[stt-verbatim=true] | 98.09          | 98.09         | 0.00    | -0.29    | 0.00 pp  | 0.00 pp    | +1           | 0               | 6 → 6 / 6                       | 0.00 pp            | 0.000¢  | -1.35s   |

### assemblyai-3-7-speaker-count

| Recording                                    | Variant Key                                     | Baseline Score | Variant Score | Δ Score | Δ Legacy | Δ SA-WER | Δ Text WER | Δ Disfluency | Δ Neutral Edits | Speakers (base → variant / ref) | Δ Word Attribution | Δ Cost  | Δ Time  |
| -------------------------------------------- | ----------------------------------------------- | -------------: | ------------: | ------: | -------: | -------: | ---------: | -----------: | --------------: | ------------------------------: | -----------------: | ------: | ------: |
| 1-audio                                      | assemblyai/assemblyai-stt-3-7[speaker-count=2]  | 99.52          | 99.52         | 0.00    | 0.00     | 0.00 pp  | 0.00 pp    | 0            | 0               | 2 → 2 / 2                       | 0.00 pp            | -0.004¢ | +3.98s  |
| 2022-09-30-widgets-fsjam-40-minutes          | assemblyai/assemblyai-stt-3-7[speaker-count=2]  | 98.81          | 98.81         | 0.00    | +0.01    | 0.00 pp  | 0.00 pp    | 0            | 0               | 2 → 2 / 2                       | 0.00 pp            | 0.000¢  | -0.08s  |
| 2023-03-15-jsjam-qwik-misko-hevery           | assemblyai/assemblyai-stt-3-7[speaker-count=13] | 97.59          | 97.47         | -0.11   | -0.10    | +0.11 pp | -0.02 pp   | -5           | +23             | 12 → 13 / 12                    | +1.23 pp           | 0.000¢  | +40.08s |
| 2023-04-05-jsjam-react-miami-2023-10-minutes | assemblyai/assemblyai-stt-3-7[speaker-count=6]  | 98.03          | 98.15         | +0.12   | +0.35    | -0.12 pp | -0.12 pp   | 0            | -2              | 6 → 6 / 6                       | 0.00 pp            | 0.000¢  | -0.08s  |

### lossless-assemblyai-3-7

| Recording                                    | Variant Key                                               | Baseline Score | Variant Score | Δ Score | Δ Legacy | Δ SA-WER | Δ Text WER | Δ Disfluency | Δ Neutral Edits | Speakers (base → variant / ref) | Δ Word Attribution | Δ Cost  | Δ Time  |
| -------------------------------------------- | --------------------------------------------------------- | -------------: | ------------: | ------: | -------: | -------: | ---------: | -----------: | --------------: | ------------------------------: | -----------------: | ------: | ------: |
| 1-audio                                      | assemblyai/assemblyai-stt-3-7[stt-audio-profile=lossless] | 99.52          | 99.52         | 0.00    | 0.00     | 0.00 pp  | 0.00 pp    | 0            | 0               | 2 → 2 / 2                       | 0.00 pp            | 0.000¢  | +4.50s  |
| 2022-09-30-widgets-fsjam-40-minutes          | assemblyai/assemblyai-stt-3-7[stt-audio-profile=lossless] | 98.81          | 98.78         | -0.04   | -0.15    | +0.04 pp | +0.04 pp   | +2           | +3              | 2 → 2 / 2                       | 0.00 pp            | 0.000¢  | +6.62s  |
| 2023-03-15-jsjam-qwik-misko-hevery           | assemblyai/assemblyai-stt-3-7[stt-audio-profile=lossless] | 97.59          | 97.61         | +0.02   | -0.03    | -0.02 pp | -0.02 pp   | +1           | -4              | 12 → 12 / 12                    | -1.03 pp           | +0.005¢ | +33.55s |
| 2023-04-05-jsjam-react-miami-2023-10-minutes | assemblyai/assemblyai-stt-3-7[stt-audio-profile=lossless] | 98.03          | 98.09         | +0.06   | +0.17    | -0.06 pp | -0.06 pp   | 0            | -1              | 6 → 6 / 6                       | 0.00 pp            | 0.000¢  | +1.98s  |

### lossless-gemini-3-5-transcribe

| Recording                                    | Variant Key                                                  | Baseline Score | Variant Score | Δ Score | Δ Legacy | Δ SA-WER | Δ Text WER | Δ Disfluency | Δ Neutral Edits | Speakers (base → variant / ref) | Δ Word Attribution | Δ Cost  | Δ Time  |
| -------------------------------------------- | ------------------------------------------------------------ | -------------: | ------------: | ------: | -------: | -------: | ---------: | -----------: | --------------: | ------------------------------: | -----------------: | ------: | ------: |
| 1-audio                                      | gemini-stt/gemini-3.5-transcribe[stt-audio-profile=lossless] | 99.05          | 99.05         | 0.00    | 0.00     | 0.00 pp  | 0.00 pp    | 0            | 0               | 2 → 2 / 2                       | 0.00 pp            | 0.000¢  | +0.31s  |
| 2022-09-30-widgets-fsjam-40-minutes          | gemini-stt/gemini-3.5-transcribe[stt-audio-profile=lossless] | 94.90          | 94.83         | -0.07   | -0.05    | +0.07 pp | +0.67 pp   | -1           | +6              | 4 → 5 / 2                       | +12.98 pp          | 0.000¢  | +16.89s |
| 2023-03-15-jsjam-qwik-misko-hevery           | gemini-stt/gemini-3.5-transcribe[stt-audio-profile=lossless] | 91.10          | 96.07         | +4.97   | +4.83    | -4.97 pp | -5.06 pp   | -18          | -996            | 26 → 22 / 12                    | -6.53 pp           | +0.007¢ | +29.57s |
| 2023-04-05-jsjam-react-miami-2023-10-minutes | gemini-stt/gemini-3.5-transcribe[stt-audio-profile=lossless] | 97.26          | 96.90         | -0.36   | -0.23    | +0.36 pp | -0.06 pp   | +1           | +6              | 6 → 6 / 6                       | -8.70 pp           | 0.000¢  | +8.99s  |

### lossless-grok-voice-2-0

| Recording                                    | Variant Key                                                | Baseline Score | Variant Score | Δ Score | Δ Legacy | Δ SA-WER | Δ Text WER | Δ Disfluency | Δ Neutral Edits | Speakers (base → variant / ref) | Δ Word Attribution | Δ Cost | Δ Time  |
| -------------------------------------------- | ---------------------------------------------------------- | -------------: | ------------: | ------: | -------: | -------: | ---------: | -----------: | --------------: | ------------------------------: | -----------------: | -----: | ------: |
| 1-audio                                      | grok/grok-voice-transcribe-2.0[stt-audio-profile=lossless] | 98.57          | 98.57         | 0.00    | 0.00     | 0.00 pp  | 0.00 pp    | 0            | 0               | 2 → 2 / 2                       | 0.00 pp            | 0.000¢ | +0.46s  |
| 2022-09-30-widgets-fsjam-40-minutes          | grok/grok-voice-transcribe-2.0[stt-audio-profile=lossless] | 98.09          | 98.09         | 0.00    | +0.07    | 0.00 pp  | 0.00 pp    | 0            | 0               | 3 → 3 / 2                       | +0.01 pp           | 0.000¢ | -26.20s |
| 2023-04-05-jsjam-react-miami-2023-10-minutes | grok/grok-voice-transcribe-2.0[stt-audio-profile=lossless] | 98.09          | 97.79         | -0.30   | -0.23    | +0.30 pp | +0.18 pp   | -1           | +5              | 6 → 6 / 6                       | -0.12 pp           | 0.000¢ | +2.57s  |

### lossless-mistral-voxtral-mini-2602

| Recording                                    | Variant Key                                           | Baseline Score | Variant Score | Δ Score | Δ Legacy | Δ SA-WER | Δ Text WER | Δ Disfluency | Δ Neutral Edits | Speakers (base → variant / ref) | Δ Word Attribution | Δ Cost | Δ Time |
| -------------------------------------------- | ----------------------------------------------------- | -------------: | ------------: | ------: | -------: | -------: | ---------: | -----------: | --------------: | ------------------------------: | -----------------: | -----: | -----: |
| 1-audio                                      | mistral/voxtral-mini-2602[stt-audio-profile=lossless] | 99.05          | 99.05         | 0.00    | 0.00     | 0.00 pp  | 0.00 pp    | 0            | 0               | 2 → 2 / 2                       | 0.00 pp            | 0.000¢ | +0.04s |
| 2022-09-30-widgets-fsjam-40-minutes          | mistral/voxtral-mini-2602[stt-audio-profile=lossless] | 98.37          | 98.56         | +0.18   | +0.15    | -0.18 pp | -0.01 pp   | +1           | -15             | 2 → 3 / 2                       | +26.63 pp          | 0.000¢ | -5.58s |
| 2023-04-05-jsjam-react-miami-2023-10-minutes | mistral/voxtral-mini-2602[stt-audio-profile=lossless] | 97.08          | 97.08         | 0.00    | 0.00     | 0.00 pp  | 0.00 pp    | 0            | 0               | 6 → 6 / 6                       | 0.00 pp            | 0.000¢ | -1.03s |

### lossless-soniox-stt-async-v5

| Recording                                    | Variant Key                                     | Baseline Score | Variant Score | Δ Score | Δ Legacy | Δ SA-WER | Δ Text WER | Δ Disfluency | Δ Neutral Edits | Speakers (base → variant / ref) | Δ Word Attribution | Δ Cost | Δ Time  |
| -------------------------------------------- | ----------------------------------------------- | -------------: | ------------: | ------: | -------: | -------: | ---------: | -----------: | --------------: | ------------------------------: | -----------------: | -----: | ------: |
| 1-audio                                      | soniox/stt-async-v5[stt-audio-profile=lossless] | 99.05          | 99.05         | 0.00    | 0.00     | 0.00 pp  | 0.00 pp    | 0            | 0               | 2 → 2 / 2                       | 0.00 pp            | 0.000¢ | +0.18s  |
| 2022-09-30-widgets-fsjam-40-minutes          | soniox/stt-async-v5[stt-audio-profile=lossless] | 98.07          | 98.61         | +0.54   | +0.55    | -0.54 pp | -0.33 pp   | -2           | -44             | 3 → 2 / 2                       | +26.69 pp          | 0.000¢ | -39.14s |
| 2023-04-05-jsjam-react-miami-2023-10-minutes | soniox/stt-async-v5[stt-audio-profile=lossless] | 97.67          | 97.49         | -0.18   | -0.17    | +0.18 pp | +0.18 pp   | 0            | +3              | 6 → 6 / 6                       | 0.00 pp            | 0.000¢ | -8.29s  |

### assemblyai-3-5-pro-rerun-2026-11-20

| Recording                                    | Variant Key                                    | Baseline Score | Variant Score | Δ Score | Δ Legacy | Δ SA-WER | Δ Text WER | Δ Disfluency | Δ Neutral Edits | Speakers (base → variant / ref) | Δ Word Attribution | Δ Cost  | Δ Time  |
| -------------------------------------------- | ---------------------------------------------- | -------------: | ------------: | ------: | -------: | -------: | ---------: | -----------: | --------------: | ------------------------------: | -----------------: | ------: | ------: |
| 1-audio                                      | assemblyai/universal-3-5-pro[rerun=2026-11-20] | 99.52          | 99.52         | 0.00    | 0.00     | 0.00 pp  | 0.00 pp    | 0            | 0               | 2 → 2 / 2                       | 0.00 pp            | -0.004¢ | +0.59s  |
| 2022-09-30-widgets-fsjam-40-minutes          | assemblyai/universal-3-5-pro[rerun=2026-11-20] | 98.44          | 98.64         | +0.21   | +0.15    | -0.21 pp | -0.02 pp   | -3           | -17             | 2 → 2 / 2                       | +26.84 pp          | 0.000¢  | -27.73s |
| 2023-03-15-jsjam-qwik-misko-hevery           | assemblyai/universal-3-5-pro[rerun=2026-11-20] | 97.39          | 97.60         | +0.21   | +0.23    | -0.21 pp | +0.02 pp   | -4           | -42             | 11 → 12 / 12                    | -0.15 pp           | 0.000¢  | -35.42s |
| 2023-04-05-jsjam-react-miami-2023-10-minutes | assemblyai/universal-3-5-pro[rerun=2026-11-20] | 98.03          | 98.69         | +0.66   | +0.64    | -0.66 pp | -0.48 pp   | 0            | -11             | 5 → 6 / 6                       | +2.33 pp           | 0.000¢  | -8.23s  |

## Notes

- Every delta is variant minus its default-settings baseline (same service/model) on the same recording, both scored now with the current scoring code against the variant's verified reference-source.json reference.
- Headline means use the common recording set paired by every variant with at least one paired recording (1-audio, 2022-09-30-widgets-fsjam-40-minutes, 2023-04-05-jsjam-react-miami-2023-10-minutes); the "all covered" score mean uses every recording a variant pairs.
- Variants with unpaired recordings (skipped, not run, failed, or missing a baseline) are listed under Coverage and never averaged silently: gladia-solaria-3-speaker-count, lossless-deepgram-nova-3, lossless-gladia-solaria-3, lossless-grok-voice-2-0, lossless-mistral-voxtral-mini-2602, lossless-soniox-stt-async-v5, lossless-speechmatics-melia-1.
- Positive score, legacy-score, and word-attribution deltas favor the variant; positive WER, edit-count, speaker-count-error, cost, and time deltas favor the baseline. Forgiven-by-view edit deltas show how much more (positive) form variation the variant produced that the neutral view forgave.
- The baseline rows come from the with-speakers archive and were recorded on an earlier date, so deltas also include any provider-side model drift; the run-to-run control variant estimates that noise for one route.
