# STT Consensus

Use this category for AutoShow speech-to-text runs with `providers/*/result.json`.

## Packet

```bash
bun scripts/run.ts stt build-packet "$RUN_DIR" --out "$TMP_PACKET"
```

Build the packet before authoring the reference. Author `consensus-transcription.txt` from the sum total of segment evidence across providers in the full multi-provider packet. Use the packet baseline and provider transcripts as evidence, not as automatic truth, and do not copy `prompt.md`, provider summaries, or any single provider output as the consensus transcript.

Preserve canonical speaker labels and timestamps in this line format:

```text
[00:00:10] [speaker-1] Transcript text.
```

Keep one segment per line, chronological timestamps, and stable canonical speaker labels.

## Report

```bash
bun scripts/run.ts stt build-report "$RUN_DIR"
```

For an archive whose historical report rows intentionally outlive their original provider results, preserve those rows while promoting current result artifacts:

```bash
bun scripts/run.ts stt build-report "$RUN_DIR" --preserve-existing
```

Current `result.json` data wins on matching provider keys. Historical-only rows retain their prior scores, costs, and timings. Do not use this flag to conceal an unexpectedly missing current result.

To use a non-default consensus transcript artifact path:

```bash
bun scripts/run.ts stt build-report "$RUN_DIR" --input-text /path/to/consensus-transcription.txt
```

A settings-variant run directory does not need its own consensus transcript. When neither `--input-text` nor `$RUN_DIR/consensus-transcription.txt` exists, `build-report` reads `$RUN_DIR/reference-source.json`:

```json
{ "schemaVersion": 1, "path": "docs/benchmarks/stt/with-speakers/<run>/consensus-transcription.txt", "sha256": "<64 hex chars>" }
```

`path` is repository-relative (absolute paths are rejected) and resolves against the checkout root; the file's SHA-256 must equal `sha256` or the report fails before writing anything. The report JSON records the pointer as `referenceSource`, and the Markdown summary names it.

### Scoring Version 2 (Neutral Headline)

The headline score is `max(0, 100 * (1 - neutralSpeakerAwareWER))`. Report JSON carries `scoringVersion` (currently 2.1; see the version history below) and a `scoringMethod` object whose `description` lines are repeated in the Markdown Method section. `score`, `speakerAwareWER`, `textOnlyWER`, `speakerAwareBreakdown`, and `textOnlyBreakdown` now use the neutral views; the scoring-version-1 values are retained as `legacyScore`, `legacySpeakerAwareWER`, `legacyTextOnlyWER` (also under `metrics`), `legacySpeakerAwareBreakdown`, and `legacyTextOnlyBreakdown`. Rows preserved by `--preserve-existing` from an older report keep their version-1 score and are named in a note.

Every view is applied identically to the reference and the provider transcript. The views are composable pure functions in `scripts/stt/transcript_lib.ts`; with no view enabled the pipeline reproduces the legacy tokenizer.

