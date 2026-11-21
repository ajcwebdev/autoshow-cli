# Consensus Transcript Comparison Report

## Summary

- Run directory: `docs/benchmarks/stt/without-speakers/2023-03-15-jsjam-qwik-misko-hevery`
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
| 1    | <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | $0.0008 | 79.04       | 20.96%            | 20.57%        | not-supported | 458.52s         | 14.77× realtime  | $0.0008     |
| 2    | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | $0.0226 | 91.88       | 8.12%             | 7.63%         | not-supported | 453.52s         | 14.93× realtime  | $0.0226     |
| 3    | <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | $0.0226 | 91.01       | 8.99%             | 8.58%         | not-supported | 35.84s          | 188.92× realtime | $0.0226     |
| 4    | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | $0.0226 | 93.07       | 6.93%             | 6.46%         | not-supported | 190.74s         | 35.50× realtime  | $0.0226     |
| 5    | <code>deepinfra-openai_whisper-large-v3</code>                             | $0.0508 | 90.75       | 9.25%             | 8.85%         | not-supported | 72.69s          | 93.17× realtime  | $0.0508     |
| 6    | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | $0.0508 | 93.40       | 6.60%             | 6.14%         | not-supported | 179.44s         | 37.74× realtime  | $0.0508     |
| 7    | <code>cloudflare-@cf_openai_whisper</code>                                 | $0.0511 | 87.13       | 12.87%            | 12.45%        | not-supported | 1027.05s        | 6.59× realtime   | $0.0511     |
| 8    | <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | $0.0579 | 93.71       | 6.29%             | 5.81%         | not-supported | 544.92s         | 12.43× realtime  | $0.0579     |
| 9    | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | $0.1129 | 94.53       | 5.47%             | 4.98%         | not-supported | 234.09s         | 28.93× realtime  | $0.1129     |
| 10   | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | $0.1693 | 92.25       | 7.75%             | 7.30%         | not-supported | 51.46s          | 131.61× realtime | $0.1693     |
| 11   | <code>together-openai_whisper-large-v3</code>                              | $0.1693 | 93.54       | 6.46%             | 5.98%         | not-supported | 27.59s          | 245.47× realtime | $0.1693     |
| 12   | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | $0.3386 | 61.05       | 38.95%            | 38.65%        | not-supported | 794.34s         | 8.53× realtime   | $0.3386     |
| 13   | <code>openai-stt-gpt-transcribe</code>                                     | $0.5079 | 94.38       | 5.62%             | 5.15%         | not-supported | 146.93s         | 46.09× realtime  | $0.5079     |
| 14   | <code>cloudflare-@cf_deepgram_nova-3</code>                                | $0.5869 | 92.90       | 7.10%             | 6.64%         | not-supported | 24.60s          | 275.30× realtime | $0.5869     |

#### Speed

| Rank | Provider                                                                   | Value    | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time | Throughput       | Actual Cost |
| ---: | -------------------------------------------------------------------------- | -------: | ----------: | ----------------: | ------------: | ------------- | --------------: | ---------------: | ----------: |
| 1    | <code>cloudflare-@cf_deepgram_nova-3</code>                                | 24.60s   | 92.90       | 7.10%             | 6.64%         | not-supported | 24.60s          | 275.30× realtime | $0.5869     |
| 2    | <code>together-openai_whisper-large-v3</code>                              | 27.59s   | 93.54       | 6.46%             | 5.98%         | not-supported | 27.59s          | 245.47× realtime | $0.1693     |
| 3    | <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 35.84s   | 91.01       | 8.99%             | 8.58%         | not-supported | 35.84s          | 188.92× realtime | $0.0226     |
| 4    | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 51.46s   | 92.25       | 7.75%             | 7.30%         | not-supported | 51.46s          | 131.61× realtime | $0.1693     |
| 5    | <code>deepinfra-openai_whisper-large-v3</code>                             | 72.69s   | 90.75       | 9.25%             | 8.85%         | not-supported | 72.69s          | 93.17× realtime  | $0.0508     |
| 6    | <code>openai-stt-gpt-transcribe</code>                                     | 146.93s  | 94.38       | 5.62%             | 5.15%         | not-supported | 146.93s         | 46.09× realtime  | $0.5079     |
| 7    | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 179.44s  | 93.40       | 6.60%             | 6.14%         | not-supported | 179.44s         | 37.74× realtime  | $0.0508     |
| 8    | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 190.74s  | 93.07       | 6.93%             | 6.46%         | not-supported | 190.74s         | 35.50× realtime  | $0.0226     |
| 9    | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 234.09s  | 94.53       | 5.47%             | 4.98%         | not-supported | 234.09s         | 28.93× realtime  | $0.1129     |
| 10   | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 453.52s  | 91.88       | 8.12%             | 7.63%         | not-supported | 453.52s         | 14.93× realtime  | $0.0226     |
| 11   | <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 458.52s  | 79.04       | 20.96%            | 20.57%        | not-supported | 458.52s         | 14.77× realtime  | $0.0008     |
| 12   | <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 544.92s  | 93.71       | 6.29%             | 5.81%         | not-supported | 544.92s         | 12.43× realtime  | $0.0579     |
| 13   | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 794.34s  | 61.05       | 38.95%            | 38.65%        | not-supported | 794.34s         | 8.53× realtime   | $0.3386     |
| 14   | <code>cloudflare-@cf_openai_whisper</code>                                 | 1027.05s | 87.13       | 12.87%            | 12.45%        | not-supported | 1027.05s        | 6.59× realtime   | $0.0511     |

