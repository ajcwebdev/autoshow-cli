# ADR-019: Refresh Current Hosted Image and Video Models

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-06
- **Date Updated:** 2026-08-10
- **Verification Status:** Passed for both phases

## Context

AutoShow's hosted image and video registries are public CLI, pricing, resume, and benchmark surfaces. Selector constants and types determine accepted provider flags; registry metadata determines prices, timing estimates, limits, and capabilities; defaults and `--all-image`, `--all-video`, and `--all-providers` determine execution targets; provider adapters determine whether each advertised model can actually run with its supported controls and modes.

The active registries at decision time contained 50 selectors: 25 image and 25 video. A 2026-08-06 evidence refresh found one shut-down selector, a provider-wide image API sunset, superseded entries, and 24 current selector introductions worth exposing. The selected end state contains 66 selectors: 34 image and 32 video.

The evidence refresh made no generation request. All 35 global video links succeeded. The image refresh fetched 36 of 39 links initially and recovered all three Reve failures in the permitted provider-scoped retry. Generated evidence plus `.refresh.json` metadata remain under the gitignored `project/links/` directory.

This decision covers concrete, current, general-purpose hosted models that fit an existing provider integration, a bounded extension of it, or the selected fal.ai image and video integration. It excludes moving aliases, superseded or deprecated generations, local-only artifacts, specialty models that require unrelated realtime or avatar products, and image-to-video products that do not fit the selected operation contracts. A hosted open-weight model may be included when the deployment and version are reproducible and its complete runtime contract is represented locally.

Why now: Gemini's registered image preview is already shut down, Reve has announced that its direct public API will sunset on 2026-08-14, and the hosted media registries omit current models available through existing providers and through fal.ai. fal.ai supplies the broadest verified incremental coverage of the reviewed 2026 image and video releases, including a current hosted Reve 2.1 route that does not depend on Reve's retiring direct API and hosted MiniMax H3 and PixVerse C1 routes that are not available through AutoShow's current video providers.

TTS and music model decisions from the same evidence refresh are recorded separately in [ADR-018](ADR-018-refresh-current-hosted-tts-and-music-models.md).

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Refresh in separate image and video phases** | Keeps each registry, its provider adapters, tests, documentation, and verification together | Each phase mixes removals, corrective migrations, transport-compatible additions, and capability-dependent additions | 2 phases; 24 selector introductions; 8 removals; 50 to 66 active selectors |
| Implement every change in one pass | Minimizes coordination overhead | Couples unrelated response parsing, reference inputs, video modes, pricing, and failure causes | 9 provider or model-family decisions across image and video |
| Update selector validators and registries only | Produces a smaller diff | Can advertise models with incorrect routing, limits, pricing, output formats, or response handling | Smaller implementation with inadequate runtime guarantees |
| Add every documented hosted identifier | Maximizes apparent coverage | Mixes moving, deprecated, specialized, incompatible-transport, and unreleased identifiers into model selection | Unbounded and architecture-changing |
| Keep the current registries | Preserves current behavior | Leaves a shut-down selector, a sunsetted provider, superseded models, and known model gaps active | No implementation cost; known drift remains |

## Decision

Refresh current hosted image and video models in two media-specific phases. Every selector change must update its complete runtime contract: constants and types, registry metadata, defaults and all-provider expansion, provider-specific validation and routing, CLI help and documentation, historical result normalization, and targeted local tests.

### Phase 1: Image — Complete

Remove unavailable providers and selectors, retain only current non-superseded generations, add all three current Gemini image models and the two fixed BFL Klein endpoints, then add six Replicate-hosted selectors and five fal.ai selectors. Remove all four Recraft SVG/vector generation selectors and finish with 34 active hosted image selectors.

