# ADR-014: Add Character Voice References and Multi-Speaker Script-to-Audio

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-10
- **Date Updated:** 2026-08-14
- **Verification Status:** Passed

## Context

AutoShow can synthesize single-voice speech through 12 providers and already has a generic multi-speaker parser, speaker mappings, turn files, local concatenation, and a native Gemini branch. Comic has a better current starting point for dialogue: `structured-script.json` retains stable source-segment IDs, canonical character keys, original speaker labels, normalized spoken text, basic delivery notes, and scene locations, but v3 does not preserve every timing/stage/source-span detail required by this decision. Comic also has a useful reference-asset lifecycle for images: authored character metadata, a registered current reference with checksums and prior-generation identity, and uniquely named copied assets. Its current singleton snapshot index can be overwritten, however, so the append-only voice snapshot design in this decision intentionally strengthens rather than merely copies that precedent.

Those pieces do not yet form a trustworthy multi-character script-to-audio workflow. Comic exposes no command for creating, selecting, auditioning, approving, or snapshotting a character voice, and no command for turning a structured comic script into multi-character audio. The generic TTS speaker registry contains only a speaker string and a provider-agnostic voice string or path. It cannot express provider-specific castings, voice-design or clone state, access restrictions, consent, delivery controls, remote-resource lifecycle, or immutable voice identity.

The repository audit in `docs/reports/comic-character-tts-options-report.md` found the existing multi-speaker contract materially incorrect. `runMultiSpeakerTts` built per-turn overridden options, but ten segmented provider targets captured the original voice during target collection and ignored those runtime overrides. Only Mistral's segmented adapter and Gemini's native adapter honored distinct mapped voices. Final metadata nevertheless recorded requested mappings as if all providers had used them. Existing OpenAI dialogue coverage proved output ordering but never asserted the request voice, and user documentation overstated provider support.

The same audit identified further correctness defects and incomplete contracts: Gemini did not enforce its exactly-two-speaker native limit and could split raw speaker-formatted text at unsafe boundaries; hosted turn setup fanned out through an unbounded `Promise.all`; multi-target and native completion could advertise dialogue paths that were never promoted while batch execution silently discarded dialogue artifacts during workspace cleanup; the generic screenplay parser stripped delivery and silently dropped some content; one unqualified speaker map was reused across incompatible provider namespaces; remote clone/reference setup was not provisioned once per character; Speechify resolved consent, locale, and gender data that its request did not fully serialize; provider catalogs and OpenAI custom-voice/model contracts had drifted; manifests and benchmarks could not distinguish multiple voices using one provider/model; and all audio was silently collapsed to mono 16 kHz PCM without a comic mastering contract.

Provider capabilities are also much richer than the current adapters. ElevenLabs combines a large voice library, Voice Design, remixing, instant and professional cloning, native Text-to-Dialogue, and dialogue timestamps. Hume Octave combines a voice library, Voice Design, cloning/import, per-utterance acting direction, multi-utterance contextual rendering, timestamps, and cross-request continuation. Mistral already supports one-off and saved reference voices; Gemini has native exactly-two-speaker synthesis; MiniMax, xAI, Speechify, and Cartesia expose custom-voice paths; Deepgram has a much larger demographically tagged stock catalog than AutoShow registers. The architecture needs to expose these differences without reducing every provider to one `voice` string or forcing comic to build provider clients of its own.

This decision is constrained by five existing architectural rules:

- ADR-002 reserves one unversioned canonical `manifest.json` for every run root, makes its item/provider state the only persistence authority, and rejects compatibility readers for retired pipeline formats.
- ADR-007 requires comic to adapt domain semantics to shared provider infrastructure instead of maintaining a comic-local model or dispatch stack.
- ADR-008 makes hosted TTS provider lanes and bounded work scheduling the shared concurrency boundary; multi-speaker turn work must join that model instead of adding another unbounded lane.
- ADR-002 requires `resume --price` to remain a no-provider, non-mutating dry run; this ADR applies the same rule to TTS price planning and separately defines static validation versus execution readiness.
- ADR-010 treats a TTS model selector as a complete runtime promise and deliberately leaves voice identity and specialized reference/dialogue capabilities to a separate decision such as this one.

