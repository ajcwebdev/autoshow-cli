# ADR-013: Comic Scene Audio and Presentation

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-10
- **Date Updated:** 2026-10-28
- **Verification Status:** Passed
- **Supersession:** Absorbs the comic scene-run authority of "Add Character Voice References and Multi-Speaker Script-to-Audio", all of "Add Provider-Neutral Sound Effects and Multi-Track Soundscape Mixing", all of "Synchronize Comic Panels with Manifest-Backed Audio", and the recorded comic recovery amendment formerly in "Define Pipeline State, Resume, and Dry-Run Planning". This is the `comic generate-audio`, `comic generate-slideshow`, and comic `resume` record.

## Context

Comic supplies structured scripts with stable segment IDs, character keys, speaker labels, spoken text, and delivery notes, and it has to turn them into multi-character audio through the shared TTS subsystem of [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md). Approved voices must be applied to each turn, and the finished metadata must record the voices actually dispatched.

Sound intent belongs in the script. A cue states what is heard, where it occurs, whether omission is allowed, and how it is placed. Absolute timestamps are unstable because dialogue duration changes with voice, provider, repair take, and pacing, and a cue that cannot be resolved exactly must never be silently clamped, guessed, or dropped. Hosted generation is paid work, so `--price` must stay read-only and one generated clip must be reusable across dialogue targets.

Reviewed still panels, canonical dialogue audio, and soundscape masters lacked a local presentation layer. A raw master does not retain panel provenance, and cross-panel overlaps on the original scene clock desynchronize audio played beneath a simple image sequence. The presentation stage must stay derived: it may consume dialogue and soundscape artifacts but must not mutate source runs, generate media, infer fuzzy matches, crop or rescale approved art, or add generated motion.

An interrupted comic run could only be continued by rerunning the explicit comic commands. Recovery has to reuse the command-neutral `resume` planner and the canonical `manifest.json` of [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), which forbids a second planner or persistence file. [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md) and [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) require comic to use the shared command tree and central registries, and [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md) makes hosted lanes the shared concurrency boundary.

Why now: multi-character script-to-audio was the next workflow requirement with comic as its first structured-script consumer; once speech identity, timing, caching, and resume were trustworthy enough to serve as the dialogue clock, the remaining gaps were a durable sound-intent and mixing layer, a synchronized local MP4 without another generative provider, and recovery of an interrupted run through `resume`.

## Options Considered

### Scene audio

**Option 1 (selected)**

- **Option:** Comic consumes approved voices through the shared script-to-audio subsystem of [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md) and owns role resolution, immutable scene snapshots, dialogue plans, and one canonical scene-run manifest
- **Pros:** Every provider keeps a truthful segmented baseline and its native strengths through shared TTS; immutable references support local repair, comparison, and resume
- **Cons:** Comic works with versioned artifacts and a formal preflight instead of a speaker string
- **Quantitative Notes:** 1 canonical `manifest.json` per scene run

**Option 2**

- **Option:** Add voice fields directly to the visual character catalog
- **Pros:** One character file to inspect
- **Cons:** Couples provider resources, consent, and expiry to a strict visual schema
- **Quantitative Notes:** n/a

### Soundscape

**Option 1 (selected)**

- **Option:** Build a complete provider-neutral vertical slice with one hosted sound-effect adapter, then add dedicated SFX targets only where a documented non-speech API fits
- **Pros:** Proves the schema, timeline, stem, cache, and price boundaries before expanding adapters; keeps authored intent portable
- **Cons:** Unsupported operations fail explicitly instead of approximating a missing API
- **Quantitative Notes:** 1 dedicated SFX target

**Option 2**

- **Option:** Add ElevenLabs-specific fields and mixing directly to `comic generate-audio`
- **Pros:** Smallest initial implementation
- **Cons:** Couples source files to one API and repeats SFX generation for every dialogue comparison
- **Quantitative Notes:** 1 provider

