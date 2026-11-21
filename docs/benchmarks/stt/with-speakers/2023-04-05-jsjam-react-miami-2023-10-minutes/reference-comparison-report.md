# Consensus Transcript Comparison Report

## Summary

- Run directory: `docs/benchmarks/stt/with-speakers/2023-04-05-jsjam-react-miami-2023-10-minutes`
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

| Rank | Provider                                      | Value   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput       | Actual Cost |
| ---: | --------------------------------------------- | ------: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------------: | ----------: |
| 1    | <code>grok-grok-voice-transcribe-2.0</code>   | $0.0167 | 98.09       | 1.91%             | 1.87%         | supported   | 5.60s           | 107.10× realtime | $0.0167     |
| 2    | <code>grok-speech-to-text</code>              | $0.0167 | 95.17       | 4.83%             | 4.47%         | supported   | 5.98s           | 100.32× realtime | $0.0167     |
| 3    | <code>soniox-stt-async-v5</code>              | $0.0167 | 97.67       | 2.33%             | 2.30%         | supported   | 26.75s          | 22.43× realtime  | $0.0167     |
| 4    | <code>speechmatics-melia-1</code>             | $0.0215 | 97.20       | 2.80%             | 2.60%         | supported   | 4.97s           | 120.82× realtime | $0.0215     |
| 5    | <code>mistral-voxtral-mini-2602</code>        | $0.0300 | 97.08       | 2.92%             | 2.54%         | supported   | 10.01s          | 59.95× realtime  | $0.0300     |
| 6    | <code>assemblyai-assemblyai-stt-3-7</code>    | $0.0383 | 98.03       | 1.97%             | 1.87%         | supported   | 8.91s           | 67.32× realtime  | $0.0383     |
| 7    | <code>assemblyai-universal-3-5-pro</code>     | $0.0383 | 98.03       | 1.97%             | 1.75%         | supported   | 17.10s          | 35.08× realtime  | $0.0383     |
| 8    | <code>deepgram-nova-3</code>                  | $0.0430 | 96.42       | 3.58%             | 3.08%         | supported   | 2.93s           | 204.99× realtime | $0.0430     |
| 9    | <code>gemini-stt-gemini-3.5-transcribe</code> | $0.0500 | 97.26       | 2.74%             | 2.78%         | supported   | 23.18s          | 25.88× realtime  | $0.0500     |
| 10   | <code>cloudflare-@cf_deepgram_nova-3</code>   | $0.0520 | 96.96       | 3.04%             | 2.90%         | supported   | 11.66s          | 51.44× realtime  | $0.0520     |
| 11   | <code>happyscribe-auto</code>                 | $0.1000 | 97.85       | 2.15%             | 1.81%         | supported   | 71.37s          | 8.41× realtime   | $0.1000     |
| 12   | <code>gladia-solaria-3</code>                 | $0.1017 | 97.85       | 2.15%             | 2.05%         | supported   | 10.71s          | 56.05× realtime  | $0.1017     |

#### Speed

| Rank | Provider                                      | Value  | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput       | Actual Cost |
| ---: | --------------------------------------------- | -----: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------------: | ----------: |
| 1    | <code>deepgram-nova-3</code>                  | 2.93s  | 96.42       | 3.58%             | 3.08%         | supported   | 2.93s           | 204.99× realtime | $0.0430     |
| 2    | <code>speechmatics-melia-1</code>             | 4.97s  | 97.20       | 2.80%             | 2.60%         | supported   | 4.97s           | 120.82× realtime | $0.0215     |
| 3    | <code>grok-grok-voice-transcribe-2.0</code>   | 5.60s  | 98.09       | 1.91%             | 1.87%         | supported   | 5.60s           | 107.10× realtime | $0.0167     |
| 4    | <code>grok-speech-to-text</code>              | 5.98s  | 95.17       | 4.83%             | 4.47%         | supported   | 5.98s           | 100.32× realtime | $0.0167     |
| 5    | <code>assemblyai-assemblyai-stt-3-7</code>    | 8.91s  | 98.03       | 1.97%             | 1.87%         | supported   | 8.91s           | 67.32× realtime  | $0.0383     |
| 6    | <code>mistral-voxtral-mini-2602</code>        | 10.01s | 97.08       | 2.92%             | 2.54%         | supported   | 10.01s          | 59.95× realtime  | $0.0300     |
| 7    | <code>gladia-solaria-3</code>                 | 10.71s | 97.85       | 2.15%             | 2.05%         | supported   | 10.71s          | 56.05× realtime  | $0.1017     |
| 8    | <code>cloudflare-@cf_deepgram_nova-3</code>   | 11.66s | 96.96       | 3.04%             | 2.90%         | supported   | 11.66s          | 51.44× realtime  | $0.0520     |
| 9    | <code>assemblyai-universal-3-5-pro</code>     | 17.10s | 98.03       | 1.97%             | 1.75%         | supported   | 17.10s          | 35.08× realtime  | $0.0383     |
| 10   | <code>gemini-stt-gemini-3.5-transcribe</code> | 23.18s | 97.26       | 2.74%             | 2.78%         | supported   | 23.18s          | 25.88× realtime  | $0.0500     |
| 11   | <code>soniox-stt-async-v5</code>              | 26.75s | 97.67       | 2.33%             | 2.30%         | supported   | 26.75s          | 22.43× realtime  | $0.0167     |
| 12   | <code>happyscribe-auto</code>                 | 71.37s | 97.85       | 2.15%             | 1.81%         | supported   | 71.37s          | 8.41× realtime   | $0.1000     |

