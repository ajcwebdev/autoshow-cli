# Consensus Transcript Comparison Report

## Summary

- Run directory: `docs/benchmarks/stt/without-speakers/1-audio`
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

| Rank | Provider                                                                   | Value   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time | Throughput      | Actual Cost |
| ---: | -------------------------------------------------------------------------- | ------: | ----------: | ----------------: | ------------: | ------------- | --------------: | --------------: | ----------: |
| 1    | <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | $0.0000 | 84.11       | 15.89%            | 14.29%        | not-supported | 2.65s           | 22.47× realtime | $0.0000     |
| 2    | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | $0.0002 | 95.79       | 4.21%             | 2.38%         | not-supported | 13.60s          | 4.38× realtime  | $0.0002     |
| 3    | <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | $0.0002 | 88.79       | 11.21%            | 9.52%         | not-supported | 1.50s           | 39.86× realtime | $0.0002     |
| 4    | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | $0.0002 | 97.20       | 2.80%             | 0.95%         | not-supported | 1.81s           | 32.88× realtime | $0.0002     |
| 5    | <code>deepinfra-openai_whisper-large-v3</code>                             | $0.0004 | 89.72       | 10.28%            | 8.57%         | not-supported | 1.43s           | 41.55× realtime | $0.0004     |
| 6    | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | $0.0004 | 97.20       | 2.80%             | 0.95%         | not-supported | 1.19s           | 50.03× realtime | $0.0004     |
| 7    | <code>cloudflare-@cf_openai_whisper</code>                                 | $0.0004 | 94.39       | 5.61%             | 3.81%         | not-supported | 7.46s           | 7.99× realtime  | $0.0004     |
| 8    | <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | $0.0005 | 97.20       | 2.80%             | 0.95%         | not-supported | 8.52s           | 7.00× realtime  | $0.0005     |
| 9    | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | $0.0010 | 97.66       | 2.34%             | 0.48%         | not-supported | 2.50s           | 23.82× realtime | $0.0010     |
| 10   | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | $0.0015 | 97.20       | 2.80%             | 0.95%         | not-supported | 0.72s           | 83.10× realtime | $0.0015     |
| 11   | <code>together-openai_whisper-large-v3</code>                              | $0.0015 | 97.66       | 2.34%             | 0.48%         | not-supported | 1.90s           | 31.31× realtime | $0.0015     |
| 12   | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | $0.0030 | 97.66       | 2.34%             | 0.48%         | not-supported | 5.77s           | 10.32× realtime | $0.0030     |
| 13   | <code>openai-stt-gpt-transcribe</code>                                     | $0.0045 | 97.20       | 2.80%             | 0.95%         | not-supported | 3.63s           | 16.41× realtime | $0.0045     |
| 14   | <code>cloudflare-@cf_deepgram_nova-3</code>                                | $0.0052 | 96.26       | 3.74%             | 1.90%         | not-supported | 0.98s           | 60.49× realtime | $0.0052     |

#### Speed

| Rank | Provider                                                                   | Value  | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time | Throughput      | Actual Cost |
| ---: | -------------------------------------------------------------------------- | -----: | ----------: | ----------------: | ------------: | ------------- | --------------: | --------------: | ----------: |
| 1    | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 0.72s  | 97.20       | 2.80%             | 0.95%         | not-supported | 0.72s           | 83.10× realtime | $0.0015     |
| 2    | <code>cloudflare-@cf_deepgram_nova-3</code>                                | 0.98s  | 96.26       | 3.74%             | 1.90%         | not-supported | 0.98s           | 60.49× realtime | $0.0052     |
| 3    | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 1.19s  | 97.20       | 2.80%             | 0.95%         | not-supported | 1.19s           | 50.03× realtime | $0.0004     |
| 4    | <code>deepinfra-openai_whisper-large-v3</code>                             | 1.43s  | 89.72       | 10.28%            | 8.57%         | not-supported | 1.43s           | 41.55× realtime | $0.0004     |
| 5    | <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 1.50s  | 88.79       | 11.21%            | 9.52%         | not-supported | 1.50s           | 39.86× realtime | $0.0002     |
| 6    | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 1.81s  | 97.20       | 2.80%             | 0.95%         | not-supported | 1.81s           | 32.88× realtime | $0.0002     |
| 7    | <code>together-openai_whisper-large-v3</code>                              | 1.90s  | 97.66       | 2.34%             | 0.48%         | not-supported | 1.90s           | 31.31× realtime | $0.0015     |
| 8    | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 2.50s  | 97.66       | 2.34%             | 0.48%         | not-supported | 2.50s           | 23.82× realtime | $0.0010     |
| 9    | <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 2.65s  | 84.11       | 15.89%            | 14.29%        | not-supported | 2.65s           | 22.47× realtime | $0.0000     |
| 10   | <code>openai-stt-gpt-transcribe</code>                                     | 3.63s  | 97.20       | 2.80%             | 0.95%         | not-supported | 3.63s           | 16.41× realtime | $0.0045     |
| 11   | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 5.77s  | 97.66       | 2.34%             | 0.48%         | not-supported | 5.77s           | 10.32× realtime | $0.0030     |
| 12   | <code>cloudflare-@cf_openai_whisper</code>                                 | 7.46s  | 94.39       | 5.61%             | 3.81%         | not-supported | 7.46s           | 7.99× realtime  | $0.0004     |
| 13   | <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 8.52s  | 97.20       | 2.80%             | 0.95%         | not-supported | 8.52s           | 7.00× realtime  | $0.0005     |
| 14   | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 13.60s | 95.79       | 4.21%             | 2.38%         | not-supported | 13.60s          | 4.38× realtime  | $0.0002     |

