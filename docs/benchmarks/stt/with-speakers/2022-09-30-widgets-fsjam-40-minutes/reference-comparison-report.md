# Consensus Transcript Comparison Report

## Summary

- Run directory: `docs/benchmarks/stt/with-speakers/2022-09-30-widgets-fsjam-40-minutes`
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
| 1    | <code>grok-grok-voice-transcribe-2.0</code>   | $0.0673 | 98.09       | 1.91%             | 1.88%         | supported   | 53.24s          | 45.51× realtime  | $0.0673     |
| 2    | <code>grok-speech-to-text</code>              | $0.0673 | 94.25       | 5.75%             | 5.23%         | supported   | 29.32s          | 82.64× realtime  | $0.0673     |
| 3    | <code>soniox-stt-async-v5</code>              | $0.0673 | 98.07       | 1.93%             | 1.74%         | supported   | 83.25s          | 29.10× realtime  | $0.0673     |
| 4    | <code>speechmatics-melia-1</code>             | $0.0868 | 97.38       | 2.62%             | 2.42%         | supported   | 22.74s          | 106.54× realtime | $0.0868     |
| 5    | <code>mistral-voxtral-mini-2602</code>        | $0.1212 | 98.37       | 1.63%             | 1.43%         | supported   | 33.26s          | 72.84× realtime  | $0.1212     |
| 6    | <code>assemblyai-assemblyai-stt-3-7</code>    | $0.1548 | 98.81       | 1.19%             | 1.20%         | supported   | 17.81s          | 136.06× realtime | $0.1548     |
| 7    | <code>assemblyai-universal-3-5-pro</code>     | $0.1548 | 98.44       | 1.56%             | 1.34%         | supported   | 45.53s          | 53.21× realtime  | $0.1548     |
| 8    | <code>deepgram-nova-3</code>                  | $0.1737 | 96.32       | 3.68%             | 2.58%         | supported   | 8.93s           | 271.37× realtime | $0.1737     |
| 9    | <code>gemini-stt-gemini-3.5-transcribe</code> | $0.2019 | 94.90       | 5.10%             | 4.46%         | supported   | 103.06s         | 23.51× realtime  | $0.2019     |
| 10   | <code>cloudflare-@cf_deepgram_nova-3</code>   | $0.2100 | 97.43       | 2.57%             | 2.39%         | supported   | 70.09s          | 34.57× realtime  | $0.2100     |
| 11   | <code>happyscribe-auto</code>                 | $0.4038 | 98.53       | 1.47%             | 1.23%         | supported   | 124.01s         | 19.54× realtime  | $0.4038     |
| 12   | <code>gladia-solaria-3</code>                 | $0.4106 | 98.00       | 2.00%             | 1.75%         | supported   | 39.28s          | 61.69× realtime  | $0.4106     |

#### Speed

| Rank | Provider                                      | Value   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput       | Actual Cost |
| ---: | --------------------------------------------- | ------: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------------: | ----------: |
| 1    | <code>deepgram-nova-3</code>                  | 8.93s   | 96.32       | 3.68%             | 2.58%         | supported   | 8.93s           | 271.37× realtime | $0.1737     |
| 2    | <code>assemblyai-assemblyai-stt-3-7</code>    | 17.81s  | 98.81       | 1.19%             | 1.20%         | supported   | 17.81s          | 136.06× realtime | $0.1548     |
| 3    | <code>speechmatics-melia-1</code>             | 22.74s  | 97.38       | 2.62%             | 2.42%         | supported   | 22.74s          | 106.54× realtime | $0.0868     |
| 4    | <code>grok-speech-to-text</code>              | 29.32s  | 94.25       | 5.75%             | 5.23%         | supported   | 29.32s          | 82.64× realtime  | $0.0673     |
| 5    | <code>mistral-voxtral-mini-2602</code>        | 33.26s  | 98.37       | 1.63%             | 1.43%         | supported   | 33.26s          | 72.84× realtime  | $0.1212     |
| 6    | <code>gladia-solaria-3</code>                 | 39.28s  | 98.00       | 2.00%             | 1.75%         | supported   | 39.28s          | 61.69× realtime  | $0.4106     |
| 7    | <code>assemblyai-universal-3-5-pro</code>     | 45.53s  | 98.44       | 1.56%             | 1.34%         | supported   | 45.53s          | 53.21× realtime  | $0.1548     |
| 8    | <code>grok-grok-voice-transcribe-2.0</code>   | 53.24s  | 98.09       | 1.91%             | 1.88%         | supported   | 53.24s          | 45.51× realtime  | $0.0673     |
| 9    | <code>cloudflare-@cf_deepgram_nova-3</code>   | 70.09s  | 97.43       | 2.57%             | 2.39%         | supported   | 70.09s          | 34.57× realtime  | $0.2100     |
| 10   | <code>soniox-stt-async-v5</code>              | 83.25s  | 98.07       | 1.93%             | 1.74%         | supported   | 83.25s          | 29.10× realtime  | $0.0673     |
| 11   | <code>gemini-stt-gemini-3.5-transcribe</code> | 103.06s | 94.90       | 5.10%             | 4.46%         | supported   | 103.06s         | 23.51× realtime  | $0.2019     |
| 12   | <code>happyscribe-auto</code>                 | 124.01s | 98.53       | 1.47%             | 1.23%         | supported   | 124.01s         | 19.54× realtime  | $0.4038     |

