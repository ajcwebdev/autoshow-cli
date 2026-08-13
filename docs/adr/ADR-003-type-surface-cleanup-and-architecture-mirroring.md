# ADR-003: Type-Surface Cleanup and Architecture-Mirrored `src/types`

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-08-13
- **Verification Status:** Passed

<!-- This record synthesizes three sequenced type-cleanup phases. All three are Accepted and implemented. Each Decision sub-part carries its own state tag. -->

## Context

The `src/types` tree (149 files) had accumulated two kinds of drag: unnecessary type declarations, and a `migrated/` staging namespace (106 of the 149 files) that no longer represented current ownership. The cleanup was sequenced into three phases so that exported-API churn, purely-internal mechanical edits, and structural file moves could be reviewed and landed independently:

- **Phase 1 — exported strict single-use declarations.** An analysis of 1,081 exported declarations (TypeScript symbol references across `src/**/*.ts` and `test/**/*.ts`) found a bucket whose only non-declaration references are in a single importing file and which are not referenced by other `src/types` declarations. These add indirection without protecting a boundary.
- **Phase 2 — non-exported single-parent declarations.** Of 107 non-exported declarations, a bucket is referenced exactly once, inside one other type or interface — private aliases that can fold into their only parent.
- **Phase 3 — architecture mirroring.** Even after declaration cleanup, type ownership was often detached from the source module it supports, and `migrated/` read as permanent architecture rather than history.

Method (phases 1 & 2): after a passing `bun run check` baseline, TypeScript language-service refactor trials simulated candidate removal/inlining/merging in memory without changing repository files. "Safe" means the simulated refactor produced no significant TypeScript errors; ordinary unused-import/declaration cleanup was not treated as a blocker because it is expected during the real edit pass.

Why now: declaration-level cleanup (phases 1–2) is the prerequisite for the structural move (phase 3); doing the moves first would churn declarations that were about to be removed. The structural phase also aligns type ownership with the ingestion, pipeline-state, and extract boundaries in [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), and [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md).

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Phase 1: remove safe exported single-use declarations first, then inline the rest** | Shrinks exported `~/types`; prefers inference where it preserves safety; keeps inline edits where an explicit shape is still useful | Removes exported names possibly convenient for out-of-tree consumers | 262 candidates: 145 remove-capable, 222 inline-capable (capability counts, overlapping) |
| Inline every safe exported single-use declaration | Preserves explicit local annotations | Keeps unnecessary aliases where inference already suffices | 222 inline-capable |
| **Phase 2: clean up non-exported single-parent declarations after exported cleanup** | Low-risk, internal; separates mechanical edits from API churn | Requires a second pass | 68 candidates: 62 inline/anonymous, 6 merge-into-parent, 0 removable-by-inference |
| **Phase 3: reorganize `src/types` to mirror `src` and retire `migrated/`** | Aligns type ownership with source ownership; removes the permanent-looking migration bucket; improves review/navigation | High import churn; careful batching + barrel updates | 149 files, incl. 106 under `migrated/` |
| Include multiple-use / internal-reference exported buckets in the same cleanup | One larger cleanup | Mixes simple strict single-use edits with repeated/type-tree-referenced declarations | Excluded: 257 one-file multiple-use + 155 internal-reference |
| Make `src/types` exactly one-to-one with `src` | Maximum predictability | Overfits small/temporary modules; many thin dirs, noisy movement | Too granular |
| Co-locate types beside implementation files | Strong locality | Conflicts with the central `~/types` contract; broad churn | Rejected |
| Collapse all types into fewer domain files | Fewer files/imports | Recreates large mixed-purpose files; weakens ownership | Opposite of source modularity |
| Leave the type surface/structure unchanged | No edit risk | Preserves indirection, root-file sprawl, and `migrated/` as long-term architecture | 0 cleanup |

## Decision

### 1. Phase 1 — exported strict single-use cleanup *(Accepted — implemented)*

Clean up only the exported strict single-use bucket, in two passes: first **remove** the 145 declarations whose only use can be dropped through inference or equivalent narrowing while keeping `bun run check` clean; then **inline** the remaining inline-capable candidates whose declaration body can replace the single use. Prefer removal over inlining when inference preserves the same checking behavior. The `Only Imported/Used In One File, Multiple Uses` (257) and internal-reference (155) exported buckets are out of scope. Three no-import exported base types were judged live at the time because each was extended within its own file. Orphaned in-file helper/base types exposed by removals are cleaned up in the same batch. Fifteen in-scope candidates are also phase-2 parents (see §2); removing or inlining such a parent must inline/relocate its non-exported child in the same edit.

