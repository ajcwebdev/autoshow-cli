# System Overview & CLI Surface

Architecture overview for the CLI, command routing, global flags, provider selectors, and the process command surface.

## Outline

- [System Layers](#system-layers)
- [Dispatch](#dispatch)
- [Command Surface](#command-surface)
- [Flag System](#flag-system)
- [Provider Selectors](#provider-selectors)

## System Layers

```
bun autoshow <command> [<subcommand>] <target> [flags]
            |
            v
+------------------+     +------------------+     +------------------+     +------------------+
| CLI layer        | --> | Target layer     | --> | Processing layer | --> | Output layer     |
| parse + dispatch |     | plan + routing   |     | steps 0-8        |     | manifest + files |
+------------------+     +------------------+     +------------------+     +------------------+
```

1. CLI layer: parse arguments, render help and version, reject unknown flags, and apply global runtime settings.
2. Target layer: resolve the target, merge config defaults, normalize provider selectors, and plan a single run or batch.
3. Processing layer: Step 0 metadata, Step 1 download/detect, Step 2 STT/OCR/article/X extraction, Step 3 LLM writing, Steps 4-7 standalone TTS/image/video/music generation, and Step 8 comic utilities.
4. Output layer: every run or batch root owns one `manifest.json`. Provider directories hold generated artifacts and optional raw `result.json` payloads, not a second control file.

## Dispatch

```
bun autoshow <command> ...
        |
        +--> help?    -> root or command help
        +--> version? -> print package version
        |
        v
unknown flags?
        |
        +--> usage error
        |
        v
apply global runtime settings
        |
        +--> --verbose / --quiet / --json / --log-level / --log-format
        +--> --output-root
        +--> --output-dir
        +--> --characters-root
        +--> --bin-dir
        +--> --color / --no-color
        +--> config cookies for yt-dlp
        |
        v
run the selected command
```

Global flags:

| Flag                    | Effect                                                                                                                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--help`, `-h`          | Show root or command help.                                                                                                                                                                                                                                                                              |
| `--version`, `-v`       | Print CLI version.                                                                                                                                                                                                                                                                                      |
| `--config-path`         | Use a config file other than `config/autoshow.json`.                                                                                                                                                                                                                                                    |
| `--output-root`         | Base output directory under which per-step subdirectories are created.                                                                                                                                                                                                                                  |
| `--output-dir`          | Pin the run directory for this invocation instead of a timestamped `output/<timestamp>_<slug>` directory. On a batch run it becomes the batch root and per-item directories keep their slug names inside it. Rejected by `config`, `setup`, `links`, `resume`, `voice`, and `comic reference-voice`, which do not create run directories. |
| `--characters-root`     | Directory of comic character reference images and `characters-reference.json`. Accepted on `voice` and `comic` only.                                                                                                                                                                                    |
| `--bin-dir`             | Directory of external tool binaries checked before the managed install and PATH.                                                                                                                                                                                                                        |
| `--allow-over-budget`   | Continue after cost preflight exceeds the configured budget. Accepted on priced pipeline and generation commands only; rejected on unbudgeted commands (`config`, `setup`, `links`, `voice`, `comic reference-voice`).                                                                                  |
| `--verbose`             | Enable debug logging.                                                                                                                                                                                                                                                                                   |
| `--quiet`, `-q`         | Suppress non-error output.                                                                                                                                                                                                                                                                              |
| `--json`                | Emit logs as JSON.                                                                                                                                                                                                                                                                                      |
| `--log-level`           | Minimum log level: `debug`, `info`, `success`, `warn`, or `error`.                                                                                                                                                                                                                                      |
| `--log-format`          | Log output format: `human`, `json`, or `both`.                                                                                                                                                                                                                                                          |
| `--color`, `--no-color` | Force ANSI colors on or off instead of auto-detecting the TTY.                                                                                                                                                                                                                                          |

Comic subcommands (`draft-scenes`, `generate-images`, `generate-audio`, `generate-slideshow`, `reference-sketch`, and `reference-voice`) are first-class children of `comic`.

## Command Surface

```
Setup and utilities:
  config    read/write persisted defaults
  setup     install local tools and report provider env readiness
  links     provider documentation/reference link lookup
  resume    rerun missing or failed providers from existing output

Processing and generation:
  metadata  Step 0/1 metadata only
  download  Step 1 download/detect only
  extract   Step 1 + Step 2 extraction
  write     Step 1 + Step 2 + Step 3 text generation
  tts       standalone TTS for .md/.txt files or directories
  voice     standalone voice registration and lifecycle management
  image     standalone image generation
  video     standalone video generation
  music     standalone music generation or local lyric-video rendering
  comic     nested draft-scenes, generate-images, generate-audio, generate-slideshow, reference-sketch, and reference-voice workflows
```

Help and version are built into the root command. Process commands share the same target planning except for standalone generation modes. `extract --transcript-video` runs before normal target processing and renders a captioned video from an existing extract run or from explicit `--audio` plus `--transcript-result`/`--transcript-text`.

## Flag System

Command groups share the same selector model but expose it through different flags:

```
extract/resume
  --provider provider[=model]
  --all-providers
  --all-local
  --provider-concurrency N
  --local-concurrency N

standalone generation
  --provider provider[=model]
  --all-providers
  --provider-concurrency N

write pipeline
  --stt provider[=model]
  --ocr provider[=model]
  --llm provider[=model]
  --all-providers stt|ocr|url|llm
  --all-local stt|ocr|url

config pipeline defaults
  --stt provider[=model]
  --ocr provider[=model]
  --llm provider[=model]
  --tts provider[=model]
  --image provider[=model]
  --video provider[=model]
  --music provider[=model]
```

`extract --provider` is route-aware. A media item maps it to STT providers, a document/image item maps it to OCR providers, and an article route uses URL backend selection. Mixed extract batches are partitioned by route so generic selections are normalized before execution.

## Provider Selectors

Current selector families:

| Step        | Providers                                                                                                                                                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STT         | `whisper`, `whisperfile`, `deepinfra`, `deepgram`, `soniox`, `speechmatics`, `rev`, `groq`, `grok`, `mistral`, `assemblyai`, `gladia`, `happyscribe`, `supadata`, `scrapecreators`, `gemini`, `together`; `youtube-captions` is a special caption-backed service. |
| OCR         | `tesseract`, `mistral`, `glm`, `kimi`, `openai`, `grok`, `anthropic`, `gemini`, `deepinfra`, `replicate`, `fal`.                                                                                                                                                  |
| URL article | `defuddle`, `firecrawl`, `glm-reader`, `spider`, `supadata`, `zyte`.                                                                                                                                                                                              |
| LLM         | `openai`, `groq`, `gemini`, `anthropic`, `minimax`, `grok`, `glm`, `kimi`, `together`, `cerebras`.                                                                                                                                                                |
| TTS         | `elevenlabs`, `minimax`, `groq`, `grok`, `mistral`, `openai`, `gemini`, `deepgram`, `speechify`, `hume`, `cartesia`, `fish`, `inworld`, `deepinfra`, `replicate`, `fal`.                                                                                          |
| Image       | `gemini`, `openai`, `grok`, `bfl`, `replicate`, `lumalabs`, `fal`.                                                                                                                                                                                                |
| Video       | `gemini`, `grok`, `ltx`, `replicate`, `lumalabs`, `fal`. MiniMax video is retired; `--provider minimax` is rejected.                                                                                                                                               |
| Music       | `elevenlabs`, `minimax`, `gemini`.                                                                                                                                                                                                                                |

Command-to-flag mapping:

| Command                       | Primary flags                                                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `metadata`                    | `--save`, document password, URL backend, batch flags.                                                                                 |
| `download`                    | download/media flags, URL backend, batch flags.                                                                                        |
| `extract`                     | STT/OCR/URL selectors, advanced OCR flags, `--youtube-captions`, batch flags, `--price`, `--transcript-video`.                         |
| `write`                       | Step selectors for STT/OCR/URL/LLM, prompt/text-input flags, rendered text flags, batch flags, pricing flags.                          |
| `resume`                      | target-aware provider selectors for missing or failed providers.                                                                       |
| `tts`/`image`/`video`/`music` | standalone generation flags and provider selectors.                                                                                    |
| `voice`                       | standalone voice registration, audition, approval, consent, listing, retirement, and deletion flags.                                   |
| `comic`                       | comic drafting, panel image generation, audio rendering, local slideshow presentation, and reference flags.                            |
| `config`                      | persisted defaults for supported selectors and options; runtime-only flags are ignored.                                                |
