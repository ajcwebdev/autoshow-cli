# ADR-003: Type-Surface Cleanup and Architecture-Mirrored `src/types`

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-08-13
- **Verification Status:** Passed

## Context

The `src/types` tree (149 files) had accumulated two kinds of drag: unnecessary type declarations, and a `migrated/` staging namespace (106 of the 149 files) that no longer represented current ownership. The cleanup was sequenced into three phases so that exported-API churn, purely-internal mechanical edits, and structural file moves could be reviewed and landed independently:

- **Phase 1 — exported strict single-use declarations.** Of 1,081 exported declarations, a bucket has its only non-declaration references in a single importing file and is not referenced by other `src/types` declarations. These add indirection without protecting a boundary.
- **Phase 2 — non-exported single-parent declarations.** Of 107 non-exported declarations, a bucket is referenced exactly once, inside one other type or interface — private aliases that can fold into their only parent.
- **Phase 3 — architecture mirroring.** Even after declaration cleanup, type ownership was often detached from the source module it supports, and `migrated/` read as permanent architecture rather than history.

Why now: declaration-level cleanup (phases 1–2) is the prerequisite for the structural move (phase 3); doing the moves first would churn declarations that were about to be removed. The structural phase also aligns type ownership with the ingestion, pipeline-state, and extract boundaries in [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), and [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md).

## Options Considered

| Option                                                                                                                                                                                   | Pros                                                                                                                                      | Cons                                                                                        | Quantitative Notes                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Three-phase cleanup: remove/inline single-use declarations, fold private single-parent aliases, and reorganize `src/types` by subsystem ownership while keeping `src/types/index.ts`** | Shrinks exported `~/types`, aligns file ownership with durable architecture, retires `migrated/`, and preserves the central public barrel | Requires phased review, import churn, and careful barrel update                             | 149 type files (106 in `migrated/`), 262 exported candidates, 68 non-exported candidates |
| Inline every single-use declaration without inference removal                                                                                                                            | Preserves explicit local annotations                                                                                                      | Leaves unnecessary type aliases where TypeScript inference suffices                         | 222 inline-capable                                                                       |
| Include multi-use and cross-referenced declarations in the initial cleanup                                                                                                               | Broadest single pass                                                                                                                      | Blurs clean single-use boundaries with complex type hierarchies; increases risk             | 412 deferred candidates                                                                  |
| Strict 1:1 directory mirroring between `src/` and `src/types/`                                                                                                                           | Highly predictable structure                                                                                                              | Overfits ephemeral modules; produces directory fragmentation and thin folders               | Too granular                                                                             |
| Co-locate type files beside implementation files in `src/`                                                                                                                               | Strong file locality                                                                                                                      | Conflicts with central `~/types` barrel and breaks project-wide import pattern              | Repository-wide import churn                                                             |
| Collapse types into fewer monolithic domain files                                                                                                                                        | Fewer files to manage                                                                                                                     | Recreates large mixed-purpose files and obscures subsystem ownership                        | Reduces modularity                                                                       |
| Leave `src/types` surface and `migrated/` namespace unchanged                                                                                                                            | Zero edit risk                                                                                                                            | Preserves indirection, unnecessary aliases, and migration staging as permanent architecture | 0 cleanup                                                                                |

## Decision

Clean up single-use type declarations across two phases by removing inference-redundant exports and inlining private aliases, then retire `src/types/migrated/` and reorganize `src/types` around durable subsystem and workflow boundaries while keeping `src/types/index.ts` as the sole public `~/types` barrel.

1. **Phase 1 — exported strict single-use cleanup:** Remove declarations whose single use is safely handled by TypeScript inference while keeping `bun run check` clean; inline remaining single-use declarations into their consuming site. Exported base types extended within their own file remain.
2. **Phase 2 — non-exported single-parent cleanup:** Fold private one-reference declarations into their parent types by merging composition interfaces or inlining nested shapes.
3. **Phase 3 — subsystem ownership restructuring:** Reorganize `src/types` by subsystem and workflow domain rather than strict 1:1 file mirroring. Retire `src/types/migrated/` entirely with no deep-path compatibility shims, retaining broad shared contracts at the root only when genuinely cross-cutting.

This applies to:

