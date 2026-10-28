# ADR-012: TTS Synthesis, Voice Management, and Delivery

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-10
- **Date Updated:** 2026-10-28
- **Verification Status:** Passed
- **Supersession:** Absorbs the shared TTS and voice-management authority of "Add Character Voice References and Multi-Speaker Script-to-Audio" and all of "Master TTS Delivery Audio Outside Paid Slot Identity". Comic scene-run authority belongs to [ADR-013](ADR-013-comic-scene-audio-and-presentation.md).

## Context

The original `tts` workflow could map speakers and concatenate turn files, but it could not represent provider-specific casting, consent, voice lifecycle, or stable character identity. Per-turn voice overrides were ignored while metadata recorded them as applied. Comic needed these capabilities through shared TTS rather than a second synthesis stack.

Delivery also reduced hosted audio to 16 kHz mono, split long text without sentence-aware boundaries, and lacked loudness normalization or book exports. Changing the output format within the existing purchased-audio identity would have prevented reuse of already purchased speech. Delivery improvements therefore needed a separate identity and a recovery path that preserved paid audio.

This record works inside the canonical `manifest.json` and no-provider `resume --price` rules of [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), the shared hosted lanes of [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md), and the model-selector contract of [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), which leaves voice identity and dialogue capability to this decision.

Why now: multi-character script-to-audio was the next workflow requirement and its dispatch and artifact contracts had to be trustworthy before voice design, clone, or native dialogue enlarged them; a later review of audiobook production then found the 16 kHz re-encode to be the largest fidelity loss in the pipeline.

## Options Considered

### Script-to-audio architecture

**Option 1 (selected)**

- **Option:** Build shared voice-identity, provisioning, capability, dialogue-rendering, timing, and artifact primitives beneath `tts` and comic, with native dialogue where a model supports it and a truthful segmented baseline everywhere else
- **Pros:** Repairs the contract once for every provider; keeps provider-native strengths; supports immutable voice references, local repair, and resume
- **Cons:** Largest initial change; two render strategies and lifecycle state to maintain
- **Quantitative Notes:** Shared contracts cover every active TTS provider

**Option 2**

- **Option:** Patch per-turn voice arguments into the existing TTS options bag
- **Pros:** Small change; basic speaker switching would work
- **Cons:** Identity, consent, capabilities, provider-qualified casting, and lifecycle stay unmodeled
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Build an ElevenLabs-only script-to-audio workflow
- **Pros:** Fastest route to the broadest managed feature set
- **Cons:** Locks artifacts and commands to one provider and bypasses shared TTS
- **Quantitative Notes:** One provider; no portable baseline

**Option 4**

- **Option:** Use only independent turn synthesis and local assembly
- **Pros:** Works for nearly every provider; simplest cache and repair model
- **Cons:** Discards native conversational context and timing where providers offer it
- **Quantitative Notes:** No native capability use

**Option 5**

- **Option:** Use only provider-native dialogue
- **Pros:** Maximizes provider-owned context
- **Cons:** Excludes providers without native dialogue, fails on speaker or length ceilings, and weakens single-line repair
- **Quantitative Notes:** n/a

**Option 6**

- **Option:** Add voice fields directly to the visual character catalog
- **Pros:** One character file to inspect
- **Cons:** Couples provider resources, consent, and audio settings to a strict visual schema
- **Quantitative Notes:** n/a

### Delivery mastering

**Option 1 (selected)**

- **Option:** Keep purchased-audio identity on its historical output format, describe final audio with a separate delivery profile that identifies the render only, master once from retained provider audio, and treat encoding, tags, cover art, and book assembly as exports outside render identity
- **Pros:** Previously purchased audio stays usable under a new profile; a recovered run matches a normal run; the same behavior applies to every hosted provider
- **Cons:** Purchased-audio identity still records the historical format; TTS delivery settings are separate from comic and soundscape mastering
- **Quantitative Notes:** Local contracts verify re-mastering retained audio with zero provider requests

**Option 2**

- **Option:** Change the defaults of the existing mastering settings and send that profile through the hosted chunk pipeline
- **Pros:** Smallest change
- **Cons:** Those settings identify purchased audio, so every existing directory would buy its audio again
- **Quantitative Notes:** Every retained chunk would require another purchase

**Option 3**

- **Option:** Use provider continuity fields for chunk seams and leave assembly unchanged
- **Pros:** Prosody carry-over handled by the provider where supported
- **Cons:** Unavailable on `eleven_v3`, conflicts with safe retry where a fresh run and a resume would send different requests, and leaves the 16 kHz re-encode in place
- **Quantitative Notes:** No active adapter implements provider continuity