> Inventory note: old ADR-005 enumerated all 262 in-scope names plus the excluded buckets in full. That exhaustive list is intentionally **not reproduced here** — it is recoverable from this file's git history — and is summarized by counts and a representative sample: `AcquireArtifactOptions`, `AnthropicModel`, `ArticleEstimateResult`, `DownloadResult`, `ExtractEstimation`, `FetchUrlResult`, `OcrResult`, `PreflightResult`, `SttEstimation`, `UrlArticleResumePlan`, … (262 total).

> Implementation Note: implemented. The exported strict single-use declarations were removed or inlined, and a representative sweep confirmed the targeted names were gone from `src/types` while `bun run check` stayed clean. Later clean-break programs also removed the temporary base types that were live during this decision, including the pipeline persistence base superseded by the one canonical manifest.

> Correction (2026-08-07): the note above is wrong on both counts and is kept only as a record of what was believed at the time. `RunTargetsOptionsBase` was never removed — it is live at `src/types/pipeline-core/target-runner-types.ts:11`, still extended in-file by `RunSingleFileTargetsOptions` and `RunTargetsOptions`, which is exactly the "kept base" behavior the decision predicted. All four names cited as gone are also live: `ArticleEstimateResult` (`costing/article-estimates-types.ts`), `FetchUrlResult` (`cli-surface/define-links-command-types.ts`), `PreflightResult` (`costing/preflight-types.ts`), and `UrlArticleResumePlan` (`cli-surface/url-resume-types.ts`). Either they were re-introduced afterwards or the "representative sweep" ran before the edits it was describing; the decision itself stands, only this verification claim does not.

### 2. Phase 2 — non-exported single-parent cleanup *(Accepted — implemented 2026-06-12)*

After phase 1, fold private one-reference declarations into their only parent: **merge** 6 composition-style children into their parent, and **inline** the remaining nested/property/array/union/type-argument references as anonymous types. Do not treat any non-exported single-parent declaration as removable by inference (the trials classified none as safe). Where a chain has a declaration that is both child and parent (e.g. `GladiaResult → GladiaTranscription → GladiaUtterance`, `HtmlRewriterText → HtmlRewriterHandlers → HtmlRewriterInstance`), inline innermost-first and keep one intermediate name when full inlining (e.g. nested `NonNullable` index chains) would hurt readability. Seventeen entries (under 15 distinct parents) share a phase-1 parent and are resolved when phase 1 removes/inlines it; re-validate the remainder before implementing. The 39 multi-reference non-exported declarations are out of scope.

> Implementation Note: implemented 2026-06-12 after re-validating the post-phase-1 tree. The actual pass found 57 non-exported declarations referenced exactly once inside one parent; all 57 were inlined or merged. A follow-up scan found 32 remaining non-exported declarations, none matching the single-parent criterion. (Line numbers in the original ADR-006 inventory were a 2026-06-12 snapshot and drifted as phase 1 edited the same files; the analysis was re-run before editing.)

### 3. Phase 3 — restructure `src/types` to mirror `src` *(Accepted — implemented 2026-06-12)*

Refactor `src/types` into a stable architecture-shaped tree that follows the `src` structure as a guide (not a strict one-to-one mirror):

- `src/types/index.ts` remains the public `~/types` barrel.
- Process-step contracts under `src/types/cli/commands/process-steps`, each step-specific contract under its step dir (`step-2-extract`, `step-4-tts`, `step-8-comic`, …).
- Setup/utility command contracts under `.../setup-and-utilities`; native CLI under `src/types/cli/native`; utility contracts under `src/types/utils` (provider clients, logging, pricing, retries, filesystem, process-lock).
- Broad shared process/provider/config/CLI/prompt/retry/test contracts remain at the `src/types` root only where genuinely cross-cutting.

This governs type-file organization only — no runtime refactors, behavior/CLI/schema changes, provider execution, or paid-provider test runs.

> Implementation Note: implemented 2026-06-12. All 106 files moved from `src/types/migrated/**` to the same relative paths under `src/types/**` (only the `migrated` segment removed); no filename conflicts. `index.ts` updated to export from final paths, preserving the `~/types` surface for in-repo consumers. No deep-path compatibility shims were added because source/test import through `~/types`; no source/test references to `src/types/migrated` remain.

