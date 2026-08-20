# ADR-002: Define Pipeline State, Resume, and Dry-Run Planning

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-08-15
- **Verification Status:** Passed
- **Supersession:** Owns batch work planning, canonical pipeline persistence, canonical selection-to-resume parity, pooled OCR page state, the narrow completed-legacy-TTS additive bridge, and resume price preflight. Source identity, classification, normalization, and discovery caches are owned by [ADR-001](ADR-001-source-ingestion-and-normalization.md); URL and OCR execution and artifacts by [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md); pooled work selection by [ADR-015](ADR-015-distribute-ocr-pages-across-a-multi-provider-work-pool.md); general diagnostic rendering by [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md).

## Context

Metadata, download, extract, write, generation, and resume require one command-neutral description of planned work and one canonical record of work already attempted. Pipeline state was previously fragmented across separate files, envelopes, summaries, and provider checkpoints, requiring readers to infer routing, guess format versions, and reconcile derived state across runs.

Pipeline outputs represent disposable execution state rather than a durable interchange format. Rerunning is the supported recovery path after persistence schema changes; maintaining migration machinery for superseded intermediate states adds maintenance burden without offering a supported compatibility promise.

One bounded case requires distinct cost handling: completed pre-cutover standalone TTS benchmark runs contain successful, already-paid provider outputs and inline narration in `item.input`. Requiring full regeneration of those benchmark cohorts to test a newly added model would unnecessarily repurchase historical audio. The architecture needs an intentionally narrow, immutable additive bridge that enables new model synthesis without treating legacy state as general current provenance.

Additionally, multi-provider pooled OCR introduces page claims, accepted results, and attempt tracking that must reside in the canonical item manifest rather than in external provider files or separate scheduler checkpoints.

Finally, resume can backfill missing provider outputs across extract, write, TTS, image, video, and music workflows. Because resume shares the execution command provider-selection surface (`--provider provider[=model]`, `--all-providers`, `--all-local`), it can initiate paid provider requests. However, `resume --price` was unsupported, leaving no way to dry-run or estimate additive costs before initiating paid runs.

Why now: resume became a paid-provider entry point without a cost preflight, and fragmented state made both resume and price planning depend on inferring run state instead of reading a single canonical authority.

## Options Considered

### Pipeline state persistence

**Option 1 (selected)**

- **Option:** One current, unversioned canonical manifest and clean-break reader
- **Pros:** Gives all commands and resume one authority; eliminates probing, aliases, derived state drift, and format ambiguity
- **Cons:** Pre-cutover outputs must be regenerated
- **Quantitative Notes:** Exactly one `manifest.json` per output directory

**Option 2**

- **Option:** Per-command or per-artifact codecs
- **Pros:** Allows individual workflow domains to evolve formats independently
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
- **Pros:** Provides consistent, safe, no-cost preflight across extract, write, and generation; prevents unexpected paid runs
- **Cons:** Requires target-aware dry-run planning in each resume handler
- **Quantitative Notes:** Covers 6 resume domains: extract, write, TTS, image, video, music

**Option 2**

- **Option:** Add `--price` only for OCR resume
- **Pros:** Smallest initial implementation
- **Cons:** Leaves inconsistent CLI behavior and unbudgeted paid runs in other workflows
- **Quantitative Notes:** Covers 1 extract route only

**Option 3**

- **Option:** Reject `resume --price`
- **Pros:** Requires no planning implementation
- **Cons:** Users must manually calculate costs or risk unexpected paid provider calls
- **Quantitative Notes:** No implementation work

### Completed legacy TTS benchmark archives

**Option 1 (selected)**

- **Option:** Retain completed legacy states immutably and append new canonical targets when inline source identity is unambiguous
- **Pros:** Preserves already-paid benchmark audio and enables additive model evaluations without weakening current render provenance
- **Cons:** Requires a narrow read-time bridge and strict validation guardrails
- **Quantitative Notes:** Applies strictly to completed/skipped legacy standalone TTS items

**Option 2**

