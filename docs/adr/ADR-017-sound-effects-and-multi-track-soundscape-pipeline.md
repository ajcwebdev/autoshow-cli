# ADR-017: Add Provider-Neutral Sound Effects and Multi-Track Soundscape Mixing

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-13
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed

## Context

ADR-013 established the shared dialogue-rendering foundation used by `comic generate-audio`: canonical structured-script input, `ComicDialoguePlan` v2, provider-qualified voice snapshots, native and segmented speech rendering, content-addressed synthesis caches, bounded provider work, versioned render artifacts, a final dialogue timeline, and 16-bit or 24-bit mono or stereo WAV output. However, that foundation (`structured-script.json` v4) lacked a soundscape domain—providing no representation for non-verbal reactions, discrete action effects, or ambient beds. The prior local audio path could concatenate dialogue, insert authored pauses, mix simultaneous speech, apply a small set of voice filters, and transcode to the requested WAV profile, but it could not schedule sound-effect generation, place independent clips against the final speech clock, retain reusable semantic stems, or build a mastered multi-bus mix with ambience ducking.

The existing artifact vocabulary is deliberately extensible: `AudioMixPlan`, `AudioTransformLedger`, `FinalTimeline`, and `AudioRun` already bind local transforms and outputs to immutable provider results. The soundscape design must extend those contracts rather than create another `manifest.json`, cache authority, provider scheduler, or comic-local HTTP stack. It must also preserve ADR-013's ability to render several dialogue targets without buying the same provider-neutral sound effects once per voice target.

The authored representation and the provider request representation have different responsibilities. A script should say what is heard, where it occurs, whether omission is allowed, and how it should be placed. It should not embed an API provider name, model ID, provider duration limit, output codec, or billing policy. Those execution details change independently and belong to model-qualified target selection, capability fixtures, render plans, and manifests.

Absolute `timestampMs` values are not stable source anchors because dialogue duration changes with the selected voice, provider strategy, repair take, pacing profile, and local transforms. Mid-turn cues require a mapping from canonical Unicode text offsets to the selected speech take's final audio clock. A cue that cannot be resolved exactly must never be silently clamped, guessed, or dropped.

Hosted sound generation is paid or quota-limited work. `--price` must remain read-only and make no provider calls, ordinary execution must require an explicit sound-effect target when uncached generation is needed, and offline fixture audio must cover the complete planning and mixing engine without paid verification.

Why now: ADR-013 makes speech identity, timing, caching, artifacts, and resume trustworthy enough to serve as the dialogue bus; the next architectural gap is a durable sound-intent and multi-track mixing layer that can add effects without weakening those guarantees.

## Options Considered

**Option 1**

- **Option:** Add ElevenLabs-specific fields and mixing directly to `comic generate-audio`
- **Pros:** Smallest initial implementation; reuses an existing credential and transport
- **Cons:** Couples source files to one API, duplicates shared scheduling and persistence, makes cue timing depend on one dialogue path, and repeats SFX generation for multi-provider dialogue comparisons
- **Quantitative Notes:** 1 provider; 1 command-specific path; high migration cost

**Option 2**

- **Option:** Integrate several SFX providers before defining the timeline and artifact contracts
- **Pros:** Broad provider choice immediately
- **Cons:** Multiplies serializer, capability, pricing, async-polling, and failure behavior before the common contract is proven
- **Quantitative Notes:** At least 4 adapters before one verified vertical slice

**Option 3**

- **Option:** Build only a local mixer and require users to supply every clip
- **Pros:** Enables entirely offline development and deterministic mastering
- **Cons:** Does not satisfy text-to-sound generation or exercise hosted generation, price, readiness, cache, and resume contracts
- **Quantitative Notes:** 0 hosted adapters

**Option 4 (selected)**

- **Option:** Build the complete provider-neutral vertical slice with ElevenLabs, then add capability-scoped providers in seven phases
- **Pros:** Proves schema, timeline, stem, cache, price, artifact, and hosted execution boundaries in Phase 1; keeps authored intent portable; adds each later provider only where its documented API fits
- **Cons:** Requires explicit phase gates and truthful unsupported capabilities; the final AudioGen phase depends on a pinned community deployment
- **Quantitative Notes:** 7 independently verifiable phases; 2 dedicated SFX targets by Phase 7

## Decision

