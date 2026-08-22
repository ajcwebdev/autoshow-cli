# ADR-013: Add Character Voice References and Multi-Speaker Script-to-Audio

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-10
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed

## Context

AutoShow can synthesize single-voice speech through 16 providers and already has a generic multi-speaker parser, speaker mappings, turn files, local concatenation, and a native Gemini branch. Comic provides structured dialogue input: `structured-script.json` retains stable source-segment IDs, canonical character keys, original speaker labels, normalized spoken text, delivery notes, and scene locations.

Those pieces do not form a trustworthy multi-character script-to-audio workflow. Comic exposes no command for creating, selecting, auditioning, approving, or snapshotting a character voice, and no command for turning a structured comic script into multi-character audio. The generic TTS speaker registry contains only a speaker string and a provider-agnostic voice string or path. It cannot express provider-specific castings, voice-design or clone state, access restrictions, consent, delivery controls, remote-resource lifecycle, or immutable voice identity.

The existing multi-speaker contract was also incorrect: most segmented adapters captured the original voice during target collection and ignored per-turn overrides, while final metadata recorded the requested mappings as if every provider had used them. Provider capabilities are richer than one `voice` string. ElevenLabs, Hume, Mistral, Gemini, MiniMax, xAI, Speechify, Cartesia, and Deepgram expose design, clone, native dialogue, or catalog features that comic must not reimplement as a second client stack.

This decision is constrained by existing architectural rules:

- ADR-002 reserves one unversioned canonical `manifest.json` for every run root, makes its item/provider state the only persistence authority, and rejects compatibility readers for retired pipeline formats.
- ADR-007 requires comic to adapt domain semantics to shared provider infrastructure instead of maintaining a comic-local model or dispatch stack.
- ADR-008 makes hosted TTS provider lanes and bounded work scheduling the shared concurrency boundary; multi-speaker turn work must join that model instead of adding another unbounded lane.
- ADR-002 requires `resume --price` to remain a no-provider, non-mutating dry run; this ADR applies the same rule to TTS price planning and separately defines static validation versus execution readiness.
- ADR-010 treats a TTS model selector as a complete runtime promise and deliberately leaves voice identity and specialized reference/dialogue capabilities to a separate decision such as this one.

Why now: multi-character script-to-audio is the next workflow requirement, with comic as its first structured-script consumer. Dispatch and artifact contracts must be corrected before voice-design, clone, or native-dialogue features enlarge an untrustworthy surface.

## Options Considered

**Option 1 (selected)**

- **Option:** Build shared voice-identity, provisioning, capability, dialogue-rendering, timing, and artifact primitives; make comic consume them; implement five voice-managed model adapters with a truthful segmented baseline across all 16 providers
- **Pros:** Repairs the current contract once; gives every provider a truthful segmented baseline; preserves provider-native strengths; supports immutable character references, local repair, comparison, and resume across five dedicated voice-managed models (ElevenLabs `eleven_v3`, Inworld `realtime-tts-2`, Fish `s2.1-pro`, Cartesia `sonic-3.5-2026-05-04`, and Speechify `simba-3.2`)
- **Cons:** Largest initial change; requires versioned artifacts, provider conformance tests, lifecycle state, and two render strategies
- **Quantitative Notes:** 16 providers; 5 voice-managed models with distinct expressiveness paths; 11 synthesis-only providers; 2 new comic commands

**Option 2**

- **Option:** Patch per-turn voice arguments and add comic flags directly to the existing `TtsOptions` bag
- **Pros:** Smaller short-term change; can make basic speaker switching work
- **Cons:** Leaves identity, consent, capabilities, provider-qualified casting, snapshots, resource lifecycle, and native dialogue unmodeled; generic options continue to mix selection and invocation
- **Quantitative Notes:** Fixes one defect but leaves the report's architectural gaps intact

**Option 3**

- **Option:** Build an ElevenLabs-only script-to-audio workflow
- **Pros:** Fastest route to the broadest managed provider feature set
- **Cons:** Locks script-to-audio artifacts and commands to one provider, bypasses shared TTS, and makes Hume/Mistral/Gemini or local fallback expensive to add later
- **Quantitative Notes:** 1 provider; no portable baseline

**Option 4**