#### Quality Score

| Rank | Provider                                      | Value                   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput       | Actual Cost |
| ---: | --------------------------------------------- | ----------------------: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------------: | ----------: |
| 1    | <code>grok-grok-voice-transcribe-2.0</code>   | 98.09/100 quality score | 98.09       | 1.91%             | 1.87%         | supported   | 5.60s           | 107.10× realtime | $0.0167     |
| 2    | <code>assemblyai-universal-3-5-pro</code>     | 98.03/100 quality score | 98.03       | 1.97%             | 1.75%         | supported   | 17.10s          | 35.08× realtime  | $0.0383     |
| 3    | <code>assemblyai-assemblyai-stt-3-7</code>    | 98.03/100 quality score | 98.03       | 1.97%             | 1.87%         | supported   | 8.91s           | 67.32× realtime  | $0.0383     |
| 4    | <code>happyscribe-auto</code>                 | 97.85/100 quality score | 97.85       | 2.15%             | 1.81%         | supported   | 71.37s          | 8.41× realtime   | $0.1000     |
| 5    | <code>gladia-solaria-3</code>                 | 97.85/100 quality score | 97.85       | 2.15%             | 2.05%         | supported   | 10.71s          | 56.05× realtime  | $0.1017     |
| 6    | <code>soniox-stt-async-v5</code>              | 97.67/100 quality score | 97.67       | 2.33%             | 2.30%         | supported   | 26.75s          | 22.43× realtime  | $0.0167     |
| 7    | <code>gemini-stt-gemini-3.5-transcribe</code> | 97.26/100 quality score | 97.26       | 2.74%             | 2.78%         | supported   | 23.18s          | 25.88× realtime  | $0.0500     |
| 8    | <code>speechmatics-melia-1</code>             | 97.20/100 quality score | 97.20       | 2.80%             | 2.60%         | supported   | 4.97s           | 120.82× realtime | $0.0215     |
| 9    | <code>mistral-voxtral-mini-2602</code>        | 97.08/100 quality score | 97.08       | 2.92%             | 2.54%         | supported   | 10.01s          | 59.95× realtime  | $0.0300     |
| 10   | <code>cloudflare-@cf_deepgram_nova-3</code>   | 96.96/100 quality score | 96.96       | 3.04%             | 2.90%         | supported   | 11.66s          | 51.44× realtime  | $0.0520     |
| 11   | <code>deepgram-nova-3</code>                  | 96.42/100 quality score | 96.42       | 3.58%             | 3.08%         | supported   | 2.93s           | 204.99× realtime | $0.0430     |
| 12   | <code>grok-speech-to-text</code>              | 95.17/100 quality score | 95.17       | 4.83%             | 4.47%         | supported   | 5.98s           | 100.32× realtime | $0.0167     |


## Provider Detail

