# setup

Install local runtimes and prerequisite tools. Use `--models` to pre-download local STT models without running inference. Use `--doctor` to check readiness without installing. Configuration flags write persistent defaults without running installation.

Run installation, model downloads, diagnostics, and configuration changes separately. `--strict` requires `--doctor`.

For Docker-only network diagnostics (`setup --network-check serve|probe`), see [Docker-only network diagnostics](../../docker.md#docker-only-network-diagnostic).

## Outline

- [Usage](#usage)
- [Disk and Network Requirements](#disk-and-network-requirements)
- [Doctor](#doctor)
- [Targeted Setup Steps](#targeted-setup-steps)
- [Model Downloads](#model-downloads)
- [Setting Defaults and Configuration](#setting-defaults-and-configuration)
- [Config Schema](#config-schema)
- [Persisted Defaults and Precedence](#persisted-defaults-and-precedence)

## Usage

```bash
bun autoshow setup
```

Full setup installs tools for local download, OCR, STT, and article extraction. On macOS, it builds FFmpeg, MuPDF, qpdf, and Tesseract from source; install Xcode command-line tools and CMake first. On Linux, it installs missing core tools through `sudo apt` and keeps downloaded tools and model bundles under `runtime/`.

Full setup also requires host-installed ImageMagick with TIFF support, Fontconfig, and DejaVu Sans. Lyric rendering needs FFmpeg's `ass` filter or Pango. Install these prerequisites before running setup:

```bash
# macOS, with Xcode command-line tools already installed
brew install cmake imagemagick pango fontconfig font-dejavu

# Debian/Ubuntu
sudo apt-get install imagemagick pango1.0-tools fontconfig fonts-dejavu-core
```

## Disk and Network Requirements

A full `bun autoshow setup` downloads local tools and the default whisperfile `tiny` model. Budget roughly **10 GB free** for default setup; larger models need additional space. Cold macOS setup time includes source compilation and depends on the machine as well as network speed. Re-runs reuse healthy installed assets.

Managed installs live under `runtime/` in the project checkout; Linux system packages remain system-installed. Interrupted downloads resume instead of restarting from zero.

## Doctor

Check prerequisites, configuration, and which provider API keys are set without installing anything:

```bash
bun autoshow setup --doctor
bun autoshow setup --doctor --strict
```
Doctor checks API-key presence without live provider calls. Warnings do not change the default exit code. `--strict` exits 2 for readiness warnings, including missing credentials required by configured defaults, invalid configuration, unreadable configured cookies, and unavailable runtimes or model assets. Optional unselected credentials do not fail strict mode. Native invocations read `.env` from the working directory; exported environment variables win over file values. [Docker uses explicit credential injection](../../docker.md#provider-credentials).

Doctor also reports whether configured YouTube cookies are readable. If anonymous `yt-dlp` requests start failing, follow the [YouTube cookies guide](cookies.md).

## Targeted Setup Steps

Valid `--step` values:

```text
yt-dlp | defuddle | whisperfile | calibre | all | transcription | music
```

An isolated step assumes its prerequisites are already present. Add `--force-redownload` to remove and reinstall that step's managed artifacts.

```bash
bun autoshow setup --step whisperfile
bun autoshow setup --step whisperfile --force-redownload
```

## Model Downloads

Ordinary setup (`setup`, `setup --step whisperfile`, or `setup --step transcription`) installs only whisperfile `tiny` for local STT. `setup --step music` installs `small.en`. Missing explicitly selected models can also download on demand during transcription.

Install additional models with repeatable `--models` flags:

```bash
bun autoshow setup --models tiny --models tiny.en --models small --models whisperfile:small.en
```

Larger models require explicit selection:

```bash
bun autoshow setup --models whisperfile:medium --models whisperfile:medium.en
bun autoshow setup --models whisperfile:large-v2 --models whisperfile:large-v3
```
Bare names and `whisperfile:<model>` are equivalent.

## Setting Defaults and Configuration

View or set persistent defaults in `config/autoshow.json`. Override that path with `--config-path`. These flags save the file and skip runtime installation and doctor checks:

```bash
bun autoshow setup --show
bun autoshow setup --reset
bun autoshow setup --llm openai=gpt-6-luna
bun autoshow setup --stt whisperfile=small.en
bun autoshow setup --ocr tesseract
bun autoshow setup --ocr mistral=mistral-ocr-4-1 --ocr-language eng --ocr-dpi 300
bun autoshow setup --tts elevenlabs=eleven_v3 --tts-voice voice_123
bun autoshow setup --tts elevenlabs=eleven_v3 --tts-speaker Host=voice_host --tts-speaker Guest=voice_guest --step-concurrency tts-chunk=3
bun autoshow setup --image openai=gpt-image-2.5-flare
bun autoshow setup --video grok=grok-imagine-video-1.5
bun autoshow setup --batch-limit 20 --batch-order oldest --batch-concurrency 2
bun autoshow setup --concurrency-mode immediate
bun autoshow setup --prompt shortSummary --prompt longChapters
bun autoshow setup --chapters --length 50 --pdf-chapter-mode auto
bun autoshow setup --max-cents 100
bun autoshow setup --cookies-from-browser chrome
bun autoshow setup --cookies /absolute/path/to/runtime/auth/youtube.cookies.txt
```

`--concurrency-mode ramp` (the native default) starts hosted provider traffic gradually up to the configured cap. `immediate` starts at that cap.

Model selector flags are repeatable. Repeating a provider selector saves all selected models in first-seen order:

```bash
bun autoshow setup --stt deepinfra=openai/whisper-large-v3 --stt deepinfra=openai/whisper-large-v3-turbo
bun autoshow setup --llm openai=gpt-6.1-sol --llm openai=gpt-6-luna
```

## Config Schema

Representative JSON shape:

```json
{
  "defaults": {
    "concurrency": {
      "mode": "ramp"
    },
    "extract": {
      "stt": {
        "whisperfile": ["small.en"]
      },
      "ocr": {
        "tesseract": true,
        "ocrLanguage": "eng",
        "dpi": 300,
        "chapters": true,
        "length": 50,
        "pdfChapterMode": "auto"
      }
    },
    "llm": {
      "openai": ["gpt-6-luna"]
    },
    "tts": {
      "elevenlabsTts": ["eleven_v3"],
      "ttsSpeakers": ["Host=voice_host", "Guest=voice_guest"]
    },
    "image": {
      "openaiImage": ["gpt-image-2.5-flare"],
      "size": "1024x1024",
      "count": 2
    },
    "video": {
      "grokVideo": ["grok-imagine-video-1.5"],
      "duration": 8,
      "resolution": "1080p"
    },
    "music": {
      "minimaxMusic": ["music-3.0"],
      "instrumental": true
    },
    "batch": {
      "limit": 5,
      "order": "newest",
      "concurrency": 1
    },
    "prompts": ["shortSummary", "longChapters"]
  },
  "pricing": {
    "maxCents": 100
  },
  "auth": {
    "cookies": "/absolute/path/to/runtime/auth/youtube.cookies.txt",
    "cookiesFromBrowser": "chrome"
  }
}
```

Model-selecting fields are arrays of models, not single strings. Use `bun autoshow setup --show` to inspect the saved file.

Image, video, and music tuning defaults such as `duration` and `format` are edited in `config/autoshow.json`. The `setup` flags for image, video, and music persist the provider and model selectors.

Save a TTS model with `--tts provider=model`. Pass transport mode and remote-job wait controls directly to individual `tts` invocations.

## Persisted Defaults and Precedence

Set the URL article backend in `config/autoshow.json` as `defaults.extract.url.provider` (`defuddle`, `spider`, or `zyte`). `setup` has no `--url-provider` flag. Once saved, `extract` inherits it like any other default. `metadata` and `download` still take `--url-provider` at runtime.

Generic `--tts-*` options resolve to the selected provider, so they take a bare value when one provider is selected and `provider=value` when several are. Use `--tts-voice` for single-speaker synthesis or `--tts-speaker` mappings for multi-speaker synthesis; these cannot be combined. In JSON, use either `voice` or `ttsSpeakers` with an optional `ttsDialogueFormat`. Create or clone voices with [`voice`](../04-audio/voice/00-voice-overview.md).

`--tts-speaker` selects multi-speaker TTS. A saved `--tts-dialogue-format` with no saved `--tts-speaker` is inert: runs that inherit it log a warning and continue as single-speaker.

Cookie auth persists the cookies file path or browser name only. Do not copy cookie-file contents into `config/autoshow.json`.

`default` prompt expansion is `shortSummary + longSummary + longChapters`.

### Precedence

```text
Explicit CLI flags > config file defaults > native CLI defaults
```

A flag overrides the saved value only when you pass it. Built-in defaults do not replace saved config.

If you type any provider/model selector for a step family at runtime, configured provider selections for that family are replaced instead of merged. For example, passing `--llm openai=...` on `write` suppresses configured Gemini and Anthropic LLM defaults for that run.

### Pricing and Budgets

Set a hard budget with `--max-cents`. Hosted and mixed-provider commands fail before execution when the estimate exceeds that limit. `--allow-over-budget` is a one-off runtime override and is never persisted.
