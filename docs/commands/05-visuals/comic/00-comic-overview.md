# comic

Draft comic scenes from episode scripts, generate panel and page images, publish a review sheet, render multi-speaker scene audio, and synchronize panels into a local still-image MP4. Manage character voices with [`voice`](../../04-audio/voice/00-voice-overview.md).

## Outline

- [Overview](#overview)
- [Setup](#setup)
- [Runtime Paths](#runtime-paths)
- [Usage](#usage)
- [Walkthrough: 01-sentient-agenda](#walkthrough-01-sentient-agenda)
- [Output](#output)
- [Supported Models](#supported-models)
- [Command Docs](#command-docs)
- [Deprecated Aliases](#deprecated-aliases)

## Overview

`comic` is a staged pipeline. A prose treatment can enter it through [`draft-treatment`](./07-draft-treatment.md), which writes the episode script and bootstraps catalog entries before step 1. Run the public subcommands in this order:

1. Start from episode script Markdown under `input/scripts/` and [draft the scene](./01-draft-scenes.md) through the `structure`, `prompt`, `blocking`, `scene`, and `panel-prompts` stages.
2. Create reusable [character and location reference images](./02-reference-sketch.md) before panel prompts consume them.
3. [Generate review sketches and final panel images](./03-generate-images.md).
4. Publish the panel-by-panel [review sheet](./06-review.md#review-sheet) with `review`, then turn a reviewer's Markdown into a structured change plan with [`review --notes`](./06-review.md#notes-processing).
5. Register and approve [character voices](../../04-audio/voice/00-voice-overview.md).
6. [Render multi-speaker scene audio](./04-generate-audio.md).
7. [Synchronize panels into a slideshow](./05-generate-slideshow.md).

## Setup

Set API keys for the text, image, and speech providers you select. The defaults need:

```bash
OPENAI_API_KEY=...
GEMINI_API_KEY=...
XAI_API_KEY=...
```

Other image providers (BFL, Replicate, Luma Labs) and TTS or sound-effect providers need their own keys. See [Supported Models](#supported-models), [TTS](../../04-audio/tts/overview.md), and [voice](../../04-audio/voice/00-voice-overview.md).

Where supported, `--price` estimates cost without provider calls or writes. Prompt writing, panel-prompt assembly, blocking import and rebind, directive reconcile, and both `review` modes are local. `review` has no `--price` option.

### Character and Location Catalogs

`draft-scenes` and `reference-sketch` require `input/characters/characters-reference.json`, or the same file under `--characters-root`. The catalog names each character and points to its reference images. Run `reference-sketch` before panel-prompt creation and after revising a character.

Location configuration lives in `input/locations/locations-reference.json`. Set `styleImage` to a project image whose visual language should guide new location views. If the location catalog does not exist, comic creates it using the first character catalog image as the style reference.

Stages that load the character catalog fail when a character has neither its source image nor its `generationReference` image on disk. Keep every style seed named by a `generationReference` under `input/characters/` before running those stages, including `draft-scenes --only structure`.

## Runtime Paths

- Episode scripts: `input/scripts/NN-script/*.md`
- Prose treatments: any `.md`, `.txt`, or `.pdf` file
- Treatment run: `output/<YYYY-MM-DD_HH-MM-SS-mmm>_<slug>-treatment/`
- Character catalog: `input/characters/`
- Location catalog: `input/locations/`
- Optional location floor plans: `input/locations/location-plans.json` and `input/locations/plans/`
- Scene run: `output/<YYYY-MM-DD_HH-MM-SS-mmm>_<scene-slug>/`
- Optional blooper copies (`generate-images --bloopers`): `<output-root>/bloopers/`

## Usage

```bash
bun autoshow comic draft-treatment <treatment-path> [flags]
bun autoshow comic draft-scenes <script-path> [--only structure|prompt|blocking|scene|panel-prompts] [--no-blocking] [--blocking-plan <path>] [--rebind] [--reconcile-from-directives] [--price]
bun autoshow comic reference-sketch (--character <key> | --location <key>) [flags]
bun autoshow comic generate-images <script-path> [--target images|sketches|both] [--price]
bun autoshow voice <subcommand> [flags]
bun autoshow comic generate-audio <script-path> [--provider <provider[=model]>] [--price]
bun autoshow comic generate-slideshow <script-path> [--audio-target <provider=model>] [--price]
bun autoshow comic review <script-path> [--export-doc | --notes <path>]
```

`<script-path>` also accepts episode-scene shorthand: `01-01` resolves to the single Markdown file in `input/scripts/01-script/` whose filename starts with `01-`. `draft-treatment` writes its script as `input/scripts/<episode>-script/<scene>-<slug>.md`, so a treatment drafted with `--episode 02` is addressed as `02-01` afterwards.

## Walkthrough: 01-sentient-agenda

This walkthrough starts from `input/scripts/01-script/01-sentient-agenda.md` (`01-01`). Later stages consume the scene run from `draft-scenes`.

### 1. Draft the scene in stages

Review each stage before spending generation cost:

```bash
bun autoshow comic draft-scenes 01-01 --only structure
bun autoshow comic draft-scenes 01-01 --only prompt
bun autoshow comic draft-scenes 01-01 --only blocking --price
bun autoshow comic draft-scenes 01-01 --only blocking
bun autoshow comic draft-scenes 01-01 --only scene --price
bun autoshow comic draft-scenes 01-01 --only scene
```

The `blocking` stage writes `metadata/blocking-plan.json`. Review the plan before drafting the scene, skip the stage with `--no-blocking`, or import a hand-authored plan with `--only blocking --blocking-plan <path>`.

### 2. Create character and location references

Panel prompts require a registered reference image for every visible character and for the scene location:

```bash
bun autoshow comic reference-sketch --character ada
bun autoshow comic reference-sketch --location melting-broadcast-studio
```

### 3. Build and review panel prompt bundles

```bash
bun autoshow comic draft-scenes 01-01 --only panel-prompts
```

Review these bundles before spending image-generation cost. Rebuild them after updating character or location sketches.

### 4. Generate review sketches, then final panel images

```bash
bun autoshow comic generate-images 01-01 --target sketches
bun autoshow comic generate-images 01-01 --target images
```

Panel prompt bundles from the previous step are reused automatically. Rebuild them with `draft-scenes --only panel-prompts`; `--force` on `generate-images` only regenerates image outputs. After bundles exist, `--target both` generates sketches and final images in one run.

Final panel images land under `output/<timestamp>_01-sentient-agenda/panels/`.

### 5. Publish the review sheet and apply reviewer notes

```bash
bun autoshow comic review 01-01 --export-doc
bun autoshow comic review 01-01 --notes notes/01-sentient-agenda-review.md
bun autoshow comic draft-scenes 01-01 --reconcile-from-directives
```

`review` writes `metadata/review/review-sheet.html`. `review --notes` turns the reviewer's Markdown into a change plan, and `--reconcile-from-directives` applies the script's own `**CAMERA:**`, `**BREAK-180:**`, `**COSTUME:**`, and `**EXTRAS:**` directives without an LLM call. None of the three calls a provider.

### 6. Register voices, render audio, and build the slideshow

After images exist, register [character voices](../../04-audio/voice/00-voice-overview.md), [render scene audio](./04-generate-audio.md), then [build the slideshow](./05-generate-slideshow.md):

```bash
bun autoshow comic generate-audio 01-01
bun autoshow comic generate-slideshow 01-01
```

## Output

Each invocation resolves a timestamped run directory under `output/` following the `YYYY-MM-DD_HH-MM-SS-mmm_<slug>` convention:

```text
output/<YYYY-MM-DD_HH-MM-SS-mmm>_01-sentient-agenda/
  metadata/
    structured-script.json
    structured-script.previous.json
    draft-prompt.md
    blocking-prompt.md
    blocking-plan.json
    blocking-bindings.json
    blocking/
    scene.json
    review/
    panel-prompts/
  qa/
  assets/
    character-references.json
    location-references.json
    voice-references/
  audio/
    <target-key>/render.json
    final/<target-key>.wav
  presentation/
    presentation.json
    final/slideshow.mp4
  panels/
  pages/
  sketches/
input/scripts/
  <episode>-script/<scene>-<slug>.md
input/characters/
  characters-reference.json
  character-sketches.json
  <source-stem>--outline-sheet.png
input/locations/
  locations-reference.json
  location-sketches.json
  location-plans.json
  plans/
  <key>--reference.png
  <key>--reference-reverse.png
  <key>--reference-side.png
```

Treatment runs write under `output/<timestamp>_<slug>-treatment/`; see [draft-treatment](./07-draft-treatment.md#artifacts). `generate-images --bloopers` copies non-promoted attempts to `<output-root>/bloopers/<episode>/<scene-slug>/`. Nothing under that blooper root is canonical.

Later stages resume the latest existing run directory for the scene. A full `draft-scenes` run or `--only structure` starts a fresh run directory. `generate-images` resumes only a run that already contains `metadata/scene.json`. Pass global `--output-dir <path>` to pin an explicit run directory.

For an interrupted recorded request, use [`resume <run-directory> --price` followed by `resume <run-directory>`](../../00-setup-and-utilities/resume.md#comic-recovery).

## Supported Models

### Image Models

`--image-model` accepts OpenAI, Google Gemini, xAI Grok, BFL, Replicate, and Luma Labs model IDs. fal.ai image models are not available on comic. The default is `gpt-image-2`. See [`image`](../image/overview.md) for the full catalog.

Pass multiple models with `--image-model` to generate each panel with every model for comparison:

```bash
--image-model gpt-image-2,gemini-3.1-flash-lite-image
```

### Text Models (LLM)

`--llm-model` accepts the same hosted text model IDs as [`write`](../../03-write/overview.md). The default is `gpt-5.6-sol` for scene drafting.

## Command Docs

- [draft-treatment](./07-draft-treatment.md)
- [draft-scenes](./01-draft-scenes.md)
- [reference-sketch](./02-reference-sketch.md)
- [generate-images](./03-generate-images.md)
- [generate-audio](./04-generate-audio.md)
- [generate-slideshow](./05-generate-slideshow.md)
- [review](./06-review.md)

## Deprecated Aliases

These spellings remain callable for one compatibility release and emit deprecation notices. Use the canonical invocations in new scripts.

| Deprecated invocation | Canonical invocation |
| --- | --- |
| `comic reference-voice` | `voice list` |
| `comic reference-voice <action> ...` | `voice <action> ...` |
| `comic review-sheet <script> [--export-doc]` | `comic review <script> [--export-doc]` |
| `comic review-notes <script> --notes <path>` | `comic review <script> --notes <path>` |
