# comic

Turn an episode script into a reviewed comic scene, panel images, multi-speaker audio, and a local still-panel MP4. This walkthrough uses one original four-panel Harborlight scene throughout: episode `02`, scene `01`, slug `01-harborlight-camp`, adult human speakers `papa-bear` and `mira`, location `harborlight-camp`.

## Overview

The dependency order is authored script/catalogs/references → local structure and prompts → reviewed blocking → hosted scene → local panel prompts → hosted images → local review → approved voices and hosted audio → local slideshow. [draft-treatment](./07-draft-treatment.md) is an optional upstream alternative to the supplied original script. Do not draft a second script over the supplied one.

The [source bundle](../../../../input/examples/comic/harborlight/README.md) contains an original script, original front-view cast drawings, the campsite drawing, and authored review notes. These are usable local inputs. They are not generated turnarounds, approved voices, generated panels, human QA labels, or a revision experiment.

## Setup

Run from the repository root. Preparation uses no credentials or network and refuses an existing destination, including an interrupted preparation. Choose another unused `--root runtime/examples/<name>` if necessary; preserve the first workspace.

```bash
bun --no-env-file src/tools/prepare-harborlight-comic.ts
ROOT=runtime/examples/harborlight-comic
SCRIPT="$ROOT/02-script/01-harborlight-camp.md"
CAST="$ROOT/characters"
RUN="$ROOT/run"
CONFIG="$ROOT/empty-config.json"
```

Keep these variables in the same shell for every comic guide. Every command pins `--output-dir "$RUN"` so it consumes this exact run. `--characters-root "$CAST"` selects the copied catalog; its sibling `locations/` supplies the location catalog. Explicit script paths avoid private `input/scripts/` files and ambiguous `02-01` shorthand.

The helper registers the original face/clothing drawings as `legacy-import` with `model: null` and real checksums, then copies them and registers the unpopulated campsite as `existing-canonical-art`, with its actual hash and specification. It creates no voice approval or provider receipt. Optional generated references belong in a separate copied workspace: changing the main catalog after panel prompts exist requires new snapshots and prompts.

Hosted examples need keys for the explicitly selected providers. Add keys through the environment; the empty config keeps unrelated defaults out. `--price` makes no billable provider call. Local `structure` stays local only when no `--provider` is passed. `review` has no `--price` flag.

## Walkthrough: Harborlight

### 1. Parse the script and write prompts locally

```bash
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only structure --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only prompt --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Inspect `metadata/structured-script.json`: both speaker keys, four authored panel notes, real source spans, and hashed source identity must exist. The prompt stage writes `metadata/draft-prompt.md` and `metadata/blocking-prompt.md`.

### 2. Import reviewed authored blocking, or choose hosted blocking

This no-cost route binds authored geometry to real structured segments. The plan helper refuses an existing `blocking-plan.json`; it is intended for the original unedited script. If you chose a different root, pass the same `--root "$ROOT"` to the helper.

```bash
bun --no-env-file src/tools/prepare-harborlight-comic.ts --root "$ROOT" --plan
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only blocking --blocking-plan "$ROOT/blocking-plan.json" --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only blocking --rebind --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Inspect `metadata/blocking-plan.json`: `generatedBy.mode` is `import`, citations name real source segments/hashes, both adults stand beside the ring, and camera `path-side-wide` preserves their sides. Rebind resolves compatible source edits; unresolved citations fail locally. On the unchanged script it verifies compatibility.

Hosted blocking is an **alternative**, not another required purchase. It uses the supplied establishing reference and reserves a validation retry. Price it before replacing the authored plan:

```bash
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only blocking --provider openai=gpt-6.1-sol --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

### 3. Estimate related hosted work before dispatch

Use [the cumulative estimate](#cumulative-estimate) first. Only for an accepted batch, draft the scene and inspect its source coverage, dialogue, blocking citations, and locations:

```bash
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only scene --panel-count 4 --provider openai=gpt-6.1-sol --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only scene --panel-count 4 --provider openai=gpt-6.1-sol --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

The second command is hosted. The repository ships no pre-approved hosted `scene.json`; local preparation stops before it. Each panel must cite its authored note and following segments, preserve spoken lines, and name `harborlight-camp`. Without a compatible reviewed scene, later examples are prerequisites, not runnable completion claims.

### 4. Build panel prompts, generate images, and review

The supplied references already satisfy the local reference prerequisite. [reference-sketch](./02-reference-sketch.md) documents optional generated replacements and extra camera views.

