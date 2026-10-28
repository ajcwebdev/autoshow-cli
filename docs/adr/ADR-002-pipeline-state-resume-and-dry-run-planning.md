# ADR-002: Define Pipeline State, Resume, and Dry-Run Planning

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-10-28
- **Verification Status:** Passed
- **Supersession:** Absorbs "Record Effective Provider Settings in Run Records." Comic recovery is owned by [ADR-013](ADR-013-comic-scene-audio-and-presentation.md#recorded-comic-recovery-through-resume), and pooled OCR execution by [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md). [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md) replaces the blanket requirement to rebuild pre-delivery-mastering TTS runs with reuse of compatible canonical runs. Canonical manifests, non-mutating price planning, and in-manifest OCR page state remain accepted.

## Context

Metadata, download, extract, write, generation, and resume need one command-neutral description of planned work and one canonical record of work already attempted. Pipeline state was previously split across files, so commands had to infer routing and reconcile derived state across runs.

Pipeline manifests describe execution state rather than a durable interchange format. Incompatible formats require a new run; retained outputs remain evidence and may contain purchased artifacts.

Resume can backfill missing provider outputs across extract, write, TTS, image, video, and music, and continue recorded comic stages. Standalone and extract runs share their execution command's provider-selection surface, so resume can start paid work and needs a cost preflight.

The manifest previously named each provider by service and model without recording its effective controls. A separate settings record lets users inspect how an output was produced without changing the identity of purchased audio.

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
- **Cons:** Maintains obsolete formats alongside the current execution contract
- **Quantitative Notes:** n/a

### Resume price planning

**Option 1 (selected)**

- **Option:** Add `--price` dry-run preflight across all resume target types
- **Pros:** Consistent no-cost preflight; prevents unexpected paid runs
- **Cons:** Each resume workflow must plan remaining work without executing it
- **Quantitative Notes:** 7 command families, including recorded comic recovery

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
- **Pros:** One predictable location for every command without changing existing identity fields
- **Cons:** Older run directories have no record
- **Quantitative Notes:** n/a

**Option 2**

- **Option:** Put settings into `providers[].options`
- **Pros:** No manifest schema change
- **Cons:** Rejected; changes the existing audio and STT resume contract
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

- Long-term interchange or document export formats, or migrations from superseded persistence formats.
- Provider-named flags on the resume CLI surface.
- Source identity, classification, and URL route execution, which belong to [ADR-001](ADR-001-source-ingestion-and-normalization.md).
- OCR execution, pooled page claim and retirement, and OCR artifacts, which belong to [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md).
- STT execution, timing, and caption artifacts, which belong to [ADR-009](ADR-009-stt-timing-captions-and-alignment.md).
- Initial comic generation and explicit stage reruns, which belong to [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md) and [ADR-017](ADR-017-comic-script-and-scene-authoring.md).
- Comic scene audio, local slideshow encoding, and the stage semantics of recorded comic recovery, which belong to [ADR-013](ADR-013-comic-scene-audio-and-presentation.md).
- Paid-slot identity, render identity, and audio compatibility checks, which belong to [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md).

### Command-neutral work planning

After [ADR-001](ADR-001-source-ingestion-and-normalization.md) classifies and routes a source, this record owns the batch work plan that turns those results into ordered, route-aware items for download, extract, write, generation, and resume. Explicit `article` and `x-space` routes are kept in the work plan and in `manifest.json`.

### Canonical `manifest.json`

Every pipeline output root contains exactly one unversioned `manifest.json`. It records planned items, routes, outputs, statuses, and provider progress. Mixed-route batches link to child manifests. Raw responses and output files support artifact validation; they do not replace the manifest as the state authority.

Missing, invalid, or superseded manifests fail before provider work. Unsupported formats require a new run rather than automatic migration.

### Resume and `resume --price`

`resume --price` estimates the work execution would attempt, then exits. It covers extract STT, OCR, and URL; write LLM; and standalone TTS, image, video, and music. Extract and additive generation resume missing or failed stored targets and can add selections. Write LLM runs only providers named with `--provider` or `--all-providers`. It makes no provider calls, writes no manifests or provider artifacts, and uses the same target selection as execution. Unsupported or non-resumable manifests produce usage errors.

Resume uses `--provider provider[=model]`, `--all-providers`, and, for extract routes, `--all-local`; provider-prefixed flags and unknown flags fail at parse time. Model selection follows the current execution inventory. Extract keeps route awareness: a stored STT run cannot resume as OCR, and a stored OCR run cannot resume as STT. X Space runs are not resumable.

Completed TTS audio can receive new model targets without rebuying existing audio. A canonical directory created before delivery mastering keeps its purchased slots: when no chunking or mastering flag is explicit, `resume` and `resume --price` adopt that run's legacy chunking and 16 kHz output ([ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md)). An explicit mismatch fails closed without spending. Pre-canonical TTS manifests stay unreadable; rebuild those directories with the current `tts` command before adding new models.

Standalone and extract resume use `--concurrency-mode` or the configuration default. Comic recovery restores its recorded concurrency.

`resume` accepts canonical single-scene comic manifests and continues requested image, audio, and presentation stages; the stage semantics, accepted flags, rejected overrides, and `--price` behavior for that recovery are owned by [ADR-013](ADR-013-comic-scene-audio-and-presentation.md#recorded-comic-recovery-through-resume).

### Pooled OCR page state

Pooled OCR page progress and accepted results live in the canonical item. Its execution, mode compatibility, and unfinished-page pricing are owned by [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md).

### Provider settings record

Each provider entry may carry versioned `settings` describing effective request controls, output-shaping local options, and accepted but ignored flags. Paths inside the project are relative to the project root, secret-like values are redacted, and lexicons and prompt files include content hashes.

TTS, generation, write, extract, and comic providers record applicable controls. Write records successful, failed, and missing requested targets; a failed target may lack resolved request details. Resume preserves records for untouched targets and refreshes targets that run again. Saved TTS chunking, mastering, export, and pronunciation options are restored where retained; complete reconstruction of every generation control remains unfinished.

The `settings` envelope is separate from identity fields and is optional for older compatible runs.

## Rationale

- A single canonical manifest removes duplicated route inference and competing run-state files.
- Rejecting superseded formats bounds compatibility work while preserving the current resume contract.
- Universal `resume --price` gives a no-cost estimate before resume can start paid provider work.
- A shared selection inventory and provider-neutral resume flags keep every command's models resume-selectable without option collisions.
- A dedicated `settings` field records effective values without changing identity fields; redaction and relative paths keep credentials and checkout paths out of those records.

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
- Free-text instructions and voice preview text are stored verbatim in `settings`; music lyrics files are recorded by path without a content hash.

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

- **Gain:** Settings are recorded separately from paid-slot identity
- **Sacrifice:** Older compatible runs may lack settings, and full generation-option reconstruction remains incomplete

## Implementation Note

The manifest contract is implemented under `src/cli/commands/command-shared/pipeline-manifest/`; resume dispatch and planning live under `src/cli/commands/setup-and-utilities/resume/`. Usage is documented in the [resume guide](../commands/00-setup-and-utilities/resume.md).

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/resume-manifests/canonical-manifest-contracts.test.ts
bun test test/test-cases/validation/resume-manifests/documented-resume-workflows.test.ts
bun test test/test-cases/validation/resume-manifests/resume-provider-flag-surface-contracts.test.ts
bun test test/test-cases/validation/audio/tts/tts-resolved-chunk-plan.test.ts
bun test test/test-cases/validation/audio/tts/tts-provider-settings-record.test.ts
```

1. Canonical manifest contracts validate current layouts and reject unsupported state.
2. Documented workflows exercise local extraction, recorded comic no-ops, failed-write recovery through mocked transport, and non-mutating price inspection.
3. Provider flag contracts keep execution and resume selections aligned.
4. TTS contracts verify saved chunk-plan restoration and settings validation, redaction, and relative paths. They do not establish audible quality.

## Follow-up Actions

- [ ] Restore remaining generation and TTS controls from saved `settings` — Pending
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
