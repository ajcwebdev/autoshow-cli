# Consensus Transcript Comparison Report

## Summary

- Run directory: `docs/benchmarks/stt/with-speakers/2023-03-15-jsjam-qwik-misko-hevery`
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
| 1    | <code>grok-grok-voice-transcribe-2.0</code>   | $0.1881 | 96.77       | 3.23%             | 2.87%         | supported   | 216.03s         | 31.35× realtime  | $0.1881     |
| 2    | <code>grok-speech-to-text</code>              | $0.1881 | 94.25       | 5.75%             | 5.39%         | supported   | 71.45s          | 94.78× realtime  | $0.1881     |
| 3    | <code>soniox-stt-async-v5</code>              | $0.1881 | 96.89       | 3.11%             | 2.72%         | supported   | 155.42s         | 43.57× realtime  | $0.1881     |
| 4    | <code>speechmatics-melia-1</code>             | $0.2427 | 94.48       | 5.52%             | 5.35%         | supported   | 48.30s          | 140.20× realtime | $0.2427     |
| 5    | <code>mistral-voxtral-mini-2602</code>        | $0.3386 | 96.02       | 3.98%             | 3.85%         | supported   | 73.00s          | 92.76× realtime  | $0.3386     |
| 6    | <code>assemblyai-assemblyai-stt-3-7</code>    | $0.4327 | 97.59       | 2.41%             | 2.17%         | supported   | 29.87s          | 226.70× realtime | $0.4327     |
| 7    | <code>assemblyai-universal-3-5-pro</code>     | $0.4327 | 97.39       | 2.61%             | 2.13%         | supported   | 75.36s          | 89.87× realtime  | $0.4327     |
| 8    | <code>deepgram-nova-3</code>                  | $0.4853 | 96.19       | 3.81%             | 3.38%         | supported   | 16.42s          | 412.52× realtime | $0.4853     |
| 9    | <code>gemini-stt-gemini-3.5-transcribe</code> | $0.5643 | 91.10       | 8.90%             | 8.71%         | supported   | 263.82s         | 25.67× realtime  | $0.5643     |
| 10   | <code>cloudflare-@cf_deepgram_nova-3</code>   | $0.5869 | 96.36       | 3.64%             | 3.44%         | supported   | 122.08s         | 55.47× realtime  | $0.5869     |
| 11   | <code>happyscribe-auto</code>                 | $1.1287 | 97.15       | 2.85%             | 2.27%         | supported   | 128.38s         | 52.75× realtime  | $1.1287     |
| 12   | <code>gladia-solaria-3</code>                 | $1.1475 | 96.80       | 3.20%             | 2.96%         | supported   | 76.34s          | 88.70× realtime  | $1.1475     |

#### Speed

| Rank | Provider                                      | Value   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput       | Actual Cost |
| ---: | --------------------------------------------- | ------: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------------: | ----------: |
| 1    | <code>deepgram-nova-3</code>                  | 16.42s  | 96.19       | 3.81%             | 3.38%         | supported   | 16.42s          | 412.52× realtime | $0.4853     |
| 2    | <code>assemblyai-assemblyai-stt-3-7</code>    | 29.87s  | 97.59       | 2.41%             | 2.17%         | supported   | 29.87s          | 226.70× realtime | $0.4327     |
| 3    | <code>speechmatics-melia-1</code>             | 48.30s  | 94.48       | 5.52%             | 5.35%         | supported   | 48.30s          | 140.20× realtime | $0.2427     |
| 4    | <code>grok-speech-to-text</code>              | 71.45s  | 94.25       | 5.75%             | 5.39%         | supported   | 71.45s          | 94.78× realtime  | $0.1881     |
| 5    | <code>mistral-voxtral-mini-2602</code>        | 73.00s  | 96.02       | 3.98%             | 3.85%         | supported   | 73.00s          | 92.76× realtime  | $0.3386     |
| 6    | <code>assemblyai-universal-3-5-pro</code>     | 75.36s  | 97.39       | 2.61%             | 2.13%         | supported   | 75.36s          | 89.87× realtime  | $0.4327     |
| 7    | <code>gladia-solaria-3</code>                 | 76.34s  | 96.80       | 3.20%             | 2.96%         | supported   | 76.34s          | 88.70× realtime  | $1.1475     |
| 8    | <code>cloudflare-@cf_deepgram_nova-3</code>   | 122.08s | 96.36       | 3.64%             | 3.44%         | supported   | 122.08s         | 55.47× realtime  | $0.5869     |
| 9    | <code>happyscribe-auto</code>                 | 128.38s | 97.15       | 2.85%             | 2.27%         | supported   | 128.38s         | 52.75× realtime  | $1.1287     |
| 10   | <code>soniox-stt-async-v5</code>              | 155.42s | 96.89       | 3.11%             | 2.72%         | supported   | 155.42s         | 43.57× realtime  | $0.1881     |
| 11   | <code>grok-grok-voice-transcribe-2.0</code>   | 216.03s | 96.77       | 3.23%             | 2.87%         | supported   | 216.03s         | 31.35× realtime  | $0.1881     |
| 12   | <code>gemini-stt-gemini-3.5-transcribe</code> | 263.82s | 91.10       | 8.90%             | 8.71%         | supported   | 263.82s         | 25.67× realtime  | $0.5643     |

