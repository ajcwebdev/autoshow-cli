# ADR-018: Refresh Current Hosted TTS and Music Models

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-06
- **Date Updated:** 2026-08-11
- **Verification Status:** Passed for both original phases, including paid music benchmarks; the Phase 0 provider-catalog follow-up passed local no-network verification

## Context

AutoShow's hosted TTS and music registries are public CLI, pricing, resume, and benchmark surfaces. Selector constants and types determine accepted provider flags; registry metadata determines prices, timing estimates, limits, and capabilities; defaults and `--all-tts`, `--all-music`, and `--all-providers` determine execution targets; provider adapters determine whether each advertised model can actually run with its supported controls and modes.

The active registries at decision time contained 23 selectors: 19 TTS and 4 music. A 2026-08-06 evidence refresh found legacy, superseded, or moving selectors and 11 current selector introductions worth exposing. The original selected end state contained 29 selectors: 24 TTS and 5 music. The dated Phase 0 catalog follow-up below adds 83 documented Deepgram Aura-2 voice-model selectors and one Groq Saudi-Arabic selector, so the current end state contains 113 selectors: 108 hosted TTS and 5 music.

The evidence refresh made no synthesis or generation request. All 117 global TTS links and all 12 global music links succeeded. The music refresh also completed for all provider-scoped selections: six ElevenLabs links, three Gemini links, and three MiniMax links, with no failures. Generated evidence plus `.refresh.json` metadata remain under the gitignored `project/links/` directory.

This decision covers concrete, current, general-purpose hosted models that fit an existing provider integration or a bounded extension of it. It excludes moving aliases, superseded or deprecated generations, ordinary voice IDs, free-tier duplicates, and specialty models that require unrelated dialogue, realtime, conversion, music-cover, or reference-audio products.

Why now: Speechify's registered English model is explicitly legacy, Cartesia's current selectors are superseded or moving, ElevenLabs Music v2 is available alongside the transitional Music v1, and MiniMax identifies Music 3.0 as recommended and Music 2.6 as previous-generation.

Image and video model decisions from the same evidence refresh are recorded separately in [ADR-019](ADR-019-refresh-current-hosted-image-and-video-models.md).

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Refresh in separate TTS and music phases** | Keeps each registry, its provider adapters, tests, documentation, and verification together | Requires two implementation and verification passes | Original refresh: 2 phases; 11 selector introductions; 5 removals; 23 to 29 active selectors. Phase 0 catalog follow-up: 84 additive hosted-TTS selectors; 29 to 113 total selectors. |
| Implement every change in one pass | Minimizes coordination overhead | Couples voice rules, music formats, pricing, and unrelated failure causes | 9 provider decisions across TTS and music |
| Update selector validators and registries only | Produces a smaller diff | Can advertise models with incorrect voices, controls, pricing, output formats, or response handling | Smaller implementation with inadequate runtime guarantees |
| Add every documented hosted identifier | Maximizes apparent coverage | Mixes moving, deprecated, specialized, and ordinary voice identifiers into model selection | Unbounded and architecture-changing |
| Keep the current registries | Preserves current behavior | Leaves legacy models, moving aliases, and known model gaps active | No implementation cost; known drift remains |

## Decision

Refresh current hosted TTS and music models in two media-specific phases. Every selector change must update its complete runtime contract: constants and types, registry metadata, defaults and all-provider expansion, provider-specific validation and routing, CLI help and documentation, historical result normalization, and targeted local tests.

### Phase 1: TTS — Complete

Complete every original TTS correction and addition as one phase, finishing that phase with 24 active hosted TTS selectors before the later catalog follow-up.

