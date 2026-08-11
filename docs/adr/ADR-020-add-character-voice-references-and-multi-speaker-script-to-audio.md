# ADR-020: Add Character Voice References and Multi-Speaker Script-to-Audio

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-10
- **Date Updated:** 2026-08-11
- **Verification Status:** Phases 0-4 passed local no-network verification; Phase 3 and Phase 4 provider contracts are covered by `tts-advanced-provider-phase-3.test.ts` and `tts-advanced-provider-phase-4.test.ts`

## Context

AutoShow can synthesize single-voice speech through 12 providers and already has a generic multi-speaker parser, speaker mappings, turn files, local concatenation, and a native Gemini branch. Comic has a better current starting point for dialogue: `structured-script.json` retains stable source-segment IDs, canonical character keys, original speaker labels, normalized spoken text, basic delivery notes, and scene locations, but v3 does not preserve every timing/stage/source-span detail required by this decision. Comic also has a useful reference-asset lifecycle for images: authored character metadata, a registered current reference with checksums and prior-generation identity, and uniquely named copied assets. Its current singleton snapshot index can be overwritten, however, so the append-only voice snapshot design in this decision intentionally strengthens rather than merely copies that precedent.

Those pieces do not yet form a trustworthy multi-character script-to-audio workflow. Comic exposes no command for creating, selecting, auditioning, approving, or snapshotting a character voice, and no command for turning a structured comic script into multi-character audio. The generic TTS speaker registry contains only a speaker string and a provider-agnostic voice string or path. It cannot express provider-specific castings, voice-design or clone state, access restrictions, consent, delivery controls, remote-resource lifecycle, or immutable voice identity.

The repository audit in `docs/reports/comic-character-tts-options-report.md` found that the pre-Phase 0 multi-speaker contract was materially incorrect. `runMultiSpeakerTts` built per-turn overridden options, but ten segmented provider targets captured the original voice during target collection and ignored those runtime overrides. Only Mistral's segmented adapter and Gemini's native adapter honored distinct mapped voices. Final metadata nevertheless recorded requested mappings as if all providers had used them. Existing OpenAI dialogue coverage proved output ordering but never asserted the request voice, and user documentation overstated provider support.

The report identified additional pre-Phase 0 correctness defects and incomplete contracts: Gemini did not enforce its exactly-two-speaker native limit and could split raw speaker-formatted text at unsafe boundaries; hosted turn setup fanned out through an unbounded `Promise.all`; multi-target and native completion could advertise dialogue paths that were never promoted while batch execution silently discarded dialogue artifacts during workspace cleanup; the generic screenplay parser stripped delivery and silently dropped some content; one unqualified speaker map was reused across incompatible provider namespaces; remote clone/reference setup was not provisioned once per character; Speechify resolved consent, locale, and gender data that its request did not fully serialize; provider catalogs and OpenAI custom-voice/model contracts had drifted; manifests and benchmarks could not distinguish multiple voices using one provider/model; and all audio was silently collapsed to mono 16 kHz PCM without a comic mastering contract.

Phase 0 was implemented on 2026-08-11. The generic TTS path now carries immutable explicit per-turn invocations through all 12 adapters; validates actual A/B/A request serialization; uses strict Gemini native planning for exactly two speakers and turn-safe batching; bounds, orders, cancels, and cleans dialogue work; rejects synthesis-time creation defaults before provider setup; protects authorized unnamed Mistral references behind opaque checksum-validated assets; retains strategy-appropriate render artifacts; and persists operation-scoped target identities with strict `ttsAudio` projections and append-only render history. ADR-018 now records the refreshed provider catalogs.

Phase 1 was implemented on 2026-08-11. The protected store now retains content-addressed purpose and retention policies for references, candidate previews, auditions, consent, and reconciliation evidence; validates owner-only roots and disposable workspaces; and keeps protected and ordinary output roots disjoint. Shared strict schemas cover voice briefs, candidates/materialization, consent, append-preserved registrations, a current approval index, canonical auditions, lifecycle state, and crash-safe provisioning journals. The shared `voice` surface and comic-native `comic reference-voice` alias import existing resources, protect consent, plan or execute Mistral saved-reference creation, audition, approve, reconcile, retire, revoke, explicitly delete eligible project-owned resources, and inspect state. Mistral creation is confined to management, and management price paths make no provider calls or artifact writes.

Phase 2 was implemented on 2026-08-11. Comic now writes one canonical `command: 'comic'` scene manifest, structured-script v4 embeds exact source identity and Unicode source spans, and `comic generate-audio` selects only an exact compatible existing scene run. Provider-neutral dialogue plans preserve delivery/effect intent and explicit overlap nodes; all selected targets and roles resolve through one immutable approved aggregate voice snapshot and append-only index. The command performs deterministic static validation and a read-only all-target readiness pass before a shared dispatch barrier, then reuses the Phase 0 branch/render/admission/result/audio-run machinery under the strict `comicAudio` namespace. It supports strict two-speaker Gemini native planning, approved Mistral saved/reference consumption, segmented fallback, operation-scoped resume, explicit 16/24-bit mono/stereo WAV mastering, and targetless local completion for a zero-turn scene. Its price path performs no provider calls or artifact writes.

Phase 3 was implemented on 2026-08-11 after rechecking the official ElevenLabs and Hume documentation. Dated capability fixtures and typed advanced ports now cover catalog discovery, protected candidate design/materialization, clone state, resource inspection/deletion, and Hume continuation validation. ElevenLabs normalizes account/shared catalogs, legacy default expiry, verification state, eligibility-proved remix lineage, Instant/Professional clone outcomes, and bounded turn-safe Text-to-Dialogue with prepared-text alignment. Hume normalizes stock/custom stable IDs, Octave 1 design saved for Octave 2, platform-gated clone state, unique name-to-ID deletion proof, model-constrained direction/timing, one-to-five native utterance takes, word/phoneme timing, and selected-generation continuation. Generic and comic planning select those native strategies only when exact intent is representable, otherwise retaining the existing approved-voice segmented repair path. Execution readiness checks every approved ElevenLabs/Hume resource before the shared dispatch barrier, and management price modes remain zero-call and zero-write.

Phase 4 was implemented on 2026-08-11 after rechecking the official MiniMax, Cartesia, and Speechify documentation. Dated capability fixtures and adapters now cover MiniMax system/account catalogs, temporary Voice Design, protected upload-and-clone activation state, and typed deletion; Cartesia public/account cursor catalogs, protected instant clone, gated Pro Voice Clone state, and lifecycle; and Speechify shared/personal cursor catalogs, protected consent-bearing personal clone, model-aware readiness, word timing, and lifecycle. The fixtures explicitly mark Cartesia and Speechify text-prompt design and all three providers' native multi-speaker dialogue as unsupported, so generic and comic rendering retain the segmented baseline. Readiness now checks every approved resource for all five advanced providers before dispatch. Voice-quality benchmark identity now uses the adapter target plus render and optional registration/snapshot-entry/character identity, with an explicit non-reusable `legacy:` fallback. Generic/comic help, capability tables, output documentation, examples, and Speechify consent/locale/gender serialization were updated. No new provider is proposed because this implementation did not demonstrate a remaining casting or privacy gap.

Provider capabilities are also much richer than the current adapters. ElevenLabs combines a large voice library, Voice Design, remixing, instant and professional cloning, native Text-to-Dialogue, and dialogue timestamps. Hume Octave combines a voice library, Voice Design, cloning/import, per-utterance acting direction, multi-utterance contextual rendering, timestamps, and cross-request continuation. Mistral already supports one-off and saved reference voices; Gemini has native exactly-two-speaker synthesis; MiniMax, xAI, Speechify, and Cartesia expose custom-voice paths; Deepgram has a much larger demographically tagged stock catalog than AutoShow registers. The architecture needs to expose these differences without reducing every provider to one `voice` string or forcing comic to build provider clients of its own.

This decision is constrained by five existing architectural rules:

- ADR-002 reserves one unversioned canonical `manifest.json` for every run root, makes its item/provider state the only persistence authority, and rejects compatibility readers for retired pipeline formats.
- ADR-007 requires comic to adapt domain semantics to shared provider infrastructure instead of maintaining a comic-local model or dispatch stack.
- ADR-008 makes hosted TTS provider lanes and bounded work scheduling the shared concurrency boundary; multi-speaker turn work must join that model instead of adding another unbounded lane.
- ADR-012 requires `resume --price` to remain a no-provider, non-mutating dry run; this ADR applies the same rule to TTS price planning and separately defines static validation versus execution readiness.
- ADR-018 treats a TTS model selector as a complete runtime promise and deliberately leaves voice identity and specialized reference/dialogue capabilities to a separate decision such as this one.

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

### Architectural boundaries

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
| Comic workflow | `CharacterVoiceBrief`, canonical character/role resolution, reference approval, `ComicDialoguePlan`, scene voice snapshot, panel/source synchronization, effect intent, comic output paths | Provider HTTP clients, provider model registries, request retry policy, provider pricing |
| Script-to-audio workflow | Provider voice references and registrations, capability facets, access state, explicit synthesis invocation, provider preflight, render planning, timing normalization, segmented/native execution, audio assembly, cache keys, synthesis metadata | Comic scene drafting, panel semantics, visual character schema |
| Provider adapter | Exact catalog, design, clone, lifecycle, request, response, limit, timing, continuation, and access-state mappings for one provider/model | Cross-provider casting policy, comic source parsing, silent fallback |
| Local artifact layer | Checksums, atomic promotion, versioned domain artifacts, caches, canonical-manifest references, mastering and effects | A second pipeline manifest, an independent resume authority, remote deletion as ordinary cleanup, secrets or raw consent PII in artifacts |

Types remain grouped under the existing `tts-workflow` and `comic-workflow` domains behind the `~/types` barrel in accordance with ADR-003. Shared types may not import comic implementation modules; comic maps its `CharacterKey` and role keys into shared speaker/profile identifiers at the boundary.

### Canonical scene-run and domain artifact contract

Every comic scene run owns exactly one canonical, unversioned `<scene-run>/manifest.json`. This decision extends `PROCESS_COMMANDS` with `comic`; a scene run uses `command: 'comic'`, `scope: 'single'`, and one item whose `input` is the normalized canonical script path. Comic drafting, image generation, and audio generation update that same item through the serialized atomic writer in `pipeline-manifest.ts`. Audio render directories are provider artifact directories inside the scene run, not independent run roots, and never contain another file named `manifest.json`. Existing comic workspaces without a valid canonical comic manifest are a clean-break input and must be rebuilt; this decision adds no retired-file probe, upgrader, or compatibility reader.

The canonical envelope remains the ADR-002 shape and has no `schemaVersion`. New versioned voice and dialogue records are domain artifacts referenced from it. Although ADR-002 reserves direct unversioned `result.json` for provider payloads in workflows that use it, TTS/comic adapters under this decision never persist a raw provider JSON response: they extract/promote audio, discard base64 bodies, and retain only a typed allowlisted evidence projection. The normalized detailed artifact is named `provider-render-result.json`, carries its own domain `schemaVersion`, and is bound to canonical state by a contained relative path and SHA-256 checksum. Bare `manifest.json` and `result.json` remain reserved canonical names; ADR-owned domain artifacts use descriptive names such as `voice-reference-snapshot.json`, `provider-render-plan.json`, `provider-render-result.json`, and `audio-run.json`.

The comic manifest stores the following authority once. The item owns one strict `item.metadata.comic = { schemaVersion: 1, stages, audio }` envelope; comic-audio provider projections remain under `provider.metadata.comicAudio` and `provider.result.comicAudio`. Drafting, image, and audio writers parse and update that same envelope so generic readers can preserve it without confusing it with flat `Step4Metadata`:

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

New generic single/batch TTS serializes the same strict `CanonicalAudioProviderProjection` at `provider.result.ttsAudio` and its sanitized summary at `provider.metadata.ttsAudio`. `operation: 'comic-audio'` requires `comicAudio` and forbids `ttsAudio`; `operation: 'tts-synthesis'` requires `ttsAudio` and forbids `comicAudio`; every other operation forbids both. The operation-specific field name is the only serialization difference: both audio operations use the same parser, history, readiness, active-work, selection, checksum, and status invariants.

`PipelineProviderState` gains optional top-level `operation`, `targetKey`, and `transport` fields; all three are required for every newly written TTS or comic provider state. `operation` names the stage/adapter surface, such as `tts-synthesis`, `comic-structure`, `comic-image`, or `comic-audio`, so a comic image target and audio target cannot collide or overwrite each other's status. The parser derives `operation: 'tts-synthesis'`, `transport: 'legacy-single'`, and an in-memory target key for an existing canonical pre-ADR single-voice TTS entry without rewriting it, but it does not restore any retired run-file reader. Canonical provider target identity is `(item, targetKey)`, where `targetKey = canonicalTargetKey(operation, service, model, transport)`. It identifies the operation-scoped adapter target only and deliberately excludes voice, cast, settings, output profile, and artifact location.

A pre-ADR single-voice entry has no final plan and therefore never receives the new plan-derived identity formula. Its read-only sentinel is `legacy:<sha256(canonical({ schemaVersion: 1, kind: 'pre-adr-single', itemInput, targetKey, service, model, canonicalLegacyOptions, artifactDir, sortedExistingOutputPathChecksumPairs }))>`, where an output lacking a recorded checksum contributes the literal `unverified` sentinel and `canonicalLegacyOptions` is the existing sanitized persisted options object, not newly inferred defaults. This value exists only for stable reporting/history/benchmark grouping. It cannot authorize cache reuse, cross-run resume, or a provider request because it cannot prove a complete voice/settings/output identity; an incomplete legacy entry that would need new synthesis fails with guidance to rebuild it as an explicit transient `ProviderRenderPlan`. No newly written state may use the `legacy:` namespace.

The voice-aware cache and resume identity is `renderIdentity = hash(renderPlanId, targetKey, strategy, voiceContextKey, synthesisSettingsHash, outputProfileHash)`. `voiceContextKey` is `approved:<snapshotId>` for an approved comic snapshot or a hash of the canonically ordered `{ turnId, bindingIdentityHash }` pairs in a transient plan. A different voice, cast, strategy, settings schema/value, or output profile therefore cannot reuse a prior success merely because the service and model match. `artifactDir` is only a containment-checked location and is never an identity.

Manifest helpers join and update new TTS/comic provider entries by `targetKey`, reject duplicate keys, and require exactly one provider state for each requested `(operation, service, model, transport)` target. Each state owns a unique containment-checked target directory such as `audio/providers/<safe-target-key>/`; immutable preliminary branches live below `branches/<branch-plan-id>/` and append-only render records point to distinct `renders/<render-identity>/` children. `artifactDir` is the target container, not a render identity. Existing non-dialogue commands may retain service/model identity until they adopt the new fields. Benchmark and consensus readers use `renderIdentity` and the registration/snapshot-entry/character identities required by their row granularity.

One provider state can accumulate several immutable branch and render identities for the same target without losing canonical reachability. Creating or explicitly reactivating preliminary work appends an `activate-branch` pointer event and sets `activeWork` to that `branchPlanId` with no readiness sequence; first creation also appends its ID/path/checksum to `branchHistory`. Committing the resulting readiness attempt appends `project-branch-readiness` and atomically names its exact sequence, so a previous check of the same content-addressed branch can never become current implicitly. Before successful all-target readiness there is no final render plan and no new render-history entry. A blocked readiness result references `(targetKey, branchPlanId)` and its dated evidence; it cannot claim `renderPlanId`, `renderIdentity`, a resolved current revision, or post-readiness snapshot state. Only after every selected target returns compatible `ready` evidence are all final plans frozen, durably written, atomically appended with their own plan path/checksum to canonical render histories, and activated with `activeWork: { kind: 'render', renderIdentity, eventSequence }` pointing to each new record's initial `missing` event before synthesis admission. Thus a new zero-attempt branch failure remains the active canonical failure even when `selectedSuccess` still preserves an exact older successful event/result/audio run.

`CanonicalAudioProviderProjection.renderHistory` is append-only by `renderIdentity`: a record's plan/voice/settings/output identity fields are immutable, its transition/evidence ledger permits only sequence-checked append operations, and entries/events cannot be removed, reordered, or rewritten. A same identity with different immutable fields or conflicting sequence bytes is corruption. Every admission snapshot, batch-invocation plan, provider batch result, aggregate result, render-takes index, output, take-selection, continuation-checkpoint, audio-run, and cache-evidence reference is containment checked and paired with its checksum; half-present required pairs/triples fail parsing. Every newly written TTS/comic provider projection requires `activeWork`; its absence is permitted only for the derived read-only pre-ADR legacy projection. Activating or reactivating a branch clears `readinessAttemptSequence` and therefore projects `missing` with `attempts: 0`; committing readiness for that active branch atomically appends `project-branch-readiness` and sets the exact sequence. A specified readiness sequence must resolve once to the same branch and projects `failed` for `blocked/self-blocked` or `ready/peer-blocked`; a ready eligible branch exists only transiently before atomic final-plan activation and otherwise projects `missing`. Older or newer readiness entries for the same content-addressed branch do not affect that projection. `activeWork.kind: 'policy-skip'` projects `skipped` with zero attempts only when its content-identified evidence has an allowed reason code, a nonempty sanitized reason, and the exact target key; policy skip is permitted only before any branch/readiness/render history or selected success exists, so it cannot hide failed or billable work. When `activeWork.kind` is `render`, status/error/attempts project from the exact `(renderIdentity, eventSequence)` event, not the record's newest event by implication. Appending a canonical event for active work atomically advances `activeWork.eventSequence` to that event; appending historical or reconciliation evidence without activating it leaves the pointer unchanged. `selectedSuccess` identifies one verified successful event, aggregate result, and audio run even when several attempts/results share a static `renderIdentity`; later active work cannot displace it implicitly. Freezing a materially different final plan appends a new record with a `missing` event and activates it; running, result, and reconciliation commits append evidence events and explicitly advance active work; promoting success is a separate atomic pointer update. A failed active rerender remains visible and keeps the operation incomplete/failed until the user retries, reconciles, or explicitly rolls active work back to the exact `(renderIdentity, eventSequence)` retained by the still-valid selected success; rollback is a local audited pointer change and never deletes failed branch or render history. The selected-success tuple must resolve to a `succeeded` event whose result and audio-run IDs match, and `select-success` and `rollback-active` pointer events must repeat that exact tuple. Every historical branch, readiness result, batch result, and aggregate remains checksum-bound after later work.

`ProviderRenderResult.status` maps to the existing canonical status vocabulary as follows:

| Render condition | Canonical provider status | Attempt and result rule |
|---|---|---|
| Preliminary branch planned and queued/cancelled before execution readiness | `missing` | `attempts: 0`; branch-plan reference only; no final render plan/identity/history entry or detailed result |
| Execution readiness blocked or failed | `failed` | `attempts: 0`; branch-plan/readiness reference, no final `ProviderRenderPlan` or `ProviderRenderResult`; typed `error.phase: 'readiness'` with explicit code/message/retryability; peer targets receive the dependency-failure row below and no synthesis begins |
| This target is ready but a peer target blocks all-target admission | `failed` | `attempts: 0`; preserve this target's `ready` result, set `error.phase: 'readiness'`, `code: 'peer-readiness-failed'`, and `blockedReason: 'dependency-readiness-failed'`; no final plan/history/result and no synthesis call |
| Top-level provider-dispatch render or resume attempt active | `running` | Increment `attempts` once per dispatching attempt; the admitting event must point to the exact fresh `ready` ledger sequence/result/candidate/account-observation hashes and a versioned write-ahead admission-journal snapshot; local-only selection/assembly resume does not increment it, and provider HTTP retries remain separately recorded |
| Local cache materialization or aggregate composition active | `running` | Do not increment provider attempts or create an admission journal; require checksum-bound materialization plan, cache evidence, portable semantic key, and current DAG input, retain the prior attempt count, and forbid provider request observations or spend |
| Native logical batch awaiting generation slots, manual take selection/checkpoint, or a later continuation batch | `running` | Preserve canonical cross-attempt/cache `batchProgress`; no aggregate `ProviderRenderResult` is required yet and no dependent provider request may start before the complete slot set and required selection/checkpoint commit |
| Provider synthesis succeeded but selection or local assembly/audio-run commit is pending | `running` | Preserve the successful cross-attempt aggregate result, batch results, outputs, takes, and journals; perform no further provider call; canonical success and item/stage completion remain impossible until assembly commits |
| Every requested turn succeeded and the selected takes/assembled audio run/final outputs verify | `succeeded` | Detailed result plus the canonical audio-run ID/path/checksum and every verified output checksum are required |
| Local selection/assembly fails after successful provider synthesis | `failed` | Preserve reusable provider work and set `error.phase` to `selection` or `assembly`; retry is local-only unless a separately priced explicit render/repair plan is chosen |
| `ProviderRenderResult.status: 'partial'` | `failed` | Preserve the immutable partial aggregate, set `retryable: false` and `blockedReason: 'explicit-recovery-or-repair-required'`; an authorized new attempt may compose its compatible successful batch prefix into a new aggregate or use explicit hybrid repair, but never extends this result in place |
| `ProviderRenderResult.status: 'failed'` | `failed` | Preserve the detailed result and sanitized error |
| Ambiguous provider outcome or unexpected created resource | `failed` | Preserve the ambiguous result, set `retryable: false` and `blockedReason: 'reconciliation-required'`, and require explicit reconciliation before retry |
| Explicit policy skip | `skipped` | `activeWork.kind: 'policy-skip'`, zero attempts, content-identified allowed-code evidence for the exact target, and empty branch/readiness/render/selection history; unsupported, invalid, unavailable, or post-work targets are validation failures rather than skips |

Generic TTS item status is derived exactly. `full` requires a nonempty `tts-synthesis` provider set, every state `succeeded` or `skipped`, and at least one success. `skipped` requires every requested target to be an explicit policy skip. `failed` requires no success, all targets terminal, and at least one failure. `incomplete` covers any `running` or `missing` state and every mixture of success and failure. A requested TTS item can never be `full` with `providers: []`.

A comic item additionally stores strict `item.metadata.comic.stages` records for `structure`, `image`, and `audio`; `item.metadata.comic.audio` owns the audio-specific IDs/references from the table, and at least one stage must be `required`. `not-requested` is exactly `execution.kind: 'none'`, `targetKeys: []`, no artifacts, and `status: 'skipped'`. A requested local stage has `execution.kind: 'local'`, no target keys, and maps local `succeeded -> full`, explicit-policy `skipped -> skipped`, `failed -> failed`, and `missing|running -> incomplete`; a skipped local state requires a policy reason. A requested provider-backed stage has a nonempty unique `targetKeys` list, each key resolves exactly once to a provider state whose operation matches that stage, and no provider state may be owned by two stages. Its reduction is the generic provider reduction: `full` requires every owned target succeeded or explicitly skipped and at least one success; `skipped` requires every owned target to be an explicit policy skip; `failed` requires no success, all targets terminal, and at least one failure; `incomplete` covers a missing/running target or any success/failure mixture. The strict parser recomputes and verifies the stored stage status. The top-level item then reduces across requested required stages by the same rules: `full` requires every required stage full or explicitly skipped and at least one full stage; `skipped` requires every required stage explicitly skipped; `failed` requires no full stage, all required stages terminal, and at least one failure; everything else is `incomplete`. Optional-stage failure remains visible but does not downgrade an otherwise full item unless the run declared that stage required. `comic generate-audio` therefore cannot overwrite, count, or hide drafting/image status, and image/audio operations using the same provider/model remain separate targets.

Each logical batch contains one or more planned generation slots. One Hume slot can request several generations in one call, while an ElevenLabs Text-to-Dialogue batch uses one single-take slot per deliberately purchased candidate; slots are generation work, never transport retries or duplicate source-turn coverage. Each dispatched slot closes first as one strict immutable `ProviderBatchResult` under its producing attempt. That provider-dispatch variant binds the exact slot-specific invocation plan, strict predecessor admission snapshot, serializer-observed request, batch-relative outputs/takes/timing, outcomes, retries, and cost; it never depends on a future aggregate result. A cache hit instead writes a current-render `CacheMaterializationPlan`, materializes verified bytes into a new current-render batch-result directory, and writes the cache-materialization result variant with zero current requests, attempts, resources, retries, or spend plus checksum-bound plan and source-cache evidence. After provider-result promotion, a descendant snapshot in the same journal append-preservingly adds its slot-qualified `recordedBatchResults` reference; cache materialization needs no admission journal. A canonical event adds each checksum-bound slot result and, only after every required slot for a take-producing logical batch succeeds, one batch-level selection and optional checkpoint to `batchProgress`. A crash or manual-selection pause may therefore resume without repurchasing a verified earlier slot.

`ProviderRenderResult` is the later strict immutable aggregate composition and may span attempts. Its ordered `batchResults` names exactly one compatible terminal result for every selected `(batchId, generationSlotId)`, `closedBy` identifies either the provider attempt that dispatched new work while finalizing the composition or a zero-dispatch local composition over any compatible mix of prior provider-dispatch and current cache-materialization results, and its observed requests, outputs, generated batches, outcomes, retries, and `currentComposition` cost must be the exact duplicate-free projection of those references. A succeeded aggregate covers every planned generation slot exactly once in batch/slot order with a dependency-consistent continuation chain; partial, failed, or ambiguous aggregates may cover only the actually materialized plan-ordered subset and retain explicit `unstarted` outcomes. Independent segmented work may form a noncontiguous subset, but any intra-render continuation chain must be a contiguous dependency prefix, and a consumed-selection rebuild must preserve its compatible prefix plus only results from the authorized invalidated suffix. Wrong plan, wrong render, missing, duplicate, overlapping, stale-suffix, cache-semantic, or continuation-inconsistent results fail composition. `closingAttempt` cost contains only provider spend incurred by the attempt that closed the aggregate and is zero for local composition, while cache materializations contribute zero current spend; `cumulativeRenderHistory` is derived through that closing event from every canonically retained attempt and is never conflated with current-composition or historical source-cache cost.

Aggregate `status: 'succeeded'` means only that provider synthesis completed: the canonical provider remains `running` until every required take selection and local assembly artifact has been committed through one verified `AudioRun`. A crash after aggregate-result promotion but before audio-run commit resumes selection or assembly from preserved outputs with zero provider calls. A local selection or assembly error appends a canonical `failed` event with provider work still reachable and reusable; only an explicit priced render or repair execution may repurchase synthesis. Each canonical `succeeded` transition atomically references the already durable aggregate result, selections, checkpoints, outputs, and one audio-run triple, so no manifest state can expose a full item between synthesis success and assembly authority.

