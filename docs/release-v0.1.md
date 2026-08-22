# AutoShow Bun CLI v0.1 Release

This release note explains what AutoShow is, what ships in v0.1, and how to start using the Bun CLI.

Provider selectors and examples track the current CLI. Model catalogs are refreshed often, so use the command documentation and `--help` for the authoritative model list.

## Outline

- [Release Basics](#release-basics)
- [Pipeline Commands](#pipeline-commands)
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
- [Setup and Utilities](#setup-and-utilities)
  - [setup](#setup)
  - [config](#config)
  - [links](#links)
  - [resume](#resume)
  - [help and version](#help-and-version)
- [Shared Runtime Behavior](#shared-runtime-behavior)
- [Output Layout](#output-layout)

## Release Basics

AutoShow is a Bun-native, pipeline-oriented CLI with one command-first entrypoint:

```bash
bun autoshow <command> [input] [flags]
```

Pipeline commands run as Step 0 through Step 9. Setup and utility commands cover installation, configuration, provider-doc fetching, resumability, and CLI discovery.

Use the [command overview](./commands.md) for the full command map, selection guide, and pricing preflight examples.

Artifact-producing runs write timestamped directories under `output/` with generated files, provider and model choices, timing, and cost metadata where available.

## Pipeline Commands

Each section summarizes the step, links to the command docs, and shows one representative example.

### Step 0: metadata

[`metadata`](./commands/process-steps/step-0-metadata/metadata.md) inspects source metadata without downloading the source. It accepts media files and URLs, documents, images, HTML, URL lists, X Spaces, feeds, channels, and directories. It prints JSON by default, Markdown with `--markdown`, and can save a run directory with `--save`.

Example:

```bash
bun autoshow metadata input/examples/document/1-document.pdf
```

### Step 1: download

[`download`](./commands/process-steps/step-1-download/download-file.md) fetches or stages a source and stops before extraction. Media and X Space runs save audio or best-quality video; document, image, and article runs save the source plus `manifest.json`.

Example:

```bash
bun autoshow download input/examples/document/1-document.pdf
```

### Step 2: extract

[`extract`](./commands/process-steps/step-2-extract/01-extract.md) transcribes media, OCRs documents and images, extracts articles, and reports on X Spaces without running hosted LLM writing. Outputs include transcripts or extraction text, optional transcript videos, and `manifest.json`.

Example:

```bash
bun autoshow extract input/examples/document/1-document.pdf --format json
```

### Step 3: write

[`write`](./commands/process-steps/step-3-write/write-text.md) runs extraction, then generates hosted LLM text from a prompt. There is no local LLM; omitting `--llm` selects the cheapest hosted model. Typical outputs are `text.json` plus optional rendered Markdown and show notes.

Example:

```bash
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3
```

### Step 4: tts

[`tts`](./commands/process-steps/step-4-tts/text-to-speech-and-voice.md) generates speech from local `.md` or `.txt` files using hosted TTS providers. Runs write `speech.wav` and `manifest.json`.

Example:

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15
```

### Step 5: image

[`image`](./commands/process-steps/step-5-image/text-to-image.md) generates images from text prompts and runs supported edit and reference workflows. Default runs write `generated-image.png` (or the selected format) plus `manifest.json`.

Example:

```bash
bun autoshow image "a premium product photo of a mountain observatory brochure" --provider bfl=flux-2-klein-4b --size 1024x1024
```

### Step 6: video

[`video`](./commands/process-steps/step-6-video/text-to-video-services.md) generates hosted `.mp4` videos from text prompts, images, references, or input-video modes. Default runs write `generated-video.mp4` plus `manifest.json`.

Example:

```bash
bun autoshow video "animate the product on a slow turntable" --provider ltx=ltx-2-3-fast --mode image-to-video --input-image output/mug-base/generated-image.png
```

### Step 7: music

[`music`](./commands/process-steps/step-7-music/text-to-music-services.md) either generates hosted `.mp3` music from prompts or renders local lyric videos from audio files.

Examples:

```bash
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3
bun autoshow music "bright 90s pop rock with a huge chorus" --provider gemini=lyria-3-pro-preview
```

### Step 8: comic

[`comic`](./commands/process-steps/step-8-comic/00-comic-overview.md) turns episode scripts into staged comic workflows: scene drafts, character and location references, panel and page images, dialogue and soundscape audio, and slideshows. Scripts live under `input/scripts/`; scene runs write `output/<timestamp>_<scene-slug>/`.

Example:

```bash
bun autoshow comic draft-scenes 05-01
```

### Step 9: voice

[`voice`](./commands/process-steps/step-9-voice/00-voice-overview.md) lists and registers provider voices without synthesizing speech. `comic reference-voice` is the comic-native alias. Registrations live under `input/characters/`.

Example:

```bash
bun autoshow voice import hero --provider elevenlabs --model eleven_v3 --voice-id hpp4J3VqNfWAUOO0d1Us --provenance-ref project:casting
```

## Setup and Utilities

These commands support the pipeline but are not process steps.

### setup

[`setup`](./commands/setup-and-utilities/setup/setup.md) installs local runtimes, downloads local models, and verifies prerequisites with `--doctor`.

Examples:

```bash
bun autoshow setup --doctor
bun autoshow setup
bun autoshow setup --models base
```

### config

[`config`](./commands/setup-and-utilities/config-command/config.md) inspects or persists defaults in `config/autoshow.json`, including provider and model choices, generation options, pricing thresholds, and cookie authentication.

Examples:

```bash
bun autoshow config --show
bun autoshow config --llm openai=gpt-5.4-mini --stt whisper=base --max-cents 50
bun autoshow config --reset
```

### links

[`links`](./commands/setup-and-utilities/links/links.md) fetches curated provider documentation into a timestamped run directory under `output/`.

Example:

```bash
bun autoshow links stt
```

### resume

[`resume`](./commands/setup-and-utilities/resume/resume.md) fills missing provider outputs in an existing run directory that contains `manifest.json`.

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
- Configured `max-cents` values act as hard budgets. `--allow-over-budget` is a one-off override.
- Batch runs support limits, ordering, and configurable item concurrency.
- Provider and model flags are repeatable. `--all-providers` and `--all-local` fan out across supported routes.

See [Pricing Preflight](./commands.md#pricing-preflight) and the individual command docs for provider-specific pricing behavior.

## Output Layout

Most artifact-producing commands write a timestamped directory under `output/` with one `manifest.json`. Utility commands such as `config` and `setup` update shared state. `links` writes a combined markdown bundle into a timestamped `output/` run directory.

See [Types, Metadata & Output Layout](./diagrams/05-types-and-output.md) for the full layout.