**Option 3**

- **Option:** Integrate several SFX providers before defining the timeline and artifact contracts
- **Pros:** Broad provider choice immediately
- **Cons:** Multiplies capability, pricing, and failure behavior before the common contract is proven
- **Quantitative Notes:** n/a

**Option 4**

- **Option:** Build only a local mixer and require users to supply every clip
- **Pros:** Entirely offline and deterministic
- **Cons:** Does not satisfy text-to-sound generation
- **Quantitative Notes:** 0 hosted adapters

### Presentation

**Option 1 (selected)**

- **Option:** Build a manifest-backed local still-panel plan, recompose its audio, and render hard cuts with FFmpeg
- **Pros:** Exact ownership evidence, no provider calls, deterministic timing, preserved source artifacts
- **Cons:** Strict failures for incomplete evidence
- **Quantitative Notes:** `$0`; one published WAV and one published MP4

**Option 2**

- **Option:** Generate motion video from each panel
- **Pros:** Visually dynamic output
- **Cons:** Provider cost, creative drift, and timing uncertainty
- **Quantitative Notes:** At least one paid request per panel

**Option 3**

- **Option:** Put the unmodified scene master under a fixed-rate image sequence
- **Pros:** Small implementation
- **Cons:** Cross-panel overlaps play under the wrong image
- **Quantitative Notes:** n/a

### Recovery

**Option 1 (selected)**

- **Option:** Continue recorded image, audio, and presentation stages through the existing `resume` command and the scene run's canonical `manifest.json`
- **Pros:** One planner and one persistence authority; `resume --price` covers the plan without provider calls
- **Cons:** Recovery cannot change providers, rendering, paths, or concurrency
- **Quantitative Notes:** 3 recoverable stages; 0 new persistence files

**Option 2**

- **Option:** A comic-specific recovery planner or a second persistence file
- **Pros:** Could accept overrides at recovery time
- **Cons:** Rejected; a second resume authority is forbidden by [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), and a universal comic build command was rejected in [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md)
- **Quantitative Notes:** n/a

## Decision

`comic generate-audio` renders a scene's dialogue and soundscape through the shared subsystem of [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md) into one canonical scene run, `comic generate-slideshow` renders a local still-panel presentation from that run, and `resume` continues a recorded comic run's image, audio, and presentation stages. Comic consumes approved voice registrations and owns role resolution, immutable scene snapshots, dialogue plans, authored sound intent, the multi-track mix, and the presentation plan.

This applies to:

- Comic role resolution, immutable voice snapshots, dialogue plans, and canonical scene-run state.
- `structured-script.json` sound intent, cue-to-timeline resolution, reusable generated clips, stems, and final mixes.
- `comic generate-audio` target selection, validation, `--price` planning, dispatch, resume, and publication.
- `comic generate-slideshow`, `comic generate-audio --slideshow`, and the `presentation/final/` outputs.
- Recorded comic recovery through `resume` and `resume --price`.

It does not apply to:

- Voice identity, consent, casting, approvals, the `voice` command's lifecycle actions, shared TTS rendering, and delivery mastering, which belong to [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md).
- Hosted lane ramp, rate-limit recovery, and work scheduling, which belong to [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md).
- Retry classification and the authorization semantics of `--allow-ambiguous-redispatch`, which belong to [ADR-005](ADR-005-cli-error-result-and-retry-contract.md).
- The command-neutral resume architecture, canonical manifest rules, and price dry runs in general, which belong to [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md). This record owns only the comic stages `resume` continues.
- Scene JSON, panel generation, blocking, and image QA, which belong to [ADR-017](ADR-017-comic-script-and-scene-authoring.md). Initial comic generation and explicit stage reruns stay on the comic commands.
- Command names, the deprecated `comic reference-voice` alias, and the rejected universal comic rendering command, which belong to [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md).
- Inferring sound cues from panel coordinates, treating provider-generated reverb or a textual spatial prompt as measured acoustics, or a standalone general-purpose SFX command.
- Generating, editing, animating, or resizing panels during presentation, mutating source dialogue or soundscape runs, or accepting raw audio without its complete canonical timeline.