#### Quality Score

| Rank | Provider                                                                   | Value                   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time | Throughput       | Actual Cost |
| ---: | -------------------------------------------------------------------------- | ----------------------: | ----------: | ----------------: | ------------: | ------------- | --------------: | ---------------: | ----------: |
| 1    | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 94.53/100 quality score | 94.53       | 5.47%             | 4.98%         | not-supported | 234.09s         | 28.93× realtime  | $0.1129     |
| 2    | <code>openai-stt-gpt-transcribe</code>                                     | 94.38/100 quality score | 94.38       | 5.62%             | 5.15%         | not-supported | 146.93s         | 46.09× realtime  | $0.5079     |
| 3    | <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 93.71/100 quality score | 93.71       | 6.29%             | 5.81%         | not-supported | 544.92s         | 12.43× realtime  | $0.0579     |
| 4    | <code>together-openai_whisper-large-v3</code>                              | 93.54/100 quality score | 93.54       | 6.46%             | 5.98%         | not-supported | 27.59s          | 245.47× realtime | $0.1693     |
| 5    | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 93.40/100 quality score | 93.40       | 6.60%             | 6.14%         | not-supported | 179.44s         | 37.74× realtime  | $0.0508     |
| 6    | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 93.07/100 quality score | 93.07       | 6.93%             | 6.46%         | not-supported | 190.74s         | 35.50× realtime  | $0.0226     |
| 7    | <code>cloudflare-@cf_deepgram_nova-3</code>                                | 92.90/100 quality score | 92.90       | 7.10%             | 6.64%         | not-supported | 24.60s          | 275.30× realtime | $0.5869     |
| 8    | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 92.25/100 quality score | 92.25       | 7.75%             | 7.30%         | not-supported | 51.46s          | 131.61× realtime | $0.1693     |
| 9    | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 91.88/100 quality score | 91.88       | 8.12%             | 7.63%         | not-supported | 453.52s         | 14.93× realtime  | $0.0226     |
| 10   | <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 91.01/100 quality score | 91.01       | 8.99%             | 8.58%         | not-supported | 35.84s          | 188.92× realtime | $0.0226     |
| 11   | <code>deepinfra-openai_whisper-large-v3</code>                             | 90.75/100 quality score | 90.75       | 9.25%             | 8.85%         | not-supported | 72.69s          | 93.17× realtime  | $0.0508     |
| 12   | <code>cloudflare-@cf_openai_whisper</code>                                 | 87.13/100 quality score | 87.13       | 12.87%            | 12.45%        | not-supported | 1027.05s        | 6.59× realtime   | $0.0511     |
| 13   | <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 79.04/100 quality score | 79.04       | 20.96%            | 20.57%        | not-supported | 458.52s         | 14.77× realtime  | $0.0008     |
| 14   | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 61.05/100 quality score | 61.05       | 38.95%            | 38.65%        | not-supported | 794.34s         | 8.53× realtime   | $0.3386     |

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
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | Third-Party Service Non-Diarization | not-supported | 92.90       | 7.10%             | 6.64%         | 24.60s          | 275.30× realtime | $0.5869     |
| <code>cloudflare-@cf_openai_whisper</code>                                 | Third-Party Service Non-Diarization | not-supported | 87.13       | 12.87%            | 12.45%        | 1027.05s        | 6.59× realtime   | $0.0511     |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | Third-Party Service Non-Diarization | not-supported | 93.71       | 6.29%             | 5.81%         | 544.92s         | 12.43× realtime  | $0.0579     |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | Third-Party Service Non-Diarization | not-supported | 79.04       | 20.96%            | 20.57%        | 458.52s         | 14.77× realtime  | $0.0008     |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | Third-Party Service Non-Diarization | not-supported | 94.53       | 5.47%             | 4.98%         | 234.09s         | 28.93× realtime  | $0.1129     |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | Third-Party Service Non-Diarization | not-supported | 61.05       | 38.95%            | 38.65%        | 794.34s         | 8.53× realtime   | $0.3386     |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | Third-Party Service Non-Diarization | not-supported | 91.88       | 8.12%             | 7.63%         | 453.52s         | 14.93× realtime  | $0.0226     |
| <code>deepinfra-openai_whisper-large-v3</code>                             | Third-Party Service Non-Diarization | not-supported | 90.75       | 9.25%             | 8.85%         | 72.69s          | 93.17× realtime  | $0.0508     |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | Third-Party Service Non-Diarization | not-supported | 91.01       | 8.99%             | 8.58%         | 35.84s          | 188.92× realtime | $0.0226     |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | Third-Party Service Non-Diarization | not-supported | 93.07       | 6.93%             | 6.46%         | 190.74s         | 35.50× realtime  | $0.0226     |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | Third-Party Service Non-Diarization | not-supported | 93.40       | 6.60%             | 6.14%         | 179.44s         | 37.74× realtime  | $0.0508     |
| <code>openai-stt-gpt-transcribe</code>                                     | Third-Party Service Non-Diarization | not-supported | 94.38       | 5.62%             | 5.15%         | 146.93s         | 46.09× realtime  | $0.5079     |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | Third-Party Service Non-Diarization | not-supported | 92.25       | 7.75%             | 7.30%         | 51.46s          | 131.61× realtime | $0.1693     |
| <code>together-openai_whisper-large-v3</code>                              | Third-Party Service Non-Diarization | not-supported | 93.54       | 6.46%             | 5.98%         | 27.59s          | 245.47× realtime | $0.1693     |

