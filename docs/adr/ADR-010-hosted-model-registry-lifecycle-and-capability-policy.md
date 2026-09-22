# ADR-010: Govern Hosted-Model Registry, Lifecycle, and Capability Policy

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-13
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed
- **Supersession:** Replaces per-modality registry and reasoning configurations. This record remains the accepted authority for selector identity, lifecycle, capability, reasoning, and pricing across write, OCR, STT, TTS, music, image, and video. Dated catalogs stay in the live registries and command docs. Benchmark evidence stays in [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md).

## Context

Hosted-model selectors are public CLI surfaces: flags, help, pricing, `--all-*` expansion, resume, manifests, and saved runs. A selector is a complete runtime promise. Concrete identity, lifecycle, pricing, defaults, capabilities, and resume behavior have to move together. A moving alias, a billing-only variant, and a product the CLI cannot call are different things.

Separate lists for execution, public selection, pricing, and resume can each look valid and still disagree at runtime. Reasoning belongs to the same promise. Hosted write and OCR previously used provider-local effort levels, a binary thinking flag, or no control, so token use, latency, price, manifests, and resume could change without one public flag.

Lifecycle needs one contract too. A deprecated model can be cheaper than its successor, so list order and price cannot pick a safe default. A wall-clock switch would make one installed commit resolve a different model later. Removing a selector without its old rates breaks cost evidence for finished runs. Substituting a successor would misstate which model ran.

Why now: refreshes across write/OCR, STT, TTS/music, and image/video kept restating these rules, and dated catalogs and benchmark evidence need one policy to cite.

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

Govern every hosted-model registry with one shared policy for selector identity, a complete runtime contract, lifecycle, pricing provenance, and one public reasoning control.

This applies to:

- The hosted write, OCR, STT, TTS, music, image, and video registries, and every command that resolves selectors through them.
- Validation, defaults, `--all-*` expansion, help, pricing, resume, and manifests.
- Historical pricing for retired selectors.

It does not apply to:

- Local inference template controls.
- Dated catalog history in the live registries and `docs/commands/`.
- Benchmark evidence and calibration records ([ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md)).

### Concrete selector identity

Register a concrete, stable provider id for a current, generally available model the CLI can run. Leave out moving `*-latest` and preview aliases when a stable id exists, duplicate names for the same model, and free-tier names that differ only in billing. A product with no upstream model id may use one stable AutoShow selector, documented as a local name. An open-weight deployment qualifies only when its version is pinned and the CLI represents its request, output, price, and capability contract.

Routine refreshes leave out products the CLI cannot already run, including domain-specific, streaming, realtime, and reference-audio products. Those need their own decision. Hosted image selectors produce raster output.

Current siblings and documented quality, latency, or service tiers may coexist. A newer model leaves a sibling in place when the operations or the price/quality trade-off differ. A superseded generation leaves active selection even if the endpoint still answers.

### Complete runtime contract

Adding, replacing, or retiring a selector updates the public contract together: accepted names, published prices and limits, bare-provider defaults, exact `--all-*` membership, model capabilities (modes, voices, languages, formats, durations, resolutions, references, and reasoning), help and examples, price preflight, resume, and the identity kept after active support ends.

A provider or model that can run can also be resumed. Extract follows the STT or OCR route stored for that item, including when one provider serves both. Invalid model or control combinations fail locally before price calculation, credential lookup, or dispatch. A listed model exposes only the controls it implements. A stored result keeps the provider that produced it.

### Lifecycle, defaults, expansion, and retirement

Write and OCR can record a model as active or deprecated, with an optional shutdown date, a concrete replacement, and whether it may be the bare-provider default or part of `--all-*`. Until a narrower status is recorded, the model stays active and eligible. Selection ignores the current date, including any recorded shutdown date, so one commit always resolves the same target.

A replacement is a concrete model in the same service. Deprecation, shutdown, and replacement are recorded as a transition. An active model stays eligible.

Bare-provider selection uses the cheapest active default-eligible model unless a documented provider policy pins one representative. `--all-*` keeps stable registry order and includes only expansion-eligible models. An explicit name stays valid on its own while the model is active or still supported for a transition.

Retired names are rejected for new runs and omitted from defaults, help, current config, and `--all-*`. When a concrete successor exists, the error names it and leaves the stored identity unchanged. Finished manifests and benchmark artifacts keep the model they stored. An unfinished retired target cannot run under the old name. Choosing the successor adds a new target.

Historical pricing keeps the rates of removed models so committed runs can be repriced. The cost recorded on a run remains the authority for that run. Retiring a priced model moves its rates into that history.

### Pricing provenance

Rates come from dated provider evidence and keep that provider's units and tiers. Context tiers use the published boundaries. The registry records a flat rate only when the provider publishes one. Published cache rates stay on record. Ordinary estimates use the uncached rate unless the planner has trustworthy evidence that a cache applies. Token-priced OCR estimates follow [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md).

A new model may temporarily reuse the nearest same-family token, latency, or duration heuristic when the registry marks that estimate provisional and keeps published rates separate. An OCR sample calibrates OCR estimates only. One quality or timing sample leaves published token rates in place. Promoting a heuristic uses the qualified evidence contract in ADR-009 and the paid-approval rules in [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md).

### Normalized reasoning

