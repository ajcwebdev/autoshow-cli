# ADR-016: Govern Documentation Command Examples as Executable Contracts

## Status

- **Decision Status:** Proposed
- **Date Created:** 2026-08-13
- **Date Updated:** 2026-08-15
- **Verification Status:** Pending

## Context

Every command printed in project documentation is a product promise. This includes the root `README.md`, detailed command references (`docs/commands/**`), setup guides, operator manuals, Docker instructions, release notes, architecture documents, and report templates. Readers cannot reliably distinguish maintained copy-and-paste examples from stale historical evidence, expected output, intentionally invalid examples, templates, or paid service invocations unless the repository explicitly classifies and governs them.

Restricting automated verification to the root `README.md` leaves over 90% of concrete CLI examples unverified. The extensive command references contain the vast majority of user-facing invocations, spanning diverse combinations of providers, models, inputs, and flags. Without comprehensive governance, documentation quickly drifts: commands reference non-existent local fixtures, invalid options, mutated configuration state, unrouted providers, or unshielded network/paid endpoints.

To maintain documentation integrity safely, every shell-like command occurrence across `README.md` and `docs/` must be inventoried and classified under an explicit execution and safety policy. Non-executable, historical, paid, and stateful commands must be protected with appropriate parse-only, stubbed, or never-execute rules, while priceable workflows must execute deterministically offline at zero cost.

Why now: A repository-wide documentation audit identified 1,455 shell-like candidates across 164 Markdown files, with 785 concrete AutoShow invocations. Scoping contracts to the README alone leaves the primary command-reference surface and operational documentation exposed to silent drift and execution errors.

## Options Considered

**Option 1 (selected)**

- **Option:** Govern every command occurrence in the root `README.md` and all Markdown beneath `docs/` through one classified inventory and policy-aware harness
- **Pros:** Matches the literal user-facing surface, catches cross-document drift, makes unsafe examples explicit, supports deduplicated execution with occurrence-based reporting, and covers generated/historical material safely
- **Cons:** Requires a Markdown-aware extractor, a typed inventory, risk-specific policies, stable offline fixtures, and generator integration
- **Quantitative Notes:** Covers 164 files, 1,455 candidates, and 785 concrete AutoShow occurrences

**Option 2**

- **Option:** Govern only the root `README.md`
- **Pros:** Smallest implementation and fastest test execution
- **Cons:** Leaves 732 concrete AutoShow occurrences outside the contract and misses the majority of user-facing failures and option drift
- **Quantitative Notes:** Covers only 53 of 785 concrete AutoShow occurrences

**Option 3**

- **Option:** Govern `README.md` plus primary command references, excluding ADRs, reports, diagrams, templates, and test guides
- **Pros:** Covers most usage docs with less initial classification work
- **Cons:** Permits stale or unsafe commands in operational, architectural, generated, and historical documents; leaves boundaries ambiguous
- **Quantitative Notes:** Omits 110 concrete AutoShow occurrences and 679 other shell-like candidates

**Option 4**

- **Option:** Parse and execute every shell-looking candidate indiscriminately
- **Pros:** Minimal policy design and superficially broad runtime coverage
- **Cons:** Can install unwanted software, mutate config or Git state, build containers, contact paid APIs, and mistake expected output for executable commands
- **Quantitative Notes:** Threatens repository state with 674 non-AutoShow and 259 stateful/utility candidates

**Option 5**

- **Option:** Rely on manual documentation review and ad-hoc price audits
- **Pros:** No committed inventory or test infrastructure
- **Cons:** Drift recurrences are frequent, verification is non-reproducible, and aggregate cost accuracy cannot be guaranteed
- **Quantitative Notes:** High ongoing maintenance burden with zero automated regression protection

## Decision

Govern every shell-like command occurrence in the root `README.md` and every Markdown document recursively beneath `docs/` through a single typed inventory and a targeted, local-only documentation contract test suite.

The extraction engine must be Markdown-aware, extracting fenced code blocks (`bash`, `sh`, `shell`, `zsh`, `console`), console prompts, line continuations, indented blocks, and command-like inline spans while recording document family, file path, section header, source kind, and occurrence ordinal. Every extracted candidate must map to exactly one typed inventory entry, and every inventory entry must resolve to a valid candidate in the active documentation corpus.

### Occurrence Classification and Execution Policy

Each inventory entry must declare an explicit primary classification and execution policy:

1. **Primary Classifications:** `priceable`, `local-runnable`, `utility`, `stateful`, `paid-execution`, `staged`, `template`, `invalid-example`, `historical`, `generated-evidence`, `expected-output`, or `external-tool`.
2. **Execution Policies:** `price`, `local-execute`, `parse-only`, `help-only`, `stubbed`, `generated-source`, or `never-execute`.

### Safety and Isolation Guardrails

- **Zero-Cost and Zero-Network:** Priceable workflows must execute with `--price`, make zero provider calls (`providerCalls: 0`), make zero network calls (`networkCalls: 0`), and produce structured envelopes with numeric `totalEstimatedCostCents` (including explicit zero for free workflows).
- **Process-Wide Isolation:** Contract test runs must use isolated temporary configuration, input overlays, cache, runtime, and output directories. Real repository files and user configuration must remain unmodified.
- **Fail-Closed Provider Guard:** A process-wide guard beneath command routing must block and fail any outbound provider request during documentation contract execution.
- **Stateful Command Protection:** Commands that mutate configuration (`config`), install software, build/run Docker containers, perform Git mutations, or invoke paid services default to `parse-only` or `never-execute`.
- **Committed Offline Fixtures:** Staged media, comic, voice, document, OCR, and batch examples must rely on committed offline fixtures rather than live URLs or prerequisites created by prior paid runs.

