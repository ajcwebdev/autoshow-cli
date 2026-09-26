# Report Structure

Start each report with this metadata, then use the exact second-level headings below:

```markdown
# {Workflow Group} Provider and Model Additions

- **Research cutoff:** {Date, time, and timezone}
- **Repository status date:** {Date and revision or snapshot}
- **Workflow scope:** {Included workflows}
- **Related reports:** {Links to existing sibling reports, their refresh scope, and any absent/out-of-scope reports}
```

This structure supports any individual report: text/OCR/URL (00), STT (01), image (02), video (03), music (04), or TTS (05). For a single-report request, create or refresh that report without creating the other five. The requested report owns its scoped reconciliation and current verification results. Report 00 run alone reconciles only text/OCR/URL, not all eight workflows. For a partial multi-report run, name one requested report as the check-results owner and link to it from the others. The text/OCR/URL report owns combined reconciliation and shared checks when the full set is refreshed.

## Executive summary

Give a short conclusion with the scoped inventory count, strongest remaining additions by reference ID, completed changes by follow-up link, and material implementation constraints. Do not reproduce the priority queue or detailed findings.

## Prioritized additions

Use this as the only ordered queue of pending recommendations. Define the priority labels used. Link every reference to its detailed finding.

| Ref            | Priority   | Candidate     |
| -------------- | ---------- | ------------- |
| {Finding link} | {Priority} | {Short label} |

## Method, evidence, and implementation terminology

Describe sources consulted, precedence when sources conflict, availability categories, pricing units, and the C/A/I classifications. State the research coverage and limitations. For supplied collections, distinguish files, embedded source sections, unique URLs, and sources freshly verified; scope-screening an unrelated section is not a fresh audit of that workflow. Follow [evidence review](evidence-review.md) for source indexing and archives. Reference recorded checks in Validation and research limitations rather than duplicating results.

## Repository source map

Use short source labels in the table; place linked paths in a list beneath it.

| Area         | Source         |
| ------------ | -------------- |
| {Short area} | {Source label} |

- **{Source label}:** {Linked registries, schemas, or executing adapters and their roles}

## Provider coverage

| Provider      | Workflows     | Entries |
| ------------- | ------------- | ------- |
| {Short label} | {Short names} | {Count} |

Below the table, give each provider's exact service key, scoped coverage conclusion, and evidence or finding links. Include relevant providers configured elsewhere with zero scoped entries, explaining their integration status.

## Current-model inventory and findings

Group entries under workflow headings, then service headings. Use the research workflow labels defined in [the repository source map](repository-source-map.md) and exact service keys in those headings; record the corresponding model-registry key and CLI provider selector below them when different.

| Current ID               | Finding            | Ref            |
| ------------------------ | ------------------ | -------------- |
| {Short ID or entry link} | {Primary category} | {Finding link} |

When an exact registry ID is long, use a compact entry link in the table and record the exact ID in a labeled entry beneath it. Preserve a one-to-one mapping between rows and current tuples. Explain coverage exceptions below the relevant inventory rather than adding columns.

## Detailed findings

Group findings by workflow, then provider. Use the following layout for each recommendation or other substantive finding. Adjust heading depth to fit the grouping while preserving field labels and order. Keep already-current findings brief; reserve expanded detail for actionable differences and unresolved evidence. A comprehensive report needs complete coverage, not a restatement of every API guide.

```markdown
#### {Ref} — {Short title}

- **Workflow:** {Workflow}
- **Existing host:** {Provider and exact service key}
- **Current IDs:** {Exact IDs or no current entry}
- **Proposed IDs or service:** {Exact host-specific IDs, service name, or none}
- **Primary finding:** {Shared category}
- **Implementation status:** {Pending, completed with follow-up link, or no change proposed}
- **Implementation class:** {C, A, I, or not applicable}
- **Availability:** {Stable, public preview, restricted, or unverified; evidence date}

**Release and availability evidence**

{Official evidence establishing release timing and availability through this host}

**Useful improvements**

{Workflow-specific benefits and relevant comparison with current behavior}

**Published pricing**

{Currency, billing units, host, source date, qualifications, and unknowns}

**Capabilities and limits**

{Supported inputs and outputs, limits, account requirements, and restrictions}

**Required work**

{Registry, schema, adapter, dispatch, pricing, and fixture changes as applicable; dependencies and uncertainties}

**Official sources**

- [{Source title}]({Direct URL}) — {Claim supported and evidence date}
```

