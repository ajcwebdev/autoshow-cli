# Consensus Transcript Comparison Report

## Summary

- Run directory: `docs/benchmarks/stt/without-speakers/2022-09-30-widgets-fsjam-40-minutes`
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
| 1    | <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | $0.0003 | 87.01       | 12.99%            | 12.35%        | not-supported | 189.62s         | 12.78× realtime  | $0.0003     |
| 2    | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | $0.0081 | 94.51       | 5.49%             | 4.76%         | not-supported | 107.45s         | 22.55× realtime  | $0.0081     |
| 3    | <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | $0.0081 | 87.93       | 12.07%            | 11.37%        | not-supported | 10.69s          | 226.58× realtime | $0.0081     |
| 4    | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | $0.0081 | 96.11       | 3.89%             | 3.11%         | not-supported | 31.06s          | 78.01× realtime  | $0.0081     |
| 5    | <code>deepinfra-openai_whisper-large-v3</code>                             | $0.0182 | 88.52       | 11.48%            | 10.78%        | not-supported | 18.81s          | 128.81× realtime | $0.0182     |
| 6    | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | $0.0182 | 96.78       | 3.22%             | 2.46%         | not-supported | 21.52s          | 112.59× realtime | $0.0182     |
| 7    | <code>cloudflare-@cf_openai_whisper</code>                                 | $0.0183 | 87.12       | 12.88%            | 12.19%        | not-supported | 267.51s         | 9.06× realtime   | $0.0183     |
| 8    | <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | $0.0207 | 96.78       | 3.22%             | 2.46%         | not-supported | 162.23s         | 14.94× realtime  | $0.0207     |
| 9    | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | $0.0404 | 97.27       | 2.73%             | 1.95%         | not-supported | 64.46s          | 37.59× realtime  | $0.0404     |
| 10   | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | $0.0606 | 96.76       | 3.24%             | 2.48%         | not-supported | 3.39s           | 714.55× realtime | $0.0606     |
| 11   | <code>together-openai_whisper-large-v3</code>                              | $0.0606 | 95.37       | 4.63%             | 3.87%         | not-supported | 10.43s          | 232.40× realtime | $0.0606     |
| 12   | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | $0.1212 | 62.35       | 37.65%            | 37.15%        | not-supported | 295.39s         | 8.20× realtime   | $0.1212     |
| 13   | <code>openai-stt-gpt-transcribe</code>                                     | $0.1818 | 97.45       | 2.55%             | 1.76%         | not-supported | 59.92s          | 40.44× realtime  | $0.1818     |
| 14   | <code>cloudflare-@cf_deepgram_nova-3</code>                                | $0.2100 | 96.56       | 3.44%             | 2.69%         | not-supported | 9.02s           | 268.72× realtime | $0.2100     |

#### Speed

| Rank | Provider                                                                   | Value   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time | Throughput       | Actual Cost |
| ---: | -------------------------------------------------------------------------- | ------: | ----------: | ----------------: | ------------: | ------------- | --------------: | ---------------: | ----------: |
| 1    | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 3.39s   | 96.76       | 3.24%             | 2.48%         | not-supported | 3.39s           | 714.55× realtime | $0.0606     |
| 2    | <code>cloudflare-@cf_deepgram_nova-3</code>                                | 9.02s   | 96.56       | 3.44%             | 2.69%         | not-supported | 9.02s           | 268.72× realtime | $0.2100     |
| 3    | <code>together-openai_whisper-large-v3</code>                              | 10.43s  | 95.37       | 4.63%             | 3.87%         | not-supported | 10.43s          | 232.40× realtime | $0.0606     |
| 4    | <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 10.69s  | 87.93       | 12.07%            | 11.37%        | not-supported | 10.69s          | 226.58× realtime | $0.0081     |
| 5    | <code>deepinfra-openai_whisper-large-v3</code>                             | 18.81s  | 88.52       | 11.48%            | 10.78%        | not-supported | 18.81s          | 128.81× realtime | $0.0182     |
| 6    | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 21.52s  | 96.78       | 3.22%             | 2.46%         | not-supported | 21.52s          | 112.59× realtime | $0.0182     |
| 7    | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 31.06s  | 96.11       | 3.89%             | 3.11%         | not-supported | 31.06s          | 78.01× realtime  | $0.0081     |
| 8    | <code>openai-stt-gpt-transcribe</code>                                     | 59.92s  | 97.45       | 2.55%             | 1.76%         | not-supported | 59.92s          | 40.44× realtime  | $0.1818     |
| 9    | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 64.46s  | 97.27       | 2.73%             | 1.95%         | not-supported | 64.46s          | 37.59× realtime  | $0.0404     |
| 10   | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 107.45s | 94.51       | 5.49%             | 4.76%         | not-supported | 107.45s         | 22.55× realtime  | $0.0081     |
| 11   | <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 162.23s | 96.78       | 3.22%             | 2.46%         | not-supported | 162.23s         | 14.94× realtime  | $0.0207     |
| 12   | <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 189.62s | 87.01       | 12.99%            | 12.35%        | not-supported | 189.62s         | 12.78× realtime  | $0.0003     |
| 13   | <code>cloudflare-@cf_openai_whisper</code>                                 | 267.51s | 87.12       | 12.88%            | 12.19%        | not-supported | 267.51s         | 9.06× realtime   | $0.0183     |
| 14   | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 295.39s | 62.35       | 37.65%            | 37.15%        | not-supported | 295.39s         | 8.20× realtime   | $0.1212     |