`--reasoning-effort <default|disabled|minimal|low|medium|high|xhigh|max>` is the public reasoning control for hosted LLM write and OCR, and for commands that dispatch them.

Each model states whether reasoning is unsupported, optional, or required, whether `disabled` is legal, and which of these levels it accepts. Unsupported combinations fail before pricing or dispatch.

Omitting the flag leaves the model's existing default unchanged. Explicit `default` sends no override.

When the flag affects behavior, write and OCR manifests, estimates, result diagnostics, and resume identity store the requested policy and the effective policy. Resume rejects an explicit policy that differs from the stored effective policy. A provider level outside these eight values is exposed only after the public enum grows to include it.

## Rationale

- Concrete fixed ids keep manifests, prices, benchmarks, and `--all-*` runs reproducible.
- One selector contract keeps validation, pricing, resume, and help on the same names.
- A shared run and resume inventory keeps every supported model resumable.
- Static lifecycle metadata makes defaults and migrations deterministic on a given commit.
- Preserved historical identities and rates keep finished runs attributable and repricable after the names leave help.
- One reasoning flag keeps provider vocabulary out of the public CLI while each model still advertises the levels it accepts.
- A durable policy, dated catalogs, and benchmark evidence stay findable because each has its own record.

## Consequences

Positive outcomes:

- Every hosted modality follows one identity, eligibility, retirement, pricing, validation, reasoning, resume, and historical-evidence contract.
- Every supported provider or model can be selected again through its resume command.
- New models can declare capabilities without a new public flag for each provider.
- A deprecated model can leave automatic paid expansion before it is fully retired, and a given commit keeps doing so.
- Finished runs stay attributable and repricable after the selector leaves active help.
- Unsupported controls and retired targets fail before credentials, spend, or network access.

Negative outcomes:

- Registry entries and per-model capabilities need updates as provider products change.
- Help grows as documented siblings and capability variants are added.
- Provisional estimates stay coarse until qualified calibration evidence exists.
- The public reasoning list is fixed at eight values until the enum is explicitly extended.

## Trade-offs

**Trade-off 1**

- **Gain:** Reproducible concrete selectors
- **Sacrifice:** No moving convenience aliases or billing-only duplicate selectors

**Trade-off 2**

- **Gain:** Deterministic lifecycle-aware defaults and expansion
- **Sacrifice:** Explicit lifecycle metadata and replacement handling

**Trade-off 3**

- **Gain:** Truthful model-specific capabilities
- **Sacrifice:** More registry data and stricter local validation

**Trade-off 4**

- **Gain:** One cross-provider reasoning surface
- **Sacrifice:** Unsupported values are rejected instead of coerced

**Trade-off 5**

- **Gain:** Historical identity and pricing continuity
- **Sacrifice:** Separate active and historical pricing records

**Trade-off 6**

- **Gain:** Evidence-gated calibration
- **Sacrifice:** Provisional estimates for newly introduced models

## Implementation Note

The policy is in force in the hosted registries under `src/cli/commands/setup-and-utilities/models/`. Command overviews under `docs/commands/` are the user-facing catalogs. Write reasoning behavior is documented in `docs/commands/03-write/overview.md`.

## API / Type Impact

- Public selectors are concrete active identities. Retired identities remain on stored runs and in historical rates.
- `write`, hosted OCR `extract`, and their resume paths accept the eight `--reasoning-effort` values only where the selected model advertises support.
- Manifests distinguish an omitted flag from explicit `default`, and store the requested and effective policy when the flag changes behavior.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
bun test test/test-cases/validation/reports-pricing/price-mode-contracts/registry-provenance.test.ts
bun test test/test-cases/validation/reports-pricing/historical-model-rate-contracts.test.ts
bun test test/test-cases/validation/providers/provider-selection-contracts/
bun test test/test-cases/validation/resume-manifests/resume-provider-*-contracts.test.ts
```

1. Types, formatting, and price-mode contracts after registry or capability changes.
2. Accepted selectors, `--reasoning-effort` parsing, omitted versus explicit-default behavior, retired-selector rejection, and local failure of unsupported model/control combinations.
3. Dated evidence, same-service replacements, stable ids, and repricing of committed artifacts after retirement.
4. Deterministic defaults, exact `--all-*` expansion, run-to-resume inventory parity, and successor guidance that preserves the stored identity.

Verification is local and no-cost.

## Follow-up Actions

- [ ] Calibrate materially different reasoning levels and provisional model heuristics — Blocked on explicit approval for paid benchmark runs
- [ ] Evaluate provider-specific reasoning levels outside the eight-value surface through explicit public-enum expansion — Pending

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — pipeline state, resume, and no-provider price planning
- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md) — shared model consumers and native CLI infrastructure
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — provider-lane scheduling
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) — extract execution and OCR calibration rules
- Related ADR: [ADR-011](ADR-011-add-refresh-metadata-to-links.md) — curated documentation acquisition
- Related ADR: [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md) — benchmark evidence and generated reports
- Related ADR: [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md) — character voice and multi-speaker architecture
- Related ADR: [ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md) — soundscape and multi-track pipeline
- Live model catalogs: `src/cli/commands/setup-and-utilities/models/`
- User-facing model docs: `docs/commands/`
- Write reasoning docs: `docs/commands/03-write/overview.md`
