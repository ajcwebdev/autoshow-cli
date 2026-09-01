# ADR-013: Add Character Voice References and Multi-Speaker Script-to-Audio

> Historical note: Fish support described by this decision was removed on 2026-09-01. DeepInfra TTS was also removed; its STT and OCR integrations remain active.

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-10
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed

## Context

AutoShow can synthesize single-voice speech through 16 providers and already has a generic multi-speaker parser, speaker mappings, turn files, local concatenation, and a native Gemini branch. Comic already supplies structured scripts with stable source-segment IDs, character keys, speaker labels, spoken text, and delivery notes.

Those pieces do not form a trustworthy multi-character script-to-audio workflow. Comic has no command for creating, selecting, auditioning, approving, or snapshotting a character voice, and no command for turning a structured script into multi-character audio. The generic TTS speaker map is only a speaker string plus a provider-agnostic voice string or path. It cannot express provider-specific castings, design or clone state, access restrictions, consent, delivery controls, remote-resource lifecycle, or immutable voice identity.

The existing multi-speaker contract was also incorrect: most segmented adapters captured the original voice during target collection and ignored per-turn overrides, while final metadata recorded the requested mappings as if every provider had used them. Provider capabilities are richer than one `voice` string, and comic must consume those capabilities through shared TTS instead of a second client stack.

This decision is constrained by existing architectural rules:

- ADR-002 reserves one unversioned canonical `manifest.json` for every run root, makes its item and provider state the only persistence authority, and rejects compatibility readers for retired pipeline formats.
- ADR-007 requires comic to adapt domain semantics to shared provider infrastructure instead of maintaining a comic-local model or dispatch stack.
- ADR-008 makes hosted TTS provider lanes and bounded work scheduling the shared concurrency boundary; multi-speaker turn work must join that model.
- ADR-002 requires `resume --price` to remain a no-provider, non-mutating dry run; this ADR applies the same rule to TTS price planning and separates static validation from execution readiness.
- ADR-010 treats a TTS model selector as a complete runtime promise and leaves voice identity and specialized reference or dialogue capabilities to a separate decision such as this one.

Why now: multi-character script-to-audio is the next workflow requirement, with comic as its first structured-script consumer. Dispatch and artifact contracts must be corrected before voice-design, clone, or native-dialogue features enlarge an untrustworthy surface.

## Options Considered

**Option 1 (selected)**

- **Option:** Build shared voice-identity, provisioning, capability, dialogue-rendering, timing, and artifact primitives; make comic consume them; implement five voice-managed model adapters with a truthful segmented baseline across all 16 providers
- **Pros:** Repairs the current contract once; gives every provider a truthful segmented baseline; preserves provider-native strengths; supports immutable character references, local repair, comparison, and resume across five dedicated voice-managed models (ElevenLabs `eleven_v3`, Inworld `realtime-tts-2`, Fish `s2.1-pro`, Cartesia `sonic-3.5-2026-05-04`, and Speechify `simba-3.2`)
- **Cons:** Largest initial change; requires versioned artifacts, provider conformance tests, lifecycle state, and two render strategies
- **Quantitative Notes:** 16 providers; 5 voice-managed models with distinct expressiveness paths; 11 synthesis-only providers; 2 new comic commands

**Option 2**

- **Option:** Patch per-turn voice arguments and add comic flags directly to the existing TTS options bag
- **Pros:** Smaller short-term change; can make basic speaker switching work
- **Cons:** Leaves identity, consent, capabilities, provider-qualified casting, snapshots, resource lifecycle, and native dialogue unmodeled; generic options continue to mix selection and invocation
- **Quantitative Notes:** 1 patched defect; remaining identity and lifecycle gaps unmodeled

**Option 3**

- **Option:** Build an ElevenLabs-only script-to-audio workflow
- **Pros:** Fastest route to the broadest managed provider feature set
- **Cons:** Locks script-to-audio artifacts and commands to one provider, bypasses shared TTS, and makes Hume, Mistral, Gemini, or local fallback expensive to add later
- **Quantitative Notes:** 1 provider; no portable baseline

