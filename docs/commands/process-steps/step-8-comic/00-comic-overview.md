# comic

Draft comic scenes from episode scripts, generate panel and page images, manage character voices, render multi-speaker scene audio, and synchronize panels into a local still-image MP4.

## Outline

- [Overview](#overview)
- [Setup](#setup)
- [Runtime Paths](#runtime-paths)
- [Usage](#usage)
- [Walkthrough: 01-opening](#walkthrough-01-opening)
- [Output](#output)
- [Supported Models](#supported-models)
- [Command Docs](#command-docs)

## Overview

`comic` is a staged pipeline. Run the public subcommands in this order:

1. Start from episode script Markdown under `input/scripts/` and [draft the scene](./01-draft-scenes.md): structured script JSON, draft prompt, scene JSON, then panel prompt bundles.
2. Create reusable [character and location reference images](./02-reference-sketch.md) before panel prompts consume them.
3. [Generate review sketches and final panel images](./03-generate-images.md).
4. Register and approve [character voices](./04-reference-voice.md).
5. [Render multi-speaker scene audio](./05-generate-audio.md).
6. [Synchronize panels into a slideshow](./06-generate-slideshow.md).

## Setup

Set API keys for the text, image, and speech providers you select. The defaults need:

```bash
OPENAI_API_KEY=...
GEMINI_API_KEY=...
XAI_API_KEY=...
```

Other image providers (BFL, Replicate, Luma Labs) and TTS or sound-effect providers need their own keys. See [Supported Models](#supported-models), [TTS](../step-4-tts/text-to-speech-and-voice.md), and [voice](../step-9-voice/00-voice-overview.md).

`--price` estimates cost without provider calls or writes. `draft-scenes --only prompt` and `draft-scenes --only panel-prompts` are local and make no provider calls.

### Character and Location Catalogs

`draft-scenes` and `reference-sketch` require `input/characters/characters-reference.json`, or the same file under `--characters-root`. The catalog names each character and points to its reference images. Run `reference-sketch` before panel-prompt creation and after revising a character.

Location configuration lives in `input/locations/locations-reference.json`. Set `styleImage` to a project image whose visual language should guide new location views. If the location catalog does not exist, comic creates it using the first character catalog image as the style reference.

## Runtime Paths

- Episode scripts: `input/scripts/NN-script/*.md`
- Character catalog and outline sheets: `input/characters/`
- Location catalog and reference views: `input/locations/`
- Scene run (prompts, scene JSON, panels, pages, sketches, audio, slideshow): `output/<YYYY-MM-DD_HH-MM-SS-mmm>_<scene-slug>/`

## Usage

```bash
bun autoshow comic draft-scenes <script-path> [--only structure|prompt|scene|panel-prompts] [--price]
bun autoshow comic reference-sketch (--character <key> | --location <key> [--view establishing|reverse|side]) [--revise --notes <text>] [--price]
bun autoshow comic generate-images <script-path> [--target images|sketches|both] [--panels <all|range|list>] [--price]
bun autoshow comic reference-voice <subcommand> [flags]
bun autoshow comic generate-audio <script-path> [--provider <provider[=model]>] [--price]
bun autoshow comic generate-slideshow <script-path> [--audio-target <provider=model>] [--price]
```

`<script-path>` also accepts episode-scene shorthand: `01-01` resolves to the single Markdown file in `input/scripts/01-script/` whose filename starts with `01-`.

## Walkthrough: 01-opening

This walkthrough starts from `input/scripts/01-script/01-opening.md` (`01-01`). Later stages consume the scene run from `draft-scenes`.

### 1. Draft the scene in stages

Review each stage before spending generation cost:

```bash
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only structure
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only prompt
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only scene --price
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only scene
```

### 2. Create character and location references

Panel prompts require a registered reference image for every visible character and for the scene location:

```bash
bun autoshow comic reference-sketch --character hero
bun autoshow comic reference-sketch --location cargo-bay
```

### 3. Build and review panel prompt bundles

```bash
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only panel-prompts
```

Review these bundles before spending image-generation cost. Rebuild them after updating character or location sketches.

### 4. Generate review sketches, then final panel images

```bash
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target sketches
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images
```

Panel prompt bundles from the previous step are reused automatically. Rebuild them with `draft-scenes --only panel-prompts`; `--force` on `generate-images` only regenerates image outputs.

To generate sketches and final images in one run after bundles exist:

```bash
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target both
```

Final panel images land under `output/<timestamp>_01-opening/panels/`.

### 5. Register voices, render audio, and build the slideshow

After images exist, register [character voices](./04-reference-voice.md), [render scene audio](./05-generate-audio.md), then [build the slideshow](./06-generate-slideshow.md):

```bash
bun autoshow comic generate-audio input/scripts/01-script/01-opening.md
bun autoshow comic generate-slideshow input/scripts/01-script/01-opening.md
```

## Output

Each invocation resolves a timestamped run directory under `output/` following the `YYYY-MM-DD_HH-MM-SS-mmm_<slug>` convention:

```text
output/<YYYY-MM-DD_HH-MM-SS-mmm>_01-opening/
  metadata/
    structured-script.json
    draft-prompt.md
    scene.json
    panel-prompts/
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

Later stages resume the latest existing run directory for the scene. A full `draft-scenes` run or `--only structure` starts a fresh run directory. `generate-images` resumes only a run that already contains `metadata/scene.json`. Pass global `--output-dir <path>` to pin an explicit run directory.

`draft-scenes --only panel-prompts` copies registered character and location references into `assets/`.

## Supported Models

### Image Models

`--image-model` accepts OpenAI, Google Gemini, xAI Grok, BFL, Replicate, and Luma Labs model IDs. fal.ai image models are not available on comic. The default is `gpt-image-2`. See [`image`](../step-5-image/text-to-image.md) for the full catalog.

| Model                         | Provider |
| ----------------------------- | -------- |
| `gpt-image-2`                 | OpenAI   |
| `gemini-3.1-flash-lite-image` | Google   |
| `gemini-3.1-flash-image`      | Google   |
| `gemini-3-pro-image`          | Google   |

Pass multiple models with `--image-model` to generate each panel with every model for comparison:

```bash
--image-model gpt-image-2,gemini-3.1-flash-lite-image
```

### Text Models (LLM)

`--llm-model` accepts the same hosted text model IDs as [`write`](../step-3-write/write-text.md). The default is `gpt-5.6-sol` for scene drafting.

## Command Docs

- [draft-scenes](./01-draft-scenes.md)
- [reference-sketch](./02-reference-sketch.md)
- [generate-images](./03-generate-images.md)
- [reference-voice](./04-reference-voice.md)
- [generate-audio](./05-generate-audio.md)
- [generate-slideshow](./06-generate-slideshow.md)
