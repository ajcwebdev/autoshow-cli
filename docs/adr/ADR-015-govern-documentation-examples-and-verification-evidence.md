# ADR-015: Govern Documentation Examples and Verification Evidence

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-13
- **Date Updated:** 2026-09-23
- **Verification Status:** Passed
- **Supersession:** Absorbs the evidence lifecycle and paid-approval authority of "Govern Benchmark Evidence and Generated-Report Architecture". That record's combined-report architecture is documented in [docs/benchmarks/README.md](../benchmarks/README.md), and its calibration and billing-authority rules live in [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md). The September 23 revision replaces the documentation snapshot and cost-report workflow with direct tests of maintained CLI examples.

## Context

The root `README.md` and command guides hold maintained CLI examples that can drift toward invalid commands, flags, and model selectors. Historical evidence, templates, and shell expressions need a different treatment from concrete current invocations. Verifying documentation must not execute paid or stateful examples.

Hosted-model refreshes need an evidence lifecycle distinct from model policy. Primary documentation establishes identity, capabilities, pricing, and limits; local contracts establish behavior without credentials; `--price` establishes a no-provider plan; a live calibration then needs immediate command-specific approval and is trustworthy only after its identity, completeness, usage, and artifact checks pass.

The initial repository-wide inventory mixed current guides with historical evidence and duplicated commands into generated reports. Snapshotting source locations also made prose movement require regeneration. The September 23 tooling cleanup retires that reporting workflow while retaining direct checks of the maintained command surface.

## Options Considered

### Documentation scope

**Option 1 (retired)**

- **Option:** Govern every command in the root `README.md` and all Markdown beneath `docs/` through one classified inventory and local verification policy
- **Pros:** Matches the user-facing surface, catches cross-document drift, and makes unsafe examples explicit
- **Cons:** Requires a classified inventory, risk-specific policies, and committed offline fixtures
- **Quantitative Notes:** Covers every concrete AutoShow occurrence

**Option 2**

- **Option:** Govern only the root `README.md`
- **Pros:** Smallest scope
- **Cons:** Leaves most user-facing invocations outside the contract
- **Quantitative Notes:** Covers under a tenth of the concrete occurrences

**Option 3 (selected)**

- **Option:** Parse concrete CLI examples in `README.md` and `docs/commands/`, including the testing guide, without snapshotting or executing them
- **Pros:** Validates maintained command syntax and model selectors directly; moving prose requires no inventory refresh
- **Cons:** Does not validate input-file existence, execution behavior, or historical examples outside those guides
- **Quantitative Notes:** n/a

**Option 4**

- **Option:** Parse and execute every shell-looking candidate
- **Pros:** No policy design
- **Cons:** Rejected; can install software, mutate config or Git state, build containers, and contact paid APIs
- **Quantitative Notes:** n/a

### Evidence governance

**Option 1 (selected)**

- **Option:** One evidence authority with command-specific paid approval
- **Pros:** Source evidence, local proof, price preflight, paid execution, validation, and compaction form one auditable lifecycle
- **Cons:** Modality refreshes link here instead of embedding their own process
- **Quantitative Notes:** Covers every hosted modality and the committed combined reports

**Option 2**

- **Option:** Keep benchmark evidence inside each refresh record
- **Pros:** Chronology stays beside model changes
- **Cons:** Repeats the approval and regeneration gates in every refresh
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Treat a successful provider response as sufficient evidence
- **Pros:** Least validation work
- **Cons:** Rejected; the 2026 STT and music runs retained collisions and incomplete artifacts after reported success
- **Quantitative Notes:** n/a

**Option 4**

- **Option:** Skip live evidence entirely
- **Pros:** No cost or quota risk
- **Cons:** Leaves compatibility, timing, usage, and artifact claims unverified
- **Quantitative Notes:** Appropriate when local contracts suffice, not as a rule

## Decision

Check concrete `bun autoshow` and `bun as` examples in the root `README.md` and `docs/commands/` against the CLI parser and model registry. `bun run check:docs` runs the local documentation example test as part of `bun run check`. It reads shell/text fences and inline commands, joins shell continuations, and excludes templates and shell expressions. It never invokes the command handlers, reads example inputs, or contacts providers.

The snapshot inventory, dedicated documentation fixtures, sandbox price runner, and six documentation cost reports are retired. Price behavior remains covered by the existing price preflight and local price contracts. Syntax validation does not establish that example inputs exist or that commands will succeed when executed. Govern live provider evidence through the existing lifecycle of no-cost preparation, paid approval, artifact validation, and post-validation compaction.

This applies to:

- Concrete CLI examples in the root `README.md` and Markdown files recursively under `docs/commands/`.
- The benchmark evidence lifecycle, paid-approval requirements, artifact validation, and compaction across every hosted modality, and the regeneration of committed reports under `docs/benchmarks/`.

It does not apply to:

