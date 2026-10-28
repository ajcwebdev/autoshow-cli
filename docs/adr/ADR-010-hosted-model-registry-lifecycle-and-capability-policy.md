# ADR-010: Govern Hosted-Model Registry, Lifecycle, and Capability Policy

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-13
- **Date Updated:** 2026-10-28
- **Verification Status:** Passed
- **Supersession:** Replaces per-modality registry and reasoning configurations. Absorbs the calibration and billing-authority rules of "Govern Benchmark Evidence and Generated-Report Architecture" and the comic model-resolution decision of "Integrate Comic with Shared Model and Native CLI Infrastructure". This record is the accepted authority for selector identity, lifecycle, capability, reasoning, and pricing across write, OCR, STT, TTS, music, image, and video, and for every command that resolves models through the central registries. The benchmark evidence lifecycle and paid-approval rules live in [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md), and the combined-report architecture is documented in [docs/benchmarks/README.md](../benchmarks/README.md).

## Context

A hosted-model selector is a public promise: flags, help, pricing, `--all-*` expansion, resume, manifests, and saved runs all depend on it. Concrete identity, lifecycle, pricing, defaults, capabilities, reasoning, and resume behavior have to move together, and separate lists for execution, selection, pricing, and resume can each look valid while disagreeing at runtime.

Lifecycle needs one contract too. A deprecated model can be cheaper than its successor, so list order and price cannot pick a safe default; a wall-clock switch would make one installed commit resolve a different model later; removing a selector without its old rates breaks cost evidence for finished runs. Comic kept a private copy of the LLM and image catalog, so its users saw a subset of models and every catalog change had to be made twice. Estimates, reconstructed rates, and recorded charges are different kinds of evidence and need one order of precedence.

Why now: refreshes across every modality kept restating these rules, comic carried a private catalog, and dated catalogs and benchmark evidence need one policy to cite.

## Options Considered

### Registry policy

**Option 1 (selected)**

- **Option:** One durable cross-modality registry, lifecycle, and capability policy, with dated catalogs and benchmark evidence kept elsewhere
- **Pros:** Every model family follows the same identity, eligibility, pricing, reasoning, validation, and resume rules
- **Cons:** A refresh that changes both policy and evidence touches more than one record
- **Quantitative Notes:** Governs 7 hosted surfaces

**Option 2**

- **Option:** Keep one policy inside each modality refresh record
- **Pros:** Provider details stay beside their implementation
- **Cons:** Repeats the rules 7 times and lets modalities drift
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Merge policy, provider chronology, and benchmark evidence into one omnibus record
- **Pros:** One exhaustive file
- **Cons:** Every routine refresh rewrites the architecture authority
- **Quantitative Notes:** n/a

**Option 4**

- **Option:** Mirror provider aliases and capability names directly
- **Pros:** Follows upstream documentation closely
- **Cons:** Moving aliases make manifests non-reproducible and the CLI provider-specific
- **Quantitative Notes:** n/a

### Registry consumers

**Option 1 (selected)**

- **Option:** Comic resolves its models, prices, and hosted generation through the central registries
- **Pros:** One catalog; a catalog or price change lands once
- **Cons:** Comic depends on shared generation infrastructure
- **Quantitative Notes:** Comic keeps no private model list

**Option 2**

- **Option:** Keep comic's own model list but read central prices
- **Pros:** Smaller migration
- **Cons:** Rejected; only price drift is fixed
- **Quantitative Notes:** n/a

## Decision

Govern every hosted-model registry with one shared policy for selector identity, a complete runtime contract, lifecycle, pricing provenance, and one public reasoning control.

This applies to:

- The hosted write, OCR, STT, TTS, music, image, and video registries, and every command that resolves selectors through them, including comic.
- Validation, defaults, `--all-*` expansion, help, pricing, resume, manifests, and historical pricing for retired selectors.

It does not apply to:

- Local inference template controls, and dated catalog history in the live registries and `docs/commands/`.
- The benchmark evidence lifecycle, paid approval, and compaction ([ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md)), and the combined-report architecture ([docs/benchmarks/README.md](../benchmarks/README.md)).
- Flag spellings and the derivation of help from capability registries ([ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md)).
- Comic workflow logic, prompts, schemas, QA, audio, or presentation ([ADR-013](ADR-013-comic-scene-audio-and-presentation.md) and [ADR-017](ADR-017-comic-script-and-scene-authoring.md)).

