# ADR-011: Refresh Current Hosted OpenAI, Anthropic, xAI, Google, and Moonshot Models

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-13
- **Date Updated:** 2026-08-12
- **Verification Status:** Passed

The 2026-07-24 Google Gemini, Moonshot Kimi, and Claude Opus 5 additions are implemented and verified against `bun run check` and the targeted local contract suites. The previously blocked hosted OCR `--price` subprocess contracts were rerun successfully on 2026-08-03 after `runtime/` was provisioned. An approved one-page Kimi K3 write probe also confirmed the request shape and provider usage reporting. On 2026-08-12, ADR-017 added typed reasoning capabilities and request mappings across the hosted LLM and OCR registries, and the current official GPT-5.6 Terra and Luna token rates were synchronized across write, OCR, documentation, and pricing contracts. Provisional Gemini, Claude, and Kimi heuristics remain deferred pending separately approved calibration.

## Context

AutoShow's text/write and OCR/extract registries are public CLI surfaces. They determine accepted selectors, exported model unions, all-provider expansion, cheapest-model defaults, price preflight, post-run cost reporting, and the central model list used by comic generation, song-lyrics presets, and every other structured prompt consumer.

This record covers a rolling refresh of generally available hosted models across five providers.

The original 2026-07-13 scope covered three providers:

- OpenAI documents concrete GPT-5.6 tiers `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna`; `gpt-5.6` is an alias for Sol.
- Anthropic documents Claude Fable 5 as generally available and Claude Mythos 5 as limited availability. Claude Sonnet 5 was already an OCR model but was absent from text/write.
- xAI documents `grok-4.5` as a current text-and-image Chat API model with a 500K context window. AutoShow already used the same OpenAI-compatible Grok chat path for text and OCR, but initially exposed Grok 4.5 only for OCR.

xAI publishes Grok 4.5 standard rates of `$2 / $0.30 / $6` per 1M input/cached-input/output tokens through 200K input tokens and `$4 / $0.60 / $12` above 200K. The original OCR metadata incorrectly recorded the short-context cached rate as `$0.50` and represented the long-context tier only as a provisional note.

A 2026-07-13 OCR resume run across 14 historical benchmark directories also supplied calibration evidence for GPT-5.6 OCR and Claude Fable 5 OCR. The selected-provider total was about $4.76 over 39 pages versus an earlier estimate of about $2.81, primarily because copied OpenAI multipliers near 0.27–0.29 understated GPT-5.6 OCR. This evidence applies only to those OCR heuristics; published token rates and text/write timing estimates remain separate.

The 2026-07-24 scope adds two more providers and one further Anthropic tier:

- Google documents `gemini-3.6-flash` and `gemini-3.5-flash-lite` as generally available since 2026-07-21, and `gemini-3.5-flash` as generally available since 2026-05-19. All three accept text, image, video, audio, and PDF input, support structured outputs, and provide a 1,048,576-token input window with 65,536 output tokens. AutoShow's registry still topped out at the Gemini 3.1 family, and `gemini-3.5-flash` was registered for OCR only — the same write/OCR asymmetry this ADR already closed for Grok 4.5. Google also lists `gemini-3.1-flash-lite`, AutoShow's current cheapest Gemini selector, with a 2027-05-07 shutdown date and `gemini-3.5-flash-lite` as its recommended replacement.
- Moonshot documents `kimi-k3` as its flagship model with a 1M-token context window and native visual understanding. AutoShow already ships a complete Kimi provider for both write and OCR but exposed only `kimi-k2.6`. Kimi K3 differs from the K2.x line in one API-visible way: thinking is always on and cannot be disabled, so the `thinking` request field that AutoShow's Kimi clients currently hardcode is rejected. K3 instead exposes a top-level `reasoning_effort` field defaulting to `max`.
- Anthropic documents `claude-opus-5` as generally available to all Claude API customers, with a 1M-token context window, 128K maximum output tokens, vision support, and thinking on by default. `claude-mythos-5` is the other new model ID but remains invitation-only through Project Glasswing.

Google also announced API changes that begin with Gemini 3.6 Flash and 3.5 Flash-Lite and apply to all future Gemini generations: `temperature`, `top_p`, and `top_k` are deprecated and ignored, prefilled model turns return HTTP 400, `thinking_budget` is replaced by the `thinking_level` string enum, and `candidate_count` is unsupported.

