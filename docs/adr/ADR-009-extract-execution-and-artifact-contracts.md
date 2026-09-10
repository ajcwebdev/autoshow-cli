# ADR-009: Extract Execution and Artifact Contracts

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-11
- **Date Updated:** 2026-09-10
- **Verification Status:** Passed
- **Supersession:** Absorbs OCR architecture, ordinal-first chapter filenames, URL extraction contracts, and the September 7–10, 2026 STT caption audit, implementation, and follow-up reports consolidated as “STT captions and word timing: consolidated report.” This record remains accepted authority for Step 2 URL, OCR, and STT execution plus public extract artifacts.

## Context

Step 2 executes extraction after [ADR-001](ADR-001-source-ingestion-and-normalization.md) has classified and normalized a source and [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) has supplied the work plan. Provider identity is shared, but URL, OCR, and STT each own adapters, retries, response handling, and artifacts. Canonical progress belongs in [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)'s manifest; raw responses and derived files cannot become resume authority.

URL extraction mixed route identity with runtime rules. Articles and X Spaces must remain distinct explicit routes: articles are resumable URL extraction, X Spaces are a separate non-resumable route, and neither is inferred from the other.

OCR is the widest extract surface: local engine choice, hosted failure handling, page concurrency, cost estimation, and the artifacts multi-provider runs write. Failure classification decides whether automatic resume may retry a provider. Token-priced estimates were drifting against billed usage, and repeated deterministic blockers were only visible per item.

Public chapter paths also disagreed. Native EPUB export used logical order, such as `chapters/01-title.txt`, while PDF chapter detection used the source page, such as `chapters/011-title.txt`. A shared artifact contract must sort by reading order while retaining the source locator and split-part behavior.

STT caption export also exposed incomplete word coverage, lost fractional offsets, and unqualified timing and speaker labels. Provider words, reconstructed tokens, generated timestamps, and retrieved caption spans carry different evidence. Fixing a downstream caption artifact must preserve successful transcription and avoid repeating provider inference.

Why now: hosted OCR estimates and diagnostics, incompatible chapter paths, and the September 2026 STT audit required explicit execution and artifact contracts; completed STT follow-ups now supply the evidence needed to retire their temporary reports.

## Options Considered

### Local OCR engine

**Option 1 (selected)**

- **Option:** Tesseract as the only local OCR engine, with source grouped by input type
- **Pros:** Fastest and highest-mean engine in local comparison; smallest provisioning and maintenance surface; mirrors runtime classification
- **Cons:** No local fallback for difficult inputs
- **Quantitative Notes:** 1 engine; 4 input-type areas (ebook, image, PDF, office/native)

**Option 2**

- **Option:** Keep OCRmyPDF and PaddleOCR alongside Tesseract
- **Pros:** Local engine diversity for hard inputs
- **Cons:** Duplicate provisioning, slower defaults, ongoing dependency maintenance
- **Quantitative Notes:** Rejected; extra engines add maintenance without a better default

### Token-priced OCR estimates

**Option 1 (selected)**

- **Option:** Evidence-gated token shapes with `costMultiplier: 1`
- **Pros:** Preserves published rate and tier semantics; keeps profile estimates from being multiplied twice; makes the wrong component visible
- **Cons:** Requires ongoing evidence collection
- **Quantitative Notes:** Promotion needs ≥3 matching healthy samples and >20% median absolute percentage error

**Option 2**

- **Option:** Tune `costMultiplier` until total estimate matches a benchmark
- **Pros:** Small metadata change
- **Cons:** Hides which token component is wrong, distorts tier selection, and double-adjusts profile estimates
- **Quantitative Notes:** Rejected for token-priced OCR

**Option 3**

- **Option:** Replace registry values from one paid run
- **Pros:** Fast calibration
- **Cons:** Overfits document mode, page band, reasoning policy, and provider variance
- **Quantitative Notes:** Rejected; one run is not a promotion sample

### Batch diagnostics

**Option 1 (selected)**

- **Option:** Derive batch diagnostics from the final canonical manifest
- **Pros:** Deterministic, sanitized rollup of repeated blockers and cost gaps; no second source of authority
- **Cons:** Another regenerable artifact schema to version
- **Quantitative Notes:** Emitted only for actionable batches

**Option 2**

- **Option:** Add blocker and cost aggregates as mutable top-level manifest state
- **Pros:** Easy for readers to find
- **Cons:** Duplicates child provider authority and can drift during partial writes or resume
- **Quantitative Notes:** Rejected; derived reports must not become resume authority

### Chapter filenames

**Option 1 (selected)**

