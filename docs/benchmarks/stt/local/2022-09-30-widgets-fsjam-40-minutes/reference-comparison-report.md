# Consensus Transcript Comparison Report

## Summary

- Run directory: `docs/benchmarks/stt/local/2022-09-30-widgets-fsjam-40-minutes`
- Total providers: 8 (8 local, 0 third-party service)
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

| Rank | Provider                           | Value                     | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time | Throughput      | Actual Cost |
| ---: | ---------------------------------- | ------------------------: | ----------: | ----------------: | ------------: | ------------- | --------------: | --------------: | ----------: |
| 1    | <code>whisperfile-large-v2</code>  | $0.00 local monetary cost | 96.12       | 3.88%             | 3.13%         | not-supported | 963.11s         | 2.52× realtime  | $0.00       |
| 2    | <code>whisperfile-large-v3</code>  | $0.00 local monetary cost | 94.70       | 5.30%             | 4.56%         | not-supported | 851.22s         | 2.85× realtime  | $0.00       |
| 3    | <code>whisperfile-medium</code>    | $0.00 local monetary cost | 96.05       | 3.95%             | 3.19%         | not-supported | 499.14s         | 4.85× realtime  | $0.00       |
| 4    | <code>whisperfile-medium.en</code> | $0.00 local monetary cost | 96.71       | 3.29%             | 2.52%         | not-supported | 502.69s         | 4.82× realtime  | $0.00       |
| 5    | <code>whisperfile-small</code>     | $0.00 local monetary cost | 95.86       | 4.14%             | 3.39%         | not-supported | 194.64s         | 12.45× realtime | $0.00       |
| 6    | <code>whisperfile-small.en</code>  | $0.00 local monetary cost | 95.85       | 4.15%             | 3.40%         | not-supported | 168.12s         | 14.41× realtime | $0.00       |
| 7    | <code>whisperfile-tiny</code>      | $0.00 local monetary cost | 91.32       | 8.68%             | 8.00%         | not-supported | 39.82s          | 60.85× realtime | $0.00       |
| 8    | <code>whisperfile-tiny.en</code>   | $0.00 local monetary cost | 91.94       | 8.06%             | 7.36%         | not-supported | 40.06s          | 60.49× realtime | $0.00       |

#### Speed

| Rank | Provider                           | Value   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time | Throughput      | Actual Cost |
| ---: | ---------------------------------- | ------: | ----------: | ----------------: | ------------: | ------------- | --------------: | --------------: | ----------: |
| 1    | <code>whisperfile-tiny</code>      | 39.82s  | 91.32       | 8.68%             | 8.00%         | not-supported | 39.82s          | 60.85× realtime | $0.00       |
| 2    | <code>whisperfile-tiny.en</code>   | 40.06s  | 91.94       | 8.06%             | 7.36%         | not-supported | 40.06s          | 60.49× realtime | $0.00       |
| 3    | <code>whisperfile-small.en</code>  | 168.12s | 95.85       | 4.15%             | 3.40%         | not-supported | 168.12s         | 14.41× realtime | $0.00       |
| 4    | <code>whisperfile-small</code>     | 194.64s | 95.86       | 4.14%             | 3.39%         | not-supported | 194.64s         | 12.45× realtime | $0.00       |
| 5    | <code>whisperfile-medium</code>    | 499.14s | 96.05       | 3.95%             | 3.19%         | not-supported | 499.14s         | 4.85× realtime  | $0.00       |
| 6    | <code>whisperfile-medium.en</code> | 502.69s | 96.71       | 3.29%             | 2.52%         | not-supported | 502.69s         | 4.82× realtime  | $0.00       |
| 7    | <code>whisperfile-large-v3</code>  | 851.22s | 94.70       | 5.30%             | 4.56%         | not-supported | 851.22s         | 2.85× realtime  | $0.00       |
| 8    | <code>whisperfile-large-v2</code>  | 963.11s | 96.12       | 3.88%             | 3.13%         | not-supported | 963.11s         | 2.52× realtime  | $0.00       |

#### Quality Score