Why now: users need concrete, current model selectors across write and document workflows, price reports need the providers' published pricing bands, and three providers have shipped generally available models that the registry cannot select — without changing stable defaults or provider clients.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Add current GA models additively across write and OCR** | Preserves configs and benchmark reruns; exposes current concrete IDs; keeps defaults stable | Adds paid targets to all-provider expansion | Adds 3 OpenAI write and OCR IDs, 2 Anthropic write IDs, 1 Anthropic OCR ID, Grok 4.5 to write, 3 Gemini write IDs, 2 Gemini OCR IDs, 1 Anthropic write and OCR ID for Opus 5, and 1 Kimi write and OCR ID |
| Add only text/write models | Keeps OCR expansion smaller | Leaves document extraction inconsistent | Omits current vision-capable models |
| Replace older selectors | Shorter lists | Breaks configs, historical outputs, and reruns | Removes accepted public interfaces |
| Add aliases such as `gpt-5.6`, `grok-4.5-latest`, `grok-build-latest`, or `gemini-flash-latest` | Mirrors provider convenience names | Duplicates or moves targets in all-model runs and undermines reproducible pricing | At least 1 duplicate or moving selector per alias |
| Include Claude Mythos 5 | Matches another documented ID | Presents limited availability as self-serve GA | Adds 1 restricted model |
| Keep Grok 4.5 OCR-only | Avoids another write target | Artificially excludes a text-capable model already supported by the Grok client | Adds 0 write selectors |
| Replace Grok 4.3 with Grok 4.5 as the default | Promotes the newest model | Changes bare-selector behavior and raises default estimated cost | Grok 4.5 standard input/output rates exceed Grok 4.3 |
| Register `gemini-3-flash-preview` alongside `gemini-3.5-flash` | Matches another documented ID | Duplicates the stable model it previews and moves with each release | Adds 1 duplicate selector |
| Send `reasoning_effort` on Kimi K3 | Bounds K3 output tokens and latency | Invents a per-model policy ahead of the general thinking-configuration surface | 1 hardcoded value that a future flag would immediately supersede |
| Promote Gemini 3.5 Flash-Lite, Claude Opus 5, or Kimi K3 to bare-selector defaults | Tracks each provider's newest tier | Changes bare-selector behavior and raises default estimated cost | Each new model's combined input plus output rate exceeds the incumbent cheapest model |

## Decision

Add current generally available concrete OpenAI, Anthropic, xAI, Google, and Moonshot model IDs additively across the applicable write and OCR registries.

For OpenAI:

- Add `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna` to write and OCR.
- Do not register the duplicate `gpt-5.6` alias.

For Anthropic:

- Add `claude-fable-5` and `claude-sonnet-5` to write.
- Add `claude-fable-5` to OCR.
- Add `claude-opus-5` to write and OCR.
- Do not register limited-availability Claude Mythos 5.

For xAI:

- Keep `grok-4.5` in OCR and add it to `SUPPORTED_GROK_MODELS` and the LLM registry.
- Do not accept aliases including `grok-4.5-latest` and `grok-build-latest`.
- Preserve `grok-4.3` as the bare `--llm grok` selector and cheapest Grok default.
- Expand `--all-llm` in stable Grok order: `grok-4.3`, then `grok-4.5`.
- Use explicit short- and long-context Grok 4.5 pricing bands in both registries. Estimates use uncached standard rates.
- Reuse Grok 4.3's write heuristic of `11,318 ms/1K tokens` and `costMultiplier: 1`.
- Retain the existing provisional Grok 4.5 OCR page heuristic until a separately approved paid calibration is available.

For Google:

- Add `gemini-3.6-flash`, `gemini-3.5-flash`, and `gemini-3.5-flash-lite` to write.
- Add `gemini-3.6-flash` and `gemini-3.5-flash-lite` to OCR, where `gemini-3.5-flash` is already registered.
- Do not register `gemini-3-flash-preview` or any `*-latest` alias.
- Use flat published Standard rates with no context tiers, because Google publishes none for these models: `$1.50 / $7.50` for Gemini 3.6 Flash, `$1.50 / $9.00` for Gemini 3.5 Flash, and `$0.30 / $2.50` for Gemini 3.5 Flash-Lite per 1M input/output tokens.
- Preserve `gemini-3.1-flash-lite` as the cheapest Gemini write and OCR default.

