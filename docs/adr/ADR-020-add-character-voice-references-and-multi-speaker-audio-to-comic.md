# ADR-020: Add Character Voice References and Multi-Speaker Audio to Comic

## Status

- **Decision Status:** Proposed
- **Date Created:** 2026-08-10
- **Date Updated:** 2026-08-10
- **Verification Status:** Pending

## Context

AutoShow can synthesize single-voice speech through 12 providers and already has a generic multi-speaker parser, speaker mappings, turn files, local concatenation, and a native Gemini branch. Comic has an even better source representation for dialogue: `structured-script.json` retains stable source-segment IDs, canonical character keys, original speaker labels, exact text, delivery notes, and scene locations. Comic also has a mature reference-asset lifecycle for images: authored character metadata, a registered current reference with checksums and prior-generation identity, and an immutable per-scene snapshot.

Those pieces do not yet form a trustworthy character-voice workflow. Comic exposes no command for creating, selecting, auditioning, approving, or snapshotting a character voice, and no command for turning a structured comic script into multi-character audio. The generic TTS speaker registry contains only a speaker string and a provider-agnostic voice string or path. It cannot express provider-specific castings, voice-design or clone state, access restrictions, consent, delivery controls, remote-resource lifecycle, or immutable voice identity.

The repository audit in `docs/reports/comic-character-tts-options-report.md` also found that the current multi-speaker contract is materially incorrect. `runMultiSpeakerTts` builds per-turn overridden options, but ten segmented provider targets captured the original voice during target collection and ignore those runtime overrides. Only Mistral's segmented adapter and Gemini's native adapter currently honor distinct mapped voices. Final metadata nevertheless records requested mappings as if all providers had used them. Existing OpenAI dialogue coverage proves output ordering but never asserts the request voice, and user documentation overstates provider support.

The report identified additional correctness defects and incomplete contracts: Gemini does not enforce its exactly-two-speaker native limit and can split raw speaker-formatted text at unsafe boundaries; hosted turn setup fans out through an unbounded `Promise.all`; multi-target and batch cleanup can delete dialogue artifacts that completion output advertises; the generic screenplay parser strips delivery and silently drops some content; one unqualified speaker map is reused across incompatible provider namespaces; remote clone/reference setup is not provisioned once per character; Speechify resolves consent, locale, and gender data that its current request does not fully serialize; provider catalogs and OpenAI custom-voice/model contracts have drifted; manifests and benchmarks cannot distinguish multiple voices using one provider/model; and all audio is silently collapsed to mono 16 kHz PCM without a comic mastering contract.

Provider capabilities are also much richer than the current adapters. ElevenLabs combines a large voice library, Voice Design, remixing, instant and professional cloning, native Text-to-Dialogue, and dialogue timestamps. Hume Octave combines a voice library, Voice Design, cloning/import, per-utterance acting direction, multi-utterance contextual rendering, timestamps, and cross-request continuation. Mistral already supports one-off and saved reference voices; Gemini has native exactly-two-speaker synthesis; MiniMax, xAI, Speechify, and Cartesia expose custom-voice paths; Deepgram has a much larger demographically tagged stock catalog than AutoShow registers. The architecture needs to expose these differences without reducing every provider to one `voice` string or forcing comic to build provider clients of its own.

This decision is constrained by four existing architectural rules:

- ADR-007 requires comic to adapt domain semantics to shared provider infrastructure instead of maintaining a comic-local model or dispatch stack.
- ADR-008 makes hosted TTS provider lanes and bounded work scheduling the shared concurrency boundary; multi-speaker turn work must join that model instead of adding another unbounded lane.
- ADR-012 requires `resume --price` to remain a no-provider, non-mutating dry run; this ADR applies the same rule to TTS price planning and separately defines static validation versus execution readiness.
- ADR-018 treats a TTS model selector as a complete runtime promise and deliberately leaves voice identity and specialized reference/dialogue capabilities to a separate decision such as this one.

Why now: multi-character audio is the next comic workflow requirement, but extending the existing speaker-map path would preserve false metadata, unsafe resource creation, provider lock-in, and silent voice reuse. The dispatch and artifact contracts must be corrected before new voice-design, clone, or native-dialogue features make that surface larger.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Build shared voice-identity, provisioning, capability, dialogue-rendering, timing, and artifact primitives; make comic consume them; implement ElevenLabs and Hume as first-class adapters** | Repairs the current contract once; gives every provider a truthful segmented baseline; preserves provider-native strengths; supports immutable character references, local repair, comparison, and resume | Largest initial change; requires versioned artifacts, provider conformance tests, lifecycle state, and two render strategies | 12 existing providers; 10 captured-voice adapters to repair; 2 first-class advanced adapters; 2 new comic commands |
| Patch per-turn voice arguments and add comic flags directly to the existing `TtsOptions` bag | Smaller short-term change; can make basic speaker switching work | Leaves identity, consent, capabilities, provider-qualified casting, snapshots, resource lifecycle, and native dialogue unmodeled; generic options continue to mix selection and invocation | Fixes one defect but leaves the report's architectural gaps intact |
| Build an ElevenLabs-only comic audio workflow | Fastest route to the broadest managed provider feature set | Locks comic artifacts and commands to one provider, bypasses shared TTS, and makes Hume/Mistral/Gemini or local fallback expensive to add later | 1 provider; no portable baseline |
| Use only independent turn synthesis and local assembly | Works for nearly every provider; simplest cache and repair model | Discards native conversational context, timestamps, and continuation available from ElevenLabs, Hume, and Gemini | 12 potential segmented providers; 0 native capability use |
| Use only provider-native dialogue | Maximizes provider-owned context | Excludes providers without native dialogue, fails on speaker/length ceilings, weakens targeted repair, and creates provider-specific artifacts | At most a few current providers; Gemini is exactly two speakers |
| Add voice fields directly to the visual character catalog | One character file to inspect | Couples provider resources, consent, expiry, and audio settings to a strict visual schema and forces unrelated schema migrations | Visual catalog is strict schema version 3 |

## Decision

Create one shared, provider-neutral character-voice and dialogue subsystem beneath both the generic Step 4 TTS command and comic. Comic owns authored character voice briefs, role resolution, approvals, immutable scene snapshots, and source-linked dialogue plans. Shared TTS owns provider capabilities, voice provisioning and lifecycle ports, explicit per-invocation voice dispatch, native and segmented rendering, timing normalization, scheduling, and synthesis metadata. Comic must not create provider clients or a second TTS target registry.

ElevenLabs and Hume Octave are the first-class advanced adapters for this subsystem. Both must implement the common discovery, candidate, audition, registration, lifecycle, preflight, native-dialogue, segmented-fallback, timing, and manifest contracts wherever the provider offers the capability. Every existing TTS provider must implement the explicit-voice segmented baseline or fail locally with a truthful model-specific capability error; no adapter may silently reuse a captured default voice.

This applies to:

- All current generic multi-speaker TTS behavior, metadata, artifacts, validation, scheduling, and provider request contracts.
- Comic character voice briefs, reference-voice creation/import/audition/approval, immutable voice snapshots, dialogue planning, audio generation, caching, assembly, effects, timing, resume, and manifests.
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

The workflow is a composition of comic-owned domain state and shared TTS-owned execution:

```text
structured-script.json
  -> comic dialogue planner
  -> character/role casting against approved registrations
  -> immutable voice snapshot and side-effect-free static render validation
  -> shared render-strategy planner
       -> native dialogue or native utterance batches
       -> explicit-voice segmented turn batches
  -> shared timing normalization and local assembly
  -> comic timeline, audio manifest, and final recording
```

| Owner | Responsibilities | Must not own |
|---|---|---|
| Comic workflow | `CharacterVoiceBrief`, canonical character/role resolution, reference approval, `ComicDialoguePlan`, scene voice snapshot, panel/source synchronization, effect intent, comic output paths | Provider HTTP clients, provider model registries, request retry policy, provider pricing |
| Shared TTS workflow | Provider voice references and registrations, capability facets, access state, explicit synthesis invocation, provider preflight, render planning, timing normalization, segmented/native execution, audio assembly, cache keys, synthesis metadata | Comic scene drafting, panel semantics, visual character schema |
| Provider adapter | Exact catalog, design, clone, lifecycle, request, response, limit, timing, continuation, and access-state mappings for one provider/model | Cross-provider casting policy, comic source parsing, silent fallback |
| Local artifact layer | Checksums, atomic promotion, snapshots, caches, manifests, resume checkpoints, mastering and effects | Remote deletion as ordinary cleanup, secrets or raw consent PII in manifests |