Keep absent or unresolved facts explicit. Add request code blocks only when exact request syntax is necessary to explain a compatibility assessment; use the matching language tag and credential placeholders.

## Restricted and announced watchlist

| Candidate     | Status         | Ref                   |
| ------------- | -------------- | --------------------- |
| {Short label} | {Short status} | {Evidence entry link} |

Below the table, use a labeled entry per candidate with its exact host/ID, official evidence, and the condition that must change before recommending addition. Keep restricted access distinct from ordinary paid public APIs and publicly callable previews.

## Unresolved evidence, conflicting sources, and non-additions

Use repeated entries rather than a prose-heavy table:

- **{Item}:** {Conflict, unknown access, unsupported claim, adjacent capability, or exclusion}
  - **Evidence:** {Direct source links and relevant dates}
  - **Resolution:** {Conclusion or evidence still needed}

Reference detailed findings when they already contain the evidence.

## Implementation follow-up

Repeat the following entry for completed changes. State explicitly when there are none for the scoped workflows.

- **{Recommendation ID} — {Completion date}:** {Change summary}
  - **Before:** {Exact former IDs or behavior}
  - **After:** {Exact current IDs or behavior}
  - **Policy:** {Approved pricing and selection policy, with evidence}
  - **History:** {Dated former finding and research reference}
  - **Decision record:** {Owning ADR links, if applicable}
  - **Verification:** {Links to dated results in Validation and research limitations}
  - **Remaining validation:** {Links to outstanding benchmark or verification tasks}

Existing code observed during research is baseline evidence, not a newly completed recommendation. Use an observation date when the completion date is unknown; do not infer implementation dates from a provider launch or an ADR's last-edit date. Link historical verification without implying it was rerun. Do not change ADR status merely because a report is reorganized. If implementation or verification status actually changes in relation to an ADR, synchronize the ADR and its index according to repository instructions.

## Coverage reconciliation and actionable addition checklist

Record scoped inventory and primary-finding counts with compact two-column tables:

| Category                   | Count   |
| -------------------------- | ------- |
| {Primary finding category} | {Count} |
| Total scoped tuples        | {Count} |

Reconcile category counts to current inventory rows, excluding proposed models and separate capability/accounting findings. For a full-set run, add the shared reconciliation in the text/OCR/URL report only:

| Report         | Tuples  |
| -------------- | ------- |
| Text, OCR, URL | {Count} |
| STT            | {Count} |
| Image          | {Count} |
| Video          | {Count} |
| Music          | {Count} |
| TTS            | {Count} |
| Combined total | {Count} |

State whether that union matches the runtime inventory and identify any exceptions. Other reports in the full-set run link here for the combined total. Scoped runs state their reconciled workflows and omit an unverified combined total; older sibling totals remain dated context.

Link to Prioritized additions for pending recommendations and Implementation follow-up for completed changes. Use checkboxes only for remaining evidence collection, benchmarks, integration prerequisites, or verification tasks; do not copy the recommendation queue. Link tasks to their owning findings, including findings in another report.

- [ ] {Task} — {Owning finding link and completion criterion}

## Validation and research limitations

Record checks actually run, with date, repository snapshot, outcome, and purpose. Link to the selected results owner when multiple requested reports share a check; a standalone report records its own results. Distinguish historical evidence from checks run for this revision. Price-only totals are hypothetical estimates, not incurred charges or live compatibility results. Add pass/fail outcomes only after execution.

**{Check name}**

- **Date and snapshot:** {Date and revision or snapshot}
- **Purpose:** {What this check establishes}
- **Outcome:** {Result and limitations}

```text
$ {Command actually run}
{Concise relevant output}
```

Omit command blocks for manual checks. State when no commands ran. Record skipped required checks and reasons. Explain limits on public availability evidence, account access, published prices, and benchmarking.