Why now: multi-character script-to-audio is the next workflow requirement, with comic as its first structured-script consumer, but extending the existing speaker-map path would preserve false metadata, unsafe resource creation, provider lock-in, and silent voice reuse. The dispatch and artifact contracts must be corrected before new voice-design, clone, or native-dialogue features make that surface larger.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Build shared voice-identity, provisioning, capability, dialogue-rendering, timing, and artifact primitives; make comic consume them; implement ElevenLabs and Hume as first-class adapters** | Repairs the current contract once; gives every provider a truthful segmented baseline; preserves provider-native strengths; supports immutable character references, local repair, comparison, and resume | Largest initial change; requires versioned artifacts, provider conformance tests, lifecycle state, and two render strategies | 12 existing providers; 10 captured-voice adapters to repair; 2 first-class advanced adapters; 2 new comic commands |
| Patch per-turn voice arguments and add comic flags directly to the existing `TtsOptions` bag | Smaller short-term change; can make basic speaker switching work | Leaves identity, consent, capabilities, provider-qualified casting, snapshots, resource lifecycle, and native dialogue unmodeled; generic options continue to mix selection and invocation | Fixes one defect but leaves the report's architectural gaps intact |
| Build an ElevenLabs-only script-to-audio workflow | Fastest route to the broadest managed provider feature set | Locks script-to-audio artifacts and commands to one provider, bypasses shared TTS, and makes Hume/Mistral/Gemini or local fallback expensive to add later | 1 provider; no portable baseline |
| Use only independent turn synthesis and local assembly | Works for nearly every provider; simplest cache and repair model | Discards native conversational context, timestamps, and continuation available from ElevenLabs, Hume, and Gemini | 12 potential segmented providers; 0 native capability use |
| Use only provider-native dialogue | Maximizes provider-owned context | Excludes providers without native dialogue, fails on speaker/length ceilings, weakens targeted repair, and creates provider-specific artifacts | At most a few current providers; Gemini is exactly two speakers |
| Add voice fields directly to the visual character catalog | One character file to inspect | Couples provider resources, consent, expiry, and audio settings to a strict visual schema and forces unrelated schema migrations | Visual catalog is strict schema version 3 |

## Decision

Create one shared, provider-neutral script-to-audio subsystem beneath both the generic Step 4 TTS command and comic. Comic owns authored character voice briefs, role resolution, approvals, immutable scene snapshots, and source-linked dialogue plans. Shared TTS owns provider capabilities, voice provisioning and lifecycle ports, explicit per-invocation voice dispatch, native and segmented rendering, timing normalization, scheduling, and synthesis metadata. Comic must not create provider clients or a second TTS target registry.

ElevenLabs and Hume Octave are the first-class advanced adapters for this subsystem. Both must implement the common discovery, candidate, audition, registration, lifecycle, preflight, native-dialogue, segmented-fallback, timing, and manifest contracts wherever the provider offers the capability. Every existing TTS provider must implement the explicit-voice segmented baseline or fail locally with a truthful model-specific capability error; no adapter may silently reuse a captured default voice.

This applies to:

- All current generic multi-speaker TTS behavior, metadata, artifacts, validation, scheduling, and provider request contracts.
- Comic character voice briefs, reference-voice creation/import/audition/approval, immutable voice snapshots, dialogue planning, audio generation, caching, assembly, effects, timing, resume, domain artifacts, and canonical scene-run state.
- Existing providers' stock, saved, custom, designed, cloned, or request-time reference voice sources as their adapters truthfully support them.
- First-class ElevenLabs voice-library, Voice Design/remix, clone, Text-to-Dialogue, and timestamp paths.
- First-class Hume voice-library, Voice Design, clone/import, acting-direction, multi-utterance, timestamp, and continuation paths.

This does not:

- Add Azure, Google Cloud TTS, Polly, Resemble, Qwen3-TTS, Chatterbox, or another new provider before the shared contracts are stable.
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

| Owner | Responsibilities | Must not own |
|---|---|---|
| Comic workflow | `CharacterVoiceBrief`, canonical character/role resolution, reference approval, `ComicDialoguePlan`, scene voice snapshot, source provenance required by downstream consumers, effect intent, comic output paths | Provider HTTP clients, provider model registries, request retry policy, provider pricing, presentation timing or video rendering |
| Script-to-audio workflow | Provider voice references and registrations, capability facets, access state, explicit synthesis invocation, provider preflight, render planning, timing normalization, segmented/native execution, audio assembly, cache keys, synthesis metadata | Comic scene drafting, panel semantics, visual character schema |
| Provider adapter | Exact catalog, design, clone, lifecycle, request, response, limit, timing, continuation, and access-state mappings for one provider/model | Cross-provider casting policy, comic source parsing, silent fallback |
| Local artifact layer | Checksums, atomic promotion, versioned domain artifacts, caches, canonical-manifest references, mastering and effects | A second pipeline manifest, an independent resume authority, remote deletion as ordinary cleanup, secrets or raw consent PII in artifacts |