**Option 4**

- **Option:** Use only independent turn synthesis and local assembly
- **Pros:** Works for nearly every provider; simplest cache and repair model
- **Cons:** Discards native conversational context, timestamps, and continuation available from ElevenLabs, Fish, Hume, and Gemini
- **Quantitative Notes:** 16 potential segmented providers; 0 native capability use

**Option 5**

- **Option:** Use only provider-native dialogue
- **Pros:** Maximizes provider-owned context
- **Cons:** Excludes providers without native dialogue, fails on speaker or length ceilings, weakens targeted repair, and creates provider-specific artifacts
- **Quantitative Notes:** At most a few current providers; Gemini is exactly two speakers

**Option 6**

- **Option:** Add voice fields directly to the visual character catalog
- **Pros:** One character file to inspect
- **Cons:** Couples provider resources, consent, expiry, and audio settings to a strict visual schema and forces unrelated schema migrations
- **Quantitative Notes:** Visual catalog is strict schema version 3

## Decision

Create one shared, provider-neutral script-to-audio subsystem beneath both the generic Step 4 `tts` command and comic. Comic owns authored character voice briefs, role resolution, approvals, immutable scene snapshots, and source-linked dialogue plans. Shared TTS owns provider capabilities, voice provisioning and lifecycle, explicit per-invocation voice dispatch, native and segmented rendering, timing, scheduling, and synthesis metadata. Comic must not create provider clients or a second TTS target registry.

Voice reference management is supported across five models: ElevenLabs `eleven_v3`, Inworld `realtime-tts-2`, Fish `s2.1-pro`, Cartesia `sonic-3.5-2026-05-04`, and Speechify `simba-3.2`. These models implement discovery, candidate creation, audition, registration, lifecycle, preflight, expressiveness, timing, and manifest contracts according to their documented capabilities. Every existing TTS provider must implement the explicit-voice segmented baseline or fail locally with a truthful model-specific capability error; no adapter may silently reuse a captured default voice.

This applies to:

- All current generic multi-speaker TTS behavior, metadata, artifacts, validation, scheduling, and provider request contracts.
- Comic character voice briefs, reference-voice creation, import, audition, approval, immutable voice snapshots, dialogue planning, audio generation, caching, assembly, effects, timing, resume, domain artifacts, and canonical scene-run state.
- Existing providers' stock, saved, custom, designed, cloned, or request-time reference voice sources as their adapters truthfully support them.
- Durable catalog, design, clone, inspect, and delete lifecycle contracts for the five voice-managed models.
- Native multi-speaker dialogue or utterance rendering where supported (ElevenLabs `eleven_v3` Text-to-Dialogue, Fish `s2.1-pro` native multi-speaker streaming, Gemini two-speaker dialogue, and Hume `octave-2` native utterances) with segmented fallback when scene constraints or model limits require it.

It does not apply to:

- Azure, Google Cloud TTS, Polly, or Resemble, which are not added before the shared contracts are stable.
- Treating configured credentials as proof that an account has plan-, approval-, verification-, or region-gated voice capabilities.
- Implicit remote voice creation during ordinary synthesis, configuration loading, resume, cleanup, or `--price`.
- Cloning without recorded provenance and consent, or cross-provider cloning from a generated audition unless explicitly authorized.
- Hosted lane ramp, rate-limit recovery, and work-selector fairness, which belong to [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md); this ADR only joins dialogue turns to those lanes.
- Sound-effect intent, stems, and mixing, which belong to [ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md).
- Panel synchronization and still-image presentation, which belong to [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md). ADR-018 may consume the immutable audio run and original timeline as read-only evidence and must not change voice identity, provider execution evidence, dialogue ranges on the original clock, or any ADR-013 artifact.
- Embedding voice fields in the visual character catalog, which remains schema version 3.
- Live paid provider runs as ADR verification. Live quality calibration remains a separately approved activity.

### Commands and ownership

`tts` synthesizes with one existing stock, designed, or cloned voice ID and remains compatible with every implemented TTS model. `voice` and `comic reference-voice` manage durable catalog, design, clone, inspect, and delete resources only for the five voice-managed models. Every other implemented TTS model stays synthesis-only.

