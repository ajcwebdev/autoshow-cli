# setup

Install local runtimes and prerequisite tools. Focused setup utilities also cover model pre-downloads (`--models`).

## Outline

- [Step Setup Docs](#step-setup-docs)
- [Global Setup Command](#global-setup-command)
- [Disk and Network Requirements](#disk-and-network-requirements)
- [Doctor](#doctor)
- [YouTube Cookies](#youtube-cookies)
- [Targeted Setup Steps](#targeted-setup-steps)
- [Model Downloads](#model-downloads)

## Step Setup Docs

- Step 2 Extract: [`01-extract.md`](../../process-steps/step-2-extract/01-extract.md) — [STT setup](../../process-steps/step-2-extract/02-extract-stt.md#stt-setup) | [OCR setup](../../process-steps/step-2-extract/03-extract-ocr.md#ocr-setup) | [URL setup](../../process-steps/step-2-extract/04-extract-url.md#url-setup)
- Step 3 Write: [`write-text.md#setup`](../../process-steps/step-3-write/write-text.md#setup)
- Step 4 TTS: [`text-to-speech-and-voice.md#setup`](../../process-steps/step-4-tts/text-to-speech-and-voice.md#setup)
- Step 5 Image: [`text-to-image.md#setup`](../../process-steps/step-5-image/text-to-image.md#setup)
- Step 6 Video: [`text-to-video-services.md`](../../process-steps/step-6-video/text-to-video-services.md) for env/setup notes
- Step 7 Music: [`text-to-music-services.md`](../../process-steps/step-7-music/text-to-music-services.md) for env/setup notes

## Global Setup Command

```bash
bun autoshow setup
```

Use full setup on a clean machine when you want local download, OCR, STT, or write workflows to work without manually installing their prerequisites first.

## Disk and Network Requirements

A full `bun autoshow setup` downloads several gigabytes and builds a number of tools from source. Budget roughly **10 GB free** and expect 5-10 minutes on a fast connection. A re-run with everything already installed takes a few seconds.

Setup writes to four places, not just the repo:

| Location | Holds | Approx. size |
| --- | --- | --- |
| `runtime/` | Managed binaries, Python envs, and local STT models | ~7 GiB |
| `~/.cache/uv` (macOS and Linux) | uv's shared Python package cache | ~2.5 GB |

Notes:

- The Setup Summary prints the current `runtime/` size under the `disk` row, in the same units as `du -h`.
- Installs created before the Whisper CoreML pipeline was retired may retain `runtime/bin/whisper-coreml-env` and encoder directories under `runtime/models/whisper`. Full setup reports those legacy artifacts and their sizes as safe to delete.
- `runtime/build` holds only transient source trees. Each installer removes its own tree on success, and a full setup prunes whatever is left over.
- Downloads stream to a `<file>.part` alongside the destination and resume from there, so an interrupted transfer does not restart from zero. Large assets abort only after **60 seconds with no bytes received**, not after a fixed total transfer time, so a slow connection does not by itself cause a failure.
- At most three downloads transfer at once. Setup starts eight tasks in parallel, and letting all of them pull at once divides the connection rather than finishing anything sooner.
- Every 30 seconds, any step still running and not already printing its own progress is listed on a single `Still running:` line, so a long source build is distinguishable from a hang without burying the rest of the output.
- The Setup Step Timings table reports **concurrent wall clock**. Tasks run in parallel and contend, so a step's figure there can be far above what the same step costs alone via `--step`.
- Every full setup writes a schema-versioned phase artifact under `runtime/setup-performance/`. It records relative build-phase timestamps, compile overlap, task timings, pinned versions, and non-sensitive host facts; use verbose logging to print the detailed phase table.

## Doctor

Check prerequisites, API keys, and configuration without installing anything:

```bash
bun autoshow setup --doctor
```

Doctor also reports YouTube cookie state separately:

- active mode: `cookies-file`, `cookies-from-browser`, or `none`
- cookie-file readability when `bun autoshow config --cookies` is configured

## YouTube Cookies

If YouTube starts challenging anonymous `yt-dlp` requests, configure cookies using the step-by-step guide in [docs/cookies.md](../../../cookies.md).

The same precedence rules apply everywhere in the CLI:

1. `bun autoshow config --cookies <file>` wins when it is set and readable.
2. Otherwise `bun autoshow config --cookies-from-browser <browser>` is used.
3. If a cookies file is configured but unreadable, AutoShow warns and does not fall back silently.

## Targeted Setup Steps

The `setup` command currently supports:

```text
uv | yt-dlp | defuddle | whisper-binary | whisper-model | whisperfile | calibre | acsm | acsm-authorize | all | transcription | write | tts | image | video | music
```

Isolated steps assume their prerequisites are already present. On a clean machine, prefer `bun autoshow setup`.

```bash
# Shared foundation for managed local tools
bun autoshow setup --step uv

# Step 1 download: yt-dlp for media inputs
bun autoshow setup --step yt-dlp

# Step 1/2 document inputs: mutool, Calibre ebook-convert, and ACSM fulfillment wrapper
bun autoshow setup --step calibre

# ACSM fulfillment only: Calibre ACSM plugin scripts + wrapper + Python env
bun autoshow setup --step acsm

# ACSM authorization: creates local activation files for fulfillment
bun autoshow setup --step acsm-authorize

# Step 2 extract: local URL article extraction
bun autoshow setup --step defuddle

# Step 2 extract: build whisper.cpp binary only
bun autoshow setup --step whisper-binary

# Step 2 extract: download the default Whisper model only
bun autoshow setup --step whisper-model

# Step 2 extract: download the default whisperfile model (tiny)
bun autoshow setup --step whisperfile

# Step 2 extract: download large-v3-turbo
bun autoshow setup --step transcription

# Step 3 write: check hosted LLM API-key readiness
bun autoshow setup --step write

# Step 4 TTS: check hosted TTS API-key readiness
bun autoshow setup --step tts

# Step 5 image: check hosted provider API-key readiness
bun autoshow setup --step image

# Step 6 video: check hosted provider API-key readiness
bun autoshow setup --step video

# Step 7 music: check hosted music API-key readiness, verify ffmpeg/ffprobe, ensure whisper-cli, and download large-v3-turbo for lyric-video rendering
bun autoshow setup --step music
```

## Model Downloads

```bash
# Download a Whisper or whisperfile model without running inference
bun autoshow setup --models base
bun autoshow setup --models whisperfile:small

# The whisperfile: prefix disambiguates model names that overlap with Whisper (tiny, small, medium); an optional whisper: prefix is also accepted.
bun autoshow setup --models whisperfile:large-v3
```

Supported whisperfile models: `tiny`, `tiny.en`, `small`, `small.en`, `medium`, `medium.en`, `large-v2`, `large-v3`.
