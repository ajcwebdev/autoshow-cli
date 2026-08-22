# setup

Install local runtimes and prerequisite tools. Use `--models` to pre-download local STT models without running inference.

## Outline

- [Step Setup Docs](#step-setup-docs)
- [Global Setup Command](#global-setup-command)
- [Disk and Network Requirements](#disk-and-network-requirements)
- [Doctor](#doctor)
- [YouTube Cookies](#youtube-cookies)
- [Targeted Setup Steps](#targeted-setup-steps)
- [Model Downloads](#model-downloads)

## Step Setup Docs

- Step 2 Extract: [`01-extract.md`](../../process-steps/step-2-extract/01-extract.md) — [STT environment](../../process-steps/step-2-extract/02-extract-stt.md#stt-environment) | [OCR setup](../../process-steps/step-2-extract/03-extract-ocr.md#ocr-setup) | [URL environment](../../process-steps/step-2-extract/04-extract-url.md#url-and-x-environment)
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

Installs live under `runtime/` in the project checkout (~3 GiB of managed binaries and local STT models). Interrupted downloads resume instead of restarting from zero. A slow connection does not fail unless the transfer stalls for 60 seconds with no bytes received.

On macOS, source builds of managed tools (`mupdf`, `qpdf`) target the host's major OS version by default. Export `MACOSX_DEPLOYMENT_TARGET` before running setup to override that target.

## Doctor

Check prerequisites, configuration, and which provider API keys are set without installing anything:

```bash
bun autoshow setup --doctor
bun autoshow setup --doctor --strict
```

API-key checks are presence-only: doctor reports whether each managed variable is set (non-empty), not whether the key is valid. The default doctor is advisory and warnings do not change its exit code. `--strict` exits 2 when a provider credential required by a configured default is missing, which makes the command suitable for a no-cost CI or deployment readiness gate; it does not make live provider calls. Doctor reads `.env` from the working directory; exported environment variables win over file values.

Doctor also reports YouTube cookie state: the active mode (`cookies-file`, `cookies-from-browser`, or `none`) and whether a configured cookies file is readable.

## YouTube Cookies

If YouTube starts challenging anonymous `yt-dlp` requests, configure cookies using [docs/cookies.md](../../../cookies.md).

## Targeted Setup Steps

Valid `--step` values:

```text
yt-dlp | defuddle | whisper-binary | whisper-model | whisperfile | calibre | all | transcription | music
```

Isolated steps assume their prerequisites are already present. On a clean machine, prefer `bun autoshow setup`.

```bash
# Step 1 download: yt-dlp plus managed ffmpeg and ffprobe for media inputs
bun autoshow setup --step yt-dlp

# Step 1/2 document inputs: mutool, qpdf, and Calibre ebook-convert
bun autoshow setup --step calibre

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

Setup test coverage is documented in [Setup Tests](setup-tests.md).
