# setup

`setup --network-check serve|probe` runs a local delayed-response fixture or a bounded probe, separately from installation and doctor. It needs no provider credentials. Use `--probe-url http://host.docker.internal:8787 --probe-client rest --delay-seconds 150` to exercise the shared REST transport from Docker; `fetch` and `fetch-no-keepalive` are diagnostic controls. See [Docker-only network diagnostics](../../docker.md#docker-only-network-diagnostic) for readiness, loopback publishing, deadlines, and fixture cleanup.

Install local runtimes and prerequisite tools. Use `--models` to pre-download local STT models without running inference.

`--network-check` cannot be combined with `--models`, `--doctor`, `--strict`, `--step`, or `--force-redownload`. Its `--probe-url`, `--probe-client`, `--delay-seconds`, and `--port` controls require network-check mode. `--strict` requires `--doctor`. `--models` selects model download mode, `--doctor` selects diagnostics, and other invocations use installation mode; help groups these controls separately.

## Outline

- [Usage](#usage)
- [Disk and Network Requirements](#disk-and-network-requirements)
- [Doctor](#doctor)
- [Targeted Setup Steps](#targeted-setup-steps)
- [Model Downloads](#model-downloads)
- [Setting Defaults and Configuration](#setting-defaults-and-configuration)
- [Config Schema](#config-schema)
- [Persisted Defaults and Precedence](#persisted-defaults-and-precedence)
- [Testing](#testing)

## Usage

```bash
bun autoshow setup
```

Use full setup on a clean machine so local download, OCR, STT, and write workflows have their prerequisites installed.

## Disk and Network Requirements

A full `bun autoshow setup` downloads several gigabytes and builds some tools from source. Budget roughly **10 GB free** and expect 5-10 minutes on a fast connection. A re-run with everything already installed takes a few seconds.

Installs live under `runtime/` in the project checkout (~3 GiB of binaries and local STT models). Interrupted downloads resume instead of restarting from zero.

## Doctor

Check prerequisites, configuration, and which provider API keys are set without installing anything:

```bash
bun autoshow setup --doctor
bun autoshow setup --doctor --strict
```

API-key checks are presence-only: doctor reports whether each managed variable is set, not whether the key is valid. Warnings do not change the default exit code. `--strict` exits 2 when a configured default needs a missing provider credential. Doctor does not make live provider calls. It reads `.env` from the working directory; exported environment variables win over file values.

Doctor also reports YouTube cookie configuration and whether a configured cookies file is readable. If YouTube starts challenging anonymous `yt-dlp` requests, configure cookies using [docs/cookies.md](../../cookies.md).

## Targeted Setup Steps

Valid `--step` values:

```text
yt-dlp | defuddle | whisperfile | calibre | all | transcription | music
```

Isolated steps assume their prerequisites are already present. On a clean machine, prefer `bun autoshow setup`.

```bash
# yt-dlp, ffmpeg, and ffprobe
bun autoshow setup --step yt-dlp

# mutool, qpdf, and Calibre ebook-convert
bun autoshow setup --step calibre

# local URL article extraction
bun autoshow setup --step defuddle

# default whisperfile model (tiny)
bun autoshow setup --step whisperfile

# whisperfile tiny and transcription provider configuration
bun autoshow setup --step transcription

# lyric-video tools and whisperfile small.en
bun autoshow setup --step music
```

## Model Downloads

Ordinary setup (`setup`, `setup --step whisperfile`, or `setup --step transcription`) installs only whisperfile `tiny` for local STT. `setup --step music` installs `small.en` after checking the music prerequisites. Missing explicitly selected models can also download on demand during transcription.

Install the four recommended models explicitly with repeatable `--models` flags:

```bash
bun autoshow setup --models tiny --models tiny.en --models small --models whisperfile:small.en
```

Optional larger models remain supported and require explicit selection:

```bash
bun autoshow setup --models whisperfile:medium --models whisperfile:medium.en
bun autoshow setup --models whisperfile:large-v2 --models whisperfile:large-v3
```

Bare names and `whisperfile:<model>` are equivalent. `--models` downloads without inference; all selectors are validated before downloading. The removed `whisper:` prefix and `whisper-binary`/`whisper-model` setup steps are rejected.

## Setting Defaults and Configuration

View or set persistent CLI defaults saved to `config/autoshow.json`:

```bash
bun autoshow setup --show
bun autoshow setup --reset
bun autoshow setup --llm openai=gpt-5.4-mini
bun autoshow setup --stt whisperfile=small.en
bun autoshow setup --stt happyscribe=auto --stt-happyscribe-organization-id org_123
bun autoshow setup --ocr tesseract
bun autoshow setup --ocr mistral=mistral-ocr-2512 --ocr-language eng --ocr-dpi 300
bun autoshow setup --tts elevenlabs=eleven_v3 --tts-voice voice_123
bun autoshow setup --tts hume=octave-2 --tts-speaker Host=voice_host --tts-speaker Guest=voice_guest --tts-chunk-concurrency 3
bun autoshow setup --image openai=gpt-image-2
bun autoshow setup --video ltx=ltx-2-3-fast
bun autoshow setup --batch-limit 20 --batch-order oldest --batch-concurrency 2
bun autoshow setup --concurrency-mode immediate
bun autoshow setup --prompt shortSummary --prompt longChapters
bun autoshow setup --chapters --length 50 --pdf-chapter-mode auto
bun autoshow setup --max-cents 100
bun autoshow setup --cookies-from-browser chrome
bun autoshow setup --cookies /absolute/path/to/runtime/auth/youtube.cookies.txt
```

Default path: `config/autoshow.json` in the project root. Override with `--config-path <path>`.

Passing `--show` prints the effective config. Passing `--reset` clears the config file. Passing configuration flags updates and saves `config/autoshow.json` without running full runtime installation or doctor checks.

`--concurrency-mode ramp` (the native default) starts hosted provider traffic gradually up to the configured cap. `immediate` starts at that cap.

Model selector flags are repeatable. Repeating a provider selector saves all selected models in first-seen order:

```bash
bun autoshow setup --stt deepinfra=openai/whisper-large-v3 --stt deepinfra=openai/whisper-large-v3-turbo
bun autoshow setup --llm openai=gpt-5.5 --llm openai=gpt-5.4-mini
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
        "whisperfile": ["small.en"],
        "speakerCount": 2
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
      "openai": ["gpt-5.4-mini"]
    },
    "tts": {
      "elevenlabsTts": ["eleven_v3"],
      "voice": "voice_123",
      "ttsSpeakers": ["Host=Kore", "Guest=Puck"]
    },
    "image": {
      "openaiImage": ["gpt-image-2"],
      "size": "1024x1024",
      "count": 2
    },
    "video": {
      "ltxVideo": ["ltx-2-3-fast"],
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

Model-selecting fields are arrays of models, not single strings. Use `bun autoshow setup --show` to inspect the file `setup` actually writes.

Image, video, and music tuning keys use the same short vocabulary as their standalone commands inside their namespaced JSON sections. Because names such as `duration` and `format` are ambiguous outside a section, `setup` persists provider/model selectors from CLI flags while these tuning defaults are edited directly in `config/autoshow.json`.

## Persisted Defaults and Precedence

`setup` has no `--url-provider` flag, so set the URL article backend in `config/autoshow.json` as `defaults.extract.url.provider` (`defuddle`, `firecrawl`, `glm-reader`, `spider`, `supadata`, or `zyte`). Once saved, `extract` inherits it like any other default. `metadata` and `download` still take public `--url-provider`.

Generic `--tts-*` options resolve to the selected provider, so they take a bare value when one provider is selected and `provider=value` when several are. Custom-voice provisioning and clone-creation audio files are runtime-only and managed via `voice`; synthesis defaults require an existing provider voice ID.

`--tts-speaker` selects multi-speaker TTS. A saved `--tts-dialogue-format` with no saved `--tts-speaker` is inert: runs that inherit it log a warning and continue as single-speaker.

Cookie auth persists the cookies file path or browser name only. Do not copy cookie-file contents into `config/autoshow.json`.

`default` prompt expansion is `shortSummary + longSummary + longChapters`.

### Precedence

```text
Explicit CLI flags > config file defaults > native CLI defaults
```

Only flags explicitly typed on the command line override config values. Native CLI defaults do not overwrite saved config defaults.

If you type any provider/model selector for a step family at runtime, configured provider selections for that family are replaced instead of merged. For example, passing `--llm openai=...` on `write` suppresses configured Gemini and Anthropic LLM defaults for that run.

### Pricing and Budgets

Set a hard budget with `--max-cents`. Hosted and mixed-provider commands fail before execution when the estimate exceeds that limit. `--allow-over-budget` is a one-off runtime override and is never persisted.

```bash
bun autoshow setup --max-cents 50
```

## Testing

The no-cost `test/test-cases/validation/cli/network-check-contracts.test.ts` covers option validation, readiness, all three clients, bounded failure, and fixture cleanup; `docker-workspace-invocation.test.ts` executes the documented shell function with fake Docker to verify literal arguments, mounts, Linux ownership, environment enforcement, image override, and failure propagation. A real 150-second Docker host-gateway fixture probe is separate container acceptance.

Coverage for the `setup` command, `--doctor`, progress output, and managed downloads.

Safety: this suite is local and no-cost. Downloads are mocked, so nothing here calls a paid or quota-limited provider.

### Quick Start

```bash
bun test test/test-cases/validation/setup/
```

### Price Preflight

Setup has no provider-priced commands, so `--price` and `--budget` do not estimate anything for this suite.

### Related Docs

- [Testing Overview](../testing.md)
