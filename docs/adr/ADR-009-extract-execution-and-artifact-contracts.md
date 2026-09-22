# ADR-009: Extract Execution and Artifact Contracts

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-11
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed
- **Supersession:** This record absorbed OCR architecture, ordinal-first chapter filenames, URL extraction contracts, and the September 2026 STT caption and timing work. It remains accepted authority for Step 2 URL, OCR, and STT execution and for the public extract artifacts those steps write.

## Context

Step 2 runs after [ADR-001](ADR-001-source-ingestion-and-normalization.md) has classified and normalized a source and [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) has supplied the work plan. URL, OCR, and STT share provider identity. Each owns retries, normalized output, and artifacts. Canonical progress stays in the ADR-002 manifest. Raw responses and derived files are not resume authority.

An article is resumable URL extraction. An X Space is a separate route and is not resumable. Neither route is inferred from the other.

OCR also chooses the local engine, classifies hosted failures, sizes page concurrency, estimates cost, and names the files a multi-provider run writes. Failure classification decides whether automatic resume may retry a provider. Token-priced estimates were drifting from billed usage, and a repeated deterministic blocker was visible only on the item that hit it.

Chapter paths disagreed across producers. EPUB export used reading order, such as `chapters/01-title.txt`. PDF chapter detection used the source page, such as `chapters/011-title.txt`. One contract has to sort by reading order and still keep the source locator and split-part behavior.

STT caption export dropped words, lost fractional offsets, and labeled timing and speakers without saying which evidence produced them. Provider words, reconstructed tokens, generated timestamps, and retrieved caption spans are different kinds of evidence. Repairing a caption file must keep a successful transcription and must not run provider inference again.

Why now: hosted OCR estimates, incompatible chapter paths, and the September 2026 STT audit needed one execution and artifact contract.

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
- **Quantitative Notes:** Promotion needs at least 3 matching healthy samples and median absolute percentage error above 20%

**Option 2**

- **Option:** Tune `costMultiplier` until the total estimate matches a benchmark
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
- **Quantitative Notes:** Emitted only for an actionable batch

**Option 2**

- **Option:** Add blocker and cost aggregates as mutable top-level manifest state
- **Pros:** Easy for readers to find
- **Cons:** Duplicates child provider authority and can drift during partial writes or resume
- **Quantitative Notes:** Rejected; a derived report must not become resume authority

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
- **Quantitative Notes:** Five local subtitle formats: SRT, VTT, ASS, TTML, and LRC

**Option 2**

- **Option:** Depend on native subtitle exports or the existing transcript-video renderer
- **Pros:** Reuses provider formatting or an established rendering path
- **Cons:** Leaves integrations without native exports uncovered and couples caption files to inference or video rendering
- **Quantitative Notes:** Rejected; native subtitle routes did not cover every integration

**Option 3**

- **Option:** Replace missing or invalid provider boundaries with uniformly spaced words and treat automatic alignment as verified timing
- **Pros:** Produces superficially consistent word cues
- **Cons:** Hides source defects, confuses interpolation with acoustic evidence, and can support unjustified accuracy claims
- **Quantitative Notes:** Rejected; a live Parakeet sample had 12 zero-duration words out of 24, and the short automatic reference kept five low-confidence words

## Decision

Step 2 execution is owned by domain, above shared provider identity. URL, OCR, and STT each own adapters, retries, response handling, normalized output, and artifacts. Canonical progress and resume eligibility stay in the [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) manifest.

This applies to:

- URL, OCR, and STT execution, retries, response handling, normalized domain output, and Step 2 artifact writes.
- STT timing provenance, caption exports, local alignment and comparison, channel merging, and reviewed speaker-label reconciliation.
- Native EPUB and ebook chapter files, PDF chapter-detection files, and split parts produced by `--length <n>`.
- Routes that write chapter files or extract artifacts. A rerun recreates files under the current names.

It does not apply to:

