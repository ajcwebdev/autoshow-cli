# Architecture Decision Record Template

## How to Use This Template

1. Copy only the contents of the `markdown` block below to `docs/adr/ADR-XXX-<kebab-case-title>.md`.
2. Replace `XXX` with the next zero-padded number from the `docs/adr/README.md` index.
3. Replace every angle-bracket placeholder and remove any optional or inapplicable content.
4. Update the `docs/adr/README.md` index in the same change. Keep its sequence summary, next-number pointer, overview entry, and Related ADR links consistent with the new record.
5. Verify the change with `bun run check` and `git diff --check`, plus only targeted local/no-cost tests when needed.

## Authoring Rules

- Use a concise, declarative, title-case decision title.
- Wrap file paths, identifiers, commands, and flags in backticks, for example `src/path/file.ts`.
- Use ISO 8601 dates in `YYYY-MM-DD` form.
- Write prose and list items unwrapped, with no hard line breaks inside a sentence. Keep fenced code blocks line-oriented.
- Do not use Markdown tables. Represent repeated structured information as named records with bold field labels so it remains readable on narrow screens and produces manageable diffs.
- Preserve the four Status field labels, their allowed values, and the Options Considered and Trade-offs field labels exactly as written. These are the load-bearing format shared by all ADRs.
- Include every required section shown in the template unless its own instructions say to remove it.

## Section Guidance

### Status

All four fields are required.

- `Decision Status` must be `Proposed`, `Accepted`, `Deprecated`, or `Superseded`.
- `Proposed` means the decision was recorded before implementation; Follow-up Actions is the implementation plan.
- `Accepted` means the decision is committed and usually implemented.
- `Deprecated` means the decision is no longer recommended; state what to do instead.
- `Superseded` means a later ADR replaced the decision; add `- **Supersession:**` naming that ADR.
- If only part of an Accepted ADR is superseded or absorbed, keep its status as `Accepted` and add `- **Supersession:** <what was superseded, by which ADR, and what remains accepted>`.
- `Verification Status` must be `Pending`, `Passed`, or `Failed`.
- Preserve the original `Date Created` permanently. Change `Date Updated` only for a material update to the record.

### Context

Describe the business and technical forces motivating the decision, including the problem, constraints, and relevant current behavior. End with an explicit `Why now:` sentence naming the trigger.

### Options Considered

Include one named record per alternative, including the chosen option. List the chosen option first, mark its record `(selected)`, and retain the `Option`, `Pros`, `Cons`, and `Quantitative Notes` fields. Use Quantitative Notes for counts, scope, cost, or timing; use `n/a` when none apply. `Rejected; <reason>` is a useful form when one decisive fact eliminates an alternative.

### Decision

State the choice in one or two declarative sentences, add enough mechanism detail to apply it, and bound its scope with both lists.

### Rationale

Explain why the selected option beat the alternatives. Tie each reason to a requirement or constraint from Context.

### Trade-offs

Use one numbered record per trade-off, pairing a `Gain` field with the `Sacrifice` required to obtain it.

### Follow-up Actions

Keep this section whenever work remains. It is always required for Proposed ADRs and for Accepted ADRs with pending, blocked, or deliberately deferred work.

Delete this section once an Accepted ADR has no remaining work. Move completed implementation details to an Implementation Note and verification details to a Test Plan; do not retain completed checklist items here.

Each item must use `- [ ]` for open work or `- [x]` for completed work awaiting section cleanup. Give it a short action title, an em dash, and one of these states: `Pending`, `In progress`, `Blocked on <what>`, or ``Implemented in `path/file.ts` ``. Add an indented explanatory line only when the title and state are insufficient.

### References

Every Related ADR listed for this record in the README overview must appear here as a Markdown link. Add relevant code paths in backticks and links to tickets, discussions, or benchmarks.

## Optional Sections

Insert applicable optional sections between Trade-offs and Follow-up Actions.

- `Implementation Note`: Use when the decision is already implemented; name what shipped and the files that carry it.
- `API / Type Impact`: Use when the decision changes a public API or exported type contract; describe the before and after.
- `Keep (with rationale)`: Use to identify patterns or code deliberately preserved so reviewers know they were considered and retained intentionally.
- `Test Plan`: Record end-to-end verification with a fenced code block of local/no-cost commands followed by a numbered list of the behaviors each command proves.

## Template

````markdown
# ADR-XXX: <Concise Decision Title>

## Status

- **Decision Status:** Proposed
- **Date Created:** YYYY-MM-DD
- **Date Updated:** YYYY-MM-DD
- **Verification Status:** Pending

## Context

<Describe the forces at play, the current state, and the constraints.>

Why now: <what triggered this decision today - new requirement, recurring pain, blocking work, etc.>

## Options Considered

**Option 1 (selected)**

- **Option:** <Chosen option>
- **Pros:** <key advantages>
- **Cons:** <key drawbacks>
- **Quantitative Notes:** <counts / scope / cost / timing>

**Option 2**

- **Option:** <Alternative B>
- **Pros:** <pros>
- **Cons:** <cons>
- **Quantitative Notes:** <quantitative notes or n/a>

**Option 3**

- **Option:** <Alternative C>
- **Pros:** <pros>
- **Cons:** <cons>
- **Quantitative Notes:** <quantitative notes or n/a>

## Decision

<State the decision in one or two declarative sentences.>

This applies to:

- <scope item the decision covers>
- <scope item the decision covers>

It does not apply to:

- <adjacent concern explicitly left out, with its owning ADR when one exists>
- <adjacent concern explicitly left out>

## Rationale

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

**Trade-off 1**

- **Gain:** <gain>
- **Sacrifice:** <sacrifice>

**Trade-off 2**

- **Gain:** <gain>
- **Sacrifice:** <sacrifice>

## Follow-up Actions

- [ ] <Action title> — <Pending / In progress / Blocked on what>
  <optional explanatory text: scope, blockers, or how to verify>
- [ ] <Action title> — <current state>

## References

- Related ADR: [ADR-0YY](ADR-0YY-<title>.md)
- <`src/path/file.ts`>
- <link to ticket, discussion, or benchmark>
````