- Exported strict single-use and non-exported single-parent type cleanup across `src/types/`.
- Subsystem- and workflow-scoped directory organization under `src/types/`.
- Preserving `src/types/index.ts` as the single public `~/types` barrel export.

It does not apply to:

- Multi-use exported declarations and multi-reference non-exported declarations (deferred to follow-up reviews).
- Runtime behavior, CLI options, schema changes, or provider execution logic.
- Strict 1:1 mirroring of internal module hierarchies or co-locating types beside implementation files.

## Rationale

- The exported strict single-use bucket is the clearest first phase: each declaration has one external use site and no internal type-tree dependencies, so its exported identity is least justified by current usage.
- Removal is preferred over inlining where inference preserves checking; inlining is reserved for shapes that still benefit from an explicit property/parameter/return/generic/union.
- The non-exported bucket has an even narrower boundary — one reference inside one parent — and needs no exported-compat consideration, so it is purely mechanical and runs second to keep API-impacting churn separate.
- The structural phase comes last because the prior tree already pointed at an architecture-shaped model, but `migrated/` prevented it from being the source of truth. A partial mirror of durable subsystem boundaries avoids needless directory churn, and keeping the central barrel avoids a big-bang import rewrite.

## Implementation Note

- Exported strict single-use declarations were removed or inlined across `src/types/`, retaining extended in-file base types, with `bun run check` passing throughout.
- Private single-parent declarations were inlined or merged into their containing parent interfaces.
- All 106 legacy files were moved out of `src/types/migrated/` into subsystem and workflow directories (such as `pipeline-core/`, `provider-core/`, `runtime-core/`, `cli-surface/`, and workflow-specific folders), retiring `src/types/migrated/` with zero deep-path compatibility shims.
- `src/types/index.ts` was updated to export all subsystem types from their final paths as the sole public `~/types` barrel.

## API / Type Impact

Phase 1 removed and inlined exported names from `~/types`; this was treated as an internal source-API cleanup, since out-of-tree consumers are not supported. Phases 2 and 3 have no exported-API impact — phase 2 is non-exported, and phase 3 preserved the barrel — so they change local readability, layout, and deep import paths only.

## Consequences

Positive outcomes:

- Smaller exported `~/types` surface; local declarations live at their only use sites; fewer aliases requiring cross-file navigation; private one-reference aliases folded into parents.
- Maintainers can infer a type file's home from the subsystem it supports; `migrated/` stops being a permanent layer; future cleanup happens by subsystem; reviews follow the source, pipeline-state, and extract boundaries in [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), and [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md).
- Each phase batches and verifies with `bun run check`.

Negative outcomes:

- Removing exported names can break out-of-tree imports; large inline shapes can reduce readability; careful batching needed as unused imports/declarations surface.
- Phase 3 import/export churn is substantial; barrel order and duplicate-export conflicts need care; some cross-cutting files remain at the root by judgment; git history for moved files is noisier unless reviewed as a batch.

## Trade-offs

| Gains                                                                                             | Sacrifices                                                                            |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Smaller exported `~/types`; declarations at use sites; inference-first removal                    | Possible out-of-tree breakage; some shapes become anonymous; careful batching         |
| Fewer private aliases; mechanical low-risk internal edits                                         | Parent declarations grow longer; inventory re-validated after phase 1                 |
| Type ownership follows subsystem boundaries; `migrated/` retired; subsystem-scoped future cleanup | Substantial phase-3 import/export churn; barrel-conflict handling; root-file judgment |

## Follow-up Actions

| Action                                                                                                         | Owner          | Current State |
| -------------------------------------------------------------------------------------------------------------- | -------------- | ------------- |
| Review the excluded exported buckets (257 one-file multiple-use, 155 internal-reference) as a separate cleanup | CLI maintainer | Deferred      |
| Review the 39 multi-reference non-exported declarations as a separate cleanup                                  | CLI maintainer | Deferred      |

## Test Plan

- Baseline and per-batch verification: `bun run check`.
- Use only targeted local/no-cost tests if extra confidence is needed.
- Do not run smoke, end-to-end, or provider tests that can call paid or quota-limited third-party providers.

## References

- Related ADR: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- `src/types/`
- `src/types/index.ts`
