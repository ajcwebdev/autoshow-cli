---
name: provider-model-additions
description: Research, refresh, or reorganize autoshow-cli provider and model addition reports using the current runtime inventory and official release, availability, and pricing sources. Supports any individual report, any selected subset, or the complete six-report set covering text/OCR/URL, STT, image, video, music, and TTS. This skill produces research documentation; it does not implement model or provider changes.
---

# Provider Model Additions

Create evidence-backed recommendations for relevant models and API capabilities on existing AutoShow providers. Distinguish model additions from service changes, accounting defects, and deliberate restoration of retired siblings. This is a documentation workflow; do not change runtime models, registries, defaults, or providers as part of the research.

## Workflow

1. Read the repository `AGENTS.md` and identify the requested reports, their workflows, and whether the request is new research, a refresh, or consolidation. Use one research cutoff for the sources refreshed in this run and record the current repository snapshot separately; finalize the cutoff after research ends.
2. Read [the repository source map](references/repository-source-map.md) before inventorying models. Follow the relevant runtime paths and executing adapters for the requested workflows; derive counts and implementation status from this checkout.
3. Research official sources using the evidence rules below. For supplied link collections or uncertain availability/pricing, read [evidence review](references/evidence-review.md). Reconcile existing findings with the current inventory before assigning recommendation status.
4. Read [the report structure](references/report-structure.md) before writing or updating reports. Preserve stable finding IDs and historical evidence, and use the six output groups below.
5. Validate coverage, links, statuses, formatting, and the repository snapshot using Validation Requirements below. Report the resulting paths, material evidence gaps, and checks actually run.

Every report supports independent creation and refresh: **text/OCR/URL (00), STT (01), image (02), video (03), music (04), and TTS (05)**. Accept selection by report name, number, or path, including any combination. The text/OCR/URL report covers three workflows; the other individual reports each cover one. An explicitly narrower workflow request stays within its owning report and labels omitted workflows as outside scope.

For a scoped run, generate or refresh only the requested reports. Inventory those workflows completely, while checking repository-wide provider names for integration candidates. Each individual report owns its scoped reconciliation and current verification results, including when report 00 is run alone. Missing sibling reports are not prerequisites: state their absence without creating placeholders or broken links. Preserve unrequested reports and their research dates; update an affected existing cross-reference only when needed, without implying that its inventory or sources were rechecked.

## Deliverables

Use these six report groups and output paths. Generate the complete set only when the user requests it or gives no narrower scope; otherwise produce the selected report or subset, using one research cutoff for that run:

- **Text, OCR, and URL:** Writing/text generation, document extraction, and web-page extraction. Output: `docs/reports/provider-model-additions/00-provider-model-additions-text-ocr-url-YYYY-MM-DD.md`.
- **STT:** Speech-to-text and transcript/caption retrieval. Output: `docs/reports/provider-model-additions/01-provider-model-additions-stt-YYYY-MM-DD.md`.
- **Image:** Image generation. Output: `docs/reports/provider-model-additions/02-provider-model-additions-image-YYYY-MM-DD.md`.
- **Video:** Video generation. Output: `docs/reports/provider-model-additions/03-provider-model-additions-video-YYYY-MM-DD.md`.
- **Music:** Music generation. Output: `docs/reports/provider-model-additions/04-provider-model-additions-music-YYYY-MM-DD.md`.
- **TTS:** Text-to-speech narration. Output: `docs/reports/provider-model-additions/05-provider-model-additions-tts-YYYY-MM-DD.md`.

Each report must stand alone for its workflows and link to sibling reports that exist, distinguishing refreshed reports from historical context. Put each current workflow/service/model tuple in exactly one inventory. A provider or model may appear in multiple reports for distinct workflows; label cross-workflow omissions and host alternatives explicitly. Keep original evidence, if needed, in an adjacent `.evidence.zip` archive with a checksum manifest, following `AGENTS.md`; do not create extra summary reports or loose JSON/CSV inventories.

## Research Requirements

- Inventory every configured provider and model in the requested workflows, including hidden entries and local backends. A full-set run covers all eight workflows. Use runtime registries and executing adapters as the source of truth; consult prior reports and ADRs for context.
- Browse current official model catalogs, release notes, API documentation, lifecycle notices, and pricing pages for successors, newer siblings, and relevant new families.
- For aggregators, verify availability through the exact existing host. An upstream release alone is insufficient. Keep host-specific IDs, limits, prices, and account requirements distinct.
- Preserve original billing units, account tiers, and effective dates. For current models, follow registry rates into the estimator: matching numbers with different character/token/duration units are an accounting finding, not a verified price. Keep unknown prices explicit without treating a public API as unavailable.
- Treat existing providers as the repository-wide provider set. A provider used in another workflow can be an integration candidate, but existing credentials do not establish support for the proposed workflow.
- Separate stable releases, publicly callable previews, restricted announcements, and unverified candidates. Distinguish model releases from service updates, dated pins, and moving aliases.
- Recommend candidates relevant to existing AutoShow workflows, including publicly callable previews and new families on existing hosts. Exclude unrelated catalog products.
- Keep public research dates, repository implementation dates, local verification, and live benchmarking separate. Reorganizing research does not revalidate its sources; local tests do not establish provider quality, latency, availability, or billed cost.