#### Quality Score

| Rank | Provider                                      | Value                   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput       | Actual Cost |
| ---: | --------------------------------------------- | ----------------------: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------------: | ----------: |
| 1    | <code>assemblyai-assemblyai-stt-3-7</code>    | 98.81/100 quality score | 98.81       | 1.19%             | 1.20%         | supported   | 17.81s          | 136.06× realtime | $0.1548     |
| 2    | <code>happyscribe-auto</code>                 | 98.53/100 quality score | 98.53       | 1.47%             | 1.23%         | supported   | 124.01s         | 19.54× realtime  | $0.4038     |
| 3    | <code>assemblyai-universal-3-5-pro</code>     | 98.44/100 quality score | 98.44       | 1.56%             | 1.34%         | supported   | 45.53s          | 53.21× realtime  | $0.1548     |
| 4    | <code>mistral-voxtral-mini-2602</code>        | 98.37/100 quality score | 98.37       | 1.63%             | 1.43%         | supported   | 33.26s          | 72.84× realtime  | $0.1212     |
| 5    | <code>grok-grok-voice-transcribe-2.0</code>   | 98.09/100 quality score | 98.09       | 1.91%             | 1.88%         | supported   | 53.24s          | 45.51× realtime  | $0.0673     |
| 6    | <code>soniox-stt-async-v5</code>              | 98.07/100 quality score | 98.07       | 1.93%             | 1.74%         | supported   | 83.25s          | 29.10× realtime  | $0.0673     |
| 7    | <code>gladia-solaria-3</code>                 | 98.00/100 quality score | 98.00       | 2.00%             | 1.75%         | supported   | 39.28s          | 61.69× realtime  | $0.4106     |
| 8    | <code>cloudflare-@cf_deepgram_nova-3</code>   | 97.43/100 quality score | 97.43       | 2.57%             | 2.39%         | supported   | 70.09s          | 34.57× realtime  | $0.2100     |
| 9    | <code>speechmatics-melia-1</code>             | 97.38/100 quality score | 97.38       | 2.62%             | 2.42%         | supported   | 22.74s          | 106.54× realtime | $0.0868     |
| 10   | <code>deepgram-nova-3</code>                  | 96.32/100 quality score | 96.32       | 3.68%             | 2.58%         | supported   | 8.93s           | 271.37× realtime | $0.1737     |
| 11   | <code>gemini-stt-gemini-3.5-transcribe</code> | 94.90/100 quality score | 94.90       | 5.10%             | 4.46%         | supported   | 103.06s         | 23.51× realtime  | $0.2019     |
| 12   | <code>grok-speech-to-text</code>              | 94.25/100 quality score | 94.25       | 5.75%             | 5.23%         | supported   | 29.32s          | 82.64× realtime  | $0.0673     |


## Provider Detail