| Provider                                      | Group                           | Diarization | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Throughput       | Actual Cost |
| --------------------------------------------- | ------------------------------- | ----------- | ----------: | ----------------: | ------------: | --------------: | ---------------: | ----------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | Third-Party Service Diarization | supported   | 98.03       | 1.97%             | 1.87%         | 8.91s           | 67.32× realtime  | $0.0383     |
| <code>assemblyai-universal-3-5-pro</code>     | Third-Party Service Diarization | supported   | 98.03       | 1.97%             | 1.75%         | 17.10s          | 35.08× realtime  | $0.0383     |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | Third-Party Service Diarization | supported   | 96.96       | 3.04%             | 2.90%         | 11.66s          | 51.44× realtime  | $0.0520     |
| <code>deepgram-nova-3</code>                  | Third-Party Service Diarization | supported   | 96.42       | 3.58%             | 3.08%         | 2.93s           | 204.99× realtime | $0.0430     |
| <code>gemini-stt-gemini-3.5-transcribe</code> | Third-Party Service Diarization | supported   | 97.26       | 2.74%             | 2.78%         | 23.18s          | 25.88× realtime  | $0.0500     |
| <code>gladia-solaria-3</code>                 | Third-Party Service Diarization | supported   | 97.85       | 2.15%             | 2.05%         | 10.71s          | 56.05× realtime  | $0.1017     |
| <code>grok-grok-voice-transcribe-2.0</code>   | Third-Party Service Diarization | supported   | 98.09       | 1.91%             | 1.87%         | 5.60s           | 107.10× realtime | $0.0167     |
| <code>grok-speech-to-text</code>              | Third-Party Service Diarization | supported   | 95.17       | 4.83%             | 4.47%         | 5.98s           | 100.32× realtime | $0.0167     |
| <code>happyscribe-auto</code>                 | Third-Party Service Diarization | supported   | 97.85       | 2.15%             | 1.81%         | 71.37s          | 8.41× realtime   | $0.1000     |
| <code>mistral-voxtral-mini-2602</code>        | Third-Party Service Diarization | supported   | 97.08       | 2.92%             | 2.54%         | 10.01s          | 59.95× realtime  | $0.0300     |
| <code>soniox-stt-async-v5</code>              | Third-Party Service Diarization | supported   | 97.67       | 2.33%             | 2.30%         | 26.75s          | 22.43× realtime  | $0.0167     |
| <code>speechmatics-melia-1</code>             | Third-Party Service Diarization | supported   | 97.20       | 2.80%             | 2.60%         | 4.97s           | 120.82× realtime | $0.0215     |

## Error Breakdown (Speaker-aware)

| Provider                                      | Substitutions | Deletions | Insertions | Ref. Words |
| --------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | 5             | 25        | 3          | 1677       |
| <code>assemblyai-universal-3-5-pro</code>     | 11            | 21        | 1          | 1677       |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | 21            | 17        | 13         | 1677       |
| <code>deepgram-nova-3</code>                  | 20            | 22        | 18         | 1677       |
| <code>gemini-stt-gemini-3.5-transcribe</code> | 23            | 12        | 11         | 1677       |
| <code>gladia-solaria-3</code>                 | 16            | 13        | 7          | 1677       |
| <code>grok-grok-voice-transcribe-2.0</code>   | 20            | 9         | 3          | 1677       |
| <code>grok-speech-to-text</code>              | 17            | 59        | 5          | 1676       |
| <code>happyscribe-auto</code>                 | 7             | 23        | 6          | 1677       |
| <code>mistral-voxtral-mini-2602</code>        | 14            | 30        | 5          | 1677       |
| <code>soniox-stt-async-v5</code>              | 17            | 13        | 9          | 1675       |
| <code>speechmatics-melia-1</code>             | 21            | 14        | 12         | 1677       |

## Error Breakdown (Text-only)

| Provider                                      | Substitutions | Deletions | Insertions | Ref. Words |
| --------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | 5             | 24        | 2          | 1656       |
| <code>assemblyai-universal-3-5-pro</code>     | 10            | 18        | 1          | 1656       |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | 19            | 17        | 12         | 1656       |
| <code>deepgram-nova-3</code>                  | 19            | 17        | 15         | 1656       |
| <code>gemini-stt-gemini-3.5-transcribe</code> | 23            | 12        | 11         | 1656       |
| <code>gladia-solaria-3</code>                 | 14            | 13        | 7          | 1656       |
| <code>grok-grok-voice-transcribe-2.0</code>   | 19            | 9         | 3          | 1656       |
| <code>grok-speech-to-text</code>              | 14            | 55        | 5          | 1655       |
| <code>happyscribe-auto</code>                 | 5             | 20        | 5          | 1656       |
| <code>mistral-voxtral-mini-2602</code>        | 13            | 25        | 4          | 1656       |
| <code>soniox-stt-async-v5</code>              | 16            | 13        | 9          | 1654       |
| <code>speechmatics-melia-1</code>             | 17            | 14        | 12         | 1656       |

