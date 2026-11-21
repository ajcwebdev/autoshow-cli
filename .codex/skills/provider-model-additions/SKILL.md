---
name: provider-model-additions
description: Research, refresh, or reformat autoshow-cli provider and model addition reports using the current runtime inventory and official release, availability, and pricing sources. Supports any individual report, any selected subset, or the complete six-report set covering text/OCR/URL, STT, image, video, music, and TTS. Produces compact, decision-ready research documentation; it does not implement model or provider changes.
---

# Provider Model Additions

Produce compact, evidence-backed reports that tell the user which models to add to existing AutoShow providers, in what order, what must be decided first, and what evidence blocks the rest. Keep model additions distinct from service changes, accounting defects and deliberate restoration of retired siblings. This is documentation only: do not change runtime models, registries, defaults or providers.

## Deliverables

Six independently refreshable reports under `docs/reports/provider-model-additions/`, selectable by name, number, path or any combination:

| Report | Workflows                                     | Output file                                        |
| ------ | --------------------------------------------- | -------------------------------------------------- |
| 00     | `write`, `ocr`, `url`                         | `00-provider-model-additions-text-ocr-url-DATE.md` |
| 01     | `stt`, including transcript/caption retrieval | `01-provider-model-additions-stt-DATE.md`          |
| 02     | `image`                                       | `02-provider-model-additions-image-DATE.md`        |
| 03     | `video`                                       | `03-provider-model-additions-video-DATE.md`        |
| 04     | `music`                                       | `04-provider-model-additions-music-DATE.md`        |
| 05     | `tts`                                         | `05-provider-model-additions-tts-DATE.md`          |

Generate the full set only when asked or when no narrower scope is given. A scoped run refreshes only the requested reports, inventories their workflows completely, owns its own reconciliation and checks, and leaves unrequested reports and their dates untouched; missing siblings are stated, not created. Keep supporting evidence in one adjacent `.evidence.zip`; create no summary reports or loose JSON/CSV inventories. When the user asks only for a local handoff or read-only assessment, return that instead of formal reports.

## Workflow

1. Read `AGENTS.md`. Identify the requested reports, whether this is new research, a refresh or a reformat, and the existing finding owners. Record the repository snapshot and the prompt path and SHA-256.
2. Read [the repository source map](references/repository-source-map.md) and inventory the executing tuples from this checkout.
3. Research official sources under the rules below, reading [evidence review](references/evidence-review.md) for supplied collections or uncertain availability or pricing. Reconcile prior findings with the current inventory before assigning statuses.
4. Write the reports to [the report structure](references/report-structure.md), with actionable findings inheriting [the standard implementation contract](references/implementation-contract.md).
5. Validate (see Validation) and reply with the report paths, material evidence gaps and the checks actually run.

## Research rules

- **Inventory.** Count every configured workflow/service/model tuple in scope, including hidden entries, selector-free services and executing local backends; record workflow, registry key, CLI selector, registry ID and wire ID where they differ. Count Tesseract with no upstream model; classify URL services in the shared `extract` registry as URL and caption retrieval as STT. Aliases, retired rates, stubs, empty directories and one backend reached through several commands add no tuples.
- **Defaults.** Resolve bare-provider and omitted-provider defaults by executing the local resolver read-only, recording the complete candidate when selection also picks mode, duration or resolution. Config descriptions and cost constants are not defaults.
- **Leads.** After freezing the inventory, screen repository-wide providers for the scoped workflows they do not dispatch. Record each lead as recommended, unresolved with a named missing fact, excluded by a recorded decision, or irrelevant. Credentials and marketing categories do not establish dispatch support.
- **Sources.** Use official catalogs, exact host and operation pages, API schemas, dated release and lifecycle notices and billing terms together. Keep complete-file, async, streaming and realtime operations distinct, and preserve modes and reference inputs the executing adapters already support.
- **Eligibility.** Apply ADR-010. Eligible routes use concrete stable host IDs, are generally available, and require neither a recurring fee nor a recurring minimum spend. Metered billing and one-time prepaid credits qualify. Record any prepaid minimum and credit expiry. Publicly callable previews stay candidates with unresolved eligibility. Consult ADR-010's Excluded integrations tables first. Reopening an excluded route requires new evidence addressing the recorded reason and a user decision.
- **Workflow policy.** STT episode publishing stays on `--provider assemblyai=universal-3-5-pro --diarization` regardless of newer candidates. For TTS, inspect serializers, native dialogue and voice provisioning before proposing capabilities, and keep spoken text, inline delivery tags and request-level instructions distinct.
- **Privacy.** Never copy source-book titles, authors, excerpts or filenames from benchmark evidence into reports or fixtures.
- **Dates.** Keep public research dates, repository implementation dates, local verification and live benchmarking separate. Reformatting refreshes no sources, and mocks or decoded artifacts establish neither spoken correctness, perceptual quality, availability nor invoice cost.