> Correction (2026-08-07): the layout bullets above no longer describe the tree. `src/types` was later regrouped by *workflow* rather than by mirroring the `src` command tree, so none of `src/types/cli/commands/process-steps`, `.../setup-and-utilities`, `src/types/cli/native`, or `src/types/utils` exist. The current top level is `api-clients`, `benchmarks`, `cli-surface`, `comic-workflow`, `costing`, `document-processing`, `download-workflow`, `generation-core`, `image-workflow`, `music-workflow`, `ocr-workflow`, `pipeline-core`, `provider-core`, `runtime-core`, `setup-support`, `stt-workflow`, `test-support`, `tts-workflow`, `url-workflow`, `video-workflow`, and `write-workflow`. What survived the regrouping is the part that mattered: `src/types/index.ts` is still the only public `~/types` barrel, and there are still no deep-path shims.

This applies to:

- Exported strict single-use and non-exported single-parent type cleanup.
- The architecture-mirrored `src/types` layout; runtime behavior and broader multiple-use type cleanup remain out of scope.

## Rationale

The strict exported bucket is the clearest first phase because each declaration has one external use site and no internal type-tree dependencies, so its exported identity is least justified by current usage; removal is preferred where inference preserves checking, and inlining is reserved for shapes that still benefit from an explicit property/parameter/return/generic/union. The non-exported bucket has an even narrower boundary — one reference inside one parent — and needs no exported-compat consideration, so it is purely mechanical and runs second to keep API-impacting churn separate. The structural phase comes last because the prior tree already pointed at an architecture-shaped model but `migrated/` prevented it from being the source of truth; a partial mirror (durable subsystem boundaries, not every helper file) avoids needless directory churn, and keeping the central barrel avoids a big-bang import rewrite. This is the same move as adopting structure that already exists rather than inventing more.

## API / Type Impact

The decision record has no runtime or compile-time impact. Phase 1 would remove/inline exported names from `~/types` — treat as an internal source-API cleanup unless out-of-tree consumers are intentionally supported, in which case make it a breaking-change note or keep compatibility re-exports until a release boundary. Phases 2 and 3 have no exported-API impact (phase 2 is non-exported; phase 3 preserves the barrel) — they change local readability/layout and deep import paths only.

## Consequences

Positive outcomes:

- Smaller exported `~/types` surface; local declarations live at their only use sites; fewer aliases requiring cross-file navigation; private one-reference aliases folded into parents.
- Maintainers can infer a type file's home from the source subsystem it supports; `migrated/` stops being a permanent layer; future cleanup happens by subsystem; reviews follow the source, pipeline-state, and extract boundaries in ADR-001, ADR-002, and ADR-009.
- Each phase batches and verifies with `bun run check`.

Negative outcomes:

- Removing exported names can break out-of-tree imports; large inline shapes can reduce readability; careful batching needed as unused imports/declarations surface.
- Phase 3 import/export churn is substantial; barrel order + duplicate-export conflicts need care; some cross-cutting files remain at the root by judgment; git history for moved files is noisier unless reviewed as a batch; out-of-tree consumers importing deep `src/types/migrated/...` paths must update.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Smaller exported `~/types`; declarations at use sites; inference-first removal | Possible out-of-tree breakage; some shapes become anonymous; careful batching |
| Fewer private aliases; mechanical low-risk internal edits | Parent declarations grow longer; inventory re-validated after phase 1 |
| Type ownership mirrors source; `migrated/` retired; subsystem-scoped future cleanup | Substantial phase-3 import/export churn; barrel-conflict handling; root-file judgment |

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Remove safe exported single-use declarations first; then inline the rest | CLI maintainer | Implemented; removal was preferred where inference kept `bun run check` clean |
| Handle the 15 cross-phase parents together with their phase-2 children | CLI maintainer | Implemented with their phase-2 children |
| Keep multiple-use and internal-reference exported buckets out of phase 1 | CLI maintainer | Deferred for separate review |
| Re-run the single-parent analysis after phase 1; merge 6 children, inline 62 references; leave 39 multi-reference declarations | CLI maintainer | Implemented (57 inlined/merged on re-validated tree) |
| Move all `migrated/**` to final `src/types/**` paths; update `index.ts`; preserve the `~/types` barrel | CLI maintainer | Implemented 2026-06-12 |
| Run `bun run check` after each batch | CLI maintainer | Passed |

## Test Plan

- Baseline already checked: `bun run check`.
- For any cleanup batch: run `bun run check`; use only targeted local/no-cost tests if extra confidence is needed.
- Do not run smoke, end-to-end, or provider tests that can call paid or quota-limited third-party providers.

## References

- Related source ownership boundary: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Related pipeline-state ownership boundary: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related extract ownership boundary: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- Types tree under review: `src/types/`
- Public type barrel: `src/types/index.ts`
- Verification rule: `bun run check`
