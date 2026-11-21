# comic

Create reviewed scenes, images, approved-voice dialogue, and local still-panel video. The workflow is script/catalogs → prepare → scene → panel prompts → images → audio → slideshow, with optional local review and candidate replacement. [draft-treatment](./07-draft-treatment.md) optionally creates the starting script.

## Setup

The original [Harborlight bundle](../../../../input/examples/comic/harborlight/README.md) supplies a four-panel scene, two adult human speakers (`papa-bear` and `mira`), and registered drawings. It supplies no generated panels or voice approvals.

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

### 1. Prepare the scene locally

```bash
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only prepare --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Prepare parses the script and builds the draft prompt from that exact structure without provider calls. Inspect both speakers, four authored panel notes, and unchanged dialogue in `metadata/structured-script.json`, and the drafting input in `metadata/draft-prompt.md`.

### 2. Estimate, then draft and review the scene

Follow the [cumulative estimate](#cumulative-estimate), then draft the scene:

```bash
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only scene --panel-count 4 --provider openai=gpt-6.1-sol --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only scene --panel-count 4 --provider openai=gpt-6.1-sol --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Check source coverage, preserved speech, shot descriptions, and location in `metadata/scene.json` before continuing.

### 3. Build panel prompts and generate images

The supplied references need no hosted replacement. Optional variants use [reference-sketch](./02-reference-sketch.md) in a separate workspace.

```bash
bun --no-env-file autoshow comic draft-scenes "$SCRIPT" --only panel-prompts --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-images "$SCRIPT" --target images --provider openai=gpt-image-2.6-flare --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-images "$SCRIPT" --target images --provider openai=gpt-image-2.6-flare --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Image generation is hosted and uses one model per run. Each successful individual panel is written to `panels/<image-run-id>/panel-NN.png` and, because the walkthrough's slots are empty, automatically selected as `panels/panel-NN.png` ("Panel 3 selected"). The command reports the image run ID. Sketches (`--target sketches` or `both`) are optional and are never selected.

### 4. Approve voices, render audio, and synchronize panels

[Register, audition, and approve](../../04-audio/voice/00-voice-overview.md) both speakers for the exact model/profile; stock IDs alone do not approve them. With those approvals and four selected panels:

```bash
bun --no-env-file autoshow comic generate-audio "$SCRIPT" --provider elevenlabs=eleven_v3 --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-slideshow "$SCRIPT" --audio-target elevenlabs=eleven_v3 --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Audio is hosted; slideshow is local and requires a complete canonical audio run, not a loose WAV. It writes `presentation/final/slideshow.mp4`. No review step is required. The supplied script has no effects, overlap, delivery tags, or uncatalogued roles; those variants need separately reviewed inputs and approvals.

### 5. Optional: review and replace a panel

[`review`](./06-review.md) writes a local sheet of the current selection. To try another version of panel 3, generate it in a new run (`--panels 3`, with `--force` because a selection already exists), note the reported image run ID, then preview and adopt it:

```bash
IMAGE_RUN=<reported-image-run-id>
bun --no-env-file autoshow comic review "$SCRIPT" --output-dir "$RUN" --run "$IMAGE_RUN"
bun --no-env-file autoshow comic review "$SCRIPT" --output-dir "$RUN" --run "$IMAGE_RUN" --use --panels 3
```

A later generation saves a new candidate ("New version of panel 3 saved. Current selection preserved.") and never replaces a selection; only `--use` does. Preview and `--export-doc` change nothing. The next slideshow render picks up the replaced panel and reuses existing audio.

## Cumulative estimate

Estimate the complete selected batch: scene drafting and its panel-count retry, optional generated references, sketches, final images, voice auditions, dialogue/effects, and billable retries. Prepare, panel prompts, review, selection, approval, and slideshow have no provider charge. `sketches` plus `images` and `--target both` are alternatives; one image model per run means each additional model is a separate priced run.

Use each stage's `--price` after its prerequisites exist. A successful preflight with missing artifacts is not a complete quote or readiness proof; missing work must not count as zero. Recompute remaining estimates as choices become known, retaining possibly billed attempts. [Repository spending rules](../../../../AGENTS.md#paid-providers) govern the cumulative batch.

## Runtime Paths

The example stays under `runtime/examples/harborlight-comic/`; unpinned scene runs use `output/<timestamp>_<scene-slug>/`. `metadata/` holds structure, prompts, scene, panel prompts, and review files; references remain in the chosen catalog roots. `panels/panel-NN.png`, `audio/final/`, and `presentation/final/` hold selected outputs; `panels/<run-id>/`, `pages/<run-id>/`, and `sketches/<run-id>/` hold run candidates. Generation reads current canonical references directly, so reference-only updates do not require new prompt bundles.

Preserve interrupted runs and paid audio. [`resume <run-directory> --price`](../../00-setup-and-utilities/resume.md#comic-recovery) inspects recorded work; `resume` restores its choices and reuses completed outputs.

## Supported Models

Images use OpenAI, Gemini, or Grok; the default is `gpt-image-2.6-flare`. Text defaults to `gpt-6.1-sol`. Audio defaults to the cheapest hosted TTS target. Current catalogs: [image](../image/overview.md), [write](../../03-write/overview.md), [TTS](../../04-audio/tts/overview.md).

## Command Docs

[draft-treatment](./07-draft-treatment.md) · [draft-scenes](./01-draft-scenes.md) · [reference-sketch](./02-reference-sketch.md) · [generate-images](./03-generate-images.md) · [review](./06-review.md) · [generate-audio](./04-generate-audio.md) · [generate-slideshow](./05-generate-slideshow.md)
