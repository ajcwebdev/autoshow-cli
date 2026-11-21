# Consensus Transcript Comparison Report

## Summary

- Run directory: `docs/benchmarks/stt/local/1-audio`
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
| 1    | <code>whisperfile-large-v2</code>  | $0.00 local monetary cost | 96.26       | 3.74%             | 1.90%         | not-supported | 28.79s          | 2.05× realtime  | $0.00       |
| 2    | <code>whisperfile-large-v3</code>  | $0.00 local monetary cost | 97.20       | 2.80%             | 0.95%         | not-supported | 28.30s          | 2.08× realtime  | $0.00       |
| 3    | <code>whisperfile-medium</code>    | $0.00 local monetary cost | 95.33       | 4.67%             | 2.86%         | not-supported | 14.55s          | 4.06× realtime  | $0.00       |
| 4    | <code>whisperfile-medium.en</code> | $0.00 local monetary cost | 97.20       | 2.80%             | 0.95%         | not-supported | 13.56s          | 4.35× realtime  | $0.00       |
| 5    | <code>whisperfile-small</code>     | $0.00 local monetary cost | 90.65       | 9.35%             | 7.62%         | not-supported | 4.57s           | 12.91× realtime | $0.00       |
| 6    | <code>whisperfile-small.en</code>  | $0.00 local monetary cost | 97.20       | 2.80%             | 0.95%         | not-supported | 4.73s           | 12.48× realtime | $0.00       |
| 7    | <code>whisperfile-tiny</code>      | $0.00 local monetary cost | 88.32       | 11.68%            | 10.00%        | not-supported | 1.06s           | 55.50× realtime | $0.00       |
| 8    | <code>whisperfile-tiny.en</code>   | $0.00 local monetary cost | 97.20       | 2.80%             | 0.95%         | not-supported | 1.08s           | 54.73× realtime | $0.00       |

#### Speed

| Rank | Provider                           | Value  | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time | Throughput      | Actual Cost |
| ---: | ---------------------------------- | -----: | ----------: | ----------------: | ------------: | ------------- | --------------: | --------------: | ----------: |
| 1    | <code>whisperfile-tiny</code>      | 1.06s  | 88.32       | 11.68%            | 10.00%        | not-supported | 1.06s           | 55.50× realtime | $0.00       |
| 2    | <code>whisperfile-tiny.en</code>   | 1.08s  | 97.20       | 2.80%             | 0.95%         | not-supported | 1.08s           | 54.73× realtime | $0.00       |
| 3    | <code>whisperfile-small</code>     | 4.57s  | 90.65       | 9.35%             | 7.62%         | not-supported | 4.57s           | 12.91× realtime | $0.00       |
| 4    | <code>whisperfile-small.en</code>  | 4.73s  | 97.20       | 2.80%             | 0.95%         | not-supported | 4.73s           | 12.48× realtime | $0.00       |
| 5    | <code>whisperfile-medium.en</code> | 13.56s | 97.20       | 2.80%             | 0.95%         | not-supported | 13.56s          | 4.35× realtime  | $0.00       |
| 6    | <code>whisperfile-medium</code>    | 14.55s | 95.33       | 4.67%             | 2.86%         | not-supported | 14.55s          | 4.06× realtime  | $0.00       |
| 7    | <code>whisperfile-large-v3</code>  | 28.30s | 97.20       | 2.80%             | 0.95%         | not-supported | 28.30s          | 2.08× realtime  | $0.00       |
| 8    | <code>whisperfile-large-v2</code>  | 28.79s | 96.26       | 3.74%             | 1.90%         | not-supported | 28.79s          | 2.05× realtime  | $0.00       |

#### Quality Score

