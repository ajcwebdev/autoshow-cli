# ADR-010: Govern Hosted-Model Registry, Lifecycle, and Capability Policy

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-13
- **Date Updated:** 2026-08-14
- **Verification Status:** Passed
- **Supersession:** Replaces per-modality registry and reasoning configurations. Owns the durable registry, lifecycle, capability, and reasoning policy shared by the write, OCR, STT, TTS, music, image, and video registries. Dated provider/model refresh history belongs to the 2026 hosted-model refresh reports under `docs/reports/`; paid-approval gates, calibration evidence, and generated-report contracts belong to [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md).

## Context

AutoShow's hosted-model registries are public CLI, configuration, pricing, resume, artifact, benchmark, and documentation surfaces. Accepted model arrays determine selector types and validation; registry metadata determines prices, timing estimates, limits, lifecycle eligibility, and capabilities; bare selectors and `--all-*` flags determine execution targets; provider adapters determine whether each advertised selector can actually run with its supported controls and modes; and historical readers determine whether old artifacts remain attributable and repricable.

A model selector is therefore a complete runtime promise, not a validator string. Concrete identity, lifecycle, pricing, defaults, all-provider expansion, request construction, response parsing, help, resume behavior, historical identity, and local contracts must move together. Moving aliases, availability tiers, voice IDs, free billing variants, and transport-incompatible products are not equivalent model selectors.

That promise also requires a single inventory. Maintaining separate lists across execution, public selection, pricing, and resume allows them to compile successfully while diverging at runtime. Canonical provider/model selection descriptors must mechanically drive all downstream execution, pricing, and resume surfaces.

Reasoning policy is also part of that capability promise. Hosted LLM-backed write and OCR adapters previously used inconsistent provider-local mechanisms (effort levels, binary thinking flags, or untoggled reasoning), affecting token usage, latency, pricing, cache identity, manifests, and resume compatibility without a unified typed contract.

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

- The hosted write, OCR, STT, TTS, music, image, and video registries and every consumer that resolves selectors through them.
- CLI surfaces fed by those registries: validation, defaults, `--all-*` expansion, help, pricing, resume, and manifests.
- Historical readers for retired selectors and their preserved rates.

It does not apply to:

- Local inference template controls.
- Dated refresh chronology (recorded in the 2026 hosted-model refresh reports under `docs/reports/`).
- Benchmark evidence and calibration records (governed by [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md)).

### Concrete selector identity and eligibility

Register concrete, reproducible provider identifiers for current, generally available models that fit an implemented AutoShow command lifecycle. Do not register moving `*-latest` or preview aliases when a concrete stable target exists, duplicate aliases that resolve to the same model, or free-tier names that differ only in billing/availability rather than generation behavior.

A provider product whose request has no model field may use one stable AutoShow-local selector label, provided documentation states that it is a local product identity rather than a claimed upstream model ID. A hosted open-weight deployment may be registered only when its deployment/version is pinned and its complete request, output, price, and capability contract is locally represented.

Routine registry refreshes exclude domain-specific, medical, human, retrieval, dedicated-endpoint, streaming, realtime, avatar, cover, reference-audio, or other products whose transport or input/output lifecycle is not already represented. Such products require a separate architectural decision. Image generation remains raster-only; SVG/vector output selectors are not part of the active hosted generation surface.

Current purpose-specific siblings and documented quality, latency, or service tiers may coexist. A newer model does not automatically replace a sibling with materially different operations or price/quality trade-offs. A superseded generation is removed from active selection even if an endpoint remains temporarily callable.

### Complete runtime contract

Every selector addition, replacement, or retirement updates together:

- accepted constants, exported unions, schemas, configuration, and provider/model identity;
- published pricing, provenance dates, limits, provisional timing/token heuristics, and actual-cost readers;
- bare-provider defaults and exact `--all-*` expansion order;
- provider-specific request construction, routing, polling, retry, response normalization, artifact metadata, and cancellation where applicable;
- model-specific modes, voices, languages, formats, durations, resolutions, references, reasoning levels, and other capabilities;
- CLI help, examples, documentation links, price preflight, resume selection, and targeted local contracts; and
- historical result identity, replacement guidance, and retired pricing when active support ends.

