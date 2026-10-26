---
name: provider-model-additions
description: Research, refresh, or reorganize autoshow-cli provider and model addition reports using the current runtime inventory and official release, availability, and pricing sources. Supports any individual report, any selected subset, or the complete six-report set covering text/OCR/URL, STT, image, video, music, and TTS. This skill produces research documentation; it does not implement model or provider changes.
---

# Provider Model Additions

Create evidence-backed recommendations for relevant models and API capabilities on existing AutoShow providers. Distinguish model additions from service changes, accounting defects, and deliberate restoration of retired siblings. This is a documentation workflow; do not change runtime models, registries, defaults, or providers as part of the research.

## Workflow

1. Read the repository `AGENTS.md` and identify the requested reports, workflows, existing finding owners, and whether the request is new research, a refresh, or consolidation. Record the current repository snapshot and the exact prompt path/SHA-256 used for this run. Use one research cutoff for sources actually refreshed; finalize it after research ends.
2. Read [the repository source map](references/repository-source-map.md) before inventorying models. Follow the relevant runtime paths and executing adapters for the requested workflows; derive counts and implementation status from this checkout.
3. Research official sources using the evidence rules below. For supplied link collections or uncertain availability/pricing, read [evidence review](references/evidence-review.md). Reconcile existing findings with the current inventory before assigning recommendation status.
4. Read [the report structure](references/report-structure.md) before writing or updating reports. Preserve stable finding IDs and historical evidence, and use the six output groups below.
5. Validate coverage, links, statuses, formatting, and the repository snapshot using Validation Requirements below. Report the resulting paths, material evidence gaps, and checks actually run.

Every report supports independent creation and refresh: **text/OCR/URL (00), STT (01), image (02), video (03), music (04), and TTS (05)**. Accept selection by report name, number, or path, including any combination. The text/OCR/URL report covers three workflows; the other individual reports each cover one. An explicitly narrower workflow request stays within its owning report and labels omitted workflows as outside scope.

For a scoped run, generate or refresh only the requested reports. Inventory those workflows completely, while checking repository-wide provider names for integration candidates. Each individual report owns its scoped reconciliation and current verification results, including when report 00 is run alone. Missing sibling reports are not prerequisites: state their absence without creating placeholders or broken links. Preserve unrequested reports and their research dates; update an affected existing cross-reference only when needed, without implying that its inventory or sources were rechecked.

When the user explicitly requests only a bounded local handoff or read-only assessment, return that requested artifact instead of creating formal reports or running write-producing checks. Keep exact identities, evidence limits and carried decisions, and record which report-level research or checks were outside that scope.

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