- **Option:** Use only independent turn synthesis and local assembly
- **Pros:** Works for nearly every provider; simplest cache and repair model
- **Cons:** Discards native conversational context, timestamps, and continuation available from ElevenLabs, Fish, Hume, and Gemini
- **Quantitative Notes:** 16 potential segmented providers; 0 native capability use

**Option 5**

- **Option:** Use only provider-native dialogue
- **Pros:** Maximizes provider-owned context
- **Cons:** Excludes providers without native dialogue, fails on speaker/length ceilings, weakens targeted repair, and creates provider-specific artifacts
- **Quantitative Notes:** At most a few current providers; Gemini is exactly two speakers

**Option 6**

- **Option:** Add voice fields directly to the visual character catalog
- **Pros:** One character file to inspect
- **Cons:** Couples provider resources, consent, expiry, and audio settings to a strict visual schema and forces unrelated schema migrations
- **Quantitative Notes:** Visual catalog is strict schema version 3

## Decision

Create one shared, provider-neutral script-to-audio subsystem beneath both the generic Step 4 TTS command and comic. Comic owns authored character voice briefs, role resolution, approvals, immutable scene snapshots, and source-linked dialogue plans. Shared TTS owns provider capabilities, voice provisioning and lifecycle ports, explicit per-invocation voice dispatch, native and segmented rendering, timing normalization, scheduling, and synthesis metadata. Comic must not create provider clients or a second TTS target registry.

Voice reference management is supported across five models: ElevenLabs `eleven_v3`, Inworld `realtime-tts-2`, Fish `s2.1-pro`, Cartesia `sonic-3.5-2026-05-04`, and Speechify `simba-3.2`. These models implement the common discovery, candidate, audition, registration, lifecycle, preflight, expressiveness, timing, and manifest contracts according to their documented capabilities. Every existing TTS provider must implement the explicit-voice segmented baseline or fail locally with a truthful model-specific capability error; no adapter may silently reuse a captured default voice.

This applies to:

- All current generic multi-speaker TTS behavior, metadata, artifacts, validation, scheduling, and provider request contracts.
- Comic character voice briefs, reference-voice creation/import/audition/approval, immutable voice snapshots, dialogue planning, audio generation, caching, assembly, effects, timing, resume, domain artifacts, and canonical scene-run state.
- Existing providers' stock, saved, custom, designed, cloned, or request-time reference voice sources as their adapters truthfully support them.
- Durable catalog, design, clone, inspect, and delete lifecycle contracts for the five voice-managed models.
- Native multi-speaker dialogue or utterance rendering where supported (ElevenLabs `eleven_v3` Text-to-Dialogue, Fish `s2.1-pro` native multi-speaker streaming, Gemini two-speaker dialogue, and Hume `octave-2` native utterances) with segmented fallback when scene constraints or model limits require it.

`tts` synthesizes with one existing stock, designed, or cloned voice ID and remains compatible with every implemented TTS model. `voice` and `comic reference-voice` manage durable catalog, design, clone, inspect, and delete resources only for the five voice-managed models. Hume, MiniMax, DeepInfra, Mistral, and every stock-only model stay synthesis-only. fal.ai Maya stays off the voice surface until it exposes a durable voice port.

Each voice-managed model must expose a working expressiveness path. The methods are not unified:

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

This decision itself does not:

- Add Azure, Google Cloud TTS, Polly, or Resemble before the shared contracts are stable.
- Treat configured credentials as proof that an account has plan-, approval-, verification-, or region-gated voice capabilities.
- Permit implicit remote voice creation during ordinary synthesis, configuration loading, resume, cleanup, or `--price`.
- Permit cloning without recorded provenance and consent, or cross-provider cloning from a generated audition unless explicitly authorized.
- Require a live paid provider run to verify this ADR. Live quality calibration remains a separately approved activity.

### Architectural Boundaries

The script-to-audio workflow is a composition of comic-owned domain state and shared TTS-owned execution:

```text
structured-script.json
  -> comic dialogue planner
  -> character/role casting against approved registrations
  -> immutable voice snapshot and side-effect-free static render validation
  -> shared render-strategy planner
       -> native dialogue or native utterance batches
       -> explicit-voice segmented turn batches
  -> shared timing normalization and local assembly
  -> comic timeline, versioned render result, canonical scene-run update, and final recording
```

