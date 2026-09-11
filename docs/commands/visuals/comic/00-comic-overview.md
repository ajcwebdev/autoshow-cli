# comic

Draft comic scenes from episode scripts, compile a blocking plan into per-panel stage ledgers, generate panel and page images under blocking and continuity QA, build reviewer artifacts, render multi-speaker scene audio, and synchronize panels into a local still-image MP4. Manage character voices with [`voice`](../../audio/voice/00-voice-overview.md).

## Outline

- [Overview](#overview)
- [Setup](#setup)
- [Runtime Paths](#runtime-paths)
- [Usage](#usage)
- [Walkthrough: 01-opening](#walkthrough-01-opening)
- [Output](#output)
- [Supported Models](#supported-models)
- [Command Docs](#command-docs)
- [Deprecated Aliases](#deprecated-aliases)

## Overview

`comic` is a staged pipeline. A prose treatment can enter it through [`draft-treatment`](./07-draft-treatment.md), which writes the episode script and bootstraps catalog entries before step 1. Run the public subcommands in this order:

1. Start from episode script Markdown under `input/scripts/` and [draft the scene](./01-draft-scenes.md): structured script JSON, draft prompt, blocking plan, scene JSON, then panel prompt bundles.
2. Create reusable [character and location reference images](./02-reference-sketch.md) before panel prompts consume them.
3. [Generate review sketches and final panel images](./03-generate-images.md).
4. Publish the panel-by-panel [review sheet](./06-review.md#review-sheet) with `review`, then turn a reviewer's Markdown into a structured change plan with [`review --notes`](./06-review.md#notes-processing).
5. Register and approve [character voices](../../audio/voice/00-voice-overview.md).
6. [Render multi-speaker scene audio](./04-generate-audio.md).
7. [Synchronize panels into a slideshow](./05-generate-slideshow.md).

## Setup

Set API keys for the text, image, and speech providers you select. The defaults need:

```bash
OPENAI_API_KEY=...
GEMINI_API_KEY=...
XAI_API_KEY=...
```

Other image providers (BFL, Replicate, Luma Labs) and TTS or sound-effect providers need their own keys. See [Supported Models](#supported-models), [TTS](../../audio/tts/overview.md), and [voice](../../audio/voice/00-voice-overview.md).

Where supported, `--price` estimates cost without provider calls or writes. `draft-treatment --price`, `draft-scenes --only prompt`, `draft-scenes --only panel-prompts`, `draft-scenes --only blocking --blocking-plan <path>`, `draft-scenes --only blocking --rebind`, `draft-scenes --reconcile-from-directives`, and both `review` modes are local and make no provider calls. `review` does not have a pricing option.

### Character and Location Catalogs

`draft-scenes` and `reference-sketch` require `input/characters/characters-reference.json`, or the same file under `--characters-root`. The catalog names each character and points to its reference images. Run `reference-sketch` before panel-prompt creation and after revising a character.

Location configuration lives in `input/locations/locations-reference.json`. Set `styleImage` to a project image whose visual language should guide new location views. If the location catalog does not exist, comic creates it using the first character catalog image as the style reference.

Every comic stage loads the character catalog, and loading fails when a character has neither its source image nor its `generationReference` image on disk. Keep every style seed named by a `generationReference` under `input/characters/` before running any stage, including `draft-scenes --only structure`.

## Runtime Paths

- Episode scripts: `input/scripts/NN-script/*.md`
- Prose treatments: any `.md`, `.txt`, or `.pdf` file, for example `input/camp.md`
- Treatment run (source copy, prompt, model responses, validated draft, parser preview, merge report): `output/<YYYY-MM-DD_HH-MM-SS-mmm>_<slug>-treatment/`
- Character catalog and outline sheets: `input/characters/`
- Location catalog and reference views: `input/locations/`
- Optional reviewed per-location geometry records and their floor-plan drawings: `input/locations/location-plans.json` and `input/locations/plans/`
- Scene run (prompts, blocking plan, scene JSON, panels, pages, sketches, review artifacts, QA reports, audio, slideshow): `output/<YYYY-MM-DD_HH-MM-SS-mmm>_<scene-slug>/`
- Blooper copies of non-promoted attempts, when `generate-images --bloopers` is set: `<output-root>/bloopers/`

## Usage

```bash
bun autoshow comic draft-treatment <treatment-path> [--panel-count <n|min-max>] [--voice-pacing exclusive|mixed] [--episode <NN>] [--scene <SC>] [--slug <text>] [--speaker <key>] [--style-seed <filename>] [--catalog-policy skip-existing|fail] [--force] [--price]
bun autoshow comic draft-scenes <script-path> [--only structure|prompt|blocking|scene|panel-prompts] [--no-blocking] [--blocking-plan <path>] [--rebind] [--reconcile-from-directives] [--panel-count <n>] [--price]
bun autoshow comic reference-sketch (--character <key> | --location <key> [--view establishing|reverse|side]) [--revise --notes <text>] [--price]
bun autoshow comic generate-images <script-path> [--target images|sketches|both] [--panels <all|range|list>] [--blocking-hard-keys <list>] [--bloopers] [--stop-on-provider-error] [--credit-preflight] [--price]
bun autoshow comic generate-images <script-path> --qa-only --continuity-qa [--continuity-only] [--labels <path>] [--trusted-anchor-panel <n>] [--price]
bun autoshow voice <subcommand> [flags]
bun autoshow comic generate-audio <script-path> [--provider <provider[=model]>] [--price]
bun autoshow comic generate-slideshow <script-path> [--audio-target <provider=model>] [--price]
bun autoshow comic review <script-path> --notes <path>
bun autoshow comic review <script-path> [--export-doc]
```

`<script-path>` also accepts episode-scene shorthand: `01-01` resolves to the single Markdown file in `input/scripts/01-script/` whose filename starts with `01-`. `draft-treatment` writes its script as `input/scripts/<episode>-script/<scene>-<slug>.md`, so a treatment drafted with `--episode 02` is addressed as `02-01` afterwards.

## Walkthrough: 01-opening

This walkthrough starts from `input/scripts/01-script/01-opening.md` (`01-01`). Later stages consume the scene run from `draft-scenes`.

### 1. Draft the scene in stages

Review each stage before spending generation cost:

```bash
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only structure
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only prompt
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only blocking --price
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only blocking
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only scene --price
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only scene
```

The `blocking` stage writes `metadata/blocking-plan.json`: the stage marks, moves, action axis, and camera setups that later stages compile into a per-panel ledger, SVG stage board, and, for dense ledgers, a deterministic screen-space `panel-NN-layout.png`. Review the plan before drafting the scene, skip the stage with `--no-blocking`, or import a hand-authored plan with `--only blocking --blocking-plan <path>` instead of drafting one.

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

### 5. Publish the review sheet and apply reviewer notes

```bash
bun autoshow comic review input/scripts/01-script/01-opening.md --export-doc
bun autoshow comic review input/scripts/01-script/01-opening.md --notes notes/01-opening-review.md
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --reconcile-from-directives
```

`review` writes a self-contained `metadata/review/review-sheet.html` with every reviewed panel's contract, stage board, canonical image, and QA route. `review --notes` turns the reviewer's Markdown reply into a structured change plan, and `--reconcile-from-directives` applies the script's own `**CAMERA:**`, `**BREAK-180:**`, `**COSTUME:**`, and `**EXTRAS:**` directives without an LLM call. None of the three calls a provider.

### 6. Register voices, render audio, and build the slideshow

After images exist, register [character voices](../../audio/voice/00-voice-overview.md), [render scene audio](./04-generate-audio.md), then [build the slideshow](./05-generate-slideshow.md):

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
    structured-script.previous.json    # the script the last structure re-run replaced; read by --rebind
    draft-prompt.md
    blocking-prompt.md
    blocking-plan.json
    blocking-bindings.json             # only in bind mode
    blocking/                          # compiled stage boards and ledger, when a plan exists
    scene.json
    review/                            # review-sheet, review-notes, and reconcile artifacts
    panel-prompts/
  qa/                                  # QA-only page audits and continuity audits
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
output/<YYYY-MM-DD_HH-MM-SS-mmm>_<slug>-treatment/
  metadata/treatment/
    source.<ext>
    source.txt
    prompt.md
    response-attempt-N.json
    treatment.json
    treatment.invalid.json           # only when both drafting attempts fail
    structured-script.preview.json
    script.md
    merge-report.json
    merge-report.md
input/scripts/
  <episode>-script/<scene>-<slug>.md   # written by draft-treatment
input/characters/
  characters-reference.json
  character-sketches.json
  <source-stem>--outline-sheet.png
input/locations/
  locations-reference.json
  location-sketches.json
  location-plans.json                # optional reviewed room geometry
  plans/                             # optional floor-plan drawings behind those records
  <key>--reference.png
  <key>--reference-reverse.png       # optional
  <key>--reference-side.png          # optional
```

`generate-images --bloopers` additionally copies every non-promoted attempt to `<output-root>/bloopers/<episode>/<scene-slug>/` with a provenance sidecar. Nothing under that root is canonical.

Later stages resume the latest existing run directory for the scene. A full `draft-scenes` run or `--only structure` starts a fresh run directory. `generate-images` resumes only a run that already contains `metadata/scene.json`. Pass global `--output-dir <path>` to pin an explicit run directory.

For an interrupted recorded request, use [`resume <run-directory> --price` followed by `resume <run-directory>`](../../setup-and-utilities/resume.md#comic-recovery). Recovery restores saved image, audio, and presentation choices, including the original image output run ID and pending slideshow intent. It reuses completed work, leaves unrequested stages alone, and reports missing intent or changed dependencies instead of selecting new defaults. Explicit comic commands still own preparation, approvals, new rendering choices, and provider comparisons.

`draft-scenes --only panel-prompts` copies registered character and location references into `assets/`.

## Supported Models

### Image Models

`--image-model` accepts OpenAI, Google Gemini, xAI Grok, BFL, Replicate, and Luma Labs model IDs. fal.ai image models are not available on comic. The default is `gpt-image-2`. See [`image`](../image/overview.md) for the full catalog.

| Model                         | Provider |
| ----------------------------- | -------- |
| `gpt-image-2`                 | OpenAI   |
| `gpt-image-2.5-flare` | OpenAI |
| `gpt-image-2.5-sunburst` | OpenAI |
| `gemini-3.1-flash-lite-image` | Google   |
| `gemini-3.1-flash-image`      | Google   |
| `gemini-3-pro-image`          | Google   |

Pass multiple models with `--image-model` to generate each panel with every model for comparison:

```bash
--image-model gpt-image-2,gemini-3.1-flash-lite-image
```

### Text Models (LLM)

`--llm-model` accepts the same hosted text model IDs as [`write`](../../text/write/overview.md). The default is `gpt-5.6-sol` for scene drafting.

## Command Docs

- [draft-treatment](./07-draft-treatment.md)
- [draft-scenes](./01-draft-scenes.md)
- [reference-sketch](./02-reference-sketch.md)
- [generate-images](./03-generate-images.md)
- [generate-audio](./04-generate-audio.md)
- [generate-slideshow](./05-generate-slideshow.md)
- [review](./06-review.md)

## Deprecated Aliases

These spellings remain callable for one compatibility release and emit deprecation notices. Their direct `--help` pages retain the original flags and name the replacements; the ordinary comic menu lists the six canonical subcommands. Removal requires a later announced breaking CLI release.

| Deprecated invocation | Canonical invocation |
| --- | --- |
| `comic reference-voice` | `voice list` |
| `comic reference-voice <action> ...` | `voice <action> ...` |
| `comic review-sheet <script> [--export-doc]` | `comic review <script> [--export-doc]` |
| `comic review-notes <script> --notes <path>` | `comic review <script> --notes <path>` |

Voice aliases keep the same providers, consent requirements, flags, and result behavior. Review aliases keep their original mode-specific validation, result identifiers, and artifact paths. Use the canonical invocations in new scripts.