#### Quality Score

| Rank | Provider                                      | Value                   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput       | Actual Cost |
| ---: | --------------------------------------------- | ----------------------: | ----------: | ----------------: | ------------: | ----------- | --------------: | ---------------: | ----------: |
| 1    | <code>assemblyai-assemblyai-stt-3-7</code>    | 97.59/100 quality score | 97.59       | 2.41%             | 2.17%         | supported   | 29.87s          | 226.70× realtime | $0.4327     |
| 2    | <code>assemblyai-universal-3-5-pro</code>     | 97.39/100 quality score | 97.39       | 2.61%             | 2.13%         | supported   | 75.36s          | 89.87× realtime  | $0.4327     |
| 3    | <code>happyscribe-auto</code>                 | 97.15/100 quality score | 97.15       | 2.85%             | 2.27%         | supported   | 128.38s         | 52.75× realtime  | $1.1287     |
| 4    | <code>soniox-stt-async-v5</code>              | 96.89/100 quality score | 96.89       | 3.11%             | 2.72%         | supported   | 155.42s         | 43.57× realtime  | $0.1881     |
| 5    | <code>gladia-solaria-3</code>                 | 96.80/100 quality score | 96.80       | 3.20%             | 2.96%         | supported   | 76.34s          | 88.70× realtime  | $1.1475     |
| 6    | <code>grok-grok-voice-transcribe-2.0</code>   | 96.77/100 quality score | 96.77       | 3.23%             | 2.87%         | supported   | 216.03s         | 31.35× realtime  | $0.1881     |
| 7    | <code>cloudflare-@cf_deepgram_nova-3</code>   | 96.36/100 quality score | 96.36       | 3.64%             | 3.44%         | supported   | 122.08s         | 55.47× realtime  | $0.5869     |
| 8    | <code>deepgram-nova-3</code>                  | 96.19/100 quality score | 96.19       | 3.81%             | 3.38%         | supported   | 16.42s          | 412.52× realtime | $0.4853     |
| 9    | <code>mistral-voxtral-mini-2602</code>        | 96.02/100 quality score | 96.02       | 3.98%             | 3.85%         | supported   | 73.00s          | 92.76× realtime  | $0.3386     |
| 10   | <code>speechmatics-melia-1</code>             | 94.48/100 quality score | 94.48       | 5.52%             | 5.35%         | supported   | 48.30s          | 140.20× realtime | $0.2427     |
| 11   | <code>grok-speech-to-text</code>              | 94.25/100 quality score | 94.25       | 5.75%             | 5.39%         | supported   | 71.45s          | 94.78× realtime  | $0.1881     |
| 12   | <code>gemini-stt-gemini-3.5-transcribe</code> | 91.10/100 quality score | 91.10       | 8.90%             | 8.71%         | supported   | 263.82s         | 25.67× realtime  | $0.5643     |


## Provider Detail