**Owner 1: Comic workflow**

- **Owner:** Comic workflow
- **Responsibilities:** `CharacterVoiceBrief`, canonical character/role resolution, reference approval, `ComicDialoguePlan`, scene voice snapshot, source provenance required by downstream consumers, effect intent, comic output paths
- **Must not own:** Provider HTTP clients, provider model registries, request retry policy, provider pricing, presentation timing or video rendering

**Owner 2: Script-to-audio workflow**

- **Owner:** Script-to-audio workflow
- **Responsibilities:** Provider voice references and registrations, capability facets, access state, explicit synthesis invocation, provider preflight, render planning, timing normalization, segmented/native execution, audio assembly, cache keys, synthesis metadata
- **Must not own:** Comic scene drafting, panel semantics, visual character schema

**Owner 3: Provider adapter**

- **Owner:** Provider adapter
- **Responsibilities:** Exact catalog, design, clone, lifecycle, request, response, limit, timing, continuation, and access-state mappings for one provider/model
- **Must not own:** Cross-provider casting policy, comic source parsing, silent fallback

**Owner 4: Local artifact layer**

- **Owner:** Local artifact layer
- **Responsibilities:** Checksums, atomic promotion, versioned domain artifacts, caches, canonical-manifest references, mastering and effects
- **Must not own:** A second pipeline manifest, an independent resume authority, remote deletion as ordinary cleanup, secrets or raw consent PII in artifacts

Types remain grouped under the existing `tts-workflow` and `comic-workflow` domains behind the `~/types` barrel in accordance with ADR-003. Shared types may not import comic implementation modules; comic maps its `CharacterKey` and role keys into shared speaker/profile identifiers at the boundary.

ADR-018 consumes the immutable `AudioRun`, final dialogue output, and original `FinalTimeline` as read-only synchronization evidence. It owns panel reconciliation, presentation timing, derived audio recomposition, and still-image MP4 rendering. A presentation run never changes voice identity, provider execution evidence, dialogue ranges on the original clock, or any ADR-013 artifact.

### Canonical Scene-Run and Artifact Contracts

Every comic scene run owns exactly one canonical, unversioned `<scene-run>/manifest.json`. A scene run uses `command: 'comic'`, `scope: 'single'`, and one item whose `input` is the normalized canonical script path. Comic drafting, image generation, and audio generation update that item through the serialized atomic writer in `pipeline-manifest.ts`. Audio render directories are provider artifact directories inside the scene run, not independent run roots, and never contain another file named `manifest.json`.

- **Canonical Manifest Binding:** Item `metadata.comic` records `schemaVersion: 1`, stages, and references for structured script, dialogue/snapshot IDs, selected per-target audio runs, mix, final timeline, and final checksums. Provider `metadata.comicAudio` records sanitized count, format, timing, current-composition/closing-attempt/cumulative cost summaries, and the aggregate render result checksum. In-flight manifests track `activeWork`, completed slot hashes, and the journal path; after compact, `result.comicAudio` holds selected-success pointers only (`render.json`, timeline, published finals, slot count, checksums).
- **Domain Artifacts:** Domain records are referenced by relative path and SHA-256 checksum (`provider-render-result.json`, `voice-reference-snapshot.json`, `render-plan.json`, `audio-run.json`). Bare `manifest.json` and `result.json` remain reserved canonical names.
- **Protected Voice Store:** Kept realpath-disjoint from output roots, storing assets, consent policies, and work attempt journals under owner-only permissions. Visual character schemas remain strictly unchanged (version 3) without embedded voice fields.

### Voice Provisioning and Capability Lifecycle

Capability presence, adapter implementation, and current-account access are separate facts. Adapters expose capability records (`AnyCapabilityRecord`), voice locators (`ProviderVoiceLocator`), preflight validation, readiness checks (`checkExecutionReadiness`), batch rendering (`renderBatch`), and optional capability ports (`VoiceCatalogPort`, `VoiceDesignPort`, `VoiceClonePort`, `VoiceLifecyclePort`, `VoiceAuditionPort`, `NativeDialoguePort`, `ContinuationPort`).