| View                 | Rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| disfluency-neutral   | Removes fillers (legacy um, uh, hmm, mhm, ah, er plus umm, uhm, uhh, hm, hmmm, mm, mmm, erm, ahh); collapses immediately repeated 1-3-word n-grams within one speaker turn; marks a false-start fragment ending in a dash attached to its last word as optional (free to omit or include) when it has at most three words and the dash is followed by a space, or when the next word restarts it (at most eight words).                                                                                                                                                                                                                   |
| orthographic-neutral | Joins hyphenated compounds and merges split forms of up to four parts into a compound hyphenated on either side; merges a two-word split into a single word seen on either side only when both parts have at least three letters (so "in to" and "a way" never merge); ok, O.K. = okay, all right = alright, can not = cannot, per cent = percent; informal reductions expand to their full form (gonna = going to, wanna = want to, gotta = got to, kinda = kind of, sorta = sort of, apostrophe-initial 'cause = because; bare "cause" is unchanged); ASCII apostrophes expand contractions; abbreviations expand only at a word start. |
| number-neutral       | Spelled cardinals, compounds, scale words, ordinals, decimals, comma thousands, percent, and currency share one digit form (twenty-five = 25, 1,250 = one thousand two hundred fifty, third = 3rd, three point five = 3.5, $5 million = five million dollars). A lone eighteen, nineteen, or twenty followed by a spelled 10-99 or "oh" plus a digit word is a year (twenty twenty three = 2023). Phrase punctuation bounds number parsing.                                                                                                                                                                                               |

Known limits: legitimate repeats ("very very") collapse on both sides; a false start in an unpunctuated provider transcript is only forgiven when the reference marks it; currency singular/plural ("a dollar" vs "$1"), decades ("the nineties"), times ("twelve fifteen" vs "12:15"), and other spelling variants outside the table are not normalized. Because compound merges depend on both sides, the neutral reference word count can differ by a few words per provider.

Version history: 2 introduced the neutral headline. 2.1 added the informal reductions to the orthographic view. They expand identically on both sides, so "going to" (including motion, "going to the store") still matches "going to", and only a form difference such as "gonna" versus "going to" is forgiven. A reduction standing for another phrase ("gotta" for "got a") is read as the listed form. Scores of transcripts that use these forms can rise slightly; regenerate per-run reports before comparing them with 2.0 reports, and the combined report warns when runs mix versions.

Error attribution (`errorAttribution` per provider) enables the views cumulatively in the order disfluency, orthographic, number on speaker-aware edit counts: `strictEdits` is the legacy count, `forgivenByView` holds the edits each step removed (order-dependent; negative when a view adds edits), and `neutralEdits` is the headline count. `remaining` classifies the headline edits from the aligned tokens: `speakerAttribution` (a speaker-change token is involved), `numberFormat` (a substitution with a digit token), and `otherLexical`. The Markdown `## Error Attribution (Speaker-aware)` table shows the same counts.

Speaker metrics (`speakerMetrics` per provider) separate speaker accuracy from speaker-aware WER: `referenceSpeakerCount`, `providerSpeakerCount` (distinct non-unknown labels), `speakerCountAbsoluteError`, and `wordAttributionAccuracy`, the share of matched words in the neutral text-only alignment whose overlap-mapped provider speaker (`mapProviderSpeakers`) equals the reference speaker. Error and accuracy are null for providers without diarization. The Markdown `## Speaker Metrics` table also shows the legacy score.

Alignment is exact for any transcript length: a minimum-edit alignment with a checkpointed traceback (every ⌈√n⌉-th row kept, blocks recomputed for directions) runs in O(n·m) time and O(m·√n) memory and returns the same path as a full-matrix traceback, so substitution/deletion/insertion counts are never unavailable.

### Settings Variants

The same service and model run with non-default settings is a distinct report row keyed `service/model[key=value,...]` with a stable, key-sorted label (also emitted as `settingsLabel`; `provider` shows the directory name plus the label, and `model` stays the bare model). The label is derived from the manifest provider state's `settings.request` and `settings.local`: `verbatim=true`, `responseFormat`, every `diarization` field except `enabled` (for example `speakerCount`), `fillerWords` (any boolean), `numberFormat`, and `audioProfile` other than `default`. Default settings produce no label, so existing rows keep their keys. An optional run-level `variant.json` (`{ "variantId": string, "label": string }`) replaces the derived label for every provider in that run. Variant rows rank alongside default rows in single-run and combined reports, and the dashboard keeps them when their base `service/model` route is supported.

The STT report uses full grouped metric rankings:

1. `## Metric Rankings` contains Local, Third-Party Service Non-Diarization, and Third-Party Service Diarization groups.
2. Each group contains full Price, Speed, and Quality Score tables.
3. JSON exposes `metricRankings.local.price|speed|qualityScore`.
4. JSON exposes `metricRankings.thirdPartyServiceNonDiarization.price|speed|qualityScore`.
5. JSON exposes `metricRankings.thirdPartyServiceDiarization.price|speed|qualityScore`.
6. The single-run JSON does not emit `rankingSurfaces`, `overall`, `overallMetric`, `overallWeights`, or `tiering`; combined cross-run reports keep the same per-group metric rankings and add no weighted composites or model tiers (see Combined Cross-Run Report).

Quality Score rankings use the scoring-version-2 neutral speaker-aware WER-derived score from highest to lowest, with speaker-aware WER, text-only WER, and diarization support retained as evidence. Price rankings use zero monetary cost for local STT providers and reported cost for third-party services, keeping missing service price at the end. Speed rankings keep missing timing at the end.

## Compaction For Git

On a category root such as `docs/benchmarks/stt/with-speakers`, run `compact-archive` so every run is compacted. After a provider has canonical `result.json`, it deletes the per-segment resume tree (`split-attempts/pass_*/segment-runs/segment_*/` plus sliced audio under `segments/`) and whisper sidecars (`transcription.words.json`, `transcription.json`) that duplicate that result. Failed providers without `result.json` keep those checkpoints, including `error.json` and `raw-response.json`. Keep `transcription.txt`. See `references/shared-conventions.md`.

Raw STT `providers/*/result.json` files carry large `result.evidence.words` arrays (per-word timing/confidence) and `result.evidence.rawResponse` blobs that can make a single run tens of megabytes — too large to commit. On a single run, compact them in place with:

```bash
bun scripts/run.ts stt compact-results "$RUN_DIR"
```

This removes:

1. `result.evidence.words` for every provider — never read by the packet or report.
2. `result.evidence.segments` for every provider — a numeric-timestamp duplicate of `result.segments`, unused by the packet or report.
3. `result.evidence.rawResponse` for every provider except `whisper` and `gemini-stt`, which are the only providers whose advisory Quality Flags read it.

Everything the packet and report consume is preserved: `provider`, `model`, `metadata.tokenCount`, `metadata.processingTime`, `result.text`, `result.segments`, `result.evidence.timingQuality`, and `result.evidence.capabilities`. Output is minified and the operation is idempotent. Regenerating `reference-comparison-report.{json,md}` after compaction produces byte-identical output aside from the `generatedAt` timestamp.

Before deleting the source audio and derivative transcription or split-attempt files, confirm `manifest.json`, every `providers/*/result.json`, and `consensus-transcription.txt` remain — they are the full set needed to regenerate reports. `manifest.json` holds canonical item and provider metadata but no transcripts, so the per-provider `result.json` payloads are the sole transcript source and must be kept.

## Combined Cross-Run Report

To aggregate every per-run `reference-comparison-report.json` under a root directory into one provider leaderboard:

```bash
bun scripts/run.ts stt build-combined-report "$ROOT_DIR"
```

`$ROOT_DIR` is the parent directory holding the run subdirectories (for example `docs/benchmarks/stt/without-speakers` or `docs/benchmarks/stt/with-speakers`). The script discovers each subdirectory that contains a `reference-comparison-report.json`, matches providers by `providerKey`, and aggregates across the runs each provider appears in:

1. Quality score: mean of the per-run neutral speaker-aware WER-derived score (scoring version 2), ranked highest first; mean legacy score and legacy speaker-aware WER are retained as columns.
2. Price: mean per-run monetary cost, ranked lowest first, local providers at zero, missing cost last.
3. Speed: mean processing time, ranked lowest first, missing timing last.

The combined report also emits `## Error Attribution` (edit counts summed over runs, `errorAttributionTotals` per provider) and `## Speaker Metrics` (`meanWordAttributionAccuracy`, `meanSpeakerCountAbsoluteError`) sections, and records the per-run `scoringVersions`; a note warns when runs mix scoring versions. The dashboard adds mean legacy score and speaker attribution evidence columns.

Output is written to `$ROOT_DIR/combined-comparison-report.json` (schema v5) and `combined-comparison-report.md`. The visual surface is the repository-level `docs/benchmarks/combined-comparison-dashboard.html`, written by `build-combined-dashboard` and rebuilt automatically after a `build-combined-report` under `docs/benchmarks`: a zero-dependency page (data in the sibling `combined-comparison-dashboard.json`, stylesheet and script generated beside it, all named by relative path, rendered in the browser from an HTTP origin) with one tab per combined-report root, consolidating the same per-group metric rankings. Each group's metric table defaults to quality order and can be reordered by quality, cost, or speed from the sort control and those column headers. Each group's sort control also offers `Custom`, three sliders sharing one 100% budget that rescore that group in the browser; it changes no emitted artifact. The report follows the same group split as single-run reports (`local`, `thirdPartyServiceNonDiarization`, `thirdPartyServiceDiarization`) with full Price, Speed, and Quality Score tables per group, plus a per-run quality-score matrix. Per-run provider details record `audioDurationSeconds` and `realtimeFactor`; the combined report records aggregate realtime throughput as total covered audio duration divided by total covered processing time and promotes it into Markdown and the HTML dashboard. It emits no weighted composites, model tiers, cross-group overall, or `rankingSurfaces` leaderboard. Run `compact-results` and `build-report` for each run first so the combined report reads finished per-run artifacts.


## Settings Comparison Report

Settings-variant runs live in flat `<variant-id>__<recording-id>/` directories under a settings root such as `docs/benchmarks/stt/settings`. Each run has `variant.json` (`variantId`, `label`, `baseline: { service, model }`, `flags`) and `reference-source.json`. The per-run report needs no flags:

```bash
bun scripts/run.ts stt build-report "$SETTINGS_ROOT/<variant-id>__<recording-id>"
bun scripts/run.ts stt build-settings-report "$SETTINGS_ROOT" [--baseline-root "$BASELINE_ROOT"]
```

`build-settings-report` is a separate subcommand, not a mode of `build-combined-report`. A combined report ranks absolute rows across runs. This report pairs each variant run with the same `service/model` at default settings from `$BASELINE_ROOT/<recording-id>/` (default: the sibling `with-speakers` root) and reports variant minus baseline. It writes `settings-comparison-report.json` and `settings-comparison-report.md` in the settings root, then rebuilds the dashboard under the same conditions as `build-combined-report`.

| Aspect   | Behavior                                                                                                                                                                                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scoring  | Both rows are scored by this command with the current scoring code against the variant's verified `reference-source.json` reference, so a delta never mixes scoring versions or references. Each baseline is scored once per recording and reference.                      |
| Deltas   | Neutral and legacy score, speaker-aware and text-only WER, error attribution (strict, disfluency, orthographic, number, neutral, speaker attribution, residual number, other lexical), speaker-count absolute error, word attribution accuracy, cost, and processing time. |
| Coverage | Recordings come from `benchmark-plan.json` plus discovered runs. Each variant × recording slot is `paired`, `skipped` (plan skip with its reason), `not run`, `variant failed`, or `baseline missing`. Planned variants with no runs stay listed.                          |
| Means    | `meanDelta` covers every paired recording of a variant. `commonSetMeanDelta` covers the common recording set, which every variant with at least one pair covers. The headline uses the common set, and the report names it. Unpaired slots are never averaged silently.    |
| Groups   | Variants are grouped by their first setting flag: transcript formatting (`--stt-filler-words`, `--stt-number-format`, `--stt-verbatim`), speaker count, audio profile, and run-to-run control (no setting flag). Groups are never ranked against each other.               |
| Drift    | Baselines were recorded earlier, so deltas include provider-side drift; the run-to-run control variant estimates that noise for one route.                                                                                                                                 |

The dashboard's optional `stt-settings` tab reads `settings-comparison-report.json` and never rescores. It is a separate tab, not a section of `stt-with-speakers`, because its rows are deltas against a baseline rather than absolute scores, and mixing them would break that tab's absolute rankings and weighting. Rows are keyed `service/model[variant-id]`, so **Only CLI-supported models** follows the base route. Quality ranks the headline mean Δ neutral score descending. Time and cost rank mean Δ ascending. The per-recording heatmap shows Δ neutral score, and a status table lists every slot with its reason. The tab is built only when the report exists; other tabs build without it.
