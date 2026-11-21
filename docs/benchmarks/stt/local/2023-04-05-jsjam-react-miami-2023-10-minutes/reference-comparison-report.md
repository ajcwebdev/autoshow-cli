# Consensus Transcript Comparison Report

## Summary

- Run directory: `docs/benchmarks/stt/local/2023-04-05-jsjam-react-miami-2023-10-minutes`
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
| 1    | <code>whisperfile-large-v2</code>  | $0.00 local monetary cost | 96.46       | 3.54%             | 2.55%         | not-supported | 203.35s         | 2.95× realtime  | $0.00       |
| 2    | <code>whisperfile-large-v3</code>  | $0.00 local monetary cost | 0.00        | 172.66%           | 173.96%       | not-supported | 358.53s         | 1.67× realtime  | $0.00       |
| 3    | <code>whisperfile-medium</code>    | $0.00 local monetary cost | 95.92       | 4.08%             | 3.09%         | not-supported | 110.44s         | 5.43× realtime  | $0.00       |
| 4    | <code>whisperfile-medium.en</code> | $0.00 local monetary cost | 92.26       | 7.74%             | 6.79%         | not-supported | 96.94s          | 6.19× realtime  | $0.00       |
| 5    | <code>whisperfile-small</code>     | $0.00 local monetary cost | 88.79       | 11.21%            | 10.36%        | not-supported | 41.78s          | 14.36× realtime | $0.00       |
| 6    | <code>whisperfile-small.en</code>  | $0.00 local monetary cost | 94.84       | 5.16%             | 4.18%         | not-supported | 39.73s          | 15.10× realtime | $0.00       |
| 7    | <code>whisperfile-tiny</code>      | $0.00 local monetary cost | 92.33       | 7.67%             | 6.78%         | not-supported | 8.41s           | 71.35× realtime | $0.00       |
| 8    | <code>whisperfile-tiny.en</code>   | $0.00 local monetary cost | 92.21       | 7.79%             | 7.03%         | not-supported | 10.84s          | 55.35× realtime | $0.00       |

#### Speed

| Rank | Provider                           | Value   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time | Throughput      | Actual Cost |
| ---: | ---------------------------------- | ------: | ----------: | ----------------: | ------------: | ------------- | --------------: | --------------: | ----------: |
| 1    | <code>whisperfile-tiny</code>      | 8.41s   | 92.33       | 7.67%             | 6.78%         | not-supported | 8.41s           | 71.35× realtime | $0.00       |
| 2    | <code>whisperfile-tiny.en</code>   | 10.84s  | 92.21       | 7.79%             | 7.03%         | not-supported | 10.84s          | 55.35× realtime | $0.00       |
| 3    | <code>whisperfile-small.en</code>  | 39.73s  | 94.84       | 5.16%             | 4.18%         | not-supported | 39.73s          | 15.10× realtime | $0.00       |
| 4    | <code>whisperfile-small</code>     | 41.78s  | 88.79       | 11.21%            | 10.36%        | not-supported | 41.78s          | 14.36× realtime | $0.00       |
| 5    | <code>whisperfile-medium.en</code> | 96.94s  | 92.26       | 7.74%             | 6.79%         | not-supported | 96.94s          | 6.19× realtime  | $0.00       |
| 6    | <code>whisperfile-medium</code>    | 110.44s | 95.92       | 4.08%             | 3.09%         | not-supported | 110.44s         | 5.43× realtime  | $0.00       |
| 7    | <code>whisperfile-large-v2</code>  | 203.35s | 96.46       | 3.54%             | 2.55%         | not-supported | 203.35s         | 2.95× realtime  | $0.00       |
| 8    | <code>whisperfile-large-v3</code>  | 358.53s | 0.00        | 172.66%           | 173.96%       | not-supported | 358.53s         | 1.67× realtime  | $0.00       |

#### Quality Score