```text
structured-script.json
  -> comic dialogue plan and approved voice snapshot
  -> shared render planner (native or segmented)
  -> shared synthesis, timing, and local assembly
  -> comic timeline, compact result, and final recording
```

**Owner 1: Comic workflow**

- **Owner:** Comic workflow
- **Responsibilities:** Character voice briefs, canonical character and role resolution, reference approval, dialogue plans, scene voice snapshots, source provenance, effect intent, and comic output paths
- **Must not own:** Provider HTTP clients, provider model registries, request retry policy, provider pricing, presentation timing, or video rendering

**Owner 2: Shared script-to-audio workflow**

- **Owner:** Shared script-to-audio workflow
- **Responsibilities:** Provider voice references and registrations, capability facets, access state, explicit synthesis invocation, provider preflight, render planning, timing, segmented and native execution, audio assembly, cache keys, and synthesis metadata
- **Must not own:** Comic scene drafting, panel semantics, or the visual character schema

**Owner 3: Provider adapter**

- **Owner:** Provider adapter
- **Responsibilities:** Exact catalog, design, clone, lifecycle, request, response, limit, timing, continuation, and access-state mappings for one provider and model
- **Must not own:** Cross-provider casting policy, comic source parsing, or silent fallback

**Owner 4: Local artifact layer**

- **Owner:** Local artifact layer
- **Responsibilities:** Checksums, atomic promotion, versioned domain artifacts, caches, canonical-manifest references, mastering, and effects
- **Must not own:** A second pipeline manifest, an independent resume authority, remote deletion as ordinary cleanup, or secrets and raw consent PII in artifacts

### Voice-managed expressiveness

Each voice-managed model must expose a working expressiveness path. The methods are not unified: ElevenLabs uses v3 audio tags plus style, stability, and similarity; Inworld uses a request-level instruction plus inline vocal tags; Fish uses in-text emotion and delivery markup; Cartesia uses SSML-like performance tags plus `[laughter]`; Speechify uses SSML `<speak>` with prosody, break, emphasis, sub, and `speechify:style`. Exact tag allowlists and request-control flags live in the TTS command docs.

### Scene-run artifacts and protected voice store

Every comic scene run owns exactly one canonical, unversioned `<scene-run>/manifest.json`. Audio render directories are provider artifact directories inside that scene run, not independent run roots, and never contain another `manifest.json`.

The manifest records the structured script, dialogue and snapshot identities, selected audio runs, mix, timeline, and checksums. Domain records such as `voice-reference-snapshot.json`, `render.json`, and `audio-run.json` are referenced by relative path and checksum.

The protected voice store is kept outside output roots. It holds voice assets, consent records, and provisioning journals under owner-only permissions. Visual character schemas remain unchanged and do not embed voice fields.

### Voice lifecycle and preflight

Capability presence, adapter implementation, and current-account access are separate facts. Configured credentials do not prove that an account can design, clone, or use a gated voice.

Preflight has three named phases:

1. Static and config validation, including `--price`: local descriptors only, zero network, zero mutation.
2. Execution readiness: authorized read-only remote inspection after local checks pass.
3. Provisioning and synthesis: explicitly selected provider-mutating phases.

`tts` and `comic generate-audio` govern synthesis and dialogue controls only. They cannot create or delete remote voices. `voice` and `comic reference-voice` accept creation, clone, design, import, consent, and lifecycle inputs. Voice design is two-phase: materialize a candidate remotely, then approve the registration locally. Cloning requires recorded provenance and consent. Remote deletion requires an explicit management action.

`comic generate-audio <script>` consumes a compatible existing scene run. A nonempty target that fails exact source, manifest, and structured-script compatibility is rejected without rewriting those files. The command maps every role against an approved registration snapshot, preserves every speakable segment, and never drops content or falls back silently. `--delivery-policy strict` rejects unsupported authored delivery; `best-effort` records it and continues.

### Rendering, resume, and compact

`--mode` selects `auto`, `native`, or `segmented`:

- `auto` uses native rendering when the model, account, speaker count, turn lengths, and voice registrations fit provider limits; otherwise it uses segmented rendering.
- `native` requires native multi-speaker dialogue and fails preflight when constraints are violated.
- `segmented` synthesizes each turn independently, then normalizes timing and assembles locally.

Gemini native dialogue is exactly two distinct speakers; other speaker counts use segmented synthesis. Authored overlaps and local voice-effect filters also force segmented rendering.

Per-turn synthesis passes an explicit voice to the provider. Dialogue work runs under the shared hosted TTS lanes from [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md). Ambiguous paid admissions are never redispatched inside the running command. Resuming one requires `--allow-ambiguous-redispatch`, which must warn that the slot may be purchased again.

Completed audio is reused by content-addressed slot files at `audio/slots/<slotHash>.wav`. A later render with the same slot identity spends nothing. A changed voice snapshot creates a new render identity but does not invalidate unrelated completed slots. `--price` subtracts retained slots and reports zero spend when a render can be assembled locally. `--max-generation-slots` can checkpoint after a bounded number of new slots without publishing a final WAV.

If synthesis stops after any request dispatch, successful outputs and admission states are preserved. The failure diagnostic reports reusable and unresolved slot counts and names `--allow-ambiguous-redispatch` when ambiguous paid admissions block automatic continuation.

Output storage has three lifetime classes:

**Class 1: Working**

- **Class:** Working
- **When it exists:** In-flight only
- **Retention and Compaction Rule:** Written under `audio/work/`. Deleted automatically when that target's selected success publishes.

**Class 2: Resume**

- **Class:** Resume
- **When it exists:** Incomplete or failed
- **Retention and Compaction Rule:** Preserves the working tree, admission journal, completed `audio/slots/<slotHash>.wav` files, and matching result records. Never deletes paid audio.

**Class 3: Archive**

- **Class:** Archive
- **When it exists:** After successful compact
- **Retention and Compaction Rule:** Retains published masters (`audio/final/<targetKey>.wav`), referenced slot WAVs, bound voice snapshots, and compact records such as `render.json`. Unreferenced working files are pruned.

A fully reused render closes as a local composition with no provider call and no journal.

## Rationale

- Voice identity is durable project state; separating briefs, registrations, auditions, and snapshots keeps character continuity across scenes and providers.
- Explicit per-turn voice identity prevents the capture bug where collectors retain a default voice while metadata claims the requested mapping.
- Capability facets let each provider use its documented strengths while every provider keeps a reliable segmented fallback.
- Five voice-managed models cover discovery, design, instant cloning, expressiveness, native dialogue, and lifecycle management without pretending that every TTS model exposes those ports.
- Native and segmented paths are both required: native preserves conversational context where it exists, and segmented keeps portability, speaker-count fallback, and targeted line repair.
- Recorded request and result evidence keeps cost accounting, resume identity, and compact archives truthful.

## Consequences

Positive outcomes:

- All 16 TTS providers participate in the shared explicit-voice and capability boundary; providers without a verified native or voice-management facet fail locally rather than fabricating support.
- Five models get first-class voice management across discovery, design, cloning, inspect, delete, and model-specific expressiveness.
- Comic gains stable voice references, audition and approval workflows, local repair, and mastering contracts.
- Remote voice creation, verification, approval, expiry, and deletion become explicit, observable lifecycle states.
- Pipeline manifests reflect the voices and models that were actually used.
- Successful runs compact to one paid copy per slot, published masters, and a handful of compact records.

Negative outcomes:

- Subsystem complexity increases, requiring structured domain artifacts and formal preflight checks.
- Sensitive voice assets and consent data require a protected store and strict path isolation.
- Maintaining native dialogue alongside segmented fallback requires dual render strategies and timing alignment.
- Compact deletes in-flight journals, so post-success debugging uses only the compact cost, retry, and error summary.

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

## Implementation Note