## Error Breakdown (Speaker-aware)

| Provider                                                                   | Substitutions | Deletions | Insertions | Ref. Words |
| -------------------------------------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | 446           | 274       | 669        | 19576      |
| <code>cloudflare-@cf_openai_whisper</code>                                 | 986           | 880       | 654        | 19583      |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 405           | 312       | 514        | 19573      |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 2222          | 1284      | 598        | 19581      |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 380           | 270       | 421        | 19576      |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 363           | 261       | 7002       | 19578      |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 648           | 594       | 347        | 19568      |
| <code>deepinfra-openai_whisper-large-v3</code>                             | 404           | 938       | 469        | 19578      |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 454           | 921       | 384        | 19567      |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 521           | 252       | 583        | 19572      |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 441           | 269       | 582        | 19569      |
| <code>openai-stt-gpt-transcribe</code>                                     | 402           | 273       | 425        | 19561      |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 490           | 268       | 759        | 19569      |
| <code>together-openai_whisper-large-v3</code>                              | 398           | 574       | 293        | 19571      |

## Error Breakdown (Text-only)

| Provider                                                                   | Substitutions | Deletions | Insertions | Ref. Words |
| -------------------------------------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | 423           | 185       | 684        | 19471      |
| <code>cloudflare-@cf_openai_whisper</code>                                 | 963           | 792       | 670        | 19478      |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 390           | 218       | 524        | 19468      |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 2204          | 1192      | 610        | 19476      |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 369           | 173       | 428        | 19471      |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 355           | 163       | 7008       | 19473      |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 637           | 496       | 353        | 19463      |
| <code>deepinfra-openai_whisper-large-v3</code>                             | 379           | 855       | 490        | 19473      |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 428           | 837       | 404        | 19462      |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 503           | 160       | 595        | 19467      |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 426           | 176       | 593        | 19464      |
| <code>openai-stt-gpt-transcribe</code>                                     | 388           | 179       | 435        | 19456      |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 461           | 182       | 777        | 19464      |
| <code>together-openai_whisper-large-v3</code>                              | 389           | 476       | 299        | 19466      |