- **Option:** Ordinal-first plus source-locator chapter names: `NN-PPP-title` / `NN-III-title`
- **Pros:** Sorts every chapter producer by reading order; preserves source traceability; one documented contract
- **Cons:** Changes public artifact paths
- **Quantitative Notes:** Applies to the 2 direct `chapters/` producers

**Option 2**

- **Option:** Keep source-page-first PDF names beside EPUB `NN-title`
- **Pros:** Avoids path churn
- **Cons:** Preserves inconsistent first-token meaning and sorting
- **Quantitative Notes:** n/a

### STT timing and caption artifacts

**Option 1 (selected)**

- **Option:** Preserve canonical timing evidence and derive coverage-checked captions and explicit local alignment artifacts from it
- **Pros:** Retains complete text, original boundaries, provenance, and successful provider work; supports offline regeneration and measured comparison
- **Cons:** Requires provenance, coverage checks, and visible limits on inferred timing
- **Quantitative Notes:** Five local subtitle formats; the September 2026 implementation increased word/token capture from 9 of 15 integrations to 12 of 15

**Option 2**

- **Option:** Depend on native subtitle exports or the existing transcript-video renderer
- **Pros:** Reuses provider formatting or an established rendering path
- **Cons:** Leaves integrations without native exports uncovered and couples caption files to inference or video rendering
- **Quantitative Notes:** Rejected; only seven direct native export routes were documented in the audit

**Option 3**

- **Option:** Replace missing or invalid provider boundaries with uniformly spaced words and treat automatic alignment as verified timing
- **Pros:** Produces superficially consistent word cues
- **Cons:** Hides source defects, confuses interpolation with acoustic evidence, and can support unjustified accuracy claims
- **Quantitative Notes:** Rejected; the live Parakeet sample contained 12 zero-duration entries among 24 words, and the short automatic reference retained five low-confidence words

## Decision

Step 2 execution is domain-owned above shared provider identity. URL, OCR, and STT own adapters, retries, response handling, normalized output, and artifacts. Canonical progress and resume eligibility stay in [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)'s manifest.

This applies to:

- URL, OCR, and STT execution, retries, response handling, normalized domain output, and Step 2 artifact writes.
- STT timing provenance, caption exports, local alignment and comparison, channel merging, and reviewed speaker-label reconciliation.
- Native EPUB and ebook chapter files, PDF chapter-detection files, and split parts produced by `--length <n>`.
- Routes that write chapter files or extract artifacts; reruns recreate files under the current names.

It does not apply to:

- Source identity, classification, and normalization ([ADR-001](ADR-001-source-ingestion-and-normalization.md)).
- Canonical pipeline state, resume authority, and price dry runs ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).
- Local OCR toolchain provisioning ([ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)).
- Shared hosted admission, ramps, and lane pressure ([ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)).
- Hosted model identity, lifecycle, reasoning, and pricing provenance ([ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)).
- Queue claims, handoff, and the product choice of fan-out versus pooled page execution ([ADR-015](ADR-015-distribute-ocr-pages-across-a-multi-provider-work-pool.md)).

### Extract domain ownership

`extract --provider` and resume use the same route-qualified STT and OCR names. There is no second list of provider spellings.

`article` is a first-class URL route and is never inferred from `x-space`, input family, or provider metadata. X Spaces keep their separate route and explicit non-resumable behavior. URL adapters write domain artifacts; provider progress is recorded only in the canonical manifest.

### OCR execution

Use Tesseract as the sole local OCR engine. Source-specific OCR follows ebook, image, PDF, and office/native inputs.

Hosted failures carry retryability and redacted diagnostics. Automatic resume skips deterministic provider blockers such as quota, billing, account, and policy failures. Explicit provider resume re-includes a blocked target after repair or an explicit retry.

Hosted page work uses the shared provider/account lanes in [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md). `--ocr-concurrency auto` sizes hosted limits from document size and qualified profiles, up to a ceiling of `48` or an explicit user cap. `--ocr-concurrency <n>` is a hard ceiling. `--concurrency-mode ramp|immediate` controls hosted startup. Local Tesseract, page rendering, and normalization start immediately.

Token-priced OCR keeps published rates and prompt/completion shapes explicit, with `costMultiplier: 1`. Canonical usage follows each provider's billed prompt and completion components, including thought tokens when the provider bills them. Calibrate components only from healthy samples qualified by provider, concrete model, OCR mode, page-count band, and effective reasoning policy. Promotion requires at least three matching samples, a consistent direction, and median absolute percentage error above 20%. Failed, partial, or incomplete work cannot become a trusted warm start. Pool and fan-out evidence are not interchangeable.