Each provider-dispatch batch result's `admissionBasis` names and checksum-binds the latest valid same-journal snapshot before that result was serialized; the cache-materialization variant forbids an admission basis and instead verifies its source entry before copying bytes. The aggregate result hashes only its verified batch-result set, not a future journal snapshot. After an aggregate closed by a provider attempt is promoted, a descendant snapshot in that closing attempt adds `recordedResult`; its exact identity/path/checksum and `batchResultSetHash` must equal the aggregate composition, and the aggregate-bearing canonical event must reference that descendant snapshot. An aggregate whose final frontier requires zero provider dispatch has `closedBy.kind: 'local-composition'` regardless of whether its verified prefix came from earlier provider attempts, has no new journal or provider attempt, and is promoted directly by a canonical local-running/result event. Its content-derived `compositionId` binds the render plan and complete ordered batch-result references; cache-origin references additionally require complete materialization evidence, while provider-origin references must resolve through their own immutable admission journals. The aggregate never cites a later canonical or journal record, so all recording edges are acyclic. `recordedBatchResults` and `recordedResult` are append-preserving and cannot substitute a second artifact for the same identity, and a later zero-dispatch composition never rewrites an earlier journal's partial or failed `recordedResult`. Canonical provider status and its unversioned projection are the resume authority and may not disagree with these records.

The canonical manifest is initialized before synthesis, updated atomically when a provider-dispatch attempt begins, and updated only after each referenced admission snapshot, slot invocation, provider/cache result, selected take, continuation checkpoint, aggregate result, output, or audio run is durably promoted. Local cache/resume/selection/assembly does not increment provider attempts or create a journal. Every dispatching attempt's admitting `running` event requires a `readinessAuthorization` whose sequence resolves to exactly one fresh `ready` entry for the plan's branch/candidate and exact account-observation subset. Observations attached solely to a blocked alternate cannot invalidate the selected candidate. Events for one attempt retain its authorization; a later resume that dispatches safe unresolved slots performs readiness again, increments the attempt, creates a new invocation/journal for that exact slot set, and binds the new event without changing static render identity.

Provider request admission is a typed write-ahead journal, not one unexplained hash. `journalId = hash(renderPlanId, renderIdentity, attempt, invocationId)`, and each create-only `RenderAdmissionJournalSnapshot.snapshotId` hashes its complete record with only `snapshotId` omitted and links to the preceding snapshot. `plannedGenerationSlots` is the exact plan-ordered set this attempt may dispatch after all currently decidable cache hits: the dependency-valid executable frontier on initial execution, a safe unresolved set on ordinary crash recovery, or a safe unresolved subset inside one consumed-selection rebuild authorization. It never includes a slot whose predecessor selection/checkpoint is not committed, so a manual Hume choice can end one attempt before a later attempt plans the next frontier. `plannedBatchIds` must equal its unique batch IDs in first-occurrence order, and `plannedRequestCount` equals the number of non-retry generation slots, not the number of source-covering logical batches. One Hume slot may request several provider generations in one call; several ElevenLabs slots deliberately authorize several non-retry calls for the same logical dialogue batch. Each request entry repeats both IDs, and a successful provider attempt has exactly one non-retry request/result per planned slot. A failed, partial, or ambiguous attempt may materialize only a plan-ordered subset; continuation-dependent slots remain a prefix, while independent segmented slots may complete out of order but are serialized canonically in plan order. A non-retry request entry is appended just in time because a prior-batch continuation cannot resolve its fingerprint earlier. Before `prepared`, its exact slot-specific batch-invocation-plan ID/path/checksum is durably written and canonically referenced. Any policy-permitted transport retry is appended before dispatch with a new ordinal, the identical batch/slot invocation plan and request fingerprint, and `retryOfRequestOrdinal` matching the batch-result and aggregate retry records; materially changing continuation, slot, or request semantics is a new top-level attempt, never an HTTP retry.

A consumed-selection authorization names the full invalidated logical-batch closure, the ordered `authorizedPotentialDispatchSlots` in that closure, the worst-case additional planned cost after currently decidable cache hits, and retry allowance. Its initial provider journal carries `mode: 'initial'`, the reservation event sequence, and exactly the first currently executable non-cached subset; the same atomic compare-and-swap that verifies the old active event/selection installs the replacement selection/checkpoint, removes stale downstream progress, appends/activates the admitting `running` event, increments the attempt, and references the fresh readiness evidence and initialized journal. There is no authoritative reservation event without either that journal or a zero-dispatch local composition. Each later dependency frontier or crash recovery performs fresh readiness, carries the same authorization/reservation with `mode: 'recovery'`, and plans only the canonically proven safe unresolved subset of `authorizedPotentialDispatchSlots` after newly decidable cache hits. It validates the installed replacement selection and reservation lineage rather than rechecking the superseded pre-reservation event. Completed provider or cache-materialized slots are excluded and reused; an ambiguous slot blocks until reconciliation establishes a reusable result or confirmed non-admission. Across all descendant attempts, each distinct authorized slot contributes planned cost at most once, total planned provider work and retries cannot exceed the separately recorded cost/allowance, observed spend remains separately truthful, and no slot outside the closure may appear. A frontier with no provider misses is local, creates no journal/attempt, writes exact continuation-aware cache-materialization plans for its hits, and advances verified cache/progress until another dependency choice or completion.

Before a network dispatch, AutoShow durably writes and canonically references the `prepared` snapshot, then a `dispatch-started` snapshot; after an acceptance, completion, authoritative provider rejection, ambiguity, or authoritative negative lookup it writes and references the next snapshot before proceeding. After each immutable provider-dispatch batch result is promoted, a descendant snapshot adds its batch/slot-result ID/path/checksum and predecessor admission-basis ID before later work consumes it. The journal snapshot ID/path/checksum fields are all present or all absent and are required on every `running` or later event for a dispatching attempt. Every proof reference and evidence artifact repeats the exact `journalId`, `invocationId`, request ordinal, request fingerprint, and proof kind required by its transition; `provider-accepted` requires `acceptance`, `completed` requires `completion`, `provider-rejected` requires `rejection`, `ambiguous` permits only `ambiguity`, and `confirmed-not-admitted` requires `not-admitted`. A kind mismatch, cross-attempt reuse, or evidence attached to another serialized body is corruption. Ordinary proof is a strict `SanitizedAdmissionEvidence` whose `evidenceHash` hashes its complete allowlisted record with only that field omitted, stored at the attempt-relative identity-independent `admission-evidence/<evidence-hash>.json` path; sensitive proof is a `ProtectedAssetRef` carried by the same typed binding. Neither may contain a raw response or secret, and no proof path may include its journal snapshot ID.

On recovery, a generation slot with no request entry in any prior attempt has never been prepared and may enter a new attempt's exact safe unresolved set only after its dependency progress is revalidated and a new immutable slot-specific batch-invocation plan is committed. `prepared` with no later dispatch transition or an explicit `confirmed-not-admitted` transition is safe no-admission proof for an existing request. An authoritative `provider-rejected` transition is a definite terminal response that proves no synthesis result was accepted for that ordinal; a policy retry is a separately journaled request ordinal, never a relabeling or replay of the rejected one. `dispatch-started` without authoritative confirmation, `provider-accepted`, or `ambiguous` is never safe replay evidence; it enters reconciliation unless a provider idempotency/request lookup produces a later `confirmed-not-admitted` proof. The strict transition graph allows `provider-rejected` only after dispatch and forbids acceptance, completion, ambiguity, or not-admitted transitions after it. It also rejects completion without acceptance, local-before-dispatch proof after dispatch, not-admitted proof after acceptance/completion, duplicate dispatch, ordinal reuse, a dependency-invalid slot order, a journal/invocation-plan batch-or-slot/fingerprint mismatch, and retry links to missing/later requests. Completed accepted work is reused only through its verified provider-dispatch `ProviderBatchResult`; cache work is reused only by materializing a new current semantic result from a verified `SynthesisCacheEntry`. Neither is repurchased or reconstructed from a summary. The latest canonically referenced snapshot and append-only cross-attempt batch progress plus any strictly chained orphan artifact in the exact attempt directory are inspected; invalid/forked chains are reconciliation failures, not guesses. A crash between writing any other domain artifact and committing its canonical reference likewise leaves evidence that reconciliation may inspect but never silently trusts or repurchases. An immutable partial aggregate is never extended in place: a later attempt or local cache composition may close a new aggregate from compatible prior slot results plus newly completed safe work, while an explicit line/range repair still creates the separately priced `hybrid` render identity. Separate generic `checkpoint.json`, provider-checkpoint, run-manifest, or audio-manifest persistence is forbidden. `writeGenerationMetadata` and the batch writer must construct complete provider states directly instead of deriving flat metadata from service/model completion lists; single and batch items must persist the same exact one-state-per-target projection.

### Core voice primitives

The implementation will use discriminated, versioned records rather than provider-specific optional fields on `TtsOptions`. Names below define the contract; final files may split them by type ownership.

