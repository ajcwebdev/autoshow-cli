# STT Settings Variants

Fresh, diarized `extract` runs of with-speakers benchmark models under non-default settings, scored against the same consensus references as `docs/benchmarks/stt/with-speakers/`. Variants are never produced with `autoshow resume` on the committed default runs, because additive resume rewrites historical manifest fields.

## Layout

Each `<variant-id>__<recording-id>/` directory is a normal single-provider `extract` run, normalized to the layout the consensus STT reports read:

| File                                            | Contents                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `manifest.json`                                 | CLI manifest; `items[0].outputDir` is `.` and the provider `artifactDir` is `providers/...` |
| `providers/<service>-<model>/result.json`       | Provider result (moved from the run root by the runner)                                     |
| `providers/<service>-<model>/transcription.txt` | Plain transcript                                                                            |
| `prompt.md`                                     | CLI prompt artifact                                                                         |
| `variant.json`                                  | Variant id, `k=v` label, default-settings baseline service/model and the exact CLI flags    |
| `reference-source.json`                         | Repository-relative consensus reference path and its SHA-256 (the text is not copied)       |

Source audio (MP3, or the float32 WAV of lossless runs) stays Git-ignored.

## Runner

`benchmark-plan.json` is the pinned plan and spending ledger (benchmark date 2026-11-20): recordings, variants, recorded skips, user approvals and one record per dispatch attempt, with `cumulativeSpentCents` derived from the attempt records.

```sh
bun src/tools/stt-settings-benchmark.ts --price
bun src/tools/stt-settings-benchmark.ts --run --approved-budget-cents N [--approval-note TEXT] [--variant ID ...]
```

- `--price` (default) calls `bun autoshow extract ... --price --json` for every pending run with an empty environment and no `.env` file, so no provider credential is available, and prints the table, totals, cumulative spend, the whole-batch requirement, the active approval and the exact `--run` commands.
- `--approved-budget-cents N` is the user-approved total cumulative ceiling for the ledger, not a per-invocation budget. `--run` refuses unless every selected run priced and N covers the recorded spend plus the per-run headroom (`--max-model-cents` value) of every remaining run in the whole batch, including variants outside `--variant`, so splitting a batch never resets the threshold. A new N is appended to `approvals`, and the check is repeated with actual recorded spend before every dispatch. Pass only a value the user explicitly approved; any total of $1 or more needs explicit approval naming the commands.
- Each dispatch appends an attempt that reserves its estimate before the CLI starts. Earlier attempts are never replaced. The CLI gets `--max-model-cents` (estimate plus 2%, rounded up): a pre-dispatch estimate filter that drops a target whose estimate exceeds it, not a hard spend cap.
- Outcomes: `completed` records the manifest's actual cost; `refused` (0¢, with `reason`) is recorded only when the CLI refused before any billable request: a usage exit (2) with no provider attempt, or an all-credential rejection (401/403, missing API key) with no remote job id, asset or recorded cost in the manifest; `failed` keeps the estimate reserved whenever a provider request may have been made. Interruption leaves `dispatched`, which also stays reserved. The runner stops on the first failure.
- Existing directories are never deleted or overwritten. A directory without a succeeded manifest, a succeeded manifest the ledger does not record, a `dispatched`/`failed` attempt without `archivedPath`, or a `completed` attempt whose directory is missing (moved, or `outputBase` changed) blocks `--run`. A completed run is never re-dispatched; restore its directory.
- After a paid run, the optional compaction step is `bun .codex/skills/consensus/scripts/run.ts stt compact-archive docs/benchmarks/stt/settings`; it drops word-level evidence, so preserve a copy first.

### Reconciling a Failed Attempt

There is no automatic retry. To retry a blocked pair:

1. Move its directory (if any) to `output/<YYYY-MM-DD>_stt-settings-failed-attempts/<variant-id>__<recording-id>__<reason>/`; never delete it.
2. Edit that pair's latest attempt in `runs`: set `archivedPath` to the moved directory and a `reason`. Change `status` to `refused` with `actualCents: 0` only with evidence that no billable request was made (no remote job id and an upload/auth rejection, or provider billing confirmation); otherwise keep `failed` with `estimatedCents` reserved, or set `actualCents` from the provider's billing record.
3. Update `cumulativeSpentCents` to the sum of the attempts (`actualCents`, else `estimatedCents`) and run `--price`; the next `--run` appends a new attempt.