Each command family has one typed canonical selection descriptor connecting provider keys to execution flags and repeatable model fields. Execution normalization, all-provider expansion, price planning, and resume derive their provider/model inventories from that descriptor or the same canonical target maps. No resume handler may maintain a parallel provider list or model-field table. Compile-time key equality makes a new provider incomplete until the descriptor contains its model fields; bidirectional local contracts reject both execution-only and resume-only targets. New models under an existing provider flow through the existing repeatable registry field automatically.

Extract uses the same rule with route-qualified maps: its public provider selectors are derived from canonical STT and OCR targets, then resolved against the stored route. A provider shared by STT and OCR can expose both canonical mappings without permitting the wrong target kind for a given item.

Invalid model/control combinations fail locally before price calculation, credential lookup, or provider dispatch. Registry presence never implies support that the adapter does not implement.

Stable AutoShow family selectors may route internally to provider mode-specific endpoints when the model identity remains constant and the selected mode is explicit in validated inputs. This applies to queue-backed providers such as fal.ai; it does not permit one provider's historical identity to be reinterpreted as another provider's result.

### Lifecycle, defaults, expansion, and retirement

Hosted registry schemas accept typed, static lifecycle metadata:

- `status`: `active` or `deprecated`;
- optional `shutdownDate` and concrete `replacementModel`;
- `defaultEligible`; and
- `allExpansionEligible`.

Entries without lifecycle metadata resolve as active and eligible. Deprecated entries require dated source evidence; dates must be valid ISO calendar dates; replacements must be concrete models in the same service; and moving aliases cannot be replacements. Selection never consults the current date. Maintainers advance lifecycle state through a reviewed repository change after rechecking evidence, so a given commit always resolves the same target.

Bare-provider selection uses the cheapest active `defaultEligible` model unless a documented provider policy deliberately chooses one representative target, such as Deepgram TTS's one-default expansion. `--all-*` preserves stable registry order after filtering `allExpansionEligible`; an explicit selector remains independently additive only while it is active or deliberately supported during a transition.

Retired selectors are rejected for new runs and absent from defaults, help, current config, and all-provider expansion. Direct selection returns replacement-aware guidance when a concrete successor exists and never silently substitutes it. Completed manifests and benchmark artifacts keep their stored model identity. An unfinished retired target cannot dispatch under that identity; selecting a successor creates a distinct additive target rather than rewriting canonical state.

Historical pricing records preserve removed model rates and request-shape facts needed to reprice committed artifacts. A recorded `providerCostCents` remains authoritative over reconstructed cost. Removing an active priced model means moving its rates to historical handling, not deleting its billing identity.

### Pricing and calibration provenance

Registry rates come from dated primary provider evidence and preserve the provider's actual units and tiers. Context-tier pricing uses explicit boundaries; flat pricing is not invented where a provider publishes none. Cached-input rates are recorded as provenance when applicable, while ordinary estimates use uncached rates unless the planner has trustworthy cache evidence. Token-priced OCR models use explicit prompt/completion components and multiplier `1` under ADR-009.

New models may temporarily reuse the nearest same-family token, latency, or duration heuristic only when the registry labels it provisional and keeps published rates separate. OCR evidence does not authorize a write heuristic, and one quality/timing sample does not override published token rates. Calibration promotion requires the healthy, model/mode/reasoning-qualified evidence contract in ADR-009 and the paid-approval/evidence rules in ADR-012.

### Normalized reasoning capability

Expose `--reasoning-effort <default|disabled|minimal|low|medium|high|max>` as the single public reasoning control for hosted LLM-backed write and OCR workflows and central consumers that dispatch through them.

Per-model capability metadata declares whether reasoning is unsupported, optional, or required; whether `disabled` is legal; and which normalized named levels are accepted. Resolve capabilities only after model selection. Reject unsupported combinations before pricing or dispatch; never silently downgrade, promote, or reinterpret an effort.