- Shared explicit-voice dispatch, native and segmented planning, slot cache, compact, and resume: `src/cli/commands/process-steps/step-4-tts/script-to-audio/`
- Voice management command, consent, and registrations: `src/cli/commands/process-steps/step-4-tts/voice-management/`
- Protected voice assets: `src/cli/commands/process-steps/step-4-tts/voice-assets/`
- Comic audio generation: `src/cli/commands/process-steps/step-8-comic/comic-commands/generate-audio/`
- Comic reference-voice command: `src/cli/commands/process-steps/step-8-comic/comic-commands/reference-voice/`
- Public types: `src/types/tts-workflow/` and `src/types/comic-workflow/`, exported only through `src/types/index.ts`

## API / Type Impact

- Before: a speaker map was a speaker string plus a provider-agnostic voice string or path, and synthesis options mixed voice selection with invocation.
- After: speaker maps carry provider-qualified voice bindings. `tts` and `comic generate-audio` synthesize with an existing voice and never create or delete remote voices. `voice` and `comic reference-voice` own catalog, design, clone, inspect, and delete for the five voice-managed models. Public controls are `--mode auto|native|segmented`, `--delivery-policy strict|best-effort`, and `--allow-ambiguous-redispatch` for resuming an ambiguous paid slot. Each comic scene run keeps one unversioned `manifest.json`; audio artifacts live inside that run as `audio/slots/`, `audio/final/`, and compact `render.json` records.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
bun test test/test-cases/validation/media-generation/tts-*.test.ts
bun test test/test-cases/validation/comic/comic-audio-*.test.ts
bun test test/test-cases/validation/comic/comic-voice-reference-artifacts.test.ts
bun test test/test-cases/validation/providers/tts-provider-contracts/
bun test test/test-cases/validation/resume-manifests/tts-resume-*.test.ts
```

1. Typecheck and unique-source check pass.
2. Mapped price commands stay no-cost and do not dispatch providers.
3. Help and usage contracts expose `tts`, `voice`, `comic reference-voice`, and `comic generate-audio` as separate surfaces and reject implicit voice creation on synthesis commands.
4. Option-resolution contracts keep synthesis controls off the voice-management flag surface.
5. TTS media-generation contracts prove explicit per-turn voice dispatch, provisioning lifecycle, dialogue planning, slot reuse, compact archives, and readiness failures that persist without provider spend.
6. Comic audio and voice-reference contracts prove approved-snapshot casting, generate-audio publication, and exact scene-run compatibility rejection.
7. Provider contracts keep the 16-provider segmented baseline truthful and confine durable `voice` management to the five named models.
8. TTS resume contracts prove no-call `--price`, retained-slot reuse, and blocked automatic redispatch of ambiguous paid admissions.

Do not run hosted TTS commands, live voice creation, provider smoke tests, or e2e paths with cost or billing association.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — canonical run manifest and dry-run price planning
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — type domain ownership and `~/types` barrel
- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md) — shared provider infrastructure and comic command ownership
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — hosted TTS provider lanes and bounded turn selector
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — TTS model contracts and voice capability boundaries
- Related ADR: [ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md) — soundscape pipeline downstream of this dialogue contract
- Related ADR: [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md) — downstream panel synchronization and still-image presentation
- Related report: [2026 Hosted-Model Refresh Report: TTS](../models/05-tts-model-report.md) — TTS catalog refresh history
- `src/cli/commands/process-steps/step-4-tts/define-tts-command.ts`
- `src/cli/commands/process-steps/step-4-tts/voice-management/define-voice-command.ts`
- `src/cli/commands/process-steps/step-8-comic/comic-commands/generate-audio/generate-audio-command.ts`
- `src/cli/commands/process-steps/step-8-comic/comic-commands/reference-voice/reference-voice-command.ts`
- [ElevenLabs Text-to-Dialogue](https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue)
- [Hume Text to Speech overview](https://dev.hume.ai/docs/text-to-speech-tts/overview)
- [Inworld Voice Cloning](https://docs.inworld.ai/docs/tutorial-basics/voice-cloning/)
- [Fish Audio API Reference](https://docs.fish.audio/api-reference/introduction)
- [Cartesia Documentation](https://docs.cartesia.ai/)
- [Speechify API Documentation](https://docs.speechify.com/)
