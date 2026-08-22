# ADR-010: Govern Hosted-Model Registry, Lifecycle, and Capability Policy

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-13
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed
- **Supersession:** Replaces per-modality registry and reasoning configurations. Owns the durable registry, lifecycle, capability, and reasoning policy shared by the write, OCR, STT, TTS, music, image, and video registries. Dated provider/model refresh history belongs to the 2026 hosted-model refresh reports under `docs/models/`; paid-approval gates, calibration evidence, and generated-report contracts belong to [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md).

## Context

Hosted-model selectors are public CLI surfaces: flags, help, pricing, `--all-*` expansion, resume, manifests, and historical artifacts. A selector is a complete runtime promise, not a validator string. Concrete identity, lifecycle, pricing, defaults, capabilities, and resume behavior must move together. Moving aliases, billing-only variants, and transport-incompatible products are not equivalent model selectors.

Separate lists for execution, public selection, pricing, and resume can compile while diverging at runtime, so one inventory must drive every downstream surface. Reasoning is part of that promise: hosted LLM-backed write and OCR adapters previously used provider-local effort levels, binary thinking flags, or untoggled reasoning, which changed token usage, latency, pricing, cache identity, manifests, and resume compatibility without a unified public control.

Lifecycle transitions also need a reusable contract. A deprecated model can remain cheaper than its successor, so array order and price alone cannot determine safe defaults. A wall-clock switch makes the same installed commit resolve differently over time. Removing a selector without historical rates breaks committed cost evidence, while silently substituting a successor misstates provider identity.

Why now: repeated refreshes across write/OCR, STT, TTS/music, and image/video each rediscovered the same rules per modality, so the registry contract needs one authority that dated catalogs and benchmark evidence can reference instead of restating.

## Options Considered

**Option 1 (selected)**

- **Option:** One durable cross-modality registry/lifecycle/capability policy with separate refresh and evidence records
- **Pros:** Gives every model family the same identity, eligibility, pricing, reasoning, validation, resume, and historical rules while keeping dated catalogs and benchmark chronology elsewhere
- **Cons:** Requires maintainers to update three authorities when a refresh includes both policy-significant and evidence-significant work
- **Quantitative Notes:** Governs 7 hosted surfaces: write, OCR, STT, TTS, music, image, and video

**Option 2**

- **Option:** Keep one policy inside each modality refresh record
- **Pros:** Keeps provider details close to their original implementation
- **Cons:** Repeats fixed-ID, retirement, pricing, approval, and validation rules and lets modalities drift
- **Quantitative Notes:** 7 near-duplicate rule sets to keep in sync

**Option 3**

- **Option:** Merge policy, provider chronology, and benchmark evidence into one omnibus record
- **Pros:** Makes one file exhaustive
- **Cons:** Buries stable rules in release-by-release detail and makes routine refreshes rewrite the architecture authority
- **Quantitative Notes:** Every refresh edits the architecture authority

**Option 4**

- **Option:** Update selector validators without a shared policy
- **Pros:** Produces small diffs
- **Cons:** Can advertise models with wrong pricing, modes, voices, request fields, defaults, resume behavior, or historical attribution
- **Quantitative Notes:** No reliable runtime promise

**Option 5**

- **Option:** Mirror provider aliases and capability names directly
- **Pros:** Closely follows upstream documentation
- **Cons:** Makes manifests non-reproducible and the public CLI provider-specific
- **Quantitative Notes:** At least one moving or duplicate identity per affected provider

## Decision

Govern every hosted-model registry with one shared policy covering selector identity, runtime contract completeness, lifecycle metadata, pricing provenance, and normalized reasoning capability.

This applies to:

- The hosted write, OCR, STT, TTS, music, image, and video registries and every command that resolves selectors through them.
- CLI surfaces fed by those registries: validation, defaults, `--all-*` expansion, help, pricing, resume, and manifests.
- Historical readers for retired selectors and their preserved rates.