| Provider                                      | Group                           | Diarization | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Throughput       | Actual Cost |
| --------------------------------------------- | ------------------------------- | ----------- | ----------: | ----------------: | ------------: | --------------: | ---------------: | ----------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | Third-Party Service Diarization | supported   | 97.59       | 2.41%             | 2.17%         | 29.87s          | 226.70× realtime | $0.4327     |
| <code>assemblyai-universal-3-5-pro</code>     | Third-Party Service Diarization | supported   | 97.39       | 2.61%             | 2.13%         | 75.36s          | 89.87× realtime  | $0.4327     |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | Third-Party Service Diarization | supported   | 96.36       | 3.64%             | 3.44%         | 122.08s         | 55.47× realtime  | $0.5869     |
| <code>deepgram-nova-3</code>                  | Third-Party Service Diarization | supported   | 96.19       | 3.81%             | 3.38%         | 16.42s          | 412.52× realtime | $0.4853     |
| <code>gemini-stt-gemini-3.5-transcribe</code> | Third-Party Service Diarization | supported   | 91.10       | 8.90%             | 8.71%         | 263.82s         | 25.67× realtime  | $0.5643     |
| <code>gladia-solaria-3</code>                 | Third-Party Service Diarization | supported   | 96.80       | 3.20%             | 2.96%         | 76.34s          | 88.70× realtime  | $1.1475     |
| <code>grok-grok-voice-transcribe-2.0</code>   | Third-Party Service Diarization | supported   | 96.77       | 3.23%             | 2.87%         | 216.03s         | 31.35× realtime  | $0.1881     |
| <code>grok-speech-to-text</code>              | Third-Party Service Diarization | supported   | 94.25       | 5.75%             | 5.39%         | 71.45s          | 94.78× realtime  | $0.1881     |
| <code>happyscribe-auto</code>                 | Third-Party Service Diarization | supported   | 97.15       | 2.85%             | 2.27%         | 128.38s         | 52.75× realtime  | $1.1287     |
| <code>mistral-voxtral-mini-2602</code>        | Third-Party Service Diarization | supported   | 96.02       | 3.98%             | 3.85%         | 73.00s          | 92.76× realtime  | $0.3386     |
| <code>soniox-stt-async-v5</code>              | Third-Party Service Diarization | supported   | 96.89       | 3.11%             | 2.72%         | 155.42s         | 43.57× realtime  | $0.1881     |
| <code>speechmatics-melia-1</code>             | Third-Party Service Diarization | supported   | 94.48       | 5.52%             | 5.35%         | 48.30s          | 140.20× realtime | $0.2427     |

## Error Breakdown (Speaker-aware)

| Provider                                      | Substitutions | Deletions | Insertions | Ref. Words |
| --------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | 146           | 279       | 58         | 20025      |
| <code>assemblyai-universal-3-5-pro</code>     | 175           | 254       | 94         | 20013      |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | 394           | 164       | 170        | 20026      |
| <code>deepgram-nova-3</code>                  | 389           | 203       | 170        | 20026      |
| <code>gemini-stt-gemini-3.5-transcribe</code> | 393           | 1207      | 183        | 20026      |
| <code>gladia-solaria-3</code>                 | 359           | 190       | 92         | 20026      |
| <code>grok-grok-voice-transcribe-2.0</code>   | 372           | 163       | 112        | 20018      |
| <code>grok-speech-to-text</code>              | 408           | 576       | 167        | 20000      |
| <code>happyscribe-auto</code>                 | 165           | 294       | 111        | 20014      |
| <code>mistral-voxtral-mini-2602</code>        | 320           | 396       | 80         | 20022      |
| <code>soniox-stt-async-v5</code>              | 367           | 54        | 202        | 20025      |
| <code>speechmatics-melia-1</code>             | 415           | 597       | 93         | 20024      |

## Error Breakdown (Text-only)

| Provider                                      | Substitutions | Deletions | Insertions | Ref. Words |
| --------------------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | 132           | 257       | 41         | 19853      |
| <code>assemblyai-universal-3-5-pro</code>     | 135           | 239       | 49         | 19841      |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | 366           | 162       | 154        | 19854      |
| <code>deepgram-nova-3</code>                  | 364           | 156       | 151        | 19854      |
| <code>gemini-stt-gemini-3.5-transcribe</code> | 376           | 1184      | 169        | 19854      |
| <code>gladia-solaria-3</code>                 | 340           | 168       | 80         | 19854      |
| <code>grok-grok-voice-transcribe-2.0</code>   | 351           | 125       | 94         | 19846      |
| <code>grok-speech-to-text</code>              | 386           | 536       | 146        | 19828      |
| <code>happyscribe-auto</code>                 | 113           | 285       | 52         | 19842      |
| <code>mistral-voxtral-mini-2602</code>        | 310           | 376       | 79         | 19850      |
| <code>soniox-stt-async-v5</code>              | 337           | 51        | 152        | 19853      |
| <code>speechmatics-melia-1</code>             | 387           | 590       | 85         | 19852      |