#### Quality Score

| Rank | Provider                                                                   | Value                   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time | Throughput       | Actual Cost |
| ---: | -------------------------------------------------------------------------- | ----------------------: | ----------: | ----------------: | ------------: | ------------- | --------------: | ---------------: | ----------: |
| 1    | <code>openai-stt-gpt-transcribe</code>                                     | 97.45/100 quality score | 97.45       | 2.55%             | 1.76%         | not-supported | 59.92s          | 40.44× realtime  | $0.1818     |
| 2    | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 97.27/100 quality score | 97.27       | 2.73%             | 1.95%         | not-supported | 64.46s          | 37.59× realtime  | $0.0404     |
| 3    | <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 96.78/100 quality score | 96.78       | 3.22%             | 2.46%         | not-supported | 162.23s         | 14.94× realtime  | $0.0207     |
| 4    | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 96.78/100 quality score | 96.78       | 3.22%             | 2.46%         | not-supported | 21.52s          | 112.59× realtime | $0.0182     |
| 5    | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 96.76/100 quality score | 96.76       | 3.24%             | 2.48%         | not-supported | 3.39s           | 714.55× realtime | $0.0606     |
| 6    | <code>cloudflare-@cf_deepgram_nova-3</code>                                | 96.56/100 quality score | 96.56       | 3.44%             | 2.69%         | not-supported | 9.02s           | 268.72× realtime | $0.2100     |
| 7    | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 96.11/100 quality score | 96.11       | 3.89%             | 3.11%         | not-supported | 31.06s          | 78.01× realtime  | $0.0081     |
| 8    | <code>together-openai_whisper-large-v3</code>                              | 95.37/100 quality score | 95.37       | 4.63%             | 3.87%         | not-supported | 10.43s          | 232.40× realtime | $0.0606     |
| 9    | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 94.51/100 quality score | 94.51       | 5.49%             | 4.76%         | not-supported | 107.45s         | 22.55× realtime  | $0.0081     |
| 10   | <code>deepinfra-openai_whisper-large-v3</code>                             | 88.52/100 quality score | 88.52       | 11.48%            | 10.78%        | not-supported | 18.81s          | 128.81× realtime | $0.0182     |
| 11   | <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 87.93/100 quality score | 87.93       | 12.07%            | 11.37%        | not-supported | 10.69s          | 226.58× realtime | $0.0081     |
| 12   | <code>cloudflare-@cf_openai_whisper</code>                                 | 87.12/100 quality score | 87.12       | 12.88%            | 12.19%        | not-supported | 267.51s         | 9.06× realtime   | $0.0183     |
| 13   | <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 87.01/100 quality score | 87.01       | 12.99%            | 12.35%        | not-supported | 189.62s         | 12.78× realtime  | $0.0003     |
| 14   | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 62.35/100 quality score | 62.35       | 37.65%            | 37.15%        | not-supported | 295.39s         | 8.20× realtime   | $0.1212     |

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
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | Third-Party Service Non-Diarization | not-supported | 96.56       | 3.44%             | 2.69%         | 9.02s           | 268.72× realtime | $0.2100     |
| <code>cloudflare-@cf_openai_whisper</code>                                 | Third-Party Service Non-Diarization | not-supported | 87.12       | 12.88%            | 12.19%        | 267.51s         | 9.06× realtime   | $0.0183     |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | Third-Party Service Non-Diarization | not-supported | 96.78       | 3.22%             | 2.46%         | 162.23s         | 14.94× realtime  | $0.0207     |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | Third-Party Service Non-Diarization | not-supported | 87.01       | 12.99%            | 12.35%        | 189.62s         | 12.78× realtime  | $0.0003     |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | Third-Party Service Non-Diarization | not-supported | 97.27       | 2.73%             | 1.95%         | 64.46s          | 37.59× realtime  | $0.0404     |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | Third-Party Service Non-Diarization | not-supported | 62.35       | 37.65%            | 37.15%        | 295.39s         | 8.20× realtime   | $0.1212     |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | Third-Party Service Non-Diarization | not-supported | 94.51       | 5.49%             | 4.76%         | 107.45s         | 22.55× realtime  | $0.0081     |
| <code>deepinfra-openai_whisper-large-v3</code>                             | Third-Party Service Non-Diarization | not-supported | 88.52       | 11.48%            | 10.78%        | 18.81s          | 128.81× realtime | $0.0182     |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | Third-Party Service Non-Diarization | not-supported | 87.93       | 12.07%            | 11.37%        | 10.69s          | 226.58× realtime | $0.0081     |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | Third-Party Service Non-Diarization | not-supported | 96.11       | 3.89%             | 3.11%         | 31.06s          | 78.01× realtime  | $0.0081     |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | Third-Party Service Non-Diarization | not-supported | 96.78       | 3.22%             | 2.46%         | 21.52s          | 112.59× realtime | $0.0182     |
| <code>openai-stt-gpt-transcribe</code>                                     | Third-Party Service Non-Diarization | not-supported | 97.45       | 2.55%             | 1.76%         | 59.92s          | 40.44× realtime  | $0.1818     |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | Third-Party Service Non-Diarization | not-supported | 96.76       | 3.24%             | 2.48%         | 3.39s           | 714.55× realtime | $0.0606     |
| <code>together-openai_whisper-large-v3</code>                              | Third-Party Service Non-Diarization | not-supported | 95.37       | 4.63%             | 3.87%         | 10.43s          | 232.40× realtime | $0.0606     |