| Rank | Provider                           | Value                   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization   | Processing Time | Throughput      | Actual Cost |
| ---: | ---------------------------------- | ----------------------: | ----------: | ----------------: | ------------: | ------------- | --------------: | --------------: | ----------: |
| 1    | <code>whisperfile-large-v3</code>  | 97.20/100 quality score | 97.20       | 2.80%             | 0.95%         | not-supported | 28.30s          | 2.08× realtime  | $0.00       |
| 2    | <code>whisperfile-medium.en</code> | 97.20/100 quality score | 97.20       | 2.80%             | 0.95%         | not-supported | 13.56s          | 4.35× realtime  | $0.00       |
| 3    | <code>whisperfile-small.en</code>  | 97.20/100 quality score | 97.20       | 2.80%             | 0.95%         | not-supported | 4.73s           | 12.48× realtime | $0.00       |
| 4    | <code>whisperfile-tiny.en</code>   | 97.20/100 quality score | 97.20       | 2.80%             | 0.95%         | not-supported | 1.08s           | 54.73× realtime | $0.00       |
| 5    | <code>whisperfile-large-v2</code>  | 96.26/100 quality score | 96.26       | 3.74%             | 1.90%         | not-supported | 28.79s          | 2.05× realtime  | $0.00       |
| 6    | <code>whisperfile-medium</code>    | 95.33/100 quality score | 95.33       | 4.67%             | 2.86%         | not-supported | 14.55s          | 4.06× realtime  | $0.00       |
| 7    | <code>whisperfile-small</code>     | 90.65/100 quality score | 90.65       | 9.35%             | 7.62%         | not-supported | 4.57s           | 12.91× realtime | $0.00       |
| 8    | <code>whisperfile-tiny</code>      | 88.32/100 quality score | 88.32       | 11.68%            | 10.00%        | not-supported | 1.06s           | 55.50× realtime | $0.00       |

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
| <code>whisperfile-large-v2</code>  | Local | not-supported | 96.26       | 3.74%             | 1.90%         | 28.79s          | 2.05× realtime  | $0.00       |
| <code>whisperfile-large-v3</code>  | Local | not-supported | 97.20       | 2.80%             | 0.95%         | 28.30s          | 2.08× realtime  | $0.00       |
| <code>whisperfile-medium</code>    | Local | not-supported | 95.33       | 4.67%             | 2.86%         | 14.55s          | 4.06× realtime  | $0.00       |
| <code>whisperfile-medium.en</code> | Local | not-supported | 97.20       | 2.80%             | 0.95%         | 13.56s          | 4.35× realtime  | $0.00       |
| <code>whisperfile-small</code>     | Local | not-supported | 90.65       | 9.35%             | 7.62%         | 4.57s           | 12.91× realtime | $0.00       |
| <code>whisperfile-small.en</code>  | Local | not-supported | 97.20       | 2.80%             | 0.95%         | 4.73s           | 12.48× realtime | $0.00       |
| <code>whisperfile-tiny</code>      | Local | not-supported | 88.32       | 11.68%            | 10.00%        | 1.06s           | 55.50× realtime | $0.00       |
| <code>whisperfile-tiny.en</code>   | Local | not-supported | 97.20       | 2.80%             | 0.95%         | 1.08s           | 54.73× realtime | $0.00       |

## Error Breakdown (Speaker-aware)

| Provider                           | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>whisperfile-large-v2</code>  | 2             | 5         | 1          | 214        |
| <code>whisperfile-large-v3</code>  | 2             | 4         | 0          | 214        |
| <code>whisperfile-medium</code>    | 5             | 5         | 0          | 214        |
| <code>whisperfile-medium.en</code> | 2             | 4         | 0          | 214        |
| <code>whisperfile-small</code>     | 10            | 10        | 0          | 214        |
| <code>whisperfile-small.en</code>  | 2             | 4         | 0          | 214        |
| <code>whisperfile-tiny</code>      | 15            | 8         | 2          | 214        |
| <code>whisperfile-tiny.en</code>   | 2             | 4         | 0          | 214        |

## Error Breakdown (Text-only)