### Deduplication and Reporting

Identical command strings sharing the same policy, fixtures, and route may share a single execution run. However, coverage, failure reporting, and cost aggregation must remain occurrence-based, mapping results back to every file and section where the command appears.

This applies to:

- The root `README.md` and all `*.md` files recursively under `docs/`.
- Fenced code blocks with shell language tags, console-prompted lines, continued commands, indented code blocks, and command-looking inline code spans.
- Standard AutoShow workflows, utilities, stateful commands, external tools, package managers, and Docker invocations present in documentation.
- Classifying historical quotations, generated report evidence, templates, placeholders, and deliberately invalid examples so they are verified statically without execution.

It does not apply to:

- `AGENTS.md` and internal agent instruction files (governed as agent policy, not user documentation).
- Markdown fixtures under `input/` or test directories (governed as pipeline test inputs).
- Live execution of paid AI providers, third-party network endpoints, or destructive local commands.

## Rationale

- Detailed command references contain the overwhelming majority of user-facing commands and documented configuration variations.
- Exhaustive inventory and selective execution decouple complete coverage from runtime risk: every command is tracked, but only safe, deterministic commands execute.
- Contextual occurrence identity ensures identical command strings are evaluated according to their specific document purpose (e.g. current guidance vs. historical quotation vs. expected output).
- Structured envelopes and process-wide test guards provide verifiable proof of zero provider spend, zero network traffic, and zero filesystem contamination.
- Committed offline fixtures allow complex staged workflows (e.g. comic, voice, image/video editing) to be validated in clean checkouts without paid generation prerequisites.
- Occurrence-based aggregation accurately reflects the cumulative cost and promise of following all documented workflows.

## Consequences

Positive outcomes:

- Every documented command is continuously verified against the CLI parser, options registry, and model catalog.
- Silent drift between documentation, CLI flags, and provider capabilities is eliminated.
- Paid, destructive, and stateful examples are safely governed without risk of unexpected execution, costs, or data mutation.
- Discrepancies such as missing fixtures, broken routes, deprecated flags, and malformed command syntax fail fast in local CI.
- Documentation metrics—including total estimated workflow costs, free utility counts, and template ratios—are deterministically aggregatable.

Negative outcomes:

- Maintaining a comprehensive typed inventory adds overhead when adding, moving, or refactoring documentation examples.
- Updating generated reports or benchmark docs requires updating generator metadata or inventory snapshots.
- Managing committed offline fixtures for document, media, voice, and comic pipelines increases repository test fixture surface.

## Trade-offs

**Trade-off 1**

- **Gain:** Full documentation coverage across all Markdown files
- **Sacrifice:** Larger typed inventory and Markdown-aware AST extraction

**Trade-off 2**

- **Gain:** Safe verification of paid, stateful, and destructive examples
- **Sacrifice:** Multiple discrete execution policies instead of a single universal runner

**Trade-off 3**

- **Gain:** Deterministic, zero-cost offline price verification
- **Sacrifice:** Maintenance of committed offline fixtures for multi-stage workflows

**Trade-off 4**

- **Gain:** Granular cross-document drift detection
- **Sacrifice:** Occurrence-based inventory maintenance for duplicated command strings

**Trade-off 5**

- **Gain:** Transparent, auditable documentation cost estimates
- **Sacrifice:** Formal snapshot updates required when CLI pricing or models change

## Test Plan

Verification of this ADR and its contracts must remain strictly local and zero-cost:

```bash
bun run check
bun t --price
bun test test/test-cases/validation/cli/doc-command-flags-contract.test.ts
```

When the dedicated documentation harness is implemented:
1. Run `bun test test/test-cases/validation/cli/documentation-command-examples.test.ts` to assert bidirectional exhaustiveness between extracted Markdown commands and typed inventory entries.
2. Verify that all priceable occurrences return structured envelopes with `providerCalls: 0`, `networkCalls: 0`, and valid numeric `totalEstimatedCostCents`.
3. Assert that stateful, external, Docker, and paid commands execute under `parse-only` or `never-execute` policies.
4. Verify that real repository configuration, git working tree, and user directories remain completely unmodified after test execution.

## Follow-up Actions

- [ ] Implement fail-closed provider/network guards and isolated temporary filesystem/config harnesses for documentation tests — Pending
- [ ] Add validation rejecting `config --price` mutations before state access — Pending
- [ ] Build the Markdown-aware extractor, typed occurrence inventory, and bidirectional coverage test suite — Pending
- [ ] Standardize structured price result envelopes across all AutoShow commands — Pending
- [ ] Commit offline fixtures for document, transcript, batch, image, video, comic, and voice workflows — Pending
- [ ] Fix quiet-price output, end-of-options (`--`) parsing, hosted EPUB planning, and article route resolution — Pending
- [ ] Define static risk and parse-only validation policies for utilities, Docker, Git, external tools, and credentials — Pending
- [ ] Implement cross-checks validating documented flags and models against CLI parsers and model registries — Pending
- [ ] Generate occurrence-based and deduplicated documentation cost reports — Pending

## References

- [`README.md`](../../README.md)
- [`docs/commands.md`](../commands.md)
- [`docs/commands/`](../commands/)
- [`docs/commands/testing.md`](../commands/testing.md)
- [`docs/docker.md`](../docker.md)
- [`docs/diagrams/`](../diagrams/)
- [`docs/reports/`](../reports/)
- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)
- Related ADR: [ADR-006](ADR-006-unify-error-handling-vocabulary.md)
- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Related ADR: [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md)
- Related ADR: [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md)
- Related ADR: [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)
- `test/test-cases/validation/cli/doc-command-flags-contract.test.ts`
