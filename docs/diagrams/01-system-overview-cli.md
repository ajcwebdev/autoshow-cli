# System Overview & CLI Surface

Command surface, routing, global flags, and provider selectors.

## Outline

- [System Layers](#system-layers)
- [Dispatch](#dispatch)
- [Command Surface](#command-surface)
- [Flag System](#flag-system)

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
2. Target layer: resolve the target, merge config defaults, and plan a single run or batch.
3. Processing layer: Step 0 metadata, Step 1 download/detect, Step 2 STT/OCR/article/X extraction, Step 3 LLM writing, Steps 4-7 standalone TTS/image/video/music generation, and Step 8 comic utilities.
4. Output layer: every run or batch root owns one `manifest.json`. Generated files live next to it, with optional per-provider `result.json` payloads.

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
apply global flags and config
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

Help and version are built into the root command. Process commands share the same target planning except for standalone generation modes. `extract --transcript-video` renders a captioned video from an existing extract run or from explicit `--audio` plus `--transcript-result`/`--transcript-text`.

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

`extract --provider` is route-aware. A media item maps it to STT providers, a document/image item maps it to OCR providers, and an article route uses URL backend selection. Mixed extract batches are partitioned by route so generic selections apply to the matching route.

The provider catalog is in [Providers, Models & Setup](04-providers-and-setup.md).
