# setup

Install local tools, download STT models, inspect readiness, or save defaults. Run these modes separately: configuration flags skip installation, `--models` downloads without inference, and `--strict` requires `--doctor`. [Docker network diagnostics](../../docker.md#docker-only-network-diagnostic) are another separate mode.

## Usage

```bash
bun autoshow setup
```

macOS builds managed FFmpeg, MuPDF, qpdf, and Tesseract under `runtime/` and extracts Calibre. Install Xcode command-line tools and these host prerequisites first:

```bash
brew install cmake imagemagick pango fontconfig font-dejavu
```

Linux installs missing core tools through `sudo apt`; install rendering prerequisites separately:

```bash
sudo apt-get install imagemagick pango1.0-tools fontconfig fonts-dejavu-core
```

ImageMagick needs TIFF support. Lyric rendering needs FFmpeg `ass` or Pango. Binary precedence is `--bin-dir`, managed tools, then `PATH` on non-macOS hosts; macOS does not fall back to `PATH` for managed tools.

## Disk and Network Requirements

Allow roughly 10 GB for tools and default whisperfile `tiny`; larger models need more. Cold macOS setup includes compilation. Re-runs reuse healthy assets, and interrupted downloads resume. Linux system packages remain system-installed.

## Doctor

```bash
bun autoshow setup --doctor
bun autoshow setup --doctor --strict
```

Doctor checks tools, assets, configuration, cookie readability, and API-key presence without installation or live provider calls. Warnings are advisory unless `--strict`, which exits 2 on any readiness warning. Missing optional, unselected keys do not fail strict mode. Native invocations load working-directory `.env`; exported variables win. [Docker injects credentials explicitly](../../docker.md#provider-credentials).

## Runtime Environment Overrides

Provider credentials are listed in `.env.example`. Export overrides before starting the CLI:

- `AUTOSHOW_PROJECT_ROOT` relocates managed tools, mutable runtime storage, and project-relative identity/path helpers. It does not change configuration-file discovery; use `--config-path` for that. `--bin-dir` changes only binary lookup.
- `AUTOSHOW_OCR_PAGE_REQUEST_TIMEOUT_MS` sets the hosted per-page OCR deadline: integer `1–900000` ms, default `300000`. Whole-document deadlines are separate.
- `AUTOSHOW_SOURCE_IDENTITY_ROOT` and `AUTOSHOW_SOURCE_IDENTITY_ALIAS` must be paired: an absolute local root and normalized absolute POSIX alias without traversal. They map recorded source identities without changing file access.

See [payload limits](../../docker.md#large-provider-responses), [shared budgets](usage.md#shared-runtime-budget), and [internal process-state policy](../../adr/ADR-004-setup-toolchain-and-runtime-configuration.md) for other environment contracts.

## Targeted Setup Steps

`--step` accepts `yt-dlp`, `defuddle`, `whisperfile`, `calibre`, `all`, `transcription`, or `music`. Isolated steps assume prerequisites exist. `--force-redownload` removes and reinstalls that step's managed artifacts.

```bash
bun autoshow setup --step whisperfile
bun autoshow setup --step whisperfile --force-redownload
```

## Model Downloads

Default setup, `--step whisperfile`, and `--step transcription` install only whisperfile `tiny`; `--step music` installs `small.en`. Explicitly selected missing models can download during transcription.

```bash
bun autoshow setup --models tiny.en --models whisperfile:small.en
bun autoshow setup --models whisperfile:medium --models whisperfile:large-v3
```

Bare names and `whisperfile:<model>` are equivalent. Use `setup --help` for the current model list.

## Setting Defaults and Configuration

Defaults normally live in `config/autoshow.json` beneath the nearest ancestor with `package.json`, or the working directory if none exists. `--config-path` overrides discovery. These operations save/read configuration without installing tools:

```bash
bun autoshow setup --show
bun autoshow setup --reset
bun autoshow setup --llm openai=gpt-6-luna
bun autoshow setup --stt whisperfile=small.en
bun autoshow setup --ocr tesseract --ocr-language eng --ocr-dpi 300
bun autoshow setup --tts elevenlabs=eleven_v3 --tts-speaker Host=voice_host --tts-speaker Guest=voice_guest --step-concurrency tts-chunk=3
bun autoshow setup --image openai=gpt-image-2.5-flare
bun autoshow setup --batch-limit 20 --batch-order oldest --batch-concurrency 2
bun autoshow setup --concurrency-mode immediate
bun autoshow setup --prompt shortSummary --prompt longChapters
bun autoshow setup --max-cents 100
```

Provider selectors are repeatable; multiple models of one provider retain first-seen order:

```bash
bun autoshow setup --llm openai=gpt-6.1-sol --llm openai=gpt-6-luna
```

## Config Schema

Model fields are arrays. This representative sample uses the strict current schema:

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

Edit image/video/music tuning fields such as `duration` directly in JSON; setup's selectors persist provider/model choices. Gemini transport and remote-job wait controls belong on individual `tts` invocations.

## Persisted Defaults and Precedence

Explicit CLI flags override saved configuration, which overrides native defaults. Built-in flag defaults never erase saved values. Any runtime provider selector replaces that family's configured provider selections rather than merging them.

Set article defaults through `defaults.extract.url.provider` (`defuddle`, `spider`, or `zyte`); setup has no `--url-provider`. `metadata` and `download` accept that flag at runtime.

Generic TTS controls use bare values with one selected provider or `provider=value` with several. Single-speaker `--tts-voice` and multi-speaker `--tts-speaker` are mutually exclusive; JSON uses `voice` or `ttsSpeakers`, optionally `ttsDialogueFormat`. A saved dialogue format without speaker mappings is inert and warns. Create/clone voices with [voice management](../04-audio/voice/00-voice-overview.md).

Cookie settings store only a path or browser name, never cookie contents; see [YouTube cookies](cookies.md). Prompt `default` expands to `shortSummary`, `longSummary`, and `longChapters`. Hosted `ramp` admission starts gradually; `immediate` starts at the configured cap.

### Pricing and Budgets

`--max-cents` blocks execution when the estimate exceeds the saved limit. `--allow-over-budget` overrides that estimate gate for one invocation and is never persisted; it does not cap actual provider charges or bypass [shared runtime budgeting](usage.md#shared-runtime-budget).