| Provider                                      | Group                           | Diarization | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Throughput       | Actual Cost |
| --------------------------------------------- | ------------------------------- | ----------- | ----------: | ----------------: | ------------: | --------------: | ---------------: | ----------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | Third-Party Service Diarization | supported   | 98.81       | 1.19%             | 1.20%         | 17.81s          | 136.06× realtime | $0.1548     |
| <code>assemblyai-universal-3-5-pro</code>     | Third-Party Service Diarization | supported   | 98.44       | 1.56%             | 1.34%         | 45.53s          | 53.21× realtime  | $0.1548     |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | Third-Party Service Diarization | supported   | 97.43       | 2.57%             | 2.39%         | 70.09s          | 34.57× realtime  | $0.2100     |
| <code>deepgram-nova-3</code>                  | Third-Party Service Diarization | supported   | 96.32       | 3.68%             | 2.58%         | 8.93s           | 271.37× realtime | $0.1737     |
| <code>gemini-stt-gemini-3.5-transcribe</code> | Third-Party Service Diarization | supported   | 94.90       | 5.10%             | 4.46%         | 103.06s         | 23.51× realtime  | $0.2019     |
| <code>gladia-solaria-3</code>                 | Third-Party Service Diarization | supported   | 98.00       | 2.00%             | 1.75%         | 39.28s          | 61.69× realtime  | $0.4106     |
| <code>grok-grok-voice-transcribe-2.0</code>   | Third-Party Service Diarization | supported   | 98.09       | 1.91%             | 1.88%         | 53.24s          | 45.51× realtime  | $0.0673     |
| <code>grok-speech-to-text</code>              | Third-Party Service Diarization | supported   | 94.25       | 5.75%             | 5.23%         | 29.32s          | 82.64× realtime  | $0.0673     |
| <code>happyscribe-auto</code>                 | Third-Party Service Diarization | supported   | 98.53       | 1.47%             | 1.23%         | 124.01s         | 19.54× realtime  | $0.4038     |
| <code>mistral-voxtral-mini-2602</code>        | Third-Party Service Diarization | supported   | 98.37       | 1.63%             | 1.43%         | 33.26s          | 72.84× realtime  | $0.1212     |
| <code>soniox-stt-async-v5</code>              | Third-Party Service Diarization | supported   | 98.07       | 1.93%             | 1.74%         | 83.25s          | 29.10× realtime  | $0.0673     |
| <code>speechmatics-melia-1</code>             | Third-Party Service Diarization | supported   | 97.38       | 2.62%             | 2.42%         | 22.74s          | 106.54× realtime | $0.0868     |

## Error Breakdown (Speaker-aware)

| Provider                                      | Substitutions | Deletions | Insertions | Ref. Words |
| --------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | 40            | 34        | 23         | 8182       |
| <code>assemblyai-universal-3-5-pro</code>     | 61            | 39        | 28         | 8180       |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | 97            | 73        | 40         | 8175       |
| <code>deepgram-nova-3</code>                  | 116           | 128       | 57         | 8173       |
| <code>gemini-stt-gemini-3.5-transcribe</code> | 96            | 184       | 137        | 8182       |
| <code>gladia-solaria-3</code>                 | 84            | 60        | 20         | 8182       |
| <code>grok-grok-voice-transcribe-2.0</code>   | 88            | 38        | 30         | 8172       |
| <code>grok-speech-to-text</code>              | 114           | 315       | 41         | 8177       |
| <code>happyscribe-auto</code>                 | 67            | 31        | 22         | 8181       |
| <code>mistral-voxtral-mini-2602</code>        | 68            | 34        | 31         | 8180       |
| <code>soniox-stt-async-v5</code>              | 99            | 24        | 35         | 8178       |
| <code>speechmatics-melia-1</code>             | 111           | 50        | 53         | 8179       |

## Error Breakdown (Text-only)

| Provider                                      | Substitutions | Deletions | Insertions | Ref. Words |
| --------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | 40            | 34        | 23         | 8110       |
| <code>assemblyai-universal-3-5-pro</code>     | 48            | 34        | 27         | 8108       |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | 95            | 61        | 38         | 8103       |
| <code>deepgram-nova-3</code>                  | 101           | 72        | 36         | 8101       |
| <code>gemini-stt-gemini-3.5-transcribe</code> | 91            | 132       | 139        | 8110       |
| <code>gladia-solaria-3</code>                 | 70            | 54        | 18         | 8110       |
| <code>grok-grok-voice-transcribe-2.0</code>   | 86            | 38        | 28         | 8100       |
| <code>grok-speech-to-text</code>              | 100           | 288       | 36         | 8105       |
| <code>happyscribe-auto</code>                 | 52            | 27        | 21         | 8109       |
| <code>mistral-voxtral-mini-2602</code>        | 55            | 31        | 30         | 8108       |
| <code>soniox-stt-async-v5</code>              | 85            | 23        | 33         | 8106       |
| <code>speechmatics-melia-1</code>             | 98            | 46        | 52         | 8107       |