Types remain grouped under the existing `tts-workflow` and `comic-workflow` domains behind the `~/types` barrel in accordance with ADR-003. Shared types may not import comic implementation modules; comic maps its `CharacterKey` and role keys into shared speaker/profile identifiers at the boundary.

ADR-019 consumes the immutable `AudioRun`, final dialogue output, and original `FinalTimeline` as read-only synchronization evidence. It owns panel reconciliation, presentation timing, derived audio recomposition, and still-image MP4 rendering. A presentation run never changes voice identity, provider execution evidence, dialogue ranges on the original clock, or any ADR-014 artifact.

### Canonical Scene-Run and Domain Artifact Contract

Every comic scene run owns exactly one canonical, unversioned `<scene-run>/manifest.json`. This decision extends `PROCESS_COMMANDS` with `comic`; a scene run uses `command: 'comic'`, `scope: 'single'`, and one item whose `input` is the normalized canonical script path. Comic drafting, image generation, and audio generation update that same item through the serialized atomic writer in `pipeline-manifest.ts`. Audio render directories are provider artifact directories inside the scene run, not independent run roots, and never contain another file named `manifest.json`. Existing comic workspaces without a valid canonical comic manifest are a clean-break input and must be rebuilt; this decision adds no retired-file probe, upgrader, or compatibility reader.

The canonical envelope remains the ADR-002 shape and has no `schemaVersion`. New versioned voice and dialogue records are domain artifacts referenced from it. Although ADR-002 reserves direct unversioned `result.json` for provider payloads in workflows that use it, TTS/comic adapters under this decision never persist a raw provider JSON response: they extract/promote audio, discard base64 bodies, and retain only a typed allowlisted evidence projection. The normalized detailed artifact is named `provider-render-result.json`, carries its own domain `schemaVersion`, and is bound to canonical state by a contained relative path and SHA-256 checksum. Bare `manifest.json` and `result.json` remain reserved canonical names; ADR-owned domain artifacts use descriptive names such as `voice-reference-snapshot.json`, `provider-render-plan.json`, `provider-render-result.json`, and `audio-run.json`.

| Canonical field | Comic audio meaning |
|---|---|
| Top-level `source` | Canonical `ComicSourceIdentity` for the exact input bytes |
| Item `input` | Normalized canonical script path, never the script body |
| Item `outputDir` | The scene-run root |
| Item `metadata.comic` | `schemaVersion: 1`; strict `stages` records plus `audio` references for structured script, scene-run/dialogue/snapshot IDs, selected per-target audio runs, mix, final timeline, and final outputs/checksums |
| Provider `operation`, `service`, `model`, `transport`, and `targetKey` | One requested operation-scoped adapter target, where `targetKey = canonicalTargetKey(operation, service, model, transport)` |
| Provider `options` | Preliminary branch-plan ID, dialogue/snapshot/voice-context identities, mode candidates, synthesis/output hashes and stable capability-fixture/scope inputs; final render-plan/render identity, chosen strategy, account scope and voice revisions appear only after all-target readiness succeeds |
| Provider `metadata.comicAudio` | Sanitized request/output counts, format, timing, current-composition/closing-attempt/cumulative cost summaries, plus the aggregate provider-render-result reference/checksum |
| Provider `result.comicAudio` | Append-only branch/readiness/render records, discriminated active-work and selected-success pointers, per-attempt dated account-observation/readiness and admission-journal references, cross-attempt batch progress, batch/aggregate result references/checksums, verified output references, committed take selections, continuation checkpoints, audio runs, and cache evidence needed for resume |
| Provider `error` | Typed and sanitized phase, code, message, retryability, and optional blocking/reconciliation reason |

`ProviderRenderResult.status` maps to the canonical status vocabulary (`missing`, `failed`, `running`, `succeeded`, `skipped`) with explicit attempt and result rules governing preliminary branches, readiness failures, peer target blocks, active attempts, cache materializations, native logical batches, and verified output assemblies.

### Core Voice Primitives

The subsystem defines a strongly-typed domain model for voice capabilities, provider access, account observations, voice references, and provisioning lifecycle states:

```ts
type VoiceCapabilityFeature =
  | 'turn-synthesis' | 'native-dialogue' | 'native-utterances'
  | 'voice-catalog' | 'voice-design' | 'voice-remix'
  | 'instant-clone' | 'professional-clone' | 'voice-import'
  | 'voice-delete' | 'acting-description' | 'word-timing'
  | 'phoneme-timing' | 'continuation'

type VoiceOrigin =
  | 'provider-stock' | 'community-library' | 'designed'
  | 'remixed' | 'instant-clone' | 'professional-clone'
  | 'imported-custom' | 'saved-reference' | 'request-reference-audio'
  | 'local-model-voice'

type ProviderVoiceRef =
  | { kind: 'remote-resource'; provider: TtsProvider; resourceId: string; origin: VoiceOrigin; ... }
  | { kind: 'shared-library-resource'; provider: TtsProvider; sharedVoiceId: string; ... }
  | { kind: 'reference-asset'; provider: TtsProvider; protectedAsset: ProtectedAssetRef; ... }
  | { kind: 'local-model-voice'; provider: TtsProvider; model: string; voiceLocator: string }

type VoiceProvisioningState =
  | { state: 'ready'; providerVoice: ProviderVoiceRef }
  | { state: 'pending'; operationId: string }
  | { state: 'verification-required'; action: string }
  | { state: 'approval-required'; action: string }
  | { state: 'external-action-required'; action: string }
  | { state: 'reconciliation-required'; attemptId: string; reason: string }
  | { state: 'missing' | 'expired' | 'deleted' | 'failed' }
```

### Capability-Faceted Provider Boundary

Capability presence, adapter implementation, and current-account access are separate facts. Adapters expose capability records (`AnyCapabilityRecord`), voice locators (`ProviderVoiceLocator`), preflight validation, readiness checks (`checkExecutionReadiness`), batch rendering (`renderBatch`), and optional capability ports (`VoiceCatalogPort`, `VoiceDesignPort`, `VoiceClonePort`, `VoiceLifecyclePort`, `VoiceAuditionPort`, `NativeDialoguePort`, `ContinuationPort`).

Preflight has three named phases:
1. Static/config validation and `--price` (local descriptors, zero network, zero mutation).
2. Execution readiness (authorized read-only remote inspection after local checks pass).
3. Provisioning and synthesis (explicitly selected provider-mutating phases).

### Runtime Option and Side-Effect Boundary

Runtime options are strictly segregated by authority:
- `TtsCliReferenceInput`: Edge-only reference audio inputs, converted to opaque `ProtectedAssetRef` before target collection.
- `TtsSynthesisRuntimeOptions`: Synthesis and dialogue controls only; cannot express resource creation or lifecycle operations.
- `VoiceManagementRuntimeOptions`: Creation, clone, design, import, consent, and lifecycle inputs accepted only by `voice` management commands.
- `ExplicitVoiceSynthesisRequest`: Resolved voice and continuation bindings constructed from validated render plans.

### Voice Candidate, Provisioning, and Lifecycle Contract

Voice creation is separated from synthesis. `comic generate-audio` consumes approved registrations and never creates or deletes voices implicitly. Voice design is two-phase (`materializeCandidate` remotely, `approveRegistration` locally). Cloning requires recorded provenance and consent records. Remote provisioning is crash-safe, using write-ahead attempt journals, lock leases, idempotency keys, and explicit reconciliation on ambiguous outcomes. Remote deletion requires an explicit management action and valid deletion eligibility.

### Character Voice Artifact Contract

Visual character schemas remain strictly unchanged (version 3). Voice assets and metadata are stored separately in versioned artifacts:

```text
<characters-root>/
  characters-reference.json
  character-voices.json
  character-voice-registrations.json
  character-voice-current.json
  voice-references/<safe-subject-key>/<safe-provider-key>/<safe-registration-id>/<generation-id>/
    audition-manifest.json
    registration-snapshot.json

<protected-voice-store>/
  assets/<opaque-asset-id>
  policies/<opaque-asset-id>/<consent-or-policy>.json
  work/<opaque-attempt-id>/

<scene-run>/
  manifest.json
  metadata/structured-script.json
  metadata/dialogue-plans/<plan-id>.json
  assets/voice-reference-snapshots.json
  assets/voice-references/<snapshot-id>/voice-reference-snapshot.json
  audio/providers/<safe-target-key>/
    branches/<branch-plan-id>/...
    renders/<render-identity>/...
```

Protected asset roots and output roots are verified to be realpath-disjoint before protected materialization or execution.

### Comic Dialogue Plan

