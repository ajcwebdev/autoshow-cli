# ADR-013: Comic Audio and Presentation

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-10
- **Date Updated:** 2026-11-14
- **Verification Status:** Passed

## Context

Comic audio needs approved voices, portable sound intent, and exact source/timing ownership. Paid clips must survive interruption and local remixing; still-panel presentations must follow their owning audio events without changing source runs.

## Decision

Comic consumes the [shared TTS subsystem](ADR-012-tts-synthesis-voice-management-and-delivery.md), owning scene snapshots, dialogue plans, soundscapes, and local presentations. It uses one canonical scene `manifest.json`, shared hosted admission, and the existing `resume` planner.

### Scene runs and generate-audio

`comic generate-audio` consumes a compatible scene run or initializes a missing/empty explicit `--output-dir`. Price planning requires an existing run. Nonempty incompatible directories fail without rewriting source, manifest, or structured script. Nested audio render directories are not independent run roots.

Every speaking role resolves to an approved immutable voice snapshot; every speakable segment is preserved, and metadata records actual dispatched bindings. Registrations remain separate from the visual character catalog. Synthesis cannot create/delete remote voices. `--delivery-policy strict` rejects unsupported authored delivery; `best-effort` records it. Comic selects native/segmented rendering with `--mode`, bounds generation slots, and owns its mix settings.

### Soundscape

Provider-neutral sound intent lives in `structured-script.json` v5: action effects, vocal reactions, and ambience, with no provider, model, transport, encoding, or billing fields. Incompatible schemas require rebuilt runs. Authored directives are required unless marked optional; ordinary visual staging creates no inferred sound. Block cues anchor at source-order boundaries, inline cues at speech offsets, and ambience spans the scene unless explicitly ranged. [The command guide](../commands/05-visuals/comic/04-generate-audio.md) defines syntax and controls.

New prompts, models, or providers create generation work. Moving clips or changing levels, pan, ducking, or mastering reuses retained audio; one-shots are not time-stretched by default. Dialogue targets share generated effects while keeping separate final mixes.

Cue anchors use scene time, source-segment edges, or speech offsets with signed offsets. They resolve against the selected final dialogue clock after repairs, pauses, and overlaps. Speech offsets require timing evidence for that same clock. Default `--soundscape-timing-policy strict` fails on missing evidence; `proportional` records an explicit linear estimate. Negative resolved starts add pre-roll to every bus rather than clamping/truncating. Late cues extend the scene and full-scene ambience; simultaneous required cues mix unless authored sequentially.

Sound-effect generation requires an explicit independent `--sfx-provider provider=model`, currently ElevenLabs `eleven_text_to_sound_v2`; there is no paid default or speech-endpoint fallback. Empty sound intent performs no SFX setup. Static checks reject unsupported cues before dispatch. Resume uses the exact retained target rather than inferring one from credentials. `--step-concurrency sfx=N` and `--concurrency-mode` use [shared lanes](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md). Ambiguous SFX admission blocks repurchase; the TTS-only `--allow-ambiguous-redispatch` does not unblock it.

The mixer publishes nonempty dialogue, vocal-reaction, action-effect, and ambience stems plus a 48 kHz stereo 24-bit PCM WAV master under `audio/final/`. Pan is stereo; surround/binaural acoustics are outside scope. Required cue failure prevents master publication; optional failure records omission. Cancellation preserves resumable artifacts. Dialogue repairs resolve anchors again without regenerating unchanged effects.

Price planning resolves the same targets, plans, and verified reuse, leaving unknown prices unknown. It performs no credential check, provider call, directory creation, cache write, or manifest update.

### Presentation

`comic generate-slideshow` locally renders reviewed still panels and exactly one complete canonical dialogue/soundscape run. It never generates motion, alters panels, accepts untimed raw audio, or mutates source audio. `comic generate-audio --slideshow` checks visuals, panel coverage, and encoder readiness before paid synthesis and records presentation intent before dispatch.