Preflight has three named phases:
1. Static/config validation and `--price` (local descriptors, zero network, zero mutation).
2. Execution readiness (authorized read-only remote inspection after local checks pass).
3. Provisioning and synthesis (explicitly selected provider-mutating phases).

Runtime options and voice lifecycles are segregated by authority:
- `TtsRuntimeOptions`: Governs synthesis and dialogue controls only; cannot express resource creation or lifecycle operations.
- The voice-management flag surfaces: Govern creation, clone, design, import, consent, and lifecycle inputs accepted only by `voice` and `comic reference-voice` management commands.
- `comic generate-audio`: Consumes approved registrations and never creates or deletes voices implicitly. Voice design is two-phase (`materializeCandidate` remotely, `approveRegistration` locally). Cloning requires recorded provenance and consent records. Remote provisioning is crash-safe with write-ahead attempt journals, lock leases, idempotency keys, and explicit reconciliation on ambiguous outcomes. Remote deletion requires an explicit management action and valid deletion eligibility.

### Comic Dialogue Plan

`comic generate-audio <script>` consumes a compatible existing scene run, resolving exact directory targets matching source identity and structured script artifacts. It writes an immutable `metadata/dialogue-plans/<plan-id>.json`, maps all roles against an aggregate local registration snapshot, and generates preliminary branch plans.

Planned turns preserve stable turn IDs, canonical character/role keys, original speaker labels, canonical text, structured delivery/tone, and local effect intent (V.O., O.S., radio, telephone). All speakable segments resolve to an explicit policy without content dropping or silent fallback.

### Render Planning and Strategy Selection

The shared render planner accepts `auto`, `native`, `segmented`, or `repair` modes:
- `auto`: Selects native rendering when model, account capabilities, speaker count, turn lengths, and voice registrations fit provider limits; otherwise uses segmented rendering.
- `native`: Strict native multi-speaker dialogue execution; fails preflight if constraints are violated.
- `segmented`: Independent turn-by-turn synthesis with timing normalization and local assembly.
- `repair`: Hybrid render identity reusing valid base turn results and re-synthesizing only resubmitted turns.

Gemini native dialogue is constrained to exactly two distinct speakers; other speaker counts use segmented synthesis.

### Segmented Rendering and Concurrency

Per-turn synthesis passes explicit voice locators and parameters to `TtsTarget.run()`. Every adapter guarantees A/B/A request serialization conformance (verifying distinct per-turn voices in actual network payloads). Dialogue work runs under the shared provider target scheduler, respecting `--tts-chunk-concurrency`, `--provider-concurrency`, and `--local-concurrency` bounds without unbounded `Promise.all` fanout.

Hosted dialogue and ordinary hosted TTS chunks use the shared run-scoped provider/account coordinator beneath their existing ordered and fair work selectors. Default `ramp` mode admits one request immediately and adds one slot every five seconds while demand is queued, up to the existing TTS chunk or turn cap; `immediate` begins at that cap. Classified rate-limit pressure halves the live shared lane limit, drains active synthesis without cancellation, and permits one exact-request recovery probe after backoff. Local audio assembly remains immediate. Definite non-timeout 4xx rejection is retry/replay-safe; network errors, timeouts, 408/409, 5xx, and missing status are ambiguous. Ambiguous paid synthesis admissions are never redispatched inside the running command; resuming one requires `--allow-ambiguous-redispatch`, which must warn that the slot may be purchased again (amended 2026-08-20, ADR-006 §D.4).

### Native Dialogue, Timing, and Continuation

Native dialogue adapters (ElevenLabs `eleven_v3`, Fish `s2.1-pro`, and Gemini two-speaker) and native utterance adapters (Hume `octave-2`) normalize provider-prepared text through `PreparedProviderText` mappings back to canonical Unicode scalar-value offsets. Provider timestamps are converted to integer milliseconds on the take clock and transformed via an audio transform ledger into the final timeline. Fish `s2.1-pro` supports native multi-speaker dialogue with timestamped streaming via `<|speaker:N|>` tags and `chunk_seq` reduction. Hume Octave multi-batch rendering supports cross-request continuation by recording result-independent generation checkpoints, allowing crash recovery and suffix rebuilds without re-synthesizing completed turns.

### Audio Assembly, Caching, and Resume