Provider request builders map the validated normalized policy to native fields such as OpenAI Responses `reasoning.effort` (`disabled` maps to native `none`), Anthropic `output_config.effort`, Gemini thinking levels, xAI/Groq/Kimi named efforts, and binary `thinking` or `reasoning.enabled` controls. An omitted flag leaves each adapter's existing default behavior unchanged; explicit `default` emits no provider override and delegates to the provider default.

Write and OCR manifests, estimates, result diagnostics, resume identity, and hosted OCR page-cache identity record requested and effective reasoning policies whenever the flag affects behavior. Resume rejects an explicit policy that differs from stored effective policy. Local inference template controls remain outside this hosted policy until their supported levels and performance implications are separately audited. Provider-specific levels outside the seven-value surface (e.g. `xhigh`) require an explicit public-enum expansion.

### Adjacent authorities

Refresh chronology belongs to the 2026 hosted-model refresh reports under `docs/reports/`; benchmark and report evidence to [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md); curated primary-source links and `.refresh.json` metadata to [ADR-011](ADR-011-add-refresh-metadata-to-links.md); lane scheduling to [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md); extract execution to [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md); and resume and price dry-run behavior to [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md).

## Rationale

- Concrete fixed IDs keep manifests, prices, benchmarks, and all-provider execution reproducible.
- One selector contract prevents validator, adapter, pricing, resume, and documentation drift.
- Derived selection descriptors prevent a provider or model from becoming fresh-run-only merely because a resume inventory was not updated by hand.
- Static lifecycle metadata provides deterministic migrations without provider-specific hardcoded defaults or date-driven behavior.
- Preserving historical identities and rates protects evidence without continuing to advertise stale models.
- One normalized reasoning concept keeps provider vocabulary out of the public CLI while typed capabilities preserve real differences.
- Separating durable policy from the dated refresh ledger and benchmark evidence makes each authority discoverable and prevents release chronology from becoming architecture.

## Consequences

Positive outcomes:

- Every hosted modality follows one identity, eligibility, retirement, pricing, validation, reasoning, resume, and historical-evidence contract.
- Every supported provider/model can be selected additively through its matching resume command, including local models covered by the command family.
- New models can declare capabilities without adding provider-specific public flags or scattered name checks.
- Deprecated models can leave automatic paid expansion before full retirement without changing behavior by date.
- Historical outputs remain attributable and repricable after active selectors are removed.
- Unsupported controls and retired targets fail before credentials, cost, quota use, or network access.

Negative outcomes:

- Registry schemas and per-model capability records require ongoing maintenance as provider products change.
- Active selector surfaces, help, and local contract matrices grow as documented siblings and capability variants are added.
- Typed command descriptors add an explicit integration step when a brand-new provider is introduced.
- Historical and active identity handling remain separate code paths.
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

The policy is implemented across the model registries and loaders under `src/cli/commands/setup-and-utilities/models/`, provider adapters, option resolution, pricing orchestration, resume handlers, and workflow metadata:

- `ReasoningCapabilitiesSchema` and `reasoning-resolver.ts` define `NORMALIZED_REASONING_EFFORTS`, `parseReasoningEffort`, `getReasoningCapabilities`, and `resolveReasoningPolicy`. Hosted write and OCR dispatch validate every selected target before price calculation or execution, preserving omitted versus explicit-default behavior and mapping native provider payloads without coercion.
- `model-lifecycle.ts` and `model-loader-schemas.ts` validate evidence dates and concrete same-service replacements, filter cheapest defaults and all-provider expansion, and ensure model resolution remains independent of the current date.
- `provider-targets.ts` defines canonical generation selection descriptors used by write, TTS, image, video, and music resume. `extract-selectors.ts` derives route-aware public provider inventories from canonical STT/OCR maps. Bidirectional contract tests verify parity between execution flags and resume handlers across all registered providers.

## API / Type Impact

