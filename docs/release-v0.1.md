# AutoShow Bun CLI v0.1 Release

This release note explains what AutoShow is, what ships in v0.1, and how to start using the Bun CLI.

Provider selectors and examples track the current CLI. Model catalogs are refreshed often, so use the command documentation and `--help` for the authoritative model list.

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
  - [Step 9: voice](#step-9-voice)
- [setup-and-utilities](#setup-and-utilities)
  - [setup](#setup)
  - [config](#config)
  - [links](#links)
  - [resume](#resume)
  - [help and version](#help-and-version)
- [Shared Runtime Behavior](#shared-runtime-behavior)
- [Manifests And Output Layout](#manifests-and-output-layout)

## Release Basics

AutoShow is a Bun-native, pipeline-oriented CLI with one command-first entrypoint:

```bash
bun autoshow <command> [input] [flags]
```

AutoShow currently exposes 14 named commands, plus built-in `help` and `version`. The named commands are split into two groups:

- `process-steps`: the ordered pipeline commands, Step 0 through Step 9.
- `setup-and-utilities`: setup, configuration, provider-doc fetching, resumability, and CLI discovery.

Use the [command overview](./commands.md) for the full command map and selection guide.

Artifact-producing runs write timestamped output directories with generated files, provider/model choices, timing, and cost metadata where available.

## process-steps

Process-step commands are ordered by pipeline step number. Each section below summarizes the step purpose, primary inputs and providers, key outputs, one representative example, and the detailed command docs.

### Step 0: metadata

[`metadata`](./commands/process-steps/step-0-metadata/metadata.md) inspects inputs and source metadata without downloading the source.

- Primary inputs/providers:
  - media files or URLs such as `.mp3`, `.mp4`, `.wav`, and `.webm`, plus YouTube, Twitch, and TikTok URLs
  - documents such as `.pdf`, `.epub`, `.mobi`, `.azw3`, `.docx`, `.pptx`, `.xlsx`, `.rtf`, `.csv`
  - images such as `.png`, `.jpg`, `.jpeg`, `.tif`, `.tiff`, `.webp`, `.bmp`, `.gif`, and `.cbz`
  - local `.html` / `.htm`, URL-list `.md` / `.txt`, X Space/post URLs, raw Space IDs, directories, RSS/podcast feeds, and YouTube channels
- Key outputs:
  - terminal JSON metadata by default, or Markdown frontmatter YAML with `--markdown`
  - saved `output/YYYY-MM-DD_HH-MM-SS-mmm_title/manifest.json` with `--save`
  - saved `output/YYYY-MM-DD_HH-MM-SS-mmm_title/metadata.md` with `--save --markdown`

Example:

```bash
bun autoshow metadata input/examples/document/1-document.pdf
```

### Step 1: download

[`download`](./commands/process-steps/step-1-download/download-file.md) fetches or normalizes media files, X Space audio, document/image files, and article/HTML inputs, then stops before extraction or writing.

- Primary inputs/providers:
  - media files or URLs such as `.mp3`, `.mp4`, `.wav`, and `.webm`, plus YouTube, Twitch, TikTok, RSS/podcast, and channel sources
  - documents such as `.pdf`, `.epub`, `.mobi`, `.azw3`, `.docx`, `.pptx`, `.xlsx`, `.rtf`, `.csv`
  - images such as `.png`, `.jpg`, `.jpeg`, `.tif`, `.tiff`, `.webp`, `.bmp`, `.gif`, and `.cbz`
  - local `.html` / `.htm`, remote HTML/article URLs, URL-list `.md` / `.txt`, X Space/post URLs, raw Space IDs, and directories
- Key outputs:
  - a timestamped run directory under `output/` with `manifest.json`
  - media and X Space audio as `<audio>.mp3|.m4a|.ogg|.flac`, or best-quality streaming media as `.mkv`, `.mp4`, or `.webm`
  - document, image, and article runs with source metadata in `manifest.json`
  - batch runs under `output/YYYY-MM-DD_HH-MM-SS-mmm_batch-label/` with one `manifest.json` covering the batch and each item

Example:

```bash
bun autoshow download input/examples/document/1-document.pdf
```

### Step 2: extract

[`extract`](./commands/process-steps/step-2-extract/01-extract.md) is the no-LLM extraction step. It transcribes media, OCRs documents and images, extracts articles, and writes those artifacts without running Step 3 writing.

- Primary inputs/providers:
  - media files or URLs such as `.mp3`, `.mp4`, `.wav`, and `.webm` through local or hosted STT, captions, or X Space extraction
  - documents such as `.pdf`, `.epub`, `.mobi`, `.azw3`, `.docx`, `.pptx`, `.xlsx`, `.rtf`, `.csv` through OCR or native extraction
  - images such as `.png`, `.jpg`, `.jpeg`, `.tif`, `.tiff`, `.webp`, `.bmp`, `.gif`, and `.cbz` through OCR
  - local `.html` / `.htm`, remote HTML/article URLs, URL-list `.md` / `.txt`, X Space/post URLs, raw Space IDs, and directories
- Key outputs:
  - media STT runs under `output/YYYY-MM-DD_HH-MM-SS-mmm_title/` with `transcription.txt`, `result.json`, and `manifest.json`; multi-provider results use `providers/<service>-<model>/`
  - document/image OCR runs under the timestamped output directory with `extraction.txt` or `result.json`, `manifest.json`, and optional `chapters/` or `chunks/`
  - article extraction runs under `output/YYYY-MM-DD_HH-MM-SS-mmm_title/` with `extraction.txt` or `result.json`, plus `manifest.json`; `--all-providers` writes per-backend artifacts under `providers/<backend>/`
  - X Space runs under the timestamped output directory with `result.json`, `extraction.md`, and `manifest.json`
  - transcript-video renders with `<label>.mp4`, `<label>.vtt`, `<label>.srt`, and `manifest.json`
  - comparison/consensus flows can add `consensus-extraction.txt`, `provider-comparison-report.md`, and `provider-comparison-report.json`

Example:

```bash
bun autoshow extract input/examples/document/1-document.pdf --format json
```

### Step 3: write

[`write`](./commands/process-steps/step-3-write/write-text.md) runs extraction, then generates hosted LLM text from a prompt.

- Primary inputs/providers:
  - routed media, document, image, article, and batch inputs accepted by `extract`, including `.mp3`, `.mp4`, `.wav`, `.webm`, `.pdf`, `.epub`, `.docx`, `.png`, `.jpg`, `.html`, `.md`, and `.txt`
  - local `.md` / `.txt` files and text directories with `--text-input`
  - project lyric draft inputs under `./output/<name>/text/` with `prompt.md` (or `--prompt-file`) and optional `tracks.md`
  - prompt families for summaries, chapters, marketing, social copy, creative writing, and song lyrics
  - hosted LLM providers. Write has no local LLM; omitting `--llm` selects the cheapest hosted model.
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
  - hosted TTS providers
- Key outputs:
  - single-target runs under `./output/<timestamp>_<label>/` with `speech.wav` and `manifest.json`
  - multi-target runs with `speech-<service>-<sanitized-model>.wav` files plus `manifest.json`
  - dialogue runs with `dialogue-normalized.txt`, per-turn `.wav` files under `segments/`, final `speech.wav`, and `manifest.json`

Example:

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15
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
  - `manifest.json` with image, cost, and timing data

Example:

```bash
bun autoshow image "a premium product photo of a mountain observatory brochure" --provider bfl=flux-2-klein-4b --size 1024x1024
```

### Step 6: video

[`video`](./commands/process-steps/step-6-video/text-to-video-services.md) generates hosted `.mp4` videos from text prompts, image inputs, references, or input-video modes.

- Primary inputs/providers:
  - text prompts
  - input/reference images such as `.png`, `.jpg`, `.jpeg`, and `.webp` for image-to-video, reference-to-video, or interpolate modes
  - input `.mp4` video files or URLs for extend and edit modes
  - hosted video providers
- Key outputs:
  - default run directory `output/YYYY-MM-DD_HH-MM-SS-mmm_video-gen/`, or the exact directory passed with `--output-dir`
  - single-provider video as `generated-video.mp4`
  - multi-provider videos named like `generated-video-<provider>-<model>.mp4`
  - `manifest.json` with video, cost, and timing data

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
  - optional caption inputs such as `.vtt` or `.srt` for lyric-video rerenders
  - hosted music providers plus local Whisper captions and ffmpeg for lyric videos
- Key outputs:
  - hosted runs under `output/YYYY-MM-DD_HH-MM-SS-mmm_music-gen/` with `generated-music.mp3` and `manifest.json`
  - multi-provider hosted runs with `generated-music-<provider>-<model>.mp3` files plus `manifest.json`
  - lyric-video runs under `output/YYYY-MM-DD_HH-MM-SS-mmm_music-lyrics-<label>/` with `<label>.mp4`, `<label>.vtt`, `<label>.srt`, and `manifest.json`
  - lyric-video batch runs under `output/YYYY-MM-DD_HH-MM-SS-mmm_music-lyrics-batch/` with `manifest.json` and per-song directories

Examples:

```bash
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3
bun autoshow music "bright 90s pop rock with a huge chorus" --provider gemini=lyria-3-pro-preview
```

### Step 8: comic

[`comic`](./commands/process-steps/step-8-comic/00-comic-overview.md) runs staged episode-script-to-comic workflows.

- Primary inputs/providers:
  - episode script Markdown files under `input/scripts/NN-script/*.md`, or strict episode-scene shorthands such as `02-01`
  - character source images under `input/characters/`, typically `.png`, `.jpg`, `.jpeg`, or `.webp`
  - configured writing, image, and voice providers, plus local FFmpeg for slideshow rendering
  - reusable character sketches and panel prompt bundles
- Key outputs:
  - a timestamped `output/<timestamp>_<scene-slug>/` run directory
  - drafting files under `metadata/`, plus sketches, panel images, and grouped page `.png` images
  - dialogue and soundscape audio under `audio/`, and synchronized slideshows under `presentation/`
  - reusable character and location reference images under `input/characters/` and `input/locations/`

Example:

```bash
bun autoshow comic draft-scenes 05-01
```

### Step 9: voice

[`voice`](./commands/process-steps/step-9-voice/00-voice-overview.md) manages durable provider voice registrations separately from speech synthesis. `comic reference-voice` is the comic-native alias of the same command.

- Primary inputs/providers:
  - authored character voice briefs in `input/characters/character-voices.json`
  - provider catalog discovery, voice design, cloning from reference audio, and consent records
  - supported voice providers: ElevenLabs `eleven_v3`, Inworld `realtime-tts-2`, Fish `s2.1-pro`, Cartesia `sonic-3.5-2026-05-04`, and Speechify `simba-3.2`
- Key outputs:
  - durable voice registrations and current selections under `input/characters/`
  - audition audio, candidate metadata, and consent records in a separate owner-only store, not under ordinary project output

Example:

```bash
bun autoshow voice import hero --provider elevenlabs --model eleven_v3 --voice-id hpp4J3VqNfWAUOO0d1Us --provenance-ref project:casting
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

[`config`](./commands/setup-and-utilities/config-command/config.md) inspects, resets, or persists selected defaults in `config/autoshow.json`.

- Persisted defaults include:
  - provider/model and prompt defaults
  - batch and concurrency controls
  - generation options for text, speech, image, video, and music
  - pricing thresholds
  - cookie authentication for authenticated downloads
- Key outputs:
  - JSON defaults written to `config/autoshow.json`
  - terminal JSON/config display with `--show`

Examples:

```bash
bun autoshow config --show
bun autoshow config --llm openai=gpt-5.4-mini --stt whisper=base
bun autoshow config --image openai=gpt-image-2 --image-size 1024x1024 --image-count 2
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
  - existing output directories containing `manifest.json`
  - supported STT, OCR, URL extraction, LLM, TTS, image, video, and music providers
- Key outputs:
  - newly completed provider artifacts added in place to the original `output/<run-or-batch-dir>/` tree
  - updated files matching the original run type, such as `transcription.txt`, `extraction.txt`, `text-<model>.json`, `speech-<provider>-<model>.wav`, `generated-image-<provider>-<model>.<ext>`, `generated-video-<provider>-<model>.mp4`, or `generated-music-<provider>-<model>.mp3`

Example:

```bash
bun autoshow resume ./output/<run-or-batch-dir> --provider deepinfra
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
- Per-step provider and local concurrency flags control how many providers run at once.

Root help also exposes shared controls for config and output paths, external tool binaries, verbosity, and JSON output.

See [Pricing Preflight](./commands.md#pricing-preflight) and the individual command docs for provider-specific pricing behavior.

## Manifests And Output Layout

Most artifact-producing process-step commands write a timestamped directory under `output/`. Utility commands either update shared state, write docs under `project/`, or add reports beside existing runs.

Every run or batch directory contains one `manifest.json`. Single runs and batches use the same layout. The manifest records the command, items, provider results, and output paths so `resume` can fill in missing work.

Provider subdirectories hold generated artifacts and, for extract runs, an optional `result.json` with the transcription or extraction payload.

See [Types, Metadata & Output Layout](./diagrams/05-types-and-output.md) for the full manifest shape.
