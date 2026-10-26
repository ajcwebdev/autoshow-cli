# ADR-010: Govern Hosted-Model Registry, Lifecycle, and Capability Policy

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-13
- **Date Updated:** 2026-10-15
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

- **Option:** Update selector validators without a shared policy
- **Pros:** Small diffs
- **Cons:** Can advertise models with wrong pricing, capabilities, defaults, or resume behavior
- **Quantitative Notes:** n/a

**Option 5**

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

Comic resolves LLM, image, QA, dialogue, and sound-effect models, prices, and hosted generation through these registries and keeps no private model list. Image selections match `image`, text selections match `write`, and QA selections are the vision-capable OpenAI and Gemini models. `--provider` and role-scoped `--<role>-provider` validate central registry IDs; comic domain rules such as target values, grid combinations, and reference-sheet modes are unchanged by registry resolution.

### Concrete selector identity

Register a concrete, stable provider id for a current, generally available model the CLI can run. Leave out moving `*-latest` and preview aliases when a stable id exists, duplicate names for the same model, and free-tier names that differ only in billing. A product with no upstream model id may use one stable AutoShow selector, documented as a local name. An open-weight deployment qualifies only when its version is pinned and the CLI represents its request, output, price, and capability contract.

Routine refreshes leave out products the CLI cannot already run, including domain-specific, streaming, realtime, and reference-audio products; those need their own decision. Hosted image selectors produce raster output. Current siblings and documented quality, latency, or service tiers may coexist, and a newer model leaves a sibling in place when the operations or the price/quality trade-off differ. A superseded generation leaves active selection even if the endpoint still answers.

### Subscription-free API eligibility

Hosted API usage must be available without mandatory recurring fees or recurring minimum spending. Metered billing and one-time prepaid credits qualify. A free allowance followed by subscription-only overages does not qualify. Optional feature subscriptions or discounts do not disqualify independently available core API usage.

