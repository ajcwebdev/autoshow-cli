# comic

Draft comic scene JSON with shot plans, build reviewed panel prompt bundles, generate QA-approved panel and page images, manage approved character voices, render multi-speaker scene audio, and synchronize canonical panels into a local still-image MP4.

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

- `OPENAI_API_KEY` is required for OpenAI text and image models.
- `GEMINI_API_KEY` is required for Gemini text and image models.
- `XAI_API_KEY` is required for Grok text and image models.
- Other image providers (BFL, Replicate, Luma Labs) and TTS or sound-effect providers need their own keys. See [Supported Models](#supported-models), [TTS](../step-4-tts/text-to-speech-and-voice.md), and [voice](../step-9-voice/00-voice-overview.md).
- `--price` estimates cost without provider calls or writes. `draft-scenes --only prompt` and `draft-scenes --only panel-prompts` are local assembly stages and make no provider calls.

Hosted generation defaults to `--concurrency-mode ramp`. Use `--concurrency-mode immediate` to start at the command's concurrency cap.

### Character and Location Catalogs

`draft-scenes` and `reference-sketch` require `input/characters/characters-reference.json`, or the equivalent file under `--characters-root`. The catalog lists character keys, relative `image` and `outlineSheet` paths, aliases, optional group aliases, and optional `sceneTextRules` (`required` or `forbidden` patterns). Scene drafting validates panels against catalog descriptions and rules. A character with one canonical reference image sets `image` and `outlineSheet` to the same relative path. A prose-defined character may declare an existing root-relative `generationReference` and optional `generationInstructions`.

Character paths must stay within the character root and use PNG/WebP/JPG/JPEG files. Canonical source images must exist when the catalog loads, except when bootstrap generation creates a new character using `generationReference`. Run `reference-sketch` before panel-prompt creation and after revising a character.

Location configuration lives in `input/locations/locations-reference.json`. Set `styleImage` to any project image whose visual language should guide new location views. A location entry may set a root-relative `referenceDirectory`, an establishing `referenceFilename` ending in `--reference.png`, or both. Reverse and side filenames use `-reverse` or `-side` before `.png`. When the location catalog does not exist, comic commands initialize it using the first character catalog image as the style reference.

## Runtime Paths

- Episode scripts: `input/scripts/NN-script/*.md`
- Character catalog, outline sheets, and sketch provenance: `input/characters/`
- Location catalog, reference views, and sketch provenance: `input/locations/`
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

Per-command flags are in the [command docs](#command-docs).

## Walkthrough: 01-opening

This walkthrough starts from `input/scripts/01-script/01-opening.md`. The equivalent shorthand is `01-01`.

`draft-scenes` is required first because later stages consume the scene run and reviewed artifacts.

### 1. Draft the scene in stages

Review each stage before spending generation cost:

```bash
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only structure
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only prompt
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only scene --price
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only scene
```

`--only scene` calls the selected text model.

### 2. Create character and location references

Panel prompts require a registered canonical image for every visible character and a registered reference image for the scene location:

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

Final panel images land under `output/<timestamp>_01-opening/panels/`. Grouped page images land in `pages/` when `--panels-per-image` is above one or `--grid` is used.

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

Later stages resume the **latest** existing run directory for the scene. A full `draft-scenes` run or `--only structure` starts a **fresh** run directory. `generate-images` resumes only a run that already contains `metadata/scene.json`. Pass global `--output-dir <path>` to pin an explicit run directory for both reading and writing.

`draft-scenes --only panel-prompts` copies registered character and location references into the run under `assets/`. Reviewed panels may also declare `designReferences` (`key`, a `sourcePath` under `input/`, and a `usage` description); those images are snapshotted the same way.

## Supported Models

### Image Models

`--image-model` accepts model IDs from the central image registry. Comic generates images with OpenAI, Google Gemini, xAI Grok, BFL, Replicate, and Luma Labs. fal.ai image models are not supported.

The default is `gpt-image-2`. Common choices:

| Model                         | Provider | Notes                                                                                 |
| ----------------------------- | -------- | ------------------------------------------------------------------------------------- |
| `gpt-image-2`                 | OpenAI   | Default. Honors `--size` and `--quality`, including custom `WIDTHxHEIGHT` dimensions. |
| `gemini-3.1-flash-lite-image` | Google   | Low-latency Gemini native image generation at 1K.                                     |
| `gemini-3.1-flash-image`      | Google   | Gemini native image generation at 1K, 2K, or 4K with optional Search grounding.       |
| `gemini-3-pro-image`          | Google   | Highest-quality Gemini native image generation at 1K, 2K, or 4K with optional Search grounding. |

Pass multiple models with `--image-model` to generate each panel with every model for comparison:

```bash
--image-model gpt-image-2,gemini-3.1-flash-lite-image
```

### Text Models (LLM)

`--llm-model` accepts model IDs from the central LLM registry for OpenAI, Groq, Google Gemini, Anthropic, MiniMax, xAI Grok, Z.AI GLM, Moonshot Kimi, Together, and Cerebras.

The default is `gpt-5.6-sol`. Common choices:

| Model                    | Provider  | Notes                                                     |
| ------------------------ | --------- | --------------------------------------------------------- |
| `gpt-5.6-sol`            | OpenAI    | Default. Used for scene drafting and panel prompts.       |
| `gpt-5.6-terra`          | OpenAI    | Balanced GPT-5.6 tier.                                    |
| `gpt-5.6-luna`           | OpenAI    | Efficient GPT-5.6 tier.                                   |
| `gpt-5.5`                | OpenAI    | High-capability flagship model.                           |
| `gpt-5.4-mini`           | OpenAI    | Fast and affordable text model.                           |
| `gpt-5.4-nano`           | OpenAI    | Smallest and fastest OpenAI model.                        |
| `gemini-3.1-pro-preview` | Google    | High-intelligence Gemini pro tier text model.             |
| `gemini-3.6-flash`       | Google    | Balanced Gemini text model.                               |
| `gemini-3.5-flash-lite`  | Google    | High-throughput low-cost Gemini text model.               |
| `claude-opus-5`          | Anthropic | Opus-tier Claude model with thinking enabled by default.  |
| `kimi-k3`                | Moonshot  | Flagship Kimi text model with 1M context and reasoning.   |
| `grok-4.3`               | xAI       | Grok structured text model with 200K context.             |
| `grok-4.5`               | xAI       | Grok structured text model with 500K context.             |

## Command Docs

- [draft-scenes](./01-draft-scenes.md)
- [reference-sketch](./02-reference-sketch.md)
- [generate-images](./03-generate-images.md)
- [reference-voice](./04-reference-voice.md)
- [generate-audio](./05-generate-audio.md)
- [generate-slideshow](./06-generate-slideshow.md)
