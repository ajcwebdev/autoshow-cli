# ADR-003: Type-Surface Cleanup and Architecture-Mirrored `src/types`

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed

## Context

`src/types` carried declarations that existed only to name a shape used once, and most type files lived under a `migrated/` staging namespace that no longer matched the subsystems they supported. The ingestion, pipeline-state, and extract boundaries in [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), and [ADR-009](ADR-009-stt-timing-captions-and-alignment.md) already described durable architecture; type files did not follow it.

Why now: type ownership had to match those subsystem boundaries so later work in those areas could be reviewed against a single tree.

## Options Considered

**Option 1 (selected)**

- **Option:** Remove or inline single-use exports, fold private single-parent aliases, and organize remaining files by durable subsystem and workflow ownership, keeping `src/types/index.ts` as the public barrel
- **Pros:** Smaller exported `~/types`, ownership aligned with durable architecture, `migrated/` retired
- **Cons:** Import churn and a careful barrel update
- **Quantitative Notes:** Most of the type tree was under `migrated/` at decision time

**Option 2**

- **Option:** Include multi-use and cross-referenced declarations in the same cleanup
- **Pros:** Broadest single pass
- **Cons:** Mixes simple single-use edits with hierarchies that still justify a shared name
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Strict 1:1 directory mirroring between `src/` and `src/types/`
- **Pros:** Predictable structure
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
- **Quantitative Notes:** n/a

## Decision

Keep `src/types` organized by durable subsystem and workflow ownership, with `src/types/index.ts` as the sole public `~/types` barrel.

Do not export a type whose only consumer is a single importing file. Fold a private alias into its parent when that parent is the only reference. Place remaining files by subsystem and workflow domain rather than by a strict `src/` mirror, and place cross-cutting contracts in shared subsystem directories such as `pipeline-core/` and `runtime-core/`, not at the `src/types` root. Do not use `src/types/migrated/` or deep-path compatibility shims.

This applies to:

- Exported single-use and non-exported single-parent declarations in `src/types/`.
- Subsystem- and workflow-scoped directories under `src/types/`, and the single public barrel.

It does not apply to:

- Multi-use exported declarations and multi-reference non-exported declarations, which remain deferred.
- Runtime behavior, CLI options, schema changes, or provider execution.
- Strict 1:1 mirroring of internal module hierarchies, or co-locating types beside implementation files.

## Rationale

- A type imported from one file does not protect a boundary and should not occupy the public barrel.
- A private alias with one parent is local structure, not a shared contract.
- `migrated/` was staging, not architecture. A partial mirror of the durable boundaries avoids thin folders around ephemeral modules, and keeping the central barrel avoids rewriting every import.

## Consequences

Positive outcomes:

- The exported `~/types` surface is smaller, and remaining type files live with the subsystem they support.
- Later type work follows the same boundaries as [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), and [ADR-009](ADR-009-stt-timing-captions-and-alignment.md).

Negative outcomes:

- Inlined shapes can be harder to read when they grow large.
- The public barrel must stay aligned with subsystem files, and placing a cross-cutting contract in `pipeline-core/` versus `runtime-core/` remains a judgment call.

## Trade-offs

**Trade-off 1**

- **Gain:** Smaller exported `~/types` with declarations at their only use sites
- **Sacrifice:** Some shapes become anonymous and some names disappear from the barrel

**Trade-off 2**

- **Gain:** Type ownership follows subsystem boundaries and `migrated/` is retired
- **Sacrifice:** Import paths and barrel entries must track directory moves

## Implementation Note

The cleanup has shipped: `src/types/index.ts` is the only root file and the sole public `~/types` barrel, and `src/types/migrated/` was removed without compatibility shims.

### Bun 1.4 Image Declarations

The 2026-08-31 evaluation removed local `Bun.Image` declarations because the installed Bun type packages already declare that surface; TIFF conversion and ImageMagick routing stay in [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md#bun-14-image-routing).

## API / Type Impact

Single-use names are not part of the public `~/types` barrel. In-tree imports continue to use `~/types`. Deep paths under `src/types/` are not a supported public API.

## Test Plan

```bash
bun run check
```

1. Typecheck and unique-source check pass against the reorganized `src/types` tree and barrel.

## Follow-up Actions

- [ ] Review remaining multi-use exported declarations as a separate cleanup — Pending
- [ ] Review remaining multi-reference non-exported declarations as a separate cleanup — Pending

## References

- Related ADR: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md)
- Related ADR: [ADR-009](ADR-009-stt-timing-captions-and-alignment.md)