#### Quality Score

| Rank | Provider                                                                   | Value                   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time | Throughput      | Actual Cost |
| ---: | -------------------------------------------------------------------------- | ----------------------: | ----------: | ----------------: | ------------: | ------------- | --------------: | --------------: | ----------: |
| 1    | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 97.66/100 quality score | 97.66       | 2.34%             | 0.48%         | not-supported | 2.50s           | 23.82× realtime | $0.0010     |
| 2    | <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 97.66/100 quality score | 97.66       | 2.34%             | 0.48%         | not-supported | 5.77s           | 10.32× realtime | $0.0030     |
| 3    | <code>together-openai_whisper-large-v3</code>                              | 97.66/100 quality score | 97.66       | 2.34%             | 0.48%         | not-supported | 1.90s           | 31.31× realtime | $0.0015     |
| 4    | <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 97.20/100 quality score | 97.20       | 2.80%             | 0.95%         | not-supported | 8.52s           | 7.00× realtime  | $0.0005     |
| 5    | <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 97.20/100 quality score | 97.20       | 2.80%             | 0.95%         | not-supported | 1.81s           | 32.88× realtime | $0.0002     |
| 6    | <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 97.20/100 quality score | 97.20       | 2.80%             | 0.95%         | not-supported | 1.19s           | 50.03× realtime | $0.0004     |
| 7    | <code>openai-stt-gpt-transcribe</code>                                     | 97.20/100 quality score | 97.20       | 2.80%             | 0.95%         | not-supported | 3.63s           | 16.41× realtime | $0.0045     |
| 8    | <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 97.20/100 quality score | 97.20       | 2.80%             | 0.95%         | not-supported | 0.72s           | 83.10× realtime | $0.0015     |
| 9    | <code>cloudflare-@cf_deepgram_nova-3</code>                                | 96.26/100 quality score | 96.26       | 3.74%             | 1.90%         | not-supported | 0.98s           | 60.49× realtime | $0.0052     |
| 10   | <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 95.79/100 quality score | 95.79       | 4.21%             | 2.38%         | not-supported | 13.60s          | 4.38× realtime  | $0.0002     |
| 11   | <code>cloudflare-@cf_openai_whisper</code>                                 | 94.39/100 quality score | 94.39       | 5.61%             | 3.81%         | not-supported | 7.46s           | 7.99× realtime  | $0.0004     |
| 12   | <code>deepinfra-openai_whisper-large-v3</code>                             | 89.72/100 quality score | 89.72       | 10.28%            | 8.57%         | not-supported | 1.43s           | 41.55× realtime | $0.0004     |
| 13   | <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 88.79/100 quality score | 88.79       | 11.21%            | 9.52%         | not-supported | 1.50s           | 39.86× realtime | $0.0002     |
| 14   | <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 84.11/100 quality score | 84.11       | 15.89%            | 14.29%        | not-supported | 2.65s           | 22.47× realtime | $0.0000     |

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

