# Consensus Transcript Comparison Report

## Summary

- Run directory: `docs/benchmarks/stt/settings/lossless-mistral-voxtral-mini-2602__2023-04-05-jsjam-react-miami-2023-10-minutes`
- Total providers: 1 (0 local, 1 third-party service)
- Local, third-party non-diarization, and third-party diarization providers are ranked separately for price, speed, and quality score.
- Quality score uses neutral speaker-aware WER-derived transcript accuracy (scoring version 2.1: `max(0, 100 * (1 - neutralSpeakerAwareWER))`), with text-only WER and the legacy score retained as supporting evidence.
- Reference transcript: `docs/benchmarks/stt/with-speakers/2023-04-05-jsjam-react-miami-2023-10-minutes/consensus-transcription.txt` via `reference-source.json` (SHA-256 `0b40c081fd375e1e0a37be6beb6ed6fed341061fbdac93c6c15ea0249161d5e1`).

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

| Rank | Provider                                                           | Value   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput      | Actual Cost |
| ---: | ------------------------------------------------------------------ | ------: | ----------: | ----------------: | ------------: | ----------- | --------------: | --------------: | ----------: |
| 1    | <code>mistral-voxtral-mini-2602[stt-audio-profile=lossless]</code> | $0.0300 | 97.08       | 2.92%             | 2.54%         | supported   | 8.98s           | 66.84× realtime | $0.0300     |

#### Speed

| Rank | Provider                                                           | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput      | Actual Cost |
| ---: | ------------------------------------------------------------------ | ----: | ----------: | ----------------: | ------------: | ----------- | --------------: | --------------: | ----------: |
| 1    | <code>mistral-voxtral-mini-2602[stt-audio-profile=lossless]</code> | 8.98s | 97.08       | 2.92%             | 2.54%         | supported   | 8.98s           | 66.84× realtime | $0.0300     |

#### Quality Score

| Rank | Provider                                                           | Value                   | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Throughput      | Actual Cost |
| ---: | ------------------------------------------------------------------ | ----------------------: | ----------: | ----------------: | ------------: | ----------- | --------------: | --------------: | ----------: |
| 1    | <code>mistral-voxtral-mini-2602[stt-audio-profile=lossless]</code> | 97.08/100 quality score | 97.08       | 2.92%             | 2.54%         | supported   | 8.98s           | 66.84× realtime | $0.0300     |


## Provider Detail

| Provider                                                           | Group                           | Diarization | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Throughput      | Actual Cost |
| ------------------------------------------------------------------ | ------------------------------- | ----------- | ----------: | ----------------: | ------------: | --------------: | --------------: | ----------: |
| <code>mistral-voxtral-mini-2602[stt-audio-profile=lossless]</code> | Third-Party Service Diarization | supported   | 97.08       | 2.92%             | 2.54%         | 8.98s           | 66.84× realtime | $0.0300     |

## Error Breakdown (Speaker-aware)

| Provider                                                           | Substitutions | Deletions | Insertions | Ref. Words |
| ------------------------------------------------------------------ | ------------: | --------: | ---------: | ---------: |
| <code>mistral-voxtral-mini-2602[stt-audio-profile=lossless]</code> | 14            | 30        | 5          | 1677       |

## Error Breakdown (Text-only)

| Provider                                                           | Substitutions | Deletions | Insertions | Ref. Words |
| ------------------------------------------------------------------ | ------------: | --------: | ---------: | ---------: |
| <code>mistral-voxtral-mini-2602[stt-audio-profile=lossless]</code> | 13            | 25        | 4          | 1656       |

## Error Attribution (Speaker-aware)

| Provider                                                           | Strict Edits | Disfluency | Orthographic | Number/Format | Neutral Edits | Speaker Attribution | Residual Number/Format | Other Lexical |
| ------------------------------------------------------------------ | -----------: | ---------: | -----------: | ------------: | ------------: | ------------------: | ---------------------: | ------------: |
| <code>mistral-voxtral-mini-2602[stt-audio-profile=lossless]</code> | 97           | 36         | 12           | 0             | 49            | 7                   | 0                      | 42            |

## Speaker Metrics

| Provider                                                           | Ref. Speakers | Provider Speakers | Count Error | Word Attribution Accuracy | Legacy Score / 100 | Legacy Speaker-aware WER |
| ------------------------------------------------------------------ | ------------: | ----------------: | ----------: | ------------------------: | -----------------: | -----------------------: |
| <code>mistral-voxtral-mini-2602[stt-audio-profile=lossless]</code> | 6             | 6                 | 0           | 98.76%                    | 94.37              | 5.63%                    |

## Quality Flags

No provider quality flags were detected.

## Duplicate Groups

No duplicate transcript groups were detected.

## Notes

- `mistral-voxtral-mini-2602[stt-audio-profile=lossless]` was the most accurate provider on neutral speaker-aware WER (scoring version 2.1), scoring 97.08/100.
- `mistral-voxtral-mini-2602[stt-audio-profile=lossless]` was the fastest provider in this set at 8.98s.
- `mistral-voxtral-mini-2602[stt-audio-profile=lossless]` lost the most ground once speaker changes were counted, with 0.39 percentage-point gap between text-only and speaker-aware WER.
