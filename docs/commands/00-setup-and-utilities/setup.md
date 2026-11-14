# setup

Install local tools, download STT models, inspect readiness, or save defaults. Run these modes separately: configuration flags skip installation, `--models` downloads without inference, and `--strict` requires `--doctor`. [Docker network diagnostics](../../docker.md#docker-only-network-diagnostic) are another separate mode.

## Usage

```bash
bun autoshow setup
```

Setup owns the local toolchain beneath `runtime/`: executables, native libraries, build helpers, fonts, trained data, models, package installations, caches, locks, and temporary workspaces. Source files, frozen dependency manifests, authored inputs, and requested outputs retain their established locations.

The source checkout's default `bun install` post-install step moves the application package graph into `runtime/tools/project-dependencies/node_modules` and keeps a relative `node_modules` lookup link at the project root. `--ignore-scripts` opts out of that hook; maintainers using it must invoke `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 bun --no-env-file src/tools/project-runtime-dependencies.ts` before source CLI commands. Dependency verification reads the frozen graph and runtime manifest without installing packages. Maintained source launch scripts disable Bun's startup transpiler cache; direct source invocations need the same environment setting to avoid the host's default transpiler cache.

If runtime was removed and the root lookup link is dangling, or the installed application graph is damaged, run `bun run setup:dependencies --install`. This standalone bootstrap stages a frozen install beneath runtime, validates it, and replaces the graph atomically while retaining the previous installation. Add `--offline` when the runtime package cache is complete. Ordinary warm `bun install` verifies the existing receipt; it refuses modified package bytes rather than accepting them as a new baseline.

```bash
bun autoshow setup --dry-run
bun autoshow setup
```

macOS source builds require Apple's Command Line Tools and SDK. Setup builds additional helpers, including CMake, from pinned upstream source inside `runtime/`; CMake does not require an installed application bundle. Setup does not install system packages or register fonts globally. On Debian/Ubuntu, native package payloads and their dependencies are downloaded, verified, and extracted into `runtime/` without installing them globally.

The managed toolchain includes FFmpeg/ffprobe with ASS rendering, MuPDF, qpdf, Calibre, Tesseract with English data and image codecs, ImageMagick, Pango, Fontconfig, and private fonts. The initial Bun executable launches setup; managed child runtimes are resolved explicitly. Application tools resolve through validated runtime paths. `--bin-dir` selects a tool directory inside the runtime root; global executable discovery is not an installation mechanism.

## Disk and Network Requirements

Allow space for source archives, temporary build trees, installed libraries, tools, and the default whisperfile `tiny`; larger models need additional storage. `--dry-run` previews the selected graph and installation actions without creating runtime state. Cold macOS setup includes compilation. Re-runs verify and reuse compatible assets, interrupted downloads resume, and failed replacements retain the previous working installation.

## Doctor

```bash
bun autoshow setup --doctor
bun autoshow setup --doctor --strict
```

Doctor verifies resolved tool origins, installation receipts, resources, configuration, cookie readability, and API-key presence without installation or live provider calls. On macOS, safe executable probes run in a process sandbox that denies writes and network access. Probes that cannot remain read-only, including the self-extracting `yt-dlp` launcher, Calibre, and whisperfile, are deferred to setup after receipt and payload verification; platforms without that sandbox verify receipts and resources instead of executing those probes. Setup performs the functional codec, font, and rendering checks. Warnings are advisory unless `--strict`, which exits 2 on any readiness warning. Missing optional, unselected keys do not fail strict mode. Native invocations load working-directory `.env`; exported variables win. [Docker injects credentials explicitly](../../docker.md#provider-credentials).

## Runtime Environment Overrides

Provider credentials are listed in `.env.example`. Export overrides before starting the CLI:

- `AUTOSHOW_PROJECT_ROOT` relocates managed tools, mutable runtime storage, and project-relative identity/path helpers. The default saved configuration is `runtime/autoshow.json`; `--config-path` explicitly selects another configuration file. `--bin-dir` changes only binary lookup within the runtime root.
- `AUTOSHOW_OCR_PAGE_REQUEST_TIMEOUT_MS` sets the hosted per-page OCR deadline: integer `1–900000` ms, default `300000`. Whole-document deadlines are separate.
- `AUTOSHOW_SOURCE_IDENTITY_ROOT` and `AUTOSHOW_SOURCE_IDENTITY_ALIAS` must be paired: an absolute local root and normalized absolute POSIX alias without traversal. They map recorded source identities without changing file access.

See [payload limits](../../docker.md#large-provider-responses), [shared budgets](usage.md#shared-runtime-budget), and [internal process-state policy](../../adr/ADR-004-setup-toolchain-and-runtime-configuration.md) for other environment contracts.

## Targeted Setup Steps

`--step` accepts `toolchain`, `ocr`, `rendering`, `alignment`, `yt-dlp`, `defuddle`, `whisperfile`, `calibre`, `all`, `transcription`, or `music`. Each step provisions its own required dependencies. Re-running a step reuses healthy installations and repairs incomplete assets. `--force-redownload` requests replacement of that step's managed artifacts; active installations remain available until replacements pass validation.

macOS targeted steps provision the selected native dependency graph. Debian/Ubuntu steps share one verified distribution baseline, so the first targeted step also downloads the common document, OCR, media, and rendering package closure. Inspect `--dry-run` before starting a cold installation when download size matters.

```bash
bun autoshow setup --step whisperfile
bun autoshow setup --step whisperfile --force-redownload
bun autoshow setup --step ocr
bun autoshow setup --step rendering
bun autoshow setup --step alignment
```

## Model Downloads

Default setup, `--step whisperfile`, and `--step transcription` install only whisperfile `tiny`; `--step music` installs `small.en`. Explicitly selected missing models can download during transcription.

```bash
bun autoshow setup --models tiny.en --models whisperfile:small.en
bun autoshow setup --models whisperfile:medium --models whisperfile:large-v3
```

Bare names and `whisperfile:<model>` are equivalent. Use `setup --help` for the current model list.

## Setting Defaults and Configuration

Defaults live in `runtime/autoshow.json`. Existing `config/autoshow.json` settings remain migration input and are preserved when brought into runtime state. `--config-path` selects an explicit configuration file. These operations save/read configuration without installing tools:

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