## Classification

Primary categories, for current tuples only:

- **Addition recommended:** an eligible newer or sibling model on the same host should be added.
- **Latest relevant model already present:** the newest relevant model is registered; name the capability or pending retirement decision that keeps any older tuple.
- **No verified newer model found:** the host was checked and nothing newer was verified.
- **No selectable model:** the service has no selectable upstream release; an internal operation ID is not a model.
- **Evidence unresolved:** a named missing fact prevents a conclusion.

Implementation classes are code-review assessments, not live results: **C** configuration (request and response path compatible; registry, schema, pricing and fixtures change), **A** adapter change (new request, response, capability or accounting behavior in an existing workflow), **I** integration (an existing provider gains dispatch for a workflow it does not serve).

Priorities:

- **P1:** a clear successor or update of a currently implemented model on the same provider and workflow, meaning a newer version of the same family or tier, or the provider's named replacement, including every lifecycle-driven replacement. A successor ranks lower only for a reason stated in its Status line: eligibility or availability is unverified (Blocked), a recorded policy or exclusion decision must be reopened first (P3), or it drops a capability current runs depend on with no workaround (P2 or P3). Higher cost alone is not a reason when the current model can stay the default.
- **P2:** any other verified addition (a sibling tier, an alternative or a new capability) with clear benefit and complete pricing.
- **P3:** optional, or needing a scope or policy decision first, such as a new workflow integration, reopening a removal or exclusion, or a tier with no predecessor.
- **Blocked:** an evidence or policy prerequisite, named in the finding.
- **Urgent (actions only):** a dated deprecation, closure, shutdown or default change that is in effect or due before the next refresh, whether or not a successor exists.

Actions that a P1 addition depends on, such as its retirement or coexistence decision, share its priority.

## Ownership and IDs

- Finding IDs are unique and stable across the set (`TEXT-`, `OCR-`, `URL-`, `STT-`, `IMAGE-`, `VIDEO-`, `MUSIC-`, `TTS-` plus three digits). Continue each sequence from its highest existing ID in the owning report or archive; never reuse an ID, and treat a missing historical owner as an evidence gap.
- Findings own evidence and work. Prioritized additions holds only pending model or workflow additions. Actions holds identity, accounting, lifecycle and policy actions plus completed changes. Shared evidence has one owner and is linked elsewhere.
- Future candidates, queue length and current-tuple category counts are separate numbers. A separate tariff or entitlement issue does not change a tuple's category.
- In a full-set run, report 00 owns the combined reconciliation and the shared repository checks; in a scoped run, one requested report owns them and the others link there. Claim a combined total only when every workflow was reconciled.

## Validation

- Run `bun --no-env-file src/tools/report-validator.ts <reports> --profile provider-research --checksums <archive.zip>` and fix every diagnostic. It checks structure, links, IDs, inventory sums, tables, whitespace and portable paths; also confirm inventory rows against the runtime and that every queued or tabled item has an owning finding with a consistent status.
- Run `bun run check` and `bun t --price --no-cleanup` once per snapshot (price-only: mapped commands run with `--price`, without provider dispatch or the full suite). Record outcomes in the owning report and label price totals as hypothetical. Neither validates research claims or billed cost; `docs/reports/` is ignored, so repository checks never prove document acceptance.
- Fix failures under `AGENTS.md`, preserving intended behavior, and rerun the affected checks. Markdown-only edits need the document checks and the default pass.
- Never run paid provider calls, live benchmarks or full test suites for this research. Stay on `staging`, never create or switch branches, and leave staging and committing to the user.

## Refreshing, reformatting or consolidating existing reports

- Preserve finding IDs, titles and prior decisions; record superseded statuses as dated history in the owning finding.
- Before shortening, splitting or replacing a report, archive its original bytes in the adjacent evidence archive with updated checksums and source index, then confirm every recommendation, watchlist item, unresolved issue and decisive citation survived.
- A reformat keeps the research run's cutoff, snapshot and prompt SHA-256 and records the reformat in Evidence and validation; it never implies sources were rechecked. Do not change ADR status because a report was reorganized.
