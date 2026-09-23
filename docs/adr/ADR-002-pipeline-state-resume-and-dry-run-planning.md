# ADR-002: Define Pipeline State, Resume, and Dry-Run Planning

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed
- **Supersession:** Absorbs the retired record "Record Effective Provider Settings in Run Records" as the run-record authority for the optional provider `settings` envelope. Recorded comic recovery moved to [ADR-013](ADR-013-comic-scene-audio-and-presentation.md#recorded-comic-recovery-through-resume), and pooled OCR page claim, retirement, and pricing moved to [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md). The requirement that every pre-delivery-mastering standalone TTS directory be rebuilt before `resume` is superseded by [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md): canonical manifests that retain legacy chunking and 16 kHz output are adopted when no chunking or mastering flag is explicit, and purchased slots stay reusable. Pre-canonical TTS manifests remain unreadable and must be rebuilt. The canonical `manifest.json`, non-mutating `resume --price`, and in-manifest pooled OCR page state remain accepted.

## Context

Metadata, download, extract, write, generation, and resume need one command-neutral description of planned work and one canonical record of work already attempted. Pipeline state was previously split across files, so commands had to infer routing and reconcile derived state across runs.

Pipeline outputs are disposable execution state, not a durable interchange format. Rerunning is the supported recovery path after persistence schema changes.

Resume can backfill missing provider outputs across extract, write, TTS, image, video, and music. It shares the execution command's provider-selection surface (`--provider provider[=model]`, `--all-providers`, `--all-local`), so it can start paid work, and it had no dry-run cost estimate.

The manifest also named each provider by service and model but not the settings sent to it, so a finished run could not show whether a control such as `--tts-stability 0.8` reached the provider. The existing `options` field could not hold that record: it is frozen for audio targets after the first write, STT resume reads it as flat keys, and the record has to stay outside every identity hash so purchased audio is never repurchased.

Why now: resume became a paid-provider entry point without a cost preflight, fragmented state made resume and price planning infer run state instead of reading one authority, and the canonical record could not show which provider settings produced a run.

## Options Considered

### Pipeline state persistence

**Option 1 (selected)**

- **Option:** One current, unversioned canonical `manifest.json`; reject older output instead of migrating it
- **Pros:** One authority for every command and resume
- **Cons:** Older outputs must be regenerated
- **Quantitative Notes:** Exactly one `manifest.json` per output directory

**Option 2**

- **Option:** Per-command or per-artifact formats
- **Pros:** Domains evolve their formats independently
- **Cons:** Recreates fragmentation and competing authorities
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Versioned compatibility readers and migrations
- **Pros:** Opens historical output directories
- **Cons:** Preserves obsolete formats for disposable execution state
- **Quantitative Notes:** n/a

### Resume price planning

**Option 1 (selected)**

- **Option:** Add `--price` dry-run preflight across all resume target types
- **Pros:** Consistent no-cost preflight; prevents unexpected paid runs
- **Cons:** Each resume workflow must plan remaining work without executing it
- **Quantitative Notes:** 6 resume domains

**Option 2**

- **Option:** Add `--price` only for OCR resume
- **Pros:** Smallest initial implementation
- **Cons:** Inconsistent CLI behavior and unbudgeted paid runs in other workflows
- **Quantitative Notes:** 1 extract route

**Option 3**

- **Option:** Reject `resume --price`
- **Pros:** No planning implementation
- **Cons:** Users estimate costs by hand or risk unexpected paid calls
- **Quantitative Notes:** n/a

### Provider settings record

**Option 1 (selected)**

- **Option:** Add one optional `settings` envelope to every provider entry, derived from the values each command already resolves and excluded from identity checks and hashes
- **Pros:** One predictable location for every command; `options` is unchanged, so audio and STT resume are untouched
- **Cons:** Older run directories have no record
- **Quantitative Notes:** Identity hashes for all eight hosted TTS providers stayed byte-identical

**Option 2**

- **Option:** Put settings into `providers[].options`
- **Pros:** No manifest schema change
- **Cons:** Rejected; `options` is immutable for audio targets and parsed flat by STT resume
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Stop compacting per-request TTS evidence
- **Pros:** Keeps the exact serialized requests
- **Cons:** TTS only, and undoes the compact archive's file-count bound
- **Quantitative Notes:** n/a

## Decision

Establish a single unversioned canonical `manifest.json` as the sole authority for pipeline execution state and batch work planning, reject superseded formats instead of migrating them, provide a non-mutating `resume --price` dry-run across every resume workflow, and let each provider entry carry an optional versioned `settings` envelope that records the effective values sent to the provider outside every identity hash.

This applies to:

- Command-neutral batch work planning and canonical pipeline persistence.
- Resume execution and `--price` dry-run preflight across extract (STT, OCR, URL), write (LLM), and generation (TTS, image, video, music).
- The same provider and model inventory on an execution command and that command's resume path.
- The optional `settings` envelope on every provider entry.
- The `resume` entry point for recorded comic runs, whose stage semantics are owned by [ADR-013](ADR-013-comic-scene-audio-and-presentation.md#recorded-comic-recovery-through-resume).

It does not apply to:

- Long-term interchange or document export formats, or backward compatibility for older or interrupted runs.
- Provider-named flags on the resume CLI surface.
- Source identity, classification, and URL route execution, which belong to [ADR-001](ADR-001-source-ingestion-and-normalization.md).
- OCR execution, pooled page claim and retirement, and OCR artifacts, which belong to [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md).
- STT execution, timing, and caption artifacts, which belong to [ADR-009](ADR-009-stt-timing-captions-and-alignment.md).
- Initial comic generation and explicit stage reruns, which belong to [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md) and [ADR-017](ADR-017-comic-script-and-scene-authoring.md).
- Comic scene audio, local slideshow encoding, and the stage semantics of recorded comic recovery, which belong to [ADR-013](ADR-013-comic-scene-audio-and-presentation.md).
- Paid-slot identity, render identity, and the audio immutability check, which belong to [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md). None of them read `settings`.

### Command-neutral work planning

After [ADR-001](ADR-001-source-ingestion-and-normalization.md) classifies and routes a source, this record owns the batch work plan that turns those results into ordered, route-aware items for download, extract, write, generation, and resume. Explicit `article` and `x-space` routes are kept in the work plan and in `manifest.json`.

### Canonical `manifest.json`

Every pipeline output root contains exactly one unversioned `manifest.json`. Each item records its input, route, output, status, and provider progress, and progress, completion, and batch summaries are derived from that record. Provider directories may keep raw responses, but those files never decide resume eligibility. Mixed-route batches link to child directories, each with its own `manifest.json`.

Missing, malformed, invalid, or superseded manifests fail before any provider work. Older output directories must be rerun with the current command; they are not migrated.

### Resume and `resume --price`

`resume --price` estimates the work execution would attempt, then exits. It covers extract STT, OCR, and URL; write LLM; and standalone TTS, image, video, and music. Extract and additive generation resume missing or failed stored targets and can add selections. Write LLM runs only providers named with `--provider` or `--all-providers`. It makes no provider calls, writes no manifests or provider artifacts, and uses the same target selection as execution. Unsupported or non-resumable manifests produce usage errors.

Resume accepts only provider-neutral options. Provider-named flags and other unknown flags fail at parse time. Every model selectable by an execution command is selectable additively by that command's resume path, including local targets and `--all-*` shortcuts. Extract keeps route awareness: a stored STT run cannot resume as OCR, and a stored OCR run cannot resume as STT.

Completed TTS audio can receive new model targets without rebuying existing audio. A canonical directory created before delivery mastering keeps its purchased slots: when no chunking or mastering flag is explicit, `resume` and `resume --price` adopt that run's legacy chunking and 16 kHz output ([ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md)). An explicit mismatch fails closed without spending. Pre-canonical TTS manifests stay unreadable; rebuild those directories with the current `tts` command before adding new models.

Resume starts a new run with `--concurrency-mode` or the configuration default.

`resume` accepts canonical single-scene comic manifests and continues requested image, audio, and presentation stages; the stage semantics, accepted flags, rejected overrides, and `--price` behavior for that recovery are owned by [ADR-013](ADR-013-comic-scene-audio-and-presentation.md#recorded-comic-recovery-through-resume).

### Pooled OCR page state

When an OCR item ran in pool mode, its page progress, attempts, and accepted results live in that item. There is no second state file. Page claim, target and lane retirement, detection of an explicit `--ocr-provider-mode` mismatch with the stored mode, re-enabling a retired target, and unfinished-page pricing are owned by [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md).

### Provider settings record

Each provider entry may carry `settings`, a versioned envelope `{ schemaVersion, settingsSchema, request, local?, ignored? }`. `request` holds the effective values sent to the provider, with defaults filled in. `local` holds local processing that shapes the output. `ignored` lists flags a model accepts but does not apply. Empty values are omitted. Paths inside the project are stored relative to the project root. Secret-like values are redacted. Lexicons and prompt files are recorded by path and sha256.

`tts` and comic audio record the resolved voice and the delivery, chunking, export, and lexicon options sent to the provider. `image`, `video`, and `music` record the request sent to the provider. `write` records one provider entry per successful LLM target. `extract` STT, OCR, and URL, plus comic images and sound effects, record their effective request. Generation and TTS resume keep the stored record and refresh it for targets that run again.

`settings` is excluded from every identity hash and from the immutable `options` field. Run directories created before this record exist stay without `settings`.

## Rationale

- A single canonical manifest removes duplicated route inference and competing run-state files.
- Rejecting older formats matches the constraint that pipeline state is rebuildable execution state, not a long-lived interchange format.
- Universal `resume --price` gives a no-cost estimate before resume can start paid provider work.
- A shared selection inventory and provider-neutral resume flags keep every command's models resume-selectable without option collisions.
- A dedicated `settings` field records effective values without migrating manifests or touching the `options` field resume already reads, and its redaction and path rules keep an API key, a PDF password, or a checkout path out of run records.

## Consequences

Positive outcomes:

- One `manifest.json` is the only authority for progress, completion, and resume eligibility, and an invalid, foreign, or superseded manifest fails before any provider work.
- Users can preflight single-directory, multi-directory, and additive resume costs at zero expense.
- Completed TTS runs can add new models without rebuying already-rendered audio.
- A run record shows which provider controls and local settings produced its output, and existing audio and STT directories still resume.

Negative outcomes:

- Older pipeline output directories, including pre-canonical TTS directories, must be regenerated, and explicit chunking or mastering flags that differ from a retained canonical plan fail closed.
- `resume --price` falls back to configuration or provider defaults when a manifest lacks size, duration, or page counts.
- Large pooled OCR documents grow `manifest.json` with page count.
- Free-text instructions and voice preview text are stored verbatim in `settings`, lyrics files are recorded by path only, and failed `write` targets have no provider entry.

## Trade-offs

**Trade-off 1**

- **Gain:** One canonical work and state authority with no compatibility migrations
- **Sacrifice:** Older superseded output directories must be rebuilt, including completed pre-canonical TTS runs

**Trade-off 2**

- **Gain:** Safe provider-neutral resume price planning
- **Sacrifice:** Each resumable domain maintains dry-run planning alongside execution

**Trade-off 3**

- **Gain:** New models on a command are automatically resume-selectable
- **Sacrifice:** Provider additions must update the shared selection inventory, not a resume-only list

**Trade-off 4**

- **Gain:** Settings are recorded without touching paid slot identity or resume behavior
- **Sacrifice:** Settings live in a new field rather than the `options` field resume reads, so resume cannot yet rebuild a run from them

## Implementation Note

Shipped as the canonical `manifest.json` written by every pipeline command, the provider-neutral `resume` command with `--price`, and the `settings` envelope recorded by `tts`, comic audio, `image`, `video`, `music`, `write`, and `extract`. Usage is documented in the resume command guide.

## API / Type Impact

- Each pipeline output root has exactly one unversioned `manifest.json`.
- `resume` accepts `--price` as a boolean provider-neutral flag and exits before provider dispatch or manifest writes; provider-named flags fail at parse time.
- Execution and resume provider flags share one selection inventory, including local targets and `--all-*` shortcuts.
- Resume `--ocr-provider-mode` only detects an explicit mismatch with the stored pool or fan-out mode; omitting it preserves the stored setting.
- Comic `resume` restores recorded options; the accepted flags and rejected overrides are listed in [ADR-013](ADR-013-comic-scene-audio-and-presentation.md#recorded-comic-recovery-through-resume).
- Each provider entry may carry an optional `settings` envelope `{ schemaVersion, settingsSchema, request, local?, ignored? }` that is outside every identity hash and outside the immutable `options` field.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/reports-pricing/price-mode-contracts/
bun test test/test-cases/validation/resume-manifests/
bun test test/test-cases/validation/providers/provider-selection-contracts/
```

1. Price commands stay no-cost, report selected missing and additive targets, and leave manifests unchanged.
2. Resume-manifest contracts prove one current `manifest.json`, reject superseded layouts, preserve pooled accepted pages, adopt retained legacy chunking and 16 kHz delivery when no chunking or mastering flag is explicit, and continue recorded comic work without provider or rendering overrides.
3. Selection-inventory contracts keep execution and resume model lists identical.
4. Provider `settings` envelopes stay outside identity hashes, redact secret-like values, relativize project paths, and survive resume for targets that run again.

## Follow-up Actions

- [ ] Let resume rebuild generation and TTS options from `settings` instead of re-reading current flags — Pending
- [ ] Record provider entries for failed `write` targets — Pending
- [ ] Hash lyrics files in music settings — Pending

## References

- Related ADR: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Related ADR: [ADR-005](ADR-005-cli-error-result-and-retry-contract.md)
- Related ADR: [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md)
- Related ADR: [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md)
- Related ADR: [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md)
- Related ADR: [ADR-009](ADR-009-stt-timing-captions-and-alignment.md)
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Related ADR: [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md)
- Related ADR: [ADR-013](ADR-013-comic-scene-audio-and-presentation.md)
- Related ADR: [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md)
- [Comic Recovery](../commands/00-setup-and-utilities/resume.md#comic-recovery)