Every provider addition and refresh must document route-specific billing eligibility with dated primary sources, including prepaid minimum purchases and expiry where documented. Conflicting or missing evidence remains unresolved. The dated decisions and primary sources under [Excluded integrations](#excluded-integrations) record the current exclusions. Retaining another route does not establish its account entitlement, unpublished purchase terms or operation-specific tariff; verify those conditions before adding or refreshing that route.

#### Excluded integrations

On September 25, 2026, Hume, Cartesia, and Speechify TTS were removed at the user's direction, including their adapters, selectors, credentials, configuration, historical rates, and committed benchmark records. This policy exclusion supersedes ordinary model retirement and historical-rate retention for these providers. Ignored local inputs, outputs, credentials, and purchased audio remain untouched. Excluded selectors and saved settings fail locally; no compatibility aliases or automatic substitutions are provided.

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

Mistral TTS and voice management were removed on September 25, 2026. Its STT/OCR models, pricing, credentials, shared REST client, and resume paths remain supported. Removed TTS selectors, controls, saved settings, reference-audio inputs, voice commands, and resume attempts fail locally without substitution. Existing Mistral manifests, benchmark evidence, registered assets, purchased audio, and remote voices remain intact; removal triggers no cleanup or remote deletion.

The removed utterance endpoint was the only implementation of `--tts-trailing-silence`; that flag and its saved configuration key are removed too.

On October 15, 2026, Firecrawl URL extraction, Supadata URL extraction and STT, Happy Scribe STT, and GLM Reader URL extraction were removed from active support. Firecrawl, Supadata, and Happy Scribe require recurring paid plans for continued usage. GLM Reader is excluded because the implemented REST route lacks a verified price and billing eligibility contract; this does not establish that the route is subscription-gated. Ordinary GLM write and OCR support remained active until the October 18 removal below.

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

These five tuples leave active selectors, model catalogs, live pricing, setup credentials, saved configuration, dispatch, and examples together. The provider-only `--stt-organization-id` and `--stt-chunk-size` flags are removed. Defuddle failures stop with the extraction error; no automatic Firecrawl fallback or other paid substitute is attempted, including article downloads and documentation links.

Existing manifests, raw results, benchmark evidence, transcripts, cached media, remote jobs, and recorded costs remain intact. Historical identifiers and frozen rate references remain available for reading completed artifacts and reconstructing old estimates; GLM Reader's former Web Search-based estimate remains explicitly historical and unverified. Recorded charges retain precedence over those estimates. Completed provider states may be reused alongside newly selected active targets. An unfinished excluded target, an explicit excluded selection, or obsolete saved configuration fails locally before credential lookup or network dispatch, without changing the old target or selecting a replacement.

On October 17, 2026, the model tuples below were excluded while their providers stay active. They are decisions, not pending additions: provider-model research must not recommend them again unless new primary evidence directly addresses the recorded reason, and restoring one needs a user decision.

<!-- excluded-hosted-models:start -->

**Provider: Cloudflare**

- **Excluded category/model tuples:** `stt/cloudflare/@cf/deepgram/nova-3`
- **Decision:** Removed at the user's direction after the [October 2026 STT benchmarks](../benchmarks/README.md#october-2026-stt-refresh): direct Deepgram `deepgram=nova-3` was about 20% cheaper ($0.258/hr against $0.312/hr) and about 6.6x faster with diarization, with comparable quality (92.82 against 93.60). Cloudflare Whisper models remain.

**Provider: Together**

- **Excluded category/model tuples:** `stt/together/nvidia/nemotron-3.5-asr-streaming-0.6b`, `stt/together/nvidia/nemotron-3-asr-streaming-0.6b`
- **Decision:** Not batch-callable: Together's transcription page lists them, but a 2026-10-17 `POST /v1/audio/transcriptions` request for Nemotron 3.5 returned 400 "This model only supports WebSocket streaming." Streaming transcription is outside current STT dispatch.

<!-- excluded-hosted-models:end -->

These tuples leave selectors, registries, live pricing, defaults, `--all-*` expansion, and examples. Explicit selections fail locally before dispatch. Finished benchmark results for Cloudflare Nova-3 keep their identity, and its rate stays in historical pricing so they remain priced. The rejected Nemotron attempt is retained as an error artifact.

### Complete runtime contract

Adding, replacing, or retiring a selector updates the public contract together: accepted names, published prices and limits, bare-provider defaults, exact `--all-*` membership, model capabilities (modes, voices, languages, formats, durations, resolutions, references, and reasoning), help and examples, price preflight, resume, and the identity kept after active support ends.

A provider or model that can run can also be resumed, and extract follows the STT or OCR route stored for that item. Invalid model or control combinations fail locally before price calculation, credential lookup, or dispatch. A listed model exposes only the controls it implements. A stored result keeps the provider that produced it.

### Lifecycle, defaults, expansion, and retirement

Write and OCR can record a model as active or deprecated, with an optional shutdown date, a concrete replacement in the same service, and whether it may be the bare-provider default or part of `--all-*`. Until a narrower status is recorded, the model stays active and eligible. Selection ignores the current date, including any recorded shutdown date, so one commit always resolves the same target.

Bare-provider selection uses the cheapest active default-eligible model unless a documented provider policy pins one representative. `--all-*` keeps stable registry order and includes only expansion-eligible models. An explicit name stays valid while the model is active or still supported for a transition.

Retired names are rejected for new runs and omitted from defaults, help, current config, and `--all-*`. When a concrete successor exists, the error names it and leaves the stored identity unchanged. Finished manifests and benchmark artifacts keep the model they stored; an unfinished retired target cannot run under the old name, and choosing the successor adds a new target. Historical pricing keeps the rates of removed models so committed runs can be repriced, and the cost recorded on a run remains the authority for that run.

On October 18, 2026, the user retired six write and OCR selectors in favor of already implemented newer options, then removed Kimi and GLM from all active workflows, including Together-hosted writing. Their adapters, model selectors, defaults, config keys, setup credentials, provider links, examples, and live verification definitions are removed, including chapter extraction and comic LLM dispatch. Together STT remains supported. Comic drafting, QA, and revision comparisons default to GPT-6.1 Sol. The active catalog has 11 write routes and 21 hosted OCR routes. Old selections fail locally without dispatch or substitution. Provider-level metadata readers remain so older local manifests stay readable; they do not enable new requests. The dashboard defaults to its current CLI-supported model view, with historical results available through its toggle.

On October 23, 2026, the user removed every remaining trace of those retired write and OCR models, as an exception to the historical-pricing rule above: committed benchmark outputs, receipts, plan entries, report rows, and evidence-archive entries; frozen rates and successor hints; bundled calibration profiles; and their rows in the calibration record below. The write benchmark plan and its remaining receipts were re-pinned to a new fingerprint, so cumulative benchmark costs now cover only retained routes.

Later on October 23, 2026, the user removed six more OCR routes from the implementation and from every benchmark, including all DeepInfra OCR models; DeepInfra remains an STT provider. Bare Mistral OCR now resolves to its newer model and bare Gemini OCR to the cheapest remaining Gemini model. Removed selections fail locally before dispatch, and 15 hosted OCR routes remain. Their OCR calibration profiles and their rows in the calibration record below were removed the same way. Five more OCR routes were removed the same way later that day, leaving one Gemini and one Grok OCR model, which are now their bare-provider defaults, and 10 hosted OCR routes remain. Three more models were then removed from write and OCR entirely, with their calibration rows, leaving 8 write routes and 9 hosted OCR routes.

Also on October 23, 2026, the user removed fal entirely: its image and video models, client, `FAL_API_KEY` credential, frozen rates, the fal-only `--generate-audio` and `--reference-audio` video controls, and its benchmark results. OpenAI `gpt-image-2` was removed from image the same day; comic image generation and revision plans now default to `gpt-image-2.5-flare`. Removed fal selections fail locally before dispatch.

### Pricing provenance

Rates come from dated provider evidence and keep that provider's units and tiers. Context tiers use the published boundaries, a flat rate is recorded only when the provider publishes one, and published cache rates stay on record. Ordinary estimates use the uncached rate unless the planner has trustworthy evidence that a cache applies. Token-priced OCR estimates follow [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md).

Published provider billing is authoritative over an estimate, and recorded provider cost takes precedence over reconstructed historical rates. Estimates and actuals must name retries, reruns, billing variance, quota effects, and any excluded or invalid outputs.

A new model may temporarily reuse the nearest same-family token, latency, or duration heuristic when the registry marks that estimate provisional and keeps published rates separate. An OCR sample calibrates OCR estimates only, one quality or timing sample never changes published rates, and paid calibration is not a prerequisite for a compatibility or lifecycle transition when primary documentation and local mocked contracts prove request support. Promoting a heuristic uses the qualified evidence contract in ADR-008 and the paid-approval rules in [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md).

Bundled OCR token profiles may override individual registry components only for the provider, model, OCR mode, page-count band and effective reasoning policy qualified by that evidence. They are a fallback when no learned local profile exists and identify their source as `calibrated-registry`. A single-page image calibration does not change PDF, CBZ, other page bands, published rates, general write estimates or scheduler timing.

### Normalized reasoning

`--reasoning-effort <default|disabled|minimal|low|medium|high|xhigh|max>` is the public reasoning control for hosted LLM write and OCR, and for commands that dispatch them. Each model states whether reasoning is unsupported, optional, or required, whether `disabled` is legal, and which levels it accepts; unsupported combinations fail before pricing or dispatch. Omitting the flag leaves the model's default unchanged, and explicit `default` sends no override.

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

All 345 planned cases completed, 341 qualified, and 50 OCR policy profiles passed component promotion. This closed the calibration and enum-review follow-ups for the reviewed catalog and measured contexts. General write token and timing heuristics remain provisional: three short summaries cannot establish long-form generation latency or reasoning cost, so the measured policy differences below do not justify a global multiplier. Unmeasured OCR contexts also remain provisional.

#### Provider-contract decisions

Before paid execution, the CLI refreshed 72 primary documents across the reviewed providers. The dated review found no justified ninth public reasoning value. The eight-value definition was centralized across parsing, schemas, persisted profiles and audits, and documented Anthropic/Grok xhigh support was added. These findings describe the September 23 catalog, not a continuing monitoring service.

**Provider: OpenAI**

- **Documented contract and decision:** The reviewed models accept low through max including xhigh. No ultra effort is documented for these API models. Provider `none` is represented by existing `disabled` where supported.
- **Primary source:** [reasoning](https://developers.openai.com/api/docs/guides/reasoning)

**Provider: Anthropic**

- **Documented contract and decision:** Fable 5 accepts xhigh. Adaptive is a thinking mode, not another effort value.
- **Primary source:** [Effort](https://platform.claude.com/docs/en/build-with-claude/effort)

**Provider: xAI**

- **Documented contract and decision:** Grok 4.5 does not accept xhigh.
- **Primary source:** [Reasoning](https://docs.x.ai/developers/model-capabilities/text/reasoning)

**Provider: Gemini**

- **Documented contract and decision:** Existing minimal/low/medium/high vocabulary covers documented model levels; budget and thinking configuration fields are separate controls.
- **Primary source:** [Thinking](https://ai.google.dev/gemini-api/docs/thinking)

#### Implementation lessons

- Forward the reasoning option through the actual `write` and image-document OCR entry points. Live diagnostic runs exposed both handoffs dropping the option, despite accurate price-plan identity and working direct adapter tests.
- Carry Anthropic and Grok xhigh through real adapters. Tests cover omitted, override and explicit default/reset behavior.
- Include Gemini's separately reported thought tokens in billed write completion usage exactly once. Providers whose output totals already include reasoning retain their totals.
- Read xhigh from persisted OCR token profiles and evidence audits. The previous profile reader rejected its own xhigh output.
- Bundle qualified OCR component medians in `src/cli/commands/setup-and-utilities/models/ocr-calibration-profiles.json`. With no learned local profile, an exact provider/model/image/page-band/policy match uses these values and reports `tokenEstimateSource: calibrated-registry`. Components that fail the gate retain their registry estimates. Other contexts do not borrow these profiles. Learned local profiles retain precedence.
- Preserve all completed paid outputs. The runner skips existing receipts/manifests and stops new scheduling on identity mismatch or Anthropic credit rejection. Explicit credit retries require a fresh exact preflight and archive prior rejection receipts; ambiguous failures are never automatically repurchased.

#### Qualification, promotion and limits

The plan contains 345 cases. Each model receives explicit `default`, `low`, and its highest supported effort; non-OpenAI models that additionally expose xhigh receive that level too. The fixtures are three original, fictional English operations reviews: Harbor, Meadow and Summit. Write uses each plaintext source with the `shortSummary` structured preset; OCR uses matching 1020×1320 images, one page per run. This is a small prose calibration corpus, not a ranking benchmark or an exhaustive test of every intermediate effort, disabled mode, language, page layout, context tier or modality.

Qualification requires exactly one full manifest item, matching selected identity and effective policy, finite provider usage and positive timing, recorded usage cost, and a nonempty decoded artifact. Write additionally requires the expected returned model ID and valid structured output. OCR requires one successful provider attempt, one covered image page, agreement between the canonical page and text artifact, and source-text equality after removing case, punctuation and whitespace. Hashes identify artifacts; they do not establish quality. Identical OCR text across providers is expected when the same source is transcribed correctly.

Write qualification establishes transport, identity, usage and structured-artifact integrity. It does not establish summary factual correctness or comparative writing quality. OCR additionally checks normalized text correctness, but not punctuation fidelity or visual layout. No audio or perceptual claims are made. OCR retries, partial results, text errors and policy mismatches cannot supply promoted samples.

For each OCR component, promotion requires at least three distinct healthy sources in the same provider/model/mode/page-band/policy group, every observation on the same side of the registry estimate, and median absolute percentage error greater than 20%, using the observation as denominator. The promoted value is the observed median. Timing measurements include wall-clock variability; this run does not promote scheduler or global latency settings. Published prices and `costMultiplier: 1` remain separate from token-shape calibration.

Four original OCR outputs were excluded for transcription errors; all four belonged to OCR routes removed on October 23, 2026, and their groups remained below the three-source gate. Errors were retained rather than replaced with favorable reruns.

#### Execution and spending

The user explicitly approved all paid commands in advance. The initial 345-case preflight estimated $4.7110. After repairing OCR dispatch and retaining 15 compatible default outputs, the repeat full-plan estimate was $4.5799; that figure includes slots subsequently reused. Anthropic credit exhaustion produced 72 explicit HTTP 400 rejections. After the user confirmed replenishment, their exact retry plan estimated $1.7612. These plans overlap and must not be added as if they were separate complete purchases.

The diagnostic write pilot and 43 OCR runs made before the handoff fixes were recorded separately and excluded from calibration; their recorded costs total $1.1325. The current plan recorded $4.0946 including disqualified outputs, and total recorded usage cost including diagnostics was $5.2272 (totals rounded independently). Recorded costs are usage multiplied by configured rates, not account invoices: cache discounts, introductory tariffs, tax, credits, and unreported billable retries can differ. In particular, Gemini standard registry rates conservatively exceed its temporary introductory tariff. No account invoice was retrieved.

#### Qualified observations and promotions

The complete policy medians are retained because they explain which components changed and which remained provisional. “—” means no component was promoted. Medians use qualified samples only; recorded current-plan cost includes all completed outputs. These are historical observations, not a model ranking.

<details>
<summary>September 23 measurements by route, provider, model and policy</summary>

<!-- reasoning-calibration:start -->
341 of 345 planned samples qualify. Recorded current-plan cost: $4.0946 (includes disqualified completed outputs; excludes earlier diagnostic runs). Rows for write and OCR routes removed on October 23, 2026 were deleted; the counts and cost above still include them.

**Route / provider / model: write / gemini / gemini-3.8-flash**

- **Policy:** default
- **Qualified:** 3/3
- **Median input:** 437
- **Median output:** 421
- **Median ms:** 2496
- **Promoted OCR input / output:** — / —

**Route / provider / model: write / gemini / gemini-3.8-flash**

- **Policy:** low
- **Qualified:** 3/3
- **Median input:** 437
- **Median output:** 38
- **Median ms:** 839
- **Promoted OCR input / output:** — / —

**Route / provider / model: write / gemini / gemini-3.8-flash**

- **Policy:** high
- **Qualified:** 3/3
- **Median input:** 437
- **Median output:** 639
- **Median ms:** 3334
- **Promoted OCR input / output:** — / —

**Route / provider / model: extract / anthropic / claude-fable-5**

- **Policy:** default
- **Qualified:** 3/3
- **Median input:** 2032
- **Median output:** 519
- **Median ms:** 8169
- **Promoted OCR input / output:** — / 519

**Route / provider / model: extract / anthropic / claude-fable-5**

- **Policy:** low
- **Qualified:** 3/3
- **Median input:** 2032
- **Median output:** 519
- **Median ms:** 8357
- **Promoted OCR input / output:** — / 519

**Route / provider / model: extract / anthropic / claude-fable-5**

- **Policy:** max
- **Qualified:** 3/3
- **Median input:** 2032
- **Median output:** 1881
- **Median ms:** 19788
- **Promoted OCR input / output:** — / 1881

**Route / provider / model: extract / anthropic / claude-fable-5**

- **Policy:** xhigh
- **Qualified:** 3/3
- **Median input:** 2032
- **Median output:** 519
- **Median ms:** 8426
- **Promoted OCR input / output:** — / 519

**Route / provider / model: extract / gemini / gemini-3.8-flash**

- **Policy:** default
- **Qualified:** 3/3
- **Median input:** 1179
- **Median output:** 1118
- **Median ms:** 3406
- **Promoted OCR input / output:** — / 1118

**Route / provider / model: extract / gemini / gemini-3.8-flash**

- **Policy:** low
- **Qualified:** 3/3
- **Median input:** 1179
- **Median output:** 340
- **Median ms:** 2054
- **Promoted OCR input / output:** — / 340

**Route / provider / model: extract / gemini / gemini-3.8-flash**

- **Policy:** high
- **Qualified:** 3/3
- **Median input:** 1179
- **Median output:** 4778
- **Median ms:** 17491
- **Promoted OCR input / output:** — / —

<!-- reasoning-calibration:end -->

</details>

#### Provenance and historical verification

The three original Harbor, Meadow and Summit text/image fixtures remain in `test/fixtures/reasoning-calibration/`. The reviewed evidence bundle contained 1,874 original files plus `SHA256SUMS`: exact preflights, per-case manifests, artifacts and execution receipts, credit-rejection history, excluded diagnostic runs, documentation refreshes and fixture inputs. Its integrity check passed before consolidation. The separate report and evidence bundle were retired on September 23 after retaining their decisions, complete policy medians, exclusions, spending and primary-source references here; raw receipts and source-document snapshots are no longer packaged with this ADR. Existing local paid outputs under `output/adr-010-calibration/` were left in place.

Historical verification passed `bun run check` (structure, names, types and documentation contracts covering 415 unique commands), `bun t --price` (97/97 price-only cases), and the since-retired documentation price verifier (15 offline examples). Targeted option resolution, provider selection, reasoning adapters, entry-point dispatch, artifact qualification, OCR token audit, pricing and CLI-help contracts passed 596 tests across 103 files without provider calls. These are the original review results; mocked contracts establish payload behavior, not output quality.

The completed calibration runner and summary generator were retired on September 23, including their investigation-specific credit-rejection retry modes. The policy medians above, bundled `ocr-calibration-profiles.json`, original fixtures, and existing local paid outputs remain. `test/test-cases/validation/reports-pricing/bundled-ocr-calibration-contracts.test.ts` preserves the runtime checks for exact image/page/policy matching and registry fallback. Future calibration requires a new scoped plan under the existing evidence and spending rules; this record no longer advertises a regeneration or paid rerun command.

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

## Follow-up Actions

- [x] Calibrate materially different reasoning levels and provisional model heuristics — September 23: 345 completed cases, 341 qualified samples, 50 scoped OCR token profiles. Write usage and timing are recorded by policy; general write and unmeasured-context heuristics remain explicitly provisional. The [historical calibration record](#reasoning-calibration-and-provider-vocabulary-review-2026-09-23) preserves exclusions, spending, provenance and measurements.
- [x] Evaluate provider-specific reasoning levels outside the eight-value surface through explicit public-enum expansion — September 23: primary-source review found no justified ninth value for registered models. Retain the eight-value enum, centralize its consumers, and expose documented Anthropic/Grok xhigh support. See the [dated evaluation](#provider-contract-decisions) and [expansion gate](#normalized-reasoning).

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