The 2026-11-21 reconciliation is recorded this way: five 0¢ `refused` attempts (an unknown `--max-cents` flag that created no directory, Gladia 401, Deepgram 401 `INVALID_AUTH`, a missing Speechmatics key, and an AssemblyAI lossless upload socket close before any transcript job), four with `archivedPath` under `output/2026-11-21_stt-settings-failed-attempts/`.

### Approval

On 2026-11-21 the user approved "up to $7.33" for the settings-variant batch: 733¢ for the 47 then-planned runs on top of the 62.956¢ already recorded for the promoted control rerun, recorded in `approvals` as a cumulative ceiling of 795.956¢.

## Speaker Counts

`--speaker-count` uses the distinct line-leading `[speaker-N]` labels in each consensus reference. The current counts are 2 for 1-audio, 2 for widgets, 12 for Qwik, and 6 for React Miami. The earlier AssemblyAI Qwik run requested 13 speakers and the Gladia run requested 12. Each run's `variant.json` preserves its actual request.

## Lossless Feasibility

`--stt-audio-profile lossless` uploads a float32 WAV at the source rate and channel count (all four sources are mono; 44.1 kHz for 1-audio and widgets, 48 kHz for Qwik and React Miami). The CLI auto-splits any upload over a provider limit and labels split speakers per chunk, so a split that only the WAV triggers is recorded as skipped. The 113-minute Qwik WAV is about 1.30 GB:

| Provider/model                   | Upload cap (B) | Qwik lossless                                                       |
| -------------------------------- | -------------: | ------------------------------------------------------------------- |
| assemblyai/assemblyai-stt-3-7    | 2,362,232,013  | Runs unsplit                                                        |
| deepgram/nova-3                  | 2,147,483,648  | Runs unsplit                                                        |
| gemini-stt/gemini-3.5-transcribe | 2,147,483,648  | Runs; the 1,800 s diarization cap splits it, as it does the default |
| gladia/solaria-3                 | 1,048,576,000  | Skipped: WAV exceeds the cap                                        |
| grok/grok-voice-transcribe-2.0   | 524,288,000    | Skipped: WAV exceeds the cap                                        |
| mistral/voxtral-mini-2602        | 524,288,000    | Skipped: WAV exceeds the cap                                        |
| soniox/stt-async-v5              | 524,288,000    | Skipped: WAV exceeds the cap                                        |
| speechmatics/melia-1             | 1,073,741,824  | Skipped: WAV exceeds the cap                                        |

The widgets WAV (about 427 MB) fits every cap. Gemini also splits the widgets recording under both profiles.

## Promoted Control Rerun

`assemblyai-3-5-pro-rerun-2026-11-20` is the already-paid default-settings rerun (`--provider assemblyai=universal-3-5-pro --diarization`) from `output/2026-11-20_assemblyai-universal-3-5-pro-diarization-control/`, promoted with `bun src/tools/stt-settings-benchmark.ts --promote assemblyai-3-5-pro-rerun-2026-11-20` and recorded at its manifest cost of 62.956¢ (0.377 + 15.480 + 43.266 + 3.833). The originals were copied, not moved. Changes per recording:

- The MP3 was not copied.
- `result.json` and `transcription.txt` moved from the run root to `providers/assemblyai-universal-3-5-pro/`.
- Manifest `items[0].providers[0].artifactDir` changed from `.` to `providers/assemblyai-universal-3-5-pro`, and `items[0].outputDir` from the `output/...` path to `.`.
- Standard consensus compaction (`compactArchiveRun`) removed `evidence.words` and `evidence.rawResponse` from `result.json` and the duplicate embedded `result` from the manifest, as in the committed with-speakers runs.
- `variant.json` and `reference-source.json` were added.

## Reports

Per-run reports read `reference-source.json`, so no flags are needed:

```sh
for run in docs/benchmarks/stt/settings/*__*/; do bun .codex/skills/consensus/scripts/run.ts stt build-report "$run"; done
bun .codex/skills/consensus/scripts/run.ts stt build-settings-report docs/benchmarks/stt/settings
```

`build-settings-report` writes `settings-comparison-report.{json,md}` here. It pairs each run with the same service/model at default settings in `docs/benchmarks/stt/with-speakers/<recording-id>/` and rescores both against the variant's reference. It reports per-recording deltas and means over the common recording set. Skipped, not-run, failed, or baseline-missing slots appear in the Coverage table instead of being averaged. The dashboard's optional **STT settings** tab reads this report. These commands make no provider calls. See `.codex/skills/consensus/references/stt.md`.