Visuals come from the current reviewed run or a same-script run with exact source coverage/dialogue reconciliation; filenames alone prove nothing. Every consecutive canonical `panels/panel-NN.png` must exist with identical even dimensions. Those dimensions are preserved without crop, padding, or rescaling; missing panels are reported together. Audio selection prefers exactly one complete selected soundscape, otherwise exactly one dialogue run. Ambiguous candidates require `--audio-target provider=model`.

Dialogue/effects bind by exact source identity, speaker, and text. Inline effects belong to their segment's panel; block effects belong to the unique panel owning the nearest preceding action/panel note. Missing, duplicate, or ambiguous ownership fails.

Panels retain reviewed order and within-panel timing. Cross-panel overlaps are serialized so events remain beneath their owning still. Untimed panels hold for `--untimed-panel-ms` (default 2000); ambience loops across the presentation, otherwise silent intervals stay silent. The derived WAV never replaces source masters.

Publication writes the resolved plan to `presentation/presentation.json` and WAV/H.264-AAC MP4 files under `presentation/final/`, using hard cuts and `--fps` (default 30). Identical completed plans are no-ops; changed plans/options replace derived outputs. Local presentation price is zero and writes nothing.

### Recorded comic recovery through resume

`resume` continues recorded image, audio, and presentation stages in that order, with `reuse`, `resume`, `not-requested`, `blocked`, or `after-audio` plans. It restores recorded choices and rejects provider, rendering, configuration, output-directory, character-root, and concurrency overrides. Configuration defaults cannot supply replacements.

Accepted controls are `--price`, `--allow-ambiguous-redispatch`, `--bin-dir`, and global logging/JSON flags including `--json --result-file`. `--require-shared-budget` reaches the shared budget gate; budgeted resume execution remains unsupported and fails before dispatch, while configured price inspection is allowed.

`resume --price` makes no calls or writes. JSON `data.comicPlans` reports readiness and stages; blocked totals cover only priceable work, and blocked execution is refused. Invalid manifests or missing sources fail inspection. Compatible completed work is reused, and unrequested stages stay unrequested.

Recovery does not prepare sources, promote image variants, change references/approvals, force regeneration, or run audits/revision evaluations. Recorded audio can synthesize remaining slots; presentation-only recovery requires complete audio. Missing upstream media or changed dependencies block presentation. An interrupted `--slideshow` request finishes locally after audio recovery. [Explicit ambiguous TTS redispatch](ADR-005-cli-error-result-and-retry-contract.md) may repurchase an unresolved slot but never authorizes blocked SFX work.

## Trade-offs

Immutable source/voice evidence and strict timing prevent silent substitutions but require more retained state and can block targets lacking exact timing. Separate generation and mixing identities avoid repeat purchases at the cost of clips/stems on disk. Derived hard-cut presentations stay deterministic and free of provider charges, while recovery deliberately cannot revise recorded choices.

## Verification

```bash
bun test test/test-cases/validation/visuals/comic/soundscape-schema-contracts.test.ts test/test-cases/validation/visuals/comic/soundscape-timeline-contracts.test.ts test/test-cases/validation/visuals/comic/soundscape-mixer-contracts.test.ts
bun test test/test-cases/validation/visuals/comic/comic-presentation-contracts.test.ts test/test-cases/validation/visuals/comic/comic-presentation-ffmpeg-contracts.test.ts
bun test test/test-cases/validation/audio/music/elevenlabs-sfx-adapter-contracts.test.ts test/test-cases/validation/resume-manifests/comic-resume-contracts.test.ts
```

Local contracts cover parsing, timing, mixing, exact panel ownership, real rendering, mocked dispatch, retention, and recovery. They do not establish hosted audible quality.

## References

- [Scene authoring](ADR-017-comic-script-and-scene-authoring.md)
- [Presentation guide](../commands/05-visuals/comic/05-generate-slideshow.md)
- [Comic recovery guide](../commands/00-setup-and-utilities/resume.md#comic-recovery)
- `src/cli/commands/visuals/comic/comic-commands/generate-audio/` and `generate-slideshow/`
- `src/cli/commands/setup-and-utilities/resume/resume-comic/`
