# Report Structure

A report is a decision document for one workflow group: what to add and in what order, what the user must decide, and what evidence blocks the rest. Readers should reach those answers in the first screen and find supporting evidence only when they open a finding.

Start every report with this metadata, then use exactly the seven second-level headings below, in order. `report-validator.ts --profile provider-research` enforces the headings, the five metadata fields and the inventory tables.

```markdown
# {Workflow group} Provider and Model Additions

- **Research cutoff:** {YYYY-MM-DD HH:MM timezone}
- **Repository snapshot:** {branch} at {short revision}, {clean or dirty}
- **Execution prompt:** [{prompt file}]({relative link}) `{SHA-256}`
- **Workflow scope:** {workflow keys}; {N} current tuples
- **Related reports:** {sibling links that exist}; {which report owns combined totals and shared checks}
```

When the live prompt file has changed since the research run, link the archived prompt entry instead and keep the research run's SHA-256. Keep each metadata value to one line.

Writing rules that apply to every section:

- **One owner per fact.** A finding owns its evidence, pricing and work. The summary, queue, watchlist and actions link to it rather than restating it.
- **Report decisive facts, archive the rest.** Keep exact IDs, prices with units, lifecycle dates and the facts that set a category, priority or class. Retrieval times, quotations, page-by-page reading notes, full command output, reviewer passes and drafting history belong in the evidence archive. Give a page or launch date only when it decides something.
- **Do not restate the skill.** Category, class and priority definitions appear once as the one-line legend in Prioritized additions. Do not add method, terminology or repository source map sections, and do not repeat hedges such as "code-review assessment, not a live result" per finding; Evidence and validation states them once.
- **Name only the files a finding changes.** Inherited requirements are in the [standard implementation contract](implementation-contract.md); a finding's Work line names only what differs or adds.
- **Length budgets.** Summary: at most six bullets. Actionable finding: about 300 words. Compact finding: about 100 words. Actions: one line per item. A single-workflow report should usually stay under 25 KB; the three-workflow text/OCR/URL report under 45 KB. Exceeding a budget needs a decision-relevant reason, not completeness for its own sake.
- **Tables.** Use only the tables defined here, with short cells, aligned pipes and no hard-wrapped prose. Put long IDs and explanations in the bullet beneath the table, not in extra columns. In reports with many findings, shortcut reference links such as `[TEXT-102]`, with definitions at the end of the file, keep tables narrow; use inline links for sibling reports and sources.

## Summary

Three to six bullets covering: the scoped tuple count and category split; the strongest pending additions by ID; time-sensitive lifecycle or accounting actions with their dates; decisions the user must make; and at most one material constraint. Do not reproduce the queue, evidence or work.

## Prioritized additions

Open with the legend line, then the queue. This is the only ordered list of pending model or workflow additions; identity, accounting, lifecycle and policy actions belong in Actions.

```markdown
Priority: **P1** clear successor or update of an implemented model, unless the finding states a reason · **P2** other verified addition with clear benefit and complete pricing · **P3** optional or needs a scope or policy decision · **Blocked** prerequisite named in the finding · **Urgent** (actions only) dated lifecycle change in effect or imminent, with or without a successor. Class: **C** configuration · **A** adapter change · **I** new workflow integration.
```

| Ref            | Priority   | Class | Candidate     |
| -------------- | ---------- | ----- | ------------- |
| {Finding link} | {Priority} | {C}   | {Short label} |

Write `No pending additions.` instead of an empty table. Beneath the table, add at most one `Prerequisites:` bullet per P3 or Blocked row whose blocker is not obvious from its label.

## Inventory

One sentence states what was counted and excluded (aliases, retired rates, stubs, reused consumers, local exceptions). Then the provider and category tables, then one table per workflow and service:

| Provider | Workflows | Entries |
| -------- | --------- | ------- |
| {Name}   | {Keys}    | {Count} |

| Category                   | Count   |
| -------------------------- | ------- |
| {Primary finding category} | {Count} |
| Total scoped tuples        | {Count} |

List only providers with scoped entries; providers without dispatch for this workflow appear as leads in the watchlist. Entries and category counts must sum to the inventory rows. Future candidates and queue length are not current tuples and are not counted here.

For a full-set run, report 00 adds a `Report` / `Tuples` table with one row per report and a `Combined total` row, followed by one sentence stating whether the union matches the runtime inventory. Scoped runs omit an unverified combined total.

Group current tuples under `### {workflow}` and `#### {service key}` headings:

| Current ID | Finding            | Ref            |
| ---------- | ------------------ | -------------- |
| {Exact ID} | {Primary category} | {Finding link} |