`comic generate-audio <script>` consumes a compatible existing scene run, resolving exact directory targets matching source identity and structured script v4 artifacts. It writes an immutable `metadata/dialogue-plans/<plan-id>.json`, maps all roles against an aggregate local registration snapshot, and generates preliminary branch plans.

Planned turns preserve stable turn IDs, canonical character/role keys, original speaker labels, canonical text, structured delivery/tone, and local effect intent (V.O., O.S., radio, telephone). All speakable segments resolve to an explicit policy without content dropping or silent fallback.

### Render Planning and Strategy Selection

The shared render planner accepts `auto`, `native`, `segmented`, or `repair` modes:
- `auto`: Selects native rendering when model, account capabilities, speaker count, turn lengths, and voice registrations fit provider limits; otherwise uses segmented rendering.
- `native`: Strict native multi-speaker dialogue execution; fails preflight if constraints are violated.
- `segmented`: Independent turn-by-turn synthesis with timing normalization and local assembly.
- `repair`: Hybrid render identity reusing valid base turn results and re-synthesizing only resubmitted turns.

Gemini native dialogue is constrained to exactly two distinct speakers; other speaker counts use segmented synthesis.

### Segmented Rendering and Concurrency

Per-turn synthesis passes explicit voice locators and parameters to `TtsTarget.run()`. Every adapter guarantees A/B/A request serialization conformance (verifying distinct per-turn voices in actual network payloads). dialogue work runs under the shared provider target scheduler, respecting `--tts-chunk-concurrency`, `--provider-concurrency`, and `--local-concurrency` bounds without unbounded `Promise.all` fanout.

Hosted dialogue and ordinary hosted TTS chunks use the shared run-scoped provider/account coordinator beneath their existing ordered and fair work selectors. Default `ramp` mode admits one request immediately and adds one slot every five seconds while demand is queued, up to the existing TTS chunk or turn cap; `immediate` begins at that cap. The former TTS success-count startup growth is retired. Classified rate-limit pressure halves the live shared lane limit, drains active synthesis without cancellation, and permits one exact-request recovery probe after backoff. Local Kitten work and local audio assembly remain immediate, and ambiguous paid synthesis admissions retain the explicit redispatch reconciliation policy.

### Native Dialogue, Timing, and Continuation

Native dialogue adapters normalize provider-prepared text through `PreparedProviderText` mappings back to canonical Unicode scalar-value offsets. Provider timestamps are converted to integer milliseconds on the take clock and transformed via an audio transform ledger into the final timeline.

Hume Octave multi-batch rendering supports cross-request continuation by recording result-independent generation checkpoints, allowing crash recovery and suffix rebuilds without re-synthesizing completed turns.

### Audio Assembly, Caching, and Resume

Audio assembly produces explicit WAV masters according to the scene render profile (sample rate, channels, codec, loudness, pauses, crossfades, room tone).

Caching uses content-addressed, versioned envelopes (`SynthesisCacheEntry`) backed by `CacheSourceProvenanceAttestation` records. Hits materialize local `CacheMaterializationPlan` artifacts with zero current spend or provider attempts. Resume reuses verified cache entries and local audio runs matching identical input hashes. For segmented dialogue, a changed aggregate voice snapshot creates a new render identity but does not invalidate unrelated completed turns: recovery compares the source identity, dialogue plan, provider/model/transport, output format, generation-slot text checksum, request controls, resolved turn data, serializer endpoint/version, and serialized voice hash, then promotes only exact-compatible completed outputs as audited cache materializations. Changed voice bindings and any rejected, ambiguous, or incomplete slots remain unresolved.

Once a mixed cache-materialized/provider-dispatched render publishes a successful terminal event and selected `AudioRun`, that selected success closes the whole render. Subsequent price and execution passes validate its complete evidence graph and report zero unresolved slots; they do not require each cache-materialized slot to masquerade as a new provider-dispatch result and never purchase those slots again. If a changed render identity is fully satisfied by compatible materializations, execution skips the provider adapter entirely, assembles the current master from those verified outputs, and records a `local-composition` terminal result without an empty provider attempt or admission journal.

If synthesis instead terminates after any request dispatch, target finalization preserves successful outputs and all admission states before surfacing the provider error. The failure diagnostic immediately applies the same exact resume planner, reports reusable and unresolved generation-slot counts, and names the explicit reconciliation flag when ambiguous paid admissions block automatic continuation. It does not retry a 5xx, timeout, network failure, or other ambiguous paid create automatically; only the user-authorized resume may redispatch those exact unresolved slots, and it must warn that they may be purchased again.