Emit `ocr-batch-diagnostics.json` and a human summary table only when a deterministic blocker affects multiple items, partial provider usage exists, actual cost is missing for attempted hosted work, or absolute estimate error exceeds 20%. The report is a sanitized, regenerable projection of the final canonical manifest and is never resume authority. Clean reruns remove a stale report.

### Fan-out and pool artifacts

[ADR-015](ADR-015-distribute-ocr-pages-across-a-multi-provider-work-pool.md) owns the `fanout|pool` product choice. This record owns the public artifacts those modes write.

Default `fanout` (explicit `--ocr-provider-mode fanout` is equivalent to omitting the flag) gives every selected target the full document and a complete result under its provider directory. `--primary-ocr` may copy one of those complete results to the top-level extraction.

`--ocr-provider-mode pool` writes one top-level composite extraction with `extractionMethod: "ocr-pool"`, assembled in original page order. `--primary-ocr` is rejected before credential lookup or dispatch. Provider directories hold attributed page attempts, never a second complete extraction.

Every accepted page records provider, model, reasoning, attempt, usage, cost, timing, and artifact path. Failed and ambiguous attempts keep the same attribution and any reported paid usage without becoming accepted output. Hosted response caches must not reuse a page response produced under a different provider mode, model, reasoning, input, page, or render.

### Chapter artifact filenames

Every direct chapter producer writes `chapters/<ordinal>-<source-locator>-<slug>.txt`. PDF uses the starting source page. EPUB uses the original spine section index when available, otherwise the logical section index.

Ordinal and split-part fields use two digits below 100 generated files and three digits at 100 or more. Source locators are padded to at least three digits and never truncated. Split files append `-part-NN` to the same base.

### STT timing and caption artifacts

Persist numeric word ranges, text, confidence, speakers, raw/chunk evidence, and applied source offsets in `result.json` before derived caption work. Preserve distinctions between native, token-derived, aligned, generated, repaired, caption-span, interpolated, and mixed timing. A schema-parsed `rawResponse` is retained evidence, not a guarantee that every original wire field survived. Keep fractional offsets and apply each source offset once. Scope local speaker IDs by chunk or channel; equal IDs alone do not establish a shared identity.

Caption export checks finite, nonnegative, positive-duration intervals, duplicate spans, and complete transcript coverage. Preserve valid overlaps and original provider boundaries. Infer intervals for uncovered or invalid word evidence only when usable segment bounds exist, count those inferences, and fail when uncovered text has no usable timing. Reading and layout warnings do not move canonical measurements. `captions.json` records cue timing, quality, invalid/inferred counts, format limits, and warnings; it is derived output and never resume authority.

Fresh-media extraction transcribes once per selected model, saves canonical results and successful provider state, then exports captions outside transcription retry loops. Saved-result export is local and requires neither audio nor a renderer. Validate options before inference, protect existing output files, and emit the normal single terminal result. Optional native subtitle exports reuse the same inference or completed job; export failure preserves transcription and writes diagnostics. Native split-chunk files retain provider-relative time; combined-result export uses the recording timeline. Adding native exports to an already successful resumed target does not create retroactive export jobs. Resume rejects changed transcription settings that would reuse incompatible evidence.

Diarization capability resolution includes the concrete model and distinguishes documented, provisional, and live-tested support. Together defaults off. Mistral `voxtral-mini-2602` uses native word timing only with diarization off; diarization uses segments, and timestamp requests omit its incompatible language field. Generated Gemini timestamps and speaker hypotheses, retrieved captions, and channel labels do not become native acoustic measurements or verified identities.

Local forced alignment requires supplied text with complete, positive, non-overlapping segment coverage and explicit installed model/runtime paths. Preserve original evidence and hashes; mark new timing as aligned and `manuallyVerified: false`. Reject low-confidence publication at the configured threshold while retaining diagnostics. Compare ordered lexical matches, coverage, boundary errors, tolerance bands, speaker-label agreement, and signed drift; reject invalid intervals for scoring. Probe installed Whisper capabilities, mark DTW midpoint-derived ranges as repaired, retain rejected variants, and leave transcription defaults unchanged after calibration.