| Rank | Provider                           | Value                   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time | Throughput      | Actual Cost |
| ---: | ---------------------------------- | ----------------------: | ----------: | ----------------: | ------------: | ------------- | --------------: | --------------: | ----------: |
| 1    | <code>whisperfile-large-v2</code>  | 96.46/100 quality score | 96.46       | 3.54%             | 2.55%         | not-supported | 203.35s         | 2.95× realtime  | $0.00       |
| 2    | <code>whisperfile-medium</code>    | 95.92/100 quality score | 95.92       | 4.08%             | 3.09%         | not-supported | 110.44s         | 5.43× realtime  | $0.00       |
| 3    | <code>whisperfile-small.en</code>  | 94.84/100 quality score | 94.84       | 5.16%             | 4.18%         | not-supported | 39.73s          | 15.10× realtime | $0.00       |
| 4    | <code>whisperfile-tiny</code>      | 92.33/100 quality score | 92.33       | 7.67%             | 6.78%         | not-supported | 8.41s           | 71.35× realtime | $0.00       |
| 5    | <code>whisperfile-medium.en</code> | 92.26/100 quality score | 92.26       | 7.74%             | 6.79%         | not-supported | 96.94s          | 6.19× realtime  | $0.00       |
| 6    | <code>whisperfile-tiny.en</code>   | 92.21/100 quality score | 92.21       | 7.79%             | 7.03%         | not-supported | 10.84s          | 55.35× realtime | $0.00       |
| 7    | <code>whisperfile-small</code>     | 88.79/100 quality score | 88.79       | 11.21%            | 10.36%        | not-supported | 41.78s          | 14.36× realtime | $0.00       |
| 8    | <code>whisperfile-large-v3</code>  | 0.00/100 quality score  | 0.00        | 172.66%           | 173.96%       | not-supported | 358.53s         | 1.67× realtime  | $0.00       |

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
| <code>whisperfile-large-v2</code>  | Local | not-supported | 96.46       | 3.54%             | 2.55%         | 203.35s         | 2.95× realtime  | $0.00       |
| <code>whisperfile-large-v3</code>  | Local | not-supported | 0.00        | 172.66%           | 173.96%       | 358.53s         | 1.67× realtime  | $0.00       |
| <code>whisperfile-medium</code>    | Local | not-supported | 95.92       | 4.08%             | 3.09%         | 110.44s         | 5.43× realtime  | $0.00       |
| <code>whisperfile-medium.en</code> | Local | not-supported | 92.26       | 7.74%             | 6.79%         | 96.94s          | 6.19× realtime  | $0.00       |
| <code>whisperfile-small</code>     | Local | not-supported | 88.79       | 11.21%            | 10.36%        | 41.78s          | 14.36× realtime | $0.00       |
| <code>whisperfile-small.en</code>  | Local | not-supported | 94.84       | 5.16%             | 4.18%         | 39.73s          | 15.10× realtime | $0.00       |
| <code>whisperfile-tiny</code>      | Local | not-supported | 92.33       | 7.67%             | 6.78%         | 8.41s           | 71.35× realtime | $0.00       |
| <code>whisperfile-tiny.en</code>   | Local | not-supported | 92.21       | 7.79%             | 7.03%         | 10.84s          | 55.35× realtime | $0.00       |

## Error Breakdown (Speaker-aware)

| Provider                           | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>whisperfile-large-v2</code>  | 14            | 37        | 8          | 1667       |
| <code>whisperfile-large-v3</code>  | 606           | 9         | 2265       | 1668       |
| <code>whisperfile-medium</code>    | 27            | 32        | 9          | 1668       |
| <code>whisperfile-medium.en</code> | 49            | 53        | 27         | 1667       |
| <code>whisperfile-small</code>     | 43            | 80        | 64         | 1668       |
| <code>whisperfile-small.en</code>  | 35            | 33        | 18         | 1668       |
| <code>whisperfile-tiny</code>      | 74            | 43        | 11         | 1668       |
| <code>whisperfile-tiny.en</code>   | 63            | 39        | 28         | 1668       |

## Error Breakdown (Text-only)