### Truthful Metadata and Artifact Retention

Canonical provider projections (`ttsAudio` or `comicAudio`) replace flat speaker summaries as authority. Detailed results record exact turn counts, batch counts, generation slots, request counts, cache materializations, take counts, output checksums, and provider cost allocations. Retired manifest formats are rejected.

### Provider Support Profiles

| Provider | Portable Baseline | Advanced Capabilities / Adapter Commitment |
|---|---|---|
| Kitten | Local segmented stock voices | No-cost local development baseline with explicit turn voice |
| ElevenLabs | Segmented explicit voice | Library discovery, Voice Design, remix, clone state, audition, Text-to-Dialogue, timestamps |
| MiniMax | Segmented stock/custom voice | Catalog, design, clone, and activation capability descriptors |
| Groq | Segmented stock voice | Saudi-Arabic model and English direction support |
| xAI/Grok | Segmented stock/custom ID | 26-voice catalog and custom voice access gates |
| Mistral | Segmented saved/reference voice | Reference audio caching and lifecycle management |
| OpenAI | Segmented stock voice | Active model validation and gated custom-voice facets |
| Gemini | Native 2-speaker & segmented turns | 30-voice catalog, exactly-two-speaker native dialogue, single-speaker fallback |
| Deepgram | Segmented Aura voice | ~90-voice catalog with demographic/language metadata |
| Speechify | Segmented pre-provisioned ID | Consent/resource validation and model access gates |
| Hume | Segmented explicit voice | Discovery, design, clone, audition, acting direction, native utterances, timestamps, continuation |
| Cartesia | Segmented voice ID | 500+ catalog, clone tiers, localization, emotion, and timing |
| Inworld | Segmented stock/custom voice ID | Read-only current Voice API catalog discovery and pre-synthesis voice-ID readiness; mutation and native-dialogue facets remain unimplemented |

### First-Class ElevenLabs Contract

- Catalog discovery, shared library addition, Voice Design/remixing with lineage attestation, IVC API provisioning, and gated PVC support.
- Native Text-to-Dialogue (Eleven v3) with turn-safe planning, candidate take budgets, alignment timing maps, and delivery tags.
- Segmented fallback for over-limit scenes or line repair.

### First-Class Hume Octave Contract

- Catalog discovery, Octave 1 Voice Design, custom voice saving, and Octave 2 synthesis compatibility.
- Native utterance rendering with acting descriptions (Octave 1), timestamps (Octave 2), speed/silence controls, and multi-take generation slots.
- Cross-request continuation via durable generation checkpoints and atomic suffix rebuild authorizations.

## Rationale

- Voice identity is durable project state; separating briefs, registrations, auditions, and snapshots ensures character continuity.
- Explicit invocation identity prevents voice-capture bugs where collectors retain default options.
- Capability facets allow maximum provider feature utilization while maintaining a reliable segmented fallback baseline.
- ElevenLabs and Hume validate the full subsystem (broad library casting + native dialogue vs. contextual acting direction + continuation).
- Native and segmented paths are both required to balance conversational coherence with provider portability and targeted repair.
- Serializer-observed request/result evidence ensures truthful cost accounting, benchmark accuracy, and reproducible builds.

## Consequences

Positive outcomes:
- All 12 TTS providers gain multi-speaker capability via an explicit-voice baseline.
- ElevenLabs and Hume become first-class voice platforms supporting design, cloning, native dialogue, and continuation.
- Comic achieves stable voice references, audition/approval workflows, local repair, and mastering contracts.
- Remote voice creation, verification, approval, expiry, and deletion become explicit, observable lifecycle states.
- Benchmarks and pipeline manifests reflect true serialized voice and model identities.

Negative outcomes:
- Subsystem complexity increases, requiring structured domain artifacts, transition ledgers, and formal preflight checks.
- Sensitive voice assets and consent data require a protected store and strict path isolation.
- Maintaining native dialogue alongside segmented fallback requires dual render strategies and timing alignment logic.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Stable provider-neutral character identity | Additional domain schemas and lifecycle state |
| Broad segmented compatibility plus provider-native quality | Dual render strategies and strategy planning |
| Crash-safe selected-take continuation across provider batches | Per-batch invocation/result/selection/checkpoint tracking |
| First-class ElevenLabs and Hume capabilities | Comprehensive provider-specific adapter facets |
| Auditable consent, provenance, and request identity | Stricter preflight and protected asset isolation |
| Targeted line repair without repeating full synthesis | Storage for segment caches and working audio runs |