- Inventory every configured tuple in the requested workflows, including hidden entries, selector-free services and executing local backends. Record workflow, registry key, CLI selector, registry ID and wire model value separately. Count Tesseract with an explicit no-upstream-model marker even though it has no registry record; URL services and caption retrieval can carry internal IDs without a selectable upstream model. Do not count aliases, retired rates/types/stubs, empty directories, or one backend reached through several commands as additional tuples.
- Resolve bare-provider and omitted-provider defaults through read-only execution of the actual local resolver. Record the complete candidate when selection also chooses mode, duration or resolution. Config descriptions and cost/timing constants are not executable defaults.
- Freeze the scoped current inventory and prior decisions before screening repository-wide existing providers for relevant missing workflows. Record each lead as recommended, unresolved with a named missing fact, excluded by a recorded decision, or irrelevant. Credentials and marketing categories do not establish dispatch support.
- Browse official catalogs, exact host/operation pages, API schemas, dated release/lifecycle notices and billing terms together. Inspect access and retirement banners even when examples remain. For conflicting claims, record source language, page-update date, retrieval date and exact operation; a preferred locale or upstream release is not automatically authoritative for another host. Follow [evidence review](references/evidence-review.md) for bounded conflict resolution and pricing traces.
- Distinguish complete-file HTTP, async batch, streaming transport and realtime conversation within the same product. Preserve modes and reference inputs already supported by executing adapters. A missing adapter for an existing workflow can be an integration finding; a newly proposed product outside current workflows needs a scope decision.
- Reconcile candidate eligibility with ADR-010: concrete stable host IDs, generally available lifecycle, and usage without mandatory recurring fees or recurring minimum spending. Publicly callable previews remain research candidates, with unresolved registry eligibility where they conflict with that policy; an existing preview is not a general exception. Keep access, grandfathered-account eligibility, tariff, add-ons and unknown cost separate.
- Read the Excluded integrations section of ADR-010 before recommending anything. Its dated tables record excluded providers and excluded models on retained providers (for example, Cloudflare `@cf/deepgram/nova-3` and Together's WebSocket-only Nemotron streaming models). Check exact host, generation, operation and model identity: neither a surviving catalog entry nor a new generation automatically reopens an excluded route. Reconsideration needs new primary evidence addressing the recorded reason and a user decision.
- For STT episode publishing, retain `--provider assemblyai=universal-3-5-pro --diarization` from `AGENTS.md`; a newer research candidate does not change that policy. For TTS, inspect serializers, native dialogue and voice provisioning before proposing missing capabilities, and keep spoken text, inline delivery tags and request-level instructions distinct.
- Preserve reference and media privacy. Do not copy source-book titles, author names, excerpts or source filenames from benchmark evidence into research reports or synthetic fixtures. Follow the repository's benchmark exemption and pre-commit audit at their actual scope; use generic fixture content outside it.
- Keep public research dates, repository implementation dates, local verification and live benchmarking separate. Reorganization does not refresh sources, and mocks or decoded artifacts do not establish spoken correctness, perceptual quality, provider availability or invoice cost.

## Shared Conventions

Use the exact report headings and order in [the report structure reference](references/report-structure.md). Retain every shared section, stating explicitly when it has no scoped findings. Use unwrapped Markdown prose and align every table to its current cell widths.

Keep tables to the supplied two or three columns and short cells. Use compact candidate labels and reference links in indexes. Put long IDs, source paths, URLs, pricing qualifications, constraints, and reasoning in labeled lists or prose. Do not add columns to accommodate detail.

Use these primary finding categories for current tuples only:

- **Addition recommended**
- **Latest relevant model already present**
- **No verified newer model found**
- **No selectable model**
- **Evidence unresolved**

Use the following implementation classifications. They are code-review assessments, not live compatibility results:

- **C — configuration:** The current request/response path appears compatible; registry, schema, metadata, pricing, and fixtures need updates.
- **A — adapter changes:** An existing workflow needs new request, response, capability, or accounting behavior.
- **I — integration:** An existing provider needs dispatch and an adapter for a workflow it does not currently support.

Give recommendations unique, stable IDs across the report set, continuing existing sequences from their actual owning reports or archives. Missing historical owners are evidence gaps, not permission to reuse IDs or restore absent reports. Detailed findings own recommendation evidence and implementation assessments. Prioritized additions owns only pending model/workflow additions. Put identity, accounting, lifecycle and policy-decision actions in actionable follow-up with an action type, owner and urgency; an urgent retirement need not have an eligible replacement. Implementation follow-up owns completed-change history. Reconcile code changes before assigning status, and preserve earlier IDs and decisions as dated history.

Use the full implementation template for new actionable additions/integrations. Keep unchanged current families, carried decisions, identity maintenance and bounded evidence gaps compact, with disposition, exact scope/IDs, dated evidence, prior owner and re-entry condition. Expand changed facts and their consequences; shared evidence has one owner. Count future candidates separately from current tuples and queue length. A service-only internal ID is not an upstream model release; a separate tariff defect does not change its primary category. Qualify retained older models by the capability or unresolved retirement decision that keeps them relevant.

For a full-set run, the text/OCR/URL report owns the combined inventory reconciliation and shared repository verification results. For a scoped run, a requested report owns that run's checks and scoped totals; other reports refreshed in the same run link there. Do not create or refresh report 00 solely to hold verification, or present an older shared result as current. Claim a combined eight-workflow total only when its complete inventory was reconciled.

## Validation Requirements

- Reconcile the requested inventories against their runtime scope without duplicate tuples; a full-set run must cover all eight workflows. Check registry-to-workflow mappings, service keys, exact IDs, local/service-only entries, category totals, and the applicable reconciliation owner. In particular, separate OCR from URL entries in the shared `extract` registry and assign transcript/caption retrieval to STT.
- Verify that every recommendation has a detailed finding, current status is consistent across report sections, and completed changes appear in history rather than the pending queue.
- Directly validate every requested report: exact twelve provider-research headings/order, local/sibling links and fragments, stable IDs, one row per expected runtime tuple, category sums, table alignment, whitespace, final newline and portable paths. Check source rows and actual executing local exceptions, not only a prose total. Verify archive checksums, original bytes and source-index coverage. Repository checks skip ignored `docs/reports/`; their success is not document acceptance or research completeness.
- Run `bun --no-env-file src/tools/report-validator.ts <report.md> --profile provider-research`, supplying `--checksums <archive.zip>` when applicable. For generic action reports use the default/`generic` profile instead. The checker accepts explicit ignored paths and bounded diagnostics; it complements runtime reconciliation and independent content review rather than proving research completeness.
- Run the repository's default verification pass once for the shared snapshot: `bun run check` and `bun t --price --no-cleanup`. The first runs structure, source-name, type and maintained documentation-example checks. Confirm price-only behavior in `test/test-runner/runner.ts`, `price-execution.ts` and `price-commands/`: mapped price commands execute with `--price`, without provider dispatch or the full suite. Price mode preserves prior output by default; `--no-cleanup` makes that intent explicit. Diagnose missing local prerequisites without silently changing setup. Neither command validates research claims, proposed-model compatibility or billed cost. Record actual outcomes under the selected owner and label price totals as estimates.
- Fix failures encountered during verification according to `AGENTS.md`, preserving intended behavior and meaningful assertions, then rerun the affected checks. If behavior changes, also run targeted local, no-cost behavioral tests. Markdown-only edits need the document checks above and the default verification pass; do not add implementation-mirroring tests.
- Do not execute paid provider calls, live benchmarks, or full test/E2E suites for this research task. Full-suite execution requires explicit user authorization; any later billable follow-up must also satisfy the repository's Paid Provider Execution Rules. Preserve previous results as dated evidence and retain cached audio and interrupted output directories.
- Inspect edited files to confirm documentation-only scope and correct report placement. Stay on `staging`; never create or switch branches. Leave staging and committing to the user unless explicitly requested.

## Consolidating an Existing Report (if applicable)

Use this procedure only when splitting or replacing an existing report:

1. Map the requested existing findings to their owning workflow reports, preserving IDs, citations, prior decisions and dated evidence. Locate current handoffs and archived owners instead of assuming a former monolithic report still exists; an absent historical owner remains an explicit evidence gap.
2. Update references and verify that every recommendation, relevant watchlist item, unresolved issue, and citation survived the split.
3. Confirm that current inventories and statuses reflect the repository snapshot without implying that historical external evidence was revalidated.
4. Replace or shorten a superseded report only after its receiving reports and references are complete; archive the original bytes with checksums first. Preserve unrequested material and its owning report. A scoped refresh does not require creating all six reports or changing other reports' dates.