### Registry consumers

Comic resolves LLM, image, QA, dialogue, and sound-effect models, prices, and hosted generation through these registries and keeps no private model list. Image selections match `image`, text selections match `write`, and QA selections are the vision-capable OpenAI and Gemini models. `--provider` and role-scoped `--<role>-provider` validate central registry IDs.

### Concrete selector identity

Register a concrete, stable provider id for a current, generally available model the CLI can run. Leave out moving `*-latest` and preview aliases when a stable id exists, duplicate names for the same model, and free-tier names that differ only in billing. A product with no upstream model id may use one stable AutoShow selector, documented as a local name. An open-weight deployment qualifies only when its version is pinned and the CLI represents its request, output, price, and capability contract.

Routine refreshes leave out products the CLI cannot already run, including domain-specific, streaming, realtime, and reference-audio products; those need their own decision. Hosted image selectors produce raster output. Current siblings and documented quality, latency, or service tiers may coexist, and a newer model leaves a sibling in place when the operations or the price/quality trade-off differ. A superseded generation leaves active selection even if the endpoint still answers.

### Subscription-free API eligibility

Hosted API usage must be available without mandatory recurring fees or recurring minimum spending. Metered billing and one-time prepaid credits qualify. A free allowance followed by subscription-only overages does not qualify. Optional feature subscriptions or discounts do not disqualify independently available core API usage.