## API / Type Impact

- Extend `PROCESS_COMMANDS` with `comic` using the unversioned `PipelineManifest` envelope.
- Extend `PipelineProviderState` with top-level `operation`, `targetKey`, and `transport`.
- Replace service/model-only target key derivation with `canonicalTargetKey(operation, service, model, transport)` and introduce voice-aware `renderIdentity`.
- Segregate `TtsSynthesisRuntimeOptions` from `VoiceManagementRuntimeOptions`.
- Replace single `voice: string` speaker maps with `ProviderQualifiedCast` and immutable snapshot bindings.
- Add strict domain schemas for `ComicSourceIdentity`, `CharacterVoiceBrief`, `ProviderRenderPlan`, `ProviderRenderResult`, `SynthesisCacheEntry`, `AudioRun`, etc.
- Add bounded dialogue work selector integrating with provider concurrency lanes.


## Implementation Note

- Shared TTS carries immutable explicit per-turn invocations through all 12 adapters, asserts actual A/B/A request serialization, plans strict Gemini exactly-two-speaker native rendering with turn-safe batching, bounds and cancels dialogue work through the shared scheduler, rejects explicit, configured, and inherited creation defaults before target collection, retains the strategy-appropriate render artifacts, and persists operation-scoped target identities with strict `ttsAudio` projections and append-only render history.
- The protected store holds content-addressed purpose and retention policy for references, candidate previews, auditions, consent, and reconciliation evidence under owner-only roots kept realpath-disjoint from output roots. The shared `voice` surface and the `comic reference-voice` alias import, audition, approve, reconcile, retire, revoke, delete, and inspect registrations through crash-safe provisioning journals; all remote creation, including Mistral saved references, is confined to management.
- Comic writes one canonical `command: 'comic'` scene manifest, structured-script v5 embeds source identity, Unicode source spans, and the ADR-018 soundscape envelope, and `comic generate-audio` selects only an exact compatible existing scene run, resolves every target and role through one immutable approved aggregate snapshot, and reuses the shared branch, readiness, admission, render, result, and audio-run machinery under the `comicAudio` namespace with explicit 16/24-bit mono/stereo WAV mastering. Missing or empty pinned paths may initialize, but a nonempty pinned path that fails exact compatibility is rejected without rewriting its structured script or manifest.
- ElevenLabs and Hume are implemented as the first-class advanced adapters against dated capability fixtures: catalog discovery, design and remix lineage, clone state, lifecycle, bounded turn-safe Text-to-Dialogue with prepared-text alignment, Octave model-constrained direction and timing, one-to-five native takes, and selected-generation continuation.
- MiniMax, Cartesia, and Speechify expose catalog, design, clone, and lifecycle facets. Their fixtures mark Cartesia and Speechify text-prompt design and all three providers' native multi-speaker dialogue unsupported, so those providers keep the segmented baseline. No new provider was added because no remaining casting or privacy gap was demonstrated.
- Benchmark identity uses the adapter target plus render and optional registration, snapshot-entry, and character identity, with the non-reusable `legacy:` fallback for pre-ADR single-voice state. ADR-013 records the refreshed provider catalogs, and ADR-008 records the dialogue selector.
- Every price path, for both synthesis and voice management, makes no provider call and writes no artifact.
- The 2026-08-14 provider reliability audit tightened the shared admission contract: definite non-timeout 4xx rejection is retry/replay-safe, while network errors, timeouts, 408/409, 5xx, and missing status are ambiguous. Provider task and prediction IDs are written as acceptance evidence before asynchronous polling continues, and target/comic aggregation preserves structured causes instead of relabeling provider failures as command usage errors.
- Provider fixtures describe only code that exists. Inworld now exposes the documented read-only `GET /voices/v1/voices` catalog through `voice discover`, and execution readiness verifies every approved Inworld voice ID against that live account-visible catalog before paid synthesis begins. Inworld mutation and native-dialogue facets, plus DeepInfra and Replicate voice-management facets, remain unavailable until their real verified adapters exist; hardcoded catalogs, synthetic preview WAVs, fabricated resource IDs, and no-op deletion are prohibited. Missing credentials, unavailable approved voices, or missing provider audio are failures and never produce silent placeholder audio.
- Comic target construction forwards every selected remote voice ID into the shared readiness layer for ElevenLabs, Hume, MiniMax, Cartesia, Speechify, and Inworld. A provider catalog check is therefore part of the same pre-dispatch barrier as snapshot selection instead of an optional adapter path that comic execution can bypass.
- Fish stateless design candidates are materialized by resolving the selected protected preview and supplying those bytes to the model-creation API. Empty voice-model creation is rejected locally. Definite voice-management HTTP rejection is journaled as terminal failure; uncertain post-dispatch failure remains reconciliation-required.
- Failed synthesis preserves its `.tts-tmp-*` workspace and every completed chunk or native-batch audio file. Cleanup runs only after finalization succeeds, so a later failure cannot erase paid segment evidence or force duplicate synthesis; recovery may promote recorded outputs on the next run.
- A casting correction that changes the aggregate voice snapshot creates a new immutable render, promotes only slot-compatible retained output as cache materialization, and dispatches only changed or previously incomplete slots. It never relabels a prior provider dispatch as belonging to the new render.
- A successfully closed render containing both cache materializations and provider dispatches resumes directly from its checksum-bound selected `AudioRun`; price reports zero unresolved slots and execution performs only local publication when needed.
- The append-only scene voice-snapshot index may retain multiple snapshot revisions for the same scene/dialogue identity. A run with a complete current voice registry rebuilds the candidate snapshot in memory, selects an exact retained snapshot only when its content identity matches, and otherwise appends the new casting revision while preserving every prior snapshot and render binding. A self-contained retained snapshot remains executable when no project voice registry exists, but an incomplete registry is rejected rather than silently falling back to stale casting. Price planning performs the same checksum-verified compatible-slot inspection without writing cache materializations, so its unresolved-slot count and estimated spend match the subsequent execution plan.