- Source identity, classification, and normalization ([ADR-001](ADR-001-source-ingestion-and-normalization.md)).
- Canonical pipeline state, resume authority, and price dry runs ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).
- Local OCR toolchain provisioning ([ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)).
- Shared hosted admission, ramps, and lane pressure ([ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)).
- Hosted model identity, lifecycle, reasoning, and pricing provenance ([ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)).
- Queue claims, handoff, and the product choice of fan-out versus pooled page execution ([ADR-015](ADR-015-distribute-ocr-pages-across-a-multi-provider-work-pool.md)).

### Extract domain ownership

`extract --provider` and `resume` use the same route-qualified STT and OCR names. There is no second list of provider spellings.

`article` is a first-class URL route. It is never inferred from `x-space`, input family, or provider metadata. X Spaces keep their own route and stay non-resumable. URL adapters write domain artifacts. Provider progress is recorded only in the canonical manifest.

### OCR execution

Tesseract is the only local OCR engine. Source-specific OCR follows ebook, image, PDF, and office/native inputs.

A hosted failure carries retryability and redacted diagnostics. Automatic resume skips a deterministic provider blocker such as quota, billing, account, or policy. Selecting that provider again on resume includes the blocked target after repair or an explicit retry.

Hosted page work uses the shared provider and account lanes in [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md). Omitting `--step-concurrency ocr-page` selects adaptive `auto` sizing from document size and qualified profiles, up to `48` or an explicit user cap. `--step-concurrency ocr-page=<n>` is a hard ceiling. [ADR-024](ADR-024-derive-cli-help-from-registries-and-generalize-provider-flags.md) replaced `--ocr-concurrency`. `--concurrency-mode ramp|immediate` controls hosted startup. Local Tesseract, page rendering, and normalization start immediately.

Token-priced OCR keeps published rates and prompt and completion shapes explicit, with `costMultiplier: 1`. Canonical usage follows each provider's billed prompt and completion components, including thought tokens when the provider bills them. A component is calibrated only from healthy samples qualified by provider, concrete model, OCR mode, page-count band, and effective reasoning policy. Promotion requires at least three matching samples, a consistent direction, and median absolute percentage error above 20%. Failed, partial, or incomplete work cannot become a trusted warm start. Pool evidence and fan-out evidence are not interchangeable.

`ocr-batch-diagnostics.json` is written only when a deterministic blocker affects multiple items, partial provider usage exists, actual cost is missing for attempted hosted work, or absolute estimate error exceeds 20%. The file is a sanitized, regenerable projection of the final canonical manifest and is never resume authority. A clean rerun removes a stale report.

### Fan-out and pool artifacts

[ADR-015](ADR-015-distribute-ocr-pages-across-a-multi-provider-work-pool.md) owns the `fanout|pool` product choice. This record owns the public artifacts those modes write.

`fanout` is the default. Explicit `--ocr-provider-mode fanout` matches omitting the flag. Every selected target receives the full document and writes a complete result under its provider directory. `--primary-ocr` may copy one of those complete results to the top-level extraction.

`--ocr-provider-mode pool` writes one top-level composite extraction with `extractionMethod: "ocr-pool"`, assembled in original page order. `--primary-ocr` is rejected before credential lookup or dispatch. Provider directories hold attributed page attempts, not a second complete extraction.

Every accepted page records provider, model, reasoning, attempt, usage, cost, timing, and artifact path. A failed or ambiguous attempt keeps the same attribution and any reported paid usage, and it does not become accepted output. A hosted page-response cache is not reused across a different provider mode, model, reasoning setting, input, page, or render.

### Chapter artifact filenames

Every direct chapter producer writes `chapters/<ordinal>-<source-locator>-<slug>.txt`. PDF uses the starting source page. EPUB uses the original spine section index when it is available, otherwise the logical section index.

Ordinal and split-part fields use two digits below 100 generated files and three digits at 100 or more. A source locator is padded to at least three digits and is never truncated. A split file appends `-part-NN` to the same base.

### STT timing and caption artifacts