### Scene runs and generate-audio

Every comic scene run owns exactly one canonical `<scene-run>/manifest.json` recording its structured script, dialogue and voice snapshots, selected audio runs, mix, and timeline. Audio render directories inside it are not separate run roots. Voice registrations remain separate from the visual character catalog.

`comic generate-audio <script>` consumes a compatible existing scene run, or initializes a missing or empty directory explicitly selected with `--output-dir`. Price planning requires an existing run. A nonempty target that fails exact source, manifest, and structured-script compatibility is rejected without rewriting those files. Every speaking role maps to an approved registration snapshot, and every speakable segment is preserved. `--delivery-policy strict` rejects unsupported authored delivery; `best-effort` records it and continues.

The command synthesizes and applies dialogue controls. It cannot create or delete remote voices; those are `voice` actions. Rendering and slot reuse use the shared subsystem of [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md); comic exposes `--mode` and `--max-generation-slots` for scene runs and keeps its own mix settings.

### Soundscape

Authored sound intent lives in `structured-script.json` v5 independently of provider, model, and billing. Dedicated generation uses an explicit `--sfx-provider` target. Local mixing places retained clips on the selected dialogue clock and publishes inspectable stems plus a mastered four-bus WAV.

#### Authored intent

`structured-script.json` v5 carries scene-level sound intent. Empty cue and ambient-bed collections keep dialogue-only behavior with no sound-effect provider call. Incompatible older scene runs must be rebuilt.

Markdown recognizes block labels `**SFX:**`, `**VOCAL SFX:**`, and `**AMBIENCE:**`, plus inline `[[SFX: ...]]` or `[[VOCAL SFX: ...]]` for mid-turn placement. Directives are required unless prefixed with `OPTIONAL`. Provider-neutral duration, gain, and pan controls affect generation or mixing without selecting a provider. A block directive anchors at its source-order boundary, an inline directive at its spoken-text offset, and an ambience block covers the full resolved scene unless it declares an explicit range. Unlabelled action or panel direction remains visual staging. Script review must preserve authored cues, required or optional policy, and source placement. Syntax and control ranges are documented under [generate-audio](../commands/05-visuals/comic/04-generate-audio.md).

Provider, model, transport, encoding, and cost never appear in `structured-script.json`. One-shot clips are never time-stretched by default. A new prompt, model, or provider creates new generation work. Moving a clip, or changing gain, pan, ducking, or the master profile, reuses the generated audio.

#### Timeline resolution

A cue anchor is an explicit non-negative scene-clock position, a source-segment start or end plus a signed millisecond offset, or a text offset within a spoken segment plus a signed millisecond offset. Source-segment edge anchors resolve from the selected final dialogue timeline after pauses, overlaps, repairs, and provider timing. Text-offset anchors resolve only when retained provider timing maps that text onto the same clock.

`--soundscape-timing-policy strict` is the default. It fails before mastering when exact mapping is unavailable and names the cue and missing evidence. `--soundscape-timing-policy proportional` maps the offset linearly across the retained turn and records that estimate. Negative offsets are allowed. If a resolved clip would begin before the timeline origin, the mixer adds pre-roll and shifts every bus rather than truncating the cue or moving it to zero. A cue that extends past dialogue extends the scene and the full-scene ambient range. Required cue collisions are mixed together unless the source places them in sequence.

#### Provider targets and execution

