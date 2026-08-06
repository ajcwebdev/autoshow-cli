# ADR-018: Refresh Current Hosted TTS, Image, and Video Models

## Status

- **Decision Status:** Proposed
- **Date Created:** 2026-08-06
- **Date Updated:** 2026-08-06
- **Verification Status:** Pending

## Context

AutoShow's hosted TTS, image, and video registries are public CLI, pricing, resume, and benchmark surfaces. Selector constants and types determine accepted provider flags; registry metadata determines prices, timing estimates, limits, and capabilities; defaults and `--all-tts`, `--all-image`, `--all-video`, and `--all-providers` determine execution targets; provider adapters determine whether each advertised model can actually run with its supported controls and modes.

The active registries at decision time contained 69 selectors: 19 TTS, 25 image, and 25 video. A 2026-08-06 official-documentation refresh found one shut-down selector, two deprecated or superseded TTS entries, three moving aliases that undermine reproducibility, and 14 current general-purpose models worth adding. The recommended end state contains 81 selectors: 24 TTS, 28 image, and 29 video.

The evidence refresh made no synthesis or generation request. All 117 global TTS links and all 35 global video links succeeded. The image refresh fetched 36 of 39 links initially and recovered all three Reve failures in the permitted provider-scoped retry. Provider-scoped refreshes completed without persistent evidence gaps, and generated evidence plus `.refresh.json` metadata remain under the gitignored `project/links/` directory.

This decision covers concrete, current, general-purpose hosted models that fit an existing provider integration or a bounded extension of it. It excludes moving aliases, deprecated generations, ordinary voice IDs, local or open-weight artifacts, and specialty models that require unrelated dialogue, realtime, avatar, conversion, editing, or image-to-video products.

Why now: Gemini's registered image preview is already shut down, Speechify's registered English model is explicitly legacy, Cartesia's current selectors are superseded or moving, and all three hosted media registries omit current provider models that can be exposed without introducing new providers.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Refresh in corrective, transport-compatible, and capability-dependent stages** | Fixes broken and non-reproducible selectors first; isolates registry-only work from adapter changes; keeps verification and any later paid approval bounded | Requires multiple implementation passes and explicit historical identity handling | 3 stages; 5 corrective migrations; 14 additions; 69 to 81 active selectors |
| Implement every change in one registry-wide pass | Minimizes coordination overhead | Couples unrelated providers, voice rules, response parsing, video modes, and failure causes | 19 recommended changes across TTS, image, and video |
| Update selector validators and registries only | Produces a smaller diff | Can advertise models with incorrect voices, controls, routing, limits, pricing, or response handling | 14 additions without adequate runtime guarantees |
| Add every documented hosted identifier | Maximizes apparent coverage | Mixes moving, deprecated, specialized, incompatible-transport, and ordinary voice identifiers into model selection | Unbounded and architecture-changing |
| Keep the current registries | Preserves current behavior | Leaves a shut-down selector, legacy models, moving aliases, and known model gaps active | No implementation cost; known drift remains |

## Decision

Refresh current hosted TTS, image, and video models in three stages. Every selector change must update its complete runtime contract: constants and types, registry metadata, defaults and all-provider expansion, provider-specific validation and routing, CLI help and documentation, historical result normalization, and targeted local tests.

Stage 1 corrects current selectors before any additive work:

