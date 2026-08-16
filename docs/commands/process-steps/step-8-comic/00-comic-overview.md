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
- [Notes](#notes)
- [Command Docs](#command-docs)

## Overview

`comic` is a staged pipeline. Run the public subcommands in this order:

1. Start from episode script Markdown under `input/scripts/` and [draft the scene](./01-draft-scenes.md): structured script JSON, draft prompt, scene JSON, then panel prompt bundles.
2. Create reusable [character and location reference images](./02-reference-sketch.md) before panel prompts consume them.
3. [Generate review sketches and final panel images](./03-generate-images.md).
4. Register and approve [character voices](./04-reference-voice.md).
5. [Render multi-speaker scene audio](./05-generate-audio.md).
6. [Synchronize panels into a slideshow](./06-generate-slideshow.md).

The public subcommands are:

```bash
bun autoshow comic draft-scenes
bun autoshow comic reference-sketch
bun autoshow comic generate-images
bun autoshow comic reference-voice
bun autoshow comic generate-audio
bun autoshow comic generate-slideshow
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

| Artifact                                                           | Path                                                                                                                                                                                |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Episode scripts                                                    | `input/scripts/NN-script/*.md`                                                                                                                                                      |
| Character source images                                            | `input/characters/`                                                                                                                                                                 |
| Per-run scene workspace (prompts, scenes, panels, pages, sketches) | `output/<YYYY-MM-DD_HH-MM-SS-mmm>_<scene-slug>/`                                                                                                                                    |
| Canonical scene manifest                                           | `output/<timestamp>_<scene-slug>/manifest.json`                                                                                                                                     |
| Immutable dialogue plans and voice snapshots                       | `output/<timestamp>_<scene-slug>/metadata/dialogue-plans/`, `output/<timestamp>_<scene-slug>/assets/voice-references/`                                                              |
| Provider render evidence and final audio                           | `output/<timestamp>_<scene-slug>/audio/<target-key>/render.json`, `output/<timestamp>_<scene-slug>/audio/slots/`, `output/<timestamp>_<scene-slug>/audio/final/`                    |
| Immutable presentation evidence and selected slideshow             | `output/<timestamp>_<scene-slug>/presentation/presentation.json`, `output/<timestamp>_<scene-slug>/presentation/final/`                                                             |
| Character outline sheets and provenance                            | `input/characters/<source-stem>--outline-sheet.png`, `input/characters/character-sketches.json`                                                                                     |
| Canonical location specs, per-view images, and provenance          | `input/locations/locations-reference.json`, `input/locations/<key>--reference.png`, `input/locations/<key>--reference-{reverse,side}.png`, `input/locations/location-sketches.json` |

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

After images exist, register [character voices](./04-reference-voice.md), [render scene audio](./05-generate-audio.md), then [build the slideshow](./06-generate-slideshow.md).

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

| Model                         | Provider | Notes                                                                                           |
| ----------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `gpt-image-2`                 | OpenAI   | Default. Honors `--size` and `--quality`, including custom `WIDTHxHEIGHT` dimensions.           |
| `gemini-3.1-flash-lite-image` | Google   | Low-latency Gemini native image generation at 1K.                                               |
| `gemini-3.1-flash-image`      | Google   | Gemini native image generation at 1K, 2K, or 4K with optional Search grounding.                 |
| `gemini-3-pro-image`          | Google   | Highest-quality Gemini native image generation at 1K, 2K, or 4K with optional Search grounding. |

Pass multiple models with `--image-model` to generate each panel with every model for comparison:

```bash
--image-model gpt-image-2,gemini-3.1-flash-lite-image
```

### Text Models (LLM)

`--llm-model` accepts any model ID from the central LLM registry (`src/cli/commands/setup-and-utilities/models/llm-config.json`). Comic routes generation through shared LLM dispatch across registered hosted providers (OpenAI, Groq, Google Gemini, Anthropic, MiniMax, xAI Grok, Z.AI GLM, Moonshot Kimi, Together, Cerebras).

The default is `gpt-5.6-sol`. Common choices:

| Model                    | Provider  | Notes                                                                        |
| ------------------------ | --------- | ---------------------------------------------------------------------------- |
| `gpt-5.6-sol`            | OpenAI    | Default. Flagship GPT-5.6 tier used for scene drafting and panel prompts.    |
| `gpt-5.6-terra`          | OpenAI    | Balanced GPT-5.6 tier.                                                       |
| `gpt-5.6-luna`           | OpenAI    | Efficient GPT-5.6 tier.                                                      |
| `gpt-5.5`                | OpenAI    | High-capability flagship model with standard and long-context pricing bands. |
| `gpt-5.4-mini`           | OpenAI    | Fast and affordable text model.                                              |
| `gpt-5.4-nano`           | OpenAI    | Smallest and fastest OpenAI model.                                           |
| `gemini-3.1-pro-preview` | Google    | High-intelligence Gemini pro tier text model.                                |
| `gemini-3.6-flash`       | Google    | Balanced Gemini text model.                                                  |
| `gemini-3.5-flash-lite`  | Google    | High-throughput low-cost Gemini text model.                                  |
| `claude-opus-5`          | Anthropic | Opus-tier Claude model with thinking enabled by default.                     |
| `kimi-k3`                | Moonshot  | Flagship Kimi text model with 1M context and reasoning.                      |
| `grok-4.3`               | xAI       | Grok structured text model with 200K context.                                |
| `grok-4.5`               | xAI       | Grok structured text model with 500K context.                                |

## Notes

- Generation commands (`draft-scenes`, `generate-images`, `generate-audio`, `reference-sketch`) call provider APIs resolved through central registries.
- Use `--price` to estimate costs without invoking provider APIs or mutating files.
- `draft-scenes --only prompt` and `draft-scenes --only panel-prompts` are local prompt-assembly stages and do not make provider calls.

## Command Docs

- [draft-scenes](./01-draft-scenes.md)
- [reference-sketch](./02-reference-sketch.md)
- [generate-images](./03-generate-images.md)
- [reference-voice](./04-reference-voice.md)
- [generate-audio](./05-generate-audio.md)
- [generate-slideshow](./06-generate-slideshow.md)