Audio assembly produces explicit WAV masters according to the scene render profile (sample rate, channels, codec, loudness, pauses, crossfades, room tone).

Caching uses content-addressed slot files at `audio/slots/<slotHash>.wav`. `slotHash` is the SHA-256 of the dialogue-plan identity, turn IDs, generation-slot text, serialized voice hash, request controls, output format, and serializer endpoint/version. A hit is a verified file at that path; the new render lists the hash and spends nothing.

A changed aggregate voice snapshot creates a new render identity but does not invalidate unrelated completed slots. Recovery compares those same slot-hash inputs and reuses only exact matches. Changed voice bindings and any rejected, ambiguous, or incomplete slots remain unresolved.

Once a mixed reused/provider-dispatched render publishes a successful terminal event and selected archive `render.json`, that selected success closes the whole render and triggers compact. Subsequent price and execution passes validate the archive checksum graph and report zero unresolved slots. If a changed render identity is fully satisfied by existing slot hashes, execution skips the provider adapter, assembles the current master from those verified files, and records a `local-composition` close without a journal.

If synthesis instead terminates after any request dispatch, target finalization preserves successful outputs and all admission states before surfacing the provider error. The failure diagnostic immediately applies the same exact resume planner, reports reusable and unresolved generation-slot counts, and names the explicit reconciliation flag when ambiguous paid admissions block automatic continuation. It does not retry an ambiguous paid create by default.

### Outputs, Retention, and Compaction

Output storage is partitioned into three lifetime classes:

**Class 1: Working**

- **Class:** Working
- **When it exists:** In-flight only
- **Retention and Compaction Rule:** Written to `audio/work/<targetKey>/<renderIdentity>/`. Deleted automatically when that target's selected success publishes.

**Class 2: Resume**

- **Class:** Resume
- **When it exists:** Incomplete or failed
- **Retention and Compaction Rule:** Preserves working tree, `journal.jsonl`, completed `audio/slots/<slotHash>.wav`, and matching `result.json`. Never deletes paid audio.

**Class 3: Archive**

- **Class:** Archive
- **When it exists:** After successful compact
- **Retention and Compaction Rule:** Retains published masters (`audio/final/<targetKey>.wav`), soundscape stems, referenced slot WAVs, bound voice snapshots, compact records (`render.json`, `sfx.json`, `mix.json`, `presentation.json`), and slim manifest pointers.

When a target publishes selected success:
1. Compact records are written and published finals are hardlinked.
2. Unreferenced slot and SFX files are pruned.
3. The working tree (`audio/work/**`), staging directories (`.staging/`), temporary files (`.tts-tmp-*`), and unbound voice snapshots are deleted.
4. The manifest `comicAudio` projection is rewritten to slim selected-success pointers. A fully reused render closes as `local-composition` with no journal.

### Provider Support Profiles

**Provider 1: ElevenLabs**

- **Provider:** ElevenLabs
- **Portable Baseline:** Segmented explicit voice
- **Advanced Capabilities / Adapter Commitment:** Shared `voice` catalog, design, remix, clone, audition, Text-to-Dialogue, timestamps, and v3 audio-tag plus `voice_settings` expressiveness

**Provider 2: MiniMax**

- **Provider:** MiniMax
- **Portable Baseline:** Segmented stock/custom voice
- **Advanced Capabilities / Adapter Commitment:** Synthesis-only; stock and custom voice support with explicit emotion selectors, volume, pitch, and interjection tags

**Provider 3: Groq**

- **Provider:** Groq
- **Portable Baseline:** Segmented stock voice
- **Advanced Capabilities / Adapter Commitment:** English Orpheus direction support

**Provider 4: xAI/Grok**

- **Provider:** xAI/Grok
- **Portable Baseline:** Segmented stock/custom ID
- **Advanced Capabilities / Adapter Commitment:** 26-voice catalog and custom voice access gates

**Provider 5: Mistral**

- **Provider:** Mistral
- **Portable Baseline:** Segmented saved/reference voice
- **Advanced Capabilities / Adapter Commitment:** Reference audio caching and lifecycle management

**Provider 6: OpenAI**

- **Provider:** OpenAI
- **Portable Baseline:** Segmented stock voice
- **Advanced Capabilities / Adapter Commitment:** Active model validation and gated custom-voice facets

