# ADR-010: Govern Hosted-Model Registry, Lifecycle, and Capability Policy

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-13
- **Date Updated:** 2026-09-25
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

Comic resolves LLM, image, QA, dialogue, and sound-effect models, prices, and hosted generation through these registries and keeps no private model list. Image selections omit fal, text selections match `write`, and QA selections are the vision-capable OpenAI and Gemini models. `--provider` and role-scoped `--<role>-provider` validate central registry IDs; comic domain rules such as target values, grid combinations, and reference-sheet modes are unchanged by registry resolution.

### Concrete selector identity

Register a concrete, stable provider id for a current, generally available model the CLI can run. Leave out moving `*-latest` and preview aliases when a stable id exists, duplicate names for the same model, and free-tier names that differ only in billing. A product with no upstream model id may use one stable AutoShow selector, documented as a local name. An open-weight deployment qualifies only when its version is pinned and the CLI represents its request, output, price, and capability contract.

Routine refreshes leave out products the CLI cannot already run, including domain-specific, streaming, realtime, and reference-audio products; those need their own decision. Hosted image selectors produce raster output. Current siblings and documented quality, latency, or service tiers may coexist, and a newer model leaves a sibling in place when the operations or the price/quality trade-off differ. A superseded generation leaves active selection even if the endpoint still answers.

### Subscription-free API eligibility

Hosted API usage must be available without mandatory recurring fees or recurring minimum spending. Metered billing and one-time prepaid credits qualify. A free allowance followed by subscription-only overages does not qualify. Optional feature subscriptions or discounts do not disqualify independently available core API usage.

Every provider addition and refresh must document route-specific billing eligibility with dated primary sources, including prepaid minimum purchases and expiry where documented. Conflicting or missing evidence remains unresolved. The [retained-provider audit](../reports/provider-pricing-eligibility-audit.md) records policy violations awaiting a separate removal decision; this change does not remove those other integrations.

#### Excluded integrations

On September 25, 2026, the following integrations were removed at the user's direction, including their adapters, selectors, credentials, configuration, historical rates, and committed benchmark records. This policy exclusion supersedes ordinary model retirement and historical-rate retention for these providers. Ignored local inputs, outputs, credentials, and purchased audio remain untouched. Excluded selectors and saved settings fail locally; no compatibility aliases or automatic substitutions are provided.