Add a provider-neutral soundscape domain to the shared script-to-audio workflow and deliver it through the seven-phase implementation plan in this ADR. Phase 1 is the complete vertical slice and uses ElevenLabs for every new hosted capability. Phase 2 connects relevant capabilities already implemented for Cartesia, Hume, and MiniMax. Phase 3 adds first-party Inworld AI across TTS, instant/pro cloning, voice design, natural language steering, and audio markups. Phase 4 adds DeepInfra hosted speech models including ResembleAI Chatterbox, Xiaomi MiMo V2.5, and Qwen3-TTS. Phase 5 adds version-pinned Replicate Kokoro stock-voice synthesis and defers reference-audio cloning or native-dialogue community models until their distinct protected-asset and serializer contracts are implemented. Phase 6 adds Fish Audio across synthesis, native dialogue/timestamps, stateless voice design, and voice-model lifecycle. Phase 7 adds Meta AudioGen through a version-pinned Replicate community deployment as a second dedicated SFX target.

The phase order is normative. A later phase does not begin until the preceding phase meets its offline acceptance gate. Each provider is added only for capabilities supported by a dated fixture and current primary documentation; an unsupported operation must remain explicitly unsupported rather than being approximated through a different API.

This applies to:

- `structured-script.json` sound intent, immutable soundscape planning, cue-to-timeline resolution, provider generation tasks, reusable generated assets, semantic stems, final mixes, and comic audio artifacts.
- `comic generate-audio` target selection, static validation, no-call price planning, execution readiness, bounded dispatch, resume, and publication when a scene contains sound intent.
- Local audio normalization, placement, looping, fades, stereo panning, ambience ducking, limiting, stem export, and final WAV mastering.
- Phase 1 through Phase 7 extensions to provider-qualified synthesis, protected voice provisioning, and the provider-dependent portions of the shared `voice` command.

### TTS synthesis versus voice management

`tts` remains compatible with every implemented TTS model and uses exactly one existing stock, designed, or cloned voice. `voice` and `comic reference-voice` manage catalog, design, clone, inspect, and delete only for ElevenLabs `eleven_v3`, Inworld `realtime-tts-2`, Fish `s2.1-pro`, Cartesia `sonic-3.5-2026-05-04`, and Speechify `simba-3.2`. Hume, MiniMax, DeepInfra, Mistral, Replicate, fal.ai, and stock-only models stay synthesis-only. fal.ai Maya stays off the voice surface until it exposes a durable voice port.

Each voice-managed model must keep a working expressiveness path. The methods differ and are not rewritten into one markup dialect:

**Model 1: ElevenLabs `eleven_v3`**

- **Model:** ElevenLabs `eleven_v3`
- **Expressiveness method:** v3 audio tags plus style, stability, and similarity
- **Compatible path:** Authored `[whispers]`/`[laughs]` stay in spoken text; dialogue `delivery` converts to the documented v3 tag allowlist; `--elevenlabs-tts-style`, `--elevenlabs-tts-stability`, and `--elevenlabs-tts-similarity-boost` serialize as `voice_settings`

**Model 2: Inworld `realtime-tts-2`**

- **Model:** Inworld `realtime-tts-2`
- **Expressiveness method:** Request-level instruction plus inline vocal tags
- **Compatible path:** `--tts-instructions` serializes as `instruction`; `[happy]`, `[laugh]`, and `[breathe]` stay in `text`

**Model 3: Fish `s2.1-pro`**

- **Model:** Fish `s2.1-pro`
- **Expressiveness method:** In-text `[emotion]` and delivery markup
- **Compatible path:** Dialogue `delivery` converts to the documented Fish tag allowlist; inline `[emotion]` stays in spoken text

**Model 4: Cartesia `sonic-3.5-2026-05-04`**

- **Model:** Cartesia `sonic-3.5-2026-05-04`
- **Expressiveness method:** SSML-like performance tags plus `[laughter]`
- **Compatible path:** `<speed>`, `<volume>`, `<emotion>`, `<break>`, `<spell>`, and `[laughter]` stay in the transcript

**Model 5: Speechify `simba-3.2`**

- **Model:** Speechify `simba-3.2`
- **Expressiveness method:** SSML `<speak>` with prosody, break, emphasis, sub, and `speechify:style`
- **Compatible path:** Authored SSML stays in `input`; wrap SSML in `<speak>`

This does not:

- Replace the voice identity, consent, approval, casting, protected-asset, or dialogue-strategy contracts owned by ADR-013; new provider adapters must implement those contracts.
- Infer sound cues from panel X coordinates or couple audio placement to `scene.json` camera composition.
- Treat provider-generated reverb or a textual spatial prompt as measured acoustic simulation.
- Add a standalone general-purpose SFX command.
- Run a hosted sound generation request as ADR verification.
- Own presentation-specific panel reconciliation, cross-panel serialization, derived slideshow audio, or still-image video rendering; ADR-018 consumes retained soundscape evidence without mutating it.