## Error Breakdown (Speaker-aware)

| Provider                                                                   | Substitutions | Deletions | Insertions | Ref. Words |
| -------------------------------------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | 102           | 129       | 50         | 8158       |
| <code>cloudflare-@cf_openai_whisper</code>                                 | 240           | 307       | 504        | 8163       |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 97            | 114       | 52         | 8163       |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 636           | 291       | 133        | 8160       |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 90            | 93        | 40         | 8157       |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 77            | 91        | 2905       | 8162       |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 215           | 177       | 56         | 8160       |
| <code>deepinfra-openai_whisper-large-v3</code>                             | 73            | 825       | 39         | 8163       |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 86            | 856       | 43         | 8163       |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 147           | 130       | 40         | 8158       |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 100           | 123       | 40         | 8160       |
| <code>openai-stt-gpt-transcribe</code>                                     | 74            | 98        | 36         | 8156       |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 118           | 87        | 59         | 8157       |
| <code>together-openai_whisper-large-v3</code>                              | 88            | 248       | 42         | 8160       |

## Error Breakdown (Text-only)

| Provider                                                                   | Substitutions | Deletions | Insertions | Ref. Words |
| -------------------------------------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | 98            | 67        | 53         | 8092       |
| <code>cloudflare-@cf_openai_whisper</code>                                 | 233           | 246       | 508        | 8097       |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 90            | 53        | 56         | 8097       |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 627           | 233       | 140        | 8094       |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 80            | 33        | 45         | 8091       |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 67            | 31        | 2910       | 8096       |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 211           | 115       | 59         | 8094       |
| <code>deepinfra-openai_whisper-large-v3</code>                             | 70            | 762       | 41         | 8097       |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 81            | 794       | 46         | 8097       |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 145           | 66        | 41         | 8092       |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 99            | 59        | 41         | 8094       |
| <code>openai-stt-gpt-transcribe</code>                                     | 71            | 34        | 37         | 8090       |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 112           | 26        | 63         | 8091       |
| <code>together-openai_whisper-large-v3</code>                              | 84            | 185       | 44         | 8094       |

