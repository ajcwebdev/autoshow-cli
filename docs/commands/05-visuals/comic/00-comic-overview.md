# comic

Create reviewed scenes, images, approved-voice dialogue, and local still-panel video. The workflow is script/catalogs → structure/prompts → blocking → scene → panel prompts → images/review → audio → slideshow. [draft-treatment](./07-draft-treatment.md) optionally creates the starting script.

## Setup

The original [Harborlight bundle](../../../../input/examples/comic/harborlight/README.md) supplies a four-panel scene, two adult human speakers (`papa-bear` and `mira`), registered drawings, and sample notes. It supplies no generated panels, QA labels, or voice approvals.

Prepare an unused workspace from the repository root. The helper refuses existing destinations; preserve interrupted work and choose another `--root` when needed.

```bash
bun --no-env-file src/tools/prepare-harborlight-comic.ts
ROOT=runtime/examples/harborlight-comic
SCRIPT="$ROOT/02-script/01-harborlight-camp.md"
CAST="$ROOT/characters"
RUN="$ROOT/run"
CONFIG="$ROOT/empty-config.json"
```

Keep these variables in the same shell. The empty config prevents unrelated defaults; `--characters-root` selects the copied catalog and sibling `locations/`. Pin every stage to `--output-dir "$RUN"`. Hosted stages need the selected providers' exported keys. `--price` makes no billable call; [`review`](./06-review.md) is local and has no price flag.

## Walkthrough: Harborlight

### 1. Parse the script and write prompts locally

```bash
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only structure --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only prompt --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Inspect both speakers, four authored panel notes, and unchanged dialogue in `metadata/structured-script.json`. Structure is local unless `--provider` is explicit.

### 2. Import reviewed authored blocking, or choose hosted blocking

For the unchanged example, create and import authored geometry without provider calls:

```bash
bun --no-env-file src/tools/prepare-harborlight-comic.ts --root "$ROOT" --plan
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only blocking --blocking-plan "$ROOT/blocking-plan.json" --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

The helper refuses an existing plan. After compatible script edits, refresh structure and use `--only blocking --rebind`; unresolved citations fail locally. [Hosted blocking](./01-draft-scenes.md#blocking-plan) is an alternative purchase, not another required stage.

### 3. Estimate related hosted work before dispatch

Follow the [cumulative estimate](#cumulative-estimate), then draft and review the scene:

```bash
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only scene --panel-count 4 --provider openai=gpt-6.1-sol --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only scene --panel-count 4 --provider openai=gpt-6.1-sol --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Check source coverage, preserved speech, blocking citations, and location before continuing.

### 4. Build panel prompts, generate images, and review

The supplied references need no hosted replacement. Optional variants use [reference-sketch](./02-reference-sketch.md) in a separate workspace.

```bash
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only panel-prompts --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-images "$SCRIPT" --target sketches --provider openai=gpt-image-2.5-flare --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-images "$SCRIPT" --target images --provider openai=gpt-image-2.5-flare --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Both image commands are hosted. Inspect `panels/<image-run-id>/panel-NN.png`; downstream review, audit, revision, and slideshow read canonical `panels/panel-NN.png` instead. Publish only the completed single-model individual-panel run you reviewed:

```bash
IMAGE_RUN=$(bun --no-env-file -e 'const m = await Bun.file(process.argv[1]).json(); const p = m.items[0].providers.filter(p => p.operation === "comic-image" && p.status === "succeeded"); if (p.length !== 1) throw new Error("Select one complete single-model image run"); console.log(p[0].metadata.runId)' "$RUN/manifest.json")
bun --no-env-file src/tools/prepare-harborlight-comic.ts --root "$ROOT" --publish-panels "$IMAGE_RUN"
bun --no-env-file autoshow comic review "$SCRIPT" --export-doc --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic review "$SCRIPT" --notes "$ROOT/review-notes.md" --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Publication validates all four images and equal even dimensions, refuses existing canonical files, and preserves candidates. Grids, subsets, variations, and multi-model output require a separately reviewed selection. Sample notes demonstrate mapping, not observed defects. Apply accepted directives manually, refresh structure/rebind, [reconcile](./01-draft-scenes.md#reconcile-from-directives), and rebuild prompts. [Audit and revision](./03-generate-images.md#optional-audit-and-revision-prerequisites) need additional evidence.

### 5. Approve voices, render audio, and synchronize panels

[Register, audition, and approve](../../04-audio/voice/00-voice-overview.md) both speakers for the exact model/profile; stock IDs alone do not approve them. With those approvals and four canonical panels:

```bash
bun --no-env-file autoshow comic generate-audio "$SCRIPT" --provider elevenlabs=eleven_v3 --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-slideshow "$SCRIPT" --audio-target elevenlabs=eleven_v3 --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Audio is hosted; slideshow is local and requires a complete canonical audio run, not a loose WAV. It writes `presentation/final/slideshow.mp4`. The supplied script has no effects, overlap, delivery tags, or uncatalogued roles; those variants need separately reviewed inputs and approvals.

## Cumulative estimate

Estimate the complete selected batch: scene/blocking validation retries, optional generated references, sketches, final images and QA/repairs/comparisons, voice auditions, dialogue/effects, and billable retries. Import, prompts, review, approval, and slideshow have no provider charge. `sketches` plus `images` and `--target both` are alternatives.

Use each stage's `--price` after its prerequisites exist. A successful preflight with missing artifacts is not a complete quote or readiness proof; missing work must not count as zero. Recompute remaining estimates as choices become known, retaining possibly billed attempts. [Repository spending rules](../../../../AGENTS.md#paid-providers) govern the cumulative batch.

## Runtime Paths

The example stays under `runtime/examples/harborlight-comic/`; unpinned scene runs use `output/<timestamp>_<scene-slug>/`. `metadata/` holds structure, plans, prompts, and review; references remain in the chosen catalog roots. `panels/`, `audio/final/`, and `presentation/final/` hold selected outputs. Generation/QA read current canonical references directly, so reference-only updates do not require new prompt bundles.

Preserve interrupted runs and paid audio. [`resume <run-directory> --price`](../../00-setup-and-utilities/resume.md#comic-recovery) inspects recorded work; `resume` restores its choices and reuses completed outputs.

## Supported Models

Images use OpenAI, Gemini, or Grok; the default is `gpt-image-2.5-flare`. Text defaults to `gpt-6.1-sol`; blocking/QA require supported OpenAI/Gemini vision models. Audio defaults to the cheapest hosted TTS target. Current catalogs: [image](../image/overview.md), [write](../../03-write/overview.md), [TTS](../../04-audio/tts/overview.md).

## Command Docs

[draft-treatment](./07-draft-treatment.md) · [draft-scenes](./01-draft-scenes.md) · [reference-sketch](./02-reference-sketch.md) · [generate-images](./03-generate-images.md) · [review](./06-review.md) · [generate-audio](./04-generate-audio.md) · [generate-slideshow](./05-generate-slideshow.md)