It does not apply to:

- Local inference template controls.
- Dated refresh chronology (recorded in the 2026 hosted-model refresh reports under `docs/models/`).
- Benchmark evidence and calibration records (governed by [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md)).

### Concrete selector identity and eligibility

Register concrete, reproducible provider identifiers for current, generally available models that fit an implemented AutoShow command lifecycle. Do not register moving `*-latest` or preview aliases when a concrete stable target exists, duplicate aliases that resolve to the same model, or free-tier names that differ only in billing or availability rather than generation behavior.

A provider product whose request has no model field may use one stable AutoShow-local selector label, provided documentation states that it is a local product identity rather than a claimed upstream model ID. A hosted open-weight deployment may be registered only when its deployment or version is pinned and its complete request, output, price, and capability contract is locally represented.

Routine registry refreshes exclude domain-specific, medical, human, retrieval, dedicated-endpoint, streaming, realtime, avatar, cover, reference-audio, or other products whose transport or input/output lifecycle is not already represented. Such products require a separate architectural decision. Image generation remains raster-only; SVG or vector output selectors are not part of the active hosted generation surface.

Current purpose-specific siblings and documented quality, latency, or service tiers may coexist. A newer model does not automatically replace a sibling with materially different operations or price/quality trade-offs. A superseded generation is removed from active selection even if an endpoint remains temporarily callable.

### Complete runtime contract

Every selector addition, replacement, or retirement updates the public contract together: accepted selectors, published pricing and limits, bare-provider defaults, exact `--all-*` expansion, model-specific capabilities (modes, voices, languages, formats, durations, resolutions, references, and reasoning), CLI help and examples, price preflight, resume selection, and historical identity when active support ends.

Execution, all-provider expansion, price planning, and resume share one provider/model inventory. A provider or model that can run can also be resumed. Extract public provider selectors follow the stored STT or OCR route, so a provider shared by both services cannot use the wrong target kind for a given item.

Invalid model or control combinations fail locally before price calculation, credential lookup, or provider dispatch. Registry presence never implies support that the selected adapter does not implement.

Stable AutoShow family selectors may route to provider mode-specific endpoints when the model identity remains constant and the selected mode is explicit in validated inputs. This does not permit one provider's historical identity to be reinterpreted as another provider's result.

### Lifecycle, defaults, expansion, and retirement

Hosted registry entries carry static lifecycle metadata: `status` (`active` or `deprecated`), optional `shutdownDate` and concrete `replacementModel`, `defaultEligible`, and `allExpansionEligible`. Entries without lifecycle metadata resolve as active and eligible.

Deprecated entries require dated source evidence; dates must be valid ISO calendar dates; replacements must be concrete models in the same service; and moving aliases cannot be replacements. Selection never consults the current date. Maintainers advance lifecycle state through a reviewed repository change after rechecking evidence, so a given commit always resolves the same target.

Bare-provider selection uses the cheapest active `defaultEligible` model unless a documented provider policy deliberately pins one representative target, as most hosted TTS provider flags and several OCR and LLM provider flags do. `--all-*` preserves stable registry order after filtering `allExpansionEligible`. An explicit selector remains independently additive only while it is active or deliberately supported during a transition.

Retired selectors are rejected for new runs and absent from defaults, help, current config, and all-provider expansion. Direct selection returns replacement-aware guidance when a concrete successor exists and never silently substitutes it. Completed manifests and benchmark artifacts keep their stored model identity. An unfinished retired target cannot dispatch under that identity; selecting a successor creates a distinct additive target rather than rewriting canonical state.

Historical pricing records preserve removed model rates and request-shape facts needed to reprice committed artifacts. A recorded `providerCostCents` remains authoritative over reconstructed cost. Removing an active priced model means moving its rates to historical handling, not deleting its billing identity.

### Pricing and calibration provenance