| Provider                           | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>whisperfile-large-v2</code>  | 12            | 22        | 8          | 1650       |
| <code>whisperfile-large-v3</code>  | 596           | 2         | 2274       | 1651       |
| <code>whisperfile-medium</code>    | 24            | 18        | 9          | 1651       |
| <code>whisperfile-medium.en</code> | 44            | 40        | 28         | 1650       |
| <code>whisperfile-small</code>     | 39            | 67        | 65         | 1651       |
| <code>whisperfile-small.en</code>  | 32            | 19        | 18         | 1651       |
| <code>whisperfile-tiny</code>      | 68            | 31        | 13         | 1651       |
| <code>whisperfile-tiny.en</code>   | 56            | 28        | 32         | 1651       |

## Error Attribution (Speaker-aware)

| Provider                           | Strict Edits | Disfluency | Orthographic | Number/Format | Neutral Edits | Speaker Attribution | Residual Number/Format | Other Lexical |
| ---------------------------------- | -----------: | ---------: | -----------: | ------------: | ------------: | ------------------: | ---------------------: | ------------: |
| <code>whisperfile-large-v2</code>  | 109          | 26         | 24           | 0             | 59            | 17                  | 0                      | 42            |
| <code>whisperfile-large-v3</code>  | 2924         | 17         | 27           | 0             | 2880          | 17                  | 2                      | 2861          |
| <code>whisperfile-medium</code>    | 104          | 14         | 22           | 0             | 68            | 17                  | 0                      | 51            |
| <code>whisperfile-medium.en</code> | 148          | 9          | 10           | 0             | 129           | 17                  | 0                      | 112           |
| <code>whisperfile-small</code>     | 203          | 4          | 12           | 0             | 187           | 17                  | 0                      | 170           |
| <code>whisperfile-small.en</code>  | 109          | 10         | 13           | 0             | 86            | 17                  | 0                      | 69            |
| <code>whisperfile-tiny</code>      | 170          | 16         | 26           | 0             | 128           | 17                  | 0                      | 111           |
| <code>whisperfile-tiny.en</code>   | 165          | 21         | 14           | 0             | 130           | 17                  | 1                      | 112           |

## Speaker Metrics

| Provider                           | Ref. Speakers | Provider Speakers | Count Error | Word Attribution Accuracy | Legacy Score / 100 | Legacy Speaker-aware WER |
| ---------------------------------- | ------------: | ----------------: | ----------: | ------------------------: | -----------------: | -----------------------: |
| <code>whisperfile-large-v2</code>  | 6             | 0                 | n/a         | n/a                       | 93.57              | 6.43%                    |
| <code>whisperfile-large-v3</code>  | 6             | 0                 | n/a         | n/a                       | 0.00               | 172.51%                  |
| <code>whisperfile-medium</code>    | 6             | 0                 | n/a         | n/a                       | 93.86              | 6.14%                    |
| <code>whisperfile-medium.en</code> | 6             | 0                 | n/a         | n/a                       | 91.27              | 8.73%                    |
| <code>whisperfile-small</code>     | 6             | 0                 | n/a         | n/a                       | 88.02              | 11.98%                   |
| <code>whisperfile-small.en</code>  | 6             | 0                 | n/a         | n/a                       | 93.57              | 6.43%                    |
| <code>whisperfile-tiny</code>      | 6             | 0                 | n/a         | n/a                       | 89.97              | 10.03%                   |
| <code>whisperfile-tiny.en</code>   | 6             | 0                 | n/a         | n/a                       | 90.27              | 9.73%                    |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `whisperfile-large-v2` was the most accurate provider on neutral speaker-aware WER (scoring version 2.1), scoring 96.46/100.
- Actual provider cost data was unavailable in `manifest.json`.
- `whisperfile-tiny` was the fastest provider in this set at 8.41s.
- `whisperfile-large-v2` lost the most ground once speaker changes were counted, with 0.99 percentage-point gap between text-only and speaker-aware WER.