```ts
type CapabilityMaturity = 'stable' | 'preview' | 'deprecated' | 'not-applicable'
type CapabilityChannel = 'api' | 'ui-only' | 'external-import' | 'unsupported'
type AdapterSupport = 'implemented' | 'planned' | 'unsupported'
type VoiceCapabilityFeature =
  | 'turn-synthesis'
  | 'native-dialogue'
  | 'native-utterances'
  | 'voice-catalog'
  | 'voice-design'
  | 'voice-remix'
  | 'instant-clone'
  | 'professional-clone'
  | 'voice-import'
  | 'voice-delete'
  | 'acting-description'
  | 'word-timing'
  | 'phoneme-timing'
  | 'continuation'
type ProviderAccessRequirement =
  | { kind: 'plan', tier?: string }
  | { kind: 'approval', approvalKind?: string }
  | { kind: 'verification', verificationKind?: string }
  | { kind: 'region', allowedRegionCodes: string[] }
type AccountCapabilityState =
  | 'available'
  | 'not-configured'
  | 'unavailable'
  | 'external-action-required'
  | 'unknown'

type CapabilityScope = {
  provider: TtsProvider
  feature: VoiceCapabilityFeature
  model?: string
  transport?: string
}

type CapabilityRecord<F extends VoiceCapabilityFeature> = {
  scope: CapabilityScope & { feature: F }
  maturity: CapabilityMaturity
  channel: CapabilityChannel
  adapterSupport: AdapterSupport
  requirements: ProviderAccessRequirement[]
  constraints: CapabilityConstraintsByFeature[F]
  reason?: string
  documentationEvidence: {
    checkedAt: string
    sourceRefs: string[]
    evidenceHash: string
  }
}

type AnyCapabilityRecord = {
  [F in VoiceCapabilityFeature]: CapabilityRecord<F>
}[VoiceCapabilityFeature]

type AccountCapabilityObservation = {
  observationHash: string
  capabilityScopeHash: string
  capabilityFixtureHash: string
  accountScopeHash: string
  state: AccountCapabilityState
  satisfiedRequirements: ProviderAccessRequirement[]
  unmetRequirements: ProviderAccessRequirement[]
  checkedAt: string
  expiresAt?: string
  evidenceRefs: string[]
  reason?: string
}

type ProtectedAssetRef = {
  storeId: string
  assetId: string
  sha256: string
}

type VoiceOrigin =
  | 'provider-stock'
  | 'community-library'
  | 'designed'
  | 'remixed'
  | 'instant-clone'
  | 'professional-clone'
  | 'imported-custom'
  | 'saved-reference'
  | 'request-reference-audio'
  | 'local-model-voice'

type ProviderVoiceRef =
  | {
      kind: 'remote-resource'
      provider: TtsProvider
      resourceId: string
      namespace: 'provider' | 'account'
      accountScopeHash?: string
      origin: Exclude<VoiceOrigin, 'community-library' | 'request-reference-audio' | 'local-model-voice'>
      ownership: 'provider' | 'third-party' | 'account' | 'project'
      derivedFrom?: ProviderVoiceLineage
      expiresAt?: string
      deletion: VoiceDeletionEligibility
    }
  | {
      kind: 'shared-library-resource'
      provider: TtsProvider
      publicOwnerId: string
      sharedVoiceId: string
      origin: 'community-library'
      usageEligibilitySnapshotHash: string
    }
  | {
      kind: 'reference-asset'
      provider: TtsProvider
      protectedAsset: ProtectedAssetRef
      origin: 'request-reference-audio'
      authorizationRef: string
    }
  | {
      kind: 'local-model-voice'
      provider: TtsProvider
      model: string
      voiceLocator: string
      origin: 'local-model-voice'
    }

type ProviderVoiceLineage = {
  sourceRef: string
  sourceIdentityHash: string
  operation: 'imported' | 'designed-from' | 'remixed-from' | 'cloned-from'
  localAttemptId: string
  providerOperationId?: string
  eligibilitySnapshotHash?: string
}

type VoiceDeletionEligibility =
  | { state: 'unknown' | 'not-owned' | 'provider-managed' | 'notice-active' | 'external-only', reason?: string, checkedAt: string }
  | { state: 'eligible', checkedAt: string, eligibilityExpiresAt?: string }
  | { state: 'deletion-pending', requestedAt: string, effectiveAt?: string }

type VoiceProvisioningState =
  | { state: 'ready', providerVoice: ProviderVoiceRef }
  | { state: 'pending', operationId: string, providerVoice?: ProviderVoiceRef }
  | { state: 'verification-required', operationId?: string, action: string, providerVoice?: ProviderVoiceRef }
  | { state: 'approval-required', operationId?: string, action: string, providerVoice?: ProviderVoiceRef }
  | { state: 'external-action-required', action: string, providerVoice?: ProviderVoiceRef }
  | { state: 'reconciliation-required', attemptId: string, providerVoice?: ProviderVoiceRef, reason: string }
  | { state: 'missing', providerVoice: ProviderVoiceRef, reason: string }
  | { state: 'expired', providerVoice: ProviderVoiceRef }
  | { state: 'deleted', providerVoice: ProviderVoiceRef, deletedAt: string }
  | { state: 'failed', code: string, message: string, providerVoice?: ProviderVoiceRef }

type VoiceProvisioningAttempt = {
  schemaVersion: 1
  attemptId: string
  registrationDraftId: string
  operation: 'design' | 'remix' | 'clone' | 'import' | 'save-reference'
  accountScopeHash: string
  lockLeaseId: string
  requestFingerprint: string
  protectedRequestEvidence: ProtectedAssetRef
  idempotencyKey?: string
  reconciliation?: {
    strategy: 'provider-operation' | 'idempotency-lookup' | 'provider-search' | 'manual-inspection'
    providerHandle?: string
    protectedLookupEvidence: ProtectedAssetRef
  }
  transitions: Array<{
    sequence: number
    phase: 'prepared' | 'request-sent' | 'response-received' | 'ambiguous' | 'reconciled' | 'terminal'
    at: string
    evidenceHash?: string
  }>
  issuedResources: Array<{
    providerVoice: ProviderVoiceRef
    observedAt: string
    sanitizedResponseHash: string
  }>
  outcome?: VoiceProvisioningState
  compareAndSwapVersion: number
}

type AuditActorRef = {
  namespace: 'local-user' | 'project-role' | 'automation'
  actorId: string
}

type VoiceRegistrationBase = {
  schemaVersion: 1
  registrationId: string
  generationId: string
  priorGenerationId?: string
  subjectKey: string
  profileKey: string
  provider: TtsProvider
  providerModel: string
  creationModel?: string
  briefHash: string
  provenanceRef: string
  consentRecordRef?: string
  settingsSchema: string
  synthesisSettings: TypedProviderSynthesisSettings
  capabilityFixtureHash: string
  accountCapabilityObservationHash?: string
  sanitizedProviderMetadata: SanitizedProviderVoiceMetadata
  retention: VoiceRetentionPolicy
  cleanupState: VoiceCleanupState
  createdAt: string
  updatedAt: string
}

type VoiceRegistration =
  | VoiceRegistrationBase & {
      approval: { state: 'approved', auditionId: string, approvedAt: string, approvedBy: AuditActorRef }
      provisioning: { state: 'ready', providerVoice: ProviderVoiceRef }
      approvedAuditionId: string
    }
  | VoiceRegistrationBase & {
      approval:
        | { state: 'draft' }
        | { state: 'auditioned', auditionId: string }
        | { state: 'retired', priorAuditionId?: string, retiredAt: string }
        | { state: 'revoked', priorAuditionId?: string, revokedAt: string, reason: string }
      provisioning: VoiceProvisioningState
      approvedAuditionId?: string
    }

type CurrentVoiceRegistrationIndex = {
  schemaVersion: 1
  selections: Array<{
    subjectKey: string
    provider: TtsProvider
    profileKey: string
    registrationId: string
    generationId: string
    updatedAt: string
  }>
}

type ApprovedVoiceSnapshotEntry = {
  entryId: string
  registrationId: string
  generationId: string
  subjectKey: string
  profileKey: string
  providerVoice: ProviderVoiceRef
  providerModel: string
  creationModel?: string
  settingsSchema: string
  synthesisSettings: TypedProviderSynthesisSettings
  sanitizedProviderMetadata: SanitizedProviderVoiceMetadata
  briefHash: string
  auditionManifestHash: string
  approvedAudition: ProtectedAssetRef
  referenceAsset?: ProtectedAssetRef
  provenanceRef: string
  consentRecordRef?: string
  capabilityFixtureHash: string
  registrationStateAtSnapshot: 'approved-ready'
  providerRevision?: string
  externallyMutable: boolean
  registrationApprovedAt: string
}

type VoiceReferenceManifest = {
  schemaVersion: 1
  snapshotId: string
  sceneRunIdentity: string
  dialoguePlanId: string
  catalogHash: string
  briefSetHash: string
  createdAt: string
  entries: ApprovedVoiceSnapshotEntry[]
}

type ResolvedVoiceBinding =
  | { kind: 'approved-snapshot', snapshotId: string, entryId: string, entryHash: string, entry: ApprovedVoiceSnapshotEntry }
  | {
      kind: 'transient-provider-voice'
      providerVoice: ProviderVoiceRef
      providerModel: string
      identityHash: string
      settingsSchema: string
      synthesisSettings: TypedProviderSynthesisSettings
      capabilityFixtureHash: string
    }

type ComicSourceIdentity = {
  schemaVersion: 1
  canonicalPath: string
  scriptSlug: string
  contentSha256: string
  identityHash: string
}

type StructuredScriptArtifactRef = {
  path: 'metadata/structured-script.json'
  artifactSchemaVersion: 4
  sha256: string
}

type GenericTtsSourceIdentity = {
  schemaVersion: 1
  sourceKind: 'inline' | 'file' | 'batch-item'
  sourceLocator:
    | { kind: 'inline', label: 'inline' }
    | { kind: 'file', canonicalPath: string }
    | { kind: 'batch-item', canonicalBatchPath: string, itemIndex: number }
  contentSha256: string
  identityHash: string
}

type ComicStageRecord =
  | {
      requirement: 'not-requested'
      status: 'skipped'
      execution: { kind: 'none', reason: 'not-requested' }
      targetKeys: []
      artifactRefs: []
    }
  | {
      requirement: 'required' | 'optional'
      status: PipelineItemStatus
      execution: { kind: 'local', state: PipelineProviderStatus, policyReason?: string }
      targetKeys: []
      artifactRefs: Array<{ path: string, sha256: string }>
    }
  | {
      requirement: 'required' | 'optional'
      status: PipelineItemStatus
      execution: { kind: 'provider-targets' }
      targetKeys: [string, ...string[]]
      artifactRefs: Array<{ path: string, sha256: string }>
    }

type CanonicalComicItemMetadata = {
  schemaVersion: 1
  stages: {
    structure: ComicStageRecord
    image: ComicStageRecord
    audio: ComicStageRecord
  }
  audio: {
    sceneRunIdentity?: string
    structuredScript?: StructuredScriptArtifactRef
    dialoguePlanId?: string
    snapshotId?: string
    selectedAudioRuns?: Array<{
      targetKey: string
      renderIdentity: string
      audioRunId: string
      audioRunRef: string
      audioRunSha256: string
    }>
    publishedAudioRunId?: string
    mixPlanRef?: { path: string, sha256: string }
    finalTimelineRef?: { path: string, sha256: string }
    finalOutputRefs?: Array<{ path: string, sha256: string }>
  }
}

type CanonicalDialogueTurn = {
  turnId: string
  sourceSegmentId: string
  beatIndex?: number
  subjectKey: string
  originalSpeakerLabel: string
  canonicalText: string
  delivery?: DeliveryPlan
  effect?: VoiceEffectPlan
}

type CanonicalDialoguePlanNode =
  | { kind: 'turn', turn: CanonicalDialogueTurn }
  | { kind: 'overlap', groupId: string, turns: CanonicalDialogueTurn[] }

type ComicDialoguePlan = {
  schemaVersion: 1
  dialoguePlanId: string
  sceneRunIdentity: string
  sourceIdentity: ComicSourceIdentity
  structuredScript: StructuredScriptArtifactRef
  createdAt: string
  nodes: CanonicalDialoguePlanNode[]
}

type GenericTtsDialoguePlan = {
  schemaVersion: 1
  dialoguePlanId: string
  sourceIdentity: GenericTtsSourceIdentity
  normalizationVersion: string
  createdAt: string
  nodes: CanonicalDialoguePlanNode[]
}

type ProviderResolvedDialogueTurn = CanonicalDialogueTurn & {
  providerText: PreparedProviderText
  voice: ResolvedVoiceBinding
  providerControls: TypedProviderSynthesisSettings
  providerDelivery?: TypedProviderDeliverySettings
}

type ProviderRenderBranchCandidateBase = {
  candidateId: string
  requiredCapabilityScopeHashes: string[]
  batchSketches: Array<{
    orderedTurnIds: string[]
    requestControlsHash: string
    generationSlots: Array<{ slotIndex: number, requestedTakeCount: number, plannedCost: PlannedCost }>
    takeSelectionPolicy: 'sole-take' | 'manual' | 'first-generated'
    continuationPlanHash: string
  }>
  requestedOutputHash: string
  plannedCost: PlannedCost
}

type ProviderRenderBranchCandidate =
  | ProviderRenderBranchCandidateBase & {
      strategy: 'native-dialogue' | 'native-utterances' | 'segmented'
      repair?: never
    }
  | ProviderRenderBranchCandidateBase & {
      strategy: 'hybrid'
      repair: HybridRepairDependencies
    }

type ProviderRenderBranchPlan = {
  schemaVersion: 1
  branchPlanId: string
  operation: 'tts-synthesis' | 'comic-audio'
  dialoguePlanId: string
  sourceIdentityHash: string
  targetKey: string
  voiceContextKey: string
  voiceContext:
    | { kind: 'approved-snapshot', snapshotId: string }
    | { kind: 'transient', bindingIdentityHashes: string[] }
  provider: TtsProvider
  model: string
  transport: string
  modePreference: 'auto' | 'native' | 'segmented' | 'repair'
  candidateStrategies: ProviderRenderBranchCandidate[]
  synthesisSettingsHash: string
  outputProfileHash: string
  capabilityFixtureHash: string
}

type IncomingContinuationBinding = {
  checkpointId: string
  checkpointRef: string
  checkpointSha256: string
  sourceRenderIdentity: string
  sourceResultIdentity: string
  sourceAudioRunId: string
  predecessorBatchId: string
  selectedTakeId: string
  provider: TtsProvider
  model: string
  providerVersion: string
  continuationStateHash: string
}

type ProviderBatchContinuationPlan =
  | { kind: 'none' }
  | { kind: 'external-checkpoint', binding: IncomingContinuationBinding }
  | { kind: 'prior-batch-selection', predecessorBatchId: string }

type ProviderGenerationSlotPlan = {
  generationSlotId: string
  slotIndex: number
  requestedTakeCount: number
  plannedCost: PlannedCost
}

type ProviderBatchPlan = {
  batchId: string
  orderedTurnIds: string[]
  requestControls: TypedProviderRequestSettings
  generationSlots: ProviderGenerationSlotPlan[]
  takeSelectionPolicy: 'sole-take' | 'manual' | 'first-generated'
  continuation: ProviderBatchContinuationPlan
  plannedCost: PlannedCost
}

type ProviderRenderPlanBase = {
  schemaVersion: 1
  branchPlanId: string
  branchCandidateId: string
  renderPlanId: string
  renderIdentity: string
  operation: 'tts-synthesis' | 'comic-audio'
  dialoguePlanId: string
  sourceIdentityHash: string
  targetKey: string
  voiceContextKey: string
  provider: TtsProvider
  model: string
  transport: string
  synthesisSettingsHash: string
  outputProfileHash: string
  capabilityFixtureHash: string
  requiredCapabilityScopeHashes: string[]
  accountScopeHash?: string
  resolvedVoiceRevisionHashes: string[]
  requestedOutput: RequestedAudioFormat
  batches: ProviderBatchPlan[]
  plannedCost: PlannedCost
  nodes: Array<
    | { kind: 'turn', turn: ProviderResolvedDialogueTurn }
    | { kind: 'overlap', groupId: string, turns: ProviderResolvedDialogueTurn[] }
  >
}

type ProviderRenderVoiceContext =
  | { kind: 'approved-snapshot', snapshotId: string }
  | { kind: 'transient', bindingIdentityHashes: string[] }

type HybridRepairDependencies = {
  schemaVersion: 1
  baseTargetKey: string
  baseSourceIdentityHash: string
  baseDialoguePlanId: string
  baseRenderIdentity: string
  baseRenderPlanId: string
  baseResultIdentity: string
  baseResultRef: string
  baseResultSha256: string
  reusedOutputs: Array<{
    baseBatchResultId: string
    outputId: string
    artifactRef: ProviderBatchResultRelativeArtifactPath
    sha256: string
    sourceTurnIds: string[]
    coveredCanonicalRanges: Array<{
      turnId: string
      start: number
      end: number
      indexUnit: 'unicode-scalar-value'
      canonicalTextSliceHash: string
      preparedProviderTextSliceHash: string
      bindingIdentityHash: string
      providerVoiceRevisionHash?: string
      providerControlsHash: string
      providerDeliveryHash?: string
      requestedOutputHash: string
    }>
  }>
  resubmittedTurnIds: string[]
}

type ProviderRenderPlan =
  | ProviderRenderPlanBase & {
      strategy: 'native-dialogue' | 'native-utterances' | 'segmented'
      voiceContext: ProviderRenderVoiceContext
      repair?: never
    }
  | ProviderRenderPlanBase & {
      strategy: 'hybrid'
      voiceContext: ProviderRenderVoiceContext
      repair: HybridRepairDependencies
    }

type ResolvedContinuationInput =
  | { kind: 'none' }
  | {
      kind: 'checkpoint'
      source: 'external' | 'prior-batch'
      checkpointId: string
      checkpointRef: string
      checkpointSha256: string
      predecessorBatchId: string
      batchResultId: string
      selectionId: string
      selectedTakeId: string
      provider: TtsProvider
      model: string
      providerVersion: string
      continuationState:
        | { kind: 'provider-generation-id', value: string }
        | { kind: 'protected-token', asset: ProtectedAssetRef }
    }

type ProviderBatchInvocationPlan = {
  schemaVersion: 1
  batchInvocationPlanId: string
  renderPlanId: string
  renderIdentity: string
  invocationId: string
  attempt: number
  batchId: string
  generationSlotId: string
  resolvedContinuation: ResolvedContinuationInput
  requestFingerprint: string
  createdAt: string
}

type ExplicitVoiceSynthesisRequest = {
  schemaVersion: 1
  invocationId: string
  renderPlanId: string
  batchId: string
  generationSlotId: string
  requestedTakeCount: number
  batchInvocationPlan: ProviderBatchInvocationPlan
  provider: TtsProvider
  model: string
  transport: string
  turns: Array<{
    turnId: string
    text: PreparedProviderText
    voice: ResolvedVoiceBinding
    controls: TypedProviderSynthesisSettings
    delivery?: TypedProviderDeliverySettings
  }>
  requestControls: TypedProviderRequestSettings
  continuation: ResolvedContinuationInput
  output: RequestedAudioFormat
  cancellation: AbortSignal
}

type ProviderBatchSynthesisResponse = {
  batchId: string
  generationSlotId: string
  batchInvocationPlanId: string
  status: 'succeeded' | 'partial' | 'failed' | 'ambiguous'
  observedRequests: ObservedProviderRequest[]
  outputs: EphemeralProviderAudioOutput[]
  takeCandidates: EphemeralProviderTake[]
  turnOutcomes: ProviderBatchTurnOutcome[]
  cost: PlannedAndObservedCost
  error?: SanitizedProviderError
}

type ObservedProviderRequest = {
  requestOrdinal: number
  invocationId: string
  batchId: string
  generationSlotId: string
  batchInvocationPlanId: string
  provider: TtsProvider
  model: string
  transport: string
  endpointKind: string
  serializerVersion: string
  requestBodyHash: string
  actualRequestControlsHash: string
  actualContinuationHash: string
  turns: Array<{
    turnId: string
    providerTextHash: string
    voiceField: string
    actualSerializedVoice: SanitizedSerializedVoiceIdentity
    actualSerializedControlsHash: string
    actualSerializedDeliveryHash?: string
  }>
  providerRequestId?: string
  acceptedAt?: string
}

type RenderRelativeArtifactPath = string
type AttemptRelativeArtifactPath = string
type ProviderBatchResultRelativeArtifactPath = string

type ProviderBatchResultRef = {
  batchId: string
  generationSlotId: string
  batchResultId: string
  artifactRef: RenderRelativeArtifactPath
  sha256: string
}

type SynthesisCacheObjectRef = {
  cacheNamespace: string
  cacheKey: string
  objectId: string
  role: 'cache-entry' | 'provenance-attestation' | 'source-batch-result' | 'audio' | 'timing-evidence'
  sha256: string
}

type ProviderContinuationSemanticFingerprint =
  | { schemaVersion: 1, kind: 'none', fingerprintHash: string }
  | {
      schemaVersion: 1
      kind: 'checkpoint'
      fingerprintHash: string
      provider: TtsProvider
      model: string
      providerVersion: string
      accountScopeHash?: string
      continuationStateHash: string
      selectedTakeSemanticHash: string
    }

type CacheSourceProvenanceAttestation = {
  schemaVersion: 1
  attestationId: string
  sourceCanonicalCommitment: {
    targetKey: string
    renderPlanId: string
    renderIdentity: string
    eventSequence: number
    eventRecordHash: string
    batchResultId: string
    batchResultSha256: string
  }
  sourceInvocation: {
    batchInvocationPlanId: string
    batchInvocationPlanSha256: string
    batchId: string
    generationSlotId: string
    requestFingerprint: string
    continuationFingerprint: ProviderContinuationSemanticFingerprint
    continuationDag:
      | { kind: 'none' }
      | {
          kind: 'checkpoint'
          predecessorBatchId: string
          predecessorBatchResultId: string
          predecessorBatchResultSha256: string
          selectionId: string
          selectionSha256: string
          checkpointId: string
          checkpointSha256: string
          selectedTakeId: string
          selectedTakeAudioSha256: string
          selectedTakeTimingSha256?: string
          providerGenerationIdentityHash: string
          selectedTakeSemanticHash: string
          continuationStateHash: string
        }
  }
  sourceAdmission: {
    journalId: string
    terminalSnapshotId: string
    terminalSnapshotSha256: string
    requestChainProjectionHash: string
    completedRequestOrdinals: number[]
  }
  observedRequestHashes: string[]
  outputChecksums: string[]
  timingEvidenceChecksums: string[]
  capturedAt: string
}

type CacheMaterializationPlan = {
  schemaVersion: 1
  cacheMaterializationPlanId: string
  renderPlanId: string
  renderIdentity: string
  batchId: string
  generationSlotId: string
  resolvedContinuation: ResolvedContinuationInput
  continuationFingerprint: ProviderContinuationSemanticFingerprint
  portableSemanticInputHash: string
  currentExecutionInputHash: string
  cacheEntry: SynthesisCacheObjectRef
}

type CurrentCacheProvenanceCopy = {
  schemaVersion: 1
  source: SynthesisCacheObjectRef
  artifactRef: ProviderBatchResultRelativeArtifactPath
  sha256: string
}

type CacheMaterializationEvidence = {
  materializationPlan: {
    cacheMaterializationPlanId: string
    artifactRef: RenderRelativeArtifactPath
    sha256: string
  }
  sourceBatchResultId: string
  cacheEntry: CurrentCacheProvenanceCopy
  sourceBatchResult: CurrentCacheProvenanceCopy
  sourceProvenanceAttestation: CurrentCacheProvenanceCopy
  materializedObjects: Array<{
    source: SynthesisCacheObjectRef
    artifactRef: ProviderBatchResultRelativeArtifactPath
    sha256: string
  }>
}

type ProviderBatchOutput = {
  outputId: string
  artifactRef: ProviderBatchResultRelativeArtifactPath
  sha256: string
  format: ObservedAudioFormat
  durationMs?: number
}

type ProviderBatchOutputRef = ProviderBatchOutput & { batchResultId: string }

type ProviderBatchResultBase = {
  schemaVersion: 1
  batchResultId: string
  renderPlanId: string
  renderIdentity: string
  batchId: string
  generationSlotId: string
  status: 'succeeded' | 'partial' | 'failed' | 'ambiguous'
  requestedTurnIds: string[]
  outputs: ProviderBatchOutput[]
  generatedBatch?: GeneratedProviderBatch
  turnOutcomes: ProviderBatchTurnOutcome[]
  createdResources: ProviderVoiceRef[]
  cost: PlannedAndObservedCost
  error?: SanitizedProviderError
}

type ProviderBatchResult = ProviderBatchResultBase & (
  | {
      provenance: 'provider-dispatch'
      invocationId: string
      attempt: number
      batchInvocationPlan: { batchInvocationPlanId: string, artifactRef: AttemptRelativeArtifactPath, sha256: string }
      admissionBasis: { journalId: string, snapshotId: string, artifactRef: AttemptRelativeArtifactPath, sha256: string }
      observedRequests: ObservedProviderRequest[]
      retryAttempts: ProviderRetryRecord[]
      cacheMaterialization?: never
    }
  | {
      provenance: 'cache-materialization'
      status: 'succeeded'
      invocationId?: never
      attempt?: never
      batchInvocationPlan?: never
      admissionBasis?: never
      observedRequests: []
      retryAttempts: []
      createdResources: []
      cacheMaterialization: CacheMaterializationEvidence
      error?: never
    }
)

type ProviderRenderCostSummary = {
  currentComposition: PlannedAndObservedCost
  closingAttempt: PlannedAndObservedCost
  cumulativeRenderHistory: PlannedAndObservedCost
}

type ProviderRenderResult = {
  schemaVersion: 1
  resultIdentity: string
  closedBy:
    | { kind: 'provider-attempt', invocationId: string, attempt: number }
    | { kind: 'local-composition', compositionId: string }
  renderPlanId: string
  renderIdentity: string
  status: 'succeeded' | 'partial' | 'failed' | 'ambiguous'
  requestedTurnIds: string[]
  batchResults: ProviderBatchResultRef[]
  observedRequests: ObservedProviderRequest[]
  outputs: ProviderBatchOutputRef[]
  generatedBatches: GeneratedProviderBatch[]
  renderTakesArtifact?: { renderTakesId: string, artifactRef: RenderRelativeArtifactPath, sha256: string }
  turnOutcomes: Array<{
    turnId: string
    status: 'succeeded' | 'failed' | 'ambiguous' | 'unstarted'
    observedRequests: Array<{ invocationId: string, requestOrdinal: number }>
    batchIds: string[]
    generationSlotIds: string[]
    outputIds: string[]
    error?: SanitizedProviderError
  }>
  createdResources: ProviderVoiceRef[]
  retryAttempts: ProviderRetryRecord[]
  cost: ProviderRenderCostSummary
  error?: SanitizedProviderError
}

type AdmissionProofKind = 'acceptance' | 'completion' | 'rejection' | 'ambiguity' | 'not-admitted'

type AdmissionProofBinding<Kind extends AdmissionProofKind> = {
  journalId: string
  invocationId: string
  requestOrdinal: number
  requestFingerprint: string
  proofKind: Kind
}

type AdmissionProofRef<Kind extends AdmissionProofKind> = AdmissionProofBinding<Kind> & (
  | { kind: 'sanitized-artifact', path: string, sha256: string }
  | { kind: 'protected-asset', asset: ProtectedAssetRef }
)

type SanitizedAdmissionEvidence<Kind extends AdmissionProofKind = AdmissionProofKind> = {
  schemaVersion: 1
  evidenceHash: string
  journalId: string
  invocationId: string
  provider: TtsProvider
  requestOrdinal: number
  requestFingerprint: string
  evidenceKind: Kind
  observedAt: string
  fields: SanitizedAdmissionEvidenceFields
}

type ProviderRequestAdmissionTransition =
  | { sequence: number, state: 'prepared', at: string, requestBodyHash: string }
  | { sequence: number, state: 'dispatch-started', at: string, transportEvidenceHash: string }
  | { sequence: number, state: 'provider-accepted', at: string, providerRequestId?: string, evidence: AdmissionProofRef<'acceptance'> }
  | { sequence: number, state: 'completed', at: string, evidence: AdmissionProofRef<'completion'> }
  | { sequence: number, state: 'provider-rejected', at: string, evidence: AdmissionProofRef<'rejection'> }
  | { sequence: number, state: 'ambiguous', at: string, evidence?: AdmissionProofRef<'ambiguity'> }
  | { sequence: number, state: 'confirmed-not-admitted', at: string, method: 'local-before-dispatch' | 'provider-idempotency-query' | 'provider-request-lookup', evidence: AdmissionProofRef<'not-admitted'> }

type ConsumedSelectionRebuildAuthorization = {
  schemaVersion: 1
  authorizationId: string
  renderPlanId: string
  renderIdentity: string
  baseResultIdentity: string
  expectedActiveEventSequence: number
  expectedSelectedBatchResultId: string
  replacementSelectedBatchResultId: string
  batchResultSetHash: string
  expectedSelectionId: string
  replacementSelectionId: string
  invalidatedBatchIds: string[]
  authorizedPotentialDispatchSlots: Array<{ batchId: string, generationSlotId: string }>
  additionalPlannedCost: PlannedCost
  retryAllowance: PlannedCost
  authorizedBy: AuditActorRef
  authorizedAt: string
}

type ConsumedSelectionRebuildJournalBinding = {
  authorizationId: string
  artifactRef: RenderRelativeArtifactPath
  sha256: string
  reservationEventSequence: number
  mode: 'initial' | 'recovery'
}

type RenderAdmissionJournalSnapshot = {
  schemaVersion: 1
  journalId: string
  snapshotId: string
  previousSnapshotId?: string
  renderPlanId: string
  renderIdentity: string
  invocationId: string
  attempt: number
  plannedRequestCount: number
  plannedBatchIds: string[]
  plannedGenerationSlots: Array<{ batchId: string, generationSlotId: string }>
  consumedSelectionRebuild?: ConsumedSelectionRebuildJournalBinding
  requests: Array<{
    requestOrdinal: number
    batchId: string
    generationSlotId: string
    batchInvocationPlanId: string
    batchInvocationPlanRef: AttemptRelativeArtifactPath
    batchInvocationPlanSha256: string
    requestFingerprint: string
    retryOfRequestOrdinal?: number
    transitions: ProviderRequestAdmissionTransition[]
  }>
  recordedBatchResults: Array<{
    batchId: string
    generationSlotId: string
    batchResultId: string
    batchResultRef: AttemptRelativeArtifactPath
    batchResultSha256: string
    admissionBasisSnapshotId: string
  }>
  recordedResult?: {
    resultIdentity: string
    resultRef: AttemptRelativeArtifactPath
    resultSha256: string
    batchResultSetHash: string
  }
  capturedAt: string
}

type CanonicalBatchProgress = {
  batchId: string
  generationSlots: Array<
    | {
        generationSlotId: string
        source: 'provider-dispatch'
        batchInvocationPlan: { batchInvocationPlanId: string, path: RenderRelativeArtifactPath, sha256: string }
        batchResult?: { batchResultId: string, path: RenderRelativeArtifactPath, sha256: string, status: 'succeeded' | 'partial' | 'failed' | 'ambiguous' }
      }
    | {
        generationSlotId: string
        source: 'cache-materialization'
        materializationPlan: { cacheMaterializationPlanId: string, path: RenderRelativeArtifactPath, sha256: string }
        batchResult: { batchResultId: string, path: RenderRelativeArtifactPath, sha256: string, status: 'succeeded' }
      }
  >
  currentTakeSelection?: { selectionId: string, path: string, sha256: string }
  continuationCheckpoint?: { checkpointId: string, path: string, sha256: string }
}

type CanonicalRenderEvent = {
  sequence: number
  status: PipelineProviderStatus
  at: string
  attempt: number
  readinessAuthorization?: {
    readinessAttemptSequence: number
    branchPlanId: string
    branchCandidateId: string
    readinessResultRef: string
    readinessResultHash: string
    accountObservationHashes: string[]
  }
  admissionJournalSnapshotId?: string
  admissionJournalRef?: string
  admissionJournalSha256?: string
  providerRenderResultIdentity?: string
  providerRenderResultRef?: string
  providerRenderResultSha256?: string
  batchProgress?: CanonicalBatchProgress[]
  outputRefs?: Array<{ path: string, sha256: string }>
  takeSelections?: Array<{ selectionId: string, path: string, sha256: string }>
  continuationCheckpoints?: Array<{ checkpointId: string, path: string, sha256: string }>
  cacheEvidenceRefs?: Array<{ path: string, sha256: string }>
  consumedSelectionRebuild?: { authorizationId: string, path: string, sha256: string, reservationEventSequence: number, mode: 'initial' | 'recovery' }
  audioRunId?: string
  audioRunRef?: string
  audioRunSha256?: string
  error?: SanitizedProviderError
}

type CanonicalRenderRecord = {
  renderIdentity: string
  renderPlanId: string
  renderPlanRef: string
  renderPlanSha256: string
  voiceContextKey: string
  synthesisSettingsHash: string
  outputProfileHash: string
  renderDir: string
  events: CanonicalRenderEvent[]
}

type CanonicalReadinessAttemptBase = {
  sequence: number
  branchPlanId: string
  readinessResultRef: string
  readinessResultHash: string
  accountObservationHashes: string[]
  at: string
}

type CanonicalReadinessAttempt = CanonicalReadinessAttemptBase & (
  | { status: 'ready', admissionDisposition: 'eligible', error?: never }
  | { status: 'ready', admissionDisposition: 'peer-blocked', error: SanitizedProviderError }
  | { status: 'blocked', admissionDisposition: 'self-blocked', error: SanitizedProviderError }
)

type ProviderPolicySkipEvidence = {
  schemaVersion: 1
  skipId: string
  targetKey: string
  reasonCode: 'user-requested' | 'project-policy' | 'rights-policy'
  reason: string
  actor: AuditActorRef
  at: string
}

type CanonicalAudioProviderProjection = {
  activeWork?:
    | { kind: 'branch', branchPlanId: string, readinessAttemptSequence?: number }
    | { kind: 'render', renderIdentity: string, eventSequence: number }
    | { kind: 'policy-skip', evidence: ProviderPolicySkipEvidence }
  selectedSuccess?: {
    renderIdentity: string
    eventSequence: number
    resultIdentity: string
    audioRunId: string
  }
  branchHistory: Array<{
    sequence: number
    branchPlanId: string
    branchPlanRef: string
    branchPlanSha256: string
    createdAt: string
  }>
  readinessAttempts: CanonicalReadinessAttempt[]
  renderHistory: CanonicalRenderRecord[]
  pointerEvents: Array<
    | { sequence: number, action: 'activate-branch', branchPlanId: string, actor: AuditActorRef, at: string }
    | { sequence: number, action: 'project-branch-readiness', branchPlanId: string, readinessAttemptSequence: number, actor: AuditActorRef, at: string }
    | { sequence: number, action: 'activate-render', renderIdentity: string, eventSequence: number, actor: AuditActorRef, at: string }
    | { sequence: number, action: 'rollback-active', renderIdentity: string, eventSequence: number, resultIdentity: string, audioRunId: string, actor: AuditActorRef, at: string }
    | { sequence: number, action: 'select-success', renderIdentity: string, eventSequence: number, resultIdentity: string, audioRunId: string, actor: AuditActorRef, at: string }
    | { sequence: number, action: 'activate-policy-skip', skipId: string, actor: AuditActorRef, at: string }
  >
}
```

`CanonicalRenderEvent.batchProgress` is the plan-ordered current composition subset and may reference immutable work from several attempts plus current-render cache materializations. Each logical-batch entry lists its generation slots in plan order. A provider slot may first carry its exact invocation plan and may add a result only after the journal has a truthful terminal request chain and descendant recorded-result entry; a cache slot carries its exact current-render materialization plan plus one succeeded materialized result with verified cache evidence. The cache plan's typed `resolvedContinuation` must match the current predecessor selection/checkpoint and its portable fingerprint must match the cache entry before the result can enter progress. The entry may add one current selection only after every required take-producing slot succeeds, and a continuation checkpoint only for the selected take when a compatible candidate exists. Independent segmented slots may form a noncontiguous subset; a prior-batch continuation requires a complete contiguous dependency prefix through the selected/checkpointed immediate predecessor. Every later event preserves earlier events as history and may extend current work or choose a newly authorized replacement suffix, but it cannot rewrite an existing invocation, materialization plan, result, selection, or checkpoint artifact. A consumed-selection replacement event and its initial/recovery journal carry the identical `ConsumedSelectionRebuildAuthorization` and reservation sequence; current progress preserves the exact compatible prefix through the newly selected predecessor and removes every old downstream entry before replacement dispatch or cache materialization. A result-bearing event's progress and aggregate `batchResults` must name the same current slot composition, and a success/audio-run event's selection/checkpoint summaries must equal the current progress leaves it assembles. Failed or ambiguous new attempts remain visible without displacing the last explicitly selected successful aggregate/audio run.

`subjectKey` is a canonical character key for a catalog character or an explicit namespaced logical role key such as `role:narrator` or `voice:ship-computer`. Logical keys never become literal path components. Every artifact path uses a collision-resistant, lowercase safe key derived and validated by one shared encoder; containment checks reject traversal, absolute paths, platform-reserved names, and provider/model/registration collisions. Mentions and visible `characterKeys` are never accepted as substitutes for speaker identity.

Provider voice display names are discovery metadata, not stable identity. Rendering uses provider IDs wherever the provider offers them. A name-based Hume or other user-facing locator must resolve to an ID or an immutable provider reference during execution readiness and must not remain the only identity in a scene snapshot.

An account-namespaced remote resource requires the non-secret `accountScopeHash` observed during provisioning/readiness; a provider-namespaced resource forbids it. Registration, snapshot, render, and cache identities retain that scope so the same opaque resource ID from different credentials/accounts cannot collide or be sent under the wrong account.

Comic source identity is computed before structure generation. `canonicalPath` is `normalize(await realpath(resolve(scriptArgument)))`, serialized as project-relative POSIX form for a path inside the project and as a normalized absolute realpath for an external source. `contentSha256` hashes the exact source bytes, and `identityHash` hashes the canonical serialization of every `ComicSourceIdentity` field except itself. Relative, absolute, and symlink spellings of the same real file therefore converge; same-basename files in different directories do not. The structured-script schema advances from strict version 3 to strict version 4 to embed that source identity and retain the delivery/stage/timing source spans required below. Version 3 scene artifacts are not upgraded in place and must be rebuilt.

Generic TTS has its own equally strict identity rather than borrowing comic state. `GenericTtsSourceIdentity.contentSha256` hashes the exact inline/file/batch-item input bytes, `sourceLocator` records only `inline`, the canonical file path, or canonical batch path plus zero-based item index, and `identityHash` hashes the complete record with only itself omitted. File and batch locators use the same realpath, project-relative-inside/absolute-outside, POSIX serialization rule as comic; inline identity metadata never stores the text. Generic normalization then writes one immutable `metadata/tts-dialogue-plans/<dialogue-plan-id>.json` per canonical item; `GenericTtsDialoguePlan.dialoguePlanId` hashes the complete plan with only its ID omitted, `createdAt` is copied from the canonical item/run creation time, and every single-voice input becomes one canonical turn while labeled and batch inputs retain their complete ordered turns. The canonical provider options carry that plan's contained path/checksum. A `tts-synthesis` branch/final plan's `sourceIdentityHash` and `dialoguePlanId` must resolve to this generic source/plan; a `comic-audio` plan must resolve to `ComicSourceIdentity`/`ComicDialoguePlan`. Cross-kind IDs or a generic plan detached from its canonical item fail before readiness.

The structured artifact is referenced separately by `StructuredScriptArtifactRef`; source identity never contains the checksum of an artifact that itself embeds source identity. `sceneRunIdentity` is the content hash of the canonical serialization of `ComicSourceIdentity` plus `StructuredScriptArtifactRef`. `dialoguePlanId` hashes the entire canonical dialogue-plan record with only its ID omitted. Each snapshot `entryId` hashes its complete canonical entry with only `entryId` omitted. `snapshotId` hashes the entire canonical `VoiceReferenceManifest` with only `snapshotId` omitted, including `sceneRunIdentity`, `dialoguePlanId`, catalog/brief hashes, the stable scene `createdAt`, and every entry sorted lexically by `(provider, providerModel, profileKey, subjectKey, registrationId, generationId, entryId)`; entry IDs must be unique. Dialogue/snapshot `createdAt` is copied from the canonical scene manifest rather than sampled at artifact-write time, so rebuilding the same logical artifact produces identical bytes. `branchPlanId` hashes the full preliminary branch record with only its ID omitted. `renderPlanId` hashes the canonical final plan payload with both `renderPlanId` and the derived `renderIdentity` omitted; `renderIdentity` is then computed by the formula above from that plan ID and the separately declared target/voice/settings/output identities. `resultIdentity` hashes the complete canonical `ProviderRenderResult` with only `resultIdentity` omitted. Each `AccountCapabilityObservation.observationHash` and `ProviderReadinessResult.readinessResultHash` likewise hashes its complete canonical record with only that hash field omitted; candidate and canonical hash lists must reference the exact embedded observations in canonical lexical hash order with neither omissions nor extras. `targetKey` remains the adapter-target identity. Strict parsers recompute every content identity in dependency order, so copied or edited artifacts cannot retain stale IDs.

`batchInvocationPlanId` hashes its complete invocation plan with only that ID omitted; `attestationId` hashes its complete cache-source provenance attestation with only that ID omitted; `cacheMaterializationPlanId` hashes its complete cache-materialization plan with only that ID omitted; each continuation `fingerprintHash` hashes its complete portable fingerprint with only that hash omitted; `batchResultId` hashes its complete provider/cache batch result with only that ID omitted; `authorizationId` and `skipId` hash their complete rebuild-authorization and policy-skip records with only those identity fields omitted; `compositionId` hashes the canonical render plan plus the complete ordered current batch-result references regardless of provider/cache provenance; and `resultIdentity` hashes the selected cross-attempt/local aggregate record with only `resultIdentity` omitted. An attestation's `capturedAt` equals its source canonical event timestamp rather than a cache-write clock, and its array projections are canonical and duplicate-free. Its completed ordinals are nonempty, resolve to completed terminal request chains in the attested admission projection, and equal the successful provider requests represented by the source batch result; its output/timing checksum sets equal the source result exactly. Batch-result output/take paths are relative to the batch-result directory and therefore never contain the ID being computed. Aggregate render-relative batch-result references contain already known prior IDs and do not create a reverse dependency.

Every preliminary candidate strategy carries its own required capability scopes, requested-output hash, batch sketch with request-controls, planned generation-slot/take counts and per-slot costs, continuation-plan hashes, and total planned cost; one ambiguous scope/request/cost set cannot stand for both native and segmented work. A hybrid candidate additionally contains the exact base-result/reused-output/range/resubmission repair dependency that it proposes, while non-hybrid candidates structurally forbid it. `candidateId` hashes that complete candidate record with only its ID omitted, and candidate IDs are unique within the branch. Execution readiness returns exactly one candidate-readiness entry for every branch candidate, with the same ID/strategy/scope set and exact observation hashes; its top-level status is `ready` only when at least one candidate allowed by the requested mode is ready. Thus `auto` can truthfully select an eligible segmented candidate when native is unavailable, while strict `native` blocks. The selected final plan names one `branchCandidateId` whose readiness entry is `ready`, and its strategy, required scope set, batch boundaries, request-control/output hashes, generation slots, take policy, continuation plan, repair dependency when applicable, and planned cost must equal that candidate before stable resolved voices and checksum-bound typed request details are frozen. The final plan contains exact typed request controls, requested output, ordered batches/slots, each slot's requested take count and planned cost, the batch selection policy, per-batch/total costs, and each batch's typed continuation plan. Slot indexes are explicit, unique, zero-based, and contiguous, preventing identical ElevenLabs candidate requests from collapsing to one content ID. Hume normally plans one slot requesting one-to-five generations; ElevenLabs plans the bounded number of single-generation slots that the user authorized. Their sum is the logical batch's take count, and slot costs sum exactly to batch/plan cost without cross-currency addition. An `external-checkpoint` is already committed by a successful source `AudioRun`, so its checkpoint/reference/checksum, selected predecessor take, source render/result/audio-run, and provider version are immutable plan inputs; changing that take changes `renderPlanId`. A `prior-batch-selection` instead names only the immediately preceding batch in the same ordered plan because its actual generated take cannot exist yet; it is valid only for a continuation-capable adapter and has no fabricated checkpoint or take ID. `generationSlotId` hashes its complete slot, including its index, with only that ID omitted, and `batchId` hashes its complete canonical batch including ordered slot records with only the batch ID omitted. Non-hybrid batches and their slot lists are nonempty and uniquely identified; source turns belong to logical batches exactly once even when several slots deliberately generate alternatives, preserve canonical order, and make every prior-batch dependency a strict linear immediate-predecessor edge with no skip or fork. The final plan cannot change strategy, batching, slots, take counts/policy, controls, output, continuation-plan kind or predecessor, repair dependency, or price silently after readiness.