- `AGENTS.md`, internal agent instruction files, ADRs, reports, diagrams, and Markdown fixtures under `input/` or test directories.
- Templates, shell expressions, arbitrary external-tool commands, and execution of documentation examples.
- Live execution of paid AI providers, third-party network endpoints, or destructive local commands.
- Registry, lifecycle, pricing-provenance, and calibration-promotion policy ([ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)).
- The combined-report artifact format and ranking contract ([docs/benchmarks/README.md](../benchmarks/README.md)).
- Single-run manifests and price planning ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).

### Benchmark evidence lifecycle and paid approval

Every provider or model refresh follows this order:

1. Refresh dated primary-source documentation with `links --refresh` ([ADR-011](ADR-011-links-selection-grammar-and-refresh-metadata.md)). Do not infer a current model from a moving alias or secondary catalog when primary documentation is available.
2. Update the registry contract ([ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)) and the command overviews under `docs/commands/`, and prove them with static checks and targeted no-network tests.
3. Run the exact no-cost `--price` or `resume --price` command for the intended targets; price mode invokes no provider and mutates no manifest or artifact ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).
4. If live evidence is materially necessary, obtain immediate explicit approval naming the exact provider command and its cost or quota risk. Approval for implementation, another provider, an earlier phase, a failed attempt, or a preflight never authorizes the paid command, and a correction or rerun requires fresh approval.
5. Validate returned identity, provider and model state, source coverage, page or duration counts, attempt and retry data, usage and actual cost, output integrity, and artifact uniqueness. A provider-reported success is not trustworthy when checkpoints, paths, checksums, or normalized outputs prove collision or reuse.
6. Compact only after trustworthy results exist: preserve canonical result envelopes and historical identity, remove regenerable checkpoints, splits, and derived files, then regenerate the combined reports and the dashboard from the compacted artifacts.

Published billing outranks an estimate and recorded cost outranks a reconstructed rate, as [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) records.

## Rationale

The [documentation example test](../../test/test-cases/validation/cli/documentation-examples.test.ts) validates the current documents directly and includes deliberately invalid commands, flags, and model selectors to verify that stale references fail. It uses the CLI parser without dispatch, so even a parsed paid or stateful command cannot execute. The test runs on every supported host without a platform-specific sandbox or generated report artifacts.

- Command references hold most user-facing invocations, so README-only contracts miss the primary surface.
- Parsing examples without dispatch verifies the maintained syntax without running paid, stateful, or destructive commands.
- Existing local behavioral tests and price preflight own execution verification; documentation does not need a second fixture and report system.
- One evidence authority keeps paid approval, validation, and compaction from being restated in every refresh, and a provider's own success report has already proven insufficient.

## Consequences

Positive outcomes:

- Concrete maintained examples stay aligned with the CLI's command names, registered flags, and explicit provider/model selectors.
- Documentation validation has no execution path, generated inventory, or report-refresh requirement.
- Paid live runs stay gated by command-specific approval.

Negative outcomes:

- Historical documents and shell/template examples are outside the automated syntax check.
- Input existence, price semantics, and full execution correctness require the existing behavioral tests and preflight.
- Every live calibration needs a fresh, exact approval, so evidence collection is slower than an ad-hoc run.

## Trade-offs

**Trade-off 1**

- **Gain:** Direct validation of maintained examples without snapshot churn
- **Sacrifice:** Automated inventory of every historical or shell-like command

**Trade-off 2**

- **Gain:** No execution of paid, stateful, or destructive examples
- **Sacrifice:** Parsing alone cannot establish successful execution

**Trade-off 3**

- **Gain:** One existing price verification system
- **Sacrifice:** No separate cost report for documentation occurrences

**Trade-off 4**

- **Gain:** Paid evidence that is validated, attributable, and regenerable from compacted artifacts
- **Sacrifice:** Command-specific approval before every paid run and validation work after every provider response

## Follow-up Actions

- [x] Replace documentation inventory/report tooling with a parse-only example test under `test/`.
- [x] Keep `check:docs` in the default repository check and validate current command references against registered flags and explicit provider/model selectors.
- [x] Cover multiline examples, aliases, shell/template exclusions, and deliberately invalid commands in local tests.
- [x] Retire documentation cost generation and orphan fixtures; retain price preflight and behavioral price contracts.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md)
- Related ADR: [ADR-005](ADR-005-cli-error-result-and-retry-contract.md)
- Related ADR: [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md)
- Related ADR: [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md)
- Related ADR: [ADR-009](ADR-009-stt-timing-captions-and-alignment.md)
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Related ADR: [ADR-011](ADR-011-links-selection-grammar-and-refresh-metadata.md)
- Related ADR: [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md)
- Related ADR: [ADR-013](ADR-013-comic-scene-audio-and-presentation.md)
- Related ADR: [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)
- [`README.md`](../../README.md)
- [`docs/commands/`](../commands/)
- [`docs/benchmarks/README.md`](../benchmarks/README.md)
