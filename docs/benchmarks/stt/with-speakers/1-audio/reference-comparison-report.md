# Consensus Transcript Comparison Report

## Summary

- Run directory: `docs/benchmarks/stt/with-speakers/1-audio`
- Total providers: 12 (0 local, 12 third-party service)
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

### Third-Party Service Diarization

#### Price

| Rank | Provider                                      | Value   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput      | Actual Cost |
| ---: | --------------------------------------------- | ------: | ----------: | ----------------: | ------------: | ----------- | --------------: | --------------: | ----------: |
| 1    | <code>grok-grok-voice-transcribe-2.0</code>   | $0.0017 | 98.57       | 1.43%             | 1.46%         | supported   | 1.43s           | 41.64× realtime | $0.0017     |
| 2    | <code>grok-speech-to-text</code>              | $0.0017 | 90.48       | 9.52%             | 9.71%         | supported   | 1.02s           | 58.42× realtime | $0.0017     |
| 3    | <code>soniox-stt-async-v5</code>              | $0.0017 | 99.05       | 0.95%             | 0.97%         | supported   | 3.85s           | 15.47× realtime | $0.0017     |
| 4    | <code>speechmatics-melia-1</code>             | $0.0021 | 100.00      | 0.00%             | 0.00%         | supported   | 2.80s           | 21.26× realtime | $0.0021     |
| 5    | <code>mistral-voxtral-mini-2602</code>        | $0.0030 | 99.05       | 0.95%             | 0.97%         | supported   | 4.89s           | 12.17× realtime | $0.0030     |
| 6    | <code>assemblyai-assemblyai-stt-3-7</code>    | $0.0038 | 99.52       | 0.48%             | 0.49%         | supported   | 4.22s           | 14.11× realtime | $0.0038     |
| 7    | <code>assemblyai-universal-3-5-pro</code>     | $0.0038 | 99.52       | 0.48%             | 0.49%         | supported   | 7.71s           | 7.72× realtime  | $0.0038     |
| 8    | <code>deepgram-nova-3</code>                  | $0.0043 | 95.24       | 4.76%             | 2.91%         | supported   | 2.86s           | 20.85× realtime | $0.0043     |
| 9    | <code>gemini-stt-gemini-3.5-transcribe</code> | $0.0050 | 99.05       | 0.95%             | 0.97%         | supported   | 5.45s           | 10.94× realtime | $0.0050     |
| 10   | <code>cloudflare-@cf_deepgram_nova-3</code>   | $0.0052 | 97.14       | 2.86%             | 2.91%         | supported   | 2.29s           | 26.03× realtime | $0.0052     |
| 11   | <code>happyscribe-auto</code>                 | $0.0099 | 99.52       | 0.48%             | 0.49%         | supported   | 50.34s          | 1.18× realtime  | $0.0099     |
| 12   | <code>gladia-solaria-3</code>                 | $0.0101 | 99.05       | 0.95%             | 0.97%         | supported   | 8.77s           | 6.79× realtime  | $0.0101     |

#### Speed

| Rank | Provider                                      | Value  | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput      | Actual Cost |
| ---: | --------------------------------------------- | -----: | ----------: | ----------------: | ------------: | ----------- | --------------: | --------------: | ----------: |
| 1    | <code>grok-speech-to-text</code>              | 1.02s  | 90.48       | 9.52%             | 9.71%         | supported   | 1.02s           | 58.42× realtime | $0.0017     |
| 2    | <code>grok-grok-voice-transcribe-2.0</code>   | 1.43s  | 98.57       | 1.43%             | 1.46%         | supported   | 1.43s           | 41.64× realtime | $0.0017     |
| 3    | <code>cloudflare-@cf_deepgram_nova-3</code>   | 2.29s  | 97.14       | 2.86%             | 2.91%         | supported   | 2.29s           | 26.03× realtime | $0.0052     |
| 4    | <code>speechmatics-melia-1</code>             | 2.80s  | 100.00      | 0.00%             | 0.00%         | supported   | 2.80s           | 21.26× realtime | $0.0021     |
| 5    | <code>deepgram-nova-3</code>                  | 2.86s  | 95.24       | 4.76%             | 2.91%         | supported   | 2.86s           | 20.85× realtime | $0.0043     |
| 6    | <code>soniox-stt-async-v5</code>              | 3.85s  | 99.05       | 0.95%             | 0.97%         | supported   | 3.85s           | 15.47× realtime | $0.0017     |
| 7    | <code>assemblyai-assemblyai-stt-3-7</code>    | 4.22s  | 99.52       | 0.48%             | 0.49%         | supported   | 4.22s           | 14.11× realtime | $0.0038     |
| 8    | <code>mistral-voxtral-mini-2602</code>        | 4.89s  | 99.05       | 0.95%             | 0.97%         | supported   | 4.89s           | 12.17× realtime | $0.0030     |
| 9    | <code>gemini-stt-gemini-3.5-transcribe</code> | 5.45s  | 99.05       | 0.95%             | 0.97%         | supported   | 5.45s           | 10.94× realtime | $0.0050     |
| 10   | <code>assemblyai-universal-3-5-pro</code>     | 7.71s  | 99.52       | 0.48%             | 0.49%         | supported   | 7.71s           | 7.72× realtime  | $0.0038     |
| 11   | <code>gladia-solaria-3</code>                 | 8.77s  | 99.05       | 0.95%             | 0.97%         | supported   | 8.77s           | 6.79× realtime  | $0.0101     |
| 12   | <code>happyscribe-auto</code>                 | 50.34s | 99.52       | 0.48%             | 0.49%         | supported   | 50.34s          | 1.18× realtime  | $0.0099     |

