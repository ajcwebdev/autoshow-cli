# ADR-016: Govern Documentation Command Examples as Executable Contracts

## Status

- **Decision Status:** Proposed
- **Date Created:** 2026-08-13
- **Date Updated:** 2026-08-21
- **Verification Status:** Pending

## Context

Every command printed in project documentation is a product promise. Readers cannot tell maintained copy-and-paste examples from stale historical evidence, expected output, intentionally invalid examples, templates, or paid service invocations unless the repository classifies and governs them.

Restricting automated verification to the root `README.md` leaves the command references and the rest of `docs/` unverified. Those files hold most user-facing invocations, including combinations of providers, models, inputs, and flags. Ungoverned examples drift: they cite missing fixtures, invalid options, mutated configuration, unrouted providers, or live network and paid endpoints.

Safe documentation integrity requires an inventory of every shell-like command in `README.md` and `docs/`, with parse-only, stubbed, or never-execute rules for non-executable, historical, paid, and stateful examples, and deterministic offline `--price` runs for priceable workflows.

Why now: A repository-wide documentation audit found 1,424 shell-like candidates across 199 Markdown files, including 803 concrete AutoShow invocations. Scoping contracts to the README alone leaves the primary command-reference surface exposed to silent drift.

## Options Considered

**Option 1 (selected)**

- **Option:** Govern every command occurrence in the root `README.md` and all Markdown beneath `docs/` through one classified inventory and policy-aware harness
- **Pros:** Matches the user-facing surface, catches cross-document drift, makes unsafe examples explicit, supports deduplicated execution with occurrence-based reporting, and covers generated and historical material safely
- **Cons:** Requires a Markdown-aware extractor, a typed inventory, risk-specific policies, and committed offline fixtures
- **Quantitative Notes:** Covers 199 files, 1,424 candidates, and 803 concrete AutoShow occurrences

**Option 2**

- **Option:** Govern only the root `README.md`
- **Pros:** Smallest implementation and fastest test execution
- **Cons:** Leaves most user-facing invocations outside the contract
- **Quantitative Notes:** Covers only 59 of 803 concrete AutoShow occurrences

**Option 3**

- **Option:** Govern `README.md` plus primary command references, excluding ADRs, reports, diagrams, templates, and test guides
- **Pros:** Covers most usage docs with less initial classification work
- **Cons:** Permits stale or unsafe commands in operational, architectural, generated, and historical documents; leaves boundaries ambiguous
- **Quantitative Notes:** Omits 77 concrete AutoShow occurrences and 395 other shell-like candidates

**Option 4**

- **Option:** Parse and execute every shell-looking candidate indiscriminately
- **Pros:** Minimal policy design and superficially broad runtime coverage
- **Cons:** Can install software, mutate config or Git state, build containers, contact paid APIs, and mistake expected output for executable commands
- **Quantitative Notes:** Threatens repository state with 621 non-AutoShow and 173 stateful/utility candidates

**Option 5**

- **Option:** Rely on manual documentation review and ad-hoc price audits
- **Pros:** No committed inventory or test infrastructure
- **Cons:** Drift recurrences are frequent, verification is non-reproducible, and aggregate cost accuracy cannot be guaranteed
- **Quantitative Notes:** High ongoing maintenance burden with zero automated regression protection

## Decision

Govern every shell-like command occurrence in the root `README.md` and every Markdown document recursively beneath `docs/` through a single typed inventory and a local-only documentation contract test suite.

Every extracted candidate maps to exactly one inventory entry, and every inventory entry resolves to a valid candidate in the active documentation corpus. Each entry declares one primary classification (`priceable`, `local-runnable`, `utility`, `stateful`, `paid-execution`, `staged`, `template`, `invalid-example`, `historical`, `generated-evidence`, `expected-output`, or `external-tool`) and one execution policy (`price`, `local-execute`, `parse-only`, `help-only`, `stubbed`, `generated-source`, or `never-execute`).

Priceable workflows run with `--price`, make no provider or network calls, and report a numeric estimated cost, including explicit zero for free workflows. Contract tests use isolated configuration, cache, and output directories so repository files and user configuration stay unmodified. A process-wide guard fails any outbound provider request during those runs. Commands that mutate configuration, install software, build or run Docker, perform Git mutations, or invoke paid services default to `parse-only` or `never-execute`. Staged media, comic, voice, document, OCR, and batch examples use committed offline fixtures rather than live URLs or artifacts from prior paid runs.