### Architectural Boundaries

**Owner 1: Comic source workflow**

- **Owner:** Comic source workflow
- **Responsibilities:** Authored sound intent, stable source-segment references, source spans, optional scene-level mix-profile selection
- **Must not own:** Provider/model IDs, credentials, billing, retry policy, provider response formats

**Owner 2: Soundscape planner**

- **Owner:** Soundscape planner
- **Responsibilities:** Intent validation, immutable synthesis tasks, timeline anchors, required/optional policy, generation identity, mix identity
- **Must not own:** Provider HTTP clients, canonical run persistence, voice casting

**Owner 3: Audio provider adapter**

- **Owner:** Audio provider adapter
- **Responsibilities:** Exact provider/model/modality capability fixture, request serialization, response decoding metadata, sanitized errors, observed usage, and provider voice lifecycle ports where applicable
- **Must not own:** Source parsing, final placement, bus gain, panning, ducking, or invented fallback capabilities

**Owner 4: Shared execution layer**

- **Owner:** Shared execution layer
- **Responsibilities:** Static validation, `--price`, readiness, bounded provider lanes, request evidence, cache materialization, cancellation, resume
- **Must not own:** A second scheduler or unbounded cue fan-out

**Owner 5: Local mastering layer**

- **Owner:** Local mastering layer
- **Responsibilities:** Canonical format conversion, anchor resolution, stem assembly, deterministic transforms, master and timeline output
- **Must not own:** Provider selection, remote calls, silent timing approximation

**Owner 6: Canonical artifact layer**

- **Owner:** Canonical artifact layer
- **Responsibilities:** One scene-run `manifest.json`, checksummed domain artifacts, append-only attempts, selected-success pointers
- **Must not own:** A soundscape-specific manifest or unversioned cache side channel

**Owner 7: ADR-018 presentation layer**

- **Owner:** ADR-018 presentation layer
- **Responsibilities:** Read-only consumption of retained cue sources, cue placement evidence, ambience, and the selected soundscape run
- **Must not own:** Mutation or replacement of the original soundscape timeline, stems, master, or selected-success pointers

Types belong in a new `src/types/soundscape-workflow/` domain and remain exported only through `src/types/index.ts`. Shared execution may live beside the current script-to-audio implementation while Step 4 remains the repository's audio-rendering host, but comic must consume it through shared contracts rather than importing provider adapters.

### Authored Intent and Planning Contracts

`structured-script.json` advances from v4 to v5 and adds a strict scene-level `soundscape` object. An empty `cues` and `ambientBeds` collection is valid and preserves dialogue-only behavior without invoking a sound-effect provider. The v5 migration is a clean break: existing v4 scene runs must be rebuilt, source identity, the structured-script artifact reference, and scene-run identity bind the exact v5 bytes, and there is no v4 upgrader or compatibility reader inside `comic generate-audio`.

Every sound intent retains the exact source span that authorized it. The Markdown grammar recognizes block labels `**SFX:**`, `**VOCAL SFX:**`, and `**AMBIENCE:**` and inline `[[SFX: ...]]` or `[[VOCAL SFX: ...]]` directives for mid-turn placement. A directive is required by default; an explicit `OPTIONAL` prefix makes it optional. An optional provider-neutral control envelope may follow the policy, such as `{duration: 2.5s, gain: -3dB, pan: -0.4}`; duration is constrained to 0.5–30 seconds, gain is expressed in decibels, and pan is a constant-power position from -1 to 1. These controls populate authored intent and never select a provider or encode a provider request. A block directive is anchored at its source-order boundary—scene start before the first speakable segment and the preceding speakable segment's end otherwise—while an inline directive is anchored to its canonical spoken-text offset. An ambience block covers the full resolved scene unless it declares an explicit anchor range. Unlabelled action or panel direction remains visual staging and does not become a paid synthesis task. LLM review may classify and normalize an explicitly authored directive, but it may not invent a cue, change required/optional policy, or detach a cue from its source span. Stable cue IDs derive from source identity, source span, cue kind, and normalized authored intent rather than array position.

Authored cues describe domain intent, not execution. The schema distinguishes:

- Non-verbal vocal reactions from discrete action SFX so the mixer retains separate semantic buses even when one provider can generate both.
- One-shot cues from ambient beds.
- Required cues, whose failure prevents master publication, from optional cues, whose omission must be explicit in the result.
- Synthesis duration intent from playback placement and final observed duration.
- Gain and stereo pan intent from provider request parameters.

A cue anchor is one of:

- An explicit non-negative scene-clock position.
- The start or end of a speakable `sourceSegmentId` plus a signed millisecond offset.
- A canonical Unicode scalar-value text offset within a speakable source segment plus a signed millisecond offset.

Ambient beds define either an explicit start/end anchor range or the full resolved scene range. Provider-generated clip duration and bed playback range are separate: an ambient source may be repeated with deterministic overlap fades and trimmed to its resolved range. One-shot clips are never time-stretched by default; any future time-stretch policy must be explicit and identity-bearing.

Provider, model, transport, output encoding, prompt influence, retry controls, and cost never appear in `structured-script.json`. A provider-neutral `SoundscapePlan` binds the structured-script hash, dialogue-plan ID, cue intent, synthesis tasks, anchor rules, selected mix profile, and required/optional policy. Provider-qualified `SoundEffectRenderPlan` artifacts are derived from it only after CLI/config target resolution.

The planner uses stable content identities. Renaming or editing a prompt creates a new generation identity. Moving the same generated clip, changing a bus gain, or changing ducking creates a new mix identity but reuses the generation result.

### Timeline Resolution

The workflow is:

```text
structured-script.json v5
  -> ComicDialoguePlan + SoundscapePlan
  -> dialogue render --------------------------+
  -> sound-effect task generation/cache -------+ bounded independently
                                                |
  -> selected final dialogue timeline ----------+
  -> strict cue-anchor resolution
  -> canonical source normalization
  -> dialogue / vocal-reaction / action-SFX / ambience buses
  -> deterministic stem transforms and final mix
  -> stems + master + compact mix record
```

A source-segment edge anchor resolves from the selected final dialogue timeline, after pauses, overlaps, repairs, and provider timing normalization. A text-offset anchor resolves only from retained provider timing that has been mapped through `PreparedProviderText` and the audio transform ledger to the final canonical clock. If exact mapping is unavailable, the default strict timing policy fails before mastering and names the cue and missing evidence. The explicit `proportional` policy linearly maps the canonical Unicode scalar offset across the exact retained turn range; every such resolution records algorithm `canonical-offset-linear-v1`, a hash of its input evidence, and a worst-case error bound in the resolved timeline, and the policy participates in soundscape plan and mix identity.

Negative offsets are allowed relative to source anchors. If a resolved clip would begin before the existing timeline origin, the mixer adds measured pre-roll and shifts every bus and final timeline consistently; it never truncates the cue or clamps it to zero. A cue extending beyond dialogue extends the scene and full-scene ambient range. Required cue collisions are mixed; they are not serialized unless the source explicitly places them that way.

### Provider Target and Generation Contract

Sound effects are a distinct target modality. `--sfx-provider <provider=model>` selects exactly one dedicated sound-effect target and has no paid hosted default. Phase 1 permits ElevenLabs, Phase 7 adds the pinned Replicate AudioGen target, and Stability `stable-audio-3` was accepted as a third target after Phase 7. Cartesia, Hume, MiniMax, Inworld, DeepInfra, Replicate speech, and Fish are not accepted by this selector unless a later ADR records a documented non-speech endpoint. Dialogue `--provider` selection remains independent. A fresh v5 render with prompt-based action-SFX or ambience intent requires an explicit SFX target. Resume may reuse the exact target pinned by a compatible retained render plan; it may not search every provider cache or infer a target from credentials. If neither source of target identity exists, static validation fails with an actionable message. A scene with empty sound intent performs no SFX target setup.

Vocal reactions are a separate routing case because they may require character identity. Phase 1 can render them through the ElevenLabs sound-effect target. Starting in Phase 2, a dialogue target may render an authored vocal reaction through its own TTS adapter only when its capability fixture supports the requested delivery and preserves the selected character voice. Such results are qualified by the dialogue target and are not reused across incompatible voice targets. If neither the selected voice target nor the explicit SFX target supports a required vocal reaction, static validation fails rather than silently converting it to dialogue text or generic foley.

A sound-effect target carries provider, model, transport, capability fixture, pricing, output constraints, and an invocation that accepts the immutable synthesis request plus cancellation and request-evidence context. Provider responses retain observed audio format, duration, sanitized request/response evidence, provider request ID when available, billed usage, and a checksummed audio artifact. Bus gain, pan, placement, looping during playback, and mastering format remain local and are not sent as provider synthesis controls unless a provider capability explicitly makes them generation inputs.

Generation cache keys include the operation, provider, model, transport, serializer/adapter version, capability fixture hash, normalized prompt, every provider-affecting request field, and requested output format. They exclude placement, bus gain, pan, ducking, and final master profile. The implementation reuses ADR-013's content-addressed synthesis provenance and materialization semantics, using modality-specific typed envelopes within the shared cache authority.