Types remain grouped under the existing `tts-workflow` and `comic-workflow` domains behind the `~/types` barrel in accordance with ADR-003. Shared types may not import comic implementation modules; comic maps its `CharacterKey` and role keys into shared speaker/profile identifiers at the boundary.

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
      protectedAssetRef: string
      sha256: string
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
  protectedRequestEvidenceRef: string
  idempotencyKey?: string
  reconciliation?: {
    strategy: 'provider-operation' | 'idempotency-lookup' | 'provider-search' | 'manual-inspection'
    providerHandle?: string
    protectedLookupEvidenceRef: string
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
  capabilitySnapshotHash: string
  accountCapabilityObservationHash?: string
  sanitizedProviderMetadata: SanitizedProviderVoiceMetadata
  retention: VoiceRetentionPolicy
  cleanupState: VoiceCleanupState
  createdAt: string
  updatedAt: string
}

type VoiceRegistration =
  | VoiceRegistrationBase & {
      approval: { state: 'approved', auditionId: string, approvedAt: string, approvedBy: string }
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
  auditionAudioChecksum: string
  referenceAudioChecksum?: string
  provenanceRef: string
  consentRecordRef?: string
  capabilitySnapshotHash: string
  capturedRemoteState: 'ready'
  providerRevision?: string
  externallyMutable: boolean
  capturedAt: string
}

type VoiceReferenceManifest = {
  schemaVersion: 1
  snapshotId: string
  sceneRunIdentity: string
  catalogHash: string
  briefSetHash: string
  createdAt: string
  entries: ApprovedVoiceSnapshotEntry[]
}

type ResolvedVoiceBinding =
  | { kind: 'approved-snapshot', snapshotId: string, entryId: string, entry: ApprovedVoiceSnapshotEntry }
  | {
      kind: 'transient-provider-voice'
      providerVoice: ProviderVoiceRef
      providerModel: string
      identityHash: string
      settingsSchema: string
      synthesisSettings: TypedProviderSynthesisSettings
      capabilitySnapshotHash: string
    }

type ComicDialogueTurn = {
  turnId: string
  sourceSegmentId: string
  beatIndex?: number
  subjectKey: string
  originalSpeakerLabel: string
  canonicalText: string
  delivery?: DeliveryPlan
  effect?: VoiceEffectPlan
}

type ComicDialoguePlanNode =
  | { kind: 'turn', turn: ComicDialogueTurn }
  | { kind: 'overlap', groupId: string, turns: ComicDialogueTurn[] }

type ProviderResolvedDialogueTurn = ComicDialogueTurn & {
  providerText: PreparedProviderText
  voice: ResolvedVoiceBinding
}

type ProviderRenderPlanBase = {
  schemaVersion: 1
  renderPlanId: string
  dialoguePlanId: string
  targetKey: string
  provider: TtsProvider
  model: string
  transport: string
  strategy: 'native-dialogue' | 'native-utterances' | 'segmented' | 'hybrid'
  nodes: Array<
    | { kind: 'turn', turn: ProviderResolvedDialogueTurn }
    | { kind: 'overlap', groupId: string, turns: ProviderResolvedDialogueTurn[] }
  >
}

type ProviderRenderPlan =
  | ProviderRenderPlanBase & {
      voiceContext: { kind: 'approved-snapshot', snapshotId: string }
    }
  | ProviderRenderPlanBase & {
      voiceContext: { kind: 'transient', bindingIdentityHashes: string[] }
    }

type ExplicitVoiceSynthesisRequest = {
  schemaVersion: 1
  invocationId: string
  renderPlanId: string
  provider: TtsProvider
  model: string
  transport: string
  turns: Array<{
    turnId: string
    text: PreparedProviderText
    voice: ResolvedVoiceBinding
  }>
  controls: TypedProviderSynthesisSettings
  output: RequestedAudioFormat
  cancellation: AbortSignal
}

type ObservedProviderRequest = {
  requestOrdinal: number
  provider: TtsProvider
  model: string
  transport: string
  endpointKind: string
  serializerVersion: string
  requestBodyHash: string
  turns: Array<{
    turnId: string
    providerTextHash: string
    voiceField: string
    actualSerializedVoice: SanitizedSerializedVoiceIdentity
  }>
  providerRequestId?: string
  acceptedAt?: string
}

type ProviderRenderResult = {
  schemaVersion: 1
  status: 'succeeded' | 'partial' | 'failed' | 'ambiguous'
  requestedTurnIds: string[]
  observedRequests: ObservedProviderRequest[]
  outputs: Array<{ outputId: string, artifactRef: string, sha256: string, format: ObservedAudioFormat, durationMs?: number }>
  generatedBatches: GeneratedProviderBatch[]
  turnOutcomes: Array<{
    turnId: string
    status: 'succeeded' | 'failed' | 'ambiguous' | 'unstarted'
    observedRequestOrdinals: number[]
    batchIds: string[]
    outputIds: string[]
    error?: SanitizedProviderError
  }>
  createdResources: ProviderVoiceRef[]
  retryAttempts: ProviderRetryRecord[]
  cost: PlannedAndObservedCost
  error?: SanitizedProviderError
}
```

`subjectKey` is a canonical character key for a catalog character or an explicit namespaced logical role key such as `role:narrator` or `voice:ship-computer`. Logical keys never become literal path components. Every artifact path uses a collision-resistant, lowercase safe key derived and validated by one shared encoder; containment checks reject traversal, absolute paths, platform-reserved names, and provider/model/registration collisions. Mentions and visible `characterKeys` are never accepted as substitutes for speaker identity.

Provider voice display names are discovery metadata, not stable identity. Rendering uses provider IDs wherever the provider offers them. A legacy Hume name or other user-facing locator must resolve to an ID or an immutable provider reference during execution readiness and must not remain the only identity in a scene snapshot.

Comic dialogue plans remain provider-neutral. Each comic `ProviderRenderPlan` uses the `approved-snapshot` voice context and resolves every subject against one provider-qualified entry in that aggregate snapshot. That separation allows the same immutable source plan to drive ElevenLabs, Hume, and other comparison targets without embedding one cast into the canonical plan. The transient voice context exists for ordinary single-voice and legacy single-provider generic TTS, where requiring a comic registration and audition would be false; it requires binding identity hashes and structurally forbids `snapshotId`. Strict parsing requires every node binding to match its context, every approved entry to share that context's snapshot ID, and the transient hash list to equal the canonical identities of all transient node bindings. Mixed or orphan bindings fail locally. A transient binding still records the actual provider voice, canonical settings hash, capability evidence, and result metadata; it cannot create a remote resource, claim approval, or enter a comic scene snapshot.

`ObservedProviderRequest` is emitted at the final provider serializer boundary from the actual URL, path, query, multipart fields, or JSON body after defaults and overrides have been applied. It is a sanitized typed projection of what was sent, not a copy of the requested render plan. Request turns are keyed records rather than parallel arrays, and their IDs must be unique. A succeeded result has exactly one succeeded outcome for every requested turn, no extra turns, and complete links from each outcome to the observed request ordinal and verified output/native batch that covers it; every request, batch, and output is referenced and there are no orphans. Partial, failed, and ambiguous results still contain exactly one explicit outcome per requested turn, including `unstarted`, so aggregate success cannot hide omitted work. This serializer-owned evidence is the authority for manifests, request counts, model/voice identity, retries, and the A/B/A conformance suite.

For ordinary synthesis, `createdResources` must be empty; a non-empty value is a contract violation that stops the run and enters reconciliation rather than normalizing creation as rendering. Voice-management operations write issued resources through their provisioning attempts. Higher-level manifests may reference several pre-existing resources used by a cast without claiming that the synthesis run created them.

Every persisted file has an explicit `schemaVersion` envelope and strict parser. Provider settings use versioned provider/model-specific schemas and canonical serialization rather than arbitrary JSON. Sanitized provider metadata is an allowlisted projection; raw responses, sharing allowlists, emails, secrets, base64 audio, and unknown fields cannot enter registrations, snapshots, cache keys, or ordinary manifests. New voice artifacts have no legacy versions, while generic Step 4 metadata keeps an explicit legacy reader during the clean break.

The strict registration parser enforces cross-field invariants that the storage union cannot leave implicit. An approved registration must have ready provisioning, a matching successful canonical audition, an unrevoked provenance record, and origin-appropriate consent/authorization; its `approvedAuditionId` must equal `approval.auditionId`. Only such a registration can enter the current index or an `ApprovedVoiceSnapshotEntry`. Draft, pending, failed, expired, retired, revoked, or deleted registrations cannot become current even if their JSON carries stale IDs.

### Capability-faceted provider boundary

Capability presence, adapter implementation, and current-account access are separate facts. A provider may document cloning while an account needs an upgrade; an adapter may plan a documented feature without implementing it; a UI-only workflow may require import rather than an API creation call. The manifest records the capability snapshot used to plan a render.

The shared provider boundary is composed from facets rather than one widening method with optimistic Boolean flags:

```ts
type ProviderVoiceLocator =
  | { kind: 'provider-id', provider: TtsProvider, resourceId: string }
  | { kind: 'display-name', provider: TtsProvider, name: string }
  | { kind: 'reference-asset', provider: TtsProvider, protectedAssetRef: string, sha256: string, authorizationRef: string }
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
  status: 'ready' | 'blocked'
  capabilityObservations: AccountCapabilityObservation[]
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
  renderTurn(request: ExplicitVoiceSynthesisRequest): Promise<ProviderRenderResult>
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