- All hosted model unions and registry schemas represent concrete active identities plus separate historical readers.
- Lifecycle metadata is optional and defaults to active/eligible, preserving existing entries until a transition is explicitly modeled.
- `write`, hosted OCR `extract`, and matching resume paths accept the seven-value `--reasoning-effort` surface only where selected models advertise support.
- Provider options receive a normalized reasoning policy; provider request builders retain ownership of native field shapes.
- Manifests distinguish omitted reasoning from explicit `default` and store requested/effective policy when material.
- Generation selection descriptors bind each provider target to its model option fields; resume provider flags and model clearing/collection derive from those bindings.

## Follow-up Actions

- [ ] Maintain primary-source pricing, lifecycle, capability, and replacement evidence during each refresh — Ongoing
- [ ] Calibrate materially different reasoning levels and provisional model heuristics — Deferred pending approval for paid benchmark runs
- [ ] Evaluate provider-specific reasoning levels outside the seven-value surface through explicit public-enum expansion — Deferred
- [ ] Evaluate out-of-scope modalities and non-standard transports (streaming, realtime, dedicated endpoints) through separate architecture decisions — Deferred

## Test Plan

- Run `bun run check`, `bun t --price`, CLI help/usage/option-resolution contracts, registry schema/provenance tests, provider selection/default/expansion tests, retired-model price and resume tests, and local request/response contracts for changed providers.
- Reasoning contracts cover parsing, omitted and explicit provider defaults, capability validation, provider request mapping, hosted-only scope, pre-dispatch validation, pricing, resume compatibility, manifest propagation, and hosted OCR cache identity.
- Lifecycle contracts cover valid evidence dates, same-service concrete replacements, no moving aliases, deterministic defaults, all-expansion eligibility, successor guidance, historical identity, and no wall-clock selection.
- Capability contracts prove active-selector acceptance, removed-selector rejection, exact all-provider expansion, complete pricing metadata, and local rejection of unsupported controls.
- Selection inventory contracts prove every extract, write, TTS, image, video, and music execution target has matching resume routing and that repeatable model flags include every registered provider family.
- Do not run `bun run t`, `bun test/test-runner.ts`, provider smoke tests, paid provider commands, or quota-risk E2E paths. Any live calibration or benchmark requires immediate explicit approval naming the exact command and expected cost or quota risk.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — pipeline state, resume, and no-provider price planning
- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md) — shared model consumers and native CLI infrastructure
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — provider-lane scheduling
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) — extract execution and OCR calibration rules
- Related ADR: [ADR-011](ADR-011-add-refresh-metadata-to-links.md) — curated documentation acquisition
- Related ADR: [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md) — benchmark evidence and generated reports
- Related reports: the 2026 hosted-model refresh reports under `docs/reports/` — dated hosted-model refresh history
- Related ADR: [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md) — character voice and multi-speaker architecture
- Related ADR: [ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md) — soundscape and multi-track pipeline
- `docs/commands/process-steps/step-3-write/write-text.md`
- `src/cli/commands/setup-and-utilities/models/`
- `src/cli/commands/setup-and-utilities/models/model-loader/model-lifecycle.ts`
- `src/cli/commands/setup-and-utilities/models/model-loader/model-loader-schemas.ts`
- `src/cli/commands/setup-and-utilities/models/model-loader/retired-model-rates.ts`
- `src/cli/commands/pricing-orchestration/compute-actual-costs.ts`
- `src/cli/commands/setup-and-utilities/models/reasoning-resolver.ts`
- `src/cli/options/option-resolution/model-flag-selection.ts`
- `src/cli/flags/service-selector-normalization/provider-targets.ts`
- `src/cli/flags/service-selector-normalization/extract-selectors.ts`
- `test/test-cases/validation/resume-manifests/resume-provider-surface-contracts.test.ts`
- `test/test-cases/validation/providers/provider-selection-contracts/selection-inventory-contracts.test.ts`
- `src/cli/commands/process-steps/step-2-extract/`
- `src/cli/commands/process-steps/step-3-write/`
- `src/cli/commands/process-steps/step-4-tts/`
- `src/cli/commands/process-steps/step-5-image/`
- `src/cli/commands/process-steps/step-6-video/`
- `src/cli/commands/process-steps/step-7-music/`
- `project/links/`
