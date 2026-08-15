# AutoShow Bun CLI v0.1 Release

This release note explains what AutoShow is, what ships in v0.1, and how to start using the Bun CLI.

Current CLI help in this repo reports `bun autoshow v0.1.0`; this document uses `v0.1` as the release label.

## Outline

- [Release Basics](#release-basics)
- [process-steps](#process-steps)
  - [Step 0: metadata](#step-0-metadata)
  - [Step 1: download](#step-1-download)
  - [Step 2: extract](#step-2-extract)
  - [Step 3: write](#step-3-write)
  - [Step 4: tts](#step-4-tts)
  - [Step 5: image](#step-5-image)
  - [Step 6: video](#step-6-video)
  - [Step 7: music](#step-7-music)
  - [Step 8: comic](#step-8-comic)
- [setup-and-utilities](#setup-and-utilities)
  - [setup](#setup)
  - [config](#config)
  - [links](#links)
  - [resume](#resume)
  - [benchmark](#benchmark)
  - [voice](#voice)
  - [help and version](#help-and-version)
- [Shared Runtime Behavior](#shared-runtime-behavior)
- [Manifests And Output Layout](#manifests-and-output-layout)

## Release Basics

AutoShow is a Bun-native, pipeline-oriented CLI with one command-first entrypoint:

```bash
bun autoshow <command> [input] [flags]
```

AutoShow currently exposes 15 named commands, plus built-in `help` and `version`. The named commands are split into two groups:

- `process-steps`: the ordered pipeline commands, Step 0 through Step 8.
- `setup-and-utilities`: setup, configuration, provider-doc fetching, resumability, voice management, benchmarking, and CLI discovery.

Use the [command overview](./commands.md) for the full command map and selection guide.

Artifact-producing runs write timestamped output directories with generated files, provider/model choices, timing, and cost metadata where available.

## process-steps

Process-step commands are ordered by pipeline step number. Each section below summarizes the step purpose, primary inputs and providers, key outputs, one representative example, and the detailed command docs.

### Step 0: metadata

[`metadata`](./commands/process-steps/step-0-metadata/metadata.md) inspects inputs and source metadata without downloading the source.

- Primary inputs/providers:
  - media files or URLs such as `.mp3`, `.mp4`, `.wav`, and `.webm`, plus YouTube, Twitch, and TikTok URLs
  - documents such as `.pdf`, `.epub`, `.acsm`, `.mobi`, `.azw3`, `.docx`, `.pptx`, `.xlsx`, `.rtf`, `.csv`
  - images such as `.png`, `.jpg`, `.jpeg`, `.tif`, `.tiff`, `.webp`, `.bmp`, `.gif`, and `.cbz`
  - local `.html` / `.htm`, URL-list `.md` / `.txt`, X Space/post URLs, raw Space IDs, directories, RSS/podcast feeds, and YouTube channels
- Key outputs:
  - terminal JSON metadata by default, or Markdown frontmatter YAML with `--markdown`
  - saved `output/YYYY-MM-DD_HH-MM-SS_title/manifest.json` with `--save`
  - saved `output/YYYY-MM-DD_HH-MM-SS_title/metadata.md` with `--save --markdown`
  - target classification details and source metadata in the displayed or saved metadata

Example:

```bash
bun autoshow metadata input/examples/document/1-document.pdf
```

### Step 1: download

[`download`](./commands/process-steps/step-1-download/download-file.md) fetches or normalizes media files, X Space audio, document/image files, and article/HTML inputs, then stops before extraction or writing.

- Primary inputs/providers:
  - media files or URLs such as `.mp3`, `.mp4`, `.wav`, and `.webm`, plus YouTube, Twitch, TikTok, RSS/podcast, and channel sources
  - documents such as `.pdf`, `.epub`, `.acsm`, `.mobi`, `.azw3`, `.docx`, `.pptx`, `.xlsx`, `.rtf`, `.csv`
  - images such as `.png`, `.jpg`, `.jpeg`, `.tif`, `.tiff`, `.webp`, `.bmp`, `.gif`, and `.cbz`
  - local `.html` / `.htm`, remote HTML/article URLs, URL-list `.md` / `.txt`, X Space/post URLs, raw Space IDs, and directories
- Key outputs:
  - media runs under `output/YYYY-MM-DD_HH-MM-SS-mmm_title/` with `<audio>.mp3|.m4a|.ogg|.flac` plus `manifest.json`
  - X Space audio downloads under the same run directory with `<audio>.mp3|.m4a|.ogg|.flac` plus `manifest.json`
  - best-quality streaming media under the same run directory as `.mkv`, `.mp4`, or `.webm` plus `manifest.json`
  - document, image, and article runs under `output/YYYY-MM-DD_HH-MM-SS-mmm_title/` with source metadata in `manifest.json`
  - batch runs under `output/YYYY-MM-DD_HH-MM-SS-mmm_batch-label/` with one canonical `manifest.json`; its optional `source` object owns source inventory and its `items` own per-item output paths and state

Example:

```bash
bun autoshow download input/examples/document/1-document.pdf
```

### Step 2: extract

[`extract`](./commands/process-steps/step-2-extract/01-extract.md) is the no-LLM extraction step. It routes inputs to the right extraction path and writes extraction artifacts without running Step 3 writing.

- Primary inputs/providers:
  - media files or URLs such as `.mp3`, `.mp4`, `.wav`, and `.webm` through local or hosted STT, captions, or X Space routes
  - documents such as `.pdf`, `.epub`, `.acsm`, `.mobi`, `.azw3`, `.docx`, `.pptx`, `.xlsx`, `.rtf`, `.csv` through OCR or native extraction
  - images such as `.png`, `.jpg`, `.jpeg`, `.tif`, `.tiff`, `.webp`, `.bmp`, `.gif`, and `.cbz` through OCR
  - local `.html` / `.htm`, remote HTML/article URLs, URL-list `.md` / `.txt`, X Space/post URLs, raw Space IDs, and directories
- Key outputs:
  - media STT runs under `output/YYYY-MM-DD_HH-MM-SS_title/` with `transcription.txt`, a raw domain `result.json`, and `manifest.json`; multi-provider results use `providers/<service>-<model>/`
  - document/image OCR runs under the timestamped output directory with `extraction.txt` or a raw domain `result.json`, `manifest.json`, and optional `chapters/` or `chunks/`
  - article extraction runs under `output/YYYY-MM-DD_HH-MM-SS_article/` with `extraction.txt`, a raw domain `result.json`, `extraction.tsv`, or `extraction.hocr`, plus `manifest.json`
  - X Space runs under the timestamped output directory with a raw domain `result.json`, `extraction.md`, and `manifest.json`
  - transcript-video renders with `<label>.mp4`, `<label>.vtt`, `<label>.srt`, and `manifest.json`
  - comparison/consensus flows can add `consensus-extraction.txt`, `provider-comparison-report.md`, and `provider-comparison-report.json`

Example:

```bash
bun autoshow extract input/examples/document/1-document.pdf --format json
```

### Step 3: write

[`write`](./commands/process-steps/step-3-write/write-text.md) runs the full extraction plus prompt-rendering and JSON LLM-output pipeline.

- Primary inputs/providers:
  - routed media, document, image, article, and batch inputs accepted by `extract`, including `.mp3`, `.mp4`, `.wav`, `.webm`, `.pdf`, `.epub`, `.acsm`, `.docx`, `.png`, `.jpg`, `.html`, `.md`, and `.txt`
  - raw local `.md` / `.txt` files and raw text directories when `--text-input` or the project text convention is used
  - project lyric draft inputs under `./output/<name>/text/` with `prompt.md` (or `--prompt-file`) and optional `tracks.md`
  - prompt families for summaries, chapters, marketing, social copy, creative writing, and song lyrics
  - hosted LLM providers and local llama.cpp or llamafile
- Key outputs:
  - timestamped write run directory under `output/` with `prompt.md` and `manifest.json`
  - single-target JSON output as `text.json`; multi-target JSON output as `text-<model>.json`
  - rendered Markdown as `text.md` / `text-<model>.md` when `--rendered-text` is set
  - show-note Markdown as `show-note.md` / `show-note-<model>.md`
  - project lyric draft Markdown under `./output/<name>/lyrics/` when that mode is used
  - comparison artifacts such as `provider-comparison-report.json` and `provider-comparison-report.md` where comparison flows generate them

Example:

```bash
bun autoshow write ./output/demo/text --prompt rockSong
```

### Step 4: tts

[`tts`](./commands/process-steps/step-4-tts/text-to-speech-and-voice.md) generates speech audio from local `.md` or `.txt` files.

- Primary inputs/providers:
  - local Markdown or plaintext files: `.md` and `.txt`
  - local Kitten TTS and hosted TTS providers
- Key outputs:
  - single-target runs under `./output/<timestamp>_<label>/` with `speech.wav` and `manifest.json`
  - multi-target runs with `speech-<service>-<sanitized-model>.wav` files plus `manifest.json`
  - dialogue runs with `dialogue-normalized.txt`, per-turn `.wav` files under `segments/`, final `speech.wav`, and `manifest.json`

Example:

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider kitten=kitten-tts-mini
```

### Step 5: image

[`image`](./commands/process-steps/step-5-image/text-to-image.md) generates images from text prompts and runs supported `.png` / `.jpg` / `.webp` edit/reference workflows.

- Primary inputs/providers:
  - text prompts
  - optional edit/reference images such as `.png`, `.jpg`, `.jpeg`, and `.webp` where the selected provider supports them
  - hosted image generation and editing providers
- Key outputs:
  - default run directory `output/<timestamp>_image-gen/`, or the exact directory passed with `--output-dir`
  - generated image files such as `generated-image.png`, `generated-image.jpg`, or `generated-image.webp`
  - multi-provider files named like `generated-image-<provider>-<model>.<ext>`
  - `manifest.json` with image, cost, and timing data in the canonical item's metadata

Example:

```bash
bun autoshow image "a premium product photo of a mountain observatory brochure" --provider recraft=recraftv4_1 --aspect-ratio 1:1
```

### Step 6: video

[`video`](./commands/process-steps/step-6-video/text-to-video-services.md) generates hosted `.mp4` videos from text prompts, image inputs, references, or input-video modes.

- Primary inputs/providers:
  - text prompts
  - input/reference images such as `.png`, `.jpg`, `.jpeg`, and `.webp` for image-to-video, reference-to-video, or interpolate modes
  - input `.mp4` video files or URLs for extend and edit modes
  - hosted video providers
- Key outputs:
  - default run directory `output/YYYY-MM-DD_HH-mm-ss_video-gen/`, or the exact directory passed with `--output-dir`
  - single-provider video as `generated-video.mp4`
  - multi-provider videos named like `generated-video-<provider>-<model>.mp4`
  - `manifest.json` with video, cost, and timing data in the canonical item's metadata

Example:

```bash
bun autoshow video "animate the product on a slow turntable" --provider ltx=ltx-2-3-fast --mode image-to-video --input-image output/mug-base/generated-image.png
```

### Step 7: music

[`music`](./commands/process-steps/step-7-music/text-to-music-services.md) either generates hosted `.mp3` music from prompts or renders local lyric videos from audio files.

- Primary inputs/providers:
  - text prompts for hosted music generation
  - optional hosted-generation lyrics files such as `.md` or `.txt`
  - local lyric-video audio files: `.wav`, `.mp3`, `.m4a`, `.flac`, `.ogg`, and `.aac`
  - optional caption inputs such as `.vtt` for lyric-video rerenders
  - hosted music providers plus local Whisper captions and ffmpeg for lyric videos
- Key outputs:
  - hosted runs under `output/YYYY-MM-DD_HH-mm-ss_music-gen/` with `generated-music.mp3` and `manifest.json`
  - multi-provider hosted runs with `generated-music-<provider>-<model>.mp3` files plus `manifest.json`
  - lyric-video runs under `output/YYYY-MM-DD_HH-MM-SS-sss_music-lyrics-<stem>/` with `<stem>.mp4`, `<stem>.vtt`, `<stem>.srt`, and `manifest.json`
  - lyric-video batch runs under `output/YYYY-MM-DD_HH-MM-SS-sss_music-lyrics-batch/` with `manifest.json` and per-song directories

Examples:

```bash
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3
bun autoshow music "bright 90s pop rock with a huge chorus" --provider gemini=lyria-3-clip-preview
```

### Step 8: comic

[`comic`](./commands/process-steps/step-8-comic/comic.md) runs staged episode-script-to-comic workflows.

- Primary inputs/providers:
  - episode script Markdown files under `input/scripts/NN-script/*.md`, or strict episode-scene shorthands such as `02-01`
  - character source images under `input/characters/`, typically `.png`, `.jpg`, `.jpeg`, or `.webp`
  - configured writing and image providers for staged comic generation
  - reusable character sketches and panel prompt bundles
- Key outputs:
  - a timestamped `output/<timestamp>_<scene-slug>/` run directory with drafting artifacts under `metadata/` and immutable reference indexes and snapshots under `assets/`
  - review sketches, final panel images, and grouped page `.png` images under that run directory's `sketches/`, `panels/`, and `pages/` subdirectories
  - reusable character and location reference images and their registration catalogs under `input/characters/` and `input/locations/`

```text
output/<timestamp>_<scene-slug>/
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
    character-references/
      <snapshot-id>/
        <character-key>/
    location-references.json
    location-references/
      <snapshot-id>/
    design-references.json           # only when reviewed panels declare design references
    design-references/
      <snapshot-id>/
  panels/
  pages/
  sketches/
```

Example:

```bash
bun autoshow comic draft-scenes 05-01
```

## setup-and-utilities

These commands support the pipeline but are not process steps.

### setup

[`setup`](./commands/setup-and-utilities/setup/setup.md) installs local runtimes and verifies prerequisites.

- Use it for:
  - local runtime installation and doctor checks
  - local model downloads
  - step-specific setup hooks
- Key outputs:
  - installed local tools and model files in their managed setup locations
  - terminal doctor report for prerequisites, API keys, and `config/autoshow.json`

Examples:

```bash
bun autoshow setup --doctor
bun autoshow setup
bun autoshow setup --models base
```

### config

[`config`](./commands/setup-and-utilities/config/config.md) inspects, resets, or persists selected defaults in `config/autoshow.json`.

- Persisted defaults include:
  - provider/model and prompt defaults
  - batch and concurrency controls
  - generation options for text, speech, image, video, and music
  - pricing thresholds
- Key outputs:
  - JSON defaults written to `config/autoshow.json`
  - terminal JSON/config display with `--show`

Examples:

```bash
bun autoshow config --show
bun autoshow config --llm openai=gpt-5.4-mini --stt whisper=base
bun autoshow config --image recraft=recraftv4_1 --image-size 1024x1024 --image-count 2
bun autoshow config --max-cents 50
bun autoshow config --reset
```

### links

[`links`](./commands/setup-and-utilities/links/links.md) fetches curated provider documentation into local markdown files.

- Use it for:
  - provider documentation snapshots
  - category-wide docs such as STT, OCR, text, TTS, image, video, music, and URL extraction
  - provider-scoped docs and remote documentation URL lists from local `.md` or `.txt` files
- Key outputs:
  - combined provider-doc Markdown at `project/links/<normalized-selection>-links.md`
  - input-file mode output at `project/links/<input-basename>-links.md`

Example:

```bash
bun autoshow links stt
```

### resume

[`resume`](./commands/setup-and-utilities/resume/resume.md) fills missing provider outputs in an existing run, child batch, or parent `extract` batch directory.

- Primary inputs/providers:
  - existing output directories containing the canonical `manifest.json`; both scopes and route-aware extract parent/child manifests use that one shape
  - supported STT, OCR, URL extraction, LLM, TTS, image, video, and music providers
- Key outputs:
  - newly completed provider artifacts added in place to the original `output/<run-or-batch-dir>/` tree
  - updated files matching the original run type, such as `transcription.txt`, `extraction.txt`, `text-<model>.json`, `speech-<provider>-<model>.wav`, `generated-image-<provider>-<model>.<ext>`, `generated-video-<provider>-<model>.mp4`, or `generated-music-<provider>-<model>.mp3`

Example:

```bash
bun autoshow resume ./output/<run-or-batch-dir> --provider deepinfra
```

### benchmark

[`benchmark`](./commands/setup-and-utilities/benchmark/benchmark.md) scores or compares existing outputs and selected benchmark inputs.

- Primary inputs/providers:
  - STT compression/speed benchmark source audio files such as `.mp3`, `.m4a`, `.wav`, `.flac`, `.ogg`, and `.aac`
  - existing TTS run directories with `manifest.json` and speech audio outputs
  - existing write, image, and video run directories with `manifest.json`, `.json`, `.png` / `.jpg` / `.webp` / `.svg`, or `.mp4` outputs
  - configured local or hosted judging providers where a benchmark mode needs them
- Key outputs:
  - STT benchmark output under `output/benchmark/<timestamp>/` with `source.m4a`, variant `.m4a` files, per-service `transcription.txt`, raw benchmark `result.json`, `benchmark-attempt.json`, and final `report.json`
  - TTS reports beside the run as `voice-quality-report.json` and `voice-quality-report.md`
  - text reports beside the run as `provider-comparison-report.json` and `provider-comparison-report.md`
  - image reports beside the run as `image-quality-report.json`, `image-quality-report.md`, `provider-comparison-report.json`, and `provider-comparison-report.md`
  - video reports beside the run as `video-quality-report.json`, `video-quality-report.md`, `provider-comparison-report.json`, and `provider-comparison-report.md`

Example:

```bash
bun autoshow benchmark input/examples/audio/1-audio.mp3 --stt-services whisper
```

### voice

[`voice`](./commands/process-steps/step-4-tts/text-to-speech-and-voice.md#voice) manages durable provider voice registrations separately from speech synthesis.

- Primary inputs/providers:
  - authored character voice briefs in `input/characters/character-voices.json`
  - provider catalog discovery, voice design, instant/professional cloning reference audio, and consent records
  - supported voice providers: ElevenLabs, Hume, MiniMax, Cartesia, Speechify, Mistral, and OpenAI
- Key outputs:
  - durable voice registrations and current selections under `input/characters/`
  - protected voice audition audio, candidate metadata, and consent records in the protected store

Example:

```bash
bun autoshow voice import hero --provider openai --model gpt-4o-mini-tts-2025-12-15 --voice-id cedar --provenance-ref project:casting
```

### help and version

Built-in discovery commands show command help or print the current CLI version.

Examples:

```bash
bun autoshow help <command>
bun autoshow version
```

## Shared Runtime Behavior

Shared runtime behavior applies across multiple process steps:

- Hosted and mixed-provider runs get cost preflight, `--price` estimate-only mode, and budget enforcement.
- Configured `max-cents` values act as hard budgets.
- `--allow-over-budget` provides a one-off override.
- Batch runs support limits, ordering, and configurable item concurrency.
- Provider/model flags are repeatable across STT, OCR, URL extraction, LLM, TTS, image, video, and music.
- `--all-providers` and `--all-local` fan-out modes cover supported routes.
- Per-step provider/local concurrency controls provider fan-out.
- Flag and config resolution project into STT, OCR, URL, LLM, TTS, image, video, music, batch, and pricing option slices. Standalone generation, pricing, and resume consumers receive only their domain slice plus named shared controls; the full media/document write path uses its own composed `ProcessingOptions` boundary.

Root help also exposes shared controls for config paths, verbosity, JSON output, cookies, and model paths.

See [Pricing Preflight](./commands.md#pricing-preflight) and the individual command docs for provider-specific pricing behavior.

## Manifests And Output Layout

Most artifact-producing process-step commands write a timestamped directory under `output/`. Utility commands either update shared state, write docs under `project/`, or add reports beside existing runs.

Every run or batch root owns exactly one unversioned `manifest.json` with `{ command, scope, createdAt, updatedAt, source?, items }`. Single and batch scopes use the same top-level and item shapes; command and scope are ordinary data, not format selectors.

- Every item has `status`, `metadata`, and `providers`, plus input identity, route/output data, and an optional `{ route, index, manifestDir }` child link.
- Every provider entry owns identity, artifact directory, attempts, options, metadata, status, result, and error state. One serialized atomic writer updates this lifecycle; requested, missing, blocked, completion, and batch-summary views are derived instead of persisted beside it.
- Route-aware extract parents and children each use the canonical file. Child links name containment-checked relative directories, never alternate manifest filenames.
- Provider directories contain generated artifacts and optional raw domain `result.json` payloads only. Raw results have no pipeline manifest version or kind and never control resume.
- The reader recognizes only the current canonical shape. Outputs from before the clean break are not probed or migrated and must be rerun.

See [Types, Metadata & Output Layout](./diagrams/05-types-and-output.md) for the full manifest shape.