| Provider                                                                   | Group                               | Diarization   | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Throughput      | Actual Cost |
| -------------------------------------------------------------------------- | ----------------------------------- | ------------- | ----------: | ----------------: | ------------: | --------------: | --------------: | ----------: |
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | Third-Party Service Non-Diarization | not-supported | 96.26       | 3.74%             | 1.90%         | 0.98s           | 60.49× realtime | $0.0052     |
| <code>cloudflare-@cf_openai_whisper</code>                                 | Third-Party Service Non-Diarization | not-supported | 94.39       | 5.61%             | 3.81%         | 7.46s           | 7.99× realtime  | $0.0004     |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | Third-Party Service Non-Diarization | not-supported | 97.20       | 2.80%             | 0.95%         | 8.52s           | 7.00× realtime  | $0.0005     |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | Third-Party Service Non-Diarization | not-supported | 84.11       | 15.89%            | 14.29%        | 2.65s           | 22.47× realtime | $0.0000     |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | Third-Party Service Non-Diarization | not-supported | 97.66       | 2.34%             | 0.48%         | 2.50s           | 23.82× realtime | $0.0010     |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | Third-Party Service Non-Diarization | not-supported | 97.66       | 2.34%             | 0.48%         | 5.77s           | 10.32× realtime | $0.0030     |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | Third-Party Service Non-Diarization | not-supported | 95.79       | 4.21%             | 2.38%         | 13.60s          | 4.38× realtime  | $0.0002     |
| <code>deepinfra-openai_whisper-large-v3</code>                             | Third-Party Service Non-Diarization | not-supported | 89.72       | 10.28%            | 8.57%         | 1.43s           | 41.55× realtime | $0.0004     |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | Third-Party Service Non-Diarization | not-supported | 88.79       | 11.21%            | 9.52%         | 1.50s           | 39.86× realtime | $0.0002     |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | Third-Party Service Non-Diarization | not-supported | 97.20       | 2.80%             | 0.95%         | 1.81s           | 32.88× realtime | $0.0002     |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | Third-Party Service Non-Diarization | not-supported | 97.20       | 2.80%             | 0.95%         | 1.19s           | 50.03× realtime | $0.0004     |
| <code>openai-stt-gpt-transcribe</code>                                     | Third-Party Service Non-Diarization | not-supported | 97.20       | 2.80%             | 0.95%         | 3.63s           | 16.41× realtime | $0.0045     |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | Third-Party Service Non-Diarization | not-supported | 97.20       | 2.80%             | 0.95%         | 0.72s           | 83.10× realtime | $0.0015     |
| <code>together-openai_whisper-large-v3</code>                              | Third-Party Service Non-Diarization | not-supported | 97.66       | 2.34%             | 0.48%         | 1.90s           | 31.31× realtime | $0.0015     |

## Error Breakdown (Speaker-aware)

| Provider                                                                   | Substitutions | Deletions | Insertions | Ref. Words |
| -------------------------------------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | 2             | 5         | 1          | 214        |
| <code>cloudflare-@cf_openai_whisper</code>                                 | 5             | 7         | 0          | 214        |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 2             | 4         | 0          | 214        |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 15            | 16        | 3          | 214        |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 2             | 3         | 0          | 214        |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 2             | 3         | 0          | 214        |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 4             | 5         | 0          | 214        |
| <code>deepinfra-openai_whisper-large-v3</code>                             | 1             | 21        | 0          | 214        |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 1             | 21        | 2          | 214        |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 2             | 4         | 0          | 214        |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 2             | 4         | 0          | 214        |
| <code>openai-stt-gpt-transcribe</code>                                     | 1             | 5         | 0          | 214        |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 3             | 3         | 0          | 214        |
| <code>together-openai_whisper-large-v3</code>                              | 2             | 3         | 0          | 214        |

## Error Breakdown (Text-only)

| Provider                                                                   | Substitutions | Deletions | Insertions | Ref. Words |
| -------------------------------------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | 1             | 2         | 1          | 210        |
| <code>cloudflare-@cf_openai_whisper</code>                                 | 4             | 4         | 0          | 210        |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 1             | 1         | 0          | 210        |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 14            | 13        | 3          | 210        |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 1             | 0         | 0          | 210        |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 1             | 0         | 0          | 210        |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 3             | 2         | 0          | 210        |
| <code>deepinfra-openai_whisper-large-v3</code>                             | 0             | 18        | 0          | 210        |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 0             | 18        | 2          | 210        |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 1             | 1         | 0          | 210        |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 1             | 1         | 0          | 210        |
| <code>openai-stt-gpt-transcribe</code>                                     | 0             | 2         | 0          | 210        |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 2             | 0         | 0          | 210        |
| <code>together-openai_whisper-large-v3</code>                              | 1             | 0         | 0          | 210        |

## Error Attribution (Speaker-aware)