## Shared Conventions

Use the exact report headings and order in [the report structure reference](references/report-structure.md). Retain every shared section, stating explicitly when it has no scoped findings. Use unwrapped Markdown prose and align every table to its current cell widths.

Keep tables to the supplied two or three columns and short cells. Use compact candidate labels and reference links in indexes. Put long IDs, source paths, URLs, pricing qualifications, constraints, and reasoning in labeled lists or prose. Do not add columns to accommodate detail.

Use these primary finding categories:

- **Addition recommended**
- **Latest relevant model already present**
- **No verified newer model found**
- **No selectable model**
- **Evidence unresolved**

Use the following implementation classifications. They are code-review assessments, not live compatibility results:

- **C — configuration:** The current request/response path appears compatible; registry, schema, metadata, pricing, and fixtures need updates.
- **A — adapter changes:** An existing workflow needs new request, response, capability, or accounting behavior.
- **I — integration:** An existing provider needs dispatch and an adapter for a workflow it does not currently support.

Give recommendations unique, stable IDs across the report set. Detailed findings own recommendation evidence and implementation assessments. Prioritized additions owns the pending recommendation order. Implementation follow-up owns completed-change history. Reconcile repository changes before assigning current status: completed additions must leave the pending queue, and inventories must reflect their current category. Preserve earlier findings and IDs as dated history rather than pending work.

Keep unchanged-model findings compact. Expand detail for decisions, incompatibilities, and evidence gaps; link to the owning finding instead of repeating its facts across the summary, watchlist, and follow-up. Inventory category totals count current tuples only, separately from future candidates and service/accounting findings. Qualify a retained older model by the capability that lacks a verified replacement.

For a full-set run, the text/OCR/URL report owns the combined inventory reconciliation and shared repository verification results. For a scoped run, a requested report owns that run's checks and scoped totals; other reports refreshed in the same run link there. Do not create or refresh report 00 solely to hold verification, or present an older shared result as current. Claim a combined eight-workflow total only when its complete inventory was reconciled.

## Validation Requirements

- Reconcile the requested inventories against their runtime scope without duplicate tuples; a full-set run must cover all eight workflows. Check registry-to-workflow mappings, service keys, exact IDs, local/service-only entries, category totals, and the applicable reconciliation owner. In particular, separate OCR from URL entries in the shared `extract` registry and assign transcript/caption retrieval to STT.
- Verify that every recommendation has a detailed finding, current status is consistent across report sections, and completed changes appear in history rather than the pending queue.
- Verify local links, cross-report references, stable IDs, required headings, and table layouts. For archived inputs, verify original bytes, checksums, and source-index coverage. Read cited external pages for the actual claim; redirects, HTTP 200, and guessed missing documentation routes do not establish model availability.
- Run the repository's default verification pass once for the shared snapshot: `bun run check` and `bun t --price`. The first runs structure, source-name, type, and documentation-example checks. Confirm that the second stays in price-only mode using `test/test-runner/runner.ts` and `test/test-runner/price-commands/`; it estimates existing verification definitions without billable provider calls or executing the full test suite. Neither command validates research claims, proposed model compatibility, or actual billed cost. Record the results in the owner selected above, labeling price totals as estimates rather than spending. Record outcomes after checks complete.
- Fix failures encountered during verification according to `AGENTS.md`, preserving intended behavior and meaningful assertions, then rerun the affected checks. If behavior changes, also run targeted local, no-cost behavioral tests. Markdown-only edits need the document checks above and the default verification pass; do not add implementation-mirroring tests.
- Do not execute paid provider calls, live benchmarks, or full test/E2E suites for this research task. Full-suite execution requires explicit user authorization; any later billable follow-up must also satisfy the repository's Paid Provider Execution Rules. Preserve previous results as dated evidence and retain cached audio and interrupted output directories.
- Inspect edited files to confirm documentation-only scope and correct report placement. Stay on `staging`; never create or switch branches. Leave staging and committing to the user unless explicitly requested.

## Consolidating an Existing Report (if applicable)

Use this procedure only when splitting or replacing an existing report:

1. Map existing findings to the six workflow reports, preserving recommendation IDs, citations, and dated research and implementation evidence. Split the former text/OCR/STT/URL group into text/OCR/URL and STT, image/video into separate image and video reports, and music/TTS into separate music and TTS reports.
2. Update references and verify that every recommendation, relevant watchlist item, unresolved issue, and citation survived the split.
3. Confirm that current inventories and statuses reflect the repository snapshot without implying that historical external evidence was revalidated.
4. Replace superseded monolithic or grouped reports only after all six reports and their references are complete.