| Rank | Provider                           | Value                   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time | Throughput      | Actual Cost |
| ---: | ---------------------------------- | ----------------------: | ----------: | ----------------: | ------------: | ------------- | --------------: | --------------: | ----------: |
| 1    | <code>whisperfile-medium.en</code> | 96.71/100 quality score | 96.71       | 3.29%             | 2.52%         | not-supported | 502.69s         | 4.82× realtime  | $0.00       |
| 2    | <code>whisperfile-large-v2</code>  | 96.12/100 quality score | 96.12       | 3.88%             | 3.13%         | not-supported | 963.11s         | 2.52× realtime  | $0.00       |
| 3    | <code>whisperfile-medium</code>    | 96.05/100 quality score | 96.05       | 3.95%             | 3.19%         | not-supported | 499.14s         | 4.85× realtime  | $0.00       |
| 4    | <code>whisperfile-small</code>     | 95.86/100 quality score | 95.86       | 4.14%             | 3.39%         | not-supported | 194.64s         | 12.45× realtime | $0.00       |
| 5    | <code>whisperfile-small.en</code>  | 95.85/100 quality score | 95.85       | 4.15%             | 3.40%         | not-supported | 168.12s         | 14.41× realtime | $0.00       |
| 6    | <code>whisperfile-large-v3</code>  | 94.70/100 quality score | 94.70       | 5.30%             | 4.56%         | not-supported | 851.22s         | 2.85× realtime  | $0.00       |
| 7    | <code>whisperfile-tiny.en</code>   | 91.94/100 quality score | 91.94       | 8.06%             | 7.36%         | not-supported | 40.06s          | 60.49× realtime | $0.00       |
| 8    | <code>whisperfile-tiny</code>      | 91.32/100 quality score | 91.32       | 8.68%             | 8.00%         | not-supported | 39.82s          | 60.85× realtime | $0.00       |

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

| Provider                           | Group | Diarization   | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Throughput      | Actual Cost |
| ---------------------------------- | ----- | ------------- | ----------: | ----------------: | ------------: | --------------: | --------------: | ----------: |
| <code>whisperfile-large-v2</code>  | Local | not-supported | 96.12       | 3.88%             | 3.13%         | 963.11s         | 2.52× realtime  | $0.00       |
| <code>whisperfile-large-v3</code>  | Local | not-supported | 94.70       | 5.30%             | 4.56%         | 851.22s         | 2.85× realtime  | $0.00       |
| <code>whisperfile-medium</code>    | Local | not-supported | 96.05       | 3.95%             | 3.19%         | 499.14s         | 4.85× realtime  | $0.00       |
| <code>whisperfile-medium.en</code> | Local | not-supported | 96.71       | 3.29%             | 2.52%         | 502.69s         | 4.82× realtime  | $0.00       |
| <code>whisperfile-small</code>     | Local | not-supported | 95.86       | 4.14%             | 3.39%         | 194.64s         | 12.45× realtime | $0.00       |
| <code>whisperfile-small.en</code>  | Local | not-supported | 95.85       | 4.15%             | 3.40%         | 168.12s         | 14.41× realtime | $0.00       |
| <code>whisperfile-tiny</code>      | Local | not-supported | 91.32       | 8.68%             | 8.00%         | 39.82s          | 60.85× realtime | $0.00       |
| <code>whisperfile-tiny.en</code>   | Local | not-supported | 91.94       | 8.06%             | 7.36%         | 40.06s          | 60.49× realtime | $0.00       |

## Error Breakdown (Speaker-aware)

| Provider                           | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>whisperfile-large-v2</code>  | 104           | 172       | 40         | 8152       |
| <code>whisperfile-large-v3</code>  | 114           | 155       | 164        | 8163       |
| <code>whisperfile-medium</code>    | 126           | 142       | 54         | 8152       |
| <code>whisperfile-medium.en</code> | 92            | 142       | 34         | 8157       |
| <code>whisperfile-small</code>     | 146           | 138       | 54         | 8160       |
| <code>whisperfile-small.en</code>  | 138           | 139       | 62         | 8160       |
| <code>whisperfile-tiny</code>      | 368           | 223       | 117        | 8157       |
| <code>whisperfile-tiny.en</code>   | 289           | 209       | 160        | 8160       |

