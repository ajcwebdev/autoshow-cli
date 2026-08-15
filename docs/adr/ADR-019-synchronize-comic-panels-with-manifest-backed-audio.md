# ADR-019: Synchronize Comic Panels with Manifest-Backed Audio

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-13
- **Date Updated:** 2026-08-15
- **Verification Status:** Passed

## Context

Comic can produce reviewed still panels, canonical dialogue `AudioRun` artifacts, and ADR-018 soundscape masters, but those assets previously had no local presentation layer. A raw WAV or MP4 does not retain enough provenance to know which speech turn or discrete effect belongs to which panel. Playing the original master beneath a simple image sequence can also put audio under the wrong image when events assigned to different panels overlap on the original scene clock.

The presentation workflow must remain derived and non-destructive. ADR-014 owns voice identity, dialogue synthesis, and the original dialogue timeline. ADR-018 owns authored sound intent, generated sound assets, semantic buses, the resolved soundscape timeline, and the original soundscape master. A presentation may consume those artifacts, but it must not change either source run, buy replacement audio, infer fuzzy source matches, crop or rescale approved art, or introduce generated motion.

Local rendering also needs deterministic restart behavior. An FFmpeg interruption should not require provider work or discard a valid completed stage, while an identical completed rerun should verify immutable checksums and do nothing. Historical comic manifests predate a presentation stage and must remain readable without implying that presentation was requested.

Provider-comparison audio runs may intentionally use separate output directories beside the reviewed visual scene. Requiring each comparison directory to duplicate `metadata/scene.json` and all canonical panel PNGs before audio starts creates a late failure mode: paid TTS can finish successfully and only then discover that the optional slideshow cannot read its visual inputs.

Why now: canonical panel, dialogue, and soundscape artifacts are sufficiently provenance-rich to produce a synchronized local MP4 without another generative provider.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| Generate motion video from each panel | Visually dynamic output | Adds provider cost, creative drift, timing uncertainty, and another provider lifecycle | At least one paid request per panel or shot |
| Put the unmodified scene master under a fixed-rate image sequence | Small implementation | Cross-panel overlaps can play under the wrong image; raw masters cannot prove panel ownership | One output with no reliable synchronization contract |
| **Build a manifest-backed local still-panel plan, recompose its audio, and render hard cuts with FFmpeg** | Exact ownership evidence, no provider calls, deterministic timing, immutable resume, preserved source artifacts | Adds derived plans, timelines, local transforms, and strict failures for incomplete evidence | `$0`; one WAV and one MP4 per presentation identity |

## Decision

Add `autoshow comic generate-slideshow <script-path>` as an optional local presentation stage. It consumes canonical `panels/panel-NN.png` files and exactly one complete manifest-selected dialogue or soundscape run, constructs a sequential panel clock, recomposes a presentation-specific WAV from retained source audio, and renders a same-size H.264/yuv420p MP4 with AAC audio and hard cuts only.

The visual source is the current run when it contains a valid reviewed scene and complete panels. Otherwise the workflow checks the deterministic canonical sibling named for the exact sanitized script slug, validates full source-segment coverage against the current structured script, and requires exact dialogue reconciliation. It then copies the verified scene and panel bytes into a content-addressed immutable `presentation/inputs/<visual-bundle-id>/` bundle inside the audio run. Presentation plans never retain external or escaping paths, and sibling naming alone never establishes compatibility.

`comic generate-audio --slideshow` performs visual resolution, source coverage, dialogue reconciliation, panel validation, and H.264 encoder readiness before TTS provider dispatch. If any prerequisite is unavailable, the command fails locally before provider spend. A completed audio run can invoke `comic generate-slideshow` directly to perform only the local import and FFmpeg work.

This applies to:

- Exact source-to-panel reconciliation, dialogue and discrete-effect ownership, untimed panel holds, cross-panel serialization, ambience looping, local presentation audio recomposition, still-image encoding, output identity, resume, and publication.
- `ComicPresentationPlan`, `ResolvedPanelTimeline`, `ComicPresentationRun`, the optional comic manifest presentation stage, immutable `presentation/runs/<presentation-id>/` artifacts, and selected `presentation/final/` outputs.
- Historical comic manifests whose missing presentation stage is interpreted as `not-requested` and whose next canonical write includes the stage.

This does not:

- Generate, repair, animate, crop, pad, or resize comic panels.
- Generate dialogue, effects, ambience, voices, or any other provider-backed media.
- Replace or mutate ADR-014 `AudioRun` artifacts, ADR-018 soundscape runs, their original timelines, masters, or selected-success pointers.
- Accept a raw audio file without its checksum-bound canonical timeline.

### Ownership Boundaries