SFX work uses the shared provider target scheduler, generation resource gate, non-secret account lane identity, immutable admissions, retry feedback, cancellation, and bounded worker pattern. It does not reuse TTS text-chunk semantics, and it must not dispatch an unbounded `Promise.all` over cues. A provider-neutral action-SFX or ambience result may feed every selected dialogue target's mix. A voice-qualified vocal-reaction result may be reused only where provider, model, voice snapshot, prepared input, and every generation-affecting control match.

Sound-effect dispatch also joins the run-scoped hosted coordinator used by comic dialogue. `--sfx-concurrency` remains the work-class ceiling; default ramp mode starts one request for each provider/account lane and adds one slot every five seconds while cues are queued, while immediate mode starts at the ceiling. Classified 429 pressure halves the lane's live aggregate limit and permits only one exact-request recovery probe after backoff. Durable admission evidence is written before provider dispatch, completed audio remains reusable, and the shared recovery path does not replay an ambiguous paid create by default. TTS synthesis may do so only when the user supplies `--allow-ambiguous-redispatch`, which authorizes reconciling a stored slot on a later checkpoint resume — not an in-flight repurchase — with an explicit duplicate-purchase warning (amended 2026-08-20, ADR-006 §D.4). Dialogue and SFX classes keep their own caps while sharing the highest registered aggregate bound when they use the same provider/account lane.

`--price` resolves the same soundscape and generation plans, accounts for verified cache/resume hits, reports per-target request and duration units, and marks unknown prices as unknown rather than zero. It performs no credential check, network call, directory creation, cache write, or manifest update. Execution readiness occurs only after static validation and before the first dispatch barrier.

Every hosted adapter must separate static capability and pricing facts from execution readiness. Account quota, subscription tier, model availability, and endpoint access are execution observations, not facts inferred by `--price`. Provider response formats are observed and retained before local normalization; account-dependent output formats are never assumed from the general endpoint schema.

### Four-Bus Mixing and Mastering

The semantic buses are:

1. Dialogue speech.
2. Non-verbal vocal reactions.
3. Discrete action SFX.
4. Ambient beds.

Spatial processing is a transform over one or more buses, not a fifth stem. Missing buses are valid. The mixer writes each non-empty normalized stem and the final master so a local remix can reuse provider outputs without another purchase.

`SoundscapeMixProfile` extends the current mastering profile with versioned, hash-bound controls for per-bus gain, loudness measurement/normalization policy, ambience sidechain source, ducking depth, detector window and threshold, attack and release, bed-loop crossfade, constant-power stereo pan, fades, limiter/true-peak ceiling, sample rate, channels, codec, and container. The accepted `comic-soundscape-v1` profile is fixture-locked at:
- **Master format:** 48 kHz stereo 24-bit PCM WAV.
- **Bus gains:** dialogue `0 dB`, vocal reactions `-1 dB`, action SFX `-3 dB`, ambience `-14 dB`.
- **Loudness & Dynamics:** `-16 LUFS` integrated loudness, `-1 dBTP` true-peak ceiling, limiter ceiling `0.95`.
- **Sidechain Ducking:** `9 dB` ambience ducking with sidechain ratio `7`, threshold `-32 dB`, attack `30 ms`, release `350 ms`, detector window `50 ms`.
- **Fades & Pan:** `120 ms` ambience-loop crossfade, `8/20 ms` fades, centered default pan, constant-power stereo panning.

The dialogue and vocal-reaction buses drive ambience ducking. Ducking is derived from a measured speech envelope and rendered as a deterministic gain envelope before the ambience bus is summed.

Stereo positioning comes only from explicit authored pan intent or the selected mix profile's center default. Phase 1 uses constant-power stereo panning. Multichannel surround, HRTF binaural rendering, automatic panel-coordinate panning, impulse-response acquisition, and provider-side spatial synthesis are outside the initial scope.

All source audio is decoded and normalized to a canonical intermediate format before placement. The mixer validates finite sample counts, observed duration, channel layout, and output duration; applies fades at trim and loop boundaries; prevents clipping with a deterministic limiter; and records every transform and its parameters in the transform ledger.

### Artifacts, Identity, Resume, and Failure Semantics

The scene run retains exactly one canonical `manifest.json`. Soundscape domain artifacts use descriptive versioned names and checksummed references, including `soundscape-plan.json`, `sound-effect-render-plan.json`, the compact `sfx.json` sound-effect archive, a `sound-effect-render-result.json` record for a render that failed a required cue, stem WAVs, and one compact `mix.json` per mix. No soundscape directory may contain another `manifest.json` or bare `result.json`.

