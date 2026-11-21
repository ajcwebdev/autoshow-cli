# Consensus Transcript Comparison Report

## Summary

- Run directory: `docs/benchmarks/stt/without-speakers/2023-04-05-jsjam-react-miami-2023-10-minutes`
- Total providers: 14 (0 local, 14 third-party service)
- Local, third-party non-diarization, and third-party diarization providers are ranked separately for price, speed, and quality score.
- Quality score uses neutral speaker-aware WER-derived transcript accuracy (scoring version 2.1: `max(0, 100 * (1 - neutralSpeakerAwareWER))`), with text-only WER and the legacy score retained as supporting evidence.

## Method

- Scoring version 2 changes the headline: score, speakerAwareWER, textOnlyWER, and their breakdowns now use the neutral views; scoring-version-1 values are retained as legacyScore, legacySpeakerAwareWER, legacyTextOnlyWER, legacySpeakerAwareBreakdown, and legacyTextOnlyBreakdown.
- Every view is applied identically to the reference and the provider transcript before alignment.
- Disfluency-neutral: fillers (um, uh, hmm, mhm, ah, er, plus umm, uhm, uhh, hm, hmmm, mm, mmm, erm, ahh) are removed; immediately repeated 1-3-word n-grams within one speaker turn collapse to one copy; false-start fragments ending in a dash attached to the last word (at most three words followed by a space, or a fragment the next word restarts) become optional tokens that cost nothing to omit or include.
- Orthographic-neutral: hyphenated compounds are joined (e-mail = email) and split forms of a compound seen on either side merge into it; two-word splits merge into a single word seen on either side only when both parts have at least three letters; ok/O.K. = okay, all right = alright, can not = cannot, per cent = percent; informal reductions expand on both sides (scoring version 2.1: gonna = going to, wanna = want to, gotta = got to, kinda = kind of, sorta = sort of, apostrophe-initial 'cause = because; because both sides are expanded identically, only form differences are forgiven); ASCII apostrophes expand contractions like curly ones; abbreviations expand only at a word start.
- Number-neutral: spelled cardinals, compounds, ordinals, decimals, scale words, comma thousands, percent, and currency share one digit form (twenty-five = 25, one thousand two hundred fifty = 1,250 = 1250, third = 3rd, three point five = 3.5, $5 million = five million dollars); spoken years with an eighteen/nineteen/twenty prefix (nineteen ninety nine = 1999, twenty twenty three = 2023) are read as years; plural/singular currency and decades are not normalized.
- Error attribution enables the views cumulatively (disfluency, orthographic, number) on speaker-aware edit counts and reports the edits each step removed; remaining headline edits are classified by the aligned tokens as speaker attribution (a speaker-change token is involved), number/format (a substitution with a digit token), or other lexical. Attribution is order-dependent and a view can occasionally add edits (negative values).
- Speaker metrics compare distinct provider speaker labels with reference speakers and report word attribution accuracy: the share of matched words in the neutral text-only alignment whose overlap-mapped provider speaker equals the reference speaker.
- Alignment is an exact minimum-edit alignment with a checkpointed traceback, so substitution/deletion/insertion counts are exact for transcripts of any length.
- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.
- Speed rankings use processing time when present; missing timing stays in the ranking at the end.
- Quality Score rankings sort by the existing speaker-aware WER-derived provider score from highest to lowest.
- Third-party service rankings are split by whether the normalized provider result supports diarization.

## Metric Rankings

### Local

#### Price

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost                 |
| ---: | -------- | ----: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a         | n/a               | n/a           | n/a         | n/a             | n/a        | No providers in this group. |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost                 |
| ---: | -------- | ----: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a         | n/a               | n/a           | n/a         | n/a             | n/a        | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost                 |
| ---: | -------- | ----: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a         | n/a               | n/a           | n/a         | n/a             | n/a        | No providers in this group. |

### Third-Party Service Non-Diarization

#### Price

| Rank | Provider                                                                   | Value   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time | Throughput       | Actual Cost |
| ---: | -------------------------------------------------------------------------- | ------: | ----------: | ----------------: | ------------: | ------------- | --------------: | ---------------: | ----------: |
| 1    | <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | $0.0001 | 83.50       | 16.50%            | 15.64%        | not-supported | 51.74s          | 11.60× realtime  | $0.0001     |
| 2    | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | $0.0020 | 93.59       | 6.41%             | 5.45%         | not-supported | 21.62s          | 27.75× realtime  | $0.0020     |
| 3    | <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | $0.0020 | 92.09       | 7.91%             | 7.27%         | not-supported | 4.27s           | 140.52× realtime | $0.0020     |
| 4    | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | $0.0020 | 96.16       | 3.84%             | 2.85%         | not-supported | 8.67s           | 69.22× realtime  | $0.0020     |
| 5    | <code>deepinfra-openai_whisper-large-v3</code>                             | $0.0045 | 95.32       | 4.68%             | 3.82%         | not-supported | 6.52s           | 92.04× realtime  | $0.0045     |
| 6    | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | $0.0045 | 96.70       | 3.30%             | 2.36%         | not-supported | 5.21s           | 115.16× realtime | $0.0045     |
| 7    | <code>cloudflare-@cf_openai_whisper</code>                                 | $0.0045 | 91.43       | 8.57%             | 7.81%         | not-supported | 71.41s          | 8.40× realtime   | $0.0045     |
| 8    | <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | $0.0051 | 95.26       | 4.74%             | 3.82%         | not-supported | 51.33s          | 11.69× realtime  | $0.0051     |
| 9    | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | $0.0100 | 96.76       | 3.24%             | 2.24%         | not-supported | 12.42s          | 48.31× realtime  | $0.0100     |
| 10   | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | $0.0150 | 96.40       | 3.60%             | 2.67%         | not-supported | 1.29s           | 464.04× realtime | $0.0150     |
| 11   | <code>together-openai_whisper-large-v3</code>                              | $0.0150 | 96.28       | 3.72%             | 2.73%         | not-supported | 3.46s           | 173.36× realtime | $0.0150     |
| 12   | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | $0.0300 | 97.12       | 2.88%             | 1.88%         | not-supported | 40.16s          | 14.94× realtime  | $0.0300     |
| 13   | <code>openai-stt-gpt-transcribe</code>                                     | $0.0450 | 97.00       | 3.00%             | 2.06%         | not-supported | 12.44s          | 48.23× realtime  | $0.0450     |
| 14   | <code>cloudflare-@cf_deepgram_nova-3</code>                                | $0.0520 | 96.04       | 3.96%             | 3.15%         | not-supported | 2.87s           | 209.13× realtime | $0.0520     |

#### Speed

| Rank | Provider                                                                   | Value  | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time | Throughput       | Actual Cost |
| ---: | -------------------------------------------------------------------------- | -----: | ----------: | ----------------: | ------------: | ------------- | --------------: | ---------------: | ----------: |
| 1    | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 1.29s  | 96.40       | 3.60%             | 2.67%         | not-supported | 1.29s           | 464.04× realtime | $0.0150     |
| 2    | <code>cloudflare-@cf_deepgram_nova-3</code>                                | 2.87s  | 96.04       | 3.96%             | 3.15%         | not-supported | 2.87s           | 209.13× realtime | $0.0520     |
| 3    | <code>together-openai_whisper-large-v3</code>                              | 3.46s  | 96.28       | 3.72%             | 2.73%         | not-supported | 3.46s           | 173.36× realtime | $0.0150     |
| 4    | <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 4.27s  | 92.09       | 7.91%             | 7.27%         | not-supported | 4.27s           | 140.52× realtime | $0.0020     |
| 5    | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 5.21s  | 96.70       | 3.30%             | 2.36%         | not-supported | 5.21s           | 115.16× realtime | $0.0045     |
| 6    | <code>deepinfra-openai_whisper-large-v3</code>                             | 6.52s  | 95.32       | 4.68%             | 3.82%         | not-supported | 6.52s           | 92.04× realtime  | $0.0045     |
| 7    | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 8.67s  | 96.16       | 3.84%             | 2.85%         | not-supported | 8.67s           | 69.22× realtime  | $0.0020     |
| 8    | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 12.42s | 96.76       | 3.24%             | 2.24%         | not-supported | 12.42s          | 48.31× realtime  | $0.0100     |
| 9    | <code>openai-stt-gpt-transcribe</code>                                     | 12.44s | 97.00       | 3.00%             | 2.06%         | not-supported | 12.44s          | 48.23× realtime  | $0.0450     |
| 10   | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 21.62s | 93.59       | 6.41%             | 5.45%         | not-supported | 21.62s          | 27.75× realtime  | $0.0020     |
| 11   | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 40.16s | 97.12       | 2.88%             | 1.88%         | not-supported | 40.16s          | 14.94× realtime  | $0.0300     |
| 12   | <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 51.33s | 95.26       | 4.74%             | 3.82%         | not-supported | 51.33s          | 11.69× realtime  | $0.0051     |
| 13   | <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 51.74s | 83.50       | 16.50%            | 15.64%        | not-supported | 51.74s          | 11.60× realtime  | $0.0001     |
| 14   | <code>cloudflare-@cf_openai_whisper</code>                                 | 71.41s | 91.43       | 8.57%             | 7.81%         | not-supported | 71.41s          | 8.40× realtime   | $0.0045     |

#### Quality Score

| Rank | Provider                                                                   | Value                   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time | Throughput       | Actual Cost |
| ---: | -------------------------------------------------------------------------- | ----------------------: | ----------: | ----------------: | ------------: | ------------- | --------------: | ---------------: | ----------: |
| 1    | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 97.12/100 quality score | 97.12       | 2.88%             | 1.88%         | not-supported | 40.16s          | 14.94× realtime  | $0.0300     |
| 2    | <code>openai-stt-gpt-transcribe</code>                                     | 97.00/100 quality score | 97.00       | 3.00%             | 2.06%         | not-supported | 12.44s          | 48.23× realtime  | $0.0450     |
| 3    | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 96.76/100 quality score | 96.76       | 3.24%             | 2.24%         | not-supported | 12.42s          | 48.31× realtime  | $0.0100     |
| 4    | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 96.70/100 quality score | 96.70       | 3.30%             | 2.36%         | not-supported | 5.21s           | 115.16× realtime | $0.0045     |
| 5    | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 96.40/100 quality score | 96.40       | 3.60%             | 2.67%         | not-supported | 1.29s           | 464.04× realtime | $0.0150     |
| 6    | <code>together-openai_whisper-large-v3</code>                              | 96.28/100 quality score | 96.28       | 3.72%             | 2.73%         | not-supported | 3.46s           | 173.36× realtime | $0.0150     |
| 7    | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 96.16/100 quality score | 96.16       | 3.84%             | 2.85%         | not-supported | 8.67s           | 69.22× realtime  | $0.0020     |
| 8    | <code>cloudflare-@cf_deepgram_nova-3</code>                                | 96.04/100 quality score | 96.04       | 3.96%             | 3.15%         | not-supported | 2.87s           | 209.13× realtime | $0.0520     |
| 9    | <code>deepinfra-openai_whisper-large-v3</code>                             | 95.32/100 quality score | 95.32       | 4.68%             | 3.82%         | not-supported | 6.52s           | 92.04× realtime  | $0.0045     |
| 10   | <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 95.26/100 quality score | 95.26       | 4.74%             | 3.82%         | not-supported | 51.33s          | 11.69× realtime  | $0.0051     |
| 11   | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 93.59/100 quality score | 93.59       | 6.41%             | 5.45%         | not-supported | 21.62s          | 27.75× realtime  | $0.0020     |
| 12   | <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 92.09/100 quality score | 92.09       | 7.91%             | 7.27%         | not-supported | 4.27s           | 140.52× realtime | $0.0020     |
| 13   | <code>cloudflare-@cf_openai_whisper</code>                                 | 91.43/100 quality score | 91.43       | 8.57%             | 7.81%         | not-supported | 71.41s          | 8.40× realtime   | $0.0045     |
| 14   | <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 83.50/100 quality score | 83.50       | 16.50%            | 15.64%        | not-supported | 51.74s          | 11.60× realtime  | $0.0001     |

### Third-Party Service Diarization

#### Price

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost                 |
| ---: | -------- | ----: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a         | n/a               | n/a           | n/a         | n/a             | n/a        | No providers in this group. |

#### Speed

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost                 |
| ---: | -------- | ----: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a         | n/a               | n/a           | n/a         | n/a             | n/a        | No providers in this group. |

#### Quality Score

| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput | Actual Cost                 |
| ---: | -------- | ----: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------: | --------------------------: |
| n/a  | n/a      | n/a   | n/a         | n/a               | n/a           | n/a         | n/a             | n/a        | No providers in this group. |


## Provider Detail

| Provider                                                                   | Group                               | Diarization   | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Throughput       | Actual Cost |
| -------------------------------------------------------------------------- | ----------------------------------- | ------------- | ----------: | ----------------: | ------------: | --------------: | ---------------: | ----------: |
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | Third-Party Service Non-Diarization | not-supported | 96.04       | 3.96%             | 3.15%         | 2.87s           | 209.13× realtime | $0.0520     |
| <code>cloudflare-@cf_openai_whisper</code>                                 | Third-Party Service Non-Diarization | not-supported | 91.43       | 8.57%             | 7.81%         | 71.41s          | 8.40× realtime   | $0.0045     |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | Third-Party Service Non-Diarization | not-supported | 95.26       | 4.74%             | 3.82%         | 51.33s          | 11.69× realtime  | $0.0051     |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | Third-Party Service Non-Diarization | not-supported | 83.50       | 16.50%            | 15.64%        | 51.74s          | 11.60× realtime  | $0.0001     |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | Third-Party Service Non-Diarization | not-supported | 96.76       | 3.24%             | 2.24%         | 12.42s          | 48.31× realtime  | $0.0100     |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | Third-Party Service Non-Diarization | not-supported | 97.12       | 2.88%             | 1.88%         | 40.16s          | 14.94× realtime  | $0.0300     |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | Third-Party Service Non-Diarization | not-supported | 93.59       | 6.41%             | 5.45%         | 21.62s          | 27.75× realtime  | $0.0020     |
| <code>deepinfra-openai_whisper-large-v3</code>                             | Third-Party Service Non-Diarization | not-supported | 95.32       | 4.68%             | 3.82%         | 6.52s           | 92.04× realtime  | $0.0045     |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | Third-Party Service Non-Diarization | not-supported | 92.09       | 7.91%             | 7.27%         | 4.27s           | 140.52× realtime | $0.0020     |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | Third-Party Service Non-Diarization | not-supported | 96.16       | 3.84%             | 2.85%         | 8.67s           | 69.22× realtime  | $0.0020     |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | Third-Party Service Non-Diarization | not-supported | 96.70       | 3.30%             | 2.36%         | 5.21s           | 115.16× realtime | $0.0045     |
| <code>openai-stt-gpt-transcribe</code>                                     | Third-Party Service Non-Diarization | not-supported | 97.00       | 3.00%             | 2.06%         | 12.44s          | 48.23× realtime  | $0.0450     |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | Third-Party Service Non-Diarization | not-supported | 96.40       | 3.60%             | 2.67%         | 1.29s           | 464.04× realtime | $0.0150     |
| <code>together-openai_whisper-large-v3</code>                              | Third-Party Service Non-Diarization | not-supported | 96.28       | 3.72%             | 2.73%         | 3.46s           | 173.36× realtime | $0.0150     |

## Error Breakdown (Speaker-aware)

| Provider                                                                   | Substitutions | Deletions | Insertions | Ref. Words |
| -------------------------------------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | 24            | 28        | 14         | 1668       |
| <code>cloudflare-@cf_openai_whisper</code>                                 | 63            | 68        | 12         | 1668       |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 33            | 32        | 14         | 1666       |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 152           | 92        | 31         | 1667       |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 18            | 35        | 1          | 1668       |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 18            | 27        | 3          | 1668       |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 50            | 53        | 4          | 1668       |
| <code>deepinfra-openai_whisper-large-v3</code>                             | 22            | 46        | 10         | 1668       |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 27            | 92        | 13         | 1668       |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 24            | 32        | 8          | 1668       |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 19            | 28        | 8          | 1667       |
| <code>openai-stt-gpt-transcribe</code>                                     | 15            | 28        | 7          | 1667       |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 22            | 22        | 16         | 1668       |
| <code>together-openai_whisper-large-v3</code>                              | 18            | 41        | 3          | 1668       |

## Error Breakdown (Text-only)

| Provider                                                                   | Substitutions | Deletions | Insertions | Ref. Words |
| -------------------------------------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | 18            | 17        | 17         | 1651       |
| <code>cloudflare-@cf_openai_whisper</code>                                 | 57            | 57        | 15         | 1651       |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 29            | 19        | 15         | 1649       |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 150           | 77        | 31         | 1650       |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 15            | 21        | 1          | 1651       |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 15            | 13        | 3          | 1651       |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 47            | 39        | 4          | 1651       |
| <code>deepinfra-openai_whisper-large-v3</code>                             | 18            | 33        | 12         | 1651       |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 20            | 82        | 18         | 1651       |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 21            | 18        | 8          | 1651       |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 15            | 15        | 9          | 1650       |
| <code>openai-stt-gpt-transcribe</code>                                     | 11            | 15        | 8          | 1650       |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 18            | 9         | 17         | 1651       |
| <code>together-openai_whisper-large-v3</code>                              | 15            | 27        | 3          | 1651       |

## Error Attribution (Speaker-aware)

| Provider                                                                   | Strict Edits | Disfluency | Orthographic | Number/Format | Neutral Edits | Speaker Attribution | Residual Number/Format | Other Lexical |
| -------------------------------------------------------------------------- | -----------: | ---------: | -----------: | ------------: | ------------: | ------------------: | ---------------------: | ------------: |
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | 98           | 14         | 18           | 0             | 66            | 17                  | 0                      | 49            |
| <code>cloudflare-@cf_openai_whisper</code>                                 | 181          | 20         | 18           | 0             | 143           | 17                  | 0                      | 126           |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 125          | 22         | 24           | 0             | 79            | 17                  | 0                      | 62            |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 306          | 12         | 19           | 0             | 275           | 17                  | 3                      | 255           |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 99           | 25         | 20           | 0             | 54            | 17                  | 0                      | 37            |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 89           | 22         | 19           | 0             | 48            | 17                  | 0                      | 31            |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 148          | 21         | 20           | 0             | 107           | 17                  | 0                      | 90            |
| <code>deepinfra-openai_whisper-large-v3</code>                             | 129          | 27         | 24           | 0             | 78            | 17                  | 0                      | 61            |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 175          | 22         | 21           | 0             | 132           | 17                  | 0                      | 115           |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 96           | 14         | 18           | 0             | 64            | 17                  | 0                      | 47            |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 87           | 15         | 17           | 0             | 55            | 17                  | 0                      | 38            |
| <code>openai-stt-gpt-transcribe</code>                                     | 94           | 25         | 19           | 0             | 50            | 17                  | 0                      | 33            |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 89           | 13         | 16           | 0             | 60            | 17                  | 0                      | 43            |
| <code>together-openai_whisper-large-v3</code>                              | 113          | 26         | 25           | 0             | 62            | 17                  | 0                      | 45            |

## Speaker Metrics

| Provider                                                                   | Ref. Speakers | Provider Speakers | Count Error | Word Attribution Accuracy | Legacy Score / 100 | Legacy Speaker-aware WER |
| -------------------------------------------------------------------------- | ------------: | ----------------: | ----------: | ------------------------: | -----------------: | -----------------------: |
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | 6             | 0                 | n/a         | n/a                       | 94.22              | 5.78%                    |
| <code>cloudflare-@cf_openai_whisper</code>                                 | 6             | 0                 | n/a         | n/a                       | 89.32              | 10.68%                   |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 6             | 0                 | n/a         | n/a                       | 92.63              | 7.37%                    |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 6             | 0                 | n/a         | n/a                       | 81.95              | 18.05%                   |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 6             | 0                 | n/a         | n/a                       | 94.16              | 5.84%                    |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 6             | 0                 | n/a         | n/a                       | 94.75              | 5.25%                    |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 6             | 0                 | n/a         | n/a                       | 91.27              | 8.73%                    |
| <code>deepinfra-openai_whisper-large-v3</code>                             | 6             | 0                 | n/a         | n/a                       | 92.39              | 7.61%                    |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 6             | 0                 | n/a         | n/a                       | 89.68              | 10.32%                   |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 6             | 0                 | n/a         | n/a                       | 94.34              | 5.66%                    |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 6             | 0                 | n/a         | n/a                       | 94.87              | 5.13%                    |
| <code>openai-stt-gpt-transcribe</code>                                     | 6             | 0                 | n/a         | n/a                       | 94.45              | 5.55%                    |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 6             | 0                 | n/a         | n/a                       | 94.75              | 5.25%                    |
| <code>together-openai_whisper-large-v3</code>                              | 6             | 0                 | n/a         | n/a                       | 93.33              | 6.67%                    |

## Quality Flags

| Provider                                                | Quality Flags                                                                                  |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>   | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |
| <code>openai-stt-gpt-transcribe</code>                  | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `deepinfra-mistralai_Voxtral-Small-24B-2507` was the most accurate provider on neutral speaker-aware WER (scoring version 2.1), scoring 97.12/100.
- `together-nvidia_parakeet-tdt-0.6b-v3` was the fastest provider in this set at 1.29s.
- `deepinfra-mistralai_Voxtral-Small-24B-2507` lost the most ground once speaker changes were counted, with 1.00 percentage-point gap between text-only and speaker-aware WER.