```bash
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only panel-prompts --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-images "$SCRIPT" --target sketches --provider openai=gpt-image-2 --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-images "$SCRIPT" --target images --provider openai=gpt-image-2 --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Generation retains candidates at `panels/<image-run-id>/panel-NN.png`. Review those actual four files first. Review sheets, QA-only, revision evaluation, and slideshow use canonical names at `panels/panel-NN.png`; they do not automatically choose a candidate run. Select the completed single-model, individual-panel run you reviewed, then publish local copies with the helper:

```bash
IMAGE_RUN=$(bun --no-env-file -e 'const m = await Bun.file(process.argv[1]).json(); const p = m.items[0].providers.filter(p => p.operation === "comic-image" && p.status === "succeeded"); if (p.length !== 1) throw new Error("Select one complete single-model image run"); console.log(p[0].metadata.runId)' "$RUN/manifest.json")
bun --no-env-file src/tools/prepare-harborlight-comic.ts --root "$ROOT" --publish-panels "$IMAGE_RUN"
```

Publication verifies all four recorded source hashes, full image decoding, equal even dimensions, and all destination paths before copying. It refuses existing canonical files and retains every candidate. It supports this complete single-model canonical individual-panel run; grids, variations, subsets and multiple-model comparisons need a separately reviewed selection workflow. No paid call occurs. Then publish the local review sheet:

```bash
bun --no-env-file autoshow comic review "$SCRIPT" --export-doc --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic review "$SCRIPT" --notes "$ROOT/review-notes.md" --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Both image commands are hosted and belong in the cumulative estimate. The supplied notes exercise local mapping; review actual panels before treating a note as an observed defect. Notes processing leaves the script unchanged. Paste reviewed directives into the runtime script before the optional [reconcile pass](./01-draft-scenes.md#reconcile-from-directives), then rebuild panel prompts if the plan changed. QA-only, continuity labels, and revision plans have additional [explicit prerequisites](./03-generate-images.md#optional-audit-and-revision-prerequisites).

### 5. Approve voices, render audio, and synchronize panels

Use the [voice lifecycle](../../04-audio/voice/00-voice-overview.md) to register, audition, review, and approve **both** `papa-bear` and `mira` for the exact provider, model, and profile. Stock voice IDs do not create approval. Include audition requests and possible billed retries in the batch estimate. The bundle supplies no invented approval manifest.

After both approvals and all four canonical panel images exist:

```bash
bun --no-env-file autoshow comic generate-audio "$SCRIPT" --provider elevenlabs=eleven_v3 --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-slideshow "$SCRIPT" --audio-target elevenlabs=eleven_v3 --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Audio is hosted; slideshow is local. The script has no effects, overlapping speech, delivery tags, or uncatalogued roles. Optional role/effect examples require a separately authored script and matching approvals. The slideshow needs a complete selected audio manifest, not an arbitrary WAV, and four same-sized even-dimension canonical panels. It writes `presentation/final/slideshow.mp4` (H.264/AAC). Repeating compatible completed work reuses artifacts.

## Cumulative estimate

Do not execute hosted blocks as independent purchases. Sum the accepted scope before dispatch: scene drafting with its validation retry; optional hosted blocking with its retry; optional model-backed structure review when a full-pipeline variant explicitly selects a text provider; optional two character turnaround generations and location views with their QA/repair allowance; a review sketch sheet containing the four panels (the default grouping is up to six panels per image); four final individual images with QA/repair/comparison allowances; two voice auditions/approvals for the exact target; dialogue rendering; and any deliberately selected alternatives, revisions, effects, or billable retries. Authored script/references/blocking and local prompts/review/slideshow cost $0 in provider charges.

Run the scene/blocking `--price` commands above. Price references with [reference-sketch](./02-reference-sketch.md), images with `generate-images ... --target both --price`, and audio with `generate-audio ... --provider elevenlabs=eleven_v3 --price` **after its scene and voice prerequisites exist**. A successful price exit alone does not establish readiness: image preflight can report missing reviewed artifacts without producing them. Future scene contents, voice selections/audition lengths, reference repairs, optional labels/revision plans, and failure retries prevent a trustworthy full hosted total from the source bundle alone. Do not report missing stages as a $0 quote. Recompute and sum remaining quotes when those choices exist, retaining prior possibly billed attempts in cumulative spending. Under this repository's execution rules, an unknown total or a related total over $0.25 requires approval for the exact batch before any paid call.

Documentation verification uses fetch-blocked local CLI stages and controlled hosted transport fixtures. Synthetic test tone audio and original test panel rasters verify decoding, timing, and local slideshow artifacts; they establish no spoken-text, voice, hosted-art, or perceptual-quality result. No live hosted spending is needed to verify these dependency contracts.

## Runtime Paths

Copied inputs, sibling catalogs, and the pinned run stay below `runtime/examples/harborlight-comic/`. Normal unpinned runs use `output/<timestamp>_<scene-slug>/`. `metadata/` holds structured script, blocking, scene, prompts, and review; `assets/` retains reference snapshots; `panels/` holds canonical images; `audio/final/` holds complete selected WAVs; `presentation/final/` holds slideshow outputs. Preserve interrupted runs and paid audio caches.

For recorded interrupted requests use [`resume <run-directory> --price`, then `resume <run-directory>`](../../00-setup-and-utilities/resume.md#comic-recovery). It restores the recorded request. See the [workspace diagram](../../../diagrams/05-types-and-output.md#comic-character-and-run-layout).

## Supported Models

Comic images accept OpenAI, Gemini, and Grok model IDs; fal.ai image models are unavailable here. Default image: `gpt-image-2`. Default text: `gpt-6.1-sol`; blocking and QA require a supported OpenAI or Gemini vision model. Audio defaults to the cheapest hosted TTS target, so this walkthrough selects its model explicitly. Model lists: [image](../image/overview.md), [write](../../03-write/overview.md), [TTS](../../04-audio/tts/overview.md).

## Command Docs

- [draft-treatment](./07-draft-treatment.md): optional prose-to-script upstream branch
- [draft-scenes](./01-draft-scenes.md): structure/prompts, blocking, and scene
- [reference-sketch](./02-reference-sketch.md): optional generated reference variants
- [generate-images](./03-generate-images.md): sketches, panels, audit/revision variants
- [review](./06-review.md): local sheet and notes
- [generate-audio](./04-generate-audio.md): approved voices and optional role/effect branches
- [generate-slideshow](./05-generate-slideshow.md): complete compatible audio and panels