## Error Attribution (Speaker-aware)

| Provider                                      | Strict Edits | Disfluency | Orthographic | Number/Format | Neutral Edits | Speaker Attribution | Residual Number/Format | Other Lexical |
| --------------------------------------------- | -----------: | ---------: | -----------: | ------------: | ------------: | ------------------: | ---------------------: | ------------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | 71           | 27         | 9            | 2             | 33            | 2                   | 0                      | 31            |
| <code>assemblyai-universal-3-5-pro</code>     | 65           | 18         | 10           | 4             | 33            | 4                   | 0                      | 29            |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | 79           | 0          | 28           | 0             | 51            | 3                   | 0                      | 48            |
| <code>deepgram-nova-3</code>                  | 85           | -3         | 28           | 0             | 60            | 10                  | 0                      | 50            |
| <code>gemini-stt-gemini-3.5-transcribe</code> | 63           | 1          | 14           | 2             | 46            | 0                   | 0                      | 46            |
| <code>gladia-solaria-3</code>                 | 48           | 6          | 6            | 0             | 36            | 3                   | 0                      | 33            |
| <code>grok-grok-voice-transcribe-2.0</code>   | 41           | 1          | 8            | 0             | 32            | 0                   | 0                      | 32            |
| <code>grok-speech-to-text</code>              | 115          | 5          | 29           | 0             | 81            | 8                   | 0                      | 73            |
| <code>happyscribe-auto</code>                 | 79           | 29         | 12           | 2             | 36            | 6                   | 0                      | 30            |
| <code>mistral-voxtral-mini-2602</code>        | 97           | 36         | 12           | 0             | 49            | 7                   | 0                      | 42            |
| <code>soniox-stt-async-v5</code>              | 98           | 38         | 19           | 2             | 39            | 1                   | 0                      | 38            |
| <code>speechmatics-melia-1</code>             | 68           | 6          | 13           | 2             | 47            | 4                   | 0                      | 43            |

## Speaker Metrics

| Provider                                      | Ref. Speakers | Provider Speakers | Count Error | Word Attribution Accuracy | Legacy Score / 100 | Legacy Speaker-aware WER |
| --------------------------------------------- | ------------: | ----------------: | ----------: | ------------------------: | -----------------: | -----------------------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | 6             | 6                 | 0           | 99.88%                    | 95.88              | 4.12%                    |
| <code>assemblyai-universal-3-5-pro</code>     | 6             | 5                 | 1           | 97.60%                    | 96.23              | 3.77%                    |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | 6             | 6                 | 0           | 99.88%                    | 95.41              | 4.59%                    |
| <code>deepgram-nova-3</code>                  | 6             | 6                 | 0           | 97.04%                    | 95.07              | 4.93%                    |
| <code>gemini-stt-gemini-3.5-transcribe</code> | 6             | 6                 | 0           | 100.00%                   | 96.34              | 3.66%                    |
| <code>gladia-solaria-3</code>                 | 6             | 6                 | 0           | 99.69%                    | 97.21              | 2.79%                    |
| <code>grok-grok-voice-transcribe-2.0</code>   | 6             | 6                 | 0           | 99.94%                    | 97.62              | 2.38%                    |
| <code>grok-speech-to-text</code>              | 6             | 6                 | 0           | 99.56%                    | 93.33              | 6.67%                    |
| <code>happyscribe-auto</code>                 | 6             | 5                 | 1           | 97.18%                    | 95.41              | 4.59%                    |
| <code>mistral-voxtral-mini-2602</code>        | 6             | 6                 | 0           | 98.76%                    | 94.37              | 5.63%                    |
| <code>soniox-stt-async-v5</code>              | 6             | 6                 | 0           | 97.91%                    | 94.31              | 5.69%                    |
| <code>speechmatics-melia-1</code>             | 6             | 7                 | 1           | 99.88%                    | 96.05              | 3.95%                    |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `grok-grok-voice-transcribe-2.0` was the most accurate provider on neutral speaker-aware WER (scoring version 2.1), scoring 98.09/100.
- `deepgram-nova-3` was the fastest provider in this set at 2.93s.
- `deepgram-nova-3` lost the most ground once speaker changes were counted, with 0.50 percentage-point gap between text-only and speaker-aware WER.