For Moonshot:

- Add `kimi-k3` to write and OCR.
- Use published rates of `$3.00 / $0.30 / $15.00` per 1M input/cache-hit-input/output tokens. Estimates use uncached input rates.
- Preserve `kimi-k2.6` as the cheapest Kimi write and OCR default.
- Omit the `thinking` request field for `kimi-k3` in both the write and OCR Kimi clients, and continue sending `thinking: { type: 'disabled' }` for the K2.x line.
- Do not send `reasoning_effort`; accept the provider default until a general thinking-configuration surface exists.

The existing OpenAI-compatible Grok client and request shape remain unchanged because they already support plain text and structured-output calls, while the OCR path already supports image input. The Gemini and Anthropic clients also remain unchanged: `run-gemini.ts` never sends the now-deprecated `temperature`, `top_p`, `top_k`, or `thinking_budget` fields and never prefills a model turn, `run-gemini-ocr.ts` already emits the current `thinkingConfig.thinkingLevel` string enum for every `gemini-3` model, and `anthropic-compatible.ts` sends no `thinking` or `effort` field, so Claude Opus 5's defaults apply as documented.

## API / Type Impact

- `--llm openai=<model>` and `--provider openai=<model>` accept the three concrete GPT-5.6 tiers.
- `--llm anthropic=<model>` accepts Claude Fable 5, Claude Sonnet 5, and Claude Opus 5; OCR accepts Claude Fable 5 and Claude Opus 5.
- `--llm grok=grok-4.5` and central-registry consumers such as comic `--llm-model grok-4.5` are valid.
- `--llm gemini=<model>` accepts `gemini-3.6-flash`, `gemini-3.5-flash`, and `gemini-3.5-flash-lite`; `--provider gemini=<model>` additionally accepts `gemini-3.6-flash` and `gemini-3.5-flash-lite`.
- `--llm kimi=kimi-k3` and `--provider kimi=kimi-k3` are valid.
- `SUPPORTED_GROK_MODELS`, `SUPPORTED_GEMINI_MODELS`, `SUPPORTED_ANTHROPIC_MODELS`, `SUPPORTED_KIMI_MODELS`, and their OCR counterparts and derived model unions include the new IDs.
- `--all-llm` includes `grok-4.3` followed by `grok-4.5`. Every other new ID is appended after the provider's existing entries so established expansion order is unchanged.
- Bare selection, cheapest-model resolution, environment variables, provider-client APIs, config schemas, and existing selectors remain unchanged for every provider.

## Rationale

- Concrete IDs keep all-provider runs and pricing output reproducible and prevent alias duplication.
- Additive registration avoids breaking historical configurations and benchmark evidence.
- Appending rather than reordering keeps `--all-llm` and `--all-ocr` expansion order stable for existing configs and reruns.
- Keeping Grok 4.3, Gemini 3.1 Flash-Lite, Claude Haiku 4.5, and Kimi K2.6 as their providers' cheapest defaults preserves established behavior and the lower-cost default. Cheapest-model resolution is computed from the registry, and every model added here is strictly more expensive than the incumbent it would have to displace.
- The shared Grok, Gemini, and Anthropic clients already have the required text, vision, and structured-output behavior, so a registry change is sufficient for those providers.
- Explicit pricing bands let the common token-cost helper select rates from estimated or observed input counts for both preflight and actual costs, and flat rates are used where the provider publishes no tiers.
- Excluding Claude Mythos 5 keeps the selector surface generally available.
- Registering `gemini-3.5-flash-lite` gives the announced replacement for `gemini-3.1-flash-lite` a selector well before that model's 2027-05-07 shutdown, without moving the default early.
- Omitting the `thinking` field for Kimi K3 is the minimum change that makes the model callable, and it leaves the request shape clean for a future cross-provider thinking-configuration flag rather than encoding a per-model policy that the flag would immediately supersede.
- OCR-only calibration evidence should not be used to invent text/write timing data.

## Consequences

Positive outcomes:

- Current OpenAI, Anthropic, xAI, Google, and Moonshot models are selectable in the workflows their modalities support.
- Grok 4.5 is available to normal write and comic structured-output consumers.
- Gemini 3.5 Flash is selectable for write instead of OCR only, closing the last write/OCR asymmetry in the Gemini registry.
- Kimi K3 and Claude Opus 5 reach every central-registry consumer, including comic `--llm-model`, song-lyrics and other structured presets, price preflight, and cost reporting.
- Estimated and actual Grok 4.5 costs use the same published 200K boundary.
- Cached-rate provenance is recorded accurately even though estimates use uncached rates.
- Existing defaults and client integrations remain stable.

Negative outcomes:

- All-provider write and OCR runs contain more paid targets.
- Model lists and help documentation are longer.
- Claude Fable 5 has 30-day retention and is not ZDR-compatible.
- Grok 4.5 OCR page-level cost and latency estimates remain heuristic pending approved calibration.
- Gemini 3.6/3.5, Claude Opus 5, and Kimi K3 write and OCR estimates reuse same-family heuristics and are provisional for the same reason.
- Kimi K3 runs with always-on thinking at the provider's default `reasoning_effort` of `max`, so reused Kimi K2.6 output-token and latency heuristics are optimistic until calibrated.
- The Kimi clients now branch on model ID to decide whether to send `thinking`, which is duplicated policy that the planned thinking-configuration ADR should absorb.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Current GA model coverage across five providers | Larger paid all-provider expansions |
| Reproducible concrete selectors | No moving provider aliases |
| Stable defaults and old selectors | Newest model is never the bare provider default |
| Published context-tier costs where they exist | Cached rates are provenance only; normal estimates remain uncached |
| Shared existing provider clients | Model-specific write timing awaits calibration |
| Kimi K3 callable with a one-line client change | A model-ID branch in two Kimi clients until the thinking-configuration surface lands |

## Implementation Evidence

- Model selectors live in `llm-models.ts` and `ocr-models.ts`.
- LLM and OCR pricing metadata live in `llm-config.json` and the provider-specific OCR configuration files.
- OpenAI OCR's structured-output allowlist includes the concrete GPT-5.6 tier IDs.
- GPT-5.6 OCR calibrated heuristics are: Sol 1,625 input/940 output tokens and 9,497 ms per page; Terra 1,625/743 and 5,349 ms; Luna 1,625/858 and 3,919 ms. Each uses multiplier 1.
- On 2026-08-12, the duplicated GPT-5.6 Terra write/OCR rates were refreshed to $2/1M input and $12/1M output tokens, and Luna to $0.20/1M input and $1.20/1M output tokens, from the current official model pages. Token and latency heuristics were not recalibrated.
- Claude Fable 5 OCR uses 2,024 input/869 output tokens, 11,827 ms per page, and multiplier 1.
- Grok 4.5 LLM uses `$2/$0.30/$6` through 200K input tokens and `$4/$0.60/$12` above 200K, with the Grok 4.3 write timing heuristic.
- Grok 4.5 OCR uses the same bands and retains its existing 4,000 input/1,000 output tokens, 18,000 ms per page, multiplier 1 heuristic.
- Provisional heuristics for the 2026-07-24 additions reuse the nearest same-family model:

| New model | Surface | Reuses | Heuristic |
|---|---|---|---|
| `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite` | write | `gemini-3.1-flash-lite` | `costMultiplier: 0.8395`, `msPer1KTokens: 2537` |
| `gemini-3.6-flash`, `gemini-3.5-flash-lite` | OCR | `gemini-3.1-flash-lite` | 1,157 input/1,626 output tokens, 2,921 ms per page |
| `claude-opus-5` | write | `claude-opus-4-8` | `costMultiplier: 1`, `msPer1KTokens: 4524` |
| `claude-opus-5` | OCR | `claude-opus-4-8` | that model's tokens per page and ms per page |
| `kimi-k3` | write | `kimi-k2.6` | `costMultiplier: 1`, `msPer1KTokens: 11215` |
| `kimi-k3` | OCR | `kimi-k2.6` | 4,265 input/516 output tokens, 16,355 ms per page |