| Area | Provider | Decision | Required implementation |
|---|---|---|---|
| Image | Gemini | Replace `gemini-3.1-flash-image-preview` with `gemini-3.1-flash-image`. | Update the constant, registry key, pricing and timing, default, help and examples, tests, and historical benchmark identity mapping. Google's [deprecation schedule](https://ai.google.dev/gemini-api/docs/deprecations) records the June 25, 2026 shutdown and stable replacement. |
| TTS | Speechify | Replace `simba-english` with `simba-3.2`. | Add current pricing and timing, confirm the default voice is valid for 3.2, and update constants, registry, defaults, docs, tests, and historical identity mapping. Do not assume voice-clone access. See Speechify's [model catalog](https://docs.sws.speechify.com/tts/text-to-speech/get-started/models). |
| TTS | Cartesia | Collapse `sonic-3` and `sonic-3.5` into `sonic-3.5-2026-05-04`. | Remove superseded Sonic 3, replace the moving 3.5 alias, confirm default-voice compatibility, and update pricing, defaults, `--all-tts`, docs, tests, and historical aliases. See [Sonic 3.5](https://docs.cartesia.ai/build-with-cartesia/tts-models/sonic-3-5). |
| TTS | OpenAI | Replace `gpt-4o-mini-tts` with `gpt-4o-mini-tts-2025-12-15`. | Move pricing and timing to the dated key and update constants, registry, defaults, docs, tests, and historical aliases. The synthesis transport remains unchanged. The dated ID is enumerated by the [speech endpoint](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create). |
| Image | Reve | Remove `latest` and retain `reve-create@20250915`. | Update constants, registry, defaults, `--all-image`, docs, tests, and historical normalization. No replacement key is needed because the fixed snapshot is already registered. See Reve's [create reference](https://api.reve.com/console/docs/create). |

Stage 2 adds eight selectors that use existing provider transports:

| Area | Provider | Decision | Required implementation |
|---|---|---|---|
| TTS | Deepgram | Add `aura-2-helena-en`, `aura-2-arcas-en`, and `aura-2-aries-en`. | Add constants and registry/pricing entries through the existing `model` query transport. Preserve the current one-default-per-Deepgram `--all-tts` policy unless a separate decision changes it. See [Aura TTS models](https://developers.deepgram.com/docs/tts-models). |
| TTS | ElevenLabs | Add `eleven_multilingual_v2` and `eleven_flash_v2_5`; retain `eleven_v3`. | Add pricing, timing, limits, supported controls, help, and tests on the existing endpoint. See the [ElevenLabs model overview](https://elevenlabs.io/docs/overview/models). |
| TTS | Speechify | Add `simba-3.0` beside `simba-3.2`. | Add pricing, timing, language controls, compatible built-in voices, help, and tests. Speechify identifies 3.0 as the multilingual API default in its [model catalog](https://docs.sws.speechify.com/tts/text-to-speech/get-started/models). |
| Image | BFL | Add `flux-2-klein-4b` and `flux-2-klein-9b`. | Add fixed endpoint allow-list entries, pricing, timing, output and reference-input constraints, help, and tests. Exclude moving preview endpoints. See the [FLUX.2 overview](https://docs.bfl.ml/flux_2/flux2_overview). |

Stage 3 adds six selectors only after their capability or adapter requirements are represented locally:

| Area | Provider | Decision | Required implementation |
|---|---|---|---|
| Image | Gemini | Add `gemini-3.1-flash-lite-image` and `gemini-3-pro-image`. | Add pricing, timing, sizes, reference-input capabilities, help, and tests. Confirm whether Pro's interleaved text/image output needs response-parser changes before registration. See Google's [model catalog](https://ai.google.dev/gemini-api/docs/models). |
| Video | MiniMax | Add `MiniMax-Hailuo-02`. | Add pricing, duration and resolution constraints, text and image modes, and first/last-frame routing. Retain the eight existing route-specific models. See the [first/last-frame reference](https://platform.minimax.io/docs/api-reference/video-generation-fl2v). |
| Video | GLM / Z.ai | Add `viduq1-image`. | Add pricing, image-to-video and start/end-frame routing, and fixed five-second/1080p validation. Retain `viduq1-text` and existing Vidu 2 routes. See [Vidu Q1](https://docs.z.ai/guides/video/vidu-q1). |
| Video | xAI Grok | Add `grok-imagine-video-1.5`. | Add per-second pricing and model-specific resolution and reference rules. Retain `grok-imagine-video` for its documented edit and extend coverage; do not assume 1.5 operation parity. See the [video guide](https://docs.x.ai/developers/model-capabilities/video/generation) and [REST reference](https://docs.x.ai/developers/rest-api-reference/inference/videos). |
| Video | Runway | Add `gemini_omni_flash` after confirming its exact request schema. | Confirm the API contract, then add pricing, duration, aspect-ratio support, routing, help, and tests. A shared endpoint-family label is not sufficient proof of compatibility. See the [Runway model catalog](https://docs.dev.runwayml.com/guides/models/). |

Removed selectors remain readable only through explicit historical-result normalization. They must be rejected as new CLI selections and excluded from defaults, help, manifests, and all-provider expansion.

Retain Mistral `voxtral-mini-tts-2603` provisionally. Official documentation confirms the Voxtral TTS v26.03 family but does not enumerate the exact API selector, so no rename is justified without an official enumeration or documented no-cost model-list response. Retain every other current selector not named for correction above, including all 25 current video selectors.

## Implementation Note

The revised TTS portion was implemented on 2026-08-06. It removes the four retired TTS selectors from active selection, adds nine canonical replacement or additive selectors for 24 active hosted TTS selectors, preserves the existing Groq English model unchanged, keeps required bare-provider defaults stable, retains Deepgram's one-default `--all-tts` expansion, adds checked pricing and explicitly provisional timing metadata, adds model-aware ElevenLabs input limits, enforces Speechify model-specific voice, language, and cloning rules, rejects OpenAI classic-model instructions before pricing or dispatch, and preserves completed historical identities while blocking incomplete retired-model resumes with canonical replacement guidance. Image and video work remains pending, so the decision stays Proposed · Pending.

## API / Type Impact

- Hosted TTS accepted-model unions remove `sonic-3`, `sonic-3.5`, `gpt-4o-mini-tts`, and `simba-english`; add their canonical replacements plus six additive selectors; and finish with 24 active selectors.
- Hosted image accepted-model unions remove `gemini-3.1-flash-image-preview` and Reve `latest`; add the stable Gemini replacement plus four additive selectors; and finish with 28 active selectors.
- Hosted video accepted-model unions retain all 25 current selectors and add four selectors for 29 active selectors.
- Bare-provider defaults and `--all-*` expansion may change only where a removed selector currently participates. Deepgram's special one-default expansion remains unchanged.
- Historical benchmark and result readers continue recognizing removed identities, but new manifests and executions emit only canonical active IDs.
- Invalid model-specific voice, language, resolution, duration, reference-input, and mode combinations fail before price calculation or provider dispatch.

## Rationale

- A model selector is a runtime promise, so validation, pricing, request construction, response parsing, help, tests, and historical identity must move together.
- Correcting shut-down, deprecated, superseded, and moving selectors first restores truthful CLI behavior before expanding the surface.
- Fixed provider IDs keep manifests, pricing, benchmarks, and all-provider runs reproducible.
- Separating transport-compatible additions from capability-dependent additions prevents registry presence from being mistaken for adapter support.
- Retaining current video selectors preserves documented operation-specific routes instead of treating chronology alone as supersession.
- Keeping removed IDs only in historical readers preserves benchmark evidence without continuing to advertise stale selectors.

## Consequences

Positive outcomes:

- Hosted media commands expose current concrete models and stop advertising a shut-down Gemini image preview and legacy or moving selectors.
- Pricing, defaults, all-provider expansion, and model-specific validation remain synchronized with accepted types.
- Current quality, latency, language, and mode choices become available without adding new providers.
- Historical benchmark artifacts remain attributable to the model that produced them.
- Every implementation stage can be verified locally before any separately approved provider call.

Negative outcomes:

- Explicit configurations using removed selector names must migrate.
- The active hosted selector surface grows from 69 to 81 entries, increasing help, documentation, and all-provider maintenance.
- Gemini Pro Image and the four video additions require more than registry edits.
- Pricing and timing metadata for new models may initially rely on published rates and explicitly provisional same-family timing estimates until paid calibration is separately approved.
- Runway `gemini_omni_flash` remains blocked from exposure until its exact request contract is confirmed.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Current, concrete, reproducible selectors | Compatibility with stale explicit selector values |
| Truthful provider-specific capabilities | More validation and adapter branches |
| Historical result continuity | Separate canonical and historical identity handling |
| Staged, attributable verification | More implementation passes than one registry-wide edit |
| Broader hosted media coverage | Larger active registries and potentially larger paid all-provider runs |

## Test Plan

Each stage must pass local, no-cost verification:

```bash
bun run check
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/
git diff --check
```

Also run the smallest relevant pricing, provenance, selector-ordering, routing, request-builder, response-parser, resume, and historical-normalization contracts for the providers changed in that stage. Tests must prove active-selector acceptance, removed-selector rejection, canonical defaults, exact all-provider expansion, complete pricing metadata, and local rejection of unsupported model/control combinations.

Do not run `bun run t`, `AGENT=1 bun test/test-runner.ts`, hosted synthesis or generation commands, provider smoke tests, or e2e tests as implementation verification. Any live provider validation or calibration is paid or quota-limited and requires immediate explicit approval naming the exact command and expected cost or quota risk.

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Complete the two remaining Stage 1 image corrective migrations with historical identity mappings | Hosted media registry maintainers | Pending; the three TTS corrective migrations are implemented |
| Add the two remaining Stage 2 BFL image selectors with pricing, limits, help, defaults, expansion, and local contracts | Hosted media registry maintainers | Pending; all six Stage 2 TTS selectors are implemented |
| Confirm Gemini Pro Image response handling and expose both additional stable Gemini image models | Image maintainers | Pending |
| Implement MiniMax, GLM, and xAI video capability rules and expose their new selectors | Video maintainers | Pending |
| Confirm Runway `gemini_omni_flash` request compatibility before exposing it | Video maintainers | Pending |
| Resolve the exact Mistral Voxtral TTS API selector from authoritative no-cost evidence | TTS maintainers | Deferred; retain `voxtral-mini-tts-2603` provisionally |

## References

- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)
- Related ADR: [ADR-011](ADR-011-refresh-current-hosted-llm-and-ocr-models.md)
- Related ADR: [ADR-012](ADR-012-add-price-preflight-to-resume.md)
- Related ADR: [ADR-013](ADR-013-add-refresh-metadata-to-links.md)
- Related ADR: [ADR-016](ADR-016-refresh-current-hosted-stt-models.md)
- `project/links/all-tts-links.md`
- `project/links/all-image-links.md`
- `project/links/all-video-links.md`
- `src/cli/commands/setup-and-utilities/models/tts-models.ts`
- `src/cli/commands/setup-and-utilities/models/tts-config/`
- `src/cli/commands/setup-and-utilities/models/image-models.ts`
- `src/cli/commands/setup-and-utilities/models/image-config.json`
- `src/cli/commands/setup-and-utilities/models/video-models.ts`
- `src/cli/commands/setup-and-utilities/models/video-config.json`
