# comic

Draft comic scene JSON with shot plans, build reviewed panel prompt bundles, generate QA-approved panel and page images, manage approved character voices, render multi-speaker scene audio, and synchronize canonical panels into a local still-image MP4.

## Outline

- [Overview](#overview)
- [Setup](#setup)
- [Runtime Paths](#runtime-paths)
- [Usage](#usage)
- [Walkthrough: 01-opening](#walkthrough-01-opening)
- [draft-scenes](#draft-scenes)
- [generate-images](#generate-images)
- [generate-audio](#generate-audio)
- [generate-slideshow](#generate-slideshow)
- [reference-sketch](#reference-sketch)
- [Output](#output)
- [Supported Models](#supported-models)
- [Notes](#notes)

## Overview

`comic` is a staged pipeline:

1. Draft structured scene JSON from episode scripts.
2. Generate reusable character and canonical location references for panel prompts.
3. Build panel prompts, review sketches, final panel images, and grouped page images.
4. Resolve approved provider-qualified voice registrations into an immutable scene snapshot and render canonical multi-speaker audio.
5. Recompose one complete manifest-backed audio run against canonical panels and render a synchronized local slideshow.

The public subcommands are:

```bash
bun autoshow comic draft-scenes
bun autoshow comic generate-images
bun autoshow comic generate-audio
bun autoshow comic generate-slideshow
bun autoshow comic reference-sketch
bun autoshow comic reference-voice
```

## Setup

`comic` uses hosted text and image models for generation stages. Set the relevant provider keys before running generation:

```bash
OPENAI_API_KEY=...
GEMINI_API_KEY=...
XAI_API_KEY=...
```

- `OPENAI_API_KEY` is required for OpenAI text and image models.
- `GEMINI_API_KEY` is required for Gemini text and image models.
- `XAI_API_KEY` is required for Grok text and image models.
- Text and image models resolve against central registries, so any other centrally registered provider you select (e.g. BFL, Recraft, Replicate, Luma Labs, fal.ai for images) requires its respective provider key. See [Supported Models](#supported-models) for the full list.
- `--price` is side-effect-free and does not call image or LLM generation APIs. `comic generate-audio --price` performs static source, casting, strategy, and cost planning without provider calls or artifact writes; `comic generate-slideshow --price` reports `$0.00` without writes.

Hosted comic LLM, image, QA, dialogue, and sound-effect work defaults to `--concurrency-mode ramp`. Each provider/account lane starts one request immediately and adds one slot every five seconds while demand is queued, up to the applicable command cap; independent providers ramp independently. `--concurrency-mode immediate` begins at those caps. Price mode simulates a clean ramp with no rate-limit events.

### Character and Location Catalogs

Every comic command requires `input/characters/characters-reference.json`, or the equivalent file under `--characters-root`. The catalog defines character keys, relative `image` and `outlineSheet` paths, per-character aliases, optional group aliases, and optional per-character `sceneTextRules`. A rule declares `kind` (`required` or `forbidden`), a regular-expression `pattern`, and a human-readable `description`. Scene drafting validates panels against catalog descriptions and rules. A character with one canonical reference image sets `image` and `outlineSheet` to the same relative path. A prose-defined character may declare an existing root-relative `generationReference` (for style context) and optional `generationInstructions`.

Character paths must stay within the character root and use PNG/WebP/JPG/JPEG files. Canonical source images must exist when the catalog loads, except when bootstrap generation creates a new character using `generationReference`. Character revisions and panel-prompt creation require a matching checksummed registration in `character-sketches.json`.

Location configuration is project-defined in `input/locations/locations-reference.json`. Set `styleImage` to any project image whose visual language should guide new location views. A location entry may set a root-relative `referenceDirectory`, an establishing `referenceFilename` ending in `--reference.png`, or both. Reverse and side filenames use `-reverse` or `-side` before `.png`. When the location catalog does not exist, comic commands initialize it using the first character catalog image as the style reference.

## Runtime Paths

Canonical project-root paths:

| Artifact | Path |
|----------|------|
| Episode scripts | `input/scripts/NN-script/*.md` |
| Character source images | `input/characters/` |
| Per-run scene workspace (prompts, scenes, panels, pages, sketches) | `output/<YYYY-MM-DD_HH-MM-SS-mmm>_<scene-slug>/` |
| Canonical scene manifest | `output/<timestamp>_<scene-slug>/manifest.json` |
| Immutable dialogue plans and voice snapshots | `output/<timestamp>_<scene-slug>/metadata/dialogue-plans/`, `output/<timestamp>_<scene-slug>/assets/voice-references/` |
| Provider render evidence and final audio | `output/<timestamp>_<scene-slug>/audio/<target-key>/render.json`, `output/<timestamp>_<scene-slug>/audio/slots/`, `output/<timestamp>_<scene-slug>/audio/final/` |
| Immutable presentation evidence and selected slideshow | `output/<timestamp>_<scene-slug>/presentation/presentation.json`, `output/<timestamp>_<scene-slug>/presentation/final/` |
| Character outline sheets and provenance | `input/characters/<source-stem>--outline-sheet.png`, `input/characters/character-sketches.json` |
| Canonical location specs, per-view images, and provenance | `input/locations/locations-reference.json`, `input/locations/<key>--reference.png`, `input/locations/<key>--reference-{reverse,side}.png`, `input/locations/location-sketches.json` |

## Usage

```bash
bun autoshow comic draft-scenes <script-path> [--only structure|prompt|scene|panel-prompts] [--price]
bun autoshow comic generate-images <script-path> [--target images|sketches|both] [--panels <all|range|list>] [--panels-per-image <n>] [--no-qa] [--max-repairs <n>] [--force] [--price]
bun autoshow comic generate-audio <script-path> [--provider <provider[=model]>] [--sfx-provider <provider=model>] [--sfx-license-use noncommercial|commercial|unknown] [--soundscape-timing-policy strict|proportional] [--profile <key>] [--mode auto|native|segmented] [--role <label=role:key>] [--price]
bun autoshow comic generate-slideshow <script-path> [--audio-target <provider=model>] [--untimed-panel-ms <n>] [--fps <n>] [--price]
bun autoshow comic reference-sketch (--character <key> | --location <key> [--view establishing|reverse|side]) [--revise --notes <text>] [--price]
```

The `<script-path>` argument also accepts strict episode-scene shorthand: `01-01` resolves to the single Markdown file in `input/scripts/01-script/` whose filename starts with `01-`.

## Walkthrough: 01-opening

This walkthrough starts from:

```text
input/scripts/01-script/01-opening.md
```

The equivalent shorthand is `01-01`.

To run the complete script-to-page pipeline:

```bash
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --panels 1-16
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target sketches --panels 1-4
```

`draft-scenes` is required first because image, audio, and presentation generation consume the canonical scene run and reviewed artifacts. Final panel images land under the scene run directory (e.g. `output/<timestamp>_01-opening/panels/`), and grouped page images land in `pages/` when `--panels-per-image` is above one or `--grid` is used.

### 1. Create structured script JSON

```bash
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only structure
```

### 2. Build the scene-drafting prompt

```bash
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only prompt
```

### 3. Draft scene JSON

```bash
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only scene
```

This stage calls the selected text model. Use `--price` first for a side-effect-free cost estimate.

### 4. Create character and location references

Panel prompts require a registered canonical image for every visible character and a registered reference image for the scene location:

```bash
bun autoshow comic reference-sketch --character hero
bun autoshow comic reference-sketch --location cargo-bay
```

### 5. Build stable panel prompt bundles

```bash
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only panel-prompts
```

Review these prompt bundles before spending image-generation cost.

### 6. Generate review sketches

```bash
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target sketches
```

Panel prompt bundles from the previous step are detected automatically and reused. Rebuild them with `draft-scenes --only panel-prompts`; `--force` on `generate-images` only regenerates image outputs.

### 7. Generate final panel images

```bash
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images
```

To generate review sketches and final panel images in one run after panel prompt bundles exist, use:

```bash
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target both
```

## draft-scenes

`draft-scenes` processes script markdown through structured script JSON, draft prompt bundles, scene JSON panel objects, and stable panel prompt bundles.

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--only <stage>` | Run only `structure`, `prompt`, `scene`, or `panel-prompts` | none (runs all stages) |
| `--concurrency <n>` | Number of panels to build prompt bundles for in parallel during `panel-prompts` | `7` |
| `--concurrency-mode <ramp\|immediate>` | Approach hosted LLM work from one request per provider/account lane (`ramp`) or start at the configured cap (`immediate`) | `ramp` |
| `--price` | Estimate API-backed stages without making API calls | `false` |

### Advanced Options

| Flag | Description | Default |
|------|-------------|---------|
| `--llm-model <model>` | Use a supported text model from the central LLM registry | `gpt-5.6-sol` |

### Examples

```bash
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only structure
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only prompt
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only scene
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only panel-prompts
```

### Behavior

- The full run executes `structure`, `prompt`, `scene`, and `panel-prompts` in order.
- `--only structure` creates or reviews structured script JSON.
- `--only prompt` builds the scene-drafting prompt bundle without calling an API.
- `--only scene` drafts scene JSON from an existing prompt bundle.
- `--only panel-prompts` builds stable panel prompt bundles from existing scene JSON without calling an API.
- Scene drafting validates generated JSON before writing it. Structured scripts embed a content-addressed source identity and exact Unicode source spans. Invalid model output is saved as `scene.invalid.json` with validation details.
- Every panel has an exhaustive prose `shotPlan` covering camera, composition, exact blocking/acting/eyelines, props, balloon placement, and exclusions. Script-authored staging and exact cast/dialogue take precedence over inferred shot details. Permanent location topology remains canonical unless the script explicitly changes the set as a story event.
- `panel.characterKeys` is authoritative for visibility. Descriptions, speech text, and source segments never add visual references implicitly. Every script-required visible character belongs in the panel. Generation preflights the selected model's reference-image input capability.
- On-screen character speakers must be visible; offscreen character speakers must not be listed as visible.

## generate-images

`generate-images` turns reviewed panel prompt bundles into optional black-and-white review sketches and final comic panel images.

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--target <target>` | `images`, `sketches`, or `both` | `images` |
| `--panels <all\|range\|list>` | Panels to process: `all`, a range like `1-8`, a list like `1,3,7`, or mixed like `1-4,9`; overlong contiguous ranges clamp to available panels | `all` |
| `--concurrency <n>` | Number of image requests (across panels, pages, models, and variations) to run in parallel | `7` |
| `--concurrency-mode <ramp\|immediate>` | Approach hosted image and QA work from one request per provider/account lane (`ramp`) or start at the configured cap (`immediate`) | `ramp` |
| `-f, --force` | Regenerate image outputs only; never rewrite reviewed scene or prompt artifacts | `false` |
| `--qa` / `--no-qa` | Enable or disable strict final-image QA | enabled |
| `--qa-model <model>` | Vision judge model | `gpt-5.6-sol` |
| `--max-repairs <n>` | Maximum repair attempts after the initial image; stagnation may restart once or stop early | `2` |
| `--price` | Estimate image-generation costs without making API calls | `false` |

### Advanced Options

| Flag | Description | Default |
|------|-------------|---------|
| `--image-model <model[,model...]>` | Use one or more supported image models (see [Supported Models](#supported-models)) | `gpt-image-2` |
| `--variation <name[,name...]>` | Generate final images with one or more prompt variations: `canonical`, `animation-polish`, `cinematic-depth` | none |
| `--size <size>` | Image size such as `1536x1024`, `1024x1024`, `1024x1536`, or `auto` | `1536x1024` |
| `--quality <quality>` | `low`, `medium`, `high`, or `auto`; Gemini ignores this compatibility flag | `high` |
| `--panels-per-image <n>` | Number of ordered panels per generated image; values above one explicitly request grouped generation | final `1`; sketches `6` |
| `--grid <columns>x<rows>` | Compose generated individual final panels into local page grids, such as `2x3`; requires `--panels-per-image 1` and `--size 1536x1024` | none |

### Examples

```bash
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target sketches
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target both
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --panels 1-16
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --panels 1,3,7
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --panels 1-16 --panels-per-image 1 --grid 2x3
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target sketches --panels 5-8
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target sketches --panels-per-image 6 --quality high
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --image-model gpt-image-2
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --image-model gpt-image-2,gemini-3.1-flash-lite-image
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --variation animation-polish,cinematic-depth
```

### Behavior

- `generate-images` requires reviewed scene and panel bundles for new runs. `--force` affects images only.
- `--panels` selects which panels to process for any target (`images`, `sketches`, or `both`). Contiguous ranges extending past available panels clamp to the overlap (e.g. `--panels 9-16` on an 11-panel scene processes panels 9–11).
- Review sketch selections must be contiguous because each sketch output corresponds to one panel range; use `--target images` for non-contiguous final panel lists like `1,3,7`.
- Final images default to one panel per image; review sketches default to six panels per chunk. `--panels-per-image >1` enables grouped pages with identical QA and repair behavior.
- Required characters are sent as one canonical image per character ordered by first appearance, followed by distinct canonical location references ordered by first panel appearance. Each location includes its textual specification so generation preserves permanent architecture, fixed furniture, installed equipment, and recurring spatial relationships. Grouped sketches and pages include a prompt legend mapping each sub-panel to its location reference.
- `--grid <columns>x<rows>` generates individual final panel PNGs, then combines them locally into full-size white-backed page grids under `pages/`. For example, `--grid 2x3 --size 1536x1024` writes 3072x3072 page PNGs and leaves trailing cells blank on partial final pages.
- `--variation` outputs are grouped under `pages/<run-id>/<variation>/<model>/` or `panels/<run-id>/<variation>/<model>/` within the scene run directory.
- `--concurrency` sets the hard cap for independent image requests. In default `ramp` mode, each provider/account lane starts at one request and adds one slot every five seconds while demand is queued.
- Multi-model runs write model-specific filenames.
- Before provider dispatch, panel/page/sketch requests are validated against the central registry's reference-image limits. Required character references are never truncated; optional continuity images may be trimmed deterministically.
- Fixed furniture and architecture continuity covers presence and geometry: footprint, silhouette, connectedness, orientation, visible edge structure, and wall relationships survive camera changes.
- Strict QA runs initial generation, vision judgment via `--qa-model`, and up to `--max-repairs` repair attempts. The first repair edits the failed image. If the same hard check persists across two consecutive judgments, the next repair restarts fresh from canonical references instead of chaining edits. Canonical character images and catalog descriptions have highest visual precedence. Set continuity audits canonical anchors as correctly placed, outside crop, missing, relocated, duplicated, mirrored, or redesigned. Harmless typographical substitutions in speech do not fail QA. Attempts and judgments are preserved in attempt QA JSON, and only passing attempts are promoted.
- Named anchor assemblies are audited component by component; a visible desk or console does not excuse omission of its named computer, keyboard, or control unit.
- `--price` makes no provider calls or writes, reporting estimated initial and maximum repair calls.

## generate-audio

`generate-audio` consumes an existing compatible scene run and approved current voice registrations. It never creates, clones, approves, or deletes voices during synthesis.

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--provider <provider[=model]>` | Select a TTS provider/model; repeatable | cheapest hosted |
| `--sfx-provider <provider=model>` | Select the dedicated authored sound-effect target; accepts `elevenlabs=eleven_text_to_sound_v2`, `replicate=sepal/audiogen@<pinned-version>`, or `stability=stable-audio-3` | none |
| `--sfx-license-use <classification>` | Declare intended use for license-restricted SFX targets: `noncommercial`, `commercial`, or `unknown`; required for AudioGen and never inferred from model selection | none |
| `--sfx-concurrency <count>` | Bound parallel sound-effect requests independently from dialogue generation | `2` |
| `--concurrency-mode <ramp\|immediate>` | Approach hosted dialogue and sound-effect caps from one request per provider/account lane (`ramp`) or start at the configured caps (`immediate`) | `ramp` |
| `--soundscape-timing-policy <policy>` | Resolve inline text offsets with exact evidence (`strict`) or recorded canonical-offset interpolation (`proportional`) | `strict` |
| `--all-providers` | Select every hosted TTS target | `false` |
| `--profile <key>` | Select the approved registration profile for every subject/target | `default` |
| `--mode <mode>` | `auto`, strict `native`, or `segmented` | `auto` |
| `--delivery-policy <policy>` | `strict` rejects unsupported authored delivery; `best-effort` records unsupported intent and continues | `strict` |
| `--pacing-profile <profile>` | `none` or deterministic `loose-comedy` authored-pause/interturn pacing | `none` |
| `--max-generation-slots <count>` | Admit at most this many unresolved segmented-render slots, persist a resumable checkpoint, and exit without publishing a final WAV | none |
| `--allow-ambiguous-redispatch` | Explicitly authorize bounded in-process retries and later repurchase of an unresolved slot whose provider admission cannot be reconciled to retained audio | `false` |
| `--role <label=subject>` | Resolve an uncatalogued or compound label to `role:key` or `voice:key`; repeatable | none |
| `--price` | Plan source identity, casting, strategy, generation slots, and cost without calls or writes | `false` |

### Examples

```bash
bun autoshow comic generate-audio 01-01 --provider gemini=gemini-3.1-flash-tts-preview --profile default
bun autoshow comic generate-audio 01-01 --provider mistral=voxtral-mini-tts-2603 --mode segmented
bun autoshow comic generate-audio 01-01 --provider minimax=speech-2.8-hd --mode segmented
bun autoshow comic generate-audio 01-01 --provider cartesia=sonic-3.5-2026-05-04 --mode auto
bun autoshow comic generate-audio 01-01 --provider speechify=simba-3.2 --mode auto
bun autoshow comic generate-audio 07-04 --provider hume=octave-1 --provider hume=octave-2 --provider elevenlabs=eleven_v3 --profile ep07-comparison --mode segmented --delivery-policy best-effort --pacing-profile loose-comedy
bun autoshow comic generate-audio 01-01 --provider gemini --role "SHIP COMPUTER=role:computer"
bun autoshow comic generate-audio 01-01 --all-providers --price
```

### Behavior

- With `--output-dir`, the command validates that exact existing directory. Without it, the command scans matching timestamped scene directories newest-first and finds an exact source-path, source-byte, manifest, structured-script, and checksum match.
- Every speakable source segment becomes one provider-neutral dialogue node. Inline authored timing is retained as a turn cue. The `loose-comedy` profile maps `beat`, `pause`/`moment`, and `long`/`heavy` cues to deterministic silences and adds a short interturn gap, recorded in the mix ledger and final timeline. Compound speech remains an explicit overlap unless `--role` casts the label to one subject.
- Casting is all-target and profile-qualified. Every speaking subject must have one approved registration for each selected provider/model/profile in an aggregate immutable scene snapshot. Once created, corrective invocations may select any contained subset of targets without recasting.
- The shared TTS subsystem manages provider readiness, plans, generation slots, admission evidence, render results, audio runs, timing, mix/transform ledgers, final timelines, and resume safety. Comic writes provider projections under `comicAudio`.
- `--max-generation-slots` sets an execution limit for segmented renders, selecting unresolved slots in plan order, forcing sequential dispatch, writing slot evidence, and leaving the run resumable without publishing `audio/final/`.
- `--price` is resume-aware and read-only. It validates retained render evidence, subtracts promoted slots from the estimate, and prices only unresolved work. When all slots are retained, it reports zero spend with local finalization.
- Provider-admitted or ambiguous work without valid retained audio is blocked from automatic repurchase. `--allow-ambiguous-redispatch` explicitly authorizes duplicate spend for bounded in-process retries and checkpoint resume. DeepInfra permits up to eight attempts per slot with exponential backoff.
- Failed synthesis runs report a recovery checkpoint with retained, unresolved, and blocked slots. Rerunning resumes using verified completed segments.
- Provider capabilities: Gemini native dialogue supports exactly two distinct speakers. ElevenLabs `eleven_v3` uses turn-safe Text-to-Dialogue with recognized model audio tags. Hume `octave-1` accepts authored delivery as prompt descriptions; Hume `octave-2` uses ordered native utterances with per-turn speed/silence controls (`--delivery-policy best-effort` records unsupported direction). MiniMax, Cartesia, and Speechify use segmented rendering in `auto` mode. Mistral consumes approved saved voices or protected request-reference registrations.
- Cartesia and Speechify approved voices participate through the same provider-qualified snapshot via `voice` / `comic reference-voice`. `generate-audio` does not invoke clone or design actions during synthesis.
- Authored overlap nodes and local voice-effect filters (radio/intercom/telephone/computer) force segmented rendering and are recorded in the mix ledger and timeline.
- Authored `**SFX:**`, `**VOCAL SFX:**`, `**AMBIENCE:**`, `[[SFX: ...]]`, and `[[VOCAL SFX: ...]]` directives populate the soundscape plan. Directives are required unless prefixed with `OPTIONAL`; optional `{duration: 2.5s, gain: -3dB, pan: -0.4}` envelopes specify synthesis duration and mix parameters.
- Inline text offsets default to strict timing. `--soundscape-timing-policy proportional` maps offsets across turn ranges and records its algorithm and error bound.
- Scenes with zero speakable turns complete locally with an empty dialogue plan.
- Final mastering produces a 48 kHz stereo 24-bit PCM WAV.
- On success, dialogue compact writes `audio/<target-key>/render.json`, `audio/<target-key>/timeline.json`, and `audio/slots/<slotHash>.wav`, then hardlinks `audio/final/<target-key>.wav`.

## generate-slideshow

`generate-slideshow` synchronizes canonical panel PNGs with one complete selected dialogue or soundscape run and renders the result locally. It does not resume audio generation or call an image, video, TTS, or sound-effect provider.

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--audio-target <provider=model>` | Select an exact complete canonical audio target when automatic selection is ambiguous | inferred |
| `--untimed-panel-ms <n>` | Hold duration for a panel with no dialogue or discrete effect | `2000` |
| `--fps <n>` | Constant output frame rate from 1 through 120 | `30` |
| `--price` | Report the local render cost and exit without writes | `false` |

### Examples

```bash
bun autoshow comic generate-slideshow 01-01
bun autoshow comic generate-slideshow 01-01 --audio-target elevenlabs=eleven_v3
bun autoshow comic generate-slideshow 01-01 --untimed-panel-ms 2500 --fps 24
bun autoshow comic generate-slideshow 01-01 --price
```

### Behavior

- Automatic selection prefers one complete soundscape run, then falls back to one complete dialogue run. Multiple eligible runs require `--audio-target provider=model`.
- Every reviewed panel must exist as `panels/panel-NN.png` in the current run or deterministic exact-script sibling. Sibling visuals are verified and copied into an immutable `presentation/inputs/` bundle inside the audio run. Panels must share identical even dimensions.
- Dialogue ownership uses exact source-segment ID, speaker, and speech text evidence. Exact parenthetical cues classified as delivery/timing may be elided when preserved in cue evidence.
- Inline sound effects follow their dialogue panel; block effects follow the panel owning the nearest preceding authored action or panel note. Missing or ambiguous ownership fails.
- Dialogue and effects within one panel preserve relative timing and overlap. Audio across panels is serialized in reviewed order. Untimed panels receive the configured hold duration (`--untimed-panel-ms`).
- Ambience loops continuously; dialogue-only runs use digital silence as the continuous bed. Presentation audio is derived from retained ranges and does not mutate source audio runs.
- FFmpeg renders same-size hard-cut stills as H.264/yuv420p video with AAC audio and fast-start metadata without motion or resize filters.
- On success, presentation compact writes `presentation/presentation.json` and hardlinks `presentation/final/slideshow.wav` and `presentation/final/slideshow.mp4`, cleaning up temporary working files.
- `comic generate-audio --slideshow` validates reviewed panels, dialogue ownership, and FFmpeg H.264 encoder availability before TTS dispatch.
- `--price` reports `$0.00` without writes.

## reference-sketch

`reference-sketch --character` manages 3-view character outline sheets. `reference-sketch --location` targets a single camera view: `establishing` by default, or `--view reverse|side`. The first establishing run scans matching scripts and asks the configured text model (`gpt-5.6-sol` by default) for stable location facts; reverse and side require an existing establishing view. Successful views are promoted and atomically registered. Existing targets no-op unless `--revise --notes` is supplied.

Location `--price` preflight estimates initial and repair calls matching generation flags. Validated existing views report zero provider calls.

### Character sheets

`reference-sketch --character` generates an immutable three-view version and automatically composes its reference sheet.

For a new prose-defined character with no source image, set `image` and `outlineSheet` to the same missing canonical destination, point `generationReference` at an existing style image under the character root, and provide rendering rules in `generationInstructions`.

#### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--character <key>` | Catalog character key (mutually exclusive with `--location`) | required (or `--location`) |
| `--location <key>` | Canonical location key (mutually exclusive with `--character`) | required (or `--character`) |
| `--view <view>` | Location camera view: `establishing`, `reverse`, or `side` | `establishing` |
| `-r, --revise` | Revise existing sketches using the source image and existing sketch refs | `false` |
| `--notes <text>` | Revision instructions; required with `--revise` | none |
| `--concurrency <n>` | Number of sketch views to generate in parallel | `7` |
| `--concurrency-mode <ramp\|immediate>` | Approach hosted LLM, image, and QA work from one request per provider/account lane (`ramp`) or start at the configured cap (`immediate`) | `ramp` |
| `--price` | Estimate image-generation costs without making API calls | `false` |

#### Advanced Options

| Flag | Description | Default |
|------|-------------|---------|
| `--image-model <model>` | Use exactly one supported image model (see [Supported Models](#supported-models)) | `gpt-image-2` |
| `--size <size>` | Image size such as `1024x1536`, `1024x1024`, `1536x1024`, or `auto` | `1024x1536` |
| `--quality <quality>` | `low`, `medium`, `high`, or `auto`; Gemini ignores this compatibility flag | `medium` |

#### Examples

```bash
bun autoshow comic reference-sketch --character hero
bun autoshow comic reference-sketch --character sidekick --price
bun autoshow comic reference-sketch --character hero --revise --notes "Correct the eye shape"
```

#### Behavior

- The three generated views and composed sheet remain in temporary storage until all views succeed; only the flat catalog `outlineSheet` is persisted.
- Fresh generation replaces the registered reference by default. Revision never falls back to fresh generation.
- The sheet and its entry in `character-sketches.json` are promoted together with rollback protection. Source and sheet SHA-256 checksums detect stale or tampered registrations.
- Default generation parameters are `gpt-image-2`, `1024x1536`, `medium`.
- After updating character sketch references, rerun `draft-scenes --only panel-prompts` for affected scenes to stage the new references.

## Output

Each invocation resolves a timestamped run directory under `output/` following the `YYYY-MM-DD_HH-MM-SS-mmm_<slug>` convention:

```text
output/<YYYY-MM-DD_HH-MM-SS-mmm>_01-opening/
  metadata/
    structured-script.json
    draft-prompt.md
    scene.json
    scene.invalid.json               # only when validation preserves invalid model output
    panel-prompts/
      source-coverage.json
      panel-NN/<bundle>.md
  assets/
    character-references.json
    character-references/<snapshot-id>/<key>/
    location-references.json
    location-references/<snapshot-id>/
    design-references.json           # only when reviewed panels declare designReferences
    design-references/<snapshot-id>/
    voice-references/<snapshot-id>/
  audio/
    slots/<slot-hash>.wav
    <target-key>/
      render.json
      timeline.json
    sound-effects/
      sfx.json
      sources/<request-identity>.audio
    soundscape/<mix-id>/
      mix.json
      master.wav
      stems/
    final/<target-key>.wav
    final/<target-key>.soundscape.wav
  presentation/
    presentation.json
    inputs/<visual-bundle-id>/
      reviewed-scene.json
      panels/panel-NN.png
    final/slideshow.wav
    final/slideshow.mp4
  panels/
  pages/
  sketches/
input/characters/
  characters-reference.json
  character-sketches.json
  <source-stem>--outline-sheet.png
input/locations/
  locations-reference.json
  location-sketches.json
  <key>--reference.png
  <key>--reference-reverse.png       # optional
  <key>--reference-side.png          # optional
```

Resume and pinning:

- Later stages (e.g. `generate-images` after `draft-scenes`, or `draft-scenes --only prompt|scene|panel-prompts`) automatically resume the **latest** existing run directory for the scene.
- A full `draft-scenes` run or `--only structure` starts a **fresh** run directory. `generate-images` resumes only a run that already contains `metadata/scene.json`.
- Pass global `--output-dir <path>` to pin an explicit run directory for both reading and writing.

### Run-level character, location, and design snapshots

`draft-scenes --only panel-prompts` validates visible character keys against registered canonical references in `character-sketches.json`. Physical reference files are copied into `assets/character-references/<snapshot-id>/<key>/`, recording checksums and generation IDs in `assets/character-references.json`. Panel bundles reference the snapshot ID and keys.

The same stage snapshots each distinct panel location once. Registered views are composed horizontally into `assets/location-references/<snapshot-id>/<key>--reference-sheet.png` (or copied directly for single-view locations). Checksums and metadata are recorded in `assets/location-references.json`.

Reviewed panels may optionally declare `designReferences` entries with `key`, `sourcePath` (below `input/`), and a `usage` description. The panel-prompt stage validates mappings, copies each distinct design into `assets/design-references/<snapshot-id>/`, and records `assets/design-references.json`. Generation, repair restarts, grouped pages, sketches, and QA receive design references following character and location references.

## Supported Models

### Image Models

`--image-model` accepts any model ID from the central image registry (`src/cli/commands/setup-and-utilities/models/image-config.json`). Comic routes generation through shared image dispatch across all registered providers (OpenAI, Google Gemini, xAI Grok, BFL, Recraft, Replicate, Luma Labs, fal.ai).

The default is `gpt-image-2`. Common choices:

| Model | Provider | Notes |
|-------|----------|-------|
| `gpt-image-2` | OpenAI | Default. Honors `--size` and `--quality`, including custom `WIDTHxHEIGHT` dimensions. |
| `gemini-3.1-flash-lite-image` | Google | Low-latency Gemini native image generation at 1K. |
| `gemini-3.1-flash-image` | Google | Gemini native image generation at 1K, 2K, or 4K with optional Search grounding. |
| `gemini-3-pro-image` | Google | Highest-quality Gemini native image generation at 1K, 2K, or 4K with optional Search grounding. |

Pass multiple models with `--image-model` to generate each panel with every model for comparison:

```bash
--image-model gpt-image-2,gemini-3.1-flash-lite-image
```

### Text Models (LLM)

`--llm-model` accepts any model ID from the central LLM registry (`src/cli/commands/setup-and-utilities/models/llm-config.json`). Comic routes generation through shared LLM dispatch across registered hosted providers (OpenAI, Groq, Google Gemini, Anthropic, MiniMax, xAI Grok, Z.AI GLM, Moonshot Kimi, Together, Cerebras).

The default is `gpt-5.6-sol`. Common choices:

| Model | Provider | Notes |
|-------|----------|-------|
| `gpt-5.6-sol` | OpenAI | Default. Flagship GPT-5.6 tier used for scene drafting and panel prompts. |
| `gpt-5.6-terra` | OpenAI | Balanced GPT-5.6 tier. |
| `gpt-5.6-luna` | OpenAI | Efficient GPT-5.6 tier. |
| `gpt-5.5` | OpenAI | High-capability flagship model with standard and long-context pricing bands. |
| `gpt-5.4-mini` | OpenAI | Fast and affordable text model. |
| `gpt-5.4-nano` | OpenAI | Smallest and fastest OpenAI model. |
| `gemini-3.1-pro-preview` | Google | High-intelligence Gemini pro tier text model. |
| `gemini-3.6-flash` | Google | Balanced Gemini text model. |
| `gemini-3.5-flash-lite` | Google | High-throughput low-cost Gemini text model. |
| `claude-opus-5` | Anthropic | Opus-tier Claude model with thinking enabled by default. |
| `kimi-k3` | Moonshot | Flagship Kimi text model with 1M context and reasoning. |
| `grok-4.3` | xAI | Grok structured text model with 200K context. |
| `grok-4.5` | xAI | Grok structured text model with 500K context. |

## Notes

- Generation commands (`draft-scenes`, `generate-images`, `generate-audio`, `reference-sketch`) call provider APIs resolved through central registries.
- Use `--price` to estimate costs without invoking provider APIs or mutating files.
- `draft-scenes --only prompt` and `draft-scenes --only panel-prompts` are local prompt-assembly stages and do not make provider calls.