## Error Attribution (Speaker-aware)

| Provider                                      | Strict Edits | Disfluency | Orthographic | Number/Format | Neutral Edits | Speaker Attribution | Residual Number/Format | Other Lexical |
| --------------------------------------------- | -----------: | ---------: | -----------: | ------------: | ------------: | ------------------: | ---------------------: | ------------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | 142          | 10         | 24           | 11            | 97            | 0                   | 2                      | 95            |
| <code>assemblyai-universal-3-5-pro</code>     | 174          | 10         | 24           | 12            | 128           | 17                  | 1                      | 110           |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | 303          | 2          | 87           | 4             | 210           | 16                  | 3                      | 191           |
| <code>deepgram-nova-3</code>                  | 394          | 0          | 90           | 3             | 301           | 91                  | 3                      | 207           |
| <code>gemini-stt-gemini-3.5-transcribe</code> | 445          | 6          | 22           | 0             | 417           | 56                  | 1                      | 360           |
| <code>gladia-solaria-3</code>                 | 216          | 5          | 32           | 15            | 164           | 24                  | 4                      | 136           |
| <code>grok-grok-voice-transcribe-2.0</code>   | 199          | 4          | 38           | 1             | 156           | 4                   | 1                      | 151           |
| <code>grok-speech-to-text</code>              | 631          | 13         | 130          | 18            | 470           | 47                  | 2                      | 421           |
| <code>happyscribe-auto</code>                 | 165          | 10         | 27           | 8             | 120           | 17                  | 1                      | 102           |
| <code>mistral-voxtral-mini-2602</code>        | 178          | 10         | 30           | 5             | 133           | 15                  | 1                      | 117           |
| <code>soniox-stt-async-v5</code>              | 200          | 11         | 31           | 0             | 158           | 18                  | 1                      | 139           |
| <code>speechmatics-melia-1</code>             | 256          | 9          | 30           | 3             | 214           | 19                  | 0                      | 195           |

## Speaker Metrics

| Provider                                      | Ref. Speakers | Provider Speakers | Count Error | Word Attribution Accuracy | Legacy Score / 100 | Legacy Speaker-aware WER |
| --------------------------------------------- | ------------: | ----------------: | ----------: | ------------------------: | -----------------: | -----------------------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | 2             | 2                 | 0           | 100.00%                   | 98.28              | 1.72%                    |
| <code>assemblyai-universal-3-5-pro</code>     | 2             | 2                 | 0           | 73.12%                    | 97.89              | 2.11%                    |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | 2             | 2                 | 0           | 99.69%                    | 96.33              | 3.67%                    |
| <code>deepgram-nova-3</code>                  | 2             | 2                 | 0           | 69.39%                    | 95.22              | 4.78%                    |
| <code>gemini-stt-gemini-3.5-transcribe</code> | 2             | 4                 | 2           | 79.57%                    | 94.60              | 5.40%                    |
| <code>gladia-solaria-3</code>                 | 2             | 2                 | 0           | 73.04%                    | 97.38              | 2.62%                    |
| <code>grok-grok-voice-transcribe-2.0</code>   | 2             | 3                 | 1           | 99.96%                    | 97.59              | 2.41%                    |
| <code>grok-speech-to-text</code>              | 2             | 2                 | 0           | 73.11%                    | 92.35              | 7.65%                    |
| <code>happyscribe-auto</code>                 | 2             | 2                 | 0           | 73.13%                    | 98.00              | 2.00%                    |
| <code>mistral-voxtral-mini-2602</code>        | 2             | 2                 | 0           | 73.32%                    | 97.84              | 2.16%                    |
| <code>soniox-stt-async-v5</code>              | 2             | 3                 | 1           | 73.31%                    | 97.57              | 2.43%                    |
| <code>speechmatics-melia-1</code>             | 2             | 2                 | 0           | 73.25%                    | 96.90              | 3.10%                    |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `assemblyai-assemblyai-stt-3-7` was the most accurate provider on neutral speaker-aware WER (scoring version 2.1), scoring 98.81/100.
- `deepgram-nova-3` was the fastest provider in this set at 8.93s.
- `deepgram-nova-3` lost the most ground once speaker changes were counted, with 1.10 percentage-point gap between text-only and speaker-aware WER.