The minimum provider contract is side-effect-free `parseVoiceLocator`, read-only readiness resolution where the selected voice kind requires it, `audition`, and `renderTurn` with an explicit `ResolvedVoiceBinding`. Readiness is optional only for local or provider-stock identities that can be proved from local fixtures; hosted custom, mutable, name-based, gated, or expiring identities require it. Display-name lookup, including legacy Hume names, occurs only inside execution readiness and must return a unique stable identity; static validation and price never perform that lookup. That makes segmented dialogue portable across any ordinary TTS adapter without pretending a transient generic voice is an approved comic reference. Optional facets add discovery, design, clone, resource management, native rendering, provider timing, or continuation without changing the comic planner.

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

Cloning requires a provenance record and, where applicable, a provider consent record before source audio is uploaded. Missing, expired, or revoked consent blocks provisioning and synthesis. Provider consent IDs and consent recordings remain separate from performer samples. Ordinary logs and scene manifests contain only non-secret references and hashes; they do not contain consent email, raw consent audio, source audio bytes, API keys, or provider tokens.

Remote provisioning occurs only in the explicit reference/voice-management workflow, once per unique registration, before its canonical audition. `comic generate-audio` performs no remote creation; its scene preparation deduplicates only read-only resolution, readiness inspection, protected local reference materialization, and conversion. Concurrent work shares one promise and result, so it cannot create one clone per turn. Mistral reference materialization and conversion are cached by immutable source checksum rather than repeated for every line.

Provisioning is crash- and multi-process-aware. A durable attempt journal and project lock are written before the create request; the journal names the typed operation, protected recoverable request evidence, and the provider-supported reconciliation strategy/handle, and an idempotency key is used where available. Every issued resource is appended to `issuedResources` before any outcome or registration transition, including failed, verification, approval, and ambiguous branches, and compare-and-swap ownership prevents a second process from promoting the same draft. A timeout or crash with an uncertain provider outcome becomes `reconciliation-required` and is never retried automatically unless provider idempotency proves that retry is safe. Recovery uses the recorded operation/evidence to inspect, search, import, tombstone, or explicitly abandon the attempt before another create is allowed; when the provider has no lookup surface, `manual-inspection` remains blocking rather than guessing.

Consent records define separate policy for new synthesis, cached-audio reuse, playback/export, retention, and deletion after revocation. The default for absent or ambiguous permission is deny. Revocation never rewrites historical non-secret manifests, but it blocks new synthesis and resume/cache use unless the record expressly permits them and can quarantine or require deletion of protected audio according to the recorded obligation.

Remote deletion is never part of render cleanup. It requires an explicit management action, exact local registration and remote resource identity, confirmation, `ownership: 'project'`, and a current deletion-eligibility/notice snapshot. Provider stock, third-party shared sources, and externally managed imports are never deleted by AutoShow. When an import operation creates a separate project-owned account resource, the source and copy are separate lineage-linked records; only the copy may be deleted, and only when its own provider eligibility permits it. Providers that delete by a mutable name, including Hume's documented endpoint, require a fresh unique name-to-expected-ID proof immediately before deletion or report `external-action-required`. A successful deletion leaves a local tombstone so historical manifests remain intelligible and future execution readiness rejects the resource.

### Character voice artifact contract

The visual character schema remains unchanged. Voice state uses separate versioned files under the character root:

```text
<characters-root>/
  characters-reference.json
  character-voices.json
  character-voice-registrations.json
  character-voice-current.json
  voice-references/<safe-subject-key>/<safe-provider-key>/<safe-registration-id>/<generation-id>/
    audition-manifest.json
    audition-takes/
    candidate-previews/
    protected-reference/
```

`character-voices.json` contains provider-neutral authored briefs keyed by canonical character or role. A brief may define language/locale, accent or dialect and strength, apparent age range, gender presentation when relevant, pitch/register, timbre, resonance, pace, energy, texture, mannerisms, default delivery, prohibited caricatures, project pronunciations, and allowed voice origins. Search traits are casting aids, not verified demographic facts.

`character-voice-registrations.json` is an append-preserving registry containing zero or more provider-specific registrations per subject. Several registrations may remain approved for different languages, models, render modes, or casting profiles. `character-voice-current.json` is the only current-selection index and contains at most one current generation per `(subjectKey, provider, profileKey)`; an atomic compare-and-swap updates that index without rewriting or retiring approved alternatives. Each registration records generation and prior-generation IDs, provider/model and stable voice reference, creation source and lineage, sanitized provider metadata, brief hash, audition artifacts and checksums, non-secret provenance/consent references, capability and account-access evidence, exact synthesis defaults, retention/expiry/deletion state, and cleanup state.

The audition contract is a versioned manifest rather than one unexplained audio file. Its standard set contains a neutral identity passage, at least one representative script line, contrasting emotional or delivery lines, character and place names plus invented terms, accent-sensitive words, and a provider-neutral comparison passage. It records the exact canonical and provider-prepared text, delivery settings, voice and model identity, capability fixture, take IDs, checksums, duration, cost, warnings, and the explicitly selected take. Projects may extend the set, but approval cannot omit the neutral, representative, pronunciation, and comparison categories. Candidate generation and audition have explicit candidate/take ceilings and a planned budget; `--max-cents` includes design/clone setup, all requested previews, audition synthesis, and local processing, while local approval authorizes no additional provider spend.

`comic reference-voice` supports provider-appropriate stock selection or import, design, clone/reference creation, audition, and approval. `materializeCandidate` is the remote creation/import/save action and can be billable; `approveRegistration` is the later local atomic current-index update after a canonical audition succeeds. Approval is rollback-protected like character/location reference promotion: incomplete candidates never replace the current selection, and a brief, source, registration, or current-generation change during work invalidates the compare-and-swap.

Reference and audition recordings are sensitive identity assets, not ordinary publishable output. Their directories are private to the current user by default, excluded from version control by the project ignore policy, and subject to explicit retention, export, and deletion rules derived from provenance and consent. A project may route them to an encrypted or OS-protected asset store. Manifests store protected references and hashes, never raw bytes or personal contact data. A request-time reference must be copied into an authorized immutable protected asset store to support resume; if provider terms or authorization forbid that, the registration and every dependent run are explicitly non-resumable for new provider synthesis and may reuse only already-authorized cached output.

Before scene audio generation, comic writes one aggregate immutable `VoiceReferenceManifest` for the exact resolved scene run. It includes every selected character and non-character role for every planned comparison target, one scene-level `snapshotId`, and provider-qualified entries. Each immutable comic `ProviderRenderPlan` refers to that ID through its approved `voiceContext` and one `entryId` per resolved turn; the provider-neutral dialogue plan never embeds a mutable current pointer. Snapshot manifests are append-only by ID and an index records which render used which snapshot, so a later render cannot overwrite an earlier run's casting identity:

```text
<scene-run>/
  metadata/dialogue-plans.json
  metadata/dialogue-plans/<plan-id>.json
  assets/voice-reference-snapshots.json
  assets/voice-references/<snapshot-id>/manifest.json
  assets/voice-references/<snapshot-id>/<safe-subject-key>/<safe-provider-key>/<safe-registration-id>/
    audition-manifest.json
    approved-audition.*
    protected-reference.*
    registration-snapshot.json
  audio/<render-id>/
    provider-plan.json
    render-takes.json
    segments/
    speech.wav
    timeline.json
    manifest.json
```

Local audio is copied only where rights and provider terms permit. The snapshot always stores checksums of permitted local evidence and a hash of immutable registration metadata. A hosted voice also stores provider/model/resource identity, the state captured at snapshot time, provider revision when exposed, whether the identity is externally mutable, and the approved audition checksum. Current remote observations belong to a separately dated readiness result; they do not mutate the immutable snapshot. Before new synthesis, a changed known provider revision blocks or requires a new registration/snapshot. When no revision exists, resume may deterministically reuse checksum-valid cached audio, but new provider synthesis must acknowledge that the remote voice can have drifted. Resume uses the snapshot captured for that run and never silently adopts a newer current registration.

### Comic dialogue plan