## Error Breakdown (Text-only)

| Provider                           | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>whisperfile-large-v2</code>  | 98            | 111       | 44         | 8086       |
| <code>whisperfile-large-v3</code>  | 107           | 94        | 168        | 8097       |
| <code>whisperfile-medium</code>    | 119           | 81        | 58         | 8086       |
| <code>whisperfile-medium.en</code> | 87            | 80        | 37         | 8091       |
| <code>whisperfile-small</code>     | 141           | 76        | 57         | 8094       |
| <code>whisperfile-small.en</code>  | 133           | 77        | 65         | 8094       |
| <code>whisperfile-tiny</code>      | 354           | 167       | 126        | 8091       |
| <code>whisperfile-tiny.en</code>   | 280           | 150       | 166        | 8094       |

## Error Attribution (Speaker-aware)

| Provider                           | Strict Edits | Disfluency | Orthographic | Number/Format | Neutral Edits | Speaker Attribution | Residual Number/Format | Other Lexical |
| ---------------------------------- | -----------: | ---------: | -----------: | ------------: | ------------: | ------------------: | ---------------------: | ------------: |
| <code>whisperfile-large-v2</code>  | 399          | 34         | 40           | 9             | 316           | 65                  | 3                      | 248           |
| <code>whisperfile-large-v3</code>  | 513          | 14         | 56           | 10            | 433           | 65                  | 3                      | 365           |
| <code>whisperfile-medium</code>    | 387          | 16         | 40           | 9             | 322           | 65                  | 3                      | 254           |
| <code>whisperfile-medium.en</code> | 332          | 10         | 46           | 8             | 268           | 65                  | 1                      | 202           |
| <code>whisperfile-small</code>     | 395          | 9          | 40           | 8             | 338           | 65                  | 3                      | 270           |
| <code>whisperfile-small.en</code>  | 405          | 10         | 53           | 3             | 339           | 65                  | 4                      | 270           |
| <code>whisperfile-tiny</code>      | 792          | 16         | 60           | 8             | 708           | 65                  | 9                      | 634           |
| <code>whisperfile-tiny.en</code>   | 722          | 13         | 43           | 8             | 658           | 65                  | 4                      | 589           |

## Speaker Metrics

| Provider                           | Ref. Speakers | Provider Speakers | Count Error | Word Attribution Accuracy | Legacy Score / 100 | Legacy Speaker-aware WER |
| ---------------------------------- | ------------: | ----------------: | ----------: | ------------------------: | -----------------: | -----------------------: |
| <code>whisperfile-large-v2</code>  | 2             | 0                 | n/a         | n/a                       | 95.15              | 4.85%                    |
| <code>whisperfile-large-v3</code>  | 2             | 0                 | n/a         | n/a                       | 93.76              | 6.24%                    |
| <code>whisperfile-medium</code>    | 2             | 0                 | n/a         | n/a                       | 95.30              | 4.70%                    |
| <code>whisperfile-medium.en</code> | 2             | 0                 | n/a         | n/a                       | 95.96              | 4.04%                    |
| <code>whisperfile-small</code>     | 2             | 0                 | n/a         | n/a                       | 95.20              | 4.80%                    |
| <code>whisperfile-small.en</code>  | 2             | 0                 | n/a         | n/a                       | 95.08              | 4.92%                    |
| <code>whisperfile-tiny</code>      | 2             | 0                 | n/a         | n/a                       | 90.37              | 9.63%                    |
| <code>whisperfile-tiny.en</code>   | 2             | 0                 | n/a         | n/a                       | 91.22              | 8.78%                    |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `whisperfile-medium.en` was the most accurate provider on neutral speaker-aware WER (scoring version 2.1), scoring 96.71/100.
- Actual provider cost data was unavailable in `manifest.json`.
- `whisperfile-tiny` was the fastest provider in this set at 39.82s.
- `whisperfile-medium.en` lost the most ground once speaker changes were counted, with 0.76 percentage-point gap between text-only and speaker-aware WER.