## Error Attribution (Speaker-aware)

| Provider                                      | Strict Edits | Disfluency | Orthographic | Number/Format | Neutral Edits | Speaker Attribution | Residual Number/Format | Other Lexical |
| --------------------------------------------- | -----------: | ---------: | -----------: | ------------: | ------------: | ------------------: | ---------------------: | ------------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | 981          | 379        | 89           | 30            | 483           | 52                  | 1                      | 430           |
| <code>assemblyai-universal-3-5-pro</code>     | 1000         | 362        | 83           | 32            | 523           | 100                 | 1                      | 422           |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | 1252         | 51         | 466          | 7             | 728           | 51                  | 17                     | 660           |
| <code>deepgram-nova-3</code>                  | 1295         | 57         | 466          | 10            | 762           | 97                  | 17                     | 648           |
| <code>gemini-stt-gemini-3.5-transcribe</code> | 1995         | 82         | 123          | 7             | 1783          | 57                  | 4                      | 1722          |
| <code>gladia-solaria-3</code>                 | 842          | 78         | 79           | 44            | 641           | 51                  | 7                      | 583           |
| <code>grok-grok-voice-transcribe-2.0</code>   | 768          | 37         | 69           | 15            | 647           | 82                  | 2                      | 563           |
| <code>grok-speech-to-text</code>              | 1582         | 82         | 312          | 37            | 1151          | 85                  | 8                      | 1058          |
| <code>happyscribe-auto</code>                 | 1019         | 351        | 86           | 12            | 570           | 123                 | 1                      | 446           |
| <code>mistral-voxtral-mini-2602</code>        | 1325         | 456        | 70           | 3             | 796           | 32                  | 4                      | 760           |
| <code>soniox-stt-async-v5</code>              | 787          | 99         | 67           | -2            | 623           | 82                  | 7                      | 534           |
| <code>speechmatics-melia-1</code>             | 1485         | 279        | 92           | 9             | 1105          | 43                  | 6                      | 1056          |

## Speaker Metrics

| Provider                                      | Ref. Speakers | Provider Speakers | Count Error | Word Attribution Accuracy | Legacy Score / 100 | Legacy Speaker-aware WER |
| --------------------------------------------- | ------------: | ----------------: | ----------: | ------------------------: | -----------------: | -----------------------: |
| <code>assemblyai-assemblyai-stt-3-7</code>    | 12            | 12                | 0           | 98.37%                    | 95.28              | 4.72%                    |
| <code>assemblyai-universal-3-5-pro</code>     | 12            | 11                | 1           | 99.07%                    | 95.19              | 4.81%                    |
| <code>cloudflare-@cf_deepgram_nova-3</code>   | 12            | 12                | 0           | 99.73%                    | 93.98              | 6.02%                    |
| <code>deepgram-nova-3</code>                  | 12            | 12                | 0           | 98.73%                    | 93.77              | 6.23%                    |
| <code>gemini-stt-gemini-3.5-transcribe</code> | 12            | 26                | 14          | 94.87%                    | 90.40              | 9.60%                    |
| <code>gladia-solaria-3</code>                 | 12            | 13                | 1           | 99.51%                    | 95.95              | 4.05%                    |
| <code>grok-grok-voice-transcribe-2.0</code>   | 12            | 13                | 1           | 99.39%                    | 96.31              | 3.69%                    |
| <code>grok-speech-to-text</code>              | 12            | 13                | 1           | 99.31%                    | 92.39              | 7.61%                    |
| <code>happyscribe-auto</code>                 | 12            | 11                | 1           | 98.96%                    | 95.10              | 4.90%                    |
| <code>mistral-voxtral-mini-2602</code>        | 12            | 19                | 7           | 99.72%                    | 93.63              | 6.37%                    |
| <code>soniox-stt-async-v5</code>              | 12            | 8                 | 4           | 90.84%                    | 96.21              | 3.79%                    |
| <code>speechmatics-melia-1</code>             | 12            | 18                | 6           | 99.79%                    | 92.86              | 7.14%                    |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `assemblyai-assemblyai-stt-3-7` was the most accurate provider on neutral speaker-aware WER (scoring version 2.1), scoring 97.59/100.
- `deepgram-nova-3` was the fastest provider in this set at 16.42s.
- `happyscribe-auto` lost the most ground once speaker changes were counted, with 0.58 percentage-point gap between text-only and speaker-aware WER.