<!-- excluded-tts-providers:start -->
| Provider  | Model identifiers                                                                                  | Billing evidence                                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hume      | `octave-1`, `octave-2`                                                                             | [Official FAQ](https://dev.hume.ai/docs/text-to-speech-tts/faq): Free and Starter cannot buy additional TTS usage; Creator or higher is required. |
| Cartesia  | `sonic-3.6-2026-08-27`, `sonic-3.5-2026-05-04`, `sonic-3`, `sonic-3.6`, `sonic-preview`, `sonic-2` | [Official pricing](https://www.cartesia.ai/pricing): monthly plans supply model credits and paid subscribers receive overages.                    |
| Speechify | `simba-3.2`, `simba-3.0`, `simba-english`                                                          | [Official API pricing](https://speechify.ai/pricing), rechecked 2026-09-25: Free cannot top up; continued usage requires a paid monthly plan.     |
<!-- excluded-tts-providers:end -->

The removed utterance endpoint was the only implementation of `--tts-trailing-silence`; that flag and its saved configuration key are removed too.

### Complete runtime contract

Adding, replacing, or retiring a selector updates the public contract together: accepted names, published prices and limits, bare-provider defaults, exact `--all-*` membership, model capabilities (modes, voices, languages, formats, durations, resolutions, references, and reasoning), help and examples, price preflight, resume, and the identity kept after active support ends.

A provider or model that can run can also be resumed, and extract follows the STT or OCR route stored for that item. Invalid model or control combinations fail locally before price calculation, credential lookup, or dispatch. A listed model exposes only the controls it implements. A stored result keeps the provider that produced it.

### Lifecycle, defaults, expansion, and retirement

Write and OCR can record a model as active or deprecated, with an optional shutdown date, a concrete replacement in the same service, and whether it may be the bare-provider default or part of `--all-*`. Until a narrower status is recorded, the model stays active and eligible. Selection ignores the current date, including any recorded shutdown date, so one commit always resolves the same target.

Bare-provider selection uses the cheapest active default-eligible model unless a documented provider policy pins one representative. `--all-*` keeps stable registry order and includes only expansion-eligible models. An explicit name stays valid while the model is active or still supported for a transition.

Retired names are rejected for new runs and omitted from defaults, help, current config, and `--all-*`. When a concrete successor exists, the error names it and leaves the stored identity unchanged. Finished manifests and benchmark artifacts keep the model they stored; an unfinished retired target cannot run under the old name, and choosing the successor adds a new target. Historical pricing keeps the rates of removed models so committed runs can be repriced, and the cost recorded on a run remains the authority for that run.

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

Before paid execution, the CLI refreshed 39 primary documents for OpenAI, Anthropic, Kimi, Grok and then 33 for Gemini, GLM, DeepInfra and Together. The dated review found no justified ninth public reasoning value. The eight-value definition was centralized across parsing, schemas, persisted profiles and audits; documented Anthropic/Grok xhigh support was added and unsupported direct Kimi K3 medium was removed. These findings describe the September 23 catalog, not a continuing monitoring service.

| Provider                   | Documented contract and decision                                                                                                                                          | Primary source                                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OpenAI                     | Astra accepts low through max including xhigh. No ultra effort is documented for these API models. Provider `none` is represented by existing `disabled` where supported. | [Astra](https://developers.openai.com/api/docs/models/gpt-6-astra), [reasoning](https://developers.openai.com/api/docs/guides/reasoning)                                             |
| Anthropic                  | Fable 5.1, Fable 5, Sonnet 5 and Opus 5 accept xhigh. Adaptive is a thinking mode, not another effort value. Sonnet 5 standard rates remain $2/$10.                       | [Effort](https://platform.claude.com/docs/en/build-with-claude/effort), [pricing](https://platform.claude.com/docs/en/about-claude/pricing)                                          |
| xAI                        | Grok 4.6 accepts xhigh; Grok 4.5 does not.                                                                                                                                | [Reasoning](https://docs.x.ai/developers/model-capabilities/text/reasoning)                                                                                                          |
| Kimi                       | K3 accepts low, high and max, excluding medium. Explicit default delegates to upstream; omitted CLI effort selects low.                                                   | [Reasoning effort](https://platform.kimi.ai/docs/guide/use-reasoning-effort.md), [K3 repository](https://github.com/MoonshotAI/Kimi-K3/blob/main/README.md)                          |
| Gemini                     | Existing minimal/low/medium/high vocabulary covers documented model levels; budget and thinking configuration fields are separate controls.                               | [Thinking](https://ai.google.dev/gemini-api/docs/thinking)                                                                                                                           |
| GLM / Together / DeepInfra | Reviewed thinking modes, hosted IDs and effort controls; no additional public enum value is substantiated for the selected models.                                        | [GLM thinking](https://docs.z.ai/guides/capabilities/thinking-mode), [Together reasoning](https://docs.together.ai/docs/reasoning), [DeepInfra models](https://deepinfra.com/models) |

Anthropic had canceled its scheduled September price increase, so Sonnet 5 retained standard rates of $2/$10 per million input/output tokens and the stale price explanation was corrected.

#### Implementation lessons

- Forward the reasoning option through the actual `write` and image-document OCR entry points. Live diagnostic runs exposed both handoffs dropping the option, despite accurate price-plan identity and working direct adapter tests.
- Carry Anthropic and Grok xhigh through real adapters. Kimi medium fails locally before credentials or dispatch. Tests cover omitted, override and explicit default/reset behavior.
- Include Gemini's separately reported thought tokens in billed write completion usage exactly once. Providers whose output totals already include reasoning retain their totals.
- Read xhigh from persisted OCR token profiles and evidence audits. The previous profile reader rejected its own xhigh output.
- Bundle qualified OCR component medians in `src/cli/commands/setup-and-utilities/models/ocr-calibration-profiles.json`. With no learned local profile, an exact provider/model/image/page-band/policy match uses these values and reports `tokenEstimateSource: calibrated-registry`. Components that fail the gate retain their registry estimates. Other contexts do not borrow these profiles. Learned local profiles retain precedence.
- Preserve all completed paid outputs. The runner skips existing receipts/manifests and stops new scheduling on identity mismatch or Anthropic credit rejection. Explicit credit retries require a fresh exact preflight and archive prior rejection receipts; ambiguous failures are never automatically repurchased.

#### Qualification, promotion and limits

The plan contains 345 cases. Each model receives explicit `default`, `low`, and its highest supported effort; non-OpenAI models that additionally expose xhigh receive that level too. The fixtures are three original, fictional English operations reviews: Harbor, Meadow and Summit. Write uses each plaintext source with the `shortSummary` structured preset; OCR uses matching 1020×1320 images, one page per run. This is a small prose calibration corpus, not a ranking benchmark or an exhaustive test of every intermediate effort, disabled mode, language, page layout, context tier or modality.

Qualification requires exactly one full manifest item, matching selected identity and effective policy, finite provider usage and positive timing, recorded usage cost, and a nonempty decoded artifact. Write additionally requires the expected returned model ID and valid structured output. OCR requires one successful provider attempt, one covered image page, agreement between the canonical page and text artifact, and source-text equality after removing case, punctuation and whitespace. Hashes identify artifacts; they do not establish quality. Identical OCR text across providers is expected when the same source is transcribed correctly.

Write qualification establishes transport, identity, usage and structured-artifact integrity. It does not establish summary factual correctness or comparative writing quality. OCR additionally checks normalized text correctness, but not punctuation fidelity or visual layout. No audio or perceptual claims are made. OCR retries, partial results, text errors and policy mismatches cannot supply promoted samples.

For each OCR component, promotion requires at least three distinct healthy sources in the same provider/model/mode/page-band/policy group, every observation on the same side of the registry estimate, and median absolute percentage error greater than 20%, using the observation as denominator. The promoted value is the observed median. Timing measurements include wall-clock variability; this run does not promote scheduler or global latency settings. Published prices and `costMultiplier: 1` remain separate from token-shape calibration.

Four original OCR outputs were excluded: Gemma 4 default/high changed “downloaded” to “download” in Meadow; Terra low changed Harbor's 7600 to 3600; Terra max changed Summit's “could” to “can”. The corresponding groups remain below the three-source gate. Errors were retained rather than replaced with favorable reruns.

#### Execution and spending

The user explicitly approved all paid commands in advance. The initial 345-case preflight estimated $4.7110. After repairing OCR dispatch and retaining 15 compatible default outputs, the repeat full-plan estimate was $4.5799; that figure includes slots subsequently reused. Anthropic credit exhaustion produced 72 explicit HTTP 400 rejections. After the user confirmed replenishment, their exact retry plan estimated $1.7612. These plans overlap and must not be added as if they were separate complete purchases.

The diagnostic write pilot and 43 OCR runs made before the handoff fixes were recorded separately and excluded from calibration; their recorded costs total $1.1325. The current plan recorded $4.0946 including disqualified outputs, and total recorded usage cost including diagnostics was $5.2272 (totals rounded independently). Recorded costs are usage multiplied by configured rates, not account invoices: cache discounts, introductory tariffs, tax, credits, and unreported billable retries can differ. In particular, Gemini standard registry rates conservatively exceed its temporary introductory tariff. No account invoice was retrieved.

#### Qualified observations and promotions

The complete policy medians are retained because they explain which components changed and which remained provisional. “—” means no component was promoted. Medians use qualified samples only; recorded current-plan cost includes all completed outputs. These are historical observations, not a model ranking.

<details>
<summary>September 23 measurements by route, provider, model and policy</summary>

<!-- reasoning-calibration:start -->
341 of 345 planned samples qualify. Recorded current-plan cost: $4.0946 (includes disqualified completed outputs; excludes earlier diagnostic runs).

| Route / provider / model                              | Policy  | Qualified | Median input | Median output | Median ms | Promoted OCR input / output |
| ----------------------------------------------------- | ------- | --------- | ------------ | ------------- | --------- | --------------------------- |
| write / openai / gpt-6-astra                          | default | 3/3       | 427          | 41            | 2120      | — / —                       |
| write / openai / gpt-6-astra                          | low     | 3/3       | 427          | 43            | 2394      | — / —                       |
| write / openai / gpt-6-astra                          | max     | 3/3       | 427          | 673           | 9446      | — / —                       |
| write / openai / gpt-5.6-sol                          | default | 3/3       | 427          | 42            | 1527      | — / —                       |
| write / openai / gpt-5.6-sol                          | low     | 3/3       | 427          | 41            | 1845      | — / —                       |
| write / openai / gpt-5.6-sol                          | max     | 3/3       | 427          | 137           | 2298      | — / —                       |
| write / openai / gpt-5.6-terra                        | default | 3/3       | 427          | 43            | 1528      | — / —                       |
| write / openai / gpt-5.6-terra                        | low     | 3/3       | 427          | 44            | 1553      | — / —                       |
| write / openai / gpt-5.6-terra                        | max     | 3/3       | 427          | 124           | 1928      | — / —                       |
| write / openai / gpt-5.6-luna                         | default | 3/3       | 427          | 111           | 1692      | — / —                       |
| write / openai / gpt-5.6-luna                         | low     | 3/3       | 427          | 105           | 1709      | — / —                       |
| write / openai / gpt-5.6-luna                         | max     | 3/3       | 427          | 181           | 2116      | — / —                       |
| write / gemini / gemini-3.8-flash                     | default | 3/3       | 437          | 421           | 2496      | — / —                       |
| write / gemini / gemini-3.8-flash                     | low     | 3/3       | 437          | 38            | 839       | — / —                       |
| write / gemini / gemini-3.8-flash                     | high    | 3/3       | 437          | 639           | 3334      | — / —                       |
| write / gemini / gemini-3.7-flash                     | default | 3/3       | 437          | 309           | 2553      | — / —                       |
| write / gemini / gemini-3.7-flash                     | low     | 3/3       | 437          | 34            | 2112      | — / —                       |
| write / gemini / gemini-3.7-flash                     | high    | 3/3       | 437          | 549           | 2721      | — / —                       |
| write / anthropic / claude-fable-5-1                  | default | 3/3       | 888          | 68            | 4290      | — / —                       |
| write / anthropic / claude-fable-5-1                  | low     | 3/3       | 888          | 65            | 3925      | — / —                       |
| write / anthropic / claude-fable-5-1                  | max     | 3/3       | 888          | 1052          | 12548     | — / —                       |
| write / anthropic / claude-fable-5-1                  | xhigh   | 3/3       | 888          | 530           | 10248     | — / —                       |
| write / anthropic / claude-sonnet-5                   | default | 3/3       | 886          | 60            | 1936      | — / —                       |
| write / anthropic / claude-sonnet-5                   | low     | 3/3       | 886          | 60            | 3066      | — / —                       |
| write / anthropic / claude-sonnet-5                   | max     | 3/3       | 886          | 66            | 2130      | — / —                       |
| write / anthropic / claude-sonnet-5                   | xhigh   | 3/3       | 886          | 60            | 2409      | — / —                       |
| write / anthropic / claude-opus-5                     | default | 3/3       | 886          | 76            | 2558      | — / —                       |
| write / anthropic / claude-opus-5                     | low     | 3/3       | 886          | 71            | 2435      | — / —                       |
| write / anthropic / claude-opus-5                     | max     | 3/3       | 886          | 80            | 2404      | — / —                       |
| write / anthropic / claude-opus-5                     | xhigh   | 3/3       | 886          | 90            | 2210      | — / —                       |
| write / grok / grok-4.6                               | default | 3/3       | 1102         | 39            | 37823     | — / —                       |
| write / grok / grok-4.6                               | low     | 3/3       | 1102         | 41            | 4138      | — / —                       |
| write / grok / grok-4.6                               | xhigh   | 3/3       | 1103         | 37            | 44650     | — / —                       |
| write / glm / glm-5.3                                 | default | 3/3       | 472          | 1083          | 22459     | — / —                       |
| write / glm / glm-5.3                                 | low     | 3/3       | 472          | 42            | 3400      | — / —                       |
| write / glm / glm-5.3                                 | max     | 3/3       | 472          | 995           | 17651     | — / —                       |
| write / glm / glm-5.3-flash                           | default | 3/3       | 472          | 1305          | 35559     | — / —                       |
| write / glm / glm-5.3-flash                           | low     | 3/3       | 472          | 48            | 1693      | — / —                       |
| write / glm / glm-5.3-flash                           | max     | 3/3       | 472          | 1184          | 10878     | — / —                       |
| write / kimi / kimi-k3                                | default | 3/3       | 529          | 665           | 20304     | — / —                       |
| write / kimi / kimi-k3                                | low     | 3/3       | 530          | 159           | 7518      | — / —                       |
| write / kimi / kimi-k3                                | max     | 3/3       | 529          | 264           | 10578     | — / —                       |
| write / together / kimi-k3                            | default | 3/3       | 577          | 210           | 2215      | — / —                       |
| write / together / kimi-k3                            | low     | 3/3       | 578          | 139           | 1718      | — / —                       |
| write / together / kimi-k3                            | max     | 3/3       | 577          | 532           | 4680      | — / —                       |
| write / together / glm-5.3                            | default | 3/3       | 411          | 39            | 978       | — / —                       |
| write / together / glm-5.3                            | low     | 3/3       | 411          | 37            | 570       | — / —                       |
| write / together / glm-5.3                            | max     | 3/3       | 411          | 36            | 338       | — / —                       |
| write / together / glm-5.3-flash                      | default | 3/3       | 411          | 1096          | 17408     | — / —                       |
| write / together / glm-5.3-flash                      | low     | 3/3       | 411          | 44            | 1042      | — / —                       |
| write / together / glm-5.3-flash                      | max     | 3/3       | 411          | 1110          | 21600     | — / —                       |
| extract / anthropic / claude-fable-5-1                | default | 3/3       | 2034         | 519           | 8987      | — / 519                     |
| extract / anthropic / claude-fable-5-1                | low     | 3/3       | 2034         | 519           | 8963      | — / 519                     |
| extract / anthropic / claude-fable-5-1                | max     | 3/3       | 2034         | 519           | 9409      | — / 519                     |
| extract / anthropic / claude-fable-5-1                | xhigh   | 3/3       | 2034         | 519           | 9149      | — / 519                     |
| extract / anthropic / claude-fable-5                  | default | 3/3       | 2032         | 519           | 8169      | — / 519                     |
| extract / anthropic / claude-fable-5                  | low     | 3/3       | 2032         | 519           | 8357      | — / 519                     |
| extract / anthropic / claude-fable-5                  | max     | 3/3       | 2032         | 1881          | 19788     | — / 1881                    |
| extract / anthropic / claude-fable-5                  | xhigh   | 3/3       | 2032         | 519           | 8426      | — / 519                     |
| extract / anthropic / claude-sonnet-5                 | default | 3/3       | 2032         | 481           | 5874      | — / —                       |
| extract / anthropic / claude-sonnet-5                 | low     | 3/3       | 2032         | 481           | 5701      | — / —                       |
| extract / anthropic / claude-sonnet-5                 | max     | 3/3       | 2032         | 1089          | 9544      | — / 1089                    |
| extract / anthropic / claude-sonnet-5                 | xhigh   | 3/3       | 2032         | 516           | 5795      | — / —                       |
| extract / anthropic / claude-opus-5                   | default | 3/3       | 2032         | 498           | 7511      | — / —                       |
| extract / anthropic / claude-opus-5                   | low     | 3/3       | 2032         | 498           | 8365      | — / —                       |
| extract / anthropic / claude-opus-5                   | max     | 3/3       | 2032         | 498           | 8049      | — / —                       |
| extract / anthropic / claude-opus-5                   | xhigh   | 3/3       | 2032         | 498           | 8329      | — / —                       |
| extract / deepinfra / google/gemma-4-31B-it           | default | 2/3       | 338          | 308           | 10952     | — / —                       |
| extract / deepinfra / google/gemma-4-31B-it           | low     | 3/3       | 341          | 812           | 22077     | 341 / —                     |
| extract / deepinfra / google/gemma-4-31B-it           | high    | 2/3       | 341          | 896           | 24499     | — / —                       |
| extract / deepinfra / Qwen/Qwen3.8-27B                | default | 3/3       | 1383         | 307           | 9579      | 1383 / 307                  |
| extract / deepinfra / Qwen/Qwen3.8-27B                | low     | 3/3       | 1411         | 353           | 11623     | 1411 / 353                  |
| extract / deepinfra / Qwen/Qwen3.8-27B                | high    | 3/3       | 1423         | 328           | 9078      | 1423 / 328                  |
| extract / deepinfra / deepseek-ai/DeepSeek-V4.1-Flash | default | 3/3       | 898          | 294           | 3635      | 898 / 294                   |
| extract / deepinfra / deepseek-ai/DeepSeek-V4.1-Flash | low     | 3/3       | 924          | 366           | 6080      | — / 366                     |
| extract / deepinfra / deepseek-ai/DeepSeek-V4.1-Flash | high    | 3/3       | 924          | 402           | 4366      | — / 402                     |
| extract / gemini / gemini-3.8-flash                   | default | 3/3       | 1179         | 1118          | 3406      | — / 1118                    |
| extract / gemini / gemini-3.8-flash                   | low     | 3/3       | 1179         | 340           | 2054      | — / 340                     |
| extract / gemini / gemini-3.8-flash                   | high    | 3/3       | 1179         | 4778          | 17491     | — / —                       |
| extract / gemini / gemini-3.7-flash                   | default | 3/3       | 1179         | 1073          | 4516      | — / 1073                    |
| extract / gemini / gemini-3.7-flash                   | low     | 3/3       | 1179         | 656           | 2564      | — / 656                     |
| extract / gemini / gemini-3.7-flash                   | high    | 3/3       | 1179         | 1224          | 4101      | — / 1224                    |
| extract / gemini / gemini-3.5-flash                   | default | 3/3       | 1179         | 1738          | 7390      | — / 1738                    |
| extract / gemini / gemini-3.5-flash                   | low     | 3/3       | 1179         | 340           | 2040      | — / 340                     |
| extract / gemini / gemini-3.5-flash                   | high    | 3/3       | 1179         | 1855          | 6525      | — / 1855                    |
| extract / gemini / gemini-3.6-flash                   | default | 3/3       | 1179         | 2038          | 8990      | — / 2038                    |
| extract / gemini / gemini-3.6-flash                   | low     | 3/3       | 1179         | 324           | 2266      | — / 324                     |
| extract / gemini / gemini-3.6-flash                   | high    | 3/3       | 1179         | 2377          | 10286     | — / 2377                    |
| extract / gemini / gemini-3.5-flash-lite              | default | 3/3       | 1179         | 340           | 1670      | — / 340                     |
| extract / gemini / gemini-3.5-flash-lite              | low     | 3/3       | 1179         | 294           | 1639      | — / 294                     |
| extract / gemini / gemini-3.5-flash-lite              | high    | 3/3       | 1179         | 1054          | 3224      | — / —                       |
| extract / glm / glm-5.3-flash                         | default | 3/3       | 1828         | 309           | 6405      | 1828 / 309                  |
| extract / glm / glm-5.3-flash                         | low     | 3/3       | 1828         | 280           | 6692      | 1828 / 280                  |
| extract / glm / glm-5.3-flash                         | max     | 3/3       | 1828         | 318           | 6130      | 1828 / 318                  |
| extract / grok / grok-4.5                             | default | 3/3       | 1934         | 277           | 5172      | 1934 / 277                  |
| extract / grok / grok-4.5                             | low     | 3/3       | 1934         | 295           | 14662     | 1934 / 295                  |
| extract / grok / grok-4.5                             | high    | 3/3       | 1934         | 277           | 10739     | 1934 / 277                  |
| extract / grok / grok-4.6                             | default | 3/3       | 2076         | 295           | 25855     | 2076 / 295                  |
| extract / grok / grok-4.6                             | low     | 3/3       | 2076         | 284           | 10399     | 2076 / 284                  |
| extract / grok / grok-4.6                             | xhigh   | 3/3       | 2077         | 295           | 27887     | 2077 / 295                  |
| extract / kimi / kimi-k3                              | default | 3/3       | 1957         | 920           | 30026     | 1957 / 920                  |
| extract / kimi / kimi-k3                              | low     | 3/3       | 1958         | 664           | 21640     | 1958 / 664                  |
| extract / kimi / kimi-k3                              | max     | 3/3       | 1957         | 731           | 20627     | 1957 / 731                  |
| extract / openai / gpt-6-astra                        | default | 3/3       | 1682         | 294           | 3985      | — / 294                     |
| extract / openai / gpt-6-astra                        | low     | 3/3       | 1682         | 294           | 4467      | — / 294                     |
| extract / openai / gpt-6-astra                        | max     | 3/3       | 1682         | 820           | 9051      | — / —                       |
| extract / openai / gpt-5.6-sol                        | default | 3/3       | 1682         | 294           | 3360      | — / 294                     |
| extract / openai / gpt-5.6-sol                        | low     | 3/3       | 1682         | 294           | 2270      | — / 294                     |
| extract / openai / gpt-5.6-sol                        | max     | 3/3       | 1682         | 727           | 4487      | — / 727                     |
| extract / openai / gpt-5.6-terra                      | default | 3/3       | 1682         | 294           | 2330      | — / 294                     |
| extract / openai / gpt-5.6-terra                      | low     | 2/3       | 1682         | 296.5         | 2253      | — / —                       |
| extract / openai / gpt-5.6-terra                      | max     | 2/3       | 1682         | 1318          | 8362      | — / —                       |
| extract / openai / gpt-5.6-luna                       | default | 3/3       | 1682         | 638           | 4237      | — / 638                     |
| extract / openai / gpt-5.6-luna                       | low     | 3/3       | 1682         | 291           | 3074      | — / 291                     |
| extract / openai / gpt-5.6-luna                       | max     | 3/3       | 1682         | 1278          | 5739      | — / 1278                    |
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
- [x] Evaluate provider-specific reasoning levels outside the eight-value surface through explicit public-enum expansion — September 23: primary-source review found no justified ninth value for registered models. Retain the eight-value enum, centralize its consumers, expose documented Anthropic/Grok xhigh support, and reject unsupported Kimi K3 medium. See the [dated evaluation](#provider-contract-decisions) and [expansion gate](#normalized-reasoning).

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