Identical command strings that share policy, fixtures, and route may share one execution run. Coverage, failure reporting, and cost aggregation stay occurrence-based, mapping results to every file and section where the command appears.

This applies to:

- The root `README.md` and all `*.md` files recursively under `docs/`.
- Fenced shell blocks, console-prompted lines, continued commands, indented code blocks, and command-looking inline code spans.
- Standard AutoShow workflows, utilities, stateful commands, external tools, package managers, and Docker invocations in documentation.
- Historical quotations, generated report evidence, templates, placeholders, and deliberately invalid examples, which are verified statically without execution.

It does not apply to:

- `AGENTS.md` and internal agent instruction files (governed as agent policy, not user documentation).
- Markdown fixtures under `input/` or test directories (governed as pipeline test inputs).
- Live execution of paid AI providers, third-party network endpoints, or destructive local commands.

## Rationale

- Command references hold most user-facing invocations and configuration variants, so README-only contracts miss the primary surface.
- Exhaustive inventory plus selective execution gives complete coverage without running unsafe examples.
- Occurrence identity evaluates the same command string by document purpose: current guidance, historical quotation, or expected output.
- Isolated `--price` runs and a fail-closed provider guard prove zero spend and zero network traffic.
- Committed offline fixtures let staged workflows validate in a clean checkout.

## Consequences

Positive outcomes:

- Documented commands stay verified against the CLI parser, options registry, and model catalog.
- Paid, destructive, and stateful examples are governed without unexpected execution, cost, or data mutation.
- Missing fixtures, broken routes, deprecated flags, and malformed syntax fail in local CI.
- Documentation cost estimates, free-utility counts, and template ratios can be aggregated deterministically.

Negative outcomes:

- Adding, moving, or refactoring documentation examples requires inventory updates.
- Generated reports and benchmark docs need generator metadata or inventory snapshots when they change.
- Offline fixtures for document, media, voice, and comic pipelines enlarge the test-fixture surface.

## Trade-offs

**Trade-off 1**

- **Gain:** Full documentation coverage across all Markdown files
- **Sacrifice:** A typed inventory and Markdown-aware extraction

**Trade-off 2**

- **Gain:** Safe verification of paid, stateful, and destructive examples
- **Sacrifice:** Multiple execution policies instead of one universal runner

**Trade-off 3**

- **Gain:** Deterministic, zero-cost offline price verification
- **Sacrifice:** Committed offline fixtures for multi-stage workflows

**Trade-off 4**

- **Gain:** Cross-document drift detection
- **Sacrifice:** Occurrence-based inventory for duplicated command strings

**Trade-off 5**

- **Gain:** Auditable documentation cost estimates
- **Sacrifice:** Snapshot updates when CLI pricing or models change

## Implementation Note

`config` does not accept `--price`. `autoshow config --price` fails as an unexpected-flag usage error before any state access (`src/cli/flags/config-flags.ts`).

## Test Plan

Verification of this ADR remains local and zero-cost:

```bash
bun run check
bun t --price
bun test test/test-cases/validation/cli/doc-command-flags-contract.test.ts
```

1. Typecheck and unique source check pass.
2. The default price suite estimates without provider calls.
3. Command-reference flag tables stay aligned with CLI parsers.

## Follow-up Actions

- [ ] Implement fail-closed provider/network guards and isolated documentation-test harnesses — Pending
- [ ] Build the Markdown-aware extractor, typed occurrence inventory, and bidirectional coverage tests — Pending
- [ ] Standardize structured `--price` result envelopes across AutoShow commands — Pending
- [ ] Commit offline fixtures for document, transcript, batch, image, video, comic, and voice workflows — Pending
- [ ] Define static risk and parse-only policies for utilities, Docker, Git, external tools, and credentials — Pending
- [ ] Cross-check documented flags and models against CLI parsers and model registries — Pending
- [ ] Generate occurrence-based and deduplicated documentation cost reports — Pending

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)
- Related ADR: [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md)
- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Related ADR: [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md)
- Related ADR: [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md)
- Related ADR: [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)
- [`README.md`](../../README.md)
- [`docs/commands/`](../commands/)
- `src/cli/flags/config-flags.ts`
- `test/test-cases/validation/cli/doc-command-flags-contract.test.ts`