Provider generation artifacts are stored independently of dialogue target artifacts. Final mix artifacts bind one selected dialogue `AudioRun`, the `SoundscapePlan`, selected sound-effect generation results or cache materializations, the mix-profile hash, the resolved timeline summary, all stem checksums, and the final master checksum. This separation lets several dialogue targets share one set of SFX results while retaining distinct final mixes.

Soundscape masters publish beside preserved dialogue outputs as `audio/final/<dialogue-target-key>.soundscape.wav`. This keeps the dialogue provider projection checksum-valid while making the selected master explicit through `selectedSoundscapeRuns` and `finalOutputRefs`.

Resume verifies identities and checksums before reuse. A mix-only change reuses verified dialogue and SFX generation results. A prompt or provider-affecting request change creates new generation work. A dialogue repair re-resolves anchors and creates a new mix identity without regenerating unchanged SFX. Ambiguous provider admission follows ADR-013's explicit `--allow-ambiguous-redispatch` authorization and may not be repurchased silently. Every TTS provider/model added by Phases 3–6 is also present in the canonical standalone TTS selection descriptor, so fresh selection, price, and additive resume cannot drift into separate provider inventories.

A failed required cue fails the soundscape render and prevents publication of that master while preserving verified dialogue and SFX artifacts for resume. A failed optional cue is recorded as omitted with a sanitized reason and does not disappear from the timeline. Cancellation stops queued cue work, drains active work, leaves canonical state resumable, and never publishes a partial master as success.

## Rationale

- Source-level sound intent remains stable when provider catalogs, API limits, and pricing change.
- Timeline anchors preserve synchronization across voices, providers, pacing, repairs, and local transforms.
- Offline-first fixture coverage validates the highest-risk mixing and identity logic without provider cost.
- Separate generation and mix identities maximize safe reuse and prevent gain or placement edits from buying the same sound again.
- Existing ADR-002, ADR-008, ADR-010, and ADR-013 contracts remain the authorities for manifests, scheduling, model capabilities, price planning, and audio render evidence.
- A complete ElevenLabs vertical slice proves the provider boundary before capability-scoped TTS expansion, new voice-provider integrations, and the community-hosted AudioGen dependency are introduced.

## Implementation Note

The seven delivery phases are implemented in the codebase as follows:

- **Phase 1 (Complete ElevenLabs Vertical Slice):** Implemented in `src/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/soundscape-directives.ts`, `src/cli/commands/process-steps/step-4-tts/soundscape/soundscape-planner.ts`, `src/cli/commands/process-steps/step-4-tts/soundscape/elevenlabs-sfx-adapter.ts`, and `src/cli/commands/process-steps/step-4-tts/soundscape/soundscape-mixer.ts`. Pins `eleven_text_to_sound_v2` (`POST /v1/sound-generation`), `structured-script.json` v5 schema, four-bus mixing, stem generation, calibrated `comic-soundscape-v1` mastering profile, and shared typed cache materialization.
- **Phase 2 (Existing Provider Capabilities):** Cartesia, Hume, and MiniMax dialogue targets participate through the shared comic-audio planning, readiness, and segmented-render paths, and their authored expressiveness stays inside each provider's own TTS adapter (Cartesia transcript performance tags, Hume acting descriptions and Octave 2 native utterances, MiniMax segmented rendering). `src/cli/commands/process-steps/step-4-tts/soundscape/soundscape-routing.ts` records a per-cue routing decision against the selected dedicated SFX target and fails a required vocal reaction that target cannot render, so speech endpoints are never treated as general SFX targets.
- **Phase 3 (First-Party Inworld AI):** Steerable `realtime-tts-2` REST adapter (`runInworldTts`, `POST /tts/v1/voice`), WORD/viseme timing alignment, injectable WebSocket protocol adapter (`synthesizeInworldWebSocket`), instant clone, and prompt-driven voice design candidate materialization.
- **Phase 4 (DeepInfra Hosted Speech Suite):** Model-specific serializers and decoders for ResembleAI Chatterbox Turbo (`$1.00/1M`), Xiaomi MiMo V2.5 (`$0.00/1M`), and Alibaba Qwen3-TTS (`$20.00/1M`), plus consent-gated zero-shot cloning.
- **Phase 5 (Replicate Version-Pinned Kokoro):** Pinned `jaaari/kokoro-82m` stock-voice adapter (`POST /v1/predictions`), immediate local output capture to prevent remote expiration, and rejection of unverified/deferred community models.
- **Phase 6 (Fish Audio):** `s2.1-pro` TTS, native multi-speaker dialogue planning with `<|speaker:N|>` tags, timestamped SSE `chunk_seq` reduction, stateless `voice-design-1` candidate materialization via `POST /model`, CLI clone parity, and reconcile without blind recreation.
- **Phase 7 (Meta AudioGen via Replicate):** Second dedicated SFX target (`--sfx-provider replicate=sepal/audiogen@154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8`) under CC BY-NC 4.0 license governance, noncommercial-use enforcement, deterministic local ambience looping, and historical manifest readability.