**Provider 7: Gemini**

- **Provider:** Gemini
- **Portable Baseline:** Native 2-speaker & segmented turns
- **Advanced Capabilities / Adapter Commitment:** 30-voice catalog, exactly-two-speaker native dialogue, single-speaker fallback

**Provider 8: Deepgram**

- **Provider:** Deepgram
- **Portable Baseline:** Segmented Aura voice
- **Advanced Capabilities / Adapter Commitment:** ~90-voice catalog with demographic/language metadata

**Provider 9: Speechify**

- **Provider:** Speechify
- **Portable Baseline:** Segmented pre-provisioned ID
- **Advanced Capabilities / Adapter Commitment:** Shared `voice` catalog, instant clone, inspect, and delete; SSML `<speak>` expressiveness

**Provider 10: Hume**

- **Provider:** Hume
- **Portable Baseline:** Segmented explicit voice
- **Advanced Capabilities / Adapter Commitment:** Synthesis-only; Octave 1 acting direction, Octave 2 native utterances, timestamps, continuation

**Provider 11: Cartesia**

- **Provider:** Cartesia
- **Portable Baseline:** Segmented voice ID
- **Advanced Capabilities / Adapter Commitment:** Shared `voice` catalog, instant clone, inspect, and delete; in-text SSML-like expressiveness

**Provider 12: Inworld**

- **Provider:** Inworld
- **Portable Baseline:** Segmented stock/custom voice ID
- **Advanced Capabilities / Adapter Commitment:** Shared `voice` catalog, design, instant clone, inspect, and delete; `--tts-instructions` steering plus preserved inline vocal tags

**Provider 13: DeepInfra**

- **Provider:** DeepInfra
- **Portable Baseline:** Segmented model-qualified synthesis
- **Advanced Capabilities / Adapter Commitment:** Reliable hosted single-voice inference; model-specific design, clone, and protected-reference facets are delivered under ADR-017 and stay off the `voice` management surface; native dialogue is truthfully unsupported

**Provider 14: Replicate**

- **Provider:** Replicate
- **Portable Baseline:** Segmented Kokoro stock voice
- **Advanced Capabilities / Adapter Commitment:** Version-pinned `jaaari/kokoro-82m` with exact stock-voice and speed serialization; speculative reference/dialogue models remain excluded

**Provider 15: Fish**

- **Provider:** Fish
- **Portable Baseline:** Segmented approved-reference synthesis
- **Advanced Capabilities / Adapter Commitment:** Shared `voice` catalog, design, instant clone, inspect, delete, and reconcile; native dialogue plus in-text `[emotion]` markup

## Rationale

- Voice identity is durable project state; separating briefs, registrations, auditions, and snapshots ensures character continuity.
- Explicit invocation identity prevents voice-capture bugs where collectors retain default options.
- Capability facets allow maximum provider feature utilization while maintaining a reliable segmented fallback baseline.
- Five voice-managed models validate the full subsystem across discovery, design, instant cloning, expressiveness, native dialogue, and lifecycle management while preserving a truthful segmented baseline for all other providers.
- Native and segmented paths are both required to balance conversational coherence with provider portability and targeted repair.
- Serializer-observed request/result evidence ensures truthful cost accounting and reproducible builds.

## Consequences

Positive outcomes:
- All 16 TTS providers participate in the shared explicit-voice/capability boundary; providers without a verified native or voice-management facet fail locally rather than fabricating support.
- Five models achieve first-class voice management across discovery, design, cloning, inspect, delete, and model-specific expressiveness.
- Comic achieves stable voice references, audition/approval workflows, local repair, and mastering contracts.
- Remote voice creation, verification, approval, expiry, and deletion become explicit, observable lifecycle states.
- Pipeline manifests reflect true serialized voice and model identities.
- Successful runs compact to one paid copy per slot and SFX source, published masters, soundscape stems, and a handful of compact records.

Negative outcomes:
- Subsystem complexity increases, requiring structured domain artifacts, transition ledgers, and formal preflight checks.
- Sensitive voice assets and consent data require a protected store and strict path isolation.
- Maintaining native dialogue alongside segmented fallback requires dual render strategies and timing alignment logic.
- Compact deletes in-flight journals, so post-success debugging uses only the compact cost/retry/error summary.