Immediately before each provider request, AutoShow materializes one immutable slot-specific `ProviderBatchInvocationPlan`. `none` remains none; an external checkpoint is copied exactly from the final plan after its source success is revalidated; and a prior-batch dependency resolves to the currently canonical selected take and result-independent `ContinuationCheckpoint` from the immediately preceding complete logical batch. `requestFingerprint` hashes the exact batch/slot request semantics, resolved continuation, serializer/schema version, controls, turns, requested take count, and output while excluding `batchInvocationPlanId`; the invocation-plan ID then hashes the complete plan, avoiding a self-reference. The invocation plan is durably referenced in the slot's `CanonicalBatchProgress` and written into the admission journal before `prepared`/`dispatch-started`. The final serializer must send the same slot and resolved continuation and record both in `ObservedProviderRequest`. Therefore two different intra-render predecessor selections retain one priced render plan but produce different downstream slot-invocation, slot-result, and final aggregate identities, while two different external predecessor selections change the render plan itself. No downstream slot is dispatched while its predecessor batch is incomplete, unselected, ambiguous, uncommitted, non-immediate, or version-incompatible.

`strategy: 'hybrid'` is the only plan form with `repair`. Its immutable dependency record names and checksum-binds the base target/source/dialogue/render plan/result, every reused output and its base batch-result ID, the source turns and zero-based half-open canonical ranges that output covers, and the exact failed/unstarted turn IDs to resubmit. The base plan/result must be canonically committed in the same target's append-only history, must resolve to the same `targetKey`, `sourceIdentityHash`, and `dialoguePlanId`, and the exact result identity/path/checksum must appear in a base event. Each reused `ProviderBatchResultRelativeArtifactPath` resolves only beneath the verified `baseBatchResultId`, which must appear exactly once in the base aggregate result's batch-result composition. Every reused output/range must link to a succeeded base outcome and match the new plan range's canonical text slice, provider-prepared text slice, complete approved/transient binding identity including snapshot/entry/revision, provider controls/delivery, and requested provider-output format hashes; a changed global snapshot is allowed only if every reused range still has the exact binding identity captured here. Every resubmitted turn must link to a failed or unstarted base outcome, and no source range may be orphaned, duplicated, overlapped, or both reused and resubmitted. Hybrid plan nodes still describe the complete logical output, while its provider batches contain exactly the canonically ordered `resubmittedTurnIds`; local assembly fills all remaining ranges only from the checksum-verified semantically compatible reused outputs. A non-hybrid plan structurally forbids repair data. Because the complete repair dependency is inside both the candidate and hashed final plan, changing the base source/dialogue/result/batch result, output reference/checksum, range semantics/binding/controls/format, coverage mapping, or resubmission set changes identity or fails strict parsing before a provider call.

Later artifacts form an acyclic dependency chain: the dialogue plan binds scene-run identity; the aggregate snapshot binds scene-run identity and dialogue-plan ID; each provider plan binds dialogue-plan and snapshot IDs plus capability, cast, strategy, transport, settings, output profile, generation slots, and only already committed external continuation or an intra-render immediate-predecessor dependency. A provider slot invocation binds the actual result-independent predecessor selection/checkpoint; its admission basis precedes its immutable slot result. A cache-materialized slot result instead binds an already immutable source-cache object and a current-render materialization plan, copies the sanitized entry/attestation/source-result and required audio/timing bytes into its own result directory, and then depends only on those contained copies without an invocation or live-cache edge. The logical batch's complete selected slot-result set precedes its selection/checkpoint, which may feed the next batch's slot invocations or cache plans. The cross-attempt render-takes index and aggregate result bind a chosen compatible slot-result composition, and the audio run binds that aggregate, selected takes, mix, timeline, and outputs. No slot result, selection, or checkpoint depends on the future aggregate result, and every journal-to-provider-result or closing-journal-to-aggregate recording edge points only from a later descendant snapshot to an already hashed artifact.

Comic dialogue plans remain provider-neutral. Each comic `ProviderRenderPlan` uses the `approved-snapshot` voice context and resolves every subject against one provider-qualified entry in that aggregate snapshot. That separation allows the same immutable source plan to drive ElevenLabs, Hume, and other comparison targets without embedding one cast into the canonical plan. The transient voice context exists for ordinary single-voice and current single-provider generic TTS, where requiring a comic registration and audition would be false; it requires binding identity hashes and structurally forbids `snapshotId`. Strict parsing requires every approved binding's `snapshotId` to equal its context, its unique `entryId` to exist exactly once in that snapshot, and its `entryHash` plus embedded entry bytes to match the indexed snapshot entry byte-for-byte; the transient hash list must equal the canonical identities of all transient node bindings. Mixed, modified, duplicated, or orphan bindings fail locally. A transient binding still records the actual provider voice, canonical settings hash, capability evidence, and result metadata; it cannot create a remote resource, claim approval, or enter a comic scene snapshot.

`ObservedProviderRequest` is emitted at the final provider serializer boundary from the actual URL, path, query, multipart fields, or JSON body after defaults and overrides have been applied. It is a sanitized typed projection of what was sent, not a copy of the requested render plan. Request-level, slot, resolved-continuation, and per-turn voice/control/delivery hashes come from that final serialized representation, so a dropped instruction or substituted checkpoint cannot be reported as sent merely because it existed in a plan. Request turns are keyed records rather than parallel arrays, and their IDs must be unique within a slot. Each provider-dispatch result's invocation/attempt identity and every observed or retry `(invocationId, requestOrdinal)`/batch/slot/invocation-plan/fingerprint must match exactly one transition chain in that attempt's referenced admission journal and may not cross-link to another invocation. A cache-materialized result structurally forbids those current request fields and instead verifies its exact current `CacheMaterializationPlan`, portable semantic fingerprint, current execution input, and source object/result hashes. A request with a definite provider response follows `dispatch-started` to `provider-accepted` and `completed`, or to an authoritative `provider-rejected` terminal transition. An ambiguous request follows `dispatch-started` to `ambiguous`; it must not claim acceptance or completion without evidence. A request stopped before dispatch, including `confirmed-not-admitted` with `method: 'local-before-dispatch'`, has no `ObservedProviderRequest`; a request confirmed not admitted by a post-dispatch provider lookup retains its serializer observation and matching dispatch transition. A succeeded aggregate has exactly one succeeded outcome for every requested turn, no extra turns, and complete links from each outcome to every planned alternative-generation slot plus the verified output/take chosen for assembly; its render-takes index resolves every inline generated slot and batch result exactly once, and every provider-dispatch slot resolves its observed invocation plan while every cache-materialized slot resolves its materialization plan. Every selected provider request, cache materialization, slot, and output is referenced with no orphans. Partial, failed, and ambiguous aggregates still contain exactly one explicit logical outcome per requested turn plus slot-level outcomes, including `unstarted`, so aggregate success cannot hide omitted work. This serializer/cache evidence is the authority for batch and aggregate results, canonical provider summaries, request counts, model/voice/control/delivery/continuation identity, retries, and the A/X, B/Y, A/X conformance suite.

For ordinary synthesis, `createdResources` must be empty in every batch and aggregate result; a non-empty value is a contract violation that stops the run and enters reconciliation rather than normalizing creation as rendering. Voice-management operations write issued resources through their provisioning attempts. Canonical and domain artifacts may reference several pre-existing resources used by a cast without claiming that the synthesis run created them.

Every new JSON domain artifact defined by this decision has an explicit `schemaVersion` and strict parser. The canonical pipeline `manifest.json` is the unversioned exception governed by ADR-002; TTS/comic emits no raw `result.json`. Provider settings use versioned provider/model-specific schemas and canonical serialization rather than arbitrary JSON. Sanitized provider metadata is an allowlisted projection; raw responses, sharing allowlists, emails, secrets, base64 audio, protected filesystem paths, and unknown fields cannot enter registrations, snapshots, cache keys, render artifacts, canonical provider state, or scene output. This decision has no persistence compatibility reader: unsupported domain schemas and pre-canonical run layouts fail with instructions to rebuild.

The strict registration parser enforces cross-field invariants that the storage union cannot leave implicit. An approved registration must have ready provisioning, a matching successful canonical audition, an unrevoked provenance record, and origin-appropriate consent/authorization; its `approvedAuditionId` must equal `approval.auditionId`. A `remixed-from` lineage requires a provider-specific `eligibilitySnapshotHash`; other lineage operations may require their own dated proof through the typed operation schema. Only a valid approved registration can enter the current index or an `ApprovedVoiceSnapshotEntry`. Draft, pending, failed, missing, expired, retired, revoked, or deleted registrations cannot become current even if their JSON carries stale IDs.

### Capability-faceted provider boundary

Capability presence, adapter implementation, and current-account access are separate facts. A provider may document cloning while an account needs an upgrade; an adapter may plan a documented feature without implementing it; a UI-only workflow may require import rather than an API creation call. The provider plan and canonical provider options record the exact stable capability-fixture/scope inputs used to plan a render; dated account/readiness evidence belongs to the attempt event.

The shared provider boundary is composed from facets rather than one widening method with optimistic Boolean flags:

```ts
type ProviderVoiceLocator =
  | { kind: 'provider-id', provider: TtsProvider, resourceId: string }
  | { kind: 'display-name', provider: TtsProvider, name: string }
  | { kind: 'reference-asset', provider: TtsProvider, protectedAsset: ProtectedAssetRef, authorizationRef: string }
  | { kind: 'local-model-voice', provider: TtsProvider, model: string, voiceLocator: string }

type ProviderQualifiedCast = {
  schemaVersion: 1
  targets: Array<{
    provider: TtsProvider
    model: string
    transport: string
    bindings: Array<{
      speakerKey: string
      locator: ProviderVoiceLocator
      settingsSchema: string
      synthesisSettings: TypedProviderSynthesisSettings
    }>
  }>
}

type ProviderReadinessResult = {
  schemaVersion: 1
  readinessResultHash: string
  branchPlanId: string
  targetKey: string
  status: 'ready' | 'blocked'
  capabilityObservations: AccountCapabilityObservation[]
  candidateReadiness: Array<{
    candidateId: string
    strategy: 'native-dialogue' | 'native-utterances' | 'segmented' | 'hybrid'
    requiredCapabilityScopeHashes: string[]
    accountObservationHashes: string[]
    status: 'ready' | 'blocked'
    errors: SanitizedProviderError[]
  }>
  resolvedVoices: Array<{
    locatorHash: string
    providerVoice: ProviderVoiceRef
    providerRevision?: string
    externallyMutable: boolean
  }>
  checkedAt: string
  errors: SanitizedProviderError[]
}

interface TtsVoiceProvider {
  readonly provider: TtsProvider
  getDeclaredCapabilities(): readonly AnyCapabilityRecord[]
  parseVoiceLocator(locator: ProviderVoiceLocator): LocalVoiceLocatorResult
  validatePlan(request: ProviderPreflightRequest): LocalPreflightResult
  checkExecutionReadiness?(request: ProviderReadinessRequest): Promise<ProviderReadinessResult>
  renderBatch(request: ExplicitVoiceSynthesisRequest): Promise<ProviderBatchSynthesisResponse>
  catalog?: VoiceCatalogPort
  design?: VoiceDesignPort
  clone?: VoiceClonePort
  lifecycle?: VoiceLifecyclePort
  audition: VoiceAuditionPort
  nativeDialogue?: NativeDialoguePort
  continuation?: ContinuationPort
}
```

An adapter cannot report an implemented facet without exposing its port and passing the facet's conformance suite. Strict capability parsing rejects impossible combinations such as channel `unsupported` without maturity `not-applicable` and adapter `unsupported`, an account observation whose capability/fixture hashes do not match the planned scope, or account state `available` with unmet requirements. Provider-wide facets omit model/transport; model-bound facets name them. Constraints are feature-discriminated and capability planning intersects them rather than merging independent Booleans. Several provider prerequisites may apply simultaneously and remain visible as requirement/unmet-requirement sets. Provider documentation evidence and account-access observations have separate dated source references and hashes. Account evidence includes a non-secret credential/account scope hash and freshness/expiry policy, and changing credentials invalidates it.

Preflight has three named phases. Static/config validation and `--price` use local descriptors and cached registrations only, perform zero network calls, and mutate neither remote nor local artifacts; price output is stdout only. Execution readiness may perform authorized read-only remote inspection only after every deterministic local check passes. Every target's readiness check must complete successfully before any target begins synthesis. Provisioning and synthesis are the only provider-mutating phases, and each must be explicitly selected by the command being run.

Every executable provider plan binds stable semantic access inputs: the declared capability-fixture hash, required capability-scope hashes, non-secret account-scope hash when relevant, and resolved voice revision/identity hashes. The dated account observations and recomputable `readinessResultHash` that authorize a particular attempt are stored in that attempt's canonical render record and audit metadata, not in `renderPlanId` or `renderIdentity`. A refreshed observation for the same account/scope/fixture/revision may authorize resume/cache reuse without changing identity; a stale, wrong-account, wrong-scope, incompatible-fixture, changed-revision, or unmet-requirement observation blocks execution. A readiness-blocked target follows the zero-attempt canonical failure mapping rather than producing a synthetic render result.

The minimum provider contract is side-effect-free `parseVoiceLocator`, read-only readiness resolution where the selected voice kind requires it, `audition`, and `renderBatch` with explicit resolved voices, one generation slot, and continuation. `ProviderBatchSynthesisResponse` is an in-memory adapter return, never a persistence authority: its ephemeral audio handles are promoted by the shared orchestrator into one result-independent provider-dispatch `ProviderBatchResult` for that slot, while cache materialization is owned entirely by the orchestrator and never calls the adapter. Only the orchestrator composes logical-batch selection state and the later immutable `ProviderRenderResult`. A remote readiness method is optional only for local or provider-stock identities that can be proved from local fixtures; hosted custom, mutable, name-based, gated, or expiring identities require it. During normal execution, a fixture-only target still emits a deterministic local `ready` result with no account observations and persists it through the same ledger, so every admitted attempt has an exact readiness authorization; static/price mode computes the same conclusion in memory without writing it. Display-name lookup, including name-based Hume locators, occurs only inside execution readiness and must return a unique stable identity; static validation and price never perform that lookup. That makes segmented dialogue portable across any ordinary TTS adapter without pretending a transient generic voice is an approved comic reference. Optional facets add discovery, design, clone, resource management, native rendering, provider timing, or continuation without changing the comic planner.

### Runtime option and side-effect boundary

The consolidated runtime-option architecture is split by authority rather than extended with more optional creation fields:

- `TtsCliReferenceInput` is an edge-only `{ speakerKey?, sourcePath, authorizationRef }` accepted for each unnamed Mistral request reference. It never enters config, `ProcessingOptions`, target collection, logs, canonical/domain artifacts, or a provider request as a filesystem path.
- `TtsSynthesisRuntimeOptions` contains provider/model selection, an existing stock/saved/custom voice locator or permitted request-time reference, synthesis controls, dialogue/cast input, scheduling, and output controls. It cannot express create, save, import, verify, approve, or delete intent.
- `VoiceManagementRuntimeOptions` contains design/remix/clone/import inputs, desired resource names, consent and provenance references, candidate/take limits, lifecycle actions, and management budgets. It is accepted only by the shared `voice` management surface and `comic reference-voice`.
- `ExplicitVoiceSynthesisRequest` is constructed from a validated render plan plus one immutable batch-invocation plan and receives resolved voice and continuation bindings directly. Provider collectors capture model and immutable serializer defaults but do not capture invocation voice identity, continuation state, or a management operation.

`TtsRuntimeOptions`, `WriteRuntimeOptions`, `ProcessingOptions`, `TtsTargetSelection`, and `buildProcessingOptions` lose ElevenLabs/Speechify clone inputs, saved-resource names, consent fields, and every other creation-only setting. `src/cli/options/option-resolution/tts-options.ts` resolves synthesis options only; a separate management resolver owns management flags. `config-types.ts` and `config-merge.ts` may persist existing provider voice IDs and safe synthesis defaults but reject creation defaults with an actionable equivalent `voice` or `comic reference-voice` command. Consent email, performer identity, raw reference paths, and protected management locators never enter the generic processing option object or canonical manifest.

At the start of Phase 0, before target collection or provider setup, static validation rejects explicit or config-inherited ElevenLabs and Speechify reference/name/consent creation combinations and named Mistral save requests. This immediate guard closes the current path where an inherited ElevenLabs default can create one shared clone during synthesis. There is no deprecation window in which an ordinary `tts`, `write`, resume, or comic render is allowed to create a voice.

Phase 0 preserves the authorized unnamed Mistral request-reference path through a minimal protected-store ingestion boundary. Price/static planning reads and hashes the CLI-edge input in memory but performs no write and reports the planned binding as non-materialized. Normal execution waits until all deterministic validation succeeds, ingests the bytes once into the owner-only protected store, replaces the edge input with an opaque `ProtectedAssetRef`, and only then collects/executes the target; the raw path is discarded. Phase 1 extends that store with audition, consent, preview, retention, and reconciliation policy. If protected ingestion is unavailable or forbidden, execution fails locally instead of leaking the path or claiming resumability. Tests cover execution and price and assert that neither generic runtime state nor canonical/domain output contains the source path.

### Voice candidate, provisioning, and lifecycle contract

Voice creation is a separate phase from scene synthesis. `comic generate-audio` consumes approved registrations and never designs, clones, verifies, approves, or deletes a remote voice implicitly.

A design or clone operation returns an explicit state:

```ts
type VoiceProvisioningResult = VoiceProvisioningState & {
  attemptId: string
  idempotencyKey?: string
  checkedAt: string
}
```

Voice Design is always two-phase. `materializeCandidate` is the remote, potentially billable create/save mutation for an explicitly selected ephemeral candidate. `approveRegistration` is the separate local atomic action that makes a fully materialized and successfully auditioned registration current. A provider design preview is evidence for selection but does not replace the canonical pre-approval audition. A failed audition cannot replace the current approved registration.

Cloning requires a provenance record and, where applicable, a provider consent record before source audio is uploaded. Missing, expired, or revoked consent blocks provisioning and synthesis. Provider consent IDs and consent recordings remain separate from performer samples. Ordinary logs, the canonical manifest, and domain artifacts contain only non-secret references and hashes; they do not contain consent email, raw consent audio, source audio bytes, API keys, or provider tokens.

Remote provisioning occurs only in the explicit reference/voice-management workflow, once per unique registration, before its canonical audition. `comic generate-audio` performs no remote creation; its scene preparation deduplicates only read-only resolution, readiness inspection, protected local reference materialization, and conversion. Concurrent work shares one promise and result, so it cannot create one clone per turn. Mistral reference materialization and conversion are cached by immutable source checksum rather than repeated for every line.

Provisioning is crash- and multi-process-aware. A durable attempt journal and project lock are written before the create request; the journal names the typed operation, protected recoverable request evidence, and the provider-supported reconciliation strategy/handle, and an idempotency key is used where available. Every issued resource is appended to `issuedResources` before any outcome or registration transition, including failed, verification, approval, and ambiguous branches, and compare-and-swap ownership prevents a second process from promoting the same draft. A timeout or crash with an uncertain provider outcome becomes `reconciliation-required` and is never retried automatically unless provider idempotency proves that retry is safe. Recovery uses the recorded operation/evidence to inspect, search, import, tombstone, or explicitly abandon the attempt before another create is allowed; when the provider has no lookup surface, `manual-inspection` remains blocking rather than guessing.

Consent records define separate policy for new synthesis, cached-audio reuse, playback/export, retention, and deletion after revocation. The default for absent or ambiguous permission is deny. Revocation never rewrites historical non-secret manifests, but it blocks new synthesis and resume/cache use unless the record expressly permits them and can quarantine or require deletion of protected audio according to the recorded obligation.

Remote deletion is never part of render cleanup. It requires an explicit management action, exact local registration and remote resource identity, confirmation, `ownership: 'project'`, and a current deletion-eligibility/notice snapshot. Provider stock, third-party shared sources, and externally managed imports are never deleted by AutoShow. When an import operation creates a separate project-owned account resource, the source and copy are separate lineage-linked records; only the copy may be deleted, and only when its own provider eligibility permits it. Providers that delete by a mutable name, including Hume's documented endpoint, require a fresh unique name-to-expected-ID proof immediately before deletion or report `external-action-required`. A successful deletion leaves a local tombstone so historical manifests remain intelligible and future execution readiness rejects the resource.

### Character voice artifact contract

The visual character schema remains unchanged. Voice metadata uses separate versioned files under the character root; sensitive audio bytes do not:

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
  policies/<opaque-asset-id>/<content-identified-policy-or-consent-revocation>.json
  work/<opaque-attempt-id>/
```

`character-voices.json` contains provider-neutral authored briefs keyed by canonical character or role. A brief may define language/locale, accent or dialect and strength, apparent age range, gender presentation when relevant, pitch/register, timbre, resonance, pace, energy, texture, mannerisms, default delivery, prohibited caricatures, project pronunciations, and allowed voice origins. Search traits are casting aids, not verified demographic facts.

`character-voice-registrations.json` is an append-preserving registry containing zero or more provider-specific registrations per subject. Several registrations may remain approved for different languages, models, render modes, or casting profiles. `character-voice-current.json` is the only current-selection index and contains at most one current generation per `(subjectKey, provider, profileKey)`; an atomic compare-and-swap updates that index without rewriting or retiring approved alternatives. Each registration records generation and prior-generation IDs, provider/model and stable voice reference, creation source and lineage, sanitized provider metadata, brief hash, audition artifacts and checksums, non-secret provenance/consent references, capability and account-access evidence, exact synthesis defaults, retention/expiry/deletion state, and cleanup state.

The audition contract is a versioned `audition-manifest.json` rather than one unexplained audio file. Its standard set contains a neutral identity passage, at least one representative script line, contrasting emotional or delivery lines, character and place names plus invented terms, accent-sensitive words, and a provider-neutral comparison passage. It records the exact canonical and provider-prepared text, delivery settings, voice and model identity, capability fixture, take IDs, protected asset references/checksums, duration, cost, warnings, and the explicitly selected take. Projects may extend the set, but approval cannot omit the neutral, representative, pronunciation, and comparison categories. Candidate generation and audition have explicit candidate/take ceilings and a planned budget; `--max-cents` includes design/clone setup, all requested previews, audition synthesis, and local processing, while local approval authorizes no additional provider spend.

`comic reference-voice` supports provider-appropriate stock selection or import, design, clone/reference creation, audition, and approval. `materializeCandidate` is the remote creation/import/save action and can be billable; `approveRegistration` is the later local atomic current-index update after a canonical audition succeeds. Approval is rollback-protected like character/location reference promotion: incomplete candidates never replace the current selection, and a brief, source, registration, or current-generation change during work invalidates the compare-and-swap.

Reference, audition, candidate-preview, consent, and reconciliation-evidence recordings are sensitive identity assets, not ordinary publishable output. They remain in an independently configured protected store that defaults below ignored `runtime/`, creates directories/files with owner-only permissions where the platform supports them, rejects symlinks and containment escapes, and may be backed by encryption or an OS-protected store. Project ignore rules are defense in depth rather than the privacy boundary, and a custom `--characters-root` is not assumed private. Before creating or accepting any scene/publish output and again after directory creation under the workspace lock, realpath checks require every registered protected asset/work root and output root to be disjoint in both directions: neither may equal, contain, or be contained by the other. An overlapping or symlink-redirected configuration fails before protected materialization or provider execution.

Every ordinary artifact uses `ProtectedAssetRef` and stores only opaque store/asset IDs, SHA-256 checksums, non-secret authorization references, and allowlisted metadata. `storeId` and `assetId` must match `^[a-z0-9][a-z0-9_-]{0,127}$`, cannot contain dots or path separators, and resolve only through a registered store adapter; they are never joined as user-supplied paths. Audit attribution uses `AuditActorRef`, an opaque local/project/automation ID that cannot contain an email, display name, or contact field. Ordinary artifacts never store an absolute protected path, performer email, contact details, consent bytes, reference/audition bytes, API key, or raw provider response. Temporary decoding, conversion, upload preparation, and reconciliation happen in an owner-only workspace outside the scene run and are removed after the relevant durable journal/result checkpoint. Because comic accepts arbitrary `--output-dir` destinations, protected bytes are never copied into a scene run. A request-time reference must be materialized into the authorized immutable protected store to support a later provider call; if rights, consent, provider terms, or retention policy forbid that, the registration and dependent run are explicitly non-resumable for new provider synthesis and may reuse only output whose reuse remains authorized.

After the dialogue plan exists and every target/profile casting resolves locally, comic writes one aggregate immutable `VoiceReferenceManifest` for the exact scene-run and dialogue-plan identities. Its `snapshotId` uses the complete canonical-record projection defined above—not entries alone—and it includes every selected character and non-character role for every planned comparison target. A later final comic `ProviderRenderPlan` refers to that ID through its approved `voiceContext` and one exact snapshot member per resolved turn; the provider-neutral dialogue plan never embeds a mutable current pointer.

Project registrations are append-preserving and `character-voice-current.json` is the sole mutable current pointer. Scene snapshot files are create-only: writing identical bytes at an existing `snapshotId` is idempotent, while the same ID with different bytes is corruption. `voice-reference-snapshots.json` is an atomically updated append-only index whose existing entries cannot be changed or removed and in which each render identity maps to exactly one snapshot ID. Changing a current registration later cannot alter a prior scene, snapshot, provider plan, cache key, or result. This borrows atomic writing and checksum validation from the visual-reference implementation while deliberately strengthening its overwriteable singleton index into append-only content identity.

```text
<scene-run>/
  manifest.json
  metadata/structured-script.json
  metadata/dialogue-plans.json
  metadata/dialogue-plans/<plan-id>.json
  assets/voice-reference-snapshots.json
  assets/voice-references/<snapshot-id>/voice-reference-snapshot.json
  audio/providers/<safe-target-key>/
    branches/<branch-plan-id>/
      provider-render-branch-plan.json
      readiness-results/<readiness-sequence>-<readiness-result-hash>/provider-readiness-result.json
    renders/<render-identity>/        # exists only after all-target readiness
      provider-render-plan.json
      rebuild-authorizations/<authorization-id>/consumed-selection-rebuild-authorization.json
      cache-materialization-plans/<cache-materialization-plan-id>/cache-materialization-plan.json
      cached-batch-results/<batch-result-id>/
        provider-batch-result.json
        cache-provenance/
          cache-entry.json
          source-provenance-attestation.json
          source-provider-batch-result.json
        takes/
        timing-evidence/<timing-evidence-id>.json
        segments/
        provider-outputs/
      local-compositions/<composition-id>/
        render-takes/<render-takes-id>/render-takes.json
        results/<result-identity>/provider-render-result.json
      attempts/<attempt-number>-<invocation-id>/
        admission/<journal-snapshot-id>/render-admission-journal.json
        admission-evidence/<evidence-hash>.json
        batch-invocations/<batch-invocation-plan-id>/provider-batch-invocation-plan.json
        batch-results/<batch-result-id>/
          provider-batch-result.json
          takes/
          timing-evidence/<timing-evidence-id>.json
          segments/
          provider-outputs/
        render-takes/<render-takes-id>/render-takes.json
        results/<result-identity>/
          provider-render-result.json
      selections/<selection-identity>/take-selection.json
      checkpoints/<checkpoint-id>/continuation-checkpoint.json
      assemblies/<audio-run-id>/
        mix-plan.json
        transform-ledger.json
        speech.wav
        timeline.json
        audio-run.json