Channel extraction preserves every stream/channel at its original sample rate and verifies decoded sample hashes. Merge validates full text coverage, applies offsets once, preserves overlaps, and rejects already merged results. Speaker reconciliation requires an explicit map tied to the source SHA-256 and a review reason; it does not infer identity acoustically. Operational flags, setup, schemas, and examples live in the [STT command guide](../commands/process-steps/step-2-extract/02-extract-stt.md) and its [local timing and speaker workflows section](../commands/process-steps/step-2-extract/02-extract-stt.md#local-timing-and-speaker-workflows).

## Rationale

- Tesseract provided the best performance-to-complexity ratio in local testing while avoiding multi-engine dependency and maintenance costs.
- Retry-aware blockers prevent automatic resume from repeating quota, billing, account, policy, and other deterministic failures.
- Adaptive OCR caps improve large-document throughput without weakening explicit `--ocr-concurrency` limits or [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) lanes.
- Explicit token components preserve pricing-tier semantics and prevent profile-derived usage from being multiplied a second time.
- A derived batch report exposes repeated blockers and cost gaps without duplicating mutable provider state.
- Explicit URL routes and one extract/resume selector inventory keep domain behavior and newly added providers selectable without inferred routes or a second spelling list.
- Logical ordinal first makes EPUB and PDF chapter paths sort by reading order, while a real source locator preserves debugging traceability.
- Distinct fan-out and pool artifacts keep comparison results and composite output from being mistaken for each other, and behavior-complete cache identity prevents incompatible page reuse.
- Complete text coverage and explicit timing provenance prevent dropped speech or inferred caption intervals from masquerading as native word evidence.
- Persisting successful STT work before caption export enables local recovery without repeating inference or provider charges.
- Automatic-reference measurements and model-specific live validation support bounded conclusions without implying general acoustic accuracy or speaker identity.

## Consequences

Positive outcomes:

- URL article execution has one explicit domain owner, and X Spaces cannot be conflated with it during execution or resume.
- Local OCR has one routing and execution path supplied by the toolchain that [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md) provisions.
- Hosted OCR preserves useful partial results, produces actionable resume guidance, and avoids known deterministic retry loops.
- Large clean runs can use available throughput, while pressured lanes fall back conservatively.
- Estimates and summaries explain wall time, retry pressure, actual partial usage, and token-shape drift.
- Actionable OCR batches emit one deterministic, sanitized blocker/cost diagnostic; clean batches remain quiet.
- Fan-out keeps complete per-provider results; pool writes one composite extraction in original page order.
- EPUB and PDF chapters share one public path shape that sorts by reading order and retains source position.
- Saved STT results can generate complete captions and local timing analyses while preserving source evidence and successful transcription.

Negative outcomes:

- There is no non-Tesseract local fallback for difficult inputs.
- Provider failure classifiers and profile schemas require maintenance as hosted APIs change.
- Clean profiles can become stale as provider routing, limits, models, account tiers, or reasoning defaults change.
- Pool mode does not provide complete per-provider outputs.
- Automatic alignment and model capability evidence require explicit confidence, language, overlap, and sample-size qualifications; timestamp precision alone cannot establish accuracy.

## Trade-offs

**Trade-off 1**

- **Gain:** One local engine and a smaller dependency surface
- **Sacrifice:** Local engine diversity

**Trade-off 2**

- **Gain:** Deterministic blocker handling and auditable fallback
- **Sacrifice:** More provider-state metadata

**Trade-off 3**

- **Gain:** `--ocr-concurrency auto` can use available throughput
- **Sacrifice:** Adaptive caps depend on profile quality and can fall back conservatively

**Trade-off 4**

- **Gain:** Explicit evidence-gated token shapes
- **Sacrifice:** Profile lifecycle and periodic evidence review

**Trade-off 5**

- **Gain:** One derived batch diagnostic
- **Sacrifice:** Another regenerable artifact schema

**Trade-off 6**

- **Gain:** Comparison artifacts in fan-out and one composite in pool
- **Sacrifice:** Two public artifact shapes

**Trade-off 7**

- **Gain:** Attempt-level cost and failure attribution
- **Sacrifice:** More provider artifact and telemetry records

**Trade-off 8**

- **Gain:** Complete caption text, auditable timing transformations, and local recovery from saved STT evidence
- **Sacrifice:** More provenance and validation artifacts; some exports or measurements fail when evidence cannot support them

## Implementation Note

URL extraction lives under `src/cli/commands/process-steps/step-2-extract/step-2-url/`. OCR execution, chapter filenames, and batch diagnostics live under `src/cli/commands/process-steps/step-2-extract/step-2-ocr/`. Extract and resume provider names are projected from `src/cli/flags/service-selector-normalization/extract-selectors.ts` and `src/cli/flags/service-selector-normalization/provider-targets.ts`. Token-shape audit is `src/tools/audit-ocr-token-shapes.ts`.

### Bun 1.4 Image Routing

The 2026-08-31 evaluation retained the existing TIFF routing after checking Bun.Image capabilities by platform.

A synthetic one-pixel red TIFF golden verifies metadata and PNG pixels on macOS and Windows, where Bun 1.4 advertises TIFF decoding. Production TIFF routing remains on the existing direct-provider or ImageMagick paths because Linux and the supported Docker image still require ImageMagick. ImageMagick also remains the comic compositing engine because Bun.Image has no composition operation.

The removal of redundant Bun.Image constructor declarations is recorded separately in [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md#bun-14-image-declarations).

### STT Caption and Timing Archive

This section retains the lasting decisions and dated evidence from the September 7 audit and implementation and September 10 follow-ups. All requested STT implementation and execution follow-ups were completed on 2026-09-10. The automatic-reference limitations below bound the supported claims; they are not outstanding implementation items.

#### Audit and Completed Implementation

The 2026-09-07 audit covered 15 registered STT integrations and 28 configured model/mode entries: 11 hosted integrations with 13 entries, two URL services with two entries, and two local engines with 13 entries. Separate YouTube-caption retrieval made 16 paths and 29 entries. Residual Rev catalog entries and unregistered OpenAI-hosted transcription were excluded. These counts describe that audit snapshot, not a current model inventory.

Word/token capture paths increased from 9 of 15 integrations and 20 of 28 entries to 12 of 15 and 25 of 28 after adding DeepInfra, Together, and Mistral. Seven direct native subtitle routes were documented, covering 19 entries; counting Deepgram's official client-side converter separately made eight provider-supplied routes and 20 entries. Initially none of the registered STT integrations persisted native subtitles, while YouTube separately retained VTT. Implementation added optional same-job exports for AssemblyAI, Gladia, Happy Scribe, and Speechmatics, installed-engine exports for whisper.cpp/whisperfile, and an explicit DeepInfra SRT/VTT response alternative. Capture availability does not imply successful live validation or accurate acoustic boundaries across all models.

The Happy Scribe reproduction lost all but the largest paragraph's word array and omitted inherited speakers; flattening now retains every structured paragraph. Local Whisper reconstruction preserves fragments, contractions, confidence, and fractional later-chunk offsets. Soniox reconstruction respects native token, language, and speaker boundaries, including contractions and non-space-delimited text, without inventing intra-token boundaries. Evidence merging reports mixed quality and scopes speaker IDs. YouTube roll-up deduplication is limited to overlapping, matching-speaker spans, preserving later repeated speech. Shared video cues use `transcript-words` / `transcript-segments` labels and expose invalid/inferred counts.

The implementation added local CTC alignment, reference comparison, Whisper DTW calibration, verified channel extraction/merge, reviewed speaker maps, and ASS/TTML/LRC alongside SRT/VTT. Provider controls and native exports persist through configuration and requested-target state. Happy Scribe has no implemented/documented diarization off switch; export can hide labels. Mistral's incompatible simultaneous diarization/native-word recommendation was corrected. The dated AssemblyAI and Deepgram rate corrections remain in the [STT pricing record](../commands/process-steps/step-2-extract/02-extract-stt.md#stt-pricing); ongoing model/pricing governance stays in [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md).

The implementation lives in `src/cli/commands/process-steps/step-2-extract/`: `run-caption-export.ts`, `caption-editor-formats.ts`, `run-stt-timing-workflow.ts`, `run-local-forced-alignment.ts`, `calibrate-whisper-timing.ts`, and `stt-channel-workflows.ts`, with provider adapters and evidence/coverage/alignment helpers under `step-2-stt/`. The local emission backend is `scripts/stt-ctc-emissions.py`.

#### Automatic Reference Construction

The user requested the best automatic references available from existing local files instead of manual annotation. Both references are English and explicitly carry `manuallyVerified: false`. The findings and quantitative results are retained in this ADR so the historical conclusion does not depend on ignored runtime files. Detailed evidence remains in the local [artifact index](../../output/stt-caption-followup.cNwSmx/followup-artifacts.json) under `output/stt-caption-followup.cNwSmx/`; raw outputs, failed attempts, working audio, and model/runtime files remain ignored and were preserved.

**Alignment backend**

- **Model:** `facebook/wav2vec2-base-960h`, revision `22aad52d435eb6dbaf354bdad9b0da84ce7d6156`; model-weight SHA-256 `8aa76ab2243c81747a1f832954586bc566090c83a0ac167df6f31f0fa917d74a`
- **Runtime:** Python 3.12, Torch 2.14.0, Transformers 4.57.6; installed dependencies frozen in [scripts/stt-alignment-requirements.txt](../../scripts/stt-alignment-requirements.txt)
- **Method:** Local CTC alignment with 16 kHz mono PCM16 and a 20 ms output frame grid; source/model fingerprints and preprocessing retained; remote model code disabled
- **Limits:** Alignment cannot recover omitted speech, adjudicate wording, separate overlapping mono voices, or infer speakers. Confidence summarizes emission scores, not a calibrated probability. Other languages, number handling, and broader acoustic claims need their own validated references.

**Short reference**

- **Input:** Existing `input/examples/audio/0-audio-short.mp3`, six seconds
- **Text:** 23 words selected automatically from the beginning of `docs/benchmarks/stt-with-speakers/1-audio/consensus-transcription.txt`, using the local short-transcription word count; no manual re-adjudication
- **Confidence:** The default `0.1` threshold rejected five words. A fresh exploratory run at `0.001` aligned all 23; the five scores of approximately `0.0021`–`0.0927` remained flagged. The default stayed `0.1`.
- **Evidence:** `reference-text.json`, `short-automatic-reference/result.json`, and `short-automatic-reference/alignment.json` beneath the artifact directory; the initial rejected `automatic-reference/` attempt was retained

**Late reference**

- **Input:** Existing `input/examples/audio/5-audio.mp3`, 300.016 seconds; a local whisper.cpp base transcription produced 1,027 word entries
- **Text and timeline:** 36 ASR-derived words at 245.900–257.960 seconds, with 250 ms padding at each end for alignment; no independent text verification
- **Confidence:** All 36 words passed the default `0.1` threshold; candidate boundaries stayed in source-audio time with offsets applied once
- **Evidence:** `long-recording-seed/result.json`, `late-automatic-reference/result.json`, `late-candidate.json`, and `late-comparison/timing-comparison.json` beneath the artifact directory

#### Timing Measurements

These 2026-09-10 measurements describe agreement with the automatic CTC references. All median and p95 pairs below are absolute start/end differences in milliseconds. Coverage includes unmatched words; boundary statistics include only ordered lexical matches. DTW intervals derive from adjacent token-center midpoints and are marked repaired. The calibration records retain individual matches, confidence, tolerance bands, raw results, invocation/help, elapsed runtime, and fingerprints.

**whisper.cpp tiny, short sample**

- **Standard:** 21/23 matched; median 70 / 60 ms; p95 300 / 260 ms
- **DTW:** 21/23 matched; median 150 / 200 ms; p95 250 / 340 ms
- **Outcome:** Standard preferred for this reference; evidence in `whisper-calibration-final/calibration.json`

**whisper.cpp base, short sample**

- **Standard:** 22/23 matched; median 100 / 60 ms; p95 219 / 287.5 ms
- **DTW:** 22/23 matched; median 45 / 105 ms; p95 158 / 239 ms
- **Outcome:** DTW slightly preferred by combined median; evidence in `whisper-base-calibration/calibration.json`

**whisper.cpp large-v3-turbo, short sample**

- **Standard:** Rejected from scoring because three words had zero-length intervals at 5.990 seconds; raw evidence retained
- **DTW:** 23/23 matched; median 40 / 80 ms; p95 100 / 218 ms
- **Outcome:** Only the DTW variant was valid; calibration remained partial in `whisper-turbo-calibration-final/calibration.json`

**whisperfile tiny, short sample**

- **Standard:** 21/23 matched; median 70 / 60 ms; p95 300 / 260 ms
- **DTW:** Not run because the installed bundle did not advertise support
- **Outcome:** Standard measured successfully; evidence in `whisperfile-calibration-final/calibration.json`

**whisper.cpp base, late excerpt**

- **Standard:** 36/36 matched; median 80 / 205 ms; p95 375 / 430 ms
- **Signed drift:** Mean start/end differences +18.9 / +171.1 ms at minute four
- **Outcome:** Evidence in `late-comparison/timing-comparison.json`; one late excerpt does not establish complete long-recording drift

No transcription defaults changed. Results varied by model, the short reference retained uncertain words, and the corpus contained only two automatic English excerpts. These results do not establish a hosted-provider ranking, multilingual or overlapping-speaker accuracy, calibrated confidence, number normalization accuracy, or verified speaker identity. Broader manually verified references would be needed to make those claims.

#### Channel and Format Evidence

The real stereo `input/examples/audio/1-audio.mp3` was split at 44.1 kHz with zero-second stream offsets. Both extracted channels' decoded sample hashes matched their respective source channel and each other. This fixture contains identical mixes, not isolated speakers. `stereo-channel-validation/channels.json` retains the measurements. Synthetic distinct-channel contracts cover offsets, overlaps, complete text, scoped labels, and reviewed mapping without equating channels with people.

All five subtitle formats were produced from the 23-word short reference. `automatic-captions/format-validation.json` records 23 TTML XML cues with unchanged text and FFmpeg decoding of ASS with unchanged display text after removing generated font tags. These establish serialization/decoding, not subjective player readability. ASS rounds to centiseconds with a one-centisecond minimum and rejects unsafe literal braces/control sequences; LRC has centisecond starts only. The sidecar retains full ranges and format limits. Individual word cues are implemented; ASS karaoke and VTT inline-word authoring are not additional modes.

#### Together Parakeet Live Validation

The four existing local Parakeet benchmark results were non-diarized and lacked word evidence. One explicitly approved six-second Together `nvidia/parakeet-tdt-0.6b-v3` run completed on 2026-09-10 at 06:11:26 UTC, with diarization, matching minimum/maximum speaker bounds of two, and word/segment verbose JSON. The historical invocation was:

```bash
bun autoshow extract input/examples/audio/0-audio-short.mp3 --provider together=nvidia/parakeet-tdt-0.6b-v3 --diarization --speaker-count 2 --captions --caption-mode word --output-dir output/stt-caption-followup.cNwSmx/parakeet-live --json
```

It returned two speaker segments (`SPEAKER_01`, `SPEAKER_00`) and 24 word entries. Duplicate top-level/nested words were represented once. Twelve entries had positive duration and twelve had identical start/end values. Normalized evidence retained all provider text, speakers, and timestamps. SRT/VTT export preserved all 24 words, reported 12 invalid and 12 inferred timings, and retained `timingQuality: mixed`; canonical native intervals were not overwritten.

The CLI computed 0.015 cents ($0.00015) from six seconds of usage at the catalog rate, with `costSource: computed_usage`; this was not an independently verified invoice. Exactly one paid run occurred, with no additional paid retry or native-export request. CLI duration was 986 ms, including 910 ms attributed to transcription. Local evidence includes `parakeet-live/result.json`, `parakeet-live/manifest.json`, `parakeet-live/captions.json`, and `parakeet-validation.json`; the artifact index fingerprints these results.

Capability metadata became `diarizationValidation: live-tested` and the provisional warning was removed. This records observed two-speaker endpoint compatibility on one sample, not verified identity or uniformly valid native words. The automatic reference had 23 words and was not independent acoustic ground truth, so this run was excluded from timing rankings. An anonymous local regression fixture reproduces the observed point-timestamp response and explicit caption fallback without provider calls. Future execution authorization follows [AGENTS.md](../../AGENTS.md#paid-provider-execution-rules).

## API / Type Impact

- `--ocr-concurrency auto` selects adaptive hosted behavior; `--ocr-concurrency <n>` is a hard maximum for runtime scheduling and estimates.
- `--ocr-provider-mode fanout|pool` defaults to `fanout`. Pool mode produces one composite top-level extraction and rejects `--primary-ocr`.
- Composite metadata carries `extractionMethod: "ocr-pool"`. Provider attempt artifacts live below `providers/<target>/attempts/`.
- Automatic resume skips deterministic provider blockers; explicit provider selection overrides that skip.
- `ocr-batch-diagnostics.json` is a versioned, regenerable projection of the final canonical batch manifest, not resume authority.
- Chapter naming adds no CLI flag. The public path shape is `NN-PPP-title` for PDF and `NN-III-title` for EPUB, with dynamic widths and split suffixes.
- `extract` and `resume` accept the same route-qualified STT and OCR provider names.
- STT results retain word evidence and timing provenance; caption sidecars expose invalid/inferred counts and format precision. Diarization capabilities are model-aware and separate documented from live-tested support.
- Local alignment, comparison, calibration, channel, and reviewed-speaker operations emit separate derived artifacts; they preserve source files and expose zero-provider-cost price preflight.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/extract-ocr/chapter-artifact-filenames.test.ts
bun test test/test-cases/validation/extract-ocr/ocr-batch-diagnostics.test.ts
bun test test/test-cases/validation/extract-ocr/ocr-page-pool-*-contracts.test.ts
bun test test/test-cases/validation/extract-ocr/ocr-resilience-contracts/
bun test test/test-cases/validation/extract-ocr/ocr-resume-failure-target-contracts.test.ts
bun test test/test-cases/validation/extract-ocr/ocr-resume-provider-state-contracts.test.ts
bun test test/test-cases/validation/reports-pricing/price-mode-contracts/ocr-token-usage-profiles.test.ts
bun test test/test-cases/validation/providers/provider-selection-contracts/selection-inventory-contracts.test.ts
bun test test/test-cases/validation/extract-stt/
bun test test/test-cases/validation/providers/openai-rest-contracts/audio-stt-contracts.test.ts
bun test test/test-cases/validation/media-generation/transcript-video-contracts.test.ts
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. Typecheck and unique-source check pass.
2. Mapped price commands stay no-cost and do not dispatch providers.
3. Chapter producers emit ordinal-first, source-locator paths with dynamic widths and split suffixes.
4. Batch diagnostics emit only for actionable blocker or cost gaps, stay regenerable, and never become resume authority.
5. Pool artifacts stay composite, isolate attempts, reject `--primary-ocr`, and leave default fan-out unchanged.
6. Hosted failure classification, `auto` versus fixed OCR caps, and automatic versus explicit resume skip deterministic blockers.
7. Token profiles reject identifying data and unhealthy samples, and token-priced OCR keeps `costMultiplier: 1`.
8. Extract public and resume selectors stay equal to the canonical STT/OCR target maps.
9. Help and usage contracts keep OCR mode and concurrency flags stable.
10. STT contracts preserve all text, numeric boundaries, source offsets, overlaps, and provenance; local captions and alignment operations expose invalid/inferred timing without changing provider evidence.
11. Compatible-STT request contracts cover model-specific diarization, timestamp fields, and safe retries with mocked endpoints; transcript-video contracts exercise local media and saved evidence.

Do not run hosted OCR providers, paid-provider, smoke, e2e, or full-suite tests for this ADR.

### STT Verification History

The September 7 audit passed `bun run check` and nine local contracts with 39 assertions; it reproduced Happy Scribe truncation and missing inherited speakers. The implementation subsequently passed 310 selected tests across 50 files, and direct-media integration passed 287 across 42 files. These are separate passes, not additive counts or full-suite coverage. Early price preflights passed 105/123 commands; 18 OCR cases failed during MuPDF setup/page counting. Exploratory checks also exposed two compatible-STT retry expectation failures and two transcript-video output-discovery failures.

The September 10 follow-ups passed `bun run check`, `git diff --check`, 328 selected tests across 52 files, and 136/136 price commands. Those selected contracts no longer reproduced the earlier retry, video, or OCR-preparation failures. Installed Whisper engines and the CTC backend were exercised separately on the existing audio. After the Parakeet run, 46 targeted local contracts across three files, both static checks, and a fresh 136/136 price pass succeeded. Report consolidation also passed both static checks and 136/136 price commands. No full smoke/e2e suite was run.

Run price preflight and contract tests sequentially: an initial concurrent run let the price runner's test-output cleanup remove a video fixture; the sequential rerun passed. The explicit-audio video contract uses an existing local fixture. Evidence under the retained artifact directory includes `local-contracts-final.log`, `final-timing-contracts.log`, `final-overlap-contracts.log`, `parakeet-local-contracts.log`, `price-verification.log`, and `parakeet-final-price-verification.log`.

## Follow-up Actions

- [ ] Collect reasoning-qualified OCR token samples — Blocked on explicit approval for paid provider runs

## References

- Related ADR: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md)
- Related ADR: [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Related ADR: [ADR-015](ADR-015-distribute-ocr-pages-across-a-multi-provider-work-pool.md)
- Related ADR: [ADR-020](ADR-020-end-the-write-pipeline-at-step-3.md)
- Extract command documentation: [`docs/commands/process-steps/step-2-extract/01-extract.md`](../commands/process-steps/step-2-extract/01-extract.md)
- OCR command documentation: [`docs/commands/process-steps/step-2-extract/03-extract-ocr.md`](../commands/process-steps/step-2-extract/03-extract-ocr.md)
- STT command documentation: [`docs/commands/process-steps/step-2-extract/02-extract-stt.md`](../commands/process-steps/step-2-extract/02-extract-stt.md)
- Local STT timing, alignment, and channels: [STT command guide — Local Timing and Speaker Workflows](../commands/process-steps/step-2-extract/02-extract-stt.md#local-timing-and-speaker-workflows)
- Resume command documentation: [`docs/commands/setup-and-utilities/resume/resume.md`](../commands/setup-and-utilities/resume/resume.md)
- `src/cli/commands/process-steps/step-2-extract/step-2-url/`
- `src/cli/commands/process-steps/step-2-extract/step-2-ocr/`
- `src/cli/commands/process-steps/step-2-extract/step-2-stt/`
- `test/test-cases/validation/extract-stt/stt-caption-followup-contracts.test.ts`
- `src/cli/flags/service-selector-normalization/extract-selectors.ts`
- `src/cli/commands/process-steps/step-2-extract/step-2-ocr/chapter-artifact-filenames.ts`
- `test/test-cases/validation/extract-ocr/chapter-artifact-filenames.test.ts`
- `test/test-cases/validation/extract-ocr/ocr-bun-image-normalization-contracts.test.ts`
