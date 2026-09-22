# ADR-017: Add Provider-Neutral Sound Effects and Multi-Track Soundscape Mixing

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-13
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed

## Context

`comic generate-audio` could master dialogue from `structured-script.json` v4, but it had no soundscape domain. It could not author sound-effect intent, generate clips independently of the selected voice, place those clips on the final speech clock, or mix them with ambience ducking.

Sound intent belongs in the script. A cue states what is heard, where it occurs, whether omission is allowed, and how it is placed. Absolute `timestampMs` values are unstable because dialogue duration changes with voice, provider, repair take, and pacing. A cue that cannot be resolved exactly must never be silently clamped, guessed, or dropped. Hosted generation is paid work: `--price` must remain read-only, uncached generation needs an explicit `--sfx-provider`, and offline fixtures must cover planning and mixing.

The soundscape extends the scene-run `manifest.json`, cache, and price contracts. The same generated clip is reusable across dialogue targets so comparison renders do not repurchase it.

Why now: ADR-013 made speech identity, timing, caching, artifacts, and resume trustworthy enough to serve as the dialogue clock; the remaining gap is a durable sound-intent and multi-track mixing layer.

## Options Considered

**Option 1 (selected)**

- **Option:** Build a complete provider-neutral vertical slice with one hosted sound-effect adapter, then add further dedicated SFX targets only where a documented non-speech API fits
- **Pros:** Proves schema, timeline, stem, cache, price, artifact, and hosted execution boundaries before expanding adapters; keeps authored intent portable
- **Cons:** Requires explicit capability gates and truthful unsupported operations rather than approximating missing APIs
- **Quantitative Notes:** 1 complete vertical slice; 3 dedicated SFX targets

**Option 2**

- **Option:** Add ElevenLabs-specific fields and mixing directly to `comic generate-audio`
- **Pros:** Smallest initial implementation; reuses an existing credential and transport
- **Cons:** Couples source files to one API, makes cue timing depend on one dialogue path, and repeats SFX generation for multi-provider dialogue comparisons
- **Quantitative Notes:** 1 provider; high migration cost

**Option 3**

- **Option:** Integrate several SFX providers before defining the timeline and artifact contracts
- **Pros:** Broad provider choice immediately
- **Cons:** Multiplies serializer, capability, pricing, polling, and failure behavior before the common contract is proven
- **Quantitative Notes:** Rejected; at least 4 adapters before one verified vertical slice

**Option 4**

- **Option:** Build only a local mixer and require users to supply every clip
- **Pros:** Entirely offline development and deterministic mastering
- **Cons:** Does not satisfy text-to-sound generation or exercise hosted generation, price, readiness, cache, and resume contracts
- **Quantitative Notes:** 0 hosted adapters

## Decision

Add a provider-neutral soundscape domain to `comic generate-audio`. Authored sound intent lives in `structured-script.json` v5 independently of provider, model, and billing. Dedicated generation uses an explicit `--sfx-provider` target. Local mixing places retained clips on the selected dialogue clock and publishes inspectable stems plus a mastered four-bus WAV.

This applies to:

- `structured-script.json` sound intent, cue-to-timeline resolution, reusable generated assets, semantic stems, final mixes, and comic audio artifacts.
- `comic generate-audio` target selection, static validation, no-call price planning, execution readiness, bounded dispatch, resume, and publication when a scene contains sound intent.
- Local audio placement, looping, fades, stereo panning, ambience ducking, limiting, stem export, and final WAV mastering.
- Dedicated sound-effect targets and the provider-dependent routing of authored vocal reactions.

It does not apply to:

- Voice identity, consent, approval, casting, protected-asset, or dialogue-strategy contracts owned by [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md).
- Inferring sound cues from panel coordinates or coupling audio placement to `scene.json` camera composition.
- Treating provider-generated reverb or a textual spatial prompt as measured acoustic simulation.
- A standalone general-purpose SFX command.
- Presentation-specific panel reconciliation, derived slideshow audio, or still-image video rendering; [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md) consumes retained soundscape evidence without mutating it.

### Authored intent

`structured-script.json` v5 adds a scene-level `soundscape` object. An empty cue and ambient-bed collection is valid and keeps dialogue-only behavior with no sound-effect provider call. Existing v4 scene runs must be rebuilt; `comic generate-audio` has no v4 upgrader.