| Owner | Responsibilities | Must not own |
|---|---|---|
| ADR-014 dialogue workflow | Voice identity, casting, provider execution, dialogue assembly, canonical dialogue `AudioRun`, and original `FinalTimeline` | Panel timing, presentation serialization, presentation outputs |
| ADR-018 soundscape workflow | Authored cues, SFX generation, retained sources, buses, cue placement, source stems, original soundscape timeline, and master | Rewriting source runs for a slideshow or choosing panel windows |
| ADR-019 presentation workflow | Exact panel reconciliation, event ownership evidence, sequential panel clock, derived audio transformations, continuous ambience or digital silence, still-image encoding, resume, publication, and presentation identity | Provider dispatch, fuzzy matching, source-run mutation, generated motion |
| Canonical manifest | Optional local stage status and checksum-bound selected presentation references | A second presentation manifest or mutable run artifacts |

### Input and Reconciliation Contract

Every reviewed panel must have one direct canonical `panels/panel-NN.png` file in its visual source. The command reports every missing file in one error, rejects duplicate numeric aliases, requires consecutive reviewed panel numbers, and requires every image to have identical positive even dimensions. Those dimensions are the output dimensions; the encoder does not crop, pad, or rescale. Imported sibling inputs preserve those exact bytes and dimensions under an immutable run-contained visual bundle.

Audio selection considers only complete selected manifest bindings. Without `--audio-target`, exactly one selected soundscape run wins; otherwise exactly one selected dialogue run is used. Multiple selected soundscape runs or, when no soundscape is selected, multiple dialogue runs require `--audio-target <provider=model>`. An explicit target selects its soundscape first and its dialogue run otherwise. Missing run artifacts, stale checksums, invalid content identities, untimed dialogue timelines, incomplete required cue results, and raw audio without an `AudioRun` fail before rendering.

Dialogue turns bind by current exact `sourceSegmentId`, speaker, and canonical speech text. When a reviewed panel line retains a parenthetical cue that the audio plan classifies as non-spoken delivery or timing, reconciliation may elide it only when the complete cue text is preserved exactly in that turn's source-backed delivery or timing evidence; the binding records the exact elision. Older reviewed panel bundles may reconcile only through deterministic exact speaker-and-text occurrence order. Source/content disagreement, unsupported parentheticals, duplicate ownership, missing turns, and ambiguous legacy occurrences fail. The workflow never uses fuzzy or provider-assisted matching.

An inline discrete effect belongs to the panel already owning its source dialogue segment. A block effect belongs to the unique panel owning the nearest preceding authored action or panel-note source segment. Split source fragments with an identical nearest source end may collapse only when every fragment resolves to the same panel, and the binding retains all equivalent source IDs. Every binding records its method and source evidence; missing and ambiguous panel ownership fail.

### Presentation Clock and Audio Contract

Panels are processed in reviewed order. Events assigned to one panel keep their relative timing and overlap. Each assigned panel starts after the preceding panel, so events that overlapped across panels on the source clock are serialized and cannot play beneath the wrong still. An assigned panel lasts from its earliest event start through its latest event end. A panel without dialogue or a discrete effect receives `--untimed-panel-ms`, defaulting to 2000 milliseconds, including untimed panels before, between, and after audio-bearing panels.

The renderer slices checksum-bound dialogue ranges from the original dialogue output and places retained SFX sources according to the resolved panel timeline. Overlapping dialogue ranges from the same panel are unioned before slicing so the same master material is not mixed twice. Ambience sources loop continuously for the complete presentation duration; when no ambience exists, the audio graph records digital silence as its continuous base. All transformations and exact FFmpeg commands are retained in `ComicPresentationRun`. The derived WAV never replaces the source dialogue or soundscape master.

### Rendering and Persistence Contract

The video uses a constant configurable frame rate, defaulting to 30 fps, H.264 video, `yuv420p`, AAC at 192 kbps, fast-start metadata, and hard cuts. `libx264` uses its `stillimage` tune when available. A supported H.264 hardware encoder is selected and recorded when the managed FFmpeg build lacks `libx264`; the source remains a static same-size image sequence and no motion, transition, crop, pad, or scale filter is introduced.

The content-addressed `presentationId` binds source identity, reviewed scene, structured script, dialogue plan, selected audio run and timeline, optional soundscape evidence, panel checksums and dimensions, reconciliation evidence, and timing/encoder options. External canonical visuals are first copied into an immutable content-addressed input bundle, so all plan paths remain contained by the active run. Immutable plans, timelines, derived media, and run evidence live under `presentation/runs/<presentation-id>/`. A fixed staging directory permits local WAV and MP4 work to resume independently before link-based immutable publication. Selected outputs are atomically copied to `presentation/final/slideshow.wav` and `presentation/final/slideshow.mp4`. Identical complete reruns validate content identities and checksums, republish only when necessary, and otherwise no-op.