Registry rates come from dated primary provider evidence and preserve the provider's actual units and tiers. Context-tier pricing uses explicit boundaries; flat pricing is not invented where a provider publishes none. Cached-input rates are recorded as provenance when applicable, while ordinary estimates use uncached rates unless the planner has trustworthy cache evidence. Token-priced OCR models use explicit prompt and completion components and multiplier `1` under [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md).

New models may temporarily reuse the nearest same-family token, latency, or duration heuristic only when the registry labels it provisional and keeps published rates separate. OCR evidence does not authorize a write heuristic, and one quality or timing sample does not override published token rates. Calibration promotion requires the healthy, model/mode/reasoning-qualified evidence contract in ADR-009 and the paid-approval and evidence rules in [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md).

### Normalized reasoning capability

Expose `--reasoning-effort <default|disabled|minimal|low|medium|high|max>` as the single public reasoning control for hosted LLM-backed write and OCR workflows and central consumers that dispatch through them.

Per-model capability metadata declares whether reasoning is unsupported, optional, or required; whether `disabled` is legal; and which normalized named levels are accepted. Resolve capabilities only after model selection. Reject unsupported combinations before pricing or dispatch; never silently downgrade, promote, or reinterpret an effort.

An omitted flag leaves each adapter's existing default behavior unchanged. Explicit `default` emits no provider override and delegates to the provider default.

Write and OCR manifests, estimates, result diagnostics, resume identity, and hosted OCR page-cache identity record requested and effective reasoning policies whenever the flag affects behavior. Resume rejects an explicit policy that differs from stored effective policy. Local inference template controls remain outside this hosted policy until their supported levels and performance implications are separately audited. Provider-specific levels outside the seven-value surface, such as `xhigh`, require an explicit public-enum expansion.

## Rationale

- Concrete fixed IDs keep manifests, prices, benchmarks, and all-provider execution reproducible.
- One selector contract prevents validator, adapter, pricing, resume, and documentation drift.
- Shared execution and resume inventories prevent a provider or model from becoming fresh-run-only.
- Static lifecycle metadata provides deterministic migrations without provider-specific hardcoded defaults or date-driven behavior.
- Preserving historical identities and rates protects evidence without continuing to advertise stale models.
- One normalized reasoning concept keeps provider vocabulary out of the public CLI while typed capabilities preserve real differences.
- Separating durable policy from the dated refresh ledger and benchmark evidence makes each authority discoverable and prevents release chronology from becoming architecture.

## Consequences

Positive outcomes:

- Every hosted modality follows one identity, eligibility, retirement, pricing, validation, reasoning, resume, and historical-evidence contract.
- Every supported provider or model can be selected additively through its matching resume command, including local models covered by the command family.
- New models can declare capabilities without adding provider-specific public flags.
- Deprecated models can leave automatic paid expansion before full retirement without changing behavior by date.
- Historical outputs remain attributable and repricable after active selectors are removed.
- Unsupported controls and retired targets fail before credentials, cost, quota use, or network access.

Negative outcomes:

- Registry schemas and per-model capability records require ongoing maintenance as provider products change.
- Active selector surfaces, help, and local contract matrices grow as documented siblings and capability variants are added.
- Introducing a brand-new provider requires wiring it into the shared inventory before it can run or resume.
- Historical and active identity handling remain separate.
- Provisional heuristics remain less precise until separately approved, qualified calibration evidence exists.
- The normalized reasoning enum is intentionally not the union of every provider-specific level.

## Trade-offs

**Trade-off 1**

- **Gain:** Reproducible concrete selectors
- **Sacrifice:** No moving convenience aliases or billing-only duplicate selectors

**Trade-off 2**

- **Gain:** Deterministic lifecycle-aware defaults and expansion
- **Sacrifice:** Explicit lifecycle metadata and replacement handling

**Trade-off 3**

- **Gain:** Truthful model-specific capabilities
- **Sacrifice:** More registry data, validation, and adapter branches

**Trade-off 4**

- **Gain:** One cross-provider reasoning surface
- **Sacrifice:** Unsupported values are rejected instead of coerced

