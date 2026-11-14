# ADR-003: Type Surface and Subsystem Ownership

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-11-14
- **Verification Status:** Passed

## Context

Type ownership should follow durable subsystem boundaries, and consumers need one public import surface.

## Decision

Organize `src/types` by subsystem and workflow, without strict one-to-one mirroring of implementation folders. `src/types/index.ts` is its only root file and sole public `~/types` barrel. Re-export shared runtime constants as values; public consumers must not use deep imports to recover values hidden by `export type *`. Internal type modules may reference each other directly.

Review aliases for readability and ownership rather than enforcing use counts. A single-use name can define a useful contract, recursive shape, or callback boundary. Keep cross-cutting contracts shared and use installed Bun declarations instead of local copies.

## Trade-offs

A central barrel gives stable ownership and imports but needs maintenance when files move. Inlining unnecessary aliases reduces indirection; indiscriminate inlining can obscure useful contracts.

## Verification

```bash
bun run check
bun test test/test-cases/validation/runtime-contracts/repository-tooling-contracts.test.ts
```

Enforce the public boundary across static, dynamic, CommonJS, alias, and relative imports while allowing internal references and unrelated strings/comments.

## Follow-up Actions

- [ ] Review remaining multi-use exported declarations — Pending
- [ ] Review remaining multi-reference private declarations — Pending

## References

- `src/types/index.ts`
- `src/tools/repository-structure-check.ts`