| Provider | Decision | Required implementation |
|---|---|---|
| Gemini | Remove `gemini-3.1-flash-image-preview` and add `gemini-3.1-flash-lite-image`, `gemini-3.1-flash-image`, and `gemini-3-pro-image`. | Make the three current GA models the active Gemini image surface, with `gemini-3.1-flash-lite-image` as the newest release and default. Add model-specific pricing, timing, size and reference-input capabilities, help, examples, tests, response handling, and historical benchmark identity handling. Google's [release notes](https://ai.google.dev/gemini-api/docs/changelog) record the Flash and Pro models' 2026-05-28 GA release, the Lite model's 2026-06-30 GA release, and the preview's 2026-06-25 shutdown. |
| Reve | Remove the Reve provider, including `latest` and `reve-create@20250915`. | Remove Reve from constants, accepted types, registry metadata, defaults, `--all-image` and `--all-providers`, help, examples, tests, pricing, and new resume targets. Preserve both selectors only in historical benchmark/result readers. Never substitute another provider for an incomplete Reve resume. The dedicated provider-sunset error was retired on 2026-08-07 (legacy audit §3.5). A Reve-only manifest now fails with the generic "Could not reconstruct targets for missing providers" error; a manifest that pairs Reve with another incomplete provider runs that other provider first and then exits 2 as still-incomplete, rather than refusing the whole resume up front. The no-substitution guarantee holds in both cases; the up-front abort does not. Reve's direct notice to API users states that onboarding is closed and the public API will fully sunset on 2026-08-14. |
| BFL | Add `flux-2-klein-4b` and `flux-2-klein-9b`. | Add fixed endpoint allow-list entries, pricing, timing, output and reference-input constraints, help, and tests. Exclude moving preview endpoints. See the [FLUX.2 overview](https://docs.bfl.ml/flux_2/flux2_overview). |
| Replicate | Add `bytedance/seedream-5-pro`, `ideogram-ai/ideogram-v4-turbo`, `ideogram-ai/ideogram-v4-balanced`, `ideogram-ai/ideogram-v4-quality`, `prunaai/ernie-image`, and `prunaai/ernie-image-turbo`. | Extend the existing Replicate adapter with model-family request builders, output normalization, reference-input and resolution rules, pricing, timing, help, and tests. Seedream Lite and Pro are current latency/quality siblings; the three Ideogram endpoints are current service tiers; ERNIE standard and Turbo are current quality/speed variants. Pin the two community-hosted Pruna deployments to verified Replicate versions at dispatch time while keeping stable selectors in AutoShow. See [Seedream 5 Pro](https://replicate.com/bytedance/seedream-5-pro), [Ideogram 4 Balanced](https://replicate.com/ideogram-ai/ideogram-v4-balanced), [ERNIE-Image](https://replicate.com/prunaai/ernie-image), and [ERNIE-Image-Turbo](https://replicate.com/prunaai/ernie-image-turbo). |
| fal.ai | Add `fal-ai/hidream-o1-image`, `microsoft/mai-image-2.5`, `microsoft/mai-image-2.5-pro`, `alibaba/qwen-image-3`, and `reve/2.1`. | Add fal.ai as an image provider with API-key setup, queue submission and polling, cancellation and retry behavior, result downloading, pricing, reference-input and output constraints, help, defaults and all-provider expansion, resume identity, and local request/response contracts. Keep Reve 2.1 under the fal provider identity and never reinterpret retired direct-Reve results as fal results. See [HiDream-O1-Image](https://fal.ai/models/fal-ai/hidream-o1-image/api), [MAI-Image-2.5](https://fal.ai/models/microsoft/mai-image-2.5), [MAI-Image-2.5-Pro](https://fal.ai/models/microsoft/mai-image-2.5-pro), [Qwen-Image 3](https://fal.ai/models/alibaba/qwen-image-3/edit), and [Reve 2.1](https://fal.ai/reve-2.1). |

Do not add an older release merely because it has a hosted endpoint. Exclude Recraft V4 and V4 Pro because V4.1 is active; Qwen-Image-2512 because Qwen-Image 2.0 is already active and Qwen-Image 3 is selected through fal.ai; Reve 1.5 and 2.0 because Reve 2.1 is selected; MAI-Image-2 and MAI-Image-2-Efficient because MAI-Image-2.5 is selected; and the hosted Hunyuan Image 3 base checkpoint because the reviewed current release is HY Image 3.0 Plus and that exact endpoint was not verified. Current purpose-specific siblings and service tiers are not treated as superseded solely because one is faster, cheaper, or higher quality. AutoShow's hosted image generation surface is raster-only: do not add or restore SVG/vector-output model selectors during future registry, benchmark, `--all-image`, or provider refresh work. Generic SVG reading may remain for historical or external inputs, but it is not an active generation capability.

### Phase 2: Video — Complete

Retain the current non-superseded video generations, replace the superseded HappyHorse selector, add the verified models available through existing providers, and then add two fal.ai-hosted model families, finishing with 32 active hosted video selectors.

#### Existing-provider expansion

| Provider | Decision | Required implementation |
|---|---|---|
| Replicate | Add `kwaivgi/kling-v3-video`, `kwaivgi/kling-v3-omni-video`, `pixverse/pixverse-v6`, and `runwayml/aleph-2`; replace `alibaba/happyhorse-1.0` with `alibaba/happyhorse-1.1`. | Extend the existing Replicate video adapter with family-specific request builders, output normalization, pricing, duration and resolution constraints, native-audio controls, multi-shot inputs, reference modes, editing inputs, help, defaults and all-provider expansion, resume identity, and targeted local contracts. Kling 3.0 and Kling 3.0 Omni are current purpose-specific siblings rather than a supersession pair. Aleph 2.0 is an editing model and must require an input video rather than being routed through text-to-video generation. See [Kling Video 3.0](https://replicate.com/kwaivgi/kling-v3-video), [Kling Video 3.0 Omni](https://replicate.com/kwaivgi/kling-v3-omni-video), [HappyHorse 1.1](https://replicate.com/alibaba/happyhorse-1.1), [PixVerse V6](https://replicate.com/pixverse/pixverse-v6), and [Runway Aleph 2.0](https://replicate.com/runwayml/aleph-2). |
| xAI Grok | Add `grok-imagine-video-1.5`. | Add per-second and resolution-aware pricing plus model-specific input and reference rules. Retain `grok-imagine-video` for its documented text, edit, extend, and other operation coverage; do not assume 1.5 operation parity. Treat the later References release as a capability expansion of the same selector rather than another model. See the [Grok Imagine Video 1.5 model card](https://docs.x.ai/developers/models/grok-imagine-video-1.5). |

Retain the already registered current releases `ltx-2-3-fast`, `ltx-2-3-pro`, `grok-imagine-video`, `bytedance/seedance-2.0`, `bytedance/seedance-2.0-fast`, `wan-video/wan-2.7-t2v`, `veo-3.1-lite-generate-preview`, and `ray-3.2`. Expanding Wan 2.7 beyond its registered text-to-video route is capability work under the same selector rather than another model addition.

#### fal.ai video expansion

| Model family | Decision | Required implementation |
|---|---|---|
| MiniMax H3 | Add the stable AutoShow selector `minimax/h3` and dispatch it to fal.ai's `minimax/h3/text-to-video`, `minimax/h3/image-to-video`, or `minimax/h3/reference-to-video` endpoint according to the supplied inputs. | Extend the selected fal.ai integration to video with queue submission and polling, cancellation and retry behavior, uploads and result downloading, 768p and 2K pricing, duration and aspect-ratio constraints, generated stereo-audio handling, first/last-frame inputs, multimodal image/video/audio references, help, defaults and all-provider expansion, resume identity, and local request/response contracts. Do not expose an assumed H3 identifier through the existing direct MiniMax adapter while its published `video_generation` model enumeration omits H3. See [MiniMax H3 text-to-video](https://fal.ai/models/minimax/h3/text-to-video) and [MiniMax H3 reference-to-video](https://fal.ai/models/minimax/h3/reference-to-video). |
| PixVerse C1 | Add the stable AutoShow selector `fal-ai/pixverse/c1` and dispatch it to fal.ai's `fal-ai/pixverse/c1/text-to-video`, `fal-ai/pixverse/c1/image-to-video`, `fal-ai/pixverse/c1/reference-to-video`, or `fal-ai/pixverse/c1/transition` endpoint according to the supplied inputs. | Add family-specific request construction, reference naming, first/last-frame transition routing, native-audio and multi-clip controls, 1–15-second duration and 360p–1080p validation, resolution-aware pricing, result normalization, help, defaults and all-provider expansion, resume identity, and local contracts. C1 is a production and reference-control sibling of PixVerse V6 rather than its replacement. See [PixVerse C1 text-to-video](https://fal.ai/models/fal-ai/pixverse/c1/text-to-video/api), [image-to-video](https://fal.ai/models/fal-ai/pixverse/c1/image-to-video/api), and [reference-to-video](https://fal.ai/models/fal-ai/pixverse/c1/reference-to-video). |

Do not add an older video generation merely because a hosted endpoint remains available. Exclude LTX-2 because LTX-2.3 is active, SkyReels V3 because SkyReels V4 supersedes it, HappyHorse 1.0 because HappyHorse 1.1 is selected, and Ray3.14 because Ray3.2 is active. SkyReels V4 remains unavailable through the selected providers; Helios requires a distinct realtime streaming integration; and PixVerse R1, PikaStream 1.0, and Vidu S1 are interactive streaming products outside the finished-clip contract. Meta Muse Video remains excluded because it was announced but unreleased at the evidence cutoff.

Removed selectors remain readable only through explicit historical-result normalization. They must be rejected as new CLI selections and excluded from defaults, help, manifests, and all-provider expansion.

Retain every other current selector not named for correction above. Of the 25 current video selectors, remove only `alibaba/happyhorse-1.0`, add six selectors through existing providers, and add two stable fal.ai selectors for 32 active video selectors.

## Implementation Note

Phase 1 removes the shut-down Gemini preview, Reve's active provider surface, and all four Recraft SVG/vector generation selectors; adds the current Gemini, BFL, Replicate, and fal.ai image selections; and finishes with 34 active hosted image selectors.

Phase 2 replaces HappyHorse 1.0 with HappyHorse 1.1; adds Kling Video 3.0, Kling Video 3.0 Omni, PixVerse V6, and Runway Aleph 2.0 through Replicate; adds Grok Imagine Video 1.5 while retaining the original Grok selector for its broader operation surface; and includes the previously completed fal.ai MiniMax H3 and PixVerse C1 integrations. The video adapters now include model-specific routing, duration and resolution validation, native-audio and multi-shot controls, reference and edit contracts, pricing, links, all-provider expansion, resume identity, historical HappyHorse cost readability, and mocked local request/response coverage, finishing with 32 active hosted video selectors.

The 2026-08-10 W9.1 MiniMax audit retained all six 01-series selectors. MiniMax's published [`video_generation` T2V enumeration](https://platform.minimax.io/docs/api-reference/video-generation-t2v) still lists `T2V-01` and `T2V-01-Director`, its [I2V enumeration](https://platform.minimax.io/docs/api-reference/video-generation-i2v) still lists `I2V-01`, `I2V-01-live`, and `I2V-01-Director`, and its [S2V enumeration](https://platform.minimax.io/docs/api-reference/video-generation-s2v) still lists `S2V-01`. The direct adapter therefore keeps both its Hailuo and 01-series normalization branches, and the six selectors remain active rather than entering the retired-rate table. Bare `--minimax-video` deliberately remains `T2V-01` at the published 19¢ six-second 720p block rate; no default shift to the 28¢ `MiniMax-Hailuo-2.3` occurs while the cheaper model remains explicitly served. A focused historical-rate contract pins all six 19¢ rates so a future approved retirement cannot silently break repricing for the committed 2026-05-21 benchmark artifacts.

The 2026-08-10 W9.2 Veo response-shape audit retained only the raw Gemini REST spellings published by Google. The [Veo REST guide](https://ai.google.dev/gemini-api/docs/veo) reads completed operations through `response.generateVideoResponse.generatedSamples[0].video.uri`; the official Google Gen AI SDK's [ML Developer API operation and response converters](https://github.com/googleapis/js-genai/blob/4489991a7c40b22dff75348748048b0b14ac687e/src/converters/_models_converters.ts#L3116-L3151) consume that same wrapper and list, and its [raw video converter](https://github.com/googleapis/js-genai/blob/4489991a7c40b22dff75348748048b0b14ac687e/src/converters/_models_converters.ts#L6041-L6058) maps `uri`, `encodedVideo`, and `encoding` to the SDK's public `uri`, `videoBytes`, and `mimeType` fields. The direct REST normalizer therefore keeps the URI and inline-byte arms but removes the unwrapped-response fallback, raw `generatedVideos`, `_self`, `videoBytes`, and `mimeType` aliases: those were a non-provider hybrid of SDK-normalized names and the separate Vertex converter. Both inline-byte fixtures now use raw `encodedVideo` plus `encoding`, and a focused mocked contract pins both published output modes while proving the removed aliases do not normalize.

## API / Type Impact

- Hosted image accepted-model unions remove `gemini-3.1-flash-image-preview`, Reve `latest`, `reve-create@20250915`, `recraftv4_1_vector`, `recraftv4_1_pro_vector`, `recraftv4_1_utility_vector`, and `recraftv4_1_utility_pro_vector`; add `gemini-3.1-flash-lite-image`, `gemini-3.1-flash-image`, `gemini-3-pro-image`, `flux-2-klein-4b`, `flux-2-klein-9b`, the six selected Replicate models, and the five selected fal.ai models; and finish with 34 active selectors.
- Hosted video accepted-model unions remove `alibaba/happyhorse-1.0`; add `alibaba/happyhorse-1.1`, `kwaivgi/kling-v3-video`, `kwaivgi/kling-v3-omni-video`, `pixverse/pixverse-v6`, `runwayml/aleph-2`, `grok-imagine-video-1.5`, `minimax/h3`, and `fal-ai/pixverse/c1`; and finish with 32 active selectors.
- Bare-provider defaults and `--all-*` expansion change where a removed selector currently participates.
- Historical benchmark and result readers continue recognizing removed identities, but new manifests and executions emit only canonical active IDs.
- Invalid model-specific resolution, duration, reference-input, and mode combinations fail before price calculation or provider dispatch.

## Rationale

- A model selector is a runtime promise, so validation, pricing, request construction, response parsing, help, tests, and historical identity must move together.
- Correcting shut-down, deprecated, and superseded selectors first restores truthful CLI behavior before expanding the surface.
- A newer same-family generation excludes older generations from new selection even when an older endpoint remains callable; current latency, quality, and cost tiers may coexist when they are documented siblings rather than replacements.
- Fixed provider IDs keep manifests, pricing, benchmarks, and all-provider runs reproducible.
- Requiring capability-dependent work inside its media phase before exposing a selector prevents registry presence from being mistaken for adapter support.
- Retaining current video selectors preserves documented operation-specific routes when a newer model lacks operation parity, while still removing generations that have a complete current replacement.
- Using stable fal.ai family selectors while routing internally to mode-specific endpoints keeps manifests and resume identities stable without hiding materially different request contracts.
- Keeping removed IDs only in historical readers preserves benchmark evidence without continuing to advertise stale selectors.

## Consequences

Positive outcomes:

- Hosted image and video commands expose current concrete models and stop advertising a shut-down Gemini image preview, a sunsetted Reve provider, and superseded selectors.
- Pricing, defaults, all-provider expansion, and model-specific validation remain synchronized with accepted types.
- Current quality, latency, reference, editing, and generation-mode choices become available through existing providers plus one selected image and video aggregator.
- Historical benchmark artifacts remain attributable to the model that produced them.
- Both media phases can be verified locally before any separately approved provider call.

Negative outcomes:

- Explicit configurations using removed selector names must migrate.
- The active image and video selector surface grows from 50 to 66 entries, increasing help, documentation, and all-provider maintenance.
- The Gemini, Replicate, fal.ai, and video additions require more than registry edits.
- fal.ai adds another credential, billing relationship, queue protocol, provider identity, and failure surface.
- Pricing and timing metadata for new models may initially rely on published rates and explicitly provisional same-family timing estimates until paid calibration is separately approved.
- SkyReels V4 and Helios remain unavailable without separate provider or realtime-streaming work.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Current, concrete, reproducible selectors | Compatibility with stale explicit selector values |
| Truthful provider-specific capabilities | More validation and adapter branches |
| Historical result continuity | Separate canonical and historical identity handling |
| Media-specific, attributable verification | More implementation passes than one registry-wide edit |
| Broader hosted image and video coverage | Larger active registries and potentially larger paid all-provider runs |

## Test Plan

Each phase must pass local, no-cost verification:

```bash
bun run check
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/
git diff --check
```

Phase 1 and the fal.ai implementation verification passed on 2026-08-06 without hosted generation calls: `bun run check`; targeted CLI help, usage, option-resolution, selector, and links contracts; and mocked queue request, polling, result-download, and metadata contracts covering all five image selectors and both video selectors. No paid fal.ai generation was executed.

Phase 2 existing-provider verification passed on 2026-08-06 without hosted generation calls: `bun run check`; 68 targeted video request, selection, option-resolution, pricing, provenance, and budget-registry contracts; the required CLI help, usage, and option-resolution smoke contracts; and `git diff --check`. The active hosted video registry contains exactly 32 selectors. Replicate schemas and prices were checked against the live model metadata and public model pages, and Grok 1.5 behavior and pricing were checked against xAI's model card and video workflow documentation.

The W9.2 Veo response-shape audit passed on 2026-08-10 without a hosted generation call: `bun run check`; `gemini-rest-contracts.test.ts`, `gemini-veo.test.ts`, and `prompt-normalization.test.ts` (14/14); `cli-help-contracts.test.ts` and `cli-usage-errors.test.ts` (96/96); `option-resolution-contracts/` (98/98); and `git diff --check`. Re-enabling the removed SDK-style `videoBytes` and `mimeType` aliases made the focused provenance contract fail; restoring the raw REST boundary returned it to green.

Also run the smallest relevant pricing, provenance, selector-ordering, routing, request-builder, response-parser, resume, and historical-normalization contracts for the providers changed in that phase. Tests must prove active-selector acceptance, removed-selector rejection, canonical defaults, exact all-provider expansion, complete pricing metadata, and local rejection of unsupported model/control combinations.

Do not run `bun run t`, `bun test/test-runner.ts`, hosted synthesis or generation commands, provider smoke tests, or e2e tests as implementation verification. Any live provider validation or calibration is paid or quota-limited and requires immediate explicit approval naming the exact command and expected cost or quota risk.

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Revisit SkyReels V4 and Helios only through a separate decision after selecting a compatible provider or defining the required realtime-streaming contract | Video maintainers | Deliberately deferred |

## References

- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)
- Related ADR: [ADR-011](ADR-011-refresh-current-hosted-llm-and-ocr-models.md)
- Related ADR: [ADR-012](ADR-012-add-price-preflight-to-resume.md)
- Related ADR: [ADR-013](ADR-013-add-refresh-metadata-to-links.md)
- Related ADR: [ADR-016](ADR-016-refresh-current-hosted-stt-models.md)
- Related ADR: [ADR-018](ADR-018-refresh-current-hosted-tts-and-music-models.md)
- `project/links/all-image-links.md`
- `project/links/all-video-links.md`
- `src/cli/commands/setup-and-utilities/models/image-models.ts`
- `src/cli/commands/setup-and-utilities/models/image-config.json`
- `src/cli/commands/setup-and-utilities/models/video-models.ts`
- `src/cli/commands/setup-and-utilities/models/video-config.json`