Every provider addition and refresh must document route-specific billing eligibility with dated primary sources, including prepaid minimum purchases and expiry where documented. Conflicting or missing evidence remains unresolved. The dated decisions and primary sources under [Excluded integrations](#excluded-integrations) record the current exclusions. Retaining another route does not establish its account entitlement, unpublished purchase terms or operation-specific tariff; verify those conditions before adding or refreshing that route.

#### Excluded integrations

On September 25, 2026, Hume, Cartesia, and Speechify TTS were removed at the user's direction. This policy exclusion supersedes ordinary model retirement and historical-rate retention for these providers. Existing local assets remain untouched. Excluded selectors and saved settings fail locally without substitution.

<!-- excluded-tts-providers:start -->

**Provider: Hume**

- **Model identifiers:** `octave-1`, `octave-2`
- **Removal decision:** [Official FAQ](https://dev.hume.ai/docs/text-to-speech-tts/faq): Free and Starter cannot buy additional TTS usage; Creator or higher is required.

**Provider: Cartesia**

- **Model identifiers:** `sonic-3.6-2026-08-27`, `sonic-3.5-2026-05-04`, `sonic-3`, `sonic-3.6`, `sonic-preview`, `sonic-2`
- **Removal decision:** [Official pricing](https://www.cartesia.ai/pricing): monthly plans supply model credits and paid subscribers receive overages.

**Provider: Speechify**

- **Model identifiers:** `simba-3.2`, `simba-3.0`, `simba-english`
- **Removal decision:** [Official API pricing](https://speechify.ai/pricing), rechecked 2026-09-25: Free cannot top up; continued usage requires a paid monthly plan.

**Provider: Mistral**

- **Model identifiers:** `voxtral-mini-tts-2603`
- **Removal decision:** TTS and voice management removed; STT/OCR retained

<!-- excluded-tts-providers:end -->

Mistral TTS and voice management were removed on September 25, 2026; its STT/OCR support remains. Removed TTS selections, saved settings, voice commands, and resume attempts fail locally without substitution. Existing manifests, registered assets, purchased audio, and remote voices remain intact.

The removed utterance endpoint was the only implementation of `--tts-trailing-silence`; that flag and its saved configuration key are removed too.

On October 15, 2026, Firecrawl URL extraction, Supadata URL extraction and STT, Happy Scribe STT, and GLM Reader URL extraction were removed. The dated billing review below excluded the first three providers for requiring recurring paid plans and GLM Reader for lacking a verified REST price and billing eligibility contract.

<!-- excluded-extraction-providers:start -->

**Provider: Firecrawl**

- **Removed category/model tuples:** `extract/firecrawl/firecrawl`
- **Dated primary evidence and decision:** [Billing](https://docs.firecrawl.dev/billing), checked 2026-10-15: Free has no pay-as-you-go option; additional credits require a paid plan.

**Provider: Supadata**

- **Removed category/model tuples:** `extract/supadata/supadata`, `stt/supadata/auto`
- **Dated primary evidence and decision:** [Pricing](https://supadata.ai/pricing), checked 2026-10-15: Free cannot recharge; paid subscriptions unlock recharge.

**Provider: Happy Scribe**

- **Removed category/model tuples:** `stt/happyscribe/auto`
- **Dated primary evidence and decision:** [Plans and pricing](https://help.happyscribe.com/en/articles/6906232-plans-and-pricing), published 2026-07-23 and checked 2026-10-15: the pay-as-you-go Starter offer was retired; one-off AI transcription requires a subscription.

**Provider: GLM Reader**

- **Removed category/model tuples:** `extract/glm-reader/glm-reader`
- **Dated primary evidence and decision:** [REST Reader](https://docs.z.ai/api-reference/tools/web-reader) and [pricing](https://docs.z.ai/guides/overview/pricing), checked 2026-10-15: no verified REST Reader tariff or independent billing entitlement. The Web Search price and Coding Plan Reader MCP are different contracts.

<!-- excluded-extraction-providers:end -->

These five tuples are excluded from active selection and dispatch. Their provider-only `--stt-organization-id` and `--stt-chunk-size` flags are removed. Defuddle failures stop with the extraction error; article downloads and documentation links do not silently fall back to a paid provider.

Existing completed artifacts and recorded costs remain intact. Historical rates remain available; GLM Reader's former Web Search-based estimate is historical and unverified. Completed provider states may be reused alongside newly selected active targets. An unfinished excluded target, explicit excluded selection, or obsolete saved configuration fails locally before credential lookup or dispatch without substitution.

On October 17, 2026, the model tuples below were excluded while their providers stay active. They are decisions, not pending additions: provider-model research must not recommend them again unless new primary evidence directly addresses the recorded reason, and restoring one needs a user decision.

<!-- excluded-hosted-models:start -->

**Provider: Cloudflare**

- **Excluded category/model tuples:** `stt/cloudflare/@cf/deepgram/nova-3`
- **Decision:** Removed at the user's direction after the [October 2026 STT benchmarks](../benchmarks/README.md#october-2026-stt-refresh) found direct Deepgram `deepgram=nova-3` cheaper and faster with comparable quality. Cloudflare Whisper models remain.

**Provider: Together**

- **Excluded category/model tuples:** `stt/together/nvidia/nemotron-3.5-asr-streaming-0.6b`, `stt/together/nvidia/nemotron-3-asr-streaming-0.6b`
- **Decision:** Not batch-callable: Together's transcription page lists them, but a 2026-10-17 `POST /v1/audio/transcriptions` request for Nemotron 3.5 returned 400 "This model only supports WebSocket streaming." Streaming transcription is outside current STT dispatch.

<!-- excluded-hosted-models:end -->

Explicit selections of these tuples fail locally before dispatch. Finished Cloudflare Nova-3 benchmark results keep their identity and historical pricing.

### Complete runtime contract

Adding, replacing, or retiring a selector updates the public contract together: accepted names, published prices and limits, bare-provider defaults, exact `--all-*` membership, model capabilities (modes, voices, languages, formats, durations, resolutions, references, and reasoning), help and examples, price preflight, resume, and the identity kept after active support ends.

A hosted provider or model that can run can also be resumed, and extract follows the media, document, or article route stored for that item. Invalid model or control combinations fail locally before price calculation, credential lookup, or dispatch. A listed model exposes only the controls it implements. A stored result keeps the provider that produced it.

### Lifecycle, defaults, expansion, and retirement

Write and OCR can record a model as active or deprecated, with an optional shutdown date, a concrete replacement in the same service, and whether it may be the bare-provider default or part of `--all-*`. Until a narrower status is recorded, the model stays active and eligible. Selection ignores the current date, including any recorded shutdown date, so one commit always resolves the same target.

Bare-provider selection uses the cheapest active default-eligible model unless a documented provider policy pins one representative. `--all-*` keeps stable registry order and includes only expansion-eligible models. An explicit name stays valid while the model is active or still supported for a transition.

Retired names are rejected for new runs and omitted from defaults, help, current config, and `--all-*`. When a concrete successor exists, the error names it and leaves the stored identity unchanged. Finished manifests and benchmark artifacts keep the model they stored; an unfinished retired target cannot run under the old name, and choosing the successor adds a new target. Historical pricing keeps the rates of removed models so committed runs can be repriced, and the cost recorded on a run remains the authority for that run.

The October 2026 user-directed removals of retired write/OCR routes, fal, and OpenAI `gpt-image-2` explicitly waived historical-rate and committed benchmark-evidence retention for those removals. Kimi and GLM write/OCR, Together writing, DeepInfra OCR, and fal image/video remain unavailable without substitution; Together and DeepInfra STT remain supported. Current model membership and defaults belong to the live catalogs, rather than a dated inventory in this policy.

### Pricing provenance

Rates come from dated provider evidence and keep that provider's units and tiers. Context tiers use the published boundaries, a flat rate is recorded only when the provider publishes one, and published cache rates stay on record. Ordinary estimates use the uncached rate unless the planner has trustworthy evidence that a cache applies. Token-priced OCR estimates follow [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md).

Published provider billing is authoritative over an estimate, and recorded provider cost takes precedence over reconstructed historical rates. Estimates and actuals must name retries, reruns, billing variance, quota effects, and any excluded or invalid outputs.

A new model may temporarily reuse the nearest same-family token, latency, or duration heuristic when the registry marks that estimate provisional and keeps published rates separate. An OCR sample calibrates OCR estimates only, one quality or timing sample never changes published rates, and paid calibration is not a prerequisite for a compatibility or lifecycle transition when primary documentation and local mocked contracts prove request support. Promoting a heuristic uses the qualified evidence contract in ADR-008 and the paid-approval rules in [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md).

Bundled OCR token profiles may override individual registry components only for the provider, model, OCR mode, page-count band and effective reasoning policy qualified by that evidence. They are a fallback when no learned local profile exists and identify their source as `calibrated-registry`. A single-page image calibration does not change PDF, CBZ, other page bands, published rates, general write estimates or scheduler timing.

### Normalized reasoning

`--reasoning-effort <default|disabled|minimal|low|medium|high|xhigh|max>` is the public reasoning control for hosted LLM write and OCR, and for commands that dispatch them. Each model states whether reasoning is unsupported, optional, or required, whether `disabled` is legal, and which levels it accepts; unsupported combinations fail before pricing or dispatch. Omitting the flag retains the command's default policy, including `low` for Gemini 3 OCR. Explicit `default` clears the CLI override and delegates to the provider default.

When the flag affects behavior, write and OCR manifests, estimates, result diagnostics, and resume identity store the requested policy and the effective policy, and resume rejects an explicit policy that differs from the stored effective policy. A provider level outside these eight values is exposed only after the public enum grows to include it.

Any future enum expansion must establish a concrete provider/model/endpoint contract and update the shared constant, request mapping, validation before dispatch, persistence, resume identity, price diagnostics, help and local behavioral tests together. SDK configuration names and provider synonyms do not automatically become new CLI values.

## Rationale

- Concrete fixed ids keep manifests, prices, benchmarks, and `--all-*` runs reproducible, and one selector contract keeps validation, pricing, resume, and help on the same names.
- Static lifecycle metadata makes defaults and migrations deterministic on a given commit, and preserved historical identities and rates keep finished runs attributable after the names leave help.
- One reasoning flag keeps provider vocabulary out of the public CLI while each model still advertises the levels it accepts.
- A comic-specific catalog made model availability and price depend on which command the user entered.
- A recorded charge is what the provider billed; an estimate or a reconstructed rate is not.

## Consequences

Positive outcomes:

- Every hosted modality, including comic, follows one identity, eligibility, retirement, pricing, validation, reasoning, and resume contract.
- New models can declare capabilities without a new public flag per provider, and unsupported controls or retired targets fail before credentials, spend, or network access.
- A deprecated model can leave automatic paid expansion before it is fully retired, and finished runs stay attributable and repricable afterwards.

Negative outcomes:

- Registry entries and per-model capabilities need updates as provider products change, and help grows with documented siblings and variants.
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

- **Gain:** One cross-provider reasoning surface
- **Sacrifice:** Unsupported values are rejected instead of coerced

**Trade-off 4**

- **Gain:** Evidence-gated calibration and historical pricing continuity
- **Sacrifice:** Provisional estimates for new models and separate active and historical rate records

## Implementation Note

The policy is in force in the hosted registries under `src/cli/commands/setup-and-utilities/models/`, and the command overviews under `docs/commands/` are the user-facing catalogs. Write reasoning behavior is documented in `docs/commands/03-write/overview.md`.

### Reasoning calibration and provider vocabulary review (2026-09-23)

The September 23 review completed the reasoning vocabulary and calibration follow-ups for its measured contexts. It retained the eight-value public enum. Current model-specific support is declared in the live registries; the review does not establish support for later models or provider vocabulary.

The retained OCR calibration profiles come from three original fictional English prose sources, Harbor, Meadow and Summit, rendered as single-page 1020×1320 images. The fixtures remain in `test/fixtures/reasoning-calibration/`, and the promoted component medians remain in `src/cli/commands/setup-and-utilities/models/ocr-calibration-profiles.json`. Profiles apply only to the exact provider, model, image mode, page-count band and effective reasoning policy represented by those samples. General write heuristics, other document modes, page bands and unmeasured policies remain provisional.

Qualification required matching model and effective policy, finite provider usage, positive timing, recorded usage cost and a nonempty decoded artifact. Write also required valid structured output and the expected returned model identity. OCR required one successful attempt covering the source image, matching page and text artifacts, and source-text equality after removing case, punctuation and whitespace. Failed, partial, retried or text-incorrect OCR outputs were excluded from promotion.

Each promoted OCR component required at least three distinct healthy sources in the same context, all observations on the same side of the registry estimate, and median absolute percentage error greater than 20%, using the observation as denominator. The promoted value is the observed median. Published prices and scheduler timing were not changed by token calibration.

These checks establish write transport, identity, usage and structured-artifact integrity, plus normalized text correctness for OCR. They do not establish summary factual correctness, writing quality, punctuation fidelity or layout fidelity. Recorded usage costs are rate-based calculations, not account invoices.

The investigation runner, separate report and raw evidence bundle were retired after review. The retained fixtures, profiles and qualification rules preserve the basis of the shipped estimates; existing local paid outputs were left intact. Future calibration requires a scoped plan under the evidence and spending rules in [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md).

## API / Type Impact

- Public selectors are concrete active identities. Retired identities remain on stored runs and in historical rates.
- `write`, hosted OCR `extract`, and their resume paths accept the eight `--reasoning-effort` values only where the selected model advertises support.
- Manifests distinguish an omitted flag from explicit `default`, and store the requested and effective policy when the flag changes behavior.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/cli/option-resolution-contracts/
bun test test/test-cases/validation/reports-pricing/
bun test test/test-cases/validation/providers/provider-selection-contracts/
```

1. Accepted selectors, `--reasoning-effort` parsing, retired-selector rejection, and local failure of unsupported model and control combinations.
2. Dated pricing evidence, same-service replacements, and repricing of committed artifacts after retirement.
3. Deterministic defaults, exact `--all-*` expansion, and run-to-resume inventory parity.

Verification is local and no-cost.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — pipeline state, resume, and no-provider price planning
- Related ADR: [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md) — comic command tree and native CLI grammar
- Related ADR: [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md) — provider-lane scheduling and hosted admission
- Related ADR: [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md) — OCR execution and token-priced calibration rules
- Related ADR: [ADR-009](ADR-009-stt-timing-captions-and-alignment.md) — STT model capability and diarization labels
- Related ADR: [ADR-011](ADR-011-links-selection-grammar-and-refresh-metadata.md) — curated documentation acquisition
- Related ADR: [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md) — TTS model contracts and voice capability boundaries
- Related ADR: [ADR-013](ADR-013-comic-scene-audio-and-presentation.md) — comic dialogue and sound-effect consumers
- Related ADR: [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md) — benchmark evidence lifecycle and paid approval
- Related ADR: [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md) — registry-derived help and provider-general flag spellings
- Combined-report architecture: [docs/benchmarks/README.md](../benchmarks/README.md)
- Live model catalogs: `src/cli/commands/setup-and-utilities/models/`
- User-facing model docs: `docs/commands/`
- Write reasoning docs: `docs/commands/03-write/overview.md`
