# ADR-002: Define Pipeline State, Resume, and Dry-Run Planning

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed

## Context

Metadata, download, extract, write, generation, and resume need one command-neutral description of planned work and one canonical record of work already attempted. Pipeline state was previously split across files, so commands had to infer routing and reconcile derived state across runs.

Pipeline outputs are disposable execution state, not a durable interchange format. Rerunning is the supported recovery path after persistence schema changes. Migrating older intermediate states adds maintenance without a compatibility promise.

Multi-provider pooled OCR records page progress, accepted results, and attempts. Those belong in the canonical item, not in provider output files.

Resume can backfill missing provider outputs across extract, write, TTS, image, video, and music. Because resume shares the execution command's provider-selection surface (`--provider provider[=model]`, `--all-providers`, `--all-local`), it can start paid work. `resume --price` was unsupported, so there was no dry-run cost estimate before a paid resume.

Why now: resume became a paid-provider entry point without a cost preflight, and fragmented state made both resume and price planning infer run state instead of reading one canonical authority.

## Options Considered

### Pipeline state persistence

**Option 1 (selected)**

- **Option:** One current, unversioned canonical `manifest.json`; reject older output instead of migrating it
- **Pros:** Gives every command and resume one authority; no competing run-state files or format ambiguity
- **Cons:** Older outputs must be regenerated
- **Quantitative Notes:** Exactly one `manifest.json` per output directory

**Option 2**

- **Option:** Per-command or per-artifact formats
- **Pros:** Lets individual workflow domains evolve formats independently
- **Cons:** Recreates format fragmentation, competing authorities, and complex cross-command dispatch
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Versioned compatibility readers and migrations
- **Pros:** Allows opening historical output directories
- **Cons:** Preserves obsolete intermediate formats for disposable execution state
- **Quantitative Notes:** n/a

### Resume price planning

**Option 1 (selected)**

- **Option:** Add `--price` dry-run preflight across all resume target types
- **Pros:** Provides consistent, no-cost preflight across extract, write, and generation; prevents unexpected paid runs
- **Cons:** Requires each resume workflow to plan remaining work without executing it
- **Quantitative Notes:** Covers 6 resume domains: extract, write, TTS, image, video, music

**Option 2**

- **Option:** Add `--price` only for OCR resume
- **Pros:** Smallest initial implementation
- **Cons:** Leaves inconsistent CLI behavior and unbudgeted paid runs in other workflows
- **Quantitative Notes:** Covers 1 extract route only

**Option 3**

- **Option:** Reject `resume --price`
- **Pros:** Requires no planning implementation
- **Cons:** Users must calculate costs by hand or risk unexpected paid provider calls
- **Quantitative Notes:** No implementation work

## Decision

Establish a single unversioned canonical `manifest.json` as the sole authority for pipeline execution state and batch work planning, reject superseded formats instead of migrating them, and provide a non-mutating `resume --price` dry-run across every resume workflow.

This applies to:

- Command-neutral batch work planning and canonical pipeline persistence (`manifest.json`).
- Resume execution and `--price` dry-run preflight across extract (STT, OCR, URL), write (LLM), and generation (TTS, image, video, music).
- Pooled OCR page progress, attempts, and accepted results stored in the canonical item.
- The same provider and model inventory on an execution command and that command's resume path.

It does not apply to:

- Long-term interchange or document export formats.
- Backward compatibility or automatic migration for older or interrupted runs.
- Provider-named flags on the resume CLI surface.
- Mutating manifests or making network calls during `resume --price`.
- Source identity and classification, which belong to [ADR-001](ADR-001-source-ingestion-and-normalization.md).
- URL and OCR execution and artifacts, which belong to [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md).
- Pooled OCR work selection, which belongs to [ADR-015](ADR-015-distribute-ocr-pages-across-a-multi-provider-work-pool.md).

### Command-neutral work planning

After [ADR-001](ADR-001-source-ingestion-and-normalization.md) classifies and routes a source, this record owns the batch work plan that turns those results into ordered, route-aware items for download, extract, write, generation, and resume.

`article` and `x-space` are distinct explicit routes. Single-item and mixed-route batches keep those routes in the work plan and in `manifest.json`. X Spaces stay non-resumable rather than being treated as URL articles.

### Canonical `manifest.json`

Every pipeline output root contains exactly one unversioned `manifest.json`. Each item records its input, route, output, status, and provider progress. Progress, completion, and batch summaries are derived from that record. Provider directories may keep raw responses, but those files never decide resume eligibility.

Mixed-route batches link to child directories, and each child has its own `manifest.json`.

Missing, malformed, invalid, or superseded manifests fail before any provider work. Older output directories must be rerun with the current command; they are not migrated.

### Resume and `resume --price`

`resume --price` estimates the missing, failed, or newly selected additive targets that execution would attempt, then exits. It covers extract STT, OCR, and URL; write LLM; and standalone TTS, image, video, and music. It makes no provider calls, writes no manifests or provider artifacts, and uses the same target selection as execution. Unsupported or non-resumable manifests produce usage errors.

Resume accepts only provider-neutral options. Provider-named flags and other unknown flags fail at parse time. Every model selectable by an execution command is selectable additively by that command's resume path, including local targets and `--all-*` shortcuts. Extract keeps route awareness: a stored STT run cannot resume as OCR, and a stored OCR run cannot resume as STT.

Completed TTS audio can receive new model targets without rebuying existing audio. Older TTS output is rejected, so `resume` and `resume --price` fail the same way. Rebuild those directories with the current `tts` command before adding new models.