## Decision

Provider eligibility follows [ADR-010’s billing policy](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md#subscription-free-api-eligibility).

One shared, provider-neutral script-to-audio subsystem sits beneath `tts` and comic. It owns provider capabilities, voice provisioning and lifecycle, explicit per-invocation voice dispatch, native and segmented rendering, timing, scheduling, synthesis metadata, and delivery mastering. Comic consumes it for scene runs under [ADR-013](ADR-013-comic-scene-audio-and-presentation.md) and never creates provider clients or a second TTS stack.

Active models and management capabilities come from the TTS and voice registries, with their current supported combinations documented in the [TTS overview](../commands/04-audio/tts/overview.md) and [voice overview](../commands/04-audio/voice/00-voice-overview.md). Each synthesis request receives the resolved voice explicitly, including a documented default for single-voice runs; speaker mappings cannot silently fall back to another voice.

Purchased speech keeps the historical output format in its identity. A separate delivery profile, selected with `--tts-audio-profile` and the related mastering flags, identifies the render, and one mastering step produces the delivered file from the provider audio already stored for that purchase.

This applies to:

- Standalone `tts` and its `resume` path for every hosted provider: single-voice, segmented multi-speaker, and native dialogue.
- `voice` registration, catalog, and lifecycle actions for supported stock, saved, designed, and cloned voices.
- Chunk planning, seam mastering, loudness normalization, exports, tags, cover art, book assembly, the pronunciation lexicon, and text preflight.

It does not apply to:

- Treating configured credentials as proof of plan-, approval-, verification-, or region-gated voice capabilities.
- Implicit remote voice creation during synthesis, configuration loading, resume, cleanup, or `--price`, or cloning without recorded provenance and consent.
- Hosted lane ramp, rate-limit recovery, and work scheduling, which belong to [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md). This record only joins dialogue turns to those lanes.
- Comic scene runs, voice briefs, scene snapshots, dialogue plans, `--delivery-policy`, soundscape, and presentation, which belong to [ADR-013](ADR-013-comic-scene-audio-and-presentation.md). The visual character catalog does not embed voice fields.
- Retry classification and the authorization semantics of `--allow-ambiguous-redispatch`, which belong to [ADR-005](ADR-005-cli-error-result-and-retry-contract.md). This record applies that authorization to persisted TTS slots.
- Provider continuity fields. ElevenLabs stitching stays unused.

### Commands

`tts` synthesizes with an existing stock, designed, or cloned voice. `voice` manages registration and lifecycle; its `list` action also provides local inspection and supported remote catalogs. Remote design, clone, and delete actions require declared provider capabilities. `comic reference-voice` remains a deprecated alias ([ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md)).

Expressiveness stays model-specific. There is no shared delivery-tag language; exact tags and request controls are in the [TTS command docs](../commands/04-audio/tts/overview.md).

### Voice lifecycle and preflight

A declared capability, an implemented adapter, and current-account access are separate facts. Preflight has three phases:

1. Static and config validation, including `--price`: local checks only, no network, no mutation.
2. Execution readiness: authorized read-only remote inspection after local checks pass.
3. Provisioning and synthesis: explicitly selected provider-mutating phases.

`tts` and `comic generate-audio` synthesize and apply dialogue controls but cannot create or delete remote voices. Only `voice` accepts creation, clone, design, import, consent, and lifecycle inputs. Voice design separates candidate creation and saving from local audition and approval. Cloning requires recorded provenance and consent. Remote deletion requires an explicit management action. Voice assets and consent records live in a protected store outside output roots.

`voice <action>` is the one management entry point for standalone and comic character voices. Import, design, and clone stay separate operations because local registration, paid design preview, and authorized sample cloning have different consent and lifecycle boundaries. Approval, audition, retirement, and deletion also stay separate: approval promotes existing evidence locally, audition can synthesize paid audio, retirement changes local lifecycle state, and deletion can remove a remote resource. Usage is in the [voice overview](../commands/04-audio/voice/00-voice-overview.md).

### Rendering, resume, and compact

Standalone `tts` automatically selects native dialogue when the model and speaker mappings meet its constraints, and segmented rendering otherwise. Native rendering uses ElevenLabs `eleven_v3` Text-to-Dialogue or eligible Gemini TTS multi-speaker synthesis. Gemini native dialogue requires two eligible stock voices. Segmented rendering synthesizes turns independently and assembles them locally; authored overlaps and local voice effects require this strategy. Explicit `--mode` selection belongs to comic scene audio under [ADR-013](ADR-013-comic-scene-audio-and-presentation.md).

Dialogue work uses the shared hosted TTS lanes. An ambiguous paid admission is never retried inside the running command. Continuing one requires `--allow-ambiguous-redispatch`, which warns that the slot may be purchased again. If synthesis stops after any request is sent, successful outputs are kept and the failure report names the reusable and unresolved slot counts.

Purchased audio is reused only when its provider, model, voice, and speech request identity match verified retained evidence. A changed voice snapshot creates a new render identity without invalidating unrelated completed slots. `--price` subtracts reusable slots and reports zero spend when the render can be assembled locally. A fully reused render completes without a provider call.

Output storage has three lifetime classes:

**Class 1: Working**

- **When it exists:** In-flight only
- **Retention:** Temporary render files are removed after successful publication

**Class 2: Resume**

- **When it exists:** Incomplete or failed
- **Retention:** Keeps working audio, completed slots, and reconciliation evidence; interrupted runs must retain their output directory

**Class 3: Archive**

- **When it exists:** After successful compact
- **Retention:** Keeps playable final audio and compact render/timeline records; completed standalone runs losslessly bundle purchased audio into `slots/audio.zip` (under each item for directory runs). Price inspection validates the bundle without extraction; local assembly restores the required clips

### Delivery mastering and export

New runs use smart chunk boundaries that respect provider request limits and protected speech syntax. Dispatch, timing estimates, and joins use the same resolved chunks; recovery preserves the text of older purchased plans. Default output keeps the provider's sample rate. Both `native` and `audiobook` preserve provider silence with trimming off and zero added join padding. Pause flags add silence only between chunks, without changing pauses inside a provider request. Opt-in trimming preserves internal pauses and leaves ambiguous or all-silent audio intact. Audiobook mastering normalizes loudness and adds 500 ms before and 1,000 ms after the audio. Saved profiles retain their original trim and gap values.

Encoding to `flac`, `mp3`, `m4a`, or `m4b`, tags, cover art, and one book file per directory with one chapter per input are exports derived from the WAV master. They do not identify the render, are recorded in the manifest, and can be rebuilt without a new render or purchase. A pronunciation lexicon is applied before chunking, and a text preflight rejects speech markup the provider documents as unsupported.

A canonical directory created before delivery mastering keeps its purchased slots. When no chunking or mastering flag is explicit, `resume` and `resume --price` adopt that run's legacy chunking and 16 kHz output. Current runs restore saved delivery, chunking, and pronunciation settings; an explicit incompatible override fails closed without spending. Rerunning a completed directory leaves completed chapters unchanged and can rebuild only its export layer. Single-file runs do not attach to an existing directory. Pre-canonical TTS manifests remain unreadable and must be rebuilt with the current `tts` command ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).

### Gemini transport and lifecycle

Gemini offers unary synthesis, buffered streaming, and explicit remote Batch execution. Native dialogue preserves provider takes without inventing turn timestamps. Batch resume collects purchased results before submitting missing work; ambiguous submission blocks automatic recreation. Cancelling local waiting leaves remote work running unless cancellation is explicitly requested. Delivery settings remain separate from transport request identity.

Gemini voice design creates persistent candidates before selection, and saving adopts the selected resource rather than recreating it. Replication requires consent, a reference recording, and separate consent audio. Known expiry and project ownership govern new synthesis and deletion. Undocumented voice-operation prices remain unknown; synthesis estimates remain estimates rather than invoices.

## Rationale

- Voice identity is durable project state, so registrations, auditions, and snapshots keep a character consistent across scenes and providers.
- An explicit voice on every turn stops metadata from claiming a mapping the provider never received, and declared capabilities keep each provider honest about design, clone, and native dialogue support.
- Native rendering keeps conversational context where the model supports it; segmented rendering keeps portability and single-line repair.
- Buying the same speech twice is the most expensive failure this pipeline can have, so purchased-audio identity stays fixed before any default changes.
- A delivery profile changes the audio the user receives, so it identifies the render; tags and containers leave the master unchanged, so they can be rebuilt freely.
- The same planning and assembly behavior applies to every hosted provider, and provider-specific controls stay on the registry-backed flags from [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md).

## Consequences

Positive outcomes:

- All configured TTS providers share the explicit-voice boundary, and unsupported controls fail locally before any spend.
- A character voice can be auditioned, approved, and kept stable across scenes and providers, and a single line can be repaired without repeating the whole synthesis.
- Remote voice creation, approval, expiry, and deletion are explicit lifecycle states.
- A successful run keeps one paid copy per slot plus the published masters, and purchased audio stays usable under any later delivery profile.

Negative outcomes:

- Callers work with structured voice artifacts and a formal preflight instead of a single voice string.
- Native dialogue and segmented fallback are both maintained, including their timing alignment.
- Compact removes in-flight records, so post-success debugging relies on the compact cost, retry, and error summary.

## Trade-offs

**Trade-off 1**

- **Gain:** Stable provider-neutral character identity with auditable consent and provenance
- **Sacrifice:** Additional voice artifacts, lifecycle state, and a stricter preflight

**Trade-off 2**

- **Gain:** Segmented compatibility on every provider plus native dialogue where supported
- **Sacrifice:** Two render strategies and a planner that chooses between them

**Trade-off 3**

- **Gain:** A crashed run continues from its completed slots and a single line can be repaired
- **Sacrifice:** Retained source audio for each paid generation

**Trade-off 4**

- **Gain:** Existing output directories keep their purchased audio under any new profile
- **Sacrifice:** Purchased-audio identity still records the historical output format

**Trade-off 5**

- **Gain:** Users can add pauses at chunk joins and opt in to edge trimming
- **Sacrifice:** Added pauses do not shorten provider silence, and trimming can affect very quiet edge speech despite its speech guards

## Implementation Note

Shipped through `src/cli/commands/audio/tts/define-tts-command.ts` and `src/cli/commands/audio/voice/define-voice-command.ts`. Shared delivery presets live in `src/cli/commands/audio/tts/tts-utils/tts-delivery-profile.ts`; comic consumes the subsystem under [ADR-013](ADR-013-comic-scene-audio-and-presentation.md).

## API / Type Impact

- Before: a speaker map was a speaker string plus a voice string or path, and synthesis options mixed voice selection with invocation.
- After: speaker maps resolve to explicit provider voice bindings. `tts` uses existing voices; `voice` owns lifecycle actions. `--allow-ambiguous-redispatch` authorizes another attempt at unresolved paid work.
- Delivery: mastering flags identify the render; export format, tags, and cover art identify derived exports. Neither changes purchased-slot identity. Chunking and pronunciation changes can change the speech requests and require new synthesis.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/audio/tts/
bun test test/test-cases/validation/audio/voice/
bun test test/test-cases/validation/resume-manifests/tts-resume-delivery-adoption-contracts.test.ts
```

1. Price commands stay no-cost and dispatch no provider.
2. TTS contracts prove explicit per-turn voice dispatch, slot reuse, compact retention, blocked automatic redispatch, and the delivery profile, chunk planner, seam mastering, and export layer against retained slot audio.
3. Voice contracts prove the lifecycle actions and capability gating without live provider calls.
4. Resume contracts verify adoption of retained plans and rejection of incompatible explicit settings before dispatch. These local checks do not establish spoken correctness or perceptual quality.

## Follow-up Actions

- [ ] Listening pass on the paid `eleven_v3` pilot — Pending
  Retain `output/2026-09-18_tts-delivery-pilot` for review of seam naturalness, pause lengths, and cross-chunk prosody; decoded integrity and transcript checks do not establish those qualities.
- [ ] Expose completed-run re-mastering through the CLI — Pending
  Local rendering supports reuse under a new profile, but completed directory reruns skip existing chapters.
- [ ] Re-export a single-file run that already exists in a directory — Pending

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — canonical run manifest, resume, and dry-run price planning
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — type domain ownership and `~/types` barrel
- Related ADR: [ADR-005](ADR-005-cli-error-result-and-retry-contract.md) — retry classification and ambiguous-redispatch authorization
- Related ADR: [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md) — canonical `voice` command and the deprecated `comic reference-voice` alias
- Related ADR: [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md) — hosted TTS provider lanes and bounded turn selector
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — TTS model contracts and voice capability boundaries
- Related ADR: [ADR-013](ADR-013-comic-scene-audio-and-presentation.md) — comic scene runs, soundscape, and presentation over this subsystem
- Related ADR: [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md) — registry-backed provider-general TTS flags
- Related ADR: [ADR-019](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md) — pre-dispatch size estimates for inlined TTS audio
- TTS catalog: [docs/commands/04-audio/tts/overview.md](../commands/04-audio/tts/overview.md)
- [voice overview](../commands/04-audio/voice/00-voice-overview.md)
- [Retained recording assessment](../benchmarks/tts/assessment.md) — offline ASR and signal evidence, without subjective quality ratings