#### Quality Score

| Rank | Provider                                      | Value                    | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput      | Actual Cost |
| ---: | --------------------------------------------- | -----------------------: | ----------: | ----------------: | ------------: | ----------- | --------------: | --------------: | ----------: |
| 1    | <code>speechmatics-melia-1</code>             | 100.00/100 quality score | 100.00      | 0.00%             | 0.00%         | supported   | 2.80s           | 21.26× realtime | $0.0021     |
| 2    | <code>assemblyai-assemblyai-stt-3-7</code>    | 99.52/100 quality score  | 99.52       | 0.48%             | 0.49%         | supported   | 4.22s           | 14.11× realtime | $0.0038     |
| 3    | <code>assemblyai-universal-3-5-pro</code>     | 99.52/100 quality score  | 99.52       | 0.48%             | 0.49%         | supported   | 7.71s           | 7.72× realtime  | $0.0038     |
| 4    | <code>happyscribe-auto</code>                 | 99.52/100 quality score  | 99.52       | 0.48%             | 0.49%         | supported   | 50.34s          | 1.18× realtime  | $0.0099     |
| 5    | <code>gemini-stt-gemini-3.5-transcribe</code> | 99.05/100 quality score  | 99.05       | 0.95%             | 0.97%         | supported   | 5.45s           | 10.94× realtime | $0.0050     |
| 6    | <code>gladia-solaria-3</code>                 | 99.05/100 quality score  | 99.05       | 0.95%             | 0.97%         | supported   | 8.77s           | 6.79× realtime  | $0.0101     |
| 7    | <code>mistral-voxtral-mini-2602</code>        | 99.05/100 quality score  | 99.05       | 0.95%             | 0.97%         | supported   | 4.89s           | 12.17× realtime | $0.0030     |
| 8    | <code>soniox-stt-async-v5</code>              | 99.05/100 quality score  | 99.05       | 0.95%             | 0.97%         | supported   | 3.85s           | 15.47× realtime | $0.0017     |
| 9    | <code>grok-grok-voice-transcribe-2.0</code>   | 98.57/100 quality score  | 98.57       | 1.43%             | 1.46%         | supported   | 1.43s           | 41.64× realtime | $0.0017     |
| 10   | <code>cloudflare-@cf_deepgram_nova-3</code>   | 97.14/100 quality score  | 97.14       | 2.86%             | 2.91%         | supported   | 2.29s           | 26.03× realtime | $0.0052     |
| 11   | <code>deepgram-nova-3</code>                  | 95.24/100 quality score  | 95.24       | 4.76%             | 2.91%         | supported   | 2.86s           | 20.85× realtime | $0.0043     |
| 12   | <code>grok-speech-to-text</code>              | 90.48/100 quality score  | 90.48       | 9.52%             | 9.71%         | supported   | 1.02s           | 58.42× realtime | $0.0017     |


## Provider Detail