| Provider                                                                   | Strict Edits | Disfluency | Orthographic | Number/Format | Neutral Edits | Speaker Attribution | Residual Number/Format | Other Lexical |
| -------------------------------------------------------------------------- | -----------: | ---------: | -----------: | ------------: | ------------: | ------------------: | ---------------------: | ------------: |
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | 18           | 4          | 4            | 2             | 8             | 4                   | 0                      | 4             |
| <code>cloudflare-@cf_openai_whisper</code>                                 | 20           | 6          | 2            | 0             | 12            | 4                   | 0                      | 8             |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 11           | 0          | 5            | 0             | 6             | 4                   | 0                      | 2             |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 42           | 4          | 4            | 0             | 34            | 4                   | 0                      | 30            |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 11           | 6          | 0            | 0             | 5             | 4                   | 0                      | 1             |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 11           | 6          | 0            | 0             | 5             | 4                   | 0                      | 1             |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 14           | 3          | 0            | 2             | 9             | 4                   | 1                      | 4             |
| <code>deepinfra-openai_whisper-large-v3</code>                             | 28           | 6          | 0            | 0             | 22            | 4                   | 0                      | 18            |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 30           | 6          | 0            | 0             | 24            | 4                   | 0                      | 20            |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 9            | 3          | 0            | 0             | 6             | 4                   | 0                      | 2             |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 12           | 4          | 0            | 2             | 6             | 4                   | 0                      | 2             |
| <code>openai-stt-gpt-transcribe</code>                                     | 12           | 6          | 0            | 0             | 6             | 4                   | 0                      | 2             |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 15           | 3          | 4            | 2             | 6             | 4                   | 0                      | 2             |
| <code>together-openai_whisper-large-v3</code>                              | 11           | 6          | 0            | 0             | 5             | 4                   | 0                      | 1             |

## Speaker Metrics

| Provider                                                                   | Ref. Speakers | Provider Speakers | Count Error | Word Attribution Accuracy | Legacy Score / 100 | Legacy Speaker-aware WER |
| -------------------------------------------------------------------------- | ------------: | ----------------: | ----------: | ------------------------: | -----------------: | -----------------------: |
| <code>cloudflare-@cf_deepgram_nova-3</code>                                | 2             | 0                 | n/a         | n/a                       | 91.82              | 8.18%                    |
| <code>cloudflare-@cf_openai_whisper</code>                                 | 2             | 0                 | n/a         | n/a                       | 90.91              | 9.09%                    |
| <code>cloudflare-@cf_openai_whisper-large-v3-turbo</code>                  | 2             | 0                 | n/a         | n/a                       | 95.00              | 5.00%                    |
| <code>cloudflare-@cf_openai_whisper-tiny-en</code>                         | 2             | 0                 | n/a         | n/a                       | 80.91              | 19.09%                   |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>                      | 2             | 0                 | n/a         | n/a                       | 95.00              | 5.00%                    |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code>                    | 2             | 0                 | n/a         | n/a                       | 95.00              | 5.00%                    |
| <code>deepinfra-nvidia_Nemotron-3.5-ASR-Streaming-Multilingual-0.6b</code> | 2             | 0                 | n/a         | n/a                       | 93.64              | 6.36%                    |
| <code>deepinfra-openai_whisper-large-v3</code>                             | 2             | 0                 | n/a         | n/a                       | 87.27              | 12.73%                   |
| <code>deepinfra-openai_whisper-large-v3-turbo</code>                       | 2             | 0                 | n/a         | n/a                       | 86.36              | 13.64%                   |
| <code>deepinfra-Qwen_Qwen3-ASR-0.6B</code>                                 | 2             | 0                 | n/a         | n/a                       | 95.91              | 4.09%                    |
| <code>deepinfra-Qwen_Qwen3-ASR-1.7B</code>                                 | 2             | 0                 | n/a         | n/a                       | 94.55              | 5.45%                    |
| <code>openai-stt-gpt-transcribe</code>                                     | 2             | 0                 | n/a         | n/a                       | 94.55              | 5.45%                    |
| <code>together-nvidia_parakeet-tdt-0.6b-v3</code>                          | 2             | 0                 | n/a         | n/a                       | 93.18              | 6.82%                    |
| <code>together-openai_whisper-large-v3</code>                              | 2             | 0                 | n/a         | n/a                       | 95.00              | 5.00%                    |

## Quality Flags

| Provider                                                | Quality Flags                                                                                  |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>   | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |
| <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |
| <code>openai-stt-gpt-transcribe</code>                  | All provider segments have zero duration; timing is coarse for overlap-based speaker analysis. |

## Duplicate Groups

| Group       | Providers                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| duplicate-1 | <code>deepinfra-mistralai_Voxtral-Mini-3B-2507</code>, <code>deepinfra-mistralai_Voxtral-Small-24B-2507</code> |

## Notes

- `deepinfra-mistralai_Voxtral-Mini-3B-2507` was the most accurate provider on neutral speaker-aware WER (scoring version 2.1), scoring 97.66/100.
- `together-nvidia_parakeet-tdt-0.6b-v3` was the fastest provider in this set at 0.72s.
- `deepinfra-mistralai_Voxtral-Mini-3B-2507` lost the most ground once speaker changes were counted, with 1.86 percentage-point gap between text-only and speaker-aware WER.