```

Branch-plan, readiness-result, consumed-selection rebuild authorization, cache-materialization plan, admission-journal snapshot, batch-invocation, provider/cache batch result, render-takes, aggregate render-result, selection, checkpoint, mix/transform/timeline, and audio-run paths are create-only. A repeated write of byte-identical content at the same content identity is idempotent; different bytes are corruption. Every readiness ledger entry and render event carries the contained immutable path/checksum pair it used, so later work can never overwrite evidence referenced by an earlier append-only event. `RenderRelativeArtifactPath` is a normalized nonempty POSIX path relative to `renders/<render-identity>/`; `AttemptRelativeArtifactPath` uses the same rules relative to one `attempts/<attempt>-<invocation-id>/` child; `ProviderBatchResultRelativeArtifactPath` uses them relative to the containing provider `batch-results/<batch-result-id>/` or local `cached-batch-results/<batch-result-id>/` child; and `AudioRunRelativeArtifactPath` uses them relative to `assemblies/<audio-run-id>/`. Each forbids an absolute path, empty/dot/dot-dot segment, backslash, encoded traversal, its containing identity prefix, and symlink escape. Native take/timing and segmented/current provider outputs use the batch-result-relative form, same-attempt journal bindings use the attempt-relative form, and cache-materialization plans, cross-attempt/local aggregate indexes, cache-result references, and rebuild authorizations use the render-relative form. An aggregate closed by a provider attempt lives in that attempt; any zero-dispatch aggregate and its render-takes index live in its content-identified local composition, even when it reuses provider-dispatch results from prior attempts. These identity-independent references let each content ID hash its record without a path/identity fixed point; only its parent's external canonical reference supplies the containing directory. Attempt and invocation are evidence/address components, not substitutes for a content identity.

The aggregate snapshot stores protected asset locators/checksums and a hash of immutable registration metadata, never protected bytes or paths. A hosted voice also stores provider/model/resource identity, its approved registration state, provider revision captured by that registration when exposed, whether the identity is externally mutable, and the approved audition checksum. It makes no claim that execution readiness has succeeded. Current remote observations belong to a separately dated readiness result; they do not mutate the immutable snapshot. Before new synthesis, a changed known provider revision blocks or requires a new registration/snapshot. When no revision exists, resume may deterministically reuse checksum-valid and still-authorized cached audio, but new provider synthesis must acknowledge that the remote voice can have drifted. Resume uses the snapshot captured for that run and never silently adopts a newer current registration.

### Comic dialogue plan

`comic generate-audio <script>` consumes only a compatible existing scene run. If `--output-dir` is present, it resolves and validates that exact existing directory and never falls back. Otherwise it enumerates timestamped directories matching the sanitized source slug in descending order and selects the first whose canonical `command: 'comic'` manifest parses, whose top-level `source` and item `input` exactly match the recomputed source identity/path, whose strict structured-script v4 artifact parses, whose embedded `ComicSourceIdentity` exactly equals that same identity, and whose structured-artifact checksum matches the canonical reference. Incompatible or corrupt candidates are skipped with recorded local reasons, so a newest incompatible run does not hide an older compatible run. If none match, the command fails without creating a directory or provider plan. The new compatibility resolver must not delegate selection to `findLatestSceneRunDirectory`, `getSceneRunDirectory`, or the current slug-only in-memory cache.

A pinned source mismatch or byte drift is a blocking error with no fallback. Relative, absolute, and symlink spellings of one source converge through realpath identity; a same-basename source from another directory never matches. The command never begins a fresh scene run, accepts structured-script v3, synthesizes from LLM-authored `scene.json`, or serializes comic turns back through the generic screenplay parser. It writes an immutable provider-neutral `metadata/dialogue-plans/<plan-id>.json` and append-only index, resolves all casts, writes the one aggregate local-registration snapshot, and writes preliminary branch plans. Only successful all-target readiness permits final immutable provider plans and render histories. The canonical root binds every artifact that actually reached its phase: source/structured reference, scene-run/dialogue/snapshot/branch IDs, then final render-plan/render identity and cache/take/timeline/output checksums only after those exist; no per-audio manifest exists.

Every planned turn retains:

- Stable `turnId`, `sourceSegmentId`, and optional `beatIndex`.
- Canonical character key or explicit namespaced role key.
- Original speaker label and exact canonical text.
- Structured delivery/tone rather than a stripped parenthetical.
- V.O., O.S., radio, intercom, telephone, computer, or other local effect intent.
- Authored pause, overlap, and scene-boundary intent where represented by the migrated structured-script schema, otherwise explicit reviewed planner defaults.
- Provider-neutral casting profile/role requirements; each `ProviderRenderPlan` supplies the provider-qualified registration and immutable snapshot entry.

The current structured-script parser removes timing-only delivery and some inline stage direction before source segments are built, so this ADR requires a schema/parser migration before it may claim authored pause or overlap fidelity. The migrated representation retains normalized delivery plus source spans for timing, stage direction, V.O./O.S., and simultaneous speech. Until that migration lands, planner-inserted pauses and overlaps are explicit defaults that require review and are never attributed to the source text.

Every speakable source segment must resolve to a voice/effect policy or a blocking validation error. Narration, captions, uncatalogued voices, compound speakers, V.O./O.S., and simultaneous speech receive explicit project policies; none is silently dropped. A compound label either resolves to one declared synthetic role with its own registration or expands to named child turns. Simultaneous child turns become an explicit `overlap` node with independent voices and placement; they are never flattened into one provider speaker string. A source segment referenced by several panels is spoken once. Panel source IDs may derive a panel-to-audio map but never duplicate canonical dialogue.

The generic `tts` command may continue accepting `--tts-speaker SPEAKER=VOICE` only when exactly one provider is selected and every mapping is locally valid for that provider/model. Multi-provider comparison uses the strict versioned `ProviderQualifiedCast` input rather than reusing one string namespace. Its parser requires unique `(provider, model, transport)` targets, unique `speakerKey` values within each target, and exact equality between every locator's provider and its enclosing target before any resolution. Precedence is target-specific cast binding, then an explicit current single-provider speaker mapping, then an explicit non-dialogue provider voice; an explicit global synthesis voice combined with a dialogue cast is a usage error, while a benign inherited global voice is omitted from the plan with an actionable diagnostic and can never override a speaker binding. An unmapped speakable role is an error. `SPEAKER=path` is supported only for a provider that can consume that request-time reference without creating a resource and with the required authorization/profile data. ElevenLabs and Speechify paths are rejected with migration guidance; an authorized unnamed Mistral one-off reference may remain synthesis input.

Generic clone/save behavior is separated from synthesis. A shared non-comic `voice` management command exposes create, import, audition, inspect, reconcile, retire, and delete operations through the same ports used by `comic reference-voice`. Every `tts`, `write`, resume, and synthesis-price path rejects a persistent ElevenLabs, Speechify, or named Mistral creation request locally before target collection or provider setup and prints the equivalent management command; there is no resource-creating compatibility period. Config loading and merge never create a voice. Persisted reference/name defaults that formerly implied creation are rejected with actionable migration diagnostics and must be converted to a registered provider ID or explicit management operation before synthesis.

### Render planning and strategy selection

The shared render planner accepts `auto`, `native`, or `segmented` for an initial render and a separately authorized `repair` mode for a prior partial render. Static planning first produces a `ProviderRenderBranchPlan` for each target from source, aggregate snapshot, local capability fixtures, candidate strategies, settings, output profile, and price branches. `repair` requires exactly one hybrid candidate with the complete prior-result dependency; hybrid is forbidden in the other mode candidate lists. These preliminary records make no current-account/revision claim and are the only plan identity available to readiness. Normal execution persists them, completes every read-only readiness check, and, only if all targets are compatible, resolves the chosen branch/current stable voice revisions and freezes the immutable final `ProviderRenderPlan`, `renderPlanId`, and `renderIdentity` for each target before the first billable synthesis request.

`auto` selects native rendering only when:

- Every batch turn uses the same provider and a compatible model.
- The adapter facet is implemented and the current account is known to have access.
- Speaker count, input length, language, output format, voice origins, timing requirements, and provider limits all fit.
- Every registration is ready, approved, unrevoked, and compatible.
- Every required per-turn direction can be represented without silently dropping semantics.

`native` is strict and fails preflight rather than degrading. `segmented` is explicit. Planning splits only between turns; an individually oversized turn may become indexed subparts of the same source turn only when the provider request can repeat the required speaker framing and the manifest preserves that relationship.

Fallback is determined during preflight. Native may fall back to segmented only with the same provider and the same approved snapshots, and only when the plan and price already include that route. An approved alternate registration may be used only when it is named in the plan. There is no silent provider or voice substitution. After accepted output, partial billable output, or an ambiguous timeout, AutoShow checkpoints and stops instead of quietly buying the script again. A later mixed native/segmented repair is an explicitly priced new `hybrid` render identity that checksum-references reusable successful output and submits only failed/unstarted turns; it is never an automatic retry of the partial whole render.

`--price` uses only fresh cached account observations and keeps every branch plan in memory. When access is unknown, it reports the native and segmented conditional branches and readiness condition rather than contacting the provider, asserting a false single total, or claiming a final plan identity. Normal execution selects only a branch already covered by the preliminary plan and budget. If any readiness check blocks, its zero-attempt provider failure references the branch plan and evidence, every otherwise-ready peer receives the explicit zero-attempt dependency-readiness failure, and no final provider plan/render history entry or synthesis call is created for any target.

Gemini's native dialogue strategy is valid for exactly two distinct speakers. Strict `native` with any other count fails locally with zero synthesis calls. In `auto`, exactly two speakers may select native while one or three-or-more may select the already validated and priced explicit-turn segmented route; ordinary non-dialogue single-voice Gemini synthesis remains valid. A requested comic audio stage with zero speakable turns completes as `execution: { kind: 'local', state: 'succeeded' }`, `status: 'full'`, `targetKeys: []`, and artifact references to the verified structured script and empty dialogue plan; it has no voice snapshot, provider state, branch/readiness/render/result/audio-run, selected/published output, or synthesis request. Generic `tts` instead rejects a normalized zero-turn input before target collection because its item contract requires at least one provider success. No strategy chunks raw speaker-labeled prose: all boundaries come from resolved turns.

Capability discovery does not bypass the central model registry governed by ADR-018. Voice metadata that does not change a selector belongs here, but adding Deepgram voice-model selectors, retiring or replacing an OpenAI model, or registering a Groq language model requires a material ADR-018 update or a later model-refresh ADR. A discovered provider identity that is not valid for a registered model/transport may be shown as unavailable but cannot render.

### Segmented rendering and concurrency

`TtsTarget.run(text, outputDir, opts)` is replaced or wrapped by an invocation that receives explicit text, resolved voice source/snapshot, per-turn controls, speaker/source identity, output location, scheduler context, and cancellation signal. Provider collectors may capture model and stable non-identity defaults, but never the invocation's voice.

Every current provider must pass an A/B/A conformance contract: calls on one collected target for Alice voice A/control set X, Bob voice B/control set Y, then Alice voice A/control set X must send A/X, B/Y, A/X in the actual provider payload while preserving source output order under reverse completion. Request-level settings remain separate and cannot overwrite per-turn settings or delivery. The required provider request fields are Kitten speaker, OpenAI `voice`, ElevenLabs voice path/ID, MiniMax `voice_setting.voice_id`, Groq `voice`, xAI `voice_id`, Mistral `voice_id` or reference audio, Gemini single-speaker `voiceConfig`, Deepgram `model`, Speechify `voice_id`, Hume utterance voice, and Cartesia `voice.id`. Gemini retains its native two-speaker registry path and must also implement the twelfth explicit-turn serializer used by segmented and ordinary single-speaker rendering.

One bounded dialogue work selector owns queued turns and native batches, deterministic result ordering, cancellation, and workspace lifetime. It adds no new concurrency flag. Hosted request admission uses the existing run-global, per-provider `--tts-chunk-concurrency` cap, currently defaulting to 30 and 50 for Grok-only hosted TTS, with one native batch or one segmented request/chunk counting as one unit; it submits directly to that coordinator rather than acquiring and then nesting another hosted cap. `--provider-concurrency`, currently default 10, continues to bound simultaneous provider/model targets, and `--local-concurrency`, currently default 10, bounds Kitten and other local synthesis/process work. Comic's visual `--concurrency` does not multiply audio admission. Reference decoding, effects, assembly, and file promotion use the applicable existing local CPU/process/resource gates. The implementation must not wrap all turns in an unbounded `Promise.all`, must cancel queued work after a blocking failure, and must avoid nested scheduler deadlock. Remote provisioning is not render work; protected local materialization is deduplicated before queued synthesis. ADR-008's current-state inventory, defaults, and nesting diagram are updated when this selector lands.

### Native dialogue, timing, and continuation

Native and segmented rendering are capability facets, not mutually exclusive provider labels. A provider may implement native dialogue plus segmented fallback, native utterance arrays plus continuation, or only explicit-voice turn rendering.

Provider-prepared text and source text are distinct artifacts. Every insertion, removal, normalization, pronunciation substitution, or ElevenLabs delivery/audio tag produces an ordered source map rather than pretending provider offsets index canonical text:

```ts
type PreparedProviderText = {
  schemaVersion: 1
  canonicalText: string
  providerText: string
  preparationVersion: string
  canonicalIndexUnit: 'unicode-scalar-value'
  providerIndexUnit: 'unicode-scalar-value' | 'utf16-code-unit' | 'utf8-byte' | 'provider-character-array-index'
  spans: Array<{
    kind: 'mapped' | 'provider-only' | 'canonical-only'
    canonicalStart?: number
    canonicalEnd?: number
    providerStart?: number
    providerEnd?: number
    transform?: string
  }>
}

type TimedToken = {
  turnId: string
  subjectKey: string
  text: string
  startMs: number
  endMs: number
  canonicalStart?: number
  canonicalEnd?: number
  providerStart?: number
  providerEnd?: number
}

type TimingClock = 'take-audio-ms' | 'final-audio-ms'

type NormalizedTiming<Clock extends TimingClock> =
  | {
      availability: 'timed'
      clock: Clock
      provenance: 'provider-native' | 'provider-alignment' | 'assembled-segments' | 'offline-alignment'
      turns: Array<{ turnId: string, subjectKey: string, startMs: number, endMs: number }>
      words?: TimedToken[]
      phonemes?: TimedToken[]
      characters?: TimedToken[]
    }
  | {
      availability: 'unavailable'
      clock: Clock
      provenance: 'unavailable'
      turns: Array<{ turnId: string, subjectKey: string }>
      reason: string
    }

type ProviderTimingEvidenceArtifact = {
  schemaVersion: 1
  timingEvidenceId: string
  provider: TtsProvider
  model: string
  providerIndexUnit?: PreparedProviderText['providerIndexUnit']
  providerTimeUnit: string
  payload: SanitizedProviderTimingProjection
}

type RenderTake = {
  takeId: string
  generationSlotId: string
  providerRequestId?: string
  providerGenerationId?: string
  audio: { artifactRef: ProviderBatchResultRelativeArtifactPath, outputId?: string, sha256: string, format: ObservedAudioFormat }
  durationMs: number
  timing: NormalizedTiming<'take-audio-ms'>
  rawProviderTimingEvidenceRef?: { timingEvidenceId: string, path: ProviderBatchResultRelativeArtifactPath, sha256: string }
  derivedCostAllocation?: { amount: number, currency: string, method: string, sourceBatchId: string }
  continuationCandidate?:
    | { kind: 'provider-generation-id', value: string }
    | { kind: 'protected-token', asset: ProtectedAssetRef }
  warnings: string[]
}

type GeneratedProviderBatchBase = {
  batchId: string
  generationSlotId: string
  takes: RenderTake[]
  batchCost: PlannedAndObservedCost
  costEvidence: SanitizedProviderCostEvidence[]
  generatedAt: string
}

type GeneratedProviderBatch = GeneratedProviderBatchBase & (
  | { source: 'provider-dispatch', batchInvocationPlanId: string, observedRequestOrdinals: number[] }
  | { source: 'cache-materialization', sourceBatchResultId: string, observedRequestOrdinals: [] }
)

type RenderTakesArtifact = {
  schemaVersion: 1
  renderTakesId: string
  renderPlanId: string
  renderIdentity: string
  generationSlots: Array<{
    batchId: string
    generationSlotId: string
    batchResult: ProviderBatchResultRef
  }>
}

type TakeSelection = {
  schemaVersion: 1
  selectionId: string
  renderPlanId: string
  renderIdentity: string
  batchId: string
  batchResults: [ProviderBatchResultRef, ...ProviderBatchResultRef[]]
} & (
  | { state: 'unselected' }
  | {
      state: 'selected'
      selectedBatchResultId: string
      selectedTakeId: string
      policy: 'sole-take' | 'manual' | 'first-generated' | 'explicit-id'
      selectedBy: AuditActorRef
      selectedAt: string
      supersedesSelectionId: string
    }
)

type ContinuationCheckpoint = {
  schemaVersion: 1
  checkpointId: string
  renderPlanId: string
  renderIdentity: string
  batchResult: ProviderBatchResultRef
  selection: { selectionId: string, path: string, sha256: string }
  provider: TtsProvider
  model: string
  providerVersion: string
  batchId: string
  selectedTakeId: string
  continuationState:
    | { kind: 'provider-generation-id', value: string }
    | { kind: 'protected-token', asset: ProtectedAssetRef }
  createdAt: string
}

type RenderAudioSourceBinding =
  | {
      kind: 'take'
      sourceId: string
      resultIdentity: string
      batchResultId: string
      selectionId: string
      takeId: string
      artifactRef: ProviderBatchResultRelativeArtifactPath
      sha256: string
    }
  | {
      kind: 'provider-output'
      sourceId: string
      resultIdentity: string
      batchResultId: string
      outputId: string
      artifactRef: ProviderBatchResultRelativeArtifactPath
      sha256: string
    }
  | {
      kind: 'reused-output'
      sourceId: string
      baseResultIdentity: string
      baseBatchResultId: string
      outputId: string
      artifactRef: ProviderBatchResultRelativeArtifactPath
      sha256: string
    }

type FinalTimeline = {
  schemaVersion: 1
  timelineId: string
  renderIdentity: string
  timing: NormalizedTiming<'final-audio-ms'>
  speechSources: RenderAudioSourceBinding[]
  transformLedgerRef: { path: AudioRunRelativeArtifactPath, sha256: string }
}

type AudioMixPlan = {
  schemaVersion: 1
  mixPlanId: string
  renderIdentity: string
  outputProfileHash: string
  sources: Array<
    | RenderAudioSourceBinding
    | { sourceId: string, role: 'licensed-asset', licensedAssetSnapshotId: string, artifactRef: string, sha256: string }
  >
  operations: TypedAudioMixOperation[]
  createdAt: string
}

type AudioTransformLedger = {
  schemaVersion: 1
  transformLedgerId: string
  renderIdentity: string
  operations: Array<{
    operationId: string
    kind: 'transcode' | 'pause' | 'crossfade' | 'overlap' | 'room-tone' | 'effect' | 'time-change'
    sourceRangeMs?: { start: number, end: number }
    finalRangeMs: { start: number, end: number }
    parametersHash: string
  }>
}

type AudioRunRelativeArtifactPath = string

