# ADR-012: TTS Synthesis, Voice Management, and Delivery

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-10
- **Date Updated:** 2026-09-24
- **Verification Status:** Passed
- **Supersession:** Absorbs the shared TTS, voice-management, rendering, slot, and compact authority of "Add Character Voice References and Multi-Speaker Script-to-Audio", whose comic scene-run authority moved to [ADR-013](ADR-013-comic-scene-audio-and-presentation.md), and all of "Master TTS Delivery Audio Outside Paid Slot Identity". The rule that `resume` adopts a pre-mastering canonical directory's legacy chunking and 16 kHz output, which [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) cites, belongs to this record. This is the standalone `tts` and `voice` command record.

## Context

`tts` could parse a multi-speaker script, map speakers, and concatenate turn files locally, but a speaker map was only a speaker string plus a voice string or path. It could not express provider-specific casting, design or clone state, consent, delivery controls, or a stable voice identity. Per-turn voice overrides were ignored while the finished metadata recorded them as applied, and there was no command for creating, auditioning, approving, or snapshotting a character voice. Provider capabilities are richer than one voice string, and comic has to reach them through shared TTS rather than a second stack.

Delivery had a separate quality problem. Every hosted single-voice run was stored as 16 kHz mono PCM even when the provider returned 24 to 48 kHz audio. Long text was split at the last newline or space before the provider limit, chunks were joined with whatever silence the provider left at each edge, and there was no loudness normalization, no container other than WAV, no tags, and no way to assemble a directory of chapters into one book. Purchased audio is identified separately from the delivered file, and that identity included the output format, so changing the format through the existing mastering settings would have orphaned every previously purchased file. ElevenLabs request stitching is unavailable for `eleven_v3`, so cross-chunk continuity could not come from that provider.

This record works inside the canonical `manifest.json` and no-provider `resume --price` rules of [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), the shared hosted lanes of [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md), and the model-selector contract of [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), which leaves voice identity and dialogue capability to this decision.

Why now: multi-character script-to-audio was the next workflow requirement and its dispatch and artifact contracts had to be trustworthy before voice design, clone, or native dialogue enlarged them; a later review of audiobook production then found the 16 kHz re-encode to be the largest fidelity loss in the pipeline.

## Options Considered

### Script-to-audio architecture

**Option 1 (selected)**

- **Option:** Build shared voice-identity, provisioning, capability, dialogue-rendering, timing, and artifact primitives beneath `tts` and comic, with native dialogue where a model supports it and a truthful segmented baseline everywhere else
- **Pros:** Repairs the contract once for every provider; keeps provider-native strengths; supports immutable voice references, local repair, and resume
- **Cons:** Largest initial change; two render strategies and lifecycle state to maintain
- **Quantitative Notes:** Eight managed models, two of them native dialogue

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
- **Quantitative Notes:** Two current native models

**Option 6**

- **Option:** Add voice fields directly to the visual character catalog
- **Pros:** One character file to inspect
- **Cons:** Couples provider resources, consent, and audio settings to a strict visual schema
- **Quantitative Notes:** Rejected; the visual catalog stays at schema version 3

### Delivery mastering

**Option 1 (selected)**

- **Option:** Keep purchased-audio identity on its historical output format, describe final audio with a separate delivery profile that identifies the render only, master once from retained provider audio, and treat encoding, tags, cover art, and book assembly as exports outside render identity
- **Pros:** Previously purchased audio stays usable under a new profile; a recovered run matches a normal run; the same behavior applies to every hosted provider
- **Cons:** Purchased-audio identity still records the historical format; TTS delivery settings are separate from comic and soundscape mastering
- **Quantitative Notes:** Re-rendering a retained run under the `audiobook` profile made zero provider requests, and loudness landed within 0.5 LU of the `-19` LUFS target

**Option 2**