| Provider                           | Substitutions | Deletions | Insertions | Ref. Words |
| ---------------------------------- | ------------: | --------: | ---------: | ---------: |
| <code>whisperfile-large-v2</code>  | 1             | 2         | 1          | 210        |
| <code>whisperfile-large-v3</code>  | 1             | 1         | 0          | 210        |
| <code>whisperfile-medium</code>    | 4             | 2         | 0          | 210        |
| <code>whisperfile-medium.en</code> | 1             | 1         | 0          | 210        |
| <code>whisperfile-small</code>     | 9             | 7         | 0          | 210        |
| <code>whisperfile-small.en</code>  | 1             | 1         | 0          | 210        |
| <code>whisperfile-tiny</code>      | 14            | 5         | 2          | 210        |
| <code>whisperfile-tiny.en</code>   | 1             | 1         | 0          | 210        |

## Error Attribution (Speaker-aware)

| Provider                           | Strict Edits | Disfluency | Orthographic | Number/Format | Neutral Edits | Speaker Attribution | Residual Number/Format | Other Lexical |
| ---------------------------------- | -----------: | ---------: | -----------: | ------------: | ------------: | ------------------: | ---------------------: | ------------: |
| <code>whisperfile-large-v2</code>  | 15           | 2          | 5            | 0             | 8             | 4                   | 0                      | 4             |
| <code>whisperfile-large-v3</code>  | 12           | 6          | 0            | 0             | 6             | 4                   | 0                      | 2             |
| <code>whisperfile-medium</code>    | 15           | 1          | 4            | 0             | 10            | 4                   | 0                      | 6             |
| <code>whisperfile-medium.en</code> | 11           | 1          | 4            | 0             | 6             | 4                   | 0                      | 2             |
| <code>whisperfile-small</code>     | 27           | 2          | 3            | 2             | 20            | 4                   | 1                      | 15            |
| <code>whisperfile-small.en</code>  | 13           | 2          | 5            | 0             | 6             | 4                   | 0                      | 2             |
| <code>whisperfile-tiny</code>      | 30           | 4          | 1            | 0             | 25            | 4                   | 0                      | 21            |
| <code>whisperfile-tiny.en</code>   | 15           | 5          | 4            | 0             | 6             | 4                   | 0                      | 2             |

## Speaker Metrics

| Provider                           | Ref. Speakers | Provider Speakers | Count Error | Word Attribution Accuracy | Legacy Score / 100 | Legacy Speaker-aware WER |
| ---------------------------------- | ------------: | ----------------: | ----------: | ------------------------: | -----------------: | -----------------------: |
| <code>whisperfile-large-v2</code>  | 2             | 0                 | n/a         | n/a                       | 93.18              | 6.82%                    |
| <code>whisperfile-large-v3</code>  | 2             | 0                 | n/a         | n/a                       | 94.55              | 5.45%                    |
| <code>whisperfile-medium</code>    | 2             | 0                 | n/a         | n/a                       | 93.18              | 6.82%                    |
| <code>whisperfile-medium.en</code> | 2             | 0                 | n/a         | n/a                       | 95.00              | 5.00%                    |
| <code>whisperfile-small</code>     | 2             | 0                 | n/a         | n/a                       | 87.73              | 12.27%                   |
| <code>whisperfile-small.en</code>  | 2             | 0                 | n/a         | n/a                       | 94.09              | 5.91%                    |
| <code>whisperfile-tiny</code>      | 2             | 0                 | n/a         | n/a                       | 86.36              | 13.64%                   |
| <code>whisperfile-tiny.en</code>   | 2             | 0                 | n/a         | n/a                       | 93.18              | 6.82%                    |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `whisperfile-large-v3` was the most accurate provider on neutral speaker-aware WER (scoring version 2.1), scoring 97.20/100.
- Actual provider cost data was unavailable in `manifest.json`.
- `whisperfile-tiny` was the fastest provider in this set at 1.06s.
- `whisperfile-large-v3` lost the most ground once speaker changes were counted, with 1.85 percentage-point gap between text-only and speaker-aware WER.