`result.json` stores numeric word ranges, text, confidence, speakers, raw and chunk evidence, and applied source offsets before any caption file is written. Timing is labeled native, token-derived, aligned, generated, repaired, caption-span, interpolated, or mixed. A parsed `rawResponse` is retained evidence. It does not mean every original wire field was kept. Fractional offsets stay fractional, and each source offset is applied once. A local speaker ID is scoped to its chunk or channel. Matching IDs do not by themselves mean the same person.

Caption export checks finite, nonnegative, positive-duration intervals, duplicate spans, and full transcript coverage. Valid overlaps and original provider boundaries stay. The exporter fills an uncovered or invalid word only when a usable segment bound exists, counts that inference, and fails when uncovered text has no usable timing. A reading or layout warning does not move the stored measurements. `captions.json` records cue timing, quality, invalid and inferred counts, format limits, and warnings. It is derived output and is not resume authority.

Fresh media is transcribed once per selected model. Canonical results and successful provider state are saved, then captions are exported outside the transcription retry loop. Export from a saved result is local: it needs neither the audio nor a video renderer. Options are validated before inference, existing output files are left in place, and the run prints the normal single terminal result. An optional native subtitle file reuses that same inference or completed job. An export failure keeps the transcription and writes diagnostics. A native split-chunk file stays on provider-relative time. A combined export uses the recording timeline. Requesting native exports on resume does not create export jobs for a target that already succeeded. Resume rejects a transcription setting change that would reuse incompatible evidence.

Diarization support is resolved for the concrete model and labeled documented, provisional, or live-tested. Together diarization defaults off. Mistral `voxtral-mini-2602` returns native word timing only with diarization off. With diarization it returns segments, and a timestamp request omits the incompatible language field. A generated Gemini timestamp or speaker hypothesis, a retrieved caption, and a channel label are not a native acoustic measurement or a verified identity.

Local forced alignment needs supplied text whose segments are complete, positive, and non-overlapping, plus explicit paths to an installed model and runtime. Original evidence and hashes are preserved. New timing is marked aligned and `manuallyVerified: false`. A word below the configured confidence threshold is withheld from publication and kept in diagnostics. Comparison scores ordered lexical matches, coverage, boundary error, tolerance bands, speaker-label agreement, and signed drift, and it rejects an invalid interval. Installed whisperfile capabilities are probed before calibration. A range derived from DTW token-center midpoints is marked repaired. A rejected variant is retained. Calibration does not change transcription defaults.