- Kimi K3's `pricingNotes` records that always-on thinking at the default `max` reasoning effort makes the reused Kimi K2.6 output-token and latency heuristics optimistic.
- Selector, expansion, comic registry, CLI help, local price-only, provenance, and estimated/actual pricing contracts cover the public behavior.
- After the repository `runtime/` tree was provisioned, `bun test test/test-cases/validation/cli/cli-usage-errors.test.ts` passed all 64 contracts and `bun test test/test-cases/validation/reports-pricing/price-mode-contracts/cli-price-mode.test.ts` passed all 31 contracts. These local `--price` subprocess runs included current Kimi, Grok, OpenAI, and Anthropic OCR selectors plus hosted OCR PDF page detection and made no provider calls.
- The explicitly approved `bun autoshow write input/examples/document/1-document.pdf --llm kimi=kimi-k3 --prompt shortSummary` probe completed successfully on 2026-08-03. Kimi reported 661 input tokens and 159 output tokens, producing an actual provider-usage cost of `0.437¢` against the `0.540¢` estimate and confirming that the K3 request succeeds without the rejected K2.x `thinking` field.
- The cross-provider thinking and reasoning-effort configuration decision is implemented separately in [ADR-017](ADR-017-normalize-cross-provider-reasoning-configuration.md). Its capability and request-mapping integration is complete; paid calibration remains outside this accepted model-refresh decision.