A third dedicated SFX target followed the phased plan: Stability `stable-audio-3` (`POST /v2beta/audio/stable-audio-3/text-to-audio`) in `src/cli/commands/process-steps/step-4-tts/soundscape/stability-stable-audio-adapter.ts`. Like AudioGen it renders action SFX and ambience only and refuses vocal reactions, which stay on the ElevenLabs target.

Public types live in `src/types/soundscape-workflow/` — `soundscape-types.ts` plus the execution, timeline, mixer, and per-adapter modules — and are exported only through `src/types/index.ts`.

## Consequences

Positive outcomes:

- Comic scenes can retain portable non-verbal reaction, action-effect, and ambience intent and render it into inspectable stems and a final master.
- Multi-provider dialogue comparisons share generated effects instead of multiplying SFX cost.
- Cue timing, optional omissions, cache reuse, billed usage, and every local transform remain auditable.
- Dialogue-only v5 scenes keep the existing execution behavior and make no SFX provider call.
- Later phases add provider capabilities without weakening the distinction between speech generation and dedicated non-speech generation.
- Fish gains the same durable consent, voice registration, audition, approval, lifecycle, pricing, and artifact protections as existing advanced voice providers.

Negative outcomes:

- `structured-script.json` advances to v5 and new canonical scene runs must be rebuilt; the implementation intentionally adds no v4 compatibility reader.
- Final mastering now depends on a selected dialogue timeline, so exact mid-turn cues can block dialogue render targets that do not expose sufficient timing evidence.
- The artifact graph and resume identity become more complex because generation and mixing have separate lifecycles.
- Retaining reusable source audio and semantic stems increases disk usage.
- Seven ordered phases increase the implementation and verification surface, and speech provider phases require provider-wide registry, TTS, voice design, and voice-management work rather than isolated SFX adapters.
- The Replicate AudioGen target is a community deployment with weaker availability guarantees than an official hosted model and CC BY-NC 4.0 model weights, so exact version, provenance, permitted-use evidence, and historical readability need additional controls and commercial use is ineligible under the initial fixture.

## Trade-offs

**Trade-off 1**

- **Gain:** Portable authored intent and provider-qualified execution
- **Sacrifice:** More planning types and validation stages

**Trade-off 2**

- **Gain:** Exact, auditable placement
- **Sacrifice:** Strict failures when canonical timing evidence is unavailable

**Trade-off 3**

- **Gain:** Provider-output reuse across many mixes
- **Sacrifice:** Additional retained artifacts and checksums

**Trade-off 4**

- **Gain:** Offline mixer verification
- **Sacrifice:** Hosted quality still requires a separately approved calibration run

**Trade-off 5**

- **Gain:** Ordered, evidence-gated provider expansion
- **Sacrifice:** Seven gated phases before the complete provider set is delivered

**Trade-off 6**

- **Gain:** Fish coverage across applicable `voice` workflows
- **Sacrifice:** Broader provider lifecycle and reconciliation surface

**Trade-off 7**

- **Gain:** A second dedicated SFX target
- **Sacrifice:** Dependence on a pinned Replicate community model in Phase 7

## Test Plan

Run the default no-cost repository verification and targeted offline soundscape contracts:

```bash
bun run check
bun t --price
bun test test/test-cases/validation/comic/soundscape-schema-contracts.test.ts
bun test test/test-cases/validation/comic/soundscape-timeline-contracts.test.ts
bun test test/test-cases/validation/comic/soundscape-mixer-contracts.test.ts
bun test test/test-cases/validation/comic/comic-soundscape-artifact-contracts.test.ts
bun test test/test-cases/validation/comic/comic-audio-{planning-identity,readiness,execution-publication,snapshot-pipeline}-contracts.test.ts
bun test test/test-cases/validation/comic/comic-audio-inworld-phase-3-contracts.test.ts
bun test test/test-cases/validation/comic/comic-audio-deepinfra-phase-4-contracts.test.ts
bun test test/test-cases/validation/comic/comic-audio-replicate-phase-5-contracts.test.ts
bun test test/test-cases/validation/comic/comic-audio-fish-phase-6-contracts.test.ts
bun test test/test-cases/validation/comic/comic-audio-audiogen-phase-7-contracts.test.ts
bun test test/test-cases/validation/media-generation/inworld-tts-adapter-contracts.test.ts
bun test test/test-cases/validation/media-generation/deepinfra-tts-adapter-contracts.test.ts
bun test test/test-cases/validation/media-generation/replicate-tts-adapter-contracts.test.ts
bun test test/test-cases/validation/media-generation/fish-tts-adapter-contracts.test.ts
bun test test/test-cases/validation/media-generation/fish-tts-timing-contracts.test.ts
bun test test/test-cases/validation/media-generation/inworld-tts-timing-contracts.test.ts
bun test test/test-cases/validation/media-generation/inworld-tts-websocket-adapter.test.ts
bun test test/test-cases/validation/media-generation/elevenlabs-sfx-adapter-contracts.test.ts
bun test test/test-cases/validation/media-generation/replicate-audiogen-adapter-contracts.test.ts
bun test test/test-cases/validation/media-generation/stability-stable-audio-adapter-contracts.test.ts
bun test test/test-cases/validation/media-generation/voice-clone-phase-1-contracts.test.ts
bun test test/test-cases/validation/resume-manifests/resume-provider-surface-contracts.test.ts
bun test test/test-cases/validation/resume-manifests/tts-resume-batch-contracts.test.ts
bun test test/test-cases/validation/resume-manifests/tts-resume-canonical-contracts.test.ts
bun test test/test-cases/validation/resume-manifests/tts-resume-protected-mistral-contracts.test.ts
git diff --check
```

The offline test suite verifies:
- Strict v5 soundscape schema parsing, block/inline directive extraction, control envelopes, and cue-ID stability.
- Exact source-edge and Unicode text-offset timeline resolution, negative pre-roll shifting, and proportional fallback bounds.
- Deterministic four-bus mixing, calibrated loudness/limiting, ambience sidechain ducking, and stem checksum lineage.
- Shared ElevenLabs SFX cache reuse across dialogue targets, durable admission, ambiguous redispatch blocking, and canonical manifest publication.
- Capability routing, provider-specific adapters, WebSocket protocol handling, and mock-backed prediction lifecycles.
- No-cost `--price` execution with zero network calls and zero file mutations.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — canonical manifest, resume, and no-call price planning
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — workflow type ownership and the `~/types` barrel
- Related ADR: [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md) — cause-aware admission classification, structured failures, and explicit TTS redispatch authorization
- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md) — shared provider infrastructure and comic boundaries
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — bounded provider work and lane identity
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — model-qualified capability, lifecycle, and pricing policy
- Related ADR: [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md) — exact TTS preflight, paid-approval state, and report evidence lifecycle
- Related report: [2026 Hosted-Model Refresh Report: TTS](../models/05-tts-model-report.md) — dated selector, provider, price, and compatibility changes
- Related ADR: [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md) — dialogue, timing, cache, artifact, and mastering foundation
- Related ADR: [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md) — derived panel timing, presentation remix, and still-image rendering
- Core Implementation: `src/types/soundscape-workflow/soundscape-types.ts`
- Direct Provider API References:
  - ElevenLabs: [Sound Effects API](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert) and [Sound Effects Overview](https://elevenlabs.io/docs/overview/capabilities/sound-effects)
  - Inworld AI: [TTS Overview & API](https://docs.inworld.ai/) and [Voice Cloning](https://docs.inworld.ai/docs/tutorial-basics/voice-cloning/)
  - DeepInfra: [Text-to-Speech API](https://docs.deepinfra.com/apis/text-to-speech) and [Models Catalog](https://deepinfra.com/models/text-to-speech)
  - Replicate: [HTTP Prediction API](https://replicate.com/docs/reference/http#create-a-prediction) and [Kokoro API](https://replicate.com/jaaari/kokoro-82m/api)
  - Fish Audio: [API Reference](https://docs.fish.audio/api-reference/introduction) and [OpenAPI Specification](https://api.fish.audio/openapi.json)
  - Meta AudioGen on Replicate: [Pinned AudioGen Version](https://replicate.com/sepal/audiogen/versions/154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8/api) and [AudioCraft AudioGen Documentation](https://github.com/facebookresearch/audiocraft/blob/main/docs/AUDIOGEN.md)
  - Stability AI: [API Reference](https://platform.stability.ai/docs/api-reference) and [Authentication](https://platform.stability.ai/docs/getting-started/authentication)
