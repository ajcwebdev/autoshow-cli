# System Overview & CLI Surface

Architecture overview for the native CLI, command routing, global flags, provider selectors, and current process command surface.

## Outline

- [System Layers](#system-layers)
- [Native Dispatch](#native-dispatch)
- [Command Surface](#command-surface)
- [Flag System](#flag-system)
- [Provider Selectors](#provider-selectors)

## System Layers

```
bun autoshow <command> <target> [flags]
            |
            v
+------------------+     +------------------+     +------------------+     +------------------+
| CLI layer        | --> | Target layer     | --> | Processing layer | --> | Output layer     |
| native parser    |     | plan + routing   |     | steps 0-8        |     | schema v2 files  |
+------------------+     +------------------+     +------------------+     +------------------+
```

1. CLI layer: `src/cli/create-cli.ts` registers the root definition, global flags, command groups, and per-command definitions. `src/cli/native/*` parses argv, renders help/version output, rejects unknown flags where appropriate, and builds the command context.
2. Target layer: `handleProcessTarget()` resolves the target, merges config defaults, normalizes selectors, builds `RuntimeOptions`, calls `resolveProcessTargetPlan()`, and for single extract/write items calls `resolveInputRoutingForCommand()`.
3. Processing layer: Step 0 metadata, Step 1 download/detect, Step 2 STT/OCR/article/X extraction, Step 3 LLM writing, Steps 4-7 TTS/image/video/music generation, and Step 8 comic utilities.
4. Output layer: `run.json`, `batch.json`, `extract-batch.json`, and provider `result.json` artifacts use schema version 2 envelopes.

## Native Dispatch

```
src/cli/create-cli.ts
        |
        v
dispatchNativeCli(argv, root, commands)
        |
        v
parseNativeCli()
        |
        +--> help?    -> renderRootHelp() or renderCommandHelp()
        +--> version? -> print package version
        |
        v
unknown global/command flags?
        |
        +--> reject unless command.allowUnknownFlags is true
        |
        v
apply global runtime settings
        |
        +--> --verbose / --quiet / --json / --log-level / --log-format -> logger
        +--> --output-root                -> base output directory
        +--> --output-dir                 -> pinned run directory for this invocation
        +--> --bin-dir                    -> external tool binary lookup
        +--> --color / --no-color         -> ANSI color handling
        +--> --cookies / --cookies-from-browser -> yt-dlp auth
        +--> --model-path                 -> llama.cpp local model override
        |
        v
run command handler under log context
        |
        v
debug log elapsed time
```

Global flags:

| Flag | Effect |
|------|--------|
| `--help`, `-h` | Show root or command help. |
| `--version`, `-v` | Print CLI version. |
| `--config-path` | Use a config file other than `config/autoshow.json`. |
| `--output-root` | Base output directory under which per-step subdirectories are created. |
| `--output-dir` | Pin the run directory for this invocation instead of a timestamped `output/<timestamp>_<slug>` directory. On a batch run it becomes the batch root and per-item directories keep their slug names inside it. Rejected by `config`, `setup`, `links`, and `resume`, which do not create run directories. |
| `--bin-dir` | Directory of external tool binaries checked before the managed install and PATH. |
| `--allow-over-budget` | Continue after cost preflight exceeds the configured budget. |
| `--verbose` | Enable debug logging. |
| `--quiet`, `-q` | Suppress non-error output. |
| `--json` | Emit logs as JSON. |
| `--log-level` | Minimum log level: `debug`, `info`, `success`, `warn`, or `error`. |
| `--log-format` | Log output format: `human`, `json`, or `both`. |
| `--color`, `--no-color` | Force ANSI colors on or off instead of auto-detecting the TTY. |
| `--cookies` | Pass a cookies.txt file to authenticated yt-dlp downloads. |
| `--cookies-from-browser` | Import browser cookies through yt-dlp. |
| `--model-path` | Use a local GGUF file for llama.cpp. |

Two commands intentionally use looser native parsing:

- `links` allows unknown flags because selector-like tokens are parsed by the command itself.
- `comic` allows unknown flags, excess parameters, and help after the first positional argument so its legacy subcommand parser can receive pass-through argv. Public comic subcommands are `draft-scenes`, `generate-images`, and `reference-sketch`.

## Command Surface

```
Core:
  help/version behavior is native to the root parser.

Setup and utilities:
  config    read/write persisted defaults
  setup     install local tools and report provider env readiness
  links     provider documentation/reference link lookup
  resume    rerun missing or failed providers from existing output
  benchmark local benchmark helpers

Processing and generation:
  metadata  Step 0/1 metadata only
  download  Step 1 download/detect only
  extract   Step 1 + Step 2 extraction
  write     Step 1 + Step 2 + Step 3, optionally Steps 4-7
  tts       standalone TTS for .md/.txt files or directories
  image     standalone image generation
  video     standalone video generation
  music     standalone music generation or local lyric-video rendering
  comic     comic workflow pass-through commands
```

Process commands enter the shared target layer except for special standalone generation modes. `extract --transcript-video` is handled before normal target processing and renders a captioned video from an existing extract run or from explicit `--audio` plus `--transcript-result`/`--transcript-text`.

## Flag System

Command groups share the same normalized selector model but expose it through different flags:

```
extract/resume/standalone generation
  --provider provider[=model]
  --all-providers
  --all-local
  --provider-concurrency N
  --local-concurrency N

write/config pipeline defaults
  --stt provider[=model]
  --ocr provider[=model]
  --llm provider[=model]
  --tts provider[=model]
  --image provider[=model]
  --video provider[=model]
  --music provider[=model]
  --all-providers stt|ocr|url|llm|tts|image|video|music
  --all-local stt|ocr|url|llm|tts
```

`extract --provider` is route-aware. A media item maps it to STT providers, a document/image item maps it to OCR providers, and an article route uses URL backend selection. Mixed extract batches are partitioned by route so generic selections are normalized before execution.

## Provider Selectors

Current selector families:

| Step | Providers |
|------|-----------|
| STT | `whisper`, `whisperfile`, `reverb`, `deepinfra`, `deepgram`, `soniox`, `speechmatics`, `rev`, `groq`, `grok`, `mistral`, `assemblyai`, `gladia`, `happyscribe`, `supadata`, `scrapecreators`, `gemini`, `together`; `youtube-captions` is a special caption-backed service. |
| OCR | `tesseract`, `mistral`, `glm`, `kimi`, `openai`, `grok`, `anthropic`, `gemini`, `deepinfra`. |
| URL article | `defuddle`, `firecrawl`, `glm-reader`, `spider`, `supadata`, `zyte`. |
| LLM | `llama`, `llamafile`, `openai`, `groq`, `gemini`, `anthropic`, `minimax`, `grok`, `glm`, `kimi`, `together`, `cerebras`. |
| TTS | `kitten`, `elevenlabs`, `minimax`, `groq`, `grok`, `mistral`, `openai`, `gemini`, `deepgram`, `speechify`, `hume`, `cartesia`. |
| Image | `gemini`, `openai`, `grok`, `bfl`, `recraft`, `replicate`, `lumalabs`, `fal`. |
| Video | `gemini`, `minimax`, `glm`, `grok`, `runway`, `ltx`, `replicate`, `lumalabs`, `fal`. |
| Music | `elevenlabs`, `minimax`, `gemini`. |

Command-to-flag mapping:

| Command | Primary flags |
|---------|---------------|
| `metadata` | `--save`, document password, URL backend, batch flags. |
| `download` | download/media flags, URL backend, batch flags. |
| `extract` | STT/OCR/URL selectors, advanced OCR flags, `--youtube-captions`, batch flags, `--price`, `--transcript-video`. |
| `write` | Step selectors for STT/OCR/URL/LLM/TTS/image/video/music, prompt/text-input flags, rendered text flags, batch flags, generation flags. |
| `resume` | target-aware provider selectors for missing or failed providers. |
| `tts`/`image`/`video`/`music` | standalone generation flags and provider selectors. |
| `config` | persisted defaults for supported selectors and options; runtime-only flags are ignored. |