## Error Attribution (Speaker-aware)

| Provider                                                                   | Strict Edits | Disfluency | Orthographic | Number/Format | Neutral Edits | Speaker Attribution | Residual Number/Format | Other Lexical |
| -------------------------------------------------------------------------- | -----------: | ---------: | -----------: | ------------: | ------------: | ------------------: | ---------------------: | ------------: |
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | 2208         | 372        | 442          | 5             | 1389          | 105                 | 18                     | 1266          |
| <code>cloudflare-@cf_openai_whisper</code>                                 | 3581         | 975        | 81           | 5             | 2520          | 106                 | 13                     | 2401          |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 1379         | 92         | 56           | 0             | 1231          | 106                 | 3                      | 1122          |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 4317         | 113        | 94           | 6             | 4104          | 106                 | 39                     | 3959          |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 1206         | 49         | 86           | 0             | 1071          | 105                 | 2                      | 964           |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 7869         | 80         | 163          | 0             | 7626          | 105                 | 5                      | 7516          |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 1823         | 75         | 103          | 56            | 1589          | 106                 | 11                     | 1472          |
| <code>deepinfra-openai_whisper-large-v3</code>                             | 1988         | 104        | 72           | 1             | 1811          | 106                 | 3                      | 1702          |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 1928         | 87         | 79           | 3             | 1759          | 105                 | 7                      | 1647          |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 1710         | 234        | 96           | 24            | 1356          | 105                 | 18                     | 1233          |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 1724         | 307        | 98           | 27            | 1292          | 105                 | 15                     | 1172          |
| <code>openai-stt-gpt-transcribe</code>                                     | 1221         | 56         | 60           | 5             | 1100          | 105                 | 7                      | 988           |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 2096         | 382        | 171          | 26            | 1517          | 105                 | 15                     | 1397          |
| <code>together-openai_whisper-large-v3</code>                              | 1391         | 56         | 69           | 1             | 1265          | 106                 | 2                      | 1157          |

## Speaker Metrics

| Provider                                                                   | Ref. Speakers | Provider Speakers | Count Error | Word Attribution Accuracy | Legacy Score / 100 | Legacy Speaker-aware WER |
| -------------------------------------------------------------------------- | ------------: | ----------------: | ----------: | ------------------------: | -----------------: | -----------------------: |
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | 12            | 0                 | n/a         | n/a                       | 88.88              | 11.12%                   |
| <code>cloudflare-@cf_openai_whisper</code>                                 | 12            | 0                 | n/a         | n/a                       | 81.96              | 18.04%                   |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 12            | 0                 | n/a         | n/a                       | 93.05              | 6.95%                    |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 12            | 0                 | n/a         | n/a                       | 78.26              | 21.74%                   |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 12            | 0                 | n/a         | n/a                       | 93.93              | 6.07%                    |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 12            | 0                 | n/a         | n/a                       | 60.36              | 39.64%                   |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 12            | 0                 | n/a         | n/a                       | 90.82              | 9.18%                    |
| <code>deepinfra-openai_whisper-large-v3</code>                             | 12            | 0                 | n/a         | n/a                       | 89.99              | 10.01%                   |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 12            | 0                 | n/a         | n/a                       | 90.29              | 9.71%                    |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 12            | 0                 | n/a         | n/a                       | 91.39              | 8.61%                    |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 12            | 0                 | n/a         | n/a                       | 91.32              | 8.68%                    |
| <code>openai-stt-gpt-transcribe</code>                                     | 12            | 0                 | n/a         | n/a                       | 93.85              | 6.15%                    |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 12            | 0                 | n/a         | n/a                       | 89.44              | 10.56%                   |
| <code>together-openai_whisper-large-v3</code>                              | 12            | 0                 | n/a         | n/a                       | 92.99              | 7.01%                    |

## Quality Flags

| Provider                                                | Quality Flags                                                                                  |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>   | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |
| <code>openai-stt-gpt-transcribe</code>                  | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `deepinfra-mistralai_Voxtral-Mini-3B-2507` was the most accurate provider on neutral speaker-aware WER (scoring version 2.1), scoring 94.53/100.
- `cloudflare-@cf_deepgram_nova-3` was the fastest provider in this set at 24.60s.
- `deepinfra-mistralai_Voxtral-Mini-3B-2507` lost the most ground once speaker changes were counted, with 0.49 percentage-point gap between text-only and speaker-aware WER.