- **Option:** Require complete regeneration before additive TTS resume
- **Pros:** Maintains an absolute clean break with no bridge logic
- **Cons:** Repurchases every historical provider output to benchmark one new model
- **Quantitative Notes:** Multiplies paid API costs across retained cohorts

**Option 3**

- **Option:** Upgrade legacy states into current operation-scoped render evidence
- **Pros:** Produces uniform manifest records
- **Cons:** Synthesizes false checksums, dialogue plans, and render lineage never recorded in the original run
- **Quantitative Notes:** Rejected as false provenance

## Decision

Establish a single unversioned canonical `manifest.json` as the sole authority for pipeline execution state and batch work planning, enforce a clean-break reader that rejects superseded formats, and implement universal non-mutating `--price` dry-run preflight across all resume workflows. Persist pooled OCR page claims and accepted results in the canonical item ledger, derive resume selection surfaces directly from canonical execution descriptors, and provide an immutable additive bridge strictly for completed standalone TTS benchmark archives to prevent repurchasing historical audio.

This applies to:

- Command-neutral batch work planning and canonical pipeline persistence (`manifest.json`).
- Resume execution and `--price` dry-run preflight across extract (STT, OCR, URL), write (LLM), and generation (TTS, image, video, music) routes.
- Pooled OCR in-manifest page claim, attempt, and accepted-result ledgers.
- Bidirectional inventory parity between execution and resume selection surfaces.
- Completed standalone legacy TTS benchmark manifests appending new canonical model targets.

It does not apply to:

- Long-term interchange or document export formats (pipeline state is disposable execution state).
- Backward compatibility or automatic migration for arbitrary pre-cutover or interrupted legacy runs.
- Provider-named flags on the resume CLI surface.
- Mutating manifests or initiating network calls during price dry-run preflight.

### Command-neutral work planning

Step 0 produces source classification, expansion, format hints, and explicit route selection under [ADR-001](ADR-001-source-ingestion-and-normalization.md). This record owns the command-neutral batch work plan that converts those source results into ordered, route-aware pipeline items consumed by download, extract, write, generation, and resume. Domain execution does not rediscover or infer routes from provider metadata.

`article` and `x-space` are distinct explicit routes. Single-item and mixed-route batches preserve their explicit routes in the work plan and manifest state. X Spaces maintain explicit non-resumable behavior rather than being inferred as URL articles.

### One pipeline persistence contract

Every pipeline output root contains exactly one unversioned `manifest.json`. The top-level shape is `{ command, scope, createdAt, updatedAt, source?, items }`, where `command` and `scope` are standard business metadata rather than format selectors. Every item uses uniform input, route, output, child-link, status, metadata, and provider-state fields.

Provider identity, artifact location, attempts, statuses (`running`, `succeeded`, `missing`, `failed`, `skipped`), resumable remote-job metadata, result summaries, and errors are stored once in item provider entries. Progress, completion, and batch-summary views are derived dynamically. Provider directories may store raw domain payloads, but raw payloads carry no pipeline format metadata and never determine resume eligibility.

Mixed-route batches use containment-checked child-directory links. Each linked child directory maintains its own canonical manifest. Resume validates parent route, child route, index, command, scope, and path containment before reading or updating child state.

The canonical reader validates current shape, timestamps, statuses, and contained relative paths. It distinguishes a missing manifest from malformed or invalid data, and rejects corrupted state before provider execution or rewriting. It does not probe for, detect, or migrate superseded formats. Existing output directories created under earlier persistence layouts must be rerun, with the sole exception of the completed standalone TTS additive bridge.

### Canonical pooled OCR page ledger

When an OCR item uses `ocrProviderMode: "pool"`, the canonical item carries an `ocrPool` ledger. The ledger records the selected mode, required page count, ordered page states, active claims, accepted results, attempts, provider/model/reasoning attribution, usage and cost evidence, target/lane status, and scheduler telemetry. An accepted page result is committed atomically after verifying that its claim remains active and no accepted result exists.