`comic generate-audio <script>` resolves the latest compatible run, or the exact run pinned by `--output-dir`, that already contains a valid `metadata/structured-script.json`, following the controlled-run selection pattern used by comic image generation. Compatibility requires the same canonical resolved source path, source slug, source-content checksum, supported structured-artifact schema, and an internally valid structured artifact carrying that source identity. A same-basename script from another directory never matches. Source drift blocks with guidance to rerun structure generation; it is not silently paired with stale dialogue, including for a pinned run. The command does not begin a fresh scene run that lacks structured source, synthesize from LLM-authored `scene.json`, or serialize comic turns back through the generic screenplay parser. It writes an immutable provider-neutral `metadata/dialogue-plans/<plan-id>.json` plus an append-only index; each provider/model comparison writes its own immutable `ProviderRenderPlan`, and each audio `manifest.json` binds the exact dialogue plan, render plan, and snapshot IDs. The resolved scene-run identity binds the structured-script checksum, dialogue plan, voice snapshot, render plan, cache namespace, checkpoints, and resume selection.

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

The generic `tts` command may continue accepting `--tts-speaker SPEAKER=VOICE` only when exactly one provider is selected and every mapping is locally valid for that provider/model. Multi-provider comparison uses the strict versioned `ProviderQualifiedCast` input rather than reusing one string namespace. Its parser requires unique `(provider, model, transport)` targets, unique `speakerKey` values within each target, and exact equality between every locator's provider and its enclosing target before any resolution. Precedence is target-specific cast binding, then an explicit legacy mapping for the sole selected provider, then an explicit non-dialogue provider voice; no inherited global voice/reference/name may override a speaker binding, and an unmapped speakable role is an error. Legacy `SPEAKER=path` is supported only for a provider that can consume that reference without remote creation and with the required authorization/profile data. Until provider-profile provisioning exists, ElevenLabs and Speechify reference paths must be rejected with migration guidance rather than advertised as usable; Mistral may retain one-off reference audio.

Generic clone/save behavior is separated from synthesis. A shared non-comic `voice` management command exposes create, import, audition, inspect, reconcile, retire, and delete operations through the same ports used by `comic reference-voice`. Existing `tts` combinations that create a persistent ElevenLabs, Speechify, or named Mistral resource enter a documented deprecation period and then fail with the equivalent management command; an unnamed Mistral request-time reference may remain a transient synthesis source. Config loading and merge never create a voice. Persisted reference/name defaults that formerly implied creation produce actionable migration diagnostics, cannot override explicit per-speaker bindings, and must be converted to a registered provider ID or an explicit management operation before synthesis.

### Render planning and strategy selection

The shared render planner accepts `auto`, `native`, or `segmented` as a mode preference and produces a complete `ProviderRenderPlan` before the first billable synthesis request.

`auto` selects native rendering only when:

- Every batch turn uses the same provider and a compatible model.
- The adapter facet is implemented and the current account is known to have access.
- Speaker count, input length, language, output format, voice origins, timing requirements, and provider limits all fit.
- Every registration is ready, approved, unrevoked, and compatible.
- Every required per-turn direction can be represented without silently dropping semantics.

`native` is strict and fails preflight rather than degrading. `segmented` is explicit. Planning splits only between turns; an individually oversized turn may become indexed subparts of the same source turn only when the provider request can repeat the required speaker framing and the manifest preserves that relationship.

Fallback is determined during preflight. Native may fall back to segmented only with the same provider and the same approved snapshots, and only when the plan and price already include that route. An approved alternate registration may be used only when it is named in the plan. There is no silent provider or voice substitution. After accepted output, partial billable output, or an ambiguous timeout, AutoShow checkpoints and stops instead of quietly buying the script again. A later mixed native/segmented repair is explicit and recorded as `hybrid`.

`--price` uses only fresh cached account observations. When access is unknown, it reports the native and segmented conditional branches and the readiness condition rather than contacting the provider or asserting a false single total. Normal execution completes all read-only readiness checks, selects only a branch already covered by that plan and budget, and freezes the final render plans before any synthesis.

Gemini's native dialogue strategy is valid for exactly two distinct speakers. Strict `native` with any other count fails locally with zero synthesis calls. In `auto`, exactly two speakers may select native while one or three-or-more may select the already validated and priced explicit-turn segmented route; ordinary non-dialogue single-voice Gemini synthesis remains valid. Zero speakable turns completes locally without a synthesis request. No strategy chunks raw speaker-labeled prose: all boundaries come from resolved turns.

Capability discovery does not bypass the central model registry governed by ADR-018. Voice metadata that does not change a selector belongs here, but adding Deepgram voice-model selectors, retiring or replacing an OpenAI model, or registering a Groq language model requires a material ADR-018 update or a later model-refresh ADR. A discovered provider identity that is not valid for a registered model/transport may be shown as unavailable but cannot render.

### Segmented rendering and concurrency

`TtsTarget.run(text, outputDir, opts)` is replaced or wrapped by an invocation that receives explicit text, resolved voice source/snapshot, per-turn controls, speaker/source identity, output location, scheduler context, and cancellation signal. Provider collectors may capture model and stable non-identity defaults, but never the invocation's voice.

Every current provider must pass an A/B/A conformance contract: calls on one collected target for Alice voice A, Bob voice B, then Alice voice A must send A/B/A in the actual provider payload while preserving source output order under reverse completion. The required provider request fields are Kitten speaker, OpenAI `voice`, ElevenLabs voice path/ID, MiniMax `voice_setting.voice_id`, Groq `voice`, xAI `voice_id`, Mistral `voice_id` or reference audio, Gemini single-speaker `voiceConfig`, Deepgram `model`, Speechify `voice_id`, Hume utterance voice, and Cartesia `voice.id`. Gemini retains its native two-speaker registry path and must also implement the twelfth explicit-turn serializer used by segmented and ordinary single-speaker rendering.

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

type RenderTake = {
  takeId: string
  providerRequestId?: string
  providerGenerationId?: string
  audioChecksum: string
  durationMs: number
  timing: NormalizedTiming<'take-audio-ms'>
  rawProviderTimingEvidenceRef?: string
  derivedCostAllocation?: { amount: number, currency: string, method: string, sourceBatchId: string }
  continuationCandidateRef?: string
  warnings: string[]
}

type GeneratedProviderBatch = {
  batchId: string
  takes: RenderTake[]
  batchCost: PlannedAndObservedCost
  generatedAt: string
}

type TakeSelection =
  | { state: 'unselected', batchId: string }
  | {
      state: 'selected'
      batchId: string
      selectedTakeId: string
      policy: 'sole-take' | 'manual' | 'first-generated' | 'explicit-id'
      selectedBy: string
      selectedAt: string
    }

type ContinuationCheckpoint = {
  checkpointId: string
  provider: TtsProvider
  model: string
  providerVersion: string
  batchId: string
  selectedTakeId: string
  tokenRef: string
  createdAt: string
}