`--sfx-provider <provider=model>` selects exactly one dedicated sound-effect target and has no paid hosted default. The accepted target is ElevenLabs `eleven_text_to_sound_v2`. Speech endpoints are not accepted. Dialogue `--provider` remains independent. A fresh render with authored action SFX, vocal reactions, or ambience requires an explicit SFX target. Resume reuses the exact target pinned by a compatible retained plan and does not infer a target from credentials. Empty sound intent performs no SFX target setup.

The target supports action SFX, ambience, and vocal reactions. Static validation rejects unsupported cues before dispatch and leaves the cue unchanged.

`--step-concurrency sfx=<n>` caps sound-effect work, and `--concurrency-mode` chooses ramp or immediate admission on the shared lanes of [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md). Ambiguous sound-effect admission blocks automatic repurchase; the TTS-only `--allow-ambiguous-redispatch` control does not unblock it.

`--price` resolves the same plans, counts verified cache and resume hits, and keeps a missing price unknown in the estimate rather than counting it as zero. It performs no credential check, network call, directory creation, cache write, or manifest update.

#### Mixing, artifacts, and failure

The semantic buses are dialogue speech, non-verbal vocal reactions, discrete action SFX, and ambient beds. The mixer writes each non-empty stem and a 48 kHz stereo 24-bit PCM WAV master so local remixes reuse provider outputs without another purchase. Authored pan controls stereo placement; surround and binaural rendering are outside this decision.

Soundscape masters publish as `audio/final/<dialogue-target-key>.soundscape.wav`. Dialogue targets share one set of SFX results and keep distinct final mixes. A dialogue repair re-resolves anchors and does not regenerate unchanged SFX.

A failed required cue fails the soundscape render and prevents publication of that master while preserving verified artifacts for resume. A failed optional cue is recorded as omitted. Cancellation stops queued cue work, leaves state resumable, and does not publish a partial master as success.

### Presentation

`autoshow comic generate-slideshow <script-path>` is an optional local presentation stage. It consumes canonical `panels/panel-NN.png` files and exactly one complete selected dialogue or soundscape run, sequences those panels in reviewed order, writes a presentation WAV from retained source audio, and renders a same-size H.264/AAC MP4 with hard cuts only.

Visuals come from the current run when it contains a valid reviewed scene and complete panels; otherwise the command uses a matching run of the same script after validating source coverage and exact dialogue reconciliation. Matching names alone never establish compatibility. `comic generate-audio --slideshow` performs the same visual, panel, and encoder checks before paid synthesis and fails locally if any prerequisite is missing. After audio already exists, `comic generate-slideshow` does only the local render.

Every reviewed panel must exist as one consecutive `panels/panel-NN.png` with identical even dimensions, which become the output dimensions with no crop, pad, or rescale. Missing files are reported together. Without `--audio-target`, exactly one complete selected soundscape run wins; otherwise exactly one selected dialogue run. Multiple complete candidates require `--audio-target <provider=model>`. Raw audio without a complete canonical audio run is rejected.

Dialogue and discrete effects bind by exact source identity, speaker, and speech text. Inline effects belong to the panel that owns their dialogue segment; block effects belong to the unique panel owning the nearest preceding action or panel-note. Missing, duplicate, or ambiguous ownership fails.

Panels play in reviewed order. Events on one panel keep their relative timing; events that overlapped across panels on the source clock are serialized so they cannot play under the wrong still. A panel without dialogue or a discrete effect holds for `--untimed-panel-ms` (default 2000). Ambience loops for the full presentation; silent intervals remain silent when no ambience exists. The presentation WAV never replaces the source master.

The video uses `--fps` (default 30), H.264, AAC, and hard cuts. Success writes `presentation/presentation.json`, `presentation/final/slideshow.wav`, and `presentation/final/slideshow.mp4`. The JSON file records the plan and resolved timeline. A changed plan, timeline, or option replaces those published files. An identical completed presentation is a no-op. `--price` reports `$0.00` and writes nothing.

### Recorded comic recovery through resume

