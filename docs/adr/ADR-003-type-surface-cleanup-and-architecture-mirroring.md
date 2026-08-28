# ADR-003: Type-Surface Cleanup and Architecture-Mirrored `src/types`

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed

## Context

`src/types` had two problems. Many declarations existed only to name a shape used once: exported aliases imported by a single file, and private aliases referenced by a single parent. Those names added indirection without protecting a module boundary. Most type files also lived under a `migrated/` staging namespace that no longer matched the subsystems they supported.

The ingestion, pipeline-state, and extract boundaries in [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), and [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) already described durable architecture. Type files did not follow it.

Why now: type ownership had to match those subsystem boundaries so later work in those areas could be reviewed against a single tree.

## Options Considered

**Option 1 (selected)**

- **Option:** Remove or inline single-use exports, fold private single-parent aliases, and organize remaining files by durable subsystem and workflow ownership, keeping `src/types/index.ts` as the public barrel
- **Pros:** Shrinks exported `~/types`, aligns file ownership with durable architecture, retires `migrated/`, and preserves the central public barrel
- **Cons:** Requires import churn and a careful barrel update
- **Quantitative Notes:** Majority of the type tree was under `migrated/` at decision time

**Option 2**

- **Option:** Include multi-use and cross-referenced declarations in the same cleanup
- **Pros:** Broadest single pass
- **Cons:** Mixes simple single-use edits with type hierarchies that still justify a shared name
- **Quantitative Notes:** Rejected; remaining multi-use names stay out of this record

**Option 3**

- **Option:** Strict 1:1 directory mirroring between `src/` and `src/types/`
- **Pros:** Highly predictable structure
- **Cons:** Overfits ephemeral modules and produces thin folders
- **Quantitative Notes:** n/a

**Option 4**

- **Option:** Co-locate type files beside implementation files in `src/`
- **Pros:** Strong file locality
- **Cons:** Conflicts with the central `~/types` barrel and the project-wide import pattern
- **Quantitative Notes:** n/a

**Option 5**

- **Option:** Collapse types into fewer monolithic domain files
- **Pros:** Fewer files to manage
- **Cons:** Recreates mixed-purpose files and hides subsystem ownership
- **Quantitative Notes:** n/a

**Option 6**

- **Option:** Leave `src/types` and `migrated/` unchanged
- **Pros:** Zero edit risk
- **Cons:** Keeps unnecessary aliases and treats migration staging as permanent architecture
- **Quantitative Notes:** 0 cleanup

## Decision

Keep `src/types` organized by durable subsystem and workflow ownership, with `src/types/index.ts` as the sole public `~/types` barrel.

Do not export a type whose only consumer is a single importing file. Fold a private alias into its parent when that parent is the only reference. Place remaining files by subsystem and workflow domain rather than by a strict `src/` mirror. Place genuinely cross-cutting contracts in shared subsystem directories such as `pipeline-core/` and `runtime-core/`, not at the `src/types` root. Do not use `src/types/migrated/` or deep-path compatibility shims.

This applies to:

- Exported single-use and non-exported single-parent declarations in `src/types/`.
- Subsystem- and workflow-scoped directories under `src/types/`.
- Preserving `src/types/index.ts` as the single public `~/types` barrel.

It does not apply to:

- Multi-use exported declarations and multi-reference non-exported declarations, which remain deferred.
- Runtime behavior, CLI options, schema changes, or provider execution.
- Strict 1:1 mirroring of internal module hierarchies, or co-locating types beside implementation files.

## Rationale

- A type imported from one file, and unused by other `src/types` declarations, does not protect a boundary and should not occupy the public barrel.
- A private alias with one parent is local structure, not a shared contract, so folding it keeps the parent as the named shape.
- `migrated/` was staging, not architecture. Durable subsystem directories match the source, pipeline-state, and extract boundaries already recorded in [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), and [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md).
- A partial mirror of those boundaries avoids thin folders around ephemeral modules, and keeping the central barrel avoids rewriting every import.

## Consequences

Positive outcomes:

- The exported `~/types` surface is smaller, and remaining type files live with the subsystem they support.
- `migrated/` is gone; later type work is reviewed by subsystem rather than against a staging namespace.
- Reviews of ingestion, pipeline-state, and extract code can follow the same boundaries as [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), and [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md).

Negative outcomes:

- Inlined shapes can be harder to read when they grow large.
- The public barrel must stay aligned with subsystem files, and placing a cross-cutting contract in `pipeline-core/` versus `runtime-core/` remains a judgment call.
- Multi-use and multi-reference declarations were left for later cleanup.

## Trade-offs

**Trade-off 1**

- **Gain:** Smaller exported `~/types` with declarations at their only use sites
- **Sacrifice:** Some shapes become anonymous and some names disappear from the barrel

**Trade-off 2**

- **Gain:** Type ownership follows subsystem boundaries and `migrated/` is retired
- **Sacrifice:** Import paths and barrel entries must track directory moves

**Trade-off 3**

- **Gain:** No 1:1 `src/` mirror and no co-located type files
- **Sacrifice:** Cross-cutting contracts need an explicit shared-subsystem home

## Implementation Note

Single-use exports were removed or inlined and private single-parent aliases were folded into their parents. Remaining files live in subsystem and workflow directories under `src/types/`. `src/types/index.ts` is the only root file and the sole public `~/types` barrel. `src/types/migrated/` was removed without compatibility shims.

## API / Type Impact

Single-use names are not part of the public `~/types` barrel. In-tree imports continue to use `~/types`. Deep paths under `src/types/` follow subsystem directories and are not a supported public API.

## Test Plan

```bash
bun run check
```

1. Typecheck and unique-source check pass against the reorganized `src/types` tree and barrel.

## Follow-up Actions

- [ ] Review remaining multi-use exported declarations as a separate cleanup — Pending
  These names were excluded because they still have more than one consumer.
- [ ] Review remaining multi-reference non-exported declarations as a separate cleanup — Pending
  These names were excluded because more than one parent still references them.

## References

- Related ADR: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- `src/types/`
- `src/types/index.ts`