`--price` validates local option syntax, reports `$0.00`, makes no provider call, and performs no writes.

## Rationale

- Canonical timelines and source provenance are the only reliable synchronization authority; filenames and raw audio duration are insufficient.
- Sequential panel windows guarantee that dialogue or effects cannot remain audible after the owning panel has changed.
- Derived recomposition preserves ADR-014 and ADR-018 artifacts while allowing presentation timing to differ from the original scene clock.
- Exact matching and explicit ambiguity failures make legacy reconciliation reviewable and reproducible.
- Local FFmpeg rendering produces a standard shareable MP4 without generative cost or visual drift.

## Implementation Note

The workflow is implemented in `src/cli/commands/process-steps/step-8-comic/comic-commands/generate-slideshow/` and the `comic-presentation-*` utilities beside the existing comic workflow. Public types live in `src/types/comic-workflow/comic-presentation-types.ts`. Comic manifest parsing and updates live in `src/cli/commands/process-steps/pipeline-manifest.ts` and `src/cli/commands/process-steps/step-8-comic/comic-utils/comic-manifest.ts`. The native command surface is defined by `src/cli/flags/comic-flags.ts` and `src/cli/commands/process-steps/step-8-comic/comic-utils/subcommand-help.ts`.

## Consequences

Positive outcomes:

- Approved still panels and canonical audio can produce a synchronized local MP4 for zero provider cost.
- Provider-comparison audio directories can reuse one exact reviewed visual bundle without external paths or manual copying.
- Combined audio-and-slideshow commands reject missing or incompatible visual inputs before paid synthesis begins.
- Panel ownership, timing changes, encoder settings, commands, and output checksums are independently reviewable.
- Source dialogue and soundscape runs remain immutable and reusable.
- Interrupted local work resumes and identical completed work no-ops.

Negative outcomes:

- The command rejects incomplete panel sets, differently sized images, untimed audio, and ambiguous legacy provenance instead of producing a best-effort video.
- Direct canonical panel PNGs are required in the current run or its deterministic exact-script sibling even when another image workflow retains model/run-qualified variants.
- Presentations retain another WAV and MP4 plus their evidence graph.
- Managed FFmpeg installations without `libx264` use a recorded H.264 hardware encoder and cannot apply the encoder-specific `stillimage` tune.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Exact, auditable panel/audio synchronization | Strict failures for missing or ambiguous provenance |
| Zero provider cost and no generated motion | Still images and hard cuts only |
| Original audio runs remain unchanged | Additional derived WAV, MP4, plan, timeline, and run artifacts |
| Same-size output with no visual transformation | Every panel must share even dimensions |
| Deterministic resume and no-op reruns | Content changes create a new immutable presentation identity |

## Test Plan

Run the default verification, price-only suite, and targeted local contracts:

```bash
bun run check
bun t --price
bun test test/test-cases/validation/comic/comic-presentation-contracts.test.ts
bun test test/test-cases/validation/comic/comic-presentation-ffmpeg-contracts.test.ts
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/
git diff --check
```

The local contracts cover exact and legacy reconciliation, ambiguity failures, inline and action-segment SFX ownership, intro/middle/outro holds, within-panel overlap, cross-panel serialization, ambience looping, digital silence, missing and duplicate panels, dimension drift, exact-source sibling visual import, stale audio checksums, audio target selection, historical manifest migration, immutable publication, repeat rendering, and an actual tiny FFmpeg render. The FFmpeg fixture verifies duration within one frame, hard-cut image timing, source dimensions, H.264/yuv420p video, AAC audio, and distinct audio frequencies aligned to their owning panels. No provider-backed test or full paid suite is part of ADR verification.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — canonical manifest, resume, and no-write price behavior
- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — workflow type ownership
- Related ADR: [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md) — managed FFmpeg lifecycle
- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md) — comic native command and shared infrastructure boundaries
- Related ADR: [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md) — voice identity, dialogue rendering, and original dialogue timeline
- Related ADR: [ADR-018](ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md) — authored sound intent, retained source assets, buses, and original soundscape mix
- `src/types/comic-workflow/comic-presentation-types.ts`
- `src/cli/commands/process-steps/step-8-comic/comic-commands/generate-slideshow/generate-slideshow-command.ts`
- `src/cli/commands/process-steps/step-8-comic/comic-utils/comic-presentation-inputs.ts`
- `src/cli/commands/process-steps/step-8-comic/comic-utils/comic-presentation-plan.ts`
- `src/cli/commands/process-steps/step-8-comic/comic-utils/comic-presentation-renderer.ts`