Markdown recognizes block labels `**SFX:**`, `**VOCAL SFX:**`, and `**AMBIENCE:**`, plus inline `[[SFX: ...]]` or `[[VOCAL SFX: ...]]` for mid-turn placement. Directives are required unless prefixed with `OPTIONAL`. An optional provider-neutral envelope may follow, such as `{duration: 2.5s, gain: -3dB, pan: -0.4}`: duration is 0.5–30 seconds, gain is in decibels, and pan runs from -1 to 1. These controls never select a provider. A block directive anchors at its source-order boundary, an inline directive at its spoken-text offset, and an ambience block covers the full resolved scene unless it declares an explicit range. Unlabelled action or panel direction remains visual staging. Script review preserves the parsed soundscape: it does not invent a cue, change required or optional policy, or detach a cue from its source span.

Provider, model, transport, encoding, and cost never appear in `structured-script.json`. Required-cue failure prevents master publication; optional-cue omission is recorded in the result. One-shot clips are never time-stretched by default. A new prompt, model, or provider creates new generation work. Moving a clip, or changing gain, pan, ducking, or the master profile, reuses the generated audio.

### Timeline resolution

A cue anchor is an explicit non-negative scene-clock position, a source-segment start or end plus a signed millisecond offset, or a text offset within a spoken segment plus a signed millisecond offset. Source-segment edge anchors resolve from the selected final dialogue timeline after pauses, overlaps, repairs, and provider timing. Text-offset anchors resolve only when retained provider timing maps that text onto the same clock.

`--soundscape-timing-policy strict` is the default. It fails before mastering when exact mapping is unavailable and names the cue and missing evidence. `--soundscape-timing-policy proportional` maps the offset linearly across the retained turn and records that estimate. Negative offsets are allowed. If a resolved clip would begin before the timeline origin, the mixer adds pre-roll and shifts every bus. It does not truncate the cue or move it to zero. A cue that extends past dialogue extends the scene and the full-scene ambient range. Required cue collisions are mixed together unless the source places them in sequence.

### Provider targets and execution

`--sfx-provider <provider=model>` selects exactly one dedicated sound-effect target and has no paid hosted default. The accepted targets are ElevenLabs `eleven_text_to_sound_v2`, version-pinned Replicate AudioGen, and Stability `stable-audio-3`. Speech endpoints are not accepted. Dialogue `--provider` remains independent. A fresh render with authored action SFX, vocal reactions, or ambience requires an explicit SFX target. Resume reuses the exact target pinned by a compatible retained plan and does not infer a target from credentials. Empty sound intent performs no SFX target setup.

AudioGen is a community deployment under CC BY-NC 4.0. `--sfx-license-use noncommercial|commercial|unknown` is required for that target and is never inferred from model selection. Commercial use is ineligible. AudioGen and Stability render action SFX and ambience only. Vocal reactions are accepted only by the ElevenLabs sound-effect target. A required vocal reaction on an unsupported target fails static validation before dispatch, and the cue is left unchanged.

`--step-concurrency sfx=<n>` caps sound-effect work, and `--concurrency-mode` chooses ramp or immediate admission. Ambiguous paid admission uses `--allow-ambiguous-redispatch` as defined by [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md).

`--price` resolves the same plans, counts verified cache and resume hits, and keeps a missing price unknown in the estimate, where it is not counted as zero. It performs no credential check, network call, directory creation, cache write, or manifest update.

### Mixing, artifacts, and failure

The semantic buses are dialogue speech, non-verbal vocal reactions, discrete action SFX, and ambient beds. Missing buses are valid. The mixer writes each non-empty stem and the final master so a local remix can reuse provider outputs without another purchase.

The accepted `comic-soundscape-v1` profile is fixture-locked:

- **Master format:** 48 kHz stereo 24-bit PCM WAV
- **Bus gains:** dialogue `0 dB`, vocal reactions `-1 dB`, action SFX `-3 dB`, ambience `-14 dB`
- **Loudness:** `-16 LUFS` integrated, `-1 dBTP` true-peak, limiter ceiling `0.95`
- **Ambience ducking:** `9 dB` from the dialogue and vocal-reaction envelope, with a `120 ms` bed-loop crossfade

Stereo position comes from explicit authored pan, rendered with constant-power panning, or from the profile's center default. Surround, HRTF binaural rendering, automatic panel-coordinate panning, and provider-side spatial synthesis are outside this decision.

The scene run keeps one `manifest.json`. Soundscape masters publish as `audio/final/<dialogue-target-key>.soundscape.wav`. Dialogue targets share one set of SFX results and keep distinct final mixes. A dialogue repair re-resolves anchors and does not regenerate unchanged SFX.

A failed required cue fails the soundscape render and prevents publication of that master while preserving verified artifacts for resume. A failed optional cue is recorded as omitted. Cancellation stops queued cue work, leaves state resumable, and does not publish a partial master as success.

