# comic

Draft comic scene JSON with exhaustive shot plans, build reviewed v4 panel bundles, generate QA-approved panel/page images, and create reusable character and canonical location references.

## Outline

- [Overview](#overview)
- [Setup](#setup)
- [Runtime Paths](#runtime-paths)
- [Usage](#usage)
- [Walkthrough: 01-opening](#walkthrough-01-opening)
- [draft-scenes](#draft-scenes)
- [generate-images](#generate-images)
- [reference-sketch](#reference-sketch)
- [character-sketch](#character-sketch)
- [Output](#output)
- [Clean-break migration](#clean-break-migration)
- [Supported Models](#supported-models)
- [Notes](#notes)
- [Deprecated Options](#deprecated-options)

## Overview

`comic` is a staged pipeline:

1. Draft structured scene JSON from episode scripts.
2. Generate the reusable character and canonical location references that panel prompts require.
3. Build panel prompts, review sketches, final panel images, and grouped page images.

The public subcommands are:

```bash
bun autoshow comic draft-scenes
bun autoshow comic generate-images
bun autoshow comic reference-sketch
bun autoshow comic character-sketch
```

## Setup

`comic` uses hosted text and image models for generation stages. Set the relevant provider key before running real generation:

```bash
OPENAI_API_KEY=...
GEMINI_API_KEY=...
XAI_API_KEY=...
```

- `OPENAI_API_KEY` is required for OpenAI text and image models.
- `GEMINI_API_KEY` is required for Gemini text and image models.
- `XAI_API_KEY` is required for Grok text and image models.
- Text and image models resolve against the central registries, so any other centrally-registered provider you select (e.g. BFL, Reve, Recraft, Replicate, Lumalabs for images) needs its own provider key set. See the [Supported Models](#supported-models) registries for the full list.
- `--price` is side-effect-free and does not call image or LLM generation APIs.

### Character catalog v3

Every comic command requires `input/characters/characters-reference.json`, or the equivalent file under `--characters-root`. There is no bundled fallback. The catalog uses `schemaVersion: 3`, an array of lowercase kebab-case keys, relative `image` and `outlineSheet` paths, per-character aliases, optional group aliases, and optional per-character `sceneTextRules`. A rule declares `kind` (`required` or `forbidden`), a validated regular-expression `pattern`, and a human-readable `description`. Scene drafting receives every catalog description and rule; deterministic scene validation rejects any visible-character panel whose description plus shot plan violates a rule. A character with one canonical reference image sets `image` and `outlineSheet` to the same relative path. Keys—not display names, aliases, image stems, or filenames—are the only identity stored in artifacts.

Character paths must stay within the character root, use PNG/WebP/JPG/JPEG files, remain exclusive to one catalog character, and all group targets must exist. The two fields may name the same file for a one-image character or distinct files for the legacy source-plus-sheet layout. Canonical source images must exist when the catalog loads. A distinct declared sheet may be missing during structure and scene drafting; character revision, panel-prompt creation, and relevant price preflight require a matching checksummed registration in `character-sketches.json`.

Location configuration is project-defined too. Set `styleImage` in `input/locations/locations-reference.json` to any project image whose visual language should guide new location views. A location entry may set a safe root-relative `referenceDirectory`, a lowercase kebab-case establishing `referenceFilename` ending in `--reference.png`, or both to control its canonical promotion path. Reverse and side filenames are derived by inserting `-reverse` or `-side` before `.png`. Legacy `--reference-sheet.png` catalog filenames remain readable and normalize to the establishing path. When the catalog does not exist yet, the comic command uses the first character catalog image as the initial style reference and writes that portable relative path into the new location catalog.

## Runtime Paths

Canonical project-root paths:

| Artifact | Path |
|----------|------|
| Episode scripts | `input/scripts/NN-script/*.md` |
| Character source images | `input/characters/` |
| Per-run scene workspace (prompts, scenes, panels, pages, sketches) | `output/<YYYY-MM-DD_HH-MM-SS-mmm>_<scene-slug>/` |
| Character outline sheets and provenance | `input/characters/<source-stem>--outline-sheet.png`, `input/characters/character-sketches.json` |
| Canonical location specs, per-view images, and provenance | `input/locations/locations-reference.json`, `input/locations/<key>--reference.png`, `input/locations/<key>--reference-{reverse,side}.png`, `input/locations/location-sketches.json` |

## Usage

```bash
bun autoshow comic draft-scenes <script-path> [--only structure|prompt|scene|panel-prompts] [--price]
bun autoshow comic generate-images <script-path> [--target images|sketches|both] [--panels <all|range|list>] [--panels-per-image <n>] [--no-qa] [--max-repairs <n>] [--force] [--price]
bun autoshow comic reference-sketch (--character <key> | --location <key> [--view establishing|reverse|side]) [--revise --notes <text>] [--price]
bun autoshow comic character-sketch --character <key> [--image-model <model>] [--revise --notes <text>] [--price]
```

The `<script-path>` argument also accepts strict episode-scene shorthand: `01-01` resolves to the single Markdown file in `input/scripts/02-script/` whose filename starts with `01-`.

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

`draft-scenes` is required first because `generate-images` only consumes newly reviewed v4 scene artifacts. This writes final panel images under the scene's run directory, e.g. `output/<timestamp>_01-opening/panels/`; grouped page images land in `pages/` when `--panels-per-image` is above one or `--grid` is used. Existing single-location v3 panel bundles and their singular location manifests remain readable by image generation.

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

This stage calls the selected text model. Use `--price` first when you want a side-effect-free cost estimate.

### 4. Create character and location references

Panel prompts require a registered canonical image for every visible character and a registered reference image for the scene's canonical location:

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

`draft-scenes` runs script markdown through structured script JSON, draft prompt bundles, scene JSON panel objects, and stable panel prompt bundles.

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--only <stage>` | Run only `structure`, `prompt`, `scene`, or `panel-prompts` | none (runs all stages) |
| `--concurrency <n>` | Number of panels to build prompt bundles for in parallel during `panel-prompts` | `10` |
| `--price` | Estimate API-backed stages without making API calls | `false` |

### Advanced Options

| Flag | Description | Default |
|------|-------------|---------|
| `--llm-model <model>` | Use a supported OpenAI, Gemini, or Grok text model | `gpt-5.6-sol` |

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
- `--only prompt` builds the scene-drafting prompt bundle and does not call an API.
- `--only scene` drafts scene JSON from an existing prompt bundle.
- `--only panel-prompts` builds stable panel prompt bundles from existing scene JSON and does not call an API.
- Scene drafting validates generated JSON before writing it.
- Structured scripts remain v2; reviewed scenes and panel bundles require `schemaVersion: 3`. Existing v2 scene/panel artifacts are readable migration inputs but cannot enter image generation until `draft-scenes` explicitly rebuilds them. Invalid model output is saved as `scene.invalid.json` with validation details.
- Every panel has an exhaustive prose `shotPlan` covering camera, composition, exact blocking/acting/eyelines, props, balloon placement, and exclusions. Script-authored staging and exact cast/dialogue take precedence over inferred shot details. Permanent location topology remains canonical unless the script explicitly changes the set as a story event.
- `panel.characterKeys` is authoritative for visibility. Descriptions, speech text, and source segments never add visual references implicitly. There is no arbitrary cast-count ceiling: every script-required visible character belongs in the panel. Generation still preflights the selected model's actual reference-image input capability.
- On-screen character speakers must be visible; offscreen character speakers must not be listed as visible.

## generate-images

`generate-images` turns scene JSON into stable panel prompt bundles, optional black-and-white review sketches, and final comic panel images.

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--target <target>` | `images`, `sketches`, or `both` | `images` |
| `--panels <all\|range\|list>` | Panels to process: `all`, a range like `1-8`, a list like `1,3,7`, or mixed like `1-4,9`; overlong contiguous ranges clamp to available panels | `all` |
| `--concurrency <n>` | Number of image requests (across panels, pages, models, and variations) to run in parallel | `10` |
| `-f, --force` | Regenerate image outputs only; never rewrite reviewed scene or prompt artifacts | `false` |
| `--qa` / `--no-qa` | Enable or disable strict final-image QA | enabled |
| `--qa-model <model>` | Vision judge model | `gpt-5.6-sol` |
| `--max-repairs <n>` | Maximum repair attempts after the initial image; stagnation may restart once or stop early | `2` |
| `--price` | Estimate image-generation costs without making API calls | `false` |

### Advanced Options

| Flag | Description | Default |
|------|-------------|---------|
| `--llm-model <model>` | Use a supported text model (see [Supported Models](#supported-models)) | `gpt-5.6-sol` |
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
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --image-model gpt-image-2,gemini-3.1-flash-image-preview
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --variation animation-polish,cinematic-depth
```

### Behavior

- `generate-images` requires reviewed v4 scene and panel bundles for new runs. It never drafts, upgrades, or rewrites them; run `draft-scenes` explicitly when inputs are older. `--force` affects images only.
- `--panels` selects which panels to process for any target (images, sketches, or both). A contiguous range that extends past the last available panel is clamped to the overlap, so `--panels 9-16` on an 11-panel scene processes panels 9-11.
- Review sketch selections must be contiguous because each sketch output is one panel range; use `--target images` for non-contiguous final panel lists like `1,3,7`.
- Non-overlapping panel selections, non-contiguous missing panels, and likely typos such as `--panels 1,99` still fail.
- Final images default to one panel per image; review sketches remain six panels per chunk. `--panels-per-image >1` explicitly enables grouped pages with identical QA/repair behavior.
- Required characters are sent as one canonical image per character ordered by first appearance, followed by every distinct immutable canonical location reference ordered by first panel appearance. Each location's immutable textual specification is included with its reference so generation preserves project-defined permanent architecture, fixed furniture, installed equipment, and recurring spatial relationships. Each individual panel receives only its assigned location. Grouped sketches and pages receive a prompt legend that maps every sub-panel to the correct location reference. Legacy characters with distinct source and sheet images still use a deterministic derived identity card. No environment anchor or prior generated panel is created or referenced.
- `--grid <columns>x<rows>` first generates individual final panel PNGs, then combines them locally into full-size white-backed page grids under `pages/`. For example, `--grid 2x3 --size 1536x1024` writes 3072x3072 page PNGs and leaves unused trailing cells blank on partial final pages.
- `--variation` only applies to final images (`--target images` or `--target both`). When omitted, base final image paths are used. When provided, outputs are grouped under `pages/<run-id>/<variation>/<model>/` or `panels/<run-id>/<variation>/<model>/` within the scene run directory.
- `--concurrency` runs that many independent image requests in parallel. Every panel uses its assigned immutable location snapshot, location specification, and its own shot plan; grouped requests carry the distinct location snapshots needed by their member panels. Continuity locks world-space set topology rather than the camera: shot plans are still expected to vary camera side, distance, elevation, depth, crop, character blocking, pose, expression, and eyeline where appropriate.
- Review sketches and final images use the defaults shown above (`gpt-image-2`, `1536x1024`, `high`).
- Multi-model runs write model-specific filenames.
- Before the first provider request, every selected panel/page/sketch and model is checked against the central registry's reference-image support and maximum input count. Required character references are never truncated; optional continuity images may be trimmed deterministically.
- For fixed furniture and architecture, continuity covers geometry as well as presence: footprint, silhouette, connectedness, orientation, visible edge structure, and wall relationships must survive camera changes. Perspective may foreshorten the canonical form but may not invent a corner, return, split, or freestanding segment. This geometry check does not lock camera position, distance, or composition.
- QA defaults on for individual and grouped outputs. Each output runs initial generation, strict GPT-5.6 Sol judgment, then at most two repair attempts by default. The first repair edits the exact failed image. If the same hard check survives two consecutive judgments, the next repair starts a completely new image from the canonical character and location references instead of chaining another edit; if that check stagnates for two more judgments after the restart, repair stops early. Canonical character images and immutable catalog descriptions have highest visual precedence for identity, physical embodiment, projection/display medium, anatomy, costume, and character-specific required props. A source or shot-plan contradiction cannot excuse a character-canon violation; QA treats it as a hard identity failure. Set continuity is independently strict: QA emits a structured audit for every canonical anchor as correctly placed, genuinely outside the crop, missing, relocated, duplicated, mirrored, or redesigned. An anchor whose canonical region is in frame must remain visibly identifiable; character or prop blocking never excuses its absence. Permanent anchors may be foreshortened or shown from another camera position, but they may not be relocated, hidden, removed from an otherwise revealing view, duplicated, mirrored, or redesigned without an explicit story event. This check does not require the canonical reference camera or repeated compositions. Cast, location, non-conflicting source staging, dialogue wording/completeness, speaker attribution, and panel structure also stay strict. Harmless typography substitutions—such as `...` for `…`, straight for curly quotation marks, or a hyphen for an em/en dash—do not fail dialogue QA when wording, meaning, speaker, and pacing are unchanged. Minor body-width, proportion, shading, detail, or stylization variance remains advisory when the character is clearly recognizable and preserves canonical design cues. Inferred shot-plan framing/staging receives one targeted edit; if that check alone remains unresolved afterward, it is explicitly recorded as waived and becomes advisory. All attempts and judgments are preserved, restart/stop decisions are recorded in attempt QA JSON, and only an attempt with no remaining hard failure is promoted. Exhaustion or stagnation omits the canonical output, continues other selected work, writes reports, and exits nonzero. `--page-qa` and `--page-qa-model` remain deprecated aliases.
- Named anchor assemblies are preserved and audited component by component. A visible desk, console, shelf, rack, berth, or counter does not excuse omission of its named computer, keyboard, control unit, appliance, instrument, or other recurring component, and generic clutter is not a substitute. If an anchor cannot remain visibly identifiable, its entire canonical region must be outside the crop.
- `--price` makes no writes or provider calls and separately reports initial image/judge calls plus maximum edit/judge calls.

## reference-sketch

`reference-sketch --character` runs the existing character-sheet workflow. `reference-sketch --location` targets exactly one view: `establishing` by default, or deterministic `--view reverse|side`. The first establishing run scans matching scripts and asks the configured text model (`gpt-5.6-sol` by default) for stable location facts; reverse and side require establishing and may be added independently. Each successful view is immediately promoted and atomically registered. An existing target is a validated no-op unless `--revise --notes` is supplied. QA enforces the named camera contract and material distinction from existing views; camera failures restart fresh from canonical references, while style, feature, and geometry repairs edit the candidate. `character-sketch` is a compatibility alias and rejects `--view`.

Location `--price` preflight uses the same target and retry arguments as generation. A new or revised view estimates one initial image and one initial judgment plus that view's permitted retries and judgments; a current validated no-op reports zero provider calls. The initial location-specification call is included only when the catalog entry does not yet exist.

## character-sketch

`character-sketch` generates a new immutable three-view version and automatically composes its reference sheet.

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--character <key>` | Character key from `characters-reference.json` | required |
| `-r, --revise` | Revise existing sketches using the source image and existing sketch refs | `false` |
| `--notes <text>` | Revision instructions; required with `--revise` | none |
| `--concurrency <n>` | Number of sketch views to generate in parallel | `10` |
| `--price` | Estimate image-generation costs without making API calls | `false` |

### Advanced Options

| Flag | Description | Default |
|------|-------------|---------|
| `--image-model <model>` | Use exactly one supported image model (see [Supported Models](#supported-models)) | `gpt-image-2` |
| `--size <size>` | Image size such as `1024x1536`, `1024x1024`, `1536x1024`, or `auto` | `1024x1536` |
| `--quality <quality>` | `low`, `medium`, `high`, or `auto`; Gemini ignores this compatibility flag | `medium` |

### Examples

```bash
bun autoshow comic character-sketch --character hero
bun autoshow comic character-sketch --character sidekick --price
bun autoshow comic character-sketch --character hero --revise --notes "Correct the eye shape"
```

### Behavior

- The three generated views and composed sheet stay in temporary storage until all work succeeds; only the flat catalog `outlineSheet` is persisted.
- Fresh generation replaces the registered reference by default. Revision never falls back to fresh generation. A one-image character supplies that canonical image once for every view; a legacy two-image character supplies `[canonical source, current outline sheet]`.
- The sheet and its entry in `character-sketches.json` are promoted together with rollback protection. Source and sheet SHA-256 checksums detect stale or tampered registrations.
- Uses the defaults shown above (`gpt-image-2`, `1024x1536`, `medium`).
- After generating or updating character sketch refs, rerun `draft-scenes --only panel-prompts` for affected scenes so stable panel bundles stage the new refs.

## Output

Each top-level invocation resolves a single timestamped run directory under `output/`, following the project-wide `YYYY-MM-DD_HH-MM-SS-mmm_<slug>` convention, so consecutive runs are preserved instead of overwriting one another. All stages of that invocation write into the same directory:

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
    location-reference.json          # legacy schema when applicable
    location-references.json
    location-references/<snapshot-id>/
    design-references.json           # only when reviewed panels declare designReferences
    design-references/<snapshot-id>/
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

- A later stage (e.g. `generate-images` after `draft-scenes`, or `draft-scenes --only prompt|scene|panel-prompts`) automatically resumes the **latest** existing run directory for the scene, so the multi-stage pipeline still finds prior-stage outputs.
- A full `draft-scenes` run or `--only structure` starts a **fresh** run directory. `generate-images` resumes only a run that already contains `metadata/scene.json`; without one it fails instead of drafting, and `--force` never changes which run directory is used.
- Pass the global `--output-dir <path>` to pin an explicit run directory for both reading and writing.
- The panel-first layout is strict for fresh, resumed, and pinned workspaces. A flat legacy workspace fails with migration instructions; AutoShow does not fall back to flat reads, migrate it automatically, or provide a migration command.

### Run-level character, location, and design snapshots

`draft-scenes --only panel-prompts` first validates the union of visible character keys. Every visible character must have a registered canonical reference whose catalog paths and checksums match `character-sketches.json`. For a one-image character, the source and sheet fields intentionally have the same path and checksum. The command then copies one physical reference file per one-image character into `assets/character-references/<snapshot-id>/<key>/`, records scene-root-relative `assets/...` paths, SHA-256 checksums, and the registration generation ID, and atomically writes `assets/character-references.json` last. Panel bundles contain the snapshot ID and keys only; no character images are copied into panel directories.

The same stage snapshots every distinct panel location once. Each location must resolve deterministically by key, catalog name, or declared alias and have an ordered schema-version-2 registration in `location-sketches.json` whose specification and per-view checksums still match. The stage composes all available views horizontally in establishing/reverse/side order into `assets/location-references/<snapshot-id>/<key>--reference-sheet.png`; a one-view location is copied directly and does not require ImageMagick. Each schema-version-2 snapshot records source-view generation IDs and checksums alongside the composed-sheet checksum, and the plural `assets/location-references.json` outer manifest remains schema version 2. Legacy schema-version-1 registrations and location snapshots remain readable only within the strict `assets/` layout so existing schemas remain compatible without flat-workspace compatibility.

Reviewed schema-version-4 panels may optionally declare `designReferences` entries with a lowercase kebab-case `key`, a safe project-relative image `sourcePath` below `input/`, and a nonblank `usage` description. Automated scene drafting emits an empty array; reviewers attach designs before rebuilding panel prompts. The panel-prompt stage validates consistent key/path/usage mappings, checksums and copies each distinct design into `assets/design-references/<snapshot-id>/`, atomically writes `assets/design-references.json`, and binds only the mapped panels to the snapshot and keys. Generation, repair restarts, capability preflight, grouped pages, sketches, and QA receive designs after character and location references in first-panel-appearance order. Missing, mixed, unsafe, duplicated, stale, or tampered design references fail before provider calls, and QA treats an unmistakable mapped redesign as a hard source-precedence failure.

Image generation rejects missing, mismatched, stale, tampered, or over-limit required references before a provider call. Rebuilding panel prompts creates new snapshots. Existing run directories keep using their immutable snapshots even if live files later change. References are compiled in first-appearance order, with exactly one direct image for each one-image character followed by each distinct location and then each mapped design used by the request. Optional continuity images come afterward. Legacy two-image characters remain compatible through a single derived identity card.

## Clean-break migration

Flat scene workspaces are intentionally unsupported. Project owners must move drafting files and `panel-prompts/` below `metadata/`, move reference manifests and immutable snapshot directories below `assets/`, rewrite manifest asset paths to scene-root-relative `assets/...` paths, and rewrite coverage prompt paths to `metadata/panel-prompts/...` before invoking AutoShow. The CLI rejects a flat workspace with an actionable migration-required error and never performs this project-specific move itself.

Legacy catalogs, unversioned structured/scene/panel artifacts, `character-sketch --image`, basename-keyed identity, version directories, and per-panel reference copies are no longer read. To migrate:

1. Create a schema-version-3 catalog under the selected character root. For one-image characters, set `image` and `outlineSheet` to the same safe character-exclusive path.
2. Move accepted legacy sheets into those flat paths and register their exact checksums in `character-sketches.json`, or regenerate missing characters with `bun autoshow comic character-sketch --character <key>`.
3. Regenerate structured scripts and scene JSON.
4. Rebuild panel prompts to create a checksummed run snapshot.

Migration is entirely project-defined: register every catalog character using its configured key and paths. No external project directory or built-in cast is consulted. Commands that generate missing sheets can spend provider credits; run `bun autoshow comic character-sketch --character <key> --price` before explicitly choosing to proceed.

## Supported Models

### Image Models

`--image-model` accepts any model id in the project's central image registry (`src/cli/commands/setup-and-utilities/models/image-config.json`), the same source of truth used by the `image` step. Comic resolves the id to its provider at runtime and routes generation through the shared image dispatch, so every centrally-registered provider (Gemini, OpenAI, Grok, BFL, Reve, Recraft, Replicate, Lumalabs) is available and pricing comes from the registry.

The default is `gpt-image-2`. Inspect `image-config.json` for the full list of available image models. Common choices:

| Model | Provider | Notes |
|-------|----------|-------|
| `gpt-image-2` | OpenAI | Default. Honors `--size` and `--quality`, including custom `WIDTHxHEIGHT` sizes. |
| `gemini-3.1-flash-image-preview` | Google | Gemini native image generation; `--size` maps to a native aspect ratio. |

Pass multiple models with `--image-model` to generate each panel with every model for comparison:

```bash
--image-model gpt-image-2,gemini-3.1-flash-image-preview
```

### Text Models (LLM)

`--llm-model` accepts any model id in the project's central LLM registry (`src/cli/commands/setup-and-utilities/models/llm-config.json`), the same source of truth used by the `write` step. Comic resolves the id to its provider at runtime and routes generation through the shared LLM dispatch, so every centrally-registered provider (OpenAI, Groq, Gemini, Anthropic, MiniMax, Grok, GLM, Kimi, Together, Cerebras, llama.cpp, Llamafile) is available and pricing comes from the registry.

The default is `gpt-5.6-sol`. Inspect `llm-config.json` for the full list of available text models. Common choices:

| Model | Provider | Notes |
|-------|----------|-------|
| `gpt-5.6-sol` | OpenAI | Default. Current flagship GPT-5.6 tier used for scene drafting and panel prompts. |
| `gpt-5.6-terra` | OpenAI | Current balanced GPT-5.6 tier. |
| `gpt-5.6-luna` | OpenAI | Current efficient GPT-5.6 tier. |
| `gpt-5.5` | OpenAI | Previous flagship tier. |
| `gpt-5.4-mini` | OpenAI | Faster and cheaper, slightly lower quality. |
| `gpt-5.4-nano` | OpenAI | Fastest and cheapest. |
| `gemini-3.1-pro-preview` | Google | Gemini pro-tier text model. |
| `gemini-3.1-flash-lite` | Google | Gemini lightweight text model. |
| `gemini-3.6-flash` | Google | Current balanced Gemini text model. |
| `gemini-3.5-flash-lite` | Google | Current high-throughput low-cost Gemini text model. |
| `claude-opus-5` | Anthropic | Current Claude Opus-tier text model; thinking is on by default. |
| `kimi-k3` | Moonshot | Flagship Kimi text model with a 1M context window; thinking is always on. |
| `grok-4.3` | xAI | Grok structured JSON text model. |
| `grok-4.5` | xAI | Current Grok structured JSON text model; uses tiered pricing above 200K input tokens. |

## Notes

- Real `draft-scenes`, `generate-images`, `reference-sketch`, and `character-sketch` runs call the provider APIs for the selected text and image models, resolved through the central LLM and image registries.
- Use `--price` to estimate hosted cost before running generation.
- `draft-scenes --only prompt` and `draft-scenes --only panel-prompts` are prompt-building stages and do not generate images.

## Deprecated Options

The following options were removed. Using them will produce an informative error with migration instructions:

| Removed Flag | Replacement |
|---|---|
| `--episode`, `--scene`, `--script` | Pass a script file path or `NN-SC` shorthand directly |
| `--panel <n>` | Use `--panels <n>` |
| `--panel-limit <n>` | Use `--panels <range>` directly (e.g. `--panels 1-4`) |
| `--chunk <number>` | Use `--panels <range>` with `--target sketches` |
| `--sketch-group-size <n\|all>` | Sketches auto-group in chunks of 6 by default; use `--panels-per-image <n>` to change chunk size or `--panels <range>` for explicit selection |
| `--sketch-panels <range>` | Use `--panels <range>` |
| `--draft-scenes` | Scene drafts are auto-detected |
| `--skip-panel-prompts` | Panel prompts are auto-detected |
| `generate-images --target prompts` | Use `draft-scenes <script-path> --only panel-prompts` |
