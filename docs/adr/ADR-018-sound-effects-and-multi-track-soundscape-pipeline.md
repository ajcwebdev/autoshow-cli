# ADR-018: Add Provider-Neutral Sound Effects and Multi-Track Soundscape Mixing

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-13
- **Date Updated:** 2026-08-14
- **Verification Status:** Passed

## Context

ADR-014 established the shared dialogue-rendering foundation used by `comic generate-audio`: canonical structured-script input, `ComicDialoguePlan` v2, provider-qualified voice snapshots, native and segmented speech rendering, content-addressed synthesis caches, bounded provider work, versioned render artifacts, a final dialogue timeline, and 16-bit or 24-bit mono or stereo WAV output. Before this ADR's Phase 1 implementation, that input was `structured-script.json` v4 and had no first-class soundscape domain.

That foundation did not model or synthesize a complete scene soundscape. The pre-Phase-1 structured script had no first-class representation for non-verbal reactions, discrete action effects, or ambient beds. The prior local audio path could concatenate dialogue, insert authored pauses, mix simultaneous speech, apply a small set of voice filters, and transcode to the requested WAV profile, but it could not schedule sound-effect generation, place independent clips against the final speech clock, retain reusable semantic stems, or build a mastered multi-bus mix with ambience ducking.

The existing artifact vocabulary is deliberately extensible: `AudioMixPlan`, `AudioTransformLedger`, `FinalTimeline`, and `AudioRun` already bind local transforms and outputs to immutable provider results. The soundscape design must extend those contracts rather than create another `manifest.json`, cache authority, provider scheduler, or comic-local HTTP stack. It must also preserve ADR-014's ability to render several dialogue targets without buying the same provider-neutral sound effects once per voice target.

The authored representation and the provider request representation have different responsibilities. A script should say what is heard, where it occurs, whether omission is allowed, and how it should be placed. It should not embed an API provider name, model ID, provider duration limit, output codec, or billing policy. Those execution details change independently and belong to model-qualified target selection, capability fixtures, render plans, and manifests.

Absolute `timestampMs` values are not stable source anchors because dialogue duration changes with the selected voice, provider strategy, repair take, pacing profile, and local transforms. Mid-turn cues require a mapping from canonical Unicode text offsets to the selected speech take's final audio clock. A cue that cannot be resolved exactly must never be silently clamped, guessed, or dropped.

Hosted sound generation is paid or quota-limited work. `--price` must remain read-only and make no provider calls, ordinary execution must require an explicit sound-effect target when uncached generation is needed, and offline fixture audio must cover the complete planning and mixing engine without paid verification.

Why now: ADR-014 makes speech identity, timing, caching, artifacts, and resume trustworthy enough to serve as the dialogue bus; the next architectural gap is a durable sound-intent and multi-track mixing layer that can add effects without weakening those guarantees.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| Add ElevenLabs-specific fields and mixing directly to `comic generate-audio` | Smallest initial implementation; reuses an existing credential and transport | Couples source files to one API, duplicates shared scheduling and persistence, makes cue timing depend on one dialogue path, and repeats SFX generation for multi-provider dialogue comparisons | 1 provider; 1 command-specific path; high migration cost |
| Integrate several SFX providers before defining the timeline and artifact contracts | Broad provider choice immediately | Multiplies serializer, capability, pricing, async-polling, and failure behavior before the common contract is proven | At least 4 adapters before one verified vertical slice |
| Build only a local mixer and require users to supply every clip | Enables entirely offline development and deterministic mastering | Does not satisfy text-to-sound generation or exercise hosted generation, price, readiness, cache, and resume contracts | 0 hosted adapters |
| **Build the complete provider-neutral vertical slice with ElevenLabs, then add capability-scoped providers in seven phases** | Proves schema, timeline, stem, cache, price, artifact, and hosted execution boundaries in Phase 1; keeps authored intent portable; adds each later provider only where its documented API fits | Requires explicit phase gates and truthful unsupported capabilities; the final AudioGen phase depends on a pinned community deployment | 7 independently verifiable phases; 2 dedicated SFX targets by Phase 7 |

## Decision

Add a provider-neutral soundscape domain to the shared script-to-audio workflow and deliver it through the seven-phase implementation plan in this ADR. Phase 1 is the complete vertical slice and uses ElevenLabs for every new hosted capability. Phase 2 connects relevant capabilities already implemented for Cartesia, Hume, and MiniMax. Phase 3 adds first-party Inworld AI across TTS, instant/pro cloning, voice design, natural language steering, and audio markups. Phase 4 adds DeepInfra hosted speech models including ResembleAI Chatterbox, Xiaomi MiMo V2.5, and Qwen3-TTS. Phase 5 adds Replicate open-source speech models including F5-TTS, Dia 1.6B, and XTTS-v2. Phase 6 adds Fish Audio across synthesis, native dialogue/timestamps, stateless voice design, and voice-model lifecycle. Phase 7 adds Meta AudioGen through a version-pinned Replicate community deployment as a second dedicated SFX target.

The phase order is normative. A later phase does not begin until the preceding phase meets its offline acceptance gate. Each provider is added only for capabilities supported by a dated fixture and current primary documentation; an unsupported operation must remain explicitly unsupported rather than being approximated through a different API.

This applies to:

- `structured-script.json` sound intent, immutable soundscape planning, cue-to-timeline resolution, provider generation tasks, reusable generated assets, semantic stems, final mixes, and comic audio artifacts.
- `comic generate-audio` target selection, static validation, no-call price planning, execution readiness, bounded dispatch, resume, and publication when a scene contains sound intent.
- Local audio normalization, placement, looping, fades, stereo panning, ambience ducking, limiting, stem export, and final WAV mastering.
- Phase 1 through Phase 7 extensions to provider-qualified synthesis, protected voice provisioning, and the provider-dependent portions of the shared `voice` command.

This does not:

- Replace the voice identity, consent, approval, casting, protected-asset, or dialogue-strategy contracts owned by ADR-014; new provider adapters must implement those contracts.
- Infer sound cues from panel X coordinates or couple audio placement to `scene.json` camera composition.
- Treat provider-generated reverb or a textual spatial prompt as measured acoustic simulation.
- Add a standalone general-purpose SFX command.
- Run a hosted sound generation request as ADR verification.
- Own presentation-specific panel reconciliation, cross-panel serialization, derived slideshow audio, or still-image video rendering; ADR-019 consumes retained soundscape evidence without mutating it.

### Architectural Boundaries

| Owner | Responsibilities | Must not own |
|---|---|---|
| Comic source workflow | Authored sound intent, stable source-segment references, source spans, optional scene-level mix-profile selection | Provider/model IDs, credentials, billing, retry policy, provider response formats |
| Soundscape planner | Intent validation, immutable synthesis tasks, timeline anchors, required/optional policy, generation identity, mix identity | Provider HTTP clients, canonical run persistence, voice casting |
| Audio provider adapter | Exact provider/model/modality capability fixture, request serialization, response decoding metadata, sanitized errors, observed usage, and provider voice lifecycle ports where applicable | Source parsing, final placement, bus gain, panning, ducking, or invented fallback capabilities |
| Shared execution layer | Static validation, `--price`, readiness, bounded provider lanes, request evidence, cache materialization, cancellation, resume | A second scheduler or unbounded cue fan-out |
| Local mastering layer | Canonical format conversion, anchor resolution, stem assembly, deterministic transforms, master and timeline output | Provider selection, remote calls, silent timing approximation |
| Canonical artifact layer | One scene-run `manifest.json`, checksummed domain artifacts, append-only attempts, selected-success pointers | A soundscape-specific manifest or unversioned cache side channel |
| ADR-019 presentation layer | Read-only consumption of retained cue sources, cue placement evidence, ambience, and the selected soundscape run | Mutation or replacement of the original soundscape timeline, stems, master, or selected-success pointers |

Types belong in a new `src/types/soundscape-workflow/` domain and remain exported only through `src/types/index.ts`. Shared execution may live beside the current script-to-audio implementation while Step 4 remains the repository's audio-rendering host, but comic must consume it through shared contracts rather than importing provider adapters.

## Authored Intent and Planning Contracts

`structured-script.json` advances from v4 to v5 and adds a strict scene-level `soundscape` object. An empty `cues` and `ambientBeds` collection is valid and preserves dialogue-only behavior without invoking a sound-effect provider. The v5 migration is a clean break: existing v4 scene runs must be rebuilt, source identity, the structured-script artifact reference, and scene-run identity bind the exact v5 bytes, and there is no v4 upgrader or compatibility reader inside `comic generate-audio`.

Every sound intent retains the exact source span that authorized it. The initial Markdown grammar recognizes block labels `**SFX:**`, `**VOCAL SFX:**`, and `**AMBIENCE:**` and inline `[[SFX: ...]]` or `[[VOCAL SFX: ...]]` directives for mid-turn placement. A directive is required by default; an explicit `OPTIONAL` prefix makes it optional. An optional provider-neutral control envelope may follow the policy, such as `{duration: 2.5s, gain: -3dB, pan: -0.4}`; duration is constrained to 0.5–30 seconds, gain is expressed in decibels, and pan is a constant-power position from -1 to 1. These controls populate authored intent and never select a provider or encode a provider request. A block directive is anchored at its source-order boundary—scene start before the first speakable segment and the preceding speakable segment's end otherwise—while an inline directive is anchored to its canonical spoken-text offset. An ambience block covers the full resolved scene unless it declares an explicit anchor range. Unlabelled action or panel direction remains visual staging and does not become a paid synthesis task. LLM review may classify and normalize an explicitly authored directive, but it may not invent a cue, change required/optional policy, or detach a cue from its source span. Stable cue IDs derive from source identity, source span, cue kind, and normalized authored intent rather than array position.

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