Resume starts a new run with `--concurrency-mode` or the configuration default.

### Pooled OCR page state

When an OCR item ran in pool mode, its page progress and accepted results live in that item. Resume keeps the stored mode, continues only unfinished pages, and never re-executes accepted pages. A fan-out item cannot resume as a pool, and a pool cannot resume as fan-out. `--ocr-provider-mode` exists only to detect an explicit mismatch with the stored mode; omitting it preserves the stored setting. Explicitly selecting a previously retired target re-enables that target without invalidating accepted pages. `resume --price` estimates only unfinished pages and does not write artifacts or manifests.

## Rationale

- A single canonical manifest removes duplicated route inference and competing run-state files.
- Rejecting older formats matches the constraint that pipeline state is rebuildable execution state, not a long-lived interchange format.
- In-manifest pooled OCR pages give crash recovery and resume one authority, instead of a second state file.
- Explicit routes keep mixed batches, URL articles, and non-resumable X Spaces from being inferred into the wrong workflow.
- Universal `resume --price` gives a no-cost estimate before resume can start paid provider work.
- A shared selection inventory keeps new command models automatically resume-selectable.
- Provider-neutral resume flags avoid option collisions across extract, write, and generation.

## Consequences

Positive outcomes:

- Every command reads and writes one `manifest.json` for run state.
- One `manifest.json` is the only authority for progress, completion, and resume eligibility.
- Invalid, foreign, or superseded manifests fail before any provider work.
- Users can preflight single-directory, multi-directory, and additive resume costs at zero expense.
- Resume can select the same models as the original command.
- Completed TTS runs can add new models without rebuying already-rendered audio.
- Pooled OCR resume continues unfinished pages, keeps accepted pages, and prices only remaining work.

Negative outcomes:

- Older pipeline output directories are not resumable and must be regenerated.
- Older standalone TTS directories must be fully re-rendered before new models can be added.
- `resume --price` falls back to configuration or provider defaults when a manifest lacks size, duration, or page counts.
- Large pooled OCR documents store page and attempt history in `manifest.json`, so that file grows with page count.

## Trade-offs

**Trade-off 1**

- **Gain:** One canonical work and state authority with no compatibility migrations
- **Sacrifice:** Older output directories must be rebuilt, including completed TTS runs

**Trade-off 2**

- **Gain:** Safe provider-neutral resume price planning
- **Sacrifice:** Each resumable domain maintains dry-run planning alongside execution

**Trade-off 3**

- **Gain:** New models on a command are automatically resume-selectable
- **Sacrifice:** Provider additions must update the shared selection inventory, not a resume-only list

**Trade-off 4**

- **Gain:** Crash-safe pooled page acceptance
- **Sacrifice:** Larger in-manifest page and attempt records

**Trade-off 5**

- **Gain:** Accurate additive resume cost estimates
- **Sacrifice:** Missing manifest metrics require configuration or default fallbacks

## Implementation Note

- Canonical `manifest.json` read/write and mixed-route child links: `src/cli/commands/process-steps/pipeline-manifest/`
- Provider-neutral `resume --price` flag: `src/cli/flags/resume-flags.ts`
- Resume target resolution and dry-run planning: `src/cli/commands/setup-and-utilities/resume/`
- Shared execution and resume selection inventories: `src/cli/flags/service-selector-normalization/provider-targets.ts` and `src/cli/flags/service-selector-normalization/extract-selectors.ts`
- Pooled OCR page persistence and resume: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-pooled-batch.ts` and `src/cli/commands/setup-and-utilities/resume/extract/ocr-resume.ts`

## API / Type Impact

- Each pipeline output root has exactly one unversioned `manifest.json`.
- `resume` accepts `--price` as a boolean provider-neutral flag and exits before provider dispatch or manifest writes.
- Resume options compose domain STT, OCR, URL, LLM, TTS, image, video, and music options with shared price and concurrency controls, and reject provider-named flags.
- Resume `--ocr-provider-mode` only detects an explicit mismatch with the stored pool or fan-out mode; omitting it preserves the stored setting.
- Execution and resume provider flags share one selection inventory, including local targets and `--all-*` shortcuts.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
bun test test/test-cases/validation/reports-pricing/price-mode-contracts/
bun test test/test-cases/validation/resume-manifests/
bun test test/test-cases/validation/providers/provider-selection-contracts/selection-inventory-contracts.test.ts
```

1. Typecheck and unique-source check pass.
2. Mapped price commands stay no-cost and do not dispatch providers.
3. Help and usage contracts keep resume provider-neutral and reject provider-named flags.
4. Price-mode contracts report selected missing and additive targets, leave manifests unchanged, and invoke no provider runners.
5. Resume-manifest contracts prove one current `manifest.json`, reject superseded layouts, preserve pooled accepted pages, price unfinished pool work only, and fail on unreadable or older TTS output.
6. Selection-inventory contracts keep execution and resume model lists identical.

Do not run live paid provider, smoke, or e2e tests that call third-party APIs.

## References

- Related ADR: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Related ADR: [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md)
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Related ADR: [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md)
- Related ADR: [ADR-015](ADR-015-distribute-ocr-pages-across-a-multi-provider-work-pool.md)
- `src/cli/commands/process-steps/pipeline-manifest.ts`
- `src/cli/commands/setup-and-utilities/resume/`
- `src/cli/flags/resume-flags.ts`
