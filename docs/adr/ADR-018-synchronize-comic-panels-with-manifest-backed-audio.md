# ADR-018: Synchronize Comic Panels with Manifest-Backed Audio

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-13
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed

## Context

Comic produces reviewed still panels, canonical dialogue `AudioRun` artifacts, and ADR-017 soundscape masters, but those assets previously lacked a local presentation layer. A raw audio master does not retain panel provenance, and cross-panel overlaps on the original scene clock cause audio to desynchronize when played beneath a simple image sequence.

The presentation workflow must remain derived and non-destructive: it may consume ADR-013 and ADR-017 artifacts, but must not mutate source runs, generate replacement media, infer fuzzy matches, crop or rescale approved art, or introduce generated motion. Local rendering requires deterministic resume and idempotent execution without provider calls. Audio runs in separate output directories must resolve reviewed visual assets without manual file duplication or late-stage failures after paid generation completes.

Why now: canonical panel, dialogue, and soundscape artifacts are sufficiently provenance-rich to produce a synchronized local MP4 without another generative provider.

## Options Considered

**Option 1 (selected)**

- **Option:** Build a manifest-backed local still-panel plan, recompose its audio, and render hard cuts with FFmpeg
- **Pros:** Exact ownership evidence, no provider calls, deterministic timing, immutable resume, preserved source artifacts
- **Cons:** Adds derived plans, timelines, local transforms, and strict failures for incomplete evidence
- **Quantitative Notes:** `$0`; one WAV and one MP4 per presentation identity

**Option 2**

- **Option:** Generate motion video from each panel
- **Pros:** Visually dynamic output
- **Cons:** Adds provider cost, creative drift, timing uncertainty, and another provider lifecycle
- **Quantitative Notes:** At least one paid request per panel or shot

**Option 3**

- **Option:** Put the unmodified scene master under a fixed-rate image sequence
- **Pros:** Small implementation
- **Cons:** Cross-panel overlaps can play under the wrong image; raw masters cannot prove panel ownership
- **Quantitative Notes:** One output with no reliable synchronization contract

## Decision

Add `autoshow comic generate-slideshow <script-path>` as an optional local presentation stage. It consumes canonical `panels/panel-NN.png` files and exactly one complete manifest-selected dialogue or soundscape run, constructs a sequential panel clock, recomposes a presentation-specific WAV from retained source audio, and renders a same-size H.264/yuv420p MP4 with AAC audio and hard cuts only.

Visuals come from the current run when it contains a valid reviewed scene and complete panels; otherwise the command uses the canonical sibling named for the exact sanitized script slug after validating source coverage and exact dialogue reconciliation. Sibling naming alone never establishes compatibility. `comic generate-audio --slideshow` performs the same visual, panel, and encoder checks before TTS dispatch and fails locally if any prerequisite is missing. A completed audio run can invoke `comic generate-slideshow` for the local import and FFmpeg work only.

Every reviewed panel must exist as one consecutive `panels/panel-NN.png` with identical positive even dimensions, which become the output dimensions with no crop, pad, or rescale. Missing files are reported together. Audio selection uses only complete selected manifest bindings: without `--audio-target`, exactly one selected soundscape run wins, otherwise exactly one selected dialogue run. Multiple complete candidates require `--audio-target <provider=model>`. Raw audio without a checksum-bound `AudioRun` is rejected.

Dialogue and discrete effects bind by exact source identity, speaker, and speech text, never by fuzzy or provider-assisted matching. Inline effects belong to the panel that owns their dialogue segment; block effects belong to the unique panel owning the nearest preceding action or panel-note. Missing, duplicate, or ambiguous ownership fails.

Panels play in reviewed order. Events on one panel keep their relative timing; events that overlapped across panels on the source clock are serialized so they cannot play under the wrong still. A panel without dialogue or a discrete effect holds for `--untimed-panel-ms` (default 2000). Ambience loops for the full presentation; if none exists, the audio is digital silence. The derived WAV never replaces the source master.

The video uses `--fps` (default 30), H.264, `yuv420p`, AAC at 192 kbps, fast-start metadata, and hard cuts. Selected success publishes `presentation/presentation.json`, `presentation/final/slideshow.wav`, and `presentation/final/slideshow.mp4`. Identical complete reruns no-op after identity and checksum validation. `--price` validates option syntax, reports `$0.00`, and performs no writes.

This applies to:

- Exact source-to-panel reconciliation, dialogue and discrete-effect ownership, untimed panel holds, cross-panel serialization, ambience looping, local presentation audio recomposition, still-image encoding, output identity, resume, and publication.
- The optional comic manifest presentation stage and selected `presentation/final/` outputs. ADR-013 owns how those artifacts are stored and compacted.

It does not apply to:

- Generating, repairing, animating, cropping, padding, or resizing comic panels.
- Generating dialogue, effects, ambience, voices, or any other provider-backed media.
- Replacing or mutating ADR-013 `AudioRun` artifacts, ADR-017 soundscape runs, their original timelines, masters, or selected-success pointers.
- Accepting a raw audio file without its checksum-bound canonical timeline.

## Rationale

- Canonical timelines and source provenance are the only reliable synchronization authority; filenames and raw audio duration are insufficient.
- Sequential panel windows guarantee that dialogue or effects cannot remain audible after the owning panel has changed.
- Derived recomposition preserves ADR-013 and ADR-017 artifacts while allowing presentation timing to differ from the original scene clock.
- Exact matching and explicit ambiguity failures make panel reconciliation reviewable and reproducible.
- Local FFmpeg rendering produces a standard shareable MP4 without generative cost or visual drift.

## Consequences

Positive outcomes:

- Approved still panels and canonical audio produce a synchronized local MP4 for zero provider cost.
- Provider-comparison audio directories reuse one exact reviewed visual bundle without external paths or manual copying.
- Combined audio-and-slideshow commands reject missing or incompatible visual inputs before paid synthesis begins.
- Panel ownership, timing, encoder settings, and output checksums are independently reviewable.
- Source dialogue and soundscape runs remain immutable and reusable.
- Interrupted local work resumes and identical completed work no-ops.

Negative outcomes:

- The command rejects incomplete panel sets, differently sized images, untimed audio, and ambiguous provenance instead of producing a best-effort video.
- Direct canonical panel PNGs are required in the current run or its deterministic exact-script sibling even when another image workflow retains model/run-qualified variants.
- Presentations retain another WAV and MP4 plus their evidence graph.
- Managed FFmpeg installations without `libx264` fall back to a recorded H.264 hardware encoder.

## Trade-offs

**Trade-off 1**

- **Gain:** Exact, auditable panel/audio synchronization
- **Sacrifice:** Strict failures for missing or ambiguous provenance

**Trade-off 2**

- **Gain:** Zero provider cost and no generated motion
- **Sacrifice:** Still images and hard cuts only

**Trade-off 3**

- **Gain:** Original audio runs remain unchanged
- **Sacrifice:** Additional derived WAV, MP4, plan, timeline, and run artifacts

**Trade-off 4**

- **Gain:** Same-size output with no visual transformation
- **Sacrifice:** Every panel must share even dimensions

**Trade-off 5**

- **Gain:** Deterministic resume and no-op reruns
- **Sacrifice:** Content changes create a new immutable presentation identity

## Implementation Note

The workflow is implemented in `src/cli/commands/process-steps/step-8-comic/comic-commands/generate-slideshow/` and the adjacent `comic-presentation-*` utilities. Public types live in `src/types/comic-workflow/` and are exported only through `src/types/index.ts`. Comic manifest updates live in `src/cli/commands/process-steps/step-8-comic/comic-utils/comic-manifest.ts`. The command surface is defined by `src/cli/flags/comic-flags.ts` and `src/cli/commands/process-steps/step-8-comic/comic-utils/subcommand-help.ts`.

## Test Plan

Run the default verification, price-only suite, and targeted local contracts:

```bash
bun run check
bun t --price
bun test test/test-cases/validation/comic/comic-presentation-contracts.test.ts
bun test test/test-cases/validation/comic/comic-presentation-ffmpeg-contracts.test.ts
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
git diff --check
```

1. `bun run check` and `git diff --check` confirm type, lint, and whitespace health after documentation edits.
2. `bun t --price` confirms no-cost `--price` planning with zero network calls and zero file mutations.
3. The presentation contracts verify exact reconciliation, ambiguity failures, SFX ownership, untimed panel holds, cross-panel serialization, ambience looping, panel validation, sibling visual import, audio target selection, immutable publication, and resume.
4. The FFmpeg contract verifies duration, hard-cut image timing, source dimensions, H.264/yuv420p video, and AAC audio.
5. The CLI help, usage-error, and option-resolution contracts confirm the public `comic generate-slideshow` surface.

No provider-backed test or paid suite is part of ADR verification.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — canonical manifest, resume, and no-write price behavior
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — workflow type ownership
- Related ADR: [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md) — managed FFmpeg lifecycle
- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md) — comic native command and shared infrastructure boundaries
- Related ADR: [ADR-013](ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md) — voice identity, dialogue rendering, and original dialogue timeline
- Related ADR: [ADR-017](ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md) — authored sound intent, retained source assets, buses, and original soundscape mix
- `src/types/comic-workflow/comic-presentation-types.ts`
- `src/cli/commands/process-steps/step-8-comic/comic-commands/generate-slideshow/generate-slideshow-command.ts`
- `src/cli/commands/process-steps/step-8-comic/comic-utils/comic-presentation-inputs.ts`
- `src/cli/commands/process-steps/step-8-comic/comic-utils/comic-presentation-plan.ts`
- `src/cli/commands/process-steps/step-8-comic/comic-utils/comic-presentation-renderer.ts`