## Timeline Resolution

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
  -> stems + master + resolved timeline + AudioRun
```

A source-segment edge anchor resolves from the selected final dialogue timeline, after pauses, overlaps, repairs, and provider timing normalization. A text-offset anchor resolves only from retained provider timing that has been mapped through `PreparedProviderText` and the audio transform ledger to the final canonical clock. If exact mapping is unavailable, the default strict timing policy fails before mastering and names the cue and missing evidence. The explicit `proportional` policy linearly maps the canonical Unicode scalar offset across the exact retained turn range; every such resolution records algorithm `canonical-offset-linear-v1`, a hash of its input evidence, and a worst-case error bound in the resolved timeline, and the policy participates in soundscape plan and mix identity.

Negative offsets are allowed relative to source anchors. If a resolved clip would begin before the existing timeline origin, the mixer adds measured pre-roll and shifts every bus and final timeline consistently; it never truncates the cue or clamps it to zero. A cue extending beyond dialogue extends the scene and full-scene ambient range. Required cue collisions are mixed; they are not serialized unless the source explicitly places them that way.

## Provider Target and Generation Contract

Sound effects are a distinct target modality. `--sfx-provider <provider=model>` selects exactly one dedicated sound-effect target and has no paid hosted default. Phase 1 permits ElevenLabs; Phase 7 adds the pinned Replicate AudioGen target. Cartesia, Hume, MiniMax, Inworld, DeepInfra, Replicate speech, and Fish are not accepted by this selector unless a later ADR records a documented non-speech endpoint. Dialogue `--provider` selection remains independent. A fresh v5 render with prompt-based action-SFX or ambience intent requires an explicit SFX target. Resume may reuse the exact target pinned by a compatible retained render plan; it may not search every provider cache or infer a target from credentials. If neither source of target identity exists, static validation fails with an actionable message. A scene with empty sound intent performs no SFX target setup.

Vocal reactions are a separate routing case because they may require character identity. Phase 1 can render them through the ElevenLabs sound-effect target. Starting in Phase 2, a dialogue target may render an authored vocal reaction through its own TTS adapter only when its capability fixture supports the requested delivery and preserves the selected character voice. Such results are qualified by the dialogue target and are not reused across incompatible voice targets. If neither the selected voice target nor the explicit SFX target supports a required vocal reaction, static validation fails rather than silently converting it to dialogue text or generic foley.

A sound-effect target carries provider, model, transport, capability fixture, pricing, output constraints, and an invocation that accepts the immutable synthesis request plus cancellation and request-evidence context. Provider responses retain observed audio format, duration, sanitized request/response evidence, provider request ID when available, billed usage, and a checksummed audio artifact. Bus gain, pan, placement, looping during playback, and mastering format remain local and are not sent as provider synthesis controls unless a provider capability explicitly makes them generation inputs.

Generation cache keys include the operation, provider, model, transport, serializer/adapter version, capability fixture hash, normalized prompt, every provider-affecting request field, and requested output format. They exclude placement, bus gain, pan, ducking, and final master profile. The implementation reuses ADR-014's content-addressed synthesis provenance and materialization semantics, generalizing the shared cache envelope or introducing a modality-specific typed envelope as required, instead of writing loose files beneath a new `.autoshow/cache/sfx/` namespace.

SFX work uses the shared provider target scheduler, generation resource gate, non-secret account lane identity, immutable admissions, retry feedback, cancellation, and bounded worker pattern. It does not reuse TTS text-chunk semantics, and it must not dispatch an unbounded `Promise.all` over cues. A provider-neutral action-SFX or ambience result may feed every selected dialogue target's mix. A voice-qualified vocal-reaction result may be reused only where provider, model, voice snapshot, prepared input, and every generation-affecting control match.

Sound-effect dispatch also joins the run-scoped hosted coordinator used by comic dialogue. `--sfx-concurrency` remains the work-class ceiling; default ramp mode starts one request for each provider/account lane and adds one slot every five seconds while cues are queued, while immediate mode starts at the ceiling. Classified 429 pressure halves the lane's live aggregate limit and permits only one exact-request recovery probe after backoff. Durable admission evidence is written before provider dispatch, completed audio remains reusable, and the shared recovery path does not authorize replaying an ambiguous paid create. Dialogue and SFX classes keep their own caps while sharing the highest registered aggregate bound when they use the same provider/account lane.

`--price` resolves the same soundscape and generation plans, accounts for verified cache/resume hits, reports per-target request and duration units, and marks unknown prices as unknown rather than zero. It performs no credential check, network call, directory creation, cache write, or manifest update. Execution readiness occurs only after static validation and before the first dispatch barrier.

Every hosted adapter must separate static capability and pricing facts from execution readiness. Account quota, subscription tier, model availability, and endpoint access are execution observations, not facts inferred by `--price`. Provider response formats are observed and retained before local normalization; account-dependent output formats are never assumed from the general endpoint schema.

## Four-Bus Mixing and Mastering

The semantic buses are:

1. Dialogue speech.
2. Non-verbal vocal reactions.
3. Discrete action SFX.
4. Ambient beds.

Spatial processing is a transform over one or more buses, not a fifth stem. Missing buses are valid. The mixer writes each non-empty normalized stem and the final master so a local remix can reuse provider outputs without another purchase.

`SoundscapeMixProfile` extends the current mastering profile with versioned, hash-bound controls for per-bus gain, loudness measurement/normalization policy, ambience sidechain source, ducking depth, detector window and threshold, attack and release, bed-loop crossfade, constant-power stereo pan, fades, limiter/true-peak ceiling, sample rate, channels, codec, and container. The first profile keeps the current comic output default of 48 kHz stereo 24-bit PCM WAV. Exact loudness and dynamics defaults are calibrated against checked-in fixture mixes before the ADR can be accepted; they are profile data rather than constants hidden in FFmpeg command strings.

The dialogue and vocal-reaction buses drive ambience ducking. Ducking is derived from a measured speech envelope and rendered as a deterministic gain envelope before the ambience bus is summed. Tests assert envelope transition points and steady-state tolerances rather than expecting a mathematically instantaneous exact attenuation at every sample.

Stereo positioning comes only from explicit authored pan intent or the selected mix profile's center default. Phase 1 uses constant-power stereo panning. Multichannel surround, HRTF binaural rendering, automatic panel-coordinate panning, impulse-response acquisition, and provider-side spatial synthesis are outside the initial scope.

All source audio is decoded and normalized to a canonical intermediate format before placement. The mixer validates finite sample counts, observed duration, channel layout, and output duration; applies fades at trim and loop boundaries; prevents clipping with a deterministic limiter; and records every transform and its parameters in the transform ledger.

## Artifacts, Identity, Resume, and Failure Semantics

The scene run retains exactly one canonical `manifest.json`. Soundscape domain artifacts use descriptive versioned names and checksummed references, including `soundscape-plan.json`, `sound-effect-render-plan.json`, `sound-effect-render-result.json`, `resolved-soundscape-timeline.json`, stem WAVs, and the extended `audio-run.json`. No soundscape directory may contain another `manifest.json` or bare `result.json`.

Provider generation artifacts are stored independently of dialogue target artifacts. Final mix artifacts bind one selected dialogue `AudioRun`, the `SoundscapePlan`, selected sound-effect generation results or cache materializations, the mix-profile hash, the resolved timeline, all stem checksums, and the final master checksum. This separation lets several dialogue targets share one set of SFX results while retaining distinct final mixes.

Resume verifies identities and checksums before reuse. A mix-only change reuses verified dialogue and SFX generation results. A prompt or provider-affecting request change creates new generation work. A dialogue repair re-resolves anchors and creates a new mix identity without regenerating unchanged SFX. Ambiguous provider admission follows ADR-014's explicit redispatch authorization and may not be repurchased silently.

A failed required cue fails the soundscape render and prevents publication of that master while preserving verified dialogue and SFX artifacts for resume. A failed optional cue is recorded as omitted with a sanitized reason and does not disappear from the timeline. Cancellation stops queued cue work, drains active work, leaves canonical state resumable, and never publishes a partial master as success.

## Implementation Plan

Each phase must update model and capability fixtures, static pricing, CLI help, artifacts, and mocked offline contracts together. `--price` remains no-call and no-write in every phase. Provider-backed acceptance tests use fixtures or mocked transports; a live paid or quota-limited run requires separate explicit approval and is not an ADR verification step. Subphases are ordered: `1A` must precede `1B`, and so on, and a phase gate cannot pass until every subphase in that phase passes its exit criterion.

### Phase 1: Complete ElevenLabs Vertical Slice

Phase 1 implements the entire soundscape workflow with ElevenLabs as the only hosted sound provider. It is not an adapter-only milestone.

#### Phase 1A: Authored Intent and Immutable Planning

Advance `structured-script.json` to v5; parse and validate `SFX`, `VOCAL SFX`, and `AMBIENCE` directives; retain source spans and required/optional policy; define stable cue, generation, placement, and mix identities; and create immutable `SoundscapePlan` and provider render-plan contracts. Implement strict source-edge and text-offset anchor resolution and the clean-break scene identity. This subphase exits when local fixtures deterministically produce valid plans and unresolved exact anchors fail before any provider setup.

#### Phase 1B: ElevenLabs Voice and Clone Reference Path

Use the existing ElevenLabs TTS, native dialogue, timing, catalog, design/remix, cloning, audition, approval, inspection, and deletion ports for the reference workflow. Add the shared protected `voice clone` command with the existing ElevenLabs instant and professional clone ports as its first implementation. This subphase exits when dialogue, voice identity, vocal material, and every provider-dependent `voice` lifecycle step needed by the reference path require no second hosted provider and pass no-call planning plus mocked lifecycle tests.

#### Phase 1C: ElevenLabs SFX Target and Shared Execution

Add `--sfx-provider elevenlabs=<model>` resolution, a dated sound-effect capability fixture and pricing record, static validation, execution readiness, bounded scheduling, request evidence, cancellation, cache materialization, resume, and reuse across dialogue targets. Implement the `POST /v1/sound-generation` serializer and response adapter for vocal reactions, action effects, and ambient sources; record `text`, `model_id`, `duration_seconds`, `prompt_influence`, `loop`, and `output_format`; and validate model-specific bounds locally. This subphase exits when mocked requests and responses prove serializer identity, no-call price behavior, failure classification, cancellation, cache, and resume.

#### Phase 1D: Four-Bus Mixer and Canonical Artifacts

Implement canonical source normalization, exact placement, deterministic looping and overlap fades, the dialogue, vocal-reaction, action-SFX, and ambience buses, local gain and constant-power pan, measured ambience ducking, limiting, semantic stems, final mastering, transform evidence, and canonical artifact publication. This subphase exits when checked-in WAV fixtures prove deterministic stems and masters, pre-roll, collision behavior, ducking tolerances, clipping prevention, and checksum lineage.

#### Phase 1E: End-to-End Offline Acceptance

Exercise dialogue-only scenes, required and optional cue failures, exact and unresolved anchors, no-call price, bounded scheduling, cache, resume, cancellation, multi-dialogue-target SFX reuse, and publication from v5 input through final `AudioRun` using mocked ElevenLabs output. This subphase exits when an authored scene produces a resumable four-bus master with no provider-specific field in source input and no dependency on a later phase.

Phase 1 gate: an authored v5 scene can move from source directives to a resumable final four-bus master with no provider-specific field in the source document and with no implementation dependency on a later phase.

#### Phase 1 Implementation Record

Phase 1 was completed on 2026-08-13. The implementation is an offline-verified vertical slice; no live or quota-limited provider request was used for acceptance.

| Subphase | State | Implemented result |
|---|---|---|
| 1A | Complete | `structured-script.json` v5, strict authored soundscape data, block and inline directive parsing, exact Unicode source spans, stable cue and plan identities, immutable planning, and strict final-timeline anchor resolution |
| 1B | Complete | Shared consent-gated `voice clone` command, no-write price planning, protected instant-clone samples, crash-safe ElevenLabs instant-clone provisioning, and truthful professional-clone verification state |
| 1C | Complete | Explicit `--sfx-provider elevenlabs=eleven_text_to_sound_v2`, dated capability and price fixture, exact serializer, execution readiness, bounded workers and retries, cancellation, durable request admission evidence, ambiguous-admission blocking, shared typed synthesis cache, resume, and optional/required failure policy |
| 1D | Complete | Canonical normalization, strict placement and pre-roll, overlap-faded ambience looping, four semantic buses, authored gain, constant-power pan, dialogue-and-vocal sidechain ducking, loudness normalization, limiting, semantic stems, transform ledger, resolved timeline, and checksummed soundscape `AudioRun` |
| 1E | Complete | Mocked command and workflow coverage for dialogue-only, soundscape-only, and combined scenes; no-call price; cache and resume; bounded work; cancellation; required and optional failures; multi-dialogue-target SFX reuse; canonical manifest publication; and final master lineage |

The accepted `comic-soundscape-v1` profile is fixture-locked at 48 kHz stereo 24-bit PCM WAV, dialogue/vocal/action/ambience bus gains of `0/-1/-3/-14 dB`, `-16 LUFS` integrated loudness, `-1 dBTP`, a limiter ceiling of `0.95`, `9 dB` ambience ducking with a `-32 dB` threshold and `30/350 ms` attack/release, a `50 ms` detector window, `120 ms` ambience-loop crossfade, `8/20 ms` fades, centered default pan, and constant-power panning. Profile data and its hash, rather than hidden FFmpeg defaults, own these values.

ElevenLabs Phase 1 pins `eleven_text_to_sound_v2`, `POST /v1/sound-generation`, serializer `elevenlabs.sound-generation.v1`, a 450-Unicode-scalar prompt limit, optional `0.5–30 second` duration, prompt influence `0–1` with default `0.3`, loop support for the pinned v2 model, and selected MP3/WAV output formats. Static price planning uses the reviewed `$0.12/minute` specified-duration API rate; automatic-duration price remains `unknown`, never zero.

Soundscape masters publish beside preserved dialogue outputs as `audio/final/<dialogue-target-key>.soundscape.wav`. This keeps the dialogue provider projection checksum-valid while making the selected master explicit through `selectedSoundscapeRuns` and `finalOutputRefs`.

### Phase 2: Existing Cartesia, Hume, and MiniMax Capabilities

Phase 2 connects relevant capabilities from the existing Cartesia, Hume, and MiniMax adapters without representing any of them as a dedicated action-SFX or ambience endpoint.

#### Phase 2A: Capability-Scoped Vocal Routing

Extend soundscape planning so an authored vocal reaction may use a provider-qualified dialogue path while action effects and ambience continue to require the ElevenLabs SFX target. Record a deterministic routing decision for every cue, qualify voice-dependent generation identities by provider/model/voice snapshot, and reject unsupported delivery before credentials or dispatch. This subphase exits when routing fixtures prove that no speech provider is silently promoted to a general SFX target and no vocal cue is rewritten into ordinary dialogue.

#### Phase 2B: Hume Integration

Use Hume acting descriptions for eligible vocal reactions, Octave native utterances only when their preview lifecycle is explicitly selected, word and phoneme timing for strict eligible anchors, and continuation state where it preserves scene delivery. Add Voice Conversion for dialogue transformations or authored voice-qualified reactions only when the donor recording is authorized and satisfies the documented speech-input contract; route the result only to a speech bus and retain donor, target-voice, timing, and consent identity. Extend shared discovery, design/materialization, import, audition, approval, inspection, retirement, revocation, and deletion paths; `voice clone` reports the documented subscription-gated external action and supports import of the resulting stable voice ID. This subphase exits when mocked Hume plans prove timing, continuation, vocal routing, voice conversion isolation, protected donor handling, voice lifecycle, and truthful clone behavior.

#### Phase 2C: Cartesia Integration

Reuse Cartesia segmented turn synthesis and approved voice identities, including documented request-scoped speed, volume, and emotion guidance and the model-qualified `[laughter]` nonverbalism for eligible voice-qualified reactions. Treat those controls as speech performance rather than independent foley. Extend shared catalog, instant-clone, import, audition, approval, inspection, retirement, revocation, and exact project-owned deletion workflows. `voice design` and materialization remain unsupported because the adapter has no text-prompt design port. This subphase exits when Cartesia can supply dialogue and eligible vocal reactions to the common mix, its protected clone flow is accessible through `voice clone`, and all unsupported SFX/design paths fail statically.

#### Phase 2D: MiniMax Integration

Reuse MiniMax segmented turn synthesis and approved voice identities, including model-qualified interjection tags for eligible voice-qualified reactions and word-level subtitle timing for strict eligible anchors. Provider voice effects remain speech-generation inputs and do not establish spatial simulation or an independent SFX stem. Extend shared catalog, design/materialization, instant clone, audition, approval, inspection, retirement, revocation, and exact project-owned deletion workflows. Preserve temporary-voice expiry and activation requirements in readiness and artifacts. This subphase exits when MiniMax can supply dialogue and eligible vocal reactions to the common mix, design and clone resources retain their lifecycle evidence, timing maps truthfully, and action-SFX or ambience requests never reach its speech endpoint.

#### Phase 2E: Cross-Provider Acceptance

Render the same v5 fixture with Cartesia, Hume, and MiniMax dialogue targets while reusing compatible ElevenLabs action-SFX and ambience results, isolating voice-qualified vocal reactions and Hume Voice Conversion results, and retaining provider-specific timing and lifecycle evidence. This subphase exits when all three targets pass stable no-call price, routing, cache, resume, protected-donor, failure, and final-mix contracts.

Phase 2 gate: the same v5 soundscape can be mixed with Cartesia, Hume, and MiniMax dialogue targets, each uses only its declared capabilities, Hume timing can authorize strict eligible anchors, and unsupported provider/cue combinations produce stable no-call diagnostics.

#### Phase 2 Implementation Record

Phase 2 was completed on 2026-08-13. The implementation connects existing Cartesia, Hume, and MiniMax capabilities into the soundscape pipeline and shared voice workflows without treating any speech provider as a dedicated action-SFX or ambience target.

| Subphase | State | Implemented result |
|---|---|---|
| 2A | Complete | Capability-scoped vocal routing, deterministic routing decisions for authored vocal reactions vs. dedicated SFX targets, provider-qualified generation identities, and static rejection of unsupported speech-provider SFX requests |
| 2B | Complete | Hume Octave 1 and Octave 2 integration with acting descriptions for vocal reactions, single-request catalog probe reuse across model targets, Voice Conversion routing restricted to speech buses, consent-gated donor handling, and subscription-gated external `voice clone` reporting |
| 2C | Complete | Cartesia Sonic integration for segmented dialogue and voice-qualified reaction controls (`[laughter]`), instant clone workflow, catalog pagination, and static rejection of unsupported text-prompt `voice design` |
| 2D | Complete | MiniMax T2A integration with interjection tags and subtitle-level word timing, catalog discovery, candidate-based voice design with protected temporary-voice lifecycle, and upload-then-clone instant voice creation |
| 2E | Complete | Cross-provider acceptance proving the same v5 soundscape fixture renders with Cartesia, Hume, and MiniMax dialogue targets while reusing ElevenLabs action-SFX and ambience results with stable no-call price, cache, resume, and final mix contracts |

### Phase 3: First-Party Inworld AI Speech and Voice Workflows

Phase 3 integrates first-party Inworld AI as a dialogue and voice-management target, supporting steerable TTS (Realtime TTS-2, 1.5 Max/Mini), instant (3–15s) and professional voice cloning, prompt voice design, natural language steering, and inline emotion/vocalization markups (`[happy]`, `[laugh]`, `[breathe]`).

#### Phase 3A: Registry, Capability, and Pricing Foundation

Add Inworld provider identity, credentials, REST and WebSocket endpoint definitions, Realtime TTS-2 ($25.00/1M chars On-Demand), 1.5 Max, and 1.5 Mini ($15.00/1M chars On-Demand) pricing models, volume tier scaling, capability fixtures, static validation, and execution readiness. This subphase exits when supported dialogue and voice combinations route deterministically, pricing plans calculate correctly without network calls, and unsupported SFX requests fail statically.

#### Phase 3B: TTS, Timing, and Render Artifacts

Implement batch REST (`InworldHttpTTSService`) and low-latency WebSocket (`InworldTTSService`) synthesis adapters. Capture character, word, and viseme timing alignment metadata, decode PCM/WAV output streams, and map alignment through prepared text into the resolved dialogue clock. This subphase exits when mocked renders preserve exact voice identity and timing alignment across price, execution, cache, and resume.

#### Phase 3C: Instant/Pro Voice Cloning and Voice Design

Implement instant voice cloning (`POST /voices/v1/voices:clone`) from 3 to 15 seconds of clean reference audio, professional voice cloning fine-tuned models (30+ minutes), and prompt-driven Voice Design. Integrate candidate materialization and voice lifecycle management into the shared `voice` command. This subphase exits when clone and design candidates are protected, durable, resumable, and identity-safe.

#### Phase 3D: Natural Language Steering and Audio Markups

Implement prompt-level natural language performance steering (e.g., `[whisper in a hushed style]`) and inline audio markups for emotion guidance (`[happy]`, `[sad]`) and non-verbal vocalizations (`[breathe]`, `[cough]`, `[sigh]`, `[laugh]`). Route vocal reaction markups to dialogue and vocal buses while preserving character voice identity. This subphase exits when steering and markup directives route deterministically without modifying non-speech SFX targets.

#### Phase 3E: Soundscape Routing and Acceptance

Render full v5 soundscape fixtures with Inworld dialogue targets while reusing ElevenLabs action-SFX and ambient beds. Validate multi-bus mixing, viseme timing alignment for lip-sync, and stem output publication. This subphase exits when Inworld dialogue targets pass offline acceptance tests across price, cache, resume, and four-bus mastering.

Phase 3 gate: Inworld AI renders steerable dialogue, instant/pro clones, voice design, and inline vocal markups through common plans and artifacts; viseme timing supports lip-sync alignment, and non-speech SFX requests fail before dispatch.

### Phase 4: DeepInfra Hosted Speech Suite (Chatterbox, MiMo V2.5, Qwen3-TTS)

Phase 4 integrates DeepInfra's hosted open-weight speech models: ResembleAI Chatterbox (`chatterbox-multilingual` & `chatterbox-turbo` @ $1.00/1M chars), Xiaomi MiMo V2.5 (`MiMo-V2.5-tts` & `MiMo-V2.5-tts-voicedesign` @ $0.00/1M promotional), and Alibaba Qwen3-TTS (`Qwen3-TTS` & `Qwen3-TTS-VoiceDesign` @ $20.00/1M chars).

#### Phase 4A: Registry, Capability, and Pricing Foundation

Add DeepInfra speech suite provider identity, bearer token authorization, hosted model catalog schemas, dated capability fixtures, static pricing records ($1.00/1M for Chatterbox, $0.00/1M promotional for MiMo V2.5, $20.00/1M for Qwen3-TTS), static validation, and execution readiness. This subphase exits when model targets resolve deterministically and no-call price calculations match verified rates.

#### Phase 4B: Chatterbox Multilingual & Turbo Adapters

Implement DeepInfra adapters for `ResembleAI/chatterbox-multilingual` and `ResembleAI/chatterbox-turbo`. Support multi-speaker dialogue synthesis and low-cost character voices without requiring direct Resemble SaaS accounts or subscription fees. This subphase exits when mocked Chatterbox renders pass serializer identity, price, cache, and resume tests.

#### Phase 4C: MiMo V2.5 TTS & Voice Design Adapters

Implement DeepInfra adapters for `XiaomiMiMo/MiMo-V2.5-tts` and `XiaomiMiMo/MiMo-V2.5-tts-voicedesign`. Support zero-cost promotional test coverage, rapid prototyping, prompt-driven voice design, and speech generation. This subphase exits when MiMo voice design candidates materialize into protected references and pass offline render tests.

#### Phase 4D: Qwen3-TTS & VoiceDesign Zero-Shot Adapters

Implement DeepInfra adapters for `Qwen/Qwen3-TTS` and `Qwen/Qwen3-TTS-VoiceDesign`. Support high-quality zero-shot reference voice cloning from reference audio clips and prompt-based voice design across multiple languages. This subphase exits when Qwen3 zero-shot reference cloning and voice design pass offline acceptance.

#### Phase 4E: Soundscape Routing and Acceptance

Render v5 soundscape fixtures using DeepInfra Chatterbox, MiMo V2.5, and Qwen3-TTS dialogue targets with ElevenLabs action SFX and ambience. Validate stem separation, cache reuse, and four-bus mixing. This subphase exits when all DeepInfra speech targets pass no-call price, cache, resume, and final mix contracts.

Phase 4 gate: DeepInfra hosted Chatterbox, MiMo V2.5, and Qwen3-TTS models render multi-speaker dialogue, voice design, and zero-shot cloning through common plans and artifacts with verified pricing and offline resume.

### Phase 5: Replicate Open-Source Speech Suite (F5-TTS, Dia 1.6B, XTTS-v2)

Phase 5 integrates high-capability open-source speech and multi-speaker dialogue models deployed on Replicate: `x-lance/f5-tts` (non-autoregressive zero-shot cloning), `zsxkib/dia` (Dia 1.6B multi-speaker dialogue with non-verbals and cloning), and `lucataco/xtts-v2` (Coqui XTTS-v2 multilingual zero-shot cloning).

#### Phase 5A: Registry, Capability, and Prediction Foundation

Add Replicate speech suite provider identity, API prediction lifecycle schemas (`POST /v1/predictions`), model version pinning, capability fixtures, static pricing, static validation, and execution readiness. Declare zero-shot cloning for F5-TTS and XTTS-v2 and multi-speaker script dialogue for Dia 1.6B. This subphase exits when Replicate speech targets validate deterministically and no-call price planning calculates prediction unit costs correctly.

#### Phase 5B: F5-TTS Zero-Shot Cloning Adapter

Implement the Replicate adapter for `x-lance/f5-tts`. Support fast, natural non-autoregressive zero-shot voice cloning from short reference audio clips without third-party voice registry requirements. This subphase exits when F5-TTS zero-shot cloning passes prediction execution, cache, and resume contracts.

#### Phase 5C: Dia 1.6B Multi-Speaker Dialogue Adapter

Implement the Replicate adapter for `zsxkib/dia` (Nari Labs Dia 1.6B). Support multi-character script dialogue synthesis directly from transcripts, incorporating non-verbal vocal cues (laughter, throat clearing) and voice cloning within conversational turns. This subphase exits when Dia multi-speaker script dialogue renders into isolated speech and vocal-reaction stems.

#### Phase 5D: XTTS-v2 Multilingual Cloning Adapter

Implement the Replicate adapter for `lucataco/xtts-v2` (Coqui XTTS-v2). Support multilingual zero-shot voice cloning across 17+ languages. This subphase exits when XTTS-v2 multilingual voice cloning passes offline prediction and audio artifact capture.

#### Phase 5E: Soundscape Routing and Acceptance

Download output audio immediately into checksummed local artifacts before Replicate's 1-hour remote prediction file expiry window. Render v5 soundscape fixtures combining F5-TTS, Dia 1.6B, and XTTS-v2 dialogue targets with ElevenLabs action SFX and ambient beds. This subphase exits when all Replicate open-source speech targets pass prediction polling, artifact capture, expiry safety, cache, and four-bus mastering contracts.

Phase 5 gate: Replicate-hosted F5-TTS, Dia 1.6B, and XTTS-v2 open-source models render zero-shot voice clones and multi-speaker dialogue through common plans and artifacts with expiry-safe local artifact capture.

### Phase 6: Fish Audio Across Synthesis and Voice Workflows

Phase 6 adds Fish as a first-class TTS and voice-management provider using its documented TTS and voice-model APIs.

#### Phase 6A: Registry, Capability, and Pricing Foundation

Add Fish provider identity, credentials, base URL, S1, S2 Pro, and `voice-design-1` model entries, lifecycle state, dated capability fixtures, pricing provenance, selector resolution, static validation, and readiness. Declare single-speaker TTS, S2 Pro native dialogue, reference clips, stable model IDs, timing, catalog, stateless voice design, fast clone, inspection, reconciliation, and deletion independently. This subphase exits when supported combinations route deterministically, unsupported SFX combinations fail without credentials, and no-call price remains read-only.

#### Phase 6B: Single-Speaker TTS and Reference Identity

Implement bounded single-speaker synthesis with approved `reference_id` resources or authorized zero-shot reference clips, documented prosody and output controls, response decoding, cache identity, request evidence, cancellation, retry classification, resume, and common dialogue artifacts. This subphase exits when mocked renders preserve exact voice identity and protected reference handling across price, execution, cache, and resume.

#### Phase 6C: Native Dialogue and Timestamp Streaming

Implement S2 Pro native multi-speaker planning and serialization, deterministic fallback to segmented turns, and timestamped SSE reduction that replaces the latest alignment snapshot by `chunk_seq` rather than accumulating superseded snapshots. Map retained alignment through prepared text and local transforms to the final timeline. This subphase exits when native/segmented selection, streaming reduction, exact anchor evidence, interruption, and malformed-event behavior pass mocked contracts.

#### Phase 6D: Voice Design, Model Management, and Reconciliation

Implement bounded `voice design` requests against the stateless `voice-design-1` endpoint, ingest every returned base64 candidate into the protected store, and retain prompt, reference text, model, seed, candidate index, sample rate, duration, and response identity. Implement `voice materialize` as a composed AutoShow workflow: validate exactly one protected selected candidate against the current create-model sample contract, then use that candidate as authorized reference audio for the ordinary fast model-creation path. Fish exposes no separate candidate-materialization operation, and a candidate identifier is not a durable remote voice resource; an ineligible candidate must fail locally instead of being padded, regenerated, or silently replaced. Also implement import, account/public model discovery, consent-gated fast voice creation through `voice clone`, canonical audition and approval, exact model inspection and training readiness, ambiguous creation reconciliation, local status/retirement/revocation, and exact project-owned deletion. Use model update only for shared mutable metadata and never for stable identity. Keep `voice save-reference` explicitly unsupported. This subphase exits when design candidates and every applicable `voice` row are durable, protected, resumable, and identity-safe.

#### Phase 6E: Soundscape Routing and Acceptance

Route documented in-speech emotion and delivery controls only to dialogue or eligible voice-qualified vocal reactions. Do not register Fish as an `--sfx-provider`; action-SFX and ambience remain dedicated-target work. This subphase exits when Fish single- and multi-speaker fixtures produce final mixes through the common plans and artifacts, timestamp evidence supports eligible strict anchors, and every unsupported voice or SFX operation fails before dispatch.

Phase 6 gate: Fish can design and materialize protected voice candidates, manage authorized voice models, and render single- or multi-speaker dialogue through the common plans and artifacts; timestamp evidence survives into strict cue resolution, and every unsupported voice or SFX operation fails before dispatch.

The `voice` command coverage required by Phase 6 is explicit:

| `voice` workflow | Fish Phase 6 |
|---|---|
| `consent`, `revoke-consent` | Reuse provider-neutral protected consent records |
| `import` | Register an existing stable model ID |
| `discover` | List public or account models with pagination and model state |
| `design` | Generate bounded stateless `voice-design-1` candidates and ingest their base64 audio into protected storage |
| `materialize` | Materialize exactly one protected selected candidate through the fast voice-model creation path |
| `clone` | Create an authorized fast TTS voice model from protected samples |
| `audition`, `approve` | Reuse canonical protected auditions and atomic local approval |
| `inspect` | Inspect exact model identity and training state |
| `reconcile` | Reconcile ambiguous or pending model creation without blind recreation |
| `retire`, `revoke`, `status` | Reuse provider-neutral append-preserved lifecycle state |
| `delete` | Delete only an exact eligibility-checked project-owned model |
| `save-reference` | Unsupported; remains Mistral-specific |

### Phase 7: Meta AudioGen Through Replicate

Phase 7 adds a second dedicated SFX target using Meta AudioCraft AudioGen through Replicate. The available target is the public community model `sepal/audiogen`, not an official Meta-owned or Replicate-maintained model. The initial fixture pins `sepal/audiogen:154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8`; changing owner, model, version, schema, hardware, or license requires a reviewed fixture update and cannot happen through silent alias resolution. Meta's AudioGen model card and Replicate's linked weight license identify the model weights as CC BY-NC 4.0, so this target is restricted to license-compatible noncommercial use unless separately documented rights supersede that fixture.

#### Phase 7A: Community-Model Governance and Pinning

Record the exact owner, model, version, input schema, output schema, hardware observation, upstream source, license provenance, permitted-use classification, and community lifecycle classification. Reject aliases and unreviewed version changes, preserve historical fixture readers, and define removal/unavailability behavior. Treat unknown or commercial intended use as statically ineligible for the initial CC BY-NC 4.0 fixture; a different license requires reviewed documentary evidence and a new fixture identity. This subphase exits when a model or license change alters fixture identity, prohibited use fails before credentials, and a retired fixture remains sufficient to read prior manifests without enabling new dispatch.

#### Phase 7B: Replicate SFX Target and Static Pricing

Add Replicate SFX provider identity, token readiness, version-qualified pricing, capability fixture, and the explicit `--sfx-provider replicate=sepal/audiogen@<version>` selector. Keep the target opt-in and excluded from default or implicit `all` selection. Require immutable license-use evidence in the render plan before readiness, and never infer noncommercial eligibility from model selection alone. Serialize prompt, one-to-ten-second duration, sampling controls, classifier-free guidance, and WAV or MP3 output with every default explicit and identity-bearing. This subphase exits when static validation and no-call price tests distinguish supported inputs, prohibited or unknown use, unknown price, invalid duration, and version mismatch without credentials or writes.

#### Phase 7C: Prediction Execution Lifecycle

Implement bounded prediction creation, polling, terminal-state reduction, cancellation, timeout and retry classification, sanitized logs and errors, and observed prediction, version, and compute metadata. Never silently create a second prediction after ambiguous admission. This subphase exits when mocked starting, processing, succeeded, failed, canceled, timed-out, and ambiguous-admission paths remain bounded and resumable.

#### Phase 7D: Expiry-Safe Artifact Capture and Soundscape Routing

Download successful output immediately into a checksummed canonical artifact because remote API prediction data and files expire. Route AudioGen only to action-SFX and ambient source tasks; give it no voice identity, voice-management, speech-to-speech, or dialogue role; and retain local deterministic ambience looping beyond the model's maximum generation duration. Keep ElevenLabs selectable and prohibit fallback substitution when the chosen target is unavailable. This subphase exits when expiry, download interruption, checksum, cache, resume, bus routing, and cross-provider identity tests pass offline.

#### Phase 7E: End-to-End and Historical Acceptance

Run the pinned community model through mocked license eligibility, price, prediction, output capture, cache, resume, mixing, cancellation, and failure contracts, then prove that marking the model unavailable blocks new dispatch without making existing plans, results, manifests, or mixes unreadable. This subphase exits when Replicate AudioGen operates as a second explicit, use-restricted SFX target without weakening historical or provider-selection guarantees.

Phase 7 gate: the pinned community deployment passes mocked license-eligibility, prediction, polling, cancellation, expiry, price, cache, resume, and mixer contracts and can be removed or marked unavailable without making historical manifests unreadable.

### Phase 8: Multi-Model Episode 2 Scene 1 Render Matrix and ADR-019 Panel Video Generation

Phase 8 establishes the production execution plan for Episode 2 Scene 1 (`01-mandatory-meeting`), building upon the initial Fish 1.5 baseline audio run and workspace initializations for Cartesia, Hume, and MiniMax present in `c/uss-acampo/output/ep02/`. The goal is to generate complete multi-speaker dialogue and soundscape masters for all newly integrated models and render corresponding ADR-019 panel videos (`panel-vid`) across structured parallel execution waves.

#### Phase 8A: Episode 2 Scene 1 Authored Script and Workspace Audit

Verify the canonical v5 `structured-script.json` for Episode 2 Scene 1 (`01-mandatory-meeting`), featuring multi-character dialogue turns, non-verbal vocal reactions, action SFX directives, and ambient beds. Confirm the existing completed Fish 1.5 run (`output/ep02/01-mandatory-meeting/audio/speech-fish-1.5.wav`) and audit initialized workspaces (`01-mandatory-meeting-cartesia`, `01-mandatory-meeting-hume`, `01-mandatory-meeting-minimax`). Validate that `SoundscapePlan` and `ComicDialoguePlan` generate deterministically across all targeted providers without embedding provider-specific parameters in the source script. Completed on 2026-08-14; v5 script structure generated deterministically and static planning validated across all model targets.

#### Phase 8B: Sub-Wave Multi-Model Soundscape Audio Generation Matrix

Execute parallel soundscape audio generation runs for Episode 2 Scene 1 across granular sub-waves with default concurrency set to 7 (`--provider-concurrency 7` / default `DEFAULT_CLI_CONCURRENCY = 7`), ensuring that each sub-wave dispatches exactly one model from each target provider concurrently to maximize throughput without API key collisions or single-provider rate-limit contention:

- **Wave 1: Open-Weight & Multi-Provider Suite**
  - **Sub-Wave 1.1**: Concurrent run of Replicate `x-lance/f5-tts`, Fal `fal-ai/speech`, and DeepInfra `ResembleAI/chatterbox-multilingual`.
  - **Sub-Wave 1.2**: Concurrent run of Replicate `zsxkib/dia`, Fal `fal-ai/speech/clone`, and DeepInfra `XiaomiMiMo/MiMo-V2.5-tts`.
  - **Sub-Wave 1.3**: Concurrent run of Replicate `lucataco/xtts-v2`, Fal `fal-ai/speech/design`, and DeepInfra `Qwen/Qwen3-TTS`.
- **Wave 2: Steerable Enterprise & Fine-Grained API Suite**
  - **Sub-Wave 2.1**: Concurrent run of Inworld AI `realtime-tts-2`, Fish Audio `s2-pro`, and ElevenLabs `eleven_v3`.
  - **Sub-Wave 2.2**: Concurrent run of Inworld AI `realtime-tts-1.5-max`, Fish Audio `fish-speech-1.5`, and Hume `octave-2`.
  - **Sub-Wave 2.3**: Concurrent run of Inworld AI `realtime-tts-1.5-mini`, Fish Audio `s1`, and Hume `octave-1`.
- **Wave 3: Fast Prototyping & Voice Design Suite**
  - **Sub-Wave 3.1**: Concurrent run of MiniMax `speech-2.8-hd`, Cartesia `sonic-3.5-2026-05-04`, and DeepInfra `ResembleAI/chatterbox-turbo`.
  - **Sub-Wave 3.2**: Concurrent run of MiniMax `speech-2.8-turbo`, Cartesia `sonic-3.0`, and DeepInfra `XiaomiMiMo/MiMo-V2.5-tts-voicedesign`.
  - **Sub-Wave 3.3**: Concurrent run of MiniMax `speech-2.8`, Cartesia `sonic-2.5`, and DeepInfra `Qwen/Qwen3-TTS-VoiceDesign`.

Each run combines the target model's dialogue bus with action SFX and ambient beds, outputting checksummed stem WAVs and mastered soundscape WAVs. This subphase exits when all model targets across Sub-Waves 1.1 through 3.3 pass synthesis, cache materialization, and four-bus mix assembly.

#### Phase 8C: ADR-019 Panel Video Sub-Wave Generation (panel-vid)

Execute the ADR-019 panel video rendering pipeline (`comic generate-panel-video` / `panel-vid`) across matching parallel sub-waves for every completed soundscape audio run:

- **Sub-Wave 4.1**: Parallel `panel-vid` generation matching Wave 1 audio runs (Sub-Waves 1.1, 1.2, 1.3).
- **Sub-Wave 4.2**: Parallel `panel-vid` generation matching Wave 2 audio runs (Sub-Waves 2.1, 2.2, 2.3).
- **Sub-Wave 4.3**: Parallel `panel-vid` generation matching Wave 3 audio runs (Sub-Waves 3.1, 3.2, 3.3).

Align visual comic panels with the derived timing of each provider's soundscape run, rendering synchronized video tracks with audio waveform integration and panel transitions. This subphase exits when every Episode 2 Scene 1 audio run produces a valid, playable, manifest-backed panel video artifact.

#### Phase 8D: Cross-Model Media Verification and Manifest Audit

Audit the complete Episode 2 Scene 1 artifact graph, verifying that `manifest.json`, `selectedSoundscapeRuns`, `finalOutputRefs`, panel video manifests, and transform ledgers maintain total checksum lineage across all model targets. This subphase exits when the entire render matrix passes offline verification with zero unhandled errors or missing references.

Phase 8 gate: Episode 2 Scene 1 generates complete soundscape audio runs across all integrated speech models across structured parallel waves and every run has a corresponding manifest-backed ADR-019 panel video.

### Phase Gates

| Phase | Ordered subphases | Hosted scope added | Required gate before the next phase |
|---|---|---|---|
| 1 | 1A intent/planning → 1B ElevenLabs voice/clone → 1C ElevenLabs SFX/execution → 1D mixer/artifacts → 1E acceptance | ElevenLabs SFX plus the complete provider-neutral planner, executor, mixer, and artifact vertical slice | All common soundscape contracts pass offline; a v5 scene produces a resumable final master from mocked ElevenLabs outputs |
| 2 | 2A vocal routing → 2B Hume → 2C Cartesia → 2D MiniMax → 2E acceptance | Cartesia, Hume, and MiniMax capabilities already exposed by their current TTS and voice adapters | Capability routing is deterministic; no provider is mislabeled as a general SFX target; shared voice clone behavior is protected and truthful |
| 3 | 3A foundation → 3B TTS/timing → 3C cloning/design → 3D markups → 3E acceptance | First-party Inworld AI steerable TTS, instant/pro cloning, voice design, natural language steering, and audio markups | Steerable dialogue, voice cloning, and audio markups pass offline acceptance; viseme alignment supports lip-syncing |
| 4 | 4A foundation → 4B Chatterbox → 4C MiMo V2.5 → 4D Qwen3-TTS → 4E acceptance | DeepInfra hosted speech suite (Chatterbox, MiMo V2.5, Qwen3-TTS) across dialogue, voice design, and zero-shot cloning | Multi-speaker dialogue, promotional voice design, and zero-shot cloning pass offline acceptance with verified pricing |
| 5 | 5A foundation → 5B F5-TTS → 5C Dia 1.6B → 5D XTTS-v2 → 5E acceptance | Replicate open-source speech suite (F5-TTS, Dia 1.6B, XTTS-v2) for zero-shot cloning and script dialogue | Zero-shot cloning and multi-speaker script dialogue pass prediction execution and expiry-safe local artifact capture |
| 6 | 6A registry/capabilities → 6B single-speaker TTS → 6C dialogue/timestamps → 6D voice design/models → 6E acceptance | Fish TTS, multi-speaker and timestamp behavior, stateless voice design, voice-model clone/catalog/lifecycle, and applicable `voice` workflows | Design, timestamp, and model lifecycle artifacts are verified; unsupported SFX paths fail statically |
| 7 | 7A governance/pinning → 7B target/pricing → 7C predictions → 7D artifacts/routing → 7E acceptance | Version-pinned, noncommercial-use-restricted Replicate community AudioGen SFX target | License eligibility, prediction expiry, provenance, exact model version, cost, cancellation, cache, resume, and historical readability are proven offline |
| 8 | 8A script/planning → 8B audio matrix → 8C panel-vid → 8D verification | Episode 2 Scene 1 render matrix across Hume, Cartesia, MiniMax, Inworld, DeepInfra, Replicate, and Fish speech targets plus ADR-019 panel videos | Episode 2 Scene 1 produces complete soundscape audio runs and corresponding panel video artifacts for every supported model |

### Implementation Documentation Index

These are the primary implementation references reviewed on 2026-08-13 and updated 2026-08-14. Provider documentation, models, access conditions, and prices can change; each capability or pricing fixture must retain the exact source URL, retrieval date, applicable provider/model/transport scope, and evidence hash rather than treating this index as a timeless capability claim. Documentation lookup does not authorize a paid or quota-limited provider request.

Use the maintained provider indexes when a deep link moves: [ElevenLabs developer documentation](https://elevenlabs.io/docs/overview/intro), [Hume documentation index](https://dev.hume.ai/llms.txt), [Cartesia documentation index](https://docs.cartesia.ai/llms.txt), [MiniMax documentation index](https://platform.minimax.io/docs/llms.txt), [Inworld documentation index](https://docs.inworld.ai/), [DeepInfra documentation index](https://docs.deepinfra.com/), [Fish documentation index](https://docs.fish.audio/llms.txt), and [Replicate documentation index](https://replicate.com/docs/llms.txt).

| Subphase | Primary implementation references |
|---|---|
| [1A](#phase-1a-authored-intent-and-immutable-planning) | Local authorities: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), and [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md). External specifications: [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12) and [Unicode Core Specification, Chapter 3](https://www.unicode.org/versions/latest/core-spec/chapter-3/). |
| [1B](#phase-1b-elevenlabs-voice-and-clone-reference-path) | [TTS with timestamps](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps), [Text-to-Dialogue with timestamps](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps), [list voices](https://elevenlabs.io/docs/api-reference/voices/search), [get voice](https://elevenlabs.io/docs/api-reference/voices/get), [Voice Design](https://elevenlabs.io/docs/api-reference/text-to-voice/design), [voice remixing](https://elevenlabs.io/docs/eleven-api/guides/how-to/voices/remix-a-voice), [create designed voice](https://elevenlabs.io/docs/api-reference/text-to-voice/create), [Instant Voice Clone](https://elevenlabs.io/docs/api-reference/voices/ivc/create), [Professional Voice Clone workflow](https://elevenlabs.io/docs/eleven-api/guides/how-to/voices/professional-voice-cloning), and [delete voice](https://elevenlabs.io/docs/api-reference/voices/delete). |
| [1C](#phase-1c-elevenlabs-sfx-target-and-shared-execution) | [Sound Effects API](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert), [Sound Effects overview and prompting](https://elevenlabs.io/docs/overview/capabilities/sound-effects), [API authentication](https://elevenlabs.io/docs/api-reference/authentication), [API errors and concurrency](https://elevenlabs.io/docs/eleven-api/resources/errors), [Sound Effects credit calculation](https://elevenlabs.io/docs/help-center/product/content-production/sound-effects/how-much-does-it-cost-to-generate-sound-effects), and [API pricing](https://elevenlabs.io/pricing/api?price.platform=api). |
| [1D](#phase-1d-four-bus-mixer-and-canonical-artifacts) | [FFmpeg audio filters](https://ffmpeg.org/ffmpeg-filters.html), especially [audio mixing](https://ffmpeg.org/ffmpeg-filters.html#amix), [panning](https://ffmpeg.org/ffmpeg-filters.html#pan), [sidechain compression](https://ffmpeg.org/ffmpeg-filters.html#sidechaincompress), [EBU R128 loudness normalization](https://ffmpeg.org/ffmpeg-filters.html#loudnorm), and [limiting](https://ffmpeg.org/ffmpeg-filters.html#alimiter). |
| [1E](#phase-1e-end-to-end-offline-acceptance) | [Bun test runner](https://bun.sh/docs/test), [Bun mocks](https://bun.sh/docs/test/mocks), and this ADR's [Test Plan](#test-plan). |
| [2A](#phase-2a-capability-scoped-vocal-routing) | [ADR-010 capability and lifecycle policy](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-014 voice and rendering contracts](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md), and the provider references in 2B–2D. |
| [2B](#phase-2b-hume-integration) | [Octave TTS overview](https://dev.hume.ai/docs/text-to-speech-tts/overview), [acting instructions](https://dev.hume.ai/docs/text-to-speech-tts/acting-instructions), [timestamps](https://dev.hume.ai/docs/text-to-speech-tts/timestamps), [continuation](https://dev.hume.ai/docs/text-to-speech-tts/continuation), [Voice Conversion](https://dev.hume.ai/docs/text-to-speech-tts/voice-conversion), [Voice Conversion JSON API](https://dev.hume.ai/reference/text-to-speech-tts/convert-voice-json), [Voice Design](https://dev.hume.ai/docs/voice/voice-design), [voice cloning access](https://dev.hume.ai/docs/voice/voice-cloning), [voice management](https://dev.hume.ai/docs/voice/management), and [billing](https://dev.hume.ai/docs/resources/billing). |
| [2C](#phase-2c-cartesia-integration) | [current API changes](https://docs.cartesia.ai/build-with-cartesia/tts-models/api-changes), [Sonic model and snapshots](https://docs.cartesia.ai/build-with-cartesia/tts-models/latest), [TTS bytes API](https://docs.cartesia.ai/api-reference/tts/bytes), [speed, volume, emotion, and nonverbalisms](https://docs.cartesia.ai/build-with-cartesia/capability-guides/volume-speed-emotion), [list voices](https://docs.cartesia.ai/api-reference/voices/list), [clone voice](https://docs.cartesia.ai/api-reference/voices/clone), [get voice](https://docs.cartesia.ai/api-reference/voices/get), [delete voice](https://docs.cartesia.ai/api-reference/voices/delete), and [concurrency limits](https://docs.cartesia.ai/use-the-api/concurrency-limits-and-timeouts). |
| [2D](#phase-2d-minimax-integration) | [API overview](https://platform.minimax.io/docs/api-reference/api-overview), [T2A HTTP API, interjections, and subtitles](https://platform.minimax.io/docs/api-reference/speech-t2a-http), [Voice Design](https://platform.minimax.io/docs/api-reference/voice-design-design), [Voice Clone workflow](https://platform.minimax.io/docs/guides/speech-voice-clone), [clone API](https://platform.minimax.io/docs/api-reference/voice-cloning-clone), [get voices](https://platform.minimax.io/docs/api-reference/voice-management-get), [delete voice](https://platform.minimax.io/docs/api-reference/voice-management-delete), and [pay-as-you-go pricing](https://platform.minimax.io/docs/guides/pricing-paygo). |
| [2E](#phase-2e-cross-provider-acceptance) | Provider references in 2B–2D, [Bun mocks](https://bun.sh/docs/test/mocks), and this ADR's [Test Plan](#test-plan). |
| [3A](#phase-3a-registry-capability-and-pricing-foundation) | [Inworld AI documentation](https://docs.inworld.ai/), [Inworld AI pricing](https://inworld.ai/pricing), and [Inworld AI Voice Cloning API guide](https://docs.inworld.ai/docs/tutorial-basics/voice-cloning/). |
| [3B](#phase-3b-tts-timing-and-render-artifacts) | [Inworld AI TTS overview](https://docs.inworld.ai/) and [REST/WebSocket interface reference](https://docs.inworld.ai/). |
| [3C](#phase-3c-instantpro-voice-cloning-and-voice-design) | [Inworld Voice Cloning guide](https://docs.inworld.ai/docs/tutorial-basics/voice-cloning/) and [voice creation API](https://docs.inworld.ai/). |
| [3D](#phase-3d-natural-language-steering-and-audio-markups) | [Inworld audio markups and natural language steering reference](https://docs.inworld.ai/). |
| [3E](#phase-3e-soundscape-routing-and-acceptance) | Inworld references in 3A–3D and this ADR's [Test Plan](#test-plan). |
| [4A](#phase-4a-registry-capability-and-pricing-foundation) | [DeepInfra TTS API reference](https://docs.deepinfra.com/apis/text-to-speech) and [DeepInfra models catalog](https://deepinfra.com/models/text-to-speech). |
| [4B](#phase-4b-chatterbox-multilingual--turbo-adapters) | [DeepInfra Chatterbox Multilingual model](https://deepinfra.com/ResembleAI/chatterbox-multilingual) and [DeepInfra Chatterbox Turbo model](https://deepinfra.com/ResembleAI/chatterbox-turbo). |
| [4C](#phase-4c-mimo-v25-tts--voice-design-adapters) | [DeepInfra Xiaomi MiMo-V2.5-tts model](https://deepinfra.com/XiaomiMiMo/MiMo-V2.5-tts) and [DeepInfra Xiaomi MiMo-V2.5-tts-voicedesign model](https://deepinfra.com/XiaomiMiMo/MiMo-V2.5-tts-voicedesign). |
| [4D](#phase-4d-qwen3-tts--voicedesign-zero-shot-adapters) | [DeepInfra Qwen3-TTS model](https://deepinfra.com/Qwen/Qwen3-TTS) and [DeepInfra Qwen3-TTS VoiceDesign model](https://deepinfra.com/Qwen/Qwen3-TTS-VoiceDesign). |
| [4E](#phase-4e-soundscape-routing-and-acceptance) | DeepInfra references in 4A–4D and this ADR's [Test Plan](#test-plan). |
| [5A](#phase-5a-registry-capability-and-prediction-foundation) | [Replicate Speech Generation Collection](https://replicate.com/collections/speech-generation) and [Replicate HTTP prediction API](https://replicate.com/docs/reference/http#create-a-prediction). |
| [5B](#phase-5b-f5-tts-zero-shot-cloning-adapter) | [Replicate F5-TTS model](https://replicate.com/x-lance/f5-tts). |
| [5C](#phase-5c-dia-16b-multi-speaker-dialogue-adapter) | [Replicate Dia dialogue model](https://replicate.com/zsxkib/dia). |
| [5D](#phase-5d-xtts-v2-multilingual-cloning-adapter) | [Replicate XTTS-v2 model](https://replicate.com/lucataco/xtts-v2). |
| [5E](#phase-5e-soundscape-routing-and-acceptance) | Replicate references in 5A–5D and this ADR's [Test Plan](#test-plan). |
| [6A](#phase-6a-registry-capability-and-pricing-foundation) | [Fish API introduction](https://docs.fish.audio/api-reference/introduction), [canonical OpenAPI schema](https://api.fish.audio/openapi.json), [models overview](https://docs.fish.audio/developer-guide/models-pricing/models-overview), [pricing and rate limits](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits), and [model deprecations](https://docs.fish.audio/developer-guide/models-pricing/deprecations). |
| [6B](#phase-6b-single-speaker-tts-and-reference-identity) | [Fish TTS API](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech), [text-to-speech guide](https://docs.fish.audio/developer-guide/core-features/text-to-speech), and [voice-cloning best practices](https://docs.fish.audio/developer-guide/best-practices/voice-cloning). |
| [6C](#phase-6c-native-dialogue-and-timestamp-streaming) | [Fish TTS API and S2 Pro dialogue schema](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech), [timestamped streaming API](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech-stream-with-timestamps), and [real-time streaming guide](https://docs.fish.audio/developer-guide/best-practices/real-time-streaming). |
| [6D](#phase-6d-voice-design-model-management-and-reconciliation) | [Voice Design API](https://docs.fish.audio/api-reference/endpoint/openapi-v1/voice-design), [Voice Design guide](https://docs.fish.audio/features/voice-design), [create model](https://docs.fish.audio/api-reference/endpoint/model/create-model), [list models](https://docs.fish.audio/api-reference/endpoint/model/list-models), [get model](https://docs.fish.audio/api-reference/endpoint/model/get-model), [update model](https://docs.fish.audio/api-reference/endpoint/model/update-model), and [delete model](https://docs.fish.audio/api-reference/endpoint/model/delete-model). |
| [6E](#phase-6e-soundscape-routing-and-acceptance) | [Fish emotion control](https://docs.fish.audio/developer-guide/core-features/emotions), [fine-grained speech control](https://docs.fish.audio/developer-guide/core-features/fine-grained-control), the TTS and timing references in 6B–6C, and this ADR's [Test Plan](#test-plan). |
| [7A](#phase-7a-community-model-governance-and-pinning) | [Replicate community-model policy](https://replicate.com/docs/topics/models/community-models), [model versions](https://replicate.com/docs/topics/models/versions), [AudioCraft AudioGen documentation](https://github.com/facebookresearch/audiocraft/blob/main/docs/AUDIOGEN.md), [AudioGen model card](https://github.com/facebookresearch/audiocraft/blob/main/model_cards/AUDIOGEN_MODEL_CARD.md), and the [CC BY-NC 4.0 weight license](https://github.com/facebookresearch/audiocraft/blob/main/LICENSE_weights). |
| [7B](#phase-7b-replicate-sfx-target-and-static-pricing) | [exact pinned AudioGen API schema](https://replicate.com/sepal/audiogen/versions/154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8/api), [Replicate pricing](https://replicate.com/pricing), [community-model pricing semantics](https://replicate.com/docs/topics/models/community-models), and [HTTP prediction API](https://replicate.com/docs/reference/http#create-a-prediction). |
| [7C](#phase-7c-prediction-execution-lifecycle) | [create and poll a prediction](https://replicate.com/docs/topics/predictions/create-a-prediction), [prediction lifecycle and terminal states](https://replicate.com/docs/topics/predictions/lifecycle), [HTTP get and cancel operations](https://replicate.com/docs/reference/http), [webhooks](https://replicate.com/docs/topics/webhooks), and [prediction rate limits](https://replicate.com/docs/topics/predictions/rate-limits). |
| [7D](#phase-7d-expiry-safe-artifact-capture-and-soundscape-routing) | [Replicate output files](https://replicate.com/docs/topics/predictions/output-files), [prediction data retention](https://replicate.com/docs/topics/predictions/data-retention), the [exact pinned AudioGen output schema](https://replicate.com/sepal/audiogen/versions/154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8/api), and the local mastering references in 1D. |
| [7E](#phase-7e-end-to-end-and-historical-acceptance) | [Replicate model versions](https://replicate.com/docs/topics/models/versions), [community-model lifecycle policy](https://replicate.com/docs/topics/models/community-models), [Bun test runner](https://bun.sh/docs/test), [Bun mocks](https://bun.sh/docs/test/mocks), and this ADR's [Test Plan](#test-plan). |

## Rationale

- Source-level sound intent remains stable when provider catalogs, API limits, and pricing change.
- Timeline anchors preserve synchronization across voices, providers, pacing, repairs, and local transforms.
- Offline-first fixture coverage validates the highest-risk mixing and identity logic without provider cost.
- Separate generation and mix identities maximize safe reuse and prevent gain or placement edits from buying the same sound again.
- Existing ADR-002, ADR-008, ADR-010, and ADR-014 contracts remain the authorities for manifests, scheduling, model capabilities, price planning, and audio render evidence.
- A complete ElevenLabs vertical slice proves the provider boundary before capability-scoped TTS expansion, new voice-provider integrations, and the community-hosted AudioGen dependency are introduced.

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

| Gains | Sacrifices |
|---|---|
| Portable authored intent and provider-qualified execution | More planning types and validation stages |
| Exact, auditable placement | Strict failures when canonical timing evidence is unavailable |
| Provider-output reuse across many mixes | Additional retained artifacts and checksums |
| Offline mixer verification | Hosted quality still requires a separately approved calibration run |
| Ordered, evidence-gated provider expansion | Seven gated phases before the complete provider set is delivered |
| Fish coverage across applicable `voice` workflows | Broader provider lifecycle and reconciliation surface |
| A second dedicated SFX target | Dependence on a pinned Replicate community model in Phase 7 |

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Phase 1A–1E: deliver authored planning, the ElevenLabs voice/clone reference path, ElevenLabs SFX execution, the calibrated four-bus mixer, canonical artifacts, and offline acceptance | AutoShow Team | Complete — offline gate passed 2026-08-13; no live provider call used |
| Phase 2A–2E: add capability routing, Hume, Cartesia, and MiniMax integration, shared voice-workflow extensions, and cross-provider acceptance | AutoShow Team | Complete — offline gate passed 2026-08-13; no live provider call used |
| Phase 3A–3E: add First-Party Inworld AI foundation, steerable TTS, instant/pro cloning, voice design, natural language steering, audio markups, and acceptance | AutoShow Team | Complete — offline gate passed 2026-08-14; verified via unit & contract test suite |
| Phase 4A–4E: add DeepInfra hosted speech suite (Chatterbox, MiMo V2.5, Qwen3-TTS) foundation, adapters, zero-shot cloning, and acceptance | AutoShow Team | Complete — offline gate passed 2026-08-14; verified via unit & contract test suite |
| Phase 5A–5E: add Replicate open-source speech suite (F5-TTS, Dia 1.6B, XTTS-v2) foundation, zero-shot cloning, multi-speaker dialogue, and acceptance | AutoShow Team | Complete — offline gate passed 2026-08-14; verified via unit & contract test suite |
| Phase 6A–6E: add Fish registry/pricing, reference-voice TTS, native dialogue/timestamps, stateless design/materialization, voice-model lifecycle/reconciliation, soundscape routing, and acceptance | AutoShow Team | Complete — offline gate passed 2026-08-14; verified via unit & contract test suite |
| Phase 7A–7E: add AudioGen governance/pinning and license eligibility, the Replicate SFX target, prediction execution, expiry-safe artifacts/routing, and historical acceptance | AutoShow Team | Complete — offline gate passed 2026-08-14; verified via unit & contract test suite |
| Phase 8A: Episode 2 Scene 1 authored script & workspace audit | AutoShow Team | Complete — v5 script structure generated & static planning validated |
| Phase 8B–8D: generate Episode 2 Scene 1 soundscape audio matrix across Hume, Cartesia, MiniMax, Inworld, DeepInfra, Replicate, and Fish sub-waves with corresponding ADR-019 panel-vid renders | AutoShow Team | In Progress — Sub-Wave 2.2 (Hume Octave-1) audio run completed (38.7 MB) & panel-vid rendered (`slideshow.mp4`); Sub-Wave 2.1 (ElevenLabs Eleven_v3) audio run completed; Fish Speech stock voice registry approved & preflight validated; manifest append-only projection check verified |

## Test Plan

Run the default no-cost repository verification and targeted offline soundscape contracts:

```bash
bun run check
bun t --price
bun test test/test-cases/validation/comic/soundscape-schema-contracts.test.ts
bun test test/test-cases/validation/comic/soundscape-timeline-contracts.test.ts
bun test test/test-cases/validation/comic/soundscape-mixer-contracts.test.ts
bun test test/test-cases/validation/comic/comic-soundscape-artifact-contracts.test.ts
bun test test/test-cases/validation/comic/comic-audio-phase-2-contracts.test.ts
bun test test/test-cases/validation/media-generation/elevenlabs-sfx-adapter-contracts.test.ts
bun test test/test-cases/validation/media-generation/voice-clone-phase-1-contracts.test.ts
git diff --check
```

The implemented Phase 1 tests use local synthetic WAV fixtures and mocked HTTP responses. They prove dialogue-only zero-dispatch behavior, soundscape-only execution without a TTS target, exact and unresolved anchors, pre-roll shifting, shared SFX reuse across dialogue targets, cache-key separation from mix identity, required and optional cue failures, price-mode no-call/no-write behavior, durable admission and ambiguous-redispatch blocking, resume, cancellation, output format, stem lineage, measured ducking, limiter bounds, deterministic selected artifacts, protected clone provisioning, and canonical manifest publication. Later phases add their provider-specific test files when implemented; they are not part of the Phase 1 command list above. Do not run live sound generation, hosted TTS, or any provider smoke/e2e path to verify this ADR.

Shared hosted SFX admission and rate-pressure recovery were verified on 2026-08-14 with fake-clock coordinator contracts and mocked sound-effect adapters only; no live provider generation ran.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — canonical manifest, resume, and no-call price planning
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — workflow type ownership and the `~/types` barrel
- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md) — shared provider infrastructure and comic boundaries
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — bounded provider work and lane identity
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — model-qualified capability, lifecycle, and pricing policy
- Related ADR: [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md) — dialogue, timing, cache, artifact, and mastering foundation
- Related ADR: [ADR-019](ADR-019-synchronize-comic-panels-with-manifest-backed-audio.md) — derived panel timing, presentation remix, and still-image rendering
- Background report: [Cartoon Sci-Fi Space Crew Voice, Multi-Character TTS, and Soundscape/Foley Options](../reports/comic-character-tts-options-report.md) — provider claims are non-authoritative and require implementation-time revalidation
- Implementation sources: [subphase documentation index](#implementation-documentation-index) — direct primary references for 1A–7E
