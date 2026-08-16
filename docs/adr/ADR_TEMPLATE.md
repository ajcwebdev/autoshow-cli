<!--
ADR TEMPLATE — copy this file to docs/adr/ADR-XXX-<kebab-case-title>.md and fill it in.

Authoring conventions:
- Replace XXX with the next zero-padded number (e.g. 015).
- Use a concise, declarative, title-case decision title.
- Wrap all file paths, identifiers, and flags in backticks, e.g. `src/path/file.ts`.
- Dates are ISO 8601 (YYYY-MM-DD).
- Keep the Status metadata labels exactly as written.
- Keep the table column headers exactly as written — they are the load-bearing format.
- Delete these guidance comments (<!-- ... -->) as you write each section.
- Optional sections are listed at the bottom; add them only when relevant.
-->

# ADR-XXX: <Concise Decision Title>

## Status

<!-- Use all four required metadata fields below.
     Decision Status is one of: Proposed | Accepted | Deprecated | Superseded.
     - Proposed: decision recorded before implementation; the Follow-up Actions table IS the implementation plan.
     - Accepted: decision committed (and usually implemented).
     - Deprecated: no longer recommended; explain what to do instead.
     - Superseded: replaced by a later ADR; link it in an optional Supersession field.
     Date Created is the original decision-record date. Date Updated is the date of the latest material ADR update.
     Verification Status is one of: Pending | Passed | Failed.
     When only part of an Accepted ADR is superseded, keep Decision Status as Accepted and add an optional
     `- **Supersession:** <what was superseded, by which ADR, and what remains accepted>` field. -->

- **Decision Status:** Proposed
- **Date Created:** YYYY-MM-DD
- **Date Updated:** YYYY-MM-DD
- **Verification Status:** Pending

## Context

<!-- The business and technical forces motivating this decision. State the problem,
     the constraints, and the relevant current behavior. End with an explicit
     "why now" sentence explaining why this is being decided at this moment. -->

<Describe the forces at play, the current state, and the constraints.>

Why now: <what triggered this decision today — new requirement, recurring pain, blocking work, etc.>

## Options Considered

<!-- One row per alternative, including the chosen one. Bold the chosen option.
     Quantitative Notes should hold counts, scope, timing, cost, or "n/a". -->

| Option              | Pros             | Cons            | Quantitative Notes               |
| ------------------- | ---------------- | --------------- | -------------------------------- |
| **<Chosen option>** | <key advantages> | <key drawbacks> | <counts / scope / cost / timing> |
| <Alternative B>     | <pros>           | <cons>          | <quantitative notes or n/a>      |
| <Alternative C>     | <pros>           | <cons>          | <quantitative notes or n/a>      |

## Decision

<!-- A declarative statement of what was chosen, followed by the scope of applicability. -->

<State the decision in one or two declarative sentences.>

This applies to:

- <scope item — what the decision covers>
- <scope item — boundaries / what it explicitly does not cover>

## Rationale

<!-- Why this option over the others, tied to the requirements and constraints in Context. -->

- <reason aligned to a requirement or constraint>
- <reason aligned to a requirement or constraint>

## Consequences

Positive outcomes:

- <benefit gained>
- <benefit gained>

Negative outcomes:

- <cost, risk, or limitation introduced>
- <cost, risk, or limitation introduced>

## Trade-offs

<!-- Left column: what we gain. Right column: what we sacrifice to get it. -->

| Gains  | Sacrifices  |
| ------ | ----------- |
| <gain> | <sacrifice> |
| <gain> | <sacrifice> |

## Follow-up Actions

<!-- Required for Proposed ADRs and for any ADR with pending, blocked, or deliberately deferred work.
     For Proposed ADRs this table IS the implementation plan.
     Accepted ADRs with no remaining work may delete this section; completed implementation belongs in
     Implementation Note and verification belongs in Test Plan.
     Current State examples: Implemented in `path/file.ts` | Pending | In progress. -->

| Action           | Owner          | Current State                                           |
| ---------------- | -------------- | ------------------------------------------------------- |
| <action to take> | <owner / role> | <Pending / In progress / Implemented in `path/file.ts`> |
| <action to take> | <owner / role> | <state>                                                 |

## References

<!-- Related ADRs (markdown links), code paths in backticks, tickets, discussions, benchmarks. -->

- Related ADR: [ADR-0YY](ADR-0YY-<title>.md)
- <`src/path/file.ts`>
- <link to ticket, discussion, or benchmark>

<!--
OPTIONAL SECTIONS — add any of the following when relevant, placed after Decision/Rationale as appropriate:

## Implementation Note
Use when the decision is already implemented; note what shipped and where.

## API / Type Impact
Use when the decision changes public API or exported type contracts; describe the before/after.

## Keep (with rationale)
Use to document patterns or code intentionally preserved, so reviewers know they were considered and kept on purpose.

## Test Plan
Use to describe how the change is verified end to end (commands to run, behavior to observe, tests added).
-->