| Provider                                      | Group                           | Diarization | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Throughput      | Actual Cost |
| --------------------------------------------- | ------------------------------- | ----------- | ----------: | ----------------: | ------------: | --------------: | --------------: | ----------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | Third-Party Service Diarization | supported   | 99.52       | 0.48%             | 0.49%         | 4.22s           | 14.11× realtime | $0.0038     |
| <code>assemblyai-universal-3-5-pro</code>     | Third-Party Service Diarization | supported   | 99.52       | 0.48%             | 0.49%         | 7.71s           | 7.72× realtime  | $0.0038     |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | Third-Party Service Diarization | supported   | 97.14       | 2.86%             | 2.91%         | 2.29s           | 26.03× realtime | $0.0052     |
| <code>deepgram-nova-3</code>                  | Third-Party Service Diarization | supported   | 95.24       | 4.76%             | 2.91%         | 2.86s           | 20.85× realtime | $0.0043     |
| <code>gemini-stt-gemini-3.5-transcribe</code> | Third-Party Service Diarization | supported   | 99.05       | 0.95%             | 0.97%         | 5.45s           | 10.94× realtime | $0.0050     |
| <code>gladia-solaria-3</code>                 | Third-Party Service Diarization | supported   | 99.05       | 0.95%             | 0.97%         | 8.77s           | 6.79× realtime  | $0.0101     |
| <code>grok-grok-voice-transcribe-2.0</code>   | Third-Party Service Diarization | supported   | 98.57       | 1.43%             | 1.46%         | 1.43s           | 41.64× realtime | $0.0017     |
| <code>grok-speech-to-text</code>              | Third-Party Service Diarization | supported   | 90.48       | 9.52%             | 9.71%         | 1.02s           | 58.42× realtime | $0.0017     |
| <code>happyscribe-auto</code>                 | Third-Party Service Diarization | supported   | 99.52       | 0.48%             | 0.49%         | 50.34s          | 1.18× realtime  | $0.0099     |
| <code>mistral-voxtral-mini-2602</code>        | Third-Party Service Diarization | supported   | 99.05       | 0.95%             | 0.97%         | 4.89s           | 12.17× realtime | $0.0030     |
| <code>soniox-stt-async-v5</code>              | Third-Party Service Diarization | supported   | 99.05       | 0.95%             | 0.97%         | 3.85s           | 15.47× realtime | $0.0017     |
| <code>speechmatics-melia-1</code>             | Third-Party Service Diarization | supported   | 100.00      | 0.00%             | 0.00%         | 2.80s           | 21.26× realtime | $0.0021     |

## Error Breakdown (Speaker-aware)

| Provider                                      | Substitutions | Deletions | Insertions | Ref. Words |
| --------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | 0             | 1         | 0          | 210        |
| <code>assemblyai-universal-3-5-pro</code>     | 0             | 1         | 0          | 210        |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | 2             | 2         | 2          | 210        |
| <code>deepgram-nova-3</code>                  | 2             | 5         | 3          | 210        |
| <code>gemini-stt-gemini-3.5-transcribe</code> | 2             | 0         | 0          | 210        |
| <code>gladia-solaria-3</code>                 | 1             | 1         | 0          | 210        |
| <code>grok-grok-voice-transcribe-2.0</code>   | 2             | 1         | 0          | 210        |
| <code>grok-speech-to-text</code>              | 2             | 16        | 2          | 210        |
| <code>happyscribe-auto</code>                 | 0             | 1         | 0          | 210        |
| <code>mistral-voxtral-mini-2602</code>        | 1             | 1         | 0          | 210        |
| <code>soniox-stt-async-v5</code>              | 1             | 1         | 0          | 210        |
| <code>speechmatics-melia-1</code>             | 0             | 0         | 0          | 210        |

## Error Breakdown (Text-only)

| Provider                                      | Substitutions | Deletions | Insertions | Ref. Words |
| --------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | 0             | 1         | 0          | 206        |
| <code>assemblyai-universal-3-5-pro</code>     | 0             | 1         | 0          | 206        |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | 2             | 2         | 2          | 206        |
| <code>deepgram-nova-3</code>                  | 2             | 2         | 2          | 206        |
| <code>gemini-stt-gemini-3.5-transcribe</code> | 2             | 0         | 0          | 206        |
| <code>gladia-solaria-3</code>                 | 1             | 1         | 0          | 206        |
| <code>grok-grok-voice-transcribe-2.0</code>   | 2             | 1         | 0          | 206        |
| <code>grok-speech-to-text</code>              | 2             | 16        | 2          | 206        |
| <code>happyscribe-auto</code>                 | 0             | 1         | 0          | 206        |
| <code>mistral-voxtral-mini-2602</code>        | 1             | 1         | 0          | 206        |
| <code>soniox-stt-async-v5</code>              | 1             | 1         | 0          | 206        |
| <code>speechmatics-melia-1</code>             | 0             | 0         | 0          | 206        |