Claims marked as running when a process exits are recovered as interrupted work on resume. Accepted page records remain immutable and are never re-executed. An item is complete only when every required page is accepted. The page ledger is part of the canonical item shape and follows the same unversioned clean-break policy.

### Resume and dry-run planning

`resume --price` provides a provider-neutral, non-mutating dry-run cost preflight for the exact missing, failed, or newly selected additive targets that execution would attempt. It applies across extract STT, OCR, and URL routes; write LLM resume; and standalone TTS, image, video, and music resume.

Pooled OCR resume preserves the stored mode from the manifest and continues only unfinished pages. Stored healthy targets remain eligible based on prior attempts; explicitly selected additive targets are admitted after capability validation. Explicitly selecting a retired target re-enables that target and its lane without invalidating accepted pages. A stored fan-out item cannot resume as pool, and a stored pool cannot resume as fan-out. `resume --price` estimates only unfinished pages under identical lane-sharing and concurrency assumptions without modifying claims, artifacts, or manifests.

Price mode performs no provider calls, writes no manifest or raw provider artifacts, and exits immediately after reporting estimates. Unsupported or non-resumable manifests produce usage errors. Execution and price mode share identical target selection and option resolution logic.

For TTS, a content-addressed `AudioRun` with a checksum-verified successful terminal event constitutes authoritative completion. Resume validates provider results, dependencies, output checksums, duration, format, and terminal bindings before reporting zero unresolved slots. When a TTS target fails, side-effect-free diagnostic planning evaluates terminal evidence to report retained and unresolved slots, reconciliation blockers, and required authorization without calling providers or mutating state.

Resume accepts only provider-neutral option slices and declares no provider-named flags. Unknown flags fail at argv parsing with `Unexpected flag: <flag>`. Omitted tuning options resolve from merged `autoshow.config` or provider defaults.

Hosted concurrency mode and lane pressure represent execution policy rather than content identity. Resume retains accepted results and initializes a fresh run-scoped coordinator using the explicit `--concurrency-mode` or configuration default. Price mode models a clean run without rate-limit pressure, using deterministic time schedules bounded by work-class caps.

### Canonical resume selection inventory

Every model selectable by an execution command must be selectable additively by that command's resume path. Resume provider flags and model options derive from the same canonical selection descriptors used by command normalization and pricing, rather than separate handwritten lists. This applies across extract, write, TTS, image, video, and music, including local targets and `--all-*` shortcuts.

Extract preserves route awareness: public `--provider` normalization derives from canonical STT and OCR target maps so shared provider names resolve strictly to the target type allowed by the stored route. Bidirectional contract tests guarantee execution and resume selection surfaces remain identical.

### Completed legacy TTS additive bridge

A pre-cutover standalone TTS item may authorize an additive current-model plan only when all retained provider states are legacy `succeeded` or `skipped` states, and `item.input` is unambiguously inline narration (contains whitespace and does not match a file path). Appended current providers must validate their own full operation-scoped source, dialogue-plan, branch, render, request, admission, result, and output evidence. Interrupted, failed, missing, path-like, or malformed legacy state fails closed.

`resume --price` and execution apply the same mixed-state source rule. Price mode derives an in-memory inline source identity, reconstructs the deterministic dialogue plan, and estimates selected additive targets without writing artifacts or manifests. Execution materializes the immutable dialogue-plan artifact before dispatch and appends new provider states. Retained legacy states remain byte-for-byte immutable and cannot be modified, deleted, or reordered.

## API / Type Impact