## Rationale

- Source-level sound intent stays valid when provider catalogs, limits, and prices change.
- Timeline anchors keep cues aligned across voices, providers, pacing, repairs, and local mix edits.
- Offline fixtures prove planning and mixing without a provider charge.
- Generation identity is separate from mix identity, so placement and level edits do not repurchase a clip.
- A new SFX target is added only when a documented non-speech API fits this contract.

## Consequences

Positive outcomes:

- Comic scenes can retain portable non-verbal reaction, action-effect, and ambience intent and render it into inspectable stems and a final master.
- Multi-provider dialogue comparisons share generated effects instead of multiplying SFX cost.
- Cue timing, optional omissions, cache reuse, billed usage, and every local transform remain auditable.
- Dialogue-only v5 scenes keep the existing execution behavior and make no SFX provider call.

Negative outcomes:

- `structured-script.json` advances to v5 and new canonical scene runs must be rebuilt; there is no v4 compatibility reader.
- Final mastering now depends on a selected dialogue timeline, so exact mid-turn cues can block dialogue render targets that do not expose sufficient timing evidence.
- Retaining reusable source audio and semantic stems increases disk usage.
- The Replicate AudioGen target is a community deployment with weaker availability guarantees than an official hosted model, and commercial use is ineligible under its CC BY-NC 4.0 terms.

## Trade-offs

**Trade-off 1**

- **Gain:** Portable authored intent and provider-qualified execution
- **Sacrifice:** Sound intent, target support, and timing evidence are validated before dispatch

**Trade-off 2**

- **Gain:** Exact, auditable placement
- **Sacrifice:** Strict failures when canonical timing evidence is unavailable

**Trade-off 3**

- **Gain:** Provider-output reuse across many mixes
- **Sacrifice:** More retained clips and stems on disk

**Trade-off 4**

- **Gain:** Offline mixer verification
- **Sacrifice:** Hosted quality still requires a separately approved calibration run

**Trade-off 5**

- **Gain:** Dedicated AudioGen and Stability paths beyond ElevenLabs
- **Sacrifice:** AudioGen depends on a pinned Replicate community model and an explicit noncommercial license declaration

## Implementation Note

`comic generate-audio` accepts `--sfx-provider`, `--sfx-license-use`, `--soundscape-timing-policy`, and `--step-concurrency sfx=<n>`. Planning, routing, mixing, and the dedicated adapters live under `src/cli/commands/audio/tts/soundscape/`.

## Test Plan

Run the default no-cost repository verification and targeted offline soundscape contracts:

```bash
bun run check
bun t --price
bun test test/test-cases/validation/visuals/comic/soundscape-schema-contracts.test.ts
bun test test/test-cases/validation/visuals/comic/soundscape-timeline-contracts.test.ts
bun test test/test-cases/validation/visuals/comic/soundscape-mixer-contracts.test.ts
bun test test/test-cases/validation/visuals/comic/comic-soundscape-artifact-contracts.test.ts
bun test test/test-cases/validation/audio/music/elevenlabs-sfx-adapter-contracts.test.ts
bun test test/test-cases/validation/audio/music/replicate-audiogen-adapter-contracts.test.ts
bun test test/test-cases/validation/audio/music/stability-stable-audio-adapter-contracts.test.ts
git diff --check
```

1. `bun run check` and `git diff --check` confirm type, lint, and whitespace health.
2. `bun t --price` confirms `--price` planning makes no network call and writes no files.
3. The soundscape schema, timeline, mixer, and artifact contracts verify v5 parsing, directive extraction, exact and proportional anchor resolution, four-bus mixing, cache reuse, and canonical publication.
4. The adapter contracts verify ElevenLabs, AudioGen, and Stability capability routing without paid provider calls.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — manifest, resume, and no-call price planning
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — shared workflow type ownership
- Related ADR: [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md) — structured failures and redispatch authorization
- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md) — comic boundaries on shared provider setup
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — bounded concurrent provider work
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — hosted model capability and pricing policy
- Related ADR: [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md) — paid-approval and retained run evidence
- Related ADR: [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md) — dialogue clock, voice identity, and mastering foundation
- Related ADR: [ADR-018](ADR-018-synchronize-comic-panels-with-manifest-backed-audio.md) — read-only panel presentation over retained soundscape audio
- `src/cli/flags/comic-flags.ts`
- ElevenLabs [Sound Effects API](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert)
- Replicate [AudioGen](https://replicate.com/sepal/audiogen)
- Stability AI [Stable Audio](https://platform.stability.ai/docs/api-reference)
