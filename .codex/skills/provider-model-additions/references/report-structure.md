# Report Structure

Start each report with this metadata, then use the exact second-level headings below:

```markdown
# {Workflow Group} Provider and Model Additions

- **Research cutoff:** {Date, time, and timezone}
- **Repository status date:** {Date and revision or snapshot}
- **Execution prompt:** {Repository-relative prompt path and exact SHA-256, or the exact supplied task snapshot when no file was used}
- **Workflow scope:** {Included workflows}
- **Related reports:** {Links to existing sibling reports, their refresh scope, and any absent/out-of-scope reports}
```

This structure supports any individual report: text/OCR/URL (00), STT (01), image (02), video (03), music (04), or TTS (05). For a single-report request, create or refresh that report without creating the other five. The requested report owns its scoped reconciliation and current verification results. Report 00 run alone reconciles only text/OCR/URL, not all eight workflows. For a partial multi-report run, name one requested report as the check-results owner and link to it from the others. The text/OCR/URL report owns combined reconciliation and shared checks when the full set is refreshed.

## Executive summary

Give a short conclusion with the scoped inventory count, strongest remaining additions by reference ID, completed changes by follow-up link, and material implementation constraints. Do not reproduce the priority queue or detailed findings.

## Prioritized additions

Use this as the only ordered queue of pending model/workflow additions. Exclude identity, accounting, lifecycle and policy-decision actions; they belong in actionable follow-up. Define the priority labels once for the refreshed scope and reuse their meanings. Mark evidence-blocked candidates and the specific prerequisite. Queue length, future-candidate counts and current-tuple category counts are distinct.

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

Before drafting, screen repository-wide providers for relevant workflows they do not currently dispatch. Report 00 owns the full missing-workflow screen; a scoped run records only its relevant part, linked to each lead's owner. Use a compact Provider / Missing workflow / Disposition table if useful, with exact host/generation/operation identities and evidence gaps beneath it. Recorded exclusions remain decisions, not pending integrations.

## Current-model inventory and findings

Group entries under workflow headings, then service headings. Use the research workflow labels defined in [the repository source map](repository-source-map.md) and exact service keys in those headings; record the corresponding model-registry key and CLI provider selector below them when different.

| Current ID               | Finding            | Ref            |
| ------------------------ | ------------------ | -------------- |
| {Short ID or entry link} | {Primary category} | {Finding link} |

When an exact registry ID is long, use a compact entry link in the table and record the exact ID in a labeled entry beneath it. Preserve a one-to-one mapping between rows and current tuples. Explain coverage exceptions below the relevant inventory rather than adding columns.

Current primary categories do not count future candidates. An already-registered newer family can qualify a retained older tuple's category, but state the retained capability or unresolved retirement decision. No selectable model means no selectable upstream release; record a service's internal operation ID separately. Independent tariff or entitlement issues belong to their own action findings rather than changing model categories.

## Detailed findings

Group findings by workflow, then provider. Use the full template below for each new actionable addition or integration, adjusting heading depth while preserving labels and order. For unchanged current families, carried completed/deferred/rejected decisions, identity maintenance and bounded evidence gaps, use a compact entry with disposition, exact scope/IDs, dated evidence, prior owner and re-entry condition. Expand only changed facts and practical consequences. Common release/pricing evidence and repeated implementation requirements have one owner; link distinct workflow changes there instead of repeating guides and ledgers.

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

{Name the actual endpoint, serializer or capability change determining C/A/I, with its executing path; for C explain why the existing request/response path remains compatible. Identify registry, schema, dispatch, pricing, fixture changes, dependencies and uncertainties.}

{Record deliberate default/all-expansion and lifecycle/retained-identity changes; all five paid provenance fields (pricingSourceUrl, pricingCheckedAt, pricingCurrency, pricingTier, pricingNotes); exact affected docs/commands overviews and provider-link files; and local accepted/default/override/reset controls, rejection-before-dispatch, pricing, valid/invalid artifacts and recovery checks. Link repeated requirements to a report-owned shared implementation contract.}

{Keep documented behavioral migration changes (for example output normalization, timing, accent, voice continuity or token budgets) separate from accepted fields. For TTS, distinguish native dialogue from single-voice similarity controls, inline delivery tags from request instructions, transport success from decoded integrity, and spoken correctness from perceptual quality. Mocks do not establish audible outcomes.}

**Official sources**

- [{Source title}]({Direct URL}) — {Claim supported and evidence date}
```

Keep absent or unresolved facts explicit. Add request code blocks only when exact request syntax is necessary to explain a compatibility assessment; use the matching language tag and credential placeholders.

Required work assesses ADR-010's complete contract and ADR-015's evidence order, including defaults, `--all-*`, help/examples, price preflight, resume and historical rates/identity. Proposed checks are implementation prerequisites rather than permission for paid execution or claims of live compatibility.

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

Reconcile category counts to current inventory rows, excluding proposed models and separate capability/accounting findings. Record future workflow/service/model candidate counts and dispositions separately; do not derive them from Addition recommended rows or queue length. For a full-set run, add the shared reconciliation in the text/OCR/URL report only:

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

Link to Prioritized additions for pending additions and Implementation follow-up for completed changes. Give identity, accounting, lifecycle and policy-decision follow-up an explicit action type, owning finding and urgency under the same priority legend. Urgent retirements remain visible even without an eligible replacement. Use checkboxes for these actions, evidence collection, benchmarks, integration prerequisites and verification; do not copy the addition queue. Link each task to its owning finding, including another report when needed.

- [ ] {Action type; urgency} — {Task, owning finding link and completion criterion}

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

Directly accept every requested report against these twelve headings, links/fragments, unique stable IDs, exact runtime tuples and local exceptions, category sums, table layout, whitespace, newline and portable paths. Apply this schema only to provider-research reports, not arbitrary maintenance/action reports. `bun run check` skips ignored reports and cannot establish document acceptance. Pin the prompt actually used; a later prompt revision does not retroactively validate an earlier research run.
