# config

View or set persistent CLI defaults saved to `config/autoshow.json`.

## Outline

- [Usage](#usage)
- [Config File Location](#config-file-location)
- [Setting Defaults](#setting-defaults)
- [Config Schema](#config-schema)
- [Persisted Defaults](#persisted-defaults)
- [Precedence](#precedence)
- [Pricing And Budgets](#pricing-and-budgets)
- [Recommended Configs](#recommended-configs)
- [Flags](#flags)

## Usage

```bash
bun autoshow config [flags]
bun autoshow config --show
bun autoshow config --reset
```

No input argument is required. Flags passed to `config` are written to `config/autoshow.json` when they map to reusable defaults.

`--show`, `--reset`, and `--config-path` are accepted but never persisted. Per-run inputs such as `--price`, `--password`, `--prompt-md`, and one-shot file, mask, or lyrics flags are rejected as unexpected flags — pass those on the command that uses them. A flag `config` accepts but cannot save is named in a warning and left unsaved.

## Config File Location

Default path: `config/autoshow.json` in the project root (the directory that contains `package.json`).

Override with `--config-path <path>`:

```bash
bun autoshow config --show --config-path ./input/my-autoshow.json
bun autoshow write input/examples/audio/1-audio.mp3 --config-path ./input/my-autoshow.json
```

## Setting Defaults

```bash
bun autoshow config --llm openai=gpt-5.4-mini
bun autoshow config --stt whisper=large-v3-turbo
bun autoshow config --stt happyscribe=auto --stt-happyscribe-organization-id org_123
bun autoshow config --ocr tesseract
bun autoshow config --ocr mistral=mistral-ocr-2512 --ocr-language eng --ocr-dpi 300
bun autoshow config --tts elevenlabs=eleven_v3 --tts-voice voice_123
bun autoshow config --tts gemini=gemini-3.1-flash-tts-preview --tts-speaker Host=Kore --tts-speaker Guest=Puck --tts-chunk-concurrency 3
bun autoshow config --image openai=gpt-image-2 --image-size 1024x1024 --image-count 2
bun autoshow config --video ltx=ltx-2-3-fast --video-duration 8 --video-resolution 1080p
bun autoshow config --batch-limit 20 --batch-order oldest --batch-concurrency 2
bun autoshow config --concurrency-mode immediate
bun autoshow config --prompt shortSummary --prompt longChapters
bun autoshow config --chapters --length 50 --pdf-chapter-mode auto
bun autoshow config --max-cents 100
bun autoshow config --cookies-from-browser chrome
bun autoshow config --cookies /absolute/path/to/runtime/auth/youtube.cookies.txt
```

Model selector flags are repeatable. Repeating a provider selector saves all selected models in first-seen order:

```bash
bun autoshow config --stt deepinfra=openai/whisper-large-v3 --stt deepinfra=openai/whisper-large-v3-turbo
bun autoshow config --llm openai=gpt-5.5 --llm openai=gpt-5.4-mini
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
        "whisper": ["large-v3-turbo"],
        "speakerCount": 2
      },
      "ocr": {
        "tesseract": true,
        "lang": "eng",
        "dpi": 300,
        "chapters": true,
        "length": 50,
        "pdfChapterMode": "auto"
      }
    },
    "llm": {
      "openai": ["gpt-5.4-mini"]
    },
    "post": {
      "tts": {
        "elevenlabsTts": ["eleven_v3"],
        "elevenlabsVoice": "voice_123",
        "ttsSpeakers": ["Host=Kore", "Guest=Puck"]
      },
      "image": {
        "openaiImage": ["gpt-image-2"],
        "imageSize": "1024x1024",
        "imageCount": 2
      },
      "video": {
        "ltxVideo": ["ltx-2-3-fast"],
        "videoDuration": 8,
        "videoResolution": "1080p"
      },
      "music": {
        "minimaxMusic": ["music-3.0"],
        "musicInstrumental": true
      }
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

Model-selecting fields are arrays of models, not single strings. Use `bun autoshow config --show` to inspect the file `config` actually writes.

## Persisted Defaults

### defaults.concurrency

| Field  | Flag                                 |
| ------ | ------------------------------------ |
| `mode` | `--concurrency-mode ramp\|immediate` |

The default mode is `ramp`, which starts hosted provider traffic gradually up to the configured cap. `immediate` starts at that cap. Local engines stay immediate.

### defaults.extract.stt

| Flag family | Examples |
| ----------- | -------- |
| Model selectors | `--stt provider[=model]`, `--youtube-captions` |
| Provider options | `--stt-happyscribe-organization-id`, `--stt-supadata-lang`, `--stt-scrapecreators-lang` |
| Diarization | `--speaker-count`, `--split` |
| Concurrency | `--provider-concurrency`, `--local-concurrency`, `--stt-segment-concurrency`, `--stt-preflight-concurrency` |

### defaults.extract.ocr

| Flag family | Examples |
| ----------- | -------- |
| Engine and models | `--ocr tesseract`, `--ocr provider[=model]` |
| Tuning | `--ocr-language`, `--format`, `--ocr-dpi`, `--ocr-concurrency`, `--ocr-provider-mode` |
| Chapters | `--chapters`, `--length`, `--pdf-chapter-mode` |
| Concurrency | `--provider-concurrency`, `--local-concurrency` |

`--ocr-language` is saved as `lang`, `--format` as `out`, and `--ocr-dpi` as `dpi`.

### defaults.extract.url

`config` has no `--url-provider` flag, so this default has to be written into `config/autoshow.json` by hand as `defaults.extract.url.provider` (`defuddle`, `firecrawl`, `glm-reader`, `spider`, `supadata`, or `zyte`). Once saved, `extract` and `write` inherit it like any other default.

### defaults.llm

| Flag family | Examples |
| ----------- | -------- |
| Model selectors | `--llm provider[=model]` |
| Concurrency | `--provider-concurrency`, `--local-concurrency` |

### defaults.post.tts

| Flag family | Examples |
| ----------- | -------- |
| Model selectors | `--tts provider[=model]` |
| Shared synthesis | `--tts-voice`, `--tts-language`, `--tts-speed`, `--tts-text-normalization`, `--tts-instructions`, `--tts-dialogue-format`, `--tts-speaker` |
| Provider synthesis | `--elevenlabs-tts-*`, `--minimax-tts-*` |
| Concurrency | `--provider-concurrency`, `--local-concurrency`, `--tts-chunk-concurrency` |

Generic `--tts-*` options resolve to the selected provider, so they take a bare value when one provider is selected and `provider=value` when several are. Custom-voice provisioning and clone-creation audio files are runtime-only and managed via `voice`; synthesis defaults require an existing provider voice ID.

`ttsSpeakers` is what selects multi-speaker TTS, so a saved `ttsDialogueFormat` with no saved `ttsSpeakers` is inert: runs that inherit it log a warning and continue as single-speaker.

### defaults.post.image

| Flag family | Examples |
| ----------- | -------- |
| Model selectors | `--image provider[=model]` |
| Reusable options | `--image-aspect-ratio`, `--image-size`, `--image-quality`, `--image-format`, `--image-background`, `--image-count` |
| Concurrency | `--provider-concurrency`, `--local-concurrency` |

One-shot image inputs, masks, and edit controls are per-generation flags accepted by processing commands and rejected by `config`.

### defaults.post.video

| Flag family | Examples |
| ----------- | -------- |
| Model selectors | `--video provider[=model]` |
| Reusable options | `--video-duration`, `--video-aspect-ratio`, `--video-resolution`, `--video-mode`, `--video-generate-audio` |
| Reference inputs | `--video-input-image`, `--video-last-frame`, `--video-reference-image`, `--video-input-video`, `--video-reference-video`, `--video-reference-audio` |
| Replicate options | `--replicate-video-seed`, `--replicate-video-negative-prompt` |
| Concurrency | `--provider-concurrency`, `--local-concurrency` |

### defaults.post.music

| Flag family | Examples |
| ----------- | -------- |
| Model selectors | `--music provider[=model]` |
| Reusable options | `--music-duration`, `--music-instrumental` |
| Concurrency | `--provider-concurrency`, `--local-concurrency` |

One-shot lyrics files describe single generations and are not persisted defaults.

### defaults.batch, defaults.prompts, pricing, auth

| Field | Flag |
| ----- | ---- |
| `defaults.batch.limit`, `defaults.batch.order`, `defaults.batch.concurrency` | `--batch-limit`, `--batch-order`, `--batch-concurrency` |
| `defaults.prompts` | repeated `--prompt` |
| `pricing.maxCents` | `--max-cents` |
| `auth.cookies` | `--cookies` |
| `auth.cookiesFromBrowser` | `--cookies-from-browser` |

Cookie auth persists the cookies file path or browser name only. Do not copy cookie-file contents into `config/autoshow.json`.

`default` prompt expansion is `shortSummary + longSummary + longChapters`.

## Precedence

```text
Explicit CLI flags > config file defaults > native CLI defaults
```

Only flags explicitly typed on the command line override config values. Native CLI defaults do not overwrite saved config defaults.

An explicit `--concurrency-mode` overrides `defaults.concurrency.mode`; otherwise the saved value overrides the native `ramp` default.

If you type any provider/model selector for a step family at runtime, configured provider selections for that family are replaced instead of merged. For example, passing `--llm openai=...` on `write` suppresses configured `defaults.llm.gemini` and `defaults.llm.groq` entries for that run.

## Pricing And Budgets

Hosted or mixed-provider process and generation commands run cost preflight before execution.

To show the estimate and exit:

```bash
bun autoshow write input/examples/audio/1-audio.mp3 --price
```

Set a hard budget:

```bash
bun autoshow config --max-cents 50
```

When the estimate exceeds the limit, the command fails before execution. Use `--allow-over-budget` for a one-off runtime override; it is never persisted.

## Recommended Configs

### All-local

```bash
bun autoshow config \
  --stt whisper=tiny \
  --ocr tesseract
```

Write has no local LLM. TTS, image, video, and hosted music generation have no local provider defaults.

### Low-cost hosted defaults

```bash
bun autoshow config \
  --stt groq=whisper-large-v3-turbo \
  --llm groq=openai/gpt-oss-20b \
  --tts minimax=speech-2.8-turbo \
  --image openai=gpt-image-2 --image-quality low \
  --video ltx=ltx-2-3-fast \
  --music minimax=music-3.0
```

## Flags

`bun autoshow config --help` is the authoritative generated flag list for this command.

Command flags:

| Flag      | Description                                     |
| --------- | ----------------------------------------------- |
| `--show`  | Print resolved config path and effective config |
| `--reset` | Clear the config file                           |

Global flags:

| Flag                             | Description                   |
| -------------------------------- | ----------------------------- |
| `--config-path`                  | Path to config file           |
| `--verbose`, `--quiet`, `--json` | Runtime-only logging controls |