- The canonical pipeline manifest (`manifest.json`) is the sole run-state authority and has no schema version field.
- `resume` accepts `--price` as a boolean provider-neutral flag and exits before provider dispatch or manifest mutation.
- Pooled OCR items include `ocrProviderMode: "pool"` and a canonical `ocrPool` page ledger.
- Resume exposes `--ocr-provider-mode` solely to detect explicit stored-mode mismatches; omitted mode preserves the stored manifest setting.
- Pooled resume target selection preserves accepted pages, treats interrupted claims as unfinished, admits validated additive targets, and re-enables explicitly selected retired targets or lanes.
- Resume options compose domain-specific STT, OCR, URL, LLM, TTS, image, video, and music options with shared price and concurrency controls, excluding provider-named flags.
- Generation and extract resume provider flags derive from typed canonical selection descriptors and target maps.
- Eligible completed legacy standalone TTS items receive non-serialized read-time `legacyRenderIdentity` annotations; appended targets record full canonical render provenance.
- Manifest writers retain pre-existing legacy TTS states while appending canonical states, rejecting any modification, deletion, or duplication of legacy entries.
- Resume initializes fresh run-scoped concurrency coordinators rather than persisting live rate-limit pressure into manifest state.

## Rationale

- A single canonical manifest eliminates duplicated route inference, disparate codecs, completion aliases, and file-probing order.
- A clean-break reader reflects that ephemeral pipeline execution state is rebuildable rather than a long-lived interchange format.
- In-manifest pooled OCR ledgers ensure atomic page acceptance and crash recovery without secondary checkpoint files.
- Explicit routing guarantees safe resume and work planning for single-item, URL, X Spaces, and mixed-route batches.
- Universal `--price` preflight prevents unexpected paid provider calls during resume runs.
- Shared selection descriptors ensure new provider and model capabilities are automatically available to resume without drift.
- The completed legacy TTS bridge protects historical financial investment in benchmark audio while strictly enforcing current render provenance for new work.
- Provider-neutral resume flags prevent CLI option collisions across heterogeneous pipeline steps.

## Consequences

Positive outcomes:

- All producers, benchmark readers, artifact reporters, and resume handlers share one canonical persistence boundary.
- Provider progress and completion cannot drift between root summaries, checkpoints, and result envelopes.
- Path-containment and shape validation fail fast before filesystem escape or provider invocation.
- Users can preflight single-directory, multi-directory, and additive resume costs at zero expense.
- Bidirectional contracts guarantee complete parity between execution and resume selection surfaces.
- Historical standalone TTS benchmark cohorts can receive new model targets without repurchasing past audio.
- Pooled OCR resume reliably recovers interrupted claims, preserves accepted pages, and prices unfinished work accurately.

Negative outcomes:

- Pre-cutover pipeline output directories are not resumable and must be regenerated (except eligible completed TTS benchmarks).
- The completed legacy TTS bridge introduces read-time validation logic that current-only manifests do not require.
- Resume handlers must maintain dry-run planning logic alongside execution paths.
- Manifests lacking exact source size, duration, or page counts rely on configuration or provider defaults for dry-run estimates.
- In-manifest page ledgers increase canonical manifest file size for large pooled OCR documents.

## Trade-offs

**Trade-off 1**

- **Gain:** One canonical work/state authority with one bounded paid-evidence bridge
- **Sacrifice:** Pre-cutover output directories must be rebuilt (except eligible completed standalone TTS archives)

**Trade-off 2**

- **Gain:** Safe provider-neutral resume price planning
- **Sacrifice:** Resumable domains maintain dry-run planning logic alongside execution

**Trade-off 3**

- **Gain:** Canonical selection-to-resume parity
- **Sacrifice:** Typed selection descriptors become a required provider-addition boundary

**Trade-off 4**

- **Gain:** Crash-safe pooled page acceptance
- **Sacrifice:** Larger in-manifest page and attempt ledgers

**Trade-off 5**

- **Gain:** Accurate additive resume cost estimates
- **Sacrifice:** Missing manifest metrics require configuration/default fallbacks

## Implementation Note