- **Option:** Change the defaults of the existing mastering settings and send that profile through the hosted chunk pipeline
- **Pros:** Smallest change
- **Cons:** Those settings identify purchased audio, so every existing directory would buy its audio again
- **Quantitative Notes:** About $30 of retained `eleven_v3` audio per 300,000-character book would be orphaned

**Option 3**

- **Option:** Use provider continuity fields for chunk seams and leave assembly unchanged
- **Pros:** Prosody carry-over handled by the provider where supported
- **Cons:** Unavailable on `eleven_v3`, conflicts with safe retry where a fresh run and a resume would send different requests, and leaves the 16 kHz re-encode in place
- **Quantitative Notes:** No active adapter implements provider continuity

## Decision

Provider eligibility follows [ADR-010’s billing policy](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md#subscription-free-api-eligibility).

One shared, provider-neutral script-to-audio subsystem sits beneath `tts` and comic. It owns provider capabilities, voice provisioning and lifecycle, explicit per-invocation voice dispatch, native and segmented rendering, timing, scheduling, synthesis metadata, and delivery mastering. Comic consumes it for scene runs under [ADR-013](ADR-013-comic-scene-audio-and-presentation.md) and never creates provider clients or a second TTS stack.

Managed models are Gemini `gemini-3.8-flash-tts` and `gemini-3.8-flash-lite-tts`, ElevenLabs `eleven_v3`, Grok `grok-tts`, OpenAI `gpt-4o-mini-tts-2025-12-15`, and Inworld `realtime-tts-2`. Import applies to all six providers, including Soniox `tts-rt-v2`. Catalog, inspect, and delete apply to every provider except OpenAI and Soniox. Design applies to Gemini, ElevenLabs, and Inworld. Clone applies to Gemini, ElevenLabs, Grok, and Inworld. Every provider must receive an explicit voice on each turn or fail locally with a model-specific capability error. No provider may silently reuse a default voice.

Purchased speech keeps the historical output format in its identity. A separate delivery profile, selected with `--tts-audio-profile` and the related mastering flags, identifies the render, and one mastering step produces the delivered file from the provider audio already stored for that purchase.

This applies to:

- Standalone `tts` and its `resume` path for every hosted provider: single-voice, segmented multi-speaker, and native dialogue.
- `voice` catalog, design, clone, import, inspect, and delete actions for providers that declare those capabilities, over stock, saved, designed, cloned, or request-time reference voices to the extent each provider supports them.
- Chunk planning, seam mastering, loudness normalization, exports, tags, cover art, book assembly, the pronunciation lexicon, and text preflight.

It does not apply to:

- Azure, Google Cloud TTS, Polly, or Resemble, which are not added before the shared contracts are stable.
- Treating configured credentials as proof of plan-, approval-, verification-, or region-gated voice capabilities.
- Implicit remote voice creation during synthesis, configuration loading, resume, cleanup, or `--price`, or cloning without recorded provenance and consent.
- Hosted lane ramp, rate-limit recovery, and work-selector fairness, which belong to [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md). This record only joins dialogue turns to those lanes.
- Comic scene runs, voice briefs, scene snapshots, dialogue plans, `--delivery-policy`, soundscape, and presentation, which belong to [ADR-013](ADR-013-comic-scene-audio-and-presentation.md). Comic segmented planning stays on the legacy splitter, and the visual character catalog does not embed voice fields.
- Retry classification and the authorization semantics of `--allow-ambiguous-redispatch`, which belong to [ADR-005](ADR-005-cli-error-result-and-retry-contract.md). This record applies that authorization to persisted TTS slots.
- Provider continuity fields. ElevenLabs stitching stays unused.
- Live paid provider runs as verification.

### Commands

`tts` synthesizes with an existing stock, designed, or cloned voice, on every implemented model. `voice` manages durable catalog, design, clone, inspect, and delete resources for providers that declare those capabilities; providers without a declared management capability stay synthesis-only. `comic reference-voice` forwards to the same actions as a deprecated alias for one compatibility release ([ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md)).

Expressiveness stays model-specific. There is no shared delivery-tag language; exact tags and request controls are in the [TTS command docs](../commands/04-audio/tts/overview.md).

### Voice lifecycle and preflight

A declared capability, an implemented adapter, and current-account access are separate facts. Preflight has three phases:

1. Static and config validation, including `--price`: local checks only, no network, no mutation.
2. Execution readiness: authorized read-only remote inspection after local checks pass.
3. Provisioning and synthesis: explicitly selected provider-mutating phases.

`tts` and `comic generate-audio` synthesize and apply dialogue controls but cannot create or delete remote voices. Only `voice` accepts creation, clone, design, import, consent, and lifecycle inputs. Voice design is two-phase: create a remote candidate, then approve the registration locally. Cloning requires recorded provenance and consent. Remote deletion requires an explicit management action. Voice assets and consent records live in a protected store outside output roots.

`voice <action>` is the one management entry point for standalone and comic character voices. Import, design, and clone stay separate operations because local registration, paid design preview, and authorized sample cloning have different consent and lifecycle boundaries. Approval, audition, retirement, and deletion also stay separate: approval promotes existing evidence locally, audition can synthesize paid audio, retirement changes local lifecycle state, and deletion can remove a remote resource. Usage is in the [voice overview](../commands/04-audio/voice/00-voice-overview.md).

### Rendering, resume, and compact

`--mode` selects `auto`, `native`, or `segmented`. `auto` uses native rendering when the model, account, speaker count, turn lengths, and voice registrations fit provider limits, and segmented rendering otherwise. `native` requires native multi-speaker dialogue and fails preflight when a constraint is violated. `segmented` synthesizes each turn independently, then normalizes timing and assembles locally. Native rendering is ElevenLabs `eleven_v3` Text-to-Dialogue and Gemini TTS multi-speaker synthesis; every other model is segmented, and authored overlaps or local voice-effect filters force segmented rendering.

Dialogue work uses the shared hosted TTS lanes. An ambiguous paid admission is never retried inside the running command. Continuing one requires `--allow-ambiguous-redispatch`, which warns that the slot may be purchased again. If synthesis stops after any request is sent, successful outputs are kept and the failure report names the reusable and unresolved slot counts.

Completed audio is reused from `audio/slots/`. Version 2 paid-slot keys include provider and model as well as the canonical speech request identity, so models using the same voice and endpoint cannot share a slot accidentally. Legacy slots remain readable through checksum-bound archives for the same target; an unscoped legacy cache file alone cannot authorize reuse. Verified recovered audio is copied into the model-scoped cache when publishing a new render. The same slot identity spends nothing on a later render, and a changed voice snapshot creates a new render identity without touching unrelated completed slots. `--price` subtracts retained slots and reports zero spend when a render can be assembled locally. `--max-generation-slots` stops after a bounded number of new slots without publishing a final WAV. A fully reused render closes as a local composition with no provider call.

Output storage has three lifetime classes:

**Class 1: Working**

- **When it exists:** In-flight only
- **Retention:** Written under `audio/work/` and deleted when that target's selected success is published

**Class 2: Resume**

- **When it exists:** Incomplete or failed
- **Retention:** Keeps the working tree, completed `audio/slots/` files, and matching result records; paid audio is never deleted

**Class 3: Archive**

- **When it exists:** After successful compact
- **Retention:** Keeps published masters under `audio/final/`, referenced slot WAVs, bound voice snapshots, and the compact `render.json`; unreferenced working files are removed

### Delivery mastering and export

New runs always use the shared smart chunk planner. Frozen legacy and earlier smart algorithms are internal replay modes for older saved plans. Provider policies resolve request limits, metadata overhead, protected syntax, and validation before any dispatch; the resulting plan supplies request text and boundaries to execution, estimates, settings, and joins. Chunk seams follow the plan that produced the purchased text, so recovery reproduces the original chunk without a new purchase. New native and audiobook profiles preserve provider silence, with trimming off and zero added join padding. Pause overrides add silence after the final output of a slot without enabling trimming; they do not alter pauses inside provider requests. Opt-in trimming validates silence intervals, retains a 30 ms speech guard, preserves internal pauses, and leaves ambiguous or all-silent audio intact. Outputs within one slot are normalized and concatenated before trimming or fades. Assembly positions use integer decoded sample frames and convert cumulative positions to existing millisecond fields. Audiobook loudness and 500/1,000 ms bookends remain unchanged. Saved profiles retain their exact prior trim and gap values. Default output keeps the provider's sample rate.

Encoding to `flac`, `mp3`, `m4a`, or `m4b`, tags, cover art, and one book file per directory with one chapter per input are exports derived from the WAV master. They do not identify the render, are recorded in the manifest, and can be rebuilt without a new render or purchase. A pronunciation lexicon is applied before chunking, and a text preflight rejects speech markup the provider documents as unsupported.

A canonical directory created before delivery mastering keeps its purchased slots. When no chunking or mastering flag is explicit, `resume` and `resume --price` adopt that run's legacy chunking and 16 kHz output, so those directories finish without buying audio again. An explicit mismatch fails closed without spending. Resuming a run that used non-default mastering or a lexicon requires the same flags again, and rerunning a completed directory with different mastering flags stops with no spend and leaves completed chapters unchanged. Pre-canonical TTS manifests stay unreadable and must be rebuilt with the current `tts` command ([ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)).

## Rationale

- Voice identity is durable project state, so registrations, auditions, and snapshots keep a character consistent across scenes and providers.
- An explicit voice on every turn stops metadata from claiming a mapping the provider never received, and declared capabilities keep each provider honest about design, clone, and native dialogue support.
- Native rendering keeps conversational context where the model supports it; segmented rendering keeps portability and single-line repair.
- Buying the same speech twice is the most expensive failure this pipeline can have, so purchased-audio identity stays fixed before any default changes.
- A delivery profile changes the audio the user receives, so it identifies the render; tags and containers leave the master unchanged, so they can be rebuilt freely.
- The same planning and assembly behavior applies to every hosted provider, and provider-specific controls stay on the registry-backed flags from [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md).

## Consequences

Positive outcomes:

- All eight providers share the explicit-voice boundary, and a provider without a verified capability fails locally before any spend.
- A character voice can be auditioned, approved, and kept stable across scenes and providers, and a single line can be repaired without repeating the whole synthesis.
- Remote voice creation, approval, expiry, and deletion are explicit lifecycle states.
- A successful run keeps one paid copy per slot plus the published masters, and purchased audio stays usable under any later delivery profile.

Negative outcomes:

- Callers work with structured voice artifacts and a formal preflight instead of a single voice string.
- Native dialogue and segmented fallback are both maintained, including their timing alignment.
- Compact removes in-flight records, so post-success debugging relies on the compact cost, retry, and error summary.
- New runs identify a different render than the same command produced before, because the default splitter and profile both changed.
- Byte-identical output is guaranteed only within a single ffmpeg build, and wall-time estimates still assume the legacy splitter.

## Trade-offs

**Trade-off 1**

- **Gain:** Stable provider-neutral character identity with auditable consent and provenance
- **Sacrifice:** Additional voice artifacts, lifecycle state, and a stricter preflight

**Trade-off 2**

- **Gain:** Segmented compatibility on every provider plus native quality where it exists
- **Sacrifice:** Two render strategies and a planner that chooses between them

**Trade-off 3**

- **Gain:** A crashed run continues from its completed slots and a single line can be repaired
- **Sacrifice:** One retained slot WAV for each paid generation

**Trade-off 4**

- **Gain:** Existing output directories keep their purchased audio under any new profile
- **Sacrifice:** Purchased-audio identity still records the historical output format

**Trade-off 5**

- **Gain:** Seam pauses are fixed and independent of the silence a provider left on each chunk
- **Sacrifice:** Opt-in silence trimming can clip very quiet edge speech; trimming is off by default and retains a 30 ms guard pad

## Implementation Note

Shipped as `tts` explicit-voice synthesis with native and segmented rendering, slot reuse, compact, resume, and delivery mastering with its export layer, and as `voice` for catalog, design, clone, import, inspect, and delete. `comic reference-voice` remains a deprecated alias of `voice`, and `comic generate-audio` consumes this subsystem under [ADR-013](ADR-013-comic-scene-audio-and-presentation.md).

## API / Type Impact

- Before: a speaker map was a speaker string plus a voice string or path, and synthesis options mixed voice selection with invocation.
- After: speaker maps carry provider-qualified voice bindings. `tts` synthesizes with an existing voice and never creates or deletes remote voices; `voice` owns the lifecycle actions. Public controls are `--mode auto|native|segmented` and `--allow-ambiguous-redispatch`. Audio artifacts live inside the run as `audio/slots/`, `audio/final/`, and `render.json`.
- Delivery: `--tts-audio-profile`, `--tts-chunk-boundary smart`, `--tts-trim-silence`, and the related mastering, export, tag, cover-art, and lexicon flags select the render and its exports. None of them enters purchased-slot identity.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/audio/tts/
bun test test/test-cases/validation/audio/voice/
```

1. Price commands stay no-cost and dispatch no provider.
2. TTS contracts prove explicit per-turn voice dispatch, slot reuse, compact retention, blocked automatic redispatch, and the delivery profile, chunk planner, seam mastering, and export layer against retained slot audio.
3. Voice contracts prove the lifecycle actions and capability gating without live provider calls.

## Follow-up Actions

- [ ] Listening pass on the paid `eleven_v3` pilot — Pending
  A 625-character, three-chunk pilot was purchased once on 2026-09-18 for an estimated 6.25¢ (`output/2026-09-18_tts-delivery-pilot`). Decoded integrity passed and a local transcript matched the source across both seams; seam naturalness, pause lengths, and cross-chunk prosody still need a human listen.
- [ ] Re-master a completed run from audio already purchased — Pending
- [ ] Model wall-time estimates on the smart splitter — Pending
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
- [ElevenLabs Text-to-Dialogue](https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue)
- <https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/request-stitching>

## Gemini 3.8 transport and lifecycle extension

Unary and buffered streaming synthesis use Interactions with canonical speech text and separate style metadata. Single-voice requests send only the selected voice in `speech_config`; speaker names stay in the local canonical plan. Native dialogue names both speakers in the configuration and annotates every turn. Live probes rejected the earlier single-voice payload containing named-speaker fields with HTTP 400. The two-model integration shares casting, retained artifacts, delivery, exports, auditions and registration rules. Native dialogue is restricted to two eligible stock voices and preserves one take without fabricated timing. Segmented generation remains available for custom voices, larger casts and incompatible controls. Conservative token planning includes metadata within the 8,192-input/16,384-output limits.

Remote Batch execution serializes GenerateContent independently and journals stable slot keys, request fingerprints, upload handles and provider job IDs. Versioned provider-job links extend manifests without changing legacy manifest requirements. Atomic journal writes and a process lock protect submission and collection. Resume collects purchased work before preparing any remainder; ambiguous submission requires reconciliation. Delivery settings remain separate from transport request identity.

Gemini design creates persistent resources before candidate selection. The creation journal precedes POST; returned IDs are retained before preview validation. Saving adopts rather than recreates. Requested preview text is separately synthesized into protected storage. Replication requires consent records, one decoded reference and separate consent audio. Known expiry and project ownership govern reuse and deletion. Operation prices remain unknown unless documented; synthesis estimates and observed usage carry explicit token schedules.

Local verification and remaining provider-evidence gaps are recorded in the [implementation report](../reports/gemini-3.8-tts-integration-2026-09-24.md). No live provider or listening result is implied by mocked transport and artifact tests.