Keep exactly one row per current tuple. Beneath each service table, write at most one line covering what a reader cannot infer: the CLI selector when it differs from the service key, a wire ID that differs from the registry ID, the resolved bare-provider default, or a coverage exception. Endpoints and reference inputs belong in a finding only when they decide its class.

## Findings

Group findings under `### {workflow}` headings and order them by provider. Use `#### {ID} — {Short title}` for each finding and keep existing titles unchanged so cross-report links survive. Use the actionable shape for pending additions, integrations and work-bearing accounting or lifecycle changes; use the compact shape for everything else.

Actionable shape:

```markdown
#### {ID} — {Short title}

- **Proposal:** {exact proposed IDs on `{service key}`}; {current IDs they extend or replace}
- **Status:** {primary category}; {priority, with the reason when a successor is not P1}; class {C, A or I}; {pending or completed with link}
- **Availability:** {stable, public preview, restricted or unverified}; {release or lifecycle date}
- **Benefit:** {the workflow benefit over current behavior, in one or two sentences}
- **Pricing:** {currency and billing unit, key rates, comparison with the current tuple, unknowns}
- **Work:** {the change that sets the class, with paths; default, coexistence or retirement decisions; anything beyond the standard contract}
- **Open questions:** {unconfirmed capabilities, source conflicts or account facts; omit when none}
- **Sources:** [{Page title}]({URL}), [{Page title}]({URL})
```

Compact shape, for current-family status, carried decisions, identity maintenance, evidence gaps and groups of unintegrated routes:

```markdown
#### {ID} — {Short title}

- **Disposition:** {category or decision, in one sentence}
- **Evidence:** {at most three decisive facts with dates}
- **Re-entry:** {what must change before this is reconsidered}
- **Sources:** [{Page title}]({URL}), [{Page title}]({URL})
```

For a group of unintegrated or removed routes, replace Evidence with one line per provider: `**{Provider}** ({disposition}): {exact IDs}; {missing fact or recorded reason}`. Cite three to six official sources per finding, choosing the pages that establish identity, availability, price and lifecycle; the archive keeps the complete source list. Add a request example only when exact syntax decides the class.

## Watchlist and unresolved evidence

One table covers restricted or announced candidates, unresolved source conflicts, provider leads without dispatch and deliberate non-additions:

| Item          | Status                | Ref            |
| ------------- | --------------------- | -------------- |
| {Short label} | {Status in ≤ 5 words} | {Finding link} |

Every row links to the finding that owns its evidence and re-entry condition; add no prose beneath the table. Keep restricted access distinct from ordinary paid access and publicly callable previews. When nothing restricted was verified, say so in one line.

## Actions

Begin with completed changes: `**Completed changes:** none in this run.`, or one line per change: `**{ID}, {date}:** {before} → {after}; verified by {link}`. Existing code observed during research is baseline, not a completed change.

Then one checkbox per action that is not a queued addition:

```markdown
- [ ] **{Type}, {priority}:** {task} ([{ID}](#{anchor})). Done when {criterion}.
```

Types: Lifecycle, Policy decision, Identity, Accounting, Evidence, Capability. Priorities follow the legend; list Urgent actions first and name their date. Merge actions that share an owner and decision. Do not list steps that are part of implementing a queued addition, or generic rules such as paid-call approval; the finding's Work line and the contract cover them. Keep urgent retirements visible even without an eligible replacement. A full-set report 00 may add one line linking urgent actions owned by sibling reports.

## Evidence and validation

```markdown
- **Evidence:** {source types used and evidence forms that limit confidence}; [{archive}]({archive}.evidence.zip), useful entries: `{entry}`, `{entry}`
- **Limits:** {unreadable sources, unqueried account state, no live calls; one line per provider only when they differ}
- **History:** {prior owners and carried decisions, or that none survive}
```

| Check             | Result                                   |
| ----------------- | ---------------------------------------- |
| {Command or name} | {Outcome, date and snapshot when needed} |

Record only checks actually run, with outcomes; label price totals as hypothetical estimates. The report that owns shared checks lists `bun run check` and `bun t --price --no-cleanup`; others link to it and list only their own document validation. Before finishing, run `bun --no-env-file src/tools/report-validator.ts <reports> --profile provider-research --checksums <archive>` and fix every diagnostic. The validator checks headings, metadata, links and fragments, unique stable IDs, inventory rows and sums, table alignment, whitespace and portable paths; it does not establish research accuracy, so also confirm inventory rows against the runtime and every recommendation against its finding.