The structural legacy program's W10.1 MiniMax gate was answered from published documentation on 2026-08-10 without a provider request. MiniMax's current [OpenAI-compatible Chat Completions API](https://platform.minimax.io/docs/api-reference/text-chat-openai) enumerates AutoShow's active `MiniMax-M3` selector, but its documented request body exposes messages, service tier, thinking controls, streaming, token limits, sampling controls, and tools without `response_format` or `json_schema`; the current [OpenAI SDK guide](https://platform.minimax.io/docs/api-reference/text-openai-api) likewise documents `MiniMax-M3` without either structured-output parameter. The deprecated [native text-generation endpoint](https://platform.minimax.io/docs/api-reference/text-post) documents `response_format: { type: 'json_schema' }` only for `MiniMax-Text-01`, which is not an active AutoShow selector. The gate is therefore negative: `MiniMax-M3` has no published native `json_schema` contract, so `compat-fallback.ts` and MiniMax's schema-guided strategy remain live.

> Follow-up (2026-08-07): `mistral-ocr-latest` was removed from `SUPPORTED_MISTRAL_OCR_MODELS` and from `ocr-config/ocr-mistral.json`. The alias predated this ADR and was the one selector left contradicting its "do not register any `*-latest` alias" clause: its registry row duplicated `mistral-ocr-4-0` byte-for-byte, so `--all-ocr` paid for the same model twice and price reports listed one model under two names. `--provider mistral=mistral-ocr-latest` now returns the standard invalid-model error naming `mistral-ocr-2512` and `mistral-ocr-4-0`, pinned by `provider-expansion-concurrency.test.ts`. The cheapest Mistral OCR default, `mistral-ocr-2512`, is unchanged.

## Remaining Work Recommendation: Stage the Gemini Default Migration Explicitly

This subordinate mini-ADR resolves how to replace the `gemini-3.1-flash-lite` bare write and OCR defaults before the provider's announced 2027-05-07 shutdown while preserving reproducible explicit selectors.

- **Recommendation Status:** Recommended, pending implementation
- **Recommended Successor:** `gemini-3.5-flash-lite`, the concrete replacement already registered for write and OCR and identified by Google in the evidence recorded above
- **Migration Deadline:** Land the default change no later than 2027-02-06, 90 days before shutdown; recheck official availability, pricing, and shutdown dates immediately before implementation
- **Paid Calibration:** Helpful but not a prerequisite; any live run still requires immediate explicit approval naming the exact command and expected cost or quota risk

| Current State | Recommended Next Step | Target Transition |
|---|---|---|
| The hosted LLM/OCR refresh is implemented. The retiring Gemini 3.1 Flash-Lite remains the computed cheapest write/OCR default, while its registered replacement has provisional heuristics. | Add static lifecycle eligibility and migrate bare and all-provider selection to Gemini 3.5 Flash-Lite by 2027-02-06, retaining explicit old-model selection until shutdown; calibrate only with separate paid approval. | Keep this ADR accepted with supported deterministic defaults, reproducible lifecycle state, and dated evidence. |

### Context and gap analysis

The registry deliberately kept `gemini-3.1-flash-lite` as the cheapest default when the newer Gemini models were added. That choice preserved bare-selector behavior and a lower estimated cost while the older model remained supported. It cannot remain a permanent rule because cheapest-model selection is computed from active registry prices, and the retiring model is still cheaper than `gemini-3.5-flash-lite`. Merely reordering `SUPPORTED_GEMINI_MODELS` will not move the default, and waiting until the shutdown date leaves configs, documentation, tests, and user expectations no transition period.

Removing `gemini-3.1-flash-lite` from every supported list 90 days early would force the bare default to move, but it would also reject explicit historical configurations while the provider still serves them. Hardcoding a one-off Gemini default would preserve the old explicit selector but undermine the repository's central cheapest-selection policy and create a provider exception that future retirements would repeat. A date-driven runtime switch would make identical installed code resolve a bare selector differently depending on the wall clock, which is hostile to reproducible manifests, tests, and offline price preflight.

The registry needs a static distinction between an explicitly selectable model and a model eligible for automatic/default selection. The same distinction should govern `--all-llm` and `--all-ocr`: a model in a retirement window may remain available for an explicit rerun but should not be added automatically to a paid expansion. Lifecycle metadata is preferable to inferring policy from array position, price, or model-name suffixes.

The successor does not need to be rediscovered. `gemini-3.5-flash-lite` is already present on both surfaces, uses the same Gemini request clients and structured-output path, supports the relevant input modalities, and is documented in this ADR as Google's replacement. Its provisional timing and token heuristics affect estimate accuracy, not request compatibility. The migration should therefore not be blocked on a paid benchmark. Calibration can improve `--price` confidence later, but an expiring default must have a deterministic supported successor even when no paid run is approved.

### Recommendation

Add typed, static lifecycle/selection metadata to hosted model registry entries. The minimum contract should represent `status` (`active` or `deprecated`), optional `shutdownDate`, optional `replacementModel`, `defaultEligible`, and `allExpansionEligible`. Do not make selection depend directly on the current date. A repository change advances lifecycle state after maintainers recheck official evidence, so a given commit always resolves the same selectors.

At least 90 days before shutdown, mark `gemini-3.1-flash-lite` deprecated and ineligible for default and all-provider expansion on both write and OCR while keeping its explicit validators and pricing metadata active. `resolveCheapestModelForFlag('gemini')` and `resolveCheapestModelForFlag('gemini-ocr')` will then select `gemini-3.5-flash-lite` from the eligible set. Preserve the retiring model for explicit selection and historical resume until the provider shutdown or until official evidence shows it is unavailable earlier. Documentation and model listings should show the shutdown date and replacement without emitting a warning during unrelated commands.

After shutdown, remove `gemini-3.1-flash-lite` from active supported selectors and active registry configuration in a dated model-refresh change. Retain its historical pricing and manifest normalization evidence wherever rerun/report readers require it; do not add a compatibility alias or silently rewrite an explicitly stored historical target to the successor. Resume should report that the target is retired and require explicit selection of the replacement rather than dispatching a different model under the old identity.

If a paid calibration is approved before the migration, use the same fixed, non-sensitive corpus for old and new models and record request settings, reasoning effort, document modes, page bands, actual prompt/candidate/thought tokens, latency, and provider cost. Do not use a single quality or timing run to override published token rates, and do not delay the lifecycle change if approval never arrives.

### Alternatives considered

| Option | Advantages | Disadvantages | Recommendation |
|---|---|---|---|
| **Static lifecycle eligibility with `gemini-3.5-flash-lite` as the scheduled successor** | Preserves explicit historical selectors, keeps commits reproducible, excludes deprecated models from automatic paid expansion, and generalizes to future retirements | Adds typed registry metadata and selection/filtering contracts | Recommended |
| Remove `gemini-3.1-flash-lite` from all active surfaces at the migration date | Smallest selection change and naturally exposes the next cheapest model | Breaks explicit configs before provider shutdown and shortens the migration window | Reject for the pre-shutdown phase; use after shutdown |
| Hardcode Gemini's bare default to `gemini-3.5-flash-lite` | Easy and leaves the old selector active | Creates a provider-specific exception to computed defaults and does not solve `--all` expansion | Reject |
| Switch automatically based on `Date.now()` and the shutdown date | No release needed at the threshold | Makes behavior time-dependent, complicates offline tests, and can change resume/default identity without a code change | Reject |
| Migrate immediately in August 2026 | Maximizes runway and removes deadline risk | Raises bare-selector cost months before necessary and changes established behavior without a transition policy | Not preferred; allowed only if a broader model refresh intentionally chooses the earlier date |
| Wait until 2027-05-07 | Preserves the cheapest default for the maximum time | Provides no operational buffer and risks a broken bare selector if the provider retires early or the release slips | Reject |
| Require paid calibration before changing the default | Produces better timing and cost heuristics | Allows unavailable approval to block a mandatory compatibility migration | Reject as a gate; retain calibration as optional evidence |

### Implementation plan

#### Phase 1: Lifecycle contract

1. Extend the hosted LLM and OCR model metadata schemas and loaders with optional lifecycle and selection fields, defaulting existing entries to active and eligible so other providers do not change.
2. Validate that `replacementModel` names another concrete selector in the same provider/modality registry, that deprecated entries name a dated evidence source in their pricing/lifecycle notes, and that no moving alias is introduced.
3. Update cheapest-model resolution to filter `defaultEligible === false` before comparing cost. Fail clearly if a provider has no eligible model instead of falling back to a deprecated entry.
4. Update all-provider expansion to filter `allExpansionEligible === false` while keeping direct validator acceptance independent until removal.

#### Phase 2: Pre-migration evidence refresh

1. Immediately before the migration change, recheck the official model and pricing documentation for successor availability, structured-output support, shutdown date, and Standard pricing.
2. Confirm local mocked Gemini write and OCR request contracts for `gemini-3.5-flash-lite`, including reasoning configuration, structured output, PDF/image input, usage parsing, and actual-cost projection.
3. If and only if a maintainer separately approves exact paid commands, run a bounded calibration matrix and record the result. Otherwise retain clearly labeled provisional heuristics.

#### Phase 3: Default migration by 2027-02-06

1. Mark `gemini-3.1-flash-lite` deprecated with shutdown date `2027-05-07`, replacement `gemini-3.5-flash-lite`, and both automatic eligibility fields false in write and OCR.
2. Assert bare Gemini write and OCR selectors resolve to `gemini-3.5-flash-lite`; assert explicit `gemini-3.1-flash-lite` remains accepted during the transition; assert `--all-llm` and `--all-ocr` exclude the deprecated model.
3. Update CLI model output, command documentation, examples that imply the old bare target, registry provenance, price contracts, and resume guidance.
4. Record the actual migration date and verification evidence in this ADR and update the README next-step row.

#### Phase 4: Post-shutdown retirement

1. Recheck provider status on or immediately after shutdown without making a paid request.
2. Remove the retired selector from active write/OCR model lists and current registry config, leaving historical rate/manifest readers intact where needed.
3. Make explicit old-selector and resume errors name `gemini-3.5-flash-lite` as the replacement, but never silently substitute it for stored provider identity.
4. Remove lifecycle exceptions that no longer serve an active explicit selector while keeping the generic lifecycle mechanism for other models.

### Acceptance and verification criteria

- Before the migration patch, current behavior stays unchanged; after it, bare Gemini write and OCR resolve deterministically to `gemini-3.5-flash-lite` in every environment.
- During the transition, explicit `gemini-3.1-flash-lite` remains accepted while bare and all-provider expansion exclude it.
- The current date is never consulted during selector resolution, price preflight, or resume.
- Write and OCR registries carry matching lifecycle state and replacement identity.
- Price estimates use the successor's published rates and clearly label provisional heuristics until calibrated.
- Historical manifests retain their concrete original selector and are never rewritten silently.
- Verification uses `bun run check`, `bun t --price`, targeted selector expansion, cheapest-model, registry provenance, Gemini request, OCR pricing, CLI help, CLI usage-error, and resume contracts. No paid provider or quota-limited command is part of default verification.

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Calibrate Grok 4.5 OCR page timing and token heuristics from a paid run | OCR maintainers | Deferred until the exact paid provider run is separately approved |
| Calibrate Gemini 3.6/3.5, Claude Opus 5, and Kimi K3 write and OCR heuristics from a paid run | Model registry maintainers | Deferred until the exact paid provider run is separately approved |
| Implement typed static lifecycle eligibility and migrate bare Gemini write/OCR plus all-provider expansion to `gemini-3.5-flash-lite` no later than 2027-02-06, while retaining explicit `gemini-3.1-flash-lite` until shutdown | Model registry maintainers | Pending — follow the four-phase Remaining Work recommendation above |
| At the next hosted LLM refresh, verify from MiniMax's published Chat Completions and model documentation whether every active MiniMax LLM selector supports OpenAI-compatible `response_format: { type: 'json_schema' }` | LLM maintainers | Closed 2026-08-10 — the current OpenAI-compatible request schema and SDK guide do not document `response_format` or `json_schema` for active `MiniMax-M3`; the deprecated native endpoint limits that feature to inactive `MiniMax-Text-01`. Keep the schema-guided compatibility path and re-evaluate only when MiniMax publishes a native contract for every active selector. |

## Verification

- `bun run check`
- `bun test test/test-cases/validation/cli/option-resolution-contracts/`
- `bun test test/test-cases/validation/cli/cli-help-contracts.test.ts`
- `bun test test/test-cases/validation/cli/cli-usage-errors.test.ts`
- Targeted local token-pricing, OCR-pricing, LLM-observed-cost, registry-provenance, and CLI price-mode contracts
- Local `--price` preflight for each new selector, which resolves registry pricing without calling a provider
- Bare-selector checks confirming `--llm gemini`, `--llm anthropic`, `--llm kimi`, and their `-ocr` counterparts still resolve to their pre-existing defaults
- Repository search for removed and renumbered ADR references

Do not run paid provider, smoke, e2e, or full-suite tests for this ADR. The Kimi K3 request shape cannot be proven without a paid call; report the exact command for a maintainer to run instead.

## References

- `src/cli/commands/setup-and-utilities/models/llm-models.ts`
- `src/cli/commands/setup-and-utilities/models/ocr-models.ts`
- `src/cli/commands/setup-and-utilities/models/llm-config.json`
- `src/cli/commands/setup-and-utilities/models/cheapest-models.ts`
- `src/cli/commands/setup-and-utilities/models/ocr-config/ocr-mistral.json`
- `src/cli/commands/setup-and-utilities/models/ocr-config/ocr-grok.json`
- `src/cli/commands/setup-and-utilities/models/ocr-config/ocr-gemini.json`
- `src/cli/commands/setup-and-utilities/models/ocr-config/ocr-anthropic.json`
- `src/cli/commands/setup-and-utilities/models/ocr-config/ocr-kimi.json`
- `src/cli/commands/process-steps/step-3-write/write-services/write-grok/run-grok.ts`
- `src/cli/commands/process-steps/step-3-write/write-services/write-gemini/run-gemini.ts`
- `src/cli/commands/process-steps/step-3-write/write-services/anthropic-compatible.ts`
- `src/cli/commands/process-steps/step-3-write/write-services/kimi/run-kimi.ts`
- `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/grok-ocr/run-grok-ocr.ts`
- `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/gemini-ocr/run-gemini-ocr.ts`
- `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/kimi-ocr/run-kimi-ocr.ts`
- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)
- Related ADR: [ADR-012](ADR-012-add-price-preflight-to-resume.md)
- Related ADR: [ADR-017](ADR-017-normalize-cross-provider-reasoning-configuration.md)
- [OpenAI latest model guide](https://developers.openai.com/api/docs/guides/latest-model.md)
- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- [OpenAI GPT-5.6 Terra model and pricing](https://developers.openai.com/api/docs/models/gpt-5.6-terra)
- [OpenAI GPT-5.6 Luna model and pricing](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
- [Anthropic models overview](https://platform.claude.com/docs/en/about-claude/models/overview)
- [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [What's new in Claude Opus 5](https://platform.claude.com/docs/en/about-claude/models/whats-new-opus-5)
- [xAI Grok 4.5 model details](https://docs.x.ai/developers/models/grok-4.5)
- [xAI pricing](https://docs.x.ai/developers/pricing)
- [Gemini API models overview](https://ai.google.dev/gemini-api/docs/models)
- [Gemini latest model guide](https://ai.google.dev/gemini-api/docs/latest-model)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini model deprecations](https://ai.google.dev/gemini-api/docs/deprecations)
- [Kimi K3 quickstart](https://platform.kimi.ai/docs/guide/kimi-k3-quickstart)
- [Kimi K3 pricing](https://platform.kimi.ai/docs/pricing/chat-k3)
- `project/links/gemini-models-text-links.md`
- `project/links/kimi-all-links.md`
- `project/links/claude-models-links.md`