`resume` accepts canonical single-scene comic manifests and continues requested image, audio, and presentation stages in that order. Stages are `reuse`, `resume`, `not-requested`, `blocked`, or `after-audio`.

Comic recovery accepts `--price`, `--allow-ambiguous-redispatch`, `--bin-dir`, and the global logging and JSON flags. It restores the recorded options and rejects provider, rendering, configuration, output-directory, character-root, and concurrency overrides. Current configuration defaults cannot supply replacement providers.

`resume --price` makes no provider calls and writes nothing. With `--json`, `data.comicPlans` reports per-directory readiness and stage details. A blocked plan can be inspected with `ready: false`; its total covers only work that could be priced, and execution refuses a blocked plan. Invalid manifests or missing source files fail inspection.

Completed compatible work is reused, and unrequested stages stay unrequested. Recovery does not select or promote image variants into `panels/panel-NN.png` or prepare scenes. A recorded audio request can synthesize its remaining slots; presentation-only recovery requires complete audio and never generates missing media. Forced regeneration, audits, revision evaluation, source preparation, new references, voice approvals, and rendering changes stay on their explicit commands. `--allow-ambiguous-redispatch` may repurchase an admitted TTS slot that has no recoverable audio; it does not authorize blocked sound-effect work.

`comic generate-audio --slideshow` records the slideshow request before synthesis, so an interrupted run finishes the video after recovering audio. Missing upstream media or changed dependencies block presentation recovery. A completed presentation whose retained options and selected audio still match the current plan is a no-op. For that stage `--price` checks the scene, panels, selected audio, timeline, and encoder and reports `$0.00`.

