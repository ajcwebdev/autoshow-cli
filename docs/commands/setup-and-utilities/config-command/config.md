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

Default path: `config/autoshow.json` in the project root.

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

`--concurrency-mode ramp` (the native default) starts hosted provider traffic gradually up to the configured cap. `immediate` starts at that cap.

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

`config` has no `--url-provider` flag, so set the URL article backend in `config/autoshow.json` as `defaults.extract.url.provider` (`defuddle`, `firecrawl`, `glm-reader`, `spider`, `supadata`, or `zyte`). Once saved, `extract` and `write` inherit it like any other default.

Generic `--tts-*` options resolve to the selected provider, so they take a bare value when one provider is selected and `provider=value` when several are. Custom-voice provisioning and clone-creation audio files are runtime-only and managed via `voice`; synthesis defaults require an existing provider voice ID.

`--tts-speaker` selects multi-speaker TTS. A saved `--tts-dialogue-format` with no saved `--tts-speaker` is inert: runs that inherit it log a warning and continue as single-speaker.

Cookie auth persists the cookies file path or browser name only. Do not copy cookie-file contents into `config/autoshow.json`.

`default` prompt expansion is `shortSummary + longSummary + longChapters`.

## Precedence

```text
Explicit CLI flags > config file defaults > native CLI defaults
```

Only flags explicitly typed on the command line override config values. Native CLI defaults do not overwrite saved config defaults.

If you type any provider/model selector for a step family at runtime, configured provider selections for that family are replaced instead of merged. For example, passing `--llm openai=...` on `write` suppresses configured Gemini and Groq LLM defaults for that run.

## Pricing And Budgets

Set a hard budget with `--max-cents`. Hosted and mixed-provider commands fail before execution when the estimate exceeds that limit. `--allow-over-budget` is a one-off runtime override and is never persisted.

```bash
bun autoshow config --max-cents 50
```

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
