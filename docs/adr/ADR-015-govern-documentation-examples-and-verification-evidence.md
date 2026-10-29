# ADR-015: Govern Documentation Examples and Verification Evidence

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-13
- **Date Updated:** 2026-10-28
- **Verification Status:** Passed
- **Supersession:** Absorbs the evidence lifecycle and spending-authorization policy of "Govern Benchmark Evidence and Generated-Report Architecture". Its combined-report architecture lives in [docs/benchmarks/README.md](../benchmarks/README.md), and its calibration and billing-authority rules live in [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md).

## Context

The root `README.md` and command guides hold maintained CLI examples that can drift toward invalid commands, flags, and model selectors. Historical evidence, templates, and shell expressions need a different treatment from concrete current invocations. Verifying documentation must not execute paid or stateful examples.

Hosted-model refreshes need an evidence lifecycle distinct from model policy. Primary documentation establishes identity, capabilities, pricing, and limits; local contracts establish behavior without credentials; `--price` establishes a no-provider plan. Live calibration must follow the spending rules in `AGENTS.md`, and is trustworthy only after its identity, completeness, usage, and artifact checks pass.

Why now: The documentation inventory mixed maintained examples with historical evidence and required regeneration after prose moved; direct syntax checks keep current guides verifiable without that overhead.

## Options Considered

### Documentation scope

**Option 1 (selected)**

- **Option:** Parse concrete CLI examples in `README.md` and `docs/commands/` without snapshotting or executing them
- **Pros:** Validates maintained command syntax and model selectors directly; moving prose requires no inventory refresh
- **Cons:** Does not validate input-file existence, execution behavior, or historical examples outside those guides
- **Quantitative Notes:** n/a

**Option 2**

- **Option:** Govern only the root `README.md`
- **Pros:** Smallest scope
- **Cons:** Leaves most user-facing invocations outside the contract
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Maintain a classified inventory of current and historical documentation commands
- **Pros:** Covers examples outside maintained user guides
- **Cons:** Duplicates commands and requires inventory regeneration when prose moves
- **Quantitative Notes:** n/a

**Option 4**

- **Option:** Parse and execute every shell-looking candidate
- **Pros:** No policy design
- **Cons:** Rejected; can install software, mutate config or Git state, build containers, and contact paid APIs
- **Quantitative Notes:** n/a

### Evidence governance

**Option 1 (selected)**

- **Option:** One evidence lifecycle governed by the repository's spending rules
- **Pros:** Source evidence, local proof, price preflight, authorized execution, validation, and preservation form one auditable lifecycle
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
- **Cons:** Rejected; transport success does not establish complete, unique, correct output artifacts
- **Quantitative Notes:** n/a

## Decision

Validate concrete `bun autoshow` and `bun as` examples in the root `README.md` and `docs/commands/` without executing them. Govern live provider evidence through no-cost preparation, spending authorization, artifact validation, and preservation of reusable results.

`bun run check:docs`, included in `bun run check`, checks registered commands, flags, and explicit `--provider provider=model` selectors. It reads shell/text fences and inline commands, joins shell continuations, and excludes templates and shell expressions. Syntax validation does not establish that example inputs exist or that commands will succeed when executed; local behavioral tests and price preflight cover execution contracts.

This applies to:

- Concrete CLI examples in the root `README.md` and Markdown files recursively under `docs/commands/`.
- The benchmark evidence lifecycle, spending authorization, artifact validation, and compaction across hosted modalities, and regeneration of reports under `docs/benchmarks/`.

It does not apply to:

- `AGENTS.md`, internal agent instruction files, ADRs, reports, diagrams, and Markdown fixtures under `input/` or test directories.
- Templates, shell expressions, arbitrary external-tool commands, and execution of documentation examples.
- CLI execution behavior beyond documentation parsing.
- Registry, lifecycle, pricing-provenance, and calibration-promotion policy ([ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)).
- The combined-report artifact format and ranking contract ([docs/benchmarks/README.md](../benchmarks/README.md)).
- Single-run manifests and price planning ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).

### Benchmark evidence lifecycle and spending authorization

Every provider or model refresh follows this order:

1. Refresh dated primary-source documentation with `links --refresh` ([ADR-011](ADR-011-links-selection-grammar-and-refresh-metadata.md)). Do not infer a current model from a moving alias or secondary catalog when primary documentation is available.
2. Update the registry contract ([ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)) and the command overviews under `docs/commands/`, and prove them with static checks and targeted no-network tests.
3. Run the exact no-cost `--price` or `resume --price` command for the intended targets; price mode invokes no provider and mutates no manifest or artifact ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).
4. If live evidence is materially necessary, estimate the complete related batch, including minimum billing, add-ons, and billable retries. A total below $1.00 USD is automatically authorized for the requested task. An unknown estimate or total of $1.00 USD or more requires explicit approval naming the exact command or combination and expected cost/risk. Keep spending cumulative across related commands and reruns; do not split work to reset the threshold.
5. Validate returned identity, provider and model state, source coverage, page or duration counts, attempt and retry data, usage and actual cost, output integrity, and artifact uniqueness. A provider-reported success is not trustworthy when checkpoints, paths, checksums, or normalized outputs prove collision or reuse.
6. Compact only after trustworthy results exist, preserving canonical result envelopes, historical identity, receipts, and reusable purchased outputs. Remove only safely regenerable artifacts, then regenerate the combined reports and dashboard. Preserve interrupted or failed TTS output and temporary working directories so cached paid audio can be reused.

Published billing outranks an estimate and recorded cost outranks a reconstructed rate, as [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) records.

## Rationale

- Command references hold most user-facing invocations, so README-only contracts miss the primary surface.
- Parsing examples without dispatch verifies the maintained syntax without running paid, stateful, or destructive commands.
- Existing local behavioral tests and price preflight own execution verification; documentation does not need a second fixture and report system.
- One evidence lifecycle keeps spending authorization, validation, and preservation consistent across refreshes; a provider response alone does not establish artifact validity or quality.

## Consequences

Positive outcomes:

- Concrete maintained examples stay aligned with the CLI's command names, registered flags, and explicit provider/model selectors.
- Documentation validation has no execution path, generated inventory, or report-refresh requirement.
- Paid live runs follow cumulative spending authorization, with explicit approval when the estimate is unknown or reaches $1.00 USD.

Negative outcomes:

- Historical documents and shell/template examples are outside the automated syntax check.
- Input existence, price semantics, and full execution correctness require the existing behavioral tests and preflight.
- Evidence collection requires cost estimation and artifact validation beyond receiving a successful provider response.

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
- **Sacrifice:** Batch cost estimation, explicit approval when required, and validation after provider responses

## Implementation Note

The [documentation example test](../../test/test-cases/validation/cli/documentation-examples.test.ts) checks maintained examples without dispatch and covers continuations, aliases, shell/template exclusions, invalid commands and flags, and stale or mismatched provider/model selectors. `package.json` includes it in the default check. The former snapshot inventory and documentation cost-report workflow are retired.

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