Usage is documented under [Comic Recovery](../commands/00-setup-and-utilities/resume.md#comic-recovery) and [generate-slideshow](../commands/05-visuals/comic/05-generate-slideshow.md).

## Rationale

- Voice identity is durable project state, and an explicit voice on every turn stops the scene manifest from claiming a mapping the provider never received.
- Consuming the shared subsystem keeps provider-native strengths and the segmented fallback available to comic without a comic-local dispatch stack.
- Source-level sound intent stays valid when provider catalogs, limits, and prices change, and timeline anchors keep cues aligned across voices, providers, pacing, repairs, and local mix edits.
- Generation identity is separate from mix identity, so placement and level edits do not repurchase a clip.
- Canonical timelines and source provenance are the only reliable synchronization authority; filenames and raw audio duration are insufficient, and sequential panel windows keep dialogue or effects from remaining audible after the owning panel has changed.
- A presentation-specific mix lets presentation timing differ from the original scene clock while the source runs stay intact.
- Reusing `resume` and the canonical manifest for recovery avoids a second planner or persistence file.

## Consequences

Positive outcomes:

- Approved character voices carry across scenes, and a mastered scene recording records the voices and models actually used.
- Scenes retain portable reaction, action-effect, and ambience intent and render it into inspectable stems and a final master, with multi-provider dialogue comparisons sharing generated effects.
- Cue timing, optional omissions, cache reuse, billed usage, and every local transform remain auditable.
- Approved still panels and canonical audio produce a synchronized local MP4 for zero provider cost, reusing reviewed panels from another run of the same script without hand copying.
- `comic generate-audio --slideshow` rejects missing or incompatible visuals, panels, or encoder setup before paid synthesis.
- A recorded comic run can continue, or be priced, with `resume`, and source dialogue and soundscape runs remain immutable and reusable.

Negative outcomes:

- Callers work with structured voice artifacts, approved snapshots, and a formal preflight instead of a single voice string.
- Incompatible older structured scripts require rebuilt scene runs.
- Exact mid-turn cues can block dialogue render targets that do not expose sufficient timing evidence.
- Retained clips and stems increase disk usage.
- The presentation command rejects incomplete panel sets, differently sized images, untimed audio, and ambiguous provenance instead of producing a best-effort video, and every reviewed panel must exist as a canonical `panels/panel-NN.png`.
- Comic `resume` cannot change providers, rendering, paths, or concurrency. Those changes use the comic commands.

## Trade-offs

**Trade-off 1**

- **Gain:** Stable provider-neutral character identity across scenes
- **Sacrifice:** Additional voice artifacts, approved snapshots, and scene-run lifecycle state

**Trade-off 2**

- **Gain:** Portable authored intent with exact, auditable placement
- **Sacrifice:** Sound intent, target support, and timing evidence are validated before dispatch, and missing evidence is a strict failure

**Trade-off 3**

- **Gain:** Provider-output reuse across mixes and dialogue targets
- **Sacrifice:** More retained clips and stems on disk

**Trade-off 4**

- **Gain:** Offline verification of planning, mixing, and presentation at zero cost
- **Sacrifice:** Hosted quality still requires a separately approved calibration run, and presentation is still images with hard cuts only

**Trade-off 5**

- **Gain:** Source audio runs stay unchanged and reruns are deterministic no-ops
- **Sacrifice:** Each presentation keeps its own derived WAV, MP4, and JSON, replaced whenever content or options change, and every panel must share even dimensions

**Trade-off 6**

- **Gain:** Interrupted comic runs continue through the same `resume` command
- **Sacrifice:** Comic recovery cannot override recorded providers, rendering, paths, or concurrency

## Implementation Note

Scene audio ships in `src/cli/commands/visuals/comic/comic-commands/generate-audio/`, local presentation in `src/cli/commands/visuals/comic/comic-commands/generate-slideshow/`, and recorded recovery in `src/cli/commands/setup-and-utilities/resume/resume-comic/`.

## Test Plan

```bash
bun run check
bun t --price
bun test test/test-cases/validation/visuals/comic/soundscape-schema-contracts.test.ts test/test-cases/validation/visuals/comic/soundscape-timeline-contracts.test.ts test/test-cases/validation/visuals/comic/soundscape-mixer-contracts.test.ts
bun test test/test-cases/validation/visuals/comic/comic-presentation-contracts.test.ts test/test-cases/validation/visuals/comic/comic-presentation-ffmpeg-contracts.test.ts
bun test test/test-cases/validation/audio/music/elevenlabs-sfx-adapter-contracts.test.ts test/test-cases/validation/resume-manifests/comic-resume-contracts.test.ts
```

1. `bun run check` checks repository, type, and documentation contracts; `bun t --price` previews the verification cost without running the full suite.
2. Soundscape contracts check directive parsing, strict and proportional anchor resolution, and deterministic four-bus mixing.
3. Presentation contracts check exact panel reconciliation, cross-panel serialization, and local H.264/AAC publication.
4. Mocked adapter and recovery contracts check routing, retained-artifact reuse, read-only price planning, and recorded stage continuation without provider or rendering overrides. They do not establish audible quality.

No provider-backed test is part of this verification.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — canonical manifest, resume architecture, and no-call price planning
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — shared workflow type ownership
- Related ADR: [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md) — FFmpeg provisioning for local rendering
- Related ADR: [ADR-005](ADR-005-cli-error-result-and-retry-contract.md) — structured failures and redispatch authorization
- Related ADR: [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md) — comic command names, aliases, and rejected consolidation alternatives
- Related ADR: [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md) — bounded concurrent provider work
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — hosted model capability and pricing policy
- Related ADR: [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md) — dialogue clock, voice identity, slots, and rendering foundation
- Related ADR: [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md) — paid-approval and retained run evidence
- Related ADR: [ADR-017](ADR-017-comic-script-and-scene-authoring.md) — scene JSON, panels, and blocking upstream of this record
- [comic generate-slideshow](../commands/05-visuals/comic/05-generate-slideshow.md)
- [Comic Recovery](../commands/00-setup-and-utilities/resume.md#comic-recovery)
- ElevenLabs [Sound Effects API](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert)