## Test Plan

Run the default repository verification together with the named local, no-cost contract validation suites:

```bash
bun run check
bun test test/test-cases/validation/resume-manifests/canonical-manifest-contracts.test.ts
bun test test/test-cases/validation/resume-manifests/no-legacy-persistence-contracts.test.ts
bun test test/test-cases/validation/resume-manifests/resume-additive-provider-contracts.test.ts
bun test test/test-cases/validation/resume-manifests/resume-provider-surface-contracts.test.ts
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
bun test test/test-cases/validation/reports-pricing/media-benchmark-contracts.test.ts
bun test test/test-cases/validation/comic/comic-workspace-path-contracts.test.ts
bun test test/test-cases/validation/comic/comic-workspace-doc-contracts.test.ts
bun test test/test-cases/validation/comic/comic-source-coverage-contracts.test.ts
bun test test/test-cases/validation/comic/character-handling-contracts.test.ts
bun test test/test-cases/validation/comic/comic-voice-reference-artifacts.test.ts
bun test test/test-cases/validation/comic/comic-audio-phase-2-contracts.test.ts
bun test test/test-cases/validation/providers/tts-provider-contracts/openai-grok-groq.test.ts
bun test test/test-cases/validation/providers/tts-provider-contracts/mistral-elevenlabs.test.ts
bun test test/test-cases/validation/providers/tts-provider-contracts/deepgram-minimax.test.ts
bun test test/test-cases/validation/providers/tts-provider-contracts/speechify.test.ts
bun test test/test-cases/validation/providers/tts-provider-contracts/hume-cartesia.test.ts
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors.test.ts
git diff --check
```

Do not run hosted TTS commands, live voice creation, provider smoke tests, or e2e paths with cost or billing association.

Verification evidence for shared hosted dialogue admission is dated 2026-08-14 and uses fake clocks, deterministic retry inputs, local WAV fixtures, and mocked provider adapters only.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — canonical run manifest and dry-run price planning
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — type domain ownership and `~/types` barrel
- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md) — shared provider infrastructure and comic command ownership
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — hosted TTS provider lanes and bounded turn selector
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — TTS model contracts and voice capability boundaries
- Related ADR: [ADR-013](ADR-013-2026-hosted-model-refresh-ledger.md) — TTS catalog refresh history
- Related ADR: [ADR-019](ADR-019-synchronize-comic-panels-with-manifest-backed-audio.md) — downstream panel synchronization and still-image presentation
- Source report: [Comic Character Voice and Multi-Character TTS Options](../reports/comic-character-tts-options-report.md)
- `src/types/tts-workflow/tts-types.ts`
- `src/cli/commands/process-steps/step-4-tts/define-tts-command.ts`
- `src/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/structured-script-parser.ts`
- [ElevenLabs Text-to-Dialogue](https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue)
- [Hume Text to Speech overview](https://dev.hume.ai/docs/text-to-speech-tts/overview)