**Trade-off 5**

- **Gain:** Historical identity and pricing continuity
- **Sacrifice:** Separate active and retired readers

**Trade-off 6**

- **Gain:** Evidence-gated calibration
- **Sacrifice:** Provisional estimates for newly introduced models

## Implementation Note

The policy ships in the hosted registries under `src/cli/commands/setup-and-utilities/models/`, with lifecycle validation in `model-lifecycle.ts` and `model-loader-schemas.ts`, historical rates in `retired-model-rates.ts`, and `--reasoning-effort` resolution in `reasoning-resolver.ts`. Canonical provider/model inventories used by execution, expansion, pricing, and resume live in `provider-targets.ts` and extract route maps in `extract-selectors.ts`.

## API / Type Impact

- All hosted model unions and registry schemas represent concrete active identities plus separate historical readers.
- Lifecycle metadata is optional and defaults to active and eligible, preserving existing entries until a transition is explicitly modeled.
- `write`, hosted OCR `extract`, and matching resume paths accept the seven-value `--reasoning-effort` surface only where selected models advertise support.
- Manifests distinguish omitted reasoning from explicit `default` and store requested and effective policy when the flag affects behavior.

## Test Plan

Run default verification and local, no-cost contract suites. Do not run `bun run t`, `bun test/test-runner.ts`, provider smoke tests, paid provider commands, or quota-risk E2E paths. Any live calibration or benchmark requires immediate explicit approval naming the exact command and expected cost or quota risk.

```bash
bun run check
bun t --price
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
bun test test/test-cases/validation/reports-pricing/price-mode-contracts/registry-provenance.test.ts
bun test test/test-cases/validation/reports-pricing/historical-model-rate-contracts.test.ts
bun test test/test-cases/validation/providers/provider-selection-contracts/
bun test test/test-cases/validation/resume-manifests/resume-provider-surface-contracts.test.ts
```

1. `bun run check` and `bun t --price` prove types, formatting, and price-mode contracts after registry or capability changes.
2. CLI help, usage, and option-resolution suites prove accepted selectors, `--reasoning-effort` parsing, omitted versus explicit-default behavior, retired-selector rejection, and local failure of unsupported model/control combinations.
3. Registry provenance and historical-rate tests prove dated evidence, same-service replacements, no moving aliases, and repricing of committed artifacts after retirement.
4. Provider-selection and resume-surface contracts prove deterministic defaults, exact `--all-*` expansion, execution-to-resume inventory parity, and replacement-aware guidance without silent substitution.

## Follow-up Actions

- [ ] Maintain primary-source pricing, lifecycle, capability, and replacement evidence during each refresh — Ongoing
- [ ] Calibrate materially different reasoning levels and provisional model heuristics — Blocked on explicit approval for paid benchmark runs
- [ ] Evaluate provider-specific reasoning levels outside the seven-value surface through explicit public-enum expansion — Pending
- [ ] Evaluate out-of-scope modalities and non-standard transports (streaming, realtime, dedicated endpoints) through separate architecture decisions — Pending

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — pipeline state, resume, and no-provider price planning
- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md) — shared model consumers and native CLI infrastructure
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — provider-lane scheduling
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) — extract execution and OCR calibration rules
- Related ADR: [ADR-011](ADR-011-add-refresh-metadata-to-links.md) — curated documentation acquisition
- Related ADR: [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md) — benchmark evidence and generated reports
- Related ADR: [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md) — character voice and multi-speaker architecture
- Related ADR: [ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md) — soundscape and multi-track pipeline
- Related reports: the 2026 hosted-model refresh reports under [`docs/models/`](../models/)
- `docs/commands/process-steps/step-3-write/write-text.md`
- `src/cli/commands/setup-and-utilities/models/`
- `src/cli/flags/service-selector-normalization/provider-targets.ts`
- `src/cli/flags/service-selector-normalization/extract-selectors.ts`