type FinalTimeline = {
  timing: NormalizedTiming<'final-audio-ms'>
  sourceTakeIds: string[]
  transformLedgerRef: string
}
```

Canonical offsets are Unicode scalar-value indexes, never implicit JavaScript UTF-16 offsets. Each adapter declares the provider's actual unit and converts through explicit indexed character arrays; fixtures cover non-BMP characters, combining marks, multilingual text, provider-returned character arrays, and normalization/tag insertions. Native adapters map provider utterance/input identifiers and provider-text offsets through `PreparedProviderText` to source `turnId` and canonical offsets.

Provider timing is first normalized to the selected take's `take-audio-ms` clock and retains a sanitized reference to raw evidence. After durable take selection, the assembler writes a transform ledger for transcodes, inserted pauses, crossfades, overlaps, room tone, effects, and time changes and derives the `final-audio-ms` timeline. A transform that cannot preserve defensible offsets requires offline realignment or the unavailable variant; it never relabels raw provider time as final time. Segmented assembly can derive exact final turn ranges but does not fabricate word or phoneme timing.

Native generation is a take-producing operation. The render plan fixes a maximum take count and request-level price before synthesis. The generated batch and all takes are durably persisted before a separate batch-keyed selection record changes from `unselected` to `selected`; validation requires the selected take to belong to that batch. One take may be selected automatically under `sole-take`; multiple takes default to manual selection and stop before effects or continuation unless the user explicitly chose a deterministic `first-generated` or `explicit-id` policy in the priced plan. Each take retains its own audio, take-clock timing, generation/request identity, checksum, warnings, optional derived cost allocation, and continuation candidate, while observed provider cost remains authoritative on the generated request/batch. Hume continuation checkpoints only the selected generation's candidate and records the exact Octave model/version; a checkpoint from a different Octave version is incompatible. ElevenLabs Text-to-Dialogue provides within-request context but no Hume-style cross-request continuation contract, so its batch boundary is recorded rather than inventing a token. Carrying emotional context between scenes is opt-in.

### Audio assembly, caching, and resume

The current unconditional mono 16 kHz conversion is not the comic master contract. Provider-native outputs are retained as source artifacts where terms permit. Comic selects an explicit render profile containing final sample rate, channels, codec, loudness target, inter-turn pauses, overlaps, crossfades, room tone, and effect chain. The manifest records source and final audio properties and every conversion. Upsampling is never described as restoring source quality.

Caching has separate identities:

- A segmented synthesis key covers canonical and provider-prepared text, source turn, the canonically serialized complete `ResolvedVoiceBinding`, provider/model/transport/revision, provider controls, delivery instructions, synthesis format, adapter/request-schema version, capability-fixture version, and text-preparation version. Approved identity hashes `(snapshotId, entryId, generationId)`; transient identity hashes its provider voice/ref asset checksum, `identityHash`, settings schema, and canonical settings.
- A native-batch key covers the ordered complete turn set, every canonically serialized approved or transient binding and prepared text, all directions and contextual prompts, provider/model/transport/revision and settings, render-strategy and batch-boundary plan, adapter/request-schema and capability-fixture versions, take policy, and incoming continuation checkpoint including predecessor selected-take ID and model/version.
- The local effect key covers the source audio checksum, effect asset/checksum, canonical effect settings, implementation version, and audio toolchain version.
- The mix key covers ordered processed-segment or selected native-take checksums, timing data, mastering settings, room tone and other licensed asset snapshots, pauses, overlaps, crossfades, assembly-schema version, and audio toolchain version.

Every cache object uses a strict versioned envelope and canonical hash serialization:

```ts
type SynthesisCacheEntry = {
  schemaVersion: 1
  keyAlgorithmVersion: string
  kind: 'segmented-turn' | 'native-batch'
  canonicalInputHash: string
  bindingIdentityHashes: string[]
  capabilityFixtureHash: string
  adapterSchemaVersion: string
  textPreparationVersion: string
  observedRequestHashes: string[]
  generatedBatchIds: string[]
  outputChecksums: string[]
  createdAt: string
}
```

Changing one line or voice invalidates only its segmented synthesis key, but invalidates the containing native batch. A Hume native-batch change also invalidates every downstream batch whose continuation derives from the changed selected take. Explicit hybrid repair can replace selected ranges with segmented work without claiming that the original native batch was incrementally regenerated. Changing mix-only settings reruns local assembly without another provider request. Corrupt or mismatched checksums invalidate the affected cache safely. Resume reuses only locally checkpointed, checksum-valid work whose consent, resource eligibility, selected take, and continuation dependency remain valid. Ambiguous provider outcomes stop in reconciliation state; this contract never promises reuse of an unconfirmed response or automatic repurchase.

Room tone, impulse responses, filters, and other effect inputs are versioned assets with safe locators, checksums, provenance/license references, and snapshot identity. Replacing one invalidates only affected effect/mix keys. Generated or third-party assets are never copied, exported, or retained beyond their recorded authorization.

### Truthful metadata and artifact retention

The new versioned dialogue manifest replaces one flat speaker summary as the authority. `Step4Metadata.speaker` may remain temporarily as a derived display field, but it cannot be the source of truth.

The manifest distinguishes turn count, provider request/chunk count, native batch count, generated and selected take count, final output count, and created resource count. Per turn it records requested registration, serializer-observed provider voice/reference and model, source ID, canonical/provider-text mapping, delivery/effect controls, segment/native batch and selected-take identity, checksum and duration where independently available, optional final placement with timing provenance, request and generation IDs, retry/reconciliation state, and completion/failure state. Observed provider cost is authoritative at provider-reported request/batch scope; a turn or take stores a reference to that cost and may include only an explicitly labeled allocation with method and provenance, never an invented observed charge. Multiple clone/design resource IDs are retained in provisioning/reference manifests. Deepgram's per-turn voice-model identity is recorded as the actual serialized request model rather than being flattened incorrectly.

Single-target, multi-target, mixed native/segmented, and batch runs preserve every artifact advertised by completion output in namespaced provider/model/item directories before temporary workspace cleanup. Native output advertises per-turn segments only when real segment artifacts exist. Completion reporting is derived from verified files and manifests, not from the requested mode.

The benchmark/evaluation key becomes `(service, model, registrationId or snapshotEntryId, optional character)` so several auditions or characters using one provider/model cannot overwrite each other. Legacy single-voice manifests remain readable through a derived legacy key.

### Mandatory defect closure

The following ledger is part of the decision, not optional cleanup. ADR-020 cannot move to Accepted · Passed while any item remains reproducible.

| ID | Defect | Required closure | Acceptance signal |
|---|---|---|---|
| `MV-01` | Ten segmented targets ignore per-turn voices captured after collection | Replace mutable option override with explicit invocation voice and require the portable turn serializer on all 12 adapters | A/B/A actual serialized-payload assertions for all 12 providers, preserving Mistral behavior and Gemini's separate native behavior |
| `MV-02` | Final metadata reports requested mappings instead of actual voices and loses per-segment results | Build the structured manifest only from serializer-observed request/result records; represent multiple outputs, resources, takes, retries, and counts | Mocked final payload identity and manifest identity match exactly; requested-only identity and unstarted turns cannot appear complete |
| `MV-03` | Existing tests and docs falsely imply every provider works | Add request-field assertions, capability matrix, and truthful help/output docs | Negative control fails when a provider reuses A for B; documentation matches tested model capabilities |
| `MV-04` | One unqualified speaker map is reused across provider namespaces | Restrict legacy mappings to one provider and add provider-qualified cast records | One character maps to different valid IDs in ElevenLabs and Hume without cross-sending |
| `MV-05` | Generic screenplay normalization strips delivery and can silently omit speakers/content | Use structured comic turns; make generic input reject unmapped speakable roles and preserve supported delivery | Complete source coverage; no speaking role is silently dropped |
| `MV-06` | ElevenLabs/Speechify `SPEAKER=path` is advertised without safe per-character provisioning; cloning can occur at the wrong granularity | Provision once per registration before synthesis or reject legacy path locally | One character creates at most one resource; missing consent/setup produces zero synthesis calls |
| `MV-07` | Remote resources can be created without durable pending/verification/retention state, and config can imply creation | Make resource creation explicit, persistent, resumable, and separate from synthesis | Created-but-unverified resources survive locally; `--price`, config load, and render never create them |
| `MV-08` | Gemini accepts invalid native speaker counts/formats and chunks raw labels unsafely | Enforce exactly two native speakers, normalize accepted formats, and split only at turn boundaries | Strict native makes zero calls for counts other than two; auto uses a preplanned segmented route for one or three-or-more; zero turns make no call; ordinary single-voice remains valid |
| `MV-09` | Hosted turn setup uses unbounded `Promise.all` outside the shared scheduler | Bound end-to-end turn work, cancellation, and cleanup | Configured limit is never exceeded; failure leaves no queued calls or `.work-*` directories |
| `MV-10` | Multi-target and batch cleanup deletes promised dialogue artifacts | Promote namespaced dialogue artifacts before workspace cleanup and derive completion from disk | Every reported path exists in single, multi-target, native, segmented, and batch fixtures |
| `MV-11` | Speechify consent/locale/gender options are accepted but not all demonstrably sent or locally classified | Revalidate the live contract, serialize provider fields exactly, and label local-only provenance | Every accepted field affects the mocked request or a documented protected local record |
| `MV-12` | Mistral voice-name overrides are silently removed and references are repeatedly prepared | Create saved voices only in reference phase, reject inline naming, cache reference preparation | No ignored name; each unique reference prepares once; pre-created IDs work per character |
| `MV-13` | OpenAI custom voices use a different object/consent contract and current model status has drifted; xAI/Deepgram/Gemini catalogs are stale or truncated | Revalidate models and catalogs, use typed custom sources, record source/check date, and route selector changes through ADR-018's central registry | Voices in a dated cited fixture pass locally; stale models receive migration guidance; custom objects are not strings; unregistered discovered model identities cannot render |
| `MV-14` | Silent mono 16 kHz normalization and missing mix controls destroy or obscure quality | Preserve native sources, add explicit render/mix profile, and record conversions | Audio probes and cache tests match selected mastering settings; remix does not resynthesize |
| `MV-15` | Benchmark keys collide for several voices on one provider/model | Include registration/snapshot and optional character in the key | Two characters on one model remain separate scored rows |
| `MV-16` | Missing all-target preflight allows deterministic errors after another provider could begin paid work | Statically validate every target, voice, registration, source, consent, native limit, and output plan before optional read-only readiness checks | One deterministic invalid target causes zero provider calls; readiness calls are read-only, happen only after static success, and never overlap synthesis |
| `MV-17` | Existing reference/name config and combined clone/synthesis flags can create an unused or shared voice at run scope | Separate voice management from synthesis and migrate resource-creating defaults | Config load, inherited defaults, price, and render cannot create a resource; explicit mappings outrank global voice/reference fields; migration guidance names the management action |
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

- Discovery covers account voices and the shared library with pagination, previews and casting metadata where returned, while recording restrictions and model compatibility in a sanitized catalog record. Adding a shared voice retains a third-party source record with public owner/shared voice IDs and usage eligibility, plus a separate lineage-linked account resource for the returned account voice ID.
- Voice Design and remix create candidate previews, then materialize only the explicitly selected candidate. Remix records immutable source lineage and a local attempt ID; provider session/iteration identity is recorded only when explicitly supplied or returned. It never mutates the source voice. Candidate state includes an expiry only when the provider exposes one and otherwise records `unknown`/`not-exposed` rather than inventing a date.
- Instant Voice Cloning is an API provisioning path. Professional Voice Cloning, verification, plan, and library-access restrictions are represented as gated, pending, or external actions rather than generic failures.
- The canonical single-voice project audition runs after candidate materialization but before local approval/current-index promotion. A verification-required created ID is persisted immediately and cannot be approved until it becomes usable.
- Lifecycle can list, inspect, import, and explicitly delete project-owned account voices; it never deletes shared-library resources.
- Native dialogue uses Eleven v3 Text-to-Dialogue. Unique-voice and input-size limits are data in a dated, cited capability fixture and adapter request schema, initially populated from the currently documented ten-voice ceiling and a conservative 2,000-character planning boundary; the ADR does not freeze those values. The planner splits only between turns.
- A plan may request a bounded number of dialogue takes because conversational generations can vary. Every take and its request/batch cost evidence are retained, with per-take amounts only when itemized or explicitly derived, and only the explicit selected take proceeds to effects and assembly.
- Native timestamps map dialogue input index, voice segments, provider-text character alignment, and the prepared-text source map to source `turnId` and canonical offsets on the take clock. Raw alignment, take-normalized timing, and the transformed or realigned final timeline are retained separately.
- Textual context and v3 audio tags map from delivery only when semantics can be represented. Unsupported required direction blocks native selection instead of disappearing.
- Text-to-Dialogue provides within-request context. The adapter does not invent a cross-request continuation token.
- Segmented rendering remains available for over-limit scenes, providers/accounts without native access, and explicit line repair using the same approved voice snapshots.

### First-class Hume Octave contract

Hume is the primary expressive and continuation-aware implementation of the shared primitives:

- Discovery covers Hume library and account custom voices and normalizes the documented `id`, `name`, and `provider` fields. It preserves tags or previews only where the API actually returns them; otherwise casting relies on a generated audition. Legacy names must resolve to exactly one expected stable ID, and ambiguity is a blocking error.
- Voice Design currently requires Octave 1, produces described speech generations/candidates, and saves the selected generation as a custom voice. The resulting designed voice may then be used for Octave 2 synthesis, so creation-model and synthesis-model identity remain separate.
- Clone access is subscription-dependent. Until a public creation API is confirmed, the facet reports `external-action-required` and imports the resulting custom voice; it must not claim that the adapter performed cloning merely because the platform supports it.
- Audition uses the project audition set with explicit generation choices. Acting descriptions are included only when the chosen model supports them.
- Lifecycle lists and inspects custom voices. Because the documented Hume deletion surface takes a mutable name, deletion requires a fresh unique name-to-expected-ID proof immediately before the call; otherwise it becomes an external action even for a project-owned voice.
- Native rendering uses an ordered utterance array with a voice per turn plus only those controls supported by the concrete model. Speed and trailing silence are available across the relevant versions. Acting `description` is an Octave 1 constraint at the decision date, while word/phoneme timestamps require Octave 2; the planner must choose a compatible feature set or block/degrade an optional requirement during planning and cannot promise both merely because Hume supports each on some model.
- Hume can return one to five generations for a request. The planned count is budgeted at request level, each generation becomes a `RenderTake`, and continuation binds to the explicitly selected generation ID.
- Where the selected model supports them, Hume word and phoneme timestamp events map to source turns on the take clock and then pass through the recorded assembly transform or offline realignment to the final clock.
- Cross-request continuation checkpoints the successful provider generation/context ID after each batch and uses only the immediately preceding valid token on resume. The checkpoint carries the Octave version, and Octave 1 output cannot continue an Octave 2 chain or vice versa.
- Octave version, preview status, character/utterance/description limits, take count, output formats, speed range, design-model differences, clone access, and account state live in dated capability fixtures and readiness observations rather than being assumed globally. The initial fixture captures the current documented 5,000 text characters, 1,000 description characters, one-to-five generations, MP3/WAV/PCM outputs, and 0.5–2.0 speed range and must be revalidated immediately before implementation.
- Segmented rendering remains available for repair, incompatible controls, or an explicitly selected portable mode.

### Delivery milestones

Implementation is staged so correctness and the first useful comic path can be verified before the larger managed-provider surfaces. Final acceptance requires Phases 0 through 3 and closure of every `MV-*` item; Phase 4 is post-acceptance breadth.

| Phase | Required outcome | Dependency and verification gate |
|---|---|---|
| 0 — truthful shared TTS | Explicit per-invocation voices for all current adapters; truthful manifests/docs; generic parser safeguards; strict Gemini planning; bounded work and retained artifacts; current Speechify/request-field and model/catalog contract fixes; local rejection guards for unsafe resource-creating legacy paths | Closes `MV-01`–`MV-04`, the generic half of `MV-05`, `MV-08`–`MV-11`, `MV-13`, and `MV-15`–`MV-16`; must pass before comic synthesis or new provisioning paths merge |
| 1 — reference primitives | Versioned briefs, registrations/current index, candidate/materialization, canonical auditions, consent/provenance, lifecycle/reconciliation, aggregate immutable snapshots, generic voice-management/config migration | Closes `MV-06`, `MV-07`, `MV-17`, and `MV-18`; depends on Phase 0 invocation and metadata contracts |
| 2 — comic MVP | `comic generate-audio`, structured-script migration, Mistral saved/reference voices, Gemini strict two-speaker native plus segmented planning, local assembly/cache/timeline/effects, role policies | Closes `MV-05`, `MV-12`, and `MV-14` and proves all Phase 0 source/Gemini/benchmark fixes in comic; first end-to-end operational milestone; depends on Phases 0–1 |
| 3 — first-class managed providers | ElevenLabs and Hume implement shared advanced conformance plus discovery, creation/import, audition, native dialogue/utterances, takes, timing, lifecycle, fallback, and Hume continuation | Required for ADR acceptance; depends on stable Phase 1 artifacts and Phase 2 render contracts |
| 4 — breadth | Additional MiniMax/Cartesia/Speechify design/clone/dialogue facets and then a new provider only for a defined gap | Optional post-acceptance work that may proceed incrementally without adding comic-local dispatch |

### Acceptance gates

ADR-020 may move to Accepted only when all of the following are true:

1. Every `MV-*` item is closed by code, local contracts, and matching user documentation.
2. All 12 providers accept an explicit per-invocation voice or reject the specific voice source locally; no provider target obtains turn identity solely from captured collection options.
3. The A/B/A mocked final-serializer matrix passes for the explicit-turn path on all 12 adapters, Gemini's native matrix passes separately, and output order remains source order under reverse completion.
4. Comic has versioned voice-brief, registration/current-index, audition/take, aggregate snapshot, dialogue-plan, timeline, and audio-run artifacts with checksum, path-safety, privacy, and tamper coverage.
5. `comic reference-voice` supports candidate/import, remote materialization, canonical audition, explicit local approval/current-index promotion, prior-generation identity, bounded price, and truthful resource/reconciliation states.
6. `comic generate-audio` resolves an existing structured scene run, consumes approved aggregate snapshots, supports native/segmented/hybrid planning, caches provider work, assembles locally, and reuses only confirmed eligible checkpointed work without silently repurchasing ambiguous or invalid work.
7. ElevenLabs and Hume pass one shared advanced-provider conformance suite plus their provider-specific discovery, creation/import, take, native, timing, lifecycle, access, fallback, and continuation contracts.
8. Gemini strict exactly-two-speaker native, auto segmented, single-voice, and turn-safe boundary contracts pass; Mistral's current per-turn reference/saved behavior remains a regression guard and the Phase 2 comic MVP works locally with mocked providers.
9. Static/config validation and price modes cause zero provider calls and zero remote/local artifact mutation; price output is stdout only. Optional execution readiness is separately named, read-only, completes for every target, and begins only after deterministic local validation succeeds and before any synthesis.
10. Manifests contain actual request identities, modes, canonical/provider text maps, generated and selected takes, timings, resources, costs, warnings, capability/account observations, and reconciliation state while excluding secrets, raw consent PII, and unsanitized provider responses.
11. All four required delivery phases have independently recorded local verification evidence, and the ADR-008/ADR-018 inventories are updated wherever implementation materially changes their owned scheduling or model contracts.

## Rationale

- Voice identity is durable project state, not a transient string flag. Separating authored briefs, provider registrations, approved auditions, and immutable snapshots makes character continuity reviewable and resumable.
- Explicit invocation identity fixes the root dispatch defect. Another provider-specific override table would remain vulnerable to collectors that close over selection values.
- Capability facets maximize provider coverage without pretending that every provider can design, clone, continue, or render native dialogue. A minimum segmented contract works broadly; advanced facets remain truthful and composable.
- ElevenLabs and Hume exercise almost the full abstraction surface in complementary ways. ElevenLabs proves large-library casting, design/clone variants, and native dialogue with alignment; Hume proves model-scoped acting direction, separate timestamp-capable plans, contextual batches, take selection, and version-compatible continuation.
- Native and segmented paths are both necessary. Native rendering can improve conversational coherence; segmented rendering provides provider portability, deterministic repair, local effects, and granular caching.
- Building dialogue plans from structured comic source preserves exact text, canonical speaker identity, delivery, and source synchronization that the legacy screenplay normalizer loses.
- Explicit preflight and separate provisioning prevent deterministic failures, duplicate clones, hidden remote resources, and unplanned fallback spend.
- The reference-image lifecycle is already a proven project pattern. Reusing atomic promotion and immutable snapshots gives voice assets the same stale/tamper protection without coupling audio state to visual schema.
- Actual request/result metadata is the only trustworthy basis for manifests, cost reports, benchmarks, and debugging.

## Consequences

Positive outcomes:

- Every current provider can participate in comic dialogue through a truthful explicit-voice baseline when its ordinary TTS adapter supports the selected voice source.
- ElevenLabs and Hume become full character-voice platforms instead of generic one-string TTS targets.
- Comic gains stable reference voices, audition/approval, multi-provider casting, exact source linkage, local repair, effects, and timeline artifacts.
- Remote voice creation, verification, approval, expiry, revocation, and deletion become observable lifecycle states rather than hidden side effects.
- Native dialogue can be used where it fits without making it the only path or hiding provider ceilings.
- Per-turn manifests, caches, and benchmark keys become truthful and independently reviewable.
- Provider expansion becomes a conformance task against stable facets rather than another comic dispatch branch.

Negative outcomes:

- The TTS type and artifact surface grows substantially, and current `TtsTarget`/`Step4Metadata` callers must migrate.
- Voice registrations and consent/provenance introduce sensitive lifecycle state that requires careful redaction and project policy.
- Supporting native and segmented rendering creates two execution paths and a more complex resume/timing model.
- First-class ElevenLabs and Hume features are plan-, preview-, verification-, or external-action-dependent and require frequent documentation revalidation.
- Preserving native provider output, normalized working audio, auditions, snapshots, segments, and manifests uses more disk space.
- Legacy multi-provider speaker mappings become invalid until expressed through provider-qualified cast records.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Stable provider-neutral character identity | More schemas, lifecycle state, and migration work |
| Broad segmented compatibility plus provider-native quality | Two render strategies and explicit strategy planning |
| First-class ElevenLabs and Hume capabilities | Deeper provider-specific adapters and more contract fixtures |
| Auditable consent, provenance, resource state, and actual request identity | More project metadata and stricter preflight |
| Targeted line regeneration and local remix without repeat spend | Persistent segment/native-batch caches and storage cost |
| Truthful capability and account-access reporting | Some documented capabilities surface as gated or unavailable instead of optimistic flags |
| Immutable voice continuity across scene resume | Explicit reference generation and promotion before full dialogue |
| Higher-quality configurable masters | More audio-format and post-processing decisions than fixed mono 16 kHz output |

## API / Type Impact

- Replace `MultiSpeakerStrategy = 'native' | 'segment-and-concat'` with a provider render-plan model that distinguishes native dialogue, native utterances, segmented, and explicit hybrid repair.
- Replace `SpeakerVoiceMapping.voice: string` as the authoritative identity with provider-qualified registrations, a profile-qualified current index, and aggregate immutable snapshot manifests. Keep legacy single-provider parsing only as an adapter into transient resolved bindings.
- Change `TtsTarget.run` or add a new target invocation boundary so every call receives explicit voice, speaker/source identity, controls, scheduler context, and cancellation rather than discovering voice identity from captured selection or a mutated `TtsOptions` bag.
- Split `DialogueTurn` into a provider-neutral `ComicDialogueTurn` and provider-specific resolved turn carrying prepared-text mapping and snapshot entry; generic text normalization becomes one optional producer rather than the canonical comic path.
- Add capability-faceted provider adapter types for catalog, design, clone, lifecycle, audition, native dialogue, timing, and continuation.
- Add versioned `CharacterVoiceBrief`, registration/current-index, provisioning journal, candidate, audition/generated-batch/take-selection, `VoiceReferenceManifest`, `ComicDialoguePlan`, `ProviderRenderPlan`, serializer-observed `ProviderRenderResult`, take/final `NormalizedTiming`, `AudioMixPlan`, cache, and audio-run manifest schemas.
- Replace ambiguous `chunkCount` and singular clone fields with turn, request, native-batch, generated/selected-take, output, and created-resource collections. Retain legacy summaries only as derived compatibility data.
- Add a provider-qualified cast input for generic multi-provider TTS. Legacy `--tts-speaker` remains valid only for a single provider.
- Add a shared non-comic `voice` management surface, deprecate resource-creating synthesis flags, and migrate config merge so stored creation defaults cannot mutate provider state.
- Add `comic reference-voice` and `comic generate-audio` to the native comic command tree without reintroducing a second provider stack. Extend the structured-script schema/parser to retain source-linked delivery/timing/overlap intent before the audio planner claims that fidelity.
- Add a bounded dialogue work selector that composes with hosted lanes and local resource gates; update ADR-008 after the scheduler inventory changes.
- Update pricing/preflight types to represent unique provisioning, candidate/take, synthesis-batch, and local assembly costs while preserving zero-call and zero-mutation `--price` behavior.

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Phase 0: add versioned shared capability, transient/approved voice binding, explicit invocation, render plan/result, prepared-text, timing/take, and lifecycle types | TTS maintainers | Pending |
| Phase 0: replace mutable per-turn option overrides and repair explicit voice dispatch for all 12 providers while preserving Mistral reference behavior and Gemini native behavior | TTS provider maintainers | Pending |
| Phase 0: add the parameterized A/B/A request matrix, negative control, static all-target validation, provider-qualified casting, and truthful metadata contracts | TTS test maintainers | Pending |
| Phase 0: add the bounded dialogue selector, cancellation, ordered results, provider-lane telemetry, local resource gating, and safe workspace cleanup; update ADR-008's current-state inventory | Scheduling maintainers | Pending |
| Phase 0: repair Speechify request serialization/local-only classification and refresh or locally reject stale xAI, Deepgram, Gemini, OpenAI, and Groq contracts through ADR-018 wherever selectors change | TTS provider maintainers | Pending |
| Phase 1: add crash-safe provisioning journals/locks, pending/verification/approval/reconciliation/retention/deletion state, consent/provenance policy, and the shared `voice` management surface | Voice lifecycle maintainers | Pending |
| Phase 1: add versioned `character-voices.json`, registration/current-index files, standard audition/take artifacts, sensitive-asset policy, and atomic local approval | Comic maintainers | Pending |
| Phase 1: migrate resource-creating TTS flags/config defaults to explicit voice management and retain legacy read/report compatibility | CLI and config maintainers | Pending |
| Phase 2: extend structured-script schema/parser fidelity and add `comic reference-voice`, `comic generate-audio`, compound/overlap role policies, resolved-run selection, and aggregate immutable voice snapshots | Comic maintainers | Pending |
| Phase 2: add segmented/native-batch/effect/mix caches, selected takes, configurable mastering, timing normalization, licensed asset snapshots, timeline manifests, and dependency-aware resume | Audio workflow maintainers | Pending |
| Phase 2: enforce Gemini strict exactly-two-speaker native planning and turn-safe partitioning; preserve and cache Mistral reference/saved voice behavior | Gemini and Mistral maintainers | Pending |
| Phase 3: implement ElevenLabs discovery/import, design/remix lineage, clone state, pre-approval audition, lifecycle, bounded native Text-to-Dialogue takes, prepared-text alignment, access readiness, and segmented repair | ElevenLabs adapter maintainers | Pending |
| Phase 3: implement Hume discovery, design, clone/import state, pre-approval audition, safe lifecycle, model-constrained acting/timing, native takes, selected-take continuation, access readiness, and segmented repair | Hume adapter maintainers | Pending |
| Phase 4: add remaining MiniMax, Cartesia, and Speechify catalog/design/clone/dialogue facets, then propose a new provider only for a demonstrated casting or privacy gap | TTS provider maintainers | Pending |
| Make benchmark keys voice-aware and update generic/comic TTS help, capability tables, output documentation, and examples | Documentation and benchmark maintainers | Pending |
| Recheck ElevenLabs and Hume official limits, access tiers, preview status, and lifecycle endpoints immediately before implementation and record check dates in capability fixtures | TTS provider maintainers | Pending |

## Test Plan

Build the shared contracts and a local fake provider first. Every advanced adapter must pass the same conformance suite before provider-specific request fixtures are added.

Core local contracts must prove:

- Capability records distinguish scope, maturity, channel, adapter support, simultaneous provider requirements, feature/model/transport constraints, dated source evidence, and credential-scoped account observations; mismatched fixtures and invalid combinations are rejected.
- Static/config and price validation perform no network, artifact mutation, or resource creation and fail all deterministic errors before optional read-only readiness or any target starts.
- Two invocations of one collected target can use different transient or approved voices without mutating the original options, and every materially different model request serializer is covered.
- All 12 providers send A/B/A for Alice/Bob/Alice through explicit turn rendering and preserve source output order under reverse completion; manifest identity comes from the final serializer observation rather than the plan, every requested turn has one linked outcome with no orphan request/batch/output, and Gemini's separate native request contract also remains covered.
- Native, segmented, strict-native failure, planned preflight fallback, and explicit hybrid repair are deterministic and manifest-visible.
- The bounded dialogue selector never exceeds the existing run-global provider and local limits, counts native batches and segmented chunks correctly, is not multiplied by comic visual concurrency, composes with provider lanes without deadlock, cancels queued work after failure, and leaves no temporary workspaces.
- One cloned/designed registration provisions exactly once across concurrent jobs and processes; two characters provision exactly twice; failed or unresolved provisioning causes zero synthesis calls.
- Fault injection before provider creation, after a response, and before local approval yields a durable typed-operation journal whose protected lookup evidence and independent `issuedResources` survive every terminal/error state, or `reconciliation-required`, never an automatic duplicate.
- Pending, verification-required, approval-required, expired, revoked, missing, and deleted resources fail or resume according to their explicit state.
- Missing or revoked consent blocks the configured combination of upload, new synthesis, cache reuse, resume, export, and retention; logs and manifests redact PII and sensitive paths.
- Generic transient plans work without a fabricated `snapshotId`, invalid approved/pending or approved/unauditioned registrations fail strict parsing, and comic plans require only ready approved entries from one aggregate snapshot.
- Strict provider-qualified casts map one character differently per target and reject duplicate targets, duplicate speakers, or locator/target provider mismatch. Stored legacy creation defaults never create resources during config load, price, or render; explicit per-speaker bindings outrank inherited global voice/reference/name values, unmapped speakable roles fail, and migration errors are actionable.
- Generic labeled/screenplay fixtures preserve supported leading parentheticals, reject unknown speakers, classify action/stage content explicitly, and prove complete speakable-source coverage without routing through comic parsing.
- Structured comic dialogue preserves exact source text and migrated delivery/stage/timing source spans, speaker identity, V.O./O.S., captions/narration policy, named non-character roles, compound/synthetic roles, overlap children, panel deduplication, and complete source coverage.
- Current-index approval is atomic; multiple approved profiles coexist; checksum tampering, stale compare-and-swap, mixed snapshot IDs, same-basename source confusion, source checksum drift, and unsafe `role:narrator`/provider/model path components are rejected, while artifacts remain contained within a valid arbitrarily pinned scene-run directory.
- Segmented caches include complete approved or transient binding identity and invalidate only changed turns. Native caches invalidate the containing batch and Hume downstream continuation dependencies; versioned cache entries reject schema/toolchain drift; mix-only changes perform zero provider calls.
- Provider-text tags/normalization retain canonical offset maps with declared units, including non-BMP/combining/multilingual cases; take and final clocks remain distinct, unavailable timing contains no fabricated numeric ranges, and every returned token carries a source turn ID.
- Generated batches persist a batch-keyed unselected state before selection; a selection from another batch fails; multi-take defaults stop for manual choice unless an explicit deterministic policy exists; every take retains identity/take timing/checksum while observed cost stays request/batch-scoped and any per-take allocation is labeled derived.
- Final audio probes match selected sample rate, channel, codec, duration, pause, crossfade, and loudness behavior.
- Room-tone/effect changes use safe checksummed licensed snapshots, invalidate only local effect/mix work, and never leak protected reference assets.
- Every completion path exists after single-, multi-target, native, segmented, mixed, and batch cleanup.
- Multiple voices on one provider/model remain separate benchmark rows, and legacy run/pricing/report/resume/benchmark readers remain compatible through their declared migration window.

ElevenLabs mocked contracts must prove:

- Library/account discovery pagination and metadata normalization.
- Design/remix candidate creation and non-recursive lineage, missing provider iteration IDs, unknown candidate expiry, materialization, canonical audition before local approval, separate shared-source/account-copy identity, and expiry/deletion-eligibility handling.
- Instant clone ready/pending/verification states and gated professional-clone behavior.
- Project-owned lifecycle management without deleting library voices.
- Native plan rejection or turn-boundary partitioning at voice/character limits.
- Text-to-Dialogue final-serializer voice identity, input-order mapping, bounded takes/selection, provider-to-canonical text alignment, take/final timestamp transformation, request-level cost, and within-request context boundaries.
- Segmented repair uses the same approved snapshots.

Hume mocked contracts must prove:

- Library/custom discovery and name-to-ID resolution.
- Octave 1 Voice Design candidate selection, saving for Octave 2 use, canonical audition before local approval, and ambiguous-name rejection.
- Clone API or external-action state is reported truthfully for the current documented surface.
- Model-constrained planning never combines Octave 1-only acting description with Octave 2-only timing; speed and trailing silence remain available where documented.
- Ordered native utterances retain per-turn voice and every supported planned control.
- One-to-five generated takes retain independent identity/take timing under one request-level cost, and word/phoneme events map to source turns and the final transform where the chosen model supports them.
- Generation/context checkpoints resume only from the immediately preceding selected successful take of the same Octave version, and changing that take or version invalidates downstream dependencies.
- Hume deletion requires a fresh unique name-to-expected-ID proof or becomes an external action.
- Segmented repair uses the same approved snapshots.

For this proposed ADR documentation change, run the default repository verification and whitespace check:

```bash
bun run check
git diff --check
```

As implementation lands, add the named local suites below and run them together with the existing targeted, no-cost contracts:

```bash
bun run check
bun test test/test-cases/validation/media-generation/tts-explicit-voice-conformance.test.ts
bun test test/test-cases/validation/media-generation/tts-native-batch-cache-and-takes.test.ts
bun test test/test-cases/validation/media-generation/tts-voice-provisioning-lifecycle.test.ts
bun test test/test-cases/validation/comic/comic-voice-reference-artifacts.test.ts
bun test test/test-cases/validation/comic/comic-dialogue-plan-and-audio.test.ts
bun test test/test-cases/validation/media-generation/tts-dialogue-contracts.test.ts
bun test test/test-cases/validation/media-generation/tts-batch-output-contracts.test.ts
bun test test/test-cases/validation/providers/tts-provider-contracts/openai-grok-groq.test.ts
bun test test/test-cases/validation/providers/tts-provider-contracts/mistral-elevenlabs.test.ts
bun test test/test-cases/validation/providers/tts-provider-contracts/deepgram-minimax.test.ts
bun test test/test-cases/validation/providers/tts-provider-contracts/speechify.test.ts
bun test test/test-cases/validation/providers/tts-provider-contracts/hume-cartesia.test.ts
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/
git diff --check
```

Do not run `bun run t`, `bun test/test-runner.ts`, a hosted TTS command, a provider voice-creation command, provider smoke tests, or an e2e path with cost, quota, billing, or price association. Any live ElevenLabs, Hume, or other provider validation requires immediate explicit approval naming the exact command and expected cost or quota risk.

## References

- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — type-domain ownership and the `~/types` barrel
- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md) — shared provider infrastructure and native comic command ownership
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — hosted TTS provider lanes and the current unbounded multi-speaker turn inventory
- Related ADR: [ADR-012](ADR-012-add-price-preflight-to-resume.md) — side-effect-free price planning
- Related ADR: [ADR-018](ADR-018-refresh-current-hosted-tts-and-music-models.md) — current TTS model contracts and the boundary between models and voice capabilities
- Source report: [Comic Character Voice and Multi-Character TTS Options](../reports/comic-character-tts-options-report.md)
- `src/types/tts-workflow/tts-types.ts`
- `src/types/tts-workflow/dialogue-normalizer-types.ts`
- `src/types/pipeline-core/process-generation-types.ts`
- `src/cli/commands/process-steps/step-4-tts/run-multi-speaker-tts.ts`
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
- `src/cli/commands/setup-and-utilities/models/tts-models.ts`
- [ElevenLabs Text-to-Dialogue](https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue)
- [ElevenLabs Text-to-Dialogue with timestamps](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps)
- [ElevenLabs voices overview](https://elevenlabs.io/docs/overview/capabilities/voices)
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