## Trade-offs

**Trade-off 1**

- **Gain:** Stable provider-neutral character identity
- **Sacrifice:** Additional domain schemas and lifecycle state

**Trade-off 2**

- **Gain:** Broad segmented compatibility plus provider-native quality
- **Sacrifice:** Dual render strategies and strategy planning

**Trade-off 3**

- **Gain:** Crash-safe selected-take continuation across provider batches
- **Sacrifice:** In-flight journal plus per-slot result files until compact

**Trade-off 4**

- **Gain:** Five-model voice management and expressiveness
- **Sacrifice:** Model-specific capability facets and expressiveness mappings

**Trade-off 5**

- **Gain:** Auditable consent, provenance, and request identity
- **Sacrifice:** Stricter preflight and protected asset isolation

**Trade-off 6**

- **Gain:** Targeted line repair without repeating full synthesis
- **Sacrifice:** One retained slot WAV per paid generation hash

**Trade-off 7**

- **Gain:** Compact archive after success
- **Sacrifice:** No post-success admission-journal or mastering-intermediate reconstruction

## API / Type Impact

- Extend `PROCESS_COMMANDS` with `comic` using the unversioned `PipelineManifest` envelope.
- Extend `PipelineProviderState` with top-level `operation`, `targetKey`, and `transport`.
- Replace service/model-only target key derivation with `canonicalTargetKey(operation, service, model, transport)` and introduce voice-aware `renderIdentity`.
- Segregate `TtsRuntimeOptions` synthesis controls from the voice-management flag surfaces owned by `voice` and `comic reference-voice`.
- Replace single `voice: string` speaker maps with `ResolvedVoiceBinding` and immutable snapshot bindings.
- Add strict domain schemas for `ComicSourceIdentity`, `CharacterVoiceBrief`, `ProviderRenderPlan`, `ProviderRenderResult`, compact `render.json` / `sfx.json` / `mix.json` / `presentation.json`, and `AudioRun`.
- Add bounded dialogue work selector integrating with provider concurrency lanes.
- Replace snapshot admission journals with content-addressed `audio/slots/<slotHash>.wav` plus `journal.jsonl`.

## Implementation Note

- Shared TTS carries immutable explicit per-turn invocations through all 16 adapters, asserts A/B/A request serialization, plans Gemini exactly-two-speaker native rendering with turn-safe batching, and bounds dialogue work through the shared scheduler. Target identities persist with strict `ttsAudio` / `comicAudio` projections. Selected success deletes the working tree and writes slim selected-success pointers.
- The protected store holds content-addressed references, candidate previews, auditions, consent, and reconciliation evidence under owner-only roots kept realpath-disjoint from output roots. `voice` and `comic reference-voice` import, audition, approve, reconcile, retire, revoke, delete, and inspect registrations through crash-safe provisioning journals. All remote creation is confined to management commands.
- Comic writes one canonical `command: 'comic'` scene manifest. `comic generate-audio` selects only an exact compatible existing scene run, resolves every target and role through one immutable approved aggregate snapshot, and reuses the shared branch, readiness, admission, render, result, and audio-run machinery under the `comicAudio` namespace with explicit 16/24-bit mono/stereo WAV mastering. A nonempty pinned path that fails exact compatibility is rejected without rewriting its structured script or manifest.
- Voice reference management is implemented for ElevenLabs `eleven_v3`, Inworld `realtime-tts-2`, Fish `s2.1-pro`, Cartesia `sonic-3.5-2026-05-04`, and Speechify `simba-3.2`. MiniMax, Hume, DeepInfra, Mistral, Replicate, fal.ai, and stock-only providers remain synthesis-only. Hume supports native utterances (Octave 2) and acting descriptions (Octave 1) during synthesis but does not expose voice-management ports.
- Every price path makes no provider call and writes no artifact. Standalone TTS selection and resume share one typed 16-provider descriptor.
- Provider task and prediction IDs are written as acceptance evidence before asynchronous polling continues. Target and comic aggregation preserves structured causes instead of relabeling provider failures as command usage errors.

## Test Plan

Run the default repository verification together with the named local, no-cost contract validation suites:

```bash
bun run check
bun test test/test-cases/validation/resume-manifests/canonical-manifest-contracts.test.ts
bun test test/test-cases/validation/resume-manifests/no-legacy-persistence-contracts.test.ts
bun test test/test-cases/validation/resume-manifests/resume-additive-*.test.ts
bun test test/test-cases/validation/resume-manifests/resume-provider-surface-contracts.test.ts
bun test test/test-cases/validation/resume-manifests/tts-resume-batch-contracts.test.ts
bun test test/test-cases/validation/resume-manifests/tts-resume-canonical-contracts.test.ts
bun test test/test-cases/validation/resume-manifests/tts-resume-protected-mistral-contracts.test.ts
bun test test/test-cases/validation/media-generation/tts-explicit-voice-dispatch.test.ts
bun test test/test-cases/validation/media-generation/tts-current-render-recovery.test.ts
bun test test/test-cases/validation/media-generation/tts-audio-run-artifacts.test.ts
bun test test/test-cases/validation/media-generation/tts-safe-artifact-lifecycle.test.ts
bun test test/test-cases/validation/media-generation/tts-readiness-failure-persistence.test.ts
bun test test/test-cases/validation/media-generation/tts-voice-provisioning-lifecycle.test.ts
bun test test/test-cases/validation/media-generation/tts-advanced-provider-phase-3.test.ts
bun test test/test-cases/validation/media-generation/tts-advanced-provider-phase-4.test.ts
bun test test/test-cases/validation/media-generation/tts-dialogue-contracts.test.ts
bun test test/test-cases/validation/media-generation/tts-batch-output-contracts.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/tts-request-controls.test.ts
bun test test/test-cases/validation/configuration/config-contracts/image-tts-defaults.test.ts
bun test test/test-cases/validation/configuration/config-contracts/explicit-runtime-exclusions.test.ts
bun test test/test-cases/validation/comic/comic-workspace-path-contracts.test.ts
bun test test/test-cases/validation/comic/comic-workspace-doc-contracts.test.ts
bun test test/test-cases/validation/comic/comic-source-coverage-contracts.test.ts
bun test test/test-cases/validation/comic/character-handling-contracts.test.ts
bun test test/test-cases/validation/comic/comic-voice-reference-artifacts.test.ts
bun test test/test-cases/validation/comic/comic-audio-{planning-identity,readiness,execution-publication,snapshot-pipeline}-contracts.test.ts
bun test test/test-cases/validation/providers/tts-provider-contracts/openai-grok-groq.test.ts
bun test test/test-cases/validation/providers/tts-provider-contracts/mistral-elevenlabs.test.ts
bun test test/test-cases/validation/providers/tts-provider-contracts/deepgram-minimax.test.ts
bun test test/test-cases/validation/providers/tts-provider-contracts/speechify.test.ts
bun test test/test-cases/validation/providers/tts-provider-contracts/hume-cartesia.test.ts
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
git diff --check
```

Do not run hosted TTS commands, live voice creation, provider smoke tests, or e2e paths with cost or billing association.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — canonical run manifest and dry-run price planning
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — type domain ownership and `~/types` barrel
- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md) — shared provider infrastructure and comic command ownership
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — hosted TTS provider lanes and bounded turn selector
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — TTS model contracts and voice capability boundaries
- Related report: [2026 Hosted-Model Refresh Report: TTS](../models/05-tts-model-report.md) — TTS catalog refresh history
- Related ADR: [ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md) — Inworld, DeepInfra, Replicate, and Fish provider phases
- Related ADR: [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md) — downstream panel synchronization and still-image presentation
- `src/types/tts-workflow/tts-types.ts`
- `src/cli/commands/process-steps/step-4-tts/define-tts-command.ts`
- `src/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/structured-script-parser.ts`
- [ElevenLabs Text-to-Dialogue](https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue)
- [Hume Text to Speech overview](https://dev.hume.ai/docs/text-to-speech-tts/overview)
- [Inworld Voice Cloning](https://docs.inworld.ai/docs/tutorial-basics/voice-cloning/)
- [Fish Audio API Reference](https://docs.fish.audio/api-reference/introduction)
- [Cartesia Documentation](https://docs.cartesia.ai/)
- [Speechify API Documentation](https://docs.speechify.com/)