Channel extraction keeps every stream at its original sample rate. Merge checks full text coverage, applies offsets once, preserves overlaps, and rejects a result that is already merged. Speaker reconciliation requires an explicit map tied to the source SHA-256 and a review reason. It does not infer identity from the audio. Flags, setup, and examples are in the [STT command guide](../commands/02-extract/stt/overview.md) and [local timing and speaker workflows](../commands/02-extract/stt/workflows/timing/overview.md#local-timing-and-speaker-workflows).

## Rationale

- Tesseract gave the best performance-to-complexity ratio in local testing and avoided a second local OCR engine to provision and maintain.
- Retry-aware blockers stop automatic resume from repeating quota, billing, account, policy, and other deterministic failures.
- Adaptive OCR caps raise large-document throughput while an explicit `--step-concurrency ocr-page=<n>` and the [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) lanes still bind the run.
- Explicit token components keep pricing-tier meaning and stop a profile-derived usage figure from being multiplied a second time.
- A derived batch report shows repeated blockers and cost gaps without a second mutable copy of provider state.
- Explicit URL routes and one extract and resume selector list keep each new provider selectable without an inferred route or a second spelling.
- An ordinal first makes EPUB and PDF chapter paths sort by reading order. A real source locator keeps the file traceable to its position in the source.
- Separate fan-out and pool artifacts keep a per-provider comparison result from being read as the composite, and cache identity stops a page response from one mode being reused in another.
- Full text coverage and explicit timing labels stop a dropped word or an inferred interval from being presented as native word evidence.
- Saving a successful transcription before caption export allows a later local export without a second provider charge.
- Automatic-reference measurements and one live model sample support only the claims those samples can carry. They do not establish general acoustic accuracy or speaker identity.

## Consequences

Positive outcomes:

- Article extraction has one explicit route, and an X Space cannot be treated as that route during execution or resume.
- Local OCR has one execution path, using the toolchain [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md) provisions.
- Hosted OCR keeps useful partial results, tells the operator what resume can safely retry, and skips a known deterministic failure.
- A clean large run can use available throughput. A pressured lane falls back conservatively.
- Estimates and diagnostics show wall time, retry pressure, partial usage, and token-shape drift.
- An actionable OCR batch writes one sanitized blocker and cost diagnostic. A clean batch stays quiet.
- Fan-out keeps a complete result per provider. Pool writes one composite extraction in original page order.
- EPUB and PDF chapters share one public path shape that sorts by reading order and keeps the source position.
- A saved STT result can produce captions and local timing analysis while the source evidence and the successful transcription stay intact.

Negative outcomes:

- Difficult inputs have no local OCR engine other than Tesseract.
- Provider failure classifiers and profile schemas need maintenance as hosted APIs change.
- A clean profile can go stale when provider routing, limits, models, account tiers, or reasoning defaults change.
- Pool mode does not write a complete extraction per provider.
- Automatic alignment and model-capability evidence have to state confidence, language, overlap, and sample size. Timestamp precision alone does not establish accuracy.

## Trade-offs

**Trade-off 1**

- **Gain:** One local engine and a smaller dependency surface
- **Sacrifice:** Local engine diversity

**Trade-off 2**

- **Gain:** Deterministic blocker handling and an auditable fallback
- **Sacrifice:** More provider-state metadata

**Trade-off 3**

- **Gain:** `--step-concurrency ocr-page=auto`, the omitted default, can use available throughput
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

- **Gain:** Complete caption text, auditable timing changes, and local recovery from saved STT evidence
- **Sacrifice:** More provenance and validation artifacts; some exports or measurements fail when the evidence cannot support them

## Implementation Note

`extract` ships this contract for URL, OCR, and STT. The command guides under References are the operator surface for flags, artifact names, and examples.

### Bun 1.4 Image Routing

The 2026-08-31 evaluation kept production TIFF routing on the direct-provider or ImageMagick path. Bun 1.4 decodes TIFF on macOS and Windows only. Linux and the supported Docker image still require ImageMagick, and Bun.Image has no composition operation, so ImageMagick also remains the comic compositing engine. Removal of the redundant Bun.Image type declarations is recorded in [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md#bun-14-image-declarations).

### STT Caption and Timing Archive

The September 2026 caption and timing follow-ups were completed on 2026-09-10. The limits below still bound what a passing STT run may claim.

Automatic English references were built from existing local files and are marked `manuallyVerified: false`. Alignment cannot recover omitted speech, decide wording, separate overlapping voices, or verify speakers. Its confidence is an emission score, not a calibrated probability. Agreement with those references varied by model, and no transcription default changed. Two English excerpts do not establish a hosted-provider ranking, multilingual or overlapping-speaker accuracy, number handling, or verified speaker identity.

whisper.cpp figures from that pass are historical. Local transcription and calibration now use whisperfile. The Python CTC runtime used for the references was replaced by the TypeScript/ONNX aligner in the STT timing guide. Those measurements have not been repeated on ONNX.

One approved six-second Together `nvidia/parakeet-tdt-0.6b-v3` run, with diarization and a speaker bound of two, returned 24 words, 12 of them zero-duration. SRT and VTT export kept all 24 words, reported 12 invalid and 12 inferred timings, and left the canonical native intervals unchanged. That sample sets `diarizationValidation: live-tested` for endpoint compatibility only. It is not verified speaker identity, not uniformly valid native word timing, and not a timing ranking. The automatic reference was not independent ground truth, so the run stays out of timing comparisons.

## API / Type Impact

- Omitting `--step-concurrency ocr-page` selects adaptive hosted scheduling. `--step-concurrency ocr-page=<n>` is a hard ceiling for scheduling and estimates. [ADR-024](ADR-024-derive-cli-help-from-registries-and-generalize-provider-flags.md) replaced `--ocr-concurrency`.
- `--ocr-provider-mode fanout|pool` defaults to `fanout`. Pool mode writes one composite top-level extraction with `extractionMethod: "ocr-pool"`, stores attempts under `providers/<target>/attempts/`, and rejects `--primary-ocr`.
- Automatic resume skips a deterministic provider blocker. Naming that provider on resume includes the target again.
- `ocr-batch-diagnostics.json` is written only for an actionable batch. It is a regenerable projection of the final manifest and is not resume authority. A clean rerun deletes a stale file.
- Chapter naming adds no flag. PDF paths use `NN-PPP-title`. EPUB paths use `NN-III-title`. Width grows with the file count, and a split part appends `-part-NN`.
- `extract` and `resume` accept the same route-qualified STT and OCR provider names.
- STT `result.json` keeps word evidence and timing labels. `captions.json` reports invalid and inferred counts and format limits. Diarization capability is per model and separates documented support from live-tested support.
- Local alignment, comparison, calibration, channel split and merge, and reviewed speaker maps write separate derived files, leave the source files in place, and show zero provider cost under `--price`.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/text/ocr/chapter-artifact-filenames.test.ts
bun test test/test-cases/validation/text/ocr/ocr-batch-diagnostics.test.ts
bun test test/test-cases/validation/text/ocr/ocr-page-pool-*-contracts.test.ts
bun test test/test-cases/validation/text/ocr/ocr-resilience-contracts/
bun test test/test-cases/validation/text/ocr/ocr-resume-failure-target-contracts.test.ts
bun test test/test-cases/validation/text/ocr/ocr-resume-provider-state-contracts.test.ts
bun test test/test-cases/validation/reports-pricing/price-mode-contracts/ocr-token-usage-profiles.test.ts
bun test test/test-cases/validation/providers/provider-selection-contracts/selection-inventory-contracts.test.ts
bun test test/test-cases/validation/stt/
bun test test/test-cases/validation/providers/openai-rest-contracts/audio-stt-contracts.test.ts
bun test test/test-cases/validation/stt/workflows/transcript-video/transcript-video-contracts.test.ts
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. Typecheck and the unique-source check pass.
2. Mapped price commands stay no-cost and do not dispatch a provider.
3. Chapter producers emit ordinal-first, source-locator paths with dynamic widths and split suffixes.
4. Batch diagnostics are emitted only for an actionable blocker or cost gap, stay regenerable, and never become resume authority.
5. Pool artifacts stay composite, isolate attempts, reject `--primary-ocr`, and leave default fan-out unchanged.
6. Hosted failure classification, `auto` versus fixed OCR caps, and automatic versus explicit resume skip deterministic blockers.
7. Token profiles reject identifying data and unhealthy samples, and token-priced OCR keeps `costMultiplier: 1`.
8. Extract and resume selectors stay equal to the canonical STT and OCR target maps.
9. Help and usage contracts keep OCR mode and concurrency flags stable.
10. STT contracts keep all text, numeric boundaries, source offsets, overlaps, and provenance. Local captions and alignment report invalid or inferred timing without changing provider evidence.
11. Compatible-STT request contracts cover model-specific diarization, timestamp fields, and safe retries against mocked endpoints. Transcript-video contracts exercise local media and saved evidence.

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
- Extract command guide: [`docs/commands/02-extract/overview.md`](../commands/02-extract/overview.md)
- OCR command guide: [`docs/commands/02-extract/ocr/overview.md`](../commands/02-extract/ocr/overview.md)
- STT command guide: [`docs/commands/02-extract/stt/overview.md`](../commands/02-extract/stt/overview.md)
- Local STT timing and speaker workflows: [STT timing guide](../commands/02-extract/stt/workflows/timing/overview.md#local-timing-and-speaker-workflows)
- Resume command guide: [`docs/commands/00-setup-and-utilities/resume.md`](../commands/00-setup-and-utilities/resume.md)
- `src/cli/commands/text/url/`
- `src/cli/commands/text/ocr/`
- `src/cli/commands/stt/`