## Error Attribution (Speaker-aware)

| Provider                                                                   | Strict Edits | Disfluency | Orthographic | Number/Format | Neutral Edits | Speaker Attribution | Residual Number/Format | Other Lexical |
| -------------------------------------------------------------------------- | -----------: | ---------: | -----------: | ------------: | ------------: | ------------------: | ---------------------: | ------------: |
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | 361          | 10         | 63           | 7             | 281           | 65                  | 5                      | 211           |
| <code>cloudflare-@cf_openai_whisper</code>                                 | 1148         | 49         | 43           | 5             | 1051          | 65                  | 8                      | 978           |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 535          | 224        | 39           | 9             | 263           | 65                  | 3                      | 195           |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 1151         | 24         | 58           | 9             | 1060          | 65                  | 11                     | 984           |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 280          | 11         | 40           | 6             | 223           | 66                  | 1                      | 156           |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 3123         | 13         | 31           | 6             | 3073          | 66                  | 1                      | 3006          |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 535          | 13         | 47           | 27            | 448           | 65                  | 9                      | 374           |
| <code>deepinfra-openai_whisper-large-v3</code>                             | 992          | 14         | 33           | 8             | 937           | 65                  | 3                      | 869           |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 1047         | 14         | 43           | 5             | 985           | 65                  | 3                      | 917           |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 398          | 10         | 53           | 18            | 317           | 65                  | 5                      | 247           |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 332          | 9          | 46           | 14            | 263           | 65                  | 5                      | 193           |
| <code>openai-stt-gpt-transcribe</code>                                     | 267          | 16         | 35           | 8             | 208           | 66                  | 1                      | 141           |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 354          | 13         | 57           | 20            | 264           | 65                  | 4                      | 195           |
| <code>together-openai_whisper-large-v3</code>                              | 438          | 14         | 39           | 7             | 378           | 65                  | 1                      | 312           |

## Speaker Metrics

| Provider                                                                   | Ref. Speakers | Provider Speakers | Count Error | Word Attribution Accuracy | Legacy Score / 100 | Legacy Speaker-aware WER |
| -------------------------------------------------------------------------- | ------------: | ----------------: | ----------: | ------------------------: | -----------------: | -----------------------: |
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | 2             | 0                 | n/a         | n/a                       | 95.61              | 4.39%                    |
| <code>cloudflare-@cf_openai_whisper</code>                                 | 2             | 0                 | n/a         | n/a                       | 86.04              | 13.96%                   |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 2             | 0                 | n/a         | n/a                       | 93.50              | 6.50%                    |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 2             | 0                 | n/a         | n/a                       | 86.01              | 13.99%                   |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 2             | 0                 | n/a         | n/a                       | 96.60              | 3.40%                    |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 2             | 0                 | n/a         | n/a                       | 62.04              | 37.96%                   |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 2             | 0                 | n/a         | n/a                       | 93.50              | 6.50%                    |
| <code>deepinfra-openai_whisper-large-v3</code>                             | 2             | 0                 | n/a         | n/a                       | 87.94              | 12.06%                   |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 2             | 0                 | n/a         | n/a                       | 87.27              | 12.73%                   |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 2             | 0                 | n/a         | n/a                       | 95.16              | 4.84%                    |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 2             | 0                 | n/a         | n/a                       | 95.96              | 4.04%                    |
| <code>openai-stt-gpt-transcribe</code>                                     | 2             | 0                 | n/a         | n/a                       | 96.75              | 3.25%                    |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 2             | 0                 | n/a         | n/a                       | 95.70              | 4.30%                    |
| <code>together-openai_whisper-large-v3</code>                              | 2             | 0                 | n/a         | n/a                       | 94.68              | 5.32%                    |

## Quality Flags

| Provider                                                | Quality Flags                                                                                  |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>   | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |
| <code>openai-stt-gpt-transcribe</code>                  | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `openai-stt-gpt-transcribe` was the most accurate provider on neutral speaker-aware WER (scoring version 2.1), scoring 97.45/100.
- `together-nvidia_parakeet-tdt-0.6b-v3` was the fastest provider in this set at 3.39s.
- `openai-stt-gpt-transcribe` lost the most ground once speaker changes were counted, with 0.80 percentage-point gap between text-only and speaker-aware WER.
