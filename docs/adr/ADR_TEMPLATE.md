# ADR Template

Record the current decision, why it matters, its constraints, and how to verify it. Link command guides, registries, and benchmarks instead of duplicating their inventories. Omit migration diaries, audit narratives, completed checklists, dated test counts, and repeated summaries of the same trade-off.

Keep IDs, filenames, and creation dates stable. Update the record and [index](README.md) together when scope, status, or open work changes. Use unwrapped prose and ordinary lists; no tables or mandatory option-record fields.

Status values:

- **Decision Status:** `Proposed`, `Accepted`, `Deprecated`, or `Superseded`.
- **Verification Status:** `Pending`, `Passed`, or `Failed`. State material gaps under Verification or Follow-up Actions.
- Retain all four status fields. Add a brief Supersession field only when needed to identify a replacement decision.

Use the sections below when they add information. Keep Context and Trade-offs short; Decision holds the operative rules. Verification names focused local checks and their limits; shared checks are in the index. Keep Follow-up Actions only for concrete unfinished work. References should point to authoritative code, guides, evidence, or adjacent decisions.

```markdown
# ADR-XXX: Decision Title

## Status

- **Decision Status:** Proposed
- **Date Created:** YYYY-MM-DD
- **Date Updated:** YYYY-MM-DD
- **Verification Status:** Pending

## Context

The problem and constraints that require a decision.

## Decision

The choice and the rules needed to apply it.

## Trade-offs

Why this choice beats the relevant alternative, and its cost or limitation.

## Verification

Targeted local checks and what they establish.

## Follow-up Actions

- [ ] Concrete unfinished work.

## References

- Authoritative implementation, guide, or related ADR.
```