| Provider | Decision | Required implementation |
|---|---|---|
| Speechify | Replace `simba-english` with `simba-3.2`, then add `simba-3.0` beside it. | Add current pricing and timing, model-specific language controls and compatible built-in voices, and update constants, registry, defaults, docs, tests, and historical identity mapping. Do not assume voice-clone access. Speechify identifies 3.0 as the multilingual API default in its [model catalog](https://docs.sws.speechify.com/tts/text-to-speech/get-started/models). |
| Cartesia | Collapse `sonic-3` and `sonic-3.5` into `sonic-3.5-2026-05-04`. | Remove superseded Sonic 3, replace the moving 3.5 alias, confirm default-voice compatibility, and update pricing, defaults, `--all-tts`, docs, tests, and historical aliases. See [Sonic 3.5](https://docs.cartesia.ai/build-with-cartesia/tts-models/sonic-3-5). |
| OpenAI | Replace `gpt-4o-mini-tts` with `gpt-4o-mini-tts-2025-12-15`. | Move pricing and timing to the dated key and update constants, registry, defaults, docs, tests, and historical aliases. The synthesis transport remains unchanged. The dated ID is enumerated by the [speech endpoint](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create). |
| Deepgram | Add `aura-2-helena-en`, `aura-2-arcas-en`, and `aura-2-aries-en`. | Add constants and registry/pricing entries through the existing `model` query transport. Preserve the current one-default-per-Deepgram `--all-tts` policy unless a separate decision changes it. See [Aura TTS models](https://developers.deepgram.com/docs/tts-models). |
| ElevenLabs | Add `eleven_multilingual_v2` and `eleven_flash_v2_5`; retain `eleven_v3`. | Add pricing, timing, limits, supported controls, help, and tests on the existing endpoint. See the [ElevenLabs model overview](https://elevenlabs.io/docs/overview/models). |
| Mistral | Retain `voxtral-mini-tts-2603` as the canonical selector. | Mistral's official [Voxtral TTS model card](https://docs.mistral.ai/models/model-cards/voxtral-tts-26-03), [model-selection guide](https://docs.mistral.ai/models/model-selection-guide?models=voxtral-tts-26-03), [audio overview](https://docs.mistral.ai/studio-api/audio/overview), and [speech-generation example](https://docs.mistral.ai/studio-api/audio/text_to_speech/speech) explicitly enumerate this exact API ID, so no rename is required. |

### Phase 0 provider-catalog follow-up — Complete

Official primary provider documentation was rechecked on 2026-08-11 without calling a provider API. Selector changes remain governed by this ADR; stock-voice changes that do not alter a model selector are recorded here so local registry validation and request serialization have dated evidence.

| Provider | Decision | Dated official evidence and implementation |
|---|---|---|
| Deepgram | Expand the active Aura-2 surface from 8 to all 91 documented voice-model IDs, adding 83 selectors. | The current [Deepgram voice and language table](https://developers.deepgram.com/docs/tts-models) lists 41 English, 17 Spanish, 9 Dutch, 2 French, 7 German, 10 Italian, and 5 Japanese Aura-2 IDs. All use the existing `model` query transport, the documented 2,000-character request limit, and the current Aura-2 price. Aura-1 remains documented but is outside this deliberately Aura-2-only selector; Flux remains excluded because it is a separate Early Access v2 family. |
| Groq | Add `canopylabs/orpheus-arabic-saudi` beside the English Orpheus model. | The current [Groq Orpheus guide](https://console.groq.com/docs/text-to-speech/orpheus) enumerates both model IDs, the Arabic voices `abdullah`, `fahad`, `sultan`, `lulwa`, `noura`, and `aisha`, a 200-character request limit, WAV-only output, no Arabic vocal directions, and $40 per million characters. Model-specific validation prevents English and Arabic voice namespaces from crossing. AutoShow chooses `abdullah` as its local Arabic default because the provider requires a voice but documents no provider default. |
| xAI | Keep the local `grok-tts` product selector and expand its stock registry from 5 to 26 voices; retain the documented eight-lowercase-alphanumeric custom-ID validation. | The current [xAI Text to Speech guide](https://docs.x.ai/developers/model-capabilities/audio/text-to-speech) lists all 26 case-insensitive stock IDs and `eve` as the default, while [Custom Voices](https://docs.x.ai/developers/model-capabilities/audio/custom-voices) defines the custom-ID shape. The REST TTS request has no model field, so `grok-tts` remains an AutoShow-local selector label rather than a claimed xAI model ID. |
| Gemini | Keep `gemini-3.1-flash-tts-preview` and add the complete 30-name prebuilt voice registry with case-insensitive local validation. | The current [Gemini speech-generation guide](https://ai.google.dev/gemini-api/docs/speech-generation) lists the 30 voices and supports them for single-speaker and exactly-two-speaker TTS. Invalid stock identities now fail before credential lookup or dispatch. |
| OpenAI | Retain the three fixed selectors and type the voice request as either a model-compatible built-in string or `{ "id": "voice_…" }` for an eligible custom voice. | The current [speech endpoint reference](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create) enumerates `tts-1`, `tts-1-hd`, the moving `gpt-4o-mini-tts` alias, and `gpt-4o-mini-tts-2025-12-15`; the moving alias remains excluded by this ADR's fixed-ID policy. It also enumerates 13 built-ins and the custom voice object. The [Text to speech guide](https://developers.openai.com/api/docs/guides/text-to-speech) limits `tts-1`/`tts-1-hd` to their documented nine-voice subset and says custom voices are limited to eligible customers. The model catalog and guide disagree about GPT-4o Mini TTS deprecation, while the request schema still enumerates the dated ID, so no speculative selector removal is made. |

### Phase 2: Music — Complete

Replace the superseded MiniMax generation, add ElevenLabs' current next-generation model without prematurely removing its transitional predecessor, and retain Gemini's current Lyria 3 pair, finishing with five active hosted music selectors.

| Provider | Decision | Required implementation |
|---|---|---|
| ElevenLabs | Add `music_v2`; retain `music_v1` during its documented transition period. | Add the selector, pricing and provisional timing metadata, help, defaults and all-provider expansion, resume identity, and local request/response contracts. Choose the documented model-specific MP3 output automatically: 44.1 kHz at 128 kbps for v1 and 48 kHz at 192 kbps for v2, and record the selected format accurately in metadata. Keep the existing prompt-only compose route as the initial v2 contract; audio reference, inpainting, long-form section composition, and fine-tuning require separate inputs and controls and must not be implied by adding the selector. ElevenLabs calls [Music v2](https://elevenlabs.io/docs/overview/capabilities/music) its next-generation model and says Music v1 remains available during a transition with advance notice before deprecation. The [compose endpoint](https://elevenlabs.io/docs/api-reference/music/compose) enumerates both fixed IDs and their model-specific output formats. |
| MiniMax | Replace `music-2.6` with `music-3.0`. | Move active validation, pricing, defaults, `--all-music`, examples, help, manifests, and provider contracts to `music-3.0`. The current `/v1/music_generation` request and response transport remains suitable for prompt-plus-lyrics and instrumental generation, but pricing and timing must be refreshed rather than copied without evidence. Preserve `music-2.6` only in historical benchmark and result readers, and reject it for new runs. MiniMax's [music generation guide](https://platform.minimax.io/docs/guides/music-generation) uses `music-3.0`, and its [music generation API](https://platform.minimax.io/docs/api-reference/music-generation) labels `music-3.0` recommended and `music-2.6` previous-generation. |
| Gemini | Retain `lyria-3-clip-preview` and `lyria-3-pro-preview`; add no selector. | Keep the current fixed IDs, per-track pricing, 30-second Clip behavior, prompt-controlled Pro duration, Interactions API routing, defaults, and tests. The refreshed [Lyria 3 guide](https://ai.google.dev/gemini-api/docs/music-generation) still identifies these as the two current family members. Do not treat Lyria RealTime as another finished-track selector. |

Do not add `music-3.0-free`, `music-2.6-free`, or `music-cover-free`. The free MiniMax IDs duplicate paid model generations while introducing materially different availability and rate limits; `music-2.6-free` also duplicates a previous generation. Do not add `music-cover` in this phase because it requires reference-audio upload or preprocessing and a cover-specific validation contract outside AutoShow's current text-to-music input surface. Do not add Lyria RealTime because its bidirectional streaming session is outside the standalone finished-file music command. Revisit these capabilities only in separate decisions that add their required inputs, controls, pricing, output, and local contracts.

## Implementation Note

Phase 1 removed the four retired TTS selectors from active selection and added nine canonical replacement or additive selectors for an initial 24 active hosted TTS selectors. The 2026-08-11 Phase 0 provider-catalog follow-up then added 84 selectors for the current total of 108 hosted TTS selectors.

Phase 2 adds ElevenLabs `music_v2`, replaces MiniMax `music-2.6` with `music-3.0`, and retains both Gemini Lyria 3 preview selectors, moving the total music surface from four to five active selectors. The adapters, model-specific ElevenLabs output metadata, current pricing, active and historical identity handling, defaults and expansion, help, docs, price registry, resume selection, and local contracts are updated.

> Follow-up (2026-08-07): phase 2's "preserve `music-2.6` only in historical benchmark and result readers" clause was not actually implemented — the model was dropped from the active registry with no historical reader behind it, so `getMusicModelMeta('minimax', 'music-2.6')` returned `undefined` and all four committed `docs/benchmarks/music/2026-05-21_*` runs repriced to $0 rather than failing. Closed by adding `RETIRED_MUSIC_MODEL_RATES` in `src/utils/pricing/compute-actual-costs.ts`, carrying the registry values the model held at retirement (15¢ per track, +1¢ when lyrics were generated), pinned by `image-video-music-pricing.test.ts`. A recorded `providerCostCents` still takes precedence. This is the same shape [ADR-019](ADR-019-refresh-current-hosted-image-and-video-models.md) used for Replicate `alibaba/happyhorse-1.0`; retiring a priced model now means moving its rate to a historical table, not deleting it.

The approved first benchmark pass exposed an additive-resume artifact collision after all eight provider calls reported success: a single resumed music target used `generated-music.mp3`, so the later MiniMax pass overwrote the four ElevenLabs Music v2 files and left both new manifest entries pointing to the same artifact. Music resume now always promotes additive outputs to provider-and-model-specific filenames before merging metadata, with a local regression contract. The four MiniMax Music 3.0 artifacts and manifest entries were repaired and validated with ffprobe. After separate approval, all four duration-matched ElevenLabs Music v2 reruns completed successfully and were preserved under provider-and-model-specific filenames alongside the MiniMax artifacts. Their manifests record the expected 48 kHz, 192 kbps `mp3_48000_192` output format, exact requested durations of 30, 60, 120, and 180 seconds, and matching file sizes; ffprobe reported playable durations of 30.024, 60.024, 120.024, and 180.024 seconds.

## API / Type Impact

- Hosted TTS accepted-model unions remove `sonic-3`, `sonic-3.5`, `gpt-4o-mini-tts`, and `simba-english`; the original phase added their canonical replacements plus six additive selectors, and the Phase 0 catalog follow-up adds 83 Aura-2 selectors and one Groq Arabic selector for 108 active hosted selectors.
- Stock-voice registries now validate 26 xAI voices, 30 Gemini voices, model-disjoint six-voice English and Arabic Groq catalogs, and OpenAI's model-specific built-in subsets. OpenAI custom IDs serialize through the documented typed `{ id }` request branch and remain explicitly eligibility-gated by the provider account.
- Hosted music accepted-model unions add ElevenLabs `music_v2`, replace MiniMax `music-2.6` with `music-3.0`, retain both Gemini Lyria 3 selectors, and finish with 5 active selectors.
- Bare-provider defaults and `--all-*` expansion change only where a removed selector currently participates. Deepgram's special one-default expansion remains unchanged.
- Historical benchmark and result readers continue recognizing removed identities, but new manifests and executions emit only canonical active IDs.
- Invalid model-specific voice, language, duration, and mode combinations fail before price calculation or provider dispatch.

## Rationale

- A model selector is a runtime promise, so validation, pricing, request construction, response parsing, help, tests, and historical identity must move together.
- Correcting deprecated, superseded, and moving selectors first restores truthful CLI behavior before expanding the surface.
- A newer same-family generation excludes older generations from new selection even when an older endpoint remains callable; current latency, quality, and cost tiers may coexist when they are documented siblings rather than replacements.
- Fixed provider IDs keep manifests, pricing, benchmarks, and all-provider runs reproducible.
- Retaining ElevenLabs Music v1 during its announced transition avoids an early compatibility break, while replacing MiniMax Music 2.6 follows an explicit provider designation of the older model as previous-generation.
- Excluding free-tier aliases and capability-specific music products keeps selectors tied to distinct generation behavior rather than billing tiers or unsupported input contracts.
- Keeping removed IDs only in historical readers preserves benchmark evidence without continuing to advertise stale selectors.

## Consequences

Positive outcomes:

- Hosted TTS and music commands expose current concrete models and stop advertising MiniMax's previous-generation music selector and legacy or moving TTS selectors.
- Pricing, defaults, all-provider expansion, and model-specific validation remain synchronized with accepted types.
- Current quality, latency, language, and music-generation choices become available through existing providers.
- Historical benchmark artifacts remain attributable to the model that produced them.
- Both media phases can be verified locally before any separately approved provider call.

Negative outcomes:

- Explicit configurations using removed selector names must migrate.
- The active TTS and music selector surface grows from 23 at the original decision to 113 after the catalog follow-up, increasing help, documentation, and all-provider maintenance. Deepgram's existing one-default `--all-tts` policy prevents its 91 voices from multiplying ordinary all-provider execution.
- ElevenLabs Music v2 requires more than registry edits.
- Pricing and timing metadata for new models may initially rely on published rates and explicitly provisional same-family timing estimates until paid calibration is separately approved.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Current, concrete, reproducible selectors | Compatibility with stale explicit selector values |
| Truthful provider-specific capabilities | More validation and adapter branches |
| Historical result continuity | Separate canonical and historical identity handling |
| Media-specific, attributable verification | More implementation passes than one registry-wide edit |
| Broader hosted TTS and music coverage | Larger active registries and potentially larger paid all-provider runs |

## Test Plan

Each phase must pass local, no-cost verification:

```bash
bun run check
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/
git diff --check
```

Phase 1 completion verification passed on 2026-08-06: `bun run check`; 179 CLI help, usage, and option-resolution contracts; 48 TTS provider, dialogue, and batch-output contracts; 41 configuration, pricing, and resume contracts; and `git diff --check`. The provider matrix initially exposed a nondeterministic Mistral multi-speaker request-order assertion; the contract now compares the concurrent requests without assuming dispatch order, while the existing artifact assertions continue proving dialogue-order assembly.

The Phase 0 provider-catalog follow-up passed local no-network verification on 2026-08-11. Focused contracts prove the exact 26/91/30 stock catalogs, the two model-disjoint Groq voice sets, the 108-selector inventory, invalid cross-model voice rejection, OpenAI classic-model voice restrictions, typed custom-voice request serialization, and the final Groq Arabic request body. No provider API or hosted synthesis command was run.

Phase 2 implementation verification must include the mocked music provider contracts, music pricing contracts, CLI help and usage contracts, option-resolution expansion and default contracts, resume identity, and historical MiniMax 2.6 normalization. It must assert ElevenLabs' model-specific output formats, active MiniMax 3.0 selection, inactive MiniMax 2.6 rejection, and an exact five-selector `--all-music` expansion without making a hosted generation request.

Phase 2 local verification passed on 2026-08-06: `bun run check`; 6 mocked music provider contracts; 27 music pricing and timing contracts; 23 selector and resume contracts including the additive artifact regression; 21 price-registry and budget contracts; the required 179 CLI help, usage, and option-resolution contracts; and `git diff --check`. The no-cost benchmark preflight covered four committed music runs. Duration-matched ElevenLabs Music v2 additions were estimated at 15.00¢, 30.00¢, 7.50¢, and 45.00¢ for 60, 120, 30, and 180 seconds respectively, totaling 97.50¢ per complete pass. Four MiniMax Music 3.0 additions with generated lyrics were estimated at 16.00¢ each, totaling 64.00¢. The initial approved pass incurred the provider work for all eight requests before the artifact collision was detected; its four MiniMax outputs remain valid. A separately approved 97.50¢ ElevenLabs rerun completed all four requests without retries in 11.685, 19.982, 8.300, and 22.055 seconds respectively. The validated benchmark manifests now contain distinct, playable MiniMax Music 3.0 and ElevenLabs Music v2 artifacts for all four runs. Estimated cumulative provider work across the initial pass and the required rerun is $2.59 before any provider-side billing adjustments; provider billing records remain authoritative.

Also run the smallest relevant pricing, provenance, selector-ordering, routing, request-builder, response-parser, resume, and historical-normalization contracts for the providers changed in that phase. Tests must prove active-selector acceptance, removed-selector rejection, canonical defaults, exact all-provider expansion, complete pricing metadata, and local rejection of unsupported model/control combinations.

Do not run `bun run t`, `bun test/test-runner.ts`, hosted synthesis or generation commands, provider smoke tests, or e2e tests as implementation verification. Any live provider validation or calibration is paid or quota-limited and requires immediate explicit approval naming the exact command and expected cost or quota risk.

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Revisit realtime music, music-cover, and reference-audio capabilities only through a separate decision that defines their distinct input, control, pricing, and output contracts | Music maintainers | Deliberately deferred |
| At the next hosted TTS refresh, verify whether OpenAI has retired `tts-1` and `tts-1-hd`, and remove or retain both together based on the published model and speech-endpoint enumeration | TTS maintainers | Closed 2026-08-11 — the official speech request schema still enumerates both fixed IDs, so both remain active. The contradictory GPT-4o Mini TTS guide/catalog status is recorded separately and requires no speculative live API probe. |

## References

- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)
- Related ADR: [ADR-011](ADR-011-refresh-current-hosted-llm-and-ocr-models.md)
- Related ADR: [ADR-012](ADR-012-add-price-preflight-to-resume.md)
- Related ADR: [ADR-013](ADR-013-add-refresh-metadata-to-links.md)
- Related ADR: [ADR-016](ADR-016-refresh-current-hosted-stt-models.md)
- Related ADR: [ADR-019](ADR-019-refresh-current-hosted-image-and-video-models.md)
- `project/links/all-tts-links.md`
- `project/links/all-music-links.md`
- `project/links/elevenlabs-music-links.md`
- `project/links/gemini-music-links.md`
- `project/links/minimax-music-links.md`
- `src/cli/commands/setup-and-utilities/models/tts-models.ts`
- `src/cli/commands/setup-and-utilities/models/tts-config/`
- `src/cli/commands/setup-and-utilities/models/music-models.ts`
- `src/cli/commands/setup-and-utilities/models/music-config.json`
- [xAI Text to Speech](https://docs.x.ai/developers/model-capabilities/audio/text-to-speech) — checked 2026-08-11
- [xAI Custom Voices](https://docs.x.ai/developers/model-capabilities/audio/custom-voices) — checked 2026-08-11
- [Deepgram Voices and Languages](https://developers.deepgram.com/docs/tts-models) — checked 2026-08-11
- [Gemini speech generation](https://ai.google.dev/gemini-api/docs/speech-generation) — checked 2026-08-11
- [OpenAI speech endpoint](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create) and [Text to speech guide](https://developers.openai.com/api/docs/guides/text-to-speech) — checked 2026-08-11
- [Groq Orpheus TTS](https://console.groq.com/docs/text-to-speech/orpheus) — checked 2026-08-11
