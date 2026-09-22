# ADR-016: Govern Documentation Command Examples as Executable Contracts

## Status

- **Decision Status:** Proposed
- **Date Created:** 2026-08-13
- **Date Updated:** 2026-09-22
- **Verification Status:** Pending

## Context

Every command printed in project documentation is a product promise. Readers cannot tell maintained copy-and-paste examples from stale historical evidence, expected output, intentionally invalid examples, templates, or paid service invocations unless the repository classifies and governs them.

Restricting automated verification to the root `README.md` leaves the command references and the rest of `docs/` unverified. Those files hold most user-facing invocations. Ungoverned examples drift: they cite missing fixtures, invalid options, mutated configuration, unrouted providers, or live network and paid endpoints.

Why now: A repository-wide documentation audit found 1,424 shell-like candidates across 199 Markdown files, including 803 concrete AutoShow invocations. Scoping contracts to the README alone leaves the primary command-reference surface exposed to silent drift.

## Options Considered

**Option 1 (selected)**

- **Option:** Govern every command in the root `README.md` and all Markdown beneath `docs/` through one classified inventory and local verification policy
- **Pros:** Matches the user-facing surface, catches cross-document drift, makes unsafe examples explicit, and covers generated and historical material safely
- **Cons:** Requires a classified inventory, risk-specific policies, and committed offline fixtures
- **Quantitative Notes:** Covers 199 files, 1,424 candidates, and 803 concrete AutoShow occurrences

**Option 2**

- **Option:** Govern only the root `README.md`
- **Pros:** Smallest scope and fastest verification
- **Cons:** Leaves most user-facing invocations outside the contract
- **Quantitative Notes:** Covers only 59 of 803 concrete AutoShow occurrences

**Option 3**

- **Option:** Govern `README.md` plus primary command references, excluding ADRs, reports, diagrams, templates, and test guides
- **Pros:** Covers most usage docs with less initial classification work
- **Cons:** Permits stale or unsafe commands in operational, architectural, generated, and historical documents; leaves boundaries ambiguous
- **Quantitative Notes:** Omits 77 concrete AutoShow occurrences and 395 other shell-like candidates

**Option 4**

- **Option:** Parse and execute every shell-looking candidate indiscriminately
- **Pros:** Minimal policy design and broad runtime coverage
- **Cons:** Can install software, mutate config or Git state, build containers, contact paid APIs, and mistake expected output for executable commands
- **Quantitative Notes:** Threatens repository state with 621 non-AutoShow and 173 stateful or utility candidates

## Decision

Govern every shell-like command in the root `README.md` and every Markdown document under `docs/` as a documentation contract. Each example is classified and verified locally without mutating repository files or user configuration and without contacting paid services.

Priceable workflows run with `--price`, make no provider or network calls, and report a numeric estimated cost. Commands that mutate configuration, install software, build or run Docker, perform Git mutations, or invoke paid services are recognized and never executed. Staged examples use committed offline fixtures. `setup` and its `config` alias do not accept `--price`.

This applies to:

- The root `README.md` and all `*.md` files recursively under `docs/`.
- Documented AutoShow workflows, utilities, stateful commands, external tools, package managers, and Docker invocations.
- Historical quotations, generated report evidence, templates, placeholders, and deliberately invalid examples, which are verified without execution.

It does not apply to:

- `AGENTS.md` and internal agent instruction files, which are agent policy rather than user documentation.
- Markdown fixtures under `input/` or test directories, which are pipeline test inputs.
- Live execution of paid AI providers, third-party network endpoints, or destructive local commands.

## Rationale

- Command references hold most user-facing invocations, so README-only contracts miss the primary surface.
- Classifying examples and executing only the safe subset covers the documentation without running paid, stateful, or destructive commands.
- Isolated `--price` runs show that a documented workflow has a known cost and makes no network or provider calls.
- Committed offline fixtures let staged workflows validate from a clean checkout.

## Consequences

Positive outcomes:

- Documented commands stay aligned with the CLI's options and model catalog.
- Paid, destructive, and stateful examples cannot run by accident.
- Missing fixtures, broken routes, deprecated flags, and malformed syntax fail local checks.
- Documentation cost estimates can be aggregated without spend.

Negative outcomes:

- Adding or moving a documented example requires an inventory update.
- Generated reports need an inventory update when their commands change.
- Offline fixtures for staged workflows enlarge the fixture set kept in the repository.

## Trade-offs

**Trade-off 1**

- **Gain:** Full documentation coverage and cross-document drift detection
- **Sacrifice:** A classified inventory of every documented command

**Trade-off 2**

- **Gain:** Safe verification of paid, stateful, and destructive examples
- **Sacrifice:** Multiple execution policies instead of one universal runner

**Trade-off 3**

- **Gain:** Deterministic, zero-cost offline price verification
- **Sacrifice:** Committed offline fixtures for multi-stage workflows

**Trade-off 4**

- **Gain:** Auditable documentation cost estimates
- **Sacrifice:** Estimates must be refreshed when CLI pricing or models change

## Follow-up Actions

- [ ] Isolate documentation verification so it cannot call providers, use the network, or write to repository or user configuration — Pending
- [ ] Inventory every documented command and fail when documentation and the inventory disagree — Pending
- [ ] Make `--price` results consistent across commands so priceable examples verify the same way — Pending
- [ ] Commit offline fixtures for document, transcript, batch, image, video, comic, and voice examples — Pending
- [ ] Classify utilities, Docker, Git, external tools, and credential commands as parse-only or never-execute — Pending
- [ ] Cross-check documented flags and models against the CLI and the model catalog — In progress
- [ ] Publish documentation cost reports that map each example to its estimated cost — Pending

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
- Related ADR: [ADR-020](ADR-020-end-the-write-pipeline-at-step-3.md)
- [`README.md`](../../README.md)
- [`docs/commands/`](../commands/)