type AudioRun = {
  schemaVersion: 1
  audioRunId: string
  targetKey: string
  renderPlanId: string
  renderIdentity: string
  providerResult: { resultIdentity: string, path: string, sha256: string }
  renderTakes?: { renderTakesId: string, path: string, sha256: string }
  takeSelections: Array<{ selectionId: string, path: string, sha256: string }>
  continuationCheckpoints: Array<{ checkpointId: string, path: string, sha256: string }>
  mixPlan: { mixPlanId: string, path: AudioRunRelativeArtifactPath, sha256: string }
  transformLedger: { transformLedgerId: string, path: AudioRunRelativeArtifactPath, sha256: string }
  finalTimeline: { timelineId: string, path: AudioRunRelativeArtifactPath, sha256: string }
  finalOutputs: Array<{ path: AudioRunRelativeArtifactPath, sha256: string, format: ObservedAudioFormat, durationMs: number }>
  createdAt: string
}
```

These are standalone strict domain envelopes, not loose sidecar shapes. `batchInvocationPlanId`, `cacheMaterializationPlanId`, `batchResultId`, `timingEvidenceId`, `renderTakesId`, `selectionId`, `checkpointId`, `timelineId`, `mixPlanId`, `transformLedgerId`, and `audioRunId` each hash the complete canonical record carrying that field with only that identity field omitted; each nested `takeId` does the same for its `RenderTake`. Every path/checksum pair is all-or-none and containment checked. The provider-dispatch `ProviderBatchResult` binds render plan/identity, batch/slot, invocation, attempt, admission, and serializer evidence; the cache variant binds the same current render/batch/slot semantic identity to immutable cache/source evidence and one exact current `CacheMaterializationPlan`, and forbids current invocation/admission claims. Before that cache result is promoted, its entry projection, source provenance attestation, and detached source batch result are copied into its own `cache-provenance/` directory and checksum-bound as `CurrentCacheProvenanceCopy` records; each copied byte sequence must equal its historical cache source object. The three named copies require source roles `cache-entry`, `provenance-attestation`, and `source-batch-result` respectively, each contained checksum must equal both its `source.sha256` and actual bytes, and materialized audio/timing roles obey the same rule. The materialization plan's external `cacheEntry` is a pre-promotion lookup locator; after promotion it must equal `CacheMaterializationEvidence.cacheEntry.source` and is verified through the contained copy rather than dereferenced. Once canonical, strict result validation uses those contained copies and never requires the historical cache locator to remain live. `TakeSelection` binds the complete ordered result set for one take-producing logical batch, and `ContinuationCheckpoint` additionally binds the one result/take actually selected; none depends on a future aggregate `resultIdentity`. Each batch-result-relative output/take/timing/provenance reference resolves only beneath its current result directory, including bytes copied from cache. `RenderTakesArtifact` indexes every exact render-relative successful slot-result reference across attempts/cache materializations; provider results resolve their invocation plans internally and cache results resolve their materialization plans internally. A result with generated slots requires that index, one without them forbids it, and resolving the index must equal the aggregate's selected result composition and inline generated slots byte-for-byte. Each canonical event/audio run names exactly one current selection record per take-producing logical batch, while earlier create-only selection records remain reachable from one linear compare-and-swap supersession chain. The first selected `TakeSelection` must supersede that batch's unselected record and carry all required slot results; a later eligible reselection may supersede only the currently selected record for the same render/plan/batch/result set. Forked successors, a stale expected-current ID, skipped links, cross-batch/slot links, incomplete result sets, and more than one current leaf are invalid. The selected take must exist in exactly one bound slot result; checkpoint identity additionally binds that result, selection, selected take, and exact provider model/version.

Selection currentness is evaluated at a canonical event sequence, not retroactively against the newest leaf. A selection becomes continuation-consumed as soon as either a canonically referenced downstream `ProviderBatchInvocationPlan.resolvedContinuation` or `CacheMaterializationPlan.resolvedContinuation` names its `selectionId`; the existing event and aggregate composition then forbid a local successor before writing any artifact. A cache plan's exact current selection/checkpoint/take edge must match its stable provider-facing continuation fingerprint, so cache reuse cannot retain a stale dependent result after local reselection. Changing such an upstream Hume choice requires an explicitly authorized, separately priced top-level rebuild of the exact dependent batch suffix. AutoShow computes that closure and its generation slots from the static immediate-predecessor graph, resolves local cache hits, prices remaining provider slots without a provider call, writes a content-identified `ConsumedSelectionRebuildAuthorization`, performs fresh execution readiness when dispatch remains, and prepares the new selection plus replacement checkpoint. One admission-time manifest compare-and-swap then verifies the expected old active event/selection and exact cost/closure, installs those create-only artifacts, removes every stale downstream result from current progress, appends and activates the initial `running` reservation event, and either binds the initialized provider journal while incrementing the attempt or records a zero-dispatch local composition without a journal/attempt. Concurrent or stale inputs fail before spend. A crashed rebuild recovers only through the authorization/reservation lineage and remaining-slot rules above. Fresh slot results produce a new aggregate result; the same static render plan/identity remains valid, while immutable old progress/result/audio remains the exact `selectedSuccess` and published output unless the new aggregate and audio run fully succeed. A failed or ambiguous rebuild remains active and visible but cannot displace that pointer.

An unconsumed selection, normally the terminal batch or a take not used for continuation, remains locally reselectable. AutoShow records its expected current `selectionId`, writes the create-only successor, an optional replacement checkpoint only when a compatible continuation candidate exists or a downstream consumer requires it, and replacement mix/transform/timeline/`AudioRun` artifacts, then performs one manifest compare-and-swap that requires the same render event and selection leaf still to be current. That atomic commit appends and activates a new `succeeded` event for the same attempt/result with the replacement selection and audio-run references and, when the render is selected or published, updates the exact `selectedSuccess` and corresponding comic selected/published audio-run pointer in the same manifest write. A failed compare-and-swap leaves only non-authoritative orphan artifacts for reconciliation. Earlier events and audio runs remain valid against the selection leaf they named at their own sequence; they are never revalidated against the replacement leaf.

An `AudioRun` is the immutable per-target/per-render assembly authority. It binds the exact aggregate provider result, optional takes, committed selections and continuation checkpoints, mix plan, transform ledger, final timeline, and a nonempty final-output set whose probed properties match its records. A `take` source must name a selected take and `selectionId` in a batch result indexed by the current result's verified `RenderTakesArtifact`; a `provider-output` source must name an exact current aggregate `ProviderRenderResult.outputs` entry and selected `batchResultId`; and a `reused-output` source must name an exact checksum-bound base batch result/output from the hybrid plan's verified base aggregate. Artifact references and checksums must equal those authoritative entries byte-for-byte. Segmented plans assemble their newly generated turns from `provider-output` sources, native plans use selected `take` sources, and hybrid plans combine current-composition `provider-output` sources for resubmitted turns with `reused-output` sources for compatible base ranges. Every speech source in the mix plan and final timeline must have one identical binding, and orphaned, duplicated, cross-result, cross-batch-result, wrong-selection, or strategy-incompatible sources are invalid. Its internal mix/ledger/timeline/output paths use `AudioRunRelativeArtifactPath`, so the directory named by `audioRunId` is not part of its own hash. A successful assembled render event requires the all-or-none `audioRunId`/path/checksum triple, and the strict parser verifies that the run's target/render IDs equal its canonical provider record. `CanonicalComicItemMetadata.audio.selectedAudioRuns` points to those same verified triples for the selected comparison outputs; when publish summaries are present, `publishedAudioRunId` names exactly one member and the mix/timeline/final-output summary refs must match that run byte-for-byte. Generic TTS uses the render event's audio-run reference without the comic item envelope. No timeline, mix plan, transform ledger, or final output is authoritative unless reachable through a checksum-verified `AudioRun` and canonical event.

Canonical offsets are Unicode scalar-value indexes, never implicit JavaScript UTF-16 offsets. Each adapter declares the provider's actual unit and converts through explicit indexed character arrays; fixtures cover non-BMP characters, combining marks, multilingual text, provider-returned character arrays, and normalization/tag insertions. Native adapters map provider utterance/input identifiers and provider-text offsets through `PreparedProviderText` to source `turnId` and canonical offsets.

Every text interval is zero-based and half-open `[start, end)`, with integer boundaries in its declared index unit. Spans are canonically ordered; mapped plus canonical-only spans form a gap-free, non-overlapping partition of the canonical text, and mapped plus provider-only spans form the equivalent partition of provider text. Missing coordinates are permitted only for the corresponding one-sided span kind, and empty or reversed mapped ranges are invalid. Timed token text offsets use the same convention and must lie within their owning turn/text.

Provider time is converted to integer milliseconds from decimal/rational values with one shared round-to-nearest, ties-away-from-zero rule, clamped to `[0, audioDurationMs]`. Boundaries are processed in provider order and equal logical boundaries reuse the same converted value; adapters reject reversed ranges and preserve genuine provider overlap explicitly rather than silently sorting it away. Turn ranges are monotonic in output order, while overlap nodes are the only planned source of cross-turn overlap in the final clock. Fixtures cover zero/end boundaries, adjacent ranges, fractional seconds, duration clamping, provider overlap, and Unicode boundary positions.

Provider timing is first normalized to the selected take's `take-audio-ms` clock and retains a sanitized reference to raw evidence. After durable take selection, the assembler writes a transform ledger for transcodes, inserted pauses, crossfades, overlaps, room tone, effects, and time changes and derives the `final-audio-ms` timeline. A transform that cannot preserve defensible offsets requires offline realignment or the unavailable variant; it never relabels raw provider time as final time. Segmented assembly can derive exact final turn ranges but does not fabricate word or phoneme timing.

Native generation is take-producing work over planned generation slots. The render plan fixes their count, each slot's requested take count, selection policy, and initial request-level price. Before each provider call, the resolved slot-invocation plan becomes canonical progress; after the call, its serializer evidence, slot-relative audio/timing, generated takes, outcomes, retries, and cost are durably promoted as one result-independent provider-dispatch `ProviderBatchResult` and recorded by its journal. A compatible cache hit produces the alternative cache-materialization result locally. Only after every required slot for the logical batch succeeds is an `unselected` record created over that complete ordered result set; first selection creates a content-identified successor rather than mutating it. Validation requires the chosen take to belong to exactly one bound slot result. One total take may be selected automatically under `sole-take`; multiple total takes default to manual selection and stop before effects or any dependent continuation request unless the priced plan explicitly chose deterministic `first-generated`. When continuation is planned, the selected take's candidate becomes a result-independent checkpoint, that selection/checkpoint pair is committed to progress, and only then may downstream slot-invocation plans be created. A later human/API choice names an already generated take and records selection policy `manual` or `explicit-id`; it does not retroactively alter priced generation slots, and the consumed-selection rule above determines whether it is local reassembly or a newly priced dependent-suffix rebuild. Each take retains its slot ID, located/checksummed audio, take-clock timing, generation/request or cache-source identity, warnings, optional derived cost allocation, and continuation candidate, while observed provider cost remains authoritative only on the original producing request/result.

Every provider-generated slot names the exact batch-invocation plan and request ordinals within its producing invocation plus sanitized cost evidence; a cache-generated slot instead names its immutable source result and carries no current ordinals/cost evidence. Across an aggregate composition, `(invocationId, requestOrdinal)` pairs and billed cost records are disjoint and aggregate exactly once into `currentComposition`; cache materialization contributes zero, separately charged retries are included when observed and authorized, an unpriced retry is not invented, and different currencies remain separate totals rather than being summed. `closingAttempt` reports only new provider spend from the attempt that closed the aggregate, while `cumulativeRenderHistory` includes retained superseded/failed attempts through that event without charging cached historical source cost to the current composition. A take may carry only a clearly derived allocation from its source request. Hume's one generation slot/request can therefore produce several takes under one charge, while each planned ElevenLabs slot/request produces one candidate and remains separately traceable. Hume continuation checkpoints only the selected generation's candidate and records the exact Octave model/version; a checkpoint from a different Octave version is incompatible. ElevenLabs Text-to-Dialogue provides within-request context but no Hume-style cross-request continuation contract, so its logical batch boundary is recorded rather than inventing a token. Carrying emotional context between scenes is opt-in and uses an externally committed checkpoint in the next render plan.

### Audio assembly, caching, and resume

The current unconditional mono 16 kHz conversion is not the comic master contract. Provider-native outputs are retained as source artifacts where terms permit. Comic selects an explicit render profile containing final sample rate, channels, codec, loudness target, inter-turn pauses, overlaps, crossfades, room tone, and effect chain. The provider result/audio-run artifacts record source and final audio properties and every conversion, with a checksum-bound final summary in canonical state. Upsampling is never described as restoring source quality.

Caching has separate identities:

- A segmented synthesis key covers canonical and provider-prepared text, source turn, the canonically serialized complete `ResolvedVoiceBinding`, provider/model/transport/revision, provider controls, delivery instructions, synthesis format, adapter/request-schema version, capability-fixture version, and text-preparation version. Approved identity hashes `(snapshotId, entryId, generationId)`; transient identity hashes its provider voice/ref asset checksum, `identityHash`, settings schema, and canonical settings.
- A native-batch generation-slot key covers the ordered complete turn set, every canonically serialized approved or transient binding and prepared text, all directions and contextual prompts, provider/model/transport/revision and settings, render strategy, logical-batch/slot plan and requested take count, adapter/request-schema and capability-fixture versions, take policy, and a portable provider-facing continuation fingerprint. That fingerprint is `none` or hashes provider/account/model/version, the provider continuation-state hash, and a selected-take semantic hash derived from stable provider-generation, selected-audio, and timing checksums; it never contains run-local result, selection, checkpoint, take, event, attempt, or invocation IDs. The current render's exact predecessor result/selection/checkpoint/take identities remain mandatory only in its `CacheMaterializationPlan.resolvedContinuation` DAG edge and must resolve to the same fingerprint. The slot key/ordinal is included when multiple deliberately independent candidates are requested, so one cached candidate cannot satisfy two ElevenLabs slots.
- The local effect key covers the source audio checksum, effect asset/checksum, canonical effect settings, implementation version, and audio toolchain version.
- The mix key covers ordered processed-segment or selected native-take checksums, timing data, mastering settings, room tone and other licensed asset snapshots, pauses, overlaps, crossfades, assembly-schema version, and audio toolchain version.

Every cache object uses a strict versioned envelope and canonical hash serialization:

```ts
type SynthesisCacheEntry = {
  schemaVersion: 1
  keyAlgorithmVersion: string
  kind: 'segmented-turn' | 'native-batch'
  generationSlotKey: string
  canonicalInputHash: string
  bindingIdentityHashes: string[]
  continuationFingerprint: ProviderContinuationSemanticFingerprint
  capabilityFixtureHash: string
  adapterSchemaVersion: string
  textPreparationVersion: string
  observedRequestHashes: string[]
  provenanceAttestation: SynthesisCacheObjectRef
  sourceBatchResult: { batchResultId: string, object: SynthesisCacheObjectRef }
  objects: SynthesisCacheObjectRef[]
  outputChecksums: string[]
  createdAt: string
}
```

Each `SynthesisCacheEntry` is itself content-addressed in a registered safe cache namespace and may be created only from a succeeded provider-dispatch batch/slot result already referenced by a canonical source event. While that source DAG is still available, the cache writer strict-parses the source result, invocation plan, completed admission/request chain, input predecessor selection/checkpoint/take when any, observed request, outputs, and timing evidence. It then writes a sanitized content-identified `CacheSourceProvenanceAttestation` whose canonical commitment, invocation and request fingerprint, terminal admission projection, exact continuation DAG hashes, portable continuation fingerprint, and output/timing checksums must be recomputable from those verified records. The entry binds that attestation, the detached source-result bytes, source request hashes, and every immutable typed-role audio/timing object needed to reconstruct the result. The attestation/source-result/audio/timing refs must use their declared roles and the same namespace/key; missing, duplicate, role-substituted, or projection-mismatched objects fail. Arbitrary cache import cannot mint an attestation, and protected continuation material is represented only by its protected reference and hash, never copied into ordinary cache JSON.

After source-run cleanup, the strict detached-cache validator verifies the attestation and source-result content identities, recomputes every attested projection available from the retained sanitized records, checks that the entry's fingerprint/request/output/timing fields match byte-for-byte, and treats the attestation's previously canonical source commitment as provenance rather than attempting to follow dead attempt-relative paths. The retained source result is never accepted as current render authority. A missing or tampered attestation, source invocation/admission projection, predecessor selection/checkpoint/take hash, fingerprint, result, output, or timing object invalidates the entry; it cannot degrade to integrity-only trust.

A hit first recomputes the portable semantic key and continuation fingerprint and revalidates voice consent/resource/revision, the complete detached source provenance, entry, and every object. Before copying bytes, the orchestrator writes one current-render `CacheMaterializationPlan`: its `portableSemanticInputHash` must equal the cache key input, its `currentExecutionInputHash` binds the current final plan/batch/slot and exact resolved binding, and its typed `resolvedContinuation` names the current predecessor selection/checkpoint/take when continuation applies. A `none` continuation requires a `none` fingerprint; a checkpoint continuation requires the checkpoint fingerprint, matching provider/model/version and account scope, and the protected token or generation ID is represented only by its stable state hash. The plan's provider-facing fingerprint must equal both the cache entry and the fingerprint derived from that current checkpoint without using their run-local IDs. The orchestrator then creates a new current-render `cached-batch-results/<batch-result-id>/` directory and copies or content-addressedly materializes the sanitized cache-entry bytes, provenance-attestation bytes, detached source-result bytes, and every required audio/timing object beneath it. Only after every destination byte/checksum matches its cache source does it write the cache-materialization `ProviderBatchResult`, whose current render/plan/batch/slot identities and complete outcomes match the plan, whose evidence binds each historical source locator to its contained current copy, and whose current observed requests, attempts, retries, created resources, and cost are empty/zero. Promotion makes that contained result graph self-sufficient: later cache eviction or namespace GC cannot invalidate canonical completion, resume, selection, assembly, or verification. Eviction before promotion leaves only an uncommitted local plan/workspace and is a cache miss, never a partial canonical result. The result never points current output or required provenance paths into another run or live cache namespace, reuses a wrong-plan result directly, or fabricates admission. Mixed cached/provider results compose normally. Any aggregate finalized without a new provider dispatch uses a local closing identity and zero provider attempts, including a cache-only suffix over a compatible provider-produced prefix; provider results in that composition remain validated by their original journals.

Changing one line or voice invalidates only its segmented synthesis key, but invalidates the containing native slot. A Hume native-slot change also invalidates every downstream cache key whose invocation continuation derives from the changed selected take; if that take was already continuation-consumed, using another take follows the authorized suffix-rebuild contract rather than extending the old result. Explicit hybrid repair can replace selected ranges with segmented work without claiming that the original native batch was incrementally regenerated. Changing mix-only settings or an unconsumed terminal take reruns local assembly without another provider request. Corrupt or mismatched checksums invalidate the affected cache safely. Resume reuses only locally checkpointed or newly materialized checksum-valid work whose consent, resource eligibility, selected take, continuation dependency, and semantic input remain valid. Ambiguous provider outcomes stop in reconciliation state; this contract never promises reuse of an unconfirmed response or automatic repurchase.

Room tone, impulse responses, filters, and other effect inputs are versioned assets with safe locators, checksums, provenance/license references, and snapshot identity. Replacing one invalidates only affected effect/mix keys. Generated or third-party assets are never copied, exported, or retained beyond their recorded authorization.

### Truthful metadata and artifact retention

The versioned provider render result and its canonical provider-state projection replace the flat speaker summary as authority. `Step4Metadata.speaker` may remain as a derived display field for output written through the current canonical writer, but it cannot drive cache, resume, cost, completion, or benchmarking. No retired run/pricing/report file reader is reintroduced.

The detailed result distinguishes turn count, logical batch count, generation-slot count, provider request/chunk count, cache-materialization count, generated/selected take count, final output count, and created resource count. Per turn it records requested registration, serializer-observed or cache-source provider voice/reference and model, source ID, canonical/provider-text mapping, delivery/effect controls, segment/batch/slot and selected-take identity, checksum and duration where independently available, optional final placement with timing provenance, request/generation/cache IDs, retry/reconciliation state, and completion/failure state. Observed provider cost is authoritative at provider-reported request/slot scope; a turn or take stores a reference to that cost and may include only an explicitly labeled allocation with method and provenance, never an invented observed charge. Multiple clone/design resource IDs are retained in provisioning/reference artifacts. Deepgram's per-turn voice-model identity is recorded as the actual serialized request model rather than being flattened incorrectly.

Segmented runs retain normalized dialogue, real turn segments, provider plan/result, final timeline, and final audio for each item/target. Native runs retain provider plan/result, native output, available take/final timing, selected-take state, timeline, and final audio, and advertise no fabricated segment directory. Mixed runs retain both truthful sets. Batch promotes the same required per-item/per-target artifacts before workspace deletion. Completion reads the canonical provider states, resolves only contained references, verifies every checksum on disk, and reports only those files; requested mode or an uncommitted sidecar cannot invent output.

The benchmark/evaluation key includes `renderIdentity`, registration or snapshot-entry identity, and optional character identity beneath the adapter `targetKey`, so several voices or casts using one provider/model cannot overwrite one another. Existing canonical pre-ADR single-voice entries receive only the explicitly defined in-memory `legacy-single` target and read-only `legacy:` sentinel; retired manifests remain unsupported.

### Mandatory defect closure

The following ledger is part of the decision, not optional cleanup. ADR-020 cannot move to Accepted · Passed while any item remains reproducible.

| ID | Defect | Required closure | Acceptance signal |
|---|---|---|---|
| `MV-01` | Ten segmented targets ignore per-turn voices captured after collection | Replace mutable option override with explicit invocation voice and require the portable turn serializer on all 12 adapters | A/B/A actual serialized-payload assertions for all 12 providers, preserving Mistral behavior and Gemini's separate native behavior |
| `MV-02` | Final metadata reports requested mappings instead of actual voices and loses per-segment results | Build the versioned provider render result and canonical projection only from serializer-observed request/result records; represent multiple outputs, resources, takes, retries, and counts | Mocked final payload identity, domain result, and canonical projection match exactly; requested-only identity and unstarted turns cannot appear complete |
| `MV-03` | Existing tests and docs falsely imply every provider works | Add request-field assertions, capability matrix, and truthful help/output docs | Negative control fails when a provider reuses A for B; documentation matches tested model capabilities |
| `MV-04` | One unqualified speaker map is reused across provider namespaces | Restrict the current unqualified mapping to one provider and add provider-qualified cast records | One character maps to different valid IDs in ElevenLabs and Hume without cross-sending |
| `MV-05` | Generic screenplay normalization strips delivery and can silently omit speakers/content | Use structured comic turns; make generic input reject unmapped speakable roles and preserve supported delivery | Complete source coverage; no speaking role is silently dropped |
| `MV-06` | ElevenLabs/Speechify `SPEAKER=path` is advertised without safe per-character provisioning; cloning can occur at the wrong granularity | Provision once per approved registration in voice management and reject the unsafe synthesis path locally | One character creates at most one resource; missing consent/setup produces zero synthesis calls |
| `MV-07` | Remote resources can be created without durable pending/verification/retention state, and config can imply creation | Make resource creation explicit, persistent, resumable, and separate from synthesis | Created-but-unverified resources survive locally; `--price`, config load, and render never create them |
| `MV-08` | Gemini accepts invalid native speaker counts/formats and chunks raw labels unsafely | Enforce exactly two native speakers, normalize accepted formats, and split only at turn boundaries | Strict native makes zero calls for counts other than two; auto uses a preplanned segmented route for one or three-or-more; zero turns make no call; ordinary single-voice remains valid |
| `MV-09` | Hosted turn setup uses unbounded `Promise.all` outside the shared scheduler | Bound end-to-end turn work, cancellation, and cleanup | Configured limit is never exceeded; failure leaves no queued calls or `.work-*` directories |
| `MV-10` | Multi-target/native completion can report nonexistent dialogue paths; batch silently discards dialogue support artifacts | Promote the strategy-appropriate per-item/per-target artifact set before workspace cleanup and derive completion from canonical checksum-verified state | Segmented fixtures retain real normalized/segment/plan/result/final files, native fixtures retain native/plan/result/timing/final files without fabricated segments, and batch retains the same sets |
| `MV-11` | Speechify consent/locale/gender options are accepted but not all demonstrably sent or locally classified | Revalidate the live contract, serialize provider fields exactly, and label local-only provenance | Every accepted field affects the mocked request or a documented protected local record |
| `MV-12` | Mistral voice-name overrides are silently removed and references are repeatedly prepared | Create saved voices only in reference phase, reject inline naming, cache reference preparation | No ignored name; each unique reference prepares once; pre-created IDs work per character |
| `MV-13` | OpenAI custom voices use a different object/consent contract and current model status has drifted; xAI/Deepgram/Gemini catalogs are stale or truncated | Revalidate models and catalogs, use typed custom sources, record source/check date, and route selector changes through ADR-018's central registry | Voices in a dated cited fixture pass locally; stale models receive migration guidance; custom objects are not strings; unregistered discovered model identities cannot render |
| `MV-14` | Silent mono 16 kHz normalization and missing mix controls destroy or obscure quality | Preserve native sources, add explicit render/mix profile, and record conversions | Audio probes and cache tests match selected mastering settings; remix does not resynthesize |
| `MV-15` | Cache, resume, and benchmark keys collide for several voices on one provider/model | Separate adapter `targetKey` from voice-aware `renderIdentity` and include registration/snapshot-entry and optional character in benchmark rows | A cast or settings change cannot reuse a prior render, and two characters on one model remain separate scored rows |
| `MV-16` | Missing all-target preflight allows deterministic errors after another provider could begin paid work | Statically validate every target, voice, registration, source, consent, native limit, and output plan before optional read-only readiness checks | One deterministic invalid target causes zero provider calls; readiness calls are read-only, happen only after static success, and never overlap synthesis |
| `MV-17` | Existing reference/name config and combined clone/synthesis flags can create an unused or shared voice at run scope | Split synthesis and voice-management option types/resolvers, remove creation fields from generic processing types, and migrate resource-creating defaults | `tts`, `write`, resume, config load, and synthesis price cannot express or create a resource; explicit casts reject explicit global voice conflicts and outrank omitted inherited defaults; migration guidance names the management action |
| `MV-18` | Voice creation lacks crash-safe identity, consent/retention policy, and ambiguous-outcome recovery | Journal and lock provisioning, retain issued resources independently of every outcome state, require consent/provenance, and reconcile uncertain outcomes | Fault injection before request, after response, and before approval creates no untracked duplicate; revoked consent enforces cache/resume/export policy |

### Provider support profiles

All 12 existing providers share the same explicit turn contract. Advanced facets reflect real provider behavior rather than synthetic parity.

| Provider | Required portable baseline | Advanced adapter commitment under this ADR |
|---|---|---|
| Kitten | Local segmented stock voices with explicit per-turn speaker | Reconfirm and expose speed; remain the no-cost local development path |
| ElevenLabs | Explicit registered voice per turn and segmented repair | First-class library discovery, Voice Design, remix, Instant/Professional Clone state, audition, lifecycle, Text-to-Dialogue, timestamps, access constraints |
| MiniMax | Segmented stock/existing voice with per-turn controls | Capability descriptors for catalog/design/clone/activation; future facets plug into the common ports rather than new CLI-only fields |
| Groq | Segmented stock voice and model-specific directions | Reconfirm and add Saudi-Arabic model/voices separately from English direction support |
| xAI/Grok | Segmented stock or imported custom ID | Refresh 26-voice catalog; represent Enterprise/geographic custom creation as gated rather than implied |
| Mistral | Segmented saved voice or one-off reference audio | Preserve working dynamic voice behavior; cache references; add lifecycle/list facets where supported |
| OpenAI | Segmented supported stock voice | Revalidate active model; represent eligible-customer custom voice plus separate consent as typed gated facets |
| Gemini | Exactly-two-speaker native stock dialogue plus mandatory explicit single-speaker turn rendering | Full 30-voice catalog, prompt/profile controls, turn-safe partitioning, preview/access status |
| Deepgram | Segmented Aura voice-model per turn | Refresh the roughly 90-voice catalog and structured age/gender/accent/language metadata |
| Speechify | Segmented pre-provisioned voice ID | Repair consent/resource state; model approval gates; add native dialogue only after reconfirming the live API |
| Hume | Explicit registered voice per turn and segmented repair | First-class discovery, design, clone/import, audition, lifecycle, acting direction, native utterances, timestamps, continuation, access constraints |
| Cartesia | Segmented voice ID per turn | Capability facets for 500+ catalog, clone tiers, localization, pronunciation, speed, volume, and emotion |

New providers may be added after these interfaces stabilize. A new adapter must first pass the explicit-turn and capability-truth conformance suites; comic should then gain it without another workflow-specific dispatch branch.

### First-class ElevenLabs contract

ElevenLabs is the primary broad-casting implementation of the shared primitives:

- Discovery covers account voices and the shared library with pagination, previews and casting metadata where returned, while recording restrictions, `disable_at_unix`/notice/expiry, and model compatibility in a sanitized catalog record. The initial fixture recognizes the documented 2026-12-31 expiry of legacy Default voices and must refresh rather than silently selecting an expired default. Adding a shared voice retains a third-party source record with public owner/shared voice IDs and usage eligibility, plus a separate lineage-linked account resource for the returned account voice ID.
- Voice Design and remix create candidate previews, then materialize only the explicitly selected candidate. Remix records immutable source lineage and a local attempt ID; provider session/iteration identity is recorded only when explicitly supplied or returned. It never mutates the source voice. A `remixed-from` lineage requires an eligibility snapshot proving the source satisfies the dated ElevenLabs rule—currently an owned designed/IVC/PVC voice or an eligible shared-library voice with an infinite notice period—and distinguishes that source identity from any lineage-linked account copy. Missing or ineligible proof fails static preflight with zero provider calls. Candidate state includes an expiry only when the provider exposes one and otherwise records `unknown`/`not-exposed` rather than inventing a date.
- Instant Voice Cloning is an API provisioning path. Professional Voice Cloning, verification, plan, and library-access restrictions are represented as gated, pending, or external actions rather than generic failures.
- The canonical single-voice project audition runs after candidate materialization but before local approval/current-index promotion. A verification-required created ID is persisted immediately and cannot be approved until it becomes usable.
- Lifecycle can list, inspect, import, and explicitly delete project-owned account voices; it never deletes shared-library resources.
- Native dialogue uses Eleven v3 Text-to-Dialogue. Unique-voice, input-size, and per-voice origin/model compatibility are data in a dated, cited capability fixture, account/voice readiness observation, and adapter request schema, initially populated from the currently documented ten-voice ceiling and conservative 2,000-character planning boundary; the ADR does not freeze those values. Current guidance that a Professional Voice Clone may be less optimized on v3 is recorded as a quality warning, not fabricated categorical incompatibility. A PVC/v3 plan fails locally with zero calls only when fresh catalog/account evidence explicitly marks that exact voice/model/transport combination unsupported; otherwise the warning is manifest-visible and the planner splits only between turns.
- A plan may request a bounded number of dialogue takes because conversational generations can vary. Every take and its request/batch cost evidence are retained, with per-take amounts only when itemized or explicitly derived, and only the explicit selected take proceeds to effects and assembly.
- Native timestamps map dialogue input index, voice segments, provider-text character alignment, and the prepared-text source map to source `turnId` and canonical offsets on the take clock. Raw alignment, take-normalized timing, and the transformed or realigned final timeline are retained separately.
- Textual context and v3 audio tags map from delivery only when semantics can be represented. Unsupported required direction blocks native selection instead of disappearing.
- Text-to-Dialogue provides within-request context. The adapter does not invent a cross-request continuation token.
- Segmented rendering remains available for over-limit scenes, providers/accounts without native access, and explicit line repair using the same approved voice snapshots.

### First-class Hume Octave contract

Hume is the primary expressive and continuation-aware implementation of the shared primitives:

- Discovery covers Hume library and account custom voices and normalizes the documented `id`, `name`, and `provider` fields. It preserves tags or previews only where the API actually returns them; otherwise casting relies on a generated audition. Name-based locators must resolve to exactly one expected stable ID, and ambiguity is a blocking error.
- Voice Design currently requires Octave 1, produces described speech generations/candidates, and saves the selected generation as a custom voice. The resulting designed voice may then be used for Octave 2 synthesis, so creation-model and synthesis-model identity remain separate.
- Clone access is subscription-dependent. Until a public creation API is confirmed, the facet reports `external-action-required` and imports the resulting custom voice; it must not claim that the adapter performed cloning merely because the platform supports it.
- Audition uses the project audition set with explicit generation choices. Acting descriptions are included only when the chosen model supports them.
- Lifecycle lists and inspects custom voices. Because the documented Hume deletion surface takes a mutable name, deletion requires a fresh unique name-to-expected-ID proof immediately before the call; otherwise it becomes an external action even for a project-owned voice.
- Native rendering uses an ordered utterance array with a voice per turn plus only those controls supported by the concrete model. Speed and trailing silence are available across the relevant versions. Acting `description` is an Octave 1 constraint at the decision date, while word/phoneme timestamps require Octave 2; the planner must choose a compatible feature set or block/degrade an optional requirement during planning and cannot promise both merely because Hume supports each on some model.
- Hume can return one to five generations for a request. The planned count is budgeted at request level, each generation becomes a `RenderTake`, and continuation binds to the explicitly selected generation ID.
- Where the selected model supports them, Hume word and phoneme timestamp events map to source turns on the take clock and then pass through the recorded assembly transform or offline realignment to the final clock.
- Cross-request continuation promotes the complete successful Hume batch slot-result set, explicit take selection, and aggregate-result-independent generation/context checkpoint before materializing the next batch's slot-invocation plan. That plan uses only the immediately preceding canonical checkpoint, records the exact selected generation and Octave version actually serialized, and becomes part of final render-takes/result identity; Octave 1 output cannot continue an Octave 2 chain or vice versa. A resumed suffix may consume a verified checkpoint from a prior attempt. Once a downstream invocation has canonically consumed a selection, changing it requires a separately priced and authorized recoverable rebuild of the exact dependent suffix, with a new aggregate result, while the old aggregate/audio run remains immutable and selected until replacement success.
- Octave version, preview status, character/utterance/description limits, take count, output formats, speed range, design-model differences, clone access, and account state live in dated capability fixtures and readiness observations rather than being assumed globally. The initial fixture captures the current documented 5,000 text characters, 1,000 description characters, one-to-five generations, MP3/WAV/PCM outputs, and 0.5–2.0 speed range and must be revalidated immediately before implementation.
- Segmented rendering remains available for repair, incompatible controls, or an explicitly selected portable mode.

### Delivery milestones

Implementation is staged so correctness and the first useful comic path can be verified before the larger managed-provider surfaces. Final acceptance requires Phases 0 through 3 and closure of every `MV-*` item; Phase 4 is post-acceptance breadth.

| Phase | Required outcome | Dependency and verification gate |
|---|---|---|
| 0 — truthful shared TTS | Explicit per-invocation voices/controls for all current adapters; shared generation-slot/invocation/render/admission/provider-or-cache-result/audio-run contracts; operation-scoped adapter `targetKey`, voice-aware transient `renderIdentity`, append-only per-target render history, exact readiness/event pointers, typed policy skip, and canonical provider/stage status mapping for single and batch; minimal protected ingestion for unnamed Mistral request references; generic parser safeguards; strict Gemini planning; bounded scheduler/cancellation/cleanup; retained strategy-appropriate artifacts; current Speechify/request-field and model/catalog fixes; immediate local rejection of every explicit, configured, or inherited creation default | Fully closes `MV-01`–`MV-04`, the generic half of `MV-05`, `MV-08`–`MV-11`, and `MV-13`; adds interim gates for `MV-06`, `MV-15`, `MV-16`, and `MV-17`; must pass before comic synthesis or provisioning paths merge |
| 1 — reference primitives | Extend the protected asset store with audition/consent/preview/reconciliation policy; versioned briefs, append-preserving registrations/current index, candidate/materialization, provisioning journals/locks, canonical auditions, consent/provenance, approval, lifecycle/reconciliation, shared voice management, and full synthesis/management option/config separation; Mistral save/create occurs only here | Closes `MV-06`, `MV-07`, `MV-17`, and `MV-18`, completes `MV-15` only for approved registration identity and `MV-16` for registration, consent, access, and read-only readiness; depends on Phase 0 invocation/result contracts and creates no scene snapshot |
| 2 — comic MVP | Extend the canonical manifest with `command: 'comic'`; structured-script v4/source identity; exact compatible-run resolver; provider-neutral dialogue plan; all-target/profile casting; one aggregate immutable scene snapshot and append-only index; preliminary branch plans; all-target readiness; final immutable provider plans/render histories; generation-slot synthesis/cache materialization/results/take selection; consumed-selection suffix authorization/recovery; mix/timeline/final output; canonical completion; Gemini strict two-speaker native and approved Mistral saved/reference consumption | Completes `MV-15` for aggregate snapshot/render identity and closes the comic half of `MV-05`, `MV-12`, and `MV-14`; first end-to-end operational milestone; depends on Phases 0–1 and consumes only Phase 1-approved saved/reference registrations |
| 3 — first-class managed providers | ElevenLabs and Hume implement shared advanced conformance plus discovery, creation/import, audition, native dialogue/utterances, takes, timing, lifecycle, fallback, and Hume continuation | Required for ADR acceptance; depends on stable Phase 1 artifacts and Phase 2 render contracts |
| 4 — breadth | Additional MiniMax/Cartesia/Speechify design/clone/dialogue facets and then a new provider only for a defined gap | Optional post-acceptance work that may proceed incrementally without adding comic-local dispatch |

Every phase's `--price` path performs the same deterministic planning in memory, performs zero provider calls, and writes none of the protected, domain, or canonical artifacts described above.

### Acceptance gates

ADR-020 may move to Accepted only when all of the following are true:

1. Every `MV-*` item is closed by code, local contracts, and matching user documentation.
2. All 12 providers accept an explicit per-invocation voice or reject the specific voice source locally; no provider target obtains turn identity solely from captured collection options.
3. The A/X, B/Y, A/X mocked final-serializer voice/control matrix passes for the explicit-turn path on all 12 adapters, Gemini's native matrix passes separately, and output order remains source order under reverse completion.
4. Every comic run contains exactly one root unversioned canonical `manifest.json` with `command: 'comic'`, one strict versioned `item.metadata.comic = { stages, audio }` payload, and no alternate stage envelope; all ADR-owned nested JSON is strictly versioned and no nested artifact is named `manifest.json` or acts as resume authority.
5. Single and batch TTS persist exactly one canonical provider state per requested operation-scoped adapter target with unique top-level `operation`/`targetKey`/`transport`, unique create-only branch/readiness/admission/attempt/render artifact paths, voice-aware `renderIdentity`, append-only readiness/multi-render history with exact branch-readiness/render-event active pointers and selected-success pointers, typed non-masking policy-skip evidence, exact journal/result/audio-run references/checksums, operation-correct `ttsAudio`/`comicAudio` namespaces, and the complete readiness/provider/stage/item status matrix; a requested item cannot be `full` with an empty provider array, zero-turn generic TTS fails before collection, zero-turn comic audio uses the defined targetless local-full form, and comic audio cannot overwrite image/draft state.
6. Comic has versioned voice-brief, registration/current-index, audition/take-selection, dialogue-plan, aggregate snapshot, branch/final provider plan/result, planned generation-slot, admission-journal, incremental slot-invocation or cache-materialization-plan/provider-or-cache-result progress, consumed-selection rebuild authorization/recovery, cross-attempt/local aggregate render-takes, result-independent checkpoint, portable continuation fingerprint, detached cache-source provenance attestation, timing, mix/transform, timeline, and audio-run artifacts with explicit content identity, exact snapshot membership, checksum, path-safety, privacy, tamper, and acyclic dependency coverage.
7. `comic reference-voice` supports candidate/import, remote materialization, canonical audition before explicit local approval/current-index promotion, prior-generation identity, bounded price, and truthful resource/reconciliation states; an uncertain create can never be retried automatically or lost from `issuedResources`.
8. `comic generate-audio` implements structured-script v4 and the exact compatible-run algorithm, consumes one approved aggregate snapshot across every target and role, persists per-strategy priced preliminary branches, freezes reconstructable final plans only after all-target readiness, binds every admitted generation slot to one exact ready evidence sequence and write-ahead admission journal, resolves intra-render continuation through result-independent selected-batch checkpoints and just-in-time slot-invocation or cache-materialization plans, supports checksum/range/semantic/binding-compatible native/segmented/explicit-repair hybrid planning, materializes cache hits as current zero-dispatch results with stable provider-facing fingerprints and exact current DAG edges, closes any zero-dispatch aggregate locally regardless of prior result provenance, rebuilds a changed consumed take only through an authorized recoverable suffix, assembles into a canonically referenced content-identified audio run, and reuses only confirmed eligible canonical work without repurchasing partial, ambiguous, interrupted, or invalid work.
9. Relative/absolute/symlink input spellings converge, same-basename paths and byte drift do not, newest incompatible automatic candidates do not hide an older compatible run, a pinned mismatch never falls back, and failure to find a match creates no fresh run.
10. Protected reference, audition, consent, preview, and reconciliation bytes remain in registered protected stores whose roots/workspaces are realpath-disjoint in both directions from every scene/publish output; arbitrary `--output-dir`, path-shaped opaque IDs, symlink overlap, canonical/domain artifacts, logs, and errors cannot expose raw protected paths, contact PII, protected bytes, secrets, or unsanitized provider responses.
11. Segmented, native, hybrid, single-target, multi-target, and batch completion retains the strategy-appropriate checksum-verified files after cleanup, including every current cache-materialized result's contained entry/attestation/source-result provenance copies, reaches them through the selected canonical audio-run record, survives later cache eviction, and advertises neither missing dialogue files nor fabricated native segments.
12. Generic synthesis and voice-management option types/resolvers are disjoint. `tts`, `write`, resume, config merge, and synthesis price reject every explicit, configured, or inherited resource-creation default before collection/provider setup; an explicit global voice plus dialogue cast is an error and an inherited global voice cannot override the cast. An unnamed Mistral raw reference exists only at the generic-TTS CLI edge, price does not materialize it, and execution replaces it with an opaque protected reference before target collection; comic uses only approved saved/reference registrations captured in its aggregate snapshot.
13. Static/config validation and all price modes cause zero provider calls and zero remote/local artifact mutation; price output is stdout only. Optional execution readiness is separately named, read-only, completes for every target, and begins only after deterministic local validation succeeds and before any final plan or synthesis; a blocked target is a typed zero-attempt branch-plan failure, every ready peer is a typed zero-attempt dependency-readiness failure, and no target receives a final `ProviderRenderPlan`, render identity/history entry, post-readiness snapshot claim, or synthetic `ProviderRenderResult`.
14. ElevenLabs and Hume pass one shared advanced-provider conformance suite plus their provider-specific discovery, creation/import, take, native, timing, lifecycle, access, fallback, and continuation contracts. ElevenLabs proves bounded many-slot/one-take native generation and conditional per-voice PVC/v3 readiness; Hume proves one-slot/many-take generation and crash-safe selected-take suffix continuation. Gemini strict exactly-two-speaker native, auto segmented, single-voice, and turn-safe boundary contracts pass, and generic Mistral request-time reference plus comic-approved saved/reference-registration behavior remain regression guards.
15. Existing canonical pre-ADR single-voice states remain readable only through the defined derived target and read-only `legacy:` sentinel, which cannot authorize cache reuse, resume synthesis, or a provider request. Unsupported domain schemas and retired `run.json`, audio-manifest, checkpoint-manifest, pricing/report/resume formats fail with rebuild guidance; no compatibility scanner or upgrader returns.
16. Phases 0 through 3 have independently recorded local verification evidence, and the ADR-008/ADR-018 inventories are updated wherever implementation materially changes their owned scheduling or model contracts.

## Rationale

- Voice identity is durable project state, not a transient string flag. Separating authored briefs, provider registrations, approved auditions, and immutable snapshots makes character continuity reviewable and resumable.
- Explicit invocation identity fixes the root dispatch defect. Another provider-specific override table would remain vulnerable to collectors that close over selection values.
- Capability facets maximize provider coverage without pretending that every provider can design, clone, continue, or render native dialogue. A minimum segmented contract works broadly; advanced facets remain truthful and composable.
- ElevenLabs and Hume exercise almost the full abstraction surface in complementary ways. ElevenLabs proves large-library casting, design/clone variants, and native dialogue with alignment; Hume proves model-scoped acting direction, separate timestamp-capable plans, contextual batches, take selection, and version-compatible continuation.
- Native and segmented paths are both necessary. Native rendering can improve conversational coherence; segmented rendering provides provider portability, deterministic repair, local effects, and granular caching.
- Result-independent generation-slot results are necessary for both first-class providers: ElevenLabs needs several deliberate requests before one logical-batch selection, while Hume's next batch must consume a selected generation before a future aggregate exists; crash resume may finish either render in later attempts without repurchase.
- Building dialogue plans from structured comic source preserves exact text, canonical speaker identity, delivery, and source synchronization that the generic screenplay normalizer currently loses.
- Explicit preflight and separate provisioning prevent deterministic failures, duplicate clones, hidden remote resources, and unplanned fallback spend.
- The reference-image lifecycle proves atomic writes, copied-asset checksums, and rollback protection, but its singleton index is overwriteable. Voice snapshots reuse the proven mechanics while strengthening them into create-only snapshots and an append-only identity index without coupling audio state to visual schema.
- Serializer-observed request/result evidence is the only trustworthy basis for the detailed result, canonical projection, cost reports, benchmarks, and debugging.

## Consequences

Positive outcomes:

- Every current provider can participate in comic dialogue through a truthful explicit-voice baseline when its ordinary TTS adapter supports the selected voice source.
- ElevenLabs and Hume become full character-voice platforms instead of generic one-string TTS targets.
- Comic gains stable reference voices, audition/approval, multi-provider casting, exact source linkage, local repair, effects, and timeline artifacts.
- Remote voice creation, verification, approval, expiry, revocation, and deletion become observable lifecycle states rather than hidden side effects.
- Native dialogue can be used where it fits without making it the only path or hiding provider ceilings.
- Per-turn results, caches, and benchmark keys become truthful and independently reviewable.
- Provider expansion becomes a conformance task against stable facets rather than another comic dispatch branch.

Negative outcomes:

- The TTS type and artifact surface grows substantially, and current `TtsTarget`/`Step4Metadata` callers must migrate.
- Voice registrations and consent/provenance introduce sensitive lifecycle state that requires careful redaction and project policy.
- Supporting native and segmented rendering creates two execution paths and a more complex resume/timing model.
- Native alternatives and continuation add per-generation-slot and per-batch persistence, cache-materialization provenance, consumed-selection authorization, and cross-attempt aggregate validation even when a provider finishes in one request.
- First-class ElevenLabs and Hume features are plan-, preview-, verification-, or external-action-dependent and require frequent documentation revalidation.
- Preserving native provider output, normalized working audio, protected auditions, snapshots, segments, and versioned domain artifacts uses more disk space.
- The current unqualified speaker mapping remains single-provider-only; multi-provider casts must use provider-qualified records.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Stable provider-neutral character identity | More schemas, lifecycle state, and migration work |
| Broad segmented compatibility plus provider-native quality | Two render strategies and explicit strategy planning |
| Crash-safe selected-take continuation across provider batches | Per-batch invocation/result/selection/checkpoint state and cross-attempt composition |
| First-class ElevenLabs and Hume capabilities | Deeper provider-specific adapters and more contract fixtures |
| Auditable consent, provenance, resource state, and actual request identity | More project metadata and stricter preflight |
| Targeted line regeneration and local remix without repeat spend | Persistent segment/native-batch caches and storage cost |
| Truthful capability and account-access reporting | Some documented capabilities surface as gated or unavailable instead of optimistic flags |
| Immutable voice continuity across scene resume | Explicit reference generation and promotion before full dialogue |
| Higher-quality configurable masters | More audio-format and post-processing decisions than fixed mono 16 kHz output |

## API / Type Impact

- Extend `PROCESS_COMMANDS`/`ProcessCommand` with `comic`. A comic scene uses the existing unversioned `PipelineManifest` envelope and serialized atomic writer, not a new manifest family.
- Extend `PipelineProviderState` and its strict parser with optional top-level `operation`, `targetKey`, and `transport`, required for new TTS/comic states. Add the one strict versioned `item.metadata.comic` envelope and shared `CanonicalAudioProviderProjection`, serialized as `ttsAudio` or `comicAudio` by operation, with immutable preliminary/readiness/attempt paths, exact branch-readiness/render-event active pointers, typed initial-only policy-skip evidence, selected success, and append-only render events/history. Update provider-state matching, item/stage validation, creation/update helpers, resume, reporting, and batch persistence to use exact operation-target cardinality and the status rules above.
- Replace the service/model-only `getGenerationTargetKey` behavior for new TTS with `canonicalTargetKey(operation, service, model, transport)`, and introduce the separate voice/settings-aware `renderIdentity`. `writeGenerationMetadata` and `writePipelineItemRecords` must accept complete provider states rather than infer them from flat completion arrays.
- Replace `MultiSpeakerStrategy = 'native' | 'segment-and-concat'` with a provider render-plan model that distinguishes native dialogue, native utterances, segmented, and explicit hybrid repair.
- Change `TtsTarget.run` or add a target invocation boundary so every call receives explicit voice, speaker/source identity, typed controls, scheduler context, output profile, and cancellation rather than discovering voice identity from captured selection or a mutated options bag.
- Split `TtsSynthesisRuntimeOptions` from `VoiceManagementRuntimeOptions`. Keep raw unnamed Mistral input in an edge-only `TtsCliReferenceInput` that becomes an opaque protected reference before target collection. Remove ElevenLabs/Speechify clone/name/consent fields, named Mistral save inputs, raw paths, and future create/import fields from `TtsRuntimeOptions`, `WriteRuntimeOptions`, `ProcessingOptions`, `TtsTargetSelection`, `CommandPricingOptions`, and `buildProcessingOptions`; add a separate management resolver/config migration.
- Replace `SpeakerVoiceMapping.voice: string` as the authoritative multi-provider identity with provider-qualified registrations, a profile-qualified current index, aggregate immutable snapshots, and resolved bindings. The current `--tts-speaker` parser remains an adapter only for one selected provider and cannot create a resource.
- Split `DialogueTurn` into shared provider-neutral `CanonicalDialoguePlanNode` records used by distinct generic/comic dialogue-plan artifacts and provider-resolved turns carrying prepared-text mapping and snapshot entries; generic text normalization remains a generic-input producer rather than the canonical comic path.
- Add strict versioned `ComicSourceIdentity`, `GenericTtsSourceIdentity`, `GenericTtsDialoguePlan`, `StructuredScriptArtifactRef`, structured-script v4, `CharacterVoiceBrief`, registration/current-index, protected-store/asset locator, provisioning and render-admission journals/evidence, `ProviderPolicySkipEvidence`, `ProviderGenerationSlotPlan`, `ProviderBatchInvocationPlan`, `ProviderContinuationSemanticFingerprint`, `CacheSourceProvenanceAttestation`, `CacheMaterializationPlan`, `CurrentCacheProvenanceCopy`, provider/cache-discriminated `ProviderBatchResult`, `ConsumedSelectionRebuildAuthorization`, `SynthesisCacheEntry`/materialization evidence, candidate, audition/`ProviderTimingEvidenceArtifact`/`RenderTakesArtifact`/`TakeSelection`/`ContinuationCheckpoint`, `VoiceReferenceManifest`, `ComicDialoguePlan`, `ProviderRenderBranchPlan`, final `ProviderRenderPlan`, readiness/result evidence, serializer-observed cross-attempt/local `ProviderRenderResult`, take/final `NormalizedTiming`, `AudioMixPlan`, `AudioTransformLedger`, `FinalTimeline`, and `AudioRun` schemas.
- Add the exact compatible-scene resolver and remove audio planning's dependency on the slug-only latest-run helpers/cache. Add append-only snapshot index compare-and-swap and contained domain-artifact reference helpers.
- Add capability-faceted provider adapter types for catalog, design, clone, lifecycle, audition, native dialogue, timing, and continuation, plus the shared `voice` management and native `comic reference-voice`/`comic generate-audio` command surfaces.
- Replace ambiguous `chunkCount` and singular clone fields with turn, logical-batch, generation-slot, provider-request, cache-materialization, generated/selected-take, output, and issued-resource collections. Only current canonical pre-ADR single-voice projections receive the defined read-only `legacy:` sentinel; no retired summary reader is retained.
- Add a bounded dialogue work selector that composes with hosted lanes and local resource gates; update ADR-008 after the scheduler inventory changes.
- Update pricing/preflight types to represent unique provisioning, candidate/take, synthesis-batch, and local assembly costs while preserving zero-call, zero-network, and zero-mutation price behavior. Update benchmark keys to use adapter target plus render/binding identity.

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Phase 0: add shared capability/access evidence, transient voice binding, explicit per-turn voice/control invocation, provider render plan, planned generation slots, just-in-time slot-invocation/provider-or-cache-result progress, per-slot admission recording, cache materialization, consumed-selection rebuild authorization/recovery, cross-attempt/local aggregate result/audio-run, prepared-text, timing/take/cost linkage, operation-scoped target/render identities, append-only render history, and canonical provider/stage/status/skip contracts | TTS maintainers | Done on 2026-08-11 |
| Phase 0: replace mutable per-turn option overrides and repair explicit voice dispatch for all 12 providers while preserving Mistral reference behavior and Gemini native behavior | TTS provider maintainers | Done on 2026-08-11 |
| Phase 0: repair single/batch canonical persistence cardinality, reject empty-provider success, retain the strategy-appropriate artifact set, and add the parameterized A/B/A/status/negative-control contracts | TTS and manifest maintainers | Done on 2026-08-11 |
| Phase 0: add deterministic all-target validation, minimal protected ingestion for unnamed Mistral request references, and rejection of explicit/configured/inherited creation defaults before target collection in render/resume/price paths | CLI and config maintainers | Done on 2026-08-11 |
| Phase 0: add the bounded dialogue selector, cancellation, ordered results, provider-lane telemetry, local resource gating, and safe workspace cleanup; update ADR-008's current-state inventory | Scheduling maintainers | Done on 2026-08-11 |
| Phase 0: repair Speechify request serialization/local-only classification and refresh or locally reject stale xAI, Deepgram, Gemini, OpenAI, and Groq contracts through ADR-018 wherever selectors change | TTS provider maintainers | Done on 2026-08-11 |
| Phase 1: extend the protected asset store with audition/consent/preview/reconciliation policy, add crash-safe provisioning journals/locks, pending/verification/approval/reconciliation/retention/deletion state, consent/provenance policy, and shared `voice` management | Voice lifecycle maintainers | Done on 2026-08-11 |
| Phase 1: add versioned `character-voices.json`, append-preserving registrations/current index, standard audition/take metadata with opaque asset references, and atomic local approval | Comic maintainers | Done on 2026-08-11 |
| Phase 1: retain Phase 0's strict synthesis/config separation, add management-only creation resolution, and provide the complete managed migration path without a retired persistence reader | CLI and config maintainers | Done on 2026-08-11 |
| Phase 2: extend `PROCESS_COMMANDS` and canonical persistence for comic, migrate structured-script to v4/source identity, and implement exact compatible-run selection | Comic and manifest maintainers | Done on 2026-08-11 |
| Phase 2: add provider-neutral dialogue plans, compound/overlap role policies, all-target casting, create-only aggregate snapshots/append-only index, preliminary branch plans, all-target readiness, final provider plans/results, and `comic generate-audio` | Comic maintainers | Done on 2026-08-11 |
| Phase 2: add segmented/native-generation-slot/effect/mix caches, current-render cache materialization, selected takes, configurable mastering, timing normalization, licensed asset snapshots, timelines, `audio-run.json`, and canonical dependency-aware resume | Audio workflow maintainers | Done on 2026-08-11 |
| Phase 2: reuse Phase 0's strict Gemini exactly-two-speaker native planning and turn-safe partitioning in comic; consume only approved Mistral saved voices or approved request-reference registrations whose protected locator is captured in the scene snapshot; keep transient unnamed request references generic-TTS-only | Gemini and Mistral maintainers | Done on 2026-08-11 |
| Phase 3: implement ElevenLabs discovery/import, design/remix lineage, clone state, pre-approval audition, lifecycle, bounded native Text-to-Dialogue takes, prepared-text alignment, access readiness, and segmented repair | ElevenLabs adapter maintainers | Done on 2026-08-11 |
| Phase 3: implement Hume discovery, design, clone/import state, pre-approval audition, safe lifecycle, model-constrained acting/timing, native takes, selected-take continuation, access readiness, and segmented repair | Hume adapter maintainers | Done on 2026-08-11 |
| Phase 4: add remaining MiniMax, Cartesia, and Speechify catalog/design/clone/dialogue facets, then propose a new provider only for a demonstrated casting or privacy gap | TTS provider maintainers | Done on 2026-08-11; no demonstrated gap requires another provider |
| Make benchmark keys voice-aware and update generic/comic TTS help, capability tables, output documentation, and examples | Documentation and benchmark maintainers | Done on 2026-08-11 |
| Recheck ElevenLabs and Hume official limits, access tiers, preview status, and lifecycle endpoints immediately before implementation and record check dates in capability fixtures | TTS provider maintainers | Done on 2026-08-11 |

## Test Plan

Build the shared contracts and a local fake provider first. Every advanced adapter must pass the same conformance suite before provider-specific request fixtures are added.

Core local contracts must prove:

- Capability records distinguish scope, maturity, channel, adapter support, simultaneous provider requirements, feature/model/transport constraints, dated source evidence, and credential-scoped account observations; mismatched fixtures and invalid combinations are rejected.
- Static/config and price validation perform no network, artifact mutation, or resource creation and fail all deterministic errors before optional read-only readiness or any target starts.
- Two invocations of one collected target can use different transient or approved voices without mutating the original options, and every materially different model request serializer is covered.
- A comic run has exactly one unversioned root canonical manifest, exactly one strict `item.metadata.comic = { schemaVersion, stages, audio }` envelope, and no nested bare manifest; every domain sidecar is strictly versioned, content-identified, contained, checksum-bound, and incapable of overriding canonical resume state. Render, attempt, provider/cache-batch-result, local-composition, and audio-run internal paths use their correct identity-independent relative type; absolute, parent-prefixed, self-identity-prefixed, cross-root, traversal, and symlink-escaping variants fail.
- Single and batch TTS persist one provider state for every and only every requested operation-scoped target. Duplicate `targetKey`, duplicate/escaping target or render directories, voice-insensitive `renderIdentity`, a sidecar/canonical status disagreement, and a `full` item with an empty provider array fail strict parsing.
- Two materially different branches and renders of the same target retain immutable canonical artifacts and history; repeated contradictory readiness checks of one branch affect status only through the exact projected sequence, reactivation clears that sequence, earlier event references still verify after later work, and transition ledgers append monotonically. `activeWork` projects an exact branch/readiness attempt or `(renderIdentity, eventSequence)` even when multiple results share one static identity; a new zero-attempt branch or failed rerender does not displace the exact `selectedSuccess`, audited rollback restores that successful event rather than merely its render identity, and conflicting same-identity bytes fail. Newly written audio state without active work fails. Content-identified policy-skip evidence with an allowed reason is the only zero-attempt `skipped` provider form and is rejected if any work/history exists; missing, arbitrary, unsupported-as-skip, or target-mismatched evidence fails. Generic TTS accepts only the shared `ttsAudio` projection, comic audio accepts only `comicAudio`, and wrong, missing, or dual namespaces fail. Mixed comic image-success/audio-failure and image-failure/audio-success fixtures prove stage-scoped updates and aggregate item status; provider-backed, local, optional, and not-requested stage reducers are exercised with ownership and zero/nonzero-target invariants. A zero-speakable-turn comic audio stage is a targetless local `full` with only structured/empty-dialogue artifacts and no provider/audio run, while generic zero-turn TTS fails before collection.
- The full provider-result/readiness-to-provider-status/item-status matrix holds, including a ready peer's zero-attempt `dependency-readiness-failed` state when another target blocks. Readiness failure creates no final plan/history/result, provider-dispatch attempts are distinct from deliberate generation slots and HTTP retries, and partial/ambiguous outcomes retain evidence but cannot report success or auto-repurchase. A native logical batch awaiting remaining slots, manual selection/checkpoint, or a cross-attempt unresolved dependency remains `running` without an aggregate result; provider synthesis success without a committed `AudioRun` also remains `running`. Crash recovery and local selection/assembly/cache materialization reuse verified outputs with zero provider calls, and neither provider nor item becomes successful until the audio-run transition commits. Every dispatching attempt resolves one exact fresh ready-ledger sequence/path/hash/candidate/account-evidence set; missing, blocked, stale, wrong-branch, wrong-candidate, wrong-account, wrong-scope, and hash-substituted authorizations fail before synthesis, while local-only work creates no provider attempt. A fake-provider admission journal fixes the exact `(batchId, generationSlotId)` set for each attempt, appends unresolved-continuation requests just in time, permits only dependency-valid materialization on non-success, and binds every request's slot invocation and proof to the exact journal, invocation, ordinal, fingerprint, and transition-specific proof kind. Hume one-request/many-take and ElevenLabs many-planned-request/one-take slots are both exercised; deliberate slots are never mislabeled as retries. Definite success follows accepted/completed, authoritative rejection follows dispatch/rejected, and ambiguity follows dispatch/ambiguous without fabricated acceptance or completion; every cross-kind proof fails. Provider-result promotion is recorded only by a descendant of its admission basis, and an aggregate closed by a provider attempt is recorded only by that closing journal's descendant carrying the exact result-set hash. Any zero-dispatch aggregate is instead promoted by a content-identified local composition, including a prior provider-produced prefix plus cache-only suffix; cache-origin members require complete materialization evidence and provider-origin members resolve through their original journals. Wrong, duplicate, predecessor-inverted, slot-substituted, cross-attempt-substituted, or mutated bindings fail. Crash injection before slot-invocation commit, before cache-materialization-plan commit, before `prepared`, before `dispatch-started`, after dispatch, after acceptance, after each slot-result promotion, after selection/checkpoint, between attempts, after aggregate promotion, and before canonical commit proves safe composition without repurchasing accepted work; missing/forked/tampered/cross-bound progress/evidence and every other interrupted outcome reconcile.
- All 12 providers send A/X, B/Y, A/X for Alice/Bob/Alice through explicit turn rendering and preserve source output order under reverse completion; the detailed result and canonical projection come from final serializer observation rather than the plan, every requested turn has one linked outcome with no orphan request/batch/output, and Gemini's separate native request contract also remains covered.
- Each candidate has its own capability scopes, observations, readiness disposition, and planned cost: `auto` with blocked native/ready segmented selects only segmented, strict native blocks, contradictory readiness/disposition variants fail parsing, and the final scope/strategy/candidate ID must equal one ready candidate. Capability fixtures and stable account/voice-revision identity affect final plan/render identity, while a fresh compatible dated readiness observation can authorize the same identity; wrong-account, wrong-scope, stale, unmet, or changed-revision evidence blocks before synthesis. Fixture-only targets emit a no-network local ready result for execution authorization. When one target blocks, every target has only branch/readiness evidence: no final plan/history is written and the aggregate snapshot makes no post-readiness claim.
- Native, segmented, strict-native failure, planned preflight fallback, and explicit hybrid repair are deterministic and manifest-visible. Final-plan fixtures prove that request controls, output, batch boundaries, generation-slot count/IDs, per-slot take counts/cost, selection policy, total planned cost, external selected-checkpoint identity, and intra-render predecessor-batch dependency affect or validate the hashed plan; each preliminary candidate has its own scopes and cost. Different intra-render selected takes retain the priced plan but change just-in-time downstream slot-invocation and final-result identities. Hybrid fixtures require the complete repair dependency in both the priced preliminary candidate and final plan, mutate the base target/source/dialogue/result, reused output path/checksum, text/prepared-text/snapshot-entry/voice-revision/control/delivery/output-format compatibility, source range, and resubmission set, and reject uncommitted bases, orphan/overlapping/duplicated ranges, succeeded resubmission, failed-output reuse, or branch/final repair mismatch before any provider call. Segmented assembly binds every current segment to its exact result/output/path/checksum as `provider-output`; hybrid assembly binds resubmitted segments the same way and compatible base ranges as `reused-output`, with cross-result, missing, duplicate, and mislabeled source variants rejected.
- The bounded dialogue selector never exceeds existing run-global provider and local limits, counts actual provider generation slots/requests and segmented chunks rather than only logical native batches, treats cache materialization as local work, is not multiplied by comic visual concurrency, composes with provider lanes without deadlock, cancels queued work after failure, and leaves no temporary workspaces.
- One cloned/designed registration provisions exactly once across concurrent jobs and processes; two characters provision exactly twice; failed or unresolved provisioning causes zero synthesis calls.
- Fault injection before provider creation, after a response, and before local approval yields a durable typed-operation journal whose protected lookup evidence and independent `issuedResources` survive every terminal/error state, or `reconciliation-required`, never an automatic duplicate.
- Pending, verification-required, approval-required, expired, revoked, missing, and deleted resources fail or resume according to their explicit state.
- Missing or revoked consent blocks the configured combination of upload, new synthesis, cache reuse, resume, export, and retention; logs and all ordinary artifacts exclude prohibited contact/consent/raw identity PII and protected paths while permitting only the defined opaque audit actor IDs.
- Generic transient plans work without a fabricated `snapshotId`, invalid approved/pending or approved/unauditioned registrations fail strict parsing, and comic plans require only ready approved entries from one aggregate snapshot.
- Strict provider-qualified casts map one character differently per target and reject duplicate targets, duplicate speakers, or locator/target provider mismatch. Explicit, configured, and inherited creation defaults fail before collection in `tts`, `write`, resume, and price; an explicit global voice plus a cast is rejected, an inherited global voice is omitted, unmapped speakable roles fail, and migration errors are actionable. The Phase 0 unnamed Mistral reference works through execution-only protected ingestion while price writes nothing and neither path exposes the raw source path in generic runtime/canonical state.
- Generic inline/file/batch-item sources derive stable non-body source identities and checksum-bound generic dialogue plans; path/item/content drift changes identity, comic/generic plan substitution fails, and legacy sentinels never authorize cache or provider execution. Generic labeled/screenplay fixtures preserve supported leading parentheticals, reject unknown speakers, classify action/stage content explicitly, and prove complete speakable-source coverage without routing through comic parsing.
- Structured comic dialogue preserves exact source text and migrated delivery/stage/timing source spans, speaker identity, V.O./O.S., captions/narration policy, named non-character roles, compound/synthetic roles, overlap children, panel deduplication, and complete source coverage.
- Source selection covers relative/absolute/symlink spellings, same-basename files in different directories, byte drift, unsupported/corrupt structured artifacts, newest-incompatible plus older-compatible candidates, pinned mismatch with no fallback, and no fresh directory creation on failure.
- Current-index approval is atomic and multiple approved profiles coexist. Aggregate snapshots are create-only and idempotent by the full canonical record, same-ID/different-bytes is corruption, the index is append-only under compare-and-swap, mutation of every non-ID dependency changes/rejects identity, entry IDs are unique, embedded binding bytes/hashes must exactly match indexed members, one snapshot covers every target/role, and later current-registration changes do not affect prior runs.
- An arbitrary pinned scene output contains no reference/audition/preview/consent bytes, raw protected paths, performer email, or contact PII; unsafe `role:narrator`/provider/model path components, path-shaped protected IDs, protected/output root overlap in either direction, registered-store/workspace symlinks, and containment escapes are rejected.
- Segmented caches include complete approved or transient binding identity and invalidate only changed turns. Native generation-slot caches invalidate the containing slot and Hume downstream continuation dependencies; ElevenLabs alternative slots cannot reuse one cached candidate twice. Versioned cache entries reject schema/toolchain drift. Cache creation requires a canonically committed source provider result and emits a content-identified sanitized provenance attestation over its source event, invocation, terminal admission chain, input predecessor selection/checkpoint/take semantics, request, result, output, and timing hashes; the entry is independently invalid after source cleanup if any retained projection or role is absent or mismatched. A native continuation cache key uses the stable provider-facing fingerprint and excludes run-local result/selection/checkpoint/take IDs, while every hit first writes a current-render `CacheMaterializationPlan` binding those exact current DAG IDs and proving that they derive the same fingerprint. A cache hit then creates a current-render cache-materialization `ProviderBatchResult` with copied/content-addressed outputs and contained cache-entry/attestation/source-result provenance, exact plan/source/destination evidence, current execution identity, and zero request/admission/attempt/resource/retry/spend fields; direct cross-render result/path reuse fails. Cache eviction before promotion yields an ordinary miss, while eviction after canonical promotion cannot affect completion, resume, selection, assembly, or verification because no required current artifact remains cache-resident. Mixed cache/provider and all-cache compositions validate, and any composition whose final frontier is cache-only closes locally with zero new provider attempts, including a partial or rebuilt provider-produced prefix plus cached suffix. Fixtures delete the source run before a portable multi-batch Hume hit and separately tamper the attested source event, invocation, admission, predecessor selection/checkpoint/take, fingerprint, result, output, and timing projections; each mismatch fails. Another fixture evicts the cache namespace immediately after canonical materialization and proves result validation, crash resume, take selection, and final assembly from contained current artifacts with zero provider calls; removing or mutating any contained provenance copy fails. Additional fixtures prove cached-downstream selection consumption, authorized reselection invalidation, changed-turn completion, and the aggregate/audio-run graph without fabricated requests. Mix-only changes perform zero provider calls.
- Provider-text tags/normalization retain zero-based half-open canonical offset maps with declared units, gap/ordering/coverage invariants, and non-BMP/combining/multilingual and boundary fixtures; time conversion/rounding is deterministic, take and final clocks remain distinct, unavailable timing contains no fabricated numeric ranges, and every returned token carries a source turn ID.
- Each native provider request persists a slot-specific immutable invocation plan and aggregate-result-independent provider-dispatch `ProviderBatchResult`; local cache materialization persists a content-identified dependency plan plus the discriminated zero-dispatch result. Only the complete planned slot-result set can create the batch-keyed unselected record; first selection supersedes it, an optional checkpoint binds the selected result/take without a future aggregate ID, and `RenderTakesArtifact` later indexes exact render-relative slot results from attempts and cache materializations. Hume one-slot/many-take and ElevenLabs many-slot/one-take fixtures both pause manual selection before downstream dispatch; a different selected take changes downstream invocation/materialization/result/aggregate identities without a cycle. A succeeded aggregate contains every planned slot exactly once; independent segmented partial progress may be a noncontiguous plan-ordered subset, while continuation progress must be a dependency prefix. Missing, duplicate, overlapping, wrong-plan, wrong-slot, non-immediate, stale-continuation, or incompatible results fail. Once either a provider invocation or cache materialization consumes a selection, local old-aggregate reselection is rejected before artifact creation; a fixture must price the exact dependency closure, create/checksum an authorization, atomically reserve the expected event/selection leaf together with its initial journal or zero-dispatch local composition, discard stale suffix progress, and preserve the old exact `selectedSuccess` on failure before atomically advancing it on replacement success. Crash after every rebuilt slot proves each recovery journal retains the same authorization/reservation, admits only the safe remaining slot subset, excludes complete/ambiguous work, never double-counts authorized planned/observed cost, and never repurchases. An unconsumed terminal selection may compare-and-swap a replacement `AudioRun`/success event without provider work or without a checkpoint when no compatible candidate exists. Stale, forked, skipped, cross-artifact, wrong-prefix, wrong-cost, wrong-suffix, or aggregate-result-dependent records fail, and orphan/competing-CAS fixtures prove older events validate against their sequence-local selection while selected/published pointers move together. Every output/take retains current batch-result-relative located/checksummed audio, identity, and timing. Versioned checkpoint/timeline/mix/transform/audio-run identities change with dependencies; batch/slot/output/selection source mismatch fails. Invocation-qualified cost evidence aggregates exactly once into current composition, local cache materialization is zero, closing-attempt and cumulative historical spend remain distinct, currencies never cross-sum, and any per-take allocation is labeled derived.
- Final audio probes match selected sample rate, channel, codec, duration, pause, crossfade, and loudness behavior.
- Room-tone/effect changes use safe checksummed licensed snapshots, invalidate only local effect/mix work, and never leak protected reference assets.
- Segmented completion retains normalized dialogue, real current-result `provider-output` segment bindings, plan/result, timeline, and final audio; native completion retains plan/result, selected `take` bindings, native output/timing, selection, timeline, and final audio without fabricated segments; every cache-materialized result retains its contained entry/attestation/source-result provenance alongside current audio/timing; hybrid completion retains both current resubmission and verified base-result source bindings; batch retains the same per-item/per-target set after workspace cleanup and cache eviction.
- Multiple voices on one provider/model remain separate benchmark rows, current canonical pre-ADR single-voice records remain readable through the non-reusable `legacy:` sentinel, and retired run/pricing/report/resume/benchmark formats remain rejected.

ElevenLabs mocked contracts must prove:

- Library/account discovery pagination and metadata normalization.
- Design/remix candidate creation and non-recursive lineage, missing provider iteration IDs, unknown candidate expiry, eligibility-proved remix with zero-call rejection when proof is absent/ineligible, materialization, canonical audition before local approval, separate shared-source/account-copy identity, and expiry/deletion-eligibility handling.
- Instant clone ready/pending/verification states and gated professional-clone behavior.
- Project-owned lifecycle management without deleting library voices, including `disable_at_unix`/notice evidence and the documented legacy Default-voice expiry fixture.
- Native plan rejection or turn-boundary partitioning at voice/character limits; PVC/v3 quality-warning propagation; and zero-call rejection only when dated per-voice/model readiness evidence explicitly says unsupported.
- Text-to-Dialogue final-serializer voice identity, input-order mapping, bounded single-take generation slots, one deliberate non-retry request/result/cost per slot, crash-safe accumulation before batch-level selection, provider-to-canonical text alignment, take/final timestamp transformation, and within-request context boundaries.
- Segmented repair uses the same approved snapshots.

Hume mocked contracts must prove:

- Library/custom discovery and name-to-ID resolution.
- Octave 1 Voice Design candidate selection, saving for Octave 2 use, canonical audition before local approval, and ambiguous-name rejection.
- Clone API or external-action state is reported truthfully for the current documented surface.
- Model-constrained planning never combines Octave 1-only acting description with Octave 2-only timing; speed and trailing silence remain available where documented.
- Ordered native utterances retain per-turn voice and every supported planned control.
- One Hume generation slot returns one-to-five takes that retain independent identity/take timing under one request-level cost, and word/phoneme events map to source turns and the final transform where the chosen model supports them.
- Generation/context checkpoints are aggregate-result-independent, resolve only from the immediately preceding canonical selected successful logical-batch take of the same Octave version, and are frozen into each just-in-time downstream slot-invocation plan before dispatch. Crash/resume composes prefix and suffix slot results from different attempts without repurchase. Changing an unconsumed terminal take is local-only; changing a continuation-consumed take is rejected as a local edit and exercises separately authorized dependency-suffix regeneration, including a crash after each rebuilt batch/slot, whose new downstream and aggregate result identities differ while upstream slot results are reused.
- Hume deletion requires a fresh unique name-to-expected-ID proof or becomes an external action.
- Segmented repair uses the same approved snapshots.

MiniMax, Cartesia, and Speechify mocked contracts must prove:

- Every dated fixture validates and declares catalog, clone, design, lifecycle, timing, and dialogue support without inferring native multi-speaker behavior from single-voice synthesis, streaming context, or voice-mixing features.
- MiniMax normalizes system/generated/cloned catalogs, decodes bounded hexadecimal design previews, preserves the seven-day pre-activation lifetime, uploads exactly one protected clone sample before creation, and selects the registered generated-or-cloned resource class for deletion.
- Cartesia preserves cursor and ownership semantics under the pinned API version, uploads exactly one protected instant-clone sample with language, reports Pro Voice Clone as an external dashboard action, and never exposes a text-prompt design or native-dialogue port.
- Speechify preserves shared/personal catalog and model compatibility, serializes locale, normalized gender, JSON consent, and idempotency for one verified 10–30 second protected sample, excludes contact PII from ordinary results, and never exposes a text-prompt design or native-dialogue port.
- Read-only readiness blocks missing, inactive, expired, inaccessible, or model-incompatible approved resources before the shared dispatch barrier, while synthesis price and management price perform no provider calls.
- Multiple current rows on one provider/model retain distinct target/render/binding benchmark identity, while incomplete pre-ADR records use only the explicit non-reusable `legacy:` key.

For this proposed ADR documentation change, run the default repository verification and whitespace check:

```bash
bun run check
git diff --check
```

As implementation lands, add the named local suites below and run them together with the existing targeted, no-cost contracts:

```bash
bun run check
bun test test/test-cases/validation/resume-manifests/canonical-manifest-contracts.test.ts
bun test test/test-cases/validation/resume-manifests/no-legacy-persistence-contracts.test.ts
bun test test/test-cases/validation/resume-manifests/resume-additive-provider-contracts.test.ts
bun test test/test-cases/validation/resume-manifests/resume-provider-surface-contracts.test.ts
bun test test/test-cases/validation/media-generation/tts-explicit-voice-conformance.test.ts
bun test test/test-cases/validation/media-generation/tts-admission-journal-and-recovery.test.ts
bun test test/test-cases/validation/media-generation/tts-audio-run-artifacts.test.ts
bun test test/test-cases/validation/media-generation/tts-hybrid-repair-compatibility.test.ts
bun test test/test-cases/validation/media-generation/tts-native-batch-cache-and-takes.test.ts
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
bun test test/test-cases/validation/comic/comic-dialogue-plan-and-audio.test.ts
bun test test/test-cases/validation/providers/tts-provider-contracts/openai-grok-groq.test.ts
bun test test/test-cases/validation/providers/tts-provider-contracts/mistral-elevenlabs.test.ts
bun test test/test-cases/validation/providers/tts-provider-contracts/deepgram-minimax.test.ts
bun test test/test-cases/validation/providers/tts-provider-contracts/speechify.test.ts
bun test test/test-cases/validation/providers/tts-provider-contracts/hume-cartesia.test.ts
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors.test.ts
git diff --check
```

Do not run `bun run t`, `bun test/test-runner.ts`, a hosted TTS command, a provider voice-creation command, provider smoke tests, or an e2e path with cost, quota, billing, or price association. Any live ElevenLabs, Hume, or other provider validation requires immediate explicit approval naming the exact command and expected cost or quota risk.

## References

- Related ADR: [ADR-002](ADR-002-url-article-extraction-and-target-discovery.md) — the one unversioned canonical run manifest and clean-break persistence policy
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — type-domain ownership and the `~/types` barrel
- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md) — shared provider infrastructure and native comic command ownership
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — hosted TTS provider lanes and the bounded multi-speaker turn selector inventory
- Related ADR: [ADR-012](ADR-012-add-price-preflight-to-resume.md) — side-effect-free price planning
- Related ADR: [ADR-018](ADR-018-refresh-current-hosted-tts-and-music-models.md) — current TTS model contracts and the boundary between models and voice capabilities
- Source report: [Comic Character Voice and Multi-Character TTS Options](../reports/comic-character-tts-options-report.md)
- `src/types/tts-workflow/tts-types.ts`
- `src/types/tts-workflow/dialogue-normalizer-types.ts`
- `src/types/pipeline-core/process-generation-types.ts`
- `src/types/provider-core/provider-contract-types.ts`
- `src/types/cli-surface/cli-types.ts`
- `src/cli/commands/process-steps/pipeline-manifest.ts`
- `src/cli/commands/process-steps/generation-command-utils.ts`
- `src/cli/commands/process-steps/step-4-tts/run-multi-speaker-tts.ts`
- `src/cli/commands/process-steps/step-4-tts/define-tts-command.ts`
- `src/cli/commands/process-steps/step-4-tts/dialogue-normalizer.ts`
- `src/cli/commands/process-steps/step-4-tts/tts-targets/multi-speaker-capability.ts`
- `src/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils.ts`
- `src/cli/commands/process-steps/provider-target-scheduler.ts`
- `src/cli/commands/process-steps/characters-root.ts`
- `src/cli/commands/process-steps/step-8-comic/schemas/schemas.ts`
- `src/cli/commands/process-steps/step-8-comic/comic-utils/character-reference-snapshot.ts`
- `src/cli/commands/process-steps/step-8-comic/comic-utils/scene-run-context.ts`
- `src/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/structured-script-parser.ts`
- `src/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/source-segments.ts`
- `src/cli/commands/setup-and-utilities/config/config-merge.ts`
- `src/cli/options/option-resolution/tts-options.ts`
- `src/cli/flags/service-selector-normalization/generic-tts-option-selectors.ts`
- `src/cli/commands/setup-and-utilities/models/tts-models.ts`
- [ElevenLabs Text-to-Dialogue](https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue)
- [ElevenLabs Text-to-Dialogue API](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert)
- [ElevenLabs Text-to-Dialogue with timestamps](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps)
- [ElevenLabs v3 best practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)
- [ElevenLabs voices overview](https://elevenlabs.io/docs/overview/capabilities/voices)
- [ElevenLabs Voice Design guide](https://elevenlabs.io/docs/eleven-creative/voices/voice-design/)
- [ElevenLabs Voice Design](https://elevenlabs.io/docs/api-reference/text-to-voice/design)
- [ElevenLabs create a voice from a preview](https://elevenlabs.io/docs/api-reference/text-to-voice/create)
- [ElevenLabs Voice Remixing](https://elevenlabs.io/docs/overview/capabilities/voice-remixing)
- [ElevenLabs Voice Remix API](https://elevenlabs.io/docs/api-reference/text-to-voice/remix)
- [ElevenLabs shared voice library](https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared)
- [ElevenLabs add a shared voice](https://elevenlabs.io/docs/api-reference/voices/voice-library/share)
- [ElevenLabs Instant Voice Cloning](https://elevenlabs.io/docs/api-reference/voices/ivc/create)
- [ElevenLabs search account voices](https://elevenlabs.io/docs/api-reference/voices/search)
- [ElevenLabs get a voice](https://elevenlabs.io/docs/api-reference/voices/get)
- [ElevenLabs delete a voice](https://elevenlabs.io/docs/api-reference/voices/delete)
- [Mistral Audio Voices endpoints](https://docs.mistral.ai/api/endpoint/audio/voices)
- [Hume Text to Speech overview](https://dev.hume.ai/docs/text-to-speech-tts/overview)
- [Hume synchronous JSON synthesis](https://dev.hume.ai/reference/text-to-speech-tts/synthesize-json)
- [Hume acting instructions](https://dev.hume.ai/docs/text-to-speech-tts/acting-instructions)
- [Hume continuation](https://dev.hume.ai/docs/text-to-speech-tts/continuation)
- [Hume timestamps](https://dev.hume.ai/docs/text-to-speech-tts/timestamps)
- [Hume Voice Design](https://dev.hume.ai/docs/voice/voice-design)
- [Hume voice cloning](https://dev.hume.ai/docs/voice/voice-cloning)
- [Hume voice management](https://dev.hume.ai/docs/voice/management)
- [Hume list voices](https://dev.hume.ai/reference/voices/list)
- [Hume create a voice from a generation](https://dev.hume.ai/reference/voices/create)
- [Hume delete voice](https://dev.hume.ai/reference/voices/delete)
- [MiniMax API overview](https://platform.minimax.io/docs/api-reference/api-overview)
- [MiniMax voice catalog](https://platform.minimax.io/docs/api-reference/voice-management-get)
- [MiniMax Voice Design](https://platform.minimax.io/docs/api-reference/voice-design-design)
- [MiniMax upload clone audio](https://platform.minimax.io/docs/api-reference/voice-cloning-uploadcloneaudio)
- [MiniMax Voice Clone](https://platform.minimax.io/docs/api-reference/voice-cloning-clone)
- [MiniMax text-to-audio](https://platform.minimax.io/docs/api-reference/speech-t2a-http)
- [Cartesia list voices](https://docs.cartesia.ai/api-reference/voices/list)
- [Cartesia clone voice](https://docs.cartesia.ai/api-reference/voices/clone)
- [Cartesia delete voice](https://docs.cartesia.ai/api-reference/voices/delete)
- [Cartesia TTS bytes](https://docs.cartesia.ai/api-reference/tts/bytes)
- [Speechify list voices](https://docs.speechify.ai/build/api-reference/v1/voices/get)
- [Speechify create voice](https://docs.speechify.ai/build/api-reference/v1/voices/post)
- [Speechify get voice](https://docs.speechify.ai/build/api-reference/v1/voices/-id-/get)
- [Speechify delete voice](https://docs.speechify.ai/build/api-reference/v1/voices/-id-/delete)
- [Speechify voice cloning overview](https://docs.speechify.ai/build/guides/voice-cloning/overview)
