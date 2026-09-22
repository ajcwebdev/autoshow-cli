# ADR-013: Add Character Voice References and Multi-Speaker Script-to-Audio

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-10
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed

## Amendment: One Voice-Management Entry Point (2026-09-10)

Use `voice <action>` for standalone and comic character voice management. `comic reference-voice` remains a deprecated forwarding alias for one compatibility release, including its default `list` action and its children. Direct help and runtime notices name the canonical command. The ordinary comic menu omits the alias. Removing the alias requires a later announced breaking CLI release.

Flags, provider capabilities, character-root resolution, bare-invocation listing, and results stay the same. Warnings follow the normal quiet and log-level controls.

The same review rejected one voice-creation command that would merge import, design, and clone. Local registration, paid design preview and save, and authorized sample cloning stay separate operations. Approval, audition, retirement, and deletion stay separate as well: approval can promote existing evidence locally, audition can synthesize paid audio, retirement changes local lifecycle state, and deletion can remove a remote resource.

Current instructions are in the [voice overview](../commands/04-audio/voice/00-voice-overview.md). The CLI consolidation is recorded in [ADR-007](./ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md#amendment-canonical-voice-and-review-commands-2026-09-10).

## Context

AutoShow synthesizes speech with `tts` and can parse a multi-speaker script, map speakers, write turn files, and concatenate them locally. Native dialogue is ElevenLabs `eleven_v3` and Hume `octave-2`. Comic already supplies structured scripts with stable segment IDs, character keys, speaker labels, spoken text, and delivery notes.

Those pieces did not form a trustworthy multi-character script-to-audio workflow. Comic had no command for creating, selecting, auditioning, approving, or snapshotting a character voice, and no command for turning a structured script into multi-character audio. A speaker map was only a speaker string plus a voice string or path. It could not express a provider-specific casting, design or clone state, access restrictions, consent, delivery controls, remote-resource lifecycle, or a stable voice identity.

Per-turn voice overrides were ignored, while the finished metadata recorded the requested mappings as if every provider had used them. Provider capabilities are richer than one voice string, and comic has to use those capabilities through shared TTS.

This decision is constrained by existing architectural rules:

- ADR-002 reserves one unversioned canonical `manifest.json` for every run root, makes its item and provider state the only persistence authority, and rejects compatibility readers for retired pipeline formats.
- ADR-007 requires comic to adapt domain semantics to shared provider infrastructure instead of maintaining a comic-local model or dispatch stack.
- ADR-008 makes hosted TTS provider lanes and bounded work scheduling the shared concurrency boundary; multi-speaker turn work must join that model.
- ADR-002 requires `resume --price` to remain a no-provider, non-mutating dry run; this ADR applies the same rule to TTS price planning and separates static validation from execution readiness.
- ADR-010 treats a TTS model selector as a complete runtime promise and leaves voice identity and specialized reference or dialogue capabilities to a separate decision such as this one.

Options Considered records the 2026-08-10 catalog of 16 TTS providers, including Fish `s2.1-pro` and a native Gemini dialogue branch. Fish TTS was removed on 2026-09-01. The Decision names the eight providers that remain.

Why now: multi-character script-to-audio is the next workflow requirement, with comic as its first structured-script consumer. Dispatch and artifact contracts must be corrected before voice design, clone, or native dialogue enlarge an untrustworthy surface.

## Options Considered

**Option 1 (selected)**

- **Option:** Build shared voice-identity, provisioning, capability, dialogue-rendering, timing, and artifact primitives; make comic consume them; implement five voice-managed model adapters with a truthful segmented baseline across all 16 providers
- **Pros:** Repairs the current contract once; gives every provider a truthful segmented baseline; preserves provider-native strengths; supports immutable character references, local repair, comparison, and resume across five dedicated voice-managed models (ElevenLabs `eleven_v3`, Inworld `realtime-tts-2`, Fish `s2.1-pro`, Cartesia `sonic-3.6-2026-08-27`, and Speechify `simba-3.2`)
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

Create one shared, provider-neutral script-to-audio subsystem beneath both `tts` and comic. Comic owns authored character voice briefs, role resolution, approvals, immutable scene snapshots, and source-linked dialogue plans. Shared TTS owns provider capabilities, voice provisioning and lifecycle, explicit per-invocation voice dispatch, native and segmented rendering, timing, scheduling, and synthesis metadata. Comic must not create provider clients or a second TTS stack.

Voice management follows each active provider's declared capabilities. Managed models are ElevenLabs `eleven_v3`, Grok `grok-tts`, Mistral `voxtral-mini-tts-2603`, OpenAI `gpt-4o-mini-tts-2025-12-15`, Speechify `simba-3.2`, Hume `octave-1` and `octave-2`, Cartesia `sonic-3.6-2026-08-27`, and Inworld `realtime-tts-2`. Import applies to all eight. Catalog, inspect, and delete apply to every provider except OpenAI. Design applies to ElevenLabs, Hume, and Inworld. Clone applies to ElevenLabs, Grok, Mistral, Cartesia, and Inworld. Every TTS provider must pass an explicit voice on each turn or fail locally with a model-specific capability error. No provider may silently reuse a default voice.

This applies to:

- Generic multi-speaker TTS behavior, metadata, artifacts, validation, scheduling, and provider request contracts.
- Comic character voice briefs, reference-voice creation, import, audition, approval, immutable voice snapshots, dialogue planning, audio generation, caching, assembly, effects, timing, resume, and canonical scene-run state.
- Stock, saved, custom, designed, cloned, or request-time reference voices, to the extent each provider actually supports them.
- Durable catalog, design, clone, inspect, and delete actions for providers that declare those capabilities.
- Native multi-speaker dialogue where supported (ElevenLabs `eleven_v3` Text-to-Dialogue and Hume `octave-2` utterances), with segmented fallback when scene constraints or model limits require it.

It does not apply to:

- Azure, Google Cloud TTS, Polly, or Resemble, which are not added before the shared contracts are stable.
- Treating configured credentials as proof that an account has plan-, approval-, verification-, or region-gated voice capabilities.
- Implicit remote voice creation during ordinary synthesis, configuration loading, resume, cleanup, or `--price`.
- Cloning without recorded provenance and consent, or cross-provider cloning from a generated audition unless explicitly authorized.
- Hosted lane ramp, rate-limit recovery, and work-selector fairness, which belong to [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md). This ADR only joins dialogue turns to those lanes.
- Sound-effect intent, stems, and mixing, which belong to [ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md).
- Panel synchronization and still-image presentation, which belong to [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md). ADR-018 may consume the immutable audio run and original timeline as read-only evidence and must not change voice identity, provider execution evidence, dialogue ranges on the original clock, or any ADR-013 artifact.
- Embedding voice fields in the visual character catalog, which remains schema version 3.
- Live paid provider runs as ADR verification. Live quality calibration remains a separately approved activity.

### Commands

`tts` synthesizes with an existing stock, designed, or cloned voice, or with Mistral request-time `--tts-ref-audio`, on every implemented TTS model. `voice` manages durable catalog, design, clone, inspect, and delete resources for providers that declare those capabilities. Deprecated `comic reference-voice` forwards to the same actions. Providers without a declared management capability stay synthesis-only.

```text
structured-script.json
  -> comic dialogue plan and approved voice snapshot
  -> shared render planner (native or segmented)
  -> shared synthesis, timing, and local assembly
  -> comic timeline, compact result, and final recording
```

Expressiveness stays model-specific. This decision does not invent a shared delivery-tag language. Exact tags and request controls are in the TTS command docs. Mistral `voxtral-mini-tts-2603` exposes none of the instruction, speed, or pause controls used by the other managed models.

### Scene-run artifacts and protected voice store

Every comic scene run owns exactly one canonical, unversioned `<scene-run>/manifest.json`. Audio render directories live inside that scene run. They are not independent run roots and never contain another `manifest.json`.

The manifest records the structured script, dialogue and snapshot identities, selected audio runs, mix, timeline, and checksums. Domain records such as `voice-reference-snapshot.json`, `render.json`, and `audio-run.json` are referenced by relative path and checksum.

The protected voice store stays outside output roots. It holds voice assets, consent records, and provisioning journals under owner-only permissions. The visual character schema does not embed voice fields.

### Voice lifecycle and preflight

A declared capability, an implemented adapter, and current-account access are separate facts. Configured credentials do not prove that an account can design, clone, or use a gated voice.

Preflight has three phases:

1. Static and config validation, including `--price`: local checks only, no network, and no mutation.
2. Execution readiness: authorized read-only remote inspection after local checks pass.
3. Provisioning and synthesis: explicitly selected provider-mutating phases.

`tts` and `comic generate-audio` synthesize and apply dialogue controls. They cannot create or delete remote voices. `voice`, and deprecated `comic reference-voice`, accept creation, clone, design, import, consent, and lifecycle inputs. Voice design is two-phase: create a remote candidate, then approve the registration locally. Cloning requires recorded provenance and consent. Remote deletion requires an explicit management action.

`comic generate-audio <script>` consumes a compatible existing scene run. A nonempty target that fails exact source, manifest, and structured-script compatibility is rejected without rewriting those files. The command maps every role against an approved registration snapshot and preserves every speakable segment. `--delivery-policy strict` rejects unsupported authored delivery. `best-effort` records it and continues.

### Rendering, resume, and compact

`--mode` selects `auto`, `native`, or `segmented`:

- `auto` uses native rendering when the model, account, speaker count, turn lengths, and voice registrations fit provider limits, and segmented rendering otherwise.
- `native` requires native multi-speaker dialogue and fails preflight when constraints are violated.
- `segmented` synthesizes each turn independently, then normalizes timing and assembles locally.

Native multi-speaker rendering is ElevenLabs `eleven_v3` Text-to-Dialogue and Hume `octave-2` utterances. Every other active model uses segmented synthesis. Authored overlaps and local voice-effect filters also force segmented rendering.

Each turn is sent with an explicit voice. Dialogue work uses the shared hosted TTS lanes from [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md). An ambiguous paid admission is never retried inside the running command. Continuing one requires `--allow-ambiguous-redispatch`, which must warn that the slot may be purchased again.

Completed audio is reused from `audio/slots/<slotHash>.wav`. The same slot identity spends nothing on a later render. A changed voice snapshot creates a new render identity and leaves unrelated completed slots in place. `--price` subtracts retained slots and reports zero spend when a render can be assembled locally. `--max-generation-slots` can stop after a bounded number of new slots without publishing a final WAV.

If synthesis stops after any request is sent, successful outputs and their admission state are kept. The failure report includes reusable and unresolved slot counts and names `--allow-ambiguous-redispatch` when ambiguous paid admissions block automatic continuation.

Output storage has three lifetime classes:

**Class 1: Working**

- **Class:** Working
- **When it exists:** In-flight only
- **Retention and Compaction Rule:** Written under `audio/work/`. Deleted when that target's selected success is published.

**Class 2: Resume**

- **Class:** Resume
- **When it exists:** Incomplete or failed
- **Retention and Compaction Rule:** Keeps the working tree, admission journal, completed `audio/slots/<slotHash>.wav` files, and matching result records. Paid audio is kept.

**Class 3: Archive**

- **Class:** Archive
- **When it exists:** After successful compact
- **Retention and Compaction Rule:** Keeps published masters (`audio/final/<targetKey>.wav`), referenced slot WAVs, bound voice snapshots, and compact records such as `render.json`. Unreferenced working files are removed.

A fully reused render closes as a local composition with no provider call.

## Rationale

- Voice identity is durable project state. Separate briefs, registrations, auditions, and snapshots keep a character consistent across scenes and providers.
- An explicit voice on every turn stops metadata from claiming a mapping the provider never received.
- Declared capabilities let each provider use what it actually offers, including a segmented fallback, without implying that every model supports design, clone, or native dialogue.
- Native rendering keeps conversational context where the model supports it. Segmented rendering keeps portability, speaker-count fallback, and repair of a single line.
- Request and result evidence is what makes cost, resume identity, and the compact archive truthful.

## Consequences

Positive outcomes:

- All eight active TTS providers share the explicit-voice boundary. A provider without a verified native or voice-management capability fails locally.
- Voice management is limited to the capabilities named in the Decision.
- Comic can keep a stable voice reference, audition and approve it, repair a line locally, and publish a mastered scene recording.
- Remote voice creation, verification, approval, expiry, and deletion are explicit lifecycle states.
- The scene manifest records the voices and models that were actually used.
- A successful run keeps one paid copy per slot, the published masters, and the compact records.

Negative outcomes:

- Callers work with structured voice artifacts and a formal preflight instead of a single voice string.
- Voice assets and consent records need a protected store outside ordinary output directories.
- Native dialogue and segmented fallback are both maintained, including their timing alignment.
- Compact removes in-flight journals. After success, debugging uses the compact cost, retry, and error summary.

## Trade-offs

**Trade-off 1**

- **Gain:** Stable provider-neutral character identity
- **Sacrifice:** Additional voice artifacts and lifecycle state

**Trade-off 2**

- **Gain:** Segmented compatibility on every provider, plus native quality where it exists
- **Sacrifice:** Two render strategies and a planner that chooses between them

**Trade-off 3**

- **Gain:** A selected take can continue after a crash, and a successful run can be archived
- **Sacrifice:** An in-flight journal and per-slot files until compact, and no admission journal to reconstruct after success

**Trade-off 4**

- **Gain:** Auditable consent, provenance, and request identity
- **Sacrifice:** Stricter preflight and a protected store for voice assets

**Trade-off 5**

- **Gain:** A single line can be repaired without repeating the whole synthesis
- **Sacrifice:** One retained slot WAV for each paid generation

## Implementation Note

Shipped as `tts` explicit-voice synthesis with native and segmented rendering, slot reuse, compact, and resume; `voice` for catalog, design, clone, import, inspect, and delete; `comic generate-audio` for approved-snapshot scene audio; and `comic reference-voice` as a deprecated alias of `voice`.

## API / Type Impact

- Before: a speaker map was a speaker string plus a voice string or path, and synthesis options mixed voice selection with invocation.
- After: speaker maps carry provider-qualified voice bindings. `tts` and `comic generate-audio` synthesize with an existing voice and never create or delete remote voices. `voice` owns catalog, design, clone, inspect, and delete for providers that declare those capabilities. Deprecated `comic reference-voice` forwards to the same actions. Public controls are `--mode auto|native|segmented`, `--delivery-policy strict|best-effort`, and `--allow-ambiguous-redispatch` for resuming an ambiguous paid slot. Each comic scene run keeps one unversioned `manifest.json`. Audio artifacts live inside that run as `audio/slots/`, `audio/final/`, and compact `render.json` records.

## Test Plan

```bash
bun run check
bun t --price
```

1. `bun run check` proves the typecheck and repository structure checks pass.
2. `bun t --price` proves mapped price commands stay no-cost and do not dispatch providers.

Passed local contract tests cover help separation of `tts`, `voice`, and `comic generate-audio`, explicit per-turn voice dispatch, slot reuse, compact retention, and blocked automatic redispatch. Hosted TTS commands, live voice creation, and other billed runs are outside this record's verification.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — canonical run manifest and dry-run price planning
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — type domain ownership and `~/types` barrel
- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md) — shared provider infrastructure and comic command ownership
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — hosted TTS provider lanes and bounded turn selector
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — TTS model contracts and voice capability boundaries
- Related ADR: [ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md) — soundscape pipeline downstream of this dialogue contract
- Related ADR: [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md) — downstream panel synchronization and still-image presentation
- TTS catalog: [docs/commands/04-audio/tts/overview.md](../commands/04-audio/tts/overview.md)
- `src/cli/commands/audio/tts/define-tts-command.ts`
- `src/cli/commands/audio/voice/define-voice-command.ts`
- `src/cli/commands/visuals/comic/comic-commands/generate-audio/generate-audio-command.ts`
- `src/cli/commands/visuals/comic/comic-commands/reference-voice/reference-voice-command.ts`
- [ElevenLabs Text-to-Dialogue](https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue)
- [Hume Text to Speech overview](https://dev.hume.ai/docs/text-to-speech-tts/overview)