- Implemented the unversioned canonical manifest and containment-checked mixed-route child links in `src/cli/commands/process-steps/pipeline-manifest.ts`.
- Implemented `priceFlag` in provider-neutral `resumeFlags` in `src/cli/flags/resume-flags.ts`.
- Implemented target resolution and side-effect-free dry-run planning in `src/cli/commands/setup-and-utilities/resume/`.
- Implemented typed selection descriptors and derived resume inventories in `src/cli/flags/service-selector-normalization/provider-targets.ts` and `extract-selectors.ts`.
- Implemented the completed legacy TTS additive bridge in `src/cli/commands/setup-and-utilities/resume/generation/tts-resume.ts` and `src/cli/commands/process-steps/pipeline-manifest.ts`.
- Implemented pooled OCR page ledger persistence and crash-recovery resume in `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-pooled-batch.ts` and `src/cli/commands/setup-and-utilities/resume/extract/ocr-resume.ts`.

## Test Plan

- Canonical persistence contracts verify single and batch scopes, single-item batches, mixed-route child links, all provider statuses, atomic updates, missing files, malformed JSON, invalid schemas, corrupt rewrites, and path containment.
- Source guards verify that no superseded persistence filenames, format-version helpers, legacy manifest types, checkpoints, or derived summary artifacts exist.
- Resume price contracts verify that estimates cover selected missing/additive targets, report multi-directory totals, leave manifests unchanged, and invoke zero provider runners.
- Pooled OCR contracts verify atomic claim checkpoints, interrupted-claim recovery, accepted-page preservation, additive/re-enabled targets, stored-mode preservation, and unfinished-page pricing.
- Resume flag and inventory contracts verify provider-neutral option surfaces, rejection of provider-named flags, and bidirectional equality between execution and resume selection descriptors across all modalities.
- TTS resume contracts verify dry-run pricing and additive target appending for unambiguous inline legacy states, while asserting that interrupted, path-like, ambiguous, or corrupted states fail closed.
- Verification commands: `bun run check`, `bun t --price`, `bun test test/test-cases/validation/cli/cli-help-contracts.test.ts`, `bun test test/test-cases/validation/cli/cli-usage-errors.test.ts`, `bun test test/test-cases/validation/cli/option-resolution-contracts/`, `bun test test/test-cases/validation/reports-pricing/price-mode-contracts/`, and `bun test test/test-cases/validation/resume-manifests/no-legacy-persistence-contracts.test.ts`. Do not run live paid provider, smoke, or e2e tests that call third-party APIs.

## References

- Source ingestion and normalization authority: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Diagnostic rendering and error vocabulary: [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md)
- Concurrency lanes and work-unit scheduling: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)
- Extract execution and artifact contracts: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- Hosted model registry and capability policy: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Benchmark evidence and report architecture: [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md)
- Pooled OCR work distribution: [ADR-015](ADR-015-distribute-ocr-pages-across-a-multi-provider-work-pool.md)
- Canonical persistence boundary: `src/cli/commands/process-steps/pipeline-manifest.ts`
- Resume routing and dispatch: `src/cli/commands/setup-and-utilities/resume/`
- Resume flags: `src/cli/flags/resume-flags.ts`
- Configuration fallback: `src/cli/commands/setup-and-utilities/config-command/config-merge.ts`
- Aggregate pricing: `src/cli/commands/pricing-orchestration/aggregate-pricing.ts`
- Canonical persistence source guard: `test/test-cases/validation/resume-manifests/no-legacy-persistence-contracts.test.ts`
- Resume provider-surface contracts: `test/test-cases/validation/resume-manifests/resume-provider-surface-contracts.test.ts`
- TTS canonical and legacy-additive resume contracts: `test/test-cases/validation/resume-manifests/tts-resume-canonical-contracts.test.ts`
- TTS item-scoped and batch resume contracts: `test/test-cases/validation/resume-manifests/tts-resume-batch-contracts.test.ts`
- TTS protected Mistral reference resume contracts: `test/test-cases/validation/resume-manifests/tts-resume-protected-mistral-contracts.test.ts`
- Shared TTS resume fixtures for the three suites above: `test/test-cases/validation/resume-manifests/tts-resume-fixtures.ts`
- Canonical provider/model inventory contracts: `test/test-cases/validation/providers/provider-selection-contracts/selection-inventory-contracts.test.ts`