## Error Attribution (Speaker-aware)

| Provider                                      | Strict Edits | Disfluency | Orthographic | Number/Format | Neutral Edits | Speaker Attribution | Residual Number/Format | Other Lexical |
| --------------------------------------------- | -----------: | ---------: | -----------: | ------------: | ------------: | ------------------: | ---------------------: | ------------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | 12           | 9          | 2            | 0             | 1             | 0                   | 0                      | 1             |
| <code>assemblyai-universal-3-5-pro</code>     | 8            | 5          | 2            | 0             | 1             | 0                   | 0                      | 1             |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | 19           | 7          | 4            | 2             | 6             | 0                   | 0                      | 6             |
| <code>deepgram-nova-3</code>                  | 23           | 7          | 4            | 2             | 10            | 4                   | 0                      | 6             |
| <code>gemini-stt-gemini-3.5-transcribe</code> | 7            | 3          | 2            | 0             | 2             | 0                   | 0                      | 2             |
| <code>gladia-solaria-3</code>                 | 6            | 0          | 2            | 2             | 2             | 0                   | 0                      | 2             |
| <code>grok-grok-voice-transcribe-2.0</code>   | 5            | 0          | 2            | 0             | 3             | 0                   | 0                      | 3             |
| <code>grok-speech-to-text</code>              | 30           | 3          | 5            | 2             | 20            | 0                   | 0                      | 20            |
| <code>happyscribe-auto</code>                 | 7            | 4          | 2            | 0             | 1             | 0                   | 0                      | 1             |
| <code>mistral-voxtral-mini-2602</code>        | 13           | 9          | 2            | 0             | 2             | 0                   | 0                      | 2             |
| <code>soniox-stt-async-v5</code>              | 10           | 6          | 2            | 0             | 2             | 0                   | 0                      | 2             |
| <code>speechmatics-melia-1</code>             | 8            | 4          | 4            | 0             | 0             | 0                   | 0                      | 0             |

## Speaker Metrics

| Provider                                      | Ref. Speakers | Provider Speakers | Count Error | Word Attribution Accuracy | Legacy Score / 100 | Legacy Speaker-aware WER |
| --------------------------------------------- | ------------: | ----------------: | ----------: | ------------------------: | -----------------: | -----------------------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | 2             | 2                 | 0           | 100.00%                   | 94.59              | 5.41%                    |
| <code>assemblyai-universal-3-5-pro</code>     | 2             | 2                 | 0           | 100.00%                   | 96.40              | 3.60%                    |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | 2             | 2                 | 0           | 100.00%                   | 91.44              | 8.56%                    |
| <code>deepgram-nova-3</code>                  | 2             | 2                 | 0           | 74.75%                    | 89.64              | 10.36%                   |
| <code>gemini-stt-gemini-3.5-transcribe</code> | 2             | 2                 | 0           | 100.00%                   | 96.85              | 3.15%                    |
| <code>gladia-solaria-3</code>                 | 2             | 2                 | 0           | 100.00%                   | 97.30              | 2.70%                    |
| <code>grok-grok-voice-transcribe-2.0</code>   | 2             | 2                 | 0           | 100.00%                   | 97.75              | 2.25%                    |
| <code>grok-speech-to-text</code>              | 2             | 2                 | 0           | 100.00%                   | 86.49              | 13.51%                   |
| <code>happyscribe-auto</code>                 | 2             | 2                 | 0           | 100.00%                   | 96.85              | 3.15%                    |
| <code>mistral-voxtral-mini-2602</code>        | 2             | 2                 | 0           | 100.00%                   | 94.14              | 5.86%                    |
| <code>soniox-stt-async-v5</code>              | 2             | 2                 | 0           | 100.00%                   | 95.50              | 4.50%                    |
| <code>speechmatics-melia-1</code>             | 2             | 2                 | 0           | 100.00%                   | 96.40              | 3.60%                    |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `speechmatics-melia-1` was the most accurate provider on neutral speaker-aware WER (scoring version 2.1), scoring 100.00/100.
- `grok-speech-to-text` was the fastest provider in this set at 1.02s.
- `deepgram-nova-3` lost the most ground once speaker changes were counted, with 1.85 percentage-point gap between text-only and speaker-aware WER.
